import express from 'express';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './src/server/router';

const app = express();

app.use(
  '/api/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => ({}),
  })
);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`tRPC Dev Server running on http://localhost:${PORT}/api/trpc`);
});