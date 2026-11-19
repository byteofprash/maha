import { GRID, allFit, fitAll, fitFloor } from "../server/layout.mjs";

let bad = 0;
const check = (name, ok, detail = "") => { if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? "  " + detail : ""}`); };
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const noOverlaps = (rs) => rs.every((a, i) => rs.slice(i + 1).every((b) => !overlap(a, b)));
const room = (id, x, y, w, h, floor = 0) => ({ id, name: id, floor, x, y, w, h, color: "#000" });

check("plan is 5 wide x 10 long", GRID.cols === 5 && GRID.rows === 10);

// the old 12x8 sample plan
const old = [
  room("Kitchen", 0, 0, 4, 3), room("Living room", 4, 0, 5, 4), room("Hall", 9, 0, 3, 3), room("Utility", 0, 3, 3, 2),
  room("Bathroom", 9, 3, 3, 2), room("Bedroom", 0, 5, 4, 3), room("Kid's room", 4, 4, 4, 4), room("Storage", 9, 5, 3, 3),
];
check("old plan does not fit", !allFit(old));
const fitted = fitFloor(old);
check("every room kept", fitted.length === old.length && old.every((r) => fitted.some((f) => f.id === r.id)));
check("all rooms inside the 5x10 plan", allFit(fitted));
check("no rooms overlap after re-fit", noOverlaps(fitted));
check("reading order kept (Kitchen first, Storage last)", fitted[0].id === "Kitchen" && fitted[fitted.length - 1].id === "Storage");
check("names/colours untouched", fitted.every((f) => f.name === f.id && f.color === "#000"));

// floors that already fit are left exactly as they are; only the broken floor changes
const ground = [room("A", 0, 0, 3, 2), room("B", 3, 0, 2, 2)];
const garden = [room("Garden", 0, 0, 8, 5, 1)];
const out = fitAll([...ground, ...garden]);
check("a floor that fits is untouched", JSON.stringify(out.slice(0, 2)) === JSON.stringify(ground));
check("the oversized floor is fixed", allFit(out.slice(2)) && out[2].w <= GRID.cols);

// extremes never throw or drop rooms
const many = Array.from({ length: 60 }, (_, i) => room("r" + i, i, i, 2, 2));
const crowded = fitFloor(many);
check("60 rooms: none dropped, nothing thrown", crowded.length === 60);
check("a lone huge room is clamped to the plan", allFit(fitFloor([room("big", 0, 0, 20, 20)])));
check("idempotent: fitting a fitted floor changes nothing", JSON.stringify(fitAll(fitted)) === JSON.stringify(fitted));

if (bad) { console.error(`${bad} layout check(s) FAILED`); process.exit(1); }
console.log("layout checks: all pass");
