import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAEpPmTy8DRlJfduu5mf6iwwpVNVeCOt94",
  authDomain: "calsdeficit-a9858.firebaseapp.com",
  projectId: "calsdeficit-a9858",
  storageBucket: "calsdeficit-a9858.firebasestorage.app",
  messagingSenderId: "421807728886",
  appId: "1:421807728886:web:b6ae94b20475e8fb2924d7",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);