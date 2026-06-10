'use client'

/**
 * Sidebar del panel admin. Navegación persistente entre secciones:
 * Dashboard · Encuestas · Reportes. Resalta la sección activa (usePathname).
 * Responsive: barra vertical en desktop (md+), barra horizontal arriba en móvil.
 */
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

const UUID = /^\/admin\/[0-9a-f-]{36}/

const NAV = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
    isActive: (p: string) => p === '/admin',
  },
  {
    href: '/admin/encuestas',
    label: 'Encuestas',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
    isActive: (p: string) => p.startsWith('/admin/encuestas') || UUID.test(p),
  },
  {
    href: '/admin/reportes',
    label: 'Reportes',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    isActive: (p: string) => p.startsWith('/admin/reportes'),
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside
      style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
      className="border-b md:border-b-0 md:border-r md:w-56 md:min-h-screen md:shrink-0"
    >
      {/* Brand */}
      <div className="px-5 py-4 flex items-center" style={{ borderColor: 'var(--line)' }}>
        <Link href="/admin" aria-label="QHogar — inicio" className="inline-flex">
          <Image src="/qhogar-logo.svg" alt="QHogar" width={132} height={60} priority style={{ width: 132, height: 'auto' }} />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex md:flex-col gap-1 px-3 pb-3 md:pt-2 overflow-x-auto">
        {NAV.map((item) => {
          const on = item.isActive(pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 whitespace-nowrap transition-colors"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14.5,
                fontWeight: on ? 600 : 500,
                color: on ? 'var(--brand-deep)' : 'var(--muted)',
                background: on ? '#E9EFF6' : 'transparent',
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
