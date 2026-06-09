/**
 * DB client — dual-driver strategy:
 *
 *   Production (Neon / Vercel):
 *     URL host contains 'neon.tech' OR env VERCEL is set
 *     → drizzle-orm/neon-http + @neondatabase/serverless
 *     (Edge/Node, http-based, neon-batched transactions)
 *
 *   Local dev / test (docker postgres:16):
 *     Any other URL (localhost, 127.0.0.1, etc.)
 *     → drizzle-orm/node-postgres + pg
 *     (native TCP, interactive transactions, works offline)
 *
 * Same schema shared by both paths — only the adapter differs.
 * Export: a single `db` instance.
 *
 * NOTE: Dynamic imports at module level work in Next.js (bundler context)
 * and Vitest (ESM). Both runtimes run the correct branch at startup.
 * The unused branch is tree-shaken by the bundler in production.
 */
import * as schema from './schema'
import * as schemaRelations from './relations'
import { NeonHttpDatabase, drizzle as neonDrizzle } from 'drizzle-orm/neon-http'
import { NodePgDatabase, drizzle as pgDrizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { neon } from '@neondatabase/serverless'

type FullSchema = typeof schema & typeof schemaRelations

function isNeon(url: string): boolean {
  return (
    url.includes('neon.tech') ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL === 'true'
  )
}

const url = process.env.DATABASE_URL

if (!url) {
  throw new Error('DATABASE_URL is not set')
}

const fullSchema = { ...schema, ...schemaRelations }

let db: NeonHttpDatabase<FullSchema> | NodePgDatabase<FullSchema>

if (isNeon(url)) {
  // Production path: neon-http (http/2, serverless-safe)
  const sqlClient = neon(url)
  db = neonDrizzle(sqlClient, { schema: fullSchema })
} else {
  // Local dev / test path: node-postgres (native TCP)
  const pool = new pg.Pool({ connectionString: url })
  db = pgDrizzle(pool, { schema: fullSchema })
}

export { db }
