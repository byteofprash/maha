import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, HandHeart, Plus } from "lucide-react";
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

export default function Inventory() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [room, setRoom] = useState("");
  const [editing, setEditing] = useState<Item | "new">();
  const [caring, setCaring] = useState<Item>();
  const now = today();

  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return state.items
      .filter((i) => (!cat || i.category === cat) && (!room || (room === "none" ? !i.roomId : i.roomId === room)))
      .filter((i) => !s || [i.name, i.brand, i.model, i.serial, i.store, i.notes].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.items, q, cat, room]);

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
        <Button className="ml-auto" onClick={() => setEditing("new")}><Plus /> Add item</Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Brand</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Bought</th>
              <th className="px-4 py-3 font-medium">Warranty</th>
              <th className="px-4 py-3 text-right font-medium">Care</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const room = state.rooms.find((r) => r.id === i.roomId);
              const end = warrantyEnd(i.purchaseDate, i.warrantyMonths);
              const nTasks = state.tasks.filter((t) => t.itemId === i.id).length;
              return (
                <tr key={i.id} className="cursor-pointer border-b last:border-0 hover:bg-accent/50" onClick={() => setEditing(i)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ItemIcon item={i} />
                      <div className="min-w-0">
                        <div className="font-medium">{i.name}</div>
                        <div className="text-xs text-muted-foreground">{i.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{room ? room.name : <span className="text-muted-foreground">Unplaced</span>}</td>
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
                      {nTasks > 0 && <span className="text-xs text-muted-foreground" title="Care routines">{nTasks}</span>}
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
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground">No items match.</p>}
      </Card>

      {caring && <CareDialog item={caring} onClose={() => setCaring(undefined)} />}
      {editing && <ItemDialog item={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
