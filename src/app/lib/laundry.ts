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
  recordedAt?: number;
  createdBy?: string;
}

export function getLaundryBusinessTimestamp(record: Pick<LaundryRecord, "bookingDate" | "createdAt">) {
  if (record.bookingDate && /^\d{4}-\d{2}-\d{2}$/.test(record.bookingDate)) {
    const timestamp = new Date(`${record.bookingDate}T12:00:00`).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  const createdAt = Number(record.createdAt);
  return Number.isFinite(createdAt) ? createdAt : 0;
}
