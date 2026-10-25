export const STOCK_IN_HISTORY_KEY = "orange-hotel-barista-stock-in-history";

export type StockInEntry = {
  id: string;
  itemId: string;
  itemName: string;
  kind: "new" | "addition";
  date: string;
  quantity: number;
  unit?: string;
  buyingPrice: number;
  sellingPrice: number;
  recordedAt: number;
  user?: string;
};
