import { NextRequest, NextResponse } from "next/server";
import { readServerSyncedStorageValue, writeServerSyncedStorageValue } from "@/app/lib/firebase-server";
import { STORAGE_LOGIN_PROFILES, type LoginProfiles, type LoginProfileEntry, type LoginUserAccount } from "@/app/lib/login-profiles";
import { normalizeRole } from "@/app/lib/auth";

export const runtime = "nodejs";

function sanitizeEntry(entry: Partial<LoginProfileEntry> | null | undefined): LoginProfileEntry | null {
  const username = typeof entry?.username === "string" ? entry.username.trim() : "";
  if (!username) return null;

  const shift = entry?.shift === "day" || entry?.shift === "night" ? entry.shift : undefined;
  const updatedAt = typeof entry?.updatedAt === "number" && Number.isFinite(entry.updatedAt) ? entry.updatedAt : Date.now();
  const password = typeof entry?.password === "string" && entry.password.trim() ? entry.password.trim() : undefined;
  const users = Array.isArray(entry?.users)
    ? entry.users
        .map((user) => {
          const userName = typeof user?.username === "string" ? user.username.trim() : "";
          if (!userName) return null;
          const userPassword = typeof user?.password === "string" && user.password.trim() ? user.password.trim() : undefined;
          const userUpdatedAt = typeof user?.updatedAt === "number" && Number.isFinite(user.updatedAt) ? user.updatedAt : updatedAt;
          const nextUser: LoginUserAccount = {
            username: userName,
            ...(userPassword ? { password: userPassword } : {}),
            ...(user?.blocked === true ? { blocked: true } : {}),
            updatedAt: userUpdatedAt,
          };
          return nextUser;
        })
        .filter(Boolean) as LoginUserAccount[]
    : undefined;

  return {
    username,
    ...(password ? { password } : {}),
    ...(shift ? { shift } : {}),
    ...(users && users.length > 0 ? { users } : {}),
    updatedAt,
  };
}

export async function GET() {
  try {
    const profiles = (await readServerSyncedStorageValue<LoginProfiles>(STORAGE_LOGIN_PROFILES).catch(() => null)) ?? {};
    return NextResponse.json(profiles);
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { role?: string; entry?: Partial<LoginProfileEntry> };
    const role = normalizeRole(body?.role);
    const entry = sanitizeEntry(body?.entry);

    if (!role || !entry) {
      return NextResponse.json({ error: "Invalid login profile payload." }, { status: 400 });
    }

    const current = (await readServerSyncedStorageValue<LoginProfiles>(STORAGE_LOGIN_PROFILES)) ?? {};
    const next: LoginProfiles = {
      ...current,
      [role]: entry,
    };

    await writeServerSyncedStorageValue(STORAGE_LOGIN_PROFILES, next).catch(() => undefined);
    return NextResponse.json(next);
  } catch {
    return NextResponse.json({ error: "Unable to save login profile." }, { status: 500 });
  }
}
