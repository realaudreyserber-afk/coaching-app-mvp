# Data Layer Roadmap — combler les gaps pour un coaching solide

> Démarré 2026-05-28. À lire en début de session pour reprendre la suite.
> Approche : ajouter toute la data manquante AVANT de pousser l'archi vers du "vrai agentique" (Option A/B du brainstorm multi-agent).
> Justification : agent malin sur data pauvre = mauvais résultat. Data riche sur agent moyen = bien meilleur que l'inverse.

---

## Pattern commun pour chaque phase

Chaque feature ajoutée suit ce template :
1. **Schema** : Zod ou TS interface dans `lib/features/<feature>/schema.ts`
2. **Firestore rules** : règle ajoutée dans `firestore.rules` (scope owner par défaut)
3. **CRUD helpers** : fonctions read/write côté server dans `lib/features/<feature>/store.ts`
4. **UI input** : page ou composant dans `app/(app)/<feature>/page.tsx` ou intégré ailleurs
5. **Agent integration** : `fetchContext` mis à jour dans le(s) sous-agent(s) concerné(s)
6. **Test E2E manuel** : input UI → vérifier doc Firestore → vérifier que l'agent voit la donnée
7. **Backup script update** : ajouter la nouvelle collection à `scripts/backup-user-data.mjs`

---

## 🔴 PHASES CRITIQUES (bloquant qualité coaching)

### Phase 1 — Cycle menstruel

**Pourquoi prioritaire** : 50% du marché. Sans ça, le coach ne peut pas adapter à la phase folliculaire/lutéale (faim, cravings, énergie, force pic).

**Schema** :
- `users/{uid}/cycles/{date}` : `{ date, phase ("menstrual"|"follicular"|"ovulation"|"luteal"), symptoms: string[], flow_intensity (0-3), notes, predicted: boolean }`
- `users/{uid}/cycle_settings/main` : `{ avg_cycle_length_days, avg_period_length_days, regularity ("regular"|"irregular"|"unknown"), tracking_started_at, hormonal_contraception (boolean + type) }`

**UI** : nouvelle page `/cycle` avec vue calendrier mensuelle + form d'entrée quotidien. Notifications optionnelles pour rappel.

**Intégration agents** :
- `NutritionCoach` : adapter cravings, kcal selon phase (lutéale = +100-200 kcal toléré)
- `MentalCoach` : valider les fluctuations mood comme physiologiques, pas comme "manque de discipline"
- `PlanningCoach` : éviter diet break en pré-menstruel, adapter cut prolongé
- `TrainingCoach` : force pic en folliculaire = bon moment pour PR, lutéale = privilégier volume modéré

**Dépendances** : aucune. Indépendant.

**Notes** : champs visibles/cachés selon user setting (privacy). Ne pas afficher si user.profile.sex !== "female".

---

### Phase 2 — Mensurations évolutives (fix bug data existant)

**Pourquoi prioritaire** : aujourd'hui `profile.waist_cm` etc. sont des **valeurs uniques**. Si l'user mesure son tour de taille tous les mois, l'historique est PERDU. Bug, pas un gap.

**Schema** :
- `users/{uid}/measurements/{date}` : `{ date, waist_cm, neck_cm, hips_cm, shoulder_cm, chest_cm, arm_cm, forearm_cm, wrist_cm, thigh_cm, calf_cm, notes, source ("self"|"coach"|"dexa"|"inbody") }`
- Chaque champ optionnel — un entry peut juste avoir waist+hips.

**Migration** :
- Script `scripts/migrate-measurements.mjs` : pour chaque user ayant `profile.*_cm`, créer un doc dans `measurements/` avec timestamp = `profile.updated_at` ou now.
- `profile.*_cm` reste pour compat lecture rapide (mirror du dernier) — mais source de vérité = collection.

**UI** : nouvelle page `/progress/measurements` avec form de saisie + courbes temporelles (chart.js ou recharts).

**Intégration agents** :
- `AnalyticsCoach` : "ton tour de taille a baissé de 3cm en 6 sem alors que ton poids stagne = recompo en cours"
- `PlanningCoach` : tendances long-terme pour décider transitions phase

**Dépendances** : aucune (migration tourne en parallèle).

**Notes** : COACH_SAVE doit aussi pouvoir écrire dans `measurements/{today}` (nouveau path autorisé), pas juste dans profile.

---

### Phase 3 — Personal Records (1RM/3RM/5RM lifts)

**Pourquoi prioritaire** : `workout_sessions` track les séances mais pas les PR. Coach ne peut pas dire "ton bench progresse de 5kg en 2 mois". Quick win — data presque déjà là.

**Schema** :
- `users/{uid}/prs/{exerciseId}` : 1 doc par exo, `{ exercise_name, prs: [{ date, weight_kg, reps, estimated_1rm, source ("manual"|"auto_from_session"), session_id? }], current_1rm }`

**Logic auto-detect** :
- À la fin d'une `workout_session`, parcourir les exos. Pour chaque exo avec sets ≥ poids+reps connus, calculer 1RM via formule Epley (`weight × (1 + reps/30)`) ou Brzycki.
- Si > current_1rm pour cet exo → ajouter à `prs[]` + update current_1rm.
- Path : `/api/sessions/[sessionId]/finish` au moment du log final.

**UI** : page `/progress/prs` avec liste des exos + courbe par exo + tableau historique PRs.

**Intégration agents** :
- `TrainingCoach` : "ton bench a progressé de 8% en 2 mois, on peut pousser le volume"
- `AnalyticsCoach` : performance trend en complément du poids/BF

**Dépendances** : aucune.

**Notes** : seuls les exos composés clés (squat/bench/deadlift/OHP/row) doivent générer des PRs auto. Configurable.

---

## 🟠 PHASES IMPORTANTES (qualité coaching + adherence)

### Phase 4 — Hydratation

**Schema** :
- `users/{uid}/hydration_log/{date}` : `{ date, entries: [{ time, ml }], total_ml, target_ml }`

**UI** : widget dashboard avec boutons +250ml / +500ml / +1L. Affichage progress bar vs target.

**Intégration agents** :
- `NutritionCoach` : si hydratation < target depuis 7j → recommandation explicite
- `AnalyticsCoach` : corrélation poids matin / déshydratation
- `SafetyCoach` : sous TRT/GLP-1, alerte si hydratation < 2.5L/jour

**Dépendances** : aucune.

---

### Phase 5 — Substances log (caféine/alcool/nicotine)

**Schema** :
- `users/{uid}/substances_log/{date}` : `{ date, entries: [{ time, type ("coffee"|"alcohol"|"nicotine"|"energy_drink"|"other"), quantity, unit, notes }] }`

**UI** : log form rapide dans dashboard + section dédiée dans `/log/substances`.

**Intégration agents** :
- `NutritionCoach` : alcool en cut = recompter calories liquides, impact lipogenèse
- `AnalyticsCoach` : corrélation alcool weekend / poids lundi
- `MentalCoach` : caféine > 400mg = impact sommeil + cortisol
- `SafetyCoach` : si patterns indiquant usage problématique → severity warning + redirection

**Dépendances** : aucune.

---

### Phase 6 — Cravings granulaires

**Approche** : extension de `checkins_daily` (pas nouvelle collection — éviter sprawl).

**Champs ajoutés à `checkins_daily`** :
- `cravings_type` : enum array ("sweet"|"salty"|"fatty"|"caffeine"|"alcohol"|"specific_food")
- `cravings_intensity` : 1-10
- `cravings_trigger` : string libre court (ex "stress travail", "soir après dîner", "après séance")

**UI** : étendre form daily checkin existant.

**Intégration agents** :
- `NutritionCoach` : cravings sucré récurrent → carence ? déficit trop agressif ? protéines trop basses ?
- `MentalCoach` : cravings comme symptôme stress/émotion vs faim physique
- `AnalyticsCoach` : patterns temporels (cravings systématiques mardi soir → événement récurrent)

**Dépendances** : aucune (juste schema extension).

---

### Phase 7 — Photos évolution

**Audit préalable** : vérifier ce que `photos/` collection (déjà existante) contient. Si déjà progression photos, juste construire le UI gallery. Sinon, schema dédié.

**Schema (si nouveau)** :
- `users/{uid}/progress_photos/{date}` : `{ date, image_url (Firebase Storage), pose ("front"|"side"|"back"), tags, notes, weight_kg_at_time }`

**UI** : page `/progress/photos` avec gallery chronologique + comparateur side-by-side (J vs J-30, etc.).

**Intégration agents** :
- `AnalyticsCoach` : peut référer aux photos sans les voir ("tu as 3 photos sur les 6 dernières semaines, prends une nouvelle ce dimanche")
- Eventuellement plus tard : vision API pour comparaison auto (out of scope MVP).

**Dépendances** : audit `photos/` collection.

---

### Phase 8 — Événements de vie

**Schema** :
- `users/{uid}/life_events/{eventId}` (auto-id) : `{ created_at, event_type ("move"|"breakup"|"work_change"|"loss"|"travel"|"injury"|"illness"|"other"), date_start, date_end?, severity ("low"|"medium"|"high"), description, expected_impact_areas: string[] }`

**UI** : form simple dans `/profile/context` ou modal accessible depuis chat coach.

**Intégration agents** :
- `MentalCoach` : si event high severity actif → moduler ton (validation, no-pression)
- `PlanningCoach` : si event majeur en cours → suspendre changement de phase agressif
- `SafetyCoach` : si event = loss/breakup avec timing récent → vigilance signaux dépression

**Dépendances** : aucune.

---

### Phase 9 — Préférences alimentaires & allergies

**Audit préalable** : vérifier ce qui est déjà dans `profile.*` ou dans onboarding.

**Champs (extension profile)** :
- `profile.dietary_preferences` : enum array ("vegetarian"|"vegan"|"pescetarian"|"halal"|"kosher"|"gluten_free"|"lactose_free"|"low_fodmap"|"keto")
- `profile.allergies` : string array (ex ["arachides", "lait", "crustacés"])
- `profile.dislikes` : string array (libres, ex ["chou", "poisson"])

**UI** : section dans settings profile.

**Intégration agents** :
- `NutritionCoach` : OBLIGATOIRE — ne jamais proposer un aliment exclu. Vérification dans le prompt.

**Dépendances** : ajout dans `/api/profile/update-fields` whitelist + supervisor prompt COACH_SAVE.

---

## 🟡 PHASES UTILES (long terme, adherence + engagement)

### Phase 10 — Goals timeline (historique objectifs)

**Schema** :
- `users/{uid}/goals_history/{date}` : `{ archived_at, previous_goals: { primary_goal, target_weight, target_bf_pct, type, deadline }, reason_for_change? }`

**Logic** : modifier `/api/profile/update-fields` — si update sur `goals.*`, snapshot l'ancien dans `goals_history/` avant merge.

**UI** : page `/progress/goals` montrant timeline des objectifs.

**Intégration agents** :
- `PlanningCoach` : "tu as changé d'objectif 3 fois en 6 mois, on stabilise ?"
- `MentalCoach` : patterns d'abandon / changement de cap fréquent

**Dépendances** : Phase 2 patterns similaires.

---

### Phase 11 — Habitudes long-terme

**Schema** :
- `users/{uid}/habits/{habitId}` : `{ name, category ("morning"|"evening"|"meal"|"training"|"other"), target_time?, frequency ("daily"|"weekly_n"|"specific_days"), days_of_week?, created_at, active, streak_current, streak_longest }`
- `users/{uid}/habit_logs/{date}_{habitId}` : `{ date, habit_id, completed (boolean), note? }`

**UI** : page `/habits` avec liste habits + tick rapide + visualisation streak.

**Intégration agents** :
- `MentalCoach` : encouragement basé sur streak (mais pas guilt-trip si broken)
- `AnalyticsCoach` : corrélation habit adherence / progrès composition

**Dépendances** : aucune.

---

### Phase 12 — Favorite recipes (user-specific)

**Schema** :
- `users/{uid}/favorite_recipes/{recipeId}` : `{ recipe_ref, added_at, cooked_count, last_cooked_at, rating_1to5? }`

**UI** : bouton "favoris" sur chaque recipe page + section favoris dans `/recipes`.

**Intégration agents** :
- `NutritionCoach` : "tu as 5 recettes favorites, voici un plan repas basé dessus"

**Dépendances** : feature `/recipes` déjà existante (à vérifier état).

---

### Phase 13 — Shopping list intégrée

**Schema** :
- `users/{uid}/shopping_lists/{listId}` : `{ created_at, name, items: [{ name, quantity, unit, checked, recipe_ref? }], status ("active"|"archived"), week_start? }`

**UI** : page `/shopping` avec liste active + bouton "auto-generate from this week's meal plan".

**Intégration agents** :
- `NutritionCoach` : "veux-tu que je te génère la shopping list pour la semaine basée sur ton plan ?"

**Dépendances** : structure du `plan.meals_template` doit être assez riche pour extraire ingrédients (peut nécessiter enrichissement schema plan).

---

### Phase 14 — Sommeil détaillé

**Audit préalable** : ouvrir un document `wearable_sync/{date}` réel et voir si sleep_stages, sleep_latency, etc. sont déjà là.

**Si data dispo** : créer agrégateur `lib/features/sleep/aggregator.ts` qui extrait/expose les champs propres.

**Si data pas dispo** : ajout manuel via form daily checkin (extension `checkins_daily`) — moins fiable mais mieux que rien.

**Intégration agents** :
- `TrainingCoach` : sommeil < 6h plusieurs jours → suggère deload
- `MentalCoach` : sommeil fragmenté → impact cortisol + cravings
- `SafetyCoach` : sommeil détruit + autres signaux → severity warning
- `PlanningCoach` : sommeil chronique mauvais → bloque progression vers cut agressif

**Dépendances** : audit wearable_sync.

---

### Phase 15 — HRV / stress

**Audit préalable** : vérifier si `wearable_sync.hrv_rmssd` ou équivalent existe.

**Si data dispo** : agrégateur + alerts si baseline drift négatif.

**Intégration agents** :
- `TrainingCoach` : HRV baseline → timing deload
- `MentalCoach` : HRV chronique bas → signal stress
- `PlanningCoach` : ne pas démarrer cut agressif si HRV instable

**Dépendances** : audit wearable_sync (probablement même audit que Phase 14).

---

## Ordre d'exécution recommandé

```
[indépendant — ordre flexible]
1. Cycle menstruel
2. Mensurations évolutives (+ migration)
3. Personal Records
4. Hydratation
5. Substances log
6. Cravings granulaires (extension checkins)
8. Événements de vie
9. Préférences alimentaires (audit + extension profile)

[séquentiel mais courts]
10. Goals timeline (extension /api/profile/update-fields)
11. Habitudes long-terme

[dépend d'audit]
7. Photos évolution (audit photos/)
14. Sommeil détaillé (audit wearable_sync)
15. HRV / stress (audit wearable_sync)

[dépend de Phase 13 plan structure si enrichissement nécessaire]
12. Favorite recipes (audit /recipes existant)
13. Shopping list
```

---

## Checklist transverse à appliquer pour CHAQUE phase

- [ ] Schema TypeScript / Zod défini
- [ ] firestore.rules ajoutées (owner-only read+write par défaut)
- [ ] CRUD helpers server-side
- [ ] UI input (page ou widget)
- [ ] Migration data existante si pertinente
- [ ] fetchContext des sous-agents concernés mis à jour
- [ ] Prompt des sous-agents enrichi pour exploiter la nouvelle data
- [ ] COACH_SAVE whitelist étendue si le coach doit pouvoir écrire ce champ
- [ ] Backup script `scripts/backup-user-data.mjs` mis à jour avec la nouvelle collection
- [ ] Test E2E manuel : UI input → Firestore doc visible → agent voit la donnée
- [ ] BACKLOG.md mis à jour avec l'avancement

---

## Après cette phase data layer

Une fois TOUS les gaps comblés (Phases 1-15), revenir au choix archi multi-agent :
- Option A — Supervisor full agentique (Function Calling Gemini, boucle, tool use)
- Option B — Hybride avec request_consult activé pour 2e pass
- Option C — Status quo

Le choix sera alors mieux informé car le Supervisor aura une vraie surface data à exploiter.

Cf. `docs/multi-agent-roadmap.md` pour le contexte multi-agent original.
