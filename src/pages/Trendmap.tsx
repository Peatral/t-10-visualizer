import React, { useState, useMemo } from 'react'
import { Filter, ChevronDown, Info } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useData } from '../context'
import { useTranslation } from '../context'
import { useTRPC } from '../utils/trpc'
import type { Article } from '../types'
import { HeatmapTable } from '../components/HeatmapTable'
import { DetailPanel } from '../components/DetailPanel'

export const Trendmap: React.FC = () => {
  const data = useData()
  const { t, language } = useTranslation()
  const trpcUtils = useTRPC()
  const [viewMode, setViewMode] = useState<'absolute' | 'relative'>('absolute')

  // Filter categories to only those containing keywords in the vocabulary sheet
  const categories = useMemo(() => {
    return data.categories.filter(cat => {
      const lower = cat.toLowerCase()
      return lower.includes("energy") || lower.includes("food") || lower.includes("housing") || lower.includes("mobility")
    })
  }, [data.categories])

  const [selectedCat, setSelectedCat] = useState(categories[0] || '')
  
  // Drilldown panel states
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTitle, setPanelTitle] = useState('')
  const [matchingArticles, setMatchingArticles] = useState<Article[]>([])
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)

  // Fetch the pre-calculated Trendmap grid from the server
  const { data: calcResult, isLoading: isCalcLoading } = useQuery({
    ...trpcUtils.getTrendmapGrid.queryOptions({ category: selectedCat, language }),
    enabled: !!selectedCat,
  })

  const handleCellClick = (displayKey: string, displayLabel: string, bucket: string) => {
    if (!calcResult) return
    const matches = (calcResult.cellMatches[displayKey] && calcResult.cellMatches[displayKey][bucket]) || []
    if (matches.length === 0) return
    
    // Sort matching list by date descending (newest first)
    const sorted = [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    setMatchingArticles(sorted as Article[])
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
      matches.push(...(articles as Article[]))
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

    setMatchingArticles(sorted as Article[])
    setSelectedArticle(sorted[0] || null)
    setPanelTitle(`${t('articlesCount', { count: sorted.length })}: [${bucket}]`)
    setPanelOpen(true)
  }

  // Convert localized display keys back to display labels for table headers
  const gridTranslations: Record<string, string> = {}
  if (calcResult) {
    calcResult.topDisplayKeys.forEach(key => {
      gridTranslations[key] = calcResult.labelToDisplay[key] || key
    })
  }

  const showLoading = isCalcLoading || !calcResult

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
              Analyzing Trendmap Keywords...
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
