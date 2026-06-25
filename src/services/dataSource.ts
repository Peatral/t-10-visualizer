import type { Article, ArticleDetail, TrendmapPayload, DataPayload } from '../types'

export async function fetchArticles(): Promise<Article[]> {
  const response = await fetch('/articles.json')
  if (!response.ok) {
    throw new Error(`Failed to load articles list: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

export async function fetchTrendmap(): Promise<TrendmapPayload> {
  const response = await fetch('/trendmap.json')
  if (!response.ok) {
    throw new Error(`Failed to load trendmap data: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

export async function fetchArticleBodies(): Promise<Record<string, string>> {
  const response = await fetch('/article-bodies.json')
  if (!response.ok) {
    throw new Error(`Failed to load article bodies: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

export function getSafeFilename(url: string): string {
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }
  const cleanUrl = url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9-]/g, '_')
    .slice(0, 50)
  return `${cleanUrl}_${Math.abs(hash)}`
}

export async function fetchArticleDetail(id: string): Promise<ArticleDetail> {
  const filename = getSafeFilename(id)
  const response = await fetch(`/articles/${filename}.json`)
  if (!response.ok) {
    throw new Error(`Failed to load article details for ${id}: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

/**
 * Backward-compatible service to retrieve the metadata and trendmap setup in parallel.
 * This completely avoids loading large bodyText properties during initial app load.
 */
export async function fetchDataPayload(): Promise<DataPayload> {
  const [articles, trendmap] = await Promise.all([
    fetchArticles(),
    fetchTrendmap()
  ])
  
  return {
    articles,
    themenwolkeWords: trendmap.themenwolkeWords,
    translations: trendmap.translations
  }
}
