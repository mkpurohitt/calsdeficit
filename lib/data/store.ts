import type {
  ConversationMeta,
  ConversationRecord,
  DateRange,
  DayRecord,
  FoodLogRecord,
  FormAnalysisRecord,
  NotificationPreferenceRecord,
  ScanHistoryRecord,
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

  addScanHistory(record: Omit<ScanHistoryRecord, "id">): Promise<ScanHistoryRecord | null>;
  getScanHistory(userId: string, limit?: number): Promise<ScanHistoryRecord[]>;
  deleteScanHistory(userId: string, id: string): Promise<void>;

  saveConversation(record: ConversationRecord): Promise<ConversationRecord | null>;
  listConversations(userId: string, limit?: number): Promise<ConversationMeta[]>;
  getConversation(userId: string, id: string): Promise<ConversationRecord | null>;
  deleteConversation(userId: string, id: string): Promise<void>;
  renameConversation(userId: string, id: string, title: string): Promise<void>;
  setConversationPinned(userId: string, id: string, pinned: boolean): Promise<void>;
}
