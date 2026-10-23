"use client";

import { useEffect, useState, useMemo } from "react";
import { readJson, writeJson } from "@/app/lib/storage";
import {
  ReceptionItem,
  INV_RECEPTION_ITEMS_KEY,
  downloadCSV,
} from "@/app/lib/inventory-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, ArrowLeftRight, Download } from "lucide-react";

type FilterType = "all" | "low" | "ok";

function labelClass(extra = "") {
  return `font-black uppercase tracking-widest text-[10px] text-gray-500 ${extra}`;
}

export default function ReceptionStockPage() {
  const [items, setItems] = useState<ReceptionItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editItem, setEditItem] = useState<ReceptionItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<ReceptionItem | null>(null);

  const [form, setForm] = useState({ name: "", unit: "", receptionQty: "", storeQty: "", minStockLevel: "5", notes: "" });
  const [addStockForm, setAddStockForm] = useState({ itemId: "", destination: "reception" as "reception" | "store", quantity: "" });
  const [transferForm, setTransferForm] = useState({ itemId: "", direction: "store-to-reception" as "store-to-reception" | "reception-to-store", quantity: "" });
  const [editForm, setEditForm] = useState({ name: "", unit: "", receptionQty: "", storeQty: "", minStockLevel: "", notes: "" });

  const load = () => {
    const stored = readJson<ReceptionItem[]>(INV_RECEPTION_ITEMS_KEY) ?? [];
    setItems(stored.filter((i) => !i.deletedAt));
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("orange-hotel-storage-updated", handler);
    return () => window.removeEventListener("orange-hotel-storage-updated", handler);
  }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (filter === "low") list = list.filter((i) => i.receptionQty < i.minStockLevel);
    if (filter === "ok") list = list.filter((i) => i.receptionQty >= i.minStockLevel);
    return list;
  }, [items, search, filter]);

  const handleAddItem = () => {
    if (!form.name.trim() || !form.unit.trim()) return;
    const now = Date.now();
    const newItem: ReceptionItem = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      unit: form.unit.trim(),
      receptionQty: Math.max(0, Number(form.receptionQty) || 0),
      storeQty: Math.max(0, Number(form.storeQty) || 0),
      minStockLevel: Math.max(0, Number(form.minStockLevel) || 5),
      notes: form.notes.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    const all = readJson<ReceptionItem[]>(INV_RECEPTION_ITEMS_KEY) ?? [];
    all.push(newItem);
    void writeJson(INV_RECEPTION_ITEMS_KEY, all);
    setItems(all.filter((i) => !i.deletedAt));
    setForm({ name: "", unit: "", receptionQty: "", storeQty: "", minStockLevel: "5", notes: "" });
    setAddItemOpen(false);
  };

  const handleAddStock = () => {
    if (!addStockForm.itemId) return;
    const qty = Math.max(0, Number(addStockForm.quantity) || 0);
    if (qty === 0) return;
    const all = readJson<ReceptionItem[]>(INV_RECEPTION_ITEMS_KEY) ?? [];
    const updated = all.map((i) => {
      if (i.id !== addStockForm.itemId) return i;
      return {
        ...i,
        receptionQty: addStockForm.destination === "reception" ? i.receptionQty + qty : i.receptionQty,
        storeQty: addStockForm.destination === "store" ? i.storeQty + qty : i.storeQty,
        updatedAt: Date.now(),
      };
    });
    void writeJson(INV_RECEPTION_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    setAddStockForm({ itemId: "", destination: "reception", quantity: "" });
    setAddStockOpen(false);
  };

  const handleTransfer = () => {
    if (!transferForm.itemId) return;
    const qty = Math.max(0, Number(transferForm.quantity) || 0);
    if (qty === 0) return;
    const all = readJson<ReceptionItem[]>(INV_RECEPTION_ITEMS_KEY) ?? [];
    const updated = all.map((i) => {
      if (i.id !== transferForm.itemId) return i;
      if (transferForm.direction === "store-to-reception") {
        const actual = Math.min(qty, i.storeQty);
        return { ...i, storeQty: i.storeQty - actual, receptionQty: i.receptionQty + actual, updatedAt: Date.now() };
      } else {
        const actual = Math.min(qty, i.receptionQty);
        return { ...i, receptionQty: i.receptionQty - actual, storeQty: i.storeQty + actual, updatedAt: Date.now() };
      }
    });
    void writeJson(INV_RECEPTION_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    setTransferForm({ itemId: "", direction: "store-to-reception", quantity: "" });
    setTransferOpen(false);
  };

  const handleEdit = () => {
    if (!editItem) return;
    const all = readJson<ReceptionItem[]>(INV_RECEPTION_ITEMS_KEY) ?? [];
    const updated = all.map((i) => {
      if (i.id !== editItem.id) return i;
      return {
        ...i,
        name: editForm.name.trim() || i.name,
        unit: editForm.unit.trim() || i.unit,
        receptionQty: Math.max(0, Number(editForm.receptionQty) || 0),
        storeQty: Math.max(0, Number(editForm.storeQty) || 0),
        minStockLevel: Math.max(0, Number(editForm.minStockLevel) || 5),
        notes: editForm.notes.trim() || undefined,
        updatedAt: Date.now(),
      };
    });
    void writeJson(INV_RECEPTION_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    setEditItem(null);
  };

  const handleDelete = () => {
    if (!deleteItem) return;
    const all = readJson<ReceptionItem[]>(INV_RECEPTION_ITEMS_KEY) ?? [];
    const updated = all.map((i) => (i.id === deleteItem.id ? { ...i, deletedAt: Date.now() } : i));
    void writeJson(INV_RECEPTION_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    setDeleteItem(null);
  };

  const openEdit = (item: ReceptionItem) => {
    setEditForm({ name: item.name, unit: item.unit, receptionQty: String(item.receptionQty), storeQty: String(item.storeQty), minStockLevel: String(item.minStockLevel), notes: item.notes ?? "" });
    setEditItem(item);
  };

  const handleDownloadCSV = () => {
    const headers = ["#", "Item Name", "Reception Qty", "Store Qty", "Total Qty", "Min Stock Level", "Unit"];
    const rows = filtered.map((item, idx) => [String(idx + 1), item.name, String(item.receptionQty), String(item.storeQty), String(item.receptionQty + item.storeQty), String(item.minStockLevel), item.unit]);
    downloadCSV("reception-stock.csv", headers, rows);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest">Reception Stock</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} items in inventory</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAddItemOpen(true)} className="font-black uppercase tracking-widest text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Item
          </Button>
          <Button variant="outline" onClick={() => setAddStockOpen(true)} className="font-black uppercase tracking-widest text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Stock
          </Button>
          <Button variant="outline" onClick={() => setTransferOpen(true)} className="font-black uppercase tracking-widest text-xs gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer
          </Button>
          <Button variant="outline" onClick={handleDownloadCSV} className="font-black uppercase tracking-widest text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <div className="flex gap-2">
          {(["all", "ok", "low"] as FilterType[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${filter === f ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
              {f === "low" ? "Low Stock" : f === "ok" ? "OK" : f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 w-10">#</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Item Name</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Reception Qty</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Store Qty</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Total Qty</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Min Stock Level</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Unit</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-16 text-gray-400 text-sm">No items found.</TableCell></TableRow>
            ) : (
              filtered.map((item, idx) => {
                const total = item.receptionQty + item.storeQty;
                const isLow = item.receptionQty < item.minStockLevel;
                return (
                  <TableRow key={item.id} className="hover:bg-gray-50">
                    <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{item.name}</span>
                        {isLow && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">LOW</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{item.receptionQty}</TableCell>
                    <TableCell className="text-right text-sm">{item.storeQty}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{total}</TableCell>
                    <TableCell className="text-right text-sm">{item.minStockLevel}</TableCell>
                    <TableCell className="text-xs text-gray-500">{item.unit}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteItem(item)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Item */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Add Reception Item</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Add a new item to the reception inventory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className={labelClass("mb-1 block")}>Item Name</label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Pens" /></div>
            <div><label className={labelClass("mb-1 block")}>Unit</label><Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="e.g. pcs, box" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass("mb-1 block")}>Reception Qty</label><Input type="number" min={0} value={form.receptionQty} onChange={(e) => setForm((f) => ({ ...f, receptionQty: e.target.value }))} placeholder="0" /></div>
              <div><label className={labelClass("mb-1 block")}>Store Qty</label><Input type="number" min={0} value={form.storeQty} onChange={(e) => setForm((f) => ({ ...f, storeQty: e.target.value }))} placeholder="0" /></div>
            </div>
            <div><label className={labelClass("mb-1 block")}>Min Stock Level</label><Input type="number" min={0} value={form.minStockLevel} onChange={(e) => setForm((f) => ({ ...f, minStockLevel: e.target.value }))} placeholder="5" /></div>
            <div><label className={labelClass("mb-1 block")}>Notes (optional)</label><Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={handleAddItem} className="font-black uppercase tracking-widest text-xs">Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Stock */}
      <Dialog open={addStockOpen} onOpenChange={setAddStockOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Add Stock</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Add stock to an existing item.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass("mb-1 block")}>Item</label>
              <select value={addStockForm.itemId} onChange={(e) => setAddStockForm((f) => ({ ...f, itemId: e.target.value }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Select item...</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Destination</label>
              <div className="flex gap-2">
                {(["reception", "store"] as const).map((d) => (
                  <button key={d} onClick={() => setAddStockForm((f) => ({ ...f, destination: d }))}
                    className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${addStockForm.destination === d ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>{d}</button>
                ))}
              </div>
            </div>
            <div><label className={labelClass("mb-1 block")}>Quantity</label><Input type="number" min={0} value={addStockForm.quantity} onChange={(e) => setAddStockForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="0" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStockOpen(false)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={handleAddStock} className="font-black uppercase tracking-widest text-xs">Add Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Transfer Stock</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Move stock between Reception and Store.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass("mb-1 block")}>Item</label>
              <select value={transferForm.itemId} onChange={(e) => setTransferForm((f) => ({ ...f, itemId: e.target.value }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Select item...</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name} (Reception: {i.receptionQty}, Store: {i.storeQty})</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Direction</label>
              <div className="flex gap-2">
                {([["store-to-reception", "Store → Reception"], ["reception-to-store", "Reception → Store"]] as const).map(([d, label]) => (
                  <button key={d} onClick={() => setTransferForm((f) => ({ ...f, direction: d }))}
                    className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${transferForm.direction === d ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>{label}</button>
                ))}
              </div>
            </div>
            <div><label className={labelClass("mb-1 block")}>Quantity</label><Input type="number" min={0} value={transferForm.quantity} onChange={(e) => setTransferForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="0" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={handleTransfer} className="font-black uppercase tracking-widest text-xs">Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Edit Item</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Update reception item details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className={labelClass("mb-1 block")}>Item Name</label><Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><label className={labelClass("mb-1 block")}>Unit</label><Input value={editForm.unit} onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelClass("mb-1 block")}>Reception Qty</label><Input type="number" min={0} value={editForm.receptionQty} onChange={(e) => setEditForm((f) => ({ ...f, receptionQty: e.target.value }))} /></div>
              <div><label className={labelClass("mb-1 block")}>Store Qty</label><Input type="number" min={0} value={editForm.storeQty} onChange={(e) => setEditForm((f) => ({ ...f, storeQty: e.target.value }))} /></div>
              <div><label className={labelClass("mb-1 block")}>Min Level</label><Input type="number" min={0} value={editForm.minStockLevel} onChange={(e) => setEditForm((f) => ({ ...f, minStockLevel: e.target.value }))} /></div>
            </div>
            <div><label className={labelClass("mb-1 block")}>Notes</label><Input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={handleEdit} className="font-black uppercase tracking-widest text-xs">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Delete Item</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Are you sure you want to delete <strong>{deleteItem?.name}</strong>?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={handleDelete} className="font-black uppercase tracking-widest text-xs bg-red-600 hover:bg-red-700">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
