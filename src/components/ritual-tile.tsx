import { useEffect, useRef, useState } from "react";
import { HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plant } from "@/components/plant";
import { ItemIcon } from "@/lib/item-icons";
import { useStore } from "@/lib/store";
import { intervalLabel, lastTendedLabel, pendingLabel, vitality } from "@/lib/dates";
import { plantFor, stageOf, STAGE_LABEL, type Stage } from "@/lib/plants";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

// Calm washes, never alarm colours: the plant does the talking.
const STAGE_BG: Record<Stage, string> = {
  thriving: "from-emerald-50 to-card dark:from-emerald-500/10",
  content: "from-lime-50 to-card dark:from-lime-500/10",
  thirsty: "from-amber-50 to-card dark:from-amber-500/10",
  waiting: "from-stone-100 to-card dark:from-stone-500/15",
};
const STAGE_TEXT: Record<Stage, string> = {
  thriving: "text-emerald-700 dark:text-emerald-300",
  content: "text-lime-700 dark:text-lime-300",
  thirsty: "text-amber-700 dark:text-amber-300",
  waiting: "text-stone-600 dark:text-stone-300",
};

/** One ritual as a tile: its plant, what it is, and a soft "Tended to it" button that waters the plant. */
export function RitualTile({
  task, onEdit, onTend, compact,
}: {
  task: Task;
  onEdit: (t: Task) => void;
  onTend: (t: Task) => void;
  /** about a quarter of the area: the plant, the name and one status line; the rest lives in the tooltip and the dialog */
  compact?: boolean;
}) {
  const { state } = useStore();
  const [tending, setTending] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const item = state.items.find((i) => i.id === task.itemId);
  const v = vitality(task);
  const stage = stageOf(v);

  const tend = () => {
    if (tending) return;
    setTending(true);
    onTend(task);
    timer.current = window.setTimeout(() => setTending(false), 2000);
  };

  if (compact) {
    const details = [
      task.title,
      [item?.name, intervalLabel(task.every, task.unit)].filter(Boolean).join(" · "),
      lastTendedLabel(task),
      `${STAGE_LABEL[stage]}: ${pendingLabel(task)}`,
    ].join("\n");
    return (
      <div className={cn("relative flex flex-col rounded-xl border bg-gradient-to-b transition-shadow hover:shadow-md", STAGE_BG[stage])}>
        <button className="flex w-full flex-1 flex-col items-center px-1.5 pb-2 pt-2 text-center" onClick={() => onEdit(task)} title={details} aria-label={`Open ${task.title}`}>
          <Plant species={plantFor(task)} vitality={v} seed={task.id} tending={tending} className="h-[76px] w-[66px]" />
          <div className="mt-1 line-clamp-2 min-h-[2.1em] text-[11px] font-medium leading-[1.05rem]">{task.title}</div>
          <div className={cn("mt-auto w-full truncate pt-0.5 text-[10px] leading-4", STAGE_TEXT[stage])}>{pendingLabel(task)}</div>
        </button>
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-1 top-1 h-7 w-7 rounded-full text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
          title="Tended to it"
          aria-label={`Tended to ${task.title}`}
          onClick={tend}
        >
          <HandHeart />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col rounded-2xl border bg-gradient-to-b p-4 transition-shadow hover:shadow-md", STAGE_BG[stage])}>
      <button className="flex flex-1 flex-col items-center text-center" onClick={() => onEdit(task)} aria-label={`Open ${task.title}`}>
        <Plant species={plantFor(task)} vitality={v} seed={task.id} tending={tending} className="h-36 w-32" />
        <div className="mt-2 text-sm font-medium leading-snug">{task.title}</div>
        <div className="mt-1 flex max-w-full items-center gap-1.5 text-xs text-muted-foreground">
          {item && <ItemIcon item={item} size="sm" className="!h-5 !w-5 !rounded-md [&_svg]:!size-3" />}
          <span className="truncate">{[item?.name, intervalLabel(task.every, task.unit)].filter(Boolean).join(" · ")}</span>
        </div>
        <div className="text-xs text-muted-foreground">{lastTendedLabel(task)}</div>
      </button>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0 text-xs leading-tight">
          <div className={cn("font-medium", STAGE_TEXT[stage])}>{STAGE_LABEL[stage]}</div>
          <div className="truncate text-muted-foreground">{pendingLabel(task)}</div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 rounded-full border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-400/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
          onClick={tend}
        >
          <HandHeart /> Tended to it
        </Button>
      </div>
    </div>
  );
}
