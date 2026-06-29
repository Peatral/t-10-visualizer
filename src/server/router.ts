import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { db } from './db/index.js'
import { articles, topics, articleTopicMatches, type Article } from './db/schema.js'
import { eq, desc, asc, and, sql } from 'drizzle-orm'
import { calculateTrendmapGrid, formatFtsQuery, getMatchingTopicIdsForQuery, type TrendmapCalculationResult } from '../utils/trendmapCalc.js'

const t = initTRPC.create()

export const appRouter = t.router({
  getAllCategories: t.procedure
    .query(async () => {
      const categoryRows = await db.selectDistinct({ category: articles.category }).from(articles).all()
      const categories = categoryRows.map(row => row.category)
      return categories
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
      category: z.string().optional(),
      language: z.enum(['en', 'de']),
      q: z.string().optional(),
      before: z.string().optional(),
      after: z.string().optional(),
      topic: z.string().optional(),
    }))
    .query(async ({ input }): Promise<TrendmapCalculationResult> => {
      const { category, language, q, before, after, topic } = input
      return await calculateTrendmapGrid(db, language, category, q, before, after, topic)
    }),

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

  getAllTopics: t.procedure.query(async () => {
    return await db.select({
      id: topics.id,
      nameDe: topics.nameDe,
      nameEn: topics.nameEn,
    })
    .from(topics)
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
        before: z.string().optional(),
        after: z.string().optional(),
        topic: z.string().optional(),
      })
    )
    .query(async ({ input }): Promise<Article[]> => {
      const q = input.q?.replace(/([a-zA-Z0-9_-]+):$/, '').trim() || ''
      const category = input.category
      const sort = input.sort || 'newest'
      const includeFullText = input.includeFullText !== false // default to true
      const { before, after, topic } = input

      const conditions: any[] = []

      // Category filter
      if (category !== undefined) {
        conditions.push(eq(articles.category, category))
      }

      // Date range filters
      if (before && before.trim()) {
        conditions.push(sql`${articles.date} <= ${before.trim()}`)
      }
      if (after && after.trim()) {
        conditions.push(sql`${articles.date} >= ${after.trim()}`)
      }

      // Topic filter
      if (topic && topic.trim()) {
        const matchingTopicIds = await getMatchingTopicIdsForQuery(db, topic)
        if (matchingTopicIds.length > 0) {
          const topicList = matchingTopicIds.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(',')
          conditions.push(
            sql`${articles.id} IN (SELECT article_id FROM article_topic_matches WHERE topic_id IN (${sql.raw(topicList)}))`
          )
        } else {
          conditions.push(sql`1=0`)
        }
      }

      // FTS5 search query
      if (q) {
        const ftsQuery = formatFtsQuery(q)
        const matchClause = includeFullText ? ftsQuery : `{title description} : ${ftsQuery}`
        conditions.push(
          sql`${articles.id} IN (SELECT id FROM articles_fts WHERE articles_fts MATCH ${matchClause})`
        )
      }

      let query: any = db.select({
        id: articles.id,
        title: articles.title,
        description: articles.description,
        date: articles.date,
        link: articles.link,
        category: articles.category,
      })
      .from(articles)

      if (conditions.length > 0) {
        query = query.where(and(...conditions))
      }

      query.orderBy(sort === 'newest' ? desc(articles.date) : asc(articles.date))
      return await query.all()
    }),
})

export type AppRouter = typeof appRouter
export default appRouter
