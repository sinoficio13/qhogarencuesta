/**
 * SurveyNav — navegación consistente entre las vistas de UNA encuesta.
 * Cada cosa en su lugar: Editar · Vista previa · Resultados · Compartir.
 * Server component (solo links); resalta la pestaña activa.
 */
import Link from 'next/link'

type Tab = 'edit' | 'preview' | 'responses' | 'share' | 'settings'

const TABS: { key: Tab; label: string; path: (id: string) => string }[] = [
  { key: 'edit', label: 'Editar preguntas', path: (id) => `/admin/${id}` },
  { key: 'preview', label: 'Vista previa', path: (id) => `/admin/${id}/preview` },
  { key: 'responses', label: 'Resultados', path: (id) => `/admin/${id}/responses` },
  { key: 'share', label: 'Compartir', path: (id) => `/admin/${id}/links` },
  { key: 'settings', label: 'Ajustes', path: (id) => `/admin/${id}/ajustes` },
]

export default function SurveyNav({
  surveyId,
  active,
  title,
}: {
  surveyId: string
  active: Tab
  title?: string
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <Link
        href="/admin"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}
      >
        ← Todas las encuestas
      </Link>
      {title && (
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, letterSpacing: '-.02em', margin: '6px 0 14px', color: 'var(--ink)' }}>
          {title}
        </h1>
      )}
      <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: 0 }}>
        {TABS.map((t) => {
          const on = t.key === active
          return (
            <Link
              key={t.key}
              href={t.path(surveyId)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                letterSpacing: '.02em',
                textDecoration: 'none',
                padding: '8px 14px',
                borderRadius: '10px 10px 0 0',
                color: on ? 'var(--brand-deep)' : 'var(--muted)',
                background: on ? 'var(--surface)' : 'transparent',
                border: on ? '1px solid var(--line)' : '1px solid transparent',
                borderBottom: on ? '1px solid var(--surface)' : '1px solid transparent',
                marginBottom: -1,
                fontWeight: on ? 700 : 400,
              }}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
