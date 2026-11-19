import { diffDays, today } from "./dates";

/** Days from `now` until the end of the week (Sunday). Monday = 6 ... Saturday = 1, Sunday = 0. Weeks run Monday to Sunday. */
export function daysLeftInWeek(now = today()): number {
  const [y, m, d] = now.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 = Sunday
  return (7 - dow) % 7;
}

/**
 * What the Today page shows, always relative to now:
 *  - today:    due today, plus anything already waiting (it needs you now)
 *  - upcoming: due tomorrow up to the end of this week, before next week starts
 * Anything further out lives on the Rituals page.
 */
export function todayBuckets<T extends { dueDate: string }>(items: T[], when: (t: T) => string = (t) => t.dueDate, now = today()) {
  const left = daysLeftInWeek(now);
  const byDue = (a: T, b: T) => when(a).localeCompare(when(b));
  return {
    today: items.filter((t) => diffDays(when(t), now) <= 0).sort(byDue),
    upcoming: items.filter((t) => { const d = diffDays(when(t), now); return d > 0 && d <= left; }).sort(byDue),
  };
}
