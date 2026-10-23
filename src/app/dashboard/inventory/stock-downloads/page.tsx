"use client";

import { useEffect, useState } from "react";
import { hydrateStorageKeyFromFirebase, subscribeToSyncedStorageKey } from "@/app/lib/firebase-sync";
import { readRoomsState, STORAGE_ROOMS } from "@/app/lib/rooms-storage";
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
  INV_KITCHEN_MOVEMENTS_KEY,
  INV_BAR_MOVEMENTS_KEY,
  INV_RECEPTION_MOVEMENTS_KEY,
  INV_HOUSEKEEPING_MOVEMENTS_KEY,
  INV_ROOM_MOVEMENTS_KEY,
  downloadCSV,
} from "@/app/lib/inventory-manager";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ChefHat,
  Wine,
  ConciergeBell,
  Sparkles,
  BedDouble,
  Download,
} from "lucide-react";

function downloadKitchenCSV() {
  const items = (readJson<KitchenItem[]>(INV_KITCHEN_ITEMS_KEY) ?? []).filter((i) => !i.deletedAt);
  const headers = ["#", "Item Name", "Store Qty", "Kitchen Qty", "Total Qty", "Broken Qty", "Good Qty", "Unit"];
  const rows = items.map((item, idx) => {
    const good = item.storeQty + item.kitchenQty;
    const total = good + item.brokenQty;
    return [String(idx + 1), item.name, String(item.storeQty), String(item.kitchenQty), String(total), String(item.brokenQty), String(good), item.unit];
  });
  downloadCSV("kitchen-stock.csv", headers, rows);
}

function downloadBarCSV() {
  const items = (readJson<BarItem[]>(INV_BAR_ITEMS_KEY) ?? []).filter((i) => !i.deletedAt);
  const headers = ["#", "Item Name", "Store Qty", "Bar Qty", "Total Qty", "Broken Qty", "Good Qty", "Unit", "Selling Price", "Buying Price"];
  const rows = items.map((item, idx) => {
    const good = item.storeQty + item.barQty;
    const total = good + item.brokenQty;
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

function downloadRoomStockCSV(room?: string) {
  const records = readJson<RoomStockRecord[]>(INV_ROOM_STOCK_KEY) ?? [];
  const headers = ["Room", "Item Name", "Quantity", "Unit", "Condition", "Last Updated"];
  const rows: string[][] = [];
  records.filter((record) => !room || record.roomId === room).forEach((record) => {
    record.items.forEach((item) => {
      rows.push([record.roomId, item.itemName, String(item.quantity), item.unit, item.condition, new Date(record.lastUpdated).toLocaleDateString()]);
    });
  });
  downloadCSV(`room-stock${room ? `-${room}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
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
    const total = item.storeQty + item.kitchenQty + item.brokenQty;
    rows.push(["Kitchen", item.name, `Store: ${item.storeQty}`, `Kitchen: ${item.kitchenQty}`, `Total: ${total} / Broken: ${item.brokenQty}`, item.unit, item.notes ?? ""]);
  });
  barItems.forEach((item) => {
    const total = item.storeQty + item.barQty + item.brokenQty;
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

const DATA_KEYS = [INV_KITCHEN_ITEMS_KEY, INV_BAR_ITEMS_KEY, INV_RECEPTION_ITEMS_KEY, INV_HOUSEKEEPING_ITEMS_KEY, INV_ROOM_STOCK_KEY, INV_KITCHEN_MOVEMENTS_KEY, INV_BAR_MOVEMENTS_KEY, INV_RECEPTION_MOVEMENTS_KEY, INV_HOUSEKEEPING_MOVEMENTS_KEY, INV_ROOM_MOVEMENTS_KEY, STORAGE_ROOMS];

function downloadMovementsCSV() {
  const keys = [INV_KITCHEN_MOVEMENTS_KEY, INV_BAR_MOVEMENTS_KEY, INV_RECEPTION_MOVEMENTS_KEY, INV_HOUSEKEEPING_MOVEMENTS_KEY, INV_ROOM_MOVEMENTS_KEY];
  const records = keys.flatMap((key) => (readJson<Array<{ itemName?: string; itemId?: string; fromLocation?: string; toLocation?: string; source?: string; destination?: string; quantity?: number; type?: string; user?: string; createdAt?: number; notes?: string }>>(key) ?? []).map((movement) => [movement.createdAt ? new Date(movement.createdAt).toISOString() : "", movement.itemName ?? movement.itemId ?? "", movement.fromLocation ?? movement.source ?? "", movement.toLocation ?? movement.destination ?? "", String(movement.quantity ?? ""), movement.type ?? "", movement.user ?? "", movement.notes ?? ""]));
  downloadCSV(`stock-movements-${new Date().toISOString().slice(0, 10)}.csv`, ["Date", "Item", "Source", "Destination", "Quantity", "Movement Type", "User", "Notes"], records);
}

export default function StockDownloadsPage() {
  const [, refresh] = useState(0);
  const [ready, setReady] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState("");
  useEffect(() => {
    let mounted = true;
    const unsubscribers = DATA_KEYS.map((key) => subscribeToSyncedStorageKey(key, () => { if (mounted) refresh((value) => value + 1); }));
    void Promise.all(DATA_KEYS.map((key) => hydrateStorageKeyFromFirebase(key))).finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; unsubscribers.forEach((unsubscribe) => unsubscribe()); };
  }, []);
  const rooms = readRoomsState();
  const inventoryCount = (key: string) => key === INV_ROOM_STOCK_KEY
    ? (readJson<RoomStockRecord[]>(key) ?? []).reduce((sum, record) => sum + record.items.length, 0)
    : (readJson<Array<{ deletedAt?: number }>>(key) ?? []).filter((item) => !item.deletedAt).length;
  const lastUpdated = (key: string) => {
    const data = readJson<Array<{ updatedAt?: number; lastUpdated?: number }>>(key) ?? [];
    const latest = Math.max(0, ...data.map((item) => item.updatedAt ?? item.lastUpdated ?? 0));
    return latest ? new Date(latest).toLocaleString() : "—";
  };
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-widest">Stock Downloads</h1>
        <p className="text-sm text-gray-500 mt-0.5">Download CSV reports for each inventory section.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white"><Table><TableHeader><TableRow><TableHead>Stock Category</TableHead><TableHead>Number of Items</TableHead><TableHead>Last Updated</TableHead><TableHead>Download Action</TableHead></TableRow></TableHeader><TableBody>
        {DOWNLOADS.map(({ label, key, action }) => <TableRow key={label}><TableCell className="font-semibold">{label}</TableCell><TableCell>{inventoryCount(key)}</TableCell><TableCell>{lastUpdated(key)}</TableCell><TableCell><Button variant="outline" size="sm" disabled={!ready} onClick={() => label === "Room Stock" ? downloadRoomStockCSV(selectedRoom || undefined) : action()}><Download className="mr-2 h-4 w-4" />Download CSV</Button></TableCell></TableRow>)}
        <TableRow><TableCell className="font-semibold">All Inventory</TableCell><TableCell>{DOWNLOADS.reduce((sum, item) => sum + inventoryCount(item.key), 0)}</TableCell><TableCell>—</TableCell><TableCell><Button variant="outline" size="sm" disabled={!ready} onClick={downloadAllCSV}><Download className="mr-2 h-4 w-4" />Download CSV</Button></TableCell></TableRow>
      </TableBody></Table></div>
      <div className="flex flex-wrap items-end gap-3"><label className="text-sm font-medium">Room export<br /><select className="mt-1 h-10 rounded-md border bg-white px-3" value={selectedRoom} onChange={(event) => setSelectedRoom(event.target.value)}><option value="">All rooms</option>{rooms.map((room) => <option key={room.id} value={room.number}>Room {room.number}</option>)}</select></label><Button variant="outline" disabled={!ready} onClick={downloadMovementsCSV}>Download Movement History CSV</Button></div>
    </div>
  );
}
