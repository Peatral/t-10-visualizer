import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useQuery } from '@tanstack/react-query'

import { useTRPC } from '../utils/trpc'
import { DataContext, LanguageProvider } from '../context'
import Navbar from '../components/Navbar'

import '../index.css'

const RootLayout = () => {
  const trpcUtils = useTRPC()
  
  // Fetch global data right at the root of the router
  const { data, error, isLoading } = useQuery(
    trpcUtils.getDataPayload.queryOptions()
  )

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

  // Once data is loaded, wrap the layout in your providers
  return (
    <DataContext.Provider value={data}>
      <LanguageProvider>
        <div className="h-full w-full flex flex-col bg-[#121212] text-[#e0e0e0]">
          <Navbar />
          <main className="flex-grow overflow-hidden relative">
            <Outlet />
          </main>
        </div>
        <TanStackRouterDevtools position="bottom-right" />
      </LanguageProvider>
    </DataContext.Provider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})