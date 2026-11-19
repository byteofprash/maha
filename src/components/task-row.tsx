import { HandHeart, MapPin, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { dueLabel, dueStatus, intervalLabel } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DueBadge({ task }: { task: Task }) {
  const s = dueStatus(task);
  const variant = s === "overdue" ? "warning" : s === "today" ? "warning" : s === "soon" ? "secondary" : "outline";
  return <Badge variant={variant}>{dueLabel(task.dueDate)}</Badge>;
}

export function TaskRow({ task, onEdit, compact }: { task: Task; onEdit: (t: Task) => void; compact?: boolean }) {
  const { state, completeTask } = useStore();
  const room = state.rooms.find((r) => r.id === task.roomId);
  const item = state.items.find((i) => i.id === task.itemId);
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5">
      <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 rounded-full" title="Tended to it" aria-label={`Tended to ${task.title}`} onClick={() => completeTask(task.id)}>
        <HandHeart className="text-rose-500" />
      </Button>
      <button className="min-w-0 flex-1 text-left" onClick={() => onEdit(task)}>
        <div className={cn("truncate text-sm font-medium")}>{task.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{intervalLabel(task.every, task.unit)}</span>
          {!compact && room && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{room.name}</span>}
          {!compact && item && <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{item.name}</span>}
        </div>
      </button>
      <DueBadge task={task} />
    </div>
  );
}
