// One-time live reset for bookings, breakfast allocations, and kitchen sales.
// Run with --apply. A complete pre-reset Firebase snapshot is saved outside the repo.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

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

const catalog = JSON.parse(fs.readFileSync(new URL("../src/app/lib/bar-catalog.json", import.meta.url), "utf8"));
const barValue = Math.round(catalog.reduce((sum, row) => sum + row.openingStock * row.buyingPrice / (row.soldByTot ? row.totLimit : 1), 0));
if (catalog.length !== 105 || barValue !== 5083244) throw new Error("The corrected bar opening stock does not reconcile.");
const cashier = original["orange-hotel-cashier-state"];
const kitchen = original["orange-hotel-kitchen-state"];
const rooms = original["orange-hotel-rooms-state"];
if (!cashier || !kitchen || !Array.isArray(rooms)) throw new Error("Cashier, kitchen, or room records are missing; refusing to reset.");
const next = structuredClone(original);
const now = Date.now();
const barVersion = "cassa-bar-catalog-2026-11-opening-stock";
const barBalance = (row) => {
  if (!row.soldByTot) return { stock: row.openingStock, totSold: 0, totLimit: 0 };
  const stock = Math.ceil(row.openingStock / row.totLimit);
  return { stock, totSold: stock * row.totLimit - row.openingStock, totLimit: row.totLimit };
};
next["orange-hotel-barista-state"] = {
  tickets: [], ticketSeq: 490, payments: [],
  menuItems: catalog.map((row, index) => ({ id: `nov-2026-menu-${index + 1}`, name: row.name, price: row.sellingPrice, buyingPrice: row.buyingPrice, category: row.category, prepMinutes: 2, updatedAt: now, catalogVersion: barVersion })),
};
next["orange-hotel-main-store-items"] = [
  ...(original["orange-hotel-main-store-items"] ?? []).filter((item) => item?.lane !== "barista"),
  ...catalog.map((row, index) => {
    const b = barBalance(row);
    return { id: `nov-2026-bar-${index + 1}`, name: row.name, size: "", stock: b.stock, unit: row.unit ?? (row.soldByTot ? "Bottle (sold by tot)" : row.category === "Cigarettes" ? "Packet" : "Bottle / unit"), minStock: 0, lane: "barista", subCategory: row.category, buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, totLimit: b.totLimit, totSold: b.totSold, updatedAt: now, catalogVersion: barVersion };
  }),
];
next["orange-hotel-inventory-items"] = [
  ...(original["orange-hotel-inventory-items"] ?? []).filter((item) => item?.category?.toLowerCase() !== "bar"),
  ...catalog.map((row, index) => {
    const b = barBalance(row);
    return { id: `nov-2026-inv-${index + 1}`, barcode: "", name: row.name, category: "Bar", subCategory: row.category, size: "", stock: b.stock, totSold: b.totSold, ...(b.totLimit ? { totPerBottle: b.totLimit } : {}), buyingPrice: row.buyingPrice, sellingPrice: row.sellingPrice, price: row.sellingPrice, status: "ACTIVE", minStock: 0, unit: row.unit ?? (row.soldByTot ? "Bottle (sold by tot)" : row.category === "Cigarettes" ? "Packet" : "Bottle / unit"), updatedAt: now, catalogVersion: barVersion };
  }),
];
next["orange-hotel-barista-starting-capital-v1"] = { amount: barValue, capturedAt: now, version: "cassa-catalog-opening-capital-nov-2026-v2" };
next["orange-hotel-cashier-state"] = { transactions: [], receiptSeq: 0 };
next["orange-hotel-kitchen-state"] = { ...kitchen, tickets: [], ticketSeq: 0, payments: [] };
next["orange-hotel-rooms-state"] = rooms.map((room) => room.status === "occupied" ? { ...room, status: "available" } : room);
for (const key of [
  "orange-hotel-breakfast-allocations", "orange-hotel-website-bookings",
  "orange-hotel-cashier-transactions", "orange-hotel-cashier-seq",
  "orange-hotel-kitchen-tickets", "orange-hotel-kitchen-seq", "orange-hotel-kitchen-payments", "orange-hotel-kitchen-menu",
  "orange-hotel-barista-stock-in-history", "orange-hotel-barista-cancel-requests", "orange-hotel-barista-waste",
  "orange-hotel-barista-purchase-session", "orange-hotel-barista-purchase-history",
  "orange-hotel-barista-daily-stock-session", "orange-hotel-barista-daily-stock-history",
  "orange-hotel-inv-bar-items", "orange-hotel-inv-bar-movements",
  "orange-hotel-barista-orders", "orange-hotel-barista-seq", "orange-hotel-barista-payments", "orange-hotel-barista-menu",
]) delete next[key];
if (Array.isArray(next["orange-hotel-cancelled-tickets"])) next["orange-hotel-cancelled-tickets"] = next["orange-hotel-cancelled-tickets"].filter((item) => item?.source !== "kitchen" && item?.source !== "barista");
if (Array.isArray(next["orange-hotel-fnb-stock-sales"])) next["orange-hotel-fnb-stock-sales"] = next["orange-hotel-fnb-stock-sales"].filter((item) => item?.department !== "kitchen");

console.log(`Clearing ${(cashier.transactions ?? []).length} bookings, ${(kitchen.tickets ?? []).length} kitchen tickets, ${(kitchen.payments ?? []).length} kitchen payments, and ${(original["orange-hotel-breakfast-allocations"] ?? []).length} breakfast allocations.`);
console.log(`Releasing ${rooms.filter((room) => room.status === "occupied").length} occupied rooms; retaining ${kitchen.menuItems?.length ?? 0} kitchen menu items.`);
console.log(`Restoring the workbook bar opening stock: ${catalog.length} products, TSh ${barValue.toLocaleString()}.`);
if (!process.argv.includes("--apply")) { console.log("Dry run only. Pass --apply to back up and reset Firebase."); process.exit(0); }

const backup = path.join(os.homedir(), "Downloads", `CASSA-before-bookings-kitchen-reset-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(backup, JSON.stringify(original));
const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(next) });
if (!put.ok) throw new Error(`Firebase reset failed: ${put.status}. Backup: ${backup}`);
const saved = await put.json();
if ((saved["orange-hotel-cashier-state"]?.transactions ?? []).length || saved["orange-hotel-cashier-state"]?.receiptSeq !== 0 || (saved["orange-hotel-kitchen-state"]?.tickets ?? []).length || (saved["orange-hotel-kitchen-state"]?.payments ?? []).length || saved["orange-hotel-kitchen-state"]?.ticketSeq !== 0 || saved["orange-hotel-rooms-state"]?.some((room) => room.status === "occupied") || saved["orange-hotel-main-store-items"]?.filter((item) => item.lane === "barista").length !== 105 || saved["orange-hotel-barista-starting-capital-v1"]?.amount !== barValue) throw new Error(`Post-write verification failed. Backup: ${backup}`);
console.log(`Reset verified. Backup: ${backup}`);
