/**
 * seed-agency — Siembra la agencia fundadora (Angel Pinto) y la vincula a las
 * encuestas existentes (buyers, agents). Idempotente: no duplica.
 *
 * Run: `npm run db:seed:agency`
 * El logo apunta al asset estático del repo (/agencies/angelpinto.png).
 * Las agencias que se carguen después por el panel usarán URLs de Vercel Blob.
 */

// Cargar .env.local SOLO si DATABASE_URL no vino del entorno (mismo patrón que seed.ts)
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    /* sin .env.local: se asume DATABASE_URL en el entorno */
  }
}

import { db } from '../src/db/index'
import { agencies, surveys } from '../src/db/schema'
import { eq, inArray } from 'drizzle-orm'

const AGENCY = {
  slug: 'angel-pinto',
  name: 'Angel Pinto',
  logo: '/agencies/angelpinto.png',
}
const LINK_SURVEY_SLUGS = ['buyers', 'agents']

async function main() {
  // 1. Upsert agencia por slug
  const existing = await db
    .select({ id: agencies.id })
    .from(agencies)
    .where(eq(agencies.slug, AGENCY.slug))
    .limit(1)

  let agencyId: string
  if (existing.length > 0) {
    agencyId = existing[0].id
    await db.update(agencies).set({ name: AGENCY.name, logo: AGENCY.logo }).where(eq(agencies.id, agencyId))
    console.log(`seed-agency: agencia "${AGENCY.name}" ya existía (${agencyId}) — actualizada`)
  } else {
    const [created] = await db.insert(agencies).values(AGENCY).returning()
    agencyId = created.id
    console.log(`seed-agency: agencia "${AGENCY.name}" creada (${agencyId})`)
  }

  // 2. Vincular encuestas existentes
  // NOTA: .returning() sin proyección — .returning({proj}) rompe el tipo union de `db`
  // (NeonHttp | NodePg) con "Expected 0 arguments, but got 1".
  const result = await db
    .update(surveys)
    .set({ agencyId })
    .where(inArray(surveys.slug, LINK_SURVEY_SLUGS))
    .returning()

  console.log(`seed-agency: vinculadas ${result.length} encuestas → ${result.map((r) => '/' + r.slug).join(', ')}`)
}

main()
  .then(() => {
    console.log('seed-agency: listo ✓')
    process.exit(0)
  })
  .catch((err) => {
    console.error('seed-agency: error', err)
    process.exit(1)
  })
