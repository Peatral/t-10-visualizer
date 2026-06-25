import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { Navbar } from './components/Navbar'
import { Dashboard } from './pages/Dashboard'
import { Trendmap } from './pages/Trendmap'
import { Timeline } from './pages/Timeline'

const RootComponent = () => {
  return (
    <div className="h-full w-full flex flex-col bg-[#121212] text-[#e0e0e0]">
      <Navbar />
      <main className="flex-grow overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  )
}

const rootRoute = createRootRoute({
  component: RootComponent,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const trendmapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trendmap',
  component: Trendmap,
})

const timelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/timeline',
  component: Timeline,
})

const routeTree = rootRoute.addChildren([indexRoute, trendmapRoute, timelineRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
