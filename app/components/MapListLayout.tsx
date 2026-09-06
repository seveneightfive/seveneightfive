'use client'

// Shared layout: listings scroll on the left, a sticky Mapbox map sits on
// the right. Works for Venues, Local Flavor, and Neighborhoods — anything
// that's a filtered list of `venues` rows with latitude/longitude.
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
  /** Fallback center if no items have coordinates yet. Defaults to Topeka, KS. */
  initialCenter?: [number, number]
  initialZoom?: number
  mapStyle?: string
}

export default function MapListLayout<T extends MapListItem>({
  items,
  renderCard,
  getPopupLabel,
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

  function handleSetActive(id: string) {
    setActiveId(id)
    const item = geoItems.find(i => i.id === id)
    if (item && mapRef.current) {
      mapRef.current.flyTo({ center: [item.longitude, item.latitude], zoom: 15, duration: 600 })
      markersRef.current[id]?.togglePopup()
    }
    cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="map-list-layout">
      <style>{`
        .map-list-layout {
          display: grid;
          grid-template-columns: 1fr 480px;
          gap: 0;
          align-items: start;
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
        @media (max-width: 960px) {
          .map-list-layout { grid-template-columns: 1fr; }
          .map-list-mapcol { position: relative; height: 360px; order: -1; }
        }
      `}</style>

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
    </div>
  )
}
