"use client"

import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const VISIT_KEY = "pwa_visit_count"
const INSTALLED_KEY = "pwa_installed"
const DISMISSED_KEY = "pwa_dismissed_at"
const REQUIRED_VISITS = 3
const TIME_ON_PAGE_MS = 30_000
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

const BENEFITS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
    label: "Instant launch",
    desc: "Opens straight from your home screen — no browser, no waiting.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    label: "Zero storage used",
    desc: "Nothing downloads to your device. It lives on the web.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
    label: "No App Store needed",
    desc: "Skip the store entirely. Add it in seconds, remove just as fast.",
  },
]

export default function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [visible, setVisible] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    if (isStandalone || localStorage.getItem(INSTALLED_KEY)) return

    const dismissedAt = localStorage.getItem(DISMISSED_KEY)
    if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_COOLDOWN_MS) return

    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream
    setIsIOS(ios)

    const visits = Number(localStorage.getItem(VISIT_KEY) || "0") + 1
    localStorage.setItem(VISIT_KEY, String(visits))

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    window.addEventListener("appinstalled", () => {
      localStorage.setItem(INSTALLED_KEY, "1")
      setVisible(false)
    })

    if (visits >= REQUIRED_VISITS) {
      const timer = setTimeout(() => {
        setVisible(true)
        requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)))
      }, TIME_ON_PAGE_MS)
      return () => {
        clearTimeout(timer)
        window.removeEventListener("beforeinstallprompt", handler)
      }
    }

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const dismiss = () => {
    setAnimateIn(false)
    setTimeout(() => {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
      setVisible(false)
    }, 250)
  }

  const handleInstall = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === "accepted") {
      localStorage.setItem(INSTALLED_KEY, "1")
      dismiss()
    }
    setPrompt(null)
  }

  if (!visible) return null
  if (!isIOS && !prompt) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 500,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          transition: "opacity 0.25s ease",
          opacity: animateIn ? 1 : 0,
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add to Home Screen"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          zIndex: 501,
          width: "min(92vw, 380px)",
          background: "#ffffff",
          borderRadius: "20px",
          padding: "32px 28px 24px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)",
          transition: "opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          opacity: animateIn ? 1 : 0,
          transform: animateIn
            ? "translate(-50%, -50%) scale(1)"
            : "translate(-50%, -50%) scale(0.93)",
        }}
      >
        {/* Close */}
        <button onClick={dismiss} aria-label="Close" style={styles.closeBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Icon */}
        <div style={styles.iconWrap}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>

        <h2 style={styles.heading}>Add to your home screen</h2>
        <p style={styles.subheading}>
          Get the full experience instantly — no download, no App Store.
        </p>

        <div style={styles.divider} />

        {/* Benefits */}
        <ul style={styles.benefitList}>
          {BENEFITS.map((b) => (
            <li key={b.label} style={styles.benefitItem}>
              <span style={styles.benefitIconWrap}>{b.icon}</span>
              <div style={styles.benefitText}>
                <span style={styles.benefitLabel}>{b.label}</span>
                <span style={styles.benefitDesc}>{b.desc}</span>
              </div>
            </li>
          ))}
        </ul>

        {/* iOS steps */}
        {isIOS && (
          <div style={styles.iosBox}>
            <p style={styles.iosIntro}>Two taps and you're done:</p>
            <div style={styles.iosRow}>
              <span style={styles.iosNum}>1</span>
              <span style={styles.iosText}>
                Tap the <strong>Share</strong> button{" "}
                <IOSShareIcon /> in Safari's toolbar
              </span>
            </div>
            <div style={styles.iosRow}>
              <span style={styles.iosNum}>2</span>
              <span style={styles.iosText}>
                Scroll and tap <strong>"Add to Home Screen"</strong> <IOSAddIcon />
              </span>
            </div>
          </div>
        )}

        {/* CTA for Chrome/Android */}
        {!isIOS && prompt && (
          <button onClick={handleInstall} style={styles.ctaBtn}>
            Add to Home Screen
          </button>
        )}

        <button onClick={dismiss} style={styles.notNowBtn}>
          Maybe later
        </button>
      </div>
    </>
  )
}

function IOSShareIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "inline", verticalAlign: "middle", margin: "0 2px" }}>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

function IOSAddIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round"
      style={{ display: "inline", verticalAlign: "middle", margin: "0 2px" }}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "#f0f0f0",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#666",
    padding: 0,
    flexShrink: 0,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    background: "#1a1814",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  heading: {
    margin: "0 0 8px",
    fontSize: "1.12rem",
    fontWeight: 700,
    color: "#111",
    lineHeight: 1.25,
    letterSpacing: "-0.01em",
  },
  subheading: {
    margin: "0 0 20px",
    fontSize: "0.83rem",
    color: "#666",
    lineHeight: 1.55,
  },
  divider: {
    height: 1,
    background: "#efefef",
    marginBottom: 20,
  },
  benefitList: {
    listStyle: "none",
    margin: "0 0 20px",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  benefitItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "#f5f5f5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: "#333",
  },
  benefitText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    paddingTop: 3,
  },
  benefitLabel: {
    fontSize: "0.87rem",
    fontWeight: 600,
    color: "#111",
  },
  benefitDesc: {
    fontSize: "0.77rem",
    color: "#777",
    lineHeight: 1.5,
  },
  iosBox: {
    background: "#f8f8f8",
    borderRadius: 12,
    padding: "14px 16px",
    marginBottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: 11,
  },
  iosIntro: {
    margin: 0,
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#555",
    marginBottom: 2,
  },
  iosRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  iosNum: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background: "#1a1814",
    color: "#fff",
    fontSize: "0.68rem",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  iosText: {
    fontSize: "0.83rem",
    color: "#333",
    lineHeight: 1.5,
  },
  ctaBtn: {
    display: "block",
    width: "100%",
    padding: "14px",
    background: "#1a1814",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: "0.9rem",
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.01em",
    marginBottom: 10,
  },
  notNowBtn: {
    display: "block",
    width: "100%",
    padding: "10px",
    background: "none",
    color: "#aaa",
    border: "none",
    fontSize: "0.82rem",
    cursor: "pointer",
    textAlign: "center",
  },
}