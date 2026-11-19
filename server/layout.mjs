// The house plan is a simple grid: 5 tiles wide, 10 long (a narrow house). Keep in sync with GRID in src/lib/types.ts.
export const GRID = { cols: 5, rows: 10 };

const fits = (r) => r.x >= 0 && r.y >= 0 && r.w >= 1 && r.h >= 1 && r.x + r.w <= GRID.cols && r.y + r.h <= GRID.rows;
export const allFit = (rooms) => rooms.every(fits);
export const fitsOnPlan = fits;

// Shelf-pack rooms left to right, wrapping to a new row; null when they don't all fit at this scale.
function tryPack(order, scale) {
  let x = 0, y = 0, rowH = 0;
  const out = [];
  for (const r of order) {
    const w = Math.min(GRID.cols, Math.max(1, scale ? Math.round(r.w * scale) : 1));
    const h = Math.min(GRID.rows, Math.max(1, scale ? Math.round(r.h * scale) : 1));
    if (x + w > GRID.cols) { x = 0; y += rowH; rowH = 0; }
    if (y + h > GRID.rows) return null;
    out.push({ ...r, x, y, w, h });
    x += w;
    rowH = Math.max(rowH, h);
  }
  return out;
}

/**
 * Re-fit ONE floor's rooms into the grid, e.g. after the plan changed from 12x8 to 5x10. Keeps reading order (top to bottom,
 * then left to right) and only shrinks rooms as much as needed. Never loses a room.
 */
export function fitFloor(rooms) {
  const order = [...rooms].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const scale of [1, 0.85, 0.7, 0.6, 0.5, 0.4, 0.3, 0]) {
    const placed = tryPack(order, scale);
    if (placed) return placed;
  }
  // more rooms than tiles: stack the rest on the last tile rather than drop any
  return order.map((r) => ({ ...r, x: 0, y: 0, w: 1, h: 1 }));
}

/** Fit every floor that has a room off the plan; floors that already fit are left exactly as they are. */
export function fitAll(rooms) {
  const floors = new Set(rooms.map((r) => r.floor));
  const fixed = new Map();
  for (const f of floors) {
    const onFloor = rooms.filter((r) => r.floor === f);
    if (!allFit(onFloor)) for (const r of fitFloor(onFloor)) fixed.set(r.id, r);
  }
  return rooms.map((r) => fixed.get(r.id) ?? r);
}
