import { Fragment, useMemo, useState } from "react";
import { Check, ChevronRight, FoldVertical, UnfoldVertical, Copy, ExternalLink, HandHeart, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { ItemDialog } from "@/components/dialogs";
import { CareDialog } from "@/components/care-dialog";
import { ItemIcon } from "@/lib/item-icons";
import { useStore } from "@/lib/store";
import { diffDays, fmtDate, today, warrantyEnd } from "@/lib/dates";
import { ITEM_CATEGORIES, type Item } from "@/lib/types";
import { cn } from "@/lib/utils";

function CopyModel({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <button
      className="inline-flex items-center gap-1.5 rounded px-1 font-mono text-xs hover:bg-accent"
      title="Copy"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value);
        setOk(true);
        setTimeout(() => setOk(false), 1200);
      }}
    >
      {value} {ok ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 opacity-50" />}
    </button>
  );
}

const UNPLACED = "none";
const COLLAPSED_KEY = "maha.inventory.collapsed";

// Which rooms are folded is a per-person convenience: remembered in this browser, never required.
function loadCollapsed(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "[]");
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
function saveCollapsed(s: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...s]));
  } catch {
    /* private mode / blocked storage: fine, it just won't be remembered */
  }
}

type Editing = { item: Item } | { roomId: string | null };
type Group = { id: string; name: string; floor?: string; color: string; items: Item[] };

export default function Inventory() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [room, setRoom] = useState("");
  const [editing, setEditing] = useState<Editing>();
  const [caring, setCaring] = useState<Item>();
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);
  const now = today();
  const filtering = !!(q || cat || room);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveCollapsed(next);
      return next;
    });

  // Items grouped by room: rooms by floor then name, "Unplaced" last, empty rooms left out.
  const groups = useMemo(() => {
    const s = q.toLowerCase();
    const rows = state.items
      .filter((i) => (!cat || i.category === cat) && (!room || (room === UNPLACED ? !i.roomId : i.roomId === room)))
      .filter((i) => !s || [i.name, i.brand, i.model, i.serial, i.store, i.notes].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => a.name.localeCompare(b.name));
    const byRoom = new Map<string, Item[]>();
    for (const i of rows) {
      const k = i.roomId && state.rooms.some((r) => r.id === i.roomId) ? i.roomId : UNPLACED;
      byRoom.set(k, [...(byRoom.get(k) ?? []), i]);
    }
    const rooms = [...state.rooms].sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name));
    const out: Group[] = rooms
      .filter((r) => byRoom.has(r.id))
      .map((r) => ({ id: r.id, name: r.name, floor: state.floors[r.floor], color: r.color, items: byRoom.get(r.id)! }));
    if (byRoom.has(UNPLACED)) out.push({ id: UNPLACED, name: "Unplaced", floor: undefined, color: "", items: byRoom.get(UNPLACED)! });
    return out;
  }, [state.items, state.rooms, state.floors, q, cat, room]);

  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed.has(g.id));
  const setAll = (fold: boolean) => {
    const next = new Set(collapsed);
    for (const g of groups) fold ? next.add(g.id) : next.delete(g.id);
    setCollapsed(next);
    saveCollapsed(next);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder="Search name, brand, model, serial…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="w-40" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {ITEM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select className="w-44" value={room} onChange={(e) => setRoom(e.target.value)}>
          <option value="">All rooms</option>
          <option value="none">Unplaced</option>
          {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        {!filtering && groups.length > 1 && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setAll(!allCollapsed)}>
            {allCollapsed ? <UnfoldVertical /> : <FoldVertical />} {allCollapsed ? "Open all rooms" : "Fold all rooms"}
          </Button>
        )}
        <Button className={cn(filtering || groups.length <= 1 ? "ml-auto" : "")} onClick={() => setEditing({ roomId: room && room !== UNPLACED ? room : null })}>
          <Plus /> Add item
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Brand</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Bought</th>
              <th className="px-4 py-3 font-medium">Warranty</th>
              <th className="px-4 py-3 text-right font-medium">Care</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const open = filtering || !collapsed.has(g.id);
              return (
                <Fragment key={g.id}>
                  <tr className="border-b bg-muted/40">
                    <td colSpan={6} className="p-0">
                      <div className="flex items-center gap-1 pr-2">
                        <button
                          type="button"
                          aria-expanded={open}
                          disabled={filtering}
                          onClick={() => toggle(g.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left disabled:cursor-default"
                        >
                          <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
                          <span
                            className={cn("h-2.5 w-2.5 shrink-0 rounded-full", !g.color && "border border-dashed border-muted-foreground/60")}
                            style={g.color ? { background: g.color } : undefined}
                          />
                          <span className={cn("font-medium", g.id === UNPLACED && "text-muted-foreground")}>{g.name}</span>
                          {g.floor && <span className="text-xs text-muted-foreground">{g.floor}</span>}
                          <span className="text-xs text-muted-foreground">· {g.items.length} {g.items.length === 1 ? "item" : "items"}</span>
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          title={g.id === UNPLACED ? "Add an item" : `Add an item to ${g.name}`}
                          onClick={() => setEditing({ roomId: g.id === UNPLACED ? null : g.id })}
                        >
                          <Plus className="!size-3.5" /> Add
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {open &&
                    g.items.map((i) => {
                  const end = warrantyEnd(i.purchaseDate, i.warrantyMonths);
                  const nTasks = state.tasks.filter((t) => t.itemId === i.id).length;
                  return (
                    <tr key={i.id} className="cursor-pointer border-b last:border-0 hover:bg-accent/50" onClick={() => setEditing({ item: i })}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ItemIcon item={i} />
                          <div className="min-w-0">
                            <div className="font-medium">{i.name}</div>
                            <div className="text-xs text-muted-foreground">{i.category}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{i.brand || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <CopyModel value={i.model} />
                          {i.manualUrl && (
                            <a href={i.manualUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Manual / receipt" className="text-muted-foreground hover:text-foreground">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {i.purchaseDate ? fmtDate(i.purchaseDate) : "—"}
                        {i.store && <div className="text-xs">{i.store}{i.price != null && ` · €${i.price}`}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {end ? (
                          <Badge variant={diffDays(end, now) < 0 ? "destructive" : diffDays(end, now) < 90 ? "warning" : "success"}>
                            {diffDays(end, now) < 0 ? "Expired" : `Until ${fmtDate(end)}`}
                          </Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {nTasks > 0 && <span className="text-xs text-muted-foreground" title="Rituals">{nTasks}</span>}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                            title="Tend to this"
                            aria-label={`Add care for ${i.name}`}
                            onClick={(e) => { e.stopPropagation(); setCaring(i); }}
                          >
                            <HandHeart />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {groups.length === 0 && <p className="p-6 text-sm text-muted-foreground">{filtering ? "No items match." : "Nothing here yet. Add the first thing you look after."}</p>}
      </Card>

      {caring && <CareDialog item={caring} onClose={() => setCaring(undefined)} />}
      {editing && (
        <ItemDialog
          item={"item" in editing ? editing.item : undefined}
          defaults={"item" in editing ? undefined : { roomId: editing.roomId }}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
