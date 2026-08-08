"use client";

import { useEffect, useState } from "react";
import {
  subscribeToConnectionStatus,
} from "@/app/lib/firebase-sync";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff } from "lucide-react";

export function SyncStatusIndicator() {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const applyConnectionState = (syncConnected: boolean) => setConnected(syncConnected);
    const onOnline = () => setConnected(false);
    const onOffline = () => setConnected(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const unsubscribe = subscribeToConnectionStatus(applyConnectionState);

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
      {connected ? "Synced" : "Not Synced"}
    </div>
  );
}
