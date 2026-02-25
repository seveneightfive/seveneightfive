"use client"

import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export default function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [iosHintVisible, setIosHintVisible] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Detect iOS Safari (no beforeinstallprompt support)
    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream
    setIsIOS(ios)

    // Already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    window.addEventListener("appinstalled", () => setInstalled(true))

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === "accepted") setInstalled(true)
    setPrompt(null)
  }

  if (installed) return null

  // Chrome/Edge/Android: show install button when prompt is available
  if (prompt) {
    return (
      <button onClick={handleInstall} aria-label="Install app" style={styles.btn}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M12 16V4M8 12l4 4 4-4"/>
          <path d="M20 20H4"/>
        </svg>
        Install App
      </button>
    )
  }

  // iOS: show a tap-to-install hint
  if (isIOS) {
    return (
      <>
        <button onClick={() => setIosHintVisible(v => !v)} aria-label="Install app" style={styles.btn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M12 16V4M8 12l4 4 4-4"/>
            <path d="M20 20H4"/>
          </svg>
          Install App
        </button>
        {iosHintVisible && (
          <div style={styles.iosHint}>
            Tap{" "}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "inline", verticalAlign: "middle" }}>
              <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>{" "}
            Share, then <strong>Add to Home Screen</strong>
            <button onClick={() => setIosHintVisible(false)} style={styles.iosClose} aria-label="Close">✕</button>
          </div>
        )}
      </>
    )
  }

  return null
}

const styles: Record<string, React.CSSProperties> = {
  btn: {
    position: "fixed",
    bottom: "80px",
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
  iosHint: {
    position: "fixed",
    bottom: "80px",
    left: "16px",
    right: "16px",
    zIndex: 300,
    background: "#1a1814",
    color: "#fff",
    padding: "14px 16px",
    borderRadius: "12px",
    fontSize: "0.85rem",
    lineHeight: 1.5,
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  },
  iosClose: {
    float: "right",
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.5)",
    cursor: "pointer",
    fontSize: "0.85rem",
    padding: 0,
  },
}
