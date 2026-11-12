// Restore verified November sales from the snapshot taken immediately before the reset.
// Dry run by default. --apply saves a live backup and uses conditional writes.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");
const backupName = "CASSA-before-bookings-kitchen-reset-2026-11-10T14-30-13-624Z.json";
const backupPath = path.join(os.homedir(), "Downloads", backupName);
const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
const originalKitchen = backup["orange-hotel-kitchen-state"];
const originalBreakfast = backup["orange-hotel-breakfast-allocations"];
if (!Array.isArray(originalKitchen?.payments) || !Array.isArray(originalKitchen?.tickets)
  || !Array.isArray(originalBreakfast)) throw new Error("Backup has an unexpected shape.");
const since = Date.parse("2026-11-01T00:00:00+03:00");
const sourcePayments = originalKitchen.payments.filter((row) => Number(row.createdAt) >= since);
const sourceTickets = originalKitchen.tickets.filter((row) => Number(row.createdAt) >= since);
const sourceBreakfast = originalBreakfast.filter((row) => row.date >= "2026-11-01");
if (sourcePayments.length !== 56 || sourceTickets.length !== 43 || sourceBreakfast.length !== 1) {
  throw new Error(`Unexpected backup counts: ${sourcePayments.length} payments, ${sourceTickets.length} tickets, ${sourceBreakfast.length} breakfast allocations.`);
}
const source = fs.readFileSync(new URL("../src/app/lib/firebase.ts", import.meta.url), "utf8");
const apiKey = source.match(/AIza[A-Za-z0-9_-]+/)?.[0];
if (!apiKey) throw new Error("Firebase API key unavailable.");
const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
});
if (!auth.ok) throw new Error(`Authentication failed: ${auth.status}`);
const { idToken } = await auth.json();
const urlFor = (key) => `https://casamotel-96c86-default-rtdb.firebaseio.com/casa-v2/${key}.json?auth=${encodeURIComponent(idToken)}`;
async function read(key) {
  const response = await fetch(urlFor(key), { headers: { "X-Firebase-ETag": "true" } });
  if (!response.ok || !response.headers.get("etag")) throw new Error(`Read failed for ${key}: ${response.status}`);
  return { value: await response.json(), etag: response.headers.get("etag") };
}
const kitchenKey = "orange-hotel-kitchen-state";
const breakfastKey = "orange-hotel-breakfast-allocations";
const kitchenBefore = await read(kitchenKey);
const breakfastBefore = await read(breakfastKey);
const kitchen = kitchenBefore.value;
const breakfast = breakfastBefore.value ?? [];
if (!kitchen || !Array.isArray(kitchen.payments) || !Array.isArray(kitchen.tickets)
  || !Array.isArray(breakfast)) throw new Error("Live records have an unexpected shape.");
const existingPayments = new Set(kitchen.payments.map((row) => row.id));
const voidedPayments = new Set(kitchen.voidedPaymentIds ?? []);
const voidedTickets = new Set(kitchen.voidedTicketIds ?? []);
const missingPayments = sourcePayments.filter((row) => !existingPayments.has(row.id) && !voidedPayments.has(row.id));
const missingPaymentTicketIds = new Set(missingPayments.map((row) => row.ticketId));
const existingTickets = new Set(kitchen.tickets.map((row) => row.id));
const missingTickets = sourceTickets.filter((row) => missingPaymentTicketIds.has(row.id)
  && !existingTickets.has(row.id) && !voidedTickets.has(row.id));
const existingBreakfast = new Set(breakfast.map((row) => row.id));
const missingBreakfast = sourceBreakfast.filter((row) => !existingBreakfast.has(row.id));
if (new Set(missingPayments.map((row) => row.id)).size !== missingPayments.length
  || new Set(missingBreakfast.map((row) => row.id)).size !== missingBreakfast.length) {
  throw new Error("Duplicate IDs in backup; refusing to restore.");
}
const summary = { kitchenPaymentsToRestore: missingPayments.length,
  kitchenTicketsToRestore: missingTickets.length, historicalPaymentsWithoutTickets: missingPayments.length - missingTickets.length,
  kitchenTotalToRestore: missingPayments.reduce((sum, row) => sum + Number(row.total || 0), 0),
  breakfastAllocationsToRestore: missingBreakfast.length,
  breakfastTotalToRestore: missingBreakfast.reduce((sum, row) => sum + Number(row.count || 0) * 5000, 0),
  intentionallyVoidedKitchenPaymentsSkipped: sourcePayments.filter((row) => voidedPayments.has(row.id)).length,
};
console.log(JSON.stringify(summary));
if (!process.argv.includes("--apply")) process.exit(0);

const savedBackup = path.join(os.homedir(), "Downloads", `CASSA-before-November-sales-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(savedBackup, JSON.stringify({ [kitchenKey]: kitchen, [breakfastKey]: breakfast }));
async function conditionalWrite(key, value, etag) {
  const response = await fetch(urlFor(key), { method: "PUT",
    headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(value) });
  if (!response.ok) throw new Error(`Conditional write failed for ${key}: ${response.status}. Backup: ${savedBackup}`);
}
if (missingPayments.length) {
  const maxCode = Math.max(0, ...[...kitchen.payments, ...missingPayments]
    .map((row) => Number(String(row.code).match(/^K-(?:H-)?(\d+)$/)?.[1]) || 0));
  await conditionalWrite(kitchenKey, { ...kitchen,
    payments: [...kitchen.payments, ...missingPayments].sort((a, b) => b.createdAt - a.createdAt),
    tickets: [...kitchen.tickets, ...missingTickets].sort((a, b) => b.createdAt - a.createdAt),
    ticketSeq: Math.max(Number(kitchen.ticketSeq) || 0, Number(originalKitchen.ticketSeq) || 0, maxCode),
  }, kitchenBefore.etag);
}
if (missingBreakfast.length) {
  await conditionalWrite(breakfastKey, [...breakfast, ...missingBreakfast], breakfastBefore.etag);
}
const verifiedKitchen = (await read(kitchenKey)).value;
const verifiedBreakfast = (await read(breakfastKey)).value ?? [];
if (missingPayments.some((row) => !verifiedKitchen.payments.some((saved) => saved.id === row.id))
  || missingTickets.some((row) => !verifiedKitchen.tickets.some((saved) => saved.id === row.id))
  || missingBreakfast.some((row) => !verifiedBreakfast.some((saved) => saved.id === row.id))) {
  throw new Error(`Restoration verification failed. Backup: ${savedBackup}`);
}
console.log(`Restoration verified. Backup: ${savedBackup}`);
