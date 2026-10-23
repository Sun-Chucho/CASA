"use client";

import { useEffect, useState } from "react";
import { readJson } from "@/app/lib/storage";
import { hydrateStorageKeyFromFirebase } from "@/app/lib/firebase-sync";
import { transactSyncedStorageKeys } from "@/app/lib/firebase-sync";
import { readStoredRole } from "@/app/lib/auth";
import { readActiveSessionUsername } from "@/app/lib/login-profiles";
import { readRoomsState, STORAGE_ROOMS } from "@/app/lib/rooms-storage";
import {
  RoomStockItem,
  RoomStockRecord,
  INV_ROOM_STOCK_KEY,
  INV_ROOM_MOVEMENTS_KEY,
  INV_HOUSEKEEPING_ITEMS_KEY,
  INV_HOUSEKEEPING_MOVEMENTS_KEY,
  HousekeepingItem,
} from "@/app/lib/inventory-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BedDouble, Plus, Trash2, Pencil } from "lucide-react";

function labelClass(extra = "") {
  return `font-black uppercase tracking-widest text-[10px] text-gray-500 ${extra}`;
}

export default function RoomStockPage() {
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [houseItems, setHouseItems] = useState<HousekeepingItem[]>([]);
  const [transferItemId, setTransferItemId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [records, setRecords] = useState<Map<string, RoomStockRecord>>(new Map());
  const [managingRoom, setManagingRoom] = useState<string | null>(null);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [removeItemIdx, setRemoveItemIdx] = useState<number | null>(null);
  const [removeAction, setRemoveAction] = useState<"return" | "dispose">("return");
  const [removeReason, setRemoveReason] = useState("");
  const [removeQuantity, setRemoveQuantity] = useState("");

  // Modal forms
  const [newItemForm, setNewItemForm] = useState({ itemName: "", quantity: "", unit: "", condition: "good" as "good" | "broken" });
  const [editItemForm, setEditItemForm] = useState({ itemName: "", quantity: "", unit: "", condition: "good" as "good" | "broken" });
  const [editReason, setEditReason] = useState("");
  const [search, setSearch] = useState("");

  const load = () => {
    const stored = readJson<RoomStockRecord[]>(INV_ROOM_STOCK_KEY) ?? [];
    const map = new Map<string, RoomStockRecord>();
    stored.forEach((r) => map.set(r.roomId, r));
    setRecords(map);
    setRoomIds(readRoomsState().map((room) => room.number));
    setHouseItems((readJson<HousekeepingItem[]>(INV_HOUSEKEEPING_ITEMS_KEY) ?? []).filter((item) => !item.deletedAt));
  };

  useEffect(() => {
    load();
    void Promise.all([hydrateStorageKeyFromFirebase(INV_ROOM_STOCK_KEY), hydrateStorageKeyFromFirebase(STORAGE_ROOMS), hydrateStorageKeyFromFirebase(INV_HOUSEKEEPING_ITEMS_KEY)]).then(load);
    const handler = () => load();
    window.addEventListener("orange-hotel-storage-updated", handler);
    return () => window.removeEventListener("orange-hotel-storage-updated", handler);
  }, []);

  const getCurrentRoomItems = (): RoomStockItem[] => {
    if (!managingRoom) return [];
    return records.get(managingRoom)?.items ?? [];
  };

  const handleAddItem = async () => {
    if (!managingRoom || !newItemForm.itemName.trim()) return;
    const qty = Number(newItemForm.quantity);
    if (!Number.isInteger(qty) || qty <= 0) return window.alert("Enter a positive whole quantity.");
    const newItem: RoomStockItem = {
      itemName: newItemForm.itemName.trim(),
      quantity: qty,
      unit: newItemForm.unit.trim() || "pcs",
      condition: newItemForm.condition,
    };
    const roomId = managingRoom;
    const now = Date.now();
    try {
      await transactSyncedStorageKeys([INV_ROOM_STOCK_KEY, INV_ROOM_MOVEMENTS_KEY], (current) => {
        const all = (current[INV_ROOM_STOCK_KEY] as RoomStockRecord[] | null) ?? [];
        const existing = all.find((record) => record.roomId === roomId);
        const roomItems = [...(existing?.items ?? [])];
        const index = roomItems.findIndex((item) => item.itemName.trim().toLowerCase() === newItem.itemName.toLowerCase() && item.unit === newItem.unit && item.condition === newItem.condition);
        if (index >= 0) roomItems[index] = { ...roomItems[index], quantity: roomItems[index].quantity + qty };
        else roomItems.push(newItem);
        const updated = { roomId, items: roomItems, lastUpdated: now };
        const movement = { id: crypto.randomUUID(), itemName: newItem.itemName, fromLocation: "new receipt", toLocation: `room:${roomId}`, quantity: qty, type: "add", user: readActiveSessionUsername(readStoredRole() ?? "unknown"), createdAt: now };
        return { [INV_ROOM_STOCK_KEY]: existing ? all.map((record) => record.roomId === roomId ? updated : record) : [...all, updated], [INV_ROOM_MOVEMENTS_KEY]: [...((current[INV_ROOM_MOVEMENTS_KEY] as unknown[] | null) ?? []), movement] };
      });
    } catch (error) { window.alert(error instanceof Error ? error.message : "Room stock was not saved."); return; }
    load();
    setNewItemForm({ itemName: "", quantity: "", unit: "", condition: "good" });
  };

  const handleTransferFromHousekeeping = async () => {
    if (!managingRoom || !transferItemId) return window.alert("Select an item to transfer.");
    const qty = Number(transferQuantity);
    if (!Number.isInteger(qty) || qty <= 0) return window.alert("Enter a positive whole quantity.");
    const roomId = managingRoom;
    const now = Date.now();
    const movementId = crypto.randomUUID();
    try {
      await transactSyncedStorageKeys([INV_HOUSEKEEPING_ITEMS_KEY, INV_ROOM_STOCK_KEY, INV_HOUSEKEEPING_MOVEMENTS_KEY, INV_ROOM_MOVEMENTS_KEY], (current) => {
        const all = (current[INV_HOUSEKEEPING_ITEMS_KEY] as HousekeepingItem[] | null) ?? [];
        const item = all.find((entry) => entry.id === transferItemId && !entry.deletedAt);
        if (!item) throw new Error("The selected item no longer exists.");
        const available = item.openingStock + item.stockAdded - item.stockIssued;
        if (available < qty) throw new Error(`Only ${available} units remain in Housekeeping.`);
        const rooms = (current[INV_ROOM_STOCK_KEY] as RoomStockRecord[] | null) ?? [];
        const existing = rooms.find((record) => record.roomId === roomId);
        const roomItems = [...(existing?.items ?? [])];
        const index = roomItems.findIndex((entry) => entry.itemName.trim().toLowerCase() === item.name.trim().toLowerCase() && entry.unit === item.unit && entry.condition === "good");
        if (index >= 0) roomItems[index] = { ...roomItems[index], quantity: roomItems[index].quantity + qty };
        else roomItems.push({ itemName: item.name, quantity: qty, unit: item.unit, condition: "good" });
        const updatedRoom = { roomId, items: roomItems, lastUpdated: now };
        const movement = { id: movementId, itemId: item.id, itemName: item.name, fromLocation: "housekeeping", toLocation: `room:${roomId}`, quantity: qty, type: "transfer", user: readActiveSessionUsername(readStoredRole() ?? "unknown"), createdAt: now };
        return {
          [INV_HOUSEKEEPING_ITEMS_KEY]: all.map((entry) => entry.id === item.id ? { ...entry, stockIssued: entry.stockIssued + qty, updatedAt: now } : entry),
          [INV_ROOM_STOCK_KEY]: existing ? rooms.map((record) => record.roomId === roomId ? updatedRoom : record) : [...rooms, updatedRoom],
          [INV_HOUSEKEEPING_MOVEMENTS_KEY]: [...((current[INV_HOUSEKEEPING_MOVEMENTS_KEY] as unknown[] | null) ?? []), movement],
          [INV_ROOM_MOVEMENTS_KEY]: [...((current[INV_ROOM_MOVEMENTS_KEY] as unknown[] | null) ?? []), movement],
        };
      });
      load();
      setTransferItemId("");
      setTransferQuantity("");
    } catch (error) { window.alert(error instanceof Error ? error.message : "Transfer failed."); }
  };

  const handleRemoveItem = async () => {
    if (!managingRoom || removeItemIdx === null || !removeReason.trim()) return window.alert("Enter a reason for this removal.");
    const roomId = managingRoom;
    const index = removeItemIdx;
    const expected = records.get(roomId)?.items[index];
    if (!expected) return;
    const quantity = Number(removeQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > expected.quantity) return window.alert(`Enter a quantity from 1 to ${expected.quantity}.`);
    const keys = removeAction === "return" ? [INV_ROOM_STOCK_KEY, INV_HOUSEKEEPING_ITEMS_KEY, INV_ROOM_MOVEMENTS_KEY] : [INV_ROOM_STOCK_KEY, INV_ROOM_MOVEMENTS_KEY];
    const now = Date.now();
    const movementId = crypto.randomUUID();
    try {
      await transactSyncedStorageKeys(keys, (current) => {
        const all = (current[INV_ROOM_STOCK_KEY] as RoomStockRecord[] | null) ?? [];
        const record = all.find((entry) => entry.roomId === roomId);
        const item = record?.items[index];
        if (!item || item.itemName !== expected.itemName || item.unit !== expected.unit || item.condition !== expected.condition || item.quantity !== expected.quantity) throw new Error("Room stock changed. Refresh and try again.");
        const updated = { ...record!, items: record!.items.map((entry, idx) => idx === index ? { ...entry, quantity: entry.quantity - quantity } : entry).filter((entry) => entry.quantity > 0), lastUpdated: now };
        const movement = { id: movementId, itemName: item.itemName, fromLocation: `room:${roomId}`, toLocation: removeAction === "return" ? "housekeeping" : "disposal", quantity, type: removeAction, reason: removeReason.trim(), user: readActiveSessionUsername(readStoredRole() ?? "unknown"), createdAt: now };
        const next: Record<string, unknown> = { [INV_ROOM_STOCK_KEY]: all.map((entry) => entry.roomId === roomId ? updated : entry), [INV_ROOM_MOVEMENTS_KEY]: [...((current[INV_ROOM_MOVEMENTS_KEY] as unknown[] | null) ?? []), movement] };
        if (removeAction === "return") {
          const house = (current[INV_HOUSEKEEPING_ITEMS_KEY] as HousekeepingItem[] | null) ?? [];
          const matching = house.find((entry) => !entry.deletedAt && entry.name.trim().toLowerCase() === item.itemName.trim().toLowerCase() && entry.unit === item.unit);
          next[INV_HOUSEKEEPING_ITEMS_KEY] = matching
            ? house.map((entry) => entry.id === matching.id ? { ...entry, stockAdded: entry.stockAdded + quantity, updatedAt: now } : entry)
            : [...house, { id: `room-return-${movementId}`, name: item.itemName, unit: item.unit, openingStock: 0, stockAdded: quantity, stockIssued: 0, createdAt: now, updatedAt: now }];
        }
        return next;
      });
      load();
      setRemoveItemIdx(null);
      setRemoveReason("");
      setRemoveQuantity("");
      setEditingItemIdx(null);
    } catch (error) { window.alert(error instanceof Error ? error.message : "Room stock removal failed."); }
  };

  const openEditItem = (idx: number) => {
    const item = getCurrentRoomItems()[idx];
    if (!item) return;
    setEditItemForm({ itemName: item.itemName, quantity: String(item.quantity), unit: item.unit, condition: item.condition });
    setEditReason("");
    setEditingItemIdx(idx);
  };

  const handleSaveEditItem = async () => {
    if (!managingRoom || editingItemIdx === null) return;
    const qty = Number(editItemForm.quantity);
    if (!Number.isInteger(qty) || qty < 0 || !editReason.trim()) return window.alert("Enter a valid quantity and a reason for this edit.");
    const roomId = managingRoom;
    const index = editingItemIdx;
    const expected = records.get(roomId)?.items[index];
    if (!expected) return;
    if (qty !== expected.quantity && readStoredRole() !== "manager") return window.alert("Manager access is required for quantity adjustments.");
    const now = Date.now();
    const movementId = crypto.randomUUID();
    try {
      await transactSyncedStorageKeys([INV_ROOM_STOCK_KEY, INV_ROOM_MOVEMENTS_KEY], (current) => {
        const all = (current[INV_ROOM_STOCK_KEY] as RoomStockRecord[] | null) ?? [];
        const record = all.find((entry) => entry.roomId === roomId);
        const old = record?.items[index];
        if (!old || old.itemName !== expected.itemName || old.quantity !== expected.quantity || old.condition !== expected.condition) throw new Error("Room stock changed. Refresh and try again.");
        const changed = { itemName: editItemForm.itemName.trim() || old.itemName, quantity: qty, unit: editItemForm.unit.trim() || old.unit, condition: editItemForm.condition };
        const updated = { ...record!, items: record!.items.map((item, idx) => idx === index ? changed : item), lastUpdated: now };
        const movement = { id: movementId, itemName: changed.itemName, fromLocation: `room:${roomId}`, toLocation: `room:${roomId}`, quantity: qty - old.quantity, type: "adjustment", reason: editReason.trim(), user: readActiveSessionUsername(readStoredRole() ?? "unknown"), createdAt: now };
        return { [INV_ROOM_STOCK_KEY]: all.map((entry) => entry.roomId === roomId ? updated : entry), [INV_ROOM_MOVEMENTS_KEY]: [...((current[INV_ROOM_MOVEMENTS_KEY] as unknown[] | null) ?? []), movement] };
      });
    } catch (error) { window.alert(error instanceof Error ? error.message : "Could not save room item."); return; }
    load();
    setEditingItemIdx(null);
  };

  const filteredRooms = roomIds.filter((id) => !search.trim() || id.includes(search.trim()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest">Room Stock</h1>
          <p className="text-sm text-gray-500 mt-0.5">{roomIds.length} rooms · click a card to manage stock</p>
        </div>
        <Input
          placeholder="Search room..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Room Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredRooms.map((roomId) => {
          const record = records.get(roomId);
          const itemCount = record?.items.length ?? 0;
          const unitCount = record?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
          const brokenCount = record?.items.filter((i) => i.condition === "broken").length ?? 0;
          return (
            <Card
              key={roomId}
              className="cursor-pointer hover:border-orange-400 hover:shadow-md transition-all duration-150 group"
              onClick={() => setManagingRoom(roomId)}
            >
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-black tracking-widest">
                    {roomId}
                  </CardTitle>
                  <BedDouble className="w-4 h-4 text-gray-400 group-hover:text-orange-400 transition-colors" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">{itemCount} item{itemCount !== 1 ? "s" : ""}</p>
                <p className="text-[10px] text-gray-500">{unitCount} total units</p>
                <p className="text-[10px] text-gray-500">{itemCount ? "Stock recorded" : "No stock recorded"}</p>
                <span className="mt-2 inline-block text-xs font-semibold text-orange-600">View Stock</span>
                {brokenCount > 0 && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-red-600 border-red-300">
                    {brokenCount} broken
                  </Badge>
                )}
                {itemCount > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {(record?.items ?? []).slice(0, 3).map((item, i) => (
                      <li key={i} className="text-[10px] text-gray-500 truncate">
                        {item.quantity}× {item.itemName}
                      </li>
                    ))}
                    {itemCount > 3 && <li className="text-[10px] text-gray-400">+{itemCount - 3} more</li>}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Manage Room Modal */}
      <Dialog open={!!managingRoom} onOpenChange={(o) => { if (!o) { setManagingRoom(null); setEditingItemIdx(null); } }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
              <BedDouble className="w-4 h-4" /> Room {managingRoom} — Stock
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              {getCurrentRoomItems().length} item types · {getCurrentRoomItems().reduce((sum, item) => sum + item.quantity, 0)} total units.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Items */}
            {getCurrentRoomItems().length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No inventory items recorded for this room. Add one below.</p>
            ) : (
              <div className="space-y-2">
                <div className="hidden grid-cols-[2rem_minmax(8rem,1fr)_4rem_4rem_5rem_6rem_4rem] gap-2 border-b pb-2 text-[10px] font-black uppercase text-gray-500 sm:grid"><span>#</span><span>Item Name</span><span>Qty</span><span>Unit</span><span>Condition</span><span>Updated</span><span>Actions</span></div>
                {getCurrentRoomItems().map((item, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3">
                    {editingItemIdx === idx ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={labelClass("mb-1 block")}>Item Name</label>
                            <Input value={editItemForm.itemName} onChange={(e) => setEditItemForm((f) => ({ ...f, itemName: e.target.value }))} className="text-xs" />
                          </div>
                          <div>
                            <label className={labelClass("mb-1 block")}>Quantity</label>
                            <Input type="number" min={0} value={editItemForm.quantity} onChange={(e) => setEditItemForm((f) => ({ ...f, quantity: e.target.value }))} className="text-xs" />
                          </div>
                          <div>
                            <label className={labelClass("mb-1 block")}>Unit</label>
                            <Input value={editItemForm.unit} onChange={(e) => setEditItemForm((f) => ({ ...f, unit: e.target.value }))} className="text-xs" />
                          </div>
                          <div>
                            <label className={labelClass("mb-1 block")}>Condition</label>
                            <div className="flex gap-1">
                              {(["good", "broken"] as const).map((c) => (
                                <button key={c} onClick={() => setEditItemForm((f) => ({ ...f, condition: c }))}
                                  className={`flex-1 py-1 rounded text-[10px] font-black uppercase tracking-widest border transition-colors ${editItemForm.condition === c ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>{c}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div><label className={labelClass("mb-1 block")}>Reason for edit or adjustment</label><Input value={editReason} onChange={(event) => setEditReason(event.target.value)} placeholder="Count verified, damaged, corrected..." /></div>
                        <div className="flex gap-2">
                          <Button onClick={handleSaveEditItem} className="font-black uppercase tracking-widest text-xs flex-1">Save</Button>
                          <Button variant="outline" onClick={() => setEditingItemIdx(null)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid items-center gap-2 sm:grid-cols-[2rem_minmax(8rem,1fr)_4rem_4rem_5rem_6rem_4rem]">
                        <span className="text-xs text-gray-400">{idx + 1}</span>
                        <span className="font-semibold text-sm">{item.itemName}</span>
                        <span className="text-sm">{item.quantity}</span>
                        <span className="text-xs text-gray-500">{item.unit}</span>
                        <Badge variant={item.condition === "good" ? "outline" : "destructive"} className="w-fit text-[9px] px-1.5 py-0">{item.condition}</Badge>
                        <span className="text-[10px] text-gray-500">{records.get(managingRoom ?? "")?.lastUpdated ? new Date(records.get(managingRoom ?? "")!.lastUpdated).toLocaleDateString() : "—"}</span>
                        <div className="flex gap-1">
                          <button onClick={() => openEditItem(idx)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setRemoveItemIdx(idx); setRemoveAction("return"); setRemoveReason(""); setRemoveQuantity(String(item.quantity)); }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add New Item */}
            <div className="border-t border-gray-100 pt-4 space-y-3"><p className={labelClass()}>Transfer Stock from Housekeeping</p><div className="grid gap-2 sm:grid-cols-[1fr_8rem]"><select className="h-10 rounded-md border px-3 text-sm" value={transferItemId} onChange={(event) => setTransferItemId(event.target.value)}><option value="">Select item...</option>{houseItems.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.openingStock + item.stockAdded - item.stockIssued} available)</option>)}</select><Input type="number" min="1" value={transferQuantity} onChange={(event) => setTransferQuantity(event.target.value)} placeholder="Quantity" /></div><Button variant="outline" onClick={() => void handleTransferFromHousekeeping()}>Transfer Stock</Button></div>
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className={labelClass()}>Add New Item · New Receipt</p>
              <p className="text-xs text-gray-500">For stock already held by Housekeeping, use Issue Stock there to transfer it to this room.</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass("mb-1 block")}>Item Name</label>
                  <Input value={newItemForm.itemName} onChange={(e) => setNewItemForm((f) => ({ ...f, itemName: e.target.value }))} placeholder="e.g. Towel" className="text-xs" />
                </div>
                <div>
                  <label className={labelClass("mb-1 block")}>Quantity</label>
                  <Input type="number" min={0} value={newItemForm.quantity} onChange={(e) => setNewItemForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="0" className="text-xs" />
                </div>
                <div>
                  <label className={labelClass("mb-1 block")}>Unit</label>
                  <Input value={newItemForm.unit} onChange={(e) => setNewItemForm((f) => ({ ...f, unit: e.target.value }))} placeholder="pcs" className="text-xs" />
                </div>
                <div>
                  <label className={labelClass("mb-1 block")}>Condition</label>
                  <div className="flex gap-1">
                    {(["good", "broken"] as const).map((c) => (
                      <button key={c} onClick={() => setNewItemForm((f) => ({ ...f, condition: c }))}
                        className={`flex-1 py-1 rounded text-[10px] font-black uppercase tracking-widest border transition-colors ${newItemForm.condition === c ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}>{c}</button>
                    ))}
                  </div>
                </div>
              </div>
              <Button onClick={handleAddItem} className="font-black uppercase tracking-widest text-xs w-full gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setManagingRoom(null); setEditingItemIdx(null); }} className="font-black uppercase tracking-widest text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={removeItemIdx !== null} onOpenChange={(open) => { if (!open) setRemoveItemIdx(null); }}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Remove room item</DialogTitle><DialogDescription>Record where the item goes before removing it from this room.</DialogDescription></DialogHeader>
          <div className="space-y-3"><p className="text-sm font-semibold">{removeItemIdx !== null ? records.get(managingRoom ?? "")?.items[removeItemIdx]?.itemName : ""}</p><label className={labelClass("block")}>Action</label><select className="w-full rounded-md border px-3 py-2 text-sm" value={removeAction} onChange={(event) => setRemoveAction(event.target.value as "return" | "dispose")}><option value="return">Return to Housekeeping</option><option value="dispose">Dispose</option></select><label className={labelClass("block")}>Quantity</label><Input type="number" min="1" max={removeItemIdx !== null ? records.get(managingRoom ?? "")?.items[removeItemIdx]?.quantity : undefined} value={removeQuantity} onChange={(event) => setRemoveQuantity(event.target.value)} /><label className={labelClass("block")}>Reason</label><Input value={removeReason} onChange={(event) => setRemoveReason(event.target.value)} placeholder="Reason for removal" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setRemoveItemIdx(null)}>Cancel</Button><Button onClick={() => void handleRemoveItem()}>Confirm Removal</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
