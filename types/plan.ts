export interface PlanMealTemplate {
  name: string;
  description: string;
  approx_kcal: number;
}

export interface PlanExercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
}

export interface PlanTrainingSession {
  name: string;
  frequency_weekly: number;
  exercises: PlanExercise[];
}

export interface PlanDoc {
  id?: string;
  active: boolean;
  date_start: string; // YYYY-MM-DD
  date_end?: string; // YYYY-MM-DD
  kcal: number;
  macros: {
    p: number; // protein
    c: number; // carbs
    f: number; // fat
  };
  meals_template: PlanMealTemplate[];
  training: {
    sessions: PlanTrainingSession[];
  };
  cardio: {
    type: string;
    duration_minutes: number;
    frequency_weekly: number;
    intensity: 'basse' | 'modérée' | 'haute';
  };
  supplements: Array<{
    name: string;
    dosage: string;
    timing: string;
  }>;
  lifestyle_notes: string;
  source: 'ai' | 'manual';
  justification: string;
  created_at: string; // ISO string
}
