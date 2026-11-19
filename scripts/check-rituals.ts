import { addDays, lastTendedLabel, pendingLabel, today, vitality } from "../src/lib/dates";
import { PLANT_KEYS, pickPlant, plantFor, stageOf } from "../src/lib/plants";
import { daysLeftInWeek, todayBuckets } from "../src/lib/today";
import { ritualFacts } from "../src/lib/ritual-facts";
import { completedLabel, countsByRitual, timeOf } from "../src/lib/completions";
import type { Completion } from "../src/lib/types";
import type { Task } from "../src/lib/types";

let bad = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? "  " + detail : ""}`);
};

const t0 = today();
const task = (every: number, unit: Task["unit"], lastDone: string | null, dueDate: string): Task => ({
  id: "t", title: "x", every, unit, dueDate, lastDone, roomId: null, itemId: null, category: "Other", notes: "", history: [], plant: "",
});

// vitality: 1 just tended, 0 on the due day, floored below
const fresh = vitality(task(10, "day", t0, addDays(t0, 10)));
const half = vitality(task(10, "day", addDays(t0, -5), addDays(t0, 5)));
const dueToday = vitality(task(10, "day", addDays(t0, -10), t0));
const wayLate = vitality(task(10, "day", addDays(t0, -60), addDays(t0, -50)));
check("just tended = 1", fresh === 1, String(fresh));
check("halfway = 0.5", Math.abs(half - 0.5) < 1e-9, String(half));
check("due today = 0", dueToday === 0, String(dueToday));
check("very late is floored, never lower", wayLate === -0.4, String(wayLate));
// a brand-new ritual (never done) starts fresh when its first due date is one interval away
check("new ritual starts at 1", vitality(task(1, "month", null, addDays(t0, 31))) > 0.9 || vitality(task(1, "month", null, addDays(t0, 30))) > 0.9);
// monthly vs weekly decay at the same elapsed time
check("weekly decays faster than monthly", vitality(task(1, "week", addDays(t0, -4), addDays(t0, 3))) < vitality(task(1, "month", addDays(t0, -4), addDays(t0, 26))));

// stages
check("stages", stageOf(1) === "thriving" && stageOf(0.5) === "content" && stageOf(0.2) === "thirsty" && stageOf(0) === "waiting" && stageOf(-0.4) === "waiting");

// plants: stable fallback, and new rituals fan out across species
check("legacy fallback is stable", plantFor({ id: "abc" }) === plantFor({ id: "abc" }));
check("unknown key falls back", PLANT_KEYS.includes(plantFor({ id: "abc", plant: "nonsense" })));
check("stored plant wins", plantFor({ id: "abc", plant: "tulip" }) === "tulip");

const made: { plant: string }[] = [];
for (let i = 0; i < PLANT_KEYS.length * 3; i++) {
  const p = pickPlant(made);
  made.push({ plant: p });
  // after every full round each species has been used the same number of times
  if ((i + 1) % PLANT_KEYS.length === 0) {
    const counts = PLANT_KEYS.map((k) => made.filter((m) => m.plant === k).length);
    check(`after ${i + 1} rituals every plant used equally`, counts.every((c) => c === counts[0]), counts.join(","));
  }
}
check("first six are all different", new Set(made.slice(0, PLANT_KEYS.length).map((m) => m.plant)).size === PLANT_KEYS.length);
check("shuffle never returns the same plant", Array.from({ length: 50 }, () => pickPlant([], "daisy")).every((p) => p !== "daisy"));

// tile wording: when it was last tended, and how long it has been pending
const lbl = (last: string | null, due: string, history: string[] = []): Task => ({ ...task(10, "day", last, due), history });
check("last tended: today / yesterday / N days / never",
  [lastTendedLabel(lbl(t0, addDays(t0, 10))), lastTendedLabel(lbl(addDays(t0, -1), addDays(t0, 9))), lastTendedLabel(lbl(addDays(t0, -7), addDays(t0, 3))), lastTendedLabel(lbl(null, t0))].join("|")
  === "Last tended today|Last tended yesterday|Last tended 7 days ago|Not tended yet");
check("last tended falls back to history", lastTendedLabel(lbl(null, t0, [addDays(t0, -4)])) === "Last tended 4 days ago");
check("long gaps read in months", lastTendedLabel(lbl(addDays(t0, -200), t0)) === "Last tended 7 months ago", lastTendedLabel(lbl(addDays(t0, -200), t0)));
check("pending: 3 days / 1 day / due today / tomorrow / in 5 days",
  [pendingLabel(lbl(null, addDays(t0, -3))), pendingLabel(lbl(null, addDays(t0, -1))), pendingLabel(lbl(null, t0)), pendingLabel(lbl(null, addDays(t0, 1))), pendingLabel(lbl(null, addDays(t0, 5)))].join("|")
  === "3 days pending|1 day pending|Due today|Due tomorrow|Due in 5 days");

// the details view's facts
const hist = [addDays(t0, -13), addDays(t0, -23), addDays(t0, -33)];
const f1 = ritualFacts({ ...lbl(addDays(t0, -13), addDays(t0, -3), hist), every: 10, unit: "day" });
check("facts: rhythm, pending, last tended", f1.rhythm === "Every 10 days" && f1.next.when === "3 days pending" && f1.last?.ago === "13 days ago", JSON.stringify({ r: f1.rhythm, w: f1.next.when, a: f1.last?.ago }));
check("facts: history newest first, counted", f1.times === 3 && f1.recent.length === 3);
const many = ritualFacts(lbl(t0, addDays(t0, 10), Array.from({ length: 30 }, (_, i) => addDays(t0, -i))));
check("facts: shows at most 6 recent dates", many.recent.length === 6 && many.times === 30);
const brandNew = ritualFacts(lbl(null, addDays(t0, 10)));
check("facts: a brand-new ritual has no 'last tended'", brandNew.last === null && brandNew.recent.length === 0 && brandNew.times === 0);

// the tended log: one plain line per entry, "ritual completed on date at time"
const comp = (id: string, doneOn: string, at: string | null, taskId: string | null = "t"): Completion => ({ id, taskId, title: "x", itemId: null, itemName: null, roomId: null, roomName: null, plant: "", notes: "", doneOn, at, actor: "ui" });
const noon = (d: string) => new Date(d + "T16:28:00").toISOString(); // local 4:28 PM, so the local date matches
const fmt = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
check("time shown when it matches the day tended", timeOf(comp("a", t0, noon(t0))) === fmt(noon(t0)));
check("no time for a back-dated or recovered entry", timeOf(comp("b", addDays(t0, -3), noon(t0))) === null && timeOf(comp("c", t0, null)) === null);
check("label: date and time, or just the date", completedLabel(comp("a", t0, noon(t0))).endsWith(" \u00b7 " + fmt(noon(t0))) && !completedLabel(comp("c", t0, null)).includes("\u00b7"), completedLabel(comp("a", t0, noon(t0))));
const counts = countsByRitual([comp("1", t0, null, "r1"), comp("2", t0, null, "r1"), comp("3", t0, null, "r2"), comp("4", t0, null, null)]);
check("counts per ritual (entries with no ritual are ignored)", counts.get("r1") === 2 && counts.get("r2") === 1 && counts.size === 2);

// the Today window: today (+ anything already waiting) and the rest of the week, Monday to Sunday
check("days left: Mon 6, Thu 3, Sat 1, Sun 0",
  [daysLeftInWeek("2026-11-16"), daysLeftInWeek("2026-11-19"), daysLeftInWeek("2026-11-21"), daysLeftInWeek("2026-11-22")].join() === "6,3,1,0");
const due = (id: string, dueDate: string) => ({ id, dueDate });
const thu = "2026-11-19";
const sample = [due("late", "2026-11-12"), due("today", thu), due("fri", "2026-11-20"), due("sun", "2026-11-22"), due("mon", "2026-11-23"), due("far", "2026-12-25")];
const onThu = todayBuckets(sample, (t) => t.dueDate, thu);
check("Thursday: today = waiting + today", onThu.today.map((t) => t.id).join() === "late,today", onThu.today.map((t) => t.id).join());
check("Thursday: upcoming runs to Sunday, not next Monday", onThu.upcoming.map((t) => t.id).join() === "fri,sun", onThu.upcoming.map((t) => t.id).join());
const onSun = todayBuckets(sample, (t) => t.dueDate, "2026-11-22");
check("Sunday: nothing 'coming up' (next week starts tomorrow); earlier days are waiting", onSun.upcoming.length === 0 && onSun.today.map((t) => t.id).join() === "late,today,fri,sun", onSun.today.map((t) => t.id).join());
const onMon = todayBuckets(sample, (t) => t.dueDate, "2026-11-23");
check("Monday: new week opens up (Mon is today, rest of week empty here)", onMon.today.some((t) => t.id === "mon") && onMon.upcoming.length === 0);
check("held tile keeps its bucket via when()", todayBuckets([due("x", "2026-12-25")], () => thu, thu).today.length === 1);

if (bad) { console.error(`${bad} ritual check(s) FAILED`); process.exit(1); }
console.log("ritual checks: all pass");
