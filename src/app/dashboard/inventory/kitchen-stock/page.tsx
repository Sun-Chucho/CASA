"use client";

import { useEffect, useState, useMemo } from "react";
import { readJson, writeJson } from "@/app/lib/storage";
import {
  KitchenItem,
  KitchenMovement,
  INV_KITCHEN_ITEMS_KEY,
  INV_KITCHEN_MOVEMENTS_KEY,
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
import { Pencil, Trash2, Plus, ArrowLeftRight, AlertTriangle, Download } from "lucide-react";

type FilterType = "all" | "good" | "broken" | "low";

function labelClass(extra = "") {
  return `font-black uppercase tracking-widest text-[10px] text-gray-500 ${extra}`;
}

export default function KitchenStockPage() {
  const [items, setItems] = useState<KitchenItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  // Modal states
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [brokenOpen, setBrokenOpen] = useState(false);
  const [editItem, setEditItem] = useState<KitchenItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<KitchenItem | null>(null);

  // Form state — Add Item
  const [form, setForm] = useState({
    name: "",
    unit: "",
    quantity: "",
    destination: "store" as "store" | "kitchen",
    condition: "good" as "good" | "broken",
    notes: "",
  });

  // Form state — Add Stock
  const [addStockForm, setAddStockForm] = useState({ itemId: "", destination: "store" as "store" | "kitchen", quantity: "" });

  // Form state — Transfer
  const [transferForm, setTransferForm] = useState({ itemId: "", direction: "store-to-kitchen" as "store-to-kitchen" | "kitchen-to-store", quantity: "" });

  // Form state — Broken
  const [brokenForm, setBrokenForm] = useState({ itemId: "", location: "store" as "store" | "kitchen", quantity: "" });

  // Form state — Edit
  const [editForm, setEditForm] = useState({ name: "", unit: "", storeQty: "", kitchenQty: "", brokenQty: "", notes: "" });

  const load = () => {
    const stored = readJson<KitchenItem[]>(INV_KITCHEN_ITEMS_KEY) ?? [];
    setItems(stored.filter((i) => !i.deletedAt));
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("orange-hotel-storage-updated", handler);
    return () => window.removeEventListener("orange-hotel-storage-updated", handler);
  }, []);

  const saveMovement = (mov: Omit<KitchenMovement, "id" | "createdAt">) => {
    const movements = readJson<KitchenMovement[]>(INV_KITCHEN_MOVEMENTS_KEY) ?? [];
    movements.push({ ...mov, id: crypto.randomUUID(), createdAt: Date.now() });
    void writeJson(INV_KITCHEN_MOVEMENTS_KEY, movements);
  };

  const saveItems = (updated: KitchenItem[]) => {
    const all = readJson<KitchenItem[]>(INV_KITCHEN_ITEMS_KEY) ?? [];
    const map = new Map(all.map((i) => [i.id, i]));
    updated.forEach((i) => map.set(i.id, i));
    void writeJson(INV_KITCHEN_ITEMS_KEY, Array.from(map.values()));
    setItems(updated.filter((i) => !i.deletedAt));
  };

  const filtered = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (filter === "good") list = list.filter((i) => i.brokenQty === 0);
    if (filter === "broken") list = list.filter((i) => i.brokenQty > 0);
    if (filter === "low") list = list.filter((i) => i.storeQty + i.kitchenQty < 5);
    return list;
  }, [items, search, filter]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleAddItem = () => {
    if (!form.name.trim() || !form.unit.trim()) return;
    const qty = Math.max(0, Number(form.quantity) || 0);
    const now = Date.now();
    const newItem: KitchenItem = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      unit: form.unit.trim(),
      storeQty: form.destination === "store" && form.condition === "good" ? qty : 0,
      kitchenQty: form.destination === "kitchen" && form.condition === "good" ? qty : 0,
      brokenQty: form.condition === "broken" ? qty : 0,
      notes: form.notes.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    const all = readJson<KitchenItem[]>(INV_KITCHEN_ITEMS_KEY) ?? [];
    all.push(newItem);
    void writeJson(INV_KITCHEN_ITEMS_KEY, all);
    setItems(all.filter((i) => !i.deletedAt));
    saveMovement({ itemId: newItem.id, itemName: newItem.name, type: "add", toLocation: form.destination, quantity: qty, notes: form.notes.trim() || undefined });
    setForm({ name: "", unit: "", quantity: "", destination: "store", condition: "good", notes: "" });
    setAddItemOpen(false);
  };

  const handleAddStock = () => {
    if (!addStockForm.itemId) return;
    const qty = Math.max(0, Number(addStockForm.quantity) || 0);
    if (qty === 0) return;
    const all = readJson<KitchenItem[]>(INV_KITCHEN_ITEMS_KEY) ?? [];
    const updated = all.map((i) => {
      if (i.id !== addStockForm.itemId) return i;
      return {
        ...i,
        storeQty: addStockForm.destination === "store" ? i.storeQty + qty : i.storeQty,
        kitchenQty: addStockForm.destination === "kitchen" ? i.kitchenQty + qty : i.kitchenQty,
        updatedAt: Date.now(),
      };
    });
    void writeJson(INV_KITCHEN_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    const item = all.find((i) => i.id === addStockForm.itemId);
    if (item) saveMovement({ itemId: item.id, itemName: item.name, type: "add", toLocation: addStockForm.destination, quantity: qty });
    setAddStockForm({ itemId: "", destination: "store", quantity: "" });
    setAddStockOpen(false);
  };

  const handleTransfer = () => {
    if (!transferForm.itemId) return;
    const qty = Math.max(0, Number(transferForm.quantity) || 0);
    if (qty === 0) return;
    const all = readJson<KitchenItem[]>(INV_KITCHEN_ITEMS_KEY) ?? [];
    const updated = all.map((i) => {
      if (i.id !== transferForm.itemId) return i;
      if (transferForm.direction === "store-to-kitchen") {
        const actual = Math.min(qty, i.storeQty);
        return { ...i, storeQty: i.storeQty - actual, kitchenQty: i.kitchenQty + actual, updatedAt: Date.now() };
      } else {
        const actual = Math.min(qty, i.kitchenQty);
        return { ...i, kitchenQty: i.kitchenQty - actual, storeQty: i.storeQty + actual, updatedAt: Date.now() };
      }
    });
    void writeJson(INV_KITCHEN_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    const item = all.find((i) => i.id === transferForm.itemId);
    if (item) saveMovement({
      itemId: item.id,
      itemName: item.name,
      type: "transfer",
      fromLocation: transferForm.direction === "store-to-kitchen" ? "store" : "kitchen",
      toLocation: transferForm.direction === "store-to-kitchen" ? "kitchen" : "store",
      quantity: qty,
    });
    setTransferForm({ itemId: "", direction: "store-to-kitchen", quantity: "" });
    setTransferOpen(false);
  };

  const handleRecordBroken = () => {
    if (!brokenForm.itemId) return;
    const qty = Math.max(0, Number(brokenForm.quantity) || 0);
    if (qty === 0) return;
    const all = readJson<KitchenItem[]>(INV_KITCHEN_ITEMS_KEY) ?? [];
    const updated = all.map((i) => {
      if (i.id !== brokenForm.itemId) return i;
      const deductStore = brokenForm.location === "store" ? Math.min(qty, i.storeQty) : 0;
      const deductKitchen = brokenForm.location === "kitchen" ? Math.min(qty, i.kitchenQty) : 0;
      return {
        ...i,
        storeQty: i.storeQty - deductStore,
        kitchenQty: i.kitchenQty - deductKitchen,
        brokenQty: i.brokenQty + qty,
        updatedAt: Date.now(),
      };
    });
    void writeJson(INV_KITCHEN_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    const item = all.find((i) => i.id === brokenForm.itemId);
    if (item) saveMovement({ itemId: item.id, itemName: item.name, type: "broken", fromLocation: brokenForm.location, quantity: qty });
    setBrokenForm({ itemId: "", location: "store", quantity: "" });
    setBrokenOpen(false);
  };

  const handleEdit = () => {
    if (!editItem) return;
    const all = readJson<KitchenItem[]>(INV_KITCHEN_ITEMS_KEY) ?? [];
    const updated = all.map((i) => {
      if (i.id !== editItem.id) return i;
      return {
        ...i,
        name: editForm.name.trim() || i.name,
        unit: editForm.unit.trim() || i.unit,
        storeQty: Math.max(0, Number(editForm.storeQty) || 0),
        kitchenQty: Math.max(0, Number(editForm.kitchenQty) || 0),
        brokenQty: Math.max(0, Number(editForm.brokenQty) || 0),
        notes: editForm.notes.trim() || undefined,
        updatedAt: Date.now(),
      };
    });
    void writeJson(INV_KITCHEN_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    setEditItem(null);
  };

  const handleDelete = () => {
    if (!deleteItem) return;
    const all = readJson<KitchenItem[]>(INV_KITCHEN_ITEMS_KEY) ?? [];
    const updated = all.map((i) => (i.id === deleteItem.id ? { ...i, deletedAt: Date.now() } : i));
    void writeJson(INV_KITCHEN_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    setDeleteItem(null);
  };

  const handleDownloadCSV = () => {
    const headers = ["#", "Item Name", "Store Qty", "Kitchen Qty", "Total Qty", "Broken Qty", "Good Qty", "Unit"];
    const rows = filtered.map((item, idx) => {
      const total = item.storeQty + item.kitchenQty;
      const good = total - item.brokenQty;
      return [String(idx + 1), item.name, String(item.storeQty), String(item.kitchenQty), String(total), String(item.brokenQty), String(good), item.unit];
    });
    downloadCSV("kitchen-stock.csv", headers, rows);
  };

  const openEdit = (item: KitchenItem) => {
    setEditForm({
      name: item.name,
      unit: item.unit,
      storeQty: String(item.storeQty),
      kitchenQty: String(item.kitchenQty),
      brokenQty: String(item.brokenQty),
      notes: item.notes ?? "",
    });
    setEditItem(item);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest">Kitchen Stock</h1>
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
          <Button variant="outline" onClick={() => setBrokenOpen(true)} className="font-black uppercase tracking-widest text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50">
            <AlertTriangle className="w-3.5 h-3.5" /> Broken
          </Button>
          <Button variant="outline" onClick={handleDownloadCSV} className="font-black uppercase tracking-widest text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-2">
          {(["all", "good", "broken", "low"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${
                filter === f ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {f === "low" ? "Low Stock" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 w-10">#</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Item Name</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Store Qty</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Kitchen Qty</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Total Qty</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Broken Qty</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Good Qty</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Unit</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-16 text-gray-400 text-sm">
                  No items found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item, idx) => {
                const total = item.storeQty + item.kitchenQty;
                const good = total - item.brokenQty;
                const isLow = total < 5;
                return (
                  <TableRow key={item.id} className="hover:bg-gray-50">
                    <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{item.name}</span>
                        {isLow && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">LOW</Badge>}
                        {item.brokenQty > 0 && <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-amber-600 border-amber-300">BROKEN</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{item.storeQty}</TableCell>
                    <TableCell className="text-right text-sm">{item.kitchenQty}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{total}</TableCell>
                    <TableCell className="text-right text-sm text-red-600">{item.brokenQty}</TableCell>
                    <TableCell className="text-right text-sm text-green-600 font-semibold">{good}</TableCell>
                    <TableCell className="text-xs text-gray-500">{item.unit}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteItem(item)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Add Item Modal ───────────────────────────────────────────────── */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Add New Item</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Add a new item to the kitchen inventory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass("mb-1 block")}>Item Name</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Chef Knife" />
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Unit</label>
              <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="e.g. pcs, kg, L" />
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Quantity</label>
              <Input type="number" min={0} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Destination</label>
              <div className="flex gap-2">
                {(["store", "kitchen"] as const).map((d) => (
                  <button key={d} onClick={() => setForm((f) => ({ ...f, destination: d }))}
                    className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${form.destination === d ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Condition</label>
              <div className="flex gap-2">
                {(["good", "broken"] as const).map((c) => (
                  <button key={c} onClick={() => setForm((f) => ({ ...f, condition: c }))}
                    className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${form.condition === c ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Notes (optional)</label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={handleAddItem} className="font-black uppercase tracking-widest text-xs">Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Stock Modal ─────────────────────────────────────────────── */}
      <Dialog open={addStockOpen} onOpenChange={setAddStockOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Add Stock</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Add stock to an existing item.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass("mb-1 block")}>Item</label>
              <select value={addStockForm.itemId} onChange={(e) => setAddStockForm((f) => ({ ...f, itemId: e.target.value }))}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Select item...</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Destination</label>
              <div className="flex gap-2">
                {(["store", "kitchen"] as const).map((d) => (
                  <button key={d} onClick={() => setAddStockForm((f) => ({ ...f, destination: d }))}
                    className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${addStockForm.destination === d ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Quantity</label>
              <Input type="number" min={0} value={addStockForm.quantity} onChange={(e) => setAddStockForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStockOpen(false)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={handleAddStock} className="font-black uppercase tracking-widest text-xs">Add Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Transfer Modal ──────────────────────────────────────────────── */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Transfer Stock</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Move stock between Store and Kitchen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass("mb-1 block")}>Item</label>
              <select value={transferForm.itemId} onChange={(e) => setTransferForm((f) => ({ ...f, itemId: e.target.value }))}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Select item...</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name} (Store: {i.storeQty}, Kitchen: {i.kitchenQty})</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Direction</label>
              <div className="flex gap-2">
                {([["store-to-kitchen", "Store → Kitchen"], ["kitchen-to-store", "Kitchen → Store"]] as const).map(([d, label]) => (
                  <button key={d} onClick={() => setTransferForm((f) => ({ ...f, direction: d }))}
                    className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${transferForm.direction === d ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Quantity</label>
              <Input type="number" min={0} value={transferForm.quantity} onChange={(e) => setTransferForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={handleTransfer} className="font-black uppercase tracking-widest text-xs">Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Record Broken Modal ──────────────────────────────────────────── */}
      <Dialog open={brokenOpen} onOpenChange={setBrokenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Record Broken</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Record damaged or broken items.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass("mb-1 block")}>Item</label>
              <select value={brokenForm.itemId} onChange={(e) => setBrokenForm((f) => ({ ...f, itemId: e.target.value }))}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Select item...</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Location</label>
              <div className="flex gap-2">
                {(["store", "kitchen"] as const).map((l) => (
                  <button key={l} onClick={() => setBrokenForm((f) => ({ ...f, location: l }))}
                    className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${brokenForm.location === l ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Broken Quantity</label>
              <Input type="number" min={0} value={brokenForm.quantity} onChange={(e) => setBrokenForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBrokenOpen(false)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={handleRecordBroken} className="font-black uppercase tracking-widest text-xs bg-red-600 hover:bg-red-700">Record Broken</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Modal ───────────────────────────────────────────────────── */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Edit Item</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Update item details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass("mb-1 block")}>Item Name</label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Unit</label>
              <Input value={editForm.unit} onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass("mb-1 block")}>Store Qty</label>
                <Input type="number" min={0} value={editForm.storeQty} onChange={(e) => setEditForm((f) => ({ ...f, storeQty: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass("mb-1 block")}>Kitchen Qty</label>
                <Input type="number" min={0} value={editForm.kitchenQty} onChange={(e) => setEditForm((f) => ({ ...f, kitchenQty: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass("mb-1 block")}>Broken Qty</label>
                <Input type="number" min={0} value={editForm.brokenQty} onChange={(e) => setEditForm((f) => ({ ...f, brokenQty: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Notes</label>
              <Input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={handleEdit} className="font-black uppercase tracking-widest text-xs">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Modal ────────────────────────────────────── */}
      <Dialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Delete Item</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Are you sure you want to delete <strong>{deleteItem?.name}</strong>? This action cannot be undone.
            </DialogDescription>
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
