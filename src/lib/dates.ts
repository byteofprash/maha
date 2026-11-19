import type { Task, Unit } from "./types";
import { VITALITY_FLOOR } from "./plants";

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const today = () => iso(new Date());

export function addInterval(s: string, every: number, unit: Unit): string {
  const d = parse(s);
  if (unit === "day") d.setDate(d.getDate() + every);
  else if (unit === "week") d.setDate(d.getDate() + 7 * every);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + every);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return iso(d);
}

export const addDays = (s: string, n: number) => addInterval(s, n, "day");

export const diffDays = (a: string, b: string) => Math.round((parse(a).getTime() - parse(b).getTime()) / 86400000);

export function intervalLabel(every: number, unit: Unit): string {
  if (every === 1) return unit === "day" ? "Daily" : unit === "week" ? "Weekly" : "Monthly";
  if (unit === "month" && every === 3) return "Quarterly";
  if (unit === "month" && every === 12) return "Yearly";
  return `Every ${every} ${unit}s`;
}

/**
 * How far through its interval a ritual is: 1 right after it was tended to, 0 on its due day, below 0 once it is waiting.
 * Drives how fresh or droopy its plant looks.
 */
export function vitality(t: Task, now = today()): number {
  const start = t.lastDone && diffDays(t.dueDate, t.lastDone) > 0 ? t.lastDone : addInterval(t.dueDate, -t.every, t.unit);
  const total = Math.max(1, diffDays(t.dueDate, start));
  return Math.max(VITALITY_FLOOR, Math.min(1, 1 - diffDays(now, start) / total));
}

export type DueStatus = "overdue" | "today" | "soon" | "later";

export function dueStatus(t: Task, now = today()): DueStatus {
  const d = diffDays(t.dueDate, now);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 7) return "soon";
  return "later";
}

export function dueLabel(dueDate: string, now = today()): string {
  const d = diffDays(dueDate, now);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Waiting since yesterday";
  if (d < 0) return `Waiting ${-d} days`;
  if (d <= 14) return `In ${d} days`;
  return parse(dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: d > 300 ? "numeric" : undefined });
}

export const fmtDate = (s: string) =>
  s ? parse(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Warranty end date (yyyy-mm-dd) or null if unknown. */
export function warrantyEnd(purchaseDate: string, months: number | null): string | null {
  if (!purchaseDate || !months) return null;
  return addInterval(purchaseDate, months, "month");
}
