'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabaseBrowser'

const MAX_PHOTOS = 5
const MAX_MB = 10

export default function PhotoUploader({
  eventPerformanceId,
  photos,
  onAdd,
  onRemove,
}: {
  eventPerformanceId: string
  photos: string[]
  onAdd: (url: string) => void
  onRemove: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Photo must be under ${MAX_MB}MB`)
      return
    }

    setUploading(true)
    setError('')

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${eventPerformanceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const supabase = createClient()
    const { error: uploadError } = await supabase.storage
      .from('performance-media')
      .upload(path, file, { upsert: false })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('performance-media').getPublicUrl(path)
    onAdd(data.publicUrl)
    setUploading(false)

    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="grid grid-cols-3 gap-3">
        {photos.map((url) => (
          <div key={url} className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Uploaded" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(url)}
              aria-label="Remove photo"
              className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}

        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 transition-colors active:scale-95 disabled:opacity-50"
          >
            {uploading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
            ) : (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-[11px] font-medium">Add photo</span>
              </>
            )}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-brand-600">{error}</p>}
    </div>
  )
}
