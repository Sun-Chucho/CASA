import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");
const DATE = "2026-11-10";
const KITCHEN_KEY = "orange-hotel-kitchen-state";
const EXPENSES_KEY = "orange-hotel-expenses";
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
const state = root[KITCHEN_KEY];
const expenses = root[EXPENSES_KEY] ?? [];
if (!state || !Array.isArray(state.payments) || !Array.isArray(state.tickets) || !Array.isArray(expenses)) {
  throw new Error("Kitchen or expense data has an unexpected shape.");
}
const localDay = (timestamp) => Number.isFinite(timestamp)
  ? new Date(timestamp + 3 * 3600000).toISOString().slice(0, 10) : "";
const payments = state.payments.filter((record) => localDay(record.createdAt) === DATE);
const tickets = state.tickets.filter((record) => localDay(record.createdAt) === DATE);
const expectedCodes = Array.from({ length: 8 }, (_, index) => `K-${index + 1}`);
if (payments.length !== 8 || tickets.length !== 8
  || expectedCodes.some((code) => !payments.some((record) => record.code === code)
    || !tickets.some((record) => record.code === code))) {
  throw new Error(`Kitchen records changed since the audit: ${payments.length} payments and ${tickets.length} tickets. Re-audit before deletion.`);
}
if (payments.some((payment) => !tickets.some((ticket) => ticket.id === payment.ticketId && ticket.code === payment.code))) {
  throw new Error("A kitchen payment lacks a matching ticket.");
}
console.log(JSON.stringify({ date: DATE, kitchenPayments: payments.length,
  kitchenTickets: tickets.length, kitchenSalesTotal: payments.reduce((sum, record) => sum + record.total, 0),
  expensesToClear: expenses.length, expensesTotal: expenses.reduce((sum, record) => sum + (record.amount ?? 0), 0) }));
if (!process.argv.includes("--apply")) {
  console.log("Dry run only. Pass --apply to commit the guarded correction.");
  process.exit(0);
}
const backupPath = path.join(os.homedir(), "Downloads", `casa-kitchen-nov10-expenses-before-${Date.now()}.json`);
fs.writeFileSync(backupPath, JSON.stringify(root));
const paymentIds = new Set(payments.map((record) => record.id));
const ticketIds = new Set(tickets.map((record) => record.id));
root[KITCHEN_KEY] = {
  ...state,
  payments: state.payments.filter((record) => !paymentIds.has(record.id)),
  tickets: state.tickets.filter((record) => !ticketIds.has(record.id)),
  voidedPaymentIds: [...new Set([...(state.voidedPaymentIds ?? []), ...paymentIds])],
  voidedTicketIds: [...new Set([...(state.voidedTicketIds ?? []), ...ticketIds])],
};
root[EXPENSES_KEY] = null;
const write = await fetch(url, {
  method: "PUT", headers: { "Content-Type": "application/json", "if-match": etag }, body: JSON.stringify(root),
});
if (!write.ok) throw new Error(`Guarded write failed: ${write.status}. No correction applied. Backup: ${backupPath}`);
const verify = await fetch(url);
if (!verify.ok) throw new Error(`Verification read failed: ${verify.status}`);
const current = await verify.json();
const remainingPayments = (current[KITCHEN_KEY]?.payments ?? []).filter((record) => localDay(record.createdAt) === DATE);
const remainingTickets = (current[KITCHEN_KEY]?.tickets ?? []).filter((record) => localDay(record.createdAt) === DATE);
const remainingExpenses = current[EXPENSES_KEY] ?? [];
if (remainingPayments.length || remainingTickets.length || remainingExpenses.length) {
  throw new Error("Verification found remaining kitchen or expense records.");
}
console.log(`Verified: zero kitchen payments and tickets for ${DATE}, zero expenses. Backup: ${backupPath}`);
