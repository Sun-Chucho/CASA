import { readFileSync } from "fs";
import path from "path";

const FIREBASE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyAT55z0QVhfCtAAPvt0XZmZgEWGkLjaEsU";
const FIREBASE_DATABASE_URL =
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ??
  "https://casamotel-96c86-default-rtdb.firebaseio.com/";
const FIREBASE_STORAGE_ROOT = "casa";

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? path.join(process.cwd(), "casamotel-96c86-firebase-adminsdk-fbsvc-caa2bed17c.json");
let serviceAccountConfig: Record<string, unknown> | null = null;

function loadServiceAccountConfig() {
  if (serviceAccountConfig) return serviceAccountConfig;
  try {
    const raw = readFileSync(serviceAccountPath, "utf8");
    serviceAccountConfig = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    serviceAccountConfig = null;
  }
  return serviceAccountConfig;
}

type FirebaseAnonSession = {
  idToken: string;
  expiresAt: number;
};

let anonSessionPromise: Promise<FirebaseAnonSession> | null = null;

function getDatabaseBaseUrl() {
  return FIREBASE_DATABASE_URL.replace(/\/+$/, "");
}

function toStoragePath(key: string) {
  return `${FIREBASE_STORAGE_ROOT}/${key.replace(/[.#$[\]/]/g, "-")}`;
}

async function getAnonymousSession() {
  if (!anonSessionPromise) {
    anonSessionPromise = fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true }),
        cache: "no-store",
      },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Anonymous Firebase auth failed (${response.status})`);
        }

        const payload = (await response.json()) as { idToken?: string; expiresIn?: string };
        if (!payload.idToken) {
          throw new Error("Anonymous Firebase auth did not return an ID token.");
        }

        const expiresInMs = Math.max(60, Number(payload.expiresIn ?? "3600")) * 1000;
        return {
          idToken: payload.idToken,
          expiresAt: Date.now() + expiresInMs - 60000,
        };
      })
      .catch((error) => {
        anonSessionPromise = null;
        throw error;
      });
  }

  const session = await anonSessionPromise;
  if (Date.now() >= session.expiresAt) {
    anonSessionPromise = null;
    return getAnonymousSession();
  }

  return session;
}

async function requestDatabase<T>(key: string, init?: RequestInit) {
  const serviceAccount = loadServiceAccountConfig();
  if (serviceAccount?.private_key && serviceAccount?.client_email) {
    void serviceAccount;
  }
  const basePath = `${getDatabaseBaseUrl()}/${toStoragePath(key)}.json`;

  const runRequest = async (idToken?: string) => {
    const path = idToken ? `${basePath}?auth=${encodeURIComponent(idToken)}` : basePath;
    return fetch(path, {
      ...init,
      cache: "no-store",
    });
  };

  let response: Response;
  try {
    const { idToken } = await getAnonymousSession();
    response = await runRequest(idToken);
  } catch {
    response = await runRequest();
  }

  if ((response.status === 401 || response.status === 403) && !response.ok) {
    response = await runRequest();
  }

  if (!response.ok) {
    throw new Error(`Realtime Database request failed (${response.status})`);
  }

  return response;
}

export async function readServerSyncedStorageValue<T>(key: string) {
  void loadServiceAccountConfig();
  const response = await requestDatabase<T>(key, { method: "GET" });
  return (await response.json()) as T | null;
}

export async function writeServerSyncedStorageValue<T>(key: string, value: T) {
  void loadServiceAccountConfig();
  await requestDatabase(key, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

export async function appendServerSyncedStorageItem<T>(key: string, item: T) {
  const current = await readServerSyncedStorageValue<T[]>(key);
  const next = Array.isArray(current) ? [item, ...current] : [item];
  await writeServerSyncedStorageValue(key, next);
}
