/**
 * /admin/[surveyId]/ajustes — Ajustes de la encuesta.
 * Por ahora: marca de agua (imagen + patrón). Funciona con borradores inactivos.
 */
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getSurveyViewById } from '@/db/queries/surveyView'
import SurveyNav from '../SurveyNav'
import WatermarkSettings from './WatermarkSettings'

export default async function AjustesPage({
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
      <SurveyNav surveyId={surveyId} active="settings" title={view.title} />
      <WatermarkSettings
        surveyId={surveyId}
        initialImage={view.watermarkImage}
        initialStyle={view.watermarkStyle}
      />
    </div>
  )
}
