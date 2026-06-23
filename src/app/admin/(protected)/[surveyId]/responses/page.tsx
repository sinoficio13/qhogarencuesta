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
import CopyLink from '../CopyLink'

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
      <CopyLink path={publicPath} />
      <SurveyResults surveyId={surveyId} />
    </div>
  )
}
