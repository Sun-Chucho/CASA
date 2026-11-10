export const STORAGE_BREAKFAST = "orange-hotel-breakfast-allocations";
export const BREAKFAST_PRICE = 5000;

export interface BreakfastAllocation {
  id: string;
  bookingId: string;
  date: string;
  roomNumber: string;
  guestName: string;
  count: number;
  updatedAt: number;
}

export interface BreakfastBooking {
  id: string;
  roomNumber: string;
  guestName?: string;
  checkInDate: string;
  checkInTime?: string;
  checkOutDate: string;
  checkOutTime?: string;
  checkedOutAt?: number;
  createdAt?: number;
  status?: string;
  total: number;
  currency?: string;
}

export function localDateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function breakfastId(bookingId: string, date: string) {
  return `${bookingId}:${date}`;
}

export function bookingOccupiesDate(booking: BreakfastBooking, date: string) {
  if (!booking.id || !booking.roomNumber || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const start = booking.checkInDate || (booking.createdAt ? localDateKey(booking.createdAt) : "");
  const end = booking.checkOutDate;
  if (!start || !end || date < start || date > end) return false;
  const breakfastTime = new Date(`${date}T10:00:00`).getTime();
  const checkIn = new Date(`${start}T${booking.checkInTime || "00:00"}`).getTime();
  const checkOut = new Date(`${end}T${booking.checkOutTime || "11:00"}`).getTime();
  if (breakfastTime < checkIn || breakfastTime >= checkOut) return false;
  if (booking.status === "checked-out" && booking.checkedOutAt && breakfastTime >= booking.checkedOutAt) return false;
  return true;
}

export function breakfastForBooking(bookingId: string, allocations: BreakfastAllocation[]) {
  return allocations.reduce((sum, allocation) => sum + (allocation.bookingId === bookingId ? Math.max(0, allocation.count) * BREAKFAST_PRICE : 0), 0);
}

export function roomRevenue(booking: { id?: string; total?: number; status?: string }, allocations: BreakfastAllocation[]) {
  const total = Number(booking.total) || 0;
  if (booking.status === "credit") return total;
  return Math.max(0, total - breakfastForBooking(booking.id || "", allocations));
}
