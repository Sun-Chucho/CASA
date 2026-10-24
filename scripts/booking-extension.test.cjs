const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

function loadTypeScript(source) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", compiled)(module, module.exports);
  return module.exports;
}

const mergeSource = fs.readFileSync("src/app/lib/cashier-booking-merge.ts", "utf8");
const { chooseCashierBookingRecord } = loadTypeScript(mergeSource);

test("a paid booking extended on credit keeps the new departure date after sync", () => {
  const oldBooking = { status: "completed", createdAt: 1000, updatedAt: 2000, checkOutDate: "2026-10-24", total: 50000 };
  const extended = { ...oldBooking, status: "credit", updatedAt: 3000, lastExtendedAt: 3000, checkOutDate: "2026-10-25", total: 100000 };
  assert.equal(chooseCashierBookingRecord(oldBooking, extended), extended);
  assert.equal(chooseCashierBookingRecord(extended, oldBooking), extended);
});

test("a later payment edit preserves an earlier extension", () => {
  const extended = { status: "credit", createdAt: 1000, updatedAt: 3000, lastExtendedAt: 3000, checkOutDate: "2026-10-25", nights: 2, total: 100000 };
  const paymentEdit = { status: "completed", createdAt: 1000, updatedAt: 4000, paymentMethodEditedAt: 4000, checkOutDate: "2026-10-24", nights: 1, total: 50000 };
  for (const merged of [chooseCashierBookingRecord(extended, paymentEdit), chooseCashierBookingRecord(paymentEdit, extended)]) {
    assert.equal(merged.status, "completed");
    assert.equal(merged.checkOutDate, "2026-10-25");
    assert.equal(merged.nights, 2);
    assert.equal(merged.total, 100000);
  }
});

test("a stale active booking cannot reopen a checked-out room", () => {
  const active = { status: "completed", updatedAt: 3000 };
  const checkedOut = { status: "checked-out", updatedAt: 4000 };
  assert.equal(chooseCashierBookingRecord(active, checkedOut), checkedOut);
  assert.equal(chooseCashierBookingRecord(checkedOut, active), checkedOut);
});

test("the next checkout day is correct in Nairobi and across a year boundary", () => {
  process.env.TZ = "Africa/Nairobi";
  const pageSource = fs.readFileSync("src/app/dashboard/cashier/page.tsx", "utf8");
  const functionSource = pageSource.match(/function addDays\(dateText: string, days: number\): string \{[\s\S]*?\n\}/)?.[0];
  assert.ok(functionSource);
  const addDays = loadTypeScript(`${functionSource}\nmodule.exports = addDays;`);
  assert.equal(addDays("2026-10-24", 1), "2026-10-25");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
