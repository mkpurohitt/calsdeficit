"use client";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  addDoc,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
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

function userDoc(userId: string) {
  return doc(db, "users", userId);
}

function sub(userId: string, name: string) {
  return collection(db, "users", userId, name);
}

export const firestoreStore: UserDataStore = {
  async saveUserGoal(goal: UserGoalRecord) {
    try {
      await setDoc(
        userDoc(goal.user_id),
        { goal: { ...goal, updated_at: new Date().toISOString() } },
        { merge: true }
      );
    } catch (error) {
      console.error("Error saving user goal:", error);
    }
  },

  async getUserGoal(userId: string) {
    try {
      const snap = await getDoc(userDoc(userId));
      const data = snap.exists() ? snap.data()?.goal : null;
      return data ? (data as UserGoalRecord) : null;
    } catch (error) {
      console.error("Error getting user goal:", error);
      return null;
    }
  },

  async addFoodLog(log) {
    try {
      const record = { ...log, created_at: new Date().toISOString() };
      const ref = await addDoc(sub(log.user_id, "foodLogs"), record);
      return { ...record, id: ref.id } as FoodLogRecord;
    } catch (error) {
      console.error("Error adding food log:", error);
      return null;
    }
  },

  async getFoodLogs(userId: string, range?: DateRange) {
    try {
      const constraints = range
        ? [where("date_key", ">=", range.from), where("date_key", "<=", range.to), orderBy("date_key"), orderBy("created_at")]
        : [orderBy("created_at")];
      const snap = await getDocs(query(sub(userId, "foodLogs"), ...constraints));
      return snap.docs.map((d) => ({ ...(d.data() as FoodLogRecord), id: d.id }));
    } catch (error) {
      console.error("Error getting food logs:", error);
      return [];
    }
  },

  async deleteFoodLog(userId: string, id: string) {
    try {
      await deleteDoc(doc(db, "users", userId, "foodLogs", id));
    } catch (error) {
      console.error("Error deleting food log:", error);
    }
  },

  async saveWorkoutLog(log) {
    try {
      const ref = await addDoc(sub(log.user_id, "workoutLogs"), log);
      return { ...log, id: ref.id } as WorkoutLogRecord;
    } catch (error) {
      console.error("Error saving workout log:", error);
      return null;
    }
  },

  async getWorkoutLogs(userId: string, range?: DateRange) {
    try {
      const constraints = range
        ? [where("date_key", ">=", range.from), where("date_key", "<=", range.to), orderBy("date_key"), orderBy("logged_at")]
        : [orderBy("logged_at")];
      const snap = await getDocs(query(sub(userId, "workoutLogs"), ...constraints));
      return snap.docs.map((d) => ({ ...(d.data() as WorkoutLogRecord), id: d.id }));
    } catch (error) {
      console.error("Error getting workout logs:", error);
      return [];
    }
  },

  async saveFormAnalysis(record) {
    try {
      await addDoc(sub(record.user_id, "formAnalyses"), record);
    } catch (error) {
      console.error("Error saving form analysis:", error);
    }
  },

  async getFormAnalyses(userId: string) {
    try {
      const snap = await getDocs(query(sub(userId, "formAnalyses"), orderBy("created_at", "desc")));
      return snap.docs.map((d) => ({ ...(d.data() as FormAnalysisRecord), id: d.id }));
    } catch (error) {
      console.error("Error getting form analyses:", error);
      return [];
    }
  },

  async getDay(userId: string, dateKey: string) {
    try {
      const snap = await getDoc(doc(db, "users", userId, "days", dateKey));
      return snap.exists() ? ({ date_key: dateKey, ...snap.data() } as DayRecord) : null;
    } catch (error) {
      console.error("Error getting day record:", error);
      return null;
    }
  },

  async saveDay(userId: string, dateKey: string, patch: Partial<DayRecord>) {
    try {
      await setDoc(
        doc(db, "users", userId, "days", dateKey),
        { ...patch, date_key: dateKey, updated_at: new Date().toISOString() },
        { merge: true }
      );
    } catch (error) {
      console.error("Error saving day record:", error);
    }
  },

  async saveNotificationPreferences(record: NotificationPreferenceRecord) {
    try {
      await setDoc(
        userDoc(record.user_id),
        { notificationPrefs: { ...record, updated_at: new Date().toISOString() } },
        { merge: true }
      );
    } catch (error) {
      console.error("Error saving notification preferences:", error);
    }
  },

  async getNotificationPreferences(userId: string) {
    const defaults: NotificationPreferenceRecord = {
      user_id: userId,
      meal_reminders: true,
      workout_reminders: true,
      weekly_summary: true,
    };
    try {
      const snap = await getDoc(userDoc(userId));
      const prefs = snap.exists() ? snap.data()?.notificationPrefs : null;
      return prefs ? ({ ...defaults, ...prefs } as NotificationPreferenceRecord) : defaults;
    } catch (error) {
      console.error("Error getting notification preferences:", error);
      return defaults;
    }
  },
};
