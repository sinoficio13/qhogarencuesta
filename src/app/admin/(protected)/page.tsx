/**
 * /admin — Survey list + create form.
 *
 * Lists ALL surveys (active and inactive) with:
 *  - Title, slug, question count, response count, active badge
 *  - Action links: Editar preguntas, Links, Respuestas, Borrar
 *  - Toggle active/inactive button
 * Plus a "Nueva encuesta" form at the top.
 */

import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db } from '@/db'
import { surveys, questions, responses } from '@/db/schema'
import { count, max } from 'drizzle-orm'
import { createSurvey, deleteSurvey, toggleActive } from '@/actions/adminSurveys'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import QRCode from 'qrcode'
import ShareButton from './ShareButton'

// ── Form action wrappers ──────────────────────────────────────────────────────
// These parse FormData and delegate to the typed action functions.
// Kept in the page file to avoid mixing form-data parsing into the action module.

async function createSurveyAction(formData: FormData) {
  'use server'
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const slug = (formData.get('slug') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null)?.trim() || undefined
  const metaChipsRaw = (formData.get('metaChipsRaw') as string | null)?.trim() || undefined
  const noteHtml = (formData.get('noteHtml') as string | null)?.trim() || undefined
  const identifierTypeRaw = (formData.get('identifierType') as string | null) ?? 'email'
  const identifierType = identifierTypeRaw === 'cedula' ? 'cedula' : 'email'
  const identifierLabel = (formData.get('identifierLabel') as string | null)?.trim() || undefined

  const metaChips = metaChipsRaw
    ? metaChipsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined

  await createSurvey({ title, slug, description, metaChips, noteHtml, identifierType, identifierLabel })
  redirect('/admin')
}

async function deleteSurveyAction(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  await deleteSurvey({ id })
  redirect('/admin')
}

async function toggleActiveAction(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  await toggleActive({ id })
  revalidatePath('/admin')
}

// ── Page component ─────────────────────────────────────────────────────────────

export default async function AdminPage() {
  await requireAdmin()

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  // Surveys + conteos. NOTA: las subqueries correlacionadas vía sql`` devolvían
  // 0 sobre neon-http (bug del driver HTTP). Se usan agregaciones GROUP BY
  // separadas, que funcionan igual en node-postgres (local) y neon-http (prod).
  const surveyList = await db
    .select({
      id: surveys.id,
      title: surveys.title,
      slug: surveys.slug,
      isActive: surveys.isActive,
    })
    .from(surveys)
    .orderBy(surveys.createdAt)

  const qCounts = await db
    .select({ surveyId: questions.surveyId, n: count() })
    .from(questions)
    .groupBy(questions.surveyId)
  const rCounts = await db
    .select({ surveyId: responses.surveyId, n: count() })
    .from(responses)
    .groupBy(responses.surveyId)

  const qCountMap: Record<string, number> = Object.fromEntries(qCounts.map((r) => [r.surveyId, r.n]))
  const rCountMap: Record<string, number> = Object.fromEntries(rCounts.map((r) => [r.surveyId, r.n]))

  // Última respuesta por encuesta (recencia → ¿sigue entrando data?)
  const lastResp = await db
    .select({ surveyId: responses.surveyId, last: max(responses.submittedAt) })
    .from(responses)
    .groupBy(responses.surveyId)
  const lastMap: Record<string, Date | null> = Object.fromEntries(lastResp.map((r) => [r.surveyId, r.last]))
  const totalResponses = Object.values(rCountMap).reduce((a, b) => a + b, 0)

  const fmtDate = (d: Date | null) =>
    d
      ? new Date(d).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '—'

  // UN solo QR del home (SVG inline, generado en el server). Lo escaneás desde
  // el teléfono y entrás rápido al panel para manejar todo desde el celu.
  const homeQr = await QRCode.toString(baseUrl, {
    type: 'svg',
    margin: 1,
    width: 150,
    errorCorrectionLevel: 'M',
  })

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', margin: '0 0 4px', color: 'var(--ink)' }}>
            Encuestas
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
            {surveyList.length} encuesta{surveyList.length !== 1 ? 's' : ''} en total
          </p>
        </div>

        {/* QR del home — escaneá para abrir el panel desde el teléfono */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', padding: '12px 14px' }}>
          <div style={{ width: 150, height: 150, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: homeQr }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-2)', letterSpacing: '.03em', textAlign: 'center' }}>
            Escaneá para entrar<br />desde el teléfono
          </span>
        </div>
      </div>

      {/* Resumen de avance — vista combinada de ambas encuestas */}
      {surveyList.length > 0 && (
        <div style={{ marginBottom: 24, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>Avance</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-2)' }}>
              {totalResponses} respuesta{totalResponses !== 1 ? 's' : ''} en total
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {surveyList.map((s) => (
              <div key={s.id} style={{ flex: '1 1 220px', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', background: '#FAFCFB' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>{s.title}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--brand-deep)', lineHeight: 1 }}>{rCountMap[s.id] ?? 0}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>respuestas</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-2)', margin: '6px 0 10px' }}>
                  Última: {fmtDate(lastMap[s.id] ?? null)}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href={`/admin/${s.id}/responses`} style={miniLinkStyle}>Ver resultados →</a>
                  <a href={`/admin/${s.id}/export`} style={{ ...miniLinkStyle, color: 'var(--muted)' }}>Exportar CSV</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create survey form */}
      <details style={{ marginBottom: 32, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', padding: '20px 24px' }}>
        <summary style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, cursor: 'pointer', color: 'var(--brand-deep)', userSelect: 'none' }}>
          + Nueva encuesta
        </summary>
        <form
          action={createSurveyAction}
          style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <label style={labelStyle}>
            Título *
            <input name="title" required placeholder="Ej: Encuesta de compradores" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Slug * (URL)
            <input name="slug" required placeholder="Ej: compradores" style={inputStyle} />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Se usará en la URL. Solo letras, números y guiones (se normaliza automáticamente).</span>
          </label>
          <label style={labelStyle}>
            Descripción
            <input name="description" placeholder="Descripción breve (opcional)" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Chips meta (separados por coma)
            <input name="metaChipsRaw" placeholder="Ej: Compradores, Propiedades, 2025" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Nota HTML (se sanitiza)
            <textarea name="noteHtml" placeholder="Ej: <b>Nota importante</b>: esto es privado" rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} />
          </label>
          <label style={labelStyle}>
            Identificador del respondente *
            <select name="identifierType" defaultValue="email" style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="email">Email</option>
              <option value="cedula">Cédula</option>
            </select>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Campo requerido para dedup — se guarda hasheado, nunca en crudo.</span>
          </label>
          <label style={labelStyle}>
            Label del identificador (opcional)
            <input name="identifierLabel" placeholder="Ej: Email de trabajo, Número de documento" style={inputStyle} />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Texto que verá el respondente. Si está vacío se usa 'Email' o 'Cédula'.</span>
          </label>
          <div>
            <button type="submit" className="btn" style={{ marginTop: 4 }}>
              Crear encuesta
            </button>
          </div>
        </form>
      </details>

      {/* Survey list */}
      {surveyList.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
          No hay encuestas todavía. Creá la primera arriba.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {surveyList.map((survey) => (
            <div
              key={survey.id}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 14,
                background: 'var(--surface)',
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              {/* Info */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>
                    {survey.title}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: survey.isActive ? 'var(--brand)' : 'var(--line)',
                      color: survey.isActive ? 'var(--brand-deep)' : 'var(--muted)',
                      background: survey.isActive ? '#E9F4F0' : 'transparent',
                    }}
                  >
                    {survey.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted-2)', display: 'flex', gap: 16 }}>
                  <span>/{survey.slug}</span>
                  <span>{qCountMap[survey.id] ?? 0} pregunta{(qCountMap[survey.id] ?? 0) !== 1 ? 's' : ''}</span>
                  <span>{rCountMap[survey.id] ?? 0} respuesta{(rCountMap[survey.id] ?? 0) !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <a href={`/admin/${survey.id}`} style={linkBtnStyle}>
                  Preguntas
                </a>
                <a href={`/admin/${survey.id}/preview`} style={linkBtnStyle}>
                  Vista previa
                </a>
                <ShareButton url={`${baseUrl}/${survey.slug}`} title={survey.title} />
                <a href={`/admin/${survey.id}/responses`} style={linkBtnStyle}>
                  Respuestas
                </a>

                {/* Toggle active */}
                <form action={toggleActiveAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={survey.id} />
                  <button type="submit" style={{ ...linkBtnStyle, color: survey.isActive ? 'var(--muted)' : 'var(--brand-deep)' }}>
                    {survey.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                </form>

                {/* Delete */}
                <form action={deleteSurveyAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="id" value={survey.id} />
                  <button
                    type="submit"
                    style={{ ...linkBtnStyle, color: '#c0392b', borderColor: '#f5c6c2', background: '#fdf3f2' }}
                  >
                    Borrar
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Inline styles (no shadcn) ─────────────────────────────────────────────────

const miniLinkStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--brand-deep)',
  textDecoration: 'none',
  borderBottom: '1px solid transparent',
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--ink)',
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '10px 13px',
  fontSize: 15,
  fontFamily: 'var(--font-body)',
  color: 'var(--ink)',
  background: '#fff',
  outline: 'none',
}

const linkBtnStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  letterSpacing: '.04em',
  color: 'var(--brand-deep)',
  background: '#E9F4F0',
  border: '1px solid #CDE6DD',
  borderRadius: 8,
  padding: '5px 11px',
  textDecoration: 'none',
  cursor: 'pointer',
  display: 'inline-block',
  lineHeight: 1.4,
}
