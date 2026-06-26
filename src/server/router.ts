import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { db } from './db/index.js'
import { articles, topics, articleTopicMatches, topicKeywords } from './db/schema.js'
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

async function getMatchingTopicIdsForQuery(db: any, q: string): Promise<string[]> {
  const cleanQ = q.trim().toLowerCase()
  const rows = await db.selectDistinct({ topicId: topics.id })
    .from(topics)
    .leftJoin(topicKeywords, eq(topics.id, topicKeywords.topicId))
    .where(
      sql`LOWER(topics.name_de) LIKE ${`%${cleanQ}%`} OR 
          LOWER(topics.name_en) LIKE ${`%${cleanQ}%`} OR 
          LOWER(topic_keywords.keyword) LIKE ${`%${cleanQ}%`}`
    )
    .all()
  return rows.map((r: any) => r.topicId)
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
  // Server-side Trendmap grid calculation on the fly
  getTrendmapGrid: t.procedure
    .input(z.object({
      category: z.string(),
      language: z.enum(['en', 'de']),
      q: z.string().optional(),
    }))
    .query(async ({ input }): Promise<TrendmapCalculationResult> => {
      const { category, language, q } = input
      return await calculateTrendmapGrid(db, category, language, q)
    }),

  getTrendmapCellArticles: t.procedure
    .input(z.object({
      category: z.string(),
      topicId: z.string(),
      bucket: z.string(),
      q: z.string().optional(),
      includeFullText: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      const { category, topicId, bucket } = input
      const [yearStr, half] = bucket.split('-')
      const year = parseInt(yearStr, 10)
      const startDate = half === 'H1' ? `${year}-01-01` : `${year}-07-01`
      const endDate = half === 'H1' ? `${year}-06-30` : `${year}-12-31`

      const conditions = [
        eq(articleTopicMatches.topicId, topicId),
        sql`articles.date >= ${startDate}`,
        sql`articles.date <= ${endDate}`
      ]
      if (category !== 'All') {
        conditions.push(eq(articles.category, category))
      }

      return await db.select({
        id: articles.id,
        title: articles.title,
        description: articles.description,
        date: articles.date,
        link: articles.link,
        category: articles.category,
      })
      .from(articles)
      .innerJoin(articleTopicMatches, eq(articles.id, articleTopicMatches.articleId))
      .where(and(...conditions))
      .groupBy(articles.id)
      .orderBy(desc(articles.date))
      .all()
    }),

  getTrendmapRowArticles: t.procedure
    .input(z.object({
      category: z.string(),
      topicId: z.string(),
      q: z.string().optional(),
      includeFullText: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      const { category, topicId } = input

      const conditions = [
        eq(articleTopicMatches.topicId, topicId)
      ]
      if (category !== 'All') {
        conditions.push(eq(articles.category, category))
      }

      return await db.select({
        id: articles.id,
        title: articles.title,
        description: articles.description,
        date: articles.date,
        link: articles.link,
        category: articles.category,
      })
      .from(articles)
      .innerJoin(articleTopicMatches, eq(articles.id, articleTopicMatches.articleId))
      .where(and(...conditions))
      .groupBy(articles.id)
      .orderBy(desc(articles.date))
      .all()
    }),

  getTrendmapColumnArticles: t.procedure
    .input(z.object({
      category: z.string(),
      bucket: z.string(),
      q: z.string().optional(),
      includeFullText: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      const { category, bucket, q } = input
      const [yearStr, half] = bucket.split('-')
      const year = parseInt(yearStr, 10)
      const startDate = half === 'H1' ? `${year}-01-01` : `${year}-07-01`
      const endDate = half === 'H1' ? `${year}-06-30` : `${year}-12-31`

      let matchingTopicIds: string[] = []
      if (q && q.trim()) {
        matchingTopicIds = await getMatchingTopicIdsForQuery(db, q)
      }

      const conditions = [
        sql`articles.date >= ${startDate}`,
        sql`articles.date <= ${endDate}`
      ]
      if (category !== 'All') {
        conditions.push(eq(articles.category, category))
      }

      if (q && q.trim()) {
        if (matchingTopicIds.length > 0) {
          const topicList = matchingTopicIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',')
          conditions.push(
            sql`articles.id IN (SELECT article_id FROM article_topic_matches WHERE topic_id IN (${sql.raw(topicList)}))`
          )
        } else {
          conditions.push(sql`1=0`)
        }
      }

      return await db.select({
        id: articles.id,
        title: articles.title,
        description: articles.description,
        date: articles.date,
        link: articles.link,
        category: articles.category,
      })
      .from(articles)
      .where(and(...conditions))
      .orderBy(desc(articles.date))
      .all()
    }),  // Get details for a single article by ID
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
