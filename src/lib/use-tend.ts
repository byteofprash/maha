import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";

/**
 * "Tended to it" for a tile. The ritual is completed straight away (so its plant perks up), but it keeps its old place in the
 * list for a moment so you can watch that happen before it moves on. Use `when(t)` wherever you sort or bucket by due date.
 */
export function useTend(holdMs = 2600) {
  const { completeTask } = useStore();
  const [held, setHeld] = useState<Record<string, string>>({});
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const tend = (t: Task) => {
    setHeld((h) => ({ ...h, [t.id]: t.dueDate }));
    completeTask(t.id);
    timers.current.push(
      window.setTimeout(() => setHeld(({ [t.id]: _released, ...rest }) => rest), holdMs)
    );
  };
  const when = (t: Task) => held[t.id] ?? t.dueDate;
  return { tend, when, held };
}
