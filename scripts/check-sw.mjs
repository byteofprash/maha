// Runs public/sw.js against a fake service-worker scope: what it shows for a push, and what tapping the notification does.
import fs from "node:fs";
import vm from "node:vm";

let bad = 0;
const check = (name, ok, detail = "") => { if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? "  " + detail : ""}`); };

function load(windows = []) {
  const handlers = {}, shown = [], opened = [], focused = [];
  const self = {
    addEventListener: (t, f) => { handlers[t] = f; },
    skipWaiting() {}, clients: {
      claim() {}, matchAll: async () => windows.map((w) => ({ focus: () => { focused.push(w); return Promise.resolve(); } })),
      openWindow: async (u) => { opened.push(u); },
    },
    registration: { showNotification: async (title, opts) => { shown.push({ title, ...opts }); } },
  };
  vm.runInNewContext(fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), { self, JSON, Promise });
  const fire = async (type, ev) => { const waits = []; handlers[type]({ ...ev, waitUntil: (p) => waits.push(p) }); await Promise.all(waits); };
  return { fire, shown, opened, focused };
}

{
  const sw = load();
  await sw.fire("push", { data: { json: () => ({ title: "A little care tomorrow", body: "Clean the filter · Water the herbs", url: "/", tag: "aham-evening" }) } });
  const n = sw.shown[0];
  check("a push shows its title and body", n.title === "A little care tomorrow" && n.body === "Clean the filter · Water the herbs");
  check("it carries the app icon, a tag (so repeats replace each other) and where to open", n.icon === "/icon-192.png" && n.tag === "aham-evening" && n.data.url === "/");
}
{
  const sw = load();
  await sw.fire("push", { data: null });
  check("an empty push still shows something gentle (browsers require a notification)", sw.shown.length === 1 && sw.shown[0].title === "AHAM" && sw.shown[0].body.length > 0);
}
{
  const sw = load();
  await sw.fire("push", { data: { json: () => { throw new Error("not json"); }, text: () => "plain words" } });
  check("a garbled push falls back to its text", sw.shown[0].body === "plain words");
}
{
  let closed = 0;
  const sw = load([{}]);
  await sw.fire("notificationclick", { notification: { close: () => closed++, data: { url: "/" } } });
  check("tapping it closes the notification and brings the open app forward (no second window)", closed === 1 && sw.focused.length === 1 && sw.opened.length === 0);
}
{
  const sw = load([]);
  await sw.fire("notificationclick", { notification: { close() {}, data: { url: "/" } } });
  check("with the app closed, tapping it opens the app", sw.opened.join() === "/");
  const sw2 = load([]);
  await sw2.fire("notificationclick", { notification: { close() {}, data: null } });
  check("a notification with no data still opens the app", sw2.opened.join() === "/");
}

if (bad) { console.error(`${bad} service-worker check(s) FAILED`); process.exit(1); }
console.log("service-worker checks: all pass");
