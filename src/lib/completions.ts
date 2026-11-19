import { diffDays, shortDate, today } from "./dates";
import type { Completion } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "14:32" when we know the time and it matches the day it was tended (a back-dated entry shows no time); otherwise null. */
export function timeOf(c: Completion): string | null {
  if (!c.at) return null;
  const d = new Date(c.at);
  if (Number.isNaN(d.getTime()) || localDate(d) !== c.doneOn) return null;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** "Today" / "Yesterday" / "Fri, Nov 6". */
export function dayLabel(date: string, now = today()): string {
  const d = diffDays(now, date);
  return d === 0 ? "Today" : d === 1 ? "Yesterday" : shortDate(date);
}

/** One line for a single entry, e.g. "Today at 14:32" or "Fri, Nov 6". */
export function whenLabel(c: Completion, now = today()): string {
  const t = timeOf(c);
  const day = dayLabel(c.doneOn, now);
  return t ? `${day} at ${t}` : day;
}

/** Entries grouped by the day they were tended, newest day first (the input is already newest first). */
export function groupByDay(list: Completion[], now = today()): { date: string; label: string; items: Completion[] }[] {
  const groups: { date: string; label: string; items: Completion[] }[] = [];
  for (const c of list) {
    const last = groups[groups.length - 1];
    if (last && last.date === c.doneOn) last.items.push(c);
    else groups.push({ date: c.doneOn, label: dayLabel(c.doneOn, now), items: [c] });
  }
  return groups;
}
