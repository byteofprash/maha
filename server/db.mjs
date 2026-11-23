// SQLite storage for AHAM (built-in node:sqlite, no native deps).
// The UI and, later, the agent both go through the functions exported here.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { GRID, fitAll, fitsOnPlan } from "./layout.mjs";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS floors (
  idx  INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, floor INTEGER NOT NULL DEFAULT 0,
  x INTEGER NOT NULL DEFAULT 0, y INTEGER NOT NULL DEFAULT 0,
  w INTEGER NOT NULL DEFAULT 3, h INTEGER NOT NULL DEFAULT 2, color TEXT NOT NULL DEFAULT '#6366f1'
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Other',
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  brand TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', serial TEXT NOT NULL DEFAULT '',
  purchase_date TEXT NOT NULL DEFAULT '', store TEXT NOT NULL DEFAULT '',
  price REAL, warranty_months INTEGER,
  manual_url TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL,
  every INTEGER NOT NULL DEFAULT 1, unit TEXT NOT NULL DEFAULT 'month' CHECK (unit IN ('day','week','month')),
  due_date TEXT NOT NULL, last_done TEXT,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  item_id TEXT REFERENCES items(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'Other', notes TEXT NOT NULL DEFAULT '',
  plant TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS task_history (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  done_on TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_task ON task_history(task_id, done_on DESC);
-- The permanent log of everything ever tended. No foreign keys and name snapshots on purpose: an entry must still read
-- correctly after its ritual, item or room is renamed or deleted (task_history above is only the capped per-ritual view).
CREATE TABLE IF NOT EXISTS completions (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  title TEXT NOT NULL,
  item_id TEXT, item_name TEXT,
  room_id TEXT, room_name TEXT,
  plant TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  done_on TEXT NOT NULL,
  at TEXT,
  actor TEXT NOT NULL DEFAULT 'ui'
);
CREATE INDEX IF NOT EXISTS idx_completions_when ON completions(done_on DESC, at DESC);
CREATE INDEX IF NOT EXISTS idx_completions_task ON completions(task_id);
CREATE INDEX IF NOT EXISTS idx_completions_room ON completions(room_id);
CREATE INDEX IF NOT EXISTS idx_items_room ON items(room_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
-- One row per device that asked for the evening reminder (a browser's push subscription). last_sent_on makes the daily
-- send happen once per local day even across restarts.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  tz TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_sent_on TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actor TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT,
  before TEXT, after TEXT
);
`;

// Each ritual grows its own plant. Keep in sync with src/lib/plants.ts (unknown keys just fall back in the UI).
export const PLANT_KEYS = ["daisy", "tulip", "sunflower", "lavender", "cosmos", "succulent"];

// Builds log entries from the per-ritual history rows (existing databases, and imports from before the log existed).
const COMPLETIONS_FROM_HISTORY = `
  INSERT INTO completions (id, task_id, title, item_id, item_name, room_id, room_name, plant, notes, done_on, at, actor)
  SELECT 'h-' || h.rowid, t.id, t.title, i.id, i.name, COALESCE(t.room_id, i.room_id), r.name, t.plant, t.notes, h.done_on, NULL, 'history'
  FROM task_history h
  JOIN tasks t ON t.id = h.task_id
  LEFT JOIN items i ON i.id = t.item_id
  LEFT JOIN rooms r ON r.id = COALESCE(t.room_id, i.room_id)`;

// ---- date helpers (mirror src/lib/dates.ts) ---------------------------------
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const today = () => iso(new Date());
export function addInterval(s, every, unit) {
  const d = parse(s);
  if (unit === "day") d.setDate(d.getDate() + every);
  else if (unit === "week") d.setDate(d.getDate() + 7 * every);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + every);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  return iso(d);
}

// ---- validation -------------------------------------------------------------
export class ValidationError extends Error {}
const bad = (m) => { throw new ValidationError(m); };
const str = (v, k, { required = false } = {}) => {
  if (v === undefined || v === null) return required ? bad(`${k} is required`) : "";
  if (typeof v !== "string") bad(`${k} must be a string`);
  if (required && !v.trim()) bad(`${k} is required`);
  return v;
};
const num = (v, k, { nullable = false, int = false, min } = {}) => {
  if (v === undefined || v === null || v === "") return nullable ? null : bad(`${k} is required`);
  const n = Number(v);
  if (!Number.isFinite(n) || (int && !Number.isInteger(n)) || (min !== undefined && n < min)) bad(`${k} is invalid`);
  return n;
};
/** Short lowercase key such as "fridge"; "" means "choose automatically". Unknown keys are tolerated: the UI falls back. */
const slug = (v, k) => {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v !== "string" || !/^[a-z0-9-]{1,30}$/.test(v)) bad(`${k} must be a short lowercase key like "fridge", or empty for automatic`);
  return v;
};
const date = (v, k, { nullable = false } = {}) => {
  if (v === undefined || v === null || v === "") return nullable ? null : bad(`${k} is required`);
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) bad(`${k} must be yyyy-mm-dd`);
  return v;
};

export function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "maha.db");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;");
  db.exec(SCHEMA);
  // In-place migrations for databases created by earlier versions (CREATE TABLE IF NOT EXISTS does not alter them).
  const hasCol = (table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
  if (!hasCol("items", "icon")) db.exec("ALTER TABLE items ADD COLUMN icon TEXT NOT NULL DEFAULT ''");
  if (!hasCol("tasks", "plant")) {
    db.exec("ALTER TABLE tasks ADD COLUMN plant TEXT NOT NULL DEFAULT ''");
    // give existing rituals a plant each, round-robin so neighbours differ
    db.exec("BEGIN");
    db.prepare("SELECT id FROM tasks ORDER BY rowid").all().forEach((t, n) =>
      db.prepare("UPDATE tasks SET plant=? WHERE id=?").run(PLANT_KEYS[n % PLANT_KEYS.length], t.id)
    );
    db.exec("COMMIT");
  }
  // The log remembers the ritual's note too. Existing log tables get the column, filled from the ritual while it still exists.
  if (!hasCol("completions", "notes")) {
    db.exec("ALTER TABLE completions ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
    db.exec("UPDATE completions SET notes = COALESCE((SELECT t.notes FROM tasks t WHERE t.id = completions.task_id), '')");
  }
  // One-off: copy what the old capped history already knows into the permanent log (dates only; the time is unknown).
  if (!db.prepare("SELECT 1 FROM meta WHERE key='completions_backfilled'").get()) {
    db.exec(COMPLETIONS_FROM_HISTORY);
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('completions_backfilled','1')").run();
  }

  const tx = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
  };
  const q = (sql) => db.prepare(sql);

  const audit = (actor, action, entity, id, before, after) =>
    q("INSERT INTO audit_log (actor, action, entity, entity_id, before, after) VALUES (?,?,?,?,?,?)").run(
      actor, action, entity, id ?? null,
      before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after)
    );

  // ---- row <-> API shape -----------------------------------------------------
  const roomOut = (r) => ({ id: r.id, name: r.name, floor: r.floor, x: r.x, y: r.y, w: r.w, h: r.h, color: r.color });
  const itemOut = (r) => ({
    id: r.id, name: r.name, category: r.category, roomId: r.room_id, brand: r.brand, model: r.model, serial: r.serial,
    purchaseDate: r.purchase_date, store: r.store, price: r.price, warrantyMonths: r.warranty_months,
    manualUrl: r.manual_url, notes: r.notes, icon: r.icon,
  });
  const taskOut = (r, history) => ({
    id: r.id, title: r.title, every: r.every, unit: r.unit, dueDate: r.due_date, lastDone: r.last_done,
    roomId: r.room_id, itemId: r.item_id, category: r.category, notes: r.notes, plant: r.plant, history,
  });
  const completionOut = (r) => ({
    id: r.id, taskId: r.task_id, title: r.title, itemId: r.item_id, itemName: r.item_name, roomId: r.room_id, roomName: r.room_name,
    plant: r.plant, notes: r.notes, doneOn: r.done_on, at: r.at, actor: r.actor,
  });
  const historyFor = (id) => q("SELECT done_on FROM task_history WHERE task_id=? ORDER BY done_on DESC, rowid DESC").all(id).map((h) => h.done_on);

  const getRoom = (id) => { const r = q("SELECT * FROM rooms WHERE id=?").get(id); return r ? roomOut(r) : null; };
  const getItem = (id) => { const r = q("SELECT * FROM items WHERE id=?").get(id); return r ? itemOut(r) : null; };
  const getTask = (id) => { const r = q("SELECT * FROM tasks WHERE id=?").get(id); return r ? taskOut(r, historyFor(id)) : null; };

  const fkCheck = (table, id, label) => {
    if (id != null && !q(`SELECT 1 FROM ${table} WHERE id=?`).get(id)) bad(`${label} ${id} does not exist`);
  };

  // ---- whole state ------------------------------------------------------------
  const isInitialized = () => !!q("SELECT 1 FROM meta WHERE key='initialized'").get();

  const getState = () => {
    if (!isInitialized()) return null;
    const hist = new Map();
    for (const h of q("SELECT task_id, done_on FROM task_history ORDER BY done_on DESC, rowid DESC").all()) {
      (hist.get(h.task_id) ?? hist.set(h.task_id, []).get(h.task_id)).push(h.done_on);
    }
    return {
      version: 1,
      floors: q("SELECT name FROM floors ORDER BY idx").all().map((f) => f.name),
      rooms: q("SELECT * FROM rooms ORDER BY rowid").all().map(roomOut),
      items: q("SELECT * FROM items ORDER BY rowid").all().map(itemOut),
      tasks: q("SELECT * FROM tasks ORDER BY rowid").all().map((r) => taskOut(r, hist.get(r.id) ?? [])),
      // newest first; the full log stays in the database, the app is handed the most recent 5000
      completions: q("SELECT * FROM completions ORDER BY done_on DESC, COALESCE(at, '') DESC, rowid DESC LIMIT 5000").all().map(completionOut),
    };
  };

  /** Replace everything (import / reset / first-run seed). One transaction. */
  const replaceState = (s, actor = "system", action = "replace_all") =>
    tx(() => {
      if (!s || !Array.isArray(s.rooms) || !Array.isArray(s.items) || !Array.isArray(s.tasks) || !Array.isArray(s.floors)) {
        bad("invalid state");
      }
      for (const t of ["completions", "task_history", "tasks", "items", "rooms", "floors"]) db.exec(`DELETE FROM ${t}`);
      s.floors.forEach((name, i) => q("INSERT INTO floors (idx, name) VALUES (?,?)").run(i, String(name)));
      // a backup from before the plan was 5x10 (or a hand-edited file) is re-fitted instead of losing rooms off the edge
      for (const r of fitAll(s.rooms.map(normRoom))) insertRoom(r);
      const roomIds = new Set(s.rooms.map((r) => r.id));
      const itemIds = new Set(s.items.map((i) => i.id));
      for (const i of s.items) insertItem(normItem({ ...i, roomId: roomIds.has(i.roomId) ? i.roomId : null }));
      for (const t of s.tasks) {
        insertTask(
          normTask({ ...t, roomId: roomIds.has(t.roomId) ? t.roomId : null, itemId: itemIds.has(t.itemId) ? t.itemId : null }),
          Array.isArray(t.history) ? t.history.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h)) : []
        );
      }
      if (Array.isArray(s.completions)) {
        for (const c of s.completions) insertCompletion(normCompletion(c));
      } else {
        db.exec(COMPLETIONS_FROM_HISTORY); // an older backup: rebuild the log from each ritual's history
      }
      q("INSERT OR REPLACE INTO meta (key, value) VALUES ('initialized','1')").run();
      q("INSERT OR REPLACE INTO meta (key, value) VALUES ('completions_backfilled','1')").run();
      audit(actor, action, "state", null, null, { rooms: s.rooms.length, items: s.items.length, tasks: s.tasks.length });
    });

  // ---- normalizers ------------------------------------------------------------
  const normRoom = (r) => ({
    id: str(r.id, "id", { required: true }), name: str(r.name, "name", { required: true }),
    floor: num(r.floor ?? 0, "floor", { int: true, min: 0 }),
    x: num(r.x ?? 0, "x", { int: true }), y: num(r.y ?? 0, "y", { int: true }),
    w: num(r.w ?? 3, "w", { int: true, min: 1 }), h: num(r.h ?? 2, "h", { int: true, min: 1 }),
    color: str(r.color ?? "#6366f1", "color"),
  });
  const normItem = (i) => ({
    id: str(i.id, "id", { required: true }), name: str(i.name, "name", { required: true }),
    category: str(i.category ?? "Other", "category"), roomId: i.roomId ?? null,
    brand: str(i.brand, "brand"), model: str(i.model, "model"), serial: str(i.serial, "serial"),
    purchaseDate: date(i.purchaseDate || null, "purchaseDate", { nullable: true }) ?? "",
    store: str(i.store, "store"),
    price: num(i.price, "price", { nullable: true, min: 0 }),
    warrantyMonths: num(i.warrantyMonths, "warrantyMonths", { nullable: true, int: true, min: 0 }),
    manualUrl: str(i.manualUrl, "manualUrl"), notes: str(i.notes, "notes"),
    icon: slug(i.icon, "icon"),
  });
  const normTask = (t) => {
    const unit = t.unit ?? "month";
    if (!["day", "week", "month"].includes(unit)) bad("unit must be day, week or month");
    return {
      id: str(t.id, "id", { required: true }), title: str(t.title, "title", { required: true }),
      every: num(t.every ?? 1, "every", { int: true, min: 1 }), unit,
      dueDate: date(t.dueDate, "dueDate"), lastDone: date(t.lastDone, "lastDone", { nullable: true }),
      roomId: t.roomId ?? null, itemId: t.itemId ?? null,
      category: str(t.category ?? "Other", "category"), notes: str(t.notes, "notes"),
      plant: slug(t.plant, "plant"),
    };
  };

  // ---- inserts / upserts --------------------------------------------------------
  const insertRoom = (r) =>
    q(`INSERT INTO rooms (id,name,floor,x,y,w,h,color) VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name,floor=excluded.floor,x=excluded.x,y=excluded.y,w=excluded.w,h=excluded.h,color=excluded.color`)
      .run(r.id, r.name, r.floor, r.x, r.y, r.w, r.h, r.color);
  const insertItem = (i) =>
    q(`INSERT INTO items (id,name,category,room_id,brand,model,serial,purchase_date,store,price,warranty_months,manual_url,notes,icon)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,room_id=excluded.room_id,brand=excluded.brand,
         model=excluded.model,serial=excluded.serial,purchase_date=excluded.purchase_date,store=excluded.store,price=excluded.price,
         warranty_months=excluded.warranty_months,manual_url=excluded.manual_url,notes=excluded.notes,icon=excluded.icon`)
      .run(i.id, i.name, i.category, i.roomId, i.brand, i.model, i.serial, i.purchaseDate, i.store, i.price, i.warrantyMonths, i.manualUrl, i.notes, i.icon);
  /** The least-used plant so far (random among ties), so every new ritual looks different from its neighbours. */
  const pickPlant = () => {
    const used = new Map(PLANT_KEYS.map((k) => [k, 0]));
    for (const r of q("SELECT plant FROM tasks").all()) if (used.has(r.plant)) used.set(r.plant, used.get(r.plant) + 1);
    const min = Math.min(...used.values());
    const pool = PLANT_KEYS.filter((k) => used.get(k) === min);
    return pool[Math.floor(Math.random() * pool.length)];
  };
  const insertTask = (t, history) => {
    const plant = t.plant || q("SELECT plant FROM tasks WHERE id=?").get(t.id)?.plant || pickPlant();
    q(`INSERT INTO tasks (id,title,every,unit,due_date,last_done,room_id,item_id,category,notes,plant) VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title,every=excluded.every,unit=excluded.unit,due_date=excluded.due_date,
         last_done=excluded.last_done,room_id=excluded.room_id,item_id=excluded.item_id,category=excluded.category,notes=excluded.notes,
         plant=excluded.plant`)
      .run(t.id, t.title, t.every, t.unit, t.dueDate, t.lastDone, t.roomId, t.itemId, t.category, t.notes, plant);
    if (history) {
      q("DELETE FROM task_history WHERE task_id=?").run(t.id);
      for (const h of history) q("INSERT INTO task_history (task_id, done_on) VALUES (?,?)").run(t.id, h);
    }
  };

  const iso = (v) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
  const normCompletion = (c) => ({
    id: typeof c.id === "string" && /^[A-Za-z0-9_-]{1,60}$/.test(c.id) ? c.id : "c-" + crypto.randomUUID().replace(/-/g, "").slice(0, 16),
    taskId: c.taskId ? String(c.taskId) : null,
    title: str(c.title, "title", { required: true }),
    itemId: c.itemId ? String(c.itemId) : null, itemName: c.itemName ? String(c.itemName) : null,
    roomId: c.roomId ? String(c.roomId) : null, roomName: c.roomName ? String(c.roomName) : null,
    plant: slug(c.plant, "plant"), notes: typeof c.notes === "string" ? c.notes.slice(0, 4000) : "", doneOn: date(c.doneOn, "doneOn"), at: iso(c.at),
    actor: typeof c.actor === "string" && c.actor ? c.actor.slice(0, 40) : "ui",
  });
  const insertCompletion = (c) =>
    q("INSERT OR REPLACE INTO completions (id,task_id,title,item_id,item_name,room_id,room_name,plant,notes,done_on,at,actor) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(c.id, c.taskId, c.title, c.itemId, c.itemName, c.roomId, c.roomName, c.plant, c.notes, c.doneOn, c.at, c.actor);
  /** What a ritual belongs to right now, frozen into the log entry. */
  const snapshotOf = (task) => {
    const item = task.itemId ? getItem(task.itemId) : null;
    const roomId = task.roomId ?? item?.roomId ?? null;
    return { itemId: item?.id ?? null, itemName: item?.name ?? null, roomId, roomName: roomId ? getRoom(roomId)?.name ?? null : null };
  };

  // ---- entity API ---------------------------------------------------------------
  const upsertRoom = (body, actor = "ui") =>
    tx(() => {
      const r = normRoom(body);
      if (r.floor >= q("SELECT COUNT(*) c FROM floors").get().c) bad(`floor ${r.floor} does not exist`);
      if (!fitsOnPlan(r)) bad(`room must fit on the plan (${GRID.cols} wide x ${GRID.rows} long)`);
      const before = getRoom(r.id);
      insertRoom(r);
      audit(actor, before ? "update" : "create", "room", r.id, before, r);
      return r;
    });
  const deleteRoom = (id, actor = "ui") =>
    tx(() => {
      const before = getRoom(id);
      if (!before) return false;
      q("DELETE FROM rooms WHERE id=?").run(id); // items/tasks fall back to room_id NULL
      audit(actor, "delete", "room", id, before, null);
      return true;
    });

  const upsertItem = (body, actor = "ui") =>
    tx(() => {
      const i = normItem(body);
      fkCheck("rooms", i.roomId, "room");
      const before = getItem(i.id);
      insertItem(i);
      audit(actor, before ? "update" : "create", "item", i.id, before, i);
      return i;
    });
  const deleteItem = (id, actor = "ui") =>
    tx(() => {
      const before = getItem(id);
      if (!before) return false;
      q("DELETE FROM items WHERE id=?").run(id);
      audit(actor, "delete", "item", id, before, null);
      return true;
    });

  const upsertTask = (body, actor = "ui") =>
    tx(() => {
      const t = normTask(body);
      fkCheck("rooms", t.roomId, "room");
      fkCheck("items", t.itemId, "item");
      const before = getTask(t.id);
      // History is owned by completeTask unless the caller sends it explicitly.
      const history = Array.isArray(body.history) ? body.history.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h)).slice(0, 30) : undefined;
      insertTask(t, history);
      const after = getTask(t.id);
      audit(actor, before ? "update" : "create", "task", t.id, before, after);
      return after;
    });
  const deleteTask = (id, actor = "ui") =>
    tx(() => {
      const before = getTask(id);
      if (!before) return false;
      q("DELETE FROM tasks WHERE id=?").run(id);
      audit(actor, "delete", "task", id, before, null);
      return true;
    });
  const completeTask = (id, on = today(), actor = "ui", completionId) =>
    tx(() => {
      const before = getTask(id);
      if (!before) return null;
      date(on, "date");
      q("UPDATE tasks SET last_done=?, due_date=? WHERE id=?").run(on, addInterval(on, before.every, before.unit), id);
      q("INSERT INTO task_history (task_id, done_on) VALUES (?,?)").run(id, on);
      q("DELETE FROM task_history WHERE task_id=? AND rowid NOT IN (SELECT rowid FROM task_history WHERE task_id=? ORDER BY done_on DESC, rowid DESC LIMIT 30)").run(id, id);
      insertCompletion(normCompletion({ id: completionId, taskId: id, title: before.title, plant: before.plant, notes: before.notes, doneOn: on, at: new Date().toISOString(), actor, ...snapshotOf(before) }));
      const after = getTask(id);
      audit(actor, "complete", "task", id, before, after);
      return after;
    });

  const addFloor = (name, actor = "ui") =>
    tx(() => {
      str(name, "name", { required: true });
      const idx = q("SELECT COUNT(*) c FROM floors").get().c;
      q("INSERT INTO floors (idx, name) VALUES (?,?)").run(idx, name);
      audit(actor, "create", "floor", String(idx), null, { name });
      return idx;
    });

  // ---- small settings + evening-reminder subscriptions -------------------------------------------
  const getMeta = (k) => q("SELECT value FROM meta WHERE key=?").get(k)?.value ?? null;
  const setMeta = (k, v) => { q("INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)").run(k, String(v)); };

  /** Titles of the rituals due on a given day (yyyy-mm-dd), for the evening "tomorrow" reminder. */
  const tasksDueOn = (d) => q("SELECT title FROM tasks WHERE due_date = ? ORDER BY title").all(date(d, "date")).map((r) => r.title);

  const validTz = (tz) => { try { new Intl.DateTimeFormat("en-CA", { timeZone: tz }); return typeof tz === "string" && tz.length > 0; } catch { return false; } };
  const b64url = (v, k) => { if (typeof v !== "string" || !/^[A-Za-z0-9_-]{8,256}$/.test(v)) bad(`${k} is invalid`); return v; };

  const addPushSubscription = ({ endpoint, p256dh, auth, tz, label }) => {
    if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint) || endpoint.length > 2000) bad("endpoint must be an https URL");
    if (!validTz(tz)) bad("tz must be an IANA time zone such as Europe/Berlin");
    q(`INSERT INTO push_subscriptions (endpoint, p256dh, auth, tz, label) VALUES (?,?,?,?,?)
       ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth, tz=excluded.tz, label=excluded.label`)
      .run(endpoint, b64url(p256dh, "p256dh"), b64url(auth, "auth"), tz, typeof label === "string" ? label.slice(0, 80) : "");
  };
  const removePushSubscription = (endpoint) => q("DELETE FROM push_subscriptions WHERE endpoint=?").run(String(endpoint)).changes > 0;
  const listPushSubscriptions = () =>
    q("SELECT endpoint, p256dh, auth, tz, label, last_sent_on AS lastSentOn FROM push_subscriptions ORDER BY created_at").all();
  const getPushSubscription = (endpoint) =>
    q("SELECT endpoint, p256dh, auth, tz, label, last_sent_on AS lastSentOn FROM push_subscriptions WHERE endpoint=?").get(String(endpoint)) ?? null;
  const markPushSent = (endpoint, d) => { q("UPDATE push_subscriptions SET last_sent_on=? WHERE endpoint=?").run(date(d, "date"), String(endpoint)); };

  /** The log, newest first. Optional filters: a room (by id), a ritual (by id), entries from `since` (yyyy-mm-dd) on. */
  const listCompletions = ({ roomId, taskId, since, limit = 100 } = {}) => {
    const where = [], args = [];
    if (roomId) { where.push("room_id = ?"); args.push(roomId); }
    if (taskId) { where.push("task_id = ?"); args.push(taskId); }
    if (since) { where.push("done_on >= ?"); args.push(date(since, "since")); }
    const w = where.length ? "WHERE " + where.join(" AND ") : "";
    const total = q(`SELECT COUNT(*) c FROM completions ${w}`).get(...args).c;
    const rows = q(`SELECT * FROM completions ${w} ORDER BY done_on DESC, COALESCE(at, '') DESC, rowid DESC LIMIT ?`)
      .all(...args, Math.min(Math.max(Number(limit) || 100, 1), 1000));
    return { total, completions: rows.map(completionOut) };
  };

  const listAudit = (limit = 100) =>
    q("SELECT id, at, actor, action, entity, entity_id, before, after FROM audit_log ORDER BY id DESC LIMIT ?").all(
      Math.min(Math.max(Number(limit) || 100, 1), 500)
    );

  /**
   * One-off migration when the plan shrank (12x8 -> 5x10): re-fit any floor with a room off the plan.
   * Takes a safety copy first so the old arrangement can be recovered.
   */
  const refitLayout = (backupDir) => {
    const rooms = q("SELECT * FROM rooms ORDER BY rowid").all().map(roomOut);
    const fixed = fitAll(rooms);
    const changed = fixed.filter((r, i) => ["x", "y", "w", "h"].some((k) => r[k] !== rooms[i][k]));
    if (!changed.length) return 0;
    fs.mkdirSync(backupDir, { recursive: true });
    backupTo(path.join(backupDir, "pre-layout-refit.db"));
    tx(() => {
      for (const r of changed) q("UPDATE rooms SET x=?, y=?, w=?, h=? WHERE id=?").run(r.x, r.y, r.w, r.h, r.id);
      audit("system", "refit_layout", "room", null, rooms.filter((r) => changed.some((c) => c.id === r.id)), changed);
    });
    return changed.length;
  };

  /** Consistent point-in-time copy (safe while the app is running). */
  const backupTo = (file) => {
    fs.rmSync(file, { force: true });
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  };

  return {
    db, dbPath, isInitialized, getState, replaceState,
    upsertRoom, deleteRoom, upsertItem, deleteItem, upsertTask, deleteTask, completeTask, addFloor,
    listAudit, backupTo, refitLayout, listCompletions,
    getMeta, setMeta, tasksDueOn, addPushSubscription, removePushSubscription, listPushSubscriptions, getPushSubscription, markPushSent,
  };
}
