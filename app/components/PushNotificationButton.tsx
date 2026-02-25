"use client"

import { useEffect, useState } from "react"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

type PermissionState = "default" | "granted" | "denied" | "unsupported"

export default function PushNotificationButton() {
  const [permState, setPermState] = useState<PermissionState>("default")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermState("unsupported")
      return
    }
    setPermState(Notification.permission as PermissionState)
  }, [])

  const handleEnable = async () => {
    if (loading) return
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setPermState("denied")
        return
      }
      setPermState("granted")

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const subscription = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      })
    } catch (err) {
      console.error("Push subscribe error:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleDisable = async () => {
    if (loading) return
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setPermState("default")
    } catch (err) {
      console.error("Push unsubscribe error:", err)
    } finally {
      setLoading(false)
    }
  }

  if (permState === "unsupported") return null

  if (permState === "granted") {
    return (
      <button onClick={handleDisable} disabled={loading} aria-label="Disable notifications" style={{ ...styles.btn, background: "#c8502a" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {loading ? "..." : "Notifications On"}
      </button>
    )
  }

  if (permState === "denied") return null

  return (
    <button onClick={handleEnable} disabled={loading} aria-label="Enable notifications" style={styles.btn}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {loading ? "..." : "Get Notified"}
    </button>
  )
}

const styles: Record<string, React.CSSProperties> = {
  btn: {
    position: "fixed",
    bottom: "136px",
    right: "16px",
    zIndex: 300,
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "10px 16px",
    background: "#1a1814",
    color: "#fff",
    border: "none",
    borderRadius: "100px",
    fontSize: "0.72rem",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: "pointer",
    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
  },
}
