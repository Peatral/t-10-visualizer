import { createTRPCReact, httpBatchLink } from '@trpc/react-query'
import type { TRPCRouter } from '../server/router'
import superjson from 'superjson'

export const trpc = createTRPCReact<TRPCRouter>()

function getUrl() {
  const base = (() => {
    if (typeof window !== 'undefined') return ''
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
    return `http://localhost:${process.env.PORT ?? 3000}`
  })()
  return `${base}/api/trpc`
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      transformer: superjson,
      url: getUrl(),
    }),
  ],
})

export const useTRPC = () => {
  return trpc.useUtils()
}

export default useTRPC
