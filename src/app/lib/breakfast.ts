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

export interface BreakfastSaleLine {
  booking: BreakfastBooking;
  quantity: number;
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
  const today = localDateKey(Date.now());
  if (date > today) return false;
  // Cashier treats every booking that has not checked out as occupied, even
  // when its scheduled checkout has passed. The current breakfast list must
  // use the same rule so overstay and credit rooms remain visible.
  if (date === today) return booking.status !== "checked-out";

  const start = booking.checkInDate || (booking.createdAt ? localDateKey(booking.createdAt) : "");
  if (start && date < start) return false;
  if (booking.checkedOutAt) return date <= localDateKey(booking.checkedOutAt);
  if (booking.status === "checked-out") return Boolean(booking.checkOutDate) && date <= booking.checkOutDate;
  return true;
}

export function breakfastForBooking(bookingId: string, allocations: BreakfastAllocation[]) {
  return allocations.reduce((sum, allocation) => sum + (allocation.bookingId === bookingId ? Math.max(0, allocation.count) * BREAKFAST_PRICE : 0), 0);
}

export function applyBreakfastSale(records: BreakfastAllocation[], lines: BreakfastSaleLine[], date: string, updatedAt: number) {
  if (lines.length === 0) throw new Error("Add a room to the cheque first.");
  const next = [...records];
  for (const { booking, quantity } of lines) {
    if (!Number.isInteger(quantity) || quantity < 1 || !bookingOccupiesDate(booking, date)) {
      throw new Error(`Room ${booking.roomNumber} is no longer available for this breakfast date.`);
    }
    const id = breakfastId(booking.id, date);
    const previous = next.find((entry) => entry.id === id);
    const existingTotal = breakfastForBooking(booking.id, next);
    if (existingTotal + quantity * BREAKFAST_PRICE > booking.total) {
      throw new Error(`Room ${booking.roomNumber} has no remaining room balance for this cheque.`);
    }
    const index = next.findIndex((entry) => entry.id === id);
    const allocation: BreakfastAllocation = {
      id,
      bookingId: booking.id,
      date,
      roomNumber: booking.roomNumber,
      guestName: booking.guestName || "Guest",
      count: (previous?.count ?? 0) + quantity,
      updatedAt,
    };
    if (index === -1) next.push(allocation);
    else next[index] = allocation;
  }
  return next;
}

export function roomRevenue(booking: { id?: string; total?: number; status?: string }, allocations: BreakfastAllocation[]) {
  const total = Number(booking.total) || 0;
  if (booking.status === "credit") return total;
  return Math.max(0, total - breakfastForBooking(booking.id || "", allocations));
}
