import rows from "./bar-catalog.json";
import { transactSyncedStorageKeys } from "./firebase-sync";
import { getStoreItemLabel, MainStoreItem, normalizeBaristaProductTarget, STORAGE_INVENTORY_ITEMS, STORAGE_MAIN_STORE_ITEMS } from "./inventory-transfer";
import { InventoryItem } from "./mock-data";
import { STORAGE_BARISTA_STATE } from "./storage";

export const BAR_CATEGORIES = ["Local Beers", "Imported Beers", "Soft Drinks", "Whiskeys", "Brandy", "Gins", "Rum", "Vodka", "Aperitif", "Liquors", "Wines", "Champagne", "Cigarettes"] as const;
export type BarCategory = typeof BAR_CATEGORIES[number];
export const BAR_CATALOG = rows as Array<{ name: string; category: BarCategory; buyingPrice: number; sellingPrice: number; soldByTot: boolean; openingStock: number; buyingPriceUnit?: "tot" }>;
const VERSION = "cassa-bar-catalog-2026-10-24-opening-counts";
type Versioned = { catalogVersion?: string };
type MenuItem = Versioned & { id: string; name: string; price: number; buyingPrice?: number; category: string; prepMinutes: number; deletedAt?: number; updatedAt?: number };
type Snapshot = { tickets: unknown[]; ticketSeq: number; payments: unknown[]; menuItems: MenuItem[] };

export function barCategory(value?: string): string {
  return BAR_CATEGORIES.find((category) => category.toLowerCase() === value?.toLowerCase()) ?? value ?? "Other";
}

function key(value: string) {
  return normalizeBaristaProductTarget(value).replace(/gwarana/g, "guarana");
}

export function buyingPriceUnit(name: string) {
  return BAR_CATALOG.find((row) => key(row.name) === key(name))?.buyingPriceUnit === "tot" ? "tot" : "unit";
}

export function openingBottleBalance(row: (typeof BAR_CATALOG)[number]) {
  if (!row.soldByTot) return { stock: row.openingStock, totSold: 0, totLimit: 0 };
  const totLimit = /700\s*mls?/i.test(row.name) ? 28 : /(?:1000\s*mls?|1\s*ltr)/i.test(row.name) ? 40 : 30;
  const stock = Math.ceil(row.openingStock / totLimit);
  return { stock, totSold: stock * totLimit - row.openingStock, totLimit };
}

// This authorized one-time baseline replaces existing counts with the supplied opening stock.
// Later sales, purchases and manager edits survive reloads through the per-record version.
export async function syncBarCatalogToPos() {
  await transactSyncedStorageKeys([STORAGE_MAIN_STORE_ITEMS, STORAGE_INVENTORY_ITEMS, STORAGE_BARISTA_STATE], (current) => {
    const stores = [...((current[STORAGE_MAIN_STORE_ITEMS] as MainStoreItem[] | null) ?? [])];
    const inventory = [...((current[STORAGE_INVENTORY_ITEMS] as InventoryItem[] | null) ?? [])];
    const snapshot = (current[STORAGE_BARISTA_STATE] as Snapshot | null) ?? { tickets: [], ticketSeq: 490, payments: [], menuItems: [] };
    const menu = [...(snapshot.menuItems ?? [])];
    for (const row of BAR_CATALOG) {
      const target = key(row.name);
      const si = stores.findIndex((item) => item.lane === "barista" && key(getStoreItemLabel(item)) === target);
      const ii = inventory.findIndex((item) => item.category.toLowerCase() === "bar" && key(item.size ? `${item.name} ${item.size}` : item.name) === target);
      const mi = menu.findIndex((item) => key(item.name) === target);
      if (stores[si]?.deletedAt || inventory[ii]?.status === "INACTIVE" || menu[mi]?.deletedAt) continue;
      const now = Date.now();
      const name = row.name;
      const unit = row.soldByTot ? "Bottle (sold by tot)" : row.category === "Cigarettes" ? "Packet" : "Bottle / unit";
      const balance = openingBottleBalance(row);
      if (si < 0) stores.push({ id: `catalog-bar-${target}`, name, size: "", stock: balance.stock, unit, minStock: 0, lane: "barista", subCategory: row.category, buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, totLimit: balance.totLimit, totSold: balance.totSold, updatedAt: now, catalogVersion: VERSION } as MainStoreItem);
      else if ((stores[si] as MainStoreItem & Versioned).catalogVersion !== VERSION) stores[si] = { ...stores[si], ...(row.name === "SMIRNOFF GUARANA" ? { name: row.name } : {}), stock: balance.stock, totSold: balance.totSold, subCategory: row.category, buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, totLimit: balance.totLimit, updatedAt: now, catalogVersion: VERSION } as MainStoreItem;
      if (ii < 0) inventory.push({ id: `catalog-inv-${target}`, barcode: "", name, category: "Bar", subCategory: row.category, size: "", stock: balance.stock, totSold: balance.totSold, totPerBottle: balance.totLimit || undefined, buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, price: row.sellingPrice, status: "ACTIVE", minStock: 0, unit, updatedAt: now, catalogVersion: VERSION } as InventoryItem);
      else if ((inventory[ii] as InventoryItem & Versioned).catalogVersion !== VERSION) inventory[ii] = { ...inventory[ii], ...(row.name === "SMIRNOFF GUARANA" ? { name: row.name } : {}), stock: balance.stock, totSold: balance.totSold, totPerBottle: balance.totLimit || undefined, subCategory: row.category, buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, price: row.sellingPrice, updatedAt: now, catalogVersion: VERSION } as InventoryItem;
      if (mi < 0) menu.push({ id: `catalog-menu-${target}`, name, price: row.sellingPrice, buyingPrice: row.buyingPrice, category: row.category, prepMinutes: 2, updatedAt: now, catalogVersion: VERSION });
      else if (menu[mi].catalogVersion !== VERSION) menu[mi] = { ...menu[mi], ...(row.name === "SMIRNOFF GUARANA" ? { name: row.name } : {}), category: row.category, buyingPrice: row.buyingPrice, price: row.sellingPrice, catalogVersion: VERSION };
    }
    return { [STORAGE_MAIN_STORE_ITEMS]: stores, [STORAGE_INVENTORY_ITEMS]: inventory, [STORAGE_BARISTA_STATE]: { ...snapshot, menuItems: menu } };
  });
}
