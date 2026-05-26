export type TrainingEnvironment =
  | 'gym' // salle complète : barres, machines, poulies, halteres, racks
  | 'home_gym' // home gym équipé : barre + rack + halteres + banc
  | 'home_bodyweight' // poids du corps uniquement (+/- barre traction)
  | 'mixed'; // alterne entre les deux

export interface UserProfile {
  name: string;
  sex: 'male' | 'female' | 'other';
  dob: string; // YYYY-MM-DD
  height: number; // cm
  timezone: string;
  profession: string;
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  /**
   * Where the user trains. Drives exercise filtering in the coach + plan generator.
   * If 'home_bodyweight', only exercises with equipment ⊆ {aucun, barre_traction,
   * barre_traction_neutre, barres_paralleles, anneaux, elastique, tapis, mur, box,
   * banc, ceinture_lest} are prescribed.
   */
  training_environment?: TrainingEnvironment;
  /**
   * Optional fine-grained list of available equipment slugs (used when
   * training_environment is 'home_gym' or 'mixed' for custom filtering).
   * Slugs match the `equipment` field of lib/features/exercises/database.json.
   */
  available_equipment?: string[];
  created_at: string; // ISO string
}

export interface UserGoals {
  type: 'lose_weight' | 'recomposition' | 'gain_muscle';
  target_weight: number; // kg
  target_date: string; // YYYY-MM-DD
  target_bf?: number; // target body fat percentage
}

export interface UserMedical {
  conditions: string[];
  medications: string[];
  allergies: string[];
  last_bloodwork_date?: string; // YYYY-MM-DD
}

export interface UserBaseline {
  weight: number; // kg
  bf_pct: number; // percentage
  measurements: {
    neck?: number;
    waist?: number;
    hips?: number;
    chest?: number;
    thigh_l?: number;
    thigh_r?: number;
    arm_l?: number;
    arm_r?: number;
  };
  photos: {
    face?: string;
    profile?: string;
    back?: string;
  };
}

export interface UserSubscription {
  tier: 'free' | 'premium';
  stripe_customer_id?: string;
  stripe_sub_id?: string;
  current_period_end?: string; // ISO string
}

export interface UserSettings {
  notifications: boolean;
  units: 'metric' | 'imperial';
  language: 'fr' | 'en';
}

export interface UserDoc {
  uid: string;
  profile: UserProfile;
  goals: UserGoals;
  medical: UserMedical;
  baseline: UserBaseline;
  plan_current_id: string | null;
  subscription: UserSubscription;
  settings: UserSettings;
}
