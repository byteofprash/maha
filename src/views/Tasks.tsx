import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { TaskRow } from "@/components/task-row";
import { TaskDialog } from "@/components/dialogs";
import { useStore } from "@/lib/store";
import { dueStatus } from "@/lib/dates";
import { TASK_CATEGORIES, type Task } from "@/lib/types";

const GROUPS: { key: ReturnType<typeof dueStatus>[]; title: string }[] = [
  { key: ["overdue"], title: "Overdue" },
  { key: ["today", "soon"], title: "This week" },
  { key: ["later"], title: "Later" },
];

export default function Tasks() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [room, setRoom] = useState("");
  const [editing, setEditing] = useState<Task | "new">();

  const filtered = useMemo(
    () =>
      state.tasks
        .filter((t) => (!cat || t.category === cat) && (!room || t.roomId === room) && t.title.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [state.tasks, q, cat, room]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="w-40" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {TASK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select className="w-44" value={room} onChange={(e) => setRoom(e.target.value)}>
          <option value="">All rooms</option>
          {state.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <Button className="ml-auto" onClick={() => setEditing("new")}><Plus /> New task</Button>
      </div>

      {GROUPS.map((g) => {
        const rows = filtered.filter((t) => g.key.includes(dueStatus(t)));
        if (!rows.length) return null;
        return (
          <section key={g.title} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">{g.title} · {rows.length}</h2>
            {rows.map((t) => <TaskRow key={t.id} task={t} onEdit={setEditing} />)}
          </section>
        );
      })}
      {filtered.length === 0 && <p className="text-sm text-muted-foreground">No tasks match.</p>}

      {editing && <TaskDialog task={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
