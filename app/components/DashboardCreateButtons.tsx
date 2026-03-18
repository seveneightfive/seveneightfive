'use client'

import { useEffect } from 'react'

export default function DashboardCreateButtons() {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://server.fillout.com/embed/v1/'
    script.async = true
    document.body.appendChild(script)
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script)
    }
  }, [])

  return (
    <div className="create-grid">
      {/* + Event — opens Fillout popup */}
      <div
        data-fillout-id="fVFVYBpMXKus"
        data-fillout-embed-type="popup"
        data-fillout-popup-size="medium"
        data-fillout-inherit-parameters
        className="create-btn yellow"
        style={{ cursor: 'pointer' }}
      >
        <span className="create-icon">+</span>
        <span className="create-label">Event</span>
      </div>

      <a href="/dashboard/announcements/new" className="create-btn red">
        <span className="create-icon">+</span>
        <span className="create-label">Announcement</span>
      </a>

      <a
        href="https://seveneightfive.fillout.com/new-artist"
        target="_blank"
        rel="noopener noreferrer"
        className="create-btn"
      >
        <span className="create-icon">+</span>
        <span className="create-label">Artist Page</span>
      </a>

      <a
        href="https://seveneightfive.fillout.com/add-venue"
        target="_blank"
        rel="noopener noreferrer"
        className="create-btn"
      >
        <span className="create-icon">+</span>
        <span className="create-label">Venue Page</span>
      </a>
    </div>
  )
}
