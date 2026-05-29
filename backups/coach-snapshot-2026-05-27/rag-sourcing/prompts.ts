import { SearchResult } from './client';

/**
 * Wraps the system prompt or user prompt to inject RAG context.
 */
export function buildRAGPrompt(
  originalPrompt: string,
  searchResults: SearchResult[]
): string {
  if (searchResults.length === 0) {
    return originalPrompt;
  }

  const contextStr = searchResults
    .map(
      (res, idx) =>
        `[Source #${idx + 1}]
Titre: ${res.title}
Auteurs: ${res.authors}
Journal: ${res.source} (${res.year})
PMID: ${res.pmid || 'N/A'}
Lien: ${res.url}`
    )
    .join('\n\n');

  return `
Tu as accès à des études scientifiques réelles et validées pour appuyer tes conseils de coach.
Voici les articles pertinents trouvés dans les bases de données médicales (PubMed / Examine) :

${contextStr}

CONSIGNES STRICTES DE CITATION :
1. Cite toujours tes sources lorsque tu affirmes un fait scientifique en rapport avec les articles fournis ci-dessus.
2. Pour citer une source, utilise le format : "Selon une étude/méta-analyse de [Auteurs] ([Année]), [Explication]. [Source #X]"
3. Ne cite JAMAIS de sources en dehors de la liste ci-dessus. N'invente pas d'études, de PMIDs, de liens ou d'auteurs.
4. Si aucun article fourni n'est pertinent pour la question, réponds simplement avec tes connaissances générales de coach de recomposition corporelle sans citer de source scientifique et sans inventer d'études.
5. Conserve ton ton direct de coach NoDream (tutoiement obligatoire, précis, pragmatique, sans illusion).

Requête de l'utilisateur :
${originalPrompt}
`;
}
