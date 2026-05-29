/**
 * analyzeMicronutrientIntake — estime les apports en micronutriments à partir
 * des aliments loggés, via la table CIQUAL, et les compare aux cibles SPORTIVES.
 *
 * C'est le branchement qui rend la détection de carence RÉELLE (le module
 * micronutrients était mort faute de composition par aliment ; CIQUAL la fournit).
 *
 * ⚠️ Garde-fous anti-faux-positif (un coach santé ne doit JAMAIS crier "carence"
 *    à tort) :
 *   - On ne signale des apports bas que si `reliable` = assez de jours ET un taux
 *     d'aliments identifiés (matchés CIQUAL) suffisant. Sinon on dit juste que les
 *     logs sont trop partiels pour conclure.
 *   - La sortie parle d'"apports bas sur les aliments identifiés", JAMAIS de
 *     carence médicale. Le coach délègue toute suspicion sérieuse à safety.
 */

import { matchFood, nutrientsForPortion } from '@/lib/features/food-composition';
import { athleteAdjustedRda } from '@/lib/features/nutrition-db/athlete-targets';
import { getNutrient } from '@/lib/features/nutrition-db/nutrients';

export interface LoggedItem {
  name?: string | null;
  qty_g?: number | null;
}
export interface LoggedDay {
  date: string;
  items: LoggedItem[];
}

export interface MicronutrientLow {
  key: string;
  name_fr: string;
  /** Couverture moyenne/jour vs cible sportive (%) */
  avg_coverage_pct: number;
  target_per_day: number;
  unit: string;
  /** Aliments riches à suggérer */
  food_sources_fr: string[];
}

export interface MicronutrientIntakeAnalysis {
  days_analyzed: number;
  items_total: number;
  items_matched: number;
  /** items matchés CIQUAL / items total */
  match_rate: number;
  /** true si assez de jours ET de match pour estimer (sinon ne pas conclure) */
  reliable: boolean;
  /** Nutriments < seuil de couverture (uniquement si reliable) */
  low: MicronutrientLow[];
  /** Formulation prudente prête pour le coach (jamais "carence"). */
  note: string;
}

// Micros pertinents pour le sportif ET correctement renseignés dans CIQUAL.
const MICRO_KEYS = [
  'iron_mg',
  'magnesium_mg',
  'zinc_mg',
  'calcium_mg',
  'potassium_mg',
  'vit_d_mcg',
  'vit_b12_mcg',
  'vit_b9_mcg',
  'vit_c_mg',
  'vit_a_mcg',
  'iodine_mcg',
  'selenium_mcg',
];

export function analyzeMicronutrientIntake(
  days: LoggedDay[],
  sex: 'male' | 'female' | null,
  opts: { minDays?: number; minMatchRate?: number; lowThresholdPct?: number } = {},
): MicronutrientIntakeAnalysis {
  const minDays = opts.minDays ?? 5;
  const minMatchRate = opts.minMatchRate ?? 0.5;
  const lowThreshold = opts.lowThresholdPct ?? 70;

  let itemsTotal = 0;
  let itemsMatched = 0;
  const perDay: Array<Record<string, number>> = [];

  for (const day of days) {
    const totals: Record<string, number> = {};
    for (const it of day.items ?? []) {
      if (!it?.name || typeof it.qty_g !== 'number' || it.qty_g <= 0) continue;
      itemsTotal++;
      const food = matchFood(it.name);
      if (!food) continue;
      itemsMatched++;
      const n = nutrientsForPortion(food, it.qty_g);
      for (const k of MICRO_KEYS) {
        if (typeof n[k] === 'number') totals[k] = (totals[k] ?? 0) + n[k];
      }
    }
    perDay.push(totals);
  }

  const daysAnalyzed = perDay.length;
  const matchRate = itemsTotal > 0 ? itemsMatched / itemsTotal : 0;
  const reliable = daysAnalyzed >= minDays && matchRate >= minMatchRate;

  const low: MicronutrientLow[] = [];
  if (reliable) {
    for (const key of MICRO_KEYS) {
      const target = athleteAdjustedRda(key, sex);
      const ref = getNutrient(key);
      if (target == null || target <= 0 || !ref) continue;
      const avgIntake =
        perDay.reduce((s, d) => s + (d[key] ?? 0), 0) / daysAnalyzed;
      const coverage = (avgIntake / target) * 100;
      if (coverage < lowThreshold) {
        low.push({
          key,
          name_fr: ref.name_fr,
          avg_coverage_pct: Math.round(coverage),
          target_per_day: target,
          unit: ref.unit,
          food_sources_fr: ref.food_sources_fr.slice(0, 4),
        });
      }
    }
    low.sort((a, b) => a.avg_coverage_pct - b.avg_coverage_pct);
  }

  const pctMatch = Math.round(matchRate * 100);
  const note = !reliable
    ? `Logs trop partiels pour estimer les micronutriments (${pctMatch}% d'aliments identifiés sur ${daysAnalyzed} j) — logger plus précisément aiderait. Ne PAS conclure à une carence.`
    : low.length
      ? `Apports bas sur les aliments identifiés (${pctMatch}%, ${daysAnalyzed} j) : ${low.map((l) => l.name_fr).join(', ')}. Indicatif (pas un diagnostic) — suggérer des sources alimentaires ; déléguer à safety si signal clinique.`
      : `Apports micronutritionnels corrects sur les aliments identifiés (${pctMatch}%, ${daysAnalyzed} j).`;

  return {
    days_analyzed: daysAnalyzed,
    items_total: itemsTotal,
    items_matched: itemsMatched,
    match_rate: Math.round(matchRate * 100) / 100,
    reliable,
    low,
    note,
  };
}
