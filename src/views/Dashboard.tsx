import { useState } from "react";
import { AlertTriangle, CalendarClock, Flower2, Package, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskRow } from "@/components/task-row";
import { ItemDialog, TaskDialog } from "@/components/dialogs";
import { useStore } from "@/lib/store";
import { diffDays, fmtDate, today, warrantyEnd } from "@/lib/dates";
import type { Item, Task } from "@/lib/types";

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Package; label: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-md bg-muted p-2.5 ${tone ?? ""}`}><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { state } = useStore();
  const [task, setTask] = useState<Task>();
  const [item, setItem] = useState<Item>();
  const now = today();

  const sorted = [...state.tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdue = sorted.filter((t) => diffDays(t.dueDate, now) < 0);
  const thisWeek = sorted.filter((t) => { const d = diffDays(t.dueDate, now); return d >= 0 && d <= 7; });
  const upcoming = sorted.filter((t) => { const d = diffDays(t.dueDate, now); return d > 7 && d <= 30; });
  const attention = [...overdue, ...thisWeek];

  const warranties = state.items
    .map((i) => ({ i, end: warrantyEnd(i.purchaseDate, i.warrantyMonths) }))
    .filter((w): w is { i: Item; end: string } => !!w.end && diffDays(w.end, now) <= 90 && diffDays(w.end, now) >= -30)
    .sort((a, b) => a.end.localeCompare(b.end));

  const missingModel = state.items.filter((i) => !i.model.trim()).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={AlertTriangle} label="Waiting for you" value={overdue.length} tone={overdue.length ? "text-amber-600" : ""} />
        <Stat icon={CalendarClock} label="Due in the next 7 days" value={thisWeek.length} />
        <Stat icon={Flower2} label="Rituals" value={state.tasks.length} />
        <Stat icon={Package} label="Items tracked" value={state.items.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Waiting for you, or coming up within a week. Tap the little hand once you've tended to it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {attention.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting this week. 🌿</p>}
            {attention.map((t) => <TaskRow key={t.id} task={t} onEdit={setTask} />)}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Next 30 days</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nothing else scheduled.</p>}
              {upcoming.map((t) => <TaskRow key={t.id} task={t} onEdit={setTask} compact />)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Warranties</CardTitle>
              <CardDescription>Ending within 90 days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {warranties.length === 0 && <p className="text-sm text-muted-foreground">Nothing expiring soon.</p>}
              {warranties.map(({ i, end }) => (
                <button key={i.id} onClick={() => setItem(i)} className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-accent">
                  <span className="truncate">{i.name}</span>
                  <Badge variant={diffDays(end, now) < 0 ? "destructive" : "warning"}>{diffDays(end, now) < 0 ? "Expired" : fmtDate(end)}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          {missingModel > 0 && (
            <p className="px-1 text-xs text-muted-foreground">{missingModel} item{missingModel > 1 ? "s" : ""} still without a model number — add them under Inventory.</p>
          )}
        </div>
      </div>

      {task && <TaskDialog task={task} onClose={() => setTask(undefined)} />}
      {item && <ItemDialog item={item} onClose={() => setItem(undefined)} />}
    </div>
  );
}
