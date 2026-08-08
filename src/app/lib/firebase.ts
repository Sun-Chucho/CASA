import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { browserLocalPersistence, getAuth, setPersistence, signInAnonymously } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyAT55z0QVhfCtAAPvt0XZmZgEWGkLjaEsU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "casamotel-96c86.firebaseapp.com",
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ??
    "https://casamotel-96c86-default-rtdb.firebaseio.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "casamotel-96c86",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "casamotel-96c86.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "273473558692",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:273473558692:web:ee23bf4f58c2bba458ae31",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-HNZGMHQRTW",
};

const measurementId =
  process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "";

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseDatabase = getDatabase(firebaseApp);

let authReadyPromise: Promise<void> | null = null;
export function ensureFirebaseAuthReady() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (!authReadyPromise) {
    authReadyPromise = (async () => {
      try {
        await setPersistence(firebaseAuth, browserLocalPersistence);
      } catch {
        // Fall back to the default auth persistence if the environment blocks local persistence.
      }

      if (firebaseAuth.currentUser) {
        return;
      }

      const credential = await signInAnonymously(firebaseAuth);
      if (!credential.user) throw new Error("Firebase anonymous authentication did not return a user.");
    })().catch((error) => {
      authReadyPromise = null;
      throw error;
    });
  }

  return authReadyPromise;
}

let analyticsPromise: Promise<Analytics | null> | null = null;

export function getFirebaseAnalytics() {
  if (typeof window === "undefined" || !measurementId) {
    return Promise.resolve<Analytics | null>(null);
  }

  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
      .catch(() => null);
  }

  return analyticsPromise;
}

export { firebaseConfig, measurementId };
