import React, { useState, useMemo } from 'react'
import { Search as SearchIcon, Filter, Clock, Info } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useData } from '../context'
import { useTranslation } from '../context'
import { fetchArticleBodies } from '../services/dataSource'
import { DetailPanel } from '../components/DetailPanel'
import type { Article } from '../types'

export const Search: React.FC = () => {
  const data = useData()
  const { t } = useTranslation()

  // State controls
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCat, setSelectedCat] = useState('All')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [includeFullText, setIncludeFullText] = useState(false)

  // Details overlay panel states
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)

  // Fetch full text corpus if full text search is enabled
  const { data: bodies, isLoading: isBodiesLoading } = useQuery({
    queryKey: ['articleBodies'],
    queryFn: fetchArticleBodies,
    enabled: includeFullText,
  })

  // List of unique categories
  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(data.articles.map(a => a.category)))]
  }, [data.articles])

  // Filter and sort results
  const filteredArticles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    
    let list = data.articles

    // 1. Filter by category
    if (selectedCat !== 'All') {
      list = list.filter(art => art.category === selectedCat)
    }

    // 2. Filter by search query
    if (q) {
      list = list.filter(art => {
        const titleMatch = art.title.toLowerCase().includes(q)
        const descMatch = art.description.toLowerCase().includes(q)
        
        if (titleMatch || descMatch) return true

        // Check full body text if enabled
        if (includeFullText && bodies) {
          const body = bodies[art.id] || ''
          return body.toLowerCase().includes(q)
        }

        return false
      })
    }

    // 3. Sort
    return [...list].sort((a, b) => {
      const timeA = new Date(a.date).getTime()
      const timeB = new Date(b.date).getTime()
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
    })
  }, [searchQuery, selectedCat, sortOrder, includeFullText, bodies, data.articles])

  const handleArticleClick = (art: Article) => {
    setSelectedArticle(art)
    setPanelOpen(true)
  }

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
            {filteredArticles.length} / {data.articles.length} {t('listView').toLowerCase()}
          </div>
        </div>

        {/* Toolbar / Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Query input */}
          <div className="md:col-span-5 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full bg-[#252525] border border-[#2e2e2e] text-white px-3 py-2 pl-9 text-sm focus:outline-none focus:border-cyan-500 placeholder-gray-500"
            />
            <SearchIcon className="w-4 h-4 text-gray-500 absolute left-3 top-3 pointer-events-none" />
          </div>

          {/* Category Filter */}
          <div className="md:col-span-3 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="w-full bg-[#252525] border border-[#2e2e2e] text-white px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? (t('overview') === 'Overview' ? 'All Categories' : 'Alle Kategorien') : cat}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div className="md:col-span-2 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="w-full bg-[#252525] border border-[#2e2e2e] text-white px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="newest">{t('newest')}</option>
              <option value="oldest">{t('oldest')}</option>
            </select>
          </div>

          {/* Full Text Toggle */}
          <div className="md:col-span-2 flex items-center justify-end">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeFullText}
                onChange={(e) => setIncludeFullText(e.target.checked)}
                className="bg-[#252525] border border-[#2e2e2e] text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span>{t('searchFullText')}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="flex-grow overflow-y-auto relative bg-[#121212]">
        {includeFullText && isBodiesLoading ? (
          <div className="absolute inset-0 z-10 bg-[#121212]/80 flex flex-col items-center justify-center text-gray-500 gap-4">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold tracking-wider uppercase text-gray-500 animate-pulse">Loading Corpus for Full-Text Search...</span>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
            <Info className="w-8 h-8 text-gray-600" />
            <span>{t('searchEmpty')}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#181818] border-b border-[#2e2e2e] text-gray-500">
                  <th className="p-3.5 font-bold uppercase tracking-wider w-24 font-mono">{t('published')}</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider w-48">{t('category')}</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider">{t('title')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {filteredArticles.map(art => (
                  <tr
                    key={art.id}
                    onClick={() => handleArticleClick(art)}
                    className="hover:bg-[#202020]/50 text-gray-300 cursor-pointer transition-colors border-b border-[#222]/50"
                  >
                    <td className="p-3.5 font-mono text-cyan-400">{art.date}</td>
                    <td className="p-3.5">
                      <span className="bg-[#3f51b5]/20 text-indigo-300 px-2 py-0.5 font-semibold text-[10px] font-mono tracking-wide uppercase">
                        {art.category}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="space-y-1">
                        <div className="font-bold text-white text-sm font-sans">{art.title}</div>
                        <div className="text-gray-500 line-clamp-1 max-w-4xl text-xs font-sans">{art.description}</div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
