import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Item, Room, State, Task } from "./types";
import { seedState, uid } from "./seed";
import { addInterval, today } from "./dates";

export type SaveStatus = "loading" | "saved" | "saving" | "error";

type Store = {
  state: State;
  status: SaveStatus;
  saveItem: (i: Partial<Item> & { name: string }) => string;
  deleteItem: (id: string) => void;
  saveTask: (t: Partial<Task> & { title: string }) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  saveRoom: (r: Partial<Room> & { name: string }) => string;
  deleteRoom: (id: string) => void;
  addFloor: (name: string) => void;
  replaceAll: (s: State) => void;
  resetToSample: () => void;
};

const Ctx = createContext<Store>(null!);
export const useStore = () => useContext(Ctx);

const blankItem = (): Item => ({
  id: uid(), name: "", category: "Other", roomId: null, brand: "", model: "", serial: "", purchaseDate: "",
  store: "", price: null, warrantyMonths: null, manualUrl: "", notes: "",
});
const blankTask = (): Task => ({
  id: uid(), title: "", every: 1, unit: "month", dueDate: today(), lastDone: null, roomId: null, itemId: null,
  category: "Other", notes: "", history: [],
});
const blankRoom = (): Room => ({ id: uid(), name: "", floor: 0, x: 0, y: 0, w: 3, h: 2, color: "#6366f1" });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [rev, setRev] = useState(0);
  const stateRef = useRef<State | null>(null);
  stateRef.current = state;

  useEffect(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((d) => {
        if (d.state) {
          setState(d.state);
          setStatus("saved");
        } else {
          setState(seedState());
          setRev(1); // persist the starter data
        }
      })
      .catch(() => {
        setState(seedState());
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    if (rev === 0) return;
    setStatus("saving");
    const t = setTimeout(() => {
      fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stateRef.current),
      })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          setStatus("saved");
        })
        .catch(() => setStatus("error"));
    }, 500);
    return () => clearTimeout(t);
  }, [rev]);

  const mutate = useCallback((fn: (s: State) => State) => {
    setState((s) => (s ? fn(s) : s));
    setRev((r) => r + 1);
  }, []);

  if (!state) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Loading MAHA…</div>;
  }

  const upsert = <T extends { id: string }>(list: T[], obj: T) =>
    list.some((x) => x.id === obj.id) ? list.map((x) => (x.id === obj.id ? obj : x)) : [...list, obj];

  const store: Store = {
    state,
    status,
    saveItem: (i) => {
      const full = { ...blankItem(), ...i } as Item;
      mutate((s) => ({ ...s, items: upsert(s.items, full) }));
      return full.id;
    },
    deleteItem: (id) =>
      mutate((s) => ({
        ...s,
        items: s.items.filter((x) => x.id !== id),
        tasks: s.tasks.map((t) => (t.itemId === id ? { ...t, itemId: null } : t)),
      })),
    saveTask: (t) => {
      const full = { ...blankTask(), ...t } as Task;
      mutate((s) => ({ ...s, tasks: upsert(s.tasks, full) }));
    },
    deleteTask: (id) => mutate((s) => ({ ...s, tasks: s.tasks.filter((x) => x.id !== id) })),
    completeTask: (id) =>
      mutate((s) => ({
        ...s,
        tasks: s.tasks.map((t) => {
          if (t.id !== id) return t;
          const now = today();
          return { ...t, lastDone: now, dueDate: addInterval(now, t.every, t.unit), history: [now, ...t.history].slice(0, 30) };
        }),
      })),
    saveRoom: (r) => {
      const full = { ...blankRoom(), ...r } as Room;
      mutate((s) => ({ ...s, rooms: upsert(s.rooms, full) }));
      return full.id;
    },
    deleteRoom: (id) =>
      mutate((s) => ({
        ...s,
        rooms: s.rooms.filter((x) => x.id !== id),
        items: s.items.map((i) => (i.roomId === id ? { ...i, roomId: null } : i)),
        tasks: s.tasks.map((t) => (t.roomId === id ? { ...t, roomId: null } : t)),
      })),
    addFloor: (name) => mutate((s) => ({ ...s, floors: [...s.floors, name] })),
    replaceAll: (s) => mutate(() => s),
    resetToSample: () => mutate(() => seedState()),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
