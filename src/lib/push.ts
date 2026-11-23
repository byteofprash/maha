// The evening reminder, from the browser's side: is it possible here, is it on, turn it on / off, send a test.

export type PushState =
  | { kind: "unsupported" }
  | { kind: "needs-install" } // iPhone: push only works from the Home Screen app
  | { kind: "blocked" } // the person (or the browser) said no to notifications for this site
  | { kind: "off" }
  | { kind: "on"; at: string };

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const bytesOf = (b64url: string) => {
  const raw = atob((b64url + "=".repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export function support(): "ok" | "needs-install" | "unsupported" {
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "ok";
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return ios ? "needs-install" : "unsupported";
}

/** "19:00" -> "7:00 PM" in the person's own clock style. */
export const clockLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
}
async function config(): Promise<{ publicKey: string; at: string }> {
  const r = await fetch("/api/push/config");
  if (!r.ok) throw new Error("Couldn't reach the server.");
  return r.json();
}

export async function readState(): Promise<PushState> {
  const s = support();
  if (s !== "ok") return { kind: s };
  if (Notification.permission === "denied") return { kind: "blocked" };
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return { kind: "off" };
  return { kind: "on", at: (await config()).at };
}

export async function enable(): Promise<PushState> {
  if (support() !== "ok") return readState();
  const perm = await Notification.requestPermission(); // must follow a tap
  if (perm === "denied") return { kind: "blocked" };
  if (perm !== "granted") return { kind: "off" };
  const { publicKey, at } = await config();
  const reg = await registration();
  const subscribe = () => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesOf(publicKey) });
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await subscribe();
  const r = await fetch("/api/push/subscribe", json({ subscription: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  if (!r.ok) { await sub.unsubscribe().catch(() => {}); throw new Error("The server didn't accept this device."); }
  return { kind: "on", at };
}

export async function disable(): Promise<void> {
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/unsubscribe", json({ endpoint: sub.endpoint })).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTest(): Promise<void> {
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) throw new Error("This device isn't subscribed.");
  const r = await fetch("/api/push/test", json({ endpoint: sub.endpoint }));
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "The test didn't go through.");
}
