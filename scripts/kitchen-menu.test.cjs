const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync("src/app/lib/kitchen-menu.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleRef = { exports: {} };
new Function("module", "exports", compiled)(moduleRef, moduleRef.exports);
const { DEFAULT_KITCHEN_MENU, mergeKitchenMenuItems } = moduleRef.exports;
const byName = new Map(DEFAULT_KITCHEN_MENU.map((item) => [item.name, item]));

const reducedPrices = {
  "Kuku Paka": 20000, "Beef Stew": 15000, "Roasted Beef": 15000,
  "Roasted Lamb": 20000, "Beef Fillet": 20000, "Grilled Chicken": 15000,
  "Fish Fillet": 25000, "Coconut Tilapia": 25000, "Grilled Fish Skewers": 20000,
  "Pepper Steak": 20000, "Chicken Schnitzel": 15000,
  "Chicken Burger": 15000, "Beef Burger": 15000,
  "Chicken Crisp Sandwich": 15000, "Chicken Sandwich": 15000,
  "Chicken Wings (6 pieces)": 15000, "Chicken Tikka Masala": 25000,
  "Chicken Makhan": 25000, "Dal Makhan": 20000,
  "Mutton Rogan Josh": 20000, "Chicken Biryani": 25000,
  "Vegetable Biryani": 20000,
};

const addedPrices = {
  "Chicken Broiler Fried": 15000, "Fish Sato Fried": 25000,
  "Fish Makange": 25000, "Chicken Makange": 15000,
  "Beef Makange": 15000, "Fish Changu Fried": 30000,
  "Fish Changu Makange": 30000, "Spaghetti Bolognese": 20000,
  "Fish Sato Clear Soup": 25000, "Fish Changu Clear Soup": 30000,
  "Chicken Broiler Clear Soup": 15000, "Local Chicken Clear Soup": 20000,
  "Local Chicken Fried": 20000, "Local Chicken Makange": 20000,
};

test("requested prices and new dishes are present while salads retain their prices", () => {
  for (const [name, price] of Object.entries({ ...reducedPrices, ...addedPrices })) {
    assert.equal(byName.get(name)?.price, price, name);
  }
  assert.equal(byName.get("Vegetable Salad").price, 15000);
  assert.equal(byName.get("Avocado Salad").price, 12000);
  assert.equal(byName.get("Chicken Club Sandwich").price, 20000);
});

test("saved old catalog prices migrate once without overwriting manager edits", () => {
  const oldKukuPaka = { ...byName.get("Kuku Paka"), price: 25000 };
  const editedBeefStew = { ...byName.get("Beef Stew"), price: 22000, updatedAt: 1000 };
  const oldSalad = { ...byName.get("Vegetable Salad") };
  const merged = mergeKitchenMenuItems([oldKukuPaka, editedBeefStew, oldSalad]);
  const menu = new Map(merged.map((item) => [item.name, item]));
  assert.equal(menu.get("Kuku Paka").price, 20000);
  assert.ok(menu.get("Kuku Paka").updatedAt > 0);
  assert.equal(menu.get("Beef Stew").price, 22000);
  assert.equal(menu.get("Vegetable Salad").price, 15000);
  assert.equal(menu.get("Fish Sato Fried").price, 25000);
  assert.deepEqual(mergeKitchenMenuItems(merged), merged);
});
