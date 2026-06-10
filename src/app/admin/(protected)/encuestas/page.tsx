/**
 * /admin/encuestas — Gestión de encuestas (listado + crear).
 * Tabla compacta con badges de estado y acciones agrupadas en menú «…».
 */
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db } from '@/db'
import { surveys, questions, responses } from '@/db/schema'
import { count, eq } from 'drizzle-orm'
import { deleteSurvey, toggleActive } from '@/actions/adminSurveys'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import RowActions from '../RowActions'

// ── server actions ──────────────────────────────────────────────────────────
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', margin: '0 0 2px', color: 'var(--ink)' }}>Encuestas</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>{surveyList.length} en total</p>
        </div>
        <Link href="/admin/encuestas/nueva" className="btn" style={{ textDecoration: 'none' }}>+ Nueva encuesta</Link>
      </div>

      {/* Lista — tabla en desktop, tarjetas en móvil (ver .s-table en globals.css) */}
      {surveyList.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>No hay encuestas todavía. Creá la primera con el botón de arriba.</p>
      ) : (
        <div className="s-card">
          <table className="s-table">
            <thead>
              <tr>
                <th>Nombre</th><th>Ruta</th><th className="c-num">Preg.</th><th className="c-num">Resp.</th><th>Estado</th><th className="c-act"></th>
              </tr>
            </thead>
            <tbody>
              {surveyList.map((s) => (
                <tr key={s.id}>
                  <td className="c-name"><span className="s-name">{s.title}</span></td>
                  <td data-label="Ruta"><span className="s-route">/{s.slug}</span></td>
                  <td className="c-num" data-label="Preguntas">{qm[s.id] ?? 0}</td>
                  <td className="c-num" data-label="Respuestas">{rm[s.id] ?? 0}</td>
                  <td data-label="Estado">
                    <span className={`s-badge${s.isActive ? ' on' : ''}`}>{s.isActive ? 'Activa' : 'Inactiva'}</span>
                  </td>
                  <td className="c-act">
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
