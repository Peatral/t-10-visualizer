import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'sqlite.db')

const client = createClient({
  url: `file:${dbPath}`,
})

export const db = drizzle(client, { schema })