import { z } from 'zod'
import { db } from './db'
import { articles, topics, articleTopicMatches, articlesFts } from './db/schema'
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
        sort: z.enum(['newest', 'oldest', 'relevant']).optional(),
        includeFullText: z.boolean().optional(),
        before: z.string().optional(),
        after: z.string().optional(),
        topic: z.string().optional(),
        markFoundWords: z.boolean().optional().default(false),
      })
    )
    .query(async ({ input }): Promise<any[]> => {
      const q = input.q?.replace(/([a-zA-Z0-9_-]+):$/, '').trim() || ''
      const category = input.category
      const includeFullText = input.includeFullText !== false
      const { before, after, topic } = input
      
      const sort = input.sort || (q ? 'relevant' : 'newest')

      const conditions: any[] = []

      if (category !== undefined) conditions.push(eq(articles.category, category))
      if (before && before.trim()) conditions.push(sql`${articles.date} <= ${before.trim()}`)
      if (after && after.trim()) conditions.push(sql`${articles.date} >= ${after.trim()}`)

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

      let query: any = db.select({
        id: articles.id,
        title: q && input.markFoundWords
          ? sql<string>`snippet(articles_fts, 1, '<mark>', '</mark>', '...', 64)` 
          : articles.title,
        description: q && input.markFoundWords
          ? sql<string>`snippet(articles_fts, 2, '<mark>', '</mark>', '...', 64)` 
          : articles.description,
        date: articles.date,
        link: articles.link,
        category: articles.category,
      }).from(articles)

      if (q) {
        const ftsQuery = formatFtsQuery(q)
        const matchClause = includeFullText ? ftsQuery : `{title description} : ${ftsQuery}`

        query = query.innerJoin(
          articlesFts, 
          sql`${articlesFts.id} = ${articles.id} AND articles_fts MATCH ${matchClause}`
        )
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions))
      }

      if (sort === 'relevant' && q) {
        query.orderBy(sql`articles_fts.rank ASC`)
      } else if (sort === 'oldest') {
        query.orderBy(asc(articles.date))
      } else {
        query.orderBy(desc(articles.date))
      }

      return query.all()
    }),

  // Add this below searchArticles
  getTopicNetwork: publicProcedure
    .input(
      z.object({
        q: z.string().optional(),
        category: z.string().optional(),
        includeFullText: z.boolean().optional(),
        before: z.string().optional(),
        after: z.string().optional(),
        topic: z.string().optional(),
        language: z.enum(['en', 'de']).default('en'),
      })
    )
    .query(async ({ input }) => {
      const q = input.q?.replace(/([a-zA-Z0-9_-]+):$/, '').trim() || ''
      const category = input.category
      const includeFullText = input.includeFullText !== false
      const { before, after, topic, language } = input

      const conditions: any[] = []

      // 1. Build the same filter conditions as searchArticles
      if (category !== undefined) conditions.push(eq(articles.category, category))
      if (before && before.trim()) conditions.push(sql`${articles.date} <= ${before.trim()}`)
      if (after && after.trim()) conditions.push(sql`${articles.date} >= ${after.trim()}`)
      
      if (topic && topic.trim()) {
        const matchingTopicIds = await getMatchingTopicIdsForQuery(db, topic)
        if (matchingTopicIds.length > 0) {
          const topicList = matchingTopicIds.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(',')
          conditions.push(sql`${articles.id} IN (SELECT article_id FROM article_topic_matches WHERE topic_id IN (${sql.raw(topicList)}))`)
        } else {
          conditions.push(sql`1=0`)
        }
      }

      if (q) {
        const ftsQuery = formatFtsQuery(q)
        const matchClause = includeFullText ? ftsQuery : `{title description} : ${ftsQuery}`
        conditions.push(sql`${articles.id} IN (SELECT id FROM articles_fts WHERE articles_fts MATCH ${matchClause})`)
      }

      // 2. Fetch all matching articles and JOIN their topics
      let query: any = db.select({
        articleId: articles.id,
        topicId: topics.id,
        topicName: language === 'de' ? topics.nameDe : topics.nameEn,
        category: articles.category
      })
      .from(articles)
      .innerJoin(articleTopicMatches, eq(articles.id, articleTopicMatches.articleId))
      .innerJoin(topics, eq(articleTopicMatches.topicId, topics.id))

      if (conditions.length > 0) {
        query = query.where(and(...conditions))
      }

      const rows = await query.all()

      // 3. Process into Nodes and Links
      const nodeMap = new Map<string, { id: string; name: string; val: number; categories: Record<string, number>; category?: string }>()
      const linkMap = new Map<string, { source: string; target: string; weight: number }>()
      
      // Group topics by article to calculate co-occurrences
      const articlesMap = new Map<string, Array<{id: string, name: string}>>()

      for (const row of rows) {
        // Tally node frequencies
        if (!nodeMap.has(row.topicId)) {
          nodeMap.set(row.topicId, { id: row.topicId, name: row.topicName, val: 0, categories: {} })
        }
        const node = nodeMap.get(row.topicId)!
        node.val += 1
        node.categories[row.category] = (node.categories[row.category] || 0) + 1

        // Group by article
        if (!articlesMap.has(row.articleId)) {
          articlesMap.set(row.articleId, [])
        }
        articlesMap.get(row.articleId)!.push({ id: row.topicId, name: row.topicName })
      }

      // Assign dominant category to each node
      for (const node of nodeMap.values()) {
        let maxCount = 0
        let dominantCategory = ''
        for (const [cat, count] of Object.entries(node.categories)) {
          if (count > maxCount) {
            maxCount = count
            dominantCategory = cat
          }
        }
        node.category = dominantCategory
      }

      // Tally link weights (co-occurrences)
      for (const [_, articleTopics] of articlesMap.entries()) {
        for (let i = 0; i < articleTopics.length; i++) {
          for (let j = i + 1; j < articleTopics.length; j++) {
            const t1 = articleTopics[i].id
            const t2 = articleTopics[j].id
            const linkId = [t1, t2].sort().join('::')
            
            if (!linkMap.has(linkId)) {
              linkMap.set(linkId, { source: t1, target: t2, weight: 0 })
            }
            linkMap.get(linkId)!.weight += 1
          }
        }
      }

      // --- NEW: PRUNING LOGIC --- //
      
      // Filter out weak connections (e.g., they only appeared together once)
      const strongLinks = Array.from(linkMap.values()).filter(link => link.weight > 1);

      // Optional: Only keep nodes that have at least one strong connection
      const connectedNodeIds = new Set(
        strongLinks.flatMap(l => [l.source, l.target])
      );
      
      const relevantNodes = Array.from(nodeMap.values())
        .filter(node => connectedNodeIds.has(node.id) || node.val > 2)
        .map(node => ({
          id: node.id,
          name: node.name,
          val: node.val,
          category: node.category || '',
          categories: node.categories
        }));

      return {
        nodes: relevantNodes,
        links: strongLinks
      }
    }),
})

export type TRPCRouter = typeof appRouter
export default appRouter
