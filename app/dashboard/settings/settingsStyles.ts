// Shared CSS for all /dashboard/settings/* pages
// Matches the existing 785 dark design system exactly

export const SETTINGS_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #1a1814; --ink2: #221f1b; --ink3: #2a2721;
    --surface: rgba(255,255,255,0.04);
    --surface2: rgba(255,255,255,0.07);
    --border: rgba(255,255,255,0.08);
    --border2: rgba(255,255,255,0.14);
    --border3: rgba(255,255,255,0.22);
    --white: #fff;
    --dim: rgba(255,255,255,0.6);
    --faint: rgba(255,255,255,0.28);
    --muted: rgba(255,255,255,0.38);
    --accent: #C80650;
    --accent-bg: rgba(200,6,80,0.1);
    --accent-border: rgba(200,6,80,0.28);
    --success: #22c55e;
    --success-bg: rgba(34,197,94,0.1);
    --warn: #f59e0b;
    --serif: 'Oswald', sans-serif;
    --sans: 'DM Sans', system-ui, sans-serif;
  }
  html, body { background: var(--ink); color: var(--white); font-family: var(--sans); -webkit-font-smoothing: antialiased; }

  /* ── TOPBAR ── */
  .topbar {
    position: sticky; top: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 20px; height: 52px;
    background: rgba(26,24,20,0.95); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .topbar-left { display: flex; align-items: center; gap: 14px; }
  .back-btn {
    display: flex; align-items: center; gap: 6px;
    font-size: 0.75rem; color: var(--dim); text-decoration: none;
    font-family: var(--sans); transition: color 0.15s;
  }
  .back-btn:hover { color: var(--white); }
  .back-arrow { font-size: 1rem; line-height: 1; }
  .wordmark {
    font-family: var(--serif); font-size: 0.68rem; font-weight: 600;
    letter-spacing: 0.22em; text-transform: uppercase;
    text-decoration: none; color: rgba(255,255,255,0.35);
  }
  .wordmark em { font-style: normal; color: var(--accent); }

  /* ── PAGE LAYOUT ── */
  .page { max-width: 560px; margin: 0 auto; padding: 0 20px 80px; }

  /* ── PAGE HEADER ── */
  .page-header { padding: 28px 0 24px; border-bottom: 1px solid var(--border); margin-bottom: 28px; }
  .page-eyebrow {
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--accent); margin-bottom: 6px;
  }
  .page-title {
    font-family: var(--serif); font-size: 2rem; font-weight: 700;
    text-transform: uppercase; line-height: 0.95; letter-spacing: -0.01em;
  }
  .page-sub { margin-top: 8px; font-size: 0.82rem; font-weight: 300; color: var(--dim); line-height: 1.5; }

  /* ── SECTIONS ── */
  .settings-section { margin-bottom: 32px; }
  .section-title {
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--muted);
    padding-bottom: 10px; border-bottom: 1px solid var(--border);
    margin-bottom: 18px;
  }

  /* ── FORM FIELDS ── */
  .field { margin-bottom: 18px; }
  .field-label {
    display: block; font-size: 0.68rem; font-weight: 500;
    letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim);
    margin-bottom: 7px;
  }
  .field-input {
    width: 100%; padding: 11px 14px;
    background: var(--surface); border: 1px solid var(--border2);
    border-radius: 10px; color: var(--white); font-family: var(--sans);
    font-size: 0.9rem; font-weight: 400; outline: none;
    transition: border-color 0.15s, background 0.15s;
    -webkit-font-smoothing: antialiased;
  }
  .field-input::placeholder { color: var(--faint); }
  .field-input:focus { border-color: var(--border3); background: var(--surface2); }
  .field-input:disabled { opacity: 0.45; cursor: not-allowed; }
  .field-hint { font-size: 0.72rem; color: var(--muted); margin-top: 5px; line-height: 1.4; }
  .field-error { font-size: 0.72rem; color: var(--accent); margin-top: 5px; }
  .field-success { font-size: 0.72rem; color: var(--success); margin-top: 5px; }

  /* ── PHONE PREFIX ── */
  .phone-wrap { display: flex; align-items: stretch; gap: 0; }
  .phone-prefix {
    display: flex; align-items: center; padding: 0 12px;
    background: rgba(255,255,255,0.03); border: 1px solid var(--border2);
    border-right: none; border-radius: 10px 0 0 10px;
    font-size: 0.82rem; color: var(--dim); white-space: nowrap; gap: 6px;
  }
  .phone-wrap .field-input { border-radius: 0 10px 10px 0; }

  /* ── BUTTONS ── */
  .btn-row { display: flex; align-items: center; gap: 10px; margin-top: 4px; flex-wrap: wrap; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 10px 20px; border-radius: 9px; font-family: var(--sans);
    font-size: 0.82rem; font-weight: 500; cursor: pointer;
    border: 1px solid transparent; transition: all 0.15s; white-space: nowrap;
    text-decoration: none;
  }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-primary {
    background: var(--accent); color: var(--white); border-color: var(--accent);
  }
  .btn-primary:hover:not(:disabled) { background: #a8043f; }
  .btn-secondary {
    background: var(--surface); color: var(--dim); border-color: var(--border2);
  }
  .btn-secondary:hover:not(:disabled) { background: var(--surface2); color: var(--white); }
  .btn-ghost {
    background: transparent; color: var(--muted); border-color: var(--border);
  }
  .btn-ghost:hover:not(:disabled) { color: var(--accent); border-color: var(--accent-border); }
  .btn-danger {
    background: transparent; color: var(--accent); border-color: var(--accent-border);
  }
  .btn-danger:hover:not(:disabled) { background: var(--accent-bg); }

  /* ── TOGGLE ROWS ── */
  .toggle-group { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .toggle-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-bottom: 1px solid var(--border);
    transition: background 0.12s;
  }
  .toggle-row:last-child { border-bottom: none; }
  .toggle-row:hover { background: var(--surface); }
  .toggle-info { flex: 1; padding-right: 16px; }
  .toggle-label { font-size: 0.86rem; font-weight: 400; color: var(--white); }
  .toggle-desc { font-size: 0.72rem; color: var(--muted); margin-top: 2px; line-height: 1.4; }

  /* ── TOGGLE SWITCH ── */
  .toggle-switch { position: relative; width: 42px; height: 24px; flex-shrink: 0; }
  .toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
  .toggle-track {
    position: absolute; inset: 0; cursor: pointer;
    background: rgba(255,255,255,0.12); border-radius: 24px;
    transition: background 0.2s;
  }
  .toggle-track::after {
    content: ''; position: absolute;
    width: 18px; height: 18px; left: 3px; top: 3px;
    background: rgba(255,255,255,0.5); border-radius: 50%;
    transition: transform 0.2s, background 0.2s;
  }
  .toggle-switch input:checked + .toggle-track { background: var(--accent); }
  .toggle-switch input:checked + .toggle-track::after {
    transform: translateX(18px); background: var(--white);
  }

  /* ── AVATAR ── */
  .avatar-section { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
  .avatar-circle {
    width: 60px; height: 60px; border-radius: 50%;
    background: var(--accent); display: flex; align-items: center; justify-content: center;
    font-family: var(--serif); font-size: 1.3rem; font-weight: 700;
    color: var(--white); flex-shrink: 0; overflow: hidden;
    border: 2px solid rgba(255,255,255,0.1);
  }
  .avatar-circle img { width: 100%; height: 100%; object-fit: cover; }
  .avatar-info { flex: 1; }
  .avatar-name { font-family: var(--serif); font-size: 1.1rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .avatar-meta { font-size: 0.75rem; color: var(--muted); margin-top: 3px; }

  /* ── VERIFY STEP ── */
  .verify-card {
    background: rgba(200,6,80,0.06); border: 1px solid var(--accent-border);
    border-radius: 12px; padding: 16px 18px; margin-top: 16px;
  }
  .verify-title { font-family: var(--serif); font-size: 0.82rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
  .verify-body { font-size: 0.8rem; color: var(--dim); line-height: 1.5; margin-bottom: 14px; }

  /* ── SUCCESS BANNER ── */
  .success-banner {
    display: flex; align-items: center; gap: 10px;
    background: var(--success-bg); border: 1px solid rgba(34,197,94,0.25);
    border-radius: 10px; padding: 12px 16px; margin-bottom: 20px;
    font-size: 0.82rem; color: var(--success);
  }

  /* ── INFO BANNER ── */
  .info-banner {
    display: flex; align-items: flex-start; gap: 10px;
    background: rgba(255,206,3,0.06); border: 1px solid rgba(255,206,3,0.2);
    border-radius: 10px; padding: 12px 16px; margin-bottom: 20px;
    font-size: 0.78rem; color: rgba(255,206,3,0.85); line-height: 1.5;
  }

  /* ── DIVIDER ── */
  .divider { height: 1px; background: var(--border); margin: 24px 0; }
`
