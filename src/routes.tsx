import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { Dashboard } from './pages/Dashboard'
import { Search } from './pages/Search'
import { ArticleView } from './pages/ArticleView'

import { RootLayout } from './components/RootLayout'

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

import { z } from 'zod'

const searchSchema = z.object({
  q: z.string().optional().catch(''),
  category: z.string().optional().catch('All'),
  fulltext: z.boolean().optional().catch(false),
  view: z.enum(['list', 'timeline', 'heatmap']).optional().catch('list'),
})

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: (search) => searchSchema.parse(search),
  component: Search,
})

const articleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/article/$articleId',
  component: ArticleView,
})

const routeTree = rootRoute.addChildren([indexRoute, searchRoute, articleRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
