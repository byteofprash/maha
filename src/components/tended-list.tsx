import { useEffect, useState } from "react";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plant } from "@/components/plant";
import { dayLabel, groupByDay, timeOf, whenLabel } from "@/lib/completions";
import { shortDate } from "@/lib/dates";
import { isPlant } from "@/lib/plants";
import type { Completion } from "@/lib/types";

const PAGE = 12;

/**
 * Everything that has been tended to, newest first, grouped by the day it happened, with the time.
 * With a room selected it shows that room's history (switchable to the whole house).
 */
export function TendedList({ completions, room }: { completions: Completion[]; room?: { id: string; name: string } | null }) {
  const [wholeHouse, setWholeHouse] = useState(false);
  const [shown, setShown] = useState(PAGE);
  useEffect(() => { setWholeHouse(false); setShown(PAGE); }, [room?.id]);

  const scoped = !!room && !wholeHouse;
  const list = scoped ? completions.filter((c) => c.roomId === room!.id) : completions;
  const groups = groupByDay(list.slice(0, shown));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{scoped ? `Tended in ${room!.name}` : "Tended recently"}</CardTitle>
            <CardDescription>
              {list.length === 0 ? "Nothing yet." : `${list.length} ${list.length === 1 ? "time" : "times"} so far, newest first`}
            </CardDescription>
          </div>
          {room && (
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant={scoped ? "secondary" : "ghost"} className="max-w-[8rem] truncate" onClick={() => setWholeHouse(false)}>{room.name}</Button>
              <Button size="sm" variant={scoped ? "ghost" : "secondary"} onClick={() => setWholeHouse(true)}>Whole house</Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {list.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <Sprout className="h-7 w-7 text-emerald-500/70" />
            When you tend to a ritual, it is remembered here.
          </div>
        )}
        {groups.map((g) => (
          <section key={g.date} className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground">
              {g.label}
              {(g.label === "Today" || g.label === "Yesterday") && <span className="font-normal"> · {shortDate(g.date)}</span>}
            </h3>
            <ul className="divide-y">
              {g.items.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-1.5" title={`${c.title}: ${whenLabel(c)}`}>
                  <Plant species={isPlant(c.plant) ? c.plant : "daisy"} vitality={1} seed={c.id} still className="h-10 w-9 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[c.itemName, scoped ? null : c.roomName].filter(Boolean).join(" · ") || "Around the house"}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs tabular-nums text-muted-foreground">{timeOf(c) ?? ""}</div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {list.length > shown && (
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setShown(shown + PAGE)}>
            Show {Math.min(PAGE, list.length - shown)} more
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
