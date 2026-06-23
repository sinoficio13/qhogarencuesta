/**
 * /resultados/[token] — vista PÚBLICA de resultados de una encuesta (sin login).
 *
 * El token es un HMAC del surveyId (ver lib/results/resultsToken), distinto del
 * slug de respuesta, así el link de respuesta que ya circula no expone los
 * resultados. Es aditivo: no toca el flujo de envío ni el panel admin. Reusa el
 * componente SurveyResults (data-pura, sin auth), ocultando el export admin.
 *
 * Nota de routing: el segmento estático `resultados` tiene prioridad sobre el
 * dinámico `[slug]` del root, así que no colisiona con la ruta pública de
 * responder encuesta.
 */
import { notFound } from 'next/navigation'
import SurveyResults from '@/app/admin/(protected)/SurveyResults'
import { findSurveyByResultsToken } from '@/lib/results/resultsToken'

export const dynamic = 'force-dynamic'

export default async function PublicResultsPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const survey = await findSurveyByResultsToken(token)
  if (!survey) notFound()

  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', marginBottom: 6 }}>
        {survey.title}
      </h1>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted-2)', marginBottom: 24 }}>
        Resultados
      </p>
      <SurveyResults surveyId={survey.id} showExport={false} />
    </main>
  )
}
