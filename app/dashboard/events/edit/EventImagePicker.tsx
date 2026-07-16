'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import { Camera, Upload, Link as LinkIcon, X, Loader2, ImageIcon } from 'lucide-react'

type Props = {
  currentUrl: string
  userId: string
  onUploaded: (url: string) => void
  onClear: () => void
  bucket?: string
  maxSizeMB?: number
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

// HEIC files sometimes report empty MIME types on certain browsers/devices,
// so we check the filename extension as a fallback.
function isHeic(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  if (type === 'image/heic' || type === 'image/heif') return true
  const name = file.name.toLowerCase()
  return name.endsWith('.heic') || name.endsWith('.heif')
}

async function convertHeicToJpeg(file: File): Promise<File> {
  // Dynamic import — heic2any is browser-only and uses Blob APIs.
  // Keeping it out of the static bundle avoids SSR issues and trims initial JS.
  const heic2anyModule = await import('heic2any')
  const heic2any = heic2anyModule.default

  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.85,
  })

  // heic2any may return Blob or Blob[] (for multi-image HEIC containers).
  // We take the first frame in that case.
  const blob = Array.isArray(converted) ? converted[0] : converted

  const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
  return new File([blob], newName, { type: 'image/jpeg' })
}

export default function EventImagePicker({
  currentUrl,
  userId,
  onUploaded,
  onClear,
  bucket = 'event-images',
  maxSizeMB = 8,
}: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusLabel, setStatusLabel] = useState('Uploading')
  const [error, setError] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const validateAndUpload = async (rawFile: File | undefined | null) => {
    if (!rawFile) return
    setError('')

    // Validate type before any conversion work
    const looksLikeImage =
      rawFile.type.startsWith('image/') ||
      ACCEPTED_TYPES.includes(rawFile.type) ||
      isHeic(rawFile)

    if (!looksLikeImage) {
      setError('Please choose an image file (JPG, PNG, WEBP, or HEIC).')
      return
    }

    // Size check happens before conversion. HEICs are usually already smaller than
    // their JPEG output, so if it passes here it'll pass after conversion too.
    if (rawFile.size > maxSizeMB * 1024 * 1024) {
      setError(`Image is too large. Maximum is ${maxSizeMB}MB.`)
      return
    }

    setUploading(true)
    setProgress(5)

    try {
      let file = rawFile

      // Convert HEIC → JPEG so browsers can actually display the result.
      if (isHeic(rawFile)) {
        setStatusLabel('Converting')
        setProgress(20)
        try {
          file = await convertHeicToJpeg(rawFile)
        } catch (convErr: any) {
          console.error('HEIC conversion failed:', convErr)
          setError(
            'Couldn’t convert this HEIC image. Try saving it as JPEG on your phone first, or pick a different image.'
          )
          setUploading(false)
          setProgress(0)
          setStatusLabel('Uploading')
          return
        }
      }

      setStatusLabel('Uploading')
      setProgress(50)

      const supabase = createClient()
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const safeName = `${userId}/event-${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(safeName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'image/jpeg',
        })

      if (upErr) {
        setError(upErr.message || 'Upload failed. Please try again.')
        setUploading(false)
        setProgress(0)
        setStatusLabel('Uploading')
        return
      }

      setProgress(90)
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(safeName)
      onUploaded(pub.publicUrl)
      setProgress(100)
      setTimeout(() => {
        setUploading(false)
        setProgress(0)
        setStatusLabel('Uploading')
      }, 400)
    } catch (e: any) {
      setError(e?.message || 'Upload failed. Please try again.')
      setUploading(false)
      setProgress(0)
      setStatusLabel('Uploading')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    validateAndUpload(file)
  }

  const handleUrlSubmit = () => {
    const trimmed = urlDraft.trim()
    if (!trimmed) return
    try {
      const u = new URL(trimmed)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') {
        setError('URL must start with http:// or https://')
        return
      }
      onUploaded(trimmed)
      setShowUrlInput(false)
      setUrlDraft('')
      setError('')
    } catch {
      setError('That doesn’t look like a valid URL.')
    }
  }

  return (
    <div className="space-y-3">
      {/* Preview */}
      {currentUrl ? (
        <div className="relative">
          <img
            src={currentUrl}
            alt="Event"
            className="block aspect-video w-full rounded-lg bg-gray-100 object-cover dark:bg-white/[0.04]"
          />
          <button
            type="button"
            onClick={onClear}
            disabled={uploading}
            className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/85 disabled:opacity-50"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-gray-50 transition dark:bg-white/[0.02] ${
            dragOver
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
              : 'border-gray-300 dark:border-gray-700'
          }`}
        >
          <ImageIcon className="h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No image yet — choose an option below
          </p>
          <p className="hidden text-xs text-gray-600 dark:text-gray-300 sm:block">
            …or drag &amp; drop a file here
          </p>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {statusLabel}… {progress}%
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/[0.06]">
            <div
              className="h-full bg-brand-600 transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
          {error}
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => validateAndUpload(e.target.files?.[0])}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => validateAndUpload(e.target.files?.[0])}
      />

      {/* Action buttons */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.06]"
        >
          <Camera className="h-4 w-4" />
          Take Photo
        </button>

        <button
          type="button"
          onClick={() => libraryInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.06]"
        >
          <Upload className="h-4 w-4" />
          Upload File
        </button>

        <button
          type="button"
          onClick={() => setShowUrlInput((v) => !v)}
          disabled={uploading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.06]"
        >
          <LinkIcon className="h-4 w-4" />
          Paste URL
        </button>
      </div>

      {/* URL input — only shows when "Paste URL" clicked */}
      {showUrlInput && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-white/[0.02] sm:flex-row">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-white/[0.03] dark:text-white"
            onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit() }}
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Use URL
          </button>
        </div>
      )}

      <p className="text-xs text-gray-600 dark:text-gray-300">
        JPG, PNG, WEBP, or HEIC up to {maxSizeMB}MB. HEIC files from iPhones are converted automatically.
      </p>
    </div>
  )
}
