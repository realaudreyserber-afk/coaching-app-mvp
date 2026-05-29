/**
 * Ajustements ALIMENTATION DU SPORTIF — surcouche sur les AJR de nutrition-db.
 *
 * Les besoins d'un athlète diffèrent du sédentaire : protéines (synthèse +
 * réparation), glucides (carburant), électrolytes (pertes sudorales), fer
 * (hémolyse/endurance), antioxydants (stress oxydatif), oméga-3 (récupération).
 * Repères evidence-based (ISSN / Garthe / Helms) — pas un avis médical.
 */

import { getNutrient } from './nutrients';

export interface AthleteAdjustment {
  /** Multiplicateur indicatif vs AJR sédentaire (null = cible absolue/contextuelle). */
  factor: number | null;
  rationale_fr: string;
}

export const ATHLETE_ADJUSTMENTS: Record<string, AthleteAdjustment> = {
  protein_g: { factor: null, rationale_fr: '1,6-2,2 g/kg (vs 0,8 sédentaire) ; haut du spectre en cut / force / déficit.' },
  carb_g: { factor: null, rationale_fr: 'Modulé par la charge : 3-5 g/kg (volume faible), 6-10 g/kg (endurance), 8-12 g/kg en compétition.' },
  sodium_mg: { factor: null, rationale_fr: "Majoré à l'effort : ~0,5-1,5 g de sodium / litre de sueur — ne PAS sous-doser en endurance ou chaleur." },
  potassium_mg: { factor: 1.2, rationale_fr: 'Électrolyte clé (contraction, crampes, récupération) ; pertes sudorales.' },
  magnesium_mg: { factor: 1.15, rationale_fr: '+10-20 % (pertes sudorales + fonction neuromusculaire) ; déficit fréquent chez le sportif.' },
  iron_mg: { factor: 1.3, rationale_fr: "Endurance : +30-70 % (hémolyse du pied, sueur, inflammation) ; surveiller la ferritine, surtout chez la femme." },
  zinc_mg: { factor: 1.2, rationale_fr: 'Turnover + pertes sudorales accrus (immunité, axe hormonal).' },
  vit_d_mcg: { factor: null, rationale_fr: 'Performance + os + immunité ; carence fréquente, supplémentation hivernale souvent justifiée.' },
  vit_c_mg: { factor: null, rationale_fr: "Stress oxydatif accru — couvrir par l'alimentation. Méga-doses chroniques déconseillées (émoussent l'adaptation à l'entraînement)." },
  vit_b1_mg: { factor: 1.2, rationale_fr: 'Métabolisme énergétique des glucides accru.' },
  epa_g: { factor: null, rationale_fr: 'EPA/DHA : récupération + modulation de l’inflammation ; viser poissons gras 2-3×/sem.' },
  dha_g: { factor: null, rationale_fr: 'idem EPA/DHA.' },
};

/** Cible protéique sportive (g/jour) selon poids + phase. */
export function athleteProteinTargetG(
  weightKg: number,
  phase: 'cut' | 'maintenance' | 'bulk' = 'maintenance',
): { min: number; max: number } {
  const perKg = phase === 'cut' ? [1.8, 2.4] : phase === 'bulk' ? [1.6, 2.0] : [1.6, 2.2];
  return { min: Math.round(weightKg * perKg[0]), max: Math.round(weightKg * perKg[1]) };
}

/**
 * AJR ajusté sportif (AJR base × facteur) pour les nutriments où un facteur
 * s'applique ; sinon renvoie l'AJR de base. null si nutriment inconnu/non quantifié.
 */
export function athleteAdjustedRda(key: string, sex: 'male' | 'female' | null): number | null {
  const n = getNutrient(key);
  if (!n) return null;
  const base = sex === 'female' ? (n.rda_female ?? n.rda_male) : (n.rda_male ?? n.rda_female);
  if (base == null) return null;
  const adj = ATHLETE_ADJUSTMENTS[key];
  if (!adj || adj.factor == null) return base;
  return Math.round(base * adj.factor * 100) / 100;
}
