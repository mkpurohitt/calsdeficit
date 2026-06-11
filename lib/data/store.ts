import type {
  DateRange,
  DayRecord,
  FoodLogRecord,
  FormAnalysisRecord,
  NotificationPreferenceRecord,
  UserGoalRecord,
  WorkoutLogRecord,
} from "./types";

export interface UserDataStore {
  saveUserGoal(goal: UserGoalRecord): Promise<void>;
  getUserGoal(userId: string): Promise<UserGoalRecord | null>;

  addFoodLog(log: Omit<FoodLogRecord, "id" | "created_at">): Promise<FoodLogRecord | null>;
  getFoodLogs(userId: string, range?: DateRange): Promise<FoodLogRecord[]>;
  deleteFoodLog(userId: string, id: string): Promise<void>;

  saveWorkoutLog(log: Omit<WorkoutLogRecord, "id">): Promise<WorkoutLogRecord | null>;
  getWorkoutLogs(userId: string, range?: DateRange): Promise<WorkoutLogRecord[]>;

  saveFormAnalysis(record: Omit<FormAnalysisRecord, "id">): Promise<void>;
  getFormAnalyses(userId: string): Promise<FormAnalysisRecord[]>;

  getDay(userId: string, dateKey: string): Promise<DayRecord | null>;
  saveDay(userId: string, dateKey: string, patch: Partial<DayRecord>): Promise<void>;

  saveNotificationPreferences(record: NotificationPreferenceRecord): Promise<void>;
  getNotificationPreferences(userId: string): Promise<NotificationPreferenceRecord>;
}
