import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { db } from './db/index.js'
import { articles, trendmapCache, topics, articleTopicMatches } from './db/schema.js'
import { eq, desc, asc, and, sql } from 'drizzle-orm'
import { calculateTrendmapGrid } from '../utils/trendmapCalc.js'

const t = initTRPC.create()

function formatFtsQuery(q: string): string {
  return q
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => `${word.replace(/[*"']/g, '')}*`)
    .join(' AND ')
}

export interface ArticleMetadata {
  id: string
  title: string
  description: string
  date: string
  link: string
  category: string
}

export interface TrendmapCalculationResult {
  labelToDisplay: Record<string, string>
  topicKeywords: Record<string, string[]>
  categoryArticles: Array<ArticleMetadata & { bucket: string; sortVal: number }>
  croppedTimeScale: Array<{ bucket: string; sortVal: number; isGap?: boolean; gapStart?: string; gapEnd?: string; spanCount?: number }>
  topDisplayKeys: string[]
  grid: Record<string, Record<string, number>>
  cellMatches: Record<string, Record<string, string[]>>
  maxCellCount: number
  relativeGrid: Record<string, Record<string, string>>
  relativeWeights: Record<string, Record<string, number>>
  maxRelativeWeight: number
}

export const appRouter = t.router({
  // Get main metadata configuration payload (no heavy articles list, no keyword vocabulary, no translations)
  getDataPayload: t.procedure.query(async () => {
    // 1. Fetch total count of articles using Drizzle sql aggregator
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(articles).get()
    const totalCount = countResult ? countResult.count : 0

    // 2. Fetch unique categories list using Drizzle selectDistinct
    const categoryRows = await db.selectDistinct({ category: articles.category }).from(articles).all()
    const categories = categoryRows.map(row => row.category)

    return {
      totalArticlesCount: totalCount,
      categories,
    }
  }),

  // Get articles for timeline page (metadata only)
  getTimelineArticles: t.procedure
    .input(z.object({ category: z.string() }))
    .query(async ({ input }) => {
      if (input.category === 'All') {
        return await db.select({
          id: articles.id,
          title: articles.title,
          description: articles.description,
          date: articles.date,
          link: articles.link,
          category: articles.category,
        }).from(articles).all()
      } else {
        return await db.select({
          id: articles.id,
          title: articles.title,
          description: articles.description,
          date: articles.date,
          link: articles.link,
          category: articles.category,
        }).from(articles)
        .where(eq(articles.category, input.category))
        .all()
      }
    }),

  // Get aggregated dashboard statistics and recent feed
  getDashboardData: t.procedure.query(async () => {
    // Total Count
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(articles).get()
    const totalArticles = countResult ? countResult.count : 0

    // Group counts
    const categoryRows = await db.select({
      category: articles.category,
      count: sql<number>`count(*)`
    }).from(articles)
    .groupBy(articles.category)
    .all()

    const categoryCounts: Record<string, number> = {}
    categoryRows.forEach(row => {
      categoryCounts[row.category] = row.count
    })

    // Recent 5 articles
    const recent = await db.select({
      id: articles.id,
      title: articles.title,
      description: articles.description,
      date: articles.date,
      link: articles.link,
      category: articles.category,
    })
    .from(articles)
    .orderBy(desc(articles.date))
    .limit(5)
    .all()

    return {
      totalArticles,
      categoryCounts,
      recentArticles: recent,
    }
  }),

  // Server-side Trendmap grid calculation using database view article_keyword_matches
  getTrendmapGrid: t.procedure
    .input(z.object({
      category: z.string(),
      language: z.enum(['en', 'de']),
    }))
    .query(async ({ input }): Promise<TrendmapCalculationResult> => {
      const { category, language } = input

      // Try to load cached result first
      const cached = await db.select({ resultJson: trendmapCache.resultJson })
        .from(trendmapCache)
        .where(and(eq(trendmapCache.category, category), eq(trendmapCache.language, language)))
        .get()

      if (cached) {
        return JSON.parse(cached.resultJson) as TrendmapCalculationResult
      }

      const result = await calculateTrendmapGrid(db, category, language)

      // Save to cache asynchronously/synchronously
      try {
        await db.delete(trendmapCache)
          .where(and(eq(trendmapCache.category, category), eq(trendmapCache.language, language)))
          .run()
        await db.insert(trendmapCache)
          .values({
            category,
            language,
            resultJson: JSON.stringify(result),
          })
          .run()
      } catch (err) {
        console.error('Failed to write to trendmapCache:', err)
      }

      return result
    }),

  // Get details for a single article by ID
  getArticleDetail: t.procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const result = await db
        .select()
        .from(articles)
        .where(eq(articles.id, input.id))
        .get()

      if (!result) {
        throw new Error(`Article not found: ${input.id}`)
      }
      return result
    }),

  // Get topics matched to a specific article by ID
  getArticleTopics: t.procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return await db
        .select({
          topicId: topics.id,
          nameDe: topics.nameDe,
          nameEn: topics.nameEn,
        })
        .from(articleTopicMatches)
        .innerJoin(topics, eq(articleTopicMatches.topicId, topics.id))
        .where(eq(articleTopicMatches.articleId, input.id))
        .all()
    }),

  // Search articles using SQLite indexes and FTS5 full-text index
  searchArticles: t.procedure
    .input(
      z.object({
        q: z.string().optional(),
        category: z.string().optional(),
        sort: z.enum(['newest', 'oldest']).optional(),
        includeFullText: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const q = (input.q || '').trim()
      const category = input.category || 'All'
      const sort = input.sort || 'newest'
      const includeFullText = input.includeFullText || false

      // If no query string, do simple standard select with category filter and sort
      if (!q) {
        const query = db.select({
          id: articles.id,
          title: articles.title,
          description: articles.description,
          date: articles.date,
          link: articles.link,
          category: articles.category,
        })
        .from(articles)

        if (category !== 'All') {
          query.where(eq(articles.category, category))
        }

        query.orderBy(sort === 'newest' ? desc(articles.date) : asc(articles.date))
        return await query.all()
      }

      // If query is present, use FTS5 virtual table via Drizzle
      const ftsQuery = formatFtsQuery(q)
      const matchClause = includeFullText ? ftsQuery : `{title description} : ${ftsQuery}`

      const query = db.select({
        id: articles.id,
        title: articles.title,
        description: articles.description,
        date: articles.date,
        link: articles.link,
        category: articles.category,
      })
      .from(articles)
      .where(
        and(
          category !== 'All' ? eq(articles.category, category) : undefined,
          sql`articles.id IN (SELECT id FROM articles_fts WHERE articles_fts MATCH ${matchClause})`
        )
      )
      .orderBy(sort === 'newest' ? desc(articles.date) : asc(articles.date))

      return await query.all()
    }),
})

export type AppRouter = typeof appRouter
export default appRouter
