"use client";
// Legacy backend, kept behind NEXT_PUBLIC_DATA_BACKEND=supabase until the
// Firestore migration (scripts/migrate-supabase-to-firestore.mjs) is verified.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { UserDataStore } from "./store";
import type {
  DateRange,
  DayRecord,
  FoodLogRecord,
  FormAnalysisRecord,
  NotificationPreferenceRecord,
  UserGoalRecord,
  WorkoutLogRecord,
} from "./types";

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}

export const supabaseStore: UserDataStore = {
  async saveUserGoal(goal: UserGoalRecord) {
    const { error } = await supabase()
      .from("user_goals")
      .upsert({ ...goal, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) console.error("Error saving user goal:", error);
  },

  async getUserGoal(userId: string) {
    const { data, error } = await supabase().from("user_goals").select("*").eq("user_id", userId).single();
    if (error && error.code !== "PGRST116") console.error("Error getting user goal:", error);
    return (data as UserGoalRecord) || null;
  },

  async addFoodLog(log) {
    const { data, error } = await supabase().from("food_logs").insert([{ ...log }]).select().single();
    if (error) console.error("Error adding food log:", error);
    return data as FoodLogRecord | null;
  },

  async getFoodLogs(userId: string, range?: DateRange) {
    let query = supabase().from("food_logs").select("*").eq("user_id", userId);
    if (range) query = query.gte("date_key", range.from).lte("date_key", range.to);
    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) {
      console.error("Error getting food logs:", error);
      return [];
    }
    return data as FoodLogRecord[];
  },

  async deleteFoodLog(_userId: string, id: string) {
    const { error } = await supabase().from("food_logs").delete().eq("id", id);
    if (error) console.error("Error deleting food log:", error);
  },

  async saveWorkoutLog(log) {
    const { data, error } = await supabase().from("workout_logs").insert([{ ...log }]).select().single();
    if (error) console.error("Error saving workout log:", error);
    return data as WorkoutLogRecord | null;
  },

  async getWorkoutLogs(userId: string, range?: DateRange) {
    let query = supabase().from("workout_logs").select("*").eq("user_id", userId);
    if (range) query = query.gte("date_key", range.from).lte("date_key", range.to);
    const { data, error } = await query.order("logged_at", { ascending: true });
    if (error) {
      if (error.code !== "PGRST205") console.error("Error getting workout logs:", error);
      return [];
    }
    return data as WorkoutLogRecord[];
  },

  async saveFormAnalysis(record) {
    const { error } = await supabase().from("form_analyses").insert([{ ...record }]);
    if (error) console.error("Error saving form analysis:", error);
  },

  async getFormAnalyses(userId: string) {
    const { data, error } = await supabase()
      .from("form_analyses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      if (error.code !== "PGRST205") console.error("Error getting form analyses:", error);
      return [];
    }
    return data as FormAnalysisRecord[];
  },

  async getDay(userId: string, dateKey: string) {
    const { data, error } = await supabase()
      .from("step_sync")
      .select("*")
      .eq("user_id", userId)
      .eq("date_key", dateKey)
      .single();
    if (error && error.code !== "PGRST116" && error.code !== "PGRST205") {
      console.error("Error getting day record:", error);
    }
    if (!data) return null;
    return {
      date_key: dateKey,
      steps: data.steps || 0,
      steps_source: data.source || "manual",
      water_ml: data.water_ml || 0,
      updated_at: data.updated_at,
    } as DayRecord;
  },

  async saveDay(userId: string, dateKey: string, patch: Partial<DayRecord>) {
    const { error } = await supabase().from("step_sync").upsert({
      user_id: userId,
      date_key: dateKey,
      steps: patch.steps ?? 0,
      source: patch.steps_source ?? "manual",
      updated_at: new Date().toISOString(),
    });
    if (error) console.error("Error saving day record:", error);
  },

  async saveNotificationPreferences(record: NotificationPreferenceRecord) {
    const { error } = await supabase()
      .from("notification_preferences")
      .upsert({ ...record, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) console.error("Error saving notification preferences:", error);
  },

  async getNotificationPreferences(userId: string) {
    const { data, error } = await supabase()
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error || !data) {
      return { user_id: userId, meal_reminders: true, workout_reminders: true, weekly_summary: true };
    }
    return data as NotificationPreferenceRecord;
  },
};
