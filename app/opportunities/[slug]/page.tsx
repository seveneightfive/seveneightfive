import type { Metadata } from 'next'
import OpportunitiesList from './OpportunitiesList'

export const metadata: Metadata = {
  title: 'Opportunities | seveneightfive',
  description: 'Explore opportunities in Topeka, Kansas.',
}

export default function OpportunitiesPage() {
  return <OpportunitiesList />
}