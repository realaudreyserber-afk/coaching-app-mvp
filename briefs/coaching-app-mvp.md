# BRIEF — Coaching App MVP (Web + Android wrap)

**Filename** : `briefs/coaching-app-mvp.md`
**Orchestrator** : Antigravity + Gemini 3 Pro
**Build target** : MVP web déployable + base prête pour wrap Android

---

## 1. Objective

Construire un MVP web complet d'application de coaching IA pour perte de poids et recomposition, déployable sur Firebase Hosting en region europe-west, conçu pour être wrappé ensuite en application Android native via Capacitor sans refonte.

---

## 2. Context

**Produit** : application web (PWA-first) qui remplace un coach humain par un agent IA Gemini 2.5 Pro, avec onboarding complet, check-ins quotidien et hebdomadaire, génération de plan personnalisé, coach conversationnel, suivi photo, ajustements automatiques.

**Cible** : adultes 25-50 ans, BF% > 25%, francophones, budget contraint, lassés du coaching humain hors de prix.

**Phase actuelle** : MVP fonctionnel pour validation marché et premier flux payant Stripe. Le wrap Android viendra en phase 2 via Capacitor, donc tout le code web doit être PWA-compliant et éviter les API non disponibles en WebView Android.

**Hors scope MVP** : intégrations wearables (Garmin, Withings), mode vocal, marketplace coachs humains, multilingue. Ces modules viendront en V1.

---

## 3. Technical Specs

### 3.1 Stack figée

```
Frontend       : Next.js 15 App Router + TypeScript + React 19
Styling        : Tailwind CSS 4 + shadcn/ui + Lucide icons
État           : Zustand pour client state, TanStack Query pour server state
Forms          : React Hook Form + Zod validation
Charts         : Recharts
Animations     : Framer Motion
PWA            : next-pwa avec service worker, manifest complet, icons 192/512/maskable

Auth           : Firebase Authentication + Google Identity Services (One Tap)
DB             : Firestore (mode native, region europe-west1)
Storage        : Cloud Storage for Firebase (region europe-west1)
Backend logic  : Next.js Route Handlers (app/api) + Cloud Functions Gen 2 pour tâches programmées
LLM            : Vertex AI Gemini 2.5 Pro (coaching, analyse, plan) + Gemini 2.5 Flash (insights, parsing)
Vision         : Vertex AI Gemini multimodal (photos progrès, bilans sanguins)

Hosting        : Firebase Hosting + Cloud Run pour SSR Next.js
Paiements      : Stripe (subscriptions + Customer Portal)
Email          : SendGrid via GCP Marketplace
Notifications  : Firebase Cloud Messaging (push web, ready pour Android)
Analytics      : Firebase Analytics + GA4
Monitoring     : Sentry + Firebase Crashlytics (V1)
Secrets        : Google Secret Manager
CI/CD          : Cloud Build + GitHub Actions
```

### 3.2 Contraintes critiques

- **PWA strict** : tout doit fonctionner en standalone offline-first sur les écrans déjà visités. Aucune API browser non supportée en Android WebView (pas de Web Bluetooth, pas de Web NFC, pas de File System Access).
- **Region europe-west1** pour tout : Firestore, Storage, Cloud Functions, Cloud Run, Vertex AI. RGPD impose hébergement EU.
- **Tutoiement systématique** dans toute l'UI et tous les prompts IA. Cohérence ton coaching FR.
- **Pas de mention "régime"** dans l'UI — utiliser "plan nutritionnel", "objectif", "phase".
- **Mobile-first** : tout designé d'abord à 375px, puis étendu desktop. Le wrap Android sera la cible principale.
- **Préparation Capacitor** : éviter window.open, éviter les iframes pour OAuth (utiliser native Google Sign-In compatible), encapsuler tout appel browser-API derrière un wrapper qui pourra être remplacé par un plugin Capacitor.

### 3.3 Structure de fichiers cible

```
/
├── AGENTS.md
├── README.md
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── .env.local.example
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
│
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          # landing
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── callback/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx                    # auth guard + nav
│   │   ├── dashboard/page.tsx
│   │   ├── onboarding/
│   │   │   ├── page.tsx
│   │   │   └── [step]/page.tsx
│   │   ├── checkin/
│   │   │   ├── daily/page.tsx
│   │   │   └── weekly/page.tsx
│   │   ├── plan/page.tsx
│   │   ├── coach/page.tsx                # chat IA
│   │   ├── progress/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       ├── ai/
│       │   ├── chat/route.ts
│       │   ├── generate-plan/route.ts
│       │   ├── weekly-review/route.ts
│       │   ├── daily-insight/route.ts
│       │   └── analyze-photo/route.ts
│       ├── stripe/
│       │   ├── webhook/route.ts
│       │   └── portal/route.ts
│       └── user/
│           ├── delete/route.ts
│           └── export/route.ts
│
├── components/
│   ├── ui/                               # shadcn primitives
│   ├── auth/
│   ├── onboarding/
│   ├── checkin/
│   ├── dashboard/
│   ├── plan/
│   ├── coach/
│   └── progress/
│
├── lib/
│   ├── firebase/
│   │   ├── client.ts
│   │   ├── admin.ts
│   │   └── hooks.ts
│   ├── vertex/
│   │   ├── client.ts
│   │   ├── prompts/                      # tous les prompts système versionnés
│   │   │   ├── coach.ts
│   │   │   ├── plan-generator.ts
│   │   │   ├── weekly-review.ts
│   │   │   ├── daily-insight.ts
│   │   │   ├── safety-layer.ts
│   │   │   └── vision-analysis.ts
│   │   └── schemas.ts                    # Zod schemas pour outputs structurés
│   ├── stripe/client.ts
│   ├── platform.ts                       # wrapper browser/native abstraction
│   └── utils.ts
│
├── types/
│   ├── user.ts
│   ├── checkin.ts
│   ├── plan.ts
│   └── chat.ts
│
├── functions/                            # Cloud Functions Gen 2
│   ├── package.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── nightly-analysis.ts           # cron 4h every day
│   │   ├── on-checkin-write.ts           # Firestore trigger
│   │   ├── alerts-monitor.ts             # garde-fous TCA, overtraining
│   │   └── data-export-purge.ts          # RGPD
│   └── tsconfig.json
│
├── public/
│   ├── manifest.json
│   ├── sw.js
│   ├── icons/
│   └── images/
│
└── docs/
    ├── architecture.md
    ├── prompts.md
    ├── data-model.md
    └── deployment.md
```

### 3.4 Modèle de données Firestore

```
users/{uid}
  profile: { name, sex, dob, height, timezone, profession, activity_level, created_at }
  goals: { type, target_weight, target_date, target_bf }
  medical: { conditions[], medications[], allergies[], last_bloodwork_date }
  baseline: { weight, bf_pct, measurements{}, photos{} }
  plan_current_id
  subscription: { tier, stripe_customer_id, stripe_sub_id, current_period_end }
  settings: { notifications, units, language }

users/{uid}/checkins_daily/{YYYY-MM-DD}
  weight, sleep_hours, sleep_quality, energy, hunger, mood,
  adherence_nutrition, training_done, training_intensity,
  steps, notes, created_at

users/{uid}/checkins_weekly/{YYYY-WW}
  measurements: { neck, waist, hips, thigh_l, thigh_r, arm_l, arm_r },
  photos: { face, profile, back } (storage paths),
  plan_feedback, free_notes,
  ai_analysis: { summary, diagnostic, photo_comparison },
  plan_proposed_id,
  created_at

users/{uid}/plans/{planId}
  active: bool,
  date_start, date_end,
  kcal, macros: { p, c, f },
  meals_template,
  training: { sessions[] },
  cardio: { type, duration, frequency, intensity },
  supplements, lifestyle_notes,
  source: "ai" | "manual",
  justification: string

users/{uid}/photos/{photoId}
  type, date, storage_path, bf_estimated, quality_score

users/{uid}/chat/{messageId}
  role: "user" | "assistant" | "system",
  content, timestamp,
  context_hash

users/{uid}/alerts/{alertId}
  type, severity, triggered_at, resolved, message, action_taken

content/recipes/{id}
content/exercises/{id}
```

### 3.5 Security Rules (Firestore)

```
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
  
  match /{collection}/{docId} {
    allow read, write: if request.auth.uid == userId;
  }
}

match /content/{collection}/{docId} {
  allow read: if request.auth != null;
  allow write: if false; // admin only via backend
}
```

### 3.6 Variables d'environnement

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

GOOGLE_CLOUD_PROJECT=
GOOGLE_APPLICATION_CREDENTIALS=
VERTEX_AI_LOCATION=europe-west1
VERTEX_AI_MODEL_PRO=gemini-2.5-pro
VERTEX_AI_MODEL_FLASH=gemini-2.5-flash

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_MONTHLY=
STRIPE_PRICE_ID_YEARLY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

SENDGRID_API_KEY=
SENTRY_DSN=

NEXT_PUBLIC_APP_URL=
```

### 3.7 Préparation wrap Android (Capacitor)

Le code doit anticiper le wrap sans le faire en MVP. Règles :
- Tous les appels à `window`, `navigator`, `localStorage` passent par `lib/platform.ts` qui expose une API neutre
- Auth Google utilise Firebase Auth `signInWithPopup` côté web — sera remplacé par `@capacitor-community/firebase-authentication` plugin natif lors du wrap
- Push notifications via FCM web — remplaçable par plugin natif sans changement de code applicatif
- Camera : accès via `<input type="file" accept="image/*" capture="user">` — remplaçable par `@capacitor/camera` plugin
- Stockage local minimal (IndexedDB via Firestore offline persistance, pas de localStorage métier)
- Pas de routing avec `window.location.href` — toujours `router.push` Next.js

---

## 4. Antigravity Prompt (à coller dans le runner)

```
ROLE
Tu es l'architecte et développeur principal en charge de construire le MVP web de l'application de coaching IA décrite dans briefs/coaching-app-mvp.md. Tu opères sous AGENTS.md du projet hub Paperclip AI. Tu utilises Gemini 3 Pro pour l'orchestration et tu délègues le code applicatif et les prompts en français à Claude via la sous-tâche scripting.

MISSION
Produire un dépôt Next.js 15 + Firebase + Vertex AI complet, fonctionnel en local et déployable sur Firebase Hosting + Cloud Run en région europe-west1, suivant exactement la structure de fichiers, le modèle de données, les Security Rules et la stack figée du brief.

CONTRAINTES NON NÉGOCIABLES
1. Stack 100% Google Cloud + Firebase + Vertex AI. Aucune dépendance Anthropic ou OpenAI dans le code applicatif.
2. Region europe-west1 partout. RGPD strict, hébergement EU exclusif.
3. PWA-first, mobile-first 375px, anticipation wrap Capacitor (cf section 3.7 du brief).
4. Tutoiement systématique français dans UI et prompts IA.
5. Pas de mention "régime", "minceur", "maigrir" dans l'UI — utiliser "plan nutritionnel", "objectif", "phase de transformation".
6. Tous les prompts système Vertex AI versionnés dans lib/vertex/prompts/, en français, avec garde-fous TCA/surentraînement obligatoires.
7. Validation Zod sur toutes les sorties structurées Gemini (responseMimeType json + responseSchema).
8. Tous les composants utilisent shadcn/ui (pas de Material UI, pas de Chakra).
9. Aucun usage de localStorage pour données métier. Firestore offline persistence or IndexedDB encapsulé.
10. Toutes les routes API protégées par vérification Firebase Admin SDK du token côté serveur.

PRINCIPES DE DESIGN
- Direction visuelle : éditorial sobre, typo distinctive (Fraunces pour display, Geist pour body), palette restreinte (fond crème ou anthracite, accent unique orange brûlé ou vert sapin).
- Aucune palette violet/gradient générique. Aucune typo Inter ou Roboto.
- Densité informationnelle élevée sur dashboard. Spacing généreux sur onboarding et coach.
- Graphiques Recharts avec couleurs cohérentes système.

LIVRABLES ATTENDUS
Cf section 6 du brief (Files to Produce). Chaque fichier doit être complet, typé, prêt à compiler.

PHASES D'EXÉCUTION (chacune commit séparé)
Phase 1 — Setup repo, config Next.js 15, Tailwind 4, Firebase client + admin, Vertex AI client, shadcn install, AGENTS.md, README.md, .env.example, firestore.rules, storage.rules.
Phase 2 — Auth Google complet : login page, callback, hooks useAuth, middleware route protection.
Phase 3 — Onboarding wizard 11 étapes avec persistance progressive Firestore et appel /api/ai/generate-plan en fin.
Phase 4 — Check-in quotidien + check-in hebdomadaire complets, avec upload photos vers Storage.
Phase 5 — Dashboard avec graphiques Recharts, insight du jour, accès rapide actions.
Phase 6 — Page plan, page progression, page settings.
Phase 7 — Coach IA conversationnel avec streaming Gemini, gestion contexte 14j daily + 4 semaines weekly + profil.
Phase 8 — Routes API IA toutes implémentées (generate-plan, weekly-review, daily-insight, chat, analyze-photo) avec safety layer.
Phase 9 — Cloud Functions : nightly-analysis, on-checkin-write trigger, alerts-monitor, data-export-purge.
Phase 10 — Stripe subscriptions + webhook + Customer Portal + tier gating dans l'app.
Phase 11 — PWA complète : manifest, service worker, icons, install prompt, push FCM web.
Phase 12 — Tests E2E Playwright sur parcours onboarding + check-in + chat. Déploiement Firebase Hosting + Cloud Run.

GARDE-FOUS À IMPLÉMENTER DANS LE SAFETY LAYER
- Détection signaux TCA (restriction extrême, obsession poids, compensation) → désactivation recommandations restrictives + orientation FFAB
- Perte > 1,5%/semaine sur 3 semaines → alerte + suggestion médecin
- Score humeur < 4/10 sur 7j/10 → orientation soutien psychologique
- Mention idéation suicidaire → arrêt immédiat conversation IA + numéro 3114 (FR) affiché
- IMC < 18,5 détecté à l'onboarding → blocage accès + orientation médicale obligatoire

LIVRABLES INTERMÉDIAIRES À CHAQUE PHASE
- Commit Git avec message structuré
- Mise à jour docs/architecture.md si changement structurel
- Tests unitaires Vitest sur logique métier critique
- Validation manuelle locale avant passage phase suivante

QUAND TU TERMINES
Produis un rapport final dans docs/handoff.md listant : ce qui est implémenté, ce qui est stub, variables d'env à fournir, étapes de déploiement, prochaines phases recommandées pour le wrap Android Capacitor.
```

---

## 5. Acceptance Criteria

L'agent a terminé le MVP si et seulement si :

1. Un utilisateur peut se créer un compte via Google One Tap en moins de 5 secondes
2. L'onboarding complet est faisable en moins de 8 minutes sur mobile
3. À la fin de l'onboarding, un plan personnalisé (kcal, macros, training) est généré par Gemini 2.5 Pro et affiché
4. Le check-in quotidien se fait en moins de 45 secondes
5. Le check-in hebdomadaire avec upload de 3 photos fonctionne sur mobile
6. Le coach IA répond avec contexte injecté en moins de 8 secondes (streaming activé)
7. Le dashboard affiche au minimum : moyenne glissante 7j poids, progression vs objectif, insight du jour
8. Stripe subscription Premium fonctionne end-to-end avec webhook vérifié
9. Firestore Security Rules empêchent tout accès cross-user (test e2e)
10. PWA installable depuis Chrome Android, fonctionne offline sur écrans déjà visités
11. Tous les prompts IA sont en français, tutoiement, sans moralisme alimentaire
12. Safety layer bloque les requêtes à risque (test cases inclus)
13. Le code passe `tsc --noEmit` sans erreur et `eslint` sans warning
14. Déploiement Firebase Hosting + Cloud Run en europe-west1 réussi et accessible via URL HTTPS
15. Le handoff doc `docs/handoff.md` documente la prochaine phase Capacitor

---

## 6. Files to Produce

Cf structure complète section 3.3 du brief. Total approximatif : 80-110 fichiers selon granularité composants.

Fichiers critiques à valider en priorité :
- `AGENTS.md`
- `lib/vertex/prompts/coach.ts`
- `lib/vertex/prompts/plan-generator.ts`
- `lib/vertex/prompts/safety-layer.ts`
- `firestore.rules`
- `app/api/ai/chat/route.ts`
- `app/(app)/onboarding/[step]/page.tsx`
- `functions/src/alerts-monitor.ts`
- `lib/platform.ts` (wrapper pour wrap Android futur)

---

## 7. Phase 2 — Wrap Android (hors scope MVP, documenté pour continuité)

Après validation MVP web, la phase 2 wrap Android sera un brief séparé `briefs/coaching-app-android-wrap.md` :

- Init projet Capacitor 6 dans le même repo (`npx cap init` + `npx cap add android`)
- Installation plugins : `@capacitor/camera`, `@capacitor/push-notifications`, `@capacitor/local-notifications`, `@capacitor/preferences`, `@capacitor-community/firebase-authentication`, `@capacitor-firebase/messaging`
- Remplacement des wrappers `lib/platform.ts` by implémentations natives
- Configuration Health Connect pour lecture poids, steps, sommeil depuis l'écosystème Android
- Build APK signé + publication Play Console (compte développeur 25$ one-shot à prévoir)
- Tests sur device physique (Samsung + Pixel minimum)
