import type { InventoryItem } from "@/app/lib/mock-data";
import {
  getStoreItemLabel,
  type MainStoreItem,
  normalizeBaristaProductTarget,
} from "@/app/lib/inventory-transfer";

export interface SyncedBaristaMenuItem {
  id: string;
  name: string;
  price: number;
  updatedAt?: number;
  deletedAt?: number;
}

interface BaristaCatalogUpdate<TMenu extends SyncedBaristaMenuItem> {
  menuItems: TMenu[];
  storeItems: MainStoreItem[];
  inventoryItems: InventoryItem[];
  menuChanged: boolean;
  storeChanged: boolean;
  inventoryChanged: boolean;
}

function getLinkedRecordToken(id: string) {
  return id.match(/(\d{10,})$/)?.[1] ?? null;
}

function isLinkedBaristaRecord(recordId: string, label: string, menuItemId: string | undefined, previousName: string) {
  const linkedToken = menuItemId ? getLinkedRecordToken(menuItemId) : null;
  return (
    (linkedToken !== null && recordId.endsWith(linkedToken)) ||
    normalizeBaristaProductTarget(label) === normalizeBaristaProductTarget(previousName)
  );
}

export function updateBaristaCatalog<TMenu extends SyncedBaristaMenuItem>({
  menuItems,
  storeItems,
  inventoryItems,
  menuItemId,
  previousName,
  nextName,
  sellingPrice,
  updatedAt,
}: {
  menuItems: TMenu[];
  storeItems: MainStoreItem[];
  inventoryItems: InventoryItem[];
  menuItemId?: string;
  previousName: string;
  nextName?: string;
  sellingPrice: number;
  updatedAt: number;
}): BaristaCatalogUpdate<TMenu> {
  const normalizedPreviousName = normalizeBaristaProductTarget(previousName);
  const trimmedNextName = nextName?.trim();
  const shouldRename = Boolean(trimmedNextName && trimmedNextName !== previousName.trim());
  let menuChanged = false;
  let storeChanged = false;
  let inventoryChanged = false;

  const nextMenuItems = menuItems.map((item) => {
    const matches = menuItemId
      ? item.id === menuItemId
      : normalizeBaristaProductTarget(item.name) === normalizedPreviousName;
    if (!matches) return item;
    menuChanged = true;
    return {
      ...item,
      ...(shouldRename ? { name: trimmedNextName as string } : {}),
      price: sellingPrice,
      updatedAt,
    };
  });

  const nextStoreItems = storeItems.map((item) => {
    if (item.lane !== "barista" || !isLinkedBaristaRecord(item.id, getStoreItemLabel(item), menuItemId, previousName)) {
      return item;
    }
    storeChanged = true;
    return {
      ...item,
      ...(shouldRename ? { name: trimmedNextName as string, size: "" } : {}),
      sellingPrice,
      updatedAt,
    };
  });

  const nextInventoryItems = inventoryItems.map((item) => {
    const label = item.size ? `${item.name} ${item.size}` : item.name;
    if (
      item.category.trim().toLowerCase() === "kitchen" ||
      !isLinkedBaristaRecord(item.id, label, menuItemId, previousName)
    ) {
      return item;
    }
    inventoryChanged = true;
    return {
      ...item,
      ...(shouldRename ? { name: trimmedNextName as string, size: "" } : {}),
      sellingPrice,
      price: sellingPrice,
      updatedAt,
    };
  });

  return {
    menuItems: nextMenuItems,
    storeItems: nextStoreItems,
    inventoryItems: nextInventoryItems,
    menuChanged,
    storeChanged,
    inventoryChanged,
  };
}
