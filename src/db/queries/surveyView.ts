/**
 * getSurveyView — load a survey by slug with all nested data.
 *
 * Returns SurveyView (ready for the RSC page to pass to SurveyForm)
 * or null if the survey is not found or not active.
 *
 * Uses Drizzle relational query (db.query.*) which triggers a JOIN-like
 * nested fetch in a single round-trip via the neon-http batch protocol.
 *
 * Design §5: force-dynamic is set on the page, not here.
 */
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { surveys } from '@/db/schema'
import { toSurveyView } from '@/lib/dto/surveyShape'
import type { SurveyView } from '@/lib/dto/surveyShape'

export async function getSurveyView(slug: string): Promise<SurveyView | null> {
  const row = await db.query.surveys.findFirst({
    where: eq(surveys.slug, slug),
    with: {
      questions: {
        orderBy: (questions, { asc }) => [asc(questions.position)],
        with: {
          options: {
            orderBy: (options, { asc }) => [asc(options.position)],
          },
          scaleRows: {
            orderBy: (scaleRows, { asc }) => [asc(scaleRows.position)],
          },
        },
      },
    },
  })

  if (!row || !row.isActive) return null

  return toSurveyView(row)
}

/**
 * getSurveyViewById — igual que getSurveyView pero por ID y SIN filtrar por
 * isActive. Para la VISTA PREVIA del admin (previsualizar incluso borradores
 * inactivos). No usar en rutas públicas.
 */
export async function getSurveyViewById(id: string): Promise<SurveyView | null> {
  const row = await db.query.surveys.findFirst({
    where: eq(surveys.id, id),
    with: {
      questions: {
        orderBy: (questions, { asc }) => [asc(questions.position)],
        with: {
          options: { orderBy: (options, { asc }) => [asc(options.position)] },
          scaleRows: { orderBy: (scaleRows, { asc }) => [asc(scaleRows.position)] },
        },
      },
    },
  })
  if (!row) return null
  return toSurveyView(row)
}
