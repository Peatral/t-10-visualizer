import React, { useState, useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '../utils/trpc'
import { TopicTag } from './TopicTag'
import { CategoryBadge } from './CategoryBadge'
import { 
  MoveVertical, 
  Maximize2, 
  Minimize2, 
  List, 
  Clock, 
  ArrowUpRight 
} from 'lucide-react'
import { DataSet } from 'vis-data'
import { Timeline } from 'vis-timeline'
import { useTranslation } from '../context'
import type { Article } from '../types'

interface DetailPanelProps {
  isOpen: boolean
  onClose: () => void
  articlesList: Article[]
  selectedArticle: Article | null
  onSelectArticle: (article: Article) => void
  title: string
  defaultView?: 'list' | 'mini-timeline'
  hideList?: boolean
  isLoading?: boolean
}

export const DetailPanel: React.FC<DetailPanelProps> = ({
  isOpen,
  onClose,
  articlesList,
  selectedArticle,
  onSelectArticle,
  title,
  defaultView = 'list',
  hideList = false,
  isLoading = false
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [panelHeight, setPanelHeight] = useState(380)
  const [leftColWidth, setLeftColWidth] = useState(35) // percentage
  const [viewMode, setViewMode] = useState<'list' | 'mini-timeline'>(defaultView)
  const { t } = useTranslation()
  const trpc = useTRPC()

  // On-demand body text loading
  const { data: detailData, isLoading: isDetailLoading } = useQuery(
    trpc.getArticleDetail.queryOptions(
      { id: selectedArticle?.id || '' },
      { enabled: !!selectedArticle?.id }
    )
  )

  // On-demand topics loading in parallel
  const { data: topicsData } = useQuery(
    trpc.getArticleTopics.queryOptions(
      { id: selectedArticle?.id || '' },
      { enabled: !!selectedArticle?.id }
    )
  )
  
  const panelRef = useRef<HTMLDivElement>(null)
  const verticalDragRef = useRef<HTMLDivElement>(null)
  const horizontalDragRef = useRef<HTMLDivElement>(null)
  const miniTimelineRef = useRef<HTMLDivElement>(null)
  const miniTimelineInstance = useRef<Timeline | null>(null)

  // Vertical Resize Handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isCollapsed) return
      const newHeight = window.innerHeight - e.clientY
      if (newHeight > 150 && newHeight < window.innerHeight * 0.85) {
        setPanelHeight(newHeight)
      }
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.classList.remove('select-none')
    }

    const handleMouseDown = () => {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      document.body.classList.add('select-none')
    }

    const dragEl = verticalDragRef.current
    if (dragEl) {
      dragEl.addEventListener('mousedown', handleMouseDown)
    }

    return () => {
      if (dragEl) {
        dragEl.removeEventListener('mousedown', handleMouseDown)
      }
    }
  }, [isOpen, isCollapsed])

  // Horizontal Resize Handler
  useEffect(() => {
    if (hideList) return
    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return
      const rect = panelRef.current.getBoundingClientRect()
      const relativeX = e.clientX - rect.left
      const newPercentage = (relativeX / rect.width) * 100
      if (newPercentage > 15 && newPercentage < 80) {
        setLeftColWidth(newPercentage)
      }
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.classList.remove('select-none')
    }

    const handleMouseDown = () => {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      document.body.classList.add('select-none')
    }

    const dragEl = horizontalDragRef.current
    if (dragEl) {
      dragEl.addEventListener('mousedown', handleMouseDown)
    }

    return () => {
      if (dragEl) {
        dragEl.removeEventListener('mousedown', handleMouseDown)
      }
    }
  }, [isOpen, hideList])

  // Mini Timeline Instantiation
  useEffect(() => {
    if (hideList || isCollapsed || !isOpen || viewMode !== 'mini-timeline' || !miniTimelineRef.current) {
      if (miniTimelineInstance.current) {
        miniTimelineInstance.current.destroy()
        miniTimelineInstance.current = null
      }
      return
    }

    if (miniTimelineInstance.current) {
      miniTimelineInstance.current.destroy()
      miniTimelineInstance.current = null
    }

    const sorted = [...articlesList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    interface VisTimelineItem {
      id: number
      content: string
      start: string
      rawArticle: Article
    }

    const visItems = sorted.map((art, idx) => ({
      id: idx,
      content: art.title,
      start: art.date,
      rawArticle: art
    }))

    const items = new DataSet<VisTimelineItem>(visItems)
    const options = {
      width: '100%',
      height: '100%',
      margin: {
        item: {
          horizontal: 5,
          vertical: 5
        }
      },
      stack: true,
      maxHeight: '100%'
    }

    const timeline = new Timeline(miniTimelineRef.current, items, options)
    miniTimelineInstance.current = timeline

    timeline.on('select', (properties) => {
      if (properties.items.length > 0) {
        const selectedId = properties.items[0] as number
        const item = items.get(selectedId)
        if (item && item.rawArticle) {
          onSelectArticle(item.rawArticle)
        }
      }
    })

    // Highlight selected article in mini timeline
    if (selectedArticle) {
      const selectedIndex = sorted.findIndex(a => a.link === selectedArticle.link)
      if (selectedIndex !== -1) {
        timeline.setSelection(selectedIndex)
      }
    }

    return () => {
      if (miniTimelineInstance.current) {
        miniTimelineInstance.current.destroy()
        miniTimelineInstance.current = null
      }
    }
  }, [hideList, viewMode, articlesList, isOpen, isCollapsed, selectedArticle, onSelectArticle])

  if (!isOpen) return null

  return (
    <div 
      ref={panelRef}
      style={{ height: isCollapsed ? '41px' : `${panelHeight}px` }}
      className="fixed bottom-0 left-0 right-0 bg-[#1e1e1e] border-t border-[#333] z-50 flex flex-col transition-[height] duration-250 ease-out shadow-2xl font-sans"
    >
      {/* Panel Resize Handle / Top Bar */}
      <div 
        ref={verticalDragRef}
        className="h-10 bg-[#1c1c1c] border-b border-[#2e2e2e] flex items-center justify-between px-6 cursor-row-resize select-none shrink-0 group"
      >
        <div className="flex items-center gap-2">
          <MoveVertical className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#00bcd4]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-400 hover:text-white p-1 hover:bg-[#2c2c2c] transition-colors cursor-pointer"
            title={isCollapsed ? "Expand panel" : "Collapse panel"}
          >
            {isCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white font-bold text-sm px-1.5 py-0.5 hover:bg-red-950 hover:text-red-400 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Panel Body */}
      {!isCollapsed && (
        <div className="flex-grow flex overflow-hidden relative">
          {isLoading && (
            <div className="absolute inset-0 z-50 bg-[#1e1e1e]/85 flex flex-col items-center justify-center text-gray-500 gap-3">
              <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Loading articles...</span>
            </div>
          )}
          {/* Left Column: List or Mini-Timeline (Only shown when hideList is false) */}
          {!hideList && (
            <>
              <div 
                style={{ width: `${leftColWidth}%` }}
                className="border-r border-[#2e2e2e] p-5 overflow-y-auto flex flex-col shrink-0"
              >
                <div className="flex items-center justify-between mb-4 border-b border-[#2e2e2e] pb-2 shrink-0">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
                    {t('articlesCount', { count: articlesList.length })}
                  </h3>
                  
                  <div className="flex bg-[#252525] p-0.5 text-xs">
                    <button 
                      onClick={() => setViewMode('list')}
                      className={`px-2 py-1 flex items-center gap-1.5 transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-[#3f51b5] text-white font-medium' : 'text-gray-400 hover:text-white'}`}
                    >
                      <List className="w-3.5 h-3.5" /> {t('listView')}
                    </button>
                    <button 
                      onClick={() => setViewMode('mini-timeline')}
                      className={`px-2 py-1 flex items-center gap-1.5 transition-colors cursor-pointer ${viewMode === 'mini-timeline' ? 'bg-[#3f51b5] text-white font-medium' : 'text-gray-400 hover:text-white'}`}
                    >
                      <Clock className="w-3.5 h-3.5" /> {t('timelineView')}
                    </button>
                  </div>
                </div>

                {/* List View */}
                {viewMode === 'list' && (
                  <ul className="space-y-2 overflow-y-auto flex-grow pr-1">
                    {articlesList.map((art, idx) => (
                      <li 
                        key={idx}
                        onClick={() => onSelectArticle(art)}
                        className={`p-3 text-sm cursor-pointer transition-colors ${
                          selectedArticle?.link === art.link 
                            ? 'bg-[#3f51b5] text-white font-medium' 
                            : 'bg-[#252525] text-gray-300 hover:bg-[#2e2e2e] hover:text-[#03a9f4]'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <span className="font-semibold truncate flex-grow text-left">{art.title}</span>
                          <span className="text-[10px] text-cyan-400 shrink-0 font-mono mt-0.5">{art.date}</span>
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-1 text-left">{art.description}</p>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Mini Vis-Timeline View */}
                {viewMode === 'mini-timeline' && (
                  <div className="flex-grow relative overflow-hidden bg-[#121212]">
                    <div ref={miniTimelineRef} className="h-full w-full" />
                  </div>
                )}
              </div>

              {/* Drag Resizer Line */}
              <div 
                ref={horizontalDragRef}
                className="w-1.5 bg-[#2e2e2e] hover:bg-[#00bcd4] cursor-col-resize select-none shrink-0 transition-colors flex items-center justify-center"
              >
              </div>
            </>
          )}

          {/* Right Column: Article Details */}
          <div 
            style={{ width: hideList ? '100%' : `${100 - leftColWidth}%` }}
            className="p-6 overflow-y-auto flex flex-col text-left font-sans"
          >
            {selectedArticle ? (
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1 leading-snug">{selectedArticle.title}</h2>
                    <div className="text-cyan-400 text-xs font-semibold mb-2">Published: {selectedArticle.date}</div>
                  </div>
                  <Link
                    to="/article/$articleId"
                    params={{ articleId: selectedArticle.id }}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#252525] hover:bg-[#323232] border border-[#2e2e2e] text-white hover:text-cyan-400 font-medium text-xs transition-colors rounded shadow-sm cursor-pointer"
                  >
                    <span>Open Full Page</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryBadge category={selectedArticle.category} variant="small" />
                    {topicsData && topicsData.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {topicsData.map((topic: any) => (
                          <TopicTag 
                            key={topic.topicId}
                            nameDe={topic.nameDe}
                            nameEn={topic.nameEn}
                            topicId={topic.topicId}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-gray-300 text-sm leading-relaxed max-w-4xl">
                  {selectedArticle.description}
                </div>

                <div className="text-sm">
                  <strong className="text-gray-400 mr-2">{t('source')}</strong>
                  <a 
                    href={selectedArticle.link} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[#03a9f4] hover:underline hover:text-cyan-300 break-all font-mono text-xs inline-flex items-center gap-1"
                  >
                    {selectedArticle.link} <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>

                <div className="border-t border-[#333] pt-4 mt-6">
                  <h4 className="text-xs text-gray-500 font-semibold mb-3">{t('fullContent')}</h4>
                  {isDetailLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-sans">
                      <div className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading full text...</span>
                    </div>
                  ) : (() => {
                    const rawText = detailData?.bodyText || '';
                    const isGolemCookieWall = rawText.includes('Besuchen Sie Golem.de wie gewohnt mit Werbung und Tracking') || rawText.includes('Golem pur ab 3 Euro');
                    const isJapanTimesExpired = rawText.includes('The article you have been looking for has expired') || rawText.includes('newswire licensing terms');
                    const isKyodoExpired = rawText.includes('Sorry, this article was first published more than three months ago');

                    if (isGolemCookieWall) {
                      return (
                        <div className="bg-[#2a1b1b] border border-[#5c2d2d] p-4 text-sm text-gray-300 font-sans">
                          <p className="font-semibold text-amber-400 mb-2">Content Scrape Notice:</p>
                          <p className="mb-3">The full text of this Golem.de article could not be scraped due to cookie banner / paywall protections. Please read the full article directly on the source website:</p>
                          <a 
                            href={selectedArticle.link} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3f51b5] text-white hover:bg-[#4d62cd] font-medium text-xs transition-colors"
                          >
                            Open on Golem.de <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )
                    }

                    if (isJapanTimesExpired) {
                      return (
                        <div className="bg-[#2a1b1b] border border-[#5c2d2d] p-4 text-sm text-gray-300 font-sans">
                          <p className="font-semibold text-amber-400 mb-2">Content Scrape Notice:</p>
                          <p className="mb-3">This Japan Times article has expired due to licensing agreements and is no longer available on their system. You can attempt to access it directly:</p>
                          <a 
                            href={selectedArticle.link} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3f51b5] text-white hover:bg-[#4d62cd] font-medium text-xs transition-colors"
                          >
                            Open on Japan Times <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )
                    }

                    if (isKyodoExpired) {
                      return (
                        <div className="bg-[#2a1b1b] border border-[#5c2d2d] p-4 text-sm text-gray-300 font-sans">
                          <p className="font-semibold text-amber-400 mb-2">Content Scrape Notice:</p>
                          <p className="mb-3">This article from Kyodo News has been archived/hidden behind a paid membership system. You can view the source directly:</p>
                          <a 
                            href={selectedArticle.link} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3f51b5] text-white hover:bg-[#4d62cd] font-medium text-xs transition-colors"
                          >
                            Open on Kyodo News <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )
                    }

                    return detailData?.bodyText ? (
                      <div className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                        {detailData.bodyText}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-xs italic font-sans">No full content text available.</div>
                    )
                  })()}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 italic text-sm font-sans">
                {t('selectArticle')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
export default DetailPanel
