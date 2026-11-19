import { useState } from "react";
import { Sprout } from "lucide-react";
import { RitualTile } from "@/components/ritual-tile";
import { TaskDialog } from "@/components/dialogs";
import { useStore } from "@/lib/store";
import { useTend } from "@/lib/use-tend";
import { todayBuckets } from "@/lib/today";
import type { Task } from "@/lib/types";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

function Section({ title, tasks, onEdit, onTend }: { title: string; tasks: Task[]; onEdit: (t: Task) => void; onTend: (t: Task) => void }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">{title} · {tasks.length}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {tasks.map((t) => <RitualTile key={t.id} task={t} onEdit={onEdit} onTend={onTend} />)}
      </div>
    </section>
  );
}

/** Deliberately quiet: what needs you today (including anything already waiting) and what comes before the week ends. */
export default function Today() {
  const { state } = useStore();
  const { tend, when } = useTend();
  const [editing, setEditing] = useState<Task>();

  const { today, upcoming } = todayBuckets(state.tasks, when);
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">{date}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting()}</h1>
      </header>

      {today.length > 0 && <Section title="Today" tasks={today} onEdit={setEditing} onTend={tend} />}
      {upcoming.length > 0 && <Section title="Later this week" tasks={upcoming} onEdit={setEditing} onTend={tend} />}

      {today.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <Sprout className="h-8 w-8 text-emerald-500/70" />
          {upcoming.length > 0 ? "Nothing needs you today. Enjoy the quiet." : "A quiet week. Everything is thriving."}
        </div>
      )}

      {editing && <TaskDialog task={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
