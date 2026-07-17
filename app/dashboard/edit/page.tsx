'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { useRouter, useSearchParams } from 'next/navigation'
import ImageUpload from './ImageUpload'
import AppearancesTab from './AppearancesTab'
import { Check, ArrowUp, ArrowDown, X, Image as ImageIcon, ArrowUpRight } from 'lucide-react'

const MUSICAL_GENRES = [
  'Rock','Pop','Jazz','Classical','Electronic','Hip-Hop','Country','Reggae',
  'Blues','Folk','Singer-Songwriter','Spoken Word','Motown','Funk','Americana',
  'Punk','Grunge','Jam Band','Tejano','Latin','DJ','Bluegrass','Rap',
]
const VISUAL_MEDIUMS = [
  'Photography','Digital / Print','Conceptual','Fiber Arts','Sculpture / Clay',
  'Airbrush / Street / Mural','Painting','Jewelry','Illustration',
]

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
  social_instagram: string | null
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
    <Suspense fallback={<LoadingState />}>
      <EditPageInner />
    </Suspense>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-pulse rounded-full bg-gray-300 dark:bg-gray-700"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
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

  // ── Form state ────────────────────────────────────────────────────────────
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

  // ── Load artist ───────────────────────────────────────────────────────────
  const loadArtist = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const query = supabase
      .from('artists')
      .select(`
        id, name, slug, tagline, bio, location_city, location_state,
        birth_place, awards, image_url, avatar_url, artist_website,
        social_facebook, social_instagram, artist_email, same_as, artist_type,
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

    if (!data) {
      router.push('/dashboard')
      return
    }

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
    setInstagram(a.social_instagram || '')
    setArtistEmail(a.artist_email || '')

    const sameAs = a.same_as || []
    setSoundcloud(sameAs.find((u) => u.includes('soundcloud')) || '')
    setTiktok(sameAs.find((u) => u.includes('tiktok')) || '')
    setAppleMusic(sameAs.find((u) => u.includes('apple')) || '')

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
    setPortfolioImages(
      (pImgs || []).map(
        (img: {
          id: string
          image_url: string
          caption: string | null
          display_order: number
        }) => ({ ...img, caption: img.caption || '' })
      )
    )

    setLoading(false)
  }, [router, artistId])

  useEffect(() => {
    loadArtist()
  }, [loadArtist])

  // Hash navigation: lets you deep-link to /dashboard/edit#links etc.
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash) setActiveSection(hash)
  }, [])

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!artist) return
    setSaving(true)
    setError('')

    const sameAs: string[] = [soundcloud, tiktok, appleMusic].filter(Boolean)

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
          social_instagram: instagram,
          artist_email: artistEmail, same_as: sameAs,
        },
        musician_profile:
          artist.artist_type === 'Musician' || artist.artist_type === 'Performance'
            ? {
                artist_id: artist.musician_profile?.artist_id || artist.id,
                artist_spotify: spotify,
                artist_youtube: youtube,
                audio_file_url: audioUrl,
                audio_title: audioTitle,
                video_url: videoUrl,
                video_title: videoTitle,
                artistvideoabout: videoAbout,
                purchase_link: purchaseLink,
                musical_genres: musicalGenres,
              }
            : null,
        visual_profile:
          artist.artist_type === 'Visual'
            ? {
                artist_id: artist.visual_profile?.artist_id || artist.id,
                visual_mediums: visualMediums,
                works,
              }
            : null,
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
    setMusicalGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    )

  const toggleMedium = (m: string) =>
    setVisualMediums((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    )

  const savePortfolio = async (artistId: string) => {
    const supabase = createClient()
    const toDelete = portfolioImages.filter((img) => img._deleted && img.id)
    const toUpsert = portfolioImages
      .filter((img) => !img._deleted)
      .map((img, i) => ({ ...img, artist_id: artistId, display_order: i }))

    if (toDelete.length > 0) {
      await supabase
        .from('artist_portfolio_images')
        .delete()
        .in('id', toDelete.map((img) => img.id!))
    }
    if (toUpsert.length > 0) {
      const inserts = toUpsert
        .filter((img) => !img.id)
        .map(({ id: _id, _deleted, ...rest }) => rest)
      const updates = toUpsert
        .filter((img) => !!img.id)
        .map(({ _deleted, ...rest }) => rest)
      if (inserts.length > 0)
        await supabase.from('artist_portfolio_images').insert(inserts)
      for (const u of updates) {
        await supabase
          .from('artist_portfolio_images')
          .update({
            image_url: u.image_url,
            caption: u.caption,
            display_order: u.display_order,
          })
          .eq('id', u.id!)
      }
    }
  }

  const addPortfolioImage = (url: string) => {
    setPortfolioImages((prev) => [
      ...prev,
      {
        image_url: url,
        caption: '',
        display_order: prev.filter((p) => !p._deleted).length,
      },
    ])
  }

  // Reorder by swapping a row up or down WITHIN the active (non-deleted) list.
  // We map back to the full list (including deleted rows) so display_order is
  // correctly persisted on save.
  const movePortfolioImage = (activeIndex: number, dir: -1 | 1) => {
    const active = portfolioImages.filter((p) => !p._deleted)
    const newIndex = activeIndex + dir
    if (newIndex < 0 || newIndex >= active.length) return
    const reorderedActive = [...active]
    ;[reorderedActive[activeIndex], reorderedActive[newIndex]] = [
      reorderedActive[newIndex],
      reorderedActive[activeIndex],
    ]
    const deleted = portfolioImages.filter((p) => p._deleted)
    setPortfolioImages([...reorderedActive, ...deleted])
  }

  if (loading) return <LoadingState />

  const sections = [
    { id: 'profile', label: 'Profile' },
    { id: 'images', label: 'Images' },
    { id: 'links', label: 'Links' },
    { id: 'media', label: 'Music / Media' },
    ...(artist?.artist_type === 'Visual' ? [{ id: 'visual', label: 'Visual' }] : []),
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'appearances', label: 'Appearances' },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // The dashboard shell provides the top header. This page adds:
  //   1. A page-title block with Save button (sticky, sits below AppHeader)
  //   2. A tab bar to switch form sections
  //   3. The active form section
  //   4. A duplicate save button at the bottom for long-form convenience
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Page header + sticky save bar */}
      <div className="sticky top-[72px] z-30 -mx-4 flex items-center justify-between gap-4 border-b border-gray-300 bg-surface-light/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6 dark:border-gray-700 dark:bg-surface-dark/95">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
            Creator
          </p>
          <h1 className="font-display text-2xl font-bold leading-none text-gray-900 dark:text-white">
            Edit Profile
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {artist?.slug && (
            <a
              href={`/artists/${artist.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-white/[0.08]"
            >
              View
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
          <SaveButton saving={saving} saved={saved} onClick={handleSave} />
        </div>
      </div>
        <div className="flex shrink-0 items-center gap-2">
+          {artist?.slug && (
+            
+              href={`/artists/${artist.slug}`}
+              target="_blank"
+              rel="noopener noreferrer"
+              className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-white/[0.08]"
+            >
+              View
+              <ArrowUpRight className="h-3.5 w-3.5" />
+            </a>
+          )}
+          <SaveButton saving={saving} saved={saved} onClick={handleSave} />
+        </div>
      </div>

      {/* Tab bar */}
      <div className="-mx-4 overflow-x-auto border-b border-gray-200 px-4 md:-mx-6 md:px-6 dark:border-gray-800">
        <nav
          className="flex min-w-max gap-1"
          role="tablist"
          aria-label="Edit profile sections"
        >
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={activeSection === s.id}
              onClick={() => setActiveSection(s.id)}
              className={`relative whitespace-nowrap rounded-t-lg border-b-2 px-3 py-3 text-xs font-semibold uppercase tracking-[0.1em] transition ${
                activeSection === s.id
                  ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-400'
                : 'border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.05] dark:hover:text-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Error bar */}
      {error && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
          {error}
        </div>
      )}

      {/* ── PROFILE ── */}
      {activeSection === 'profile' && (
        <Card>
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className={inputCls}
            />
          </Field>
          <Field label="Tagline">
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="A short phrase that describes you"
              className={inputCls}
            />
          </Field>
          <Field label="Bio">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your story…"
              rows={6}
              className={`${inputCls} resize-y min-h-[120px] leading-relaxed`}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="City">
              <input
                type="text"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="Topeka"
                className={inputCls}
              />
            </Field>
            <Field label="State">
              <input
                type="text"
                value={locationState}
                onChange={(e) => setLocationState(e.target.value)}
                placeholder="KS"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Hometown / Birth Place">
            <input
              type="text"
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
              placeholder="Where you're from"
              className={inputCls}
            />
          </Field>
          <Field label="Awards & Recognition">
            <textarea
              value={awards}
              onChange={(e) => setAwards(e.target.value)}
              placeholder="Any awards, grants, or notable recognition"
              rows={3}
              className={`${inputCls} resize-y leading-relaxed`}
            />
          </Field>
        </Card>
      )}

      {/* ── IMAGES ── */}
      {activeSection === 'images' && artist && (
        <Card>
          <Field
            label="Hero Image"
            hint="Full-width image at the top of your profile page (recommended: landscape, at least 1200px wide)"
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Hero"
                className="mb-2 block aspect-video w-full rounded-lg bg-gray-100 object-cover dark:bg-white/[0.04]"
              />
            ) : (
              <ImagePlaceholder ratio="aspect-video" />
            )}
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
            <div className="mt-2">
              <ImageUpload
                artistId={artist.id}
                field="hero"
                currentUrl={imageUrl}
                onUploaded={setImageUrl}
              />
            </div>
          </Field>
          <Divider />
          <Field label="Avatar / Headshot" hint="Square headshot used in listings and previews">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Avatar"
                className="mb-2 block h-20 w-20 rounded-full bg-gray-100 object-cover dark:bg-white/[0.04]"
              />
            ) : (
              <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/[0.04] dark:text-gray-600">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
            <div className="mt-2">
              <ImageUpload
                artistId={artist.id}
                field="avatar"
                currentUrl={avatarUrl}
                onUploaded={setAvatarUrl}
              />
            </div>
          </Field>
        </Card>
      )}

      {/* ── LINKS ── */}
      {activeSection === 'links' && (
        <Card>
          <Field label="Website">
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourwebsite.com"
              className={inputCls}
            />
          </Field>
          <Field label="Email (public contact)">
            <input
              type="email"
              value={artistEmail}
              onChange={(e) => setArtistEmail(e.target.value)}
              placeholder="contact@example.com"
              className={inputCls}
            />
          </Field>
          <Divider />
          <Field label="Instagram URL">
            <input
              type="url"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="https://instagram.com/yourhandle"
              className={inputCls}
            />
          </Field>
          <Field label="Facebook URL">
            <input
              type="url"
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="https://facebook.com/yourpage"
              className={inputCls}
            />
          </Field>
          <Field label="TikTok URL">
            <input
              type="url"
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              placeholder="https://tiktok.com/@yourhandle"
              className={inputCls}
            />
          </Field>
          <Field label="SoundCloud URL">
            <input
              type="url"
              value={soundcloud}
              onChange={(e) => setSoundcloud(e.target.value)}
              placeholder="https://soundcloud.com/yourprofile"
              className={inputCls}
            />
          </Field>
          <Field label="Apple Music URL">
            <input
              type="url"
              value={appleMusic}
              onChange={(e) => setAppleMusic(e.target.value)}
              placeholder="https://music.apple.com/…"
              className={inputCls}
            />
          </Field>
        </Card>
      )}

      {/* ── MUSIC / MEDIA ── */}
      {activeSection === 'media' && (
        <Card>
          <Field label="Spotify URL">
            <input
              type="url"
              value={spotify}
              onChange={(e) => setSpotify(e.target.value)}
              placeholder="https://open.spotify.com/artist/…"
              className={inputCls}
            />
          </Field>
          <Field label="YouTube Video URL">
            <input
              type="url"
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              className={inputCls}
            />
          </Field>
          <Field label="Video Title">
            <input
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Song or video name"
              className={inputCls}
            />
          </Field>
          <Field label="Video Description">
            <textarea
              value={videoAbout}
              onChange={(e) => setVideoAbout(e.target.value)}
              placeholder="Brief description of the video"
              rows={3}
              className={`${inputCls} resize-y leading-relaxed`}
            />
          </Field>
          <Divider />
          <Field label="Audio File URL">
            <input
              type="url"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://… (mp3 or wav)"
              className={inputCls}
            />
          </Field>
          <Field label="Audio Title">
            <input
              type="text"
              value={audioTitle}
              onChange={(e) => setAudioTitle(e.target.value)}
              placeholder="Track name"
              className={inputCls}
            />
          </Field>
          <Divider />
          <Field label="Buy / Book Link">
            <input
              type="url"
              value={purchaseLink}
              onChange={(e) => setPurchaseLink(e.target.value)}
              placeholder="Booking page, Bandcamp, etc."
              className={inputCls}
            />
          </Field>
          <Divider />
          <Field label="Genres">
            <ChipGroup
              options={MUSICAL_GENRES}
              selected={musicalGenres}
              onToggle={toggleGenre}
            />
          </Field>
        </Card>
      )}

      {/* ── VISUAL ── */}
      {activeSection === 'visual' && artist && (
        <Card>
          <Field label="Mediums">
            <ChipGroup
              options={VISUAL_MEDIUMS}
              selected={visualMediums}
              onToggle={toggleMedium}
            />
          </Field>
          <Field label="Portfolio / Works Image" hint="A portfolio image shown on your profile">
            {works && works.startsWith('http') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={works}
                alt="Works"
                className="mb-2 block aspect-video w-full rounded-lg bg-gray-100 object-cover dark:bg-white/[0.04]"
              />
            ) : (
              <ImagePlaceholder ratio="aspect-video" />
            )}
            <input
              type="url"
              value={works}
              onChange={(e) => setWorks(e.target.value)}
              placeholder="https://… (image URL)"
              className={inputCls}
            />
            <div className="mt-2">
              <ImageUpload
                artistId={artist.id}
                field="portfolio"
                currentUrl={works}
                onUploaded={setWorks}
              />
            </div>
          </Field>
        </Card>
      )}

      {/* ── PORTFOLIO ── */}
      {activeSection === 'portfolio' && artist && (() => {
        // Build the "active" view (filtering out deleted rows). We also keep
        // a parallel map from active index → original index so caption edits
        // update the right row of `portfolioImages` even after reordering.
        const activeRows = portfolioImages
          .map((img, originalIdx) => ({ img, originalIdx }))
          .filter(({ img }) => !img._deleted)

        return (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Add images to your portfolio gallery. They appear on your public
              profile in the Works section. Use the arrows to reorder.
            </p>

            {activeRows.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center dark:border-gray-700 dark:bg-white/[0.02]">
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  No images yet — upload one below to get started.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {activeRows.map(({ img, originalIdx }, activeIdx) => (
                <div
                  key={img.id || originalIdx}
                  className="flex items-start gap-3 rounded-xl border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-white/[0.03]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.image_url}
                    alt=""
                    className="h-16 w-20 shrink-0 rounded-md bg-gray-100 object-cover dark:bg-white/[0.04]"
                  />
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={img.caption}
                      onChange={(e) =>
                        // Use originalIdx — survives reordering.
                        setPortfolioImages((prev) =>
                          prev.map((p, idx) =>
                            idx === originalIdx ? { ...p, caption: e.target.value } : p
                          )
                        )
                      }
                      placeholder="Caption (optional)"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <IconBtn
                      onClick={() => movePortfolioImage(activeIdx, -1)}
                      disabled={activeIdx === 0}
                      ariaLabel="Move up"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </IconBtn>
                    <IconBtn
                      onClick={() => movePortfolioImage(activeIdx, 1)}
                      disabled={activeIdx === activeRows.length - 1}
                      ariaLabel="Move down"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </IconBtn>
                    <IconBtn
                      onClick={() =>
                        setPortfolioImages((prev) =>
                          prev.map((p, idx) =>
                            idx === originalIdx ? { ...p, _deleted: true } : p
                          )
                        )
                      }
                      ariaLabel="Remove image"
                      tone="danger"
                    >
                      <X className="h-3 w-3" />
                    </IconBtn>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-white/[0.02]">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-600 dark:text-gray-300">
                Add Image
              </p>
              <ImageUpload
                artistId={artist.id}
                field={`portfolio-${activeRows.length}` as any}
                currentUrl=""
                onUploaded={addPortfolioImage}
              />
              <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                Or paste a URL:
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  type="url"
                  placeholder="https://…"
                  id="portfolio-url-input"
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById(
                      'portfolio-url-input'
                    ) as HTMLInputElement
                    if (input?.value.trim()) {
                      addPortfolioImage(input.value.trim())
                      input.value = ''
                    }
                  }}
                  className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08]"
                >
                  Add
                </button>
              </div>
            </div>
          </>
        )
      })()}

      {/* Bottom save (full-width for long forms) */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className={`w-full rounded-lg px-4 py-3.5 font-display text-sm font-semibold uppercase tracking-wider text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
          saved ? 'bg-success-600 hover:bg-success-700' : 'bg-brand-600 hover:bg-brand-700'
        }`}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
      </button>
    </div>
  )
}

// ─── Bits ────────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-500 placeholder:text-gray-400 dark:placeholder:text-gray-500'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5 rounded-2xl border border-gray-300 bg-white p-5 shadow-theme-xs dark:border-gray-700 dark:bg-white/[0.03]">
      {children}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-gray-700 dark:text-gray-200">
         {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">{hint}</p>
      )}
    </div>
  )
}

function Divider() {
  return <hr className="border-t border-gray-100 dark:border-gray-800" />
}

function ImagePlaceholder({ ratio }: { ratio: string }) {
  return (
    <div
      className={`mb-2 flex w-full items-center justify-center rounded-lg bg-gray-100 text-gray-400 ${ratio} dark:bg-white/[0.04] dark:text-gray-600`}
    >
      <ImageIcon className="h-6 w-6" />
    </div>
  )
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isOn = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              isOn
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:border-gray-600'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function IconBtn({
  onClick,
  disabled,
  ariaLabel,
  tone = 'neutral',
  children,
}: {
  onClick: () => void
  disabled?: boolean
  ariaLabel: string
  tone?: 'neutral' | 'danger'
  children: React.ReactNode
}) {
  const cls =
    tone === 'danger'
      ? 'bg-brand-50 text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400 dark:hover:bg-brand-500/25'
      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-400 dark:hover:bg-white/[0.1] disabled:opacity-40 disabled:hover:bg-gray-100 dark:disabled:hover:bg-white/[0.06]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`flex h-6 w-6 items-center justify-center rounded-md transition disabled:cursor-not-allowed ${cls}`}
    >
      {children}
    </button>
  )
}

function SaveButton({
  saving,
  saved,
  onClick,
}: {
  saving: boolean
  saved: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 font-display text-xs font-semibold uppercase tracking-wider text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
        saved ? 'bg-success-600 hover:bg-success-700' : 'bg-brand-600 hover:bg-brand-700'
      }`}
    >
      {saved && <Check className="h-3.5 w-3.5" />}
      {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
    </button>
  )
}
