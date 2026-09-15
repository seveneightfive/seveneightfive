'use client'

// Shared layout: listings scroll on the left, a sticky Mapbox map sits on
// the right. Works for Venues, Local Flavor, and Neighborhoods — anything
// that's a filtered list of `venues` rows with latitude/longitude.
//
// On mobile (<960px) this now also offers a List/Map toggle. "List" shows
// just the card list, full width. "Map" makes the map full-screen and shows
// a compact bottom-sheet preview (via renderPreview) for whichever pin was
// last tapped, instead of the old behavior of always squeezing a 360px map
// strip above the list.
//
// Usage:
//
//   <MapListLayout
//     items={venuesWithCoords}
//     getPopupLabel={(v) => v.name}
//     renderCard={(venue, { isActive, setActive, cardRef }) => (
//       <div ref={cardRef} onClick={setActive} className={isActive ? 'venue-card active' : 'venue-card'}>
//         ...your existing card markup...
//       </div>
//     )}
//     renderPreview={(venue) => (
//       <a href={`/venues/${venue.slug}`}>...compact bottom-sheet card...</a>
//     )}
//   />
//
// Requires: npm install mapbox-gl
// Requires env var: NEXT_PUBLIC_MAPBOX_TOKEN

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
}

export type MapListItem = {
  id: string
  latitude: number | null
  longitude: number | null
}

type RenderCardOpts = {
  isActive: boolean
  setActive: () => void
  cardRef: (el: HTMLElement | null) => void
}

type Props<T extends MapListItem> = {
  items: T[]
  renderCard: (item: T, opts: RenderCardOpts) => React.ReactNode
  getPopupLabel?: (item: T) => string
  /**
   * Compact card shown in the mobile bottom sheet when a marker is tapped
   * in "Map" mode. Falls back to a plain text label (via getPopupLabel) if
   * omitted, but a real preview (photo + name + link) is recommended.
   */
  renderPreview?: (item: T) => React.ReactNode
  /** Fallback center if no items have coordinates yet. Defaults to Topeka, KS. */
  initialCenter?: [number, number]
  initialZoom?: number
  mapStyle?: string
}

export default function MapListLayout<T extends MapListItem>({
  items,
  renderCard,
  getPopupLabel,
  renderPreview,
  initialCenter = [-95.6890, 39.0473],
  initialZoom = 12,
  mapStyle = 'mapbox://styles/mapbox/dark-v11',
}: Props<T>) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({})
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  // Mobile-only List/Map toggle. Meaningless above the 960px breakpoint,
  // where CSS shows both columns side by side regardless of this value.
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')

  const geoItems = items.filter(
    (i): i is T & { latitude: number; longitude: number } =>
      i.latitude != null && i.longitude != null
  )

  // Init map once.
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: initialCenter,
      zoom: initialZoom,
    })
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.on('load', () => setMapReady(true))
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rebuild markers whenever the filtered item list (or map readiness) changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    geoItems.forEach(item => {
      const el = document.createElement('div')
      el.className = 'map-list-marker'
      el.addEventListener('click', () => handleSetActive(item.id))

      const marker = new mapboxgl.Marker(el)
        .setLngLat([item.longitude, item.latitude])
        .addTo(map)

      if (getPopupLabel) {
        marker.setPopup(
          new mapboxgl.Popup({ offset: 16, closeButton: false }).setText(getPopupLabel(item))
        )
      }

      markersRef.current[item.id] = marker
    })

    if (geoItems.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      geoItems.forEach(i => bounds.extend([i.longitude, i.latitude]))
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, geoItems.map(i => i.id).join(',')])

  // Mapbox needs an explicit resize() any time its container's size changes
  // outside its own control. Switching into mobile "Map" mode un-hides a
  // container that was previously display:none, which Mapbox has no way to
  // detect on its own — without this the map renders at its last-known
  // (usually zero) size until the window happens to resize.
  useEffect(() => {
    if (mobileView !== 'map') return
    const id = requestAnimationFrame(() => mapRef.current?.resize())
    return () => cancelAnimationFrame(id)
  }, [mobileView])

  function handleSetActive(id: string) {
    setActiveId(id)
    const item = geoItems.find(i => i.id === id)
    if (item && mapRef.current) {
      mapRef.current.flyTo({ center: [item.longitude, item.latitude], zoom: 15, duration: 600 })
      markersRef.current[id]?.togglePopup()
    }
    cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const activeItem = activeId ? items.find(i => i.id === activeId) ?? null : null

  return (
    <div className="map-list-layout" data-mobile-view={mobileView}>
      <style>{`
        .map-list-layout {
          display: grid;
          grid-template-columns: 1fr 480px;
          gap: 0;
          align-items: start;
          position: relative;
        }
        .map-list-listcol { min-width: 0; }
        .map-list-mapcol { position: sticky; top: 0; height: 100vh; }
        .map-list-mapcol > div { width: 100%; height: 100%; }
        .map-list-marker {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent, #C80650);
          border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
          cursor: pointer;
        }

        /* ── Mobile List/Map toggle — hidden entirely above 960px ── */
        .map-list-toggle {
          display: none;
        }

        /* ── Mobile bottom-sheet preview (Map mode only) ── */
        .map-list-sheet {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          z-index: 25;
          background: #fff;
          border-radius: 20px 20px 0 0;
          box-shadow: 0 -8px 24px rgba(0,0,0,0.25);
          padding: 14px 16px calc(14px + env(safe-area-inset-bottom, 0px));
        }
        .map-list-sheet-handle {
          width: 36px; height: 4px; background: #ece8e2; border-radius: 2px;
          margin: 0 auto 12px;
        }

        @media (max-width: 960px) {
          .map-list-layout { grid-template-columns: 1fr; }

          .map-list-toggle {
            display: flex;
            position: fixed;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 30;
            background: rgba(26,24,20,0.9);
            backdrop-filter: blur(6px);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 100px;
            padding: 3px;
            gap: 2px;
          }
          .map-list-toggle-btn {
            border: none;
            background: transparent;
            padding: 7px 18px;
            border-radius: 100px;
            font-family: 'Oswald', sans-serif;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.65);
            cursor: pointer;
          }
          .map-list-toggle-btn.active {
            background: #FFCE03;
            color: #1a1814;
          }

          /* Default (list mode): map column stays mounted (so Mapbox
             doesn't re-init on every toggle flip) but hidden. */
          .map-list-mapcol { display: none; }

          .map-list-layout[data-mobile-view="map"] .map-list-listcol { display: none; }
          .map-list-layout[data-mobile-view="map"] .map-list-mapcol {
            display: block;
            position: fixed;
            inset: 0;
            height: 100dvh;
            z-index: 15;
          }
        }
      `}</style>

      <div className="map-list-toggle">
        <button
          type="button"
          className={`map-list-toggle-btn${mobileView === 'list' ? ' active' : ''}`}
          onClick={() => setMobileView('list')}
        >
          List
        </button>
        <button
          type="button"
          className={`map-list-toggle-btn${mobileView === 'map' ? ' active' : ''}`}
          onClick={() => setMobileView('map')}
        >
          Map
        </button>
      </div>

      <div className="map-list-listcol">
        {items.map(item =>
          renderCard(item, {
            isActive: activeId === item.id,
            setActive: () => handleSetActive(item.id),
            cardRef: el => {
              cardRefs.current[item.id] = el
            },
          })
        )}
      </div>

      <div className="map-list-mapcol">
        <div ref={mapContainer} />
      </div>

      {mobileView === 'map' && activeItem && (
        <div className="map-list-sheet">
          <div className="map-list-sheet-handle" />
          {renderPreview
            ? renderPreview(activeItem)
            : <div style={{ fontSize: '0.85rem', color: '#1a1814' }}>{getPopupLabel?.(activeItem) ?? 'Selected location'}</div>
          }
        </div>
      )}
    </div>
  )
}
