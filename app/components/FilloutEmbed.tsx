'use client'

import { useEffect } from 'react'

export default function FilloutEmbed() {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://server.fillout.com/embed/v1/'
    script.async = true
    document.body.appendChild(script)
    return () => {
      document.body.removeChild(script)
    }
  }, [])

  return (
    <div
      data-fillout-id="fVFVYBpMXKus"
      data-fillout-embed-type="slider"
      data-fillout-button-text="Add Event"
      data-fillout-button-color="#FFCD03"
      data-fillout-slider-direction="left"
      data-fillout-inherit-parameters
      data-fillout-popup-size="medium"
    />
  )
}
