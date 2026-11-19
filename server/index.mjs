// Single-process server: serves the built UI and the SQLite-backed REST API.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, ValidationError } from "./db.mjs";
import { mountMcp } from "./mcp.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "state.json");
const PASSWORD = process.env.MAHA_PASSWORD || process.env.HOME_OS_PASSWORD || ""; // optional: protects the whole app (HTTP Basic)

fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();

// ---- optional password gate -------------------------------------------------
app.use((req, res, next) => {
  if (!PASSWORD) return next();
  // Liveness probe for the deploy check / Docker: returns only {ok:true}, so it is safe to leave open.
  if (req.path === "/api/health") return next();
  // Calendar apps can't send Basic auth, so the .ics feed also accepts ?token=
  if (req.path === "/api/tasks.ics" && req.query.token === PASSWORD) return next();
  const [scheme, b64] = (req.headers.authorization || "").split(" ");
  if (scheme === "Basic" && b64) {
    const pass = Buffer.from(b64, "base64").toString().split(":").slice(1).join(":");
    if (pass === PASSWORD) return next();
  }
  // MCP clients usually send a bearer token instead of Basic auth
  if (scheme === "Bearer" && b64 === PASSWORD) return next();
  res.set("WWW-Authenticate", 'Basic realm="MAHA"').status(401).send("Authentication required");
});

app.use(express.json({ limit: "5mb" }));

// ---- persistence (SQLite) -----------------------------------------------------
const store = openDb(DATA_DIR);

// One-time import of the legacy JSON file.
if (!store.isInitialized() && fs.existsSync(FILE)) {
  try {
    store.replaceState(JSON.parse(fs.readFileSync(FILE, "utf8")), "migration", "import_state_json");
    fs.renameSync(FILE, FILE + ".migrated");
    console.log("Imported state.json into SQLite");
  } catch (e) {
    console.error("state.json import failed, leaving it untouched:", e.message);
  }
}

// Daily consistent backup (keeps the last 7) next to the live DB.
const BACKUP_DIR = path.join(DATA_DIR, "backups");
function backup() {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    store.backupTo(path.join(BACKUP_DIR, `maha-${new Date().toISOString().slice(0, 10)}.db`));
    const old = fs.readdirSync(BACKUP_DIR).filter((f) => /^maha-.*\.db$/.test(f)).sort().slice(0, -7);
    for (const f of old) fs.rmSync(path.join(BACKUP_DIR, f), { force: true });
  } catch (e) {
    console.error("backup failed:", e.message);
  }
}
if (store.isInitialized()) backup();
setInterval(backup, 24 * 3600 * 1000).unref();

const read = () => store.getState();
const actor = (req) => (req.get("x-actor") || "ui").slice(0, 40);
const wrap = (fn) => (req, res) => {
  try { fn(req, res); } catch (e) {
    if (e instanceof ValidationError) return res.status(400).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: "internal error" });
  }
};
const withId = (req) => ({ ...req.body, id: req.params.id });

app.get("/api/health", (_req, res) => res.json({ ok: true }));
// Behind the password gate, so the calendar token is only ever shown to signed-in users.
app.get("/api/config", (_req, res) =>
  res.json({
    feedPath: PASSWORD ? `/api/tasks.ics?token=${encodeURIComponent(PASSWORD)}` : "/api/tasks.ics",
    ephemeral: process.env.EPHEMERAL_STORAGE === "1",
  })
);

// Whole-state: read for the UI's first load; PUT is bulk replace (import / reset / first-run seed).
app.get("/api/state", wrap((_req, res) => res.json({ state: read() })));
app.put("/api/state", wrap((req, res) => {
  store.replaceState(req.body, actor(req));
  res.json({ ok: true });
}));

// Granular entity endpoints (shared by the UI and the future agent tools).
app.get("/api/audit", wrap((req, res) => res.json({ entries: store.listAudit(req.query.limit) })));
app.post("/api/floors", wrap((req, res) => res.json({ index: store.addFloor(req.body?.name, actor(req)) })));

app.put("/api/rooms/:id", wrap((req, res) => res.json({ room: store.upsertRoom(withId(req), actor(req)) })));
app.delete("/api/rooms/:id", wrap((req, res) => res.json({ ok: store.deleteRoom(req.params.id, actor(req)) })));

app.put("/api/items/:id", wrap((req, res) => res.json({ item: store.upsertItem(withId(req), actor(req)) })));
app.delete("/api/items/:id", wrap((req, res) => res.json({ ok: store.deleteItem(req.params.id, actor(req)) })));

app.put("/api/tasks/:id", wrap((req, res) => res.json({ task: store.upsertTask(withId(req), actor(req)) })));
app.delete("/api/tasks/:id", wrap((req, res) => res.json({ ok: store.deleteTask(req.params.id, actor(req)) })));
app.post("/api/tasks/:id/complete", wrap((req, res) => {
  const task = store.completeTask(req.params.id, req.body?.date, actor(req));
  if (!task) return res.status(404).json({ error: "task not found" });
  res.json({ task });
}));

// ---- MCP server (agent tools) -----------------------------------------------------
mountMcp(app, store);

// ---- calendar feed (works as a stand-in for notifications) -----------------------
const ics = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const compact = (d) => d.replaceAll("-", "");
const nextDay = (d) => {
  const [y, m, dd] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, dd + 1));
  return t.toISOString().slice(0, 10).replaceAll("-", "");
};

app.get("/api/tasks.ics", (_req, res) => {
  const s = read() || { tasks: [], rooms: [], items: [] };
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MAHA//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:MAHA tasks"];
  for (const t of s.tasks) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.dueDate || "")) continue;
    const room = s.rooms.find((r) => r.id === t.roomId);
    const desc = [room && `Room: ${room.name}`, t.notes].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${t.id}@maha`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(t.dueDate)}`,
      `DTEND;VALUE=DATE:${nextDay(t.dueDate)}`,
      `SUMMARY:${ics("🏠 " + t.title)}`,
      ...(desc ? [`DESCRIPTION:${ics(desc)}`] : []),
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  res.type("text/calendar").send(lines.join("\r\n"));
});

// ---- static UI ------------------------------------------------------------------
const DIST = path.join(__dirname, "..", "dist");
app.use(express.static(DIST));
app.get("*", (_req, res) => res.sendFile(path.join(DIST, "index.html")));

app.listen(PORT, "0.0.0.0", () => console.log(`MAHA listening on ${PORT}, data in ${DATA_DIR}`));
