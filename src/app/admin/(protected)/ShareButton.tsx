'use client'

/**
 * Botón "Compartir" que comparte el link público DIRECTAMENTE, sin navegar
 * a otra vista:
 *   - Móvil / navegadores con Web Share API → abre la hoja nativa de compartir
 *     (WhatsApp, etc.) con navigator.share().
 *   - PC / sin Web Share API → copia el link al portapapeles y muestra "¡Copiado!".
 *
 * Reemplaza el viejo link a /admin/[surveyId]/links (esa vista sigue existiendo
 * como detalle, pero ya no es el camino primario para compartir).
 */
import { useState } from 'react'

interface Props {
  url: string
  title: string
}

export default function ShareButton({ url, title }: Props) {
  const [feedback, setFeedback] = useState<string | null>(null)

  async function handleShare() {
    // Web Share API (móvil y algunos navegadores de escritorio)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch (err) {
        // El usuario canceló la hoja de compartir → no es un error real.
        if (err instanceof Error && err.name === 'AbortError') return
        // Cualquier otra falla → caemos al copiado.
      }
    }

    // Fallback: copiar al portapapeles
    try {
      await navigator.clipboard.writeText(url)
      setFeedback('¡Copiado!')
    } catch {
      setFeedback(url)
    }
    setTimeout(() => setFeedback(null), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      title={url}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        letterSpacing: '.04em',
        color: 'var(--brand-deep)',
        background: '#E9F4F0',
        border: '1px solid #CDE6DD',
        borderRadius: 8,
        padding: '5px 11px',
        cursor: 'pointer',
        lineHeight: 1.4,
      }}
    >
      {feedback ?? 'Compartir'}
    </button>
  )
}
