import { createHTTPHandler } from '@trpc/server/adapters/standalone'
import type { IncomingMessage, ServerResponse } from 'http'
import { appRouter } from '../src/server/router.js'

const handler = createHTTPHandler({
  router: appRouter,
  createContext: () => ({}),
  basePath: '/api/trpc/',
})

export default async function (req: IncomingMessage, res: ServerResponse) {
  return new Promise<void>((resolve, reject) => {
    const oldEnd = res.end
    res.end = function (this: ServerResponse, ...args: unknown[]) {
      oldEnd.apply(this, args as never)
      resolve()
      return this
    }
    
    try {
      handler(req, res)
    } catch (err) {
      reject(err)
    }
  })
}
