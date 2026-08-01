// Shared styles for the /network/* pages (check-in, connect, live, map).
// Mirrors the design tokens used in app/save-the-date/new/page.tsx so this
// feature feels native to the rest of seveneightfive.com.

export const NETWORK_BASE_STYLES = `
  :root {
    --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #8a847d;
    --white: #ffffff; --off: #f7f6f4; --warm: #f2ede6;
    --accent: #c80650; --accent-light: #fdf1ec; --border: #ece8e2;
    --gold: #FFCE03;
    --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
  }
  html, body { background: var(--white) !important; }

  .net-page {
    font-family: var(--sans);
    max-width: 900px;
    margin: 0 auto;
    padding: 32px 24px 80px;
    color: var(--ink);
    -webkit-font-smoothing: antialiased;
  }
  .net-topbar {
    width: 100%;
    border-bottom: 1px solid var(--border);
    background: #fff;
  }
  .net-topbar-inner {
    max-width: 900px;
    margin: 0 auto;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .net-back {
    font-family: var(--serif); font-size: 0.72rem; font-weight: 600;
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-faint);
    text-decoration: none; transition: color 0.15s;
  }
  .net-back:hover { color: var(--ink); }
  .net-page-label {
    font-family: var(--serif); font-size: 0.72rem; font-weight: 600;
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-faint);
  }
  .net-header { margin-bottom: 28px; }
  .net-header h1 {
    font-family: var(--serif); font-size: 2rem; font-weight: 700;
    letter-spacing: 0.01em; text-transform: uppercase; margin-bottom: 8px;
    line-height: 1.05; color: var(--ink);
  }
  .net-header p { font-size: 0.95rem; color: var(--ink-soft); line-height: 1.55; max-width: 560px; }

  .btn-primary {
    background: var(--accent); color: #fff; border: none; padding: 11px 20px;
    font-family: var(--serif); font-size: 0.8rem; font-weight: 700;
    letter-spacing: 0.04em; text-transform: uppercase; border-radius: 8px;
    cursor: pointer; white-space: nowrap; transition: opacity 0.15s;
  }
  .btn-primary:hover { opacity: 0.85; }
  .btn-primary:disabled { opacity: 0.4; cursor: default; }
  .btn-ghost {
    background: transparent; color: var(--ink); border: 1.5px solid var(--border);
    padding: 9px 16px; font-size: 14px; font-weight: 500; border-radius: 8px;
    cursor: pointer; transition: border-color 0.15s;
  }
  .btn-ghost:hover { border-color: var(--ink-faint); }
  .btn-outline {
    background: #fff; color: var(--ink); border: 1.5px solid var(--border);
    padding: 8px 14px; font-size: 13px; font-weight: 600; border-radius: 7px;
    cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
    transition: border-color 0.15s, background 0.15s;
  }
  .btn-outline:hover { border-color: var(--ink-faint); background: var(--off); }

  .chip {
    font-size: 0.66rem; font-weight: 700; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--accent); background: var(--accent-light);
    border-radius: 100px; padding: 3px 10px; display: inline-block;
  }
  .chip-neutral { color: var(--ink-soft); background: var(--off); }

  .form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
  .form-group label { font-size: 13px; font-weight: 600; color: var(--ink); }
  .form-group input, .form-group select, .form-group textarea {
    border: 1.5px solid var(--border); border-radius: 7px; padding: 9px 12px;
    font-size: 14px; font-family: inherit; color: var(--ink); outline: none;
    transition: border-color 0.15s; background: #fff;
  }
  .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--ink); }

  .checkbox-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  @media (max-width: 560px) { .checkbox-grid { grid-template-columns: 1fr; } }
  .checkbox-tile {
    display: flex; align-items: center; gap: 8px; border: 1.5px solid var(--border);
    border-radius: 8px; padding: 10px 12px; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: border-color 0.15s, background 0.15s;
  }
  .checkbox-tile.checked { border-color: var(--accent); background: var(--accent-light); }
  .checkbox-tile input { width: 16px; height: 16px; cursor: pointer; }

  .card {
    border: 1.5px solid var(--border); border-radius: 12px; padding: 16px;
    margin-bottom: 12px;
  }
  .empty-state { padding: 48px 24px; text-align: center; color: var(--ink-faint); font-size: 15px; }
  .loading-state { padding: 40px 24px; text-align: center; color: var(--ink-faint); font-size: 14px; font-weight: 500; }

  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(26,24,20,0.5); z-index: 1000;
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .modal {
    background: #fff; border-radius: 14px; width: 100%; max-width: 480px;
    max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,0.18);
  }
  .modal-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 24px 24px 0; gap: 12px;
  }
  .modal-header h2 {
    font-family: var(--serif); font-size: 1.2rem; font-weight: 700;
    text-transform: uppercase; color: var(--ink);
  }
  .close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--ink-faint); padding: 0; }
  .close-btn:hover { color: var(--ink); }
  .modal-body { padding: 16px 24px 24px; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }

  .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); gap: 12px; margin-bottom: 28px; }
  .stat-card { border: 1.5px solid var(--border); border-radius: 12px; padding: 16px; text-align: center; }
  .stat-card .num { font-family: var(--serif); font-size: 2rem; font-weight: 700; color: var(--ink); line-height: 1; }
  .stat-card .label { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-faint); margin-top: 6px; }

  .form-error {
    color: var(--accent); font-size: 13px; font-weight: 500; margin-top: 10px;
    padding: 10px 12px; background: var(--accent-light); border-radius: 6px;
  }
`
