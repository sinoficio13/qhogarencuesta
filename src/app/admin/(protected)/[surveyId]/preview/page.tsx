/**
 * /admin/[surveyId]/preview — Vista previa de la encuesta tal como la ve el
 * encuestado, pero en modo preview (envío deshabilitado, no guarda nada).
 * Funciona también con encuestas inactivas (borradores).
 */
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getSurveyViewById } from '@/db/queries/surveyView'
import { SurveyForm } from '@/components/survey/SurveyForm'
import SurveyNav from '../SurveyNav'

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ surveyId: string }>
}) {
  await requireAdmin()
  const { surveyId } = await params
  const view = await getSurveyViewById(surveyId)
  if (!view) notFound()

  return (
    <div style={{ maxWidth: 760 }}>
      <SurveyNav surveyId={surveyId} active="preview" title={view.title} />
      <SurveyForm view={view} preview />
    </div>
  )
}
