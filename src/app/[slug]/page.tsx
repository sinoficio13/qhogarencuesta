/**
 * Public survey page — RSC.
 *
 * T-044: fetches survey by slug, passes SurveyView to SurveyForm.
 * Uses force-dynamic (design §1) — no ISR in Phase 1.
 * notFound() for unknown or inactive surveys.
 *
 * Slug examples: 'compradores', 'agentes'
 * (seeded in WU-6 via scripts/seed.ts)
 */
import { notFound } from 'next/navigation'
import { getSurveyView } from '@/db/queries/surveyView'
import { SurveyForm } from '@/components/survey/SurveyForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function SurveyPage({ params }: Props) {
  // Next.js 15: params is a Promise — must await (design §1)
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

      {/* TODO-confirm: wording pending client approval */}
      <footer className="site">
        QHogar · Encuesta de parte de <strong>Angel Pinto</strong>. Los datos
        son recogidos por QHogar para investigación de mercado interna.
      </footer>
    </>
  )
}
