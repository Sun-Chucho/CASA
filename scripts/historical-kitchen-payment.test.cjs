const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync("src/app/lib/casa-history.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleRef = { exports: {} };
new Function("module", "exports", "require", compiled)(moduleRef, moduleRef.exports, () => ({ normalizeExpenseRecords: (value) => value }));
const { sanitizeCasaHistory } = moduleRef.exports;

const payment = {
  id: "kp-history-1793101935061",
  ticketId: "historical-1793101935061",
  code: "K-H-302",
  createdAt: 1792918800000,
  destination: "Historical Kitchen Payment",
  total: 20000,
  status: "completed",
  method: "cash",
  historical: true,
  lines: [
    { name: "Chicken Lollipops (6 pieces)", qty: 1 },
    { name: "Chips", qty: 1 },
  ],
};

test("removes only the Chips line and its TSh 5,000 from the exact historical payment", () => {
  const other = { ...payment, id: "another-payment" };
  const state = { tickets: [], ticketSeq: 302, payments: [payment, other], menuItems: [] };
  const cleaned = sanitizeCasaHistory("orange-hotel-kitchen-state", state);
  assert.deepEqual(cleaned.payments[0].lines, [{ name: "Chicken Lollipops (6 pieces)", qty: 1 }]);
  assert.equal(cleaned.payments[0].total, 15000);
  assert.equal(cleaned.payments[0].code, "K-H-302");
  assert.equal(cleaned.payments[0].method, "cash");
  assert.equal(cleaned.payments[0].status, "completed");
  assert.deepEqual(cleaned.payments[1], other);
  assert.deepEqual(sanitizeCasaHistory("orange-hotel-kitchen-state", cleaned), cleaned);
  assert.deepEqual(sanitizeCasaHistory("orange-hotel-kitchen-payments", [payment])[0], cleaned.payments[0]);
});
