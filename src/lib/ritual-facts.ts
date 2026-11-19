import { intervalLabel, lastTendedLabel, pendingLabel, shortDate, today } from "./dates";
import type { Task } from "./types";

/** The plain-language facts shown on a ritual's details view (pure, so the wording is tested). */
export function ritualFacts(t: Task, now = today()) {
  const last = t.lastDone ?? t.history[0] ?? null;
  return {
    rhythm: intervalLabel(t.every, t.unit), // "Monthly", "Every 10 days"
    next: { date: shortDate(t.dueDate), when: pendingLabel(t, now) }, // "Fri 20 Nov", "Due tomorrow" / "3 days pending"
    last: last ? { date: shortDate(last), ago: lastTendedLabel(t, now).replace(/^Last tended /, "") } : null, // "Tue 3 Nov", "13 days ago"
    recent: t.history.slice(0, 6).map(shortDate), // newest first
    times: t.history.length,
  };
}
