// AHAM service worker: it only receives the evening reminder (a web push) and shows it. It caches nothing.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : "" }; }
  // every push must show something (browsers require it), so even a malformed one shows a gentle default
  event.waitUntil(
    self.registration.showNotification(d.title || "AHAM", {
      body: d.body || "A little care is coming round.",
      icon: "/icon-192.png",
      tag: d.tag || "aham",
      data: { url: d.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) if ("focus" in w) return w.focus(); // already open: just bring it forward
      return self.clients.openWindow(url);
    })
  );
});
