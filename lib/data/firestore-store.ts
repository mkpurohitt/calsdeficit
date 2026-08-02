"use client";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  addDoc,
  limit as fbLimit,
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
  ConversationMeta,
  ConversationRecord,
  ScanHistoryRecord,
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

  async addScanHistory(record: Omit<ScanHistoryRecord, "id">) {
    try {
      const ref = await addDoc(sub(record.user_id, "scanHistory"), record);
      // Keep the collection small: prune everything past the newest 10.
      try {
        const snap = await getDocs(query(sub(record.user_id, "scanHistory"), orderBy("created_at", "desc")));
        const extras = snap.docs.slice(10);
        await Promise.all(extras.map((d) => deleteDoc(d.ref)));
      } catch {
        /* pruning is best-effort */
      }
      return { ...record, id: ref.id } as ScanHistoryRecord;
    } catch (error) {
      console.error("Error adding scan history:", error);
      return null;
    }
  },

  async getScanHistory(userId: string, limitTo = 10) {
    try {
      const snap = await getDocs(query(sub(userId, "scanHistory"), orderBy("created_at", "desc")));
      return snap.docs.slice(0, limitTo).map((d) => ({ ...(d.data() as ScanHistoryRecord), id: d.id }));
    } catch (error) {
      console.error("Error getting scan history:", error);
      return [];
    }
  },

  async deleteScanHistory(userId: string, id: string) {
    try {
      await deleteDoc(doc(db, "users", userId, "scanHistory", id));
    } catch (error) {
      console.error("Error deleting scan history:", error);
    }
  },

  async saveConversation(record: ConversationRecord) {
    try {
      // Firestore rejects `undefined`; round-trip to drop any undefined fields.
      const messages = JSON.parse(JSON.stringify(record.messages ?? []));
      if (record.id) {
        // A user-renamed chat keeps its title — auto-titling from the first
        // message must not clobber it on the next turn.
        const ref = doc(db, "users", record.user_id, "conversations", record.id);
        let keepTitle = false;
        try {
          const existing = await getDoc(ref);
          keepTitle = Boolean(existing.exists() && existing.data()?.title_custom);
        } catch {
          /* fall through to the normal update */
        }
        await setDoc(
          ref,
          {
            ...(keepTitle ? {} : { title: record.title }),
            preview: record.preview,
            messages,
            updated_at: record.updated_at,
          },
          { merge: true }
        );
        return { ...record, messages };
      }
      const ref = await addDoc(sub(record.user_id, "conversations"), {
        title: record.title,
        preview: record.preview,
        messages,
        created_at: record.created_at,
        updated_at: record.updated_at,
      });
      // Keep history bounded: prune everything past the 40 most recent.
      // Pinned chats are never pruned — the user explicitly kept them.
      try {
        const snap = await getDocs(query(sub(record.user_id, "conversations"), orderBy("updated_at", "desc")));
        const prunable = snap.docs.filter((d) => !d.data()?.pinned);
        await Promise.all(prunable.slice(40).map((d) => deleteDoc(d.ref)));
      } catch {
        /* pruning is best-effort */
      }
      return { ...record, id: ref.id, messages };
    } catch (error) {
      console.error("Error saving conversation:", error);
      return null;
    }
  },

  async listConversations(userId: string, limitTo = 40): Promise<ConversationMeta[]> {
    try {
      const snap = await getDocs(
        query(sub(userId, "conversations"), orderBy("updated_at", "desc"), fbLimit(limitTo))
      );
      const rows = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: (data.title as string) || "New chat",
          preview: (data.preview as string) || "",
          updated_at: (data.updated_at as string) || "",
          pinned: Boolean(data.pinned),
          title_custom: Boolean(data.title_custom),
        };
      });
      // Pinned first, then most-recent. Sorted client-side so no composite
      // Firestore index is required.
      return rows.sort((a, b) =>
        a.pinned === b.pinned ? b.updated_at.localeCompare(a.updated_at) : a.pinned ? -1 : 1
      );
    } catch (error) {
      console.error("Error listing conversations:", error);
      return [];
    }
  },

  async getConversation(userId: string, id: string) {
    try {
      const snap = await getDoc(doc(db, "users", userId, "conversations", id));
      return snap.exists() ? ({ ...(snap.data() as ConversationRecord), id: snap.id }) : null;
    } catch (error) {
      console.error("Error getting conversation:", error);
      return null;
    }
  },

  async deleteConversation(userId: string, id: string) {
    try {
      await deleteDoc(doc(db, "users", userId, "conversations", id));
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  },

  async renameConversation(userId: string, id: string, title: string) {
    try {
      const clean = title.trim().slice(0, 80);
      if (!clean) return;
      // title_custom stops the per-turn auto-title from overwriting this.
      await setDoc(
        doc(db, "users", userId, "conversations", id),
        { title: clean, title_custom: true },
        { merge: true }
      );
    } catch (error) {
      console.error("Error renaming conversation:", error);
    }
  },

  async setConversationPinned(userId: string, id: string, pinned: boolean) {
    try {
      await setDoc(doc(db, "users", userId, "conversations", id), { pinned }, { merge: true });
    } catch (error) {
      console.error("Error pinning conversation:", error);
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
