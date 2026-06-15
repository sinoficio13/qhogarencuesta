'use client'

/**
 * WatermarkSettings — configura la marca de agua de UNA encuesta.
 *  - Elegís imagen (preview local, NO se sube todavía) y patrón.
 *  - El botón "Guardar cambios" persiste todo junto: sube la imagen a Vercel
 *    Blob, fija el patrón y/o quita la imagen, según corresponda.
 *
 * El preview reusa watermarkLayerStyle → misma fuente de verdad que el render
 * público. Lo que ves acá es lo que verá el encuestado.
 */
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  uploadWatermarkImage,
  setWatermarkStyle,
  removeWatermarkImage,
} from '@/actions/adminWatermark'
import { validateWatermarkImage } from '@/lib/validation/crud'
import {
  watermarkLayerStyle,
  WATERMARK_LABELS,
  WATERMARK_STYLES,
  type WatermarkStyle,
} from '@/components/survey/watermarkStyles'

export default function WatermarkSettings({
  surveyId,
  initialImage,
  initialStyle,
}: {
  surveyId: string
  initialImage: string | null
  initialStyle: WatermarkStyle
}) {
  // Lo PERSISTIDO (última verdad guardada en la DB)
  const [savedImage, setSavedImage] = useState<string | null>(initialImage)
  const [savedStyle, setSavedStyle] = useState<WatermarkStyle>(initialStyle)

  // Lo EDITADO en pantalla (todavía sin guardar)
  const [style, setStyle] = useState<WatermarkStyle>(initialStyle)
  const [file, setFile] = useState<File | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [removePending, setRemovePending] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  // Limpiar el objectURL del preview local para no leakear memoria
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  // Imagen que se MUESTRA: el archivo nuevo > la guardada (salvo que se vaya a quitar)
  const shownImage = localPreview ?? (removePending ? null : savedImage)

  const dirty =
    style !== savedStyle || file !== null || (removePending && savedImage !== null)

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (!picked) return
    const check = validateWatermarkImage({ type: picked.type, size: picked.size })
    if (!check.ok) {
      setError(check.error)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setError(null)
    setSaved(false)
    if (localPreview) URL.revokeObjectURL(localPreview)
    setFile(picked)
    setLocalPreview(URL.createObjectURL(picked))
    setRemovePending(false)
  }

  function onPickStyle(next: WatermarkStyle) {
    setStyle(next)
    setSaved(false)
    setError(null)
  }

  function onRemove() {
    setSaved(false)
    setError(null)
    if (file) {
      // todavía no se guardó: solo descartar la selección local
      if (localPreview) URL.revokeObjectURL(localPreview)
      setFile(null)
      setLocalPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    } else if (savedImage) {
      // marcar para borrar al guardar
      setRemovePending(true)
    }
  }

  function onSave() {
    setError(null)
    startTransition(async () => {
      // 1. Imagen: subir nueva, o quitar la existente
      if (file) {
        const fd = new FormData()
        fd.set('surveyId', surveyId)
        fd.set('file', file)
        const res = await uploadWatermarkImage(fd)
        if (!res.ok) {
          setError(res.errors.file ?? res.errors.surveyId ?? 'No se pudo subir la imagen.')
          return
        }
        setSavedImage(res.url)
        if (localPreview) URL.revokeObjectURL(localPreview)
        setFile(null)
        setLocalPreview(null)
        if (fileRef.current) fileRef.current.value = ''
      } else if (removePending) {
        const res = await removeWatermarkImage({ surveyId })
        if (!res.ok) {
          setError('No se pudo quitar la imagen.')
          return
        }
        setSavedImage(null)
        setRemovePending(false)
      }

      // 2. Patrón
      if (style !== savedStyle) {
        const res = await setWatermarkStyle({ surveyId, style })
        if (!res.ok) {
          setError(res.errors.style ?? 'No se pudo guardar el patrón.')
          return
        }
        setSavedStyle(style)
      }

      setSaved(true)
    })
  }

  const previewLayer = shownImage ? watermarkLayerStyle(style, shownImage) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
      <section style={card}>
        <h2 style={h2}>Imagen de la marca de agua</h2>
        <p style={muted}>PNG, JPG o WebP · hasta 2 MB. Se usa solo en esta encuesta.</p>

        {shownImage ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shownImage}
              alt="Marca de agua"
              style={{ height: 56, width: 'auto', borderRadius: 8, border: '1px solid var(--line)', background: '#fff', padding: 6 }}
            />
            <button type="button" onClick={onRemove} disabled={pending} style={btnGhost}>
              Quitar
            </button>
            {file && <span style={{ ...muted, fontStyle: 'italic' }}>sin guardar</span>}
          </div>
        ) : (
          <p style={{ ...muted, marginTop: 12 }}>
            {removePending ? 'Se quitará al guardar.' : 'No hay imagen cargada.'}
          </p>
        )}

        <label style={{ ...btnGhost, marginTop: 14, display: 'inline-block', cursor: 'pointer' }}>
          {shownImage ? 'Elegir otra imagen' : 'Elegir imagen'}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onPickFile}
            disabled={pending}
            style={{ display: 'none' }}
          />
        </label>
      </section>

      <section style={card}>
        <h2 style={h2}>Patrón</h2>
        <p style={muted}>Cómo se aplica la imagen sobre la encuesta.</p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {WATERMARK_STYLES.map((s) => {
            const on = s === style
            return (
              <button
                key={s}
                type="button"
                onClick={() => onPickStyle(s)}
                disabled={pending}
                style={{
                  ...chip,
                  borderColor: on ? 'var(--brand)' : 'var(--line)',
                  background: on ? '#E9EFF6' : '#fff',
                  color: on ? 'var(--brand-deep)' : 'var(--muted)',
                  fontWeight: on ? 700 : 500,
                }}
              >
                {WATERMARK_LABELS[s]}
              </button>
            )
          })}
        </div>

        {/* Preview en vivo */}
        <div style={{ marginTop: 18 }}>
          <span style={{ ...muted, display: 'block', marginBottom: 8 }}>Vista previa</span>
          <div style={previewCard}>
            {previewLayer && <div aria-hidden style={previewLayer} />}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)' }}>
                ¿Recomendarías QHogar?
              </strong>
              <p style={{ ...muted, margin: '8px 0 0' }}>1. Pregunta de ejemplo</p>
              <p style={{ ...muted, margin: '6px 0 0' }}>2. Otra pregunta de ejemplo</p>
            </div>
            {style !== 'none' && !shownImage && (
              <p style={{ ...muted, position: 'relative', zIndex: 1, marginTop: 10, fontStyle: 'italic' }}>
                Elegí una imagen para ver el patrón.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Barra de guardado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button type="button" onClick={onSave} disabled={!dirty || pending} style={{ ...btn, opacity: !dirty || pending ? 0.5 : 1, cursor: !dirty || pending ? 'default' : 'pointer' }}>
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {dirty && !pending && <span style={{ ...muted, fontStyle: 'italic' }}>Tenés cambios sin guardar.</span>}
        {saved && !dirty && !pending && <span style={{ color: '#067647', fontSize: 14, fontWeight: 600 }}>✓ Cambios guardados</span>}
      </div>

      {error && <p style={{ color: '#b42318', fontSize: 14, margin: 0 }}>{error}</p>}
    </div>
  )
}

// ── estilos ─────────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  padding: 24,
}
const previewCard: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  // transform crea contexto de contención: el watermark 'centered' (position:
  // fixed) queda anclado a ESTA tarjeta en el preview, no al viewport.
  transform: 'translateZ(0)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  background: '#fff',
  padding: 20,
  minHeight: 130,
}
const h2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', margin: '0 0 4px' }
const muted: React.CSSProperties = { fontSize: 13, color: 'var(--muted)', margin: 0 }
const btn: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: '#fff', background: 'var(--brand)', border: 'none', borderRadius: 10, padding: '11px 20px' }
const btnGhost: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)', background: 'transparent', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }
const chip: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '.02em', border: '1px solid var(--line)', borderRadius: 999, padding: '7px 16px', cursor: 'pointer' }
