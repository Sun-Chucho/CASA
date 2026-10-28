import { normalizeExpenseRecords } from "@/app/lib/expenses";

export const CASA_DATA_START_MS = Date.parse("2026-07-27T00:00:00+03:00");

const CASA_ROOM_PRICES: Record<string, number> = {
  "100": 100000,
  "101": 50000,
  "102": 50000,
  "103": 50000,
  "104": 50000,
  "105": 50000,
  "106": 50000,
  "107": 50000,
  "108": 100000,
  "109": 100000,
  "110": 100000,
  "111": 120000,
  "112": 60000,
  "113": 60000,
  "114": 60000,
  "115": 60000,
  "116": 60000,
  "117": 60000,
};

const FILTERED_HISTORY_ARRAY_KEYS = new Set([
  "orange-hotel-expenses",
  "orange-hotel-laundry-records",
  "orange-hotel-cancelled-tickets",
  "orange-hotel-barista-waste",
  "orange-hotel-menu-audit-trail",
  "orange-hotel-website-bookings",
  "orange-hotel-live-chat",
  "orange-hotel-store-movements",
  "orange-hotel-store-usage",
  "orange-hotel-kitchen-purchase-history",
  "orange-hotel-kitchen-daily-stock-history",
  "orange-hotel-barista-purchase-history",
  "orange-hotel-barista-daily-stock-history",
]);

const HISTORY_TIMESTAMP_FIELDS = [
  "createdAt",
  "startedAt",
  "closedAt",
  "movedAt",
  "usedAt",
  "changedAt",
  "recordedAt",
  "updatedAt",
  "timestamp",
  "date",
] as const;

function readHistoryTimestamp(record: unknown) {
  if (typeof record !== "object" || record === null) return null;

  for (const field of HISTORY_TIMESTAMP_FIELDS) {
    const rawValue = (record as Record<string, unknown>)[field];
    if (rawValue === null || rawValue === undefined || rawValue === "") continue;
    const numericValue = typeof rawValue === "string" ? Number(rawValue) : rawValue;
    const timestamp =
      typeof numericValue === "number" && Number.isFinite(numericValue) && numericValue > 100000000000
        ? numericValue
        : Date.parse(String(rawValue));
    if (Number.isFinite(timestamp)) return timestamp;
  }

  return null;
}

function keepCasaHistoryRecord(record: unknown) {
  if (typeof record === "object" && record !== null) {
    const historical = (record as Record<string, unknown>).historical === true;
    const recordedAt = Number((record as Record<string, unknown>).recordedAt);
    if (historical && Number.isFinite(recordedAt) && recordedAt >= CASA_DATA_START_MS) {
      return true;
    }
  }
  const timestamp = readHistoryTimestamp(record);
  // Records without a usable date are preserved rather than guessed at.
  return timestamp === null || timestamp >= CASA_DATA_START_MS;
}

function filterHistoryArray(value: unknown) {
  return Array.isArray(value) ? value.filter(keepCasaHistoryRecord) : value;
}

// This duplicate Chips line was entered in the 25 October historical sale.
// Keep the other item on the same payment and prevent an offline snapshot from
// restoring the removed line during a later sync.
function removeDuplicateHistoricalChipsLine(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.map((record) => {
    if (typeof record !== "object" || record === null) return record;
    const payment = record as Record<string, unknown>;
    const lines = payment.lines;
    if (
      payment.id !== "kp-history-1793101935061" ||
      payment.code !== "K-H-302" ||
      payment.createdAt !== 1792918800000 ||
      payment.historical !== true ||
      payment.destination !== "Historical Kitchen Payment" ||
      payment.total !== 20000 ||
      !Array.isArray(lines) ||
      lines.length !== 2 ||
      !lines.some((line) => line?.name === "Chicken Lollipops (6 pieces)" && line?.qty === 1) ||
      !lines.some((line) => line?.name === "Chips" && line?.qty === 1)
    ) return record;

    return {
      ...payment,
      lines: lines.filter((line) => line?.name !== "Chips"),
      total: 15000,
      updatedAt: Math.max(Number(payment.updatedAt) || 0, Date.parse("2026-10-28T00:00:00+03:00")),
    };
  });
}

export function sanitizeCasaHistory<T>(key: string, value: T): T {
  if (value === null || value === undefined) return value;

  if (key === "orange-hotel-rooms-state") {
    const savedRooms = Array.isArray(value) ? value : [];
    const savedByNumber = new Map(
      savedRooms
        .filter((room): room is Record<string, unknown> => typeof room === "object" && room !== null)
        .map((room) => [String(room.number ?? ""), room]),
    );
    return Object.entries(CASA_ROOM_PRICES).map(([number, price]) => {
      const savedRoom = savedByNumber.get(number);
      const status = savedRoom?.status;
      return {
        id: `r${number}`,
        number,
        type: price === 50000 ? "Standard" : price === 60000 ? "Deluxe" : price === 100000 ? "Executive" : "Suite",
        status:
          status === "occupied" || status === "cleaning" || status === "maintenance"
            ? status
            : "available",
        price,
      };
    }) as T;
  }

  if (key === "orange-hotel-cashier-state" && typeof value === "object") {
    const snapshot = value as Record<string, unknown>;
    const receiptSeq = Number(snapshot.receiptSeq);
    const transactions = Array.isArray(snapshot.transactions)
      ? snapshot.transactions.flatMap((record) => {
          if (typeof record !== "object" || record === null) return [];
          const booking = record as Record<string, unknown>;
          const idMatch = /^tx-(\d+)$/.exec(String(booking.id ?? ""));
          const explicitEnteredAt = Number(booking.enteredAt);
          const enteredAt = Number.isFinite(explicitEnteredAt) && explicitEnteredAt > 0
            ? explicitEnteredAt
            : idMatch
              ? Number(idMatch[1])
              : null;
          const roomNumber = String(booking.roomNumber ?? "");
          // A booking keeps the rate agreed when it was made. Room prices and
          // package prices change, so comparing old bookings with today's rate
          // silently deletes real guests, including stays still in progress.
          return (
            enteredAt !== null &&
            enteredAt >= CASA_DATA_START_MS &&
            roomNumber in CASA_ROOM_PRICES
          )
            ? [{ ...booking, enteredAt }]
            : [];
        })
      : [];
    return {
      ...snapshot,
      transactions,
      receiptSeq: Number.isFinite(receiptSeq) ? Math.max(receiptSeq, 84920) : 84920,
    } as T;
  }

  if ((key === "orange-hotel-kitchen-state" || key === "orange-hotel-barista-state") && typeof value === "object") {
    const snapshot = value as Record<string, unknown>;
    return {
      ...snapshot,
      tickets: filterHistoryArray(snapshot.tickets),
      payments: key === "orange-hotel-kitchen-state"
        ? removeDuplicateHistoricalChipsLine(filterHistoryArray(snapshot.payments))
        : filterHistoryArray(snapshot.payments),
    } as T;
  }

  if (key === "orange-hotel-kitchen-payments") {
    return removeDuplicateHistoricalChipsLine(filterHistoryArray(value)) as T;
  }

  if (key === "orange-hotel-expenses") {
    return normalizeExpenseRecords(filterHistoryArray(value)) as T;
  }

  if (FILTERED_HISTORY_ARRAY_KEYS.has(key)) {
    return filterHistoryArray(value) as T;
  }

  return value;
}
