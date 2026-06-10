/**
 * /admin/reportes — Analítica. Selector de encuesta + resultados inline.
 * La encuesta elegida viaja en ?survey=<id>. Render delegado a <SurveyResults>.
 */
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db } from '@/db'
import { surveys } from '@/db/schema'
import { asc } from 'drizzle-orm'
import Link from 'next/link'
import SurveyResults from '../SurveyResults'

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ survey?: string }>
}) {
  await requireAdmin()
  const { survey } = await searchParams

  const list = await db
    .select({ id: surveys.id, title: surveys.title, slug: surveys.slug })
    .from(surveys)
    .orderBy(asc(surveys.createdAt))

  const selectedId = survey && list.some((s) => s.id === survey) ? survey : list[0]?.id
  const selected = list.find((s) => s.id === selectedId)

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', margin: '0 0 4px', color: 'var(--ink)' }}>
        Reportes
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 20px' }}>Resultados detallados por encuesta.</p>

      {list.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No hay encuestas para reportar.</p>
      ) : (
        <>
          {/* Selector de encuesta */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            {list.map((s) => {
              const on = s.id === selectedId
              return (
                <Link
                  key={s.id}
                  href={`/admin/reportes?survey=${s.id}`}
                  style={{
                    fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: on ? 600 : 500,
                    textDecoration: 'none', padding: '8px 14px', borderRadius: 10,
                    border: `1px solid ${on ? 'var(--brand)' : 'var(--line)'}`,
                    background: on ? '#E9EFF6' : 'var(--surface)',
                    color: on ? 'var(--brand-deep)' : 'var(--muted)',
                  }}
                >
                  {s.title}
                </Link>
              )
            })}
          </div>

          {selected && (
            <>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, margin: '0 0 14px', color: 'var(--ink)' }}>
                {selected.title}{' '}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-2)' }}>/{selected.slug}</span>
              </h2>
              <SurveyResults surveyId={selected.id} />
            </>
          )}
        </>
      )}
    </div>
  )
}
