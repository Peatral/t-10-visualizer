import { 
  useState, 
  useMemo, 
  useEffect, 
  Suspense, 
  useEffectEvent,
} from 'react'
import { Info, List, Clock, LayoutGrid, ChevronDown } from 'lucide-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useSearch, useNavigate, createFileRoute } from '@tanstack/react-router'
import { useDebounce } from 'use-debounce'
import { type Language } from '../context'
import { useTranslation } from '../context'
import { useTRPC } from '../utils/trpc'
import { SmartSearchInput } from '../components/SmartSearchInput'
import { parseSearchQuery, stringifySearchQuery, type ParsedSearchQuery } from '../utils/searchParser'
import { SearchListView } from '../components/SearchListView'
import { SearchTimelineView } from '../components/SearchTimelineView'
import { SearchHeatmapView } from '../components/SearchHeatmapView'
import type { Article } from '../server/db/schema'
import { z } from 'zod'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { TranslationKey } from '../context/LanguageContext'

const searchSchema = z.object({
  q: z.string().optional().catch(''),
  category: z.string().optional().catch('All'),
  fulltext: z.boolean().optional().catch(false),
  view: z.enum(['list', 'timeline', 'heatmap']).optional().catch('list'),
})

export const Route = createFileRoute('/search')({
  validateSearch: (search) => searchSchema.parse(search),
  component: Search,
})

interface SearchResultsProps {
  parsedFilters: ParsedSearchQuery;
  sortBy: 'newest' | 'oldest';
  viewMode: 'list' | 'timeline' | 'heatmap';
  heatmapScaleMode: 'absolute' | 'relative';
  language: Language;  
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  onArticleClick: (article: Article) => void;
  onCellClick: (topicId: string, label: string, bucket: string) => void;
  onRowClick: (topicId: string, label?: string) => void;
  onColumnClick: (bucket: string) => void;
}

function SearchResults({ 
  parsedFilters, 
  sortBy, 
  viewMode, 
  heatmapScaleMode,
  language,
  onArticleClick,
  onCellClick,
  onRowClick,
  onColumnClick,
  t
}: SearchResultsProps) {
  const trpc = useTRPC()

  const { data: filteredArticles } = useSuspenseQuery(
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

  if (filteredArticles.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
        <Info className="w-8 h-8 text-gray-600" />
        <span>{t('searchEmpty')}</span>
      </div>
    )
  }

  if (viewMode === 'heatmap') {
    return (
      <SearchHeatmapView
        parsedFilters={parsedFilters}
        language={language}
        heatmapScaleMode={heatmapScaleMode}
        handleCellClick={onCellClick}
        handleRowClick={onRowClick}
        handleColumnClick={onColumnClick}
      />
    )
  }

  if (viewMode === 'timeline') {
    return (
      <SearchTimelineView
        articles={filteredArticles}
        onArticleClick={onArticleClick}
      />
    )
  }

  return (
    <SearchListView
      articles={filteredArticles}
      onArticleClick={onArticleClick}
    />
  )
}

function Search() {
  const { t, language } = useTranslation()
  const searchParams = useSearch({ from: '/search' })
  const navigate = useNavigate({ from: '/search' })

  const [localQuery, setLocalQuery] = useState(searchParams.q || '')
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'heatmap'>(searchParams.view || 'list')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest')
  const [heatmapScaleMode, setHeatmapScaleMode] = useState<'absolute' | 'relative'>('absolute')
  const [debouncedQuery] = useDebounce(localQuery, 400)

  const syncViewToUrl = useEffectEvent((newViewMode: 'list' | 'timeline' | 'heatmap') => {
    if (searchParams.view !== newViewMode) {
      navigate({ search: (prev) => ({ ...prev, view: newViewMode }), replace: true })
    }
  })

  const syncUrlToView = useEffectEvent((urlViewMode?: 'list' | 'timeline' | 'heatmap') => {
    if (urlViewMode && urlViewMode !== viewMode) {
      setViewMode(urlViewMode)
    }
  })
  const syncQueryToUrl = useEffectEvent((newQuery: string) => {
    if ((searchParams.q || '') !== newQuery) {
      navigate({ search: (prev) => ({ ...prev, q: newQuery || undefined }), replace: true })
    }
  })


  useEffect(() => {
    syncViewToUrl(viewMode)
  }, [viewMode]) // Only triggers when local viewMode changes

  useEffect(() => {
    syncUrlToView(searchParams.view)
  }, [searchParams.view]) // Only triggers when URL view changes

  useEffect(() => {
    syncQueryToUrl(debouncedQuery)
  }, [debouncedQuery]) // Only triggers when debounced input changes

  useEffect(() => {
    setLocalQuery(searchParams.q || '')
  }, [searchParams.q])

  const parsedFilters = useMemo(() => parseSearchQuery(debouncedQuery), [debouncedQuery])

  const handleArticleClick = (art: Article) => {
    navigate({ to: '/articles/$articleId', params: { articleId: art.id } })
  }

  const updateSearchWithBucket = (topicId: string | null, bucket?: string) => {
    const parsed = parseSearchQuery(localQuery)
    if (topicId) parsed.topic = topicId
    
    if (bucket) {
      const [yearStr, half] = bucket.split('-')
      const year = parseInt(yearStr, 10)
      parsed.after = half === 'H1' ? `${year}-01-01` : `${year}-07-01`
      parsed.before = half === 'H1' ? `${year}-06-30` : `${year}-12-31`
    }
    
    setLocalQuery(stringifySearchQuery(parsed))
    setViewMode('list')
  }

  return (
    <div className="h-full flex flex-col bg-[#121212] select-none text-left font-sans">
      <div className="bg-[#1e1e1e] border-b border-[#2e2e2e] p-6 shrink-0 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">{t('searchTitle')}</h2>
          </div>

          <div className="flex bg-[#252525] p-0.5 text-xs select-none self-start sm:self-center">
            {(['list', 'timeline', 'heatmap'] as const).map((mode) => (
              <button 
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer capitalize ${viewMode === mode ? 'bg-[#3f51b5] text-white font-medium' : 'text-gray-400 hover:text-white'}`}
              >
                {mode === 'list' && <List className="w-3.5 h-3.5" />}
                {mode === 'timeline' && <Clock className="w-3.5 h-3.5" />}
                {mode === 'heatmap' && <LayoutGrid className="w-3.5 h-3.5" />}
                {t(`${mode}View`) || mode}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <SmartSearchInput
                value={localQuery}
                onChange={setLocalQuery}
              />
            </div>

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

            {viewMode === 'heatmap' && (
              <div className="shrink-0 flex bg-[#252525] p-0.5 text-[10px] font-semibold">
                <button onClick={() => setHeatmapScaleMode('absolute')} className={`px-2.5 py-1 ${heatmapScaleMode === 'absolute' ? 'bg-[#3f51b5] text-white font-bold' : 'text-gray-400 hover:text-white'}`}>{t('absoluteMode') || 'Absolute'}</button>
                <button onClick={() => setHeatmapScaleMode('relative')} className={`px-2.5 py-1 ${heatmapScaleMode === 'relative' ? 'bg-[#3f51b5] text-white font-bold' : 'text-gray-400 hover:text-white'}`}>{t('relativeMode') || 'Relative'}</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-auto relative bg-[#121212]">
        <Suspense fallback={
          <div className="h-full flex items-center justify-center text-gray-400">
            <LoadingSpinner text={viewMode === 'heatmap' ? 'Calculating Heatmap...' : 'Searching...'} />
          </div>
        }>
          <SearchResults 
            parsedFilters={parsedFilters}
            sortBy={sortBy}
            viewMode={viewMode}
            heatmapScaleMode={heatmapScaleMode}
            language={language}
            t={t}
            onArticleClick={handleArticleClick}
            onCellClick={(topicId: string, _label: string, bucket: string) => updateSearchWithBucket(topicId, bucket)}
            onRowClick={(topicId: string) => updateSearchWithBucket(topicId)}
            onColumnClick={(bucket: string) => updateSearchWithBucket(null, bucket)}
          />
        </Suspense>
      </div>
    </div>
  )
}
