# Coach snapshot — 2026-05-27

Snapshot complet des artefacts du coach IA NoDream à cette date. Sauvegarde
indépendante des sources Git (utile si le repo se perd, pour audit, ou pour
restauration rapide).

## 📦 Contenu

### `prompts/` — 6 prompts système Vertex AI

| Fichier | Rôle | Taille |
|---|---|---|
| `coach.ts` | COACH_SYSTEM_PROMPT principal — 21 sections, ~25-35k tokens | 43 KB |
| `plan-generator.ts` | Génération du plan initial (training + nutrition) | 12 KB |
| `safety-layer.ts` | Détection TCA / SUICIDE / UNDERWEIGHT / EXTREME_LOSS | 3 KB |
| `weekly-review.ts` | Bilan hebdomadaire | 2 KB |
| `vision-analysis.ts` | Analyse photo progression (Gemini Vision) | 1.7 KB |
| `daily-insight.ts` | Insight quotidien post-checkin | 1.3 KB |

### `rag-coach/` — Bibliothèque RAG exos & méthodes

| Fichier | Rôle |
|---|---|
| `embeddings/exercises.json` | 250+ exos avec vecteurs 768d (text-multilingual-embedding-002) — 4.7 MB |
| `embeddings/methods.json` | 20 méthodes d'entraînement (5/3/1, drop sets, rest-pause, etc.) |
| `context.ts` | Helpers `buildCoachRagFragment` / `buildPlanRagFragment` |
| `retrieve.ts` | API publique `retrieveExercises` / `retrieveMethods` |
| `embedder.ts` | Wrapper Vertex AI embedding API |
| `store.ts` | Cosine similarity + topK + filter par niveau/équipement |
| `types.ts` | Interfaces TypeScript |
| `README.md` | Architecture détaillée |

### `rag-sourcing/` — RAG sources scientifiques + nutrition guides

| Fichier | Rôle |
|---|---|
| `internal-corpus.ts` | Query `content/sources_scientifiques`, `content/protocoles_seche`, `content/nutrition_guides` Firestore + scoring keyword |
| `client.ts` | `searchScientificCorpus` (RAG hybride : internal + Ottawa + FR authorities + PubMed) |
| `fr-sources.ts` | Helper FR ANSES/HAS via Google CSE |
| `prompts.ts` | `buildRAGPrompt` pour formater les sources dans le coach prompt |
| `README.md` | Architecture RAG sourcing |

### `corpus/` — 3 documents source markdown

| Fichier | Source | Rôle |
|---|---|---|
| `corpus-seche-protocoles.md` | Source confidentielle (e-book IFBB PRO + diététicienne) | Protocoles nutritionnels par tranche de poids (3 phases × 4 tranches = 12 protocoles), indexés Firestore via `seed-corpus.mjs` |
| `corpus-nutrition-ottawa.md` | Hôpital d'Ottawa P1208 (2015) | Plan d'alimentation pour la gestion du poids — sections 1-11 + §12 partielle (§12-14 manquantes). 5 items indexés Firestore. |
| `bibliographie-seche.md` | Diverses sources peer-reviewed | Bibliographie scientifique (références à citer) |

### `scripts/` — Outil de restauration Firestore

| Fichier | Rôle |
|---|---|
| `seed-corpus.mjs` | Pousse en Firestore les 16 sources scientifiques + 12 protocoles + 5 nutrition guides. À relancer si on veut restaurer les `content/*` collections. Lancement : `node scripts/seed-corpus.mjs` (lit `.env.local` pour les creds Firebase Admin). |

## 🔄 Comment restaurer depuis ce snapshot

### Restaurer les prompts dans le code
```powershell
Copy-Item .\prompts\*.ts ..\..\lib\vertex\prompts\
```

### Restaurer les embeddings RAG
```powershell
Copy-Item -Recurse .\rag-coach\* ..\..\lib\features\rag-coach\
```

### Restaurer les corpus markdown
```powershell
Copy-Item .\corpus\*.md ..\..\docs\corpus\
```

### Restaurer les content/* Firestore
```powershell
$env:FIREBASE_PROJECT_ID="linsociable-coaching"
node .\scripts\seed-corpus.mjs
```

## 🕐 Versions au moment du snapshot

- Modèle Vertex AI principal : `gemini-3.5-flash` (defaults dans `lib/vertex/client.ts`)
- Modèle embedding RAG : `text-multilingual-embedding-002`
- Région Vertex : `europe-west1`
- Commit Git de référence : voir `git log` au moment du snapshot

## 📝 Ce qui N'est PAS dans ce snapshot

- Données utilisateur Firestore (`users/{uid}/*`) — pour ça, cf. backlog item "script `scripts/backup-user-data.mjs`" (à implémenter)
- Variables d'environnement secrètes (Firebase Admin private key, etc.)
- `node_modules/`
