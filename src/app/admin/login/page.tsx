/**
 * /admin/login — Login page for the admin panel.
 *
 * Shell RSC + LoginForm client component (needs useActionState for error feedback).
 */

import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8 space-y-6">
        <h1 className="text-2xl font-semibold text-center text-gray-800">
          Panel Admin
        </h1>
        <LoginForm />
      </div>
    </main>
  )
}
