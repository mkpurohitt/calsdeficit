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
  /** Weeks the user chose to reach goal_weight_kg — drives the deficit size. */
  timeframe_weeks?: number;
  /** The pace that timeframe implies, after clamping to a safe rate. */
  timeline?: {
    requested_weeks: number;
    weekly_rate_kg: number;
    projected_weeks: number;
    capped: boolean;
    daily_delta_kcal: number;
  };
  /** True when the profile was skipped and the numbers are a rough baseline. */
  needs_profile?: boolean;
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
  /** Personalized day-of-eating plan (markdown), built from goals + health data */
  diet_plan?: string;
  /* ── Health context (onboarding); drives safer, tailored AI guidance ── */
  /** Self-reported conditions, e.g. ["Type 2 diabetes", "Hypertension"] */
  health_conditions?: string[];
  /** e.g. "Vegetarian" | "Vegan" | "Eggetarian" | "Non-vegetarian" | "Jain" */
  dietary_preference?: string;
  /** Foods to never suggest, e.g. ["Peanuts", "Gluten"] */
  allergies?: string[];
  /** Free-text detail the user chose to add (medications, injuries, notes) */
  health_notes?: string;
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
  /** Tiny compressed JPEG data-URL of the logged food photo (~96px) for the journal row. */
  photo_thumb?: string;
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
  /** Tiny compressed JPEG data-URL frame from an uploaded workout video (~96px). */
  thumb?: string;
  date_key: string;
  logged_at: string;
}

export interface FormAnalysisRecord {
  id?: string;
  user_id: string;
  exercise_name: string;
  score: number;
  corrections?: string[];
  /** Tiny compressed JPEG data-URL frame captured from the analysed video (~96px). */
  thumb?: string;
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

/** Compressed record of an AI food scan the user has NOT logged yet
 * (created from the Home chat; removed once added to the diary). */
export interface ScanHistoryRecord {
  id?: string;
  user_id: string;
  food_name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  photo_thumb?: string;
  created_at: string;
}

/** A saved Home-chat conversation the user can reopen and continue. */
export interface ConversationRecord {
  id?: string;
  user_id: string;
  title: string;
  preview: string;
  /** Serialized chat messages (client-owned shape; text + scan/workout/exercise cards). */
  messages: unknown[];
  created_at: string;
  updated_at: string;
  /** Pinned chats sort above the rest in the history list. */
  pinned?: boolean;
  /** True once the user renames the chat, so auto-titling stops overwriting it. */
  title_custom?: boolean;
}

/**
 * A public, read-only snapshot of a conversation, addressable at /share/<id>.
 *
 * Sharing copies the messages rather than pointing at the original chat, so the
 * owner can keep talking (or delete the chat) without changing what a recipient
 * sees — and nothing else in the owner's account is ever exposed.
 */
export interface SharedChatRecord {
  id?: string;
  /** Who shared it — used to authorise edits/revocation, never displayed raw. */
  owner_uid: string;
  /** Display name shown as "Shared by …"; empty when the user has none set. */
  owner_name: string;
  title: string;
  /** Same serialized shape as ConversationRecord.messages. */
  messages: unknown[];
  created_at: string;
}

/** Lightweight conversation header for the sidebar list (no messages). */
export interface ConversationMeta {
  id: string;
  title: string;
  preview: string;
  updated_at: string;
  pinned?: boolean;
  title_custom?: boolean;
}

export interface DateRange {
  from: string;
  to: string;
}
