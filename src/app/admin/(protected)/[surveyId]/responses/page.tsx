/**
 * /admin/[surveyId]/responses — Resultados de una encuesta.
 * Render delegado a <SurveyResults> (compartido con /admin/reportes).
 */
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { surveys } from '@/db/schema'
import SurveyNav from '../SurveyNav'
import SurveyResults from '../../SurveyResults'
import { resultsToken } from '@/lib/results/resultsToken'

export default async function ResponsesPage({
  params,
}: {
  params: Promise<{ surveyId: string }>
}) {
  await requireAdmin()
  const { surveyId } = await params

  const [survey] = await db
    .select({ title: surveys.title })
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1)
  if (!survey) notFound()

  const token = await resultsToken(surveyId)
  const publicPath = `/resultados/${token}`

  return (
    <div style={{ maxWidth: 860 }}>
      <SurveyNav surveyId={surveyId} active="responses" title={survey.title} />
      <div style={{ marginBottom: 20, border: '1px solid var(--line)', borderRadius: 10, padding: '12px 16px', background: 'var(--surface)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted-2)', marginBottom: 6 }}>
          Link público de resultados (sin login)
        </div>
        <a href={publicPath} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--brand-deep)', wordBreak: 'break-all' }}>
          {publicPath}
        </a>
      </div>
      <SurveyResults surveyId={surveyId} />
    </div>
  )
}
