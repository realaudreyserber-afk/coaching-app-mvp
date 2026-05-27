# Backlog NoDream Tactical OS

> **Document vivant** — Claude met à jour à chaque session.
> Lis ce fichier en début de session pour reprendre où on en était.
>
> **Conventions :**
> - `- [ ]` = todo
> - `- [x]` = fait
> - `- [~]` = en cours / bloqué
> - Date d'ajout en suffixe : `(2026-05-26)`
> - Date de complétion en suffixe quand coché : `(✓ 2026-05-27)`
> - Préfixer par `**[P0]**` / `**[P1]**` / `**[P2]**` quand priorité connue

---

## 🚨 P0 — Bloquants prod

- [~] **[P0]** Webhook GitHub → Vercel ne déclenche plus les builds — détecté 2026-05-26 vers 23h. Les commits `14d60e7`, `12b7477`, `531aa63`, `adddba7` poussés mais Vercel n'a pas créé de deploy pour eux. Le dernier deploy Ready est `09dbc3d` à 29 min ago. Vérifier [Vercel Git settings](https://vercel.com/realaudreyserber-1346s-projects/coaching-app-mvp/settings/git) + [GitHub Webhooks Recent Deliveries](https://github.com/realaudreyserber-afk/coaching-app-mvp/settings/hooks). En attente : reset quota Vercel Free Tier (100 deploys/jour, atteint 2026-05-26).

- [~] **[P0]** `/login` inaccessible en mode normal — toutes les fixes sont en LOCAL (commit `531aa63`) mais pas en prod tant que webhook Vercel/quota ne sont pas débloqués. Workaround : test sur `localhost:3001/login` qui fonctionne. (2026-05-27)

---

## 🔧 Ops — toi (CLI / Cloud)

- [ ] **[P0]** Vérifier deploy Vercel le 2026-05-27 (quota reset à 0h UTC) — relancer un build pour pousser `531aa63` en prod, puis tester `/login` sur `coaching-app-mvp.vercel.app`. (2026-05-27)

- [ ] **[P0]** Refaire onboarding sous compte Google — ton plan actuel est sous un UID anonymous (un des 2 `keep_completed`), pas sous ton user Google `real.audrey.serber@gmail.com` (UID `x4djKXyNrXagBI6hMw74E34pHJy1`). Solution : aller sur localhost:3001 ou prod, faire les 8 steps de l'onboarding sous ce UID Google → tu auras un plan persistant Katch-McArdle. (2026-05-27)

- [ ] **[P1]** Op #2 — Deploy plateauDetector Cloud Function (2026-05-26)
  ```powershell
  cd C:\Users\Utilisateur\.gemini\antigravity\scratch\coaching-app-mvp
  firebase deploy --only functions:plateauDetector --project linsociable-coaching
  ```
  Liens si APIs à activer : [Cloud Build](https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com?project=linsociable-coaching) · [Artifact Registry](https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com?project=linsociable-coaching)

- [ ] **[P1]** Tester onboarding 8 steps (Wave 9, commit `f2ec516`) — `/settings → Refaire mon onboarding → /onboarding/4` (BF%) puis jusqu'à `/onboarding/8` (génération). Vérifier que la justification du nouveau plan mentionne "Katch-McArdle". (2026-05-26)

- [ ] **[P1]** Tester /plan/history (commit `78c2a0c`) — cliquer "Historique" depuis /plan, déplier les détails de l'ancien plan vs le nouveau. (2026-05-26)

- [ ] **[P1]** Nettoyer les 4 UIDs restants après cleanup partiel — 3 anonymes + 1 2e Google (`audrey.serber@gmail.com`). Commande :
  ```powershell
  node scripts/cleanup-anonymous-users.mjs --uids=WJlraYwcpHc2UyiEE7rnDYR6E7o1,wuLfwJvWEZYdYC6zhnGOodh9BPa2,uHVk2XSnIvdBxyuKAmDNoTG7cy82,DwcBRHVs45cZbgzda24dZholnCX2 --confirm
  ```
  ⚠ ATTENTION : un des UIDs anonymes (`keep_completed`) contient probablement TON plan d'onboarding initial. À supprimer SEULEMENT après avoir refait l'onboarding sous compte Google + vérifié que le nouveau plan est OK. (2026-05-27)

- [ ] **[P2]** (Optionnel) Op #5 — Configurer `GOOGLE_CREDENTIALS_BASE64` sur [Vercel env vars](https://vercel.com/realaudreyserber-1346s-projects/coaching-app-mvp/settings/environment-variables) pour activer le TTS audio du coach. (2026-05-26)

---

## ⚙️ Code — moi

### Observabilité / CI

- [x] **[P1]** Sentry sur routes coach — fait Wave 13C pour /api/ai/coach, /api/coach/apply-patch, /api/coach/proactive. **Reste à étendre** aux autres routes Vertex : analyze-photo, weekly-review, daily-insight, bloodwork/analyze, scanner/analyze, nutrition/photo-recognize, coach-session-* (commit `0e46418`).
- [ ] **[P2]** Workflow CI Playwright — `.github/workflows/e2e.yml` pour `e2e/coach-flow.spec.ts` + `e2e/onboarding.spec.ts` sur chaque PR (avec webServer Next + `npx playwright test`). (2026-05-26)
- [ ] **[P2]** Dashboard badge dot E2E — wire Firestore emulator pour valider vraiment le badge unread coach. Test actuellement volontairement faible, cf `e2e/coach-flow.spec.ts:78-80`. (2026-05-26)

### Data / Migration

- [ ] **[P1]** Script de migration `anonymous → Google` — quand un user se logge en Google après avoir fait l'onboarding en mode anonymous, son plan/profile/baseline restent orphelins sous l'UID anonymous. Solution : implémenter `linkWithCredential` au moment du Google login, OU script de migration post-hoc qui copie users/{anonymous_uid}/* vers users/{google_uid}/*. (2026-05-27)
- [ ] **[P2]** Migration `wearable_sync` legacy camelCase → snake_case — script `scripts/migrate-wearable-sync.mjs`. Pas critique tant que peu de users actifs. (2026-05-26)
- [ ] **[P2]** PWA icons NoDream — régénérer `/public/icons/icon-192.png`, `icon-512.png`, `maskable-*.png` avec le brand NoDream actuel. Les icons actuels sont peut-être legacy. (2026-05-26)
- [x] **[P2]** Dashboard insight cache — fait Wave 13A (commit `da2b9cd`).
- [x] **[P2]** Coach scrollIntoView throttle — fait Wave 13B (commit `dc93079`).
- [x] **[P2]** Coach 100vh → 100dvh iOS Safari — fait Wave 13B (commit `dc93079`).

### UX onboarding

- [ ] **[P2]** STEP_PHOTOS dédiées — générer via Nano Banana 2 deux photos éditoriales N&B pour step 4 (BF% / caliper) et step 6 (rack + barres / Matrix-tactical). Actuellement réutilise measurements/activity. (2026-05-26)
- [ ] **[P2]** `available_equipment` liste précise au step training — checkboxes "Barre + rack / Haltères / Banc / Barre traction / Élastiques" pour les users qui ont un home_gym partiel. (2026-05-26)
- [ ] **[P2]** Bouton "Skip onboarding" mode limité — autoriser l'accès au coach avec contexte réduit avant complétion full. (2026-05-26)
- [ ] **[P2]** Step 4 BF% — ajouter un mode "j'ai mesuré X%" en saisie numérique exacte (en plus des 5 ranges visuels). (2026-05-26)
- [ ] **[P2]** Step 7 Goals — ajouter `target_bf_pct` en plus de `target_weight` pour que le coach ait une cible BF%. (2026-05-26)
- [ ] **[P2]** Lien "Déjà un compte ? Se connecter" visible dès /onboarding/1 — pour que les nouveaux users qui ont déjà un Google account ne refassent pas l'onboarding en mode anonymous. (2026-05-27)

### Coach

- [ ] **[P1]** Vérifier que le coach context envoie bien BF% dans le prompt — `lib/vertex/context-builder.ts:259` doit sortir `BF actuel: 32%` quand `baseline.bf_pct` présent. Vu rapidement OK, mais pas testé end-to-end. (2026-05-26)
- [ ] **[P2]** Hook coach proactif "BF% manquant" — si après 3 jours d'usage le user n'a toujours pas de `baseline.bf_pct`, le coach propose de l'ajouter via /settings ou par message. (2026-05-26)
- [ ] **[P2]** Récupérer les mensurations partagées au coach AVANT le whitelist update — dans la conv 2026-05-27, l'user a donné `neck=50, waist=120, arm=44, forearm=39, shoulder=143, wrist=19`. Les champs `arm/forearm/shoulder/wrist/thigh/calf/chest_cm` n'étaient pas dans le whitelist `update-fields/route.ts` à ce moment-là (étendu par commit `90ebeb7` après coup) → tentatives `<COACH_SAVE>` du coach silently rejected. **Solution simple** : retourner sur /coach et redire "re-sauvegarde mes mensurations : cou 50, taille 120, bras 44, avant-bras 39, épaules 143, poignet 19" → le coach émet un nouveau `<COACH_SAVE>` qui sera accepté cette fois (whitelist OK). **Plus tard** : implémenter un parsing du chat history pour récup auto (ROI/complexité à évaluer). Cf. aussi le script `scripts/show-profile.mjs` créé en session pour auditer `users/{uid}.profile.*_cm`. (2026-05-27)
- [ ] **[P2]** UI Settings — saisie directe des mensurations supplémentaires — `arm_cm`, `forearm_cm`, `shoulder_cm`, `wrist_cm`, `thigh_cm`, `calf_cm`, `chest_cm` sont whitelist côté serveur (commit `90ebeb7`) mais ne sont pas saisissables hors chat coach. Ajouter un bloc dans Settings Profile Card (grille 7 inputs number, optionnels) pour ceux qui n'aiment pas le chat. (2026-05-27)
- [ ] **[P2]** Activer explicit context caching dans `/api/ai/coach/route.ts` — l'helper `getCoachSystemPromptCache()` (`lib/vertex/cached-coach-prompt.ts`) et le support `cachedContentName` dans `client.ts` sont en place. Reste à :
  (a) refactor `buildEnrichedSystemPrompt` pour exposer une fonction qui retourne SEULEMENT les blocks dynamiques (sans COACH_SYSTEM_PROMPT — qui est déjà dans le cache),
  (b) modifier coach/route.ts pour récupérer `cacheName = await getCoachSystemPromptCache()` puis si non-null prepend les blocks dynamiques dans le 1er message user + appel `generateTextStream({ cachedContentName, ...sans systemInstruction })`,
  (c) tester côté streaming SSE (le pattern actuel doit continuer à marcher en fallback no-cache).
  **Pourquoi pas maintenant** : refactor invasif du coach déjà débuggé cette session, gain économique incertain tant qu'on n'a pas mesuré le volume de messages réels. L'implicit caching natif de Gemini 3.5 Flash fait probablement déjà ~80% du job sans modification. À monitorer dans Vertex AI usage avant de pousser l'explicit. (2026-05-27)
- [ ] **[P2]** RAG nutrition — indexer la lib recettes dans le RAG coach — Le RAG actuel indexe 250+ exos + 20 méthodes. Étendre à `lib/features/recipes/` pour que le coach puisse retrieve des recettes pertinentes quand l'user pose une question alimentaire. Implémentation : (a) `scripts/build-rag-recipes.mjs` via `text-multilingual-embedding-002`, (b) `lib/features/rag-coach/embeddings/recipes.json` committé, (c) `retrieveRecipes()` dans `retrieve.ts`, (d) extension `buildCoachRagFragment` pour inclure recettes si query touche nutrition (heuristique mot-clé OU classification IA), (e) nouveau bloc `[RECETTES PERTINENTES]` dans le coach prompt. Plus de boulot que le RAG exercices car embeddings doivent être recalculés si la lib change. (2026-05-27)
- [ ] **[P2]** Compléter le corpus Ottawa P1208 — `docs/corpus/corpus-nutrition-ottawa.md` est ingéré partiellement (sections 1-11 + 12 partielle). Sections **manquantes** : fin §12 (recommandations pratiques échelle de faim), §13 (ressources externes), §14 (modèle de journal alimentaire). Quand le contenu intégral arrive : compléter le markdown + ajouter les items correspondants dans `scripts/seed-corpus.mjs` (section `nutritionGuides`). (2026-05-27)
- [ ] **[P2]** Op — Lancer `seed-corpus.mjs` pour pousser les 5 nutrition_guides en Firestore — `scripts/seed-corpus.mjs` a été étendu avec 5 items Ottawa (`ottawa-principes-fondamentaux`, `ottawa-auto-evaluation-habitudes`, `ottawa-modele-assiette-equilibree`, `ottawa-besoins-proteines-grand-public`, `ottawa-echelle-faim`). À pousser en prod via : `node scripts/seed-corpus.mjs` avec les env vars FIREBASE_ADMIN_* (présentes dans `.env.local` et Vercel). Va créer la collection `content/nutrition_guides/items/`. (2026-05-27)
- [ ] **[P2]** Ajouter `searchNutritionGuides()` dans `lib/features/rag-sourcing/internal-corpus.ts` — Une fois les nutrition_guides indexés en Firestore (cf. Op ci-dessus), implémenter une fonction de recherche par theme (ex: "satiete", "proteines", "assiette") qui retourne les guides Ottawa pertinents. Brancher ensuite dans le coach context builder via un nouveau block `[GUIDES NUTRITIONNELS]` injecté quand la query user touche à la gestion de poids / habitudes / portions. (2026-05-27) → ✅ **fait dans commit `a1cd80f` (local non pushé)** : `searchNutritionGuides` ajouté à `internal-corpus.ts`, branché dans `searchScientificCorpus` cap 4→5.

### Agents & orchestration

- [ ] **[P3]** Niveau 3 — Coach agentique avec tool use Gemini — Refactor du coach en agent loop avec `functionDeclarations`. Tools proposés : data (`fetch_progress_chart`, `fetch_session_history`, `search_recipes_by_macros`, `get_nutrition_guide`...), action (`apply_plan_patch`, `regenerate_full_plan`, `trigger_diet_break`), safety (`flag_safety_review`). Architecture : agent loop max 5 tours, streaming SSE partiel, audit log dans `users/{uid}/agent_tool_calls/{id}`. Garde-fous : tools action nécessitent confirmation user en text, validation Zod sur args, cap latence/tokens. **Scope invasif** : ~8-10 fichiers, ~800-1200 lignes net. Nouveaux fichiers : `lib/vertex/agent-tools.ts`, `lib/vertex/tool-executors.ts`, `lib/vertex/agent-loop.ts`. **Pourquoi pas maintenant** : Niveau 1+2 déjà déployés en prod (11/12 Cloud Functions actives, `/api/coach/proactive` avec 4 triggers) couvrent 80% des cas d'usage. Tool use brille surtout sur workflows complexes multi-étapes — overkill pour MVP actuel. À envisager quand le projet aura besoin d'autonomie agent (notifs proactives intelligentes, déclenchement automatique de regen plan, etc.). (2026-05-27)

### Refactor / nettoyage

- [ ] **[P2]** Steps onboarding non câblés à arbitrer — `Step6Lifestyle`, `Step8Medical`, `Step10Nutrition` exportés dans `steps.tsx` mais jamais utilisés dans le switch. Soit on les supprime, soit on les active dans une "phase 2" optionnelle post-onboarding. (2026-05-26)

### Auth

- [ ] **[P1]** Stratégie auto-anonymous vs Google login — actuellement `signInAnonymously()` au mount empêche `/login` d'être atteignable en mode normal sans détection `user.isAnonymous` partout. Patches déjà appliqués sur `/login/page.tsx` (commits `12b7477` + `531aa63`) mais à terme, soit désactiver l'auto-anonymous, soit ajouter un Welcome screen `Continuer en invité / Se connecter`. (2026-05-27)

---

## 💡 Nice to have (futur)

- [ ] **[P3]** Self-host des modèles Veo / Nano Banana ? (hors scope coaching-app, plutôt Humbolo)
- [ ] **[P3]** Mode multi-coach (ORACLE.IA / SYRINX.IA / etc.) — si on veut différencier coach nutrition vs coach training.
- [ ] **[P3]** Export PDF d'un plan archivé (depuis /plan/history) pour partager avec un nutritionniste.
- [ ] **[P3]** Page de comparaison côte-à-côte "Plan A vs Plan B" depuis /plan/history.
- [ ] **[P3]** Intégrer 16 programmes Fitadium comme few-shot examples dans le prompt `/api/ai/generate-plan` pour améliorer la qualité des plans générés (cf programmes récupérés 2026-05-26 : Débutant, Prise de masse, Sèche, Perte poids homme, Force, etc.). (2026-05-27)

---

## 📌 Bancal — dette à surveiller

_Liste des défauts connus, à ne PAS corriger sans réflexion (souvent il y a une raison)._

- `dashboard badge dot` E2E volontairement faible (mock mode skip Firestore reads). Plus de robustesse nécessite un setup emulator complexe.
- Migration `user.onboarding_completed = true` pour les anciens users qui ont un plan : pas faite automatiquement. Solution actuelle = passer par /settings → Refaire onboarding (rare cas vu peu d'users).
- `STEP_PHOTOS` réutilise certaines images (steps 4 et 6 = measurements/activity). Pas dramatique mais pas optimal.
- **Quota Vercel Free = 100 deploys/jour** — atteint le 2026-05-26 après ~20 commits + redéploys. Bloque toute push pendant 24h. Solution si récurrent : upgrade Vercel Pro ($20/mois). Workaround : tester en local via `npm run dev`.
- **Auto-anonymous sign-in au mount** (`auth-provider.tsx:166`) — empêche `/login` d'être atteignable en mode normal sans détection `user.isAnonymous` ad-hoc dans chaque page d'auth. Patches en place mais l'architecture mériterait un Welcome screen.
- **Pas de `linkWithCredential` lors du Google login** — quand un user fait l'onboarding en mode anonymous puis se logge Google, ses données (plan, profile, baseline) restent orphelines sous l'UID anonymous. Confirmé sur le compte du dev 2026-05-27.
- **Empty commits forcent un redeploy Vercel** — `git commit --allow-empty -m "trigger redeploy"` + push relance le webhook. Utile quand Vercel saute un commit, mais consomme du quota Free.
- **Steppers live page reset à 0 au changement d'exo** (Wave 11B) — la nouvelle logique d'init sur `[activeExerciseIdx]` réinitialise SYSTÉMATIQUEMENT les steppers au switch d'exo (vs l'ancien guard `weight===0 && reps===0`). Si l'user logge un set, navigue, revient, le `last_performance` (mis à jour par onSnapshot) écrase ses valeurs actuelles. Acceptable car le `last_performance` est la cible légitime, mais à reconsidérer si feedback user négatif.
- **Confirm text delete account devenu "EFFACER" partout** (Wave 11C) — si tu as documenté ailleurs "tape SUPPRIMER", il faut mettre à jour. Le serveur n'accepte que "EFFACER".

---

## 🔍 Audit Wave 13C — items à faire (reste de l'audit)

Items identifiés par l'audit du 2026-05-27 mais pas encore traités (P1/P2 plus bas que les 7 routes fixées) :

- [ ] **[P1]** Étendre Sentry captureException aux autres routes Vertex : `app/api/ai/analyze-photo`, `weekly-review`, `daily-insight`, `bloodwork/analyze`, `scanner/analyze`, `nutrition/photo-recognize`, `coach-session-cue`, `coach-session-debrief`, `coach-session-debrief`, `coach-meal-feedback`, `coach-audio`, `coach-progress-analysis`.
- [ ] **[P2]** Rate-limit sur les routes secondaires : `app/api/profile/update-fields`, `app/api/user/tdee-recalc`, `app/api/notifications/register`, `app/api/nutrition/barcode`, `app/api/micro-tasks/today`, `app/api/user/export`, `app/api/user/delete`.
- [ ] **[P2]** Firestore rules — étendre validation shape sur : `medications` (cap size + required fields), `micronutrients_daily` (numeric ranges), `experiments` (whitelist exp_id), `referrals` (cap size).
- [ ] **[P2]** Magic numbers — rewire les `setTimeout(..., 2000)` dispersés dans 4 pages settings vers `TOAST_DURATION_MS` (constante créée Wave 13C). Aussi les `setTimeout(..., 800)` dans `components/onboarding/steps.tsx` (fake delays).
- [ ] **[P2]** Recharts code-splitting — `dynamic(() => import('@/components/dashboard/weight-chart'))` pour réduire le bundle initial (~96KB gz). Le composant est déjà mount-gated mais pas lazy-loaded.
- [ ] **[P3]** Accessibility settings/notifications + settings/privacy : audit des `htmlFor`/`id` (10 inputs, 12 htmlFor — il manque 2 associations).
- [ ] **[P3]** Silent catch logging — `.catch(() => {})` dans `app/api/stripe/checkout/route.ts:55` (rollback creating flag) + `lib/features/rag-sourcing/client.ts:38-40` (PubMed/Corpus/Internal cascade). Au moins Sentry breadcrumb.

---

## ✅ Historique récent

### Session 2026-05-27

- [x] Fix Google sign-in popup → redirect — `signInWithPopup` était instable sur web (cookies tiers, popup bloqué, popup fermé prématurément). Switch en `signInWithRedirect` + `getRedirectResult()` au mount (commit `14d60e7`). EN LOCAL — pas encore en prod tant que Vercel ne rebuild pas. (✓ 2026-05-27)
- [x] Fix `/login` useEffect skippe le redirect si `user.isAnonymous` — sinon le auto-anonymous empêche d'accéder à la page de login (commit `12b7477`). (✓ 2026-05-27)
- [x] Fix `/login` Loader skippe aussi si `user.isAnonymous` — sinon page bloquée sur "Préparation de ton espace..." même quand le redirect est skippé (commit `531aa63`). (✓ 2026-05-27)
- [x] 16 programmes Fitadium fetchés et analysés — comparison patterns vs plan IA généré. Pas intégré dans le code, juste référence pour future few-shot prompt. (✓ 2026-05-27)
- [x] **Wave 11A** — Extension schéma repas avec `items[]` grammage + macros (cause racine "repas sans grammage" demandée par l'user). Étendu Zod schema, Vertex JSON schema, prompt plan-generator, types/plan.ts, MealCard. Back-compat préservée via fallback `description` (commit `bbb55ca`). (✓ 2026-05-27)
- [x] **Wave 11B** — Bugs critiques /session live : refus 2e session in_progress server-side (409), useRef vs state pour double-tap log-set, revoke blob URLs audio (leak), warning UI "⚠ Hors-base RAG" sur exo hallucinations Wave 10, init steppers robust pour poids du corps, AMRAP autorisé (reps=0 OK si target=AMRAP/échec/max), bouton "Terminer (incomplet)" si anyLogged, cleanup dead code buildBlockCode (commit `168641c`). (✓ 2026-05-27)
- [x] **Wave 11C** — Unification delete account `/settings` ↔ `/privacy` : POST + confirmText=EFFACER + reauth pour les 2 pages, détection provider (Google popup / password prompt / autre fallback server check), remplacement des 3 alert() restart onboarding par setErrorMsg banner, filename `linsociable-export-` → `nodream-export-` (commit `c4ad481`). (✓ 2026-05-27)
- [x] **Wave 11D** — Coach streaming AbortController + 90s watchdog. Cleanup au démontage pour éviter "setState on unmounted component" warnings + memory leaks. Détection AbortError pour ne pas perturber l'UI sur navigation. Dashboard insight cache déferré en P2 (commit `b7c11b8`). (✓ 2026-05-27)
- [x] **Wave 11E** — Polish UX : limit(50) sur /plan/history, limit(180)+limit(104) sur /progress daily/weekly, photo onError fallback "Photo expirée" (Storage signed URLs expiration), runTransaction sur génération code référral (race 2 tabs), fix markdown `**` non rendu → `<strong>` (commit `77904bf`). (✓ 2026-05-27)
- [x] **Wave 12** — P0 sécurité OAuth Google Fit (cookie session vs `?uid=` spoofable), Bearer header manquant sur /api/user/sync-wearables. Dashboard `currentWeight.toFixed` crash protection via toNum(). Coach loadChatHistory dedup vs send race + cancelled cleanup. 9 pages : emoji 🚧 retiré au profit d'un tag `[BETA]` NoDream tech accent (cohérence avec feedback_no_emojis.md) (commit `b29e288`). (✓ 2026-05-27)
- [x] **Wave 13A** — P1 dashboard live coach badge (onSnapshot vs one-shot getDoc) + daily-insight cache 6h sur checkin.insight (évite POST Vertex à chaque refresh). Subscription Stripe URL allowlist (`checkout.stripe.com` / `billing.stripe.com`) avant `window.location.href` + normalize Firestore Timestamp/string/number pour period_end (évite "Invalid Date") (commit `da2b9cd`). (✓ 2026-05-27)
- [x] **Wave 13B** — P2 micronutrients 7 queries N+1 → 1 query range (`date >= start AND <= end`) + util local date Europe/Paris. Coach scrollIntoView throttle 6 fps + behavior:'auto' pendant streaming + 100vh → 100dvh iOS Safari. Workout summary Web Share fallback clipboard + toast gold "X copié" + debriefRequestedFor reset on session.id change (commit `dc93079`). (✓ 2026-05-27)
- [x] **Wave 13C** — Audit ouvert : rate-limit sur 7 routes Vertex/Stripe/FCM coûteuses (voice-recognize, recipe-ocr, send-smart, sync-wearables, stripe checkout+portal, onboarding restart). Sentry captureException sur 3 routes coach (Wave 11D bonus). Firestore rules shape validation : food_logs requires {date, kcal 0-10000} + ≤30 fields, coach_messages role MUST be 'user' côté client (anti-impersonation assistant). WeightChart memoize yMin/yMax + isAnimationActive=false (perf low-end). Lib/constants/ui.ts source de vérité pour les magic numbers UI. Tests rules étendus pour couvrir les 2 nouvelles contraintes (commit `0e46418`). (✓ 2026-05-27)

### Session 2026-05-26

- [x] Wave 7 #5-#10 — MealCard/ExerciseCard NoDream refactor, LRU cache embeddings, superset_group, focus trap modal, CI rules tests, E2E coach-flow (commit `9774c37`) (✓ 2026-05-26)
- [x] Op #1 — Build RAG embeddings 293 exos + 20 méthodes via Vertex text-multilingual-embedding-002 (commit `b38637a`) (✓ 2026-05-26)
- [x] Fix bug `onboarding_completed` flag — guard layout ne checkait `profile !== undefined` au lieu d'un flag dédié, éjectait les users mid-onboarding (commit `882d1dd`) (✓ 2026-05-26)
- [x] Wave 9 — Onboarding 6→8 steps (BF% + training profile), Katch-McArdle dans plan-generator prompt, endpoint `/api/onboarding/restart`, bouton settings (commit `f2ec516`) (✓ 2026-05-26)
- [x] UI `/plan/history` — liste tous les plans archivés + active, détection auto formule TDEE (commit `78c2a0c`) (✓ 2026-05-26)
- [x] **Wave 10** — Fix P0 hallucination RAG coach + auto `<COACH_PLAN_PATCH>` sur substitution. Étendu `ActivePlanSummary` avec `sessions[]`, injecté sessions+exos avec indices dans le prompt système via `activePlanBlock`, ajouté §18.5 règle 7 "patch obligatoire sur substitution d'exo", renforcé §19 règle 1 "interdiction absolue d'inventer un exo hors RAG" (commit `9b6b6c9`) (✓ 2026-05-26)
- [x] Script `scripts/cleanup-anonymous-users.mjs` — nettoyer Auth + Firestore des anonymous users sans onboarding fait (commit `80ef36d`) + flags `--keep-most-recent=N` (commit `7c1b397`) + `--uids=...` force-delete mode (commit `9005ade`) (✓ 2026-05-26)
- [x] Exécution cleanup — 36/36 anonymous users supprimés (Firestore + Auth) en une passe. 39 → 3 restants (2 keep_completed + 1 keep-most-recent). (✓ 2026-05-26)
- [x] Script `scripts/show-active-plan.mjs` — pretty-print du plan actif Firestore (kcal, macros, sessions avec indexes pour PLAN_PATCH, cardio, supplements, justification). Exposé via `npm run plan:show --email=...` (commit `09dbc3d`) (✓ 2026-05-26)

### Sessions précédentes

_Pour l'historique complet, voir `git log --oneline` ou `docs/handoff.md`._

---

## 🔄 Workflow de mise à jour

Quand tu (Claude) bosses sur ce projet :
1. **Au début** de chaque session : lis ce fichier pour reprendre où on en était.
2. **Pendant** : ajoute toute nouvelle tâche découverte en `- [ ]` dans la bonne section.
3. **À la fin** de chaque commit : déplace les tâches faites en `[x]` et copie-les dans **Historique récent** avec date + commit hash.
4. **Quand l'utilisateur indique** qu'une tâche ops est faite (deploy, test manuel, etc.), coche-la immédiatement.
