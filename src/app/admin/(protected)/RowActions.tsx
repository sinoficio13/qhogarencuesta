'use client'

/**
 * Menú «…» por fila de encuesta. SOLO acciones que NO están dentro del editor:
 * Activar/Desactivar y Borrar. (Editar, Vista previa, Resultados y Compartir
 * viven como pestañas dentro de /admin/[id], al que se entra tocando el nombre.)
 *
 * Posición: fixed anclado al botón y CLAMPED al viewport para no recortarse en
 * móvil (antes se salía del borde izquierdo).
 */
import { useState, useRef, useEffect, useCallback } from 'react'

interface Survey {
  id: string
  title: string
  isActive: boolean
}

const MENU_W = 210

export default function RowActions({
  survey,
  toggleAction,
  deleteAction,
}: {
  survey: Survey
  toggleAction: (formData: FormData) => void | Promise<void>
  deleteAction: (formData: FormData) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onMove = () => close()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      // right tal que el menú quede dentro del viewport (margen 8px a cada lado)
      const right = Math.max(8, Math.min(vw - r.right, vw - MENU_W - 8))
      setPos({ top: r.bottom + 6, right })
    }
    setOpen((v) => !v)
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
          <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 80 }} />
          <div
            role="menu"
            style={{
              position: 'fixed', top: pos.top, right: pos.right, zIndex: 81,
              width: MENU_W, maxWidth: 'calc(100vw - 16px)',
              background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12,
              boxShadow: 'var(--shadow)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
            }}
          >
            <form action={toggleAction} onSubmit={close}>
              <input type="hidden" name="id" value={survey.id} />
              <button type="submit" style={btnItem}>
                {survey.isActive ? '⏸ Desactivar' : '▶ Activar'}
              </button>
            </form>
            <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
            <form action={deleteAction} onSubmit={(e) => { if (!confirm(`¿Borrar "${survey.title}" y todas sus respuestas? No se puede deshacer.`)) { e.preventDefault(); return } close() }}>
              <input type="hidden" name="id" value={survey.id} />
              <button type="submit" style={{ ...btnItem, color: '#c0392b' }}>🗑 Borrar</button>
            </form>
          </div>
        </>
      )}
    </>
  )
}

const btnItem: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--ink)',
  textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
  width: '100%', padding: '10px 10px', borderRadius: 8, display: 'block',
}
