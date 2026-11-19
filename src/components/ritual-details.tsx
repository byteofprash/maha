import { createContext, useContext, useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { CalendarClock, HandHeart, History, MapPin, NotebookPen, Pencil, Repeat, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Plant } from "@/components/plant";
import { STAGE_BG, STAGE_TEXT } from "@/components/stage-style";
import { TaskDialog } from "@/components/dialogs";
import { ItemIcon } from "@/lib/item-icons";
import { useStore } from "@/lib/store";
import { vitality } from "@/lib/dates";
import { plantFor, stageOf, STAGE_LABEL } from "@/lib/plants";
import { ritualFacts } from "@/lib/ritual-facts";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

function Fact({ icon: Icon, label, children }: { icon: ElementType; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 rounded-lg bg-muted p-1.5 text-muted-foreground"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium leading-snug">{children}</div>
      </div>
    </div>
  );
}

/** Read-only: what this ritual is, when it is due, when it was last tended, and what it looks after. Editing is one tap away. */
function RitualDetails({ task, onClose, onEdit }: { task: Task; onClose: () => void; onEdit: () => void }) {
  const { state, completeTask } = useStore();
  const [tending, setTending] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const item = state.items.find((i) => i.id === task.itemId);
  const room = state.rooms.find((r) => r.id === (task.roomId ?? item?.roomId));
  const v = vitality(task);
  const stage = stageOf(v);
  const f = ritualFacts(task);

  const tend = () => {
    if (tending) return;
    setTending(true);
    completeTask(task.id);
    timer.current = window.setTimeout(() => setTending(false), 2000);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" aria-describedby="ritual-details-desc">
        <DialogDescription id="ritual-details-desc" className="sr-only">Details of this ritual</DialogDescription>

        <div className={cn("flex flex-col items-center rounded-xl bg-gradient-to-b px-4 pb-4 pt-5 text-center", STAGE_BG[stage])}>
          <Plant species={plantFor(task)} vitality={v} seed={task.id} tending={tending} className="h-32 w-28" />
          <DialogTitle className="mt-2 text-xl leading-snug">{task.title}</DialogTitle>
          <div className={cn("mt-1 text-sm font-medium", STAGE_TEXT[stage])}>
            {STAGE_LABEL[stage]} <span className="text-muted-foreground">·</span> {f.next.when}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Fact icon={CalendarClock} label="Next care">
            {f.next.date}
            <div className="text-xs font-normal text-muted-foreground">{f.next.when}</div>
          </Fact>
          <Fact icon={HandHeart} label="Last tended">
            {f.last ? (
              <>
                {f.last.date}
                <div className="text-xs font-normal text-muted-foreground">{f.last.ago}</div>
              </>
            ) : (
              <span className="font-normal text-muted-foreground">Not tended yet</span>
            )}
          </Fact>
          <Fact icon={Repeat} label="Comes round">{f.rhythm}</Fact>
          <Fact icon={Tag} label="Kind">{task.category}</Fact>
          {item && (
            <Fact icon={() => <ItemIcon item={item} size="sm" className="!h-4 !w-4 !rounded" />} label="Looks after">{item.name}</Fact>
          )}
          {room && <Fact icon={MapPin} label="Where">{room.name}</Fact>}
        </div>

        <section className="space-y-1.5">
          <h3 className="flex items-center gap-1.5 text-xs text-muted-foreground"><NotebookPen className="h-3.5 w-3.5" /> A note to your future self</h3>
          <p className="whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
            {task.notes.trim() || <span className="text-muted-foreground">No note yet. Add one with Edit.</span>}
          </p>
        </section>

        <section className="space-y-1.5">
          <h3 className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Recently tended{f.times > 0 && ` · ${f.times} ${f.times === 1 ? "time" : "times"}`}
          </h3>
          {f.recent.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {f.recent.map((d, i) => (
                <span key={i} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">{d}</span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing yet. Tend to it once and it appears here.</p>
          )}
        </section>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button variant="outline" onClick={onEdit}><Pencil /> Edit</Button>
          <Button
            className="rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
            onClick={tend}
          >
            <HandHeart /> Tended to it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Ctx = createContext<{ open: (id: string) => void }>({ open: () => {} });
export const useRitualDetails = () => useContext(Ctx);

/** Lets any ritual card, on any page, open the same details view. Edit opens the form; saving returns to the details. */
export function RitualDetailsProvider({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const task = openId ? state.tasks.find((t) => t.id === openId) : undefined;

  // deleted from the edit form (or elsewhere): nothing left to show
  useEffect(() => {
    if (openId && !task) { setOpenId(null); setMode("view"); }
  }, [openId, task]);

  return (
    <Ctx.Provider value={{ open: (id) => { setMode("view"); setOpenId(id); } }}>
      {children}
      {task && mode === "view" && <RitualDetails task={task} onClose={() => setOpenId(null)} onEdit={() => setMode("edit")} />}
      {task && mode === "edit" && <TaskDialog task={task} onClose={() => setMode("view")} />}
    </Ctx.Provider>
  );
}
