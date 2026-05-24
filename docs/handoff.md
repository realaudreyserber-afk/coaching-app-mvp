# Handoff — Coaching App MVP (état au 2026-05-24)

## État global

- Phases MVP 1-8 : ✅ implémentées
- Phase 9 (Cloud Functions Gen 2) : ✅ squelette complet, à déployer
- Phase 10 (Stripe) : ✅ checkout + portail + webhook + tier gating prêts (placeholder price IDs)
- Phase 11 (PWA) : ✅ manifest + service worker + meta tags (icons à fournir)
- Phase 12 (E2E + déploiement) : 🟡 E2E partiel, déploiement Firebase à effectuer

V1 Extensions (25 modules) : 21 livrés en code, 4 restants (`gdpr-self-service` complet, `stripe_portal_advanced` granulaire, `health_connect`, `healthkit`).

## Ce qui change vs. l'audit initial

| Audit | Statut |
|---|---|
| firestore.rules `content/foods` ouvert en write | ✅ verrouillé (admin-only) |
| Bug doublon semaglutide detector | ✅ corrigé + ajout zepbound/victoza |
| Indexes Firestore vides | ✅ 8 composites ajoutés |
| Safety layer jamais appelé | ✅ branché coach + generate-plan + step 11 (via 403) |
| Dev-bypass `mock-token` actif si NODE_ENV=development | ✅ gating `ENABLE_MOCK_AUTH=1` |
| Pas de middleware racine | ✅ `middleware.ts` + cookie `__session` Firebase |
| firebase.json incomplet | ✅ hosting frameworks + functions Gen 2 europe-west1 |
| Pas de Cloud Functions | ✅ 8 functions Gen 2 (nightly, alerts, RGPD, smart-notifs, TDEE, wearables, stripe-webhook, on-checkin) |
| Pas de PWA | ✅ manifest + sw.js + installer hook |
| Coach pas en streaming | ✅ SSE via `generateTextStream` |
| Routes IA manquantes | ✅ weekly-review + daily-insight + analyze-photo |
| Pas de Stripe | ✅ checkout + portail + webhook + UI + tier gating |
| Flags non-RC | ✅ hybride RC → env → localStorage(dev) |
| Pas de tests safety | ✅ 7 cas unit Vitest |

## Variables d'environnement à fournir

### Firebase (obligatoire pour build)
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
```

### Vertex AI
```
GOOGLE_CLOUD_PROJECT
VERTEX_AI_LOCATION=europe-west1
VERTEX_AI_MODEL_PRO=gemini-2.5-pro
VERTEX_AI_MODEL_FLASH=gemini-2.5-flash
GEMINI_API_KEY (optionnel, sinon GCP ADC)
SAFETY_DEEP_CHECK=1 (recommandé en prod)
```

### Stripe (à remplir avec tes vraies clés/prix)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_MONTHLY=price_...
STRIPE_PRICE_ID_YEARLY=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Dev / sécurité
```
ENABLE_MOCK_AUTH=1            # local + CI uniquement
NEXT_PUBLIC_ENABLE_MOCK_AUTH=1 # local + CI uniquement
NODE_ENV=production           # en prod, désactive mock même si flag set
ADMIN_EMAILS=foo@bar.com,...
```

### Optionnel (V1 extensions)
```
PUBMED_API_KEY
VERTEX_AI_SEARCH_DATASTORE_ID
GOOGLE_FIT_OAUTH_CLIENT_ID
GOOGLE_FIT_OAUTH_CLIENT_SECRET
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_FIREBASE_VAPID_KEY        # push web tokens
CSE_API_KEY                            # Google CSE pour RAG FR
CSE_FR_ENGINE_ID                       # CSE Engine ID restreint domaines ANSES/EFSA/HAS/...
SENTRY_DSN                             # côté serveur
NEXT_PUBLIC_SENTRY_DSN                 # côté client
SENTRY_ENV                             # production / staging / dev
```

## Étapes de déploiement Firebase

1. `firebase login`
2. `firebase use linsociable-coaching`
3. Provisionner les secrets : `firebase functions:secrets:set STRIPE_SECRET_KEY` (idem WEBHOOK_SECRET)
4. `firebase deploy --only firestore:rules,firestore:indexes,storage:rules`
5. `cd functions && npm install && cd ..`
6. `firebase deploy --only functions`
7. `npm run build`
8. `firebase deploy --only hosting`
9. Configurer webhook Stripe : URL `https://europe-west1-linsociable-coaching.cloudfunctions.net/stripeWebhook` + endpoint signing secret
10. Configurer Remote Config : créer les paramètres `feature_*` (défaut `false`)

## Tâches restantes pour la production

### Bloquantes
- [ ] Fournir les 4 icônes PWA dans `public/icons/` (cf. `public/icons/README.md`)
- [ ] Remplir les vrais Stripe price IDs
- [ ] Définir les `ADMIN_EMAILS` ou attribuer les custom claims via `adminAuth.setCustomUserClaims(uid, { admin: true })`
- [ ] Tester end-to-end le flow Stripe en mode test
- [ ] Lancer un test E2E full onboarding → check-in → coach → plan

### Non-bloquantes
- [x] ~~Configurer Sentry~~ — instrumentation prête ([sentry.*.config.ts](sentry.server.config.ts), [instrumentation.ts](instrumentation.ts)). Activer en posant `SENTRY_DSN`. NB : peer dep sur Next 16 nécessite `--legacy-peer-deps` jusqu'à mise à jour Sentry.
- [x] ~~Ajouter Sourcing FR au RAG~~ — domaines ANSES/EFSA/HAS/INSERM/OMS/EFSA via Google CSE ([lib/features/rag-sourcing/fr-sources.ts](lib/features/rag-sourcing/fr-sources.ts)). Activer en posant `CSE_API_KEY` + `CSE_FR_ENGINE_ID`.
- [x] ~~Tests E2E sur les parcours MVP critiques~~ — 4 specs : onboarding, coach SSE, safety, subscription ([e2e/](e2e/))
- [x] ~~`responseSchema` Vertex AI~~ — branché sur 4 routes structurées + safety deep check
- [x] ~~Tests Firestore rules~~ — `npm run test:rules` (nécessite émulateur)
- [x] ~~shadcn primitives manquantes~~ — Input, Label, Textarea, Dialog, Toast, Tabs, Select
- [x] ~~Wrappers Capacitor~~ — camera, push, location ([lib/platform/](lib/platform/))
- [x] ~~A/B exposure events~~ — `useExperiment` hook + `experiment_exposures/{id}` Firestore
- [x] ~~Rate-limiting per-user~~ — 20/min, 200/h sur coach ; 5/h sur generate-plan
- [x] ~~RGPD audit log + Stripe events TTL~~ — collection `rgpd_audit_log` + Cloud Function `stripeEventsCleanup` (30j)
- [ ] Compléter modules V1 absents : health-connect, healthkit (wrappers natifs Capacitor V2)
- [ ] Activer `SAFETY_DEEP_CHECK=1` après calibration des faux positifs sur 100 conversations

## Phase 2 — Wrap Capacitor Android

Le code est prêt à recevoir le wrap :
1. `npm install @capacitor/core @capacitor/cli @capacitor/android`
2. `npx cap init "L'Insociable" "com.linsociable.coaching" --web-dir=.next`
3. Installer plugins : `@capacitor-community/firebase-authentication`, `@capacitor/camera`, `@capacitor/push-notifications`, `@capacitor-firebase/messaging`, `@kiwi-health/capacitor-health-connect`
4. Remplacer les wrappers dans `lib/platform.ts` et `lib/platform/health.ts` par les implémentations natives
5. Configurer Health Connect dans `AndroidManifest.xml`
6. Build APK signé + Play Console (compte développeur 25$)

## Risques résiduels

- **Faux positifs safety fast-path** : les regex sont volontairement larges. Surveiller les bounces en prod.
- **Index Firestore manquants au runtime** : Firestore loggue dans la console GCP un lien de création direct. Vérifier après les premiers déploiements.
- **Service worker cache stale** : bumper `CACHE_VERSION` dans `public/sw.js` à chaque release majeure UI.
- **Cookie session 5j sans rotation** : si compromis, valide 5j. Considérer rotation au prochain hit + révocation `revokeRefreshTokens`.
- **Stripe webhook idempotence** : pas de check `event.id` actuellement. À ajouter si volume > 100 events/jour.
