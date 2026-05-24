# BRIEF V2 — Coaching App V1 Extensions (resserré post-audit)

**Filename** : `briefs/coaching-app-v1-extensions-v2.md`
**Supersede** : `briefs/coaching-app-v1-extensions.md` (V1 original conservé pour traçabilité)
**Orchestrator** : Antigravity + Gemini 3 Pro
**Build target** : 25 modules différenciateurs additifs, conformes au runtime MVP observé
**Précondition** : MVP `coaching-app-mvp` déployé en prod sur `coaching-app-mvp.vercel.app` (région `fra1`)

---

## 0. Changelog vs V1

Cette V2 intègre les conclusions de **`docs/baseline-audit.md`** (audit live du MVP en runtime, 2026-05-24). Changements majeurs :

| # | Décision V2 | Source | Conséquence |
|---|---|---|---|
| C1 | **Snake_case obligatoire** sur toutes collections, sous-collections, champs | ADR-006 + audit live | Élimine fragmentation (V1 proposait camelCase pour certains modules) |
| C2 | **Maps imbriquées** pour données one-shot par user, **sous-collections** pour append-only | ADR-006 + audit | -6 sous-collections inutiles (`medical.glp1` au lieu de `medications/glp1`, `fasting_protocol` map sur user, `profile.tdee_adaptive` etc.) |
| C3 | **Pattern "extension de `lifestyle_notes`"** pour M9, M16, M19 | Découverte audit : moteur de contextualisation IA déjà actif | -30% effort sur ces 3 modules — ils enrichissent le prompt plan-generator au lieu de dupliquer |
| C4 | **`subscription` map déjà présente** sur `users/{uid}` | Audit live | M20 = enrichment du champ existant, pas création |
| C5 | **Remote Config déjà initialisé** côté client (base IndexedDB `firebase_remote_config` observée) | Audit live | `lib/features/flags.ts` se branche sur l'instance existante (déjà fait) |
| C6 | **Phase A.0 fondations** explicite avant les 25 modules | Brief V1 implicite | `lib/features/food-logs/schema.ts` (déjà fait), `lib/features/notifications/templates.ts`, conventions partagées |
| C7 | **Estimation 280-320 fichiers** (vs 350-400 V1) | Audit + déduplication | Réduction par réutilisation et factorisation |
| C8 | **4 modules à embryon prod** : M1 photo-meal, M6 EU food DB, M11 body scanner, M19 smart-notifs | Audit live 2026-05-24bis | Voir §0.bis — scope réduit −40 à −60% par module |

## 0.bis — Audit live 2026-05-24 (post-déploiement Phase A.x)

Un second audit runtime a révélé que **4 des 25 modules ont déjà des fondations live en production** (pas seulement en code, mais visibles à l'utilisateur). Ajustement scope correspondant :

| Module brief V1 original | Observation runtime | % déjà en prod | Scope V2 réduit |
|---|---|---|---|
| **M11 Body Scanner** | UI photos (Face/Profil/Dos) + 8 mensurations livrées sur `/checkin/weekly` | ~60% | Reste : analyse Vision multi-photos + diff inter-dates + score morpho |
| **M6 EU food DB** | DB hardcodée 13 aliments (Cru vs Cuit) déjà dans `/plan` | ~30% | Reste : migration vers `content/foods/items` (cron OFF déjà fait Phase A.1) + retrait DB hardcodée |
| **M1 Photo-to-meal** | Pipeline upload photo bilan hebdo en place | ~40% | Reste : brancher Vertex Vision + Zod parse sur le pipeline existant |
| **M19 Smart FCM** | Toggle Notifications dans Settings + permission browser | ~50% | Reste : UI Settings → catégories opt-out granulaire (cron + templates déjà fait Phase A.3) |

**Conséquence sur l'estimation finale** : **~250 fichiers** (vs 290 V2, vs 350-400 V1 original).

---

## 1. Objective

Étendre L'Insociable avec les 25 modules différenciateurs identifiés, **strictement additifs**, **alignés sur le schéma runtime** observé en prod, **réutilisant** les couches MVP existantes (contextualisation IA, Remote Config, subscription, safety layer).

---

## 2. Conventions non-négociables (ADR-006)

### 2.1 Naming

- **Collections / sous-collections** : snake_case (`food_logs`, `coach_messages`, `checkins_daily`, `wearable_sync`)
- **Champs Firestore** : snake_case (`adherence_nutrition`, `plan_current_id`, `training_done`, `last_request_at`)
- **Sous-collection mono-doc** (singleton) : `streak/current`, `medical/glp1` si nécessaire

### 2.2 Maps vs sous-collections

| Type donnée | Stockage |
|---|---|
| Profil santé one-shot (allergies, conditions) | `users/{uid}.medical` (map) |
| Protocole one-shot (jeûne actif, GLP-1 traitement) | `users/{uid}.medical.glp1`, `users/{uid}.fasting_protocol` (map) |
| TDEE adaptatif, métriques calculées | `users/{uid}.profile.tdee_adaptive` (map) |
| Append-only / time-series | sous-collection `users/{uid}/checkins_daily/{date}`, `users/{uid}/food_logs/{logId}`, `users/{uid}/coach_messages/{msgId}` |
| Système global lecture-only | `content/foods/items/{barcode}`, `content/exercises/{id}` |
| Cron-deduplication | `_stripe_events/{event.id}` (admin-only) |

### 2.3 Conventions API

- Toutes routes API protégées par `withAuth` (Bearer Firebase ID token)
- Routes IA structurées : `responseMimeType: 'application/json'` + `responseSchema` + `parseLLMJson()` côté serveur + Zod validation
- Routes IA conversationnelles : SSE streaming (`Accept: text/event-stream`)
- Rate-limit per-user via `lib/firebase/rate-limit.ts` sur toute route Vertex AI
- Safety layer `runSafetyCheck()` en amont de tout appel Vertex sur user input libre

### 2.4 Conventions UI

- Tous nouveaux écrans sous **feature flag** Firebase Remote Config (défaut `false`)
- Pattern d'entrée : `if (!flags.X()) return <NotAvailable />;`
- shadcn/ui pour tous composants (Input, Label, Dialog, Toast, Tabs, Select déjà disponibles)
- `useToast()` du `<Toaster>` racine pour les feedbacks

### 2.5 Sécurité

- Tier gating Premium via `lib/stripe/subscription.ts` (`canAccessFeature`) — **côté serveur**, pas seulement flag client
- Modules touchant la santé (M4 GLP-1, M11 body scanner, M15 micronutrients, M16 bloodwork) : disclaimer médical obligatoire + safety layer activé
- Données médicales sensibles : chiffrement at rest par défaut Firestore + log d'accès audit

---

## 3. Phase A.0 — Fondations partagées (à compléter AVANT les modules)

| Fondation | Statut | Localisation |
|---|---|---|
| `food_logs` canonical schema | ✅ fait | `lib/features/food-logs/schema.ts` + 5 tests |
| Snake_case conventions | ✅ fait | ADR-006 + `docs/baseline-audit.md` |
| Rate-limit infrastructure | ✅ fait | `lib/firebase/rate-limit.ts` (token bucket per-user) |
| Safety layer | ✅ fait | `lib/vertex/safety.ts` + dict FR |
| Stripe tier gating | ✅ fait | `lib/stripe/subscription.ts` + `useSubscription` + `PremiumGate` |
| Remote Config flags | ✅ fait | `lib/features/flags.ts` (RC + env + localStorage dev) |
| Cloud Functions parallèle | ✅ fait | `functions/src/lib/parallel.ts` (processInChunks) |
| **Notifications templates** | 🔴 à faire | `lib/features/notifications/templates.ts` (réutilisé M19) |
| **Health metrics aggregator** | 🔴 à faire | `lib/features/health/aggregator.ts` (M7 wearables + M8 TDEE) |
| **Context-extension hook** | 🔴 à faire | `lib/vertex/context-builder.ts` — extend `lifestyle_notes` pattern pour M9, M16, M19 |

---

## 4. Modules V1 détaillés (25)

### Légende
- **Schema target** : où stocker les nouvelles données (map vs sous-collection)
- **Reuse** : composants/services MVP réutilisés (au lieu de dupliquer)
- **Effort** : S (1-3 fichiers), M (4-8), L (9-15), XL (16+)

**Légende état runtime** : 🟢 fait (Phase A.x), 🟡 embryon prod (audit live), 🔴 à faire from scratch, ⚙️ refactor migration.

| Tier | # | Module | État | Schema target | Reste à faire | Effort |
|---|---|---|---|---|---|---|
| 1 | M1 | Photo-to-meal IA | 🟡 40% | `food_logs/{id}` (source=photo_meal) | Brancher Vertex Vision sur upload existant + Zod parse | S |
| 1 | M2 | Barcode scanner | 🟢 | `food_logs/{id}` (source=barcode) + `content/foods/items/{barcode}` cache | aligné canonical schema | — |
| 1 | M3 | Voice logging | 🟢 | `food_logs/{id}` (source=voice) | aligné canonical schema | — |
| 1 | M4 | GLP-1 tracking | ⚙️ | **`users/{uid}.medical.glp1` map** | migration faite Phase A.0 | — |
| 1 | M5 | Jeûne intermittent | 🟢 | **`users/{uid}.fasting_protocol` map** | déjà en map | — |
| 1 | M6 | Base alimentaire EU (OFF) | 🟡 30% | `content/foods/items/{barcode}` (cron OFF déjà OK) | Retirer DB hardcodée 13 aliments de `/plan` + remplacer par query Firestore | S |
| 1 | M7 | Wearables hub (Google Fit) | 🟢 | `users/{uid}/wearable_sync/{date}` + **`users/{uid}.wearable.google_fit` map** | OAuth flow refactored Phase A.2 | — |
| 1 | M8 | TDEE adaptatif | 🟢 | **`users/{uid}.profile.tdee_adaptive`** + history sub `users/{uid}/tdee_history/{week}` | history sub ajouté Phase A.2 | — |
| 2 | M9 | Sourcing scientifique | 🟡 60% | **Extension de `lifestyle_notes` pattern** via `context-builder` | Brancher RAG sources dans coach via builder + UI citations cliquables | M |
| 2 | M10 | Parcours profil-spécifique | 🟢 | **`users/{uid}.profile_path`** + bifurcation onboarding | déjà en plan-generator Phase A.3 | — |
| 2 | M11 | Body Scanner photo IA | 🟡 60% | `users/{uid}/body_scans/{date}` (déjà sub-coll) | Analyse Vision 4-photos + diff inter-dates (UI photos + mensurations déjà sur `/checkin/weekly`) | M |
| 2 | M12 | Form check vidéo | 🟢 | `users/{uid}/form_checks/{id}` | Premium quota + persistence faits Phase A.7 | — |
| 2 | M13 | Micro-tâches comportementales | 🟢 | `content/micro_tasks/{id}` + `users/{uid}/daily_tasks/{date}` | route `/api/micro-tasks/today` Phase A.3 | — |
| 2 | M14 | Import recette + OCR | 🟢 | `food_logs/{id}` (source=recipe_ocr) | aligné canonical schema Phase A.1 | — |
| 2 | M15 | Micronutriments | 🟢 | aggregator + RDI coverage | Dashboard UI `/progress/micronutrients` (route existe, à finir) | S |
| 2 | M16 | Upload bilan sanguin | 🟢 | `users/{uid}/bloodwork/{date}` | persistence + tier gating Phase A.2 | — |
| 3 | M17 | Parrainage | 🟢 | **`users/{uid}.referral` map** | snake_case + `ensureReferralCode` Phase A.4 | — |
| 3 | M18 | Streak factuel | 🟢 | `users/{uid}/streak/current` | gap detection + at_risk + cron marker Phase A.4 | — |
| 3 | M19 | Notifications smart FCM | 🟡 50% | **`users/{uid}.notification_context` map** | UI Settings → opt-out granulaire par catégorie (toggle global + permission déjà en prod, moteur règles + cron + audit déjà Phase A.3) | S |
| 3 | M20 | Stripe Portal avancé | 🟡 | **Enrichment `users/{uid}.subscription` existant** | UI Settings → pause/upgrade/annulation rétention (route portal + hook déjà MVP) | M |
| 3 | M21 | Cohort analytics admin | 🟢 | `/api/admin/metrics` réel | BigQuery export pour analyses ad-hoc (vrai dashboard UI optionnel) | M |
| 3 | M22 | A/B testing framework | 🟢 | `experiment_exposures/{id}` + `experiments/{id}` | route admin/experiments Phase A.4 | — |
| 3 | M23 | RGPD self-service | 🟢 | `dataExportPurge` Cloud Function + audit log | UI Settings → bouton Export + Delete avec confirm (route export OK, callable function OK) | S |
| 3 | M24 | Health Connect Android | 🟢 stub | `lib/platform/health.ts` wrapper | post-wrap Capacitor (Phase 2) | — |
| 3 | M25 | HealthKit iOS | 🟢 stub | idem M24 | post-wrap (Phase 2) | — |

---

## 5. Modules à migrer (déjà partiellement implémentés en V1.0)

| Module | État actuel | Migration V2 requise |
|---|---|---|
| M4 GLP-1 | `users/{uid}/medications/glp1` (sub) | **Migrer vers `users/{uid}.medical.glp1` map** — refactor 2 routes (`coach`, `generate-plan`) |
| M5 Fasting | déjà en map ✓ | rien |
| M22 A/B | hook fait, exposure logged ✓ | rien |

---

## 6. Pattern "context-extension" pour M9, M16, M19

### Principe
Le MVP a un moteur de contextualisation déjà actif : `plans/{planId}.lifestyle_notes` est généré par Gemini Pro avec accès au profil complet. Les modules V2 qui touchent au coaching doivent **enrichir le prompt** au lieu de créer leur propre pipeline.

### Pattern d'implémentation

```typescript
// lib/vertex/context-builder.ts
export interface UserContext {
  profile: UserProfile;
  baseline: UserBaseline;
  goals: UserGoals;
  medical: UserMedical;
  glp1?: GLP1State;          // M4
  fasting?: FastingState;    // M5
  bloodwork?: BloodworkSummary; // M16
  ragSources?: SearchResult[];  // M9
  notificationHints?: NotifContext; // M19
}

export function buildEnrichedSystemPrompt(
  basePrompt: string,
  ctx: UserContext
): string {
  let prompt = basePrompt;
  if (ctx.glp1?.active) prompt += GLP1_CONTEXT_BLOCK(ctx.glp1);
  if (ctx.fasting?.active) prompt += FASTING_CONTEXT_BLOCK(ctx.fasting);
  if (ctx.bloodwork) prompt += BLOODWORK_CONTEXT_BLOCK(ctx.bloodwork);
  if (ctx.ragSources?.length) prompt += RAG_CONTEXT_BLOCK(ctx.ragSources);
  return prompt;
}
```

### Routes qui doivent utiliser ce builder
- `/api/ai/coach` (déjà partiellement fait — refactor pour utiliser le builder unifié)
- `/api/ai/generate-plan` (idem)
- `/api/ai/weekly-review` (étendre avec bloodwork si dispo)
- `/api/ai/daily-insight` (étendre avec notification_context)
- Cloud Function `smartNotificationsCron` (générer la notif personnalisée via Flash + context)

---

## 7. Contraintes de non-régression (héritées V1, renforcées)

1. **Aucun fichier MVP existant supprimé.** Diff vérifiable par `git log --diff-filter=D`.
2. **Aucune signature de fonction publique changée.** Extensions = nouvelles fonctions, dépréciation par commentaire JSDoc.
3. **Aucune route MVP changée par défaut.** Si extension, feature flag OFF par défaut + route v2 séparée si nécessaire.
4. **Aucune Firestore rule existante affaiblie.** Uniquement ajouts ou restrictions supplémentaires.
5. **Aucun champ Firestore existant supprimé ou retypé.** Uniquement ajout de champs optionnels.
6. **Tous les nouveaux écrans sous feature flag** (Remote Config, défaut `false`).
7. **Tous les prompts Gemini MVP inchangés.** Nouveaux prompts dans nouveaux fichiers.
8. **Tests E2E Playwright MVP passent 100%** avant et après chaque PR.
9. **Coverage tests nouveaux modules ≥ 70%** sur logique métier.
10. **Rollback documenté** par flag dans `lib/features/<module>/README.md`.
11. **Snake_case strict.** Lint check : `scripts/check-snake-case.mjs` (à créer en Phase A.0).
12. **Rate-limit obligatoire** sur toute nouvelle route Vertex AI.
13. **Tier gating Premium côté serveur** pour les modules marqués Premium ci-dessus.
14. **Safety check** appelé en amont sur toute route IA acceptant input libre.

---

## 8. Acceptance Criteria

### 8.1 Non-régression (CRITIQUE)
1. Les 100% des tests E2E Playwright MVP passent verts après chaque PR
2. Aucune route MVP changée (`/api/ai/daily-insight`, `/api/ai/generate-plan`, `/checkin/daily`, ...)
3. Aucun champ Firestore existant supprimé
4. Toutes les Security Rules existantes maintenues
5. Tous les feature flags par défaut `false` en prod (vérifiable Remote Config console)
6. Lighthouse score mobile ne régresse pas de plus de 3 points

### 8.2 Conformité runtime
1. Tous nouveaux champs/collections en snake_case (lint check)
2. Maps imbriquées privilégiées vs sous-collections pour data one-shot (cf. tableau §4)
3. Modules touchant le coaching (M9, M16, M19) utilisent `buildEnrichedSystemPrompt()`, pas leur propre pipeline
4. Modules Premium gated côté serveur (`canAccessFeature` check dans la route)

### 8.3 Activation progressive
1. `docs/extensions-rollout.md` produit avec ordre d'activation et critères A/B
2. Premier test A/B configuré (M22) avec hypothèse testable (ex: prix annuel 179€ vs 149€ vs 199€)
3. Dashboard admin (M21) accessible avec custom claim `admin: true`
4. Export/Delete RGPD (M23) testé end-to-end avec audit log vérifié

---

## 9. Files to Add / Modify (estimation révisée 2026-05-24bis)

État réel après Phase A.0 → A.7 + audit live bis :

| Catégorie | Estimation V2 originale | **État réel post-Phase A** | Reste à faire |
|---|---|---|---|
| `lib/features/<module>/` | ~100 | **~80 livrés** | 0 (libs prêtes) |
| `components/features/<module>/` | ~75 | **~30 livrés** | ~15 (UI Settings opt-out M19, dashboard M15, body scanner M11 Vision UI) |
| Routes pages | ~20 | **~25 livrées** | 0 |
| Routes API | ~18 | **~22 livrées** | 0 (M1 Vision branchement = enrichissement route existante) |
| Cloud Functions | ~10 | **15 déployées** | 0 |
| Tests unitaires | ~40 | **136 tests passing** | ~10 (M9 RAG flow, M19 UI flows) |
| Tests E2E Playwright | ~12 | **4 livrés** | ~8 (parcours critiques par module) |
| Docs (modules + ADR + rollout) | ~10 | **5 livrés** (architecture, baseline-audit, handoff, GO-LIVE, extensions-rollout) | ~5 (README par module restant) |
| Configuration | ~5 | **5 livrés** (rules, 13 indexes, vercel.json, .env, .npmrc) | 0 |
| **Total estimé** | **~290** | **~177 fichiers déjà commits** | **~38 fichiers restants** |

### Travail restant concentré sur 4 modules à embryon prod

1. **M1 Photo-to-meal** (~5 fichiers) — brancher Vertex Vision sur le pipeline upload bilan hebdo qui existe déjà
2. **M6 EU food DB UI migration** (~3 fichiers) — retirer DB hardcodée `/plan` + query `content/foods/items`
3. **M9 RAG sourcing UI** (~6 fichiers) — extension `context-builder` + UI citations cliquables dans coach
4. **M11 Body Scanner Vision** (~8 fichiers) — analyse 4-photos + diff inter-dates
5. **M19 Notifs opt-out UI granulaire** (~4 fichiers) — Settings → catégories par cron template
6. **M20 Stripe Portal UI avancé** (~5 fichiers) — pages pause/upgrade/annulation rétention
7. **M15 Micronutrients dashboard** (~4 fichiers) — UI `/progress/micronutrients`
8. **M23 RGPD UI Settings** (~3 fichiers) — bouton Export + Delete avec confirm

**Estimation effort restant** : ~38 fichiers, 1-2 sprints solo (vs estimé initial 290 sur 10 sprints).

### 9.2 Modifications additives uniquement
- `lib/features/flags.ts` (ajouts incrémentaux des nouveaux flags)
- `firestore.rules` (ajouts uniquement, validation par tests rules-unit-testing)
- `firestore.indexes.json` (nouveaux composites)
- `storage.rules` (nouvelles règles uniquement)
- `package.json` (nouvelles dépendances)
- `.env.vercel.example` (nouvelles variables documentées)
- `lib/vertex/context-builder.ts` (extension du moteur lifestyle_notes)

### 9.3 Nouvelles variables d'environnement
```
# M2 / M6 Open Food Facts
OPENFOODFACTS_API_BASE=https://world.openfoodfacts.org
NUTRITIONIX_APP_ID=
NUTRITIONIX_APP_KEY=

# M7 Wearables
GOOGLE_FIT_OAUTH_CLIENT_ID=
GOOGLE_FIT_OAUTH_CLIENT_SECRET=
WITHINGS_CLIENT_ID=
WITHINGS_CLIENT_SECRET=
GARMIN_CONSUMER_KEY=
GARMIN_CONSUMER_SECRET=

# M9 RAG (existant + nouveau)
VERTEX_AI_SEARCH_DATASTORE_ID=
EXAMINE_API_KEY=

# M3 voice (Cloud STT déjà couvert par ADC)
# (rien de nouveau)

# M17 referral
FIREBASE_DYNAMIC_LINKS_URL_PREFIX=

# M21 admin (déjà couvert ADMIN_EMAILS)
BIGQUERY_DATASET=
```

### 9.4 Nouveaux Remote Config flags
Tous défaut `false`. Convention : `feature_<module_snake>`.
```
feature_photo_meal, feature_barcode, feature_voice_log, feature_glp1, feature_fasting,
feature_off_db, feature_wearables, feature_tdee_adaptive, feature_rag_sourcing,
feature_profile_paths, feature_body_scanner, feature_form_check, feature_micro_tasks,
feature_recipe_ocr, feature_micronutrients, feature_bloodwork_upload, feature_referral,
feature_streak, feature_smart_notifs, feature_stripe_portal_advanced, feature_admin_dashboard,
feature_ab_framework, feature_gdpr_self_service, feature_health_connect, feature_healthkit
```

---

## 10. Ordre d'exécution recommandé

### Phase A.0 — Fondations restantes (1 sprint)
- Migration M4 GLP-1 vers `users/{uid}.medical.glp1` map
- `lib/features/notifications/templates.ts`
- `lib/features/health/aggregator.ts`
- `lib/vertex/context-builder.ts` (refactor coach + generate-plan pour utiliser le builder)
- `scripts/check-snake-case.mjs` lint
- ADR-007 (pattern context-extension formalisé)

### Phase A.1 — Modules food tracking (2 sprints)
M2 (barcode) → M1 (photo-meal) → M3 (voice) → M14 (recipe OCR) → M6 (OFF base) → M15 (micronutrients)

### Phase A.2 — Modules santé (2 sprints)
M5 (fasting) → M8 (TDEE adaptive) → M7 (wearables) → M11 (body scanner) → M16 (bloodwork)

### Phase A.3 — Modules profil + coaching (2 sprints)
M10 (parcours profil) → M9 (RAG sourcing) → M13 (micro-tasks) → M19 (smart notifs)

### Phase A.4 — Modules ops (1 sprint)
M20 (Stripe portal) → M17 (parrainage) → M18 (streak) → M22 (A/B) → M23 (RGPD)

### Phase A.5 — Admin + monitoring (1 sprint)
M21 (cohort analytics + BigQuery export)

### Phase A.6 — Capacitor prep (1 sprint, post-MVP web validation)
M24 (Health Connect Android) + M25 (HealthKit iOS) wrappers

### Phase A.7 — Modules vidéo (1 sprint)
M12 (form check vidéo)

**Total** : ~10 sprints à 1 dev solo (~6 mois). Possible accélération à 2-3 devs en parallèle (modules indépendants).

---

## 11. Phase 2 — Wrap Capacitor Android (hors scope V1)

Brief séparé `briefs/coaching-app-android-wrap.md` (à créer post-V1.0 web validation).

Anticipations déjà en place :
- `lib/platform/{camera,push,location,health}.ts` wrappers avec interface unifiée
- `isNativePlatform()` détection
- `auth-provider` fallback `signInWithRedirect` pour WebView
- M24/M25 stubs prêts à recevoir les plugins natifs

---

## 12. Sortie attendue post-V1

À la fin de l'exécution complète V1 :
- 25 modules tous derrière feature flag, activables progressivement
- Coverage tests ≥ 70% par module + 12 E2E parcours
- `docs/extensions-rollout.md` avec ordre d'activation + critères A/B
- Migration GLP-1 effectuée
- Aucune régression MVP
- App live sur `coaching-app-mvp.vercel.app` avec tous les modules en attente d'activation
- Dashboard admin opérationnel
- BigQuery dataset prêt pour cohort analytics
