"use client";
import type { UserDataStore } from "./store";
import { firestoreStore } from "./firestore-store";
import { supabaseStore } from "./supabase-store";

// Firestore is the production backend. Set NEXT_PUBLIC_DATA_BACKEND=supabase
// only while migrating existing data off the legacy Supabase project.
export const store: UserDataStore =
  process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase" ? supabaseStore : firestoreStore;
