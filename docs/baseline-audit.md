# Baseline audit — État réel du MVP en prod (2026-05-24)

> Capture du comportement runtime observé sur `coaching-app-mvp.vercel.app` après login + onboarding 11 étapes + un check-in quotidien.
> Source de vérité pour le brief V1 extensions et pour tout futur contributeur.

## Stack confirmée en runtime

| Couche | Implémentation observée |
|---|---|
| Frontend | Next.js 16 App Router (Turbopack) sur Vercel `fra1` (Frankfurt EU) |
| Auth | Firebase Auth + Google OAuth (One Tap absent → Google popup standard) |
| Database | Firestore accédé directement depuis le client (Web SDK) — persistence IndexedDB activée |
| AI | Vertex AI Gemini 2.5 Pro via `/api/ai/daily-insight` (et `/api/ai/coach` SSE) |
| Feature flags | Firebase Remote Config — base IndexedDB `firebase_remote_config` détectée |
| PWA | `manifest.json` SVG icons servis (fix post-audit) |

## Identifiants techniques

- **Projet Firebase** : `linsociable-coaching`
- **Région** : `europe-west1` (Firestore, Storage, Vertex AI) / `fra1` (Vercel front)
- **Profil de test** : Audrey, 187 cm, 132.5 kg → 115 kg cible (IMC 37.9 → parcours `high-bf`)

## Schéma Firestore réel `users/{uid}` (capté en live)

```
users/{uid}
├─ uid                : string
├─ onboarding_step    : int (0–11)
├─ plan_current_id    : string (ref)
├─ profile            : map { name, height, activity_level, sex, dob, timezone, profession, ... }
├─ baseline           : map { weight, bf_pct, measurements{}, photos{} }
├─ fitness            : map { historique sportif }
├─ goals              : map { type, target_weight, target_date, target_bf }
├─ medical            : map { conditions[], medications[], allergies[], last_bloodwork_date }
├─ nutrition          : map { préférences }
├─ settings           : map { notifications, units, language }
├─ subscription       : map { tier, stripe_customer_id, stripe_sub_id, current_period_end }
│
├─ checkins_daily/{YYYY-MM-DD}  : map (cf. ci-dessous)
└─ plans/{planId}                : map (cf. ci-dessous)
```

### `checkins_daily/{YYYY-MM-DD}` (capté en live)

```typescript
{
  weight: number,                  // kg, ex: 131.8
  steps: number,                   // int
  sleep_hours: number,
  sleep_quality: number,           // 0-10
  energy: number,                  // 0-10
  hunger: number,                  // 0-10
  mood: number,                    // 0-10
  adherence_nutrition: number,     // 0-100 (%)
  training_done: boolean,
  notes: string,
  created_at: string,              // ISO timestamp
}
```

### `plans/{planId}` (capté en live)

```typescript
{
  active: boolean,
  source: "ai" | "manual",
  date_start: string,              // YYYY-MM-DD
  kcal: number,
  macros: { p, c, f },
  meals_template: [...],
  supplements: [...],
  training: { ... },
  cardio: { ... },
  justification: string,           // narratif Gemini personnalisé
  lifestyle_notes: string,         // ★ moteur de contextualisation IA déjà présent
  created_at: string,
}
```

## Flux backend confirmé

### Check-in quotidien
```
User submit → Firestore write checkins_daily/{date}
            → securetoken.googleapis.com refresh
            → POST /api/ai/daily-insight (200)
            → Gemini Flash renvoie insight personnalisé contextualisé
            → render UI "Insight du jour"
```

Insight de test reçu : *"Audrey, quelle belle journée ! Tu as assuré à 100% tes repas et ton entraînement, avec un excellent sommeil en prime. C'est une super dynamique, continue sur cette lancée !"*

→ Ton conforme au brief : factuel, court, tutoiement, pas de moralisme.

### Génération de plan (onboarding step 11)
```
POST /api/ai/generate-plan → safety pre-check (IMC<18.5)
                          → fetch users/{uid} (profile + goals + medical + baseline)
                          → detectProfilePath (high-bf, glp1, ex-athlete, ...)
                          → Vertex AI Pro avec responseSchema
                          → Zod parse + Firestore transaction (deactivate ancien + create new)
                          → return planId
```

## Observations clés pour les extensions

### 1. Moteur de contextualisation IA déjà présent
Le champ `plans/{planId}.lifestyle_notes` montre que Gemini a déjà accès à un contexte riche (sommeil, hydratation, profil santé) et produit du coaching narratif personnalisé.
**Implication V1** : M9 (RAG sourcing), M19 (smart notifs), M16 (bloodwork) doivent s'**étendre** ce moteur, pas le doubler.

### 2. `subscription` map pré-existante
Le champ `subscription` existe déjà même sans UI Premium. M20 (Stripe portal avancé) = **enrichissement**, pas création from scratch.

### 3. Remote Config déjà actif côté client
Pas besoin d'initialiser RC — il l'est déjà. `lib/features/flags.ts` se branche sur l'instance existante.

### 4. Snake_case partout
Toutes les clés Firestore observées sont snake_case. Toute nouvelle collection ou champ V1 doit suivre cette convention (cf. ADR-006).

### 5. Convention map vs sous-collection
- **Maps imbriquées** : données one-shot par user (médical, profil, goals)
- **Sous-collections** : append-only ou time-series (checkins, plans, food_logs, coach_messages)

Donc M4 GLP-1 devrait migrer vers `users/{uid}.medical.glp1 = { molecule, dose, start_date, side_effects }` plutôt que sous-collection.

### 6. Bug PWA icon 404 (corrigé post-audit)
`/icons/icon-192.png` retournait 404 (les PNGs n'existaient pas). Fix : SVG icons inline servis depuis `/icons/icon.svg` et `/icons/icon-maskable.svg`. Manifest mis à jour.

## Estimation V1 révisée

| Source | Estimation fichiers |
|---|---|
| Brief V1 original (350-400) | overestimé |
| **Audit révisé** | **280-320 fichiers** |

Réductions venant de :
- Réutilisation du moteur de contextualisation (M9 + M19 + M16 mutualisent)
- Maps existantes étendues vs nouvelles collections (M4, M10)
- Remote Config infra déjà en place
- Schemas réutilisables (food-logs canonique pour M1+M2+M3+M14)

## Fondations à poser avant les modules V1 (Phase A.0)

1. **`lib/features/food-logs/schema.ts`** ✓ fait — Zod canonical schema pour M1/M2/M3/M14 (snake_case, source enum, totals auto)
2. **`users/{uid}.medical.glp1` map convention** — refactor M4 backlog
3. **Index Firestore food_logs (date desc, loggedAt desc)** ✓ déjà dans `firestore.indexes.json`
4. **Pattern "contextualization extension"** documenté : tout module qui touche au coaching doit s'intégrer dans `lifestyle_notes` generation, pas créer son propre prompt

## Routes confirmées en prod

Pages : `/dashboard`, `/plan`, `/coach`, `/progress` (3 sous-onglets), `/settings`, `/checkin/daily`, `/onboarding/[step]`

API : `/api/ai/daily-insight`, `/api/ai/coach`, `/api/ai/generate-plan`, `/api/ai/weekly-review`, `/api/ai/analyze-photo`, `/api/stripe/{checkout,portal}`, `/api/auth/session`, `/api/user/export`, `/api/admin/metrics`, `/api/health`

Public : `/`, `/login`, `/setup`, `/api/health`, `/manifest.json`, `/sw.js`
