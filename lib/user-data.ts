import { supabase } from "./supabase";

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
  created_at: string;
}

export interface StepSyncRecord {
  user_id: string;
  date_key: string;
  steps: number;
  source: "manual" | "google-fit";
  fit_status?: "not_connected" | "manual_only" | "connected";
  updated_at?: string;
}

export interface NotificationPreferenceRecord {
  user_id: string;
  meal_reminders: boolean;
  workout_reminders: boolean;
  weekly_summary: boolean;
}

export function getDateKey(input: Date = new Date()) {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function saveUserGoal(goal: UserGoalRecord) {
  const { error } = await supabase
    .from("user_goals")
    .upsert({
      ...goal,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) console.error("Error saving user goal:", error);
}

export async function getUserGoal(userId: string) {
  const { data, error } = await supabase
    .from("user_goals")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error("Error getting user goal:", error);
  }
  return data as UserGoalRecord | null;
}

export async function addFoodLog(log: Omit<FoodLogRecord, "id" | "created_at">) {
  const { data, error } = await supabase
    .from("food_logs")
    .insert([{ ...log }])
    .select()
    .single();
  if (error) console.error("Error adding food log:", error);
  return data;
}

export async function getFoodLogs(userId: string) {
  const { data, error } = await supabase
    .from("food_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Error getting food logs:", error);
    return [];
  }
  return data as FoodLogRecord[];
}

export async function deleteFoodLog(id: string) {
  const { error } = await supabase
    .from("food_logs")
    .delete()
    .eq("id", id);
  if (error) console.error("Error deleting food log:", error);
}

export async function saveWorkoutLog(log: Omit<WorkoutLogRecord, "id">) {
  const { data, error } = await supabase
    .from("workout_logs")
    .insert([{ ...log }])
    .select()
    .single();
  if (error) console.error("Error saving workout log:", error);
  return data;
}

export async function getWorkoutLogs(userId: string) {
  const { data, error } = await supabase
    .from("workout_logs")
    .select("*")
    .eq("user_id", userId)
    .order("logged_at", { ascending: true });
  if (error) {
    if (error.code !== 'PGRST205') console.error("Error getting workout logs:", error);
    return [];
  }
  return data as WorkoutLogRecord[];
}

export async function saveFormAnalysis(record: Omit<FormAnalysisRecord, "id">) {
  const { error } = await supabase
    .from("form_analyses")
    .insert([{ ...record }]);
  if (error) console.error("Error saving form analysis:", error);
}

export async function getFormAnalyses(userId: string) {
  const { data, error } = await supabase
    .from("form_analyses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code !== 'PGRST205') console.error("Error getting form analyses:", error);
    return [];
  }
  return data as FormAnalysisRecord[];
}

export async function saveStepSync(record: StepSyncRecord) {
  const { error } = await supabase
    .from("step_sync")
    .upsert({
      ...record,
      updated_at: new Date().toISOString(),
    });
  if (error) console.error("Error saving step sync:", error);
}

export async function getStepSync(userId: string, dateKey: string) {
  const { data, error } = await supabase
    .from("step_sync")
    .select("*")
    .eq("user_id", userId)
    .eq("date_key", dateKey)
    .single();
  if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') {
    console.error("Error getting step sync:", error);
  }
  return data as StepSyncRecord | null;
}

export async function saveNotificationPreferences(record: NotificationPreferenceRecord) {
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({
      ...record,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) console.error("Error saving notification preferences:", error);
}

export async function getNotificationPreferences(userId: string) {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) {
    if (error.code !== 'PGRST116' && error.code !== 'PGRST205') console.error("Error getting notification preferences:", error);
    return {
      user_id: userId,
      meal_reminders: true,
      workout_reminders: true,
      weekly_summary: true,
    } satisfies NotificationPreferenceRecord;
  }
  return data as NotificationPreferenceRecord;
}
