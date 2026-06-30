import { 
  useState, 
  useMemo, 
  useEffect, 
  Suspense, 
  useEffectEvent,
  Activity,
} from 'react'
import { Info, List, Clock, LayoutGrid, Network, type LucideIcon } from 'lucide-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useSearch, useNavigate, createFileRoute } from '@tanstack/react-router'
import { useDebounce } from 'use-debounce'
import { type Language } from '../context'
import { useTranslation } from '../context'
import { useTRPC } from '../utils/trpc'
import { SmartSearchInput } from '../components/SmartSearchInput'
import { parseSearchQuery, stringifySearchQuery, type ParsedSearchQuery } from '../utils/searchParser'
import { 
  SearchListView, ListStateProvider, ListControls, useListState,
  SearchTimelineView,
  SearchHeatmapView, HeatmapStateProvider, HeatmapControls,
  SearchNetworkView, NetworkStateProvider, NetworkControls 
} from '../components/search-visualizations'
import type { Article } from '../server/db/schema'
import { z } from 'zod'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { TranslationKey } from '../context/LanguageContext'

const viewModes = ['list', 'timeline', 'heatmap', 'network'] as const;

const viewModeSchema = z.enum(viewModes);
type ViewMode = z.infer<typeof viewModeSchema>;

const searchSchema = z.object({
  q: z.string().optional().catch(''),
  category: z.string().optional().catch(undefined),
  fulltext: z.boolean().optional().catch(false),
  view: viewModeSchema.optional().catch('list'),
})

export const Route = createFileRoute('/search')({
  validateSearch: (search) => searchSchema.parse(search),
  component: Search,
})

interface ViewportProps {
  parsedFilters: ParsedSearchQuery;
  language: Language;
  onArticleClick: (article: Article) => void;
  onCellClick: (topicId: string, label: string, bucket: string) => void;
  onRowClick: (topicId: string, label?: string) => void;
  onColumnClick: (bucket: string) => void;
}

interface ControlsProps {
  language: Language;
}

interface VisualizationConfig {
  id: ViewMode;
  labelKey: TranslationKey;
  icon: LucideIcon;
  Provider?: React.ComponentType<{ children: React.ReactNode }>;
  component: React.ComponentType<ViewportProps>;
  controlsComponent?: React.ComponentType<ControlsProps>;
}

const VISUALIZATIONS: VisualizationConfig[] = [
  {
    id: 'list',
    labelKey: 'listView',
    icon: List,
    Provider: ListStateProvider,
    component: SearchListView,
    controlsComponent: ListControls,
  },
  {
    id: 'timeline',
    labelKey: 'timelineView',
    icon: Clock,
    component: SearchTimelineView,
  },
  {
    id: 'heatmap',
    labelKey: 'heatmapView',
    icon: LayoutGrid,
    Provider: HeatmapStateProvider,
    component: SearchHeatmapView,
    controlsComponent: HeatmapControls,
  },
  {
    id: 'network',
    labelKey: 'networkView',
    icon: Network,
    Provider: NetworkStateProvider,
    component: SearchNetworkView,
    controlsComponent: NetworkControls,
  },
];

interface ProvidersProps {
  children: React.ReactNode;
}

export function VisualizationProviders({ children }: ProvidersProps) {
  return VISUALIZATIONS.reduceRight((acc, viz) => {
    if (viz.Provider) {
      const Provider = viz.Provider;
      return <Provider>{acc}</Provider>;
    }
    return acc;
  }, children);
}

interface ActiveControlsProps {
  viewMode: ViewMode;
  language: Language;
}

export function ActiveControls({ viewMode, language }: ActiveControlsProps) {
  const activeViz = VISUALIZATIONS.find((v) => v.id === viewMode);
  if (!activeViz?.controlsComponent) return null;
  const ControlsComponent = activeViz.controlsComponent;
  return <ControlsComponent language={language} />;
}

interface ViewportContainerProps {
  viewMode: ViewMode;
  parsedFilters: ParsedSearchQuery;
  language: Language;
  onArticleClick: (article: Article) => void;
  onCellClick: (topicId: string, label: string, bucket: string) => void;
  onRowClick: (topicId: string, label?: string) => void;
  onColumnClick: (bucket: string) => void;
}

export function ViewportContainer({
  viewMode,
  parsedFilters,
  language,
  onArticleClick,
  onCellClick,
  onRowClick,
  onColumnClick,
}: ViewportContainerProps) {
  return (
    <>
      {VISUALIZATIONS.map((viz) => {
        const ViewportComponent = viz.component;
        return (
          <Activity key={viz.id} mode={viewMode === viz.id ? 'visible' : 'hidden'}>
            <Suspense fallback={
              <div className="h-full flex items-center justify-center text-gray-500">
                <LoadingSpinner text={language === 'de' ? 'Lädt...' : 'Loading...'} />
              </div>
            }>
              <ViewportComponent
                parsedFilters={parsedFilters}
                language={language}
                onArticleClick={onArticleClick}
                onCellClick={onCellClick}
                onRowClick={onRowClick}
                onColumnClick={onColumnClick}
              />
            </Suspense>
          </Activity>
        );
      })}
    </>
  );
}

function SearchContent() {
  const { t, language } = useTranslation()
  const searchParams = useSearch({ from: '/search' })
  const navigate = useNavigate({ from: '/search' })

  const [localQuery, setLocalQuery] = useState(searchParams.q || '')
  const [viewMode, setViewMode] = useState<ViewMode>(searchParams.view || 'list')
  const [debouncedQuery] = useDebounce(localQuery, 400)

  const syncViewToUrl = useEffectEvent((newViewMode: ViewMode) => {
    if (searchParams.view !== newViewMode) {
      navigate({ search: (prev) => ({ ...prev, view: newViewMode }), replace: true })
    }
  })

  const syncUrlToView = useEffectEvent((urlViewMode?: ViewMode) => {
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
  }, [viewMode])

  useEffect(() => {
    syncUrlToView(searchParams.view)
  }, [searchParams.view])

  useEffect(() => {
    syncQueryToUrl(debouncedQuery)
  }, [debouncedQuery])

  useEffect(() => {
    setLocalQuery(searchParams.q || '')
  }, [searchParams.q])

  const parsedFilters = useMemo(() => parseSearchQuery(debouncedQuery), [debouncedQuery])

  const listState = useListState()
  const sortBy = listState ? listState.sortBy : 'newest'
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

  const isEmpty = filteredArticles.length === 0

  return (
    <div className="h-full flex flex-col bg-[#121212] select-none text-left font-sans">
      <div className="bg-[#1e1e1e] border-b border-[#2e2e2e] p-6 shrink-0 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">{t('searchTitle')}</h2>
          </div>

          <div className="flex bg-[#252525] p-0.5 text-xs select-none self-start sm:self-center">
            {VISUALIZATIONS.map((viz) => (
              <button 
                key={viz.id}
                onClick={() => setViewMode(viz.id)}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer capitalize ${viewMode === viz.id ? 'bg-[#3f51b5] text-white font-medium' : 'text-gray-400 hover:text-white'}`}
              >
                <viz.icon className="w-3.5 h-3.5" />
                {t(viz.labelKey) || viz.id}
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

            <ActiveControls viewMode={viewMode} language={language} />
          </div>
        </div>
      </div>

      <div className="grow overflow-auto relative bg-[#121212]">
        <Suspense fallback={
          <div className="h-full flex items-center justify-center text-gray-400">
            <LoadingSpinner text={viewMode === 'heatmap' ? 'Calculating Heatmap...' : viewMode === 'timeline' ? 'Loading Timeline...' : 'Searching...'} />
          </div>
        }>
          {isEmpty ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
              <Info className="w-8 h-8 text-gray-600" />
              <span>{t('searchEmpty')}</span>
            </div>
          ) : (
            <ViewportContainer
              viewMode={viewMode}
              parsedFilters={parsedFilters}
              language={language}
              onArticleClick={handleArticleClick}
              onCellClick={(topicId: string, _label: string, bucket: string) => updateSearchWithBucket(topicId, bucket)}
              onRowClick={(topicId: string) => updateSearchWithBucket(topicId)}
              onColumnClick={(bucket: string) => updateSearchWithBucket(null, bucket)}
            />
          )}
        </Suspense>
      </div>
    </div>
  )
}

export function Search() {
  return (
    <VisualizationProviders>
      <SearchContent />
    </VisualizationProviders>
  )
}
