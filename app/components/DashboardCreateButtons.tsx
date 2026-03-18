'use client'

export default function DashboardCreateButtons() {
  return (
    <div className="create-grid">
      <a
        href="https://seveneightfive.fillout.com/add-event"
        target="_blank"
        rel="noopener noreferrer"
        className="create-btn yellow"
      >
        <span className="create-icon">+</span>
        <span className="create-label">Event</span>
      </a>

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
