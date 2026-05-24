/**
 * Dictionnaire de keywords pour la détection fast-path safety.
 * À auditer périodiquement par un professionnel de santé mentale.
 *
 * Normalisation appliquée avant matching (cf. normalizeForSafety) :
 *   - toLowerCase()
 *   - apostrophes typographiques → apostrophe ASCII
 *   - NFC unicode + suppression accents
 */

export const SUICIDE_KEYWORDS_FR = [
  'me suicider',
  'suicide',
  'me tuer',
  'mourir',
  'en finir',
  'plus envie de vivre',
  "m'automutiler",
  'me faire du mal',
  'plus la force',
  'tout arreter',
  'tout arrêter',
  'envie de disparaitre',
  'envie de disparaître',
  'a quoi bon vivre',
  'à quoi bon vivre',
];

export const TCA_KEYWORDS_FR = [
  'me faire vomir',
  'vomir apres',
  'vomir après',
  'jeune punitif',
  'jeûne punitif',
  'laxatifs',
  'meritais pas de manger',
  'méritais pas de manger',
  'puni de manger',
  'compensatoire',
  'mange-vomi',
  '800 kcal',
  '600 kcal',
  '500 kcal',
];

export function normalizeForSafety(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/[‘’‛ʼ]/g, "'")
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function normalizeKeywords(list: string[]): string[] {
  return list.map(normalizeForSafety);
}
