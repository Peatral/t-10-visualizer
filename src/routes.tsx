import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { Dashboard } from './pages/Dashboard'
import { Trendmap } from './pages/Trendmap'
import { Timeline } from './pages/Timeline'
import { Search } from './pages/Search'

import { RootLayout } from './components/RootLayout'

const rootRoute = createRootRoute({
  component: RootLayout,
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

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: Search,
})

const routeTree = rootRoute.addChildren([indexRoute, trendmapRoute, timelineRoute, searchRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
