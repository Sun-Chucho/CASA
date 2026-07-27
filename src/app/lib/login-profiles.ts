"use client";

import { Role } from "@/app/lib/mock-data";
import { readJson, writeJson } from "@/app/lib/storage";

export const STORAGE_LOGIN_PROFILES = "orange-hotel-login-profiles";
export const STORAGE_ACTIVE_USERNAME = "orange-hotel-username";
export const SESSION_IDENTITY_EVENT = "orange-hotel-session-identity-updated";

export interface LoginUserAccount {
  username: string;
  password?: string;
  blocked?: boolean;
  updatedAt: number;
}

export interface LoginProfileEntry {
  username: string;
  password?: string;
  shift?: "day" | "night";
  users?: LoginUserAccount[];
  updatedAt: number;
}

export type LoginProfiles = Partial<Record<Role, LoginProfileEntry>>;

export const DEFAULT_LOGIN_PASSWORD = "1234";
export const MANAGER_LOGIN_PASSWORD = "4321";
export const MANAGER_SESSION_VERSION = "manager-password-4321-v1";
export const STORAGE_MANAGER_SESSION_VERSION = "orange-hotel-manager-session-version";

export function getDefaultLoginPassword(role: Role) {
  return role === "manager" ? MANAGER_LOGIN_PASSWORD : DEFAULT_LOGIN_PASSWORD;
}

function dispatchLoginProfilesUpdated() {
  window.dispatchEvent(new CustomEvent("orange-hotel-storage-updated", { detail: { key: STORAGE_LOGIN_PROFILES } }));
}

function dispatchSessionIdentityUpdated() {
  window.dispatchEvent(new CustomEvent(SESSION_IDENTITY_EVENT));
}

export function readLocalLoginProfiles() {
  if (typeof window === "undefined") return null;
  return readJson<LoginProfiles>(STORAGE_LOGIN_PROFILES);
}

export function writeLocalLoginProfiles(profiles: LoginProfiles) {
  if (typeof window === "undefined") return;
  writeJson(STORAGE_LOGIN_PROFILES, profiles);
  dispatchLoginProfilesUpdated();
}

export function readActiveSessionUsername(fallback = "") {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(STORAGE_ACTIVE_USERNAME) ?? fallback;
}

export function writeActiveSessionUsername(username: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_ACTIVE_USERNAME, username.trim());
  dispatchSessionIdentityUpdated();
}

export function subscribeToSessionIdentity(onChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleCustomEvent = () => onChange();
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === STORAGE_ACTIVE_USERNAME) {
      onChange();
    }
  };

  window.addEventListener(SESSION_IDENTITY_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(SESSION_IDENTITY_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);
  };
}

export async function hydrateLoginProfilesFromServer() {
  if (typeof window === "undefined") return null;

  try {
    const response = await fetch("/api/login-profiles", { cache: "no-store" });
    if (!response.ok) return null;
    const profiles = (await response.json()) as LoginProfiles;
    writeLocalLoginProfiles(profiles ?? {});
    return profiles ?? {};
  } catch {
    return null;
  }
}

export function saveLoginProfileToServer(role: Role, entry: LoginProfileEntry): Promise<boolean>;
export async function saveLoginProfileToServer(
  role: Role,
  entry: LoginProfileEntry,
) {
  if (typeof window === "undefined") return false;

  try {
    const response = await fetch("/api/login-profiles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role, entry }),
    });

    if (!response.ok) return false;
    const profiles = (await response.json()) as LoginProfiles;
    writeLocalLoginProfiles(profiles ?? {});
    return true;
  } catch {
    return false;
  }
}

export function getProfilePassword(entry: LoginProfileEntry | null | undefined, username: string, fallback = DEFAULT_LOGIN_PASSWORD) {
  if (!entry) return fallback;

  const matchedUser = entry.users?.find((user) => user.username.trim().toLowerCase() === username.trim().toLowerCase());
  if (matchedUser?.password?.trim()) return matchedUser.password.trim();
  if (entry.password?.trim()) return entry.password.trim();
  return fallback;
}

export function isProfileUserBlocked(entry: LoginProfileEntry | null | undefined, username: string) {
  const matchedUser = entry?.users?.find((user) => user.username.trim().toLowerCase() === username.trim().toLowerCase());
  return matchedUser?.blocked === true;
}

export function upsertProfileUser(
  entry: LoginProfileEntry | null | undefined,
  username: string,
  updates: Partial<LoginUserAccount>,
): LoginProfileEntry {
  const normalizedUsername = username.trim();
  const now = typeof updates.updatedAt === "number" && Number.isFinite(updates.updatedAt) ? updates.updatedAt : Date.now();
  const existingUsers = Array.isArray(entry?.users) ? entry.users : [];
  const nextUser: LoginUserAccount = {
    username: normalizedUsername,
    password: typeof updates.password === "string" ? updates.password.trim() : existingUsers.find((user) => user.username.toLowerCase() === normalizedUsername.toLowerCase())?.password,
    blocked: typeof updates.blocked === "boolean" ? updates.blocked : existingUsers.find((user) => user.username.toLowerCase() === normalizedUsername.toLowerCase())?.blocked,
    updatedAt: now,
  };

  const otherUsers = existingUsers.filter((user) => user.username.toLowerCase() !== normalizedUsername.toLowerCase());

  return {
    username: normalizedUsername,
    password: typeof updates.password === "string" ? updates.password.trim() : entry?.password,
    shift: entry?.shift,
    users: [...otherUsers, nextUser],
    updatedAt: now,
  };
}

export function renameProfileUser(
  entry: LoginProfileEntry | null | undefined,
  previousUsername: string,
  nextUsername: string,
): LoginProfileEntry {
  const normalizedPrevious = previousUsername.trim().toLowerCase();
  const normalizedNext = nextUsername.trim();
  const now = Date.now();
  const existingUsers = Array.isArray(entry?.users) ? entry.users : [];
  const previousUser = existingUsers.find((user) => user.username.trim().toLowerCase() === normalizedPrevious);
  const nextUser = existingUsers.find((user) => user.username.trim().toLowerCase() === normalizedNext.toLowerCase());
  const filteredUsers = existingUsers.filter((user) => {
    const normalizedUser = user.username.trim().toLowerCase();
    return normalizedUser !== normalizedPrevious && normalizedUser !== normalizedNext.toLowerCase();
  });

  return {
    username: normalizedNext,
    password: entry?.password,
    shift: entry?.shift,
    users: [
      ...filteredUsers,
      {
        username: normalizedNext,
        password: previousUser?.password ?? nextUser?.password ?? entry?.password,
        updatedAt: now,
      },
    ],
    updatedAt: now,
  };
}
