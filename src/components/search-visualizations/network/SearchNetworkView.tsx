import React, { useState, useEffect, lazy, Suspense, useRef, useMemo, useCallback } from 'react'
import { Maximize2 } from 'lucide-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useTRPC } from '../../../utils/trpc'
import type { ParsedSearchQuery } from '../../../utils/searchParser'
import type { Language } from '../../../context'
import type { ForceGraphMethods } from 'react-force-graph-2d'
import type { Article } from '../../../server/db/schema'
import { useNetworkState } from './NetworkContext'

const ForceGraph2D = lazy(() => import('react-force-graph-2d'))

interface SearchNetworkViewProps {
  parsedFilters: ParsedSearchQuery;
  language: Language;
  onArticleClick?: (article: Article) => void;
  onCellClick?: (topicId: string, label: string, bucket: string) => void;
  onRowClick?: (topicId: string, label?: string) => void;
  onColumnClick?: (bucket: string) => void;
}

interface GraphNode {
  id: string;
  name?: string;
  val?: number;
  category?: string;
  categories?: Record<string, number>;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sFraction = s / 100
  const lFraction = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sFraction * Math.min(lFraction, 1 - lFraction)
  const f = (n: number) => lFraction - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4))
  }
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  weight?: number;
}

export function SearchNetworkView({ parsedFilters, language, onRowClick }: SearchNetworkViewProps) {
  const { weightFilter } = useNetworkState()
  const trpc = useTRPC()
  const [isMounted, setIsMounted] = useState(false)

  const fgRef = useRef<ForceGraphMethods | null>(null)
  const setForceGraphRef = useCallback((node: ForceGraphMethods | null) => {
    fgRef.current = node
    if (node) {
      node.d3Force('charge')?.strength(-2000)
      node.d3Force('link')?.distance(500)
      node.d3ReheatSimulation()
    }
  }, [])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const { data: graphData } = useSuspenseQuery(
    trpc.getTopicNetwork.queryOptions({
      q: parsedFilters.q,
      category: parsedFilters.category,
      before: parsedFilters.before,
      after: parsedFilters.after,
      topic: parsedFilters.topic,
      language: language,
    })
  )

  const filteredGraphData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] }
    
    // Filter links based on the weight threshold
    const filteredLinks = (graphData.links as GraphLink[]).filter((link: GraphLink) => {
      const weight = typeof link.weight === 'number' ? link.weight : 1
      return weight >= weightFilter
    })

    // Filter nodes to keep only those that have at least one active connection
    const activeNodeIds = new Set<string>()
    filteredLinks.forEach((link: GraphLink) => {
      const sourceId = typeof link.source === 'object' && link.source !== null ? link.source.id : (link.source as string)
      const targetId = typeof link.target === 'object' && link.target !== null ? link.target.id : (link.target as string)
      activeNodeIds.add(sourceId)
      activeNodeIds.add(targetId)
    })

    const filteredNodes = (graphData.nodes as GraphNode[]).filter((node: GraphNode) => activeNodeIds.has(node.id))

    return {
      nodes: filteredNodes,
      links: filteredLinks,
    }
  }, [graphData, weightFilter])

  const activeCategories = useMemo(() => {
    const cats = new Set<string>()
    filteredGraphData.nodes.forEach((node: GraphNode) => {
      if (node.categories) {
        Object.keys(node.categories).forEach(cat => {
          if (cat) cats.add(cat)
        })
      } else if (node.category) {
        cats.add(node.category)
      }
    })
    return Array.from(cats).sort()
  }, [filteredGraphData])

  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    const count = activeCategories.length
    activeCategories.forEach((cat, idx) => {
      // Equally space categories around the color wheel
      const hue = Math.round((idx * 360) / Math.max(1, count))
      map[cat.toLowerCase().trim()] = `hsl(${hue}, 65%, 60%)`
    })
    return map
  }, [activeCategories])

  const getCategoryColor = (category: string): string => {
    const normalized = category.toLowerCase().trim()
    return categoryColorMap[normalized] || '#9e9e9e'
  }

  const getCategoryRgb = (category: string): { r: number; g: number; b: number } => {
    const color = getCategoryColor(category)
    const hslMatch = /hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/.exec(color)
    if (hslMatch) {
      return hslToRgb(parseInt(hslMatch[1], 10), parseFloat(hslMatch[2]), parseFloat(hslMatch[3]))
    }
    return { r: 158, g: 158, b: 158 }
  }

  const getNodeColor = (node: GraphNode): string => {
    const cats = node.categories || {}
    const entries = Object.entries(cats)
    if (entries.length === 0) return '#9e9e9e'
    
    let totalWeight = 0
    let r = 0
    let g = 0
    let b = 0
    
    for (const [cat, weight] of entries) {
      const rgb = getCategoryRgb(cat)
      r += rgb.r * weight
      g += rgb.g * weight
      b += rgb.b * weight
      totalWeight += weight
    }
    
    if (totalWeight === 0) return '#9e9e9e'
    
    r = Math.round(r / totalWeight)
    g = Math.round(g / totalWeight)
    b = Math.round(b / totalWeight)
    
    return `rgb(${r}, ${g}, ${b})`
  }

  useEffect(() => {
    const fg = fgRef.current
    if (fg) {
      fg.d3Force('charge')?.strength(-2000)
      fg.d3Force('link')?.distance(500)
      fg.d3ReheatSimulation()
    }
  }, [filteredGraphData])

  if (!isMounted) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Initializing network layout...
      </div>
    )
  }

  if (filteredGraphData.nodes.length === 0) {
    return <div className="h-full flex items-center justify-center text-gray-500">No network data satisfies the current filter.</div>
  }

  return (
    <div className="w-full h-full bg-[#121212] relative">
      <button
        onClick={() => fgRef.current?.zoomToFit(400)}
        className="absolute top-4 right-4 z-10 p-2 bg-[#252525] border border-[#2e2e2e] hover:bg-[#333333] text-gray-400 hover:text-white transition-colors cursor-pointer"
        title={language === 'de' ? 'Ansicht zurücksetzen' : 'Recenter / Zoom to Fit'}
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>

      <div className="absolute bottom-4 left-4 z-10 p-4 bg-[#252525] border border-[#2e2e2e] w-44 space-y-3 select-none">
        <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
          {language === 'de' ? 'Kategorien' : 'Categories'}
        </h4>
        <div className="grid grid-cols-1 gap-2 font-sans text-[13px]">
          {activeCategories.map((cat) => (
            <div key={cat} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(cat) }} />
              <span className="text-gray-300">{cat}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0 bg-gradient-to-r from-[#5c6bc0] via-[#26a69a] to-[#ffb74d]" />
            <span className="text-gray-300">{language === 'de' ? 'Gemischt' : 'Blended'}</span>
          </div>
        </div>
      </div>

      <Suspense fallback={<div className="h-full flex items-center justify-center text-gray-500">Loading graph engine...</div>}>
        <ForceGraph2D
          key={JSON.stringify(parsedFilters)}
          ref={setForceGraphRef}
          graphData={filteredGraphData}
          linkVisibility={false}
          nodeLabel="name"
          nodeVal="val"
          linkWidth={(link) => Math.sqrt(link.weight || 1) * 1.5}
          linkColor={() => 'rgba(255, 255, 255, 0.15)'}
          nodeColor={getNodeColor}
          onNodeClick={(node) => onRowClick && onRowClick(node.id as string)}
        />
      </Suspense>
    </div>
  )
}
