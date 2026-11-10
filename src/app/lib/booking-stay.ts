export function bookingChargeDays(checkInDate: string, checkInTime: string, checkOutDate: string, checkOutTime: string): number {
  if (!checkInDate || !checkOutDate || !checkInTime || !checkOutTime) return 0;
  const start = new Date(`${checkInDate}T${checkInTime}:00`).getTime();
  const end = new Date(`${checkOutDate}T${checkOutTime}:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const startDay = Date.parse(`${checkInDate}T00:00:00Z`);
  const endDay = Date.parse(`${checkOutDate}T00:00:00Z`);
  if (!Number.isFinite(startDay) || !Number.isFinite(endDay)) return 0;
  return Math.max(1, Math.round((endDay - startDay) / 86_400_000));
}
