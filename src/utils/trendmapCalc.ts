import { eq } from 'drizzle-orm'
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

export async function calculateTrendmapGrid(db: any, category: string, language: 'en' | 'de'): Promise<TrendmapCalculationResult> {
  // 1. Fetch topics for this category to build display lookup
  const dbTopics = await db.select({
    id: topics.id,
    nameDe: topics.nameDe,
    nameEn: topics.nameEn,
  })
  .from(topics)
  .where(eq(topics.category, category))
  .all()

  // Map topic IDs to display labels
  const labelToDisplay: Record<string, string> = {}
  dbTopics.forEach((t: any) => {
    const display = language === 'en' ? t.nameEn : t.nameDe
    labelToDisplay[t.id] = display
  })

  // Fetch topic keywords mapping
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

  // 2. Fetch matched rows natively using Drizzle select builder
  const dbMatches = await db.select({
    articleId: articleTopicMatches.articleId,
    category: articleTopicMatches.category,
    date: articleTopicMatches.date,
    bucket: articleTopicMatches.bucket,
    sortVal: articleTopicMatches.sortVal,
    displayKey: articleTopicMatches.topicId,
  })
  .from(articleTopicMatches)
  .where(eq(articleTopicMatches.category, category))
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

  const categoryArticles = categoryDbArticles.map((a: any) => {
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
  categoryArticles.forEach((a: any) => {
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
  categoryArticles.forEach((art: any) => {
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
  dbMatches.forEach((match: any) => {
    const key = match.displayKey.toLowerCase()
    matchCounts[key] = (matchCounts[key] || 0) + 1
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

  // Map article ID to article metadata for quick lookup
  const articleLookup = new Map<string, ArticleMetadata>()
  categoryDbArticles.forEach((art: any) => {
    articleLookup.set(art.id, art)
  })

  dbMatches.forEach((match: any) => {
    const key = match.displayKey.toLowerCase()
    const art = articleLookup.get(match.articleId)
    if (art && grid[key] && grid[key][match.bucket] !== undefined) {
      
      // Only increment and push if we haven't seen this article in this cell yet
      if (!cellMatches[key][match.bucket].includes(match.articleId)) {
        grid[key][match.bucket]++
        cellMatches[key][match.bucket].push(match.articleId)
        if (grid[key][match.bucket] > maxCellCount) {
          maxCellCount = grid[key][match.bucket]
        }
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

  const strippedArticles = categoryArticles.map((a: any) => ({
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
    topicKeywords: topicKeywordsMap,
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
}
