const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync("src/app/lib/barista-stock.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleRef = { exports: {} };
new Function("module", "exports", compiled)(moduleRef, moduleRef.exports);
const { adjustSignedTotBalance, getRemainingTots, getMenuStockStatus } = moduleRef.exports;

test("tot sales below zero remain owed until enough bottles are restocked", () => {
  const sold = adjustSignedTotBalance(0, 0, 30, -31);
  assert.deepEqual(sold, { stock: -1, totSold: 1 });
  assert.equal(getRemainingTots({ name: "Spirit (TOTS)", size: "", totLimit: 30, ...sold }), -31);
  const oneBottle = { ...sold, stock: sold.stock + 1 };
  assert.equal(getRemainingTots({ name: "Spirit (TOTS)", size: "", totLimit: 30, ...oneBottle }), -1);
  const twoBottles = { ...sold, stock: sold.stock + 2 };
  assert.equal(getRemainingTots({ name: "Spirit (TOTS)", size: "", totLimit: 30, ...twoBottles }), 29);
  assert.deepEqual(adjustSignedTotBalance(sold.stock, sold.totSold, 30, 31), { stock: 0, totSold: 0 });
});

test("zero and negative balances remain sellable and show the debt", () => {
  const unit = { id: "beer", name: "Beer", size: "", unit: "bottles", stock: -3, minStock: 0, lane: "barista" };
  assert.deepEqual(getMenuStockStatus([unit], "Beer"), { available: true, label: "3 bottles owed" });
  assert.equal(getMenuStockStatus([{ ...unit, stock: 0 }], "Beer").available, true);
  const tots = { ...unit, id: "spirit", name: "Spirit (TOTS)", stock: 0, totLimit: 30, totSold: 2 };
  assert.deepEqual(getMenuStockStatus([tots], "Spirit (TOTS)"), { available: true, label: "2 tots owed" });
});
