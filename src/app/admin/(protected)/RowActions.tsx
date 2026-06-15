'use client'

/**
 * Acciones por fila de encuesta — botones INLINE (sin dropdown flotante).
 * Editar (link al editor con sus pestañas) · Activar/Desactivar · Borrar.
 * En móvil se apilan como una fila de botones al pie de la tarjeta (ver .c-act
 * y .row-actions en globals.css). Sin menús que se recorten ni posiciones raras.
 */
import Link from 'next/link'

interface Survey {
  id: string
  title: string
  isActive: boolean
}

export default function RowActions({
  survey,
  toggleAction,
  deleteAction,
}: {
  survey: Survey
  toggleAction: (formData: FormData) => void | Promise<void>
  deleteAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <div className="row-actions">
      <Link href={`/admin/${survey.id}`} className="ra-btn ra-primary">✏️ Editar</Link>

      <form action={toggleAction}>
        <input type="hidden" name="id" value={survey.id} />
        <button type="submit" className="ra-btn">
          {survey.isActive ? '⏸ Desactivar' : '▶ Activar'}
        </button>
      </form>

      <form
        action={deleteAction}
        onSubmit={(e) => {
          if (!confirm(`¿Borrar "${survey.title}" y todas sus respuestas? No se puede deshacer.`)) e.preventDefault()
        }}
      >
        <input type="hidden" name="id" value={survey.id} />
        <button type="submit" className="ra-btn ra-danger" aria-label="Borrar encuesta">🗑</button>
      </form>
    </div>
  )
}
