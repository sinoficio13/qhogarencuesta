/**
 * /admin/login — Login page for the admin panel.
 *
 * Shell RSC + LoginForm client component (needs useActionState for error feedback).
 */

import Image from 'next/image'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
      <div className="w-full max-w-sm rounded-2xl p-8 space-y-6" style={{ background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow)' }}>
        <div className="flex flex-col items-center gap-3">
          <Image src="/qhogar-logo.svg" alt="QHogar" width={150} height={68} priority style={{ width: 150, height: 'auto' }} />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted-2)', margin: 0 }}>
            Panel de administración
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
