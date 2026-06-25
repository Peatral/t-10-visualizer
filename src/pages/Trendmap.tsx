import React, { useState, useEffect, useMemo } from 'react'
import { Filter, ChevronDown, Info } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchArticleBodies } from '../services/dataSource'
import { useData } from '../context/DataContext'
import { useTranslation } from '../context/LanguageContext'
import type { Article } from '../types'
import { getYearHalf, checkKeywordMatchBilingual } from '../utils/matching'
import { HeatmapTable } from '../components/HeatmapTable'
import { DetailPanel } from '../components/DetailPanel'

export interface ArticleWithSearchText extends Article {
  fullSearchText: string
  bucket: string
  sortVal: number
}

interface CalculationResult {
  labelToDisplay: Map<string, string>
  categoryArticles: ArticleWithSearchText[]
  croppedTimeScale: Array<{ bucket: string; sortVal: number; isGap?: boolean; gapStart?: string; gapEnd?: string; spanCount?: number }>
  topDisplayKeys: string[]
  grid: Record<string, Record<string, number>>
  cellMatches: Record<string, Record<string, Article[]>>
  maxCellCount: number
  relativeGrid: Record<string, Record<string, string>> // Percentage formatted strings (e.g. "12.5%")
  relativeWeights: Record<string, Record<string, number>> // Numeric fractions [0, 1] for color rendering
  maxRelativeWeight: number
}

export const Trendmap: React.FC = () => {
  const data = useData()
  const { t, language } = useTranslation()
  const [viewMode, setViewMode] = useState<'absolute' | 'relative'>('absolute')

  // Load the full body texts on-demand for matching
  const { data: bodies, isLoading: isBodiesLoading } = useQuery({
    queryKey: ['articleBodies'],
    queryFn: fetchArticleBodies,
  })

  // Helper to retrieve keyword candidates for a specific category
  const getCandidateWords = (cat: string): string[] => {
    const lower = cat.toLowerCase()
    if (lower.includes("energy")) return data.themenwolkeWords["Energy"] || []
    if (lower.includes("food")) return data.themenwolkeWords["Food"] || []
    if (lower.includes("housing")) return data.themenwolkeWords["Housing"] || []
    if (lower.includes("mobility")) return data.themenwolkeWords["Mobility"] || []
    return []
  }

  // Filter categories to only those containing keywords in the vocabulary sheet
  const categories = useMemo(() => {
    return Array.from(new Set(data.articles.map(a => a.category)))
      .filter(cat => getCandidateWords(cat).length > 0)
  }, [data.articles, data.themenwolkeWords])

  const [selectedCat, setSelectedCat] = useState(categories[0] || '')
  
  // Drilldown panel states
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTitle, setPanelTitle] = useState('')
  const [matchingArticles, setMatchingArticles] = useState<Article[]>([])
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)

  // Calculations deferred state to avoid blocking the main rendering thread
  const [isCalculating, setIsCalculating] = useState(true)
  const [calcResult, setCalcResult] = useState<CalculationResult | null>(null)

  useEffect(() => {
    if (isBodiesLoading) return

    setIsCalculating(true)

    // Defer computation by a short delay to let the loading view commit and spin instantly
    const timer = setTimeout(() => {
      const candidates = getCandidateWords(selectedCat)

      // Map German keyword candidates to localized display labels to merge duplicates
      const labelToDisplay = new Map<string, string>()
      const labelToGermanWords = new Map<string, string[]>()
      
      candidates.forEach(word => {
        const translation = data.translations[word] || ""
        const display = (language === 'en' && translation) ? translation : word
        const key = display.toLowerCase()
        
        labelToDisplay.set(key, display)
        const list = labelToGermanWords.get(key) || []
        if (!list.includes(word)) list.push(word)
        labelToGermanWords.set(key, list)
      })

      const uniqueDisplayKeys = Array.from(labelToGermanWords.keys())

      // Filter articles by category and map date sorting
      const categoryArticles: ArticleWithSearchText[] = data.articles
        .filter(a => a.category === selectedCat)
        .map(a => {
          const { bucket, sortVal } = getYearHalf(a.date)
          const bodyText = bodies?.[a.id] || ""
          const fullSearchText = `${a.title} ${a.description} ${bodyText}`.toLowerCase()
          return {
            ...a,
            bucket,
            sortVal,
            fullSearchText
          }
        })

      // Get min/max sort value to generate columns
      let minSort = Infinity
      let maxSort = -Infinity
      categoryArticles.forEach(a => {
        if (a.sortVal < minSort) minSort = a.sortVal
        if (a.sortVal > maxSort) maxSort = a.sortVal
      })

      // Generate complete time scale
      const timeScale: { bucket: string; sortVal: number }[] = []
      if (minSort !== Infinity && maxSort !== -Infinity) {
        for (let s = minSort; s <= maxSort; s++) {
          const year = Math.floor(s / 2)
          const half = s % 2 === 0 ? "H1" : "H2"
          timeScale.push({
            bucket: `${year}-${half}`,
            sortVal: s
          })
        }
      }

      // Count total articles published in this category in each time slot
      const totalArticlesPerSlot: Record<string, number> = {}
      timeScale.forEach(t => {
        totalArticlesPerSlot[t.bucket] = 0
      })
      categoryArticles.forEach(art => {
        if (totalArticlesPerSlot[art.bucket] !== undefined) {
          totalArticlesPerSlot[art.bucket]++
        }
      })

      // Apply Gaussian smoothing across neighboring slots for the baseline (denominator)
      // to counterbalance low-data eras and prevent mathematical spikes from single articles.
      const smoothedBaseline: Record<string, number> = {}
      const kernel = [0.15, 0.7, 0.15] // Simple local gaussian kernel (left, target, right)
      
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

        // Add a small global prior (e.g. 2 articles) to avoid dividing by 0 and suppress noise in dead eras
        smoothedBaseline[slot.bucket] = (weightedSum / (weightSum || 1)) + 2.0
      })

      // Count match occurrences grouped by localized display label
      const matchCounts: Record<string, number> = {}
      uniqueDisplayKeys.forEach(key => {
        const germanWords = labelToGermanWords.get(key) || []
        let count = 0
        categoryArticles.forEach(art => {
          const isMatch = germanWords.some(word => {
            const translation = data.translations[word] || ""
            return checkKeywordMatchBilingual(art.fullSearchText, word, translation)
          })
          if (isMatch) count++
        })
        if (count > 0) {
          matchCounts[key] = count
        }
      })

      // Select unique display labels from the curated list (sorted by count descending)
      const topDisplayKeys = Object.entries(matchCounts)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0])

      // Build grid counts and mapping
      const grid: Record<string, Record<string, number>> = {}
      const cellMatches: Record<string, Record<string, Article[]>> = {}
      let maxCellCount = 0

      topDisplayKeys.forEach(key => {
        grid[key] = {}
        cellMatches[key] = {}
        timeScale.forEach(t => {
          grid[key][t.bucket] = 0
          cellMatches[key][t.bucket] = []
        })
      })

      categoryArticles.forEach(art => {
        topDisplayKeys.forEach(key => {
          const germanWords = labelToGermanWords.get(key) || []
          const isMatch = germanWords.some(word => {
            const translation = data.translations[word] || ""
            return checkKeywordMatchBilingual(art.fullSearchText, word, translation)
          })

          if (isMatch) {
            grid[key][art.bucket]++
            cellMatches[key][art.bucket].push(art)
            if (grid[key][art.bucket] > maxCellCount) {
              maxCellCount = grid[key][art.bucket]
            }
          }
        })
      })

      // Build relative percentages using smoothed baseline
      const relativeGrid: Record<string, Record<string, string>> = {}
      const relativeWeights: Record<string, Record<string, number>> = {}
      let maxRelativeWeight = 0

      topDisplayKeys.forEach(key => {
        relativeGrid[key] = {}
        relativeWeights[key] = {}
        timeScale.forEach(t => {
          const count = grid[key][t.bucket] || 0
          if (count === 0) {
            relativeGrid[key][t.bucket] = ""
            relativeWeights[key][t.bucket] = 0
          } else {
            const baseline = smoothedBaseline[t.bucket] || 1
            const relativeFraction = count / baseline
            relativeWeights[key][t.bucket] = relativeFraction
            if (relativeFraction > maxRelativeWeight) {
              maxRelativeWeight = relativeFraction
            }
            
            // Format percentage display
            const rawPercent = (count / (totalArticlesPerSlot[t.bucket] || 1)) * 100
            relativeGrid[key][t.bucket] = `${rawPercent.toFixed(0)}%`
          }
        })
      })

      // Exclude empty time columns at the borders (Cropping)
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

      // Compress gaps of > 3 years (which translates to > 6 half-year buckets in sequence)
      // where every single bucket has absolutely zero matches.
      interface CroppedTimeScaleItem {
        bucket: string
        sortVal: number
        isGap?: boolean
        gapStart?: string
        gapEnd?: string
        spanCount?: number
      }
      const croppedTimeScale: CroppedTimeScaleItem[] = []
      let zeroMatchStreak: Array<{ bucket: string; sortVal: number }> = []

      const checkColumnHasMatches = (bucketName: string) => {
        return topDisplayKeys.some(key => (grid[key]?.[bucketName] || 0) > 0)
      }

      croppedTimeScaleRaw.forEach((col) => {
        const hasMatches = checkColumnHasMatches(col.bucket)
        
        if (!hasMatches) {
          zeroMatchStreak.push(col)
        } else {
          // If we had a streak of > 6 empty buckets, collapse it into a single gap column
          if (zeroMatchStreak.length > 6) {
            const startYear = zeroMatchStreak[0].bucket
            const endYear = zeroMatchStreak[zeroMatchStreak.length - 1].bucket
            croppedTimeScale.push({
              bucket: `gap-${startYear}-${endYear}`,
              sortVal: zeroMatchStreak[0].sortVal,
              isGap: true,
              gapStart: startYear,
              gapEnd: endYear,
              spanCount: zeroMatchStreak.length
            })
          } else {
            // Keep normal empty columns if the gap is short
            zeroMatchStreak.forEach(c => croppedTimeScale.push(c))
          }
          zeroMatchStreak = []
          croppedTimeScale.push(col)
        }
      })

      // Flush remaining streak if any
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
            spanCount: zeroMatchStreak.length
          })
        } else {
          zeroMatchStreak.forEach(c => croppedTimeScale.push(c))
        }
      }

      setCalcResult({
        labelToDisplay,
        categoryArticles,
        croppedTimeScale,
        topDisplayKeys,
        grid,
        cellMatches,
        maxCellCount,
        relativeGrid,
        relativeWeights,
        maxRelativeWeight
      })
      setIsCalculating(false)
    }, 40)

    return () => clearTimeout(timer)
  }, [selectedCat, data.articles, data.translations, bodies, language, isBodiesLoading])

  const handleCellClick = (displayKey: string, displayLabel: string, bucket: string) => {
    if (!calcResult) return
    const matches = (calcResult.cellMatches[displayKey] && calcResult.cellMatches[displayKey][bucket]) || []
    if (matches.length === 0) return
    
    // Sort matching list by date descending (newest first)
    const sorted = [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    setMatchingArticles(sorted)
    setSelectedArticle(sorted[0] || null)
    setPanelTitle(`${t('articlesCount', { count: sorted.length })}: "${displayLabel}" [${bucket}]`)
    setPanelOpen(true)
  }

  const handleRowClick = (displayKey: string, displayLabel: string) => {
    if (!calcResult) return
    // Gather all matching articles in this row across all time buckets
    const matches: Article[] = []
    const bucketRecords = calcResult.cellMatches[displayKey] || {}
    Object.values(bucketRecords).forEach(articles => {
      matches.push(...articles)
    })
    
    if (matches.length === 0) return
    
    // Sort matching list by date descending (newest first)
    const sorted = [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    setMatchingArticles(sorted)
    setSelectedArticle(sorted[0] || null)
    setPanelTitle(`${t('articlesCount', { count: sorted.length })}: "${displayLabel}" [All Time]`)
    setPanelOpen(true)
  }

  const handleColumnClick = (bucket: string) => {
    if (!calcResult) return
    // Show all articles in category matching the time-bucket
    const matches = calcResult.categoryArticles.filter(art => art.bucket === bucket)
    if (matches.length === 0) return

    // Sort matching list by date descending (newest first)
    const sorted = [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    setMatchingArticles(sorted)
    setSelectedArticle(sorted[0] || null)
    setPanelTitle(`${t('articlesCount', { count: sorted.length })}: [${bucket}]`)
    setPanelOpen(true)
  }

  // Convert localized display keys back to display labels for table headers
  const gridTranslations: Record<string, string> = {}
  if (calcResult) {
    calcResult.topDisplayKeys.forEach(key => {
      gridTranslations[key] = calcResult.labelToDisplay.get(key) || key
    })
  }

  const showLoading = isBodiesLoading || isCalculating || !calcResult

  return (
    <div className="h-full flex flex-col relative bg-[#121212] font-sans">
      {/* Toolbar Subheader */}
      <div className="bg-[#1e1e1e] border-b border-[#2e2e2e] px-8 py-3.5 shrink-0 flex flex-wrap items-center justify-between gap-4 z-35 select-none">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold uppercase text-gray-400 font-sans">{t('categoryLabel')}</span>
          </div>
          <div className="relative">
            <select 
              value={selectedCat} 
              onChange={(e) => {
                setSelectedCat(e.target.value)
                setPanelOpen(false)
              }}
              className="bg-[#2a2a2a] text-white px-3 py-1.5 pr-8 text-sm font-medium focus:outline-none appearance-none cursor-pointer font-sans"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Toggle buttons for view modes */}
          <div className="flex bg-[#2a2a2a] p-0.5" title={t('relativeModeDesc')}>
            <button
              onClick={() => setViewMode('absolute')}
              className={`px-3 py-1 text-xs font-semibold font-sans transition-colors ${
                viewMode === 'absolute' 
                  ? 'bg-cyan-500 text-black' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('absoluteMode')}
            </button>
            <button
              onClick={() => setViewMode('relative')}
              className={`px-3 py-1 text-xs font-semibold font-sans transition-colors ${
                viewMode === 'relative' 
                  ? 'bg-cyan-500 text-black' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('relativeMode')}
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500 font-medium">
          {t('heatmapHelp', { count: calcResult?.topDisplayKeys.length || 0 })}
        </div>
      </div>

      {/* Heatmap Grid Wrapper */}
      <div className="flex-grow flex flex-col min-h-0 select-none bg-[#121212]">
        {showLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold tracking-wider uppercase text-gray-500 animate-pulse">
              {isBodiesLoading ? "Loading Search Corpus..." : "Analyzing Trendmap Keywords..."}
            </span>
          </div>
        ) : calcResult.topDisplayKeys.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
            <Info className="w-8 h-8 text-gray-600" />
            <span>{t('noWords')}</span>
          </div>
        ) : (
          <HeatmapTable 
            topWords={calcResult.topDisplayKeys} 
            croppedTimeScale={calcResult.croppedTimeScale} 
            grid={calcResult.grid} 
            displayGrid={viewMode === 'relative' ? calcResult.relativeGrid : undefined}
            weightGrid={viewMode === 'relative' ? calcResult.relativeWeights : undefined}
            translations={gridTranslations} 
            maxCellCount={calcResult.maxCellCount} 
            maxDisplayWeight={viewMode === 'relative' ? calcResult.maxRelativeWeight : undefined}
            handleCellClick={handleCellClick} 
            handleRowClick={handleRowClick}
            handleColumnClick={handleColumnClick}
          />
        )}
      </div>

      <DetailPanel 
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        articlesList={matchingArticles}
        selectedArticle={selectedArticle}
        onSelectArticle={setSelectedArticle}
        title={panelTitle}
      />
    </div>
  )
}
export default Trendmap
