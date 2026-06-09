'use client'

/**
 * LoginForm — client component for the admin login page.
 *
 * Uses useActionState (React 19 / Next.js 15+) to receive the error result
 * from loginAction and display it without a full page reload.
 * On success, loginAction calls redirect('/admin') which Next.js handles
 * as a client-side navigation.
 */

import { useActionState } from 'react'
import { loginAction, type LoginResult } from '@/actions/adminAuth'

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null)

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && (
        <div role="alert" data-error className="text-sm text-red-600 text-center rounded-lg bg-red-50 px-3 py-2">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          disabled={isPending}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Verificando…' : 'Ingresar'}
      </button>
    </form>
  )
}
