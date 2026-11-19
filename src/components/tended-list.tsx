import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRitualDetails } from "@/components/ritual-details";
import { completedLabel, countsByRitual } from "@/lib/completions";
import { intervalLabel } from "@/lib/dates";
import type { Completion, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE = 30;

/**
 * Everything that has been tended to, newest first, as plain lines: "Ritual   Thu, Nov 19 · 4:28 PM".
 * Tapping a line opens it up: the ritual's note and a few details.
 */
export function TendedList({ completions, tasks }: { completions: Completion[]; tasks: Task[] }) {
  const { open } = useRitualDetails();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const counts = useMemo(() => countsByRitual(completions), [completions]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tended</CardTitle>
        <CardDescription>
          {completions.length === 0 ? "Nothing yet." : `${completions.length} in all, newest first. Tap one to see more.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {completions.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">When you tend to a ritual, it is remembered here.</p>
        )}
        <ul className="divide-y">
          {completions.slice(0, shown).map((c) => {
            const isOpen = expanded.has(c.id);
            const live = c.taskId ? tasks.find((t) => t.id === c.taskId) : undefined; // still around? then show its current note
            const note = (live?.notes ?? c.notes).trim();
            const times = c.taskId ? counts.get(c.taskId) ?? 1 : 1;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggle(c.id)}
                  className="flex w-full items-baseline gap-3 rounded-md px-1 py-2.5 text-left hover:bg-accent/40"
                >
                  <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 translate-y-0.5 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{completedLabel(c)}</span>
                </button>

                {isOpen && (
                  <div className="space-y-3 pb-3 pl-8 pr-1">
                    {note && <p className="whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2.5 text-sm">{note}</p>}
                    <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-xs">
                      {c.itemName && (<><dt className="text-muted-foreground">Looks after</dt><dd>{c.itemName}</dd></>)}
                      {c.roomName && (<><dt className="text-muted-foreground">Room</dt><dd>{c.roomName}</dd></>)}
                      {live && (<><dt className="text-muted-foreground">Comes round</dt><dd>{intervalLabel(live.every, live.unit)}</dd></>)}
                      <dt className="text-muted-foreground">Tended</dt>
                      <dd>{times} {times === 1 ? "time" : "times"} so far</dd>
                    </dl>
                    {live ? (
                      <Button variant="outline" size="sm" onClick={() => open(live.id)}>Open this ritual</Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">This ritual has since been removed.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {completions.length > shown && (
          <Button variant="ghost" size="sm" className="mt-2 w-full text-muted-foreground" onClick={() => setShown(shown + PAGE)}>
            Show {Math.min(PAGE, completions.length - shown)} more
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
