/**
 * E2E fixture seed — inserts minimal compradores survey into dev DB.
 *
 * Used by Playwright e2e tests (and can be invoked standalone).
 * This is NOT the full production seed (that's WU-6 / scripts/seed.ts).
 *
 * The compradores survey has:
 *   - 1 single (required)
 *   - 1 multi max=2 (required)
 *   - 1 scale 2 rows (required)
 *   - 1 open (optional)
 *
 * Idempotent: deletes existing compradores-e2e survey then re-inserts.
 */
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from '../../src/db/schema'
import { eq } from 'drizzle-orm'
import { sanitize } from '../../src/lib/sanitize'

const DB_URL =
  process.env.DATABASE_URL || 'postgres://qhogar:qhogar@localhost:5432/qhogar'

export const E2E_SLUG = 'compradores'

export async function seedE2eSurvey(dbUrl = DB_URL) {
  const pool = new pg.Pool({ connectionString: dbUrl })
  const db = drizzle(pool, { schema })

  try {
    // Idempotent cleanup — cascade deletes questions → options/scaleRows/responses
    const existing = await db.query.surveys.findFirst({
      where: eq(schema.surveys.slug, E2E_SLUG),
    })
    if (existing) {
      await db.delete(schema.surveys).where(eq(schema.surveys.id, existing.id))
    }

    // Insert survey
    const [survey] = await db
      .insert(schema.surveys)
      .values({
        slug: E2E_SLUG,
        title: 'Encuesta a compradores',
        description: 'Para quien ya compró vivienda en el último año',
        metaChips: ['Para quien ya compró', '3 preguntas + 1 opcional', '~1 min'],
        noteHtml: sanitize(
          '<b>Por qué cerradas:</b> las preguntas de tocar se completan mucho más que las de escribir.'
        ),
        isActive: true,
      })
      .returning()

    // Q1 — single (required)
    const [q1] = await db
      .insert(schema.questions)
      .values({
        surveyId: survey.id,
        position: 10,
        type: 'single',
        text: 'Cuando dudabas entre varios pisos parecidos en precio y tamaño, ¿qué inclinó la balanza?',
        hintWhy: 'El desempate · elige solo una',
        isRequired: true,
      })
      .returning()

    await db.insert(schema.options).values([
      { questionId: q1.id, position: 10, text: 'La ubicación / lo bien comunicado que estaba' },
      { questionId: q1.id, position: 20, text: 'El entorno: tranquilidad, poco ruido, buen aire' },
      { questionId: q1.id, position: 30, text: 'El piso en sí (luz, terraza, piscina, garaje)' },
      { questionId: q1.id, position: 40, text: 'El precio / era el más asequible' },
    ])

    // Q2 — multi max=2 (required)
    const [q2] = await db
      .insert(schema.questions)
      .values({
        surveyId: survey.id,
        position: 20,
        type: 'multi',
        text: 'Si una web nueva tuviera esto, ¿qué te haría usarla en vez de Idealista?',
        hint: 'Selecciona un máximo de 2',
        isRequired: true,
        maxSelect: 2,
      })
      .returning()

    await db.insert(schema.options).values([
      { questionId: q2.id, position: 10, text: 'Buscar por WhatsApp' },
      { questionId: q2.id, position: 20, text: 'Proximidad a un sitio que yo elija' },
      { questionId: q2.id, position: 30, text: 'Colegio a pocos minutos andando' },
      { questionId: q2.id, position: 40, text: 'Que tenga más pisos que las demás', isControl: true },
    ])

    // Q3 — scale 2 rows (required)
    const [q3] = await db
      .insert(schema.questions)
      .values({
        surveyId: survey.id,
        position: 30,
        type: 'scale',
        text: 'Si una web te hubiera dado esto sin tener que buscarlo aparte, ¿cuánto te habría ayudado?',
        hint: '1 = no me habría aportado · 5 = me habría ayudado muchísimo',
        isRequired: true,
      })
      .returning()

    await db.insert(schema.scaleRows).values([
      { questionId: q3.id, position: 10, labelHtml: sanitize('Tiempo <b>andando a un sitio que yo elija</b>') },
      { questionId: q3.id, position: 20, labelHtml: sanitize('Filtrar por <b>piscina y otras características</b>') },
    ])

    // Q4 — open optional
    await db.insert(schema.questions).values({
      surveyId: survey.id,
      position: 40,
      type: 'open',
      text: '¿Echaste de menos algo que ninguna web te ofrecía?',
      isRequired: false,
    })

    return survey
  } finally {
    await pool.end()
  }
}

// Allow running standalone: tsx tests/fixtures/seedE2eSurvey.ts
if (require.main === module) {
  seedE2eSurvey()
    .then((s) => console.log('Seeded:', s.slug, s.id))
    .catch((e) => { console.error(e); process.exit(1) })
}
