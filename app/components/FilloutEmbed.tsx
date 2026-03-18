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
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 200,
          background: '#FFCE03',
          color: '#0A0A0A',
          fontFamily: "'Oswald', sans-serif",
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          cursor: 'pointer',
          borderRadius: 0,
          height: '15vh',
          width: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          userSelect: 'none',
        }}
      >
        + Add Event
      </div>
    </>
  )
}
