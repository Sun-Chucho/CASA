"use client";

import { useEffect, useState, useMemo } from "react";
import { readJson, writeJson } from "@/app/lib/storage";
import { importPhysicalStock } from "@/app/lib/inventory-physical-import";
import { transactSyncedStorageValue } from "@/app/lib/firebase-sync";
import { readStoredRole } from "@/app/lib/auth";
import { readActiveSessionUsername } from "@/app/lib/login-profiles";
import {
  BarItem,
  BarMovement,
  INV_BAR_ITEMS_KEY,
  INV_BAR_MOVEMENTS_KEY,
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

export default function BarStockPage() {
  const [items, setItems] = useState<BarItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [importReport, setImportReport] = useState("");

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [brokenOpen, setBrokenOpen] = useState(false);
  const [editItem, setEditItem] = useState<BarItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<BarItem | null>(null);

  const [form, setForm] = useState({
    name: "",
    unit: "",
    quantity: "",
    destination: "store" as "store" | "bar",
    condition: "good" as "good" | "broken",
    sellingPrice: "",
    buyingPrice: "",
    notes: "",
  });

  const [addStockForm, setAddStockForm] = useState({ itemId: "", destination: "store" as "store" | "bar", quantity: "" });
  const [transferForm, setTransferForm] = useState({ itemId: "", direction: "store-to-bar" as "store-to-bar" | "bar-to-store", quantity: "" });
  const [brokenForm, setBrokenForm] = useState({ itemId: "", location: "store" as "store" | "bar", quantity: "" });
  const [editForm, setEditForm] = useState({ name: "", unit: "", storeQty: "", barQty: "", brokenQty: "", sellingPrice: "", buyingPrice: "", notes: "" });
  const [editReason, setEditReason] = useState("");

  const load = () => {
    const stored = readJson<BarItem[]>(INV_BAR_ITEMS_KEY) ?? [];
    setItems(stored.filter((i) => !i.deletedAt));
  };

  useEffect(() => {
    load();
    void importPhysicalStock("bar").then((report) => { setImportReport(`Physical stock import: ${report.imported} imported, ${report.updated} linked, ${report.skipped} skipped, ${report.flagged} flagged for review.`); load(); }).catch(() => setImportReport("Physical stock import could not complete. Reopen this page when the database is available."));
    const handler = () => load();
    window.addEventListener("orange-hotel-storage-updated", handler);
    return () => window.removeEventListener("orange-hotel-storage-updated", handler);
  }, []);

  const saveMovement = (mov: Omit<BarMovement, "id" | "createdAt">) => {
    const entry = { ...mov, id: crypto.randomUUID(), user: readActiveSessionUsername(readStoredRole() ?? "unknown"), createdAt: Date.now() };
    void transactSyncedStorageValue<BarMovement[]>(INV_BAR_MOVEMENTS_KEY, (current) => [...(current ?? []), entry]).catch((error) => console.error("Bar movement was not recorded", error));
  };

  const filtered = useMemo(() => {
    let list = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (filter === "good") list = list.filter((i) => i.brokenQty === 0);
    if (filter === "broken") list = list.filter((i) => i.brokenQty > 0);
    if (filter === "low") list = list.filter((i) => i.storeQty + i.barQty < 5);
    return list;
  }, [items, search, filter]);

  const handleAddItem = async () => {
    if (!form.name.trim() || !form.unit.trim()) return;
    if (items.some((item) => item.name.trim().toLowerCase() === form.name.trim().toLowerCase())) return window.alert("This item exists. Use Add Stock.");
    const qty = Number(form.quantity);
    if (!Number.isInteger(qty) || qty < 0) return window.alert("Enter a valid non-negative whole quantity.");
    const now = Date.now();
    const newItem: BarItem = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      unit: form.unit.trim(),
      storeQty: form.destination === "store" && form.condition === "good" ? qty : 0,
      barQty: form.destination === "bar" && form.condition === "good" ? qty : 0,
      brokenQty: form.condition === "broken" ? qty : 0,
      sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : undefined,
      buyingPrice: form.buyingPrice ? Number(form.buyingPrice) : undefined,
      notes: form.notes.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await transactSyncedStorageValue<BarItem[]>(INV_BAR_ITEMS_KEY, (current) => {
        const all = current ?? [];
        if (all.some((item) => !item.deletedAt && item.name.trim().toLowerCase() === newItem.name.toLowerCase())) throw new Error("This item already exists. Use Add Stock.");
        return [...all, newItem];
      });
    } catch (error) { window.alert(error instanceof Error ? error.message : "Could not add item."); return; }
    load();
    saveMovement({ itemId: newItem.id, itemName: newItem.name, type: "add", toLocation: form.destination, quantity: qty });
    setForm({ name: "", unit: "", quantity: "", destination: "store", condition: "good", sellingPrice: "", buyingPrice: "", notes: "" });
    setAddItemOpen(false);
  };

  const handleAddStock = async () => {
    if (!addStockForm.itemId) return;
    const qty = Number(addStockForm.quantity);
    if (!Number.isInteger(qty) || qty <= 0) return window.alert("Enter a positive whole quantity.");
    let item: BarItem | undefined;
    try {
      await transactSyncedStorageValue<BarItem[]>(INV_BAR_ITEMS_KEY, (current) => {
        const all = current ?? [];
        item = all.find((entry) => entry.id === addStockForm.itemId && !entry.deletedAt);
        if (!item) throw new Error("Item no longer exists.");
        return all.map((entry) => entry.id !== item!.id ? entry : { ...entry, storeQty: addStockForm.destination === "store" ? entry.storeQty + qty : entry.storeQty, barQty: addStockForm.destination === "bar" ? entry.barQty + qty : entry.barQty, updatedAt: Date.now() });
      });
    } catch (error) { window.alert(error instanceof Error ? error.message : "Could not add stock."); return; }
    load();
    if (item) saveMovement({ itemId: item.id, itemName: item.name, type: "add", toLocation: addStockForm.destination, quantity: qty });
    setAddStockForm({ itemId: "", destination: "store", quantity: "" });
    setAddStockOpen(false);
  };

  const handleTransfer = async () => {
    if (!transferForm.itemId) return;
    const qty = Number(transferForm.quantity);
    if (!Number.isInteger(qty) || qty <= 0) return window.alert("Enter a positive whole quantity.");
    let item: BarItem | undefined;
    let updated: BarItem[];
    try {
      updated = await transactSyncedStorageValue<BarItem[]>(INV_BAR_ITEMS_KEY, (current) => {
        const all = current ?? [];
        item = all.find((i) => i.id === transferForm.itemId && !i.deletedAt);
        if (!item) throw new Error("Item no longer exists.");
        const source = transferForm.direction === "store-to-bar" ? item.storeQty : item.barQty;
        if (source < qty) throw new Error(`Only ${source} units are available at the source.`);
        return all.map((i) => i.id !== item!.id ? i : transferForm.direction === "store-to-bar"
          ? { ...i, storeQty: i.storeQty - qty, barQty: i.barQty + qty, updatedAt: Date.now() }
          : { ...i, barQty: i.barQty - qty, storeQty: i.storeQty + qty, updatedAt: Date.now() });
      });
    } catch (error) { window.alert(error instanceof Error ? error.message : "Transfer failed."); return; }
    setItems(updated.filter((i) => !i.deletedAt));
    if (item) saveMovement({
      itemId: item.id, itemName: item.name, type: "transfer",
      fromLocation: transferForm.direction === "store-to-bar" ? "store" : "bar",
      toLocation: transferForm.direction === "store-to-bar" ? "bar" : "store",
      quantity: qty,
    });
    setTransferForm({ itemId: "", direction: "store-to-bar", quantity: "" });
    setTransferOpen(false);
  };

  const handleRecordBroken = async () => {
    if (!brokenForm.itemId) return;
    const qty = Number(brokenForm.quantity);
    if (!Number.isInteger(qty) || qty <= 0) return window.alert("Enter a positive whole quantity.");
    let item: BarItem | undefined;
    let updated: BarItem[];
    try {
      updated = await transactSyncedStorageValue<BarItem[]>(INV_BAR_ITEMS_KEY, (current) => {
        const all = current ?? [];
        item = all.find((i) => i.id === brokenForm.itemId && !i.deletedAt);
        if (!item) throw new Error("Item no longer exists.");
        const available = brokenForm.location === "store" ? item.storeQty : item.barQty;
        if (available < qty) throw new Error(`Only ${available} usable units are available at this location.`);
        return all.map((i) => i.id !== item!.id ? i : {
          ...i, storeQty: brokenForm.location === "store" ? i.storeQty - qty : i.storeQty,
          barQty: brokenForm.location === "bar" ? i.barQty - qty : i.barQty,
          brokenQty: i.brokenQty + qty, updatedAt: Date.now(),
        });
      });
    } catch (error) { window.alert(error instanceof Error ? error.message : "Could not record damage."); return; }
    setItems(updated.filter((i) => !i.deletedAt));
    if (item) saveMovement({ itemId: item.id, itemName: item.name, type: "broken", fromLocation: brokenForm.location, quantity: qty });
    setBrokenForm({ itemId: "", location: "store", quantity: "" });
    setBrokenOpen(false);
  };

  const handleEdit = () => {
    if (!editItem) return;
    const quantities = [editForm.storeQty, editForm.barQty, editForm.brokenQty].map(Number);
    if (!quantities.every((value) => Number.isInteger(value) && value >= 0)) return window.alert("Enter valid non-negative whole quantities.");
    const changed = quantities[0] !== editItem.storeQty || quantities[1] !== editItem.barQty || quantities[2] !== editItem.brokenQty;
    if (changed && readStoredRole() !== "manager") return window.alert("Manager access is required for quantity adjustments.");
    if (changed && !editReason.trim()) return window.alert("Enter a reason for the stock adjustment.");
    const all = readJson<BarItem[]>(INV_BAR_ITEMS_KEY) ?? [];
    const updated = all.map((i) => {
      if (i.id !== editItem.id) return i;
      return {
        ...i,
        name: editForm.name.trim() || i.name,
        unit: editForm.unit.trim() || i.unit,
        storeQty: Math.max(0, Number(editForm.storeQty) || 0),
        barQty: Math.max(0, Number(editForm.barQty) || 0),
        brokenQty: Math.max(0, Number(editForm.brokenQty) || 0),
        sellingPrice: editForm.sellingPrice ? Number(editForm.sellingPrice) : undefined,
        buyingPrice: editForm.buyingPrice ? Number(editForm.buyingPrice) : undefined,
        notes: editForm.notes.trim() || undefined,
        updatedAt: Date.now(),
      };
    });
    void writeJson(INV_BAR_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    if (changed) saveMovement({ itemId: editItem.id, itemName: editItem.name, type: "adjustment", quantity: quantities[0] + quantities[1] + quantities[2] - editItem.storeQty - editItem.barQty - editItem.brokenQty, notes: editReason.trim() });
    setEditItem(null);
  };

  const handleDelete = () => {
    if (!deleteItem) return;
    if (readStoredRole() !== "manager") return window.alert("Manager access is required to archive items.");
    const all = readJson<BarItem[]>(INV_BAR_ITEMS_KEY) ?? [];
    const updated = all.map((i) => (i.id === deleteItem.id ? { ...i, deletedAt: Date.now() } : i));
    void writeJson(INV_BAR_ITEMS_KEY, updated);
    setItems(updated.filter((i) => !i.deletedAt));
    saveMovement({ itemId: deleteItem.id, itemName: deleteItem.name, type: "archive", quantity: 0 });
    setDeleteItem(null);
  };

  const openEdit = (item: BarItem) => {
    setEditReason("");
    setEditForm({
      name: item.name, unit: item.unit,
      storeQty: String(item.storeQty), barQty: String(item.barQty), brokenQty: String(item.brokenQty),
      sellingPrice: item.sellingPrice != null ? String(item.sellingPrice) : "",
      buyingPrice: item.buyingPrice != null ? String(item.buyingPrice) : "",
      notes: item.notes ?? "",
    });
    setEditItem(item);
  };

  const handleDownloadCSV = () => {
    const headers = ["#", "Item Name", "Store Qty", "Bar Qty", "Total Qty", "Broken Qty", "Good Qty", "Unit", "Selling Price", "Buying Price"];
    const rows = filtered.map((item, idx) => {
      const good = item.storeQty + item.barQty;
      const total = good + item.brokenQty;
      return [String(idx + 1), item.name, String(item.storeQty), String(item.barQty), String(total), String(item.brokenQty), String(good), item.unit, String(item.sellingPrice ?? ""), String(item.buyingPrice ?? "")];
    });
    downloadCSV("bar-stock.csv", headers, rows);
  };

  return (
    <div className="p-6 space-y-6">
      {importReport && <p role="status" className="rounded-lg border bg-white px-4 py-2 text-xs text-gray-600">{importReport}</p>}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest">Bar Stock</h1>
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

      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <div className="flex gap-2">
          {(["all", "good", "broken", "low"] as FilterType[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${filter === f ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
              {f === "low" ? "Low Stock" : f}
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
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Store Qty</TableHead>
              <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 text-right">Bar Qty</TableHead>
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
                <TableCell colSpan={9} className="text-center py-16 text-gray-400 text-sm">No items found.</TableCell>
              </TableRow>
            ) : (
              filtered.map((item, idx) => {
                const good = item.storeQty + item.barQty;
                const total = good + item.brokenQty;
                const isLow = good < 5;
                return (
                  <TableRow key={item.id} className="hover:bg-gray-50">
                    <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{item.name}</span>
                        {isLow && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">LOW</Badge>}
                        {item.brokenQty > 0 && <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-amber-600 border-amber-300">BROKEN</Badge>}
                        {item.source?.warnings.some((warning) => !warning.startsWith("Original blank")) && <Badge variant="outline" title={item.source.warnings.join(" ")} className="text-[9px] px-1.5 py-0 text-amber-600 border-amber-300">REVIEW SOURCE</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{item.storeQty}</TableCell>
                    <TableCell className="text-right text-sm">{item.barQty}</TableCell>
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

      {/* Add Item */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Add New Bar Item</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Add a new item to the bar inventory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className={labelClass("mb-1 block")}>Item Name</label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Whiskey" /></div>
            <div><label className={labelClass("mb-1 block")}>Unit</label><Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="e.g. bottle, L" /></div>
            <div><label className={labelClass("mb-1 block")}>Quantity</label><Input type="number" min={0} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="0" /></div>
            <div>
              <label className={labelClass("mb-1 block")}>Destination</label>
              <div className="flex gap-2">
                {(["store", "bar"] as const).map((d) => (
                  <button key={d} onClick={() => setForm((f) => ({ ...f, destination: d }))}
                    className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${form.destination === d ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>{d}</button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Condition</label>
              <div className="flex gap-2">
                {(["good", "broken"] as const).map((c) => (
                  <button key={c} onClick={() => setForm((f) => ({ ...f, condition: c }))}
                    className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${form.condition === c ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>{c}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass("mb-1 block")}>Selling Price</label><Input type="number" min={0} value={form.sellingPrice} onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))} placeholder="0" /></div>
              <div><label className={labelClass("mb-1 block")}>Buying Price</label><Input type="number" min={0} value={form.buyingPrice} onChange={(e) => setForm((f) => ({ ...f, buyingPrice: e.target.value }))} placeholder="0" /></div>
            </div>
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
            <DialogDescription className="text-xs text-gray-500">Add stock to an existing bar item.</DialogDescription>
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
                {(["store", "bar"] as const).map((d) => (
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
            <DialogDescription className="text-xs text-gray-500">Move stock between Store and Bar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass("mb-1 block")}>Item</label>
              <select value={transferForm.itemId} onChange={(e) => setTransferForm((f) => ({ ...f, itemId: e.target.value }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Select item...</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name} (Store: {i.storeQty}, Bar: {i.barQty})</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Direction</label>
              <div className="flex gap-2">
                {([["store-to-bar", "Store → Bar"], ["bar-to-store", "Bar → Store"]] as const).map(([d, label]) => (
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

      {/* Broken */}
      <Dialog open={brokenOpen} onOpenChange={setBrokenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Record Broken</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Record damaged or broken bar items.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass("mb-1 block")}>Item</label>
              <select value={brokenForm.itemId} onChange={(e) => setBrokenForm((f) => ({ ...f, itemId: e.target.value }))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">Select item...</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass("mb-1 block")}>Location</label>
              <div className="flex gap-2">
                {(["store", "bar"] as const).map((l) => (
                  <button key={l} onClick={() => setBrokenForm((f) => ({ ...f, location: l }))}
                    className={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors ${brokenForm.location === l ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>{l}</button>
                ))}
              </div>
            </div>
            <div><label className={labelClass("mb-1 block")}>Broken Quantity</label><Input type="number" min={0} value={brokenForm.quantity} onChange={(e) => setBrokenForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="0" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBrokenOpen(false)} className="font-black uppercase tracking-widest text-xs">Cancel</Button>
            <Button onClick={handleRecordBroken} className="font-black uppercase tracking-widest text-xs bg-red-600 hover:bg-red-700">Record Broken</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-sm">Edit Bar Item</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Update item details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className={labelClass("mb-1 block")}>Item Name</label><Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><label className={labelClass("mb-1 block")}>Unit</label><Input value={editForm.unit} onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelClass("mb-1 block")}>Store Qty</label><Input type="number" min={0} value={editForm.storeQty} onChange={(e) => setEditForm((f) => ({ ...f, storeQty: e.target.value }))} /></div>
              <div><label className={labelClass("mb-1 block")}>Bar Qty</label><Input type="number" min={0} value={editForm.barQty} onChange={(e) => setEditForm((f) => ({ ...f, barQty: e.target.value }))} /></div>
              <div><label className={labelClass("mb-1 block")}>Broken Qty</label><Input type="number" min={0} value={editForm.brokenQty} onChange={(e) => setEditForm((f) => ({ ...f, brokenQty: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass("mb-1 block")}>Selling Price</label><Input type="number" min={0} value={editForm.sellingPrice} onChange={(e) => setEditForm((f) => ({ ...f, sellingPrice: e.target.value }))} /></div>
              <div><label className={labelClass("mb-1 block")}>Buying Price</label><Input type="number" min={0} value={editForm.buyingPrice} onChange={(e) => setEditForm((f) => ({ ...f, buyingPrice: e.target.value }))} /></div>
            </div>
            <div><label className={labelClass("mb-1 block")}>Notes</label><Input value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any notes..." /></div>
            <div><label className={labelClass("mb-1 block")}>Reason for quantity adjustment</label><Input value={editReason} onChange={(event) => setEditReason(event.target.value)} placeholder="Required if quantities change" /></div>
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
