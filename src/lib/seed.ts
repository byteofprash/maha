import type { Item, Room, State, Task } from "./types";
import { addDays, today } from "./dates";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

/**
 * Starter data. Rooms and the floor plan are a placeholder layout — drag/resize them in the House view.
 * Items only carry what is known (brand / series); add exact model numbers from the rating plates.
 */
export function seedState(): State {
  const t0 = today();
  const room = (name: string, x: number, y: number, w: number, h: number, color: string, floor = 0): Room => ({
    id: uid(), name, floor, x, y, w, h, color,
  });
  const rooms = {
    kitchen: room("Kitchen", 0, 0, 4, 3, "#f59e0b"),
    living: room("Living room", 4, 0, 5, 4, "#6366f1"),
    hall: room("Hall", 9, 0, 3, 3, "#64748b"),
    utility: room("Utility / laundry", 0, 3, 3, 2, "#06b6d4"),
    bath: room("Bathroom", 9, 3, 3, 2, "#10b981"),
    bedroom: room("Bedroom", 0, 5, 4, 3, "#a855f7"),
    kid: room("Kid's room", 4, 4, 4, 4, "#ef4444"),
    storage: room("Garage / storage", 9, 5, 3, 3, "#84cc16"),
    garden: room("Garden", 0, 0, 8, 5, "#84cc16", 1),
  };

  const item = (name: string, category: string, roomId: string | null, brand = "", model = "", notes = ""): Item => ({
    id: uid(), name, category, roomId, brand, model, serial: "", purchaseDate: "", store: "", price: null,
    warrantyMonths: null, manualUrl: "", notes,
  });
  const NEED = "Add the full model number from the rating plate.";
  const items = {
    dishwasher: item("Dishwasher (i3)", "Appliance", rooms.kitchen.id, "Siemens", "", NEED),
    oven: item("Oven", "Appliance", rooms.kitchen.id, "Neff", "", NEED),
    hob: item("Induction stove", "Appliance", rooms.kitchen.id, "Neff", "", NEED),
    washer: item("Washing machine (i5)", "Appliance", rooms.utility.id, "Siemens", "", NEED),
    dryer: item("Heat-pump dryer", "Appliance", rooms.utility.id, "Siemens", "", NEED),
    deebot: item("Robot vacuum", "Appliance", null, "Ecovacs", "Deebot N8 Pro"),
    miele1: item("Cordless vacuum", "Appliance", null, "Miele", "Cat & Dog HX1"),
    miele2: item("Corded vacuum", "Appliance", null, "Miele", "Cat & Dog", NEED),
    eufy: item("Security cameras", "Smart home", null, "Eufy", "", "Add each camera's model + location."),
    drill: item("Impact drill", "Tool", rooms.storage.id, "Bosch (Green)"),
    rotary: item("Rotary drill", "Tool", rooms.storage.id, "Bosch (Green)"),
    saw: item("Table saw", "Tool", rooms.storage.id, "Bosch (Green)"),
    sander: item("Rotary sander", "Tool", rooms.storage.id, "Bosch (Green)"),
    bike: item("Bicycle", "Bike & vehicle", rooms.storage.id),
    knives: item("Kitchen knives", "Other", rooms.kitchen.id),
    veeraBed: item("Veera's bed", "Pet", rooms.living.id),
  };

  // First due dates are staggered so the dashboard isn't one big wall on day one.
  const task = (title: string, every: number, unit: Task["unit"], offset: number, category: string, extra: Partial<Task> = {}): Task => ({
    id: uid(), title, every, unit, dueDate: addDays(t0, offset), lastDone: null, roomId: null, itemId: null,
    category, notes: "", history: [], ...extra,
  });
  const tasks: Task[] = [
    task("Water the plants", 1, "week", 0, "Plants", { roomId: rooms.living.id }),
    task("Fill air in the bicycle tyres", 2, "week", 1, "Bikes & tools", { itemId: items.bike.id }),
    task("Sharpen the knives", 2, "month", 5, "Cleaning", { itemId: items.knives.id, roomId: rooms.kitchen.id }),
    task("Wash Veera's clothes", 1, "month", 10, "Pets"),
    task("Clean the wardrobes", 3, "month", 14, "Cleaning", { roomId: rooms.bedroom.id }),
    task("Wash Veera's bed", 3, "month", 20, "Pets", { itemId: items.veeraBed.id }),
  ];

  return {
    version: 1,
    floors: ["Main floor", "Garden"],
    rooms: Object.values(rooms),
    items: Object.values(items),
    tasks,
  };
}
