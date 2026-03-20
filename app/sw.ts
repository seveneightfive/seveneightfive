import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { NetworkFirst, StaleWhileRevalidate, Serwist } from "serwist"

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    // HTML pages — always try network first so new deployments are picked up
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages-v1",
        networkTimeoutSeconds: 5,
        plugins: [],
      }),
    },
    // API routes — stale-while-revalidate so they're fast but always updating
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new StaleWhileRevalidate({
        cacheName: "api-v1",
      }),
    },
    // Static assets not covered by precache (images, fonts, CDN)
    {
      matcher: ({ request }) =>
        request.destination === "image" ||
        request.destination === "font",
      handler: new StaleWhileRevalidate({
        cacheName: "assets-v1",
      }),
    },
  ],
})

serwist.addEventListeners()

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return

  const data = event.data.json() as {
    title: string
    body: string
    url?: string
    icon?: string
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  )
})

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close()
  const url: string = (event.notification.data as { url: string })?.url || "/"
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) return client.focus()
        }
        return self.clients.openWindow(url)
      })
  )
})
