// Checks for the evening reminder: time logic, wording, the scheduler against a real database with a fake clock and fake sender.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import * as webpush from "web-push";
import { openDb } from "../server/db.mjs";
import { addDays, compose, dueNow, ensureSubject, ensureVapid, GRACE_MINUTES, localParts, startNotifier } from "../server/push.mjs";

let bad = 0;
const check = (name, ok, detail = "") => { if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? "  " + detail : ""}`); };
const at = (iso) => new Date(iso);

// ---- local time in a time zone, across daylight saving -----------------------------------------------------
const L = (iso, tz) => { const p = localParts(at(iso), tz); return `${p.date} ${String(Math.floor(p.minutes / 60)).padStart(2, "0")}:${String(p.minutes % 60).padStart(2, "0")}`; };
check("Berlin in winter: 18:00 UTC is 19:00", L("2026-11-20T18:00:00Z", "Europe/Berlin") === "2026-11-20 19:00", L("2026-11-20T18:00:00Z", "Europe/Berlin"));
check("Berlin in summer time: 17:00 UTC is 19:00", L("2026-07-20T17:00:00Z", "Europe/Berlin") === "2026-07-20 19:00");
check("clocks change on 29 Mar 2026: 19:00 local is still 19:00 either side", L("2026-03-28T18:00:00Z", "Europe/Berlin") === "2026-03-28 19:00" && L("2026-03-29T17:00:00Z", "Europe/Berlin") === "2026-03-29 19:00");
check("New York in winter", L("2026-11-20T18:00:00Z", "America/New_York") === "2026-11-20 13:00");
check("India (half-hour offset)", L("2026-11-20T13:30:00Z", "Asia/Kolkata") === "2026-11-20 19:00");
check("the date moves with the zone (Auckland is a day ahead)", L("2026-11-20T18:00:00Z", "Pacific/Auckland") === "2026-11-21 07:00");
check("adding a day crosses month, year and leap day", addDays("2026-11-30", 1) === "2026-12-01" && addDays("2026-12-31", 1) === "2027-01-01" && addDays("2028-02-28", 1) === "2028-02-29" && addDays("2027-02-28", 1) === "2027-03-01");

// ---- when to send -------------------------------------------------------------------------------------------
const berlin = { tz: "Europe/Berlin", lastSentOn: null };
const D = (iso, sub = berlin) => dueNow(sub, at(iso)).send;
check("not before 19:00", D("2026-11-20T17:59:00Z") === false);
check("exactly 19:00", D("2026-11-20T18:00:00Z") === true);
check("still inside the grace window", D("2026-11-20T19:59:00Z") === true);
check("not once the window has passed", D(`2026-11-20T${String(18 + GRACE_MINUTES / 60).padStart(2, "0")}:00:00Z`) === false);
check("not twice on the same local day", D("2026-11-20T18:30:00Z", { ...berlin, lastSentOn: "2026-11-20" }) === false);
check("again the next local day", D("2026-11-21T18:00:00Z", { ...berlin, lastSentOn: "2026-11-20" }) === true);
check("'tomorrow' is the device's tomorrow", dueNow(berlin, at("2026-12-31T18:00:00Z")).tomorrow === "2027-01-01");

// ---- wording -----------------------------------------------------------------------------------------------
check("nothing tomorrow: no message", compose([]) === null);
check("one ritual", compose(["Clean the filter"]).body === "Clean the filter");
check("three rituals", compose(["A", "B", "C"]).body === "A · B · C");
check("more than three are summed up", compose(["A", "B", "C", "D", "E"]).body === "A · B · C and 2 more");
check("a gentle title, opens the app", compose(["A"]).title === "A little care tomorrow" && compose(["A"]).url === "/");

// ---- the scheduler, on a real database with a fake clock and a fake sender -------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aham-push-"));
const store = openDb(tmp);
const room = { id: "k", name: "Kitchen", floor: 0, x: 0, y: 0, w: 3, h: 3, color: "#000" };
const task = (id, title, dueDate) => ({ id, title, every: 10, unit: "day", dueDate, lastDone: null, roomId: "k", itemId: null, category: "Other", notes: "", plant: "daisy", history: [] });
store.replaceState({ floors: ["Main"], rooms: [room], items: [], tasks: [
  task("a", "Clean the filter", "2026-11-21"), task("b", "Water the herbs", "2026-11-21"), // tomorrow
  task("c", "Wipe the hinges", "2026-11-20"),                                              // today: not announced
  task("d", "Old and waiting", "2026-11-10"),                                              // late: not announced
  task("e", "Next week", "2026-11-27"),
] });
const key = () => crypto.randomBytes(32).toString("base64url");
const sub = (n, tz) => store.addPushSubscription({ endpoint: `https://push.example/${n}`, p256dh: key(), auth: crypto.randomBytes(16).toString("base64url"), tz, label: "test" });
sub("berlin", "Europe/Berlin");

let clock = at("2026-11-20T17:59:00Z");
const sent = []; let behaviour = null;
const send = async (s, msg) => { if (behaviour) await behaviour(s, msg); sent.push({ endpoint: s.endpoint, ...msg }); };
const n = startNotifier({ store, send, now: () => clock, intervalMs: 3_600_000, log: { log() {}, error() {} } });

await n.tick();
check("18:59 local-1h: nothing sent yet", sent.length === 0);
clock = at("2026-11-20T18:00:00Z"); await n.tick();
check("19:00: one notification, naming only tomorrow's rituals", sent.length === 1 && sent[0].body === "Clean the filter · Water the herbs", sent[0]?.body);
clock = at("2026-11-20T18:05:00Z"); await n.tick();
check("19:05: no duplicate", sent.length === 1);
const n2 = startNotifier({ store, send, now: () => clock, intervalMs: 3_600_000, log: { log() {}, error() {} } });
clock = at("2026-11-20T18:10:00Z"); await n2.tick();
check("after a server restart it still does not resend", sent.length === 1);
clock = at("2026-11-21T18:00:00Z"); await n2.tick();
check("next day with nothing due the day after: no message", sent.length === 1);
clock = at("2026-11-26T18:00:00Z"); await n2.tick();
check("a later day with a ritual due tomorrow: sends", sent.length === 2 && sent[1].body === "Next week", sent[1]?.body);

// two devices in different zones each get it at their own 19:00
sub("kolkata", "Asia/Kolkata");
clock = at("2026-11-26T13:30:00Z"); await n2.tick();
check("Kolkata's 19:00 comes before Berlin's (and Berlin isn't sent twice)", sent.filter((s) => s.endpoint.endsWith("kolkata")).length === 1 && sent.filter((s) => s.endpoint.endsWith("berlin")).length === 2);

// failures
store.replaceState({ floors: ["Main"], rooms: [room], items: [], tasks: [task("a", "Clean the filter", "2026-12-02")] });
store.addPushSubscription({ endpoint: "https://push.example/flaky", p256dh: key(), auth: crypto.randomBytes(16).toString("base64url"), tz: "Europe/Berlin" });
for (const s of store.listPushSubscriptions()) if (!s.endpoint.endsWith("flaky")) store.removePushSubscription(s.endpoint);
let calls = 0; behaviour = async () => { if (++calls === 1) throw Object.assign(new Error("push service hiccup"), { statusCode: 503 }); };
clock = at("2026-12-01T18:00:00Z"); sent.length = 0; await n2.tick();
check("a temporary failure sends nothing and is not marked as sent", sent.length === 0 && store.getPushSubscription("https://push.example/flaky").lastSentOn === null);
clock = at("2026-12-01T18:01:00Z"); await n2.tick();
check("it is retried on the next pass and then succeeds once", sent.length === 1 && store.getPushSubscription("https://push.example/flaky").lastSentOn === "2026-12-01");
behaviour = async () => { throw Object.assign(new Error("gone"), { statusCode: 410 }); };
clock = at("2026-12-02T18:00:00Z"); store.replaceState({ floors: ["Main"], rooms: [room], items: [], tasks: [task("a", "Clean the filter", "2026-12-03")] });
await n2.tick();
check("a device the push service reports as gone (410) is forgotten", store.getPushSubscription("https://push.example/flaky") === null);

// ---- keys and storing subscriptions ------------------------------------------------------------------------
const k1 = ensureVapid(store), k2 = ensureVapid(store);
check("signing keys are made once and kept", k1.publicKey === k2.publicKey && k1.privateKey === k2.privateKey && k1.publicKey.length === 87);
check("the contact address is remembered from the first request and not overwritten", ensureSubject(store, "https://one.example") === "https://one.example" && ensureSubject(store, "https://two.example") === "https://one.example");
const bads = [
  () => store.addPushSubscription({ endpoint: "http://insecure.example/x", p256dh: key(), auth: "x".repeat(22), tz: "Europe/Berlin" }),
  () => store.addPushSubscription({ endpoint: "https://ok.example/x", p256dh: key(), auth: "x".repeat(22), tz: "Not/AZone" }),
  () => store.addPushSubscription({ endpoint: "https://ok.example/x", p256dh: "not valid!!", auth: "x".repeat(22), tz: "Europe/Berlin" }),
];
check("bad subscriptions are rejected (http endpoint, unknown zone, junk keys)", bads.every((f) => { try { f(); return false; } catch { return true; } }));
store.addPushSubscription({ endpoint: "https://push.example/keep", p256dh: key(), auth: crypto.randomBytes(16).toString("base64url"), tz: "Europe/Berlin" });
store.markPushSent("https://push.example/keep", "2026-12-05");
store.addPushSubscription({ endpoint: "https://push.example/keep", p256dh: key(), auth: crypto.randomBytes(16).toString("base64url"), tz: "Europe/London" });
check("subscribing again updates the device without forgetting today's send", store.getPushSubscription("https://push.example/keep").lastSentOn === "2026-12-05" && store.getPushSubscription("https://push.example/keep").tz === "Europe/London");

// ---- the real encrypted message web-push builds can be read back by the device ------------------------------
const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
const authSecret = crypto.randomBytes(16);
const payload = compose(["Clean the filter", "Water the herbs"]);
const req = await webpush.generateRequestDetails(
  { endpoint: "https://push.example/real", keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: authSecret.toString("base64url") } },
  JSON.stringify(payload),
  { vapidDetails: { subject: "https://one.example", publicKey: k1.publicKey, privateKey: k1.privateKey }, TTL: 3600 }
);
check("the request is signed (VAPID) and encrypted (aes128gcm)", /^vapid t=.+, k=/.test(req.headers.Authorization) && req.headers["Content-Encoding"] === "aes128gcm" && req.body.length > 50);
const ece = (await import("http_ece")).default;
const plain = ece.decrypt(req.body, { version: "aes128gcm", privateKey: ecdh, authSecret: authSecret.toString("base64url") }).toString();
check("the device can decrypt it back to exactly our text", JSON.parse(plain).body === "Clean the filter · Water the herbs", plain.slice(0, 80));

n.stop(); n2.stop(); fs.rmSync(tmp, { recursive: true, force: true });
if (bad) { console.error(`${bad} push check(s) FAILED`); process.exit(1); }
console.log("push checks: all pass");
