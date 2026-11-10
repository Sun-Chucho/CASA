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

const cashier = original["orange-hotel-cashier-state"];
const kitchen = original["orange-hotel-kitchen-state"];
const rooms = original["orange-hotel-rooms-state"];
if (!cashier || !kitchen || !Array.isArray(rooms)) throw new Error("Cashier, kitchen, or room records are missing; refusing to reset.");
const next = structuredClone(original);
next["orange-hotel-cashier-state"] = { transactions: [], receiptSeq: 0 };
next["orange-hotel-kitchen-state"] = { ...kitchen, tickets: [], ticketSeq: 0, payments: [] };
next["orange-hotel-rooms-state"] = rooms.map((room) => room.status === "occupied" ? { ...room, status: "available" } : room);
for (const key of [
  "orange-hotel-breakfast-allocations", "orange-hotel-website-bookings",
  "orange-hotel-cashier-transactions", "orange-hotel-cashier-seq",
  "orange-hotel-kitchen-tickets", "orange-hotel-kitchen-seq", "orange-hotel-kitchen-payments", "orange-hotel-kitchen-menu",
]) delete next[key];
if (Array.isArray(next["orange-hotel-cancelled-tickets"])) next["orange-hotel-cancelled-tickets"] = next["orange-hotel-cancelled-tickets"].filter((item) => item?.source !== "kitchen");
if (Array.isArray(next["orange-hotel-fnb-stock-sales"])) next["orange-hotel-fnb-stock-sales"] = next["orange-hotel-fnb-stock-sales"].filter((item) => item?.department !== "kitchen");

console.log(`Clearing ${(cashier.transactions ?? []).length} bookings, ${(kitchen.tickets ?? []).length} kitchen tickets, ${(kitchen.payments ?? []).length} kitchen payments, and ${(original["orange-hotel-breakfast-allocations"] ?? []).length} breakfast allocations.`);
console.log(`Releasing ${rooms.filter((room) => room.status === "occupied").length} occupied rooms; retaining ${kitchen.menuItems?.length ?? 0} kitchen menu items.`);
if (!process.argv.includes("--apply")) { console.log("Dry run only. Pass --apply to back up and reset Firebase."); process.exit(0); }

const backup = path.join(os.homedir(), "Downloads", `CASSA-before-bookings-kitchen-reset-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(backup, JSON.stringify(original));
const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(next) });
if (!put.ok) throw new Error(`Firebase reset failed: ${put.status}. Backup: ${backup}`);
const saved = await put.json();
if ((saved["orange-hotel-cashier-state"]?.transactions ?? []).length || saved["orange-hotel-cashier-state"]?.receiptSeq !== 0 || (saved["orange-hotel-kitchen-state"]?.tickets ?? []).length || (saved["orange-hotel-kitchen-state"]?.payments ?? []).length || saved["orange-hotel-kitchen-state"]?.ticketSeq !== 0 || saved["orange-hotel-rooms-state"]?.some((room) => room.status === "occupied")) throw new Error(`Post-write verification failed. Backup: ${backup}`);
console.log(`Reset verified. Backup: ${backup}`);
