'use client'

/**
 * Formulario de "Agregar pregunta" — versión clara y estética.
 *
 * Patrones aplicados (survey-builder UX, tipo Typeform/Google Forms):
 *  - Selector de TIPO como tarjetas visuales (ícono + nombre + descripción),
 *    en vez de un dropdown con jerga técnica (single/multi/scale/open).
 *  - Progressive disclosure: el "máximo de opciones" aparece SOLO si el tipo
 *    es múltiple. Nada de campos irrelevantes a la vista.
 *  - Lenguaje humano + ayuda contextual según el tipo elegido.
 *
 * Envía a la server action `action` (createQuestionAction) vía <form action>.
 * Tras crear, la action hace redirect → la página se refresca y el form se resetea.
 */
import { useState } from 'react'

type QType = 'single' | 'multi' | 'scale' | 'open'

interface Props {
  surveyId: string
  action: (formData: FormData) => void | Promise<void>
}

const TYPES: { value: QType; icon: string; name: string; desc: string; help: string }[] = [
  {
    value: 'single',
    icon: '◉',
    name: 'Opción única',
    desc: 'Elige UNA respuesta',
    help: 'Después de crear la pregunta, le agregás las opciones a elegir.',
  },
  {
    value: 'multi',
    icon: '☑',
    name: 'Opción múltiple',
    desc: 'Elige VARIAS respuestas',
    help: 'Después de crear la pregunta, le agregás las opciones. Podés limitar el máximo a elegir.',
  },
  {
    value: 'scale',
    icon: '★',
    name: 'Escala 1–5',
    desc: 'Puntúa varias filas',
    help: 'Después de crear la pregunta, agregás las filas que la persona puntúa del 1 al 5.',
  },
  {
    value: 'open',
    icon: '✎',
    name: 'Respuesta abierta',
    desc: 'Texto libre',
    help: 'La persona escribe una respuesta libre. No lleva opciones ni filas.',
  },
]

export default function AddQuestionForm({ surveyId, action }: Props) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<QType>('single')
  const [required, setRequired] = useState(true)

  const selected = TYPES.find((t) => t.value === type)!

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          marginBottom: 28,
          border: '1px dashed var(--sage)',
          borderRadius: 14,
          background: 'var(--surface)',
          padding: '18px 22px',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          color: 'var(--brand-deep)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        + Agregar pregunta
      </button>
    )
  }

  return (
    <div
      style={{
        marginBottom: 28,
        border: '1px solid var(--line)',
        borderRadius: 14,
        background: 'var(--surface)',
        padding: '20px 22px',
        boxShadow: 'var(--shadow)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, margin: 0, color: 'var(--ink)' }}>
          Nueva pregunta
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      {/* 1) Tipo de pregunta — tarjetas visuales */}
      <p style={labelTextStyle}>1 · ¿Qué tipo de pregunta?</p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
          marginBottom: 6,
        }}
      >
        {TYPES.map((t) => {
          const isSel = t.value === type
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 12,
                cursor: 'pointer',
                border: `1px solid ${isSel ? 'var(--brand)' : 'var(--line)'}`,
                background: isSel ? '#F0F8F5' : '#fff',
                boxShadow: isSel ? 'inset 0 0 0 1px var(--brand)' : 'none',
                transition: '.15s ease',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14.5, color: isSel ? 'var(--brand-deep)' : 'var(--ink)' }}>
                {t.name}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.3 }}>{t.desc}</span>
            </button>
          )
        })}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
        💡 {selected.help}
      </p>

      {/* Form de envío */}
      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <input type="hidden" name="surveyId" value={surveyId} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="isRequired" value={String(required)} />

        {/* 2) Texto */}
        <label style={labelStyle}>
          <span style={labelTextStyle}>2 · Texto de la pregunta</span>
          <textarea
            name="text"
            required
            rows={2}
            placeholder="Ej: ¿Qué fue lo más importante al elegir tu vivienda?"
            style={{ ...inputStyle, resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
          />
        </label>

        {/* 3) Ayuda opcional */}
        <label style={labelStyle}>
          <span style={labelTextStyle}>3 · Texto de ayuda <span style={mutedTag}>opcional</span></span>
          <input name="hint" placeholder="Aclaración chica que aparece debajo de la pregunta" style={inputStyle} />
        </label>

        {/* 4) Obligatoria / Opcional — segmentado */}
        <div>
          <span style={labelTextStyle}>4 · ¿Es obligatoria?</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[
              { val: true, label: 'Obligatoria' },
              { val: false, label: 'Opcional' },
            ].map((o) => {
              const isSel = required === o.val
              return (
                <button
                  key={String(o.val)}
                  type="button"
                  onClick={() => setRequired(o.val)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: `1px solid ${isSel ? 'var(--brand)' : 'var(--line)'}`,
                    background: isSel ? '#F0F8F5' : '#fff',
                    color: isSel ? 'var(--brand-deep)' : 'var(--muted)',
                  }}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 5) Máximo de opciones — SOLO si es múltiple */}
        {type === 'multi' && (
          <label style={labelStyle}>
            <span style={labelTextStyle}>5 · Máximo de opciones a elegir <span style={mutedTag}>opcional</span></span>
            <input
              name="maxSelect"
              type="number"
              min={1}
              placeholder="Dejá vacío para sin límite"
              style={{ ...inputStyle, maxWidth: 220 }}
            />
          </label>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" className="btn">Crear pregunta</button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 11, padding: '13px 20px', color: 'var(--muted)', cursor: 'pointer', fontSize: 15 }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

// ── estilos ──────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const labelTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 14,
  color: 'var(--ink)',
}

const mutedTag: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 400,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: 'var(--muted-2)',
  marginLeft: 6,
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: '11px 14px',
  fontSize: 15,
  fontFamily: 'var(--font-body)',
  color: 'var(--ink)',
  background: '#fff',
  outline: 'none',
  width: '100%',
}
