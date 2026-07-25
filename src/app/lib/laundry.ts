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
  createdBy?: string;
}
