const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync("src/app/lib/bar-sale-date.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleValue = { exports: {} };
new Function("module", "exports", compiled)(moduleValue, moduleValue.exports);
const { barSaleBusinessDate } = moduleValue.exports;

test("past sales keep the selected business date", () => {
  assert.equal(barSaleBusinessDate({ createdAt: Date.parse("2026-11-10T23:00:00Z"), businessDate: "2026-11-09" }), "2026-11-09");
});

test("ordinary sales use the East Africa date across midnight", () => {
  assert.equal(barSaleBusinessDate({ createdAt: Date.parse("2026-11-10T22:30:00Z") }), "2026-11-11");
});
