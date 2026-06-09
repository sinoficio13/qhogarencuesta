/**
 * /admin — Admin panel home page.
 *
 * requireAdmin() is already called by /admin/layout.tsx (defense-in-depth).
 * This page adds a redundant guard to ensure Server Action authors see the pattern.
 *
 * WU-5 will replace the placeholder content with the actual survey list + CRUD links.
 */

import { requireAdmin } from '@/lib/auth/requireAdmin'

export default async function AdminPage() {
  // Defense-in-depth: explicit per-page guard (design §4, CVE-2025-29927)
  await requireAdmin()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-800">Panel</h1>
      <p className="text-gray-500 text-sm">
        WU-5 — Gestión de encuestas se implementará aquí. <br />
        Por ahora el guard de autenticación está activo y funcionando.
      </p>
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="font-medium text-gray-700">Compradores</p>
          <p className="text-sm text-gray-400 mt-1">Próximamente en WU-5</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="font-medium text-gray-700">Agentes</p>
          <p className="text-sm text-gray-400 mt-1">Próximamente en WU-5</p>
        </div>
      </div>
    </div>
  )
}
