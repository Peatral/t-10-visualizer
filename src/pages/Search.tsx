import { useState, useMemo, useEffect } from 'react'
import { Info, List, Clock, LayoutGrid, ChevronDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { useDebounce } from 'use-debounce'
import { useData } from '../context'
import { useTranslation } from '../context'
import { useTRPC } from '../utils/trpc'
import { SmartSearchInput } from '../components/SmartSearchInput'
import { parseSearchQuery, stringifySearchQuery } from '../utils/searchParser'
import { SearchListView } from '../components/SearchListView'
import { SearchTimelineView } from '../components/SearchTimelineView'
import { SearchHeatmapView } from '../components/SearchHeatmapView'
import type { Article } from '../types'

export const Search = () => {
  const data = useData()
  const { t, language } = useTranslation()
  const searchParams = useSearch({ from: '/search' })
  const navigate = useNavigate({ from: '/search' })
  const trpc = useTRPC()

  // Local state for immediate typing feedback
  const [localQuery, setLocalQuery] = useState(searchParams.q || '')

  // View state: list, timeline, or heatmap (initialized from URL search param)
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'heatmap'>(searchParams.view || 'list')

  // Sync viewMode changes back to URL search params
  useEffect(() => {
    if (searchParams.view !== viewMode) {
      navigate({
        search: (prev) => ({
          ...prev,
          view: viewMode,
        }),
        replace: true,
      })
    }
  }, [viewMode, searchParams.view, navigate])

  // Sync viewMode from URL when it changes externally
  useEffect(() => {
    if (searchParams.view && searchParams.view !== viewMode) {
      setViewMode(searchParams.view)
    }
  }, [searchParams.view])

  // Sorting state for the list view
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest')

  // Heatmap mode: absolute vs relative scale weighting
  const [heatmapScaleMode, setHeatmapScaleMode] = useState<'absolute' | 'relative'>('absolute')

  // Derive debounced query from the local state
  const [debouncedQuery] = useDebounce(localQuery, 400)

  // Sync local query input only if the URL param changes externally (e.g. browser back/forward)
  useEffect(() => {
    setLocalQuery(searchParams.q || '')
  }, [searchParams.q])

  // Sync debounced query changes back to URL search params
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

  // Event handler for typing changes
  const handleQueryChange = (value: string) => {
    setLocalQuery(value)
  }

  // List of unique categories
  const categories = useMemo(() => {
    return [...data.categories]
  }, [data.categories])

  // Parse the query string into structured filters on the client
  const parsedFilters = useMemo(() => {
    return parseSearchQuery(debouncedQuery)
  }, [debouncedQuery])

  // Run SQLite index & FTS5 search on the serverless backend
  const { data: filteredArticles = [], isLoading: isSearchLoading } = useQuery(
    trpc.searchArticles.queryOptions({
      q: parsedFilters.q,
      category: parsedFilters.category,
      sort: sortBy,
      before: parsedFilters.before,
      after: parsedFilters.after,
      topic: parsedFilters.topic,
      includeFullText: true,
    })
  )

  // Run dynamic Trendmap grid calculation ONLY for currently found search subset
  const { data: trendmapResult, isLoading: isHeatmapLoading } = useQuery({
    ...trpc.getTrendmapGrid.queryOptions({
      category: parsedFilters.category || 'All',
      language,
      q: parsedFilters.q,
      before: parsedFilters.before,
      after: parsedFilters.after,
      topic: parsedFilters.topic,
    }),
    enabled: viewMode === 'heatmap'
  })

  const handleArticleClick = (art: Article) => {
    navigate({ to: '/article/$articleId', params: { articleId: art.id } })
  }

  // Heatmap Cell, Row, and Column click interactions to modify search query filters
  const handleCellClick = (topicId: string, _displayLabel: string, bucket: string) => {
    const parsed = parseSearchQuery(localQuery)
    parsed.topic = topicId
    const [yearStr, half] = bucket.split('-')
    const year = parseInt(yearStr, 10)
    parsed.after = half === 'H1' ? `${year}-01-01` : `${year}-07-01`
    parsed.before = half === 'H1' ? `${year}-06-30` : `${year}-12-31`
    
    const newQueryStr = stringifySearchQuery(parsed)
    setLocalQuery(newQueryStr)
    setViewMode('list')
  }

  const handleRowClick = (topicId: string, _displayLabel: string) => {
    const parsed = parseSearchQuery(localQuery)
    parsed.topic = topicId
    const newQueryStr = stringifySearchQuery(parsed)
    setLocalQuery(newQueryStr)
    setViewMode('list')
  }

  const handleColumnClick = (bucket: string) => {
    const parsed = parseSearchQuery(localQuery)
    const [yearStr, half] = bucket.split('-')
    const year = parseInt(yearStr, 10)
    parsed.after = half === 'H1' ? `${year}-01-01` : `${year}-07-01`
    parsed.before = half === 'H1' ? `${year}-06-30` : `${year}-12-31`
    
    const newQueryStr = stringifySearchQuery(parsed)
    setLocalQuery(newQueryStr)
    setViewMode('list')
  }

  return (
    <div className="h-full flex flex-col bg-[#121212] select-none text-left font-sans">
      {/* Search Header and Search bar wrapper */}
      <div className="bg-[#1e1e1e] border-b border-[#2e2e2e] p-6 shrink-0 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">{t('searchTitle')}</h2>
          </div>

          {/* View mode switcher */}
          <div className="flex bg-[#252525] p-0.5 text-xs select-none self-start sm:self-center">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-[#3f51b5] text-white font-medium' : 'text-gray-400 hover:text-white'}`}
            >
              <List className="w-3.5 h-3.5" /> {t('listView')}
            </button>
            <button 
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer ${viewMode === 'timeline' ? 'bg-[#3f51b5] text-white font-medium' : 'text-gray-400 hover:text-white'}`}
            >
              <Clock className="w-3.5 h-3.5" /> {t('timelineView')}
            </button>
            <button 
              onClick={() => setViewMode('heatmap')}
              className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer ${viewMode === 'heatmap' ? 'bg-[#3f51b5] text-white font-medium' : 'text-gray-400 hover:text-white'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Heatmap
            </button>
          </div>
        </div>

        {/* Unified Search Input and toolbar options */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <SmartSearchInput
                value={localQuery}
                onChange={handleQueryChange}
                categories={categories}
              />
            </div>

            {/* List View dedicated sorting dropdown */}
            {viewMode === 'list' && (
              <div className="shrink-0 flex items-center gap-2 bg-[#252525] px-3 py-1.5 border border-[#2e2e2e]">
                <span className="text-[11px] text-gray-400 font-medium font-mono">{t('sortBy')}:</span>
                <div className="relative">
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
                    className="bg-[#1a1a1a] text-white pl-2 pr-6 py-0.5 text-xs font-semibold focus:outline-none appearance-none cursor-pointer font-sans"
                  >
                    <option value="newest">{t('newest')}</option>
                    <option value="oldest">{t('oldest')}</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-1.5 top-1 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Heatmap dedicated absolute/relative switch */}
            {viewMode === 'heatmap' && (
              <div className="shrink-0 flex bg-[#252525] p-0.5 text-[10px] font-semibold">
                <button
                  onClick={() => setHeatmapScaleMode('absolute')}
                  className={`px-2.5 py-1 ${heatmapScaleMode === 'absolute' ? 'bg-[#3f51b5] text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                >
                  {t('absoluteMode') || 'Absolute'}
                </button>
                <button
                  onClick={() => setHeatmapScaleMode('relative')}
                  className={`px-2.5 py-1 ${heatmapScaleMode === 'relative' ? 'bg-[#3f51b5] text-white font-bold' : 'text-gray-400 hover:text-white'}`}
                >
                  {t('relativeMode') || 'Relative'}
                </button>
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-semibold text-gray-500 select-none font-mono">
            <span className="text-cyan-500 font-bold">Search Modifiers:</span>
            <span>category:name</span>
            <span>topic:id</span>
            <span>after:YYYY-MM-DD</span>
            <span>before:YYYY-MM-DD</span>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="flex-grow overflow-auto relative bg-[#121212]">
        {isSearchLoading ? (
          <div className="absolute inset-0 z-10 bg-[#121212]/80 flex flex-col items-center justify-center text-gray-500 gap-4">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-gray-500 animate-pulse">Searching Articles...</span>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
            <Info className="w-8 h-8 text-gray-600" />
            <span>{t('searchEmpty')}</span>
          </div>
        ) : viewMode === 'list' ? (
          <SearchListView
            articles={filteredArticles}
            onArticleClick={handleArticleClick}
          />
        ) : viewMode === 'timeline' ? (
          <SearchTimelineView
            articles={filteredArticles}
            onArticleClick={handleArticleClick}
          />
        ) : (
          <SearchHeatmapView
            trendmapResult={trendmapResult}
            heatmapScaleMode={heatmapScaleMode}
            isHeatmapLoading={isHeatmapLoading}
            handleCellClick={handleCellClick}
            handleRowClick={handleRowClick}
            handleColumnClick={handleColumnClick}
          />
        )}
      </div>
    </div>
  )
}

export default Search