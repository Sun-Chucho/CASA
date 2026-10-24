type BookingSyncRecord = {
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastExtendedAt?: unknown;
  paymentMethodEditedAt?: unknown;
  checkedOutAt?: unknown;
  checkOutDate?: unknown;
  checkOutTime?: unknown;
  nights?: unknown;
  total?: unknown;
  extensionPaymentMethod?: unknown;
  extensionAmount?: unknown;
};

function timestamp(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function bookingRevision(record: BookingSyncRecord): number {
  return Math.max(
    timestamp(record.createdAt),
    timestamp(record.updatedAt),
    timestamp(record.lastExtendedAt),
    timestamp(record.paymentMethodEditedAt),
    timestamp(record.checkedOutAt),
  );
}

export function chooseCashierBookingRecord(current: unknown, incoming: unknown): unknown {
  if (!current || typeof current !== "object") return incoming;
  if (!incoming || typeof incoming !== "object") return current;

  const currentBooking = current as BookingSyncRecord;
  const incomingBooking = incoming as BookingSyncRecord;

  // Checkout is terminal in this workflow. An old browser must not reopen a
  // room by replaying a booking it still has marked active.
  if (currentBooking.status === "checked-out" && incomingBooking.status !== "checked-out") return current;
  if (incomingBooking.status === "checked-out" && currentBooking.status !== "checked-out") return incoming;

  // Extension and payment changes can change completed to credit or vice versa.
  // The latest explicit edit wins regardless of payment status.
  const currentRevision = bookingRevision(currentBooking);
  const incomingRevision = bookingRevision(incomingBooking);
  const winner = currentRevision > incomingRevision ? currentBooking : incomingBooking;
  const other = winner === currentBooking ? incomingBooking : currentBooking;

  // A payment edit made from an older screen can have a newer timestamp than
  // an extension while still carrying the old departure date and amount.
  // Keep that payment decision and the latest extension together.
  if (
    timestamp(other.lastExtendedAt) > timestamp(winner.lastExtendedAt) &&
    timestamp(winner.paymentMethodEditedAt) >= timestamp(other.lastExtendedAt)
  ) {
    return {
      ...winner,
      checkOutDate: other.checkOutDate,
      checkOutTime: other.checkOutTime,
      nights: other.nights,
      total: other.total,
      extensionPaymentMethod: other.extensionPaymentMethod,
      extensionAmount: other.extensionAmount,
      lastExtendedAt: other.lastExtendedAt,
    };
  }

  return winner;
}
