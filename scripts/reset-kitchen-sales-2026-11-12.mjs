// Back up the live database, then clear kitchen sales without changing breakfast,
// bookings, menu items, stock, or other departments. Dry run unless --apply.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");
const source = fs.readFileSync(new URL("../src/app/lib/firebase.ts", import.meta.url), "utf8");
const apiKey = source.match(/AIza[A-Za-z0-9_-]+/)?.[0];
if (!apiKey) throw new Error("Firebase API key unavailable.");
const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
});
if (!auth.ok) throw new Error(`Authentication failed: ${auth.status}`);
const { idToken } = await auth.json();
const url = `https://casamotel-96c86-default-rtdb.firebaseio.com/casa-v2.json?auth=${encodeURIComponent(idToken)}`;
const response = await fetch(url, { headers: { "X-Firebase-ETag": "true" } });
if (!response.ok || !response.headers.get("etag")) throw new Error(`Live read failed: ${response.status}`);
const etag = response.headers.get("etag");
const root = await response.json();
const kitchenKey = "orange-hotel-kitchen-state";
const kitchen = root?.[kitchenKey];
if (!kitchen || !Array.isArray(kitchen.payments) || !Array.isArray(kitchen.tickets)) {
  throw new Error("Kitchen ledger has an unexpected shape; no reset was made.");
}
const oldBreakfast = JSON.stringify(root["orange-hotel-breakfast-allocations"] ?? null);
const oldMenu = JSON.stringify(kitchen.menuItems ?? []);
const oldStock = JSON.stringify(root["orange-hotel-main-store-items"] ?? null);
const resetAt = Date.now();
const next = structuredClone(root);
next[kitchenKey] = {
  ...kitchen,
  tickets: [],
  payments: [],
  salesResetAt: resetAt,
  voidedPaymentIds: [...new Set([...(kitchen.voidedPaymentIds ?? []), ...kitchen.payments.map((entry) => entry.id).filter(Boolean)])],
  voidedTicketIds: [...new Set([...(kitchen.voidedTicketIds ?? []), ...kitchen.tickets.map((entry) => entry.id).filter(Boolean)])],
};
for (const key of ["orange-hotel-kitchen-tickets", "orange-hotel-kitchen-payments"]) delete next[key];
if (Array.isArray(next["orange-hotel-cancelled-tickets"])) {
  next["orange-hotel-cancelled-tickets"] = next["orange-hotel-cancelled-tickets"].filter((entry) => entry?.source !== "kitchen");
}
if (Array.isArray(next["orange-hotel-fnb-stock-sales"])) {
  next["orange-hotel-fnb-stock-sales"] = next["orange-hotel-fnb-stock-sales"].filter((entry) => entry?.department !== "kitchen");
}
console.log(JSON.stringify({ paymentsToClear: kitchen.payments.length, ticketsToClear: kitchen.tickets.length,
  salesTotalToClear: kitchen.payments.reduce((sum, entry) => sum + Number(entry.total || 0), 0),
  receiptCounterRetained: kitchen.ticketSeq, breakfastAllocationsRetained: (root["orange-hotel-breakfast-allocations"] ?? []).length }));
if (!process.argv.includes("--apply")) process.exit(0);

const backupPath = path.join(os.homedir(), "Downloads", `CASSA-before-kitchen-sales-reset-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(backupPath, JSON.stringify(root));
const write = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(next) });
if (!write.ok) throw new Error(`Conditional reset failed (${write.status}); no changes were saved. Backup: ${backupPath}`);
const check = await fetch(url);
if (!check.ok) throw new Error(`Reset saved but verification read failed (${check.status}). Backup: ${backupPath}`);
const current = await check.json();
if (current[kitchenKey]?.payments?.length || current[kitchenKey]?.tickets?.length
  || current[kitchenKey]?.salesResetAt !== resetAt
  || JSON.stringify(current[kitchenKey]?.menuItems ?? []) !== oldMenu
  || JSON.stringify(current["orange-hotel-breakfast-allocations"] ?? null) !== oldBreakfast
  || JSON.stringify(current["orange-hotel-main-store-items"] ?? null) !== oldStock) {
  throw new Error(`Reset verification failed. Backup: ${backupPath}`);
}
console.log(`Kitchen sales reset verified. Backup: ${backupPath}`);
