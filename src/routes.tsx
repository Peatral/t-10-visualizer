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

const trendmapSchema = z.object({
  q: z.string().optional().catch(''),
  category: z.string().optional().catch(''),
  fulltext: z.boolean().optional().catch(false),
})

const trendmapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trendmap',
  validateSearch: (search) => trendmapSchema.parse(search),
  component: Trendmap,
})

const timelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/timeline',
  component: Timeline,
})

import { z } from 'zod'

const searchSchema = z.object({
  q: z.string().optional().catch(''),
  category: z.string().optional().catch('All'),
  sort: z.enum(['newest', 'oldest']).optional().catch('newest'),
  fulltext: z.boolean().optional().catch(false),
})

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: (search) => searchSchema.parse(search),
  component: Search,
})

const routeTree = rootRoute.addChildren([indexRoute, trendmapRoute, timelineRoute, searchRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
