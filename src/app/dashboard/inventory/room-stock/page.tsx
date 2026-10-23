"use client";

import { useEffect, useState } from "react";
import { readJson, writeJson } from "@/app/lib/storage";
import {
  RoomStockItem,
  RoomStockRecord,
  INV_ROOM_STOCK_KEY,
} from "@/app/lib/inventory-manager";
import { ROOMS } from "@/app/lib/mock-data";
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

const ROOM_IDS = ROOMS.map((r) => r.number);

export default function RoomStockPage() {
  const [records, setRecords] = useState<Map<string, RoomStockRecord>>(new Map());
  const [managingRoom, setManagingRoom] = useState<string | null>(null);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);

  // Modal forms
  const [newItemForm, setNewItemForm] = useState({ itemName: "", quantity: "", unit: "", condition: "good" as "good" | "broken" });
  const [editItemForm, setEditItemForm] = useState({ itemName: "", quantity: "", unit: "", condition: "good" as "good" | "broken" });
  const [search, setSearch] = useState("");

  const load = () => {
    const stored = readJson<RoomStockRecord[]>(INV_ROOM_STOCK_KEY) ?? [];
    const map = new Map<string, RoomStockRecord>();
    stored.forEach((r) => map.set(r.roomId, r));
    setRecords(map);
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("orange-hotel-storage-updated", handler);
    return () => window.removeEventListener("orange-hotel-storage-updated", handler);
  }, []);

  const saveAll = (map: Map<string, RoomStockRecord>) => {
    void writeJson(INV_ROOM_STOCK_KEY, Array.from(map.values()));
    setRecords(new Map(map));
  };

  const getCurrentRoomItems = (): RoomStockItem[] => {
    if (!managingRoom) return [];
    return records.get(managingRoom)?.items ?? [];
  };

  const handleAddItem = () => {
    if (!managingRoom || !newItemForm.itemName.trim()) return;
    const qty = Math.max(0, Number(newItemForm.quantity) || 0);
    const newItem: RoomStockItem = {
      itemName: newItemForm.itemName.trim(),
      quantity: qty,
      unit: newItemForm.unit.trim() || "pcs",
      condition: newItemForm.condition,
    };
    const existing = records.get(managingRoom) ?? { roomId: managingRoom, items: [], lastUpdated: Date.now() };
    const updated = { ...existing, items: [...existing.items, newItem], lastUpdated: Date.now() };
    const newMap = new Map(records);
    newMap.set(managingRoom, updated);
    saveAll(newMap);
    setNewItemForm({ itemName: "", quantity: "", unit: "", condition: "good" });
  };

  const handleRemoveItem = (idx: number) => {
    if (!managingRoom) return;
    const existing = records.get(managingRoom);
    if (!existing) return;
    const items = existing.items.filter((_, i) => i !== idx);
    const updated = { ...existing, items, lastUpdated: Date.now() };
    const newMap = new Map(records);
    newMap.set(managingRoom, updated);
    saveAll(newMap);
    if (editingItemIdx === idx) setEditingItemIdx(null);
  };

  const openEditItem = (idx: number) => {
    const item = getCurrentRoomItems()[idx];
    if (!item) return;
    setEditItemForm({ itemName: item.itemName, quantity: String(item.quantity), unit: item.unit, condition: item.condition });
    setEditingItemIdx(idx);
  };

  const handleSaveEditItem = () => {
    if (!managingRoom || editingItemIdx === null) return;
    const existing = records.get(managingRoom);
    if (!existing) return;
    const items = existing.items.map((item, i) => {
      if (i !== editingItemIdx) return item;
      return {
        itemName: editItemForm.itemName.trim() || item.itemName,
        quantity: Math.max(0, Number(editItemForm.quantity) || 0),
        unit: editItemForm.unit.trim() || item.unit,
        condition: editItemForm.condition,
      };
    });
    const updated = { ...existing, items, lastUpdated: Date.now() };
    const newMap = new Map(records);
    newMap.set(managingRoom, updated);
    saveAll(newMap);
    setEditingItemIdx(null);
  };

  const filteredRooms = ROOM_IDS.filter((id) => !search.trim() || id.includes(search.trim()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest">Room Stock</h1>
          <p className="text-sm text-gray-500 mt-0.5">{ROOM_IDS.length} rooms · click a card to manage stock</p>
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
              <BedDouble className="w-4 h-4" /> Room {managingRoom} — Stock
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Manage stock items for this room.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Items */}
            {getCurrentRoomItems().length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No items yet. Add one below.</p>
            ) : (
              <div className="space-y-2">
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
                        <div className="flex gap-2">
                          <Button onClick={handleSaveEditItem} className="font-black uppercase tracking-widest text-xs flex-1">Save</Button>
                          <Button variant="outline" onClick={() => setEditingItemIdx(null)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{item.itemName}</p>
                          <p className="text-xs text-gray-500">{item.quantity} {item.unit}</p>
                          <Badge
                            variant={item.condition === "good" ? "outline" : "destructive"}
                            className="text-[9px] px-1.5 py-0 mt-1"
                          >
                            {item.condition}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditItem(idx)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleRemoveItem(idx)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
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
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className={labelClass()}>Add New Item</p>
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
    </div>
  );
}
