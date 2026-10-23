export type KitchenMenuCategory =
  | "salad"
  | "soup"
  | "snacks"
  | "beef"
  | "fish"
  | "pork"
  | "local-food"
  | "pizza"
  | "burger"
  | "sandwich"
  | "pasta"
  | "dessert"
  | "drinks";

export interface KitchenMenuItem {
  id: string;
  name: string;
  price: number;
  category: KitchenMenuCategory;
  prepMinutes: number;
  createdAt?: number;
  updatedAt?: number;
}

export const KITCHEN_CATEGORY_OPTIONS: Array<{ value: KitchenMenuCategory; label: string }> = [
  { value: "salad", label: "Salads" },
  { value: "soup", label: "Soups" },
  { value: "snacks", label: "Snacks" },
  { value: "beef", label: "Beef" },
  { value: "fish", label: "Fish" },
  { value: "pork", label: "Pork" },
  { value: "local-food", label: "Local Food" },
  { value: "pizza", label: "Pizza" },
  { value: "burger", label: "Burgers" },
  { value: "sandwich", label: "Sandwiches" },
  { value: "pasta", label: "Pasta" },
  { value: "dessert", label: "Desserts" },
  { value: "drinks", label: "Drinks" },
];

export const KITCHEN_CATEGORY_LABELS: Record<KitchenMenuCategory, string> = Object.fromEntries(
  KITCHEN_CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<KitchenMenuCategory, string>;

export const DEFAULT_KITCHEN_MENU: KitchenMenuItem[] = [];

function isKitchenMenuCategory(value: unknown): value is KitchenMenuCategory {
  return KITCHEN_CATEGORY_OPTIONS.some((option) => option.value === value);
}

function isValidKitchenMenuItem(item: unknown): item is KitchenMenuItem {
  if (!item || typeof item !== "object") return false;

  const candidate = item as Partial<KitchenMenuItem>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.trim().length > 0 &&
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0 &&
    typeof candidate.price === "number" &&
    Number.isFinite(candidate.price) &&
    candidate.price > 0 &&
    isKitchenMenuCategory(candidate.category) &&
    typeof candidate.prepMinutes === "number" &&
    Number.isFinite(candidate.prepMinutes) &&
    candidate.prepMinutes > 0
  );
}

function buildKitchenMenuSignature(item: KitchenMenuItem) {
  return `${item.name}|${item.price}|${item.category}|${item.prepMinutes}`;
}

const DEFAULT_KITCHEN_MENU_SIGNATURES = new Map(
  DEFAULT_KITCHEN_MENU.map((item) => [item.id, buildKitchenMenuSignature(item)]),
);
const DEFAULT_KITCHEN_MENU_BY_ID = new Map(DEFAULT_KITCHEN_MENU.map((item) => [item.id, item]));
const OBSOLETE_DEFAULT_KITCHEN_MENU_IDS = new Set(["km-dessert-2", "km-dessert-3"]);
const APPROVED_KITCHEN_MENU_NAME_ALIASES: Record<string, string> = {
  "fresh garden salad": "km-salad-1",
  "chicken mayonnaise salad": "km-salad-2",
  "chicken mayo salad": "km-salad-2",
  "greek salad": "km-salad-3",
  "fresh avocado salad": "km-salad-4",
  "avocado salad": "km-salad-4",
  "cream of pumpkin soup": "km-soup-1",
  "cream of pumpkin": "km-soup-1",
  "clear beef soup": "km-soup-2",
  "local banana soup": "km-soup-3",
  "banana soup": "km-soup-3",
  "local kitchen soup": "km-soup-4",
  "kitchen soup": "km-soup-4",
  "fried chicken wings": "km-snack-1",
  "marinated fish fingers": "km-snack-2",
  "fish fingers": "km-snack-2",
  "beef samosa": "km-snack-3",
  "marinated pepper steak": "km-beef-1",
  "pepper steak": "km-beef-1",
  "beef stroganoff": "km-beef-2",
  "beef stir-fry": "km-beef-3",
  "grilled lemon nile perch": "km-fish-1",
  "grilled nile perch": "km-fish-1",
  "fish curry": "km-fish-2",
  "fried tilapia": "km-fish-3",
  "grilled pork chop": "km-pork-1",
  "grilled pork ribs": "km-pork-2",
  "chicken trooper": "km-local-1",
  "mbuzi kitunguu": "km-local-2",
  "chicken vurga": "km-local-3",
  "chicken vunga": "km-local-3",
  "mchemsho wa samaki": "km-local-4",
  "mchemsho samaki": "km-local-4",
  "margherita pizza": "km-pizza-1",
  "margherita": "km-pizza-1",
  "hawaiian pizza": "km-pizza-2",
  "hawaiian": "km-pizza-2",
  "chicken pizza": "km-pizza-3",
  "orange special pizza": "km-pizza-4",
  "orange special": "km-pizza-4",
  "chicken burger": "km-burger-1",
  "beef burger": "km-burger-2",
  "vegetable burger": "km-burger-3",
  "veggie burger": "km-burger-3",
  "crab sandwich": "km-sandwich-1",
  "ham and bacon sandwich": "km-sandwich-2",
  "ham & bacon": "km-sandwich-2",
  "egg sandwich": "km-sandwich-3",
  "spaghetti napolitana": "km-pasta-1",
  "vegetable pasta": "km-pasta-2",
  "spaghetti bolognese": "km-pasta-3",
  "bolognese": "km-pasta-3",
  "chicken pasta": "km-pasta-4",
  "ice cream - vanilla": "km-dessert-1",
  "ice cream - strawberry": "km-dessert-1",
  "ice cream - chocolate": "km-dessert-1",
  "ice cream": "km-dessert-1",
  "pineapple cake": "km-dessert-4",
  "jam swiss roll": "km-dessert-5",
  "fresh fruit platter": "km-dessert-6",
  "fruit platter": "km-dessert-6",
  "smoothie": "km-drink-1",
  "fresh juice": "km-drink-2",
  "milkshake": "km-drink-3",
};

function normalizeKitchenMenuName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getApprovedKitchenMenuItem(item: KitchenMenuItem) {
  const byId = DEFAULT_KITCHEN_MENU_BY_ID.get(item.id);
  if (byId) return byId;

  const aliasId = APPROVED_KITCHEN_MENU_NAME_ALIASES[normalizeKitchenMenuName(item.name)];
  return aliasId ? DEFAULT_KITCHEN_MENU_BY_ID.get(aliasId) : undefined;
}

function getKitchenMenuRevision(item: KitchenMenuItem) {
  const revision = Number(item.updatedAt ?? item.createdAt ?? 0);
  return Number.isFinite(revision) ? revision : 0;
}

export function isDefaultKitchenMenuItem(item: KitchenMenuItem): boolean {
  return DEFAULT_KITCHEN_MENU_SIGNATURES.get(item.id) === buildKitchenMenuSignature(item);
}

export function mergeKitchenMenuItems(
  menuItems: KitchenMenuItem[],
  options?: { includeDefaultMenu?: boolean; stripDefaultMenu?: boolean },
): KitchenMenuItem[] {
  const includeDefaultMenu = options?.includeDefaultMenu ?? !options?.stripDefaultMenu;
  const stripDefaultMenu = options?.stripDefaultMenu ?? false;

  const merged = new Map<string, KitchenMenuItem>();

  for (const item of menuItems) {
    if (!isValidKitchenMenuItem(item)) continue;
    if (OBSOLETE_DEFAULT_KITCHEN_MENU_IDS.has(item.id)) continue;

    const approvedItem = getApprovedKitchenMenuItem(item);
    if (stripDefaultMenu && approvedItem) continue;

    // Historical menu aliases are canonicalized to the stable default ID, but
    // the persisted values remain authoritative. Replacing the whole record
    // here used to erase every manager name/price edit to a built-in dish.
    const normalizedItem = approvedItem && approvedItem.id !== item.id
      ? { ...item, id: approvedItem.id }
      : item;
    const existingItem = merged.get(normalizedItem.id);
    if (!existingItem || getKitchenMenuRevision(normalizedItem) > getKitchenMenuRevision(existingItem)) {
      merged.set(normalizedItem.id, normalizedItem);
    }
  }

  if (includeDefaultMenu) {
    for (const item of DEFAULT_KITCHEN_MENU) {
      if (!merged.has(item.id)) merged.set(item.id, item);
    }
  }

  return Array.from(merged.values());
}
