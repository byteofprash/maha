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
  icon: string; // "" = chosen automatically from the product (see lib/item-icon-rules.ts)
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
  plant: string; // which plant grows for this ritual (see lib/plants.ts); "" = not chosen yet
};

/** One entry in the permanent log of everything tended to. Names are snapshots, so it reads right after renames and deletions. */
export type Completion = {
  id: string;
  taskId: string | null;
  title: string;
  itemId: string | null;
  itemName: string | null;
  roomId: string | null;
  roomName: string | null;
  plant: string;
  notes: string; // the ritual's note as it was when it was tended
  doneOn: string; // yyyy-mm-dd, the day it was tended
  at: string | null; // when it was recorded (ISO); null for entries recovered from old history
  actor: string;
};

export type State = {
  version: 1;
  floors: string[];
  rooms: Room[];
  items: Item[];
  tasks: Task[];
  completions: Completion[]; // newest first
};

// The house plan: 5 tiles wide, 10 long (a narrow house). Keep in sync with GRID in server/layout.mjs.
export const GRID = { cols: 5, rows: 10 };

export const TASK_CATEGORIES = ["Cleaning", "Plants", "Pets", "Bikes & tools", "Appliances", "Garden", "Safety", "Admin", "Other"];
export const ITEM_CATEGORIES = ["Appliance", "Electronics", "Smart home", "Furniture", "Tool", "Bike & vehicle", "Garden", "Pet", "Other"];
export const ROOM_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#84cc16", "#64748b"];
