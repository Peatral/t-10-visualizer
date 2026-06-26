import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { db } from './db/index.js'
import { articles, themenwolke, translations, articleKeywordMatches } from './db/schema.js'
import { eq, desc, asc, and, sql } from 'drizzle-orm'
import { getYearHalf } from '../utils/matching.js'

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
  categoryArticles: Array<ArticleMetadata & { bucket: string; sortVal: number }>
  croppedTimeScale: Array<{ bucket: string; sortVal: number; isGap?: boolean; gapStart?: string; gapEnd?: string; spanCount?: number }>
  topDisplayKeys: string[]
  grid: Record<string, Record<string, number>>
  cellMatches: Record<string, Record<string, ArticleMetadata[]>>
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

      // 1. Fetch vocabulary candidates for this category to build capitalization lookup
      let themenwolkeKey = 'Energy'
      const lower = category.toLowerCase()
      if (lower.includes('energy')) themenwolkeKey = 'Energy'
      else if (lower.includes('food')) themenwolkeKey = 'Food'
      else if (lower.includes('housing')) themenwolkeKey = 'Housing'
      else if (lower.includes('mobility')) themenwolkeKey = 'Mobility'

      const dbWords = await db.select({ word: themenwolke.word })
        .from(themenwolke)
        .where(eq(themenwolke.category, themenwolkeKey))
        .all()
      const candidates = dbWords.map(w => w.word)

      // Fetch translations to assist display labels mapping
      const dbTranslations = await db.select().from(translations).all()
      const transMap: Record<string, string> = {}
      dbTranslations.forEach((item) => {
        transMap[item.key] = item.value
      })

      // Map candidates to display labels
      const labelToDisplay: Record<string, string> = {}
      candidates.forEach(word => {
        const translation = transMap[word] || ''
        const display = (language === 'en' && translation) ? translation : word
        const key = display.toLowerCase()
        labelToDisplay[key] = display
      })

      // 2. Fetch matched rows from the database view natively using Drizzle select builder
      const displayCol = language === 'en' ? articleKeywordMatches.englishWord : articleKeywordMatches.germanWord
      const dbMatches = await db.select({
        articleId: articleKeywordMatches.articleId,
        category: articleKeywordMatches.category,
        date: articleKeywordMatches.date,
        bucket: articleKeywordMatches.bucket,
        sortVal: articleKeywordMatches.sortVal,
        displayKey: displayCol,
      })
      .from(articleKeywordMatches)
      .where(eq(articleKeywordMatches.category, category))
      .all()

      // 3. Fetch target articles metadata in category (no bodyText column loaded!)
      const categoryDbArticles = await db.select({
        id: articles.id,
        title: articles.title,
        description: articles.description,
        date: articles.date,
        link: articles.link,
        category: articles.category,
      })
      .from(articles)
      .where(eq(articles.category, category))
      .all()

      const categoryArticles = categoryDbArticles.map(a => {
        const { bucket, sortVal } = getYearHalf(a.date)
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          date: a.date,
          link: a.link,
          category: a.category,
          bucket,
          sortVal,
        }
      })

      // Min / max sort value for timeline scale
      let minSort = Infinity
      let maxSort = -Infinity
      categoryArticles.forEach(a => {
        if (a.sortVal < minSort) minSort = a.sortVal
        if (a.sortVal > maxSort) maxSort = a.sortVal
      })

      const timeScale: { bucket: string; sortVal: number }[] = []
      if (minSort !== Infinity && maxSort !== -Infinity) {
        for (let s = minSort; s <= maxSort; s++) {
          const year = Math.floor(s / 2)
          const half = s % 2 === 0 ? 'H1' : 'H2'
          timeScale.push({
            bucket: `${year}-${half}`,
            sortVal: s,
          })
        }
      }

      // Count articles per slot
      const totalArticlesPerSlot: Record<string, number> = {}
      timeScale.forEach(t => {
        totalArticlesPerSlot[t.bucket] = 0
      })
      categoryArticles.forEach(art => {
        if (totalArticlesPerSlot[art.bucket] !== undefined) {
          totalArticlesPerSlot[art.bucket]++
        }
      })

      // Gaussian smoothing
      const smoothedBaseline: Record<string, number> = {}
      const kernel = [0.15, 0.7, 0.15]
      timeScale.forEach((slot, idx) => {
        let weightedSum = 0
        let weightSum = 0
        for (let k = -1; k <= 1; k++) {
          const neighborIdx = idx + k
          if (neighborIdx >= 0 && neighborIdx < timeScale.length) {
            const neighborSlot = timeScale[neighborIdx]
            const neighborCount = totalArticlesPerSlot[neighborSlot.bucket] || 0
            const kernelWeight = kernel[k + 1]
            weightedSum += neighborCount * kernelWeight
            weightSum += kernelWeight
          }
        }
        smoothedBaseline[slot.bucket] = (weightedSum / (weightSum || 1)) + 2.0
      })

      // Count matches for sorting
      const matchCounts: Record<string, number> = {}
      dbMatches.forEach(match => {
        const key = match.displayKey.toLowerCase()
        matchCounts[key] = (matchCounts[key] || 0) + 1
      })

      const topDisplayKeys = Object.entries(matchCounts)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0])

      const grid: Record<string, Record<string, number>> = {}
      const cellMatches: Record<string, Record<string, ArticleMetadata[]>> = {}
      let maxCellCount = 0

      topDisplayKeys.forEach(key => {
        grid[key] = {}
        cellMatches[key] = {}
        timeScale.forEach(t => {
          grid[key][t.bucket] = 0
          cellMatches[key][t.bucket] = []
        })
      })

      // Map article ID to article metadata for quick lookup
      const articleLookup = new Map<string, ArticleMetadata>()
      categoryDbArticles.forEach(art => {
        articleLookup.set(art.id, art)
      })

      dbMatches.forEach(match => {
        const key = match.displayKey.toLowerCase()
        const art = articleLookup.get(match.articleId)
        if (art && grid[key] && grid[key][match.bucket] !== undefined) {
          grid[key][match.bucket]++
          cellMatches[key][match.bucket].push(art)
          if (grid[key][match.bucket] > maxCellCount) {
            maxCellCount = grid[key][match.bucket]
          }
        }
      })

      // Relative weights and percentages
      const relativeGrid: Record<string, Record<string, string>> = {}
      const relativeWeights: Record<string, Record<string, number>> = {}
      let maxRelativeWeight = 0

      topDisplayKeys.forEach(key => {
        relativeGrid[key] = {}
        relativeWeights[key] = {}
        timeScale.forEach(t => {
          const count = grid[key][t.bucket] || 0
          if (count === 0) {
            relativeGrid[key][t.bucket] = ''
            relativeWeights[key][t.bucket] = 0
          } else {
            const baseline = smoothedBaseline[t.bucket] || 1
            const relativeFraction = count / baseline
            relativeWeights[key][t.bucket] = relativeFraction
            if (relativeFraction > maxRelativeWeight) {
              maxRelativeWeight = relativeFraction
            }
            const rawPercent = (count / (totalArticlesPerSlot[t.bucket] || 1)) * 100
            relativeGrid[key][t.bucket] = `${rawPercent.toFixed(0)}%`
          }
        })
      })

      // Crop time scale
      let firstActiveIdx = timeScale.length
      let lastActiveIdx = -1

      timeScale.forEach((col, idx) => {
        let hasMatch = false
        topDisplayKeys.forEach(key => {
          if (grid[key][col.bucket] > 0) hasMatch = true
        })
        if (hasMatch) {
          if (idx < firstActiveIdx) firstActiveIdx = idx
          if (idx > lastActiveIdx) lastActiveIdx = idx
        }
      })

      const croppedTimeScaleRaw = lastActiveIdx >= firstActiveIdx
        ? timeScale.slice(firstActiveIdx, lastActiveIdx + 1)
        : timeScale

      // Compress gaps
      const croppedTimeScale: Array<{ bucket: string; sortVal: number; isGap?: boolean; gapStart?: string; gapEnd?: string; spanCount?: number }> = []
      let zeroMatchStreak: Array<{ bucket: string; sortVal: number }> = []

      const checkColumnHasMatches = (bucketName: string) => {
        return topDisplayKeys.some(key => (grid[key]?.[bucketName] || 0) > 0)
      }

      croppedTimeScaleRaw.forEach((col) => {
        const hasMatches = checkColumnHasMatches(col.bucket)
        if (!hasMatches) {
          zeroMatchStreak.push(col)
        } else {
          if (zeroMatchStreak.length > 6) {
            const startYear = zeroMatchStreak[0].bucket
            const endYear = zeroMatchStreak[zeroMatchStreak.length - 1].bucket
            croppedTimeScale.push({
              bucket: `gap-${startYear}-${endYear}`,
              sortVal: zeroMatchStreak[0].sortVal,
              isGap: true,
              gapStart: startYear,
              gapEnd: endYear,
              spanCount: zeroMatchStreak.length,
            })
          } else {
            zeroMatchStreak.forEach(c => croppedTimeScale.push(c))
          }
          zeroMatchStreak = []
          croppedTimeScale.push(col)
        }
      })

      if (zeroMatchStreak.length > 0) {
        if (zeroMatchStreak.length > 6) {
          const startYear = zeroMatchStreak[0].bucket
          const endYear = zeroMatchStreak[zeroMatchStreak.length - 1].bucket
          croppedTimeScale.push({
            bucket: `gap-${startYear}-${endYear}`,
            sortVal: zeroMatchStreak[0].sortVal,
            isGap: true,
            gapStart: startYear,
            gapEnd: endYear,
            spanCount: zeroMatchStreak.length,
          })
        } else {
          zeroMatchStreak.forEach(c => croppedTimeScale.push(c))
        }
      }

      const strippedArticles = categoryArticles.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        date: a.date,
        link: a.link,
        category: a.category,
        bucket: a.bucket,
        sortVal: a.sortVal,
      }))

      return {
        labelToDisplay,
        categoryArticles: strippedArticles,
        croppedTimeScale,
        topDisplayKeys,
        grid,
        cellMatches,
        maxCellCount,
        relativeGrid,
        relativeWeights,
        maxRelativeWeight,
      }
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
