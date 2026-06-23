'use client'

/**
 * CopyLink — muestra el link público de resultados con un botón "Copiar".
 * El link es siempre el mismo para la encuesta (determinista), así que se
 * encuentra siempre acá, en la pestaña Resultados. Copia la URL absoluta
 * (origin + path) para pegar directo en WhatsApp/mail.
 */
import { useState } from 'react'

export default function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin + path)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // si el navegador bloquea el clipboard, el usuario puede copiar el link a mano
    }
  }

  return (
    <div style={{ marginBottom: 20, border: '1px solid var(--line)', borderRadius: 10, padding: '12px 16px', background: 'var(--surface)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted-2)', marginBottom: 8 }}>
        Link público de resultados (sin login)
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <a href={path} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--brand-deep)', wordBreak: 'break-all', flex: 1, minWidth: 200 }}>
          {path}
        </a>
        <button
          type="button"
          onClick={copy}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 13, cursor: 'pointer', color: '#fff', background: copied ? 'var(--brand-deep)' : 'var(--brand)', border: 'none', borderRadius: 8, padding: '8px 14px', flex: 'none' }}
        >
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}
