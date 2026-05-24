# BRIEF — Coaching App V1 Extensions (additive, non-régressif)

> ⚠️ **SUPERSEDED** par [`coaching-app-v1-extensions-v2.md`](./coaching-app-v1-extensions-v2.md) le 2026-05-24
>
> La V2 intègre les conclusions de `docs/baseline-audit.md` (audit live du MVP en runtime) :
> - Snake_case obligatoire (ADR-006)
> - Maps imbriquées privilégiées vs sous-collections (`medical.glp1`, `fasting_protocol`, `profile.tdee_adaptive`)
> - Réutilisation du moteur `lifestyle_notes` pour M9, M16, M19 (pattern context-extension)
> - `subscription` map déjà présente → M20 = enrichment
> - Remote Config déjà initialisé client-side
> - Estimation révisée 350-400 → 280-320 fichiers
> - Phase A.0 fondations explicite + ordre d'exécution en 7 phases sur 10 sprints
>
> Ce fichier est conservé pour traçabilité historique du brief original. **Ne pas s'y référer pour l'implémentation.**

---

**Filename** : `briefs/coaching-app-v1-extensions.md`
**Orchestrator** : Antigravity + Gemini 3 Pro
**Build target** : ajouter 25 modules différenciateurs sans casser le MVP existant
**Précondition** : MVP `briefs/coaching-app-mvp.md` déployé, tests E2E verts

---

## 1. Objective

Étendre l'application avec les modules manquants identifiés dans l'étude concurrentielle européenne (mai 2026), **strictement de manière additive**, sans modifier les flux existants validés. Chaque nouveau module est isolé sous feature flag, testé en non-régression avant merge, déployable indépendamment.

---

## 2. Context

### 2.1 État actuel du codebase

L'application existe et fonctionne avec :
- Auth Google + onboarding 11 étapes
- Check-in quotidien + hebdo
- Plan généré par Gemini 2.5 Pro
- Dashboard + graphiques
- Coach IA conversationnel
- Module progression + photos
- Stripe Premium
- Cloud Functions nocturnes
- PWA installable

**Tous ces flux sont en production et ne doivent pas régresser.**

### 2.2 Gaps identifiés à combler

Issus de l'étude concurrentielle (Yazio, Foodvisor, WeightWatchers, MacroFactor, Cal AI, Future, MyFitnessPal, Noom) :

| Tier | Module | Concurrent référence | Différenciation |
|---|---|---|---|
| 1 | Photo-to-meal IA | Cal AI, Foodvisor | Gemini Vision multi-aliments |
| 1 | Barcode scanner | Yazio, MyFitnessPal | Open Food Facts FR |
| 1 | Voice logging | Aucun en FR | Cloud Speech-to-Text |
| 1 | GLP-1 medication tracking | WeightWatchers | Suivi effets secondaires + protéines |
| 1 | Jeûne intermittent | Yazio | Intégré au plan, pas en silo |
| 1 | Base alimentaire EU | Yazio, Foodvisor | Open Food Facts FR/DE complète |
| 1 | Wearables hub | MyFitnessPal | Google Fit central + Withings/Garmin |
| 1 | TDEE adaptatif | MacroFactor | Recalcul auto via balance énergétique |
| 2 | Sourcing scientifique | Aucun grand public | RAG corpus PubMed/Examine curé |
| 2 | Parcours profil-spécifique | Aucun | High BF / ex-athlète / GLP-1 / bariatrique |
| 2 | Body Scanner photo IA | WW (3D) | Gemini Vision comparatif morpho |
| 2 | Form check vidéo | Aucun en FR | Gemini Vision sur upload vidéo training |
| 2 | Micro-tâches comportementales | Noom | Factuelles, non infantilisantes |
| 2 | Import recette + OCR | Aucun | Gemini Vision sur photo recette |
| 2 | Micronutriments | Cronometer | Tracking vitamines/minéraux V1.5 |
| 2 | Upload bilan sanguin | Aucun grand public | Gemini Vision parse PDF + alertes |
| 3 | Système de parrainage | Standard | Crédit mensuel récompense |
| 3 | Streak factuel | Standard mais infantile chez Noom | Sans badges, sans confettis |
| 3 | Notifications smart FCM | Standard | Personnalisées par contexte IA |
| 3 | Stripe Portal avancé | Standard | Pause, upgrade, cancel self-service |
| 3 | Cohort analytics | Standard | Dashboard interne admin |
| 3 | A/B testing framework | Standard | Firebase Remote Config + Analytics |
| 3 | RGPD export/delete | Obligatoire EU | Self-service complet |
| 3 | Health Connect Android prep | Anticipation wrap | Plugin Capacitor ready |
| 3 | HealthKit iOS prep | Anticipation V2 | Plugin Capacitor ready |

---

## 3. Contraintes de non-régression (NON NÉGOCIABLES)

Toute violation de ces règles invalide la PR :

1. **Aucun fichier existant ne doit être supprimé.** Seuls ajouts et patches additifs.
2. **Aucune signature de fonction publique ne doit changer.** Si extension nécessaire, créer une fonction nouvelle ; déprécier l'ancienne avec commentaire sans la retirer.
3. **Aucune route existante ne doit changer de comportement par défaut.** Si extension, feature flag `OFF` par défaut, route v2 séparée préférable.
4. **Aucune Security Rule Firestore existante ne doit être affaiblie.** Uniquement ajouts ou restrictions supplémentaires.
5. **Aucun schema Firestore existant ne doit avoir un champ supprimé ou typé différemment.** Uniquement ajout de champs optionnels (`field?: T`).
6. **Tous les nouveaux écrans sont sous feature flag** (Firebase Remote Config). Flag par défaut `false`.
7. **Tous les prompts Gemini existants restent inchangés.** Nouveaux prompts dans nouveaux fichiers.
8. **Tests E2E Playwright existants doivent passer 100%** avant et après chaque PR. Pipeline CI bloque le merge sinon.
9. **Coverage tests nouveaux modules ≥ 70%** sur logique métier.
10. **Rollback documenté** : chaque module doit pouvoir être désactivé via feature flag sans redéploiement.

---

## 4. Technical Specs par module

### 4.1 Architecture additive globale

Tous les nouveaux modules suivent la convention :

```
lib/features/<module-name>/
  index.ts                  # exports publics
  config.ts                 # feature flag, constantes
  schema.ts                 # Zod schemas
  client.ts                 # API client si externe
  hooks.ts                  # React hooks
  prompts.ts                # prompts Gemini dédiés
  README.md                 # doc module isolé

components/features/<module-name>/
  <Module>Screen.tsx
  <Module>Card.tsx
  ...

app/(app)/<module-route>/page.tsx    # nouvelle route, jamais existante
app/api/<module-name>/route.ts        # nouvelle API route

functions/src/features/<module-name>/  # Cloud Function dédiée si scheduled
```

**Pattern feature flag** :

```typescript
// lib/features/flags.ts
import { remoteConfig } from "@/lib/firebase/client";

export const flags = {
  photoMeal: () => getRemoteValue("feature_photo_meal", false),
  glp1: () => getRemoteValue("feature_glp1", false),
  fasting: () => getRemoteValue("feature_fasting", false),
  // ...
};
```

Tout écran nouveau commence par :
```typescript
if (!flags.photoMeal()) return <NotAvailable />;
```

### 4.2 Détail des 25 modules

#### M1 — Photo-to-meal IA
- Route : `app/(app)/log/photo/page.tsx`
- API : `app/api/nutrition/photo-recognize/route.ts`
- Prompt Gemini Vision : retourne JSON `{ items: [{ name, qty_estimated_g, kcal, p, c, f, confidence }], total }`
- UX : capture photo → preview avec items éditables → confirmation log
- Cache résultats par hash image (Cloud Storage)

#### M2 — Barcode scanner
- Lib : `@zxing/browser` (PWA-compatible, fonctionne en WebView Android)
- API : `app/api/nutrition/barcode/route.ts` → query Open Food Facts FR
- Fallback : MyFitnessPal scraping interdit ; alternative Nutritionix API si manquant

#### M3 — Voice logging
- Cloud Speech-to-Text (region europe-west1, modèle latest_long FR-fr)
- Pipeline : audio (WebRTC) → STT → texte → Gemini Flash parse en items structurés → log
- Bouton micro permanent sur dashboard

#### M4 — GLP-1 medication tracking
- Schema Firestore : `users/{uid}/medications/glp1/`
  - molecule (semaglutide, tirzepatide, liraglutide), dose, frequency, start_date, side_effects[]
- Module dédié dans Settings + intégration au coach IA (le coach sait que le user est sous GLP-1 et adapte)
- Adaptations automatiques du plan : +20% protéines (la perte musculaire est le risque #1 sous GLP-1), focus résistance, monitoring nausées et hypoglycémies
- Disclaimer médical explicite, jamais de prescription

#### M5 — Jeûne intermittent
- Schema : `users/{uid}/fasting_protocol`
  - type (16:8, 18:6, 20:4, OMAD, custom), eating_window_start/end, days_active[]
- Timer fasting persistant dans la nav
- Synchronisé avec les autres données (énergie, faim, performance) pour analyse corrélation par Gemini

#### M6 — Base alimentaire EU (Open Food Facts FR/DE)
- Cron Cloud Function : ingestion incrémentielle daily de OFF (delta dump)
- Stockage : Firestore collection `content/foods/{id}` avec index sur `barcode`, `name_normalized`, `brand`
- Volume cible : 500k aliments FR/DE/IT/ES priorité
- Champs : kcal_100g, p_100g, c_100g, f_100g, fiber_100g, sodium_100g, allergens[], nutriscore, novascore

#### M7 — Wearables hub (Google Fit central)
- OAuth Google Fit + scopes : `fitness.body.read`, `fitness.activity.read`, `fitness.sleep.read`, `fitness.heart_rate.read`
- Cloud Function `wearable-sync-nightly` : pull last 24h pour chaque user opt-in
- Normalisation dans `users/{uid}/wearable_sync/{date}`
- UI Settings → Connexions : Google Fit (hub), Withings (direct), Garmin (Health API)

#### M8 — TDEE adaptatif (MacroFactor-style)
- Cloud Function `tdee-recalc-weekly`
- Algo : régression linéaire sur moyenne glissante 14j poids + somme calories ingérées → estimation TDEE réel
- Affichage en transparence : "Ton TDEE estimé : 2480 kcal (révisé +60 vs semaine dernière)"
- Coach IA utilise cette valeur, pas le TDEE théorique Mifflin-St Jeor

#### M9 — Sourcing scientifique (RAG)
- Vertex AI Search index sur corpus curé :
  - Examine.com (synthèses, accès payant via API)
  - PubMed (abstracts open access via E-utilities NCBI)
  - Guidelines (ESPEN, EFSA, ANSES, OMS)
  - Manuels de référence (Schoenfeld training, Helms cut)
- Coach IA cite ses sources : "Selon une méta-analyse 2022 (Helms et al.), la perte de masse maigre en déficit est minimisée à 2,2 g de protéines/kg LBM."
- Affichage des sources cliquables en fin de message

#### M10 — Parcours profil-spécifique
- Nouvelles routes onboarding bifurquées selon profil détecté :
  - `/onboarding/high-bf`
  - `/onboarding/ex-athlete`
  - `/onboarding/glp1`
  - `/onboarding/post-bariatric`
- Chaque parcours injecte des contraintes spécifiques dans le générateur de plan

#### M11 — Body Scanner photo IA
- Route : `app/(app)/scanner/page.tsx`
- Capture 4 photos (face, dos, profil G, profil D) sur fond uniforme, posture standardisée
- Gemini Vision multi-image : retourne JSON `{ bf_pct_estimated, morphology_notes[], changes_vs_previous[], asymmetries[], posture_observations[] }`
- Comparaison auto avec scan précédent → narratif des changements
- Fréquence : 1x par mois recommandée

#### M12 — Form check vidéo
- Upload vidéo MP4/MOV < 30s d'un exercice (squat, deadlift, bench, etc.)
- Gemini Vision sur frames extraites (1 frame / 0,5s) + prompt spécialisé technique
- Retour : observations technique + recommandations + score 1-10
- Limité à 5 form checks/mois en Premium, illimité Premium+

#### M13 — Micro-tâches comportementales daily
- Schema : `content/micro_tasks/{id}` (banque de 200+ tâches)
- Algorithme de sélection : 1 tâche/jour adaptée au profil + flags actifs + jour de la semaine
- Exemples factuels (pas "tu es génial") : "Aujourd'hui, pèse 3 aliments que tu mangerais d'habitude à l'œil. Note les écarts."
- Validation simple : fait / pas fait, sans gamification

#### M14 — Import recette + OCR
- Upload photo de recette (livre, magazine, capture écran site)
- Gemini Vision → extraction structurée `{ name, ingredients: [{ name, qty, unit }], steps[], servings, total_kcal_estimated, macros }`
- Sauvegarde dans `users/{uid}/recipes/{id}`
- Pouvoir l'utiliser ensuite comme un repas logué

#### M15 — Micronutriments
- Extension du schema food : déjà couvert si OFF en M6
- Dashboard micronutriments : 14 cibles (vit A, C, D, E, K, B1-B12, Ca, Mg, K, Na, Fe, Zn, Se, I)
- Alertes carences récurrentes (< 70% AJR sur 14 jours)
- Recommandations alimentaires correctives (jamais supplémentaires sans bilan sanguin)

#### M16 — Upload bilan sanguin
- Upload PDF/JPG de NFS, bilan lipidique, glycémie, thyroïde
- Gemini Vision parse → JSON normalisé `{ markers: [{ name, value, unit, reference_range, status }] }`
- Stockage `users/{uid}/bloodwork/{date}`
- Alertes auto sur hors-norme + intégration au contexte coach IA
- Disclaimer médical strict

#### M17 — Système de parrainage
- Code unique par user (généré à l'onboarding)
- Tracking via Firebase Dynamic Links (ou alternative post-shutdown : URL custom + cookie)
- Récompense : 1 mois Premium offert au parrain et au filleul
- Module Settings → Parrainage

#### M18 — Streak factuel
- Compteur de jours consécutifs avec check-in quotidien complet
- Affichage sobre : "47 jours" (pas de flammes, pas de confettis, pas de "tu déchires")
- Stocké `users/{uid}/streak/{current, longest}`

#### M19 — Notifications smart FCM
- Cloud Function `smart-notifications-cron` (toutes les heures)
- Logique : déterminer si une notif est pertinente pour ce user à cette heure-ci selon : check-in pas fait, plateau détecté, milestone atteint, micro-tâche du jour, rappel jeûne
- Templates personnalisés par Gemini Flash (jamais des templates statiques)
- Opt-out granulaire par catégorie

#### M20 — Stripe Portal avancé
- Pages dédiées dans Settings :
  - Voir plan actuel
  - Changer (upgrade Premium → Premium+, ou inverse, prorata)
  - Pause (1 à 3 mois, données conservées, accès limité)
  - Annuler (avec étape rétention : raison + offre 50% 3 mois)
- Webhook Stripe complet : tous les événements lifecycle gérés

#### M21 — Cohort analytics admin
- Dashboard interne `/admin` (protégé par claim Firebase `admin: true`)
- Métriques : DAU, WAU, MAU, rétention J1/J7/J30/J90, funnel onboarding, conversion freemium→Premium, churn par cohorte, NPS rolling
- Source : Firebase Analytics + BigQuery export

#### M22 — A/B testing framework
- Firebase Remote Config + custom A/B tests
- Library : variants par feature flag avec hashing user_id stable
- Logging événements `experiment_exposure` et `experiment_conversion` vers BigQuery
- 1er test à lancer : prix annuel 179€ vs 149€ vs 199€

#### M23 — RGPD export + delete
- Settings → Confidentialité
- Export : zip de tout `users/{uid}/*` en JSON + photos en fichiers, envoyé par email signed URL expiration 24h
- Delete : Cloud Function `delete-user-data` qui purge Firestore + Storage + Stripe customer cancel + envoi email confirmation
- Conformité Article 17 RGPD (droit à l'oubli)

#### M24 — Health Connect Android prep
- Wrapper `lib/platform/health.ts` avec interface unifiée
- Implémentation web : stub no-op + lecture Google Fit OAuth
- Implémentation Android future (post wrap Capacitor) : `@kiwi-health/capacitor-health-connect` plugin
- Tests : signature stable de l'interface

#### M25 — HealthKit iOS prep
- Même wrapper que M24
- Implémentation iOS future : `@capacitor-community/health` plugin
- Tests : signature stable

---

## 5. Acceptance Criteria

### 5.1 Non-régression (CRITIQUE)

1. Les 100% des tests E2E Playwright préexistants passent verts après chaque PR
2. Aucun fichier existant supprimé (vérifiable par `git log --diff-filter=D`)
3. Aucun champ Firestore existant supprimé ou renommé (vérifiable par diff schemas)
4. Toutes les Security Rules existantes maintenues ou renforcées (vérifiable par tests Firebase rules-unit-testing)
5. Tous les feature flags par défaut `false` en production (vérifiable Remote Config console)
6. Performance : Lighthouse score mobile ne régresse pas de plus de 3 points

### 6.2 Nouveaux modules

Pour chaque module Mx :
1. Feature flag présent dans `lib/features/flags.ts` et désactivé par défaut
2. Activation via Remote Config rend le module accessible sans redéploiement
3. Tests unitaires Vitest avec couverture ≥ 70% sur la logique métier
4. Test E2E Playwright du parcours nominal du module
5. README.md du module avec procédure de rollback documentée
6. Pour modules touchant la santé (M4, M11, M15, M16) : disclaimer médical en place, garde-fou safety layer activé

### 6.3 Activation progressive en production

1. Document `docs/extensions-rollout.md` produit avec ordre d'activation et critères A/B
2. Premier test A/B configuré (M22) avec une hypothèse testable
3. Dashboard admin (M21) accessible et fonctionnel
4. Export/Delete RGPD (M23) testé end-to-end

---

## 6. Files to Add / Modify

### 6.1 Nouveaux fichiers attendus (estimation)
- 25 dossiers `lib/features/<module>/` × ~6 fichiers = ~150 fichiers
- 25 dossiers `components/features/<module>/` × ~4 composants = ~100 fichiers
- ~30 nouvelles routes pages
- ~25 nouvelles routes API
- ~15 nouvelles Cloud Functions
- ~50 nouveaux tests unitaires
- ~25 nouveaux tests E2E
- 4 nouveaux documents docs/

**Total estimé** : 350-400 fichiers ajoutés.

### 6.2 Fichiers à modifier (modifications uniquement additives)
- `lib/features/flags.ts` (création + ajouts incrémentaux)
- `firestore.rules` (ajouts uniquement)
- `firestore.indexes.json` (nouveaux index)
- `storage.rules` (nouvelles règles uniquement)
- `package.json` (nouvelles dépendances)
- `.env.example` (nouvelles variables)
- `next.config.mjs` (nouvelles configs si nécessaire, jamais de suppression)

### 6.3 Nouvelles variables d'environnement
```
OPENFOODFACTS_API_BASE=https://world.openfoodfacts.org
NUTRITIONIX_APP_ID=
NUTRITIONIX_APP_KEY=
GOOGLE_FIT_OAUTH_CLIENT_ID=
GOOGLE_FIT_OAUTH_CLIENT_SECRET=
WITHINGS_CLIENT_ID=
WITHINGS_CLIENT_SECRET=
GARMIN_CONSUMER_KEY=
GARMIN_CONSUMER_SECRET=
VERTEX_AI_SEARCH_DATASTORE_ID=
PUBMED_API_KEY=
EXAMINE_API_KEY=
FIREBASE_DYNAMIC_LINKS_URL_PREFIX=
ADMIN_EMAILS=
```

### 6.4 Nouveaux flags Remote Config
```
feature_photo_meal: bool = false
feature_barcode: bool = false
feature_voice_log: bool = false
feature_glp1: bool = false
feature_fasting: bool = false
feature_off_db: bool = false
feature_wearables: bool = false
feature_tdee_adaptive: bool = false
feature_rag_sourcing: bool = false
feature_profile_paths: bool = false
feature_body_scanner: bool = false
feature_form_check: bool = false
feature_micro_tasks: bool = false
feature_recipe_ocr: bool = false
feature_micronutrients: bool = false
feature_bloodwork_upload: bool = false
feature_referral: bool = false
feature_streak: bool = false
feature_smart_notifs: bool = false
feature_stripe_portal_advanced: bool = false
feature_admin_dashboard: bool = false
feature_ab_framework: bool = false
feature_gdpr_self_service: bool = false
feature_health_connect: bool = false
feature_healthkit: bool = false
```
