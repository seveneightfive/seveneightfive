'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseBrowser'

type EntityType = 'artist' | 'venue' | 'event'

type Props = {
  entityType: EntityType
  entityId: string
  showFavorite?: boolean
  showFollow?: boolean
  className?: string
}

export default function FollowFavoriteButtons({
  entityType,
  entityId,
  showFavorite = true,
  showFollow = true,
  className = '',
}: Props) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [followPending, setFollowPending] = useState(false)
  const [favPending, setFavPending] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return

      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const [followRes, favRes] = await Promise.all([
        showFollow
          ? supabase
              .from('follows')
              .select('id')
              .eq('follower_id', user.id)
              .eq('entity_type', entityType)
              .eq('entity_id', entityId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        showFavorite
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
  }, [entityType, entityId, showFollow, showFavorite])

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

  /* Dark variant (artist/venue pages have dark bg) */
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

  /* Light variant — add class ffb-light to the wrapper */
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
