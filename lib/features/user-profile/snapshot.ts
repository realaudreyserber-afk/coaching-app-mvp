import { adminDb } from '@/lib/firebase/admin';

export interface NormalizedProfile {
  uid: string;
  name: string;
  age: number | null;
  sex: 'male' | 'female' | null;
  objective: 'lose_weight' | 'gain_muscle' | 'recomposition' | null;
  weight_kg: number | null;
  height_cm: number | null;
  target_weight_kg: number | null;
  /**
   * Audit 2026-05-29 : composition corporelle partagée à tous les agents pour
   * une base de calcul protéines COMMUNE (nutrition/training/planning divergeaient
   * : poids cible vs poids actuel vs LBM). `body_fat_pct` = baseline.bf_pct si
   * mesuré ; `lbm_kg` dérivé (poids × (1 − bf%)). null si non mesuré.
   */
  body_fat_pct: number | null;
  lbm_kg: number | null;
  activity_level: string | null;
  dietary_restrictions: string[] | null;
  dietary_preferences: string[] | null;
  allergies: string[] | null;
  dislikes: string[] | null;
  uses_glp1: boolean;
  /**
   * Audit 2026-05-28 #4 : contexte hormonal explicite (ex: 'trt').
   * Champ CRITIQUE — sans lui, les sections "Sous TRT" des prompts agents
   * nutrition/training n'ont aucune donnée source → soit règle morte, soit
   * le LLM infère le TRT du texte libre = bug TRT halluciné. Le coach mono
   * lisait déjà profile.hormonal_context ; le multi-agent ne le recevait pas.
   * `null`/'none' = aucun contexte hormonal déclaré (jamais inférer).
   */
  hormonal_context: string | null;
  training_level: string | null;
  equipment: string[] | null;
  injuries: string[] | null;
  training_seniority_years: number | null;
  training_environment: string | null;
  competition_target_date: string | null;
  goals: {
    type: 'lose_weight' | 'gain_muscle' | 'recomposition' | null;
    target_weight: number | null;
    target_date: string | null;
    recommended_weeks_min: number | null;
    recommended_weeks_default: number | null;
    recommended_weeks_max: number | null;
    duration_chosen_weeks: number | null;
  } | null;
  ed_history: boolean;
  comorbidities: string[] | null;
  medications: string[] | null;
  household: string | null;
  work_context: string | null;
  lifestyle: string | null;
  travel_frequency: string | null;
  relationship_status: string | null;
}

export async function getUserProfileSnapshot(uid: string): Promise<NormalizedProfile> {
  const userRef = adminDb.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    throw new Error(`User ${uid} not found`);
  }
  const data = snap.data() || {};
  const profile = data.profile || {};
  const baseline = data.baseline || {};
  const goals = data.goals || {};
  const medical = data.medical || {};

  // Compute age from dob
  let age: number | null = null;
  if (profile.dob) {
    const birthDate = new Date(profile.dob);
    const today = new Date();
    let computedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      computedAge--;
    }
    age = computedAge;
  } else if (typeof profile.age === 'number') {
    age = profile.age;
  }

  // Weight fallback chain
  const weight_kg = profile.weight ?? baseline.weight ?? null;
  const height_cm = profile.height ?? null;
  const body_fat_pct =
    typeof baseline.bf_pct === 'number' ? baseline.bf_pct : null;
  const lbm_kg =
    typeof weight_kg === 'number' && body_fat_pct !== null
      ? Math.round(weight_kg * (1 - body_fat_pct / 100) * 10) / 10
      : null;

  return {
    uid,
    name: profile.name ?? '',
    age,
    sex: (profile.sex as 'male' | 'female') ?? null,
    objective: (goals.type as 'lose_weight' | 'gain_muscle' | 'recomposition') ?? null,
    weight_kg,
    height_cm,
    target_weight_kg: goals.target_weight ?? null,
    body_fat_pct,
    lbm_kg,
    activity_level: profile.activity_level ?? null,
    dietary_restrictions: profile.dietary_restrictions ?? null,
    dietary_preferences: profile.dietary_preferences ?? null,
    allergies: profile.allergies ?? medical.allergies ?? null,
    dislikes: profile.dislikes ?? null,
    uses_glp1: profile.uses_glp1 ?? medical.glp1?.active ?? false,
    hormonal_context: profile.hormonal_context ?? medical.hormonal_context ?? null,
    training_level: profile.training_history ?? null,
    equipment: profile.equipment ?? null,
    injuries: profile.injuries ?? medical.conditions ?? null,
    training_seniority_years: profile.training_seniority_years ?? null,
    training_environment: profile.training_environment ?? null,
    competition_target_date: profile.competition_target_date ?? null,
    goals: {
      type: (goals.type as 'lose_weight' | 'gain_muscle' | 'recomposition') ?? null,
      target_weight: goals.target_weight ?? null,
      target_date: goals.target_date ?? null,
      recommended_weeks_min: goals.recommended_weeks_min ?? null,
      recommended_weeks_default: goals.recommended_weeks_default ?? null,
      recommended_weeks_max: goals.recommended_weeks_max ?? null,
      duration_chosen_weeks: goals.duration_chosen_weeks ?? null,
    },
    ed_history: profile.ed_history ?? profile.tca_history ?? false,
    comorbidities: profile.comorbidities ?? medical.conditions ?? null,
    medications: profile.medications ?? medical.medications ?? null,
    household: profile.household ?? null,
    work_context: profile.work_context ?? null,
    lifestyle: profile.lifestyle ?? null,
    travel_frequency: profile.travel_frequency ?? null,
    relationship_status: profile.relationship_status ?? null,
  };
}
