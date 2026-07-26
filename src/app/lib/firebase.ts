import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence, signInAnonymously } from "firebase/auth";
import { getDatabase, onValue, ref } from "firebase/database";

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
const AUTH_READY_TIMEOUT_MS = 2500;

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

      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        const timeoutId = window.setTimeout(() => {
          console.warn("Firebase auth bootstrap timed out, continuing without client auth.");
          unsubscribe();
          finish();
        }, AUTH_READY_TIMEOUT_MS);

        const unsubscribe = onAuthStateChanged(
          firebaseAuth,
          (user) => {
            if (!user) return;
            window.clearTimeout(timeoutId);
            unsubscribe();
            finish();
          },
          () => {
            window.clearTimeout(timeoutId);
            unsubscribe();
            finish();
          },
        );

        signInAnonymously(firebaseAuth).catch((error) => {
          window.clearTimeout(timeoutId);
          console.warn("Firebase anonymous auth unavailable, continuing without client auth.", error);
          unsubscribe();
          finish();
        });
      });
    })().catch((error) => {
      authReadyPromise = null;
      throw error;
    });
  }

  return authReadyPromise;
}

// Enable offline persistence: an active onValue listener on the storage root
// ensures the SDK eagerly caches all data locally. Writes made while offline
// are automatically queued by the Firebase SDK and replayed when the
// connection is restored.
if (typeof window !== "undefined") {
  void ensureFirebaseAuthReady()
    .then(() => {
      const tier = window.localStorage.getItem("mawio-tier") || "standard";
      onValue(ref(firebaseDatabase, `casa/${tier}`), () => {}, { onlyOnce: false });
    })
    .catch((error) => {
      console.error("Firebase authentication bootstrap failed", error);
    });
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
