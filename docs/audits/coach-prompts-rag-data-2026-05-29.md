# Audit — Prompts + RAG + Couche données du coach (multi-agents)

> **Date** : 2026-05-29
> **Méthode** : audit multi-agents (11 relecteurs : 1 par agent lisant prompt + `fetchContext`, + 1 relecteur infra RAG/données, + 1 synthèse transversale). Analyse seule, aucune modification.
> **Données brutes** : `coach-prompts-rag-data-2026-05-29.raw.json` (90 findings)
> **Portée** : supervisor + 8 sous-agents (nutrition, training, analytics, safety, mental, social, education, planning) + coach legacy (mono-prompt fallback) + infra RAG (`rag-coach`, `rag-sourcing`) + couche données (`snapshot` + stores).

---

## Verdict global

Architecture mature, mais **dette de cohésion transversale** qui annule une partie des qualités individuelles. Les prompts pris **isolément** sont d'un très bon niveau (voix NoDream soignée, périmètres nets, garde-fous safety sérieux, délégation médicale claire). La faiblesse n'est presque jamais *dans* un prompt, mais dans **la colle entre prompt, implémentation et données**.

Trois fractures structurelles :
1. **Plan & citations non partagés** — pas de source unique de vérité ni pour le plan actif (le superviseur patche à l'aveugle) ni pour les sources scientifiques (3 agents sur 4 hallucinent leurs citations). Touche **sécurité ET crédibilité**.
2. **Données mortes systémiques** — ≥ 9 datasets fetchés/seedés jamais exploités (PRs, micronutriments, wearables, fasting, protocoles sèche, cravings/habits, sleep/hrv, goals_history, recettes), payés en Firestore + tokens, avec des règles de prompt qui les promettent dans le vide.
3. **Absence de fragments partagés** — voix, contrat de sortie, garde-fou hormonal, délégation safety copiés-collés dans chaque prompt → dérive garantie (education sans ban « régime », superviseur paternaliste, social sans enum severity).

S'ajoutent : un **bug RAG exos critique** (filtre niveau/équipement mort pour 100 % des users via un cast masquant), une **fenêtre temporelle analytics inadaptée** (7 j pour des diagnostics 30-60 j), et un mécanisme `request_consult` **promis partout mais jamais consommé** → trou de couverture safety.

> En l'état, le système fonctionne et parle d'une voix cohérente en surface, mais ses **garde-fous chiffrés** (cohérence calorique du patch, refus de patch dangereux, perte >150 % → safety, sources vérifiables) reposent souvent sur des **données que l'agent décideur ne possède pas**. C'est le risque principal à traiter avant tout enrichissement fonctionnel.

---

## Top priorités (par ROI)

1. **Source unique du plan + citations** (2 critiques) — charger `active_plan` UNE fois au niveau superviseur et l'injecter dans `buildAggregatePrompt` ; brancher un fragment `scientific_sources` partagé (garde-fou anti-hallucination) dans nutrition/planning/analytics. Débloque sécurité du patch + crédibilité des citations.
2. **Réparer le RAG exos training** (critique, trivial) — corriger le mapping `ProfileForRag` (`training_history`/`training_environment`/`available_equipment`), retirer le cast `as`, + test unitaire profil-débutant.
3. **Audit binaire fetch↔prompt** sur les 8 agents — chaque donnée fetchée : soit une règle l'exploite, soit on retire le fetch. Élimine ~9 données mortes.
4. **Factoriser 4 fragments partagés** — `NODREAM_VOICE`, `OUTPUT_CONTRACT` (enum severity fermé), `SAFETY_DELEGATION`, `HORMONAL_GUARDRAIL`. Corrige d'un coup les dérives (education, superviseur, social) + empêche la re-divergence.
5. **Standardiser cycle + statut hormonal** cross-prompts — convention `current_phase` pré-calculé + `on_hormonal_contraception` ; exposer `hormonal_context`/`uses_glp1` à safety ; flag `amenorrhea_suspected` calculé.
6. **`request_consult`** — au minimum traiter `['safety']` comme override de routing au 2e tour (sinon la délégation TCA croisée s'évapore) ; idéalement un vrai mini second tour.

---

## Findings critiques & high (par agent)

### supervisor
- **CRITICAL — `alignement_prompt_impl`** : le prompt charge le superviseur d'émettre `COACH_PLAN_PATCH` avec cohérence calorique + refus si « déjà en cut » + noms d'exos validés RAG, mais `buildAggregatePrompt` ne transmet NI plan actif, NI profil, NI RAG. Il **invente** les valeurs courantes → patch POSTé vers `apply-patch`. → injecter un bloc `[PLAN ACTIF]` ou déléguer le patch aux sous-agents.
- **HIGH — `data_coverage`** : `raw_data` (qui porte `active_plan`/`rag_exercises`) explicitement exclu de l'agrégation. Donnée chargée puis jetée avant le décideur.
- MEDIUM : `request_consult` parsé/stocké mais jamais consommé (pas de 2e tour) ; safety critical n'inhibe pas l'émission de patch ; voix paternaliste (« Reste hydraté ce soir »).
- LOW : prompt ROUTE+AGGREGATE = même system prompt entier (coût input doublé) ; exemple JSON avec fences vs consigne « pas de fences ».

### nutrition
- **HIGH — `alignement_prompt_impl`** : `active_plan` + `today_food_logs` (les 2 données les plus structurantes) fetchés mais **jamais mentionnés dans le prompt** → l'agent ne raisonne pas sur les macros restantes du jour.
- **HIGH — `data_coverage`** : `profile.ed_history` (antécédent TCA) non chargé alors que toute la logique severity=critical repose sur la détection TCA.
- MEDIUM : `favorite_recipes`/`shopping_lists` = IDs opaques inexploitables ; RAG = seulement Ottawa, jamais `searchInternalCorpus`/`searchScientificCorpus` (Helms/Phillips cités de mémoire) ; 3 référentiels protéines divergents (poids cible/actuel/LBM) ; `uses_glp1` structuré non câblé comme déclencheur.

### training
- **CRITICAL — `rag_coherence`** : `profileForRag = { level, equipment }` mal mappé (interface attend `training_history`/`training_environment`/`available_equipment`), cast `as ProfileForRag` masque l'erreur → filtre niveau ET équipement **morts pour tous**.
- **CRITICAL — `alignement_prompt_impl`** : section PERSONAL RECORDS du prompt complète, mais `getPrsSnapshot` **importé jamais appelé** → `ctx.prs` jamais peuplé (instruction morte / hallucination 1RM).
- HIGH : `recent_workouts` ne garde aucune charge/exo → impossible de recommander une progression concrète.
- MEDIUM/LOW : cycle en J-numbers vs `current_phase` ; `injuries` chargé non exploité ; profil « obésité musclée » exige LBM/BF non chargés ; docstring obsolète.

### analytics
- **CRITICAL — `alignement_prompt_impl`** : `weight_trend_60day` (garde-fou perte-muscle >150 % → safety) référencé mais **calculé uniquement dans planning** → règle jamais exécutée.
- **CRITICAL — `data_coverage`** : rôle = plateau >3 sem, recalibrage TDEE sur N sem, mais `fetchContext` ne charge que **7 jours** → diagnostics multi-semaines physiquement impossibles.
- HIGH : adherence promise (`adherence_pct`) jamais calculée, agrégation kcal seul (pas de macros).
- MEDIUM/LOW : `cravings`/`habits` fetchés mais absents du prompt ; noms de clés prompt↔impl divergents ; confidence basée 7/7 j contredit les règles plateau (21+ j).

### safety
- **HIGH — `data_coverage`** : signal central « perte non sollicitée >5 %/mois » inévaluable — `objective`/`goals` absents de `profile_flags` (impossible de distinguer cut volontaire vs perte pathologique).
- **HIGH — `alignement_prompt_impl`** : section HYDRATATION raisonne sur « user sous TRT/GLP-1 » mais `hormonal_context`/`uses_glp1` **non chargés** → règle morte ou déclenchée sur inférence (risque audit #4).
- MEDIUM : aménorrhée listée comme signal mais cycle jamais fetché ; sleep/hrv fetchés mais aucun seuil dans le prompt ; bloodwork numérique (Hb >17) référencé mais exposé en flags/note opaques.

### mental
- **HIGH ×2 — `alignement_prompt_impl`** : `state.tone_preferences` ET `state.do_not_repeat` mappés mais **inexistants dans le schéma CoachState** (toujours undefined) → mémoire anti-répétition morte. Vrais champs : `topics_discussed`, `personality_notes`.
- MEDIUM : `goals_history` (`is_unstable` = pattern d'abandon) + `last_debrief`/`mood_trend` fetchés mais jamais référencés ; aucun RAG pour les cadres cités (SDT, ACT, Lally 2010) ; règle « pas de chiffres » en tension avec exemples chiffrés.

### social
- **HIGH — `alignement_prompt_impl`** : règle 3 promet de comparer le « BF mesuré » mais `fetchContext` ne charge **aucune mensuration/BF** → l'agent doit inventer ou rester vague.
- MEDIUM : aucun RAG (plate model Ottawa cité de tête) ; `lifestyle`/`relationship_status` chargés non instruits ; **enum severity non posée** (risque de severity non conforme).
- LOW : chevauchement planning (règle 4 « planifier les écarts ») ; bornage détresse à renforcer.

### education
- **HIGH ×2 — `rag_coherence`** : garde-fou anti-hallucination `buildRAGPrompt` **non appliqué** alors que citations obligatoires + liste d'auteurs hardcodée → fabrication de PMID/URL probable. Et message FR brut passé à `searchScientificCorpus` **sans extraction de mots-clés EN** → branche PubMed quasi morte.
- MEDIUM : clé `scientific_sources` jamais nommée dans le prompt ; **voix manquante** (mot « régime » non interdit, tutoiement non imposé) ; severity=warning sans `request_consult: ['safety']` sur comportement dangereux.

### planning
- **HIGH — `rag_coherence`** : section CITATIONS (6 réfs + chiffres Garthe/Trexler/Mountjoy) mais **aucun RAG branché** → citations/valeurs de mémoire.
- **HIGH — `alignement_prompt_impl`** : la **libido** (signal de transition/diet break, citée 3×) n'est **jamais calculée** dans `checkin_summary_30day`.
- MEDIUM : HRV chargé jamais instruit ; `hormonal_context` chargé jamais exploité ; noms de clés prompt↔impl divergents (et le prompt se contredit lui-même).

### coach-legacy (fallback mono-prompt)
- **HIGH — `rag_coherence`** : gates `flags.ragSourcing()` etc. utilisent un **resolver CLIENT** côté route serveur → Remote Config sans effet en prod (comportement = env var pure).
- MEDIUM : double régime de citation (whitelist §4 + sources RAG injectées) sans règle de préséance ; « Masse musculaire : N/A » imprimé systématiquement ; cap 150-250 mots en tension avec contexte massif.
- LOW : §13 suit les mensurations « dans le temps » mais seules les valeurs actuelles sont chargées ; §15 protocole par tranche de poids jamais injecté ; détection §3 dépend de `SAFETY_DEEP_CHECK=1`.

### rag-data-infra
- **CRITICAL** : (rappel) mapping `ProfileForRag` cassé → filtre niveau/équipement mort.
- **HIGH ×3** : nutrition ne branche que Ottawa (jamais `searchScientificCorpus`) ; `getProtocolForUser` (protocoles sèche seedés) appelé par **aucun** agent ; module **micronutrients** calculé mais consommé par aucun agent.
- MEDIUM : wearables/health non lus par le MAS (régression silencieuse vs coach mono) ; fasting jamais fetché (pourtant dans le scope nutrition) ; `getPrsSnapshot` import mort ; `body_fat`/`LBM` absents du snapshot alors que nutrition/training/planning en ont besoin ; `training_seniority_years` mélange number/string.
- LOW : `language:'en'` en dur sur sources internes ; fusion RAG sans rerank par score ; duplication `recent_chat` ; index RAG chargés via `require()` avec dégradation silencieuse (pas d'observabilité).

---

## Synthèse transversale (issues inter-agents)

| Type | Sévérité | Agents | Résumé |
|---|---|---|---|
| `rag_incoherent` | **critical** | nutrition, planning, analytics, education, infra | Chaîne citations : 4 agents promettent des réfs chiffrées, 3 ne branchent rien → hallucinations. Standardiser un fragment `scientific_sources` + garde-fou commun. |
| `donnee_manquante` | **critical** | supervisor, nutrition, planning, analytics, training | Plan actif fetché par les sous-agents mais jamais reçu par le superviseur (décideur du patch). Charger 1× au niveau superviseur. |
| `conflit_entre_agents` | high | nutrition, training, planning, analytics | Pas de base protéines/composition commune ; `body_fat`/`LBM` absents du snapshot → écarts 40-80 g/j. |
| `donnee_inutilisee` | high | (transversal) | ≥9 datasets morts : PRs, micronutrients, wearables, fasting, protocoles, cravings/habits, sleep/hrv, goals_history, recettes. Audit binaire fetch↔prompt. |
| `incoherence_convention` | high | training, mental, planning, analytics, safety, legacy | Cycle modélisé en 2 façons (J-numbers vs `current_phase`) ; aménorrhée sans champ calculé. |
| `incoherence_convention` | high | nutrition, safety, training, planning, legacy, supervisor | Statut hormonal (TRT/GLP-1) tantôt gardé, tantôt inféré, tantôt ignoré, tantôt non chargé (safety). |
| `trou_de_couverture` | high | supervisor, nutrition, training, analytics, safety | `request_consult` jamais consommé → délégation TCA croisée = chemin mort (trou safety). |
| `redondance_factorisable` | medium | tous | Voix / contrat sortie / garde-fou TRT / délégation safety copiés-collés → 4 fragments à factoriser. |
| `incoherence_voix` | medium | supervisor, education, mental, legacy | Superviseur paternaliste ; education sans ban « régime » ; mental cite « Neff 2003 » en jargon. |
| `donnee_manquante` | medium | safety, nutrition, analytics, supervisor | `objective`/`goals` absents de safety ; `weight_trend` calculé à un seul endroit. |
| `donnee_manquante` | medium | analytics, supervisor, legacy | Fenêtre 7 j vs diagnostics 30-60 j (analytics + mensurations legacy). |
| `chevauchement_mandat` | medium | nutrition, analytics, social, planning | Frontières floues : nutrition↔analytics (stagnation), social↔planning (planifier écarts), substances safety↔analytics/mental. |
| `incoherence_convention` | medium | analytics, planning, education, legacy, supervisor | Noms de clés prompt↔impl divergents partout (pas de contrat de payload). |
| `rag_incoherent` | medium | infra, training, legacy | RAG exos : mapping cassé + index `require()` à dégradation silencieuse (pas d'observabilité). |

---

*Rapport généré par workflow `audit-coach-prompts-rag-data`. Correctifs traités séparément (voir commits `fix(agents|prompts|rag)` à partir du 2026-05-29).*
