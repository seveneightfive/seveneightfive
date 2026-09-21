'use client'

// Shared layout: listings scroll on the left, a sticky Mapbox map sits on
// the right (full-bleed to the right edge of the window, pinned under the
// sticky BrowseHeader).
//
// On mobile (<960px) this offers a List/Map toggle. "List" shows just the
// card list, full width. "Map" makes the map full-screen and shows a compact
// bottom-sheet preview (via renderPreview) for whichever pin was last tapped.
//
// Usage:
//
//   <MapListLayout
//     items={venuesWithCoords}
//     getPopupLabel={(v) => v.name}
//     getMarkerColor={(v) => colorFor(v.neighborhood)}
//     legend={[{ label: 'NOTO', color: '#E6195E' }, ...]}
//     legendSelected={selectedNeighborhoods}
//     onLegendClick={(label) => toggleNeighborhood(label)}
//     renderCard={(venue, { isActive, setActive, cardRef, onHoverChange }) => (...)}
//     renderPreview={(venue) => (...)}
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

export type LegendEntry = { label: string; color: string }

type RenderCardOpts = {
  isActive: boolean
  setActive: () => void
  cardRef: (el: HTMLElement | null) => void
  /** Call from onMouseEnter / onMouseLeave to highlight this item's map dot. */
  onHoverChange: (hovering: boolean) => void
}

type Props<T extends MapListItem> = {
  items: T[]
  renderCard: (item: T, opts: RenderCardOpts) => React.ReactNode
  getPopupLabel?: (item: T) => string
  /** Compact card shown in the mobile bottom sheet when a marker is tapped. */
  renderPreview?: (item: T) => React.ReactNode
  /** Dot color per item (e.g. by neighborhood). Defaults to the brand accent. */
  getMarkerColor?: (item: T) => string
  /** Optional map legend (desktop only). Entries double as filter toggles. */
  legend?: LegendEntry[]
  legendSelected?: string[]
  onLegendClick?: (label: string) => void
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
  getMarkerColor,
  legend,
  legendSelected = [],
  onLegendClick,
  initialCenter = [-95.6890, 39.0473],
  initialZoom = 12,
  mapStyle = 'mapbox://styles/mapbox/dark-v11',
}: Props<T>) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({})
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')

  const geoItems = items.filter(
    (i): i is T & { latitude: number; longitude: number } =>
      i.latitude != null && i.longitude != null
  )
  const geoKey = geoItems.map(i => i.id).join(',')

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

  // Keep Mapbox sized to its container whenever the layout changes
  // (window resize, breakpoint change, sticky column resizing).
  useEffect(() => {
    const el = mapContainer.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => mapRef.current?.resize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Rebuild markers whenever the filtered item list (or map readiness) changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    geoItems.forEach(item => {
      // Outer element is positioned by Mapbox (it owns its transform), so
      // hover/active scaling happens on the inner dot instead.
      const el = document.createElement('div')
      el.className = 'map-list-marker'
      const dot = document.createElement('div')
      dot.className = 'map-list-dot'
      dot.style.background = getMarkerColor ? getMarkerColor(item) : '#C80650'
      el.appendChild(dot)
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
  }, [mapReady, geoKey])

  // Reflect hover (from a card) and active (last clicked) state on the dots.
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const el = marker.getElement()
      el.classList.toggle('is-hover', id === hoverId)
      el.classList.toggle('is-active', id === activeId)
      el.style.zIndex = id === hoverId || id === activeId ? '5' : ''
    })
  }, [hoverId, activeId, mapReady, geoKey])

  // Switching into mobile "Map" mode un-hides a display:none container.
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
          --browse-header-h: 66px; /* 64px row + 2px border (browse-header.module.css) */
          display: grid;
          /* List gets ~44% of the window (520–760px); the map takes the rest. */
          grid-template-columns: minmax(520px, min(44%, 760px)) 1fr;
          gap: 0;
          align-items: start; /* required so the map column can be sticky */
          position: relative;
        }
        .map-list-listcol {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 24px 24px 80px;
        }
        .map-list-mapcol {
          position: sticky;
          top: var(--browse-header-h);
          height: calc(100vh - var(--browse-header-h));
          height: calc(100dvh - var(--browse-header-h));
        }
        .map-list-mapcol > .map-list-canvas { width: 100%; height: 100%; }

        /* ── Dots ── */
        .map-list-marker {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .map-list-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.5);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .map-list-marker.is-hover .map-list-dot { transform: scale(1.5); }
        .map-list-marker.is-active .map-list-dot {
          transform: scale(1.6);
          box-shadow: 0 0 0 4px rgba(255,255,255,0.35), 0 1px 4px rgba(0,0,0,0.5);
        }

        /* ── Legend (desktop only) ── */
        .map-list-legend {
          position: absolute;
          left: 12px;
          bottom: 30px; /* clear of Mapbox attribution */
          z-index: 2;
          max-width: calc(100% - 24px);
          display: flex;
          flex-wrap: wrap;
          gap: 4px 6px;
          padding: 8px;
          background: rgba(26,24,20,0.88);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
        }
        .map-list-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 9px;
          border: 1px solid transparent;
          border-radius: 100px;
          background: transparent;
          color: rgba(255,255,255,0.8);
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.7rem;
          font-weight: 600;
          cursor: pointer;
        }
        .map-list-legend-item:hover { background: rgba(255,255,255,0.1); }
        .map-list-legend-item.selected { border-color: rgba(255,255,255,0.7); color: #fff; }
        .map-list-legend-swatch { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }

        /* ── Mobile List/Map toggle — hidden entirely above 960px ── */
        .map-list-toggle { display: none; }

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
          .map-list-listcol { padding: 16px 16px 96px; }
          .map-list-legend { display: none; }

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

          /* List mode: map stays mounted (no Mapbox re-init) but hidden. */
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
            onHoverChange: hovering =>
              setHoverId(prev => (hovering ? item.id : prev === item.id ? null : prev)),
          })
        )}
      </div>

      <div className="map-list-mapcol">
        <div className="map-list-canvas" ref={mapContainer} />
        {legend && legend.length > 0 && (
          <div className="map-list-legend" role="group" aria-label="Neighborhoods">
            {legend.map(entry => (
              <button
                key={entry.label}
                type="button"
                className={`map-list-legend-item${legendSelected.includes(entry.label) ? ' selected' : ''}`}
                onClick={() => onLegendClick?.(entry.label)}
                aria-pressed={legendSelected.includes(entry.label)}
              >
                <span className="map-list-legend-swatch" style={{ background: entry.color }} />
                {entry.label}
              </button>
            ))}
          </div>
        )}
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
