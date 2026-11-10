// Bar sales are reported on the hotel's East Africa business date.
export function barSaleBusinessDate(payment: { createdAt?: number; businessDate?: string }): string {
  if (typeof payment.businessDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payment.businessDate)) return payment.businessDate;
  if (!Number.isFinite(payment.createdAt)) return "";
  return new Date(Number(payment.createdAt) + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
