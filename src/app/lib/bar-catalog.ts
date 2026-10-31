import rows from "./bar-catalog.json";
import { transactSyncedStorageKeys } from "./firebase-sync";
import { getStoreItemLabel, MainStoreItem, normalizeBaristaProductTarget, STORAGE_INVENTORY_ITEMS, STORAGE_MAIN_STORE_ITEMS } from "./inventory-transfer";
import { InventoryItem } from "./mock-data";
import { STORAGE_BARISTA_STATE } from "./storage";

export const BAR_CATEGORIES = ["Local Beers", "Imported Beers", "Soft Drinks", "Whiskeys", "Brandy", "Gins", "Rum", "Vodka", "Aperitif", "Liquors", "Wines", "Champagne", "Cigarettes"] as const;
export type BarCategory = typeof BAR_CATEGORIES[number];
export const BAR_CATALOG = rows as Array<{ name: string; category: BarCategory; buyingPrice: number; sellingPrice: number; soldByTot: boolean; openingStock: number; buyingPriceUnit?: "tot" }>;
const VERSION = "cassa-bar-catalog-2026-10-24-opening-counts";
export const JAGER_750_CORRECTION_VERSION = "cassa-jagermeister-750ml-one-bottle-v1";
const STARTING_CAPITAL_KEY = "orange-hotel-barista-starting-capital-v1";
const JAGER_750_OLD_OPENING_STOCK = 61;
// Snapshots captured before this catalog correction contain the 60 excess bottles.
const JAGER_750_CORRECTION_COMMITTED_AT = Date.parse("2026-10-30T08:52:09Z");
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
  await transactSyncedStorageKeys([STORAGE_MAIN_STORE_ITEMS, STORAGE_INVENTORY_ITEMS, STORAGE_BARISTA_STATE, STARTING_CAPITAL_KEY], (current) => {
    const stores = [...((current[STORAGE_MAIN_STORE_ITEMS] as MainStoreItem[] | null) ?? [])];
    const inventory = [...((current[STORAGE_INVENTORY_ITEMS] as InventoryItem[] | null) ?? [])];
    const snapshot = (current[STORAGE_BARISTA_STATE] as Snapshot | null) ?? { tickets: [], ticketSeq: 490, payments: [], menuItems: [] };
    const menu = [...(snapshot.menuItems ?? [])];
    const capital = current[STARTING_CAPITAL_KEY] as { amount: number; capturedAt: number; jager750Correction?: string } | null;
    for (const row of BAR_CATALOG) {
      const target = key(row.name);
      const isJager750 = row.name === "JAGERMEISTER 750 Mls";
      const rowVersion = isJager750 ? JAGER_750_CORRECTION_VERSION : VERSION;
      const si = stores.findIndex((item) => item.lane === "barista" && key(getStoreItemLabel(item)) === target);
      const ii = inventory.findIndex((item) => item.category.toLowerCase() === "bar" && key(item.size ? `${item.name} ${item.size}` : item.name) === target);
      const mi = menu.findIndex((item) => key(item.name) === target);
      if (stores[si]?.deletedAt || inventory[ii]?.status === "INACTIVE" || menu[mi]?.deletedAt) continue;
      const now = Date.now();
      const name = row.name;
      const unit = row.soldByTot ? "Bottle (sold by tot)" : row.category === "Cigarettes" ? "Packet" : "Bottle / unit";
      const balance = openingBottleBalance(row);
      const correctedStock = (stock: number) => Math.max(0, stock - (JAGER_750_OLD_OPENING_STOCK - row.openingStock));
      if (si < 0) stores.push({ id: `catalog-bar-${target}`, name, size: "", stock: balance.stock, unit, minStock: 0, lane: "barista", subCategory: row.category, buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, totLimit: balance.totLimit, totSold: balance.totSold, updatedAt: now, catalogVersion: rowVersion } as MainStoreItem);
      else if ((stores[si] as MainStoreItem & Versioned).catalogVersion !== rowVersion) {
        const old = stores[si] as MainStoreItem & Versioned;
        const oldBaseline = isJager750 && old.catalogVersion === VERSION;
        const needsCorrection = isJager750 && old.stock > row.openingStock && (oldBaseline || (!old.catalogVersion && old.stock === JAGER_750_OLD_OPENING_STOCK));
        stores[si] = { ...old, ...(row.name === "SMIRNOFF GUARANA" ? { name: row.name } : {}), stock: isJager750 ? (needsCorrection ? correctedStock(old.stock) : old.stock) : balance.stock, totSold: balance.totSold, subCategory: row.category, buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, totLimit: balance.totLimit, updatedAt: now, catalogVersion: rowVersion } as MainStoreItem;
      }
      if (ii < 0) inventory.push({ id: `catalog-inv-${target}`, barcode: "", name, category: "Bar", subCategory: row.category, size: "", stock: balance.stock, totSold: balance.totSold, totPerBottle: balance.totLimit || undefined, buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, price: row.sellingPrice, status: "ACTIVE", minStock: 0, unit, updatedAt: now, catalogVersion: rowVersion } as InventoryItem);
      else if ((inventory[ii] as InventoryItem & Versioned).catalogVersion !== rowVersion) {
        const old = inventory[ii] as InventoryItem & Versioned;
        const needsCorrection = isJager750 && old.stock > row.openingStock && (old.catalogVersion === VERSION || (!old.catalogVersion && old.stock === JAGER_750_OLD_OPENING_STOCK));
        inventory[ii] = { ...old, ...(row.name === "SMIRNOFF GUARANA" ? { name: row.name } : {}), stock: isJager750 ? (needsCorrection ? correctedStock(old.stock) : old.stock) : balance.stock, totSold: balance.totSold, totPerBottle: balance.totLimit || undefined, subCategory: row.category, buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, price: row.sellingPrice, updatedAt: now, catalogVersion: rowVersion } as InventoryItem;
      }
      if (mi < 0) menu.push({ id: `catalog-menu-${target}`, name, price: row.sellingPrice, buyingPrice: row.buyingPrice, category: row.category, prepMinutes: 2, updatedAt: now, catalogVersion: VERSION });
      else if (menu[mi].catalogVersion !== VERSION) menu[mi] = { ...menu[mi], ...(row.name === "SMIRNOFF GUARANA" ? { name: row.name } : {}), category: row.category, buyingPrice: row.buyingPrice, price: row.sellingPrice, catalogVersion: VERSION };
    }
    // Stock and capital can be synced on different visits. Apply the opening
    // correction to older snapshots even when the stock row is already updated.
    const correctedCapital = capital && capital.capturedAt < JAGER_750_CORRECTION_COMMITTED_AT && capital.jager750Correction !== JAGER_750_CORRECTION_VERSION
      ? { ...capital, amount: Math.max(0, capital.amount - (JAGER_750_OLD_OPENING_STOCK - 1) * (BAR_CATALOG.find((row) => row.name === "JAGERMEISTER 750 Mls")?.buyingPrice ?? 0)), jager750Correction: JAGER_750_CORRECTION_VERSION }
      : capital;
    return { [STORAGE_MAIN_STORE_ITEMS]: stores, [STORAGE_INVENTORY_ITEMS]: inventory, [STORAGE_BARISTA_STATE]: { ...snapshot, menuItems: menu }, [STARTING_CAPITAL_KEY]: correctedCapital };
  });
}
