// AutoMate service worker: shows Web Push notifications and opens them. It caches nothing and
// never touches requests, so the app behaves exactly as without it.
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "AutoMate", {
      body: data.body || undefined,
      tag: data.tag,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: { href: data.href || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/notifications";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows[0];
      if (open) {
        await open.navigate(href).catch(() => undefined);
        return open.focus();
      }
      return self.clients.openWindow(href);
    })(),
  );
});
