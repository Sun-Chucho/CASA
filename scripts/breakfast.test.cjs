const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync("src/app/lib/breakfast.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleRef = { exports: {} };
new Function("module", "exports", compiled)(moduleRef, moduleRef.exports);
const { bookingOccupiesDate, breakfastForBooking, roomRevenue } = moduleRef.exports;

test("paid room revenue is reclassified without changing the room payment", () => {
  const booking = { id: "stay-1", total: 50000, status: "completed" };
  const records = [{ bookingId: "stay-1", count: 2 }, { bookingId: "stay-2", count: 1 }];
  assert.equal(breakfastForBooking("stay-1", records), 10000);
  assert.equal(roomRevenue(booking, records), 40000);
  assert.equal(booking.total, 50000);
  assert.equal(roomRevenue(booking, []), 50000);
  assert.equal(roomRevenue({ ...booking, status: "credit" }, records), 50000);
});

test("breakfast room list follows the stay and checkout time", () => {
  process.env.TZ = "Africa/Nairobi";
  const booking = { id: "stay-1", roomNumber: "101", checkInDate: "2026-11-09", checkInTime: "14:00", checkOutDate: "2026-11-11", checkOutTime: "11:00", total: 50000 };
  assert.equal(bookingOccupiesDate(booking, "2026-11-09"), false);
  assert.equal(bookingOccupiesDate(booking, "2026-11-10"), true);
  assert.equal(bookingOccupiesDate(booking, "2026-11-11"), true);
  assert.equal(bookingOccupiesDate(booking, "2026-11-12"), false);
  assert.equal(bookingOccupiesDate({ ...booking, status: "checked-out", checkedOutAt: Date.parse("2026-11-10T08:00:00+03:00") }, "2026-11-10"), false);
});
