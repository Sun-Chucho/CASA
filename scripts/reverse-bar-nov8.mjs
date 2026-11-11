import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

const DATE = "2026-11-08";
const EXPECTED_CODES = new Set(Array.from({ length: 25 }, (_, index) => `B-H-${585 + index}`));
const STATE_KEY = "orange-hotel-barista-state";
const STORE_KEY = "orange-hotel-main-store-items";
const INVENTORY_KEY = "orange-hotel-inventory-items";
const CANCELLED_KEY = "orange-hotel-cancelled-tickets";
const source = fs.readFileSync(new URL("../src/app/lib/firebase.ts", import.meta.url), "utf8");
const apiKey = source.match(/AIza[A-Za-z0-9_-]+/)?.[0];
if (!apiKey) throw new Error("Firebase key unavailable.");
const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
});
if (!auth.ok) throw new Error(`Auth failed: ${auth.status}`);
const { idToken } = await auth.json();
const url = `https://casamotel-96c86-default-rtdb.firebaseio.com/casa-v2.json?auth=${encodeURIComponent(idToken)}`;
const response = await fetch(url, { headers: { "X-Firebase-ETag": "true" } });
if (!response.ok) throw new Error(`Read failed: ${response.status}`);
const etag = response.headers.get("etag");
if (!etag) throw new Error("Firebase did not provide an ETag.");
const root = await response.json();
const state = root[STATE_KEY];
const businessDate = (payment) => payment.businessDate || (Number.isFinite(payment.createdAt)
  ? new Date(payment.createdAt + 3 * 3600000).toISOString().slice(0, 10) : "");
const sales = (state?.payments ?? []).filter((payment) => businessDate(payment) === DATE);
const actualCodes = new Set(sales.map((sale) => sale.code));
if (sales.length !== EXPECTED_CODES.size || actualCodes.size !== EXPECTED_CODES.size
  || [...EXPECTED_CODES].some((code) => !actualCodes.has(code))) {
  throw new Error(`Expected B-H-585 through B-H-609 on ${DATE}; found ${sales.length} sales with different codes. Re-audit before changing data.`);
}
if (sales.some((sale) => !sale.historical || sale.status !== "completed" || !Array.isArray(sale.lines) || !sale.id)) {
  throw new Error("One or more sales differ from the audited historical records.");
}
const stores = root[STORE_KEY];
const inventory = root[INVENTORY_KEY];
const cancelled = root[CANCELLED_KEY] ?? [];
if (!Array.isArray(stores) || !Array.isArray(inventory) || !Array.isArray(cancelled)) {
  throw new Error("Bar ledgers have an unexpected shape.");
}
if (sales.some((sale) => cancelled.some((record) => record.originalPaymentId === sale.id))) {
  throw new Error("An 8 November sale already has a cancellation record; inspect before proceeding.");
}
const normalize = (value) => value.replace(/\s*\(?TOTS?\)?$/i, "").trim().toLowerCase();
const label = (item) => item.size ? `${item.name} ${item.size}` : item.name;
const quantities = new Map();
for (const sale of sales) for (const line of sale.lines) {
  if (!line.name || !Number.isSafeInteger(line.qty) || line.qty <= 0) throw new Error(`Invalid sale line in ${sale.code}.`);
  quantities.set(line.name, (quantities.get(line.name) ?? 0) + line.qty);
}
const changes = [];
for (const [name, qty] of quantities) {
  const storeMatches = stores.filter((item) => item.lane === "barista" && !item.deletedAt && normalize(label(item)) === normalize(name));
  const inventoryMatches = inventory.filter((item) => item.category?.trim().toLowerCase() === "bar" && item.status !== "INACTIVE" && normalize(label(item)) === normalize(name));
  if (storeMatches.length !== 1 || inventoryMatches.length !== 1) throw new Error(`Expected one item per ledger for ${name}.`);
  const [store] = storeMatches;
  const [item] = inventoryMatches;
  if ((store.totLimit ?? 0) !== 0 || (item.totPerBottle ?? 0) !== 0
    || (store.totSold ?? 0) !== 0 || (item.totSold ?? 0) !== 0) {
    throw new Error(`${name} uses tot stock; this correction requires separate tot arithmetic.`);
  }
  if (!Number.isFinite(store.stock) || store.stock !== item.stock) throw new Error(`Stock ledgers differ for ${name}.`);
  changes.push({ name, qty, storeId: store.id, inventoryId: item.id, before: store.stock, after: store.stock + qty });
}
const total = sales.reduce((sum, sale) => sum + sale.total, 0);
console.log(JSON.stringify({ date: DATE, saleCount: sales.length, total, stockProducts: changes.length, changes }, null, 2));
if (!process.argv.includes("--apply")) {
  console.log("Dry run only. Pass --apply to commit the guarded correction.");
  process.exit(0);
}
const backupPath = path.join(os.homedir(), "Downloads", `casa-bar-nov8-before-${Date.now()}.json`);
fs.writeFileSync(backupPath, JSON.stringify(root));
const now = Date.now();
const removedIds = new Set(sales.map((sale) => sale.id));
root[STATE_KEY] = {
  ...state,
  payments: state.payments.filter((sale) => !removedIds.has(sale.id)),
  voidedPaymentIds: [...new Set([...(state.voidedPaymentIds ?? []), ...removedIds])],
};
for (const change of changes) {
  const store = stores.find((item) => item.id === change.storeId);
  const item = inventory.find((entry) => entry.id === change.inventoryId);
  store.stock = change.after;
  store.updatedAt = now;
  item.stock = change.after;
  item.updatedAt = now;
}
root[CANCELLED_KEY] = [
  ...sales.map((sale) => ({ ...sale, id: `void-${sale.id}`, originalPaymentId: sale.id,
    source: "barista", status: "cancelled", cancelledAt: now, approvedBy: "8 November 2026 bar correction" })),
  ...cancelled,
];
const write = await fetch(url, {
  method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(root),
});
if (!write.ok) throw new Error(`Guarded write failed: ${write.status}. No correction was applied. Backup: ${backupPath}`);
console.log(`Applied correction. Backup: ${backupPath}`);
const verifyResponse = await fetch(url);
if (!verifyResponse.ok) throw new Error(`Verification read failed: ${verifyResponse.status}`);
const verified = await verifyResponse.json();
const remaining = (verified[STATE_KEY]?.payments ?? []).filter((sale) => businessDate(sale) === DATE);
if (remaining.length !== 0) throw new Error(`${remaining.length} 8 November bar sales remain after write.`);
for (const change of changes) {
  const store = verified[STORE_KEY].find((item) => item.id === change.storeId);
  const item = verified[INVENTORY_KEY].find((entry) => entry.id === change.inventoryId);
  if (store?.stock !== change.after || item?.stock !== change.after) throw new Error(`Stock verification failed for ${change.name}.`);
}
console.log(`Verified: 0 sales dated ${DATE}, ${changes.length} restored product balances in both ledgers.`);
