import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'

const dbPath = path.resolve(process.cwd(), 'sqlite.db')
const sqlite = new Database(dbPath, { readonly: !!process.env.VERCEL })
export const db = drizzle(sqlite, { schema })
