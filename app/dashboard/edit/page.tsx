'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { useRouter, useSearchParams } from 'next/navigation'
import ImageUpload from './ImageUpload'

const MUSICAL_GENRES = ['Rock','Pop','Jazz','Classical','Electronic','Hip-Hop','Country','Reggae','Blues','Folk','Singer-Songwriter','Spoken Word','Motown','Funk','Americana','Punk','Grunge','Jam Band','Tejano','Latin','DJ','Bluegrass','Rap']
const VISUAL_MEDIUMS = ['Photography','Digital / Print','Conceptual','Fiber Arts','Sculpture / Clay','Airbrush / Street / Mural','Painting','Jewelry','Illustration']

type PortfolioImg = {
  id?: string
  image_url: string
  caption: string
  display_order: number
  _deleted?: boolean
}

type ArtistData = {
  id: string
  name: string
  slug: string | null
  tagline: string | null
  bio: string | null
  location_city: string | null
  location_state: string | null
  birth_place: string | null
  awards: string | null
  image_url: string | null
  avatar_url: string | null
  artist_website: string | null
  social_facebook: string | null
  artist_email: string | null
  same_as: string[] | null
  artist_type: string | null
  musician_profile: {
    artist_id?: string
    artist_spotify: string | null
    artist_youtube: string | null
    audio_file_url: string | null
    audio_title: string | null
    video_url: string | null
    video_title: string | null
    artistvideoabout: string | null
    purchase_link: string | null
    musical_genres: string[] | null
  } | null
  visual_profile: {
    artist_id?: string
    visual_mediums: string[] | null
    works: string | null
  } | null
}

export default function EditPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#1a1814' }} />}>
      <EditPageInner />
    </Suspense>
  )
}

function EditPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const artistId = params.get('id')
  const [artist, setArtist] = useState<ArtistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [activeSection, setActiveSection] = useState('profile')

  // Form state
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [bio, setBio] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationState, setLocationState] = useState('')
  const [birthPlace, setBirthPlace] = useState('')
  const [awards, setAwards] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [website, setWebsite] = useState('')
  const [facebook, setFacebook] = useState('')
  const [artistEmail, setArtistEmail] = useState('')
  const [instagram, setInstagram] = useState('')
  const [soundcloud, setSoundcloud] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [appleMusic, setAppleMusic] = useState('')
  const [spotify, setSpotify] = useState('')
  const [youtube, setYoutube] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [audioTitle, setAudioTitle] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoTitle, setVideoTitle] = useState('')
  const [videoAbout, setVideoAbout] = useState('')
  const [purchaseLink, setPurchaseLink] = useState('')
  const [musicalGenres, setMusicalGenres] = useState<string[]>([])
  const [visualMediums, setVisualMediums] = useState<string[]>([])
  const [works, setWorks] = useState('')
  const [portfolioImages, setPortfolioImages] = useState<PortfolioImg[]>([])

  const loadArtist = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const query = supabase
      .from('artists')
      .select(`
        id, name, slug, tagline, bio, location_city, location_state,
        birth_place, awards, image_url, avatar_url, artist_website,
        social_facebook, artist_email, same_as, artist_type,
        artist_musician_profiles (
          artist_id, artist_spotify, artist_youtube, audio_file_url, audio_title,
          video_url, video_title, artistvideoabout, purchase_link, musical_genres
        ),
        artist_visual_profiles (artist_id, visual_mediums, works)
      `)
      .eq('auth_user_id', user.id)

    const { data } = artistId
      ? await query.eq('id', artistId).single()
      : await query.single()

    if (!data) { router.push('/dashboard'); return }

    const mp = Array.isArray(data.artist_musician_profiles)
      ? data.artist_musician_profiles[0] || null
      : (data.artist_musician_profiles as any) || null
    const vp = Array.isArray(data.artist_visual_profiles)
      ? data.artist_visual_profiles[0] || null
      : (data.artist_visual_profiles as any) || null

    const a: ArtistData = { ...data, musician_profile: mp, visual_profile: vp }
    setArtist(a)

    // Populate form
    setName(a.name || '')
    setTagline(a.tagline || '')
    setBio(a.bio || '')
    setLocationCity(a.location_city || '')
    setLocationState(a.location_state || '')
    setBirthPlace(a.birth_place || '')
    setAwards(a.awards || '')
    setImageUrl(a.image_url || '')
    setAvatarUrl(a.avatar_url || '')
    setWebsite(a.artist_website || '')
    setFacebook(a.social_facebook || '')
    setArtistEmail(a.artist_email || '')

    const sameAs = a.same_as || []
    setInstagram(sameAs.find(u => u.includes('instagram')) || '')
    setSoundcloud(sameAs.find(u => u.includes('soundcloud')) || '')
    setTiktok(sameAs.find(u => u.includes('tiktok')) || '')
    setAppleMusic(sameAs.find(u => u.includes('apple')) || '')

    setSpotify(mp?.artist_spotify || '')
    setYoutube(mp?.artist_youtube || '')
    setAudioUrl(mp?.audio_file_url || '')
    setAudioTitle(mp?.audio_title || '')
    setVideoUrl(mp?.video_url || '')
    setVideoTitle(mp?.video_title || '')
    setVideoAbout(mp?.artistvideoabout || '')
    setPurchaseLink(mp?.purchase_link || '')
    setMusicalGenres(mp?.musical_genres || [])

    setVisualMediums(vp?.visual_mediums || [])
    setWorks(vp?.works || '')

    // Load portfolio images
    const { data: pImgs } = await supabase
      .from('artist_portfolio_images')
      .select('id, image_url, caption, display_order')
      .eq('artist_id', a.id)
      .order('display_order', { ascending: true })
    setPortfolioImages((pImgs || []).map((img: { id: string; image_url: string; caption: string | null; display_order: number }) => ({ ...img, caption: img.caption || '' })))

    setLoading(false)
  }, [router])

  useEffect(() => { loadArtist() }, [loadArtist])

  // Handle hash on load
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash) setActiveSection(hash)
  }, [])

  const handleSave = async () => {
    if (!artist) return
    setSaving(true)
    setError('')

    const sameAs: string[] = [instagram, soundcloud, tiktok, appleMusic].filter(Boolean)

    const res = await fetch('/api/artist/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artistId: artist.id,
        artist: {
          name, tagline, bio,
          location_city: locationCity, location_state: locationState,
          birth_place: birthPlace, awards,
          image_url: imageUrl, avatar_url: avatarUrl,
          artist_website: website, social_facebook: facebook,
          artist_email: artistEmail, same_as: sameAs,
        },
        musician_profile: artist.artist_type === 'Musician' || artist.artist_type === 'Performance' ? {
          artist_id: artist.musician_profile?.artist_id || artist.id,
          artist_spotify: spotify, artist_youtube: youtube,
          audio_file_url: audioUrl, audio_title: audioTitle,
          video_url: videoUrl, video_title: videoTitle,
          artistvideoabout: videoAbout, purchase_link: purchaseLink,
          musical_genres: musicalGenres,
        } : null,
        visual_profile: artist.artist_type === 'Visual' ? {
          artist_id: artist.visual_profile?.artist_id || artist.id,
          visual_mediums: visualMediums, works,
        } : null,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Save failed')
      setSaving(false)
      return
    }

    await savePortfolio(artist.id)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const toggleGenre = (g: string) =>
    setMusicalGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])

  const toggleMedium = (m: string) =>
    setVisualMediums(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const savePortfolio = async (artistId: string) => {
    const supabase = createClient()
    const toDelete = portfolioImages.filter(img => img._deleted && img.id)
    const toUpsert = portfolioImages.filter(img => !img._deleted)
      .map((img, i) => ({ ...img, artist_id: artistId, display_order: i }))

    if (toDelete.length > 0) {
      await supabase.from('artist_portfolio_images').delete().in('id', toDelete.map(img => img.id!))
    }
    if (toUpsert.length > 0) {
      const inserts = toUpsert.filter(img => !img.id).map(({ id: _id, _deleted, ...rest }) => rest)
      const updates = toUpsert.filter(img => !!img.id).map(({ _deleted, ...rest }) => rest)
      if (inserts.length > 0) await supabase.from('artist_portfolio_images').insert(inserts)
      for (const u of updates) {
        await supabase.from('artist_portfolio_images').update({ image_url: u.image_url, caption: u.caption, display_order: u.display_order }).eq('id', u.id!)
      }
    }
  }

  const addPortfolioImage = (url: string) => {
    setPortfolioImages(prev => [...prev, {
      image_url: url, caption: '', display_order: prev.filter(p => !p._deleted).length
    }])
  }

  const movePortfolioImage = (index: number, dir: -1 | 1) => {
    const active = portfolioImages.filter(p => !p._deleted)
    const newIndex = index + dir
    if (newIndex < 0 || newIndex >= active.length) return
    const reordered = [...active]
    ;[reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]]
    setPortfolioImages(reordered)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1a1814', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {[0,1,2].map(i => <span key={i} style={{ width: 7, height: 7, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', animation: `pulse 1.2s ${i*0.2}s ease-in-out infinite` }} />)}
      </div>
    </div>
  )

  const sections = [
    { id: 'profile', label: 'Profile' },
    { id: 'images', label: 'Images' },
    { id: 'links', label: 'Links' },
    { id: 'media', label: 'Music/Media' },
    ...(artist?.artist_type === 'Visual' ? [{ id: 'visual', label: 'Visual' }] : []),
    { id: 'portfolio', label: 'Portfolio' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1814; --ink-soft: #6b6560; --ink-faint: #c0bab3;
          --white: #fff; --off: #f7f6f4; --border: #ece8e2;
          --accent: #C80650;
          --serif: 'Oswald', sans-serif; --sans: 'DM Sans', system-ui, sans-serif;
        }
        html, body { background: var(--ink); color: var(--white); font-family: var(--sans); -webkit-font-smoothing: antialiased; }

        .topbar { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 56px; background: rgba(26,24,20,0.95); backdrop-filter: blur(8px); border-bottom: 1px solid rgba(255,255,255,0.08); }
        .topbar-left { display: flex; align-items: center; gap: 16px; }
        .back-btn { display: flex; align-items: center; gap: 6px; font-size: 0.72rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.4); text-decoration: none; transition: color 0.15s; }
        .back-btn:hover { color: rgba(255,255,255,0.7); }
        .page-title { font-family: var(--serif); font-size: 0.9rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }

        .save-btn { padding: 8px 20px; background: var(--accent); border: none; border-radius: 100px; font-family: var(--sans); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #fff; cursor: pointer; transition: opacity 0.15s; }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .save-btn.saved { background: #2a7a4a; }

        .tab-bar { display: flex; gap: 0; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 0 24px; }
        .tab-bar::-webkit-scrollbar { display: none; }
        .tab-btn { padding: 14px 16px; font-family: var(--sans); font-size: 0.72rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
        .tab-btn.active { color: var(--white); border-bottom-color: var(--accent); }

        .content { max-width: 640px; margin: 0 auto; padding: 32px 24px 80px; }

        .field { margin-bottom: 24px; }
        .field-label { display: block; font-size: 0.62rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 8px; }
        .field-hint { font-size: 0.75rem; color: rgba(255,255,255,0.25); margin-top: 5px; }
        input[type=text], input[type=email], input[type=url], textarea, select {
          width: 100%; padding: 12px 14px; background: rgba(255,255,255,0.05);
          border: 1.5px solid rgba(255,255,255,0.1); border-radius: 8px;
          font-family: var(--sans); font-size: 0.9rem; color: #fff; outline: none;
          transition: border-color 0.15s;
        }
        input[type=text]::placeholder, input[type=email]::placeholder, input[type=url]::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
        input[type=text]:focus, input[type=email]:focus, input[type=url]:focus, textarea:focus { border-color: rgba(255,255,255,0.3); }
        textarea { resize: vertical; min-height: 120px; line-height: 1.6; }

        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        .img-preview { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 8px; display: block; margin-bottom: 10px; background: rgba(255,255,255,0.05); }
        .img-preview-avatar { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; display: block; margin-bottom: 10px; background: rgba(255,255,255,0.05); }

        .genre-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .genre-chip { padding: 6px 12px; border-radius: 100px; border: 1.5px solid rgba(255,255,255,0.12); background: transparent; font-family: var(--sans); font-size: 0.75rem; font-weight: 500; color: rgba(255,255,255,0.45); cursor: pointer; transition: all 0.15s; }
        .genre-chip.selected { background: var(--accent); border-color: var(--accent); color: #fff; }

        .section-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 28px 0; }

        .error-bar { padding: 12px 16px; background: rgba(200,6,80,0.12); border: 1px solid rgba(200,6,80,0.3); border-radius: 8px; font-size: 0.85rem; color: #ff9ab0; margin-bottom: 24px; }

        @keyframes pulse { 0%,80%,100%{opacity:0.3;transform:scale(0.85)}40%{opacity:1;transform:scale(1)} }
        @media (max-width: 480px) { .field-row { grid-template-columns: 1fr; } }
      `}</style>

      <div className="topbar">
        <div className="topbar-left">
          <a href="/dashboard" className="back-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Dashboard
          </a>
          <span className="page-title">Edit Profile</span>
        </div>
        <button
          className={`save-btn${saved ? ' saved' : ''}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      <div className="tab-bar">
        {sections.map(s => (
          <button
            key={s.id}
            className={`tab-btn${activeSection === s.id ? ' active' : ''}`}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="content">
        {error && <div className="error-bar">{error}</div>}

        {/* ── PROFILE ── */}
        {activeSection === 'profile' && (
          <>
            <div className="field">
              <label className="field-label">Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="field">
              <label className="field-label">Tagline</label>
              <input type="text" value={tagline} onChange={e => setTagline(e.target.value)} placeholder="A short phrase that describes you" />
            </div>
            <div className="field">
              <label className="field-label">Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell your story…" rows={6} />
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">City</label>
                <input type="text" value={locationCity} onChange={e => setLocationCity(e.target.value)} placeholder="Topeka" />
              </div>
              <div className="field">
                <label className="field-label">State</label>
                <input type="text" value={locationState} onChange={e => setLocationState(e.target.value)} placeholder="KS" />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Hometown / Birth Place</label>
              <input type="text" value={birthPlace} onChange={e => setBirthPlace(e.target.value)} placeholder="Where you're from" />
            </div>
            <div className="field">
              <label className="field-label">Awards & Recognition</label>
              <textarea value={awards} onChange={e => setAwards(e.target.value)} placeholder="Any awards, grants, or notable recognition" rows={3} />
            </div>
          </>
        )}

        {/* ── IMAGES ── */}
        {activeSection === 'images' && artist && (
          <>
            <div className="field">
              <label className="field-label">Hero Image</label>
              {imageUrl && <img src={imageUrl} alt="Hero" className="img-preview" />}
              <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://…" />
              <ImageUpload artistId={artist.id} field="hero" currentUrl={imageUrl} onUploaded={setImageUrl} />
              <div className="field-hint">Full-width image at the top of your profile page (recommended: landscape, at least 1200px wide)</div>
            </div>
            <div className="section-divider" />
            <div className="field">
              <label className="field-label">Avatar / Headshot</label>
              {avatarUrl && <img src={avatarUrl} alt="Avatar" className="img-preview-avatar" />}
              <input type="url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://…" />
              <ImageUpload artistId={artist.id} field="avatar" currentUrl={avatarUrl} onUploaded={setAvatarUrl} />
              <div className="field-hint">Square headshot used in listings and previews</div>
            </div>
          </>
        )}

        {/* ── LINKS ── */}
        {activeSection === 'links' && (
          <>
            <div className="field">
              <label className="field-label">Website</label>
              <input type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yourwebsite.com" />
            </div>
            <div className="field">
              <label className="field-label">Email (public contact)</label>
              <input type="email" value={artistEmail} onChange={e => setArtistEmail(e.target.value)} placeholder="contact@example.com" />
            </div>
            <div className="section-divider" />
            <div className="field">
              <label className="field-label">Instagram URL</label>
              <input type="url" value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="https://instagram.com/yourhandle" />
            </div>
            <div className="field">
              <label className="field-label">Facebook URL</label>
              <input type="url" value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="https://facebook.com/yourpage" />
            </div>
            <div className="field">
              <label className="field-label">TikTok URL</label>
              <input type="url" value={tiktok} onChange={e => setTiktok(e.target.value)} placeholder="https://tiktok.com/@yourhandle" />
            </div>
            <div className="field">
              <label className="field-label">SoundCloud URL</label>
              <input type="url" value={soundcloud} onChange={e => setSoundcloud(e.target.value)} placeholder="https://soundcloud.com/yourprofile" />
            </div>
            <div className="field">
              <label className="field-label">Apple Music URL</label>
              <input type="url" value={appleMusic} onChange={e => setAppleMusic(e.target.value)} placeholder="https://music.apple.com/…" />
            </div>
          </>
        )}

        {/* ── MUSIC / MEDIA ── */}
        {activeSection === 'media' && (
          <>
            <div className="field">
              <label className="field-label">Spotify URL</label>
              <input type="url" value={spotify} onChange={e => setSpotify(e.target.value)} placeholder="https://open.spotify.com/artist/…" />
            </div>
            <div className="field">
              <label className="field-label">YouTube Video URL</label>
              <input type="url" value={youtube} onChange={e => setYoutube(e.target.value)} placeholder="https://youtube.com/watch?v=…" />
            </div>
            <div className="field">
              <label className="field-label">Video Title</label>
              <input type="text" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} placeholder="Song or video name" />
            </div>
            <div className="field">
              <label className="field-label">Video Description</label>
              <textarea value={videoAbout} onChange={e => setVideoAbout(e.target.value)} placeholder="Brief description of the video" rows={3} />
            </div>
            <div className="section-divider" />
            <div className="field">
              <label className="field-label">Audio File URL</label>
              <input type="url" value={audioUrl} onChange={e => setAudioUrl(e.target.value)} placeholder="https://… (mp3 or wav)" />
            </div>
            <div className="field">
              <label className="field-label">Audio Title</label>
              <input type="text" value={audioTitle} onChange={e => setAudioTitle(e.target.value)} placeholder="Track name" />
            </div>
            <div className="section-divider" />
            <div className="field">
              <label className="field-label">Buy / Book Link</label>
              <input type="url" value={purchaseLink} onChange={e => setPurchaseLink(e.target.value)} placeholder="Booking page, Bandcamp, etc." />
            </div>
            <div className="section-divider" />
            <div className="field">
              <label className="field-label">Genres</label>
              <div className="genre-grid">
                {MUSICAL_GENRES.map(g => (
                  <button
                    key={g}
                    type="button"
                    className={`genre-chip${musicalGenres.includes(g) ? ' selected' : ''}`}
                    onClick={() => toggleGenre(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── VISUAL ── */}
        {activeSection === 'visual' && artist && (
          <>
            <div className="field">
              <label className="field-label">Mediums</label>
              <div className="genre-grid">
                {VISUAL_MEDIUMS.map(m => (
                  <button
                    key={m}
                    type="button"
                    className={`genre-chip${visualMediums.includes(m) ? ' selected' : ''}`}
                    onClick={() => toggleMedium(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="field-label">Portfolio / Works Image</label>
              {works && works.startsWith('http') && <img src={works} alt="Works" className="img-preview" />}
              <input type="url" value={works} onChange={e => setWorks(e.target.value)} placeholder="https://… (image URL)" />
              <ImageUpload artistId={artist.id} field="portfolio" currentUrl={works} onUploaded={setWorks} />
              <div className="field-hint">A portfolio image shown on your profile</div>
            </div>
          </>
        )}

        {/* ── PORTFOLIO ── */}
        {activeSection === 'portfolio' && artist && (() => {
          const active = portfolioImages.filter(p => !p._deleted)
          return (
            <>
              <div className="field-hint" style={{ marginBottom: 20, color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', lineHeight: 1.6 }}>
                Add images to your portfolio gallery. They appear on your public profile in the Works section. Drag to reorder using the arrows.
              </div>

              {active.length === 0 && (
                <div style={{ padding: '32px 0', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>
                  No images yet — upload one below to get started.
                </div>
              )}

              {active.map((img, i) => (
                <div key={img.id || i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, marginBottom: 10 }}>
                  <img src={img.image_url} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: 'rgba(255,255,255,0.06)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      value={img.caption}
                      onChange={e => setPortfolioImages(prev => prev.map((p, pi) => pi === portfolioImages.indexOf(img) ? { ...p, caption: e.target.value } : p))}
                      placeholder="Caption (optional)"
                      style={{ marginBottom: 0 }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                    <button type="button" onClick={() => movePortfolioImage(i, -1)} disabled={i === 0} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 4, color: 'rgba(255,255,255,0.4)', cursor: i === 0 ? 'not-allowed' : 'pointer', padding: '4px 8px', fontSize: '0.8rem' }}>↑</button>
                    <button type="button" onClick={() => movePortfolioImage(i, 1)} disabled={i === active.length - 1} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 4, color: 'rgba(255,255,255,0.4)', cursor: i === active.length - 1 ? 'not-allowed' : 'pointer', padding: '4px 8px', fontSize: '0.8rem' }}>↓</button>
                    <button type="button" onClick={() => setPortfolioImages(prev => prev.map(p => p === img ? { ...p, _deleted: true } : p))} style={{ background: 'rgba(200,6,80,0.12)', border: 'none', borderRadius: 4, color: '#ff9ab0', cursor: 'pointer', padding: '4px 8px', fontSize: '0.8rem' }}>✕</button>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 16, padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1.5px dashed rgba(255,255,255,0.1)', borderRadius: 10 }}>
                <div className="field-label" style={{ marginBottom: 10 }}>Add Image</div>
                <ImageUpload artistId={artist.id} field={`portfolio-${active.length}` as any} currentUrl="" onUploaded={addPortfolioImage} />
                <div className="field-hint" style={{ marginTop: 8 }}>Or paste a URL:</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    type="url"
                    placeholder="https://…"
                    id="portfolio-url-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('portfolio-url-input') as HTMLInputElement
                      if (input?.value.trim()) { addPortfolioImage(input.value.trim()); input.value = '' }
                    }}
                    style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </>
          )
        })()}

        <div style={{ marginTop: 32 }}>
          <button
            className={`save-btn${saved ? ' saved' : ''}`}
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%', padding: '14px', borderRadius: '8px', fontSize: '0.85rem' }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}
