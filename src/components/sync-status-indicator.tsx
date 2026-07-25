"use client";

import { useEffect, useState } from "react";
import {
  subscribeToConnectionStatus,
} from "@/app/lib/firebase-sync";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff } from "lucide-react";

export function SyncStatusIndicator() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    return subscribeToConnectionStatus(setConnected);
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
