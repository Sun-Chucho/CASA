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

test("breakfast shows every currently occupied room, including overstays and credit", () => {
  process.env.TZ = "Africa/Nairobi";
  const actualNow = Date.now;
  Date.now = () => Date.parse("2026-11-10T09:00:00+03:00");
  try {
    const booking = { id: "stay-1", roomNumber: "101", checkInDate: "2026-11-07", checkInTime: "14:00", checkOutDate: "2026-11-08", checkOutTime: "11:00", total: 50000 };
    assert.equal(bookingOccupiesDate(booking, "2026-11-10"), true);
    assert.equal(bookingOccupiesDate({ ...booking, status: "credit" }, "2026-11-10"), true);
    assert.equal(bookingOccupiesDate({ ...booking, status: "checked-out" }, "2026-11-10"), false);
    assert.equal(bookingOccupiesDate({ ...booking, checkInDate: "2026-11-10", checkInTime: "14:00" }, "2026-11-10"), true);
    assert.equal(bookingOccupiesDate(booking, "2026-11-11"), false);
  } finally {
    Date.now = actualNow;
  }
});

test("historical breakfast dates use the actual checkout date", () => {
  process.env.TZ = "Africa/Nairobi";
  const actualNow = Date.now;
  Date.now = () => Date.parse("2026-11-12T09:00:00+03:00");
  try {
    const booking = { id: "stay-2", roomNumber: "102", checkInDate: "2026-11-09", checkOutDate: "2026-11-10", checkedOutAt: Date.parse("2026-11-11T08:00:00+03:00"), status: "checked-out", total: 50000 };
    assert.equal(bookingOccupiesDate(booking, "2026-11-08"), false);
    assert.equal(bookingOccupiesDate(booking, "2026-11-10"), true);
    assert.equal(bookingOccupiesDate(booking, "2026-11-11"), true);
    assert.equal(bookingOccupiesDate(booking, "2026-11-12"), false);
  } finally {
    Date.now = actualNow;
  }
});
