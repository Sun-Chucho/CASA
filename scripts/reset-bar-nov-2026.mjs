// One-time live reset from CASSA - BAR STOCK MOVEMENT NOV 2026.xlsx.
// Run with --apply. A complete pre-reset Firebase snapshot is saved outside the repo.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const catalog = JSON.parse(fs.readFileSync(new URL("../src/app/lib/bar-catalog.json", import.meta.url), "utf8"));
const source = fs.readFileSync(new URL("../src/app/lib/firebase.ts", import.meta.url), "utf8");
const apiKey = source.match(/AIza[A-Za-z0-9_-]+/)?.[0];
if (!apiKey) throw new Error("Firebase API key was not found.");
const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
});
if (!auth.ok) throw new Error(`Anonymous Firebase authentication failed: ${auth.status}`);
const { idToken } = await auth.json();
const url = `https://casamotel-96c86-default-rtdb.firebaseio.com/casa-v2.json?auth=${encodeURIComponent(idToken)}`;
const read = await fetch(url, { headers: { "X-Firebase-ETag": "true" } });
if (!read.ok) throw new Error(`Firebase read failed: ${read.status}`);
const etag = read.headers.get("etag");
if (!etag) throw new Error("Firebase did not return an ETag; refusing to overwrite live data.");
const original = await read.json();
if (!original || typeof original !== "object") throw new Error("The live database root is empty or invalid.");

const now = Date.now();
const version = "cassa-bar-catalog-2026-11-opening-stock";
const capitalVersion = "cassa-catalog-opening-capital-nov-2026-v2";
const value = Math.round(catalog.reduce((sum, row) => sum + row.openingStock * row.buyingPrice / (row.soldByTot ? row.totLimit : 1), 0));
if (catalog.length !== 105 || value !== 5083244) throw new Error(`Corrected opening stock reconciliation failed: ${catalog.length} items, TSh ${value}.`);
const balance = (row) => {
  if (!row.soldByTot) return { stock: row.openingStock, totSold: 0, totLimit: 0 };
  const stock = Math.ceil(row.openingStock / row.totLimit);
  return { stock, totSold: stock * row.totLimit - row.openingStock, totLimit: row.totLimit };
};
const store = catalog.map((row, index) => {
  const b = balance(row);
  return { id: `nov-2026-bar-${index + 1}`, name: row.name, size: "", stock: b.stock, unit: row.unit ?? (row.soldByTot ? "Bottle (sold by tot)" : row.category === "Cigarettes" ? "Packet" : "Bottle / unit"), minStock: 0, lane: "barista", subCategory: row.category, buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, totLimit: b.totLimit, totSold: b.totSold, updatedAt: now, catalogVersion: version };
});
const inventory = catalog.map((row, index) => {
  const b = balance(row);
  return { id: `nov-2026-inv-${index + 1}`, barcode: "", name: row.name, category: "Bar", subCategory: row.category, size: "", stock: b.stock, totSold: b.totSold, ...(b.totLimit ? { totPerBottle: b.totLimit } : {}), buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, price: row.sellingPrice, status: "ACTIVE", minStock: 0, unit: row.unit ?? (row.soldByTot ? "Bottle (sold by tot)" : row.category === "Cigarettes" ? "Packet" : "Bottle / unit"), updatedAt: now, catalogVersion: version };
});
const menuItems = catalog.map((row, index) => ({ id: `nov-2026-menu-${index + 1}`, name: row.name, price: row.sellingPrice, buyingPrice: row.buyingPrice, category: row.category, prepMinutes: 2, updatedAt: now, catalogVersion: version }));
const next = structuredClone(original);
next["orange-hotel-barista-state"] = { tickets: [], ticketSeq: 490, payments: [], menuItems };
next["orange-hotel-main-store-items"] = [...(original["orange-hotel-main-store-items"] ?? []).filter((item) => item?.lane !== "barista"), ...store];
next["orange-hotel-inventory-items"] = [...(original["orange-hotel-inventory-items"] ?? []).filter((item) => item?.category?.toLowerCase() !== "bar"), ...inventory];
next["orange-hotel-barista-starting-capital-v1"] = { amount: value, capturedAt: now, version: capitalVersion };
for (const key of [
  "orange-hotel-barista-stock-in-history", "orange-hotel-barista-cancel-requests", "orange-hotel-barista-waste",
  "orange-hotel-barista-purchase-session", "orange-hotel-barista-purchase-history",
  "orange-hotel-barista-daily-stock-session", "orange-hotel-barista-daily-stock-history",
  "orange-hotel-inv-bar-items", "orange-hotel-inv-bar-movements",
  "orange-hotel-barista-orders", "orange-hotel-barista-seq", "orange-hotel-barista-payments", "orange-hotel-barista-menu",
]) delete next[key];
for (const [key, matches] of [
  ["orange-hotel-cancelled-tickets", (item) => item?.source === "barista"],
  ["orange-hotel-menu-audit-trail", (item) => item?.menu === "barista"],
  ["orange-hotel-expenses", (item) => item?.department === "barista"],
  ["orange-hotel-store-movements", (item) => item?.lane === "barista" || item?.department === "barista"],
  ["orange-hotel-store-usage", (item) => item?.lane === "barista" || item?.department === "barista"],
  ["orange-hotel-fnb-stock-sales", (item) => item?.department === "barista" || item?.department === "bar"],
]) if (Array.isArray(next[key])) next[key] = next[key].filter((item) => !matches(item));
for (const key of ["orange-hotel-fnb-beverage-cost"]) delete next[key];

console.log(`Opening stock: ${catalog.length} products, ${catalog.reduce((sum, row) => sum + row.openingStock, 0)} units, TSh ${value.toLocaleString()}.`);
console.log(`Clearing ${(original["orange-hotel-barista-state"]?.tickets ?? []).length} tickets and ${(original["orange-hotel-barista-state"]?.payments ?? []).length} payments.`);
if (!process.argv.includes("--apply")) { console.log("Dry run only. Pass --apply to back up and reset Firebase."); process.exit(0); }
const backup = path.join(os.homedir(), "Downloads", `CASSA-bar-before-reset-${new Date(now).toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(backup, JSON.stringify(original));
const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(next) });
if (!put.ok) throw new Error(`Firebase reset failed: ${put.status}. Backup: ${backup}`);
const saved = await put.json();
if (saved["orange-hotel-barista-state"]?.tickets?.length || saved["orange-hotel-barista-state"]?.payments?.length || saved["orange-hotel-main-store-items"]?.filter((item) => item.lane === "barista").length !== 105 || saved["orange-hotel-barista-starting-capital-v1"]?.amount !== value) throw new Error(`Post-write verification failed. Backup: ${backup}`);
console.log(`Reset verified. Backup: ${backup}`);
