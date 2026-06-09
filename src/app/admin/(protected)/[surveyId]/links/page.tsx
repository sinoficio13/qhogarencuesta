/**
 * /admin/[surveyId]/links — Invitation link generator + list.
 *
 * - Generate N links with optional label
 * - List all invitations: token, full URL, label, used/unused, createdAt
 * - Copy-to-clipboard button per link (client component)
 * - Counters: total / respondidos / pendientes
 */

import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db } from '@/db'
import { surveys, invitations } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { generateLinks } from '@/actions/adminLinks'
import CopyButton from './CopyButton'

interface Params {
  surveyId: string
}

// ── Form-action wrappers ───────────────────────────────────────────────────────

async function generateLinksAction(formData: FormData) {
  'use server'
  const surveyId = formData.get('surveyId') as string
  const countRaw = formData.get('count') as string
  const count = Math.max(1, Math.min(500, parseInt(countRaw, 10) || 1))
  const label = (formData.get('label') as string | null)?.trim() || undefined

  await generateLinks({ surveyId, count, label })
  redirect(`/admin/${surveyId}/links`)
}

// ── Page component ─────────────────────────────────────────────────────────────

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

  const invitationList = await db
    .select()
    .from(invitations)
    .where(eq(invitations.surveyId, surveyId))
    .orderBy(desc(invitations.createdAt))

  const total = invitationList.length
  const used = invitationList.filter((i) => i.usedAt !== null).length
  const pending = total - used

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 6 }}>
          <a href={`/admin/${surveyId}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>
            ← {survey.title}
          </a>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', margin: '0 0 8px', color: 'var(--ink)' }}>
          Links de invitación
        </h1>
        {/* Counters */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Total', value: total },
            { label: 'Respondidos', value: used },
            { label: 'Pendientes', value: pending },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 16px', background: 'var(--surface)', minWidth: 100 }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, display: 'block', color: 'var(--ink)' }}>{value}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted-2)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Generate form */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', padding: '20px 24px', marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, margin: '0 0 16px', color: 'var(--ink)' }}>
          Generar links
        </h2>
        <form action={generateLinksAction} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input type="hidden" name="surveyId" value={surveyId} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
            Cantidad *
            <input
              name="count"
              type="number"
              min={1}
              max={500}
              defaultValue={10}
              required
              style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-body)', width: 100 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: 'var(--ink)', flex: 1, minWidth: 180 }}>
            Label (opcional)
            <input
              name="label"
              placeholder="Ej: Lote noviembre 2025"
              style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-body)' }}
            />
          </label>
          <button type="submit" className="btn" style={{ alignSelf: 'flex-end' }}>
            Generar
          </button>
        </form>
      </div>

      {/* Invitation list */}
      {invitationList.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
          No hay links generados todavía. Generá el primero arriba.
        </p>
      ) : (
        <div style={{ border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: '#FAFCFB' }}>
                {['Token', 'URL', 'Label', 'Estado', 'Creado', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted-2)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invitationList.map((inv, i) => {
                const url = `${baseUrl}/r/${inv.token}`
                const isUsed = inv.usedAt !== null
                return (
                  <tr
                    key={inv.id}
                    style={{
                      borderBottom: i < invitationList.length - 1 ? '1px solid var(--line)' : 'none',
                      background: isUsed ? '#FAFAFA' : '#fff',
                    }}
                  >
                    <td style={{ padding: '10px 14px', color: 'var(--ink)', letterSpacing: '.04em' }}>
                      {inv.token}
                    </td>
                    <td style={{ padding: '10px 14px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', textDecoration: 'none', fontSize: 12 }}>
                        {url}
                      </a>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>
                      {inv.label ?? '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 10,
                          letterSpacing: '.06em',
                          textTransform: 'uppercase',
                          border: '1px solid',
                          borderColor: isUsed ? '#CDE6DD' : 'var(--line)',
                          color: isUsed ? 'var(--brand-deep)' : 'var(--muted)',
                          background: isUsed ? '#E9F4F0' : 'transparent',
                        }}
                      >
                        {isUsed ? 'Respondido' : 'Pendiente'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--muted-2)', whiteSpace: 'nowrap', fontSize: 11 }}>
                      {inv.createdAt
                        ? new Date(inv.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <CopyButton text={url} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
