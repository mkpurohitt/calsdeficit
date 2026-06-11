"use client";
// Facade over the pluggable data store (lib/data). Pages import from here so
// the storage backend can change without touching UI code.
import { store } from "./data";
import type {
  DateRange,
  DayRecord,
  FoodLogRecord,
  FormAnalysisRecord,
  NotificationPreferenceRecord,
  UserGoalRecord,
  WorkoutLogRecord,
} from "./data/types";

export type {
  DateRange,
  DayRecord,
  FoodLogRecord,
  FormAnalysisRecord,
  NotificationPreferenceRecord,
  UserGoalRecord,
  WorkoutLogRecord,
};

/**
 * Local-timezone day key (YYYY-MM-DD). Must only ever run on the client —
 * a server would bucket meals into UTC days.
 */
export function getDateKey(input: Date = new Date()) {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDateKeyDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getDateKey(date);
}

export const saveUserGoal = (goal: UserGoalRecord) => store.saveUserGoal(goal);
export const getUserGoal = (userId: string) => store.getUserGoal(userId);

export const addFoodLog = (log: Omit<FoodLogRecord, "id" | "created_at">) => store.addFoodLog(log);
export const getFoodLogs = (userId: string, range?: DateRange) => store.getFoodLogs(userId, range);
export const deleteFoodLog = (userId: string, id: string) => store.deleteFoodLog(userId, id);

export const saveWorkoutLog = (log: Omit<WorkoutLogRecord, "id">) => store.saveWorkoutLog(log);
export const getWorkoutLogs = (userId: string, range?: DateRange) => store.getWorkoutLogs(userId, range);

export const saveFormAnalysis = (record: Omit<FormAnalysisRecord, "id">) => store.saveFormAnalysis(record);
export const getFormAnalyses = (userId: string) => store.getFormAnalyses(userId);

export const getDay = (userId: string, dateKey: string) => store.getDay(userId, dateKey);
export const saveDay = (userId: string, dateKey: string, patch: Partial<DayRecord>) =>
  store.saveDay(userId, dateKey, patch);

export const saveNotificationPreferences = (record: NotificationPreferenceRecord) =>
  store.saveNotificationPreferences(record);
export const getNotificationPreferences = (userId: string) => store.getNotificationPreferences(userId);
