// Inspect the November 12 bar sales. With --apply, change only the audited
// batch's business date to November 11 after writing a complete live backup.
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
if (!response.ok || !response.headers.get("etag")) throw new Error(`Read failed: ${response.status}`);
const etag = response.headers.get("etag");
const root = await response.json();
const key = "orange-hotel-barista-state";
const state = root?.[key];
if (!Array.isArray(state?.payments)) throw new Error("Barista payments missing or invalid.");
const businessDate = (sale) => sale.businessDate || (Number.isFinite(sale.createdAt)
  ? new Date(sale.createdAt + 3 * 3600000).toISOString().slice(0, 10) : "");
const target = state.payments.filter((sale) => businessDate(sale) === "2026-11-12");
const expectedCodes = new Set(Array.from({ length: 13 }, (_, index) => `B-${638 + index}`));
if (process.argv.includes("--verify")) {
  const moved = state.payments.filter((sale) => expectedCodes.has(sale.code));
  const verified = { sales: moved.length,
    items: moved.reduce((sum, sale) => sum + (sale.lines?.reduce((count, line) => count + Number(line.qty || 0), 0) ?? 1), 0),
    paid: moved.filter((sale) => sale.status !== "credit").reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    credit: moved.filter((sale) => sale.status === "credit").reduce((sum, sale) => sum + Number(sale.total || 0), 0),
  };
  if (verified.sales !== 13 || verified.items !== 40 || verified.paid !== 119500 || verified.credit !== 0
    || moved.some((sale) => businessDate(sale) !== "2026-11-11")
    || target.some((sale) => expectedCodes.has(sale.code))) throw new Error("Barista date correction is not intact.");
  console.log(JSON.stringify({ businessDate: "2026-11-11", ...verified, november12MovedReceipts: 0 }));
  process.exit(0);
}
const summary = {
  sales: target.length,
  items: target.reduce((sum, sale) => sum + (sale.lines?.reduce((count, line) => count + Number(line.qty || 0), 0) ?? 1), 0),
  paid: target.filter((sale) => sale.status !== "credit").reduce((sum, sale) => sum + Number(sale.total || 0), 0),
  credit: target.filter((sale) => sale.status === "credit").reduce((sum, sale) => sum + Number(sale.total || 0), 0),
  records: target.map((sale) => ({ code: sale.code, historical: sale.historical, businessDate: sale.businessDate,
    createdAt: new Date(sale.createdAt).toISOString(), recordedAt: sale.recordedAt ? new Date(sale.recordedAt).toISOString() : null })),
};
console.log(JSON.stringify(summary, null, 2));
if (!process.argv.includes("--apply")) process.exit(0);
if (summary.sales !== 13 || summary.items !== 40 || summary.paid !== 119500 || summary.credit !== 0
  || target.some((sale) => !expectedCodes.has(sale.code) || sale.historical === true
    || sale.businessDate !== "2026-11-12" || !sale.id)
  || new Set(target.map((sale) => sale.code)).size !== expectedCodes.size) {
  throw new Error("The live records do not match receipts B-638 through B-650; no changes were saved.");
}
const ids = new Set(target.map((sale) => sale.id));
if (ids.size !== target.length) throw new Error("Duplicate payment IDs; no changes were saved.");
const backup = path.join(os.homedir(), "Downloads", `CASSA-before-bar-date-correction-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(backup, JSON.stringify(root));
const correctedAt = Date.now();
const next = { ...root, [key]: { ...state,
  payments: state.payments.map((sale) => ids.has(sale.id)
    ? { ...sale, businessDate: "2026-11-11", updatedAt: correctedAt }
    : sale),
} };
const write = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(next) });
if (!write.ok) throw new Error(`Conditional write failed (${write.status}); no data changed. Backup: ${backup}`);
const check = await fetch(url);
if (!check.ok) throw new Error(`Verification read failed (${check.status}). Backup: ${backup}`);
const saved = await check.json();
const changed = (saved[key]?.payments ?? []).filter((sale) => ids.has(sale.id));
if (changed.length !== 13 || changed.some((sale) => businessDate(sale) !== "2026-11-11"
  || sale.createdAt !== target.find((old) => old.id === sale.id)?.createdAt || sale.updatedAt !== correctedAt)) {
  throw new Error(`Date correction verification failed. Backup: ${backup}`);
}
console.log(`Verified: 13 sales moved to 2026-11-11. Backup: ${backup}`);
