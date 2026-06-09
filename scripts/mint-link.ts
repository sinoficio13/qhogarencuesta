/**
 * mint-link.ts — generate one-time invitation links for a survey.
 *
 * Usage:
 *   tsx scripts/mint-link.ts <slug> <count> [label]
 *
 * Examples:
 *   tsx scripts/mint-link.ts compradores 10
 *   tsx scripts/mint-link.ts agentes 5 "Lote noviembre 2026"
 *
 * Output: prints one full URL per line.
 * URL format: <NEXT_PUBLIC_BASE_URL>/r/<token>
 *   (defaults to http://localhost:3000 if env var not set)
 *
 * The script inserts the invitations and then prints the URLs.
 * Safe to run multiple times — each run inserts fresh tokens.
 *
 * Environment:
 *   DATABASE_URL — required (points at dev or prod DB)
 *   NEXT_PUBLIC_BASE_URL — optional, defaults to http://localhost:3000
 */

import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { surveys, invitations } from '../src/db/schema'
import { eq } from 'drizzle-orm'
import { generateToken } from '../src/lib/token'
import * as schema from '../src/db/schema'

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.error('Usage: tsx scripts/mint-link.ts <slug> <count> [label]')
    process.exit(1)
  }

  const slug = args[0]
  const count = parseInt(args[1], 10)
  const label = args[2] ?? null

  if (isNaN(count) || count < 1) {
    console.error('Error: count must be a positive integer')
    process.exit(1)
  }

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('Error: DATABASE_URL is not set')
    process.exit(1)
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'

  const pool = new pg.Pool({ connectionString: dbUrl })
  const db = drizzle(pool, { schema })

  // Look up the survey by slug
  const survey = await db.query.surveys.findFirst({
    where: eq(surveys.slug, slug),
  })

  if (!survey) {
    console.error(`Error: survey with slug "${slug}" not found`)
    await pool.end()
    process.exit(1)
  }

  console.log(`Minting ${count} link(s) for survey: "${survey.title}" (${survey.id})`)
  if (label) console.log(`Label: ${label}`)
  console.log('')

  // Insert invitations and collect tokens
  const rows = Array.from({ length: count }, () => ({
    surveyId: survey.id,
    token: generateToken(),
    label,
  }))

  const inserted = await db
    .insert(invitations)
    .values(rows)
    .returning({ id: invitations.id, token: invitations.token })

  for (const inv of inserted) {
    console.log(`${baseUrl}/r/${inv.token}`)
  }

  console.log(`\n${inserted.length} invitation(s) created.`)

  await pool.end()
}

main().catch((err) => {
  console.error('mint-link failed:', err)
  process.exit(1)
})
