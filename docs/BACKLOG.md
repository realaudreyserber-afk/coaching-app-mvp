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

- [ ] **Hallucination RAG coach** — coach propose des exos hors-base. Observé 2026-05-26 sur question "remplace shoulder press" → suggestion "Développé Landmine" inexistant. Détail dans section **Code/Coach/Hallucinations RAG** ci-dessous. (2026-05-26)
- [ ] **Coach ne déclenche pas `<COACH_PLAN_PATCH>`** sur substitution d'exo — observe 2026-05-26 : alternative proposée mais plan actif non modifié. Détail dans section **Code/Coach/Hallucinations RAG** ci-dessous. (2026-05-26)

---

## 🔧 Ops — toi (CLI / Cloud)

- [ ] **[P1]** Op #2 — Deploy plateauDetector Cloud Function (2026-05-26)
  ```powershell
  cd C:\Users\Utilisateur\.gemini\antigravity\scratch\coaching-app-mvp
  firebase deploy --only functions:plateauDetector --project linsociable-coaching
  ```
  Liens si APIs à activer : [Cloud Build](https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com?project=linsociable-coaching) · [Artifact Registry](https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com?project=linsociable-coaching)

- [ ] **[P1]** Tester onboarding 8 steps (Wave 9, commit `f2ec516`) — `/settings → Refaire mon onboarding → /onboarding/4` (BF%) puis jusqu'à `/onboarding/8` (génération). Vérifier que la justification du nouveau plan mentionne "Katch-McArdle". (2026-05-26)

- [ ] **[P1]** Tester /plan/history (commit `78c2a0c`) — cliquer "Historique" depuis /plan, déplier les détails de l'ancien plan vs le nouveau. (2026-05-26)

- [ ] **[P2]** (Optionnel) Op #5 — Configurer `GOOGLE_CREDENTIALS_BASE64` sur [Vercel env vars](https://vercel.com/realaudreyserber-1346s-projects/coaching-app-mvp/settings/environment-variables) pour activer le TTS audio du coach. (2026-05-26)

---

## ⚙️ Code — moi

### Observabilité / CI

- [ ] **[P1]** Sentry sur routes coach — `/api/ai/coach`, `/api/ai/coach/*`, `/api/coach/apply-patch`, `/api/coach/proactive`. Actuellement les 500 Vertex partent dans logs Vercel uniquement. (2026-05-26)
- [ ] **[P2]** Workflow CI Playwright — `.github/workflows/e2e.yml` pour `e2e/coach-flow.spec.ts` + `e2e/onboarding.spec.ts` sur chaque PR (avec webServer Next + `npx playwright test`). (2026-05-26)
- [ ] **[P2]** Dashboard badge dot E2E — wire Firestore emulator pour valider vraiment le badge unread coach. Test actuellement volontairement faible, cf `e2e/coach-flow.spec.ts:78-80`. (2026-05-26)

### Data / Migration

- [ ] **[P2]** Migration `wearable_sync` legacy camelCase → snake_case — script `scripts/migrate-wearable-sync.mjs`. Pas critique tant que peu de users actifs. (2026-05-26)
- [ ] **[P2]** PWA icons NoDream — régénérer `/public/icons/icon-192.png`, `icon-512.png`, `maskable-*.png` avec le brand NoDream actuel. Les icons actuels sont peut-être legacy. (2026-05-26)

### UX onboarding

- [ ] **[P2]** STEP_PHOTOS dédiées — générer via Nano Banana 2 deux photos éditoriales N&B pour step 4 (BF% / caliper) et step 6 (rack + barres / Matrix-tactical). Actuellement réutilise measurements/activity. (2026-05-26)
- [ ] **[P2]** `available_equipment` liste précise au step training — checkboxes "Barre + rack / Haltères / Banc / Barre traction / Élastiques" pour les users qui ont un home_gym partiel. (2026-05-26)
- [ ] **[P2]** Bouton "Skip onboarding" mode limité — autoriser l'accès au coach avec contexte réduit avant complétion full. (2026-05-26)
- [ ] **[P2]** Step 4 BF% — ajouter un mode "j'ai mesuré X%" en saisie numérique exacte (en plus des 5 ranges visuels). (2026-05-26)
- [ ] **[P2]** Step 7 Goals — ajouter `target_bf_pct` en plus de `target_weight` pour que le coach ait une cible BF%. (2026-05-26)

### Coach

- [ ] **[P1]** Vérifier que le coach context envoie bien BF% dans le prompt — `lib/vertex/context-builder.ts:259` doit sortir `BF actuel: 32%` quand `baseline.bf_pct` présent. Vu rapidement OK, mais pas testé end-to-end. (2026-05-26)
- [ ] **[P2]** Hook coach proactif "BF% manquant" — si après 3 jours d'usage le user n'a toujours pas de `baseline.bf_pct`, le coach propose de l'ajouter via /settings ou par message. (2026-05-26)

#### Hallucinations RAG (P0 — testé en prod, observé)

- [ ] **[P0]** **Renforcer le prompt coach pour interdire les exos hors-RAG** — Cas observé 2026-05-26 : user a demandé un substitut au shoulder press, coach a proposé "Développé Landmine" qui n'est PAS dans la base (293 exos). Le seul exo landmine en base est `rowing_t_bar` (pull horizontal). Solution : ajouter une règle dure dans le prompt système coach `lib/vertex/prompts/coach.ts` : "**INTERDICTION ABSOLUE** de recommander un exo qui n'est pas dans le bloc [EXERCICES PERTINENTS POUR CETTE QUESTION] injecté ce tour. Si le user demande un exo que tu connais mais qui n'est pas listé, dis-lui : 'Cet exo n'est pas dans notre bibliothèque, je te propose [alternative RAG-validée]'". Risques actuels : user track des exos fantômes, pas de cues, pas de safety_notes, le plan-generator les ignore. (2026-05-26)

- [ ] **[P0]** **Trigger `<COACH_PLAN_PATCH>` automatique sur substitution d'exo** — Cas observé 2026-05-26 : user a demandé un substitut suite à douleur épaule, coach a proposé 3 exos mais SANS déclencher `<COACH_PLAN_PATCH>`. Le plan actif garde le shoulder press, le user devra repenser à demander explicitement le patch. Solution : ajouter au prompt coach §18.5 une règle "Si l'utilisateur demande une alternative à un exo de son plan ACTUEL pour cause de douleur/limitation, propose 1-2 exos RAG puis **applique le patch automatiquement** via `<COACH_PLAN_PATCH>{"training.sessions[X].exercises[Y].name": "..."}</COACH_PLAN_PATCH>` (en précisant la session et l'index dans le commentaire). Le user pourra annuler s'il préfère un autre choix.". Nécessite côté apply-patch route de supporter les paths nested `training.sessions[X].exercises[Y].name`. (2026-05-26)

### Refactor / nettoyage

- [ ] **[P2]** Steps onboarding non câblés à arbitrer — `Step6Lifestyle`, `Step8Medical`, `Step10Nutrition` exportés dans `steps.tsx` mais jamais utilisés dans le switch. Soit on les supprime, soit on les active dans une "phase 2" optionnelle post-onboarding. (2026-05-26)

---

## 💡 Nice to have (futur)

- [ ] **[P3]** Self-host des modèles Veo / Nano Banana ? (hors scope coaching-app, plutôt Humbolo)
- [ ] **[P3]** Mode multi-coach (ORACLE.IA / SYRINX.IA / etc.) — si on veut différencier coach nutrition vs coach training.
- [ ] **[P3]** Export PDF d'un plan archivé (depuis /plan/history) pour partager avec un nutritionniste.
- [ ] **[P3]** Page de comparaison côte-à-côte "Plan A vs Plan B" depuis /plan/history.

---

## 📌 Bancal — dette à surveiller

_Liste des défauts connus, à ne PAS corriger sans réflexion (souvent il y a une raison)._

- `dashboard badge dot` E2E volontairement faible (mock mode skip Firestore reads). Plus de robustesse nécessite un setup emulator complexe.
- Migration `user.onboarding_completed = true` pour les anciens users qui ont un plan : pas faite automatiquement. Solution actuelle = passer par /settings → Refaire onboarding (rare cas vu peu d'users).
- `STEP_PHOTOS` réutilise certaines images (steps 4 et 6 = measurements/activity). Pas dramatique mais pas optimal.

---

## ✅ Historique récent

### Session 2026-05-26

- [x] Wave 7 #5-#10 — MealCard/ExerciseCard NoDream refactor, LRU cache embeddings, superset_group, focus trap modal, CI rules tests, E2E coach-flow (commit `9774c37`) (✓ 2026-05-26)
- [x] Op #1 — Build RAG embeddings 293 exos + 20 méthodes via Vertex text-multilingual-embedding-002 (commit `b38637a`) (✓ 2026-05-26)
- [x] Fix bug `onboarding_completed` flag — guard layout ne checkait `profile !== undefined` au lieu d'un flag dédié, éjectait les users mid-onboarding (commit `882d1dd`) (✓ 2026-05-26)
- [x] Wave 9 — Onboarding 6→8 steps (BF% + training profile), Katch-McArdle dans plan-generator prompt, endpoint `/api/onboarding/restart`, bouton settings (commit `f2ec516`) (✓ 2026-05-26)
- [x] UI `/plan/history` — liste tous les plans archivés + active, détection auto formule TDEE (commit `78c2a0c`) (✓ 2026-05-26)

### Sessions précédentes

_Pour l'historique complet, voir `git log --oneline` ou `docs/handoff.md`._

---

## 🔄 Workflow de mise à jour

Quand tu (Claude) bosses sur ce projet :
1. **Au début** de chaque session : lis ce fichier pour reprendre où on en était.
2. **Pendant** : ajoute toute nouvelle tâche découverte en `- [ ]` dans la bonne section.
3. **À la fin** de chaque commit : déplace les tâches faites en `[x]` et copie-les dans **Historique récent** avec date + commit hash.
4. **Quand l'utilisateur indique** qu'une tâche ops est faite (deploy, test manuel, etc.), coche-la immédiatement.
