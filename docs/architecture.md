# Architecture — Coaching App MVP

Source de vérité : `briefs/coaching-app-mvp.md` + `briefs/coaching-app-v1-extensions.md`

## ADR-001 — Hosting Firebase Hosting + Cloud Run

**Statut** : Accepté — 2026-05-24
**Décideur** : Humbolo

### Contexte
Le brief MVP §3.1 impose Firebase Hosting + Cloud Run en région europe-west1 pour la conformité RGPD. Un `netlify.toml` avait été ajouté pendant le scaffolding initial.

### Décision
Cible production = Firebase Hosting (frameworks-aware) + Cloud Run europe-west1 + Cloud Functions Gen 2 europe-west1.
`netlify.toml` conservé pour des previews de PR temporaires uniquement, jamais comme cible prod.

### Conséquences
- Tous les jobs schedulés vivent dans `functions/src/` (Gen 2)
- Les secrets vivent dans Google Secret Manager (référence via `defineSecret`)
- Le déploiement passe par `firebase deploy` (hosting + functions + rules + indexes)
- Le coût Cloud Run > Netlify pour le trafic faible, mais conformité RGPD acquise et intégration native FCM/Firestore/Auth

## ADR-002 — Safety layer obligatoire en amont des appels IA

**Statut** : Accepté — 2026-05-24

### Contexte
Le brief §4 impose des garde-fous TCA/3114/IMC/perte rapide. Le prompt safety était présent (`lib/vertex/prompts/safety-layer.ts`) mais jamais appelé.

### Décision
- `lib/vertex/safety.ts` expose `runSafetyCheck(text, ctx)` et `checkUserBaseline(ctx)`
- Fast-path local (regex + IMC) sans appel Vertex pour les cas évidents (latence et coût)
- Deep check Vertex Flash optionnel via `SAFETY_DEEP_CHECK=1` (désactivé par défaut)
- Branché dans `/api/ai/coach` (avant tout appel modèle) et `/api/ai/generate-plan` (avant génération)
- Réponse 403 avec message FR + ressource (3114 / FFAB) si flagged

### Conséquences
- Coût ~0 pour le fast-path
- Faux négatifs possibles (regex limitée) — activer le deep check en prod conseillé après calibration
- Tests dans `lib/vertex/safety.test.ts`

## ADR-003 — Auth session via cookie httpOnly + middleware racine

**Statut** : Accepté — 2026-05-24

### Contexte
La protection des routes `(app)/*` était purement client-side (`app/(app)/layout.tsx`). En SSR, les pages flashaient avant la redirection.

### Décision
- `middleware.ts` racine bloque toutes les routes non publiques sans cookie `__session`
- `app/api/auth/session/route.ts` mint un cookie via `adminAuth.createSessionCookie()` (5 jours)
- `components/auth/auth-provider.tsx` POST le ID token vers `/api/auth/session` à chaque `onAuthStateChanged`
- API routes restent protégées par `withAuth()` qui vérifie le Bearer token (compatible JS clients existants)

### Conséquences
- Plus de flash de page protégée en SSR
- Double mécanisme (cookie SSR + Bearer API) → maintenir les deux synchronisés
- Mock auth gated derrière `ENABLE_MOCK_AUTH=1` + `NODE_ENV != production`

## ADR-007 — Context-extension pattern pour les routes AI conversationnelles

**Statut** : Accepté — 2026-05-24

### Contexte
Le MVP a déjà un moteur de contextualisation Vertex AI (`plans/{planId}.lifestyle_notes` est généré avec accès au profil complet). Plusieurs modules V1 (M9 RAG sourcing, M16 bloodwork, M19 smart notifs) auraient dupliqué ce pipeline si laissés indépendants.

### Décision
Toute route AI doit utiliser **`lib/vertex/context-builder.ts`** :

```ts
import { buildEnrichedSystemPrompt, buildUserContext } from '@/lib/vertex/context-builder';

const ctx = buildUserContext({ userData, activePlan, bloodwork, ragSources });
const systemPrompt = buildEnrichedSystemPrompt(BASE, ctx, {
  includeBloodwork: flags.bloodworkUpload(),
  includeRag: flags.ragSourcing(),
});
```

Le builder applique en cascade : profile → active_plan → profile_path → glp1 → fasting → bloodwork → rag → notification_context. Chaque bloc est opt-in.

### Conséquences
- M9, M16, M19 enrichissent `UserContext` via leur loader, pas leur propre pipeline
- Le ton (tutoiement, pas de "régime", citations strictes) reste uniforme
- Ajouter un bloc = 1 fn + registre + 1 test
- Lint `npm run lint:snake-case` enforced (ADR-006)

### Migration
Routes existantes (`coach`, `generate-plan`) à refactorer progressivement pour utiliser le builder. Migration M4 GLP-1 vers `medical.glp1` map déjà faite (cf. ADR-006).

## ADR-006 — Conventions Firestore : snake_case + maps imbriquées vs sous-collections

**Statut** : Accepté — 2026-05-24 (issu de l'audit live MVP)

### Contexte
L'audit live du MVP en prod a révélé que **toutes** les collections et tous les champs Firestore existants utilisent **snake_case** : `checkins_daily`, `adherence_nutrition`, `plan_current_id`, `training_done`, `lifestyle_notes`. Plusieurs PRs d'extensions avaient introduit du camelCase (`fastingProtocol`, `streakCurrent`) ou kebab-case (`food-logs`).

Par ailleurs, le schéma `users/{uid}` est **fortement structuré en maps imbriquées** : `profile`, `baseline`, `fitness`, `goals`, `medical`, `nutrition`, `settings`, `subscription`. Le brief V1 §M4 (GLP-1) prévoyait pourtant une sous-collection `users/{uid}/medications/glp1` séparée.

### Décision
**Convention obligatoire** :
- Snake_case partout (collections, sous-collections, champs)
- Données médicales / profil → **étendre les maps existantes** (`medical.glp1`, `profile.tdee_adaptive`, etc.)
- Données temporelles ou listables → **sous-collections** (`food_logs/{logId}`, `checkins_daily/{date}`, `coach_messages/{msgId}`)
- Compteurs single-instance → **sous-collection d'un seul doc** (`streak/current`) ou map sur user (`analytics.weight_avg_7d`)

### Migration des extensions actuelles
- GLP-1 : `users/{uid}/medications/glp1` → `users/{uid}.medical.glp1` (M4 refactor backlog)
- Schemas V1 modules : aligner sur snake_case (déjà fait dans `lib/features/food-logs/schema.ts`)

### Conséquences
- Cohérence requêtes Firestore (un seul style à indexer)
- Réduction des lectures (1 `getDoc(users/{uid})` charge déjà tout le profil métier)
- Sous-collections réservées aux données append-only ou time-series

## ADR-005 — Middleware Edge runtime : guard cookie en présence, pas en validité crypto

**Statut** : Accepté avec limitation connue — 2026-05-24

### Contexte
Next.js middleware s'exécute **uniquement sur le runtime Edge** (V8 isolates, pas Node). Les modules `firebase-admin` (requis pour `verifySessionCookie`) ne sont pas disponibles. Conséquence : impossible de vérifier cryptographiquement le cookie `__session` dans le middleware sans un appel HTTP supplémentaire vers un endpoint Node-runtime (latence doublée par requête).

### Décision
- Le middleware ne vérifie que la **présence** du cookie `__session` (soft guard, anti-flash SSR)
- La vraie sécurité vient :
  1. de `withAuth()` qui vérifie le **Bearer token Firebase** sur chaque appel API serveur-side
  2. du client Firebase Auth qui rejette toute session invalide (redirige vers `/login` via `(app)/layout.tsx`)
- Un attaquant ayant un faux cookie verra brièvement le squelette de l'app (loading state) puis sera redirigé client-side

### Conséquences acceptées
- Risque résiduel = **info disclosure faible** (structure des routes protégées)
- Pour réduire ce risque, option future : ajouter `await fetch('/api/auth/verify')` dans le middleware (Node runtime), +50ms latency par request
- Préférer cette option uniquement si une donnée sensible apparait en SSR sans guard client (situation actuelle : aucune page n'affiche de PII en SSR sans `useAuth()`)

## ADR-004 — Feature flags : Remote Config → env vars → localStorage (dev only)

**Statut** : Accepté — 2026-05-24

### Contexte
Le brief V1 §4.1 impose Firebase Remote Config. L'implémentation initiale n'utilisait qu'env vars + localStorage (insécurisé : un user pouvait activer Premium via DevTools).

### Décision
`lib/features/flags.ts` résout dans l'ordre :
1. Remote Config (cache 5 min)
2. Env vars `FEATURE_*` / `NEXT_PUBLIC_FEATURE_*`
3. localStorage `feature_<key>` (uniquement si `NODE_ENV === 'development'`)
4. Défaut `false`

Pour les features Premium, le gating tier-Stripe (`canAccessFeature`) doit être appliqué côté serveur en plus du flag.

## Structure du projet (résumé)

```
/
├── middleware.ts                          # auth guard racine
├── firebase.json                          # hosting + functions + rules + indexes
├── firestore.rules                        # content/* admin-only, users/* owner-only
├── firestore.indexes.json                 # composites coach_messages, plans, alerts, ...
├── app/
│   ├── api/auth/session/route.ts          # mint cookie httpOnly
│   ├── api/ai/{coach,generate-plan,weekly-review,daily-insight,analyze-photo}/
│   ├── api/stripe/{checkout,portal,webhook}/
│   └── (app)/settings/subscription/
├── lib/
│   ├── vertex/
│   │   ├── client.ts                      # generateText + generateTextStream
│   │   ├── safety.ts                      # runSafetyCheck + checkUserBaseline
│   │   └── prompts/                       # versionnés
│   ├── stripe/{client,server,subscription,hooks}.ts
│   └── features/flags.ts                  # RC → env → localStorage(dev)
├── functions/                             # Cloud Functions Gen 2 europe-west1
│   └── src/{nightly-analysis,on-checkin-write,alerts-monitor,data-export-purge,smart-notifications-cron,tdee-recalc-weekly,wearable-sync-nightly,stripe-webhook}.ts
└── public/
    ├── manifest.json                      # PWA standalone
    ├── sw.js                              # service worker offline-first
    ├── firebase-messaging-sw.js           # FCM background
    └── icons/                             # 192/512/maskable (à fournir)
```
