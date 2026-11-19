import { useRef, useState, type PointerEvent } from "react";
import { Pencil, Plus, Package, Flower2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RitualTile } from "@/components/ritual-tile";
import { TendedList } from "@/components/tended-list";
import { ItemDialog, RoomDialog, TaskDialog } from "@/components/dialogs";
import { ItemIcon } from "@/lib/item-icons";
import { useStore } from "@/lib/store";
import { useTend } from "@/lib/use-tend";
import { diffDays, today } from "@/lib/dates";
import { GRID, type Item, type Room, type Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

type Drag = { id: string; mode: "move" | "resize"; sx: number; sy: number; orig: Room; last: Room };

export default function House() {
  const { state, saveRoom, addFloor } = useStore();
  const [floor, setFloor] = useState(0);
  const [edit, setEdit] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [roomDlg, setRoomDlg] = useState<Room | "new">();
  const [taskDlg, setTaskDlg] = useState<{ defaults?: Partial<Task> }>();
  const [itemDlg, setItemDlg] = useState<{ item?: Item; defaults?: Partial<Item> }>();
  const [newFloor, setNewFloor] = useState("");
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const now = today();
  const { tend, when } = useTend();

  const rooms = state.rooms.filter((r) => r.floor === floor);
  const selected = state.rooms.find((r) => r.id === selId) ?? null;

  const roomItems = (id: string) => state.items.filter((i) => i.roomId === id);
  const roomTasks = (id: string) => state.tasks.filter((t) => t.roomId === id || state.items.find((i) => i.id === t.itemId)?.roomId === id);
  const unplaced = state.items.filter((i) => !i.roomId);

  const down = (e: PointerEvent<HTMLElement>, r: Room, mode: Drag["mode"]) => {
    setSelId(r.id);
    if (!edit) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: r.id, mode, sx: e.clientX, sy: e.clientY, orig: r, last: r };
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || !canvas.current) return;
    const rect = canvas.current.getBoundingClientRect();
    const dx = Math.round((e.clientX - d.sx) / (rect.width / GRID.cols));
    const dy = Math.round((e.clientY - d.sy) / (rect.height / GRID.rows));
    const o = d.orig;
    const next: Room =
      d.mode === "move"
        ? { ...o, x: clamp(o.x + dx, 0, GRID.cols - o.w), y: clamp(o.y + dy, 0, GRID.rows - o.h) }
        : { ...o, w: clamp(o.w + dx, 1, GRID.cols - o.x), h: clamp(o.h + dy, 1, GRID.rows - o.y) };
    if (next.x !== d.last.x || next.y !== d.last.y || next.w !== d.last.w || next.h !== d.last.h) {
      d.last = next;
      saveRoom(next);
    }
  };
  const up = () => { drag.current = null; };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[26rem] space-y-3 lg:mx-0">
        <div className="flex flex-wrap items-center gap-2">
          {state.floors.map((n, i) => (
            <Button key={i} size="sm" variant={i === floor ? "default" : "outline"} onClick={() => { setFloor(i); setSelId(null); }}>{n}</Button>
          ))}
          {edit && (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => { e.preventDefault(); if (newFloor.trim()) { addFloor(newFloor.trim()); setNewFloor(""); } }}
            >
              <Input className="h-8 w-32" placeholder="New floor…" value={newFloor} onChange={(e) => setNewFloor(e.target.value)} />
              <Button size="sm" variant="outline" type="submit"><Plus /></Button>
            </form>
          )}
          <div className="ml-auto flex gap-2">
            {edit && <Button size="sm" variant="outline" onClick={() => setRoomDlg("new")}><Plus /> Room</Button>}
            <Button size="sm" variant={edit ? "default" : "outline"} onClick={() => setEdit(!edit)}>
              {edit ? <><Check /> Done</> : <><Pencil /> Edit layout</>}
            </Button>
          </div>
        </div>

        <div
          ref={canvas}
          className="relative w-full overflow-hidden rounded-lg border bg-card"
          style={{
            aspectRatio: `${GRID.cols} / ${GRID.rows}`,
            backgroundImage:
              "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: `${100 / GRID.cols}% ${100 / GRID.rows}%`,
          }}
          onClick={() => !edit && setSelId(null)}
        >
          {rooms.map((r) => {
            const its = roomItems(r.id);
            const ts = roomTasks(r.id);
            const late = ts.filter((t) => diffDays(t.dueDate, now) <= 0).length;
            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onPointerDown={(e) => down(e, r, "move")}
                onPointerMove={move}
                onPointerUp={up}
                onClick={(e) => { e.stopPropagation(); setSelId(r.id); }}
                onDoubleClick={() => edit && setRoomDlg(r)}
                onKeyDown={(e) => e.key === "Enter" && setSelId(r.id)}
                className={cn(
                  "absolute select-none overflow-hidden rounded-md border-2 p-2 text-left transition-shadow",
                  edit ? "cursor-move touch-none" : "cursor-pointer hover:shadow-md",
                  selId === r.id && "ring-2 ring-ring ring-offset-1 ring-offset-background"
                )}
                style={{
                  left: `${(r.x / GRID.cols) * 100}%`,
                  top: `${(r.y / GRID.rows) * 100}%`,
                  width: `${(r.w / GRID.cols) * 100}%`,
                  height: `${(r.h / GRID.rows) * 100}%`,
                  background: `${r.color}26`,
                  borderColor: r.color,
                }}
              >
                <div className="truncate text-xs font-semibold sm:text-sm">{r.name}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {its.length > 0 && <Badge variant="secondary" className="px-1.5 text-[10px]"><Package className="h-3 w-3" />{its.length}</Badge>}
                  {ts.length > 0 && (
                    <Badge variant={late ? "warning" : "secondary"} className="px-1.5 text-[10px]"><Flower2 className="h-3 w-3" />{late ? `${late} waiting` : ts.length}</Badge>
                  )}
                </div>
                {edit && (
                  <div
                    onPointerDown={(e) => down(e, r, "resize")}
                    className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none rounded-tl bg-foreground/60"
                    title="Resize"
                  />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {edit ? "Drag rooms to move, drag the corner to resize, double-click to rename or delete. The plan is a simple grid, 5 tiles wide and 10 long: rough is fine." : "Tap a room to see what lives there and what it needs."}
        </p>
      </div>

      <div className="space-y-4">
        {selected ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>{selected.name}</CardTitle>
                  <CardDescription>{state.floors[selected.floor]}</CardDescription>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setRoomDlg(selected)}><Pencil /> Edit</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Items</h3>
                  <Button size="sm" variant="outline" onClick={() => setItemDlg({ defaults: { roomId: selected.id } })}><Plus /> Add</Button>
                </div>
                {roomItems(selected.id).length === 0 && <p className="text-sm text-muted-foreground">Nothing placed here yet.</p>}
                {roomItems(selected.id).map((i) => (
                  <button key={i.id} onClick={() => setItemDlg({ item: i })} className="flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent">
                    <ItemIcon item={i} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{i.name}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">{i.model || i.brand}</span>
                  </button>
                ))}
              </section>
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Rituals</h3>
                  <Button size="sm" variant="outline" onClick={() => setTaskDlg({ defaults: { roomId: selected.id } })}><Plus /> Add</Button>
                </div>
                {roomTasks(selected.id).length === 0 && <p className="text-sm text-muted-foreground">No rituals for this room yet.</p>}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                  {[...roomTasks(selected.id)].sort((a, b) => when(a).localeCompare(when(b))).map((t) => (
                    <RitualTile key={t.id} task={t} onTend={tend} />
                  ))}
                </div>
              </section>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Room details</CardTitle>
              <CardDescription>Select a room on the plan.</CardDescription>
            </CardHeader>
          </Card>
        )}

        <TendedList completions={state.completions} room={selected ? { id: selected.id, name: selected.name } : null} />

        {unplaced.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Not placed yet</CardTitle>
              <CardDescription>Open an item and pick its room to put it on the plan.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {unplaced.map((i) => (
                <button key={i.id} onClick={() => setItemDlg({ item: i })}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-accent">{i.name}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {roomDlg && (
        <RoomDialog
          room={roomDlg === "new" ? undefined : roomDlg}
          defaults={{ floor }}
          onClose={() => setRoomDlg(undefined)}
        />
      )}
      {taskDlg && <TaskDialog defaults={taskDlg.defaults} onClose={() => setTaskDlg(undefined)} />}
      {itemDlg && <ItemDialog item={itemDlg.item} defaults={itemDlg.defaults} onClose={() => setItemDlg(undefined)} />}
    </div>
  );
}
