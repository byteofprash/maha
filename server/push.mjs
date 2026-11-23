// The evening reminder: every day at 19:00 (the device's own local time) a web-push notification names the rituals that come
// round tomorrow. Pure helpers first (easy to test), then the VAPID keys, the sender and the scheduler.
import * as webpush from "web-push";

export const NOTIFY_AT = /^([01]\d|2[0-3]):[0-5]\d$/.test(process.env.AHAM_NOTIFY_AT || "") ? process.env.AHAM_NOTIFY_AT : "19:00";
/** If the server was down at 19:00, it still sends when it comes back, but only within this many minutes. */
export const GRACE_MINUTES = 180;

const toMinutes = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

/** The calendar date and minutes-since-midnight at `now` in an IANA time zone, e.g. "Europe/Berlin". */
export function localParts(now, tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const g = (t) => parts.find((p) => p.type === t).value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, minutes: Number(g("hour")) * 60 + Number(g("minute")) };
}

export function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Is it time to send to this device now? Once per local day, from `at` until the grace window ends. */
export function dueNow({ tz, lastSentOn }, now, at = NOTIFY_AT) {
  const { date, minutes } = localParts(now, tz);
  const start = toMinutes(at);
  return { send: minutes >= start && minutes < start + GRACE_MINUTES && lastSentOn !== date, date, tomorrow: addDays(date, 1) };
}

/** The notification text for tomorrow's rituals, or null when nothing comes round (no message is sent). */
export function compose(titles) {
  if (!titles.length) return null;
  const shown = titles.slice(0, 3);
  const more = titles.length - shown.length;
  return { title: "A little care tomorrow", body: shown.join(" · ") + (more > 0 ? ` and ${more} more` : ""), url: "/", tag: "aham-evening" };
}

// ---- keys ------------------------------------------------------------------------------------------------
// VAPID keys prove to the browsers' push services that the messages come from this server. Made once, kept in the database.
export function ensureVapid(store) {
  let publicKey = store.getMeta("vapid_public");
  let privateKey = store.getMeta("vapid_private");
  if (!publicKey || !privateKey) {
    ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
    store.setMeta("vapid_public", publicKey);
    store.setMeta("vapid_private", privateKey);
  }
  return { publicKey, privateKey };
}

/** The contact URL push services are given (VAPID "sub"): the app's own address, remembered from the first subscription. */
export function ensureSubject(store, origin) {
  if (process.env.AHAM_VAPID_SUBJECT) return process.env.AHAM_VAPID_SUBJECT;
  let subject = store.getMeta("vapid_subject");
  if (!subject && origin) { subject = origin; store.setMeta("vapid_subject", subject); }
  return subject;
}

// ---- sending ---------------------------------------------------------------------------------------------
export function makeSender(store, { dryRun = process.env.AHAM_PUSH_DRY_RUN === "1", log = console } = {}) {
  return async function send(sub, payload) {
    if (dryRun) { log.log(`push (dry run) -> ${sub.endpoint.slice(0, 40)}...: ${payload.title} | ${payload.body}`); return; }
    const { publicKey, privateKey } = ensureVapid(store);
    const subject = ensureSubject(store);
    if (!subject) throw new Error("no VAPID subject yet");
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { vapidDetails: { subject, publicKey, privateKey }, TTL: 4 * 3600 }
    );
  };
}

// ---- the scheduler ---------------------------------------------------------------------------------------
export function startNotifier({ store, send, now = () => new Date(), intervalMs = 30_000, at = NOTIFY_AT, log = console }) {
  let running = false;
  const lastLogged = new Map(); // endpoint -> ms; a failing device is logged at most every 10 minutes, not every tick

  /** One pass over every subscribed device. Returns what happened (used by tests). */
  async function tick() {
    if (running) return [];
    running = true;
    const did = [];
    try {
      for (const sub of store.listPushSubscriptions()) {
        const d = dueNow(sub, now(), at);
        if (!d.send) continue;
        const msg = compose(store.tasksDueOn(d.tomorrow));
        if (!msg) { store.markPushSent(sub.endpoint, d.date); did.push({ endpoint: sub.endpoint, sent: false, why: "nothing tomorrow" }); continue; }
        try {
          await send(sub, msg);
          store.markPushSent(sub.endpoint, d.date);
          did.push({ endpoint: sub.endpoint, sent: true, ...msg });
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) {
            store.removePushSubscription(sub.endpoint); // the device unsubscribed or uninstalled: forget it
            did.push({ endpoint: sub.endpoint, removed: true });
          } else {
            did.push({ endpoint: sub.endpoint, error: String(e.message) });
            const t = Date.now();
            if (t - (lastLogged.get(sub.endpoint) ?? 0) > 600_000) { lastLogged.set(sub.endpoint, t); log.error(`push failed (${e.statusCode ?? "no status"}): ${e.message}`); }
          }
        }
      }
    } finally { running = false; }
    return did;
  }

  const timer = setInterval(() => tick().catch((e) => log.error("notifier:", e.message)), intervalMs);
  timer.unref();
  return { tick, stop: () => clearInterval(timer) };
}
