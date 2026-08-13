export const STORAGE_LAUNDRY_RECORDS = "orange-hotel-laundry-records";

export type LaundryPaymentStatus = "completed" | "credit";
export type LaundryPaymentMethod = "cash" | "card" | "mobile-money" | "credit";

export interface LaundryRecord {
  id: string;
  clientName: string;
  itemCount: number;
  totalAmount: number;
  status: LaundryPaymentStatus;
  paymentMethod: LaundryPaymentMethod;
  createdAt: number;
  bookingDate?: string;
  paymentDate?: string;
  paidAt?: number;
  recordedAt?: number;
  updatedAt?: number;
  createdBy?: string;
}

function getDateTimestamp(value: string | undefined) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const timestamp = new Date(`${value}T12:00:00`).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}

export function getLaundryBusinessTimestamp(
  record: Pick<LaundryRecord, "paymentDate" | "paidAt" | "recordedAt" | "createdAt" | "status">,
) {
  const paymentDateTimestamp = getDateTimestamp(record.paymentDate);
  if (paymentDateTimestamp) return paymentDateTimestamp;
  if (record.status === "completed") {
    const paidAt = Number(record.paidAt ?? record.recordedAt);
    if (Number.isFinite(paidAt) && paidAt > 0) return paidAt;
  }
  const createdAt = Number(record.createdAt);
  return Number.isFinite(createdAt) ? createdAt : 0;
}
