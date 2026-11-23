import { useRef, useState, type ReactNode } from "react";
import { Copy, Download, Upload, Trash2, Shuffle } from "lucide-react";
import { NotificationSettings } from "@/components/notification-settings";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { uid } from "@/lib/seed";
import { IconPicker } from "@/lib/item-icons";
import { Plant } from "@/components/plant";
import { PLANT_LABEL, pickPlant, plantFor } from "@/lib/plants";
import { fmtDate, today } from "@/lib/dates";
import { ITEM_CATEGORIES, ROOM_COLORS, TASK_CATEGORIES, type Item, type Room, type State, type Task } from "@/lib/types";
import { cn } from "@/lib/utils";

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function RoomSelect({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const { state } = useStore();
  return (
    <Select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— none —</option>
      {state.rooms.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name} ({state.floors[r.floor] ?? "?"})
        </option>
      ))}
    </Select>
  );
}

/* ---------------------------------- Task ---------------------------------- */

export function TaskDialog({ task, defaults, onClose }: { task?: Task; defaults?: Partial<Task>; onClose: () => void }) {
  const { state, saveTask, deleteTask } = useStore();
  const [f, setF] = useState<Task>(() => {
    const base: Task = {
      id: uid(), title: "", every: 1, unit: "month", dueDate: today(), lastDone: null, roomId: null, itemId: null,
      category: "Other", notes: "", history: [], plant: "", ...(task ?? defaults),
    };
    if (!task && !base.plant) base.plant = pickPlant(state.tasks); // a new ritual's plant, different from its neighbours
    return base;
  });
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit ritual" : "New ritual"}</DialogTitle>
          <DialogDescription>A small act of care that comes round again. When you tend to it, the next one is counted from that day.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="What will you do?">
            <Input autoFocus value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Descale the kettle" />
          </Field>
          <div className="flex items-center gap-3 rounded-lg border border-input px-3 py-1.5">
            <Plant species={plantFor(f)} vitality={1} seed={f.id} className="h-16 w-14 shrink-0" />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium">Its plant</div>
              <div className="text-xs text-muted-foreground">{PLANT_LABEL[plantFor(f)]}: it thrives while you keep tending this.</div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => set("plant", pickPlant(state.tasks.filter((x) => x.id !== f.id), plantFor(f)))}>
              <Shuffle /> Shuffle
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Repeats every">
              <div className="flex gap-2">
                <Input type="number" min={1} value={f.every} onChange={(e) => set("every", Math.max(1, Number(e.target.value) || 1))} className="w-20" />
                <Select value={f.unit} onChange={(e) => set("unit", e.target.value as Task["unit"])}>
                  <option value="day">days</option>
                  <option value="week">weeks</option>
                  <option value="month">months</option>
                </Select>
              </div>
            </Field>
            <Field label="Next due">
              <Input type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={f.category} onChange={(e) => set("category", e.target.value)}>
                {TASK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Room">
              <RoomSelect value={f.roomId} onChange={(v) => set("roomId", v)} />
            </Field>
          </div>
          <Field label="Related item">
            <Select
              value={f.itemId ?? ""}
              onChange={(e) => {
                const id = e.target.value || null;
                const it = state.items.find((i) => i.id === id);
                setF((p) => ({ ...p, itemId: id, roomId: p.roomId ?? it?.roomId ?? null }));
              }}
            >
              <option value="">— none —</option>
              {state.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="How-to, product to use, where the supplies are…" />
          </Field>
          {task && task.history.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Last done {fmtDate(task.history[0])}
              {task.history.length > 1 && ` · before that ${task.history.slice(1, 4).map(fmtDate).join(", ")}`}
            </p>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          {task ? (
            <Button variant="ghost" className="text-destructive" onClick={() => { deleteTask(task.id); onClose(); }}>
              <Trash2 /> Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!f.title.trim()} onClick={() => { saveTask({ ...f, title: f.title.trim() }); onClose(); }}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- Item ---------------------------------- */

export function ItemDialog({ item, defaults, onClose }: { item?: Item; defaults?: Partial<Item>; onClose: () => void }) {
  const { saveItem, deleteItem } = useStore();
  const [f, setF] = useState<Item>(() => ({
    id: uid(), name: "", category: "Other", roomId: null, brand: "", model: "", serial: "", purchaseDate: "",
    store: "", price: null, warrantyMonths: null, manualUrl: "", icon: "", notes: "", ...(item ?? defaults),
  }));
  const set = <K extends keyof Item>(k: K, v: Item[K]) => setF((p) => ({ ...p, [k]: v }));
  const num = (s: string) => (s === "" ? null : Number(s));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
          <DialogDescription>What it is, where it lives, and how to look it up later.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name">
            <Input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Dishwasher" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={f.category} onChange={(e) => set("category", e.target.value)}>
                {ITEM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Room">
              <RoomSelect value={f.roomId} onChange={(v) => set("roomId", v)} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Brand"><Input value={f.brand} onChange={(e) => set("brand", e.target.value)} /></Field>
            <Field label="Model number"><Input value={f.model} onChange={(e) => set("model", e.target.value)} /></Field>
            <Field label="Serial number"><Input value={f.serial} onChange={(e) => set("serial", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Bought on"><Input type="date" value={f.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} /></Field>
            <Field label="Store"><Input value={f.store} onChange={(e) => set("store", e.target.value)} /></Field>
            <Field label="Price (€)"><Input type="number" min={0} step="0.01" value={f.price ?? ""} onChange={(e) => set("price", num(e.target.value))} /></Field>
            <Field label="Warranty (months)"><Input type="number" min={0} value={f.warrantyMonths ?? ""} onChange={(e) => set("warrantyMonths", num(e.target.value))} /></Field>
          </div>
          <Field label="Manual / receipt link"><Input value={f.manualUrl} onChange={(e) => set("manualUrl", e.target.value)} placeholder="https://…" /></Field>
          <Field label="Icon"><IconPicker item={f} onChange={(k) => set("icon", k)} /></Field>
          <Field label="Notes"><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
        <DialogFooter className="sm:justify-between">
          {item ? (
            <Button variant="ghost" className="text-destructive" onClick={() => { deleteItem(item.id); onClose(); }}>
              <Trash2 /> Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!f.name.trim()} onClick={() => { saveItem({ ...f, name: f.name.trim() }); onClose(); }}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- Room ---------------------------------- */

export function RoomDialog({ room, defaults, onClose }: { room?: Room; defaults?: Partial<Room>; onClose: () => void }) {
  const { state, saveRoom, deleteRoom } = useStore();
  const [f, setF] = useState<Room>(() => ({
    id: uid(), name: "", floor: 0, x: 0, y: 0, w: 3, h: 2, color: ROOM_COLORS[0], ...(room ?? defaults),
  }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{room ? "Edit room" : "Add room"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Name"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Floor">
            <Select value={f.floor} onChange={(e) => setF({ ...f, floor: Number(e.target.value) })}>
              {state.floors.map((n, i) => <option key={i} value={i}>{n}</option>)}
            </Select>
          </Field>
          <Field label="Colour">
            <div className="flex gap-2">
              {ROOM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setF({ ...f, color: c })}
                  className={cn("h-7 w-7 rounded-full border-2", f.color === c ? "border-foreground" : "border-transparent")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
        </div>
        <DialogFooter className="sm:justify-between">
          {room ? (
            <Button variant="ghost" className="text-destructive" onClick={() => { deleteRoom(room.id); onClose(); }}>
              <Trash2 /> Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!f.name.trim()} onClick={() => { saveRoom({ ...f, name: f.name.trim() }); onClose(); }}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- Data ---------------------------------- */

export function DataDialog({ onClose, feedPath }: { onClose: () => void; feedPath: string }) {
  const { state, replaceAll, resetToSample } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const feed = `${location.origin}${feedPath}`;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aham-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      const s = JSON.parse(await file.text()) as State;
      if (!Array.isArray(s.rooms) || !Array.isArray(s.items) || !Array.isArray(s.tasks) || !Array.isArray(s.floors)) throw new Error();
      replaceAll(s);
      setMsg(`Imported ${s.items.length} items, ${s.tasks.length} tasks, ${s.rooms.length} rooms.`);
    } catch {
      setMsg("That file isn't an AHAM backup.");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>An evening reminder, backups, and a calendar feed for due dates.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 text-sm">
          <NotificationSettings />
          <section className="space-y-2">
            <p className="font-medium">Backup</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportJson}><Download /> Export JSON</Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Import JSON</Button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
            </div>
            {msg && <p className="text-muted-foreground">{msg}</p>}
          </section>
          <section className="space-y-2">
            <p className="font-medium">Calendar feed (due dates)</p>
            <div className="flex gap-2">
              <Input readOnly value={feed} onFocus={(e) => e.currentTarget.select()} />
              <Button variant="outline" size="icon" onClick={() => navigator.clipboard?.writeText(feed)} aria-label="Copy"><Copy /></Button>
            </div>
            <p className="text-muted-foreground">Subscribe from Google / Apple Calendar via “add by URL” to get due dates as all-day events and your calendar's own reminders.</p>
          </section>
          <section className="space-y-2">
            <p className="font-medium">Reset</p>
            <Button variant="outline" className="text-destructive" onClick={() => { if (confirm("Replace everything with the sample data?")) { resetToSample(); onClose(); } }}>
              Reset to sample data
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
