import React, { useState, useMemo, useEffect } from 'react'
import { Filter, Info, Search as SearchIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { useDebounce } from 'use-debounce'
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
  
  const searchParams = useSearch({ from: '/trendmap' })
  const navigate = useNavigate({ from: '/trendmap' })
  const [viewMode, setViewMode] = useState<'absolute' | 'relative'>('absolute')

  // Filter categories to only those containing keywords in the vocabulary sheet, plus 'All'
  const categories = useMemo(() => {
    const filtered = data.categories.filter(cat => {
      const lower = cat.toLowerCase()
      return lower.includes("energy") || lower.includes("food") || lower.includes("housing") || lower.includes("mobility")
    })
    return ['All', ...filtered]
  }, [data.categories])

  const selectedCat = searchParams.category || 'All'

  // Local state for search query typing
  const [localQuery, setLocalQuery] = useState(searchParams.q || '')
  const [debouncedQuery] = useDebounce(localQuery, 400)

  // Sync query input externally
  useEffect(() => {
    setLocalQuery(searchParams.q || '')
  }, [searchParams.q])

  // Sync debounced search query to URL
  useEffect(() => {
    if ((searchParams.q || '') !== debouncedQuery) {
      navigate({
        search: (prev) => ({
          ...prev,
          q: debouncedQuery || undefined,
        }),
        replace: true,
      })
    }
  }, [debouncedQuery, searchParams.q, navigate])

  const updateSearch = (updates: Partial<typeof searchParams>) => {
    navigate({
      search: (prev) => ({
        ...prev,
        ...updates,
      }),
      replace: true,
    })
  }

  // Drilldown panel and lazy querying states
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTitle, setPanelTitle] = useState('')
  const [matchingArticles, setMatchingArticles] = useState<Article[]>([])
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)

  const [clickedDetails, setClickedDetails] = useState<{
    type: 'cell' | 'row' | 'column'
    topicId?: string
    displayLabel?: string
    bucket?: string
  } | null>(null)

  // Fetch the dynamic Trendmap grid from the server on the fly
  const { data: calcResult, isLoading: isCalcLoading } = useQuery({
    ...trpcUtils.getTrendmapGrid.queryOptions({ 
      category: selectedCat, 
      language,
      q: debouncedQuery,
    }),
    enabled: !!selectedCat,
  })

  // Dynamic Detail articles list loader
  const { data: detailArticles = [], isFetching: isDetailFetching } = useQuery({
    queryKey: ['trendmapDetails', clickedDetails, selectedCat, debouncedQuery],
    queryFn: async () => {
      if (!clickedDetails) return []
      if (clickedDetails.type === 'cell') {
        return await trpcUtils.client.getTrendmapCellArticles.query({
          category: selectedCat,
          topicId: clickedDetails.topicId!,
          bucket: clickedDetails.bucket!,
          q: debouncedQuery,
        })
      } else if (clickedDetails.type === 'row') {
        return await trpcUtils.client.getTrendmapRowArticles.query({
          category: selectedCat,
          topicId: clickedDetails.topicId!,
          q: debouncedQuery,
        })
      } else {
        return await trpcUtils.client.getTrendmapColumnArticles.query({
          category: selectedCat,
          bucket: clickedDetails.bucket!,
          q: debouncedQuery,
        })
      }
    },
    enabled: !!clickedDetails,
  })

  // Sync loaded detail articles to state
  useEffect(() => {
    if (clickedDetails && detailArticles) {
      setMatchingArticles(detailArticles as Article[])
      setSelectedArticle(detailArticles[0] as Article || null)
    }
  }, [detailArticles, clickedDetails])

  const handleCellClick = (topicId: string, displayLabel: string, bucket: string) => {
    setPanelTitle(`${t('articlesCount', { count: 0 })}: "${displayLabel}" [${bucket}]`)
    setClickedDetails({ type: 'cell', topicId, displayLabel, bucket })
    setPanelOpen(true)
  }

  const handleRowClick = (topicId: string, displayLabel: string) => {
    setPanelTitle(`${t('articlesCount', { count: 0 })}: "${displayLabel}" [All Time]`)
    setClickedDetails({ type: 'row', topicId, displayLabel })
    setPanelOpen(true)
  }

  const handleColumnClick = (bucket: string) => {
    setPanelTitle(`${t('articlesCount', { count: 0 })}: [${bucket}]`)
    setClickedDetails({ type: 'column', bucket })
    setPanelOpen(true)
  }

  // Update panel title with real count once loaded
  useEffect(() => {
    if (clickedDetails && !isDetailFetching) {
      const count = detailArticles.length
      if (clickedDetails.type === 'cell') {
        setPanelTitle(`${t('articlesCount', { count })}: "${clickedDetails.displayLabel}" [${clickedDetails.bucket}]`)
      } else if (clickedDetails.type === 'row') {
        setPanelTitle(`${t('articlesCount', { count })}: "${clickedDetails.displayLabel}" [All Time]`)
      } else {
        setPanelTitle(`${t('articlesCount', { count })}: [${clickedDetails.bucket}]`)
      }
    }
  }, [detailArticles, isDetailFetching, clickedDetails, t])

  const showLoading = isCalcLoading || !calcResult

  return (
    <div className="h-full flex flex-col relative bg-[#121212] font-sans">
      {/* Search Header Toolbar */}
      <div className="bg-[#1e1e1e] border-b border-[#2e2e2e] p-6 shrink-0 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">{t('heatmapTitle')}</h2>
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Dynamic Topic Visualizer</span>
          </div>
          {!showLoading && (
            <div className="text-xs text-gray-400 font-medium font-mono bg-[#151515] px-3 py-1 border border-[#2e2e2e]">
              {calcResult.topDisplayKeys.length} {t('heatmapLabel') || 'Topics'}
            </div>
          )}
        </div>

        {/* Toolbar Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Query input */}
          <div className="md:col-span-6 relative">
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder={t('trendmapSearchPlaceholder')}
              className="w-full bg-[#252525] border border-[#2e2e2e] text-white px-3 py-2 pl-9 text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-500"
            />
            <SearchIcon className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
          </div>

          {/* Category Filter */}
          <div className="md:col-span-3 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              value={selectedCat}
              onChange={(e) => {
                updateSearch({ category: e.target.value })
                setPanelOpen(false)
              }}
              className="w-full bg-[#252525] border border-[#2e2e2e] text-white px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? (t('overview') === 'Overview' ? 'All Categories' : 'Alle Kategorien') : cat}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle buttons for view modes */}
          <div className="md:col-span-3 flex items-center justify-start">
            <div className="flex bg-[#252525] border border-[#2e2e2e] p-0.5" title={t('relativeModeDesc')}>
              <button
                onClick={() => setViewMode('absolute')}
                className={`px-3 py-1.5 text-xs font-semibold font-sans transition-colors ${
                  viewMode === 'absolute' 
                    ? 'bg-cyan-500 text-black' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t('absoluteMode')}
              </button>
              <button
                onClick={() => setViewMode('relative')}
                className={`px-3 py-1.5 text-xs font-semibold font-sans transition-colors ${
                  viewMode === 'relative' 
                    ? 'bg-cyan-500 text-black' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t('relativeMode')}
              </button>
            </div>
          </div>
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
            topicKeywords={calcResult.topicKeywords}
            labelToDisplay={calcResult.labelToDisplay}
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
        onClose={() => {
          setPanelOpen(false)
          setClickedDetails(null)
        }}
        articlesList={matchingArticles}
        selectedArticle={selectedArticle}
        onSelectArticle={setSelectedArticle}
        title={panelTitle}
        isLoading={isDetailFetching}
      />
    </div>
  )
}

export default Trendmap
