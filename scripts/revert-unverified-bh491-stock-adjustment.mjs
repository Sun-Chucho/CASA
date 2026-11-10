// Undo only the speculative one-unit adjustment. BH-491 must be reversed from
// its actual BarPOS sale record after that record has been identified.
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
const stores = original["orange-hotel-main-store-items"];
const inventory = original["orange-hotel-inventory-items"];
const store = stores?.find((entry) => entry.id === "nov-2026-bar-11");
const item = inventory?.find((entry) => entry.id === "nov-2026-inv-11");
const payments = original["orange-hotel-barista-state"]?.payments ?? [];
if (!store || !item || store.stock !== 26 || item.stock !== 26 || !/SERENGETI.*SMALL/i.test(store.name) || !/SERENGETI.*SMALL/i.test(item.name)) throw new Error("Stock changed since the speculative correction. No changes made.");
if (payments.some((payment) => /^B-?H-?491$/i.test(payment.code ?? ""))) throw new Error("BH-491 is now in cloud sales. Reverse the sale itself instead.");
console.log("Undo speculative adjustment: Serengeti small 26 -> 25 in both ledgers. Wazee discount stays intact.");
if (!process.argv.includes("--apply")) process.exit(0);
const backup = path.join(os.homedir(), "Downloads", `CASSA-before-BH491-stock-only-reversal-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(backup, JSON.stringify(original));
const updatedAt = Date.now();
const next = {
  ...original,
  "orange-hotel-main-store-items": stores.map((entry) => entry.id === store.id ? { ...entry, stock: 25, updatedAt } : entry),
  "orange-hotel-inventory-items": inventory.map((entry) => entry.id === item.id ? { ...entry, stock: 25, updatedAt } : entry),
};
const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(next) });
if (!put.ok) throw new Error(`Reversal failed: ${put.status}. Backup: ${backup}`);
const saved = await put.json();
if (saved["orange-hotel-main-store-items"]?.find((entry) => entry.id === store.id)?.stock !== 25 || saved["orange-hotel-inventory-items"]?.find((entry) => entry.id === item.id)?.stock !== 25 || saved["orange-hotel-cashier-state"]?.transactions?.find((entry) => entry.id === "tx-1794325018267")?.total !== 400000) throw new Error(`Post-write verification failed. Backup: ${backup}`);
console.log(`Stock-only adjustment undone. Backup: ${backup}`);
