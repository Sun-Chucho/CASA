"use client";

import { useEffect, useMemo, useState } from "react";
import { readStoredRole } from "@/app/lib/auth";
import { readActiveSessionUsername } from "@/app/lib/login-profiles";
import { hydrateStorageKeyFromFirebase, subscribeToSyncedStorageKey, transactSyncedStorageKeys } from "@/app/lib/firebase-sync";
import { getStoreItemLabel, MainStoreItem, normalizeBaristaProductTarget, STORAGE_INVENTORY_ITEMS, STORAGE_MAIN_STORE_ITEMS } from "@/app/lib/inventory-transfer";
import { InventoryItem } from "@/app/lib/mock-data";
import { readJson, readPosState, STORAGE_BARISTA_STATE } from "@/app/lib/storage";
import { BAR_CATEGORIES, buyingPriceUnit, syncBarCatalogToPos } from "@/app/lib/bar-catalog";
import { getRemainingTots, getTotLimit } from "@/app/lib/barista-stock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STOCK_IN_HISTORY_KEY = "orange-hotel-barista-stock-in-history";
const CATEGORIES = [...BAR_CATEGORIES, "beer", "wine", "spirits", "cider", "soft-drinks", "water-juice", "energy-drinks", "malt", "coffee", "tea", "cold", "snacks"] as const;
type DrinkCategory = typeof CATEGORIES[number];
type StockMode = "new" | "addition";
type StockMenuItem = { id: string; name: string; price: number; buyingPrice?: number; category: DrinkCategory; prepMinutes: number; updatedAt?: number; deletedAt?: number };
type StockInEntry = { id: string; itemId: string; itemName: string; kind: StockMode; date: string; quantity: number; buyingPrice: number; sellingPrice: number; recordedAt: number; user?: string };

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
  const [category, setCategory] = useState<DrinkCategory>("Local Beers");
  const [categoryFilter, setCategoryFilter] = useState("all");
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
    ]).then(() => syncBarCatalogToPos()).catch((error) => console.error("Bar catalog sync failed", error)).finally(() => { reload(); if (!cancelled) setHydrated(true); });
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
    return [...result.entries()].sort((a, b) => {
      const left = a[1].store?.subCategory ?? a[1].inventory?.subCategory ?? a[1].menu?.category ?? "Other";
      const right = b[1].store?.subCategory ?? b[1].inventory?.subCategory ?? b[1].menu?.category ?? "Other";
      return left.localeCompare(right) || a[1].label.localeCompare(b[1].label);
    });
  }, [stores, inventory, menus]);

  const selectedChoice = choices.find(([key]) => key === selected)?.[1];
  const choiceCategory = (choice: typeof choices[number][1]) => choice.store?.subCategory ?? choice.inventory?.subCategory ?? choice.menu?.category ?? "Other";
  const visibleChoices = choices.filter(([, choice]) => categoryFilter === "all" || choiceCategory(choice) === categoryFilter);

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
      const target = normalizeBaristaProductTarget(mode === "new" ? label : selectedChoice!.label);
      const id = crypto.randomUUID();
      await transactSyncedStorageKeys([STORAGE_MAIN_STORE_ITEMS, STORAGE_INVENTORY_ITEMS, STORAGE_BARISTA_STATE, STOCK_IN_HISTORY_KEY], (current) => {
        const allStores = (current[STORAGE_MAIN_STORE_ITEMS] as MainStoreItem[] | null) ?? [];
        const allInventory = (current[STORAGE_INVENTORY_ITEMS] as InventoryItem[] | null) ?? [];
        const snapshot = (current[STORAGE_BARISTA_STATE] as ReturnType<typeof readBaristaSnapshot> | null) ?? { tickets: [], ticketSeq: 490, payments: [], menuItems: [] };
        const history = (current[STOCK_IN_HISTORY_KEY] as StockInEntry[] | null) ?? [];
        if (history.some((entry) => entry.id === id)) return current;
        const existingStore = allStores.find((item) => item.lane === "barista" && !item.deletedAt && normalizeBaristaProductTarget(getStoreItemLabel(item)) === target);
        const existingMenu = snapshot.menuItems.find((item) => !item.deletedAt && normalizeBaristaProductTarget(item.name) === target);
        const existingInventory = allInventory.find((item) => item.category.trim().toLowerCase() === "bar" && item.status !== "INACTIVE" && normalizeBaristaProductTarget(item.size ? `${item.name} ${item.size}` : item.name) === target);
        if (mode === "new" && (existingStore || existingMenu || existingInventory)) throw new Error("This drink already exists. Select it under New Additions.");
        if (mode === "addition" && !existingStore && !existingMenu && !existingInventory) throw new Error("The selected drink no longer exists. Refresh and select it again.");
        const itemName = existingStore?.name ?? existingInventory?.name ?? (mode === "new" ? drinkName : selectedChoice!.label);
        const itemSize = existingStore?.size ?? existingInventory?.size ?? (mode === "new" ? drinkSize : "");
        const itemLabel = itemSize && !itemName.toLowerCase().includes(itemSize.toLowerCase()) ? `${itemName} ${itemSize}` : itemName;
        const itemUnit = existingStore?.unit ?? existingInventory?.unit ?? unit.trim();
        const rawCategory = existingStore?.subCategory ?? existingInventory?.subCategory ?? existingMenu?.category ?? (mode === "new" ? category : "cold");
        const itemCategory = CATEGORIES.includes(rawCategory as DrinkCategory) ? rawCategory as DrinkCategory : "cold";
        const previousStock = (existingInventory?.updatedAt ?? 0) > (existingStore?.updatedAt ?? 0) ? existingInventory?.stock : existingStore?.stock ?? existingInventory?.stock;
        const stock = (previousStock ?? 0) + qty;
        const storeId = existingStore?.id ?? `bs-${id}`;
        const nextStore: MainStoreItem = existingStore
          ? { ...existingStore, stock, subCategory: itemCategory, buyingPrice: buy, sellingPrice: sell, receivedStock: (existingStore.receivedStock ?? 0) + qty, updatedAt: now }
          : { id: storeId, name: itemName, size: itemSize, stock, unit: itemUnit, minStock: 0, lane: "barista", subCategory: itemCategory, buyingPrice: buy, sellingPrice: sell, receivedStock: qty, updatedAt: now };
        const nextInventory: InventoryItem = existingInventory
          ? { ...existingInventory, stock, subCategory: itemCategory, buyingPrice: buy, sellingPrice: sell, price: sell, receivedStock: (existingInventory.receivedStock ?? 0) + qty, updatedAt: now }
          : { id: `inv-${id}`, barcode: "", name: itemName, category: "Bar", subCategory: itemCategory, size: itemSize, stock, totSold: 0, buyingPrice: buy, sellingPrice: sell, price: sell, status: "ACTIVE", minStock: 0, unit: itemUnit, receivedStock: qty, updatedAt: now };
        const nextMenu: StockMenuItem = existingMenu
          ? { ...existingMenu, category: itemCategory, buyingPrice: buy, price: sell, updatedAt: now }
          : { id: `barista-${id}`, name: itemLabel, price: sell, buyingPrice: buy, category: itemCategory, prepMinutes: 2, updatedAt: now };
        const entry: StockInEntry = { id, itemId: storeId, itemName: itemLabel, kind: mode, date, quantity: qty, buyingPrice: buy, sellingPrice: sell, recordedAt: now, user: readActiveSessionUsername("manager") };
        return {
          [STORAGE_MAIN_STORE_ITEMS]: existingStore ? allStores.map((item) => item.id === existingStore.id ? nextStore : item) : [...allStores, nextStore],
          [STORAGE_INVENTORY_ITEMS]: existingInventory ? allInventory.map((item) => item.id === existingInventory.id ? nextInventory : item) : [...allInventory, nextInventory],
          [STORAGE_BARISTA_STATE]: { ...snapshot, menuItems: existingMenu ? snapshot.menuItems.map((item) => item.id === existingMenu.id ? nextMenu : item) : [...snapshot.menuItems, nextMenu] },
          [STOCK_IN_HISTORY_KEY]: [entry, ...history],
        };
      });
      load();
      setQuantity("");
      if (mode === "new") { setName(""); setSize(""); setBuyingPrice(""); setSellingPrice(""); }
      setFeedback("Stock saved successfully.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Stock could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (role === null) return <div className="p-8 text-sm text-muted-foreground">Loading Stock In...</div>;
  if (role !== "manager") return <div className="p-8 text-sm text-muted-foreground">Manager access required.</div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-tight">Stock In</h1>
        <p className="text-sm text-muted-foreground">Manager drink stock: create a new item or record a dated addition to an existing item.</p>
      </header>
      <Tabs value={mode} onValueChange={(value) => { setMode(value as StockMode); setFeedback(""); setQuantity(""); setBuyingPrice(""); setSellingPrice(""); setSelected(""); }}>
        <TabsList><TabsTrigger value="new">New Item</TabsTrigger><TabsTrigger value="addition">New Additions</TabsTrigger></TabsList>
      </Tabs>
      <Card>
        <CardHeader><CardTitle>{mode === "new" ? "Set opening stock" : "Record stock addition"}</CardTitle><CardDescription>Buying price is per bottle or unit, except St. Remy (per tot). Selling price is per tot for tot products and per unit otherwise.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {mode === "new" ? <>
            <div><label className={fieldLabel}>Drink name</label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Soda" /></div>
            <div><label className={fieldLabel}>Size</label><Input value={size} onChange={(event) => setSize(event.target.value)} placeholder="e.g. 350ml" /></div>
            <div><label className={fieldLabel}>Category</label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value as DrinkCategory)}>{CATEGORIES.map((value) => <option key={value} value={value}>{value.replaceAll("-", " ")}</option>)}</select></div>
            <div><label className={fieldLabel}>Unit</label><Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Bottle" /></div>
          </> : <div className="md:col-span-2"><label className={fieldLabel}>Select drink</label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected} onChange={(event) => chooseDrink(event.target.value)}><option value="">Select a drink</option>{[...BAR_CATEGORIES, "Other"].map((group) => <optgroup key={group} label={group}>{choices.filter(([, choice]) => choiceCategory(choice) === group).map(([key, choice]) => <option key={key} value={key}>{choice.label}</option>)}</optgroup>)}</select></div>}
          <div><label className={fieldLabel}>{mode === "new" ? "Opening quantity" : "Quantity received"}</label><Input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
          <div><label className={fieldLabel}>Buying price (TSh)</label><Input type="number" min="0" value={buyingPrice} onChange={(event) => setBuyingPrice(event.target.value)} /></div>
          <div><label className={fieldLabel}>Selling price (TSh)</label><Input type="number" min="0.01" value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} /></div>
          <div><label className={fieldLabel}>Stock date</label><Input type="date" max={today()} value={date} onChange={(event) => setDate(event.target.value)} /></div>
          <div className="flex items-center gap-4 md:col-span-2 xl:col-span-4"><Button onClick={() => void save()} disabled={saving || !hydrated}>{saving ? "Saving..." : !hydrated ? "Loading stock..." : mode === "new" ? "Save New Drink" : "Add Stock"}</Button>{feedback && <p role="status" className="text-sm font-medium">{feedback}</p>}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Current drink stock</CardTitle><CardDescription>Use Add Stock to record a new purchase. Tot opening counts were converted to bottle balances; remaining tots are shown below.</CardDescription><select aria-label="Filter drink category" className="h-10 max-w-xs rounded-md border bg-background px-3 text-sm" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{BAR_CATEGORIES.map((value) => <option key={value}>{value}</option>)}<option>Other</option></select></CardHeader>
        <CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Drink</TableHead><TableHead>Category</TableHead><TableHead>Quantity</TableHead><TableHead>Unit</TableHead><TableHead>Buying price</TableHead><TableHead>Selling price</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{visibleChoices.map(([key, choice]) => <TableRow key={key}><TableCell>{choice.label}</TableCell><TableCell>{choiceCategory(choice)}</TableCell><TableCell>{choice.store && getTotLimit(choice.store) > 0 ? `${getRemainingTots(choice.store)} tots (${choice.store.stock} bottles)` : choice.store?.stock ?? choice.inventory?.stock ?? 0}</TableCell><TableCell>{choice.store?.unit ?? choice.inventory?.unit ?? "—"}</TableCell><TableCell>TSh {(choice.store?.buyingPrice ?? choice.inventory?.buyingPrice ?? choice.menu?.buyingPrice ?? 0).toLocaleString()} / {buyingPriceUnit(choice.label)}</TableCell><TableCell>TSh {(choice.store?.sellingPrice ?? choice.inventory?.sellingPrice ?? choice.menu?.price ?? 0).toLocaleString()}</TableCell><TableCell><Button variant="outline" size="sm" onClick={() => { setMode("addition"); chooseDrink(key); setQuantity(""); }}>Add Stock</Button></TableCell></TableRow>)}{visibleChoices.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No drinks in this category.</TableCell></TableRow>}</TableBody></Table></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent additions</CardTitle><CardDescription>Recorded stock entries and their purchase dates.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Drink</TableHead><TableHead>Type</TableHead><TableHead>Quantity</TableHead><TableHead>Buying price</TableHead><TableHead>Selling price</TableHead><TableHead>Recorded by</TableHead></TableRow></TableHeader><TableBody>{history.slice(0, 30).map((entry) => <TableRow key={entry.id}><TableCell>{entry.date}</TableCell><TableCell>{entry.itemName}</TableCell><TableCell>{entry.kind === "new" ? "Opening stock" : "Addition"}</TableCell><TableCell>{entry.quantity}</TableCell><TableCell>TSh {entry.buyingPrice.toLocaleString()}</TableCell><TableCell>TSh {entry.sellingPrice.toLocaleString()}</TableCell><TableCell>{entry.user ?? "—"}</TableCell></TableRow>)}{history.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No stock entries yet.</TableCell></TableRow>}</TableBody></Table></CardContent>
      </Card>
    </div>
  );
}
