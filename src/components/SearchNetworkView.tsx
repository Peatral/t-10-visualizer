import { useState, useEffect, lazy, Suspense } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useTRPC } from '../utils/trpc'
import type { ParsedSearchQuery } from '../utils/searchParser'
import type { Language } from '../context'

const ForceGraph2D = lazy(() => import('react-force-graph-2d'))

interface SearchNetworkViewProps {
  parsedFilters: ParsedSearchQuery;
  language: Language;
  onNodeClick: (topicId: string) => void;
}

export function SearchNetworkView({ parsedFilters, language, onNodeClick }: SearchNetworkViewProps) {
  const trpc = useTRPC()
  const [isMounted, setIsMounted] = useState(false)

  // 2. Client-side guard
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

  // 3. Server-side / Hydration fallback
  // Because the server returns here, the React.lazy import is NEVER triggered on the server.
  if (!isMounted) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Initializing network layout...
      </div>
    )
  }

  if (graphData.nodes.length === 0) {
    return <div className="h-full flex items-center justify-center text-gray-500">No network data available.</div>
  }

  return (
    <div className="w-full h-full bg-[#121212]">
      {/* 4. Suspense boundary required for React.lazy */}
      <Suspense fallback={<div className="h-full flex items-center justify-center text-gray-500">Loading graph engine...</div>}>
        <ForceGraph2D
          graphData={graphData}
          nodeLabel="name"
          nodeVal="val"
          linkWidth={(link) => Math.sqrt(link.weight)}
          linkColor={() => '#2e2e2e'}
          nodeColor={() => '#3f51b5'}
          onNodeClick={(node) => onNodeClick(node.id as string)}
          
          // --- NEW PERFORMANCE PROPS --- //
          
          // 1. Run the physics engine for 150 ticks in the background BEFORE rendering
          warmupTicks={150}
          
          // 2. Stop the physics simulation completely after the initial layout
          cooldownTicks={0} 
          
          // 3. Optional: Make the nodes draggable but freeze them again when dropped
          onEngineStop={() => {
            // This tells the graph to stop calculating physics once the layout is done
          }}
        />
      </Suspense>
    </div>
  )
}