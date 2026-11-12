import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/api/', '/login', '/signup', '/auth', '/callback', '/onboarding'],
    },
    sitemap: 'https://www.seveneightfive.com/sitemap.xml',
    host: 'https://www.seveneightfive.com',
  }
}
