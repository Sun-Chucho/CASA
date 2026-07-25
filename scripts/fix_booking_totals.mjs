const CASHIER_STATE_URL =
  "https://the-orange-hotel-database-default-rtdb.firebaseio.com/orangeHotel/storage/orange-hotel-cashier-state.json";

const USD_TO_TSH_RATE = 2500;

const explicitTotals = new Map([
  ["#11", 400000],
  ["#21", 150000],
  ["#22", 150000],
  ["#23", 150000],
  ["#24", 150000],
  ["#25", 150000],
  ["#26", 150000],
  ["#27", 150000],
  ["#28", 150000],
  ["#41", 150000],
  ["#42", 150000],
  ["#43", 150000],
  ["#44", 150000],
  ["#51", 450000],
  ["#52", 450000],
  ["#53", 450000],
  ["#54", 300000],
]);

function normalizeReceiptNo(value) {
  return typeof value === "string" ? value.trim() : "";
}

function roundAmount(value) {
  return Math.round(Number(value) || 0);
}

const response = await fetch(CASHIER_STATE_URL);
if (!response.ok) {
  throw new Error(`Failed to fetch cashier state: ${response.status}`);
}

const snapshot = await response.json();
if (!snapshot || !Array.isArray(snapshot.transactions)) {
  throw new Error("Cashier state did not contain a transactions array.");
}

const updatedTransactions = snapshot.transactions.map((tx) => {
  const receiptNo = normalizeReceiptNo(tx.receiptNo);
  const next = { ...tx };

  if (next.currency === "$") {
    next.currency = "TSh";
    next.ratePerNight = roundAmount((next.ratePerNight ?? 0) * USD_TO_TSH_RATE);
    next.total = roundAmount((next.total ?? 0) * USD_TO_TSH_RATE);
  }

  const explicitTotal = explicitTotals.get(receiptNo);
  if (explicitTotal !== undefined) {
    next.currency = "TSh";
    next.total = explicitTotal;
    if (typeof next.nights === "number" && next.nights > 0) {
      next.ratePerNight = roundAmount(explicitTotal / next.nights);
    }
  }

  return next;
});

const putResponse = await fetch(CASHIER_STATE_URL, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ...snapshot,
    transactions: updatedTransactions,
  }),
});

if (!putResponse.ok) {
  throw new Error(`Failed to update cashier state: ${putResponse.status}`);
}

const touchedReceipts = updatedTransactions
  .filter((tx) => explicitTotals.has(normalizeReceiptNo(tx.receiptNo)) || tx.receiptNo === "#51" || tx.receiptNo === "#52" || tx.receiptNo === "#53" || tx.receiptNo === "#54")
  .map((tx) => ({
    receiptNo: tx.receiptNo,
    currency: tx.currency,
    nights: tx.nights,
    ratePerNight: tx.ratePerNight,
    total: tx.total,
  }));

console.log(
  JSON.stringify(
    {
      ok: true,
      updatedCount: touchedReceipts.length,
      touchedReceipts,
    },
    null,
    2,
  ),
);
