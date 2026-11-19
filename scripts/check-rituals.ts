import { addDays, today, vitality } from "../src/lib/dates";
import { PLANT_KEYS, pickPlant, plantFor, stageOf } from "../src/lib/plants";
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

if (bad) { console.error(`${bad} ritual check(s) FAILED`); process.exit(1); }
console.log("ritual checks: all pass");
