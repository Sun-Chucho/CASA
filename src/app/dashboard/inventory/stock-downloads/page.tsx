"use client";

import { readJson } from "@/app/lib/storage";
import {
  KitchenItem,
  BarItem,
  ReceptionItem,
  HousekeepingItem,
  RoomStockRecord,
  INV_KITCHEN_ITEMS_KEY,
  INV_BAR_ITEMS_KEY,
  INV_RECEPTION_ITEMS_KEY,
  INV_HOUSEKEEPING_ITEMS_KEY,
  INV_ROOM_STOCK_KEY,
  downloadCSV,
} from "@/app/lib/inventory-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChefHat,
  Wine,
  ConciergeBell,
  Sparkles,
  BedDouble,
  Download,
  FileDown,
} from "lucide-react";

function downloadKitchenCSV() {
  const items = (readJson<KitchenItem[]>(INV_KITCHEN_ITEMS_KEY) ?? []).filter((i) => !i.deletedAt);
  const headers = ["#", "Item Name", "Store Qty", "Kitchen Qty", "Total Qty", "Broken Qty", "Good Qty", "Unit"];
  const rows = items.map((item, idx) => {
    const total = item.storeQty + item.kitchenQty;
    const good = total - item.brokenQty;
    return [String(idx + 1), item.name, String(item.storeQty), String(item.kitchenQty), String(total), String(item.brokenQty), String(good), item.unit];
  });
  downloadCSV("kitchen-stock.csv", headers, rows);
}

function downloadBarCSV() {
  const items = (readJson<BarItem[]>(INV_BAR_ITEMS_KEY) ?? []).filter((i) => !i.deletedAt);
  const headers = ["#", "Item Name", "Store Qty", "Bar Qty", "Total Qty", "Broken Qty", "Good Qty", "Unit", "Selling Price", "Buying Price"];
  const rows = items.map((item, idx) => {
    const total = item.storeQty + item.barQty;
    const good = total - item.brokenQty;
    return [String(idx + 1), item.name, String(item.storeQty), String(item.barQty), String(total), String(item.brokenQty), String(good), item.unit, String(item.sellingPrice ?? ""), String(item.buyingPrice ?? "")];
  });
  downloadCSV("bar-stock.csv", headers, rows);
}

function downloadReceptionCSV() {
  const items = (readJson<ReceptionItem[]>(INV_RECEPTION_ITEMS_KEY) ?? []).filter((i) => !i.deletedAt);
  const headers = ["#", "Item Name", "Reception Qty", "Store Qty", "Total Qty", "Min Stock Level", "Unit"];
  const rows = items.map((item, idx) => [String(idx + 1), item.name, String(item.receptionQty), String(item.storeQty), String(item.receptionQty + item.storeQty), String(item.minStockLevel), item.unit]);
  downloadCSV("reception-stock.csv", headers, rows);
}

function downloadHousekeepingCSV() {
  const items = (readJson<HousekeepingItem[]>(INV_HOUSEKEEPING_ITEMS_KEY) ?? []).filter((i) => !i.deletedAt);
  const headers = ["#", "Item Name", "Opening Stock", "Stock Added", "Stock Issued", "Current Balance", "Unit", "Last Updated"];
  const rows = items.map((item, idx) => {
    const balance = item.openingStock + item.stockAdded - item.stockIssued;
    return [String(idx + 1), item.name, String(item.openingStock), String(item.stockAdded), String(item.stockIssued), String(balance), item.unit, new Date(item.updatedAt).toLocaleDateString()];
  });
  downloadCSV("housekeeping-stock.csv", headers, rows);
}

function downloadRoomStockCSV() {
  const records = readJson<RoomStockRecord[]>(INV_ROOM_STOCK_KEY) ?? [];
  const headers = ["Room", "Item Name", "Quantity", "Unit", "Condition", "Last Updated"];
  const rows: string[][] = [];
  records.forEach((record) => {
    record.items.forEach((item) => {
      rows.push([record.roomId, item.itemName, String(item.quantity), item.unit, item.condition, new Date(record.lastUpdated).toLocaleDateString()]);
    });
  });
  downloadCSV("room-stock.csv", headers, rows);
}

function downloadAllCSV() {
  const kitchenItems = (readJson<KitchenItem[]>(INV_KITCHEN_ITEMS_KEY) ?? []).filter((i) => !i.deletedAt);
  const barItems = (readJson<BarItem[]>(INV_BAR_ITEMS_KEY) ?? []).filter((i) => !i.deletedAt);
  const receptionItems = (readJson<ReceptionItem[]>(INV_RECEPTION_ITEMS_KEY) ?? []).filter((i) => !i.deletedAt);
  const housekeepingItems = (readJson<HousekeepingItem[]>(INV_HOUSEKEEPING_ITEMS_KEY) ?? []).filter((i) => !i.deletedAt);
  const roomRecords = readJson<RoomStockRecord[]>(INV_ROOM_STOCK_KEY) ?? [];

  const headers = ["Section", "Item Name", "Detail 1", "Detail 2", "Detail 3", "Unit", "Notes"];
  const rows: string[][] = [];

  kitchenItems.forEach((item) => {
    const total = item.storeQty + item.kitchenQty;
    rows.push(["Kitchen", item.name, `Store: ${item.storeQty}`, `Kitchen: ${item.kitchenQty}`, `Total: ${total} / Broken: ${item.brokenQty}`, item.unit, item.notes ?? ""]);
  });
  barItems.forEach((item) => {
    const total = item.storeQty + item.barQty;
    rows.push(["Bar", item.name, `Store: ${item.storeQty}`, `Bar: ${item.barQty}`, `Total: ${total} / Broken: ${item.brokenQty}`, item.unit, item.notes ?? ""]);
  });
  receptionItems.forEach((item) => {
    rows.push(["Reception", item.name, `Reception: ${item.receptionQty}`, `Store: ${item.storeQty}`, `Min Level: ${item.minStockLevel}`, item.unit, item.notes ?? ""]);
  });
  housekeepingItems.forEach((item) => {
    const balance = item.openingStock + item.stockAdded - item.stockIssued;
    rows.push(["Housekeeping", item.name, `Opening: ${item.openingStock}`, `Added: ${item.stockAdded} / Issued: ${item.stockIssued}`, `Balance: ${balance}`, item.unit, item.notes ?? ""]);
  });
  roomRecords.forEach((record) => {
    record.items.forEach((item) => {
      rows.push(["Room " + record.roomId, item.itemName, `Qty: ${item.quantity}`, `Condition: ${item.condition}`, "", item.unit, ""]);
    });
  });

  downloadCSV(`all-stock-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

const DOWNLOADS = [
  {
    label: "Kitchen Stock",
    description: "All kitchen inventory items with store/kitchen quantities and broken counts.",
    icon: ChefHat,
    color: "text-orange-500",
    bg: "bg-orange-50",
    action: downloadKitchenCSV,
    key: INV_KITCHEN_ITEMS_KEY,
  },
  {
    label: "Bar Stock",
    description: "All bar inventory items with store/bar quantities, broken counts, and pricing.",
    icon: Wine,
    color: "text-purple-500",
    bg: "bg-purple-50",
    action: downloadBarCSV,
    key: INV_BAR_ITEMS_KEY,
  },
  {
    label: "Reception Stock",
    description: "Reception items with quantities, store buffer, and minimum stock levels.",
    icon: ConciergeBell,
    color: "text-blue-500",
    bg: "bg-blue-50",
    action: downloadReceptionCSV,
    key: INV_RECEPTION_ITEMS_KEY,
  },
  {
    label: "Housekeeping Stock",
    description: "Housekeeping items with opening stock, additions, issues, and current balance.",
    icon: Sparkles,
    color: "text-green-500",
    bg: "bg-green-50",
    action: downloadHousekeepingCSV,
    key: INV_HOUSEKEEPING_ITEMS_KEY,
  },
  {
    label: "Room Stock",
    description: "Per-room stock items — one row per room per item.",
    icon: BedDouble,
    color: "text-cyan-500",
    bg: "bg-cyan-50",
    action: downloadRoomStockCSV,
    key: INV_ROOM_STOCK_KEY,
  },
];

export default function StockDownloadsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-widest">Stock Downloads</h1>
        <p className="text-sm text-gray-500 mt-0.5">Download CSV reports for each inventory section.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {DOWNLOADS.map(({ label, description, icon: Icon, color, bg, action }) => (
          <Card key={label} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${bg}`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <CardTitle className="font-black uppercase tracking-widest text-xs">{label}</CardTitle>
                </div>
              </div>
              <CardDescription className="text-xs text-gray-500 mt-1">{description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={action}
                variant="outline"
                className="font-black uppercase tracking-widest text-xs gap-1.5 w-full"
              >
                <Download className="w-3.5 h-3.5" /> Download CSV
              </Button>
            </CardContent>
          </Card>
        ))}

        {/* All Stock combined */}
        <Card className="hover:shadow-md transition-shadow border-gray-900">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-900">
                <FileDown className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="font-black uppercase tracking-widest text-xs">All Stock Combined</CardTitle>
              </div>
            </div>
            <CardDescription className="text-xs text-gray-500 mt-1">
              Download all sections combined into a single CSV file for a full inventory snapshot.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              onClick={downloadAllCSV}
              className="font-black uppercase tracking-widest text-xs gap-1.5 w-full"
            >
              <Download className="w-3.5 h-3.5" /> Download All Stock
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
