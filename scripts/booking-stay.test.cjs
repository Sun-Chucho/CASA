const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync("src/app/lib/booking-stay.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleValue = { exports: {} };
new Function("module", "exports", compiled)(moduleValue, moduleValue.exports);
const { bookingChargeDays } = moduleValue.exports;

test("a same-day stay with a later checkout charges one day", () => {
  assert.equal(bookingChargeDays("2026-11-10", "08:00", "2026-11-10", "17:00"), 1);
});

test("a same-day checkout must be after check-in", () => {
  assert.equal(bookingChargeDays("2026-11-10", "08:00", "2026-11-10", "08:00"), 0);
  assert.equal(bookingChargeDays("2026-11-10", "17:00", "2026-11-10", "08:00"), 0);
});

test("overnight stays retain the calendar-day charge", () => {
  assert.equal(bookingChargeDays("2026-11-10", "14:00", "2026-11-11", "12:00"), 1);
  assert.equal(bookingChargeDays("2026-12-31", "14:00", "2027-01-02", "12:00"), 2);
});
