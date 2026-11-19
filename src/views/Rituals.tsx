import { useMemo, useState } from "react";
import { Plus, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { RitualTile } from "@/components/ritual-tile";
import { TaskDialog } from "@/components/dialogs";
import { useStore } from "@/lib/store";
import { useTend } from "@/lib/use-tend";
import { dueStatus } from "@/lib/dates";
import { TASK_CATEGORIES, type Task } from "@/lib/types";

const GROUPS: { key: ReturnType<typeof dueStatus>[]; title: string }[] = [
  { key: ["overdue", "today"], title: "Waiting for you" }, // due today = its plant already says "Waiting for you"
  { key: ["soon"], title: "Coming up this week" },
  { key: ["later"], title: "Resting easy" },
];

export default function Rituals() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [room, setRoom] = useState("");
  const [creating, setCreating] = useState(false);

  const { tend, when, held } = useTend();

  const filtered = useMemo(
    () =>
      state.tasks
        .filter((t) => (!cat || t.category === cat) && (!room || t.roomId === room) && t.title.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => when(a).localeCompare(when(b))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.tasks, q, cat, room, held]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder="Search rituals…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="w-40" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All kinds</option>
          {TASK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select className="w-44" value={room} onChange={(e) => setRoom(e.target.value)}>
          <option value="">All rooms</option>
          {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <Button className="ml-auto" onClick={() => setCreating(true)}><Plus /> New ritual</Button>
      </div>

      {/* one grid, so a tile keeps its place (and its animation) while the others move around it */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2.5">
        {GROUPS.flatMap((g) => {
          const rows = filtered.filter((t) => g.key.includes(dueStatus({ ...t, dueDate: when(t) })));
          if (!rows.length) return [];
          return [
            <h2 key={`h-${g.title}`} className="col-span-full mt-2 text-sm font-semibold text-muted-foreground first:mt-0">
              {g.title} · {rows.length}
            </h2>,
            ...rows.map((t) => <RitualTile key={t.id} task={t} onTend={tend} compact />),
          ];
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
          <Sprout className="h-8 w-8 text-emerald-500/70" />
          {state.tasks.length === 0
            ? "No rituals yet. Open something in your inventory and tap the little hand to start one."
            : "No rituals match."}
        </div>
      )}

      {creating && <TaskDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
