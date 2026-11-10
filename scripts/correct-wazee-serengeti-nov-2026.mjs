// One-time correction for the Wazee discount and the accidental BH-491 stock tap.
// Dry run by default. Pass --apply to back up and update the live Firebase root.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");
const source = fs.readFileSync(new URL("../src/app/lib/firebase.ts", import.meta.url), "utf8");
const apiKey = source.match(/AIza[A-Za-z0-9_-]+/)?.[0];
if (!apiKey) throw new Error("Firebase API key was not found.");
const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
});
if (!auth.ok) throw new Error(`Firebase authentication failed: ${auth.status}`);
const { idToken } = await auth.json();
const url = `https://casamotel-96c86-default-rtdb.firebaseio.com/casa-v2.json?auth=${encodeURIComponent(idToken)}`;
const read = await fetch(url, { headers: { "X-Firebase-ETag": "true" } });
if (!read.ok) throw new Error(`Firebase read failed: ${read.status}`);
const etag = read.headers.get("etag");
if (!etag) throw new Error("Firebase did not return an ETag.");
const original = await read.json();
const cashier = original["orange-hotel-cashier-state"];
const bar = original["orange-hotel-barista-state"];
const stores = original["orange-hotel-main-store-items"];
const inventory = original["orange-hotel-inventory-items"];
const booking = cashier?.transactions?.find((entry) => entry.id === "tx-1794325018267");
const store = stores?.find((entry) => entry.id === "nov-2026-bar-11");
const item = inventory?.find((entry) => entry.id === "nov-2026-inv-11");
if (process.argv.includes("--verify")) {
  if (booking?.total !== 400000 || booking?.discountPercent !== 50 || booking?.ratePerNight !== 100000 || store?.stock !== 26 || item?.stock !== 26 || (bar?.payments ?? []).some((payment) => /^B-?H-?491$/i.test(payment.code ?? ""))) throw new Error("Live correction verification failed.");
  console.log("Verified: Wazee TSh 400,000 at 50% discount; Serengeti small 26 in both ledgers; no BH-491 cloud sale.");
  process.exit(0);
}
if (!booking || booking.guestName?.trim().toLowerCase() !== "wazee" || booking.total !== 800000 || booking.nights !== 8 || booking.ratePerNight !== 100000 || booking.discountPercent) throw new Error("Wazee booking differs from the audited record; no changes made.");
if (!store || !item || !/SERENGETI.*SMALL/i.test(store.name) || !/SERENGETI.*SMALL/i.test(item.name) || store.stock !== item.stock || store.totSold || item.totSold) throw new Error("Serengeti small stock differs across ledgers; no changes made.");
const matches = (bar?.payments ?? []).filter((payment) => /^B-?H-?491$/i.test(payment.code ?? ""));
if (matches.length > 1 || matches.some((payment) => payment.lines?.length !== 1 || !/SERENGETI.*SMALL/i.test(payment.lines[0]?.name ?? "") || payment.lines[0]?.qty !== 1)) throw new Error("BH-491 has unexpected sale lines; no changes made.");
console.log(`Wazee: TSh ${booking.total.toLocaleString()} -> 400,000. Serengeti small: ${store.stock} -> ${store.stock + 1}. BH-491 cloud payments found: ${matches.length}.`);
if (!process.argv.includes("--apply")) process.exit(0);

const backup = path.join(os.homedir(), "Downloads", `CASSA-before-wazee-BH491-correction-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(backup, JSON.stringify(original));
const updatedAt = Date.now();
const next = {
  ...original,
  "orange-hotel-cashier-state": {
    ...cashier,
    transactions: cashier.transactions.map((entry) => entry.id === booking.id
      ? { ...entry, total: 400000, discountPercent: 50, extensionAmount: entry.extensionAmount == null ? undefined : entry.extensionAmount / 2, updatedAt }
      : entry),
  },
  "orange-hotel-barista-state": {
    ...bar,
    payments: (bar?.payments ?? []).filter((payment) => !matches.some((match) => match.id === payment.id)),
    tickets: (bar?.tickets ?? []).filter((ticket) => !matches.some((match) => match.ticketId === ticket.id)),
  },
  "orange-hotel-main-store-items": stores.map((entry) => entry.id === store.id ? { ...entry, stock: entry.stock + 1, updatedAt } : entry),
  "orange-hotel-inventory-items": inventory.map((entry) => entry.id === item.id ? { ...entry, stock: entry.stock + 1, updatedAt } : entry),
};
const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(next) });
if (!put.ok) throw new Error(`Firebase correction failed: ${put.status}. Backup: ${backup}`);
const saved = await put.json();
if (saved["orange-hotel-cashier-state"]?.transactions?.find((entry) => entry.id === booking.id)?.total !== 400000 || saved["orange-hotel-main-store-items"]?.find((entry) => entry.id === store.id)?.stock !== store.stock + 1 || saved["orange-hotel-inventory-items"]?.find((entry) => entry.id === item.id)?.stock !== item.stock + 1) throw new Error(`Post-write verification failed. Backup: ${backup}`);
console.log(`Correction verified. Backup: ${backup}`);
