/**
 * /admin layout — sidebar persistente + header, con guard de auth.
 *
 * requireAdmin() re-chequea la sesión en cada render (defensa en profundidad
 * además del middleware Edge). El layout envuelve todas las rutas /admin/**
 * protegidas con el Sidebar (Dashboard · Encuestas · Reportes).
 */
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { logoutAction } from '@/actions/adminAuth'
import Sidebar from './Sidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()

  return (
    <div className="md:flex" style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <Sidebar />
      <div className="flex-1 min-w-0">
        <header
          className="flex items-center justify-end px-5 py-3"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}
        >
          <form action={logoutAction}>
            <button
              type="submit"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12.5,
                color: 'var(--muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cerrar sesión
            </button>
          </form>
        </header>
        <main style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 20px 60px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
