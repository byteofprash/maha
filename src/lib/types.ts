export type Unit = "day" | "week" | "month";

export type Room = {
  id: string;
  name: string;
  floor: number; // index into State.floors
  x: number; // grid units
  y: number;
  w: number;
  h: number;
  color: string;
};

export type Item = {
  id: string;
  name: string;
  category: string;
  roomId: string | null;
  brand: string;
  model: string;
  serial: string;
  purchaseDate: string; // yyyy-mm-dd or ""
  store: string;
  price: number | null;
  warrantyMonths: number | null;
  manualUrl: string;
  notes: string;
};

export type Task = {
  id: string;
  title: string;
  every: number;
  unit: Unit;
  dueDate: string; // yyyy-mm-dd — next time it is due
  lastDone: string | null;
  roomId: string | null;
  itemId: string | null;
  category: string;
  notes: string;
  history: string[]; // completion dates, newest first
};

export type State = {
  version: 1;
  floors: string[];
  rooms: Room[];
  items: Item[];
  tasks: Task[];
};

export const GRID = { cols: 12, rows: 8 };

export const TASK_CATEGORIES = ["Cleaning", "Plants", "Pets", "Bikes & tools", "Appliances", "Garden", "Safety", "Admin", "Other"];
export const ITEM_CATEGORIES = ["Appliance", "Electronics", "Smart home", "Furniture", "Tool", "Bike & vehicle", "Garden", "Pet", "Other"];
export const ROOM_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#84cc16", "#64748b"];
