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
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getSurveyView } from '@/db/queries/surveyView'
import { SurveyForm } from '@/components/survey/SurveyForm'
import { Watermark } from '@/components/survey/Watermark'

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
            <Image src="/qhogar-logo.svg" alt="QHogar" width={116} height={53} priority style={{ width: 116, height: 'auto' }} />
          </div>
          <span className="tag">Validación de producto · 2026</span>
        </div>
      </header>

      <div className="wrap" style={{ paddingTop: '32px', position: 'relative' }}>
        <Watermark image={view.watermarkImage} style={view.watermarkStyle} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <SurveyForm view={view} />
        </div>
      </div>

      <footer className="site">
        Encuesta de QHogar
        {view.agency ? (
          <>
            {' '}realizada a través de <strong>{view.agency.name}</strong>
          </>
        ) : null}
        . Los datos son recogidos por QHogar para investigación de mercado
        interna.
      </footer>
    </>
  )
}
