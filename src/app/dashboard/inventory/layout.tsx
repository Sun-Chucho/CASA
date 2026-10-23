"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChefHat,
  Wine,
  ConciergeBell,
  Sparkles,
  BedDouble,
  Download,
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

  return (
    <div className="flex h-full min-h-screen w-full">
      {/* Left Sidebar */}
      <aside className="w-56 bg-gray-950 text-white flex flex-col shrink-0 min-h-screen">
        <div className="px-4 py-5 border-b border-gray-800">
          <p className="font-black uppercase tracking-widest text-[10px] text-gray-400">
            Inventory Manager
          </p>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-semibold ${
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
    </div>
  );
}
