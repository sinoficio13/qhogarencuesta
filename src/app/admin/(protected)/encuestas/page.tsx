/**
 * /admin/encuestas — Gestión de encuestas (listado + crear).
 * Tabla compacta con badges de estado y acciones agrupadas en menú «…».
 */
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db } from '@/db'
import { surveys, questions, responses } from '@/db/schema'
import { count, eq } from 'drizzle-orm'
import { createSurvey, deleteSurvey, toggleActive } from '@/actions/adminSurveys'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import RowActions from '../RowActions'

// ── server actions ──────────────────────────────────────────────────────────
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
  const metaChips = metaChipsRaw ? metaChipsRaw.split(',').map((s) => s.trim()).filter(Boolean) : undefined
  await createSurvey({ title, slug, description, metaChips, noteHtml, identifierType, identifierLabel })
  redirect('/admin/encuestas')
}

async function deleteSurveyAction(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  // responses NO tiene ON DELETE CASCADE hacia surveys → borrarlas primero.
  await db.delete(responses).where(eq(responses.surveyId, id))
  await deleteSurvey({ id })
  redirect('/admin/encuestas')
}

async function toggleActiveAction(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  await toggleActive({ id })
  revalidatePath('/admin/encuestas')
}

// ── page ──────────────────────────────────────────────────────────────────────
export default async function EncuestasPage() {
  await requireAdmin()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  const surveyList = await db
    .select({ id: surveys.id, title: surveys.title, slug: surveys.slug, isActive: surveys.isActive })
    .from(surveys).orderBy(surveys.createdAt)
  const qCounts = await db.select({ surveyId: questions.surveyId, n: count() }).from(questions).groupBy(questions.surveyId)
  const rCounts = await db.select({ surveyId: responses.surveyId, n: count() }).from(responses).groupBy(responses.surveyId)
  const qm: Record<string, number> = Object.fromEntries(qCounts.map((r) => [r.surveyId, r.n]))
  const rm: Record<string, number> = Object.fromEntries(rCounts.map((r) => [r.surveyId, r.n]))

  return (
    <div>
      {/* Cabecera con acción principal */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', margin: '0 0 2px', color: 'var(--ink)' }}>Encuestas</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>{surveyList.length} en total</p>
        </div>
      </div>

      {/* Crear */}
      <details style={{ marginBottom: 24, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', padding: '16px 20px' }}>
        <summary style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, cursor: 'pointer', color: 'var(--brand-deep)', userSelect: 'none' }}>+ Nueva encuesta</summary>
        <form action={createSurveyAction} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={labelStyle}>Título *<input name="title" required placeholder="Ej: Encuesta de compradores" style={inputStyle} /></label>
          <label style={labelStyle}>Slug * (URL)<input name="slug" required placeholder="Ej: compradores" style={inputStyle} /><span style={hintStyle}>Se usará en la URL. Se normaliza automáticamente.</span></label>
          <label style={labelStyle}>Descripción<input name="description" placeholder="Opcional" style={inputStyle} /></label>
          <label style={labelStyle}>Chips meta (coma)<input name="metaChipsRaw" placeholder="Ej: Compradores, 2025" style={inputStyle} /></label>
          <label style={labelStyle}>Nota HTML (se sanitiza)<textarea name="noteHtml" placeholder="Opcional" rows={2} style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} /></label>
          <label style={labelStyle}>Identificador del respondente *
            <select name="identifierType" defaultValue="email" style={{ ...inputStyle, cursor: 'pointer' }}><option value="email">Email</option><option value="cedula">Cédula</option></select>
            <span style={hintStyle}>Requerido para dedup — se guarda hasheado.</span>
          </label>
          <label style={labelStyle}>Label del identificador (opcional)<input name="identifierLabel" placeholder="Ej: Tu email, Número de documento" style={inputStyle} /></label>
          <div><button type="submit" className="btn" style={{ marginTop: 4 }}>Crear encuesta</button></div>
        </form>
      </details>

      {/* Tabla */}
      {surveyList.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>No hay encuestas todavía. Creá la primera arriba.</p>
      ) : (
        <div style={{ border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted-2)' }}>
                <th style={th}>Nombre</th><th style={th}>Ruta</th><th style={thC}>Preg.</th><th style={thC}>Resp.</th><th style={th}>Estado</th><th style={thR}></th>
              </tr>
            </thead>
            <tbody>
              {surveyList.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={td}><span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{s.title}</span></td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--muted)' }}>/{s.slug}</td>
                  <td style={{ ...td, ...tdC, fontFamily: 'var(--font-mono)', fontSize: 13 }}>{qm[s.id] ?? 0}</td>
                  <td style={{ ...td, ...tdC, fontFamily: 'var(--font-mono)', fontSize: 13 }}>{rm[s.id] ?? 0}</td>
                  <td style={td}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 999, border: '1px solid', borderColor: s.isActive ? 'var(--brand)' : 'var(--line)', color: s.isActive ? 'var(--brand-deep)' : 'var(--muted)', background: s.isActive ? '#E9F4F0' : 'transparent' }}>
                      {s.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td style={{ ...td, ...tdR }}>
                    <RowActions survey={s} baseUrl={baseUrl} toggleAction={toggleActiveAction} deleteAction={deleteSurveyAction} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── estilos ──────────────────────────────────────────────────────────────────
const th: React.CSSProperties = { padding: '12px 16px', fontWeight: 400 }
const thC: React.CSSProperties = { ...th, textAlign: 'center' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '12px 16px', verticalAlign: 'middle' }
const tdC: React.CSSProperties = { textAlign: 'center' }
const tdR: React.CSSProperties = { textAlign: 'right' }
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: 'var(--ink)' }
const hintStyle: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' }
const inputStyle: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 10, padding: '10px 13px', fontSize: 15, fontFamily: 'var(--font-body)', color: 'var(--ink)', background: '#fff', outline: 'none' }
