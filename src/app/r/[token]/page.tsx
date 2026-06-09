/**
 * Respondent route — /r/[token]
 *
 * WU-5 dedup slice: resolves a one-time invitation token to its survey.
 *
 * States:
 *  - Token not found in DB → friendly "Link inválido" page (Spanish).
 *  - Token found but already used (usedAt is set) → "Link ya usado" page (Spanish).
 *  - Token valid and unused → render <SurveyForm view={...} token={token} />.
 *
 * force-dynamic: token state can change between requests (consume on submit).
 * No metadata generation — token-based pages are not indexed.
 */
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { invitations, surveys } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getSurveyView } from '@/db/queries/surveyView'
import { SurveyForm } from '@/components/survey/SurveyForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

export default async function TokenPage({ params }: Props) {
  const { token } = await params

  // Resolve token → invitation
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
    with: {
      survey: true,
    },
  })

  // Token not found
  if (!invitation) {
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
          </div>
        </header>
        <div className="wrap" style={{ paddingTop: '48px', textAlign: 'center' }}>
          <section className="panel" style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div style={{ padding: '40px 32px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
              <h2 style={{ marginBottom: '12px' }}>Link inválido</h2>
              <p style={{ color: 'var(--muted-2)', lineHeight: 1.6 }}>
                El link que usaste no existe o fue mal escrito. Si recibiste un
                link por correo o WhatsApp, verificá que lo copiaste completo.
              </p>
            </div>
          </section>
        </div>
      </>
    )
  }

  // Token already used
  if (invitation.usedAt !== null) {
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
          </div>
        </header>
        <div className="wrap" style={{ paddingTop: '48px', textAlign: 'center' }}>
          <section className="panel" style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div style={{ padding: '40px 32px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <h2 style={{ marginBottom: '12px' }}>Ya respondiste</h2>
              <p style={{ color: 'var(--muted-2)', lineHeight: 1.6 }}>
                Esta encuesta ya fue respondida con este link. Cada link es de
                un solo uso. Si creés que hay un error, contactá al administrador.
              </p>
            </div>
          </section>
        </div>
      </>
    )
  }

  // Token valid — resolve survey view
  const view = await getSurveyView(invitation.survey.slug)

  if (!view) {
    // Survey inactive or removed
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
        <SurveyForm view={view} token={token} />
      </div>

      {/* TODO-confirm: wording pending client approval */}
      <footer className="site">
        QHogar · Encuesta de parte de <strong>Angel Pinto</strong>. Los datos
        son recogidos por QHogar para investigación de mercado interna.
      </footer>
    </>
  )
}
