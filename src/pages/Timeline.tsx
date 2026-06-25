import React, { useState, useEffect, useRef } from 'react'
import { Filter, ChevronDown } from 'lucide-react'
import { DataSet } from 'vis-data'
import { Timeline as VisTimeline } from 'vis-timeline'
import { useData } from '../context/DataContext'
import { useTranslation } from '../context/LanguageContext'
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

  // Filter articles based on selected category
  const activeArticles = selectedCat === "All"
    ? data.articles
    : data.articles.filter(a => a.category === selectedCat)

  useEffect(() => {
    if (!timelineRef.current) return

    // Clear previous timeline instance if any
    if (timelineInstance.current) {
      timelineInstance.current.destroy()
      timelineInstance.current = null
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

    const items = new DataSet(visItems)

    const options = {
      width: '100%',
      height: '100%',
      margin: {
        item: {
          horizontal: 10,
          vertical: 10
        }
      },
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
        const selectedId = properties.items[0]
        const item = items.get(selectedId) as any
        if (item && item.rawArticle) {
          setSelectedArticle(item.rawArticle)
          setPanelOpen(true)
        }
      }
    })

    return () => {
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
      <div className="flex-grow relative overflow-hidden">
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
