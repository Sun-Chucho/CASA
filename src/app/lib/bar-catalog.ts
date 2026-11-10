import rows from "./bar-catalog.json";
import { transactSyncedStorageKeys } from "./firebase-sync";
import { getStoreItemLabel, MainStoreItem, normalizeBaristaProductTarget, STORAGE_INVENTORY_ITEMS, STORAGE_MAIN_STORE_ITEMS } from "./inventory-transfer";
import { InventoryItem } from "./mock-data";
import { STORAGE_BARISTA_STATE } from "./storage";

export const BAR_CATEGORIES = ["Local Beers", "Imported Beers", "Soft Drinks", "Whiskeys", "Brandy", "Gins", "Rum", "Vodka", "Aperitif", "Liquors", "Wines", "Champagne", "Cigarettes"] as const;
export type BarCategory = typeof BAR_CATEGORIES[number];
export const BAR_CATALOG = rows as Array<{ name: string; category: BarCategory; buyingPrice: number; sellingPrice: number; soldByTot: boolean; openingStock: number; totLimit?: number; unit?: string; buyingPriceUnit?: "tot" }>;
const VERSION = "cassa-bar-catalog-2026-11-opening-stock";
const PRICE_CORRECTION_VERSION = "cassa-bar-buying-prices-nov-2026-v1";
const PRICE_CORRECTION_NAMES = new Set(["SMINOFF GWARANA", "PROVETO", "EMBASSY CKLICK"]);
const STARTING_CAPITAL_KEY = "orange-hotel-barista-starting-capital-v1";
export const OPENING_CAPITAL_VERSION = "cassa-catalog-opening-capital-nov-2026-v2";
export const BAR_OPENING_CAPITAL = Math.round(BAR_CATALOG.reduce((total, row) => {
  const limit = openingBottleBalance(row).totLimit;
  const units = row.soldByTot && row.buyingPriceUnit !== "tot" ? row.openingStock / limit : row.openingStock;
  return total + units * row.buyingPrice;
}, 0));
type Versioned = { catalogVersion?: string; priceCorrectionVersion?: string };
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
  const totLimit = row.totLimit ?? (/700\s*mls?/i.test(row.name) ? 28 : /(?:1000\s*mls?|1\s*ltr)/i.test(row.name) ? 40 : 30);
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
    const capital = current[STARTING_CAPITAL_KEY] as { amount: number; capturedAt: number; version?: string } | null;
    // The live ledger must be cleared by the one-time reset before the new
    // catalog can be used. Do not mix November opening stock with old sales.
    if (capital?.version !== OPENING_CAPITAL_VERSION && (snapshot.tickets?.length || snapshot.payments?.length)) return current;
    for (const row of BAR_CATALOG) {
      const target = key(row.name);
      const rowVersion = VERSION;
      const si = stores.findIndex((item) => item.lane === "barista" && key(getStoreItemLabel(item)) === target);
      const ii = inventory.findIndex((item) => item.category.toLowerCase() === "bar" && key(item.size ? `${item.name} ${item.size}` : item.name) === target);
      const mi = menu.findIndex((item) => key(item.name) === target);
      if (stores[si]?.deletedAt || inventory[ii]?.status === "INACTIVE" || menu[mi]?.deletedAt) continue;
      const now = Date.now();
      const name = row.name;
      const unit = row.unit ?? (row.soldByTot ? "Bottle (sold by tot)" : row.category === "Cigarettes" ? "Packet" : "Bottle / unit");
      const balance = openingBottleBalance(row);
      const correctPrice = PRICE_CORRECTION_NAMES.has(row.name);
      if (si < 0) stores.push({ id: `catalog-bar-${target}`, name, size: "", stock: balance.stock, unit, minStock: 0, lane: "barista", subCategory: row.category, buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, totLimit: balance.totLimit, totSold: balance.totSold, updatedAt: now, catalogVersion: rowVersion } as MainStoreItem);
      else if ((stores[si] as MainStoreItem & Versioned).catalogVersion !== rowVersion) {
        const old = stores[si] as MainStoreItem & Versioned;
        stores[si] = { ...old, name, stock: balance.stock, totSold: balance.totSold, subCategory: row.category, buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, totLimit: balance.totLimit, updatedAt: now, catalogVersion: rowVersion } as MainStoreItem;
      }
      else if (correctPrice && (stores[si] as MainStoreItem & Versioned).priceCorrectionVersion !== PRICE_CORRECTION_VERSION) {
        stores[si] = { ...stores[si], buyingPrice: row.buyingPrice, unit, updatedAt: now, priceCorrectionVersion: PRICE_CORRECTION_VERSION } as MainStoreItem;
      }
      if (ii < 0) inventory.push({ id: `catalog-inv-${target}`, barcode: "", name, category: "Bar", subCategory: row.category, size: "", stock: balance.stock, totSold: balance.totSold, totPerBottle: balance.totLimit || undefined, buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, price: row.sellingPrice, status: "ACTIVE", minStock: 0, unit, updatedAt: now, catalogVersion: rowVersion } as InventoryItem);
      else if ((inventory[ii] as InventoryItem & Versioned).catalogVersion !== rowVersion) {
        const old = inventory[ii] as InventoryItem & Versioned;
        inventory[ii] = { ...old, name, stock: balance.stock, totSold: balance.totSold, totPerBottle: balance.totLimit || undefined, subCategory: row.category, buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, price: row.sellingPrice, updatedAt: now, catalogVersion: rowVersion } as InventoryItem;
      }
      else if (correctPrice && (inventory[ii] as InventoryItem & Versioned).priceCorrectionVersion !== PRICE_CORRECTION_VERSION) {
        inventory[ii] = { ...inventory[ii], buyingPrice: row.buyingPrice, unit, updatedAt: now, priceCorrectionVersion: PRICE_CORRECTION_VERSION } as InventoryItem;
      }
      if (mi < 0) menu.push({ id: `catalog-menu-${target}`, name, price: row.sellingPrice, buyingPrice: row.buyingPrice, category: row.category, prepMinutes: 2, updatedAt: now, catalogVersion: VERSION });
      else if (menu[mi].catalogVersion !== VERSION) menu[mi] = { ...menu[mi], name, category: row.category, buyingPrice: row.buyingPrice, price: row.sellingPrice, catalogVersion: VERSION };
      else if (correctPrice && menu[mi].priceCorrectionVersion !== PRICE_CORRECTION_VERSION) menu[mi] = { ...menu[mi], buyingPrice: row.buyingPrice, updatedAt: now, priceCorrectionVersion: PRICE_CORRECTION_VERSION };
    }
    // Opening capital is the value of the catalog opening counts at buying cost.
    // Keep it separate from later sales, price edits, and restocks.
    const correctedCapital = capital?.version === OPENING_CAPITAL_VERSION
      ? capital
      : { amount: BAR_OPENING_CAPITAL, capturedAt: Date.now(), version: OPENING_CAPITAL_VERSION };
    return { [STORAGE_MAIN_STORE_ITEMS]: stores, [STORAGE_INVENTORY_ITEMS]: inventory, [STORAGE_BARISTA_STATE]: { ...snapshot, menuItems: menu }, [STARTING_CAPITAL_KEY]: correctedCapital };
  });
}
