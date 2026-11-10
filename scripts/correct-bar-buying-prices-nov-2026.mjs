// Correct three missing buying prices without changing stock or sales.
// Run with --apply after the matching Firebase capital rule is deployed.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const catalog = JSON.parse(fs.readFileSync(new URL("../src/app/lib/bar-catalog.json", import.meta.url), "utf8"));
const corrections = new Map([
  ["SMINOFF GWARANA", { buyingPrice: 41000 / 25 }],
  ["PROVETO", { buyingPrice: 35000 }],
  ["EMBASSY CKLICK", { buyingPrice: 6500, unit: "Box" }],
]);
const capital = Math.round(catalog.reduce((sum, row) => sum + row.openingStock * row.buyingPrice / (row.soldByTot ? row.totLimit : 1), 0));
if (catalog.length !== 105 || capital !== 5083244 || [...corrections].some(([name, price]) => catalog.find((row) => row.name === name)?.buyingPrice !== price.buyingPrice)) throw new Error("Corrected catalog does not reconcile.");
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
const next = structuredClone(original);
const version = "cassa-bar-buying-prices-nov-2026-v1";
const updatedAt = Date.now();
for (const [key, predicate] of [
  ["orange-hotel-main-store-items", (item) => item.lane === "barista"],
  ["orange-hotel-inventory-items", (item) => item.category === "Bar"],
  ["orange-hotel-barista-state", null],
]) {
  const records = key === "orange-hotel-barista-state" ? next[key]?.menuItems : next[key];
  if (!Array.isArray(records)) throw new Error(`Missing ${key} records.`);
  for (const [name, correction] of corrections) {
    const matches = records.filter((item) => item.name === name && (!predicate || predicate(item)));
    if (matches.length !== 1) throw new Error(`Expected one ${name} in ${key}, found ${matches.length}.`);
    Object.assign(matches[0], correction, { updatedAt, priceCorrectionVersion: version });
  }
}
next["orange-hotel-barista-starting-capital-v1"] = {
  ...(original["orange-hotel-barista-starting-capital-v1"] ?? {}), amount: capital,
  version: "cassa-catalog-opening-capital-nov-2026-v2",
};
console.log(`Corrected opening capital: TSh ${capital.toLocaleString()}; restock history unchanged.`);
if (!process.argv.includes("--apply")) { console.log("Dry run only. Pass --apply to back up and update Firebase."); process.exit(0); }
const backup = path.join(os.homedir(), "Downloads", `CASSA-before-bar-price-correction-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(backup, JSON.stringify(original));
const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(next) });
if (!put.ok) throw new Error(`Firebase price correction failed: ${put.status}. Backup: ${backup}`);
const saved = await put.json();
if (saved["orange-hotel-barista-starting-capital-v1"]?.amount !== capital || [...corrections].some(([name, correction]) => saved["orange-hotel-main-store-items"].find((item) => item.lane === "barista" && item.name === name)?.buyingPrice !== correction.buyingPrice)) throw new Error(`Price verification failed. Backup: ${backup}`);
console.log(`Price correction verified. Backup: ${backup}`);
