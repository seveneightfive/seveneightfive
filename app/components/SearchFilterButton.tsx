'use client'

import styles from './browse-header.module.css'

type SearchFilterButtonProps = {
  count: number
  onClick: () => void
  variant?: 'light' | 'dark'
}

export default function SearchFilterButton({ count, onClick, variant = 'dark' }: SearchFilterButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.searchFilterBtn} ${variant === 'light' ? styles.searchFilterBtnLight : ''}`}
      onClick={onClick}
      aria-haspopup="dialog"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 6h16M7 12h10M10 18h4" />
      </svg>
      <span>Search &amp; Filter</span>
      {count > 0 && <span className={styles.searchFilterBadge}>{count}</span>}
    </button>
  )
}
