# RAG Coach — exercices + méthodes d'entraînement

Retrieval-Augmented Generation pour le coach ORACLE.IA et le générateur de
plans. Remplace l'injection systématique de la bibliothèque complète dans le
prompt système (4-5k tokens) par un retrieve ciblé à chaque appel.

## Pourquoi RAG ?

Avant Wave 4B, chaque message au coach et chaque génération de plan envoyait
le compact dump des 250+ exos (~4k tokens) + le knowledge méthodes (~7k tokens)
dans le system prompt. C'était :
- **Coûteux** : tokens facturés à chaque appel.
- **Lent** : premier token plus tardif (~300ms supplémentaires).
- **Non-scalable** : si on rajoute 100 exos nutrition, recettes, etc., le
  prompt explose.

Le RAG résout ces 3 problèmes en n'injectant que ce qui est pertinent à
la question posée (top-K exos + 1-2 méthodes).

## Architecture

```
┌────────────────────────────┐
│  scripts/build-rag-...mjs  │  (offline, run via `npm run build:rag`)
│  - reads database.json     │
│  - reads knowledge.md      │
│  - calls Vertex embedding  │
│  - writes embeddings/*.json│
└────────────────────────────┘
              ↓
┌────────────────────────────────────┐
│  lib/features/rag-coach/           │
│  - embeddings/exercises.json (~1MB)│  loaded at cold start
│  - embeddings/methods.json  (~50KB)│  cached in RAM via store.ts
│  - store.ts (cosine + topK)        │
│  - retrieve.ts (public API)        │
│  - context.ts (profile→filter map) │
└────────────────────────────────────┘
              ↓
┌─────────────────────────────────┐    ┌──────────────────────────────────┐
│  /api/ai/coach                  │    │  /api/ai/generate-plan           │
│  buildCoachRagFragment(query)   │    │  buildPlanRagFragment(profile)   │
│  → top 6 exos + 2 methods       │    │  → 40-50 exos (all patterns)     │
│  appended to systemInstruction  │    │  appended to systemInstruction   │
└─────────────────────────────────┘    └──────────────────────────────────┘
```

## Stack

- **Embeddings** : Vertex AI `text-multilingual-embedding-002` (768 dims,
  français natif, gratuit jusqu'à 100k requests/mois).
- **Stockage** : JSON statique check-in dans le repo. Pas de DB vectorielle
  tierce. Brute-force cosine en RAM pour <1000 docs c'est instantané (~0.5ms).
- **Auth** : Application Default Credentials via `google-auth-library`
  (transitive dep de `firebase-admin`).
- **Pré-retrieval déterministe** plutôt que tool use Gemini : plus simple à
  brancher dans le streaming SSE, et déclenche systématiquement (pas de risque
  que le modèle "oublie" d'appeler le tool).

## Comment indexer (offline)

```bash
# Variables requises
export GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json
export GOOGLE_CLOUD_PROJECT=ton-projet-gcp
export VERTEX_LOCATION=europe-west1  # ou autre

npm run build:rag
```

Outputs (commit dans Git après chaque ajout massif d'exos ou de méthodes) :
- `lib/features/rag-coach/embeddings/exercises.json` (~1 MB, 250+ vecteurs 768d)
- `lib/features/rag-coach/embeddings/methods.json` (~50 KB, 20 vecteurs)

Coût total : ~$0.006 par run complet.

## Comment retrieve (runtime)

```ts
import { retrieveExercises, retrieveMethods } from "@/lib/features/rag-coach/retrieve";

// User question → top-5 exos filtrés par niveau + équipement
const hits = await retrieveExercises(
  "alternative au squat barre pour mes genoux",
  { maxLevel: "intermediaire", availableEquipment: ["barre", "halteres"] },
  5,
);

// User question → top-2 méthodes pertinentes
const methods = await retrieveMethods("c'est quoi un myo-rep ?", 2);
```

Helpers haut-niveau dans `context.ts` :

```ts
import {
  buildCoachRagFragment,  // pour /api/ai/coach
  buildPlanRagFragment,   // pour /api/ai/generate-plan
} from "@/lib/features/rag-coach/context";

const fragment = await buildCoachRagFragment(userQuery, userData.profile);
const systemPrompt = `${baseCoachPrompt}\n${fragment}`;
```

## Profile filtering

| `profile.training_history` | RAG `maxLevel` filter            |
|---------------------------|----------------------------------|
| `beginner`                | `debutant`                       |
| `intermediate` (default)  | `intermediaire`                  |
| `advanced`                | `avance`                         |

| `profile.training_environment` | RAG `availableEquipment` filter            |
|--------------------------------|--------------------------------------------|
| `gym` (default)                | `undefined` (no filter, full DB)           |
| `home_gym`                     | barre/halteres/banc/rack/dips/traction/... |
| `home_bodyweight`              | aucun/barre_traction/anneaux/elastique/... |
| `mixed`                        | `undefined` (coach decides per session)    |

Custom `profile.available_equipment` array overrides the env default.

## Quand le RAG retourne 0 résultats

- Index pas encore généré (fresh dev install, ou ajout d'exos sans rerun
  `build:rag`) → l'erreur est logguée en `console.warn` et le retrieve
  retourne `[]`. Le coach continue de fonctionner mais sans contexte
  exercices/méthodes.
- Query trop courte (<8 chars) → bypass intentionnel pour éviter
  d'embedder "ok" ou "merci".

## Tests

`store.test.ts` couvre :
- Cosine similarity (identiques, orthogonaux, opposés)
- L2 normalization
- TopK + filter
- `levelFromProfile` / `equipmentFromProfile` mapping

## TODO / améliorations futures

- [ ] Cache LRU des embeddings de query (1 user pose souvent 2× la même
      question) — actuellement chaque message refacture un embedding.
- [ ] Indexer aussi les recettes (`lib/features/recipes/`) quand la
      question porte sur l'alimentation.
- [ ] Indexer les sources scientifiques internes pour fusionner avec
      `rag-sourcing` qui fait du keyword-match limité.
- [ ] Passer en HNSW (FAISS-WebAssembly via `vectordb`) si N > 5000.
- [ ] Tool use Gemini pour que le modèle décide quand chercher (ex :
      "j'ai assez d'infos sur la nutrition mais besoin de la lib exos").
