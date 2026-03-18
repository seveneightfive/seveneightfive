'use client'

import { useEffect } from 'react'

export default function FilloutEmbed() {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://server.fillout.com/embed/v1/'
    script.async = true
    document.body.appendChild(script)
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script)
    }
  }, [])

  return (
    <>
      <div
        data-fillout-id="fVFVYBpMXKus"
        data-fillout-embed-type="popup"
        data-fillout-popup-size="medium"
        data-fillout-inherit-parameters
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          background: '#FFCE03',
          color: '#0A0A0A',
          fontFamily: "'Oswald', sans-serif",
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          padding: '14px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          borderRadius: 0,
          display: 'block',
          width: '100%',
          userSelect: 'none',
        }}
      >
        + Add Event
      </div>
    </>
  )
}
