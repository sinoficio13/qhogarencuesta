/**
 * /admin — Dashboard general. Salud global del sistema (no el listado).
 *   - KPIs: total de encuestas, total de respuestas, respuestas últimos 7 días.
 *   - QR de acceso rápido desde el teléfono.
 * El listado y la gestión viven en /admin/encuestas; la analítica en /admin/reportes.
 */
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db } from '@/db'
import { surveys, responses } from '@/db/schema'
import { count, gte } from 'drizzle-orm'
import QRCode from 'qrcode'
import Link from 'next/link'

function Kpi({ value, label, hint }: { value: number | string; label: string; hint?: string }) {
  return (
    <div style={{ flex: '1 1 180px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', padding: '18px 20px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34, lineHeight: 1, color: 'var(--brand-deep)' }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', marginTop: 8 }}>{label}</div>
      {hint && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-2)', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

export default async function DashboardPage() {
  await requireAdmin()
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  const [{ surveyCount }] = await db.select({ surveyCount: count() }).from(surveys)
  const [{ total }] = await db.select({ total: count() }).from(responses)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [{ last7 }] = await db.select({ last7: count() }).from(responses).where(gte(responses.submittedAt, since))

  const homeQr = await QRCode.toString(baseUrl, { type: 'svg', margin: 1, width: 150, errorCorrectionLevel: 'M' })

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', margin: '0 0 4px', color: 'var(--ink)' }}>
        Dashboard
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 24px' }}>Estado general del sistema de encuestas.</p>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'stretch', marginBottom: 24 }}>
        <Kpi value={surveyCount} label="Encuestas creadas" />
        <Kpi value={total} label="Respuestas recibidas" hint="acumuladas, todas las encuestas" />
        <Kpi value={last7} label="Respuestas (7 días)" hint="últimos 7 días" />

        {/* QR de acceso rápido */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', padding: '12px 16px' }}>
          <div style={{ width: 120, height: 120, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: homeQr }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted-2)', textAlign: 'center' }}>
            Escaneá para entrar<br />desde el teléfono
          </span>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/admin/encuestas" style={quickLink}>
          → Gestionar encuestas
        </Link>
        <Link href="/admin/reportes" style={quickLink}>
          → Ver reportes
        </Link>
      </div>
    </div>
  )
}

const quickLink: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 14,
  color: 'var(--brand-deep)',
  background: '#E9F4F0',
  border: '1px solid #CDE6DD',
  borderRadius: 10,
  padding: '12px 18px',
  textDecoration: 'none',
}
