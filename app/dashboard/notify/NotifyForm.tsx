"use client"

import { useState } from "react"

const SECRET_STORAGE_KEY = "push_secret_remembered"

type SendResult = { sent: number; failed: number } | { error: string }

export default function NotifyForm() {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState(
    () => (typeof window !== "undefined" && localStorage.getItem(SECRET_STORAGE_KEY)) || ""
  )
  const [rememberSecret, setRememberSecret] = useState(
    () => typeof window !== "undefined" && !!localStorage.getItem(SECRET_STORAGE_KEY)
  )
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim() || !secret.trim()) return

    setSending(true)
    setResult(null)

    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-push-secret": secret,
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          ...(url.trim() ? { url: url.trim() } : {}),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setResult({ error: data.error || `Request failed (${res.status})` })
      } else {
        setResult(data)
        setTitle("")
        setBody("")
        setUrl("")
      }

      if (rememberSecret) {
        localStorage.setItem(SECRET_STORAGE_KEY, secret)
      } else {
        localStorage.removeItem(SECRET_STORAGE_KEY)
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Network error" })
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={styles.wrap}>
      <h1 style={styles.heading}>Send a push notification</h1>
      <p style={styles.subheading}>
        Goes out immediately to every subscribed device. There's no undo — send test copies to
        yourself first if you're unsure how it'll read.
      </p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Title
          <input
            style={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New show announced!"
            maxLength={65}
            required
          />
        </label>

        <label style={styles.label}>
          Body
          <textarea
            style={styles.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tickets are live for..."
            maxLength={180}
            rows={3}
            required
          />
        </label>

        <label style={styles.label}>
          Link when tapped (optional)
          <input
            style={styles.input}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/events/some-show"
          />
        </label>

        <label style={styles.label}>
          Push secret
          <input
            style={styles.input}
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="PUSH_SECRET from Vercel"
            required
          />
        </label>

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={rememberSecret}
            onChange={(e) => setRememberSecret(e.target.checked)}
          />
          Remember secret on this device
        </label>

        <button type="submit" disabled={sending} style={styles.submitBtn}>
          {sending ? "Sending…" : "Send notification"}
        </button>
      </form>

      {result && "error" in result && (
        <p style={styles.errorMsg}>Failed to send: {result.error}</p>
      )}
      {result && "sent" in result && (
        <p style={styles.successMsg}>
          Sent to {result.sent} device{result.sent === 1 ? "" : "s"}
          {result.failed > 0 ? ` — ${result.failed} failed and were removed if expired.` : "."}
        </p>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "32px 20px",
  },
  heading: {
    fontSize: "1.4rem",
    fontWeight: 700,
    marginBottom: 6,
  },
  subheading: {
    fontSize: "0.85rem",
    color: "#666",
    marginBottom: 24,
    lineHeight: 1.5,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#333",
  },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: "0.9rem",
    fontWeight: 400,
  },
  textarea: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: "0.9rem",
    fontWeight: 400,
    resize: "vertical",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: "0.8rem",
    color: "#666",
  },
  submitBtn: {
    padding: "12px",
    borderRadius: 8,
    border: "none",
    background: "#1a1814",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.9rem",
    cursor: "pointer",
    marginTop: 8,
  },
  errorMsg: {
    marginTop: 16,
    color: "#b71c3a",
    fontSize: "0.85rem",
  },
  successMsg: {
    marginTop: 16,
    color: "#1a7a3d",
    fontSize: "0.85rem",
  },
}
