"use client";

import { useEffect, useMemo, useState } from "react";
import { readStoredRole } from "@/app/lib/auth";
import { hydrateStorageKeyFromFirebase, subscribeToSyncedStorageKey } from "@/app/lib/firebase-sync";
import { getStoreItemLabel, MainStoreItem, normalizeBaristaProductTarget, STORAGE_INVENTORY_ITEMS, STORAGE_MAIN_STORE_ITEMS } from "@/app/lib/inventory-transfer";
import { InventoryItem } from "@/app/lib/mock-data";
import { readJson, readPosState, STORAGE_BARISTA_STATE, writeJson, writePosState } from "@/app/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STOCK_IN_HISTORY_KEY = "orange-hotel-barista-stock-in-history";
const CATEGORIES = ["beer", "wine", "spirits", "cider", "soft-drinks", "water-juice", "energy-drinks", "malt", "coffee", "tea", "cold", "snacks"] as const;
type DrinkCategory = typeof CATEGORIES[number];
type StockMode = "new" | "addition";
type StockMenuItem = { id: string; name: string; price: number; buyingPrice?: number; category: DrinkCategory; prepMinutes: number; updatedAt?: number; deletedAt?: number };
type StockInEntry = { id: string; itemId: string; itemName: string; kind: StockMode; date: string; quantity: number; buyingPrice: number; sellingPrice: number; recordedAt: number };

function today() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function readBaristaSnapshot() {
  return readPosState<unknown, unknown, StockMenuItem>(
    STORAGE_BARISTA_STATE,
    "orange-hotel-barista-orders",
    "orange-hotel-barista-seq",
    "orange-hotel-barista-payments",
    "orange-hotel-barista-menu",
    490,
  );
}

const fieldLabel = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground";

export default function StockInPage() {
  const [role, setRole] = useState<string | null>(null);
  const [mode, setMode] = useState<StockMode>("new");
  const [stores, setStores] = useState<MainStoreItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [menus, setMenus] = useState<StockMenuItem[]>([]);
  const [history, setHistory] = useState<StockInEntry[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [unit, setUnit] = useState("Bottle");
  const [category, setCategory] = useState<DrinkCategory>("beer");
  const [quantity, setQuantity] = useState("");
  const [buyingPrice, setBuyingPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [feedback, setFeedback] = useState("");

  const load = () => {
    setStores((readJson<MainStoreItem[]>(STORAGE_MAIN_STORE_ITEMS) ?? []).filter((item) => item.lane === "barista" && !item.deletedAt));
    setInventory((readJson<InventoryItem[]>(STORAGE_INVENTORY_ITEMS) ?? []).filter((item) => item.category.trim().toLowerCase() === "bar" && item.status !== "INACTIVE"));
    setMenus(readBaristaSnapshot().menuItems.filter((item) => !item.deletedAt));
    setHistory(readJson<StockInEntry[]>(STOCK_IN_HISTORY_KEY) ?? []);
  };

  useEffect(() => {
    setRole(readStoredRole());
    let cancelled = false;
    const reload = () => { if (!cancelled) load(); };
    void Promise.all([
      hydrateStorageKeyFromFirebase(STORAGE_MAIN_STORE_ITEMS),
      hydrateStorageKeyFromFirebase(STORAGE_INVENTORY_ITEMS),
      hydrateStorageKeyFromFirebase(STORAGE_BARISTA_STATE),
      hydrateStorageKeyFromFirebase(STOCK_IN_HISTORY_KEY),
    ]).finally(() => { reload(); if (!cancelled) setHydrated(true); });
    const unsubscribers = [STORAGE_MAIN_STORE_ITEMS, STORAGE_INVENTORY_ITEMS, STORAGE_BARISTA_STATE, STOCK_IN_HISTORY_KEY]
      .map((key) => subscribeToSyncedStorageKey(key, reload));
    reload();
    return () => { cancelled = true; unsubscribers.forEach((unsubscribe) => unsubscribe()); };
  }, []);

  const choices = useMemo(() => {
    const result = new Map<string, { label: string; store?: MainStoreItem; inventory?: InventoryItem; menu?: StockMenuItem }>();
    stores.forEach((store) => {
      const label = getStoreItemLabel(store);
      result.set(normalizeBaristaProductTarget(label), { label, store });
    });
    inventory.forEach((item) => {
      const label = item.size ? `${item.name} ${item.size}` : item.name;
      const key = normalizeBaristaProductTarget(label);
      const previous = result.get(key);
      result.set(key, { ...previous, label: previous?.label ?? label, inventory: item });
    });
    menus.forEach((menu) => {
      const key = normalizeBaristaProductTarget(menu.name);
      const previous = result.get(key);
      result.set(key, { ...previous, label: previous?.label ?? menu.name, menu });
    });
    return [...result.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [stores, inventory, menus]);

  const selectedChoice = choices.find(([key]) => key === selected)?.[1];

  const chooseDrink = (value: string) => {
    setSelected(value);
    const choice = choices.find(([key]) => key === value)?.[1];
    setBuyingPrice(choice?.store?.buyingPrice != null ? String(choice.store.buyingPrice) : choice?.inventory?.buyingPrice != null ? String(choice.inventory.buyingPrice) : choice?.menu?.buyingPrice != null ? String(choice.menu.buyingPrice) : "");
    setSellingPrice(choice?.store?.sellingPrice != null ? String(choice.store.sellingPrice) : choice?.inventory?.sellingPrice != null ? String(choice.inventory.sellingPrice) : choice?.menu?.price != null ? String(choice.menu.price) : "");
    setFeedback("");
  };

  const save = async () => {
    if (saving || !hydrated || role !== "manager") return;
    const qty = Number(quantity);
    const buy = Number(buyingPrice);
    const sell = Number(sellingPrice);
    const drinkName = name.trim();
    const drinkSize = size.trim();
    const label = drinkSize ? `${drinkName} ${drinkSize}` : drinkName;
    if ((mode === "new" && (!drinkName || !unit.trim())) || (mode === "addition" && !selectedChoice)) {
      setFeedback("Choose a drink or enter its name and unit.");
      return;
    }
    if (!quantity.trim() || !Number.isInteger(qty) || qty <= 0 || !buyingPrice.trim() || !Number.isFinite(buy) || buy < 0 || !sellingPrice.trim() || !Number.isFinite(sell) || sell <= 0) {
      setFeedback("Enter a positive whole quantity and valid buying and selling prices.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00`).getTime()) || date > today()) {
      setFeedback("Choose a valid stock date up to today.");
      return;
    }
    if (mode === "new" && choices.some(([key]) => key === normalizeBaristaProductTarget(label))) {
      setFeedback("This drink already exists. Use Add Stock to increase its quantity.");
      return;
    }

    setSaving(true);
    setFeedback("");
    try {
      const now = Date.now();
      const allStores = readJson<MainStoreItem[]>(STORAGE_MAIN_STORE_ITEMS) ?? [];
      const allInventory = readJson<InventoryItem[]>(STORAGE_INVENTORY_ITEMS) ?? [];
      const snapshot = readBaristaSnapshot();
      const target = normalizeBaristaProductTarget(mode === "new" ? label : selectedChoice!.label);
      const existingStore = allStores.find((item) => item.lane === "barista" && !item.deletedAt && normalizeBaristaProductTarget(getStoreItemLabel(item)) === target);
      const existingMenu = snapshot.menuItems.find((item) => !item.deletedAt && normalizeBaristaProductTarget(item.name) === target);
      const existingInventory = allInventory.find((item) => item.category.trim().toLowerCase() === "bar" && item.status !== "INACTIVE" && normalizeBaristaProductTarget(item.size ? `${item.name} ${item.size}` : item.name) === target);
      if (mode === "new" && (existingStore || existingMenu || existingInventory)) {
        setFeedback("This drink was added on another device. Select it under Add Stock.");
        load();
        return;
      }
      const itemName = existingStore?.name ?? existingInventory?.name ?? (mode === "new" ? drinkName : selectedChoice!.label);
      const itemSize = existingStore?.size ?? existingInventory?.size ?? (mode === "new" ? drinkSize : "");
      const itemLabel = itemSize && !itemName.toLowerCase().includes(itemSize.toLowerCase()) ? `${itemName} ${itemSize}` : itemName;
      const itemUnit = existingStore?.unit ?? existingInventory?.unit ?? unit.trim();
      const rawCategory = existingMenu?.category ?? existingStore?.subCategory ?? existingInventory?.subCategory ?? (mode === "new" ? category : "cold");
      const itemCategory = CATEGORIES.includes(rawCategory as DrinkCategory) ? rawCategory as DrinkCategory : "cold";
      const stock = (existingStore?.stock ?? existingInventory?.stock ?? 0) + qty;
      const id = crypto.randomUUID();
      const storeId = existingStore?.id ?? `bs-${id}`;
      const nextStore: MainStoreItem = existingStore
        ? { ...existingStore, stock, buyingPrice: buy, sellingPrice: sell, receivedStock: (existingStore.receivedStock ?? 0) + qty, updatedAt: now }
        : { id: storeId, name: itemName, size: itemSize, stock, unit: itemUnit, minStock: 0, lane: "barista", subCategory: itemCategory, buyingPrice: buy, sellingPrice: sell, receivedStock: qty, updatedAt: now };
      const nextInventory: InventoryItem = existingInventory
        ? { ...existingInventory, stock, buyingPrice: buy, sellingPrice: sell, price: sell, receivedStock: (existingInventory.receivedStock ?? 0) + qty, updatedAt: now }
        : { id: `inv-${id}`, barcode: "", name: itemName, category: "Bar", subCategory: itemCategory, size: itemSize, stock, totSold: 0, buyingPrice: buy, sellingPrice: sell, price: sell, status: "ACTIVE", minStock: 0, unit: itemUnit, receivedStock: qty, updatedAt: now };
      const nextMenu: StockMenuItem = existingMenu
        ? { ...existingMenu, buyingPrice: buy, price: sell, updatedAt: now }
        : { id: `barista-${id}`, name: itemLabel, price: sell, buyingPrice: buy, category: itemCategory, prepMinutes: 2, updatedAt: now };
      const entry: StockInEntry = { id, itemId: storeId, itemName: itemLabel, kind: mode, date, quantity: qty, buyingPrice: buy, sellingPrice: sell, recordedAt: now };
      const nextHistory = [entry, ...(readJson<StockInEntry[]>(STOCK_IN_HISTORY_KEY) ?? [])];
      const writes = await Promise.all([
        writeJson(STORAGE_MAIN_STORE_ITEMS, existingStore ? allStores.map((item) => item.id === existingStore.id ? nextStore : item) : [...allStores, nextStore]),
        writeJson(STORAGE_INVENTORY_ITEMS, existingInventory ? allInventory.map((item) => item.id === existingInventory.id ? nextInventory : item) : [...allInventory, nextInventory]),
        writePosState(STORAGE_BARISTA_STATE, snapshot.tickets, snapshot.ticketSeq, snapshot.payments, existingMenu ? snapshot.menuItems.map((item) => item.id === existingMenu.id ? nextMenu : item) : [...snapshot.menuItems, nextMenu]),
        writeJson(STOCK_IN_HISTORY_KEY, nextHistory),
      ]);
      load();
      setQuantity("");
      if (mode === "new") { setName(""); setSize(""); setBuyingPrice(""); setSellingPrice(""); }
      setFeedback(writes.some((result) => result === false) ? "Saved on this device; cloud sync is pending." : "Stock saved successfully.");
    } catch {
      setFeedback("Stock was saved locally, but cloud synchronization is pending. Check sync status before adding it again.");
    } finally {
      setSaving(false);
    }
  };

  if (role === null) return <div className="p-8 text-sm text-muted-foreground">Loading Stock In...</div>;
  if (role !== "manager") return <div className="p-8 text-sm text-muted-foreground">Manager access required.</div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Drink Stock In</h1>
        <p className="text-sm text-muted-foreground">Set opening stock for a new drink or record a dated addition to an existing drink.</p>
      </header>
      <Tabs value={mode} onValueChange={(value) => { setMode(value as StockMode); setFeedback(""); setQuantity(""); setBuyingPrice(""); setSellingPrice(""); setSelected(""); }}>
        <TabsList><TabsTrigger value="new">New Drink</TabsTrigger><TabsTrigger value="addition">Add Stock</TabsTrigger></TabsList>
      </Tabs>
      <Card>
        <CardHeader><CardTitle>{mode === "new" ? "Set opening stock" : "Record stock addition"}</CardTitle><CardDescription>Buying price is the cost per unit. Selling price is the POS price per unit.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {mode === "new" ? <>
            <div><label className={fieldLabel}>Drink name</label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Soda" /></div>
            <div><label className={fieldLabel}>Size</label><Input value={size} onChange={(event) => setSize(event.target.value)} placeholder="e.g. 350ml" /></div>
            <div><label className={fieldLabel}>Category</label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value as DrinkCategory)}>{CATEGORIES.map((value) => <option key={value} value={value}>{value.replaceAll("-", " ")}</option>)}</select></div>
            <div><label className={fieldLabel}>Unit</label><Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Bottle" /></div>
          </> : <div className="md:col-span-2"><label className={fieldLabel}>Select drink</label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected} onChange={(event) => chooseDrink(event.target.value)}><option value="">Select a drink</option>{choices.map(([key, choice]) => <option key={key} value={key}>{choice.label}</option>)}</select></div>}
          <div><label className={fieldLabel}>{mode === "new" ? "Opening quantity" : "Quantity received"}</label><Input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
          <div><label className={fieldLabel}>Buying price (TSh)</label><Input type="number" min="0" value={buyingPrice} onChange={(event) => setBuyingPrice(event.target.value)} /></div>
          <div><label className={fieldLabel}>Selling price (TSh)</label><Input type="number" min="0.01" value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} /></div>
          <div><label className={fieldLabel}>Stock date</label><Input type="date" max={today()} value={date} onChange={(event) => setDate(event.target.value)} /></div>
          <div className="flex items-center gap-4 md:col-span-2 xl:col-span-4"><Button onClick={() => void save()} disabled={saving || !hydrated}>{saving ? "Saving..." : !hydrated ? "Loading stock..." : mode === "new" ? "Save New Drink" : "Add Stock"}</Button>{feedback && <p role="status" className="text-sm font-medium">{feedback}</p>}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent additions</CardTitle><CardDescription>Recorded stock entries and their purchase dates.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Drink</TableHead><TableHead>Type</TableHead><TableHead>Quantity</TableHead><TableHead>Buying price</TableHead><TableHead>Selling price</TableHead></TableRow></TableHeader><TableBody>{history.slice(0, 30).map((entry) => <TableRow key={entry.id}><TableCell>{entry.date}</TableCell><TableCell>{entry.itemName}</TableCell><TableCell>{entry.kind === "new" ? "Opening stock" : "Addition"}</TableCell><TableCell>{entry.quantity}</TableCell><TableCell>TSh {entry.buyingPrice.toLocaleString()}</TableCell><TableCell>TSh {entry.sellingPrice.toLocaleString()}</TableCell></TableRow>)}{history.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No stock entries yet.</TableCell></TableRow>}</TableBody></Table></CardContent>
      </Card>
    </div>
  );
}
