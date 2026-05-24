# Module M9 — Sourcing Scientifique (RAG Coach)

Ce module permet au Coach IA conversationnel "L'Insociable" d'adosser ses réponses et conseils nutritionnels ou sportifs à de vraies études scientifiques publiées.

## Configuration & Feature Flag

- **Feature Flag** : `feature_rag_sourcing` (Remote Config Firebase ou variable d'environnement `FEATURE_RAG_SOURCING` / `NEXT_PUBLIC_FEATURE_RAG_SOURCING`).
- **Comportement par défaut** : Désactivé (`false`).

## Fonctionnement technique du RAG

Lorsque l'utilisateur pose une question au Coach :
1. **Extraction de mots-clés** : L'API utilise Gemini 2.5 Flash pour analyser la question et en extraire 2 ou 3 mots-clés scientifiques pertinents en anglais (ex: "protéines musculation" -> "protein intake hypertrophy").
2. **Recherche de Corpus** : 
   - En production : Recherche sur un index Vertex AI Search si `VERTEX_AI_SEARCH_DATASTORE_ID` est configuré.
   - En fallback : Requête HTTP directe vers l'API publique de PubMed (NCBI E-utilities) via `esearch` et `esummary`.
3. **Augmentation du Prompt** : Les résumés, auteurs et journaux des études trouvées sont injectés dans le contexte de Gemini Pro avec des règles de citation strictes.
4. **Génération de la réponse** : Le coach répond à l'utilisateur, cite les sources utilisées et retourne la liste des métadonnées des articles (titres, auteurs, année, lien PubMed).
5. **Affichage dans l'application** : La page de chat `/coach` affiche en dessous du message les sources scientifiques sous forme de cartes cliquables avec des liens sortants vers PubMed.

## Règles de Sécurité & Garde-fous

- **Interdiction d'halluciner** : Le modèle a pour consigne stricte de ne citer *que* les articles fournis par la recherche en temps réel. S'il n'y a pas d'article pertinent, il répond avec ses connaissances générales sans inventer d'études factices.
- **Règles éthiques** : Le safety layer médical reste actif et intercepte en amont toute question hors-cadre ou indiquant un comportement dangereux.

## Procédure de Rollback

En cas de ralentissement de l'API PubMed ou de dysfonctionnement de la Vertex AI Search :
1. Désactiver le flag `feature_rag_sourcing` via Remote Config.
2. Le coach continuera de répondre normalement à l'utilisateur sans effectuer de recherche de sourcing en amont et sans afficher de bloc de sources scientifiques.
