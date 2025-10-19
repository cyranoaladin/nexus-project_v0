import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const urls = [
    '/',
    '/offres',
    '/contact',
    '/bilan-gratuit',
    '/notre-centre',
    '/equipe',
  ]
  const now = new Date()
  return urls.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1.0 : 0.6,
  }))
}
