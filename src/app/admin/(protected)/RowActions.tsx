'use client'

/**
 * Menú de acciones «…» por fila de la tabla de encuestas.
 * Agrupa Editar · Vista previa · Resultados · Compartir · Activar/Desactivar ·
 * Borrar en un dropdown.
 *
 * UX FIX: el menú se renderiza con position:fixed anclado al botón (medido con
 * getBoundingClientRect), NO con position:absolute dentro de la fila. Motivo:
 * el contenedor de la tabla usa overflow-x:auto y, por spec CSS, eso fuerza
 * overflow-y:auto → un menú absolute quedaba recortado y generaba scroll fantasma.
 * Fixed lo saca de cualquier ancestro con overflow. Se cierra al hacer scroll.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
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
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const publicUrl = `${baseUrl}/${survey.slug}`

  const close = useCallback(() => setOpen(false), [])

  // Anclar el menú al botón y cerrarlo si la página se mueve.
  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => close()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setOpen((v) => !v)
  }

  async function share() {
    close()
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: survey.title, url: publicUrl }); return } catch { /* cancelado o sin soporte */ }
    }
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* noop */ }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Acciones"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          background: open ? 'var(--paper)' : 'transparent',
          border: '1px solid var(--line)', borderRadius: 8, padding: '4px 10px',
          cursor: 'pointer', color: 'var(--muted)', fontSize: 18, lineHeight: 1,
        }}
      >
        ⋯
      </button>

      {open && pos && (
        <>
          {/* click-outside */}
          <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 80 }} />
          <div
            role="menu"
            style={{
              position: 'fixed', top: pos.top, right: pos.right, zIndex: 81, minWidth: 200,
              background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
              boxShadow: 'var(--shadow)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
            }}
          >
            <Link href={`/admin/${survey.id}`} style={item} onClick={close}>✏️ Editar preguntas</Link>
            <Link href={`/admin/${survey.id}/preview`} style={item} onClick={close}>👁 Vista previa</Link>
            <Link href={`/admin/${survey.id}/responses`} style={item} onClick={close}>📊 Resultados</Link>
            <button type="button" onClick={share} style={btnItem}>
              {copied ? '✓ ¡Copiado!' : '🔗 Compartir link'}
            </button>
            <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
            <form action={toggleAction} onSubmit={close}>
              <input type="hidden" name="id" value={survey.id} />
              <button type="submit" style={btnItem}>
                {survey.isActive ? '⏸ Desactivar' : '▶ Activar'}
              </button>
            </form>
            <form action={deleteAction} onSubmit={(e) => { if (!confirm(`¿Borrar "${survey.title}" y todas sus respuestas? No se puede deshacer.`)) { e.preventDefault(); return } close() }}>
              <input type="hidden" name="id" value={survey.id} />
              <button type="submit" style={{ ...btnItem, color: '#c0392b' }}>
                🗑 Borrar
              </button>
            </form>
          </div>
        </>
      )}
    </>
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

const btnItem: React.CSSProperties = {
  ...item,
  textAlign: 'left',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
}
