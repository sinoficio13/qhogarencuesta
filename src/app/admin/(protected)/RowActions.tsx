'use client'

/**
 * Menú de acciones «…» por fila de la tabla de encuestas.
 * Agrupa Editar · Vista previa · Resultados · Compartir · Activar/Desactivar ·
 * Borrar en un dropdown, para no llenar la fila de 6 botones.
 * Las acciones de servidor (toggle/delete) llegan como props.
 */
import { useState } from 'react'
import Link from 'next/link'

interface Survey {
  id: string
  slug: string
  title: string
  isActive: boolean
}

export default function RowActions({
  survey,
  baseUrl,
  toggleAction,
  deleteAction,
}: {
  survey: Survey
  baseUrl: string
  toggleAction: (formData: FormData) => void | Promise<void>
  deleteAction: (formData: FormData) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const publicUrl = `${baseUrl}/${survey.slug}`

  async function share() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: survey.title, url: publicUrl }); return } catch { /* cancelado o sin soporte */ }
    }
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* noop */ }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Acciones"
        style={{ background: 'transparent', border: '1px solid var(--line)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, lineHeight: 1 }}
      >
        ⋯
      </button>

      {open && (
        <>
          {/* click-outside */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
          <div
            style={{
              position: 'absolute', right: 0, top: '110%', zIndex: 11, minWidth: 190,
              background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
              boxShadow: 'var(--shadow)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
            }}
          >
            <Link href={`/admin/${survey.id}`} style={item}>✏️ Editar preguntas</Link>
            <Link href={`/admin/${survey.id}/preview`} style={item}>👁 Vista previa</Link>
            <Link href={`/admin/${survey.id}/responses`} style={item}>📊 Resultados</Link>
            <button type="button" onClick={share} style={{ ...item, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>
              {copied ? '✓ ¡Copiado!' : '🔗 Compartir link'}
            </button>
            <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
            <form action={toggleAction}>
              <input type="hidden" name="id" value={survey.id} />
              <button type="submit" style={{ ...item, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>
                {survey.isActive ? '⏸ Desactivar' : '▶ Activar'}
              </button>
            </form>
            <form action={deleteAction} onSubmit={(e) => { if (!confirm(`¿Borrar "${survey.title}" y todas sus respuestas? No se puede deshacer.`)) e.preventDefault() }}>
              <input type="hidden" name="id" value={survey.id} />
              <button type="submit" style={{ ...item, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', width: '100%', color: '#c0392b' }}>
                🗑 Borrar
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}

const item: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13.5,
  color: 'var(--ink)',
  textDecoration: 'none',
  padding: '8px 10px',
  borderRadius: 8,
  display: 'block',
}
