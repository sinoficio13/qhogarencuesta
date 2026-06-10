/**
 * /admin/[surveyId]/links — Compartir (public link + response count)
 *
 * PIVOT: replaced N individual invitation tokens with a single public URL.
 * This page now shows:
 *   - The one public shareable URL: /<slug>
 *   - Copy-to-clipboard button
 *   - Total response count (dedup guaranteed by partial unique index)
 */

import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db } from '@/db'
import { surveys, responses } from '@/db/schema'
import { eq, count } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import CopyButton from './CopyButton'
import SurveyNav from '../SurveyNav'

interface Params {
  surveyId: string
}

export default async function LinksPage({
  params,
}: {
  params: Promise<Params>
}) {
  await requireAdmin()
  const { surveyId } = await params

  const [survey] = await db
    .select({ id: surveys.id, title: surveys.title, slug: surveys.slug })
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1)
  if (!survey) notFound()

  // Count responses for this survey
  const [{ value: responseCount }] = await db
    .select({ value: count() })
    .from(responses)
    .where(eq(responses.surveyId, surveyId))

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const publicUrl = `${baseUrl}/${survey.slug}`

  return (
    <div style={{ maxWidth: 720 }}>
      <SurveyNav surveyId={surveyId} active="share" title={survey.title} />
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 24px' }}>
        Este es el único link público de la encuesta. Compartilo por WhatsApp, email o redes.
      </p>

      {/* Public link card */}
      <div
        style={{
          border: '1px solid var(--line)',
          borderRadius: 14,
          background: 'var(--surface)',
          padding: '24px',
          marginBottom: 24,
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted-2)', marginBottom: 10 }}>
          Link público
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 15,
              color: 'var(--brand)',
              textDecoration: 'none',
              wordBreak: 'break-all',
              flex: 1,
            }}
          >
            {publicUrl}
          </a>
          <CopyButton text={publicUrl} />
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
          Cualquier persona con este link puede responder la encuesta. La deduplicación
          se hace por el identificador ingresado (email o cédula), no por el link.
        </p>
      </div>

      {/* Response count */}
      <div
        style={{
          border: '1px solid var(--line)',
          borderRadius: 10,
          background: 'var(--surface)',
          padding: '18px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 32,
              color: 'var(--ink)',
              display: 'block',
            }}
          >
            {responseCount}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--muted-2)',
            }}
          >
            Respuesta{responseCount !== 1 ? 's' : ''} únicas registradas
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <a
            href={`/admin/${surveyId}/responses`}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '.04em',
              color: 'var(--brand-deep)',
              background: '#E9EFF6',
              border: '1px solid #CEDBEA',
              borderRadius: 8,
              padding: '6px 14px',
              textDecoration: 'none',
              cursor: 'pointer',
              display: 'inline-block',
            }}
          >
            Ver respuestas →
          </a>
        </div>
      </div>
    </div>
  )
}
