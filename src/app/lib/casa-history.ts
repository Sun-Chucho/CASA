export const CASA_HISTORY_CUTOFF_MS = Date.parse("2026-07-14T00:00:00+03:00");

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
  const timestamp = readHistoryTimestamp(record);
  // Records without a usable date are preserved rather than guessed at.
  return timestamp === null || timestamp >= CASA_HISTORY_CUTOFF_MS;
}

function filterHistoryArray(value: unknown) {
  return Array.isArray(value) ? value.filter(keepCasaHistoryRecord) : value;
}

export function sanitizeCasaHistory<T>(key: string, value: T): T {
  if (value === null || value === undefined) return value;

  if (key === "orange-hotel-cashier-state" && typeof value === "object") {
    const snapshot = value as Record<string, unknown>;
    const receiptSeq = Number(snapshot.receiptSeq);
    return {
      ...snapshot,
      transactions: filterHistoryArray(snapshot.transactions),
      receiptSeq: Number.isFinite(receiptSeq) ? Math.max(receiptSeq, 84920) : 84920,
    } as T;
  }

  if ((key === "orange-hotel-kitchen-state" || key === "orange-hotel-barista-state") && typeof value === "object") {
    const snapshot = value as Record<string, unknown>;
    return {
      ...snapshot,
      tickets: filterHistoryArray(snapshot.tickets),
      payments: filterHistoryArray(snapshot.payments),
    } as T;
  }

  if (FILTERED_HISTORY_ARRAY_KEYS.has(key)) {
    return filterHistoryArray(value) as T;
  }

  return value;
}
