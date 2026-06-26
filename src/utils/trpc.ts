import { createTRPCReact, httpBatchLink } from '@trpc/react-query'
import type { AppRouter } from '../server/router'

export const trpc = createTRPCReact<AppRouter>()

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/api/trpc',
    }),
  ],
})

export const useTRPC = () => {
  return trpc.useUtils()
}

export default useTRPC
