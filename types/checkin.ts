export interface DailyCheckin {
  weight: number; // kg
  sleep_hours: number;
  sleep_quality: number; // 1-10
  energy: number; // 1-10
  hunger: number; // 1-10
  mood: number; // 1-10
  adherence_nutrition: number; // percentage (0-100) or rating
  training_done: boolean;
  training_intensity?: number; // 1-10
  steps: number;
  notes?: string;
  created_at: string; // ISO string
}

export interface WeeklyCheckin {
  measurements: {
    neck: number;
    waist: number;
    hips: number;
    thigh_l: number;
    thigh_r: number;
    arm_l: number;
    arm_r: number;
  };
  photos: {
    face: string; // storage URL or path
    profile: string; // storage URL or path
    back: string; // storage URL or path
  };
  plan_feedback: string;
  free_notes?: string;
  ai_analysis?: {
    summary: string;
    diagnostic: string;
    photo_comparison?: string;
  };
  plan_proposed_id?: string | null;
  created_at: string; // ISO string
}
