import { eq, sql, and } from 'drizzle-orm'
import { articles, topics, articleTopicMatches, topicKeywords } from '../server/db/schema.js'
import { getYearHalf } from './matching.js'

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

export async function calculateTrendmapGrid(
  db: any,
  category: string,
  language: 'en' | 'de',
  q?: string
): Promise<TrendmapCalculationResult> {
  // 1. Fetch all topics (category-independent)
  const dbTopics = await db.select({
    id: topics.id,
    nameDe: topics.nameDe,
    nameEn: topics.nameEn,
  })
  .from(topics)
  .all()

  // Map topic IDs to display labels
  const labelToDisplay: Record<string, string> = {}
  dbTopics.forEach((t: any) => {
    const display = language === 'en' ? t.nameEn : t.nameDe
    labelToDisplay[t.id] = display
  })

  // Fetch all topic keywords mapping (independent of query language)
  const dbKeywords = await db.select({
    topicId: topicKeywords.topicId,
    keyword: topicKeywords.keyword
  })
  .from(topicKeywords)
  .all()

  const topicKeywordsMap: Record<string, string[]> = {}
  dbKeywords.forEach((k: any) => {
    if (!topicKeywordsMap[k.topicId]) {
      topicKeywordsMap[k.topicId] = []
    }
    if (!topicKeywordsMap[k.topicId].includes(k.keyword)) {
      topicKeywordsMap[k.topicId].push(k.keyword)
    }
  })

  // Resolve matching topic IDs for search query if present
  let matchingTopicIds: string[] = []
  if (q && q.trim()) {
    matchingTopicIds = await getMatchingTopicIdsForQuery(db, q)
  }

  // 2. Query min and max dates in category to build timescale
  const dateConditions: any[] = []
  if (category !== 'All') {
    dateConditions.push(eq(articles.category, category))
  }

  if (q && q.trim()) {
    if (matchingTopicIds.length > 0) {
      const topicList = matchingTopicIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',')
      dateConditions.push(
        sql`${articles.id} IN (SELECT article_id FROM article_topic_matches WHERE topic_id IN (${sql.raw(topicList)}))`
      )
    } else {
      dateConditions.push(sql`1=0`)
    }
  }

  let dateQuery = db.select({
    minDate: sql<string>`min(date)`,
    maxDate: sql<string>`max(date)`
  })
  .from(articles)

  if (dateConditions.length > 0) {
    dateQuery = dateQuery.where(and(...dateConditions))
  }

  const { minDate, maxDate } = await dateQuery.get() || { minDate: null, maxDate: null }

  let minSort = Infinity
  let maxSort = -Infinity
  if (minDate) minSort = getYearHalf(minDate).sortVal
  if (maxDate) maxSort = getYearHalf(maxDate).sortVal

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

  // 3. Query total articles per bucket in category for baseline
  const bucketConditions: any[] = []
  if (category !== 'All') {
    bucketConditions.push(eq(articles.category, category))
  }

  if (q && q.trim()) {
    if (matchingTopicIds.length > 0) {
      const topicList = matchingTopicIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',')
      bucketConditions.push(
        sql`${articles.id} IN (SELECT article_id FROM article_topic_matches WHERE topic_id IN (${sql.raw(topicList)}))`
      )
    } else {
      bucketConditions.push(sql`1=0`)
    }
  }

  let bucketCountsQuery = db.select({
    bucket: sql<string>`strftime('%Y', date) || '-' || (CASE WHEN strftime('%m', date) <= '06' THEN 'H1' ELSE 'H2' END)`,
    count: sql<number>`count(*)`
  })
  .from(articles)
  .groupBy(sql`strftime('%Y', date) || '-' || (CASE WHEN strftime('%m', date) <= '06' THEN 'H1' ELSE 'H2' END)`)

  if (bucketConditions.length > 0) {
    bucketCountsQuery = bucketCountsQuery.where(and(...bucketConditions))
  }

  const bucketCounts = await bucketCountsQuery.all()
  const totalArticlesPerSlot: Record<string, number> = {}
  timeScale.forEach(t => {
    totalArticlesPerSlot[t.bucket] = 0
  })
  bucketCounts.forEach((r: any) => {
    if (totalArticlesPerSlot[r.bucket] !== undefined) {
      totalArticlesPerSlot[r.bucket] = r.count
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

  // 4. Fetch matched aggregated cell counts directly using group by
  const matchesConditions: any[] = []
  if (category !== 'All') {
    matchesConditions.push(eq(articleTopicMatches.category, category))
  }

  if (q && q.trim()) {
    if (matchingTopicIds.length > 0) {
      const topicList = matchingTopicIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',')
      matchesConditions.push(
        sql`${articleTopicMatches.topicId} IN (${sql.raw(topicList)})`
      )
    } else {
      matchesConditions.push(sql`1=0`)
    }
  }

  let matchesCountQuery = db.select({
    topicId: articleTopicMatches.topicId,
    bucket: articleTopicMatches.bucket,
    count: sql<number>`count(distinct article_id)`
  })
  .from(articleTopicMatches)
  .groupBy(articleTopicMatches.topicId, articleTopicMatches.bucket)

  if (matchesConditions.length > 0) {
    matchesCountQuery = matchesCountQuery.where(and(...matchesConditions))
  }

  const dbMatches = await matchesCountQuery.all()

  // Count matches for sorting
  const matchCounts: Record<string, number> = {}
  dbMatches.forEach((row: any) => {
    const key = row.topicId.toLowerCase()
    matchCounts[key] = (matchCounts[key] || 0) + row.count
  })

  const topDisplayKeys = Object.entries(matchCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])

  const grid: Record<string, Record<string, number>> = {}
  const cellMatches: Record<string, Record<string, string[]>> = {}
  let maxCellCount = 0

  topDisplayKeys.forEach(key => {
    grid[key] = {}
    cellMatches[key] = {}
    timeScale.forEach(t => {
      grid[key][t.bucket] = 0
      cellMatches[key][t.bucket] = []
    })
  })

  dbMatches.forEach((row: any) => {
    const key = row.topicId.toLowerCase()
    if (grid[key] && grid[key][row.bucket] !== undefined) {
      grid[key][row.bucket] = row.count
      if (row.count > maxCellCount) {
        maxCellCount = row.count
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
    if (zeroMatchStreak.length >= 3) {
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

  return {
    labelToDisplay,
    topicKeywords: topicKeywordsMap,
    categoryArticles: [],
    croppedTimeScale,
    topDisplayKeys,
    grid,
    cellMatches: {},
    maxCellCount,
    relativeGrid,
    relativeWeights,
    maxRelativeWeight,
  }
}
