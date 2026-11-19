import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Item, Room, State, Task } from "./types";
import { seedState, uid } from "./seed";
import { addInterval, today } from "./dates";
import { pickPlant } from "./plants";

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
  store: "", price: null, warrantyMonths: null, manualUrl: "", icon: "", notes: "",
});
const blankTask = (): Task => ({
  id: uid(), title: "", every: 1, unit: "month", dueDate: today(), lastDone: null, roomId: null, itemId: null,
  category: "Other", notes: "", history: [], plant: "",
});
const blankRoom = (): Room => ({ id: uid(), name: "", floor: 0, x: 0, y: 0, w: 3, h: 2, color: "#6366f1" });

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const pending = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const failed = useRef(false);

  const load = useCallback((afterError = false) => {
    return fetch("/api/state")
      .then((r) => r.json())
      .then((d) => {
        if (d.state) {
          setState(d.state);
          setStatus(afterError ? "error" : "saved");
        } else {
          const seed = seedState();
          setState(seed);
          send("/api/state", json("PUT", seed));
        }
      })
      .catch(() => {
        setState((s) => s ?? seedState());
        setStatus("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Writes are queued so they reach the server in order (e.g. item before the task that links it). */
  const send = useCallback(
    (url: string, init: RequestInit, onOk?: (data: any) => void) => {
      pending.current++;
      failed.current = false;
      setStatus("saving");
      chain.current = chain.current
        .then(() => fetch(url, init))
        .then(async (r) => {
          if (!r.ok) throw new Error(String(r.status));
          onOk?.(await r.json());
          if (--pending.current === 0 && !failed.current) setStatus("saved");
        })
        .catch(() => {
          pending.current--;
          failed.current = true;
          setStatus("error");
          load(true); // server rejected or is unreachable: fall back to what it actually has
        });
    },
    [load]
  );

  useEffect(() => {
    load();
  }, [load]);

  const mutate = useCallback((fn: (s: State) => State) => setState((s) => (s ? fn(s) : s)), []);

  if (!state) {
    return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Loading AHAM…</div>;
  }

  const upsert = <T extends { id: string }>(list: T[], obj: T) =>
    list.some((x) => x.id === obj.id) ? list.map((x) => (x.id === obj.id ? obj : x)) : [...list, obj];

  const put = (kind: "items" | "tasks" | "rooms", obj: { id: string }) => send(`/api/${kind}/${obj.id}`, json("PUT", obj));
  const del = (kind: "items" | "tasks" | "rooms", id: string) => send(`/api/${kind}/${id}`, json("DELETE"));

  const store: Store = {
    state,
    status,
    saveItem: (i) => {
      const full = { ...blankItem(), ...i } as Item;
      mutate((s) => ({ ...s, items: upsert(s.items, full) }));
      put("items", full);
      return full.id;
    },
    deleteItem: (id) => {
      mutate((s) => ({
        ...s,
        items: s.items.filter((x) => x.id !== id),
        tasks: s.tasks.map((t) => (t.itemId === id ? { ...t, itemId: null } : t)),
      }));
      del("items", id);
    },
    saveTask: (t) => {
      const full = { ...blankTask(), ...t } as Task;
      // a brand-new ritual gets the plant its neighbours have the least of
      if (!full.plant && !state.tasks.some((x) => x.id === full.id)) full.plant = pickPlant(state.tasks);
      mutate((s) => ({ ...s, tasks: upsert(s.tasks, full) }));
      put("tasks", full);
    },
    deleteTask: (id) => {
      mutate((s) => ({ ...s, tasks: s.tasks.filter((x) => x.id !== id) }));
      del("tasks", id);
    },
    completeTask: (id) => {
      const now = today();
      mutate((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id !== id ? t : { ...t, lastDone: now, dueDate: addInterval(now, t.every, t.unit), history: [now, ...t.history].slice(0, 30) }
        ),
      }));
      send(`/api/tasks/${id}/complete`, json("POST", { date: now }));
    },
    saveRoom: (r) => {
      const full = { ...blankRoom(), ...r } as Room;
      mutate((s) => ({ ...s, rooms: upsert(s.rooms, full) }));
      put("rooms", full);
      return full.id;
    },
    deleteRoom: (id) => {
      mutate((s) => ({
        ...s,
        rooms: s.rooms.filter((x) => x.id !== id),
        items: s.items.map((i) => (i.roomId === id ? { ...i, roomId: null } : i)),
        tasks: s.tasks.map((t) => (t.roomId === id ? { ...t, roomId: null } : t)),
      }));
      del("rooms", id);
    },
    addFloor: (name) => {
      mutate((s) => ({ ...s, floors: [...s.floors, name] }));
      send("/api/floors", json("POST", { name }));
    },
    replaceAll: (s) => {
      setState(s);
      send("/api/state", json("PUT", s));
    },
    resetToSample: () => {
      const seed = seedState();
      setState(seed);
      send("/api/state", json("PUT", seed));
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
