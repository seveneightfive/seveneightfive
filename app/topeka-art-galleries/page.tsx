import type { Metadata } from 'next'
import ArtGalleriesClient from './ArtGalleriesClient'

export const metadata: Metadata = {
  title: 'Topeka Art Galleries & Studios | seveneightfive',
  description: 'Discover art galleries, museums, and studios in Topeka, KS — plus upcoming exhibitions and classes.',
}

export default function TopekaArtGalleriesPage() {
  return <ArtGalleriesClient />
}
