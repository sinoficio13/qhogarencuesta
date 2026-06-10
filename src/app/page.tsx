/**
 * Root route — redirige al panel admin.
 *
 * Decisión del usuario: nadie elige encuesta desde la raíz; los respondentes
 * entran por su link directo (/buyers, /agents) difundido por WhatsApp. Así que
 * la raíz va directo al panel admin (que a su vez pide login si no hay sesión).
 */
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/admin')
}
