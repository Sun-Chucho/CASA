const CASHIER_STATE_URL =
  "https://the-orange-hotel-database-default-rtdb.firebaseio.com/orangeHotel/storage/orange-hotel-cashier-state.json";

const paymentUpdates = new Map([
  [
    "#209",
    {
      roomNumber: "2001",
      payment: "cash",
      paymentBreakdown: undefined,
    },
  ],
  [
    "#208",
    {
      roomNumber: "2002",
      payment: "card",
      paymentBreakdown: [
        { method: "cash", nights: 1, amount: 70000 },
        { method: "card", nights: 2, amount: 140000 },
      ],
    },
  ],
  [
    "#204",
    {
      roomNumber: "5002",
      payment: "card",
      paymentBreakdown: undefined,
    },
  ],
]);

function normalizeReceiptNo(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const match = trimmed.match(/^#0*(\d+)$/);
  return match ? `#${match[1]}` : trimmed;
}

function normalizeRoomNumber(value) {
  return typeof value === "string" ? value.trim() : "";
}

const response = await fetch(CASHIER_STATE_URL);
if (!response.ok) {
  throw new Error(`Failed to fetch cashier state: ${response.status}`);
}

const snapshot = await response.json();
if (!snapshot || !Array.isArray(snapshot.transactions)) {
  throw new Error("Cashier state did not contain a transactions array.");
}

const touched = [];
const foundReceipts = new Set();

const updatedTransactions = snapshot.transactions.map((tx) => {
  const receiptNo = normalizeReceiptNo(tx.receiptNo);
  const update = paymentUpdates.get(receiptNo);

  if (!update) return tx;
  foundReceipts.add(receiptNo);

  if (normalizeRoomNumber(tx.roomNumber) !== update.roomNumber) {
    throw new Error(
      `Receipt ${receiptNo} was expected to be room ${update.roomNumber}, found room ${tx.roomNumber}.`,
    );
  }

  const next = {
    ...tx,
    payment: update.payment,
  };

  if (update.paymentBreakdown) {
    next.paymentBreakdown = update.paymentBreakdown;
  } else {
    delete next.paymentBreakdown;
  }

  touched.push({
    receiptNo,
    roomNumber: next.roomNumber,
    payment: next.payment,
    paymentBreakdown: next.paymentBreakdown ?? null,
  });

  return next;
});

for (const receiptNo of paymentUpdates.keys()) {
  if (!foundReceipts.has(receiptNo)) {
    throw new Error(`Receipt ${receiptNo} was not found in cashier state.`);
  }
}

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

console.log(
  JSON.stringify(
    {
      ok: true,
      updatedCount: touched.length,
      touched,
    },
    null,
    2,
  ),
);
