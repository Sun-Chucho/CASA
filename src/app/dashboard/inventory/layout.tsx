"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readStoredRole } from "@/app/lib/auth";
import {
  ChefHat,
  Wine,
  ConciergeBell,
  Sparkles,
  BedDouble,
  Download,
  ArrowLeft,
  Building2,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Kitchen Stock", href: "/dashboard/inventory/kitchen-stock", icon: ChefHat },
  { label: "Bar Stock", href: "/dashboard/inventory/bar-stock", icon: Wine },
  { label: "Reception Stock", href: "/dashboard/inventory/reception-stock", icon: ConciergeBell },
  { label: "Housekeeping Stock", href: "/dashboard/inventory/housekeeping-stock", icon: Sparkles },
  { label: "Room Stock", href: "/dashboard/inventory/room-stock", icon: BedDouble },
  { label: "Stock Downloads", href: "/dashboard/inventory/stock-downloads", icon: Download },
];

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isManager, setIsManager] = useState(false);

  useEffect(() => setIsManager(readStoredRole() === "manager"), []);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col md:flex-row">
      <aside className="w-full shrink-0 bg-gray-950 text-white md:h-full md:w-56 md:overflow-y-auto">
        <div className="px-4 py-5 border-b border-gray-800">
          <p className="font-black uppercase tracking-widest text-[10px] text-gray-400">
            Inventory Manager
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col md:overflow-visible">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-orange-500 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider leading-tight">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-800 p-3 text-xs">
          {isManager && <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>}
          <Link href="/dashboard/company-stock" className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white"><Building2 className="h-4 w-4" /> Company Stock</Link>
          <Link href="/dashboard/settings/password" className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white"><Settings className="h-4 w-4" /> Settings</Link>
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-gray-50">{children}</main>
    </div>
  );
}
