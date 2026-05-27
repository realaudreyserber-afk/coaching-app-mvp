# Multi-Agent System NoDream — Roadmap

> **Démarré** : 2026-05-27 (session interrompue pour reprise ultérieure)
> **Lire ce fichier en début de session de reprise.** Tout le contexte est ici.

---

## 🎯 Objectif

Refactorer le coach en architecture **multi-agents avec Supervisor** :
- 1 Supervisor (Gemini) qui route et agrège
- 7 sous-agents spécialisés (Nutrition, Training, Analytics, Safety, Mental, Social, Education)
- Chaque session intégralement archivée dans Firestore `users/{uid}/agent_memory_backup/{sessionId}`
- Script local `scripts/backup-user-data.mjs` pour dump complet (avec la nouvelle collection)

Décidé en session 2026-05-27 — choix utilisateur **A+B** : Firestore archive + script export local.

---

## 📋 État au 2026-05-27 (fin de session)

### ✅ Phase 0 — Infrastructure (DONE, en local non commit)

Fichiers créés :
- `lib/vertex/agents/types.ts` — interfaces : `AgentInput` (avec session_id), `AgentOutput`, `SessionRecord`, `RoutingDecision`, `SharedSessionMemory`, `SubAgentName` enum. Plus `createEmptySharedMemory()`. Const `AGENT_SCHEMA_VERSION = 1`.
- `lib/vertex/agents/shared-memory.ts` — `persistSessionRecord(record)`, `loadSessionRecord(uid, sessionId)`, `listRecentSessions(uid, limit)`, `estimateCostUsd(in, out)`, helpers `memory.{addNote, setFact, getFact, recordDecision}`.
- `lib/vertex/agents/tracing.ts` — `tracer.forSession(sessionId, uid)` retournant `{ supervisor, agent, captureError }`. `generateSessionId()`. Logs JSON structured + Sentry breadcrumb auto.
- `firestore.rules` — règle `match /agent_memory_backup/{sessionId}` (read owner+admin, write false).

Build TS validé après Phase 0.

### ⏳ Phase 1 — BaseAgent (PENDING — à reprendre)

À créer : `lib/vertex/agents/sub-agents/base.ts`

```typescript
import { tracer } from '../tracing';
import { generateText } from '../../client';
import { parseLLMJson } from '../../client';  // ou re-implémenter selon besoin
import type { AgentInput, AgentOutput, SubAgentName, SharedSessionMemory } from '../types';

export abstract class BaseAgent {
  abstract readonly name: SubAgentName;
  abstract readonly systemPrompt: string;
  readonly model: string = 'gemini-3.5-flash';
  readonly temperature: number = 0.3;

  /** Fetch les données Firestore spécifiques à cet agent. Surcharger. */
  protected abstract fetchContext(input: AgentInput): Promise<Record<string, unknown>>;

  /** Construit le prompt user complet (data context + user message + reason). */
  protected buildUserPrompt(input: AgentInput, context: Record<string, unknown>): string {
    const memNotes = input.shared_memory?.notes ?? {};
    const memFacts = input.shared_memory?.facts ?? {};
    return `[CONTEXTE DOMAINE]\n${JSON.stringify(context, null, 2)}\n\n` +
      `[NOTES DES AUTRES AGENTS]\n${JSON.stringify(memNotes, null, 2)}\n\n` +
      `[FAITS PARTAGÉS]\n${JSON.stringify(memFacts, null, 2)}\n\n` +
      `[MESSAGE USER]\n${input.user_message}\n\n` +
      `[POURQUOI TU ES CONSULTÉ]\n${input.reason_for_consult}\n\n` +
      `[FORMAT DE RÉPONSE OBLIGATOIRE]\nRetourne un JSON respectant strictement :\n` +
      `{ "diagnostic": string, "recommendations": string[], "severity": "info"|"warning"|"critical", ` +
      `"confidence": "low"|"medium"|"high", "citations"?: [{label,url?}], "request_consult"?: SubAgentName[], "raw_data"?: object }`;
  }

  async run(input: AgentInput, _mem: SharedSessionMemory): Promise<AgentOutput> {
    const trace = tracer.forSession(input.session_id, input.uid);
    const startMs = Date.now();
    try {
      trace.agent(this.name, 'start', 'info', { reason: input.reason_for_consult });
      const context = await this.fetchContext(input);
      const userPrompt = this.buildUserPrompt(input, context);
      const raw = await generateText({
        model: this.model,
        systemInstruction: this.systemPrompt,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        temperature: this.temperature,
        responseMimeType: 'application/json',
      });
      const parsed = this.parseOutput(raw);
      const duration = Date.now() - startMs;
      trace.agent(this.name, 'finish', 'info', { duration_ms: duration });
      return { ...parsed, agent: this.name, duration_ms: duration };
    } catch (err) {
      await trace.captureError(err, this.name);
      return {
        agent: this.name,
        diagnostic: '(erreur agent — résultat ignoré)',
        recommendations: [],
        severity: 'info',
        confidence: 'low',
        error: err instanceof Error ? err.message : String(err),
        duration_ms: Date.now() - startMs,
      };
    }
  }

  private parseOutput(raw: string): Omit<AgentOutput, 'agent' | 'duration_ms'> {
    // Utiliser parseLLMJson du client.ts pour la tolérance fences markdown
    const obj = JSON.parse(raw); // ou parseLLMJson(raw) si on l'expose
    return {
      diagnostic: String(obj.diagnostic ?? ''),
      recommendations: Array.isArray(obj.recommendations) ? obj.recommendations.map(String) : [],
      citations: Array.isArray(obj.citations) ? obj.citations : undefined,
      severity: ['info', 'warning', 'critical'].includes(obj.severity) ? obj.severity : 'info',
      confidence: ['low', 'medium', 'high'].includes(obj.confidence) ? obj.confidence : 'medium',
      request_consult: Array.isArray(obj.request_consult) ? obj.request_consult : undefined,
      raw_data: obj.raw_data,
    };
  }
}
```

**Points d'attention pour Phase 1** :
- `parseLLMJson` est déjà exporté de `lib/vertex/client.ts` — l'importer pour tolérance fences markdown ```json...```
- `generateText` retourne uniquement le text — pour les tokens counting, soit retourner aussi `usageMetadata` (modifier client.ts) soit estimer côté agent
- Tests unitaires optionnels mais utiles : créer une `DummyAgent extends BaseAgent` qui mock fetchContext et vérifie le flow

### ⏳ Phase 2 — Supervisor + prompt

À créer :
- `lib/vertex/agents/supervisor.ts` — fonction principale `runAgentSession(uid, userMessage, recentChat?)` :
  1. Génère un sessionId via `generateSessionId()`
  2. Initialise `SharedSessionMemory` vide
  3. **Étape route** : appelle Gemini avec supervisor prompt → parse `RoutingDecision`
  4. Si `skip_sub_agents=true` : early-return avec `direct_response`
  5. **Étape exécution** : instancie chaque sous-agent dans la decision, lance `Promise.all`
  6. **Étape arbitration** (Phase 2 = skipper, Phase 5 = à implémenter) : si `severity=critical` sur safety → faire prévaloir safety. Sinon ignorer.
  7. **Étape agrégation** : appelle Gemini avec les outputs structurés, agrège en une réponse user unifiée
  8. **Étape archive** : construit le `SessionRecord` et appelle `persistSessionRecord`
  9. Retourne `{ finalResponse, sessionRecord }`
- `lib/vertex/prompts/agents/supervisor.ts` — prompt ~1.5-2k tokens :
  - Présentation rôle ("tu es l'orchestrateur ORACLE.IA")
  - Liste les 7 sous-agents avec 1-2 lignes de description chacun
  - Règles de routing : trivial → skip, question domaine pur → 1 agent, problème complexe → 2-3, signal de risque → safety + 1 autre
  - Format JSON `RoutingDecision` strict

### ⏳ Phase 3 — Sous-agents pilotes

À créer :
- `lib/vertex/agents/sub-agents/nutrition.ts` :
  - `fetchContext` : `profile`, `active_plan.{kcal,macros,meals_template}`, `today_food_logs` (déjà via context-fetcher), top 3 `nutrition_guides` Ottawa via `searchNutritionGuides(query, 3)` du `internal-corpus.ts`
  - Domaine d'expertise : macros, ingrédients, recettes, fasting, suppléments, GLP1
- `lib/vertex/agents/sub-agents/analytics.ts` :
  - `fetchContext` : `checkin_7day_history` (Wave 13E déjà branché), `tdee_history` (Wave 13E), `body_scan_recent`, `last_session_summary`, weight history
  - Domaine : tendances, plateau, calibrage TDEE, diagnostic data
- `lib/vertex/prompts/agents/nutrition.ts` + `analytics.ts` — prompts courts ciblés (~3-4k tokens chacun)

### ⏳ Phase 4 — Route `/api/ai/coach-multi`

À créer : `app/api/ai/coach-multi/route.ts`

Squelette :
```typescript
export async function POST(req: NextRequest) {
  return withAuth(req, async (_authReq, user) => {
    if (process.env.ENABLE_COACH_MULTI !== '1') {
      return NextResponse.json({ error: 'multi-agent not enabled' }, { status: 503 });
    }
    const rl = await checkRateLimit(user.uid, { scope: 'ai_coach_multi', perMinute: 5, perHour: 50 });
    if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    
    const { messages } = await req.json();
    const lastUserMsg = messages[messages.length - 1]?.content;
    
    // Safety fast-path (déjà en place dans /api/ai/coach actuel — réutiliser)
    const safety = await runSafetyCheck(lastUserMsg, { ... });
    if (safety.flagged) return NextResponse.json({ response: safety.message, safety });
    
    // SSE streaming des phases
    const stream = new ReadableStream({
      async start(controller) {
        // event phase: 'route'
        // call supervisor.routeStep()
        // event phase: 'sub-agents'
        // call supervisor.executeSubAgents()
        // event chunk per agent finish
        // event phase: 'aggregate'
        // stream the final response
        // event done with sessionId
      }
    });
    return new NextResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  });
}
```

**Points d'attention Phase 4** :
- Ne PAS casser `/api/ai/coach` actuel — route en parallèle
- Env var `ENABLE_COACH_MULTI=1` requise pour activer
- Le client (`app/(app)/coach/page.tsx`) doit gérer les events SSE multi-phases (probablement à étendre)

### ⏳ Phase 5 — Sous-agents restants

À créer (5 agents + 5 prompts) :
- `training.ts` : fetchContext = workout_sessions historique, plan.training, recent form_checks, RAG exos via buildCoachRagFragment
- `safety.ts` : **priorité haute**. fetchContext = checkin energy/mood + bloodwork + alerts. Si `severity=critical`, le Supervisor doit override les autres
- `mental.ts` : fetchContext = recent_chat + coach_state.response_style. Pas de data Firestore — purement conversationnel
- `social.ts` : pas de fetchContext (statique). Spécialisé sur la pression sociale
- `education.ts` : fetchContext = searchScientificCorpus avec keywords extraits du user_message

### ⏳ Phase 6 — Script `backup-user-data.mjs`

À créer : `scripts/backup-user-data.mjs`

Pattern : reprendre la structure de `scripts/show-active-plan.mjs` et `scripts/show-last-session.mjs`. Args `--email` ou `--uid`. Output : `./backups/{uid}/{YYYY-MM-DD-HHMMSS}/`.

24 collections à dumper :
```
profile.json (users/{uid} doc complet)
agent_memory_backup/*.json  ← NOUVELLE collection (multi-agent)
plans/
plans_history/
workout_sessions/
coach_messages/
food_logs/
checkins_daily/
checkins_weekly/
body_scans/
form_checks/
wearable_sync/
bloodwork/
coach_state/
coach_patches/
tdee_history/
micronutrients_daily/
notification_log/
session_debriefs/
insights_daily/
daily_tasks/
alerts/
streak/
medications/
referrals/
meta.json (timestamp, env, schema version)
```

**À exclure** : `tokens/` (OAuth refresh tokens — secrets en clair sur disque = mauvaise idée). Documenter dans le README du backup.

---

## ⚠️ Pièges à éviter (checklist avant code)

1. **Format JSON Gemini parfois bancal** — utiliser `parseLLMJson` du `client.ts` (existe déjà, tolère fences markdown ```json...```)
2. **Tokens counting** — Gemini SDK retourne `response.usageMetadata.promptTokenCount / candidatesTokenCount`. Pour les capturer, **modifier `client.ts`** pour retourner aussi metadata (breaking change léger sur generateText), OU les estimer à partir de la longueur des strings (approximation)
3. **Streaming SSE multi-phases** — bien séparer les events : `phase`, `agent_start`, `agent_finish`, `chunk`, `done`. Le client `coach/page.tsx` doit savoir afficher les étapes
4. **Désaccord entre agents** — pour Phase 3 (2 agents seulement), peu probable. Pour Phase 5 (7 agents), prévoir un "arbiter" simple dans supervisor.ts : si `severity=critical` sur safety, ses recommandations priment et override les autres
5. **Coût** — chaque session = 1 route + N sous-agents + 1 aggregate = N+2 appels Gemini. Avec 7 agents = 9 appels max. Le Supervisor doit décider parcimonieusement (1-3 agents typique, pas 7)
6. **Latence** — sous-agents en parallèle (`Promise.all`) pour limiter à `max(N)` au lieu de `sum`. Agrégation en série après. **Surveiller la latence end-to-end vs `/api/ai/coach` actuel.**
7. **Safety override** — si SafetyCoach détecte TCA/critique : le Supervisor doit ARRÊTER l'agrégation normale et déclencher le safety message + flag dans coach_state. Logique dans supervisor.ts à coder Phase 5.
8. **Tests** — sans tests E2E, on déploie en aveugle. Considérer un test minimal dans `e2e/` qui simule une session avec Gemini mocked. Priorité moyenne.
9. **SharedSessionMemory mutable** — passée par référence aux sous-agents. Race condition si on parallélise mal des writes. Pour Phase 3 (2 agents en parallèle) : chaque agent écrit dans **son propre namespace** de `notes[agent_name]`, jamais en cross-write. Le Supervisor centralise les writes sur `facts` et `decisions`.
10. **Le coach actuel ne doit pas être cassé** — la route `/api/ai/coach` reste intacte. La nouvelle route `/api/ai/coach-multi` est en parallèle. Le client coach actuel ne doit pas la consommer tant qu'on n'a pas validé end-to-end.
11. **`response.text` peut être null** — Gemini SDK : si `responseMimeType: 'application/json'` ne donne pas de JSON valide, `response.text` peut être empty string. Wrap dans try/catch.
12. **Vercel function timeout 60s** — pour Phase 4, configurer `maxDuration: 60` dans `vercel.json` pour `coach-multi`. Avec 9 appels Gemini possibles, latence cumulative à surveiller — fallback no-multi si timeout détecté.

---

## 📁 Inventaire fichiers (récap)

### Création (Phase 0+1+2+3+4+5+6 = 19 nouveaux fichiers)

```
lib/vertex/agents/
├── types.ts                          ✅ DONE
├── shared-memory.ts                  ✅ DONE
├── tracing.ts                        ✅ DONE
├── supervisor.ts                     ⏳ Phase 2
└── sub-agents/
    ├── base.ts                       ⏳ Phase 1
    ├── nutrition.ts                  ⏳ Phase 3
    ├── analytics.ts                  ⏳ Phase 3
    ├── training.ts                   ⏳ Phase 5
    ├── safety.ts                     ⏳ Phase 5
    ├── mental.ts                     ⏳ Phase 5
    ├── social.ts                     ⏳ Phase 5
    └── education.ts                  ⏳ Phase 5

lib/vertex/prompts/agents/
├── supervisor.ts                     ⏳ Phase 2
├── nutrition.ts                      ⏳ Phase 3
├── analytics.ts                      ⏳ Phase 3
├── training.ts                       ⏳ Phase 5
├── safety.ts                         ⏳ Phase 5
├── mental.ts                         ⏳ Phase 5
├── social.ts                         ⏳ Phase 5
└── education.ts                      ⏳ Phase 5

app/api/ai/coach-multi/
└── route.ts                          ⏳ Phase 4

scripts/
└── backup-user-data.mjs              ⏳ Phase 6
```

### Modifications

```
firestore.rules                        ✅ DONE (règle agent_memory_backup ajoutée)
lib/vertex/client.ts                   ⏳ Phase 1 ou 2 (exposer usageMetadata)
vercel.json                            ⏳ Phase 4 (maxDuration coach-multi)
app/(app)/coach/page.tsx               ⏳ Phase 4 (SSE multi-phases UI) — optionnel
```

---

## 🗂️ État git au moment de la pause

### Local non commit (Phase 0 + Wave 13E + autres) :

```
lib/vertex/agents/types.ts            (nouveau, Phase 0)
lib/vertex/agents/shared-memory.ts    (nouveau, Phase 0)
lib/vertex/agents/tracing.ts          (nouveau, Phase 0)
firestore.rules                       (modif, Phase 0)
lib/vertex/context-builder.ts         (modif, Wave 13E enrichments)
lib/vertex/context-fetcher.ts         (modif, Wave 13E enrichments)
docs/multi-agent-roadmap.md           (ce fichier, à committer aussi)
```

### Local commit non push :

```
a1cd80f  feat(coach): branchement corpus nutrition Ottawa P1208 au RAG sourcing
         (5 nutrition_guides + searchNutritionGuides + branchement client.ts)
```

### Déjà push :

Tout le reste (Phase 1+2+3 du coach harmonisation, fixes timeout, etc.)

---

## 🔁 Procédure de reprise en nouvelle session

1. **Cd dans le projet** :
   ```powershell
   cd C:\Users\Utilisateur\.gemini\antigravity\scratch\coaching-app-mvp
   ```

2. **Lire ce fichier en entier** : `docs/multi-agent-roadmap.md`

3. **Vérifier l'état git** :
   ```powershell
   git log --oneline -10
   git diff --stat
   ```
   On doit voir le commit `a1cd80f` local non pushé + les modifs locales Phase 0 + Wave 13E.

4. **Build pour confirmer que l'état actuel compile** :
   ```powershell
   npm run build
   ```

5. **Reprendre à Phase 1** : créer `lib/vertex/agents/sub-agents/base.ts` selon le squelette ci-dessus.

6. **Commit/push strategy** :
   - Le user préfère un seul commit global plutôt que des micro-commits (quota Vercel)
   - À la fin d'un bloc cohérent (ex: Phase 1+2+3 ensemble), commit + push
   - Pour Phase 4 (nouvelle route + UI), commit + push séparé pour pouvoir revert si bug
   - Phase 5+6 peuvent être groupées

---

## 🧠 Contexte additionnel utile

- **Modèle Gemini actuel** : `gemini-3.5-flash` partout (harmonisé en session précédente)
- **Coach actuel** : route `/api/ai/coach` avec streaming SSE, contexte enrichi via `buildEnrichedSystemPrompt` + 16 blocks opt-in
- **Coach prompt** : 21 sections, ~25-35k tokens (renuméroté propre récemment)
- **Wave 13E déjà accumulée en local** : 3 nouveaux blocs context-builder (`checkin_7day_history`, `tdee_history`, `recent_coach_patches`) avec fetchers correspondants. Ces enrichments seront aussi utiles pour les sous-agents Analytics et Mental.
- **Backup local des artefacts coach** : `backups/coach-snapshot-2026-05-27/` (gitignored). Permet de restaurer prompts + RAG embeddings si besoin.
