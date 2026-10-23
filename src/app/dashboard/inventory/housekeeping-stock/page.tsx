"use client";

import { useEffect, useState, useMemo } from "react";
import { readJson, writeJson } from "@/app/lib/storage";
import {
  HousekeepingItem,
  INV_HOUSEKEEPING_ITEMS_KEY,
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
import { Pencil, Trash2, Plus, MinusCircle, Download } from "lucide-react";

function labelClass(extra = "") {
  return `font-black uppercase tracking-widest text-[10px] text-gray-500 ${extra}`;
}

export default function HousekeepingStockPage() {
  const [items, setItems] = useState<HousekeepingItem[]>([]);
  const [search, setSearch] = useState("");

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [issueStockOpen, setIssueStockOpen] = useState(false);
  const [editItem, setEditItem] = useState<HousekeepingItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<HousekeepingItem | null>(null);

  const [form, setForm] = useState({ name: "", unit: "", openingStock: "", notes: "" });
  const [addStockForm, setAddStockForm] = useState({ itemId: "", quantity: "" });
  const [issueForm, setIssueForm] = useState({ itemId: "", quantity: "" });
  const [editForm, setEditForm] = useState({ name: "", unit: "", openingStock: "", stockAdded: "", stockIssued: "", notes: "" });

  const load = () => {
    const stored = readJson<HousekeepingItem[]>(INV_HOUSEKEEPING_ITEMS_KEY) ?? [];
    setItems(stored.filter((i) => !i.deletedAt));
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("orange-hotel-storage-updated", handler);
    return () => window.removeEventListener("orange-hotel-storage-updated", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const handleAddItem = () => {
    if (!form.name.trim() || !form.unit.trim()) return;
    const now = Date.now();
    const newItem: HousekeepingItem = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      unit: form.unit.trim(),
      openingStock: Math.max(0, Number(form.openingStock) || 0),
      stockAdded: 0,
      stockIssued: 0,
      notes: form.notes.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    const all = readJson<HousekeepingItem[]>(INV_HOUSEKEEPING_ITEMS_KEY) ?? [];
    all.push(newItem);
    void writeJson(INV_HOUSEKEEPING_ITEMS_KEY, all);
    setItems(all.filter((i) => !i.deletedAt));
    setForm({ name: "", unit: "", openingStock: "", notes: "" });
    setAddItemOpen(false);
  };

  const handleAddStock = () => {
    if (!addStockForm.itemId) return;
    const qty = Math.max(0, Number(addStockForm.quantity) || 0);
    if (qty === 0) return;
    const all = readJson<HousekeepingItem[]>(INV_HOUSEKEEPING_ITEMS_KEY) ?? [];
    const updated = all.map((i) => i.id !== addStockForm.itemId ? i : { ...i, stockAdded: i.stockAdded + qty, updatedAt: Date.now() });
    void writeJson(INV_HOUSEKEEPING_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    setAddStockForm({ itemId: "", quantity: "" });
    setAddStockOpen(false);
  };

  const handleIssueStock = () => {
    if (!issueForm.itemId) return;
    const qty = Math.max(0, Number(issueForm.quantity) || 0);
    if (qty === 0) return;
    const all = readJson<HousekeepingItem[]>(INV_HOUSEKEEPING_ITEMS_KEY) ?? [];
    const updated = all.map((i) => i.id !== issueForm.itemId ? i : { ...i, stockIssued: i.stockIssued + qty, updatedAt: Date.now() });
    void writeJson(INV_HOUSEKEEPING_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    setIssueForm({ itemId: "", quantity: "" });
    setIssueStockOpen(false);
  };

  const handleEdit = () => {
    if (!editItem) return;
    const all = readJson<HousekeepingItem[]>(INV_HOUSEKEEPING_ITEMS_KEY) ?? [];
    const updated = all.map((i) => {
      if (i.id !== editItem.id) return i;
      return {
        ...i,
        name: editForm.name.trim() || i.name,
        unit: editForm.unit.trim() || i.unit,
        openingStock: Math.max(0, Number(editForm.openingStock) || 0),
        stockAdded: Math.max(0, Number(editForm.stockAdded) || 0),
        stockIssued: Math.max(0, Number(editForm.stockIssued) || 0),
        notes: editForm.notes.trim() || undefined,
        updatedAt: Date.now(),
      };
    });
    void writeJson(INV_HOUSEKEEPING_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    setEditItem(null);
  };

  const handleDelete = () => {
    if (!deleteItem) return;
    const all = readJson<HousekeepingItem[]>(INV_HOUSEKEEPING_ITEMS_KEY) ?? [];
    const updated = all.map((i) => (i.id === deleteItem.id ? { ...i, deletedAt: Date.now() } : i));
    void writeJson(INV_HOUSEKEEPING_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    setDeleteItem(null);
  };

  const openEdit = (item: HousekeepingItem) => {
    setEditForm({ name: item.name, unit: item.unit, openingStock: String(item.openingStock), stockAdded: String(item.stockAdded), stockIssued: String(item.stockIssued), notes: item.notes ?? "" });
    setEditItem(item);
  };

  const handleDownloadCSV = () => {
    const headers = ["#", "Item Name", "Opening Stock", "Stock Added", "Stock Issued", "Current Balance", "Unit", "Last Updated"];
    const rows = filtered.map((item, idx) => {
      const balance = item.openingStock + item.stockAdded - item.stockIssued;
      return [String(idx + 1), item.name, String(item.openingStock), String(item.stockAdded), String(item.stockIssued), String(balance), item.unit, new Date(item.updatedAt).toLocaleDateString()];
    });
    downloadCSV("housekeeping-stock.csv", headers, rows);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest">Housekeeping Stock</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} items tracked</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAddItemOpen(true)} className="font-black uppercase tracking-widest text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Item
          </Button>
          <Button variant="outline" onClick={() => setAddStockOpen(true)} className="font-black uppercase tracking-widest text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Stock
          </Button>
          <Button variant="outline" onClick={() => setIssueStockOpen(true)} className="font-black uppercase tracking-widest text-xs gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50">
            <MinusCircle className="w-3.5 h-3.5" /> Issue Stock
          </Button>
          <Button variant="outline" onClick={handleDownloadCSV} className="font-black uppercase tracking-widest text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 w-10">#</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Item Name</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Opening Stock</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Stock Added</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Stock Issued</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Current Balance</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Unit</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Last Updated</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-16 text-gray-400 text-sm">No items found.</TableCell></TableRow>
            ) : (
              filtered.map((item, idx) => {
                const balance = item.openingStock + item.stockAdded - item.stockIssued;
                return (
                  <TableRow key={item.id} className="hover:bg-gray-50">
                    <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                    <TableCell><span className="font-semibold text-sm">{item.name}</span></TableCell>
                    <TableCell className="text-right text-sm">{item.openingStock}</TableCell>
                    <TableCell className="text-right text-sm text-green-600">{item.stockAdded}</TableCell>
                    <TableCell className="text-right text-sm text-red-600">{item.stockIssued}</TableCell>
                    <TableCell className="text-right text-sm font-bold">{balance}</TableCell>
                    <TableCell className="text-xs text-gray-500">{item.unit}</TableCell>
                    <TableCell className="text-xs text-gray-400">{new Date(item.updatedAt).toLocaleDateString()}</TableCell>
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
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Add Housekeeping Item</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Add a new item to housekeeping inventory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className={labelClass("mb-1 block")}>Item Name</label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Towels" /></div>
            <div><label className={labelClass("mb-1 block")}>Unit</label><Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="e.g. pcs, roll" /></div>
            <div><label className={labelClass("mb-1 block")}>Opening Stock</label><Input type="number" min={0} value={form.openingStock} onChange={(e) => setForm((f) => ({ ...f, openingStock: e.target.value }))} placeholder="0" /></div>
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
            <DialogDescription className="text-xs text-gray-500">Increment the stock added for an item.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass("mb-1 block")}>Item</label>
              <select value={addStockForm.itemId} onChange={(e) => setAddStockForm((f) => ({ ...f, itemId: e.target.value }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Select item...</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div><label className={labelClass("mb-1 block")}>Quantity to Add</label><Input type="number" min={0} value={addStockForm.quantity} onChange={(e) => setAddStockForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="0" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStockOpen(false)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={handleAddStock} className="font-black uppercase tracking-widest text-xs">Add Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Stock */}
      <Dialog open={issueStockOpen} onOpenChange={setIssueStockOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Issue Stock</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Increment the stock issued for an item.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass("mb-1 block")}>Item</label>
              <select value={issueForm.itemId} onChange={(e) => setIssueForm((f) => ({ ...f, itemId: e.target.value }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Select item...</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name} (Balance: {i.openingStock + i.stockAdded - i.stockIssued})</option>)}
              </select>
            </div>
            <div><label className={labelClass("mb-1 block")}>Quantity to Issue</label><Input type="number" min={0} value={issueForm.quantity} onChange={(e) => setIssueForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="0" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueStockOpen(false)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={handleIssueStock} className="font-black uppercase tracking-widest text-xs bg-orange-500 hover:bg-orange-600">Issue Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Edit Item</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Update housekeeping item details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className={labelClass("mb-1 block")}>Item Name</label><Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><label className={labelClass("mb-1 block")}>Unit</label><Input value={editForm.unit} onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelClass("mb-1 block")}>Opening Stock</label><Input type="number" min={0} value={editForm.openingStock} onChange={(e) => setEditForm((f) => ({ ...f, openingStock: e.target.value }))} /></div>
              <div><label className={labelClass("mb-1 block")}>Added</label><Input type="number" min={0} value={editForm.stockAdded} onChange={(e) => setEditForm((f) => ({ ...f, stockAdded: e.target.value }))} /></div>
              <div><label className={labelClass("mb-1 block")}>Issued</label><Input type="number" min={0} value={editForm.stockIssued} onChange={(e) => setEditForm((f) => ({ ...f, stockIssued: e.target.value }))} /></div>
            </div>
            <div><label className={labelClass("mb-1 block")}>Notes</label><Input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} /></div>
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
