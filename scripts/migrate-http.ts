/**
 * Migrate vía neon-http (HTTPS/443) en lugar de drizzle-kit (pg/TCP/5432).
 *
 * Por qué: algunos entornos (sandboxes, redes con egress TCP filtrado) NO pueden
 * abrir conexiones TCP crudas a Neon → `drizzle-kit migrate` falla con ECONNRESET.
 * El driver neon-http usa HTTPS, que sí pasa. Aplica las MISMAS migraciones de
 * ./drizzle, registrándolas en la tabla __drizzle_migrations igual que drizzle-kit.
 *
 * Run: `DATABASE_URL='<neon-url>' npm run db:migrate:http`
 *      (cae a .env.local si DATABASE_URL no está seteada).
 */
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    /* sin .env.local: se asume DATABASE_URL en el entorno */
  }
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('migrate-http: DATABASE_URL no está seteada')
  process.exit(1)
}

async function main() {
  const sql = neon(url!)
  const db = drizzle(sql)
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('migrate-http: migraciones aplicadas ✓')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('migrate-http: ERROR\n', err)
    process.exit(1)
  })
