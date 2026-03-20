'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseBrowser'

type EntityType = 'artist' | 'venue' | 'event'

type Props = {
  entityType: EntityType
  entityId: string
  showFavorite?: boolean
  showFollow?: boolean
  heartOnly?: boolean   // NEW — renders a single circular heart that toggles follow
  className?: string
}

export default function FollowFavoriteButtons({
  entityType,
  entityId,
  showFavorite = true,
  showFollow = true,
  heartOnly = false,
  className = '',
}: Props) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [followPending, setFollowPending] = useState(false)
  const [favPending, setFavPending] = useState(false)

  // heartOnly mode only ever needs the follow state
  const needsFollow = showFollow || heartOnly
  const needsFavorite = showFavorite && !heartOnly

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return

      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const [followRes, favRes] = await Promise.all([
        needsFollow
          ? supabase
              .from('follows')
              .select('id')
              .eq('follower_id', user.id)
              .eq('entity_type', entityType)
              .eq('entity_id', entityId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        needsFavorite
          ? supabase
              .from('user_favorites')
              .select('id')
              .eq('user_id', user.id)
              .eq('entity_type', entityType)
              .eq('entity_id', entityId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      if (!mounted) return
      setIsFollowing(!!followRes.data)
      setIsFavorited(!!favRes.data)
      setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [entityType, entityId, needsFollow, needsFavorite])

  const handleFollow = async () => {
    if (!userId) { window.location.href = '/login'; return }
    setFollowPending(true)
    const supabase = createClient()

    if (isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', userId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
      setIsFollowing(false)
    } else {
      await supabase
        .from('follows')
        .insert({ follower_id: userId, entity_type: entityType, entity_id: entityId })
      setIsFollowing(true)
    }
    setFollowPending(false)
  }

  const handleFavorite = async () => {
    if (!userId) { window.location.href = '/login'; return }
    setFavPending(true)
    const supabase = createClient()

    if (isFavorited) {
      await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
      setIsFavorited(false)
    } else {
      await supabase
        .from('user_favorites')
        .insert({ user_id: userId, entity_type: entityType, entity_id: entityId })
      setIsFavorited(true)
    }
    setFavPending(false)
  }

  // ── HEART ONLY MODE ────────────────────────────────────────────────────────
  // Single circular button, sits in the hero actions row.
  // Unfollowed: ghost circle, white outline heart
  // Following:  crimson tint circle, filled crimson heart
  // Loading:    ghost circle, dimmed
  if (heartOnly) {
    return (
      <>
        <style>{HEART_ONLY_STYLES}</style>
        <button
          className={`ffb-heart-btn${isFollowing ? ' active' : ''}${loading ? ' loading' : ''} ${className}`}
          onClick={handleFollow}
          disabled={followPending || loading}
          title={isFollowing ? 'Unfollow artist' : 'Follow artist'}
          aria-label={isFollowing ? 'Unfollow artist' : 'Follow artist'}
        >
          {followPending ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="20" opacity="0.4"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          )}
        </button>
      </>
    )
  }

  // ── STANDARD MODE (unchanged behaviour) ───────────────────────────────────
  if (loading) {
    return (
      <div className={`ffb-wrap ${className}`}>
        <style>{BTN_STYLES}</style>
        {showFollow && <button className="ffb-btn ffb-skeleton" disabled>Follow</button>}
        {showFavorite && <button className="ffb-btn ffb-skeleton ffb-icon" disabled>♡</button>}
      </div>
    )
  }

  return (
    <div className={`ffb-wrap ${className}`}>
      <style>{BTN_STYLES}</style>

      {showFollow && (
        <button
          className={`ffb-btn ${isFollowing ? 'ffb-following' : 'ffb-follow'}`}
          onClick={handleFollow}
          disabled={followPending}
        >
          {followPending ? '…' : isFollowing ? '✓ Following' : '+ Follow'}
        </button>
      )}

      {showFavorite && (
        <button
          className={`ffb-btn ffb-icon ${isFavorited ? 'ffb-favorited' : 'ffb-fav'}`}
          onClick={handleFavorite}
          disabled={favPending}
          title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          {favPending ? '…' : isFavorited ? '♥' : '♡'}
        </button>
      )}
    </div>
  )
}

// ─── Heart-only button styles ─────────────────────────────────────────────────

const HEART_ONLY_STYLES = `
  .ffb-heart-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255,255,255,0.10);
    border: 1px solid rgba(255,255,255,0.22);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, border-color 0.15s, transform 0.12s;
    -webkit-tap-highlight-color: transparent;
  }
  .ffb-heart-btn svg {
    fill: none;
    stroke: rgba(255,255,255,0.85);
    transition: fill 0.15s, stroke 0.15s;
  }
  .ffb-heart-btn:hover {
    background: rgba(200,6,80,0.22);
    border-color: #C80650;
  }
  .ffb-heart-btn:hover svg {
    stroke: #C80650;
  }
  .ffb-heart-btn:active {
    transform: scale(0.88);
  }
  .ffb-heart-btn.active {
    background: rgba(200,6,80,0.25);
    border-color: #C80650;
  }
  .ffb-heart-btn.active svg {
    fill: #C80650;
    stroke: #C80650;
  }
  .ffb-heart-btn.loading {
    opacity: 0.4;
    cursor: default;
  }
  .ffb-heart-btn:disabled {
    cursor: not-allowed;
  }

  /* Satisfying pop animation when toggling */
  .ffb-heart-btn.active svg {
    animation: heartPop 0.3s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }
  @keyframes heartPop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.35); }
    70%  { transform: scale(0.9); }
    100% { transform: scale(1); }
  }
`

// ─── Standard button styles (unchanged) ──────────────────────────────────────

const BTN_STYLES = `
  .ffb-wrap { display: flex; gap: 8px; align-items: center; }
  .ffb-btn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 9px 18px; border-radius: 100px;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 0.78rem; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; cursor: pointer;
    transition: all 0.15s; border: 1.5px solid;
    white-space: nowrap;
  }
  .ffb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .ffb-btn.ffb-icon { padding: 9px 14px; font-size: 1rem; letter-spacing: 0; text-transform: none; }
  .ffb-skeleton { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); color: transparent; }

  .ffb-btn.ffb-follow {
    background: transparent;
    border-color: rgba(255,255,255,0.25);
    color: rgba(255,255,255,0.7);
  }
  .ffb-btn.ffb-follow:hover { border-color: rgba(255,255,255,0.6); color: #fff; }
  .ffb-btn.ffb-following {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.3);
    color: #fff;
  }
  .ffb-btn.ffb-fav {
    background: transparent;
    border-color: rgba(255,255,255,0.2);
    color: rgba(255,255,255,0.5);
  }
  .ffb-btn.ffb-fav:hover { border-color: #C80650; color: #C80650; }
  .ffb-btn.ffb-favorited {
    background: rgba(200,6,80,0.15);
    border-color: rgba(200,6,80,0.4);
    color: #C80650;
  }

  .ffb-light .ffb-btn.ffb-follow {
    border-color: rgba(0,0,0,0.2); color: rgba(0,0,0,0.6);
  }
  .ffb-light .ffb-btn.ffb-follow:hover { border-color: rgba(0,0,0,0.5); color: #000; }
  .ffb-light .ffb-btn.ffb-following {
    background: #FFCE03; border-color: #FFCE03; color: #0A0A0A;
  }
  .ffb-light .ffb-btn.ffb-fav { border-color: rgba(0,0,0,0.15); color: rgba(0,0,0,0.4); }
  .ffb-light .ffb-btn.ffb-fav:hover { border-color: #C80650; color: #C80650; }
  .ffb-light .ffb-btn.ffb-favorited {
    background: rgba(200,6,80,0.08); border-color: rgba(200,6,80,0.3); color: #C80650;
  }
`
