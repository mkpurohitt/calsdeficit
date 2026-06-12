"use client";
import type { UserDataStore } from "./store";
import { firestoreStore } from "./firestore-store";

export const store: UserDataStore = firestoreStore;
