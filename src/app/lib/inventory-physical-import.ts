import source from "@/app/lib/inventory-physical-source.json";
import { hydrateStorageKeyFromFirebase, transactSyncedStorageValue } from "@/app/lib/firebase-sync";
import {
  BarItem, HousekeepingItem, KitchenItem, PhysicalSource,
  INV_BAR_ITEMS_KEY, INV_HOUSEKEEPING_ITEMS_KEY, INV_KITCHEN_ITEMS_KEY,
} from "@/app/lib/inventory-manager";

type Department = "kitchen" | "bar" | "housekeeping";
type PhysicalRow = { sourceRow: number; name: string; sourceLine: string; store?: number | null; working?: number | null; total?: number | null; broken?: number | null; good?: number | null; old?: number | null; recorded?: number | null; balance?: number | null; unit?: string };

function itemSource(department: Department, row: PhysicalRow): PhysicalSource {
  const values: Record<string, number | null> = department === "housekeeping"
    ? { old: row.old ?? null, recorded: row.recorded ?? null, balance: row.balance ?? null }
    : { store: row.store ?? null, working: row.working ?? null, total: row.total ?? null, broken: row.broken ?? null, good: row.good ?? null };
  const warnings: string[] = [];
  const blanks = Object.entries(values).filter(([, value]) => value === null).map(([field]) => field);
  if (blanks.length) warnings.push(`Original blank fields: ${blanks.join(", ")}`);
  if (department === "kitchen" && row.total !== null && row.total !== undefined && row.total !== (row.store ?? 0) + (row.working ?? 0)) warnings.push("Source total disagrees with location quantities; verify physically.");
  if (department === "bar" && row.store) warnings.push("Source good/broken values describe the bar quantity; store condition is unconfirmed.");
  if (department === "housekeeping" && row.balance !== (row.old ?? 0) + (row.recorded ?? 0)) warnings.push("Source balance disagrees with old and recorded quantities.");
  return { batch: "cassa-physical-stock", row: row.sourceRow, original: row.sourceLine, values, warnings };
}

function makeItem(department: Department, row: PhysicalRow): KitchenItem | BarItem | HousekeepingItem {
  const now = Date.now();
  const common = { id: `physical-${department}-${row.sourceRow}`, name: row.name, unit: row.unit ?? "pcs", createdAt: now, updatedAt: now, source: itemSource(department, row) };
  if (department === "housekeeping") return { ...common, openingStock: row.old ?? 0, stockAdded: row.recorded ?? 0, stockIssued: 0 };
  // Imported broken units are part of the source location count. Keep them in
  // brokenQty and remove them from usable location balances exactly once.
  const brokenQty = row.broken ?? 0;
  const working = row.working ?? 0;
  const fromWorking = Math.min(working, brokenQty);
  const fromStore = Math.min(row.store ?? 0, brokenQty - fromWorking);
  const storeQty = (row.store ?? 0) - fromStore;
  const workingQty = working - fromWorking;
  if (department === "kitchen") return { ...common, storeQty, kitchenQty: workingQty, brokenQty };
  return { ...common, storeQty, barQty: workingQty, brokenQty };
}

const KEYS = { kitchen: INV_KITCHEN_ITEMS_KEY, bar: INV_BAR_ITEMS_KEY, housekeeping: INV_HOUSEKEEPING_ITEMS_KEY };

/** Idempotent merge: existing records and quantities are never replaced. */
export async function importPhysicalStock(department: Department) {
  const key = KEYS[department];
  await hydrateStorageKeyFromFirebase(key);
  const rows = source[department] as PhysicalRow[];
  let imported = 0;
  let skipped = 0;
  let updated = 0;
  const saved = await transactSyncedStorageValue<Array<KitchenItem | BarItem | HousekeepingItem>>(key, (current) => {
    const items = Array.isArray(current) ? [...current] : [];
    imported = 0;
    skipped = 0;
    updated = 0;
    for (const row of rows) {
      const name = row.name.trim().toLocaleLowerCase();
      const index = items.findIndex((item) => item.id === `physical-${department}-${row.sourceRow}` || item.name.trim().toLocaleLowerCase() === name);
      if (index >= 0) {
        if (!items[index].source) {
          items[index] = { ...items[index], source: itemSource(department, row) };
          updated++;
          continue;
        }
        skipped++;
        continue;
      }
      items.push(makeItem(department, row));
      imported++;
    }
    return items;
  });
  return { imported, skipped, updated, flagged: saved.filter((item) => item.source?.warnings.length).length };
}
