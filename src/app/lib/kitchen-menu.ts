export type KitchenMenuCategory =
  | "salad"
  | "soup"
  | "snacks"
  | "beef"
  | "chicken"
  | "fish"
  | "meat"
  | "pork"
  | "local-food"
  | "pizza"
  | "burger"
  | "sandwich"
  | "pasta"
  | "indian"
  | "sides"
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
  { value: "chicken", label: "Chicken" },
  { value: "fish", label: "Fish" },
  { value: "meat", label: "Meat" },
  { value: "pork", label: "Pork" },
  { value: "local-food", label: "Local Food" },
  { value: "pizza", label: "Pizza" },
  { value: "burger", label: "Burgers" },
  { value: "sandwich", label: "Sandwiches" },
  { value: "pasta", label: "Pasta" },
  { value: "indian", label: "Indian Dishes" },
  { value: "sides", label: "Side Dishes" },
  { value: "dessert", label: "Desserts" },
  { value: "drinks", label: "Drinks" },
];

export const KITCHEN_CATEGORY_LABELS: Record<KitchenMenuCategory, string> = Object.fromEntries(
  KITCHEN_CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<KitchenMenuCategory, string>;

// Stable IDs let manager edits survive future catalog updates and sync merges.
const CASSA_FOOD_ITEMS: Array<[string, number, KitchenMenuCategory]> = [
  ["Tomato Soup", 10000, "soup"],
  ["Pumpkin Soup", 10000, "soup"],
  ["Vegetable Soup", 10000, "soup"],
  ["Cream of Mushroom Soup", 10000, "soup"],
  ["Cream Chicken Soup", 10000, "soup"],
  ["Fish Sato Clear Soup", 25000, "soup"],
  ["Fish Changu Clear Soup", 30000, "soup"],
  ["Chicken Broiler Clear Soup", 15000, "soup"],
  ["Local Chicken Clear Soup", 20000, "soup"],
  ["Vegetable Salad", 15000, "salad"],
  ["Avocado Salad", 12000, "salad"],
  ["Green Salad", 10000, "salad"],
  ["Chicken Salad", 15000, "salad"],
  ["Chicken Caesar Salad", 15000, "salad"],
  ["Kuku Paka", 20000, "chicken"],
  ["Beef Stew", 15000, "beef"],
  ["Roasted Beef", 15000, "beef"],
  ["Roasted Lamb", 20000, "meat"],
  ["Beef Fillet", 20000, "beef"],
  ["Grilled Chicken", 15000, "chicken"],
  ["Fish Fillet", 25000, "fish"],
  ["Coconut Tilapia", 25000, "fish"],
  ["Grilled Fish Skewers", 20000, "fish"],
  ["Pepper Steak", 20000, "beef"],
  ["Chicken Schnitzel", 15000, "chicken"],
  ["Chicken Broiler Fried", 15000, "chicken"],
  ["Chicken Makange", 15000, "chicken"],
  ["Local Chicken Fried", 20000, "chicken"],
  ["Local Chicken Makange", 20000, "chicken"],
  ["Beef Makange", 15000, "beef"],
  ["Fish Sato Fried", 25000, "fish"],
  ["Fish Makange", 25000, "fish"],
  ["Fish Changu Fried", 30000, "fish"],
  ["Fish Changu Makange", 30000, "fish"],
  ["Chicken Burger", 15000, "burger"],
  ["Beef Burger", 15000, "burger"],
  ["Vegetable Burger", 15000, "burger"],
  ["Vegetable Sandwich", 15000, "sandwich"],
  ["Chicken Club Sandwich", 20000, "sandwich"],
  ["Chicken Crisp Sandwich", 15000, "sandwich"],
  ["Chicken Sandwich", 15000, "sandwich"],
  ["Chicken Wings (6 pieces)", 15000, "snacks"],
  ["Chicken Lollipops (6 pieces)", 15000, "snacks"],
  ["Chicken Spring Rolls (4 pieces)", 15000, "snacks"],
  ["Vegetable Spring Rolls (4 pieces)", 15000, "snacks"],
  ["Beef Samosa (4 pieces)", 10000, "snacks"],
  ["Vegetable Samosa (4 pieces)", 6000, "snacks"],
  ["Spaghetti Marinara", 20000, "pasta"],
  ["Spaghetti Bolognese", 20000, "pasta"],
  ["Spaghetti Arrabbiata", 20000, "pasta"],
  ["Spaghetti Alfredo", 25000, "pasta"],
  ["Chicken Parmesan Spaghetti", 25000, "pasta"],
  ["Aubergine Parmesan", 20000, "pasta"],
  ["Vegetable Spaghetti", 15000, "pasta"],
  ["Chicken Tikka Masala", 25000, "indian"],
  ["Chicken Makhan", 25000, "indian"],
  ["Dal Makhan", 20000, "indian"],
  ["Mutton Rogan Josh", 20000, "indian"],
  ["Chicken Biryani", 25000, "indian"],
  ["Vegetable Biryani", 20000, "indian"],
  ["Hawaiian Pizza", 25000, "pizza"],
  ["Chicken Pizza", 30000, "pizza"],
  ["Beef Pizza", 30000, "pizza"],
  ["Margherita Pizza", 20000, "pizza"],
  ["Cassa Modern Pizza", 30000, "pizza"],
  ["Rice", 5000, "sides"],
  ["Mashed Potatoes", 5000, "sides"],
  ["Ugali", 5000, "sides"],
  ["Chapati", 5000, "sides"],
  ["Chips", 5000, "sides"],
  ["Chips Mayai", 8000, "sides"],
  ["Ndizi (Bananas)", 5000, "sides"],
  ["Ice Cream", 10000, "dessert"],
  ["Pineapple Crumble", 10000, "dessert"],
  ["Apple Crumble", 10000, "dessert"],
  ["Muffins Cake", 10000, "dessert"],
  ["Fruit Salad", 10000, "dessert"],
];

export const DEFAULT_KITCHEN_MENU: KitchenMenuItem[] = CASSA_FOOD_ITEMS.map(([name, price, category]) => ({
  id: `km-cassa-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}`,
  name,
  price,
  category,
  prepMinutes: category === "sides" || category === "dessert" ? 10 : 20,
}));

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
const DEFAULT_KITCHEN_MENU_BY_NAME = new Map(DEFAULT_KITCHEN_MENU.map((item) => [item.name.toLowerCase(), item]));
// Apply the requested price change once to saved built-in dishes, including
// rows that were edited before this correction. Later manager edits still win.
const REDUCED_KITCHEN_MENU_NAMES = new Set([
  "Kuku Paka", "Beef Stew", "Roasted Beef", "Roasted Lamb", "Beef Fillet",
  "Grilled Chicken", "Fish Fillet", "Coconut Tilapia", "Grilled Fish Skewers",
  "Pepper Steak", "Chicken Schnitzel", "Chicken Burger", "Beef Burger",
  "Chicken Crisp Sandwich", "Chicken Sandwich", "Chicken Wings (6 pieces)",
  "Chicken Tikka Masala", "Chicken Makhan", "Dal Makhan", "Mutton Rogan Josh",
  "Chicken Biryani", "Vegetable Biryani",
]);
const KITCHEN_PRICE_REVISION = Date.parse("2026-10-28T13:52:00Z");
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

  const byName = DEFAULT_KITCHEN_MENU_BY_NAME.get(normalizeKitchenMenuName(item.name));
  if (byName) return byName;

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
    const canonicalItem = approvedItem && approvedItem.id !== item.id
      ? { ...item, id: approvedItem.id }
      : item;
    const normalizedItem = approvedItem &&
      item.id === approvedItem.id &&
      REDUCED_KITCHEN_MENU_NAMES.has(approvedItem.name) &&
      normalizeKitchenMenuName(canonicalItem.name) === normalizeKitchenMenuName(approvedItem.name) &&
      getKitchenMenuRevision(canonicalItem) < KITCHEN_PRICE_REVISION &&
      canonicalItem.price === approvedItem.price + 5000
      ? { ...canonicalItem, price: approvedItem.price, updatedAt: KITCHEN_PRICE_REVISION }
      : canonicalItem;
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
