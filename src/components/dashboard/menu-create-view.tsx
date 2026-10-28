"use client";

import { useEffect, useState } from "react";
import { readJson, readPosState, STORAGE_BARISTA_STATE, STORAGE_KITCHEN_STATE, writeJson, writePosState } from "@/app/lib/storage";
import { hydrateStorageKeyFromFirebase, subscribeToSyncedStorageKey } from "@/app/lib/firebase-sync";
import { updateBaristaCatalog } from "@/app/lib/barista-menu-sync";
import {
  type MainStoreItem,
  STORAGE_INVENTORY_ITEMS,
  STORAGE_MAIN_STORE_ITEMS,
} from "@/app/lib/inventory-transfer";
import type { InventoryItem } from "@/app/lib/mock-data";
import {
  KITCHEN_CATEGORY_LABELS,
  KITCHEN_CATEGORY_OPTIONS,
  KitchenMenuCategory,
  KitchenMenuItem,
  mergeKitchenMenuItems,
} from "@/app/lib/kitchen-menu";
import { useIsDirector } from "@/hooks/use-is-director";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { readStoredRole } from "@/app/lib/auth";
import { readActiveSessionUsername } from "@/app/lib/login-profiles";
import { Role } from "@/app/lib/mock-data";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";

type BaristaCategory = "espresso" | "coffee" | "tea" | "cold" | "snacks";

interface BaristaMenuItem {
  id: string;
  name: string;
  price: number;
  category: BaristaCategory;
  prepMinutes: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number;
}

interface QueueTicket {
  id: string;
}

interface PaymentRecord {
  id: string;
}

interface MenuAuditEntry {
  id: string;
  menu: "kitchen" | "barista";
  itemId: string;
  itemName: string;
  changedAt: number;
  changedBy: string;
  changes: string[];
}

const KITCHEN_LEGACY = {
  tickets: "orange-hotel-kitchen-tickets",
  seq: "orange-hotel-kitchen-seq",
  payments: "orange-hotel-kitchen-payments",
  menu: "orange-hotel-kitchen-menu",
  defaultSeq: 300,
} as const;

const BARISTA_LEGACY = {
  tickets: "orange-hotel-barista-orders",
  seq: "orange-hotel-barista-seq",
  payments: "orange-hotel-barista-payments",
  menu: "orange-hotel-barista-menu",
  defaultSeq: 490,
} as const;

const STORAGE_MENU_AUDIT = "orange-hotel-menu-audit-trail";

async function allWritesSynced(writes: Array<Promise<boolean> | void>) {
  const pendingWrites = writes.filter((write): write is Promise<boolean> => Boolean(write));
  const results = await Promise.all(pendingWrites);
  return results.every(Boolean);
}

function formatAuditDate(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function MenuCreateView() {
  const isDirector = useIsDirector();
  const { confirm, dialog } = useConfirmDialog();
  const { toast } = useToast();
  const [tab, setTab] = useState<"kitchen" | "barista">("kitchen");
  const [sessionRole, setSessionRole] = useState<Role | null>(null);
  const [changedBy, setChangedBy] = useState("manager");
  const [menuReady, setMenuReady] = useState(false);
  const [savingMenuItem, setSavingMenuItem] = useState(false);

  const [kitchenMenuItems, setKitchenMenuItems] = useState<KitchenMenuItem[]>([]);
  const [kitchenName, setKitchenName] = useState("");
  const [kitchenPrice, setKitchenPrice] = useState("");
  const [kitchenPrepMinutes, setKitchenPrepMinutes] = useState("15");
  const [kitchenCategory, setKitchenCategory] = useState<KitchenMenuCategory>("salad");
  const [editingKitchenId, setEditingKitchenId] = useState<string | null>(null);
  const [editingKitchenName, setEditingKitchenName] = useState("");
  const [editingKitchenPrice, setEditingKitchenPrice] = useState("");
  const [kitchenSearch, setKitchenSearch] = useState("");
  const [kitchenFilterCategory, setKitchenFilterCategory] = useState<string>("all");

  const [baristaMenuItems, setBaristaMenuItems] = useState<BaristaMenuItem[]>([]);
  const [baristaName, setBaristaName] = useState("");
  const [baristaPrice, setBaristaPrice] = useState("");
  const [baristaPrepMinutes, setBaristaPrepMinutes] = useState("10");
  const [baristaCategory, setBaristaCategory] = useState<BaristaCategory>("coffee");
  const [editingBaristaId, setEditingBaristaId] = useState<string | null>(null);
  const [editingBaristaName, setEditingBaristaName] = useState("");
  const [editingBaristaPrice, setEditingBaristaPrice] = useState("");
  const [auditTrail, setAuditTrail] = useState<MenuAuditEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const currentRole = readStoredRole();
    setSessionRole(currentRole);
    setChangedBy(readActiveSessionUsername(currentRole ?? "manager") || currentRole || "manager");

    const applyMenuSnapshots = (persistKitchenNormalization = true) => {
      if (cancelled) return;
      const kitchenSnapshot = readPosState<QueueTicket, PaymentRecord, KitchenMenuItem>(
        STORAGE_KITCHEN_STATE,
        KITCHEN_LEGACY.tickets,
        KITCHEN_LEGACY.seq,
        KITCHEN_LEGACY.payments,
        KITCHEN_LEGACY.menu,
        KITCHEN_LEGACY.defaultSeq,
      );
      const nextKitchenMenuItems = mergeKitchenMenuItems(kitchenSnapshot.menuItems);
      setKitchenMenuItems(nextKitchenMenuItems);
      if (
        persistKitchenNormalization &&
        JSON.stringify(nextKitchenMenuItems) !== JSON.stringify(kitchenSnapshot.menuItems)
      ) {
        void writePosState(
          STORAGE_KITCHEN_STATE,
          kitchenSnapshot.tickets,
          kitchenSnapshot.ticketSeq,
          kitchenSnapshot.payments,
          nextKitchenMenuItems,
        );
      }

      const baristaSnapshot = readPosState<QueueTicket, PaymentRecord, BaristaMenuItem>(
        STORAGE_BARISTA_STATE,
        BARISTA_LEGACY.tickets,
        BARISTA_LEGACY.seq,
        BARISTA_LEGACY.payments,
        BARISTA_LEGACY.menu,
        BARISTA_LEGACY.defaultSeq,
      );
      setBaristaMenuItems(baristaSnapshot.menuItems.filter((item) => !item.deletedAt));
    };

    applyMenuSnapshots(false);
    setAuditTrail(readJson<MenuAuditEntry[]>(STORAGE_MENU_AUDIT) ?? []);

    void Promise.all([
      hydrateStorageKeyFromFirebase(STORAGE_KITCHEN_STATE, true),
      hydrateStorageKeyFromFirebase(STORAGE_BARISTA_STATE, true),
    ]).finally(() => {
      if (cancelled) return;
      applyMenuSnapshots();
      setMenuReady(true);
    });

    const unsubscribeKitchen = subscribeToSyncedStorageKey(STORAGE_KITCHEN_STATE, () => applyMenuSnapshots());
    const unsubscribeBarista = subscribeToSyncedStorageKey(STORAGE_BARISTA_STATE, () => applyMenuSnapshots());
    const unsubscribeAudit = subscribeToSyncedStorageKey<MenuAuditEntry[]>(STORAGE_MENU_AUDIT, (value) => {
      setAuditTrail(Array.isArray(value) ? value : readJson<MenuAuditEntry[]>(STORAGE_MENU_AUDIT) ?? []);
    });

    return () => {
      cancelled = true;
      unsubscribeKitchen();
      unsubscribeBarista();
      unsubscribeAudit();
    };
  }, []);

  const filteredKitchenMenuItems = kitchenMenuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(kitchenSearch.trim().toLowerCase());
    const matchesCategory = kitchenFilterCategory === "all" || item.category === kitchenFilterCategory;
    return matchesSearch && matchesCategory;
  });

  const saveAuditEntry = (entry: MenuAuditEntry) => {
    setAuditTrail((current) => {
      const nextAuditTrail = [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, 100);
      void writeJson(STORAGE_MENU_AUDIT, nextAuditTrail);
      return nextAuditTrail;
    });
  };

  const persistKitchenMenu = (nextMenuItems: KitchenMenuItem[]) => {
    const latestSnapshot = readPosState<QueueTicket, PaymentRecord, KitchenMenuItem>(
      STORAGE_KITCHEN_STATE,
      KITCHEN_LEGACY.tickets,
      KITCHEN_LEGACY.seq,
      KITCHEN_LEGACY.payments,
      KITCHEN_LEGACY.menu,
      KITCHEN_LEGACY.defaultSeq,
    );
    return writePosState(
      STORAGE_KITCHEN_STATE,
      latestSnapshot.tickets,
      latestSnapshot.ticketSeq,
      latestSnapshot.payments,
      nextMenuItems,
    );
  };

  const persistBaristaMenu = (nextMenuItems: BaristaMenuItem[]) => {
    const latestSnapshot = readPosState<QueueTicket, PaymentRecord, BaristaMenuItem>(
      STORAGE_BARISTA_STATE,
      BARISTA_LEGACY.tickets,
      BARISTA_LEGACY.seq,
      BARISTA_LEGACY.payments,
      BARISTA_LEGACY.menu,
      BARISTA_LEGACY.defaultSeq,
    );
    return writePosState(
      STORAGE_BARISTA_STATE,
      latestSnapshot.tickets,
      latestSnapshot.ticketSeq,
      latestSnapshot.payments,
      nextMenuItems,
    );
  };

  const showMenuSyncResult = (synced: boolean, itemName: string, action: "created" | "updated") => {
    toast({
      title: synced ? `Menu item ${action}` : "Saved locally - sync pending",
      description: synced
        ? `${itemName} is now available to the live POS screens.`
        : `${itemName} will be sent to the POS screens automatically when the connection recovers.`,
      variant: synced ? "default" : "destructive",
    });
  };

  const addKitchenMenuItem = async () => {
    if (isDirector || !menuReady || savingMenuItem) return;
    const price = Number(kitchenPrice);
    const prepMinutes = Number(kitchenPrepMinutes);
    if (!kitchenName.trim() || !Number.isFinite(price) || price <= 0 || !Number.isFinite(prepMinutes) || prepMinutes <= 0) {
      toast({ title: "Check the menu item", description: "Enter a name, a price above zero, and a preparation time above zero.", variant: "destructive" });
      return;
    }
    const approved = await confirm({
      title: "Create Kitchen Menu Item",
      description: `Are you sure you want to add ${kitchenName.trim()} at TSh ${price.toLocaleString()}?`,
      actionLabel: "Add Menu Item",
    });
    if (!approved) return;

    setSavingMenuItem(true);
    const updatedAt = Date.now();
    const latestSnapshot = readPosState<QueueTicket, PaymentRecord, KitchenMenuItem>(
      STORAGE_KITCHEN_STATE,
      KITCHEN_LEGACY.tickets,
      KITCHEN_LEGACY.seq,
      KITCHEN_LEGACY.payments,
      KITCHEN_LEGACY.menu,
      KITCHEN_LEGACY.defaultSeq,
    );
    const nextMenuItems = [
      {
        id: `km-${crypto.randomUUID()}`,
        name: kitchenName.trim(),
        price,
        prepMinutes,
        category: kitchenCategory,
        createdAt: updatedAt,
        updatedAt,
      },
      ...mergeKitchenMenuItems(latestSnapshot.menuItems),
    ];
    try {
      setKitchenMenuItems(nextMenuItems);
      const synced = await allWritesSynced([persistKitchenMenu(nextMenuItems)]);
      showMenuSyncResult(synced, kitchenName.trim(), "created");
      setKitchenName("");
      setKitchenPrice("");
      setKitchenPrepMinutes("15");
      setKitchenCategory("salad");
    } catch (error) {
      console.error("Could not save kitchen menu item", error);
      setKitchenMenuItems(mergeKitchenMenuItems(readPosState<QueueTicket, PaymentRecord, KitchenMenuItem>(
        STORAGE_KITCHEN_STATE, KITCHEN_LEGACY.tickets, KITCHEN_LEGACY.seq,
        KITCHEN_LEGACY.payments, KITCHEN_LEGACY.menu, KITCHEN_LEGACY.defaultSeq,
      ).menuItems));
      toast({ title: "Menu item was not saved", description: "Please try again.", variant: "destructive" });
    } finally {
      setSavingMenuItem(false);
    }
  };

  const startKitchenEdit = (item: KitchenMenuItem) => {
    setEditingKitchenId(item.id);
    setEditingKitchenName(item.name);
    setEditingKitchenPrice(String(item.price));
  };

  const cancelKitchenEdit = () => {
    setEditingKitchenId(null);
    setEditingKitchenName("");
    setEditingKitchenPrice("");
  };

  const saveKitchenEdit = async (item: KitchenMenuItem) => {
    if (isDirector) return;
    const nextName = editingKitchenName.trim();
    const nextPrice = Number(editingKitchenPrice);
    if (!nextName || Number.isNaN(nextPrice) || nextPrice <= 0) return;

    const changes = [
      item.name !== nextName ? `Name: ${item.name} -> ${nextName}` : "",
      item.price !== nextPrice ? `Price: TSh ${item.price.toLocaleString()} -> TSh ${nextPrice.toLocaleString()}` : "",
    ].filter(Boolean);
    if (changes.length === 0) {
      cancelKitchenEdit();
      return;
    }

    const approved = await confirm({
      title: "Update Kitchen Menu Item",
      description: `Save changes to ${item.name}?`,
      actionLabel: "Save Changes",
    });
    if (!approved) return;

    const updatedAt = Date.now();
    const nextMenuItems = kitchenMenuItems.map((entry) =>
      entry.id === item.id ? { ...entry, name: nextName, price: nextPrice, updatedAt } : entry,
    );
    setKitchenMenuItems(nextMenuItems);
    const synced = await allWritesSynced([persistKitchenMenu(nextMenuItems)]);
    saveAuditEntry({
      id: `audit-${updatedAt}`,
      menu: "kitchen",
      itemId: item.id,
      itemName: nextName,
      changedAt: updatedAt,
      changedBy,
      changes,
    });
    cancelKitchenEdit();
    showMenuSyncResult(synced, nextName, "updated");
  };

  const addBaristaMenuItem = async () => {
    if (isDirector || !menuReady || savingMenuItem) return;
    const price = Number(baristaPrice);
    const prepMinutes = Number(baristaPrepMinutes);
    if (!baristaName.trim() || !Number.isFinite(price) || price <= 0 || !Number.isFinite(prepMinutes) || prepMinutes <= 0) {
      toast({ title: "Check the menu item", description: "Enter a name, a price above zero, and a preparation time above zero.", variant: "destructive" });
      return;
    }
    const approved = await confirm({
      title: "Create Barista Menu Item",
      description: `Are you sure you want to add ${baristaName.trim()} at TSh ${price.toLocaleString()}?`,
      actionLabel: "Add Menu Item",
    });
    if (!approved) return;

    setSavingMenuItem(true);
    const updatedAt = Date.now();
    const latestSnapshot = readPosState<QueueTicket, PaymentRecord, BaristaMenuItem>(
      STORAGE_BARISTA_STATE,
      BARISTA_LEGACY.tickets,
      BARISTA_LEGACY.seq,
      BARISTA_LEGACY.payments,
      BARISTA_LEGACY.menu,
      BARISTA_LEGACY.defaultSeq,
    );
    const activeMenuItems = latestSnapshot.menuItems.length > 0
      ? latestSnapshot.menuItems.filter((item) => !item.deletedAt)
      : baristaMenuItems;
    const deletedMenuItems = latestSnapshot.menuItems.filter((item) => item.deletedAt);
    const nextMenuItems = [
      {
        id: `bm-${crypto.randomUUID()}`,
        name: baristaName.trim(),
        price,
        prepMinutes,
        category: baristaCategory,
        createdAt: updatedAt,
        updatedAt,
      },
      ...activeMenuItems,
    ];
    try {
      setBaristaMenuItems(nextMenuItems);
      const synced = await allWritesSynced([persistBaristaMenu([...nextMenuItems, ...deletedMenuItems])]);
      showMenuSyncResult(synced, baristaName.trim(), "created");
      setBaristaName("");
      setBaristaPrice("");
      setBaristaPrepMinutes("10");
      setBaristaCategory("coffee");
    } catch (error) {
      console.error("Could not save barista menu item", error);
      setBaristaMenuItems(readPosState<QueueTicket, PaymentRecord, BaristaMenuItem>(
        STORAGE_BARISTA_STATE, BARISTA_LEGACY.tickets, BARISTA_LEGACY.seq,
        BARISTA_LEGACY.payments, BARISTA_LEGACY.menu, BARISTA_LEGACY.defaultSeq,
      ).menuItems.filter((item) => !item.deletedAt));
      toast({ title: "Menu item was not saved", description: "Please try again.", variant: "destructive" });
    } finally {
      setSavingMenuItem(false);
    }
  };

  const startBaristaEdit = (item: BaristaMenuItem) => {
    setEditingBaristaId(item.id);
    setEditingBaristaName(item.name);
    setEditingBaristaPrice(String(item.price));
  };

  const cancelBaristaEdit = () => {
    setEditingBaristaId(null);
    setEditingBaristaName("");
    setEditingBaristaPrice("");
  };

  const saveBaristaEdit = async (item: BaristaMenuItem) => {
    if (isDirector) return;
    const nextName = editingBaristaName.trim();
    const nextPrice = Number(editingBaristaPrice);
    if (!nextName || Number.isNaN(nextPrice) || nextPrice <= 0) return;

    const changes = [
      item.name !== nextName ? `Name: ${item.name} -> ${nextName}` : "",
      item.price !== nextPrice ? `Price: TSh ${item.price.toLocaleString()} -> TSh ${nextPrice.toLocaleString()}` : "",
    ].filter(Boolean);
    if (changes.length === 0) {
      cancelBaristaEdit();
      return;
    }

    const approved = await confirm({
      title: "Update Barista Menu Item",
      description: `Save changes to ${item.name}?`,
      actionLabel: "Save Changes",
    });
    if (!approved) return;

    const updatedAt = Date.now();
    const latestSnapshot = readPosState<QueueTicket, PaymentRecord, BaristaMenuItem>(
      STORAGE_BARISTA_STATE,
      BARISTA_LEGACY.tickets,
      BARISTA_LEGACY.seq,
      BARISTA_LEGACY.payments,
      BARISTA_LEGACY.menu,
      BARISTA_LEGACY.defaultSeq,
    );
    const storedMenuItems = latestSnapshot.menuItems.some((entry) => entry.id === item.id)
      ? latestSnapshot.menuItems
      : baristaMenuItems;
    const storeItems = readJson<MainStoreItem[]>(STORAGE_MAIN_STORE_ITEMS) ?? [];
    const inventoryItems = readJson<InventoryItem[]>(STORAGE_INVENTORY_ITEMS) ?? [];
    const catalogUpdate = updateBaristaCatalog({
      menuItems: storedMenuItems,
      storeItems,
      inventoryItems,
      menuItemId: item.id,
      previousName: item.name,
      nextName,
      sellingPrice: nextPrice,
      updatedAt,
    });
    setBaristaMenuItems(catalogUpdate.menuItems.filter((entry) => !entry.deletedAt));
    const synced = await allWritesSynced([
      persistBaristaMenu(catalogUpdate.menuItems),
      catalogUpdate.storeChanged ? writeJson(STORAGE_MAIN_STORE_ITEMS, catalogUpdate.storeItems) : undefined,
      catalogUpdate.inventoryChanged ? writeJson(STORAGE_INVENTORY_ITEMS, catalogUpdate.inventoryItems) : undefined,
    ]);
    saveAuditEntry({
      id: `audit-${updatedAt}`,
      menu: "barista",
      itemId: item.id,
      itemName: nextName,
      changedAt: updatedAt,
      changedBy,
      changes,
    });
    cancelBaristaEdit();
    showMenuSyncResult(synced, nextName, "updated");
  };

  const visibleAuditTrail = auditTrail.filter((entry) => entry.menu === tab);
  const isKitchenSession = sessionRole === "kitchen";

  return (
    <div className="space-y-6">
      {dialog}
      <header>
        <h1 className="text-3xl font-black tracking-tight uppercase">{isKitchenSession ? "Menu & Prices" : "Menu Create"}</h1>
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {isKitchenSession
            ? "Create dishes and update the Kitchen POS selling prices"
            : "Create and manage kitchen and barista menu items from one place"}
        </p>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as "kitchen" | "barista")}>
        <TabsList className="h-11">
          <TabsTrigger value="kitchen" className="font-black uppercase text-[10px] tracking-widest">Kitchen POS</TabsTrigger>
          {!isKitchenSession && (
            <TabsTrigger value="barista" className="font-black uppercase text-[10px] tracking-widest">Barista POS</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="kitchen" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-black uppercase tracking-tight">Create Kitchen Menu Item</CardTitle>
              <CardDescription>Set dish name, section, preparation time, and selling price.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dish Name</label>
                <Input value={kitchenName} onChange={(event) => setKitchenName(event.target.value)} placeholder="e.g. Grilled Chicken" disabled={isDirector} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Section / Category</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={kitchenCategory}
                  onChange={(event) => setKitchenCategory(event.target.value as KitchenMenuCategory)}
                  disabled={isDirector}
                >
                  {KITCHEN_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prep Time (Mins)</label>
                <Input type="number" min="1" value={kitchenPrepMinutes} onChange={(event) => setKitchenPrepMinutes(event.target.value)} placeholder="15" disabled={isDirector} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selling Price (TSh)</label>
                <Input type="number" min="1" value={kitchenPrice} onChange={(event) => setKitchenPrice(event.target.value)} placeholder="15000" disabled={isDirector} />
              </div>
              <div className="md:col-span-4 pt-1">
                <Button className="h-10 font-black uppercase text-[10px] tracking-widest px-6" onClick={addKitchenMenuItem} disabled={isDirector || !menuReady || savingMenuItem}>
                  {!menuReady ? "Loading Menu..." : savingMenuItem ? "Saving..." : "Add Menu Item"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl font-black uppercase tracking-tight">Kitchen Menu</CardTitle>
                  <CardDescription>Current kitchen menu items and selling prices. Pasta choices: Penne, Fusilli or Spaghetti.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-48 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={kitchenSearch}
                      onChange={(e) => setKitchenSearch(e.target.value)}
                      placeholder="Search dish..."
                      className="h-9 pl-9 text-xs"
                    />
                  </div>
                  <select
                    value={kitchenFilterCategory}
                    onChange={(e) => setKitchenFilterCategory(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold"
                  >
                    <option value="all">All Categories</option>
                    {KITCHEN_CATEGORY_OPTIONS.filter((opt) => kitchenMenuItems.some((item) => item.category === opt.value)).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Item</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Category</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Prep</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Price</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px] tracking-widest h-12">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKitchenMenuItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-bold">
                        {editingKitchenId === item.id ? (
                          <Input value={editingKitchenName} onChange={(event) => setEditingKitchenName(event.target.value)} disabled={isDirector} />
                        ) : (
                          item.name
                        )}
                      </TableCell>
                      <TableCell className="font-bold uppercase text-[10px] tracking-widest">{KITCHEN_CATEGORY_LABELS[item.category]}</TableCell>
                      <TableCell className="font-bold">{item.prepMinutes} min</TableCell>
                      <TableCell className="font-bold">
                        {editingKitchenId === item.id ? (
                          <Input type="number" min="1" value={editingKitchenPrice} onChange={(event) => setEditingKitchenPrice(event.target.value)} disabled={isDirector} />
                        ) : (
                          `TSh ${item.price.toLocaleString()}`
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingKitchenId === item.id ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => saveKitchenEdit(item)} disabled={isDirector} className="font-black uppercase text-[10px] tracking-widest">
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelKitchenEdit} className="font-black uppercase text-[10px] tracking-widest">
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => startKitchenEdit(item)} disabled={isDirector} className="font-black uppercase text-[10px] tracking-widest">
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {kitchenMenuItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">
                        No kitchen menu items yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {!isKitchenSession && <TabsContent value="barista" className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-black uppercase tracking-tight">Create Barista Menu Item</CardTitle>
              <CardDescription>Set item name, category, preparation time, and price.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input value={baristaName} onChange={(event) => setBaristaName(event.target.value)} placeholder="Drink or snack name" disabled={isDirector} />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={baristaCategory}
                onChange={(event) => setBaristaCategory(event.target.value as BaristaCategory)}
                disabled={isDirector}
              >
                <option value="espresso">Espresso</option>
                <option value="coffee">Coffee</option>
                <option value="tea">Tea</option>
                <option value="cold">Cold</option>
                <option value="snacks">Snacks</option>
              </select>
              <Input type="number" min="1" value={baristaPrepMinutes} onChange={(event) => setBaristaPrepMinutes(event.target.value)} placeholder="Prep minutes" disabled={isDirector} />
              <Input type="number" min="1" value={baristaPrice} onChange={(event) => setBaristaPrice(event.target.value)} placeholder="Price" disabled={isDirector} />
              <div className="md:col-span-4">
                <Button className="h-10 font-black uppercase text-[10px] tracking-widest" onClick={addBaristaMenuItem} disabled={isDirector || !menuReady || savingMenuItem}>
                  {!menuReady ? "Loading Menu..." : savingMenuItem ? "Saving..." : "Add Menu Item"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-black uppercase tracking-tight">Barista Menu</CardTitle>
              <CardDescription>Current barista menu items and selling prices.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Item</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Category</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Prep</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Price</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px] tracking-widest h-12">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {baristaMenuItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-bold">
                        {editingBaristaId === item.id ? (
                          <Input value={editingBaristaName} onChange={(event) => setEditingBaristaName(event.target.value)} disabled={isDirector} />
                        ) : (
                          item.name
                        )}
                      </TableCell>
                      <TableCell className="font-bold uppercase text-[10px] tracking-widest">{item.category}</TableCell>
                      <TableCell className="font-bold">{item.prepMinutes} min</TableCell>
                      <TableCell className="font-bold">
                        {editingBaristaId === item.id ? (
                          <Input type="number" min="1" value={editingBaristaPrice} onChange={(event) => setEditingBaristaPrice(event.target.value)} disabled={isDirector} />
                        ) : (
                          `TSh ${item.price.toLocaleString()}`
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingBaristaId === item.id ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => saveBaristaEdit(item)} disabled={isDirector} className="font-black uppercase text-[10px] tracking-widest">
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelBaristaEdit} className="font-black uppercase text-[10px] tracking-widest">
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => startBaristaEdit(item)} disabled={isDirector} className="font-black uppercase text-[10px] tracking-widest">
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {baristaMenuItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">
                        No barista menu items yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>}
      </Tabs>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-black uppercase tracking-tight">Menu Edit Audit Trail</CardTitle>
          <CardDescription>Recent {tab === "kitchen" ? "kitchen" : "barista"} menu changes with timestamp and details.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">When</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Item</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Changed By</TableHead>
                <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleAuditTrail.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-bold">{formatAuditDate(entry.changedAt)}</TableCell>
                  <TableCell className="font-bold">{entry.itemName}</TableCell>
                  <TableCell className="font-bold capitalize">{entry.changedBy}</TableCell>
                  <TableCell className="font-medium text-muted-foreground">{entry.changes.join(" | ")}</TableCell>
                </TableRow>
              ))}
              {visibleAuditTrail.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center font-black uppercase text-[10px] tracking-widest text-muted-foreground">
                    No menu edits recorded yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
