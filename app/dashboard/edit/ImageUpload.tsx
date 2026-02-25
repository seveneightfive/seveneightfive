'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabaseBrowser'

type Props = {
  artistId: string
  field: 'hero' | 'avatar' | 'portfolio'
  currentUrl: string
  onUploaded: (url: string) => void
}

export default function ImageUpload({ artistId, field, currentUrl, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const maxMb = 8
    if (file.size > maxMb * 1024 * 1024) {
      setError(`File must be under ${maxMb}MB`)
      return
    }

    setUploading(true)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `${artistId}/${field}-${Date.now()}.${ext}`

    const supabase = createClient()
    const { error: uploadError } = await supabase.storage
      .from('artist-images')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage
      .from('artist-images')
      .getPublicUrl(path)

    onUploaded(data.publicUrl)
    setUploading(false)

    // Reset file input
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div style={{ marginTop: 8 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          background: 'rgba(255,255,255,0.06)',
          border: '1.5px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: '0.75rem',
          fontWeight: 500,
          letterSpacing: '0.04em',
          color: uploading ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)',
          cursor: uploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        {uploading ? 'Uploading…' : 'Upload Image'}
      </button>
      {error && (
        <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#ff9ab0' }}>{error}</div>
      )}
      {currentUrl && !uploading && (
        <div style={{ marginTop: 4, fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)', wordBreak: 'break-all' }}>
          {currentUrl.split('/').pop()}
        </div>
      )}
    </div>
  )
}
