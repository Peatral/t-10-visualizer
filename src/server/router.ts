import { z } from 'zod'
import { db } from './db'
import { articles, topics, articleTopicMatches, type Article } from './db/schema'
import { eq, desc, asc, and, sql, count } from 'drizzle-orm'
import { calculateTrendmapGrid, formatFtsQuery, getMatchingTopicIdsForQuery, type TrendmapCalculationResult } from '../utils/trendmapCalc'
import { createTRPCRouter, publicProcedure } from '../integrations/trpc/init'

export const appRouter = createTRPCRouter({
  getAllCategories: publicProcedure
    .query(async () => {
      const categoryRows = await db.selectDistinct({ category: articles.category }).from(articles).all()
      const categories = categoryRows.map(row => row.category)
      return categories
    }),
  
  getRecentArticles: publicProcedure
    .input(
      z.object({
        count: z.int().positive(),
      })
    )
    .query(({ input: { count }}) => {
      return db
        .select({
          id: articles.id,
          title: articles.title,
          description: articles.description,
          date: articles.date,
          link: articles.link,
          category: articles.category,
        })
        .from(articles)
        .orderBy(desc(articles.date))
        .limit(count)
        .all()
      }),

  getTotalArticles: publicProcedure
    .query(async () => {
      const countResult = await db.select({ count: count() }).from(articles).get()
      const totalArticles = countResult ? countResult.count : 0
      return totalArticles
    }),

  // Get aggregated dashboard statistics and recent feed
  getArticleCountByCategory: publicProcedure
    .query(async () => {
      const categoryRows = await db.select({
        category: articles.category,
        count: count(),
      }).from(articles)
      .groupBy(articles.category)
      .all()

      const categoryCounts: Record<string, number> = {}
      categoryRows.forEach(row => {
        categoryCounts[row.category] = row.count
      })

      return categoryCounts
    }),

  // Server-side Trendmap grid calculation on the fly
  getTrendmapGrid: publicProcedure
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
      return calculateTrendmapGrid(db, language, category, q, before, after, topic)
    }),

  getArticleDetail: publicProcedure
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
  getArticleTopics: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return db
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

  getAllTopics: publicProcedure.query(async () => {
    return db.select({
      id: topics.id,
      nameDe: topics.nameDe,
      nameEn: topics.nameEn,
    })
    .from(topics)
    .all()
  }),

  // Search articles using SQLite indexes and FTS5 full-text index
  searchArticles: publicProcedure
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
      return query.all()
    }),
})

export type TRPCRouter = typeof appRouter
export default appRouter
