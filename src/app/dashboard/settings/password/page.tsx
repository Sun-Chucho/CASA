"use client";

import { useEffect, useState } from "react";
import { Lock, User } from "lucide-react";
import { normalizeRole } from "@/app/lib/auth";
import { Role } from "@/app/lib/mock-data";
import {
  DEFAULT_LOGIN_PASSWORD,
  getProfilePassword,
  LoginProfileEntry,
  readLocalLoginProfiles,
  readActiveSessionUsername,
  saveLoginProfileToServer,
  STORAGE_LOGIN_PROFILES,
  subscribeToSessionIdentity,
  upsertProfileUser,
} from "@/app/lib/login-profiles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PasswordSettingsPage() {
  const [role, setRole] = useState<Role>("manager");
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [activeProfile, setActiveProfile] = useState<LoginProfileEntry | null>(null);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const applySession = () => {
      const storedRole = normalizeRole(localStorage.getItem("orange-hotel-role")) ?? "manager";
      setRole(storedRole);
      setUsername(readActiveSessionUsername(storedRole));
      setActiveProfile(readLocalLoginProfiles()?.[storedRole] ?? null);
    };

    const handleProfilesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key !== STORAGE_LOGIN_PROFILES) return;
      applySession();
    };

    applySession();
    const unsubscribeSession = subscribeToSessionIdentity(applySession);
    window.addEventListener("orange-hotel-storage-updated", handleProfilesUpdated as EventListener);

    return () => {
      unsubscribeSession();
      window.removeEventListener("orange-hotel-storage-updated", handleProfilesUpdated as EventListener);
    };
  }, []);

  const updatePassword = async () => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      setFeedback({ type: "error", message: "No active user found for this session." });
      return;
    }

    const expectedPassword = getProfilePassword(activeProfile, normalizedUsername, DEFAULT_LOGIN_PASSWORD);
    if (currentPassword !== expectedPassword) {
      setFeedback({ type: "error", message: "Current password is incorrect." });
      return;
    }

    const nextPassword = newPassword.trim();
    if (nextPassword.length < 4) {
      setFeedback({ type: "error", message: "New password must be at least 4 characters." });
      return;
    }

    if (nextPassword !== confirmPassword.trim()) {
      setFeedback({ type: "error", message: "New password and confirmation do not match." });
      return;
    }

    setSaving(true);
    try {
      const profiles = readLocalLoginProfiles() ?? {};
      const nextEntry = upsertProfileUser(profiles[role], normalizedUsername, {
        password: nextPassword,
        updatedAt: Date.now(),
      });
      const saved = await saveLoginProfileToServer(role, nextEntry);
      if (!saved) {
        setFeedback({ type: "error", message: "Password was not saved to the backend. No local change was applied." });
        return;
      }

      setActiveProfile(nextEntry);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback({
        type: "success",
        message: `Password updated for ${normalizedUsername}.`,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight uppercase">Settings</h1>
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Change the password for the current logged-in user only
        </p>
      </header>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-black uppercase tracking-tight">Account Password</CardTitle>
          <CardDescription>Use this page to update only your own login password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border bg-muted/20 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Logged In User</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-black">{username || role}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{role}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="h-11 pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-11 pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-11 pl-10" />
              </div>
            </div>
          </div>

          {feedback && (
            <div className={`rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-widest ${feedback.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
              {feedback.message}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => void updatePassword()}
              disabled={!currentPassword || !newPassword || !confirmPassword || saving}
              className="h-11 font-black uppercase text-[10px] tracking-widest"
            >
              {saving ? "Saving..." : "Update Password"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
