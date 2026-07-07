export interface UserGoalRecord {
  user_id: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  goal: string;
  daily_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /* Extended profile captured by onboarding (optional — older records lack them) */
  gender?: "male" | "female";
  activity_level?: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal_weight_kg?: number;
  step_goal?: number;
  fiber_g?: number;
  water_ml?: number;
  /** ISO yyyy-mm-dd; `age` stays derived for calculations */
  birth_date?: string;
  /** Days per week the user can train (drives the split structure) */
  workout_days?: number;
  /** Display-unit preferences; storage stays metric */
  height_unit?: "cm" | "ft";
  weight_unit?: "kg" | "lbs";
  /** Per-meal calorie targets derived from daily_calories */
  meal_targets?: { breakfast: number; lunch: number; dinner: number; snacks: number };
  /** Detailed AI/template weekly exercise plan (markdown) shown after onboarding */
  weekly_plan?: string;
}

export interface FoodLogRecord {
  id?: string;
  user_id: string;
  food_name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  meal_type: string;
  health_tip?: string;
  source?: string;
  verified?: boolean;
  confidence?: number;
  date_key: string;
  date: string;
  created_at?: string;
}

export interface WorkoutLogRecord {
  id?: string;
  user_id: string;
  exercise_id: string;
  exercise_name: string;
  muscle_group?: string;
  sets: number;
  reps: number;
  weight_lbs: number;
  date_key: string;
  logged_at: string;
}

export interface FormAnalysisRecord {
  id?: string;
  user_id: string;
  exercise_name: string;
  score: number;
  corrections?: string[];
  created_at: string;
}

export interface DayRecord {
  date_key: string;
  steps: number;
  steps_source: "manual" | "google-health" | "google-fit";
  water_ml: number;
  updated_at?: string;
}

export interface NotificationPreferenceRecord {
  user_id: string;
  meal_reminders: boolean;
  workout_reminders: boolean;
  weekly_summary: boolean;
}

export interface DateRange {
  from: string;
  to: string;
}
