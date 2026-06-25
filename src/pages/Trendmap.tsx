import React, { useState } from 'react'
import { Filter, ChevronDown, Info } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchArticleBodies } from '../services/dataSource'
import { useData } from '../context/DataContext'
import { useTranslation } from '../context/LanguageContext'
import type { Article } from '../types'
import { getYearHalf, checkKeywordMatchBilingual } from '../utils/matching'
import { HeatmapTable } from '../components/HeatmapTable'
import { DetailPanel } from '../components/DetailPanel'

export const Trendmap: React.FC = () => {
  const data = useData()
  const { t, language } = useTranslation()

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
  const categories = Array.from(new Set(data.articles.map(a => a.category)))
    .filter(cat => getCandidateWords(cat).length > 0)

  const [selectedCat, setSelectedCat] = useState(categories[0] || '')
  
  // Drilldown panel states
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTitle, setPanelTitle] = useState('')
  const [matchingArticles, setMatchingArticles] = useState<Article[]>([])
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)

  const candidates = getCandidateWords(selectedCat)

  // Map German keyword candidates to localized display labels to merge duplicates (e.g. English "car")
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
  const categoryArticles = data.articles
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

  // Count match occurrences grouped by localized display label
  const matchCounts: Record<string, number> = {}
  uniqueDisplayKeys.forEach(key => {
    const germanWords = labelToGermanWords.get(key) || []
    let count = 0
    categoryArticles.forEach(art => {
      // Check if this article matches any of the grouped German words (or English equivalents)
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

  // Select top 30 unique display labels
  const topDisplayKeys = Object.entries(matchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
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

  const croppedTimeScale = lastActiveIdx >= firstActiveIdx 
    ? timeScale.slice(firstActiveIdx, lastActiveIdx + 1)
    : timeScale

  const handleCellClick = (displayKey: string, displayLabel: string, bucket: string) => {
    const matches = (cellMatches[displayKey] && cellMatches[displayKey][bucket]) || []
    if (matches.length === 0) return
    
    // Sort matching list by date descending (newest first)
    const sorted = [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    setMatchingArticles(sorted)
    setSelectedArticle(sorted[0] || null)
    setPanelTitle(`${t('articlesCount', { count: sorted.length })}: "${displayLabel}" [${bucket}]`)
    setPanelOpen(true)
  }

  // Convert localized display keys back to display labels for table headers
  const gridTranslations: Record<string, string> = {}
  topDisplayKeys.forEach(key => {
    gridTranslations[key] = labelToDisplay.get(key) || key
  })

  return (
    <div className="h-full flex flex-col relative bg-[#121212] font-sans">
      {/* Toolbar Subheader */}
      <div className="bg-[#1e1e1e] border-b border-[#2e2e2e] px-8 py-3.5 shrink-0 flex items-center justify-between z-35 select-none">
        <div className="flex items-center gap-4">
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
        </div>

        <div className="text-xs text-gray-500 font-medium">
          {t('heatmapHelp', { count: topDisplayKeys.length })}
        </div>
      </div>

      {/* Heatmap Grid Wrapper */}
      <div className="flex-grow flex flex-col min-h-0 select-none bg-[#121212]">
        {isBodiesLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold tracking-wider uppercase text-gray-500 animate-pulse">Analyzing Trendmap Keywords...</span>
          </div>
        ) : topDisplayKeys.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
            <Info className="w-8 h-8 text-gray-600" />
            <span>{t('noWords')}</span>
          </div>
        ) : (
          <HeatmapTable 
            topWords={topDisplayKeys} 
            croppedTimeScale={croppedTimeScale} 
            grid={grid} 
            translations={gridTranslations} 
            maxCellCount={maxCellCount} 
            handleCellClick={handleCellClick} 
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
