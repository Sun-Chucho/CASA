"use client";

import { useEffect, useState } from "react";
import {
  subscribeToConnectionStatus,
} from "@/app/lib/firebase-sync";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff } from "lucide-react";

export function SyncStatusIndicator() {
  // Seed with browser online state so we never show "Offline" on first render
  // when the device actually has internet (Firebase may take a moment to confirm).
  const [connected, setConnected] = useState(
    typeof window !== "undefined" ? window.navigator.onLine : true,
  );

  useEffect(() => {
    // Mirror browser online / offline events as a fast fallback.
    const onOnline = () => setConnected(true);
    const onOffline = () => setConnected(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Firebase realtime connection status (authoritative when available).
    const unsubscribe = subscribeToConnectionStatus(setConnected);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      unsubscribe();
    };
  }, []);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors",
        connected
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-red-50 text-red-700 border border-red-200",
      )}
    >
      {connected ? (
        <Wifi className="w-3 h-3" />
      ) : (
        <WifiOff className="w-3 h-3" />
      )}
      {connected ? "Synced" : "Offline"}
    </div>
  );
}
