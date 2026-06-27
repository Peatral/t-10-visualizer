import { useState, useMemo, useEffect, useRef } from 'react'
import { Info } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { useDebounce } from 'use-debounce'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useData } from '../context'
import { useTranslation } from '../context'
import { useTRPC } from '../utils/trpc'
import { DetailPanel } from '../components/DetailPanel'
import { SmartSearchInput } from '../components/SmartSearchInput'
import { parseSearchQuery } from '../utils/searchParser'
import type { Article } from '../types'

export const Search = () => {
  const data = useData()
  const { t } = useTranslation()
  const searchParams = useSearch({ from: '/search' })
  const navigate = useNavigate({ from: '/search' })
  const trpc = useTRPC()

  // Local state for immediate typing feedback
  const [localQuery, setLocalQuery] = useState(searchParams.q || '')

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

  // Details overlay panel states
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)

  // List of unique categories
  const categories = useMemo(() => {
    return [...data.categories]
  }, [data.categories])

  // Parse the query string into structured filters on the client
  const parsedFilters = useMemo(() => {
    return parseSearchQuery(debouncedQuery)
  }, [debouncedQuery])

  // Run SQLite index & FTS5 search on the serverless backend using useQuery + queryOptions
  const { data: filteredArticles = [], isLoading: isSearchLoading } = useQuery(
    trpc.searchArticles.queryOptions({
      q: parsedFilters.q,
      category: parsedFilters.category,
      sort: parsedFilters.sort,
      before: parsedFilters.before,
      after: parsedFilters.after,
      topic: parsedFilters.topic,
      includeFullText: true, // Always enable full text search
    })
  )

  const handleArticleClick = (art: Article) => {
    setSelectedArticle(art)
    setPanelOpen(true)
  }

  // --- Virtualization Setup (using @tanstack/react-virtual) ---
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: filteredArticles.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 64, // Approximate row height in pixels
    overscan: 10, // Render 10 items outside the viewport to prevent flickering
  })

  return (
    <div className="h-full flex flex-col bg-[#121212] select-none text-left font-sans">
      {/* Search Header and Search bar wrapper */}
      <div className="bg-[#1e1e1e] border-b border-[#2e2e2e] p-6 shrink-0 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">{t('searchTitle')}</h2>
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Article Index Search</span>
          </div>
          <div className="text-xs text-gray-400 font-medium font-mono bg-[#151515] px-3 py-1 border border-[#2e2e2e]">
            {filteredArticles.length} / {data.totalArticlesCount} {t('listView').toLowerCase()}
          </div>
        </div>

        {/* Unified Search Input and modifier hints */}
        <div className="space-y-3">
          <SmartSearchInput
            value={localQuery}
            onChange={handleQueryChange}
            categories={categories}
          />
          
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider select-none font-mono">
            <span className="text-cyan-500 font-bold">Search Modifiers:</span>
            <span>category:name</span>
            <span>topic:id</span>
            <span>after:YYYY-MM-DD</span>
            <span>before:YYYY-MM-DD</span>
            <span>sort:newest|oldest</span>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div 
        ref={scrollContainerRef} 
        className="flex-grow overflow-auto relative bg-[#121212]"
      >
        {isSearchLoading ? (
          <div className="absolute inset-0 z-10 bg-[#121212]/80 flex flex-col items-center justify-center text-gray-500 gap-4">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold tracking-wider uppercase text-gray-500 animate-pulse">Searching Articles...</span>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
            <Info className="w-8 h-8 text-gray-600" />
            <span>{t('searchEmpty')}</span>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse block">
            {/* Table Header - sticky to the top of the scrolling container */}
            <thead className="block sticky top-0 z-10 bg-[#181818] border-b border-[#2e2e2e] text-gray-500 w-full">
              <tr className="flex w-full">
                <th className="p-3.5 font-bold uppercase tracking-wider w-28 shrink-0 font-mono">{t('published')}</th>
                <th className="p-3.5 font-bold uppercase tracking-wider w-48 shrink-0">{t('category')}</th>
                <th className="p-3.5 font-bold uppercase tracking-wider flex-1">{t('title')}</th>
              </tr>
            </thead>
            
            {/* Virtualized Body Container */}
            <tbody 
              className="block relative w-full divide-y divide-[#222]"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const art = filteredArticles[virtualRow.index]
                if (!art) return null
                
                return (
                  <tr
                    key={art.id}
                    onClick={() => handleArticleClick(art)}
                    className="flex hover:bg-[#202020]/50 text-gray-300 cursor-pointer transition-colors border-b border-[#222]/50 absolute top-0 left-0 w-full"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <td className="p-3.5 font-mono text-cyan-400 w-28 shrink-0 flex items-center">{art.date}</td>
                    <td className="p-3.5 w-48 shrink-0 flex items-center">
                      <span className="bg-[#3f51b5]/20 text-indigo-300 px-2 py-0.5 font-semibold text-[10px] font-mono tracking-wide uppercase truncate">
                        {art.category}
                      </span>
                    </td>
                    <td className="p-3.5 flex-1 min-w-0 flex items-center">
                      <div className="space-y-1 w-full">
                        <div className="font-bold text-white text-sm font-sans truncate">{art.title}</div>
                        <div className="text-gray-500 line-clamp-1 max-w-4xl text-xs font-sans">{art.description}</div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <DetailPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        articlesList={filteredArticles}
        selectedArticle={selectedArticle}
        onSelectArticle={setSelectedArticle}
        title={t('detailTitle')}
      />
    </div>
  )
}

export default Search