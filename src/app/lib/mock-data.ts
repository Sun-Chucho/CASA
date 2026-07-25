
export type Role = 'manager' | 'director' | 'inventory' | 'cashier' | 'kitchen' | 'barista' | 'standard' | 'platinum';

export interface User {
  id: string;
  name: string;
  role: Role;
  avatar: string;
}

export const USERS: User[] = [
  { id: 'u1', name: 'JACKLINE', role: 'cashier', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jackline' },
  { id: 'u2', name: 'MONDY', role: 'cashier', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mondy' },
  { id: 'u3', name: 'LINDA', role: 'cashier', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Linda' },
  { id: 'u4', name: 'FORTUNATA', role: 'cashier', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fortunata' },
];

export interface Room {
  id: string;
  number: string;
  type: 'Standard' | 'Deluxe' | 'Executive' | 'Suite';
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance';
  price: number;
}

export const STANDARD_ROOM_PRICE = 50000;
export const PLATINUM_ROOM_PRICE = 50000;

const CASA_ROOM_NUMBERS = [
  "100", "101", "102", "103", "104", "105", "106", "107",
  "108", "109", "110", "111", "112", "113", "114", "115", "116", "117",
] as const;

const CASA_ROOM_RULES: Array<{ numbers: readonly string[]; price: number }> = [
  { numbers: ["101", "102", "103", "104", "105", "106", "107"], price: 50000 },
  { numbers: ["100", "108", "109", "110"], price: 100000 },
  { numbers: ["111"], price: 120000 },
  { numbers: ["112", "113", "114", "115", "116", "117"], price: 60000 },
];

export function getCasaRoomPrice(number: string): number {
  const match = CASA_ROOM_RULES.find((rule) => rule.numbers.includes(number));
  return match?.price ?? STANDARD_ROOM_PRICE;
}

export function getCasaRoomType(price: number): Room['type'] {
  if (price === 50000) return 'Standard';
  if (price === 60000) return 'Deluxe';
  if (price === 100000) return 'Executive';
  if (price === 120000) return 'Suite';
  return 'Standard';
}

const casaRooms: Room[] = CASA_ROOM_NUMBERS.map((number) => {
  const price = getCasaRoomPrice(number);
  return {
    id: `r${number}`,
    number,
    type: getCasaRoomType(price),
    status: "available",
    price: price,
  };
});

export const ROOMS: Room[] = [...casaRooms];

export const PLATINUM_HOTEL_ROOMS: Room[] = [];

export function getDefaultRoomsForTier(_tier: "standard" | "platinum"): Room[] {
  return ROOMS.map((room) => ({ ...room }));
}

export interface InventoryItem {
  id: string;
  barcode: string;
  name: string;
  category: string;
  subCategory?: string;
  size: string;
  stock: number; // Bottles or Units
  totPerBottle?: number;
  totSold: number; // Currently sold tots from the active bottle
  buyingPrice: number;
  sellingPrice: number;
  price?: number;
  status: 'ACTIVE' | 'INACTIVE';
  minStock: number;
  unit: string;
  damages?: number;
  receivedStock?: number;
}

export const INVENTORY: InventoryItem[] = [];

export const SALES_HISTORY: Array<{
  date: string;
  totalRevenue: number;
  roomRevenue: number;
  foodAndDrinksRevenue: number;
}> = [];
