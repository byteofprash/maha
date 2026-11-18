// Single-process server: serves the built UI and a tiny JSON persistence API.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "state.json");
const PASSWORD = process.env.HOME_OS_PASSWORD || ""; // optional: protects the whole app (HTTP Basic)

fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();

// ---- optional password gate -------------------------------------------------
app.use((req, res, next) => {
  if (!PASSWORD) return next();
  // Calendar apps can't send Basic auth, so the .ics feed also accepts ?token=
  if (req.path === "/api/tasks.ics" && req.query.token === PASSWORD) return next();
  const [scheme, b64] = (req.headers.authorization || "").split(" ");
  if (scheme === "Basic" && b64) {
    const pass = Buffer.from(b64, "base64").toString().split(":").slice(1).join(":");
    if (pass === PASSWORD) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="MAHA"').status(401).send("Authentication required");
});

app.use(express.json({ limit: "5mb" }));

// ---- persistence ------------------------------------------------------------
const read = () => {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return null; }
};
const write = (state) => {
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, FILE); // atomic swap so a crash never leaves half a file
};

app.get("/api/health", (_req, res) => res.json({ ok: true }));
// Behind the password gate, so the calendar token is only ever shown to signed-in users.
app.get("/api/config", (_req, res) =>
  res.json({
    feedPath: PASSWORD ? `/api/tasks.ics?token=${encodeURIComponent(PASSWORD)}` : "/api/tasks.ics",
    ephemeral: process.env.EPHEMERAL_STORAGE === "1",
  })
);
app.get("/api/state", (_req, res) => res.json({ state: read() }));
app.put("/api/state", (req, res) => {
  const s = req.body;
  if (!s || !Array.isArray(s.rooms) || !Array.isArray(s.items) || !Array.isArray(s.tasks) || !Array.isArray(s.floors)) {
    return res.status(400).json({ error: "invalid state" });
  }
  write(s);
  res.json({ ok: true });
});

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
