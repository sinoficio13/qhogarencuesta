/**
 * Public survey page — RSC.
 *
 * PIVOT: /[slug] is THE answerable public link (shareable via WhatsApp / social).
 * Preview mode removed — respondents enter their identifier directly and submit.
 *
 * T-044: fetches survey by slug, passes SurveyView to SurveyForm.
 * Uses force-dynamic — no ISR.
 * notFound() for unknown or inactive surveys.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSurveyView } from '@/db/queries/surveyView'
import { SurveyForm } from '@/components/survey/SurveyForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const view = await getSurveyView(slug)
  return {
    title: view ? `${view.title} · QHogar` : 'Encuesta · QHogar',
  }
}

export default async function SurveyPage({ params }: Props) {
  const { slug } = await params

  const view = await getSurveyView(slug)

  if (!view) {
    notFound()
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <svg className="mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 11.5 12 3l9 8.5" stroke="#0E7C66" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 10v10h14V10" stroke="#0F2A2C" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="12" cy="14" r="2.4" fill="#EE6C4D" />
            </svg>
            <span>Q<b>Hogar</b></span>
          </div>
          <span className="tag">Validación de producto · 2026</span>
        </div>
      </header>

      <div className="wrap" style={{ paddingTop: '32px' }}>
        <SurveyForm view={view} />
      </div>

      <footer className="site">
        QHogar · Encuesta de parte de <strong>Angel Pinto</strong>. Los datos
        son recogidos por QHogar para investigación de mercado interna.
      </footer>
    </>
  )
}
