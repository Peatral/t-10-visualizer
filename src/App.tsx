import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RouterProvider } from '@tanstack/react-router'
import { DataContext } from './context/DataContext'
import { LanguageProvider } from './context/LanguageContext'
import { fetchDataPayload, fetchArticleBodies } from './services/dataSource'
import { router } from './routes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
})

function VisualizerApp() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['dataPayload'],
    queryFn: fetchDataPayload,
  })

  // Prefetch large article bodies payload in the background as soon as app metadata resolves
  useQuery({
    queryKey: ['articleBodies'],
    queryFn: fetchArticleBodies,
    enabled: !!data,
    staleTime: Infinity, // Static asset, cache indefinitely
  })

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#121212] text-[#e0e0e0] p-6 text-center font-sans">
        <div className="bg-red-950/20 border border-red-800 p-6 rounded-lg max-w-md">
          <h3 className="text-red-400 font-bold text-lg mb-2">Failed to Load Visualizer Data</h3>
          <p className="text-sm text-gray-400 mb-4">{error.message}</p>
          <div className="text-xs text-gray-500 leading-relaxed">
            Ensure that Deno has built the bundled <code className="text-gray-300">mega-visualizer/public/data.json</code> file by running the data preparation script.
          </div>
        </div>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#121212] text-[#e0e0e0] gap-4 font-sans">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold tracking-wider uppercase text-gray-500 animate-pulse">Loading Visualizer...</span>
      </div>
    )
  }

  return (
    <DataContext.Provider value={data}>
      <LanguageProvider>
        <RouterProvider router={router} />
      </LanguageProvider>
    </DataContext.Provider>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <VisualizerApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
