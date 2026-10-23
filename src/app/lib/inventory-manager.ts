// Inventory Manager — shared types and storage keys

// ─── Storage Keys ────────────────────────────────────────────────────────────
export const INV_KITCHEN_ITEMS_KEY = "orange-hotel-inv-kitchen-items";
export const INV_KITCHEN_MOVEMENTS_KEY = "orange-hotel-inv-kitchen-movements";

export const INV_BAR_ITEMS_KEY = "orange-hotel-inv-bar-items";
export const INV_BAR_MOVEMENTS_KEY = "orange-hotel-inv-bar-movements";

export const INV_RECEPTION_ITEMS_KEY = "orange-hotel-inv-reception-items";
export const INV_RECEPTION_MOVEMENTS_KEY = "orange-hotel-inv-reception-movements";

export const INV_HOUSEKEEPING_ITEMS_KEY = "orange-hotel-inv-housekeeping-items";

export const INV_ROOM_STOCK_KEY = "orange-hotel-inv-room-stock";
export const INV_HOUSEKEEPING_MOVEMENTS_KEY = "orange-hotel-inv-housekeeping-movements";
export const INV_ROOM_MOVEMENTS_KEY = "orange-hotel-inv-room-movements";

export interface PhysicalSource {
  batch: "cassa-physical-stock";
  row: number;
  original: string;
  values: Record<string, number | null>;
  warnings: string[];
}

// ─── Kitchen ─────────────────────────────────────────────────────────────────
export interface KitchenItem {
  id: string;
  name: string;
  unit: string;
  storeQty: number;
  kitchenQty: number;
  brokenQty: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  source?: PhysicalSource;
}

export interface KitchenMovement {
  id: string;
  itemId: string;
  itemName: string;
  type: "add" | "transfer" | "broken" | "adjustment" | "archive";
  fromLocation?: "store" | "kitchen";
  toLocation?: "store" | "kitchen";
  quantity: number;
  notes?: string;
  user?: string;
  createdAt: number;
}

// ─── Bar ─────────────────────────────────────────────────────────────────────
export interface BarItem {
  id: string;
  name: string;
  unit: string;
  storeQty: number;
  barQty: number;
  brokenQty: number;
  sellingPrice?: number;
  buyingPrice?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  source?: PhysicalSource;
}

export interface BarMovement {
  id: string;
  itemId: string;
  itemName: string;
  type: "add" | "transfer" | "broken" | "adjustment" | "archive";
  fromLocation?: "store" | "bar";
  toLocation?: "store" | "bar";
  quantity: number;
  notes?: string;
  user?: string;
  createdAt: number;
}

// ─── Reception ───────────────────────────────────────────────────────────────
export interface ReceptionItem {
  id: string;
  name: string;
  unit: string;
  receptionQty: number;
  storeQty: number;
  minStockLevel: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  source?: PhysicalSource;
}

// ─── Housekeeping ─────────────────────────────────────────────────────────────
export interface HousekeepingItem {
  id: string;
  name: string;
  unit: string;
  openingStock: number;
  stockAdded: number;
  stockIssued: number;
  notes?: string;
  updatedAt: number;
  createdAt: number;
  deletedAt?: number;
  source?: PhysicalSource;
}

// ─── Room Stock ───────────────────────────────────────────────────────────────
export interface RoomStockItem {
  itemName: string;
  quantity: number;
  unit: string;
  condition: "good" | "broken";
}

export interface RoomStockRecord {
  roomId: string;
  items: RoomStockItem[];
  lastUpdated: number;
}

// ─── CSV Download Helper ──────────────────────────────────────────────────────
export function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
