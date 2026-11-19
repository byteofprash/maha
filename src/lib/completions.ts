import { shortDate } from "./dates";
import type { Completion } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "4:28 PM" when we know the time and it matches the day it was tended (a back-dated entry shows no time); otherwise null. */
export function timeOf(c: Completion): string | null {
  if (!c.at) return null;
  const d = new Date(c.at);
  if (Number.isNaN(d.getTime()) || localDate(d) !== c.doneOn) return null;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** "Thu, Nov 19 · 4:28 PM", or just the date when the time isn't known. */
export function completedLabel(c: Completion): string {
  const t = timeOf(c);
  return t ? `${shortDate(c.doneOn)} · ${t}` : shortDate(c.doneOn);
}

/** How many times each ritual appears in the log (for "tended 7 times"). */
export function countsByRitual(list: Completion[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of list) if (c.taskId) m.set(c.taskId, (m.get(c.taskId) ?? 0) + 1);
  return m;
}
