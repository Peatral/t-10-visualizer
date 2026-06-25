import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Filter, ChevronDown } from 'lucide-react'
import { DataSet } from 'vis-data'
import { Timeline as VisTimeline } from 'vis-timeline'
import { useData } from '../context'
import { useTranslation } from '../context'
import type { Article } from '../types'
import { DetailPanel } from '../components/DetailPanel'

export const Timeline: React.FC = () => {
  const data = useData()
  const { t } = useTranslation()
  const timelineRef = useRef<HTMLDivElement>(null)
  const timelineInstance = useRef<VisTimeline | null>(null)

  // Find unique categories available
  const categories = ["All", ...Array.from(new Set(data.articles.map(a => a.category)))]
  const [selectedCat, setSelectedCat] = useState("All")

  // Drilldown overlay panel states
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)

  // Non-blocking initialization states
  const [isInitializing, setIsInitializing] = useState(true)

  // Filter articles based on selected category (memoized to keep reference stable)
  const activeArticles = useMemo(() => {
    return selectedCat === "All"
      ? data.articles
      : data.articles.filter(a => a.category === selectedCat)
  }, [selectedCat, data.articles])

  useEffect(() => {
    if (!timelineRef.current) return

    setIsInitializing(true)

    // Clear previous timeline instance immediately
    if (timelineInstance.current) {
      timelineInstance.current.destroy()
      timelineInstance.current = null
    }

    // Defer the heavy DOM attachment and Vis rendering to let the loader mount instantly
    const timer = setTimeout(() => {
      if (!timelineRef.current) return

      interface VisTimelineItem {
        id: number
        content: string
        start: string
        rawIndex: number
        rawArticle: Article
      }

      // Map articles to Vis DataSet items
      const visItems = activeArticles.map((art, index) => ({
        id: index,
        content: art.title,
        start: art.date,
        // Metadata payload
        rawIndex: index,
        rawArticle: art
      }))

      const items = new DataSet<VisTimelineItem>(visItems)

      // Optimize options for maximum drag performance (point render type, throttled redraws)
      const options = {
        width: '100%',
        height: '100%',
        margin: {
          item: {
            horizontal: 6,
            vertical: 4
          }
        },
        type: 'point' as const, // Points render significantly faster than default boxed styles
        throttleRedraw: 20, // Throttles redraw operations during panning/zooming to avoid frame drops
        stack: true,
        maxHeight: '100%',
        zoomMin: 1000 * 60 * 60 * 24 * 30, // 30 days
        zoomMax: 1000 * 60 * 60 * 24 * 365 * 40 // 40 years
      }

      const timeline = new VisTimeline(timelineRef.current, items, options)
      timelineInstance.current = timeline

      // Add selection handler
      timeline.on('select', (properties) => {
        if (properties.items.length > 0) {
          const selectedId = properties.items[0] as number
          const item = items.get(selectedId)
          if (item && item.rawArticle) {
            setSelectedArticle(item.rawArticle)
            setPanelOpen(true)
          }
        }
      })

      setIsInitializing(false)
    }, 60)

    return () => {
      clearTimeout(timer)
      if (timelineInstance.current) {
        timelineInstance.current.destroy()
        timelineInstance.current = null
      }
    }
  }, [activeArticles])

  return (
    <div className="h-full flex flex-col relative bg-[#121212] font-sans">
      {/* Category selector subheader */}
      <div className="bg-[#1e1e1e] border-b border-[#2e2e2e] px-8 py-3.5 shrink-0 flex items-center justify-between z-30 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold uppercase text-gray-400 font-sans">{t('timelineGroup')}</span>
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
                <option key={cat} value={cat}>{cat === "All" ? (t('overview') === "Overview" ? "All" : "Alle") : cat}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        <div className="text-xs text-gray-500 font-medium">
          {t('timelineHelp')}
        </div>
      </div>

      {/* Vis Timeline Container */}
      <div className="flex-grow relative overflow-hidden bg-[#121212]">
        {/* Loading overlay for non-blocking mounting */}
        {isInitializing && (
          <div className="absolute inset-0 z-40 bg-[#121212] flex flex-col items-center justify-center text-gray-500 gap-4">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold tracking-wider uppercase text-gray-500 animate-pulse">Initializing Timeline...</span>
          </div>
        )}
        <div ref={timelineRef} className="h-full w-full" />
      </div>

      <DetailPanel 
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        articlesList={selectedArticle ? [selectedArticle] : []}
        selectedArticle={selectedArticle}
        onSelectArticle={setSelectedArticle}
        title={t('detailTitle')}
        defaultView="list"
        hideList={true}
      />
    </div>
  )
}
export default Timeline
