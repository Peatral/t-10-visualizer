import { createHTTPHandler } from '@trpc/server/adapters/standalone'
import http from 'http'
import { appRouter } from '../src/server/router'

const handler = createHTTPHandler({
  router: appRouter,
  createContext: () => ({}),
  basePath: '/api/trpc/',
})

export default async function (req: http.IncomingMessage, res: http.ServerResponse) {
  return new Promise<void>((resolve, reject) => {
    const oldEnd = res.end
    res.end = function (this: http.ServerResponse, ...args: unknown[]) {
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
