/**
 * /admin/encuestas/nueva — Crear una encuesta en su propia página.
 * Antes vivía en un <details> dentro del listado; ahora tiene su lugar.
 */
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createSurvey } from '@/actions/adminSurveys'
import { redirect } from 'next/navigation'
import Link from 'next/link'

async function createSurveyAction(formData: FormData) {
  'use server'
  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const slug = (formData.get('slug') as string | null)?.trim() ?? ''
  const description = (formData.get('description') as string | null)?.trim() || undefined
  const metaChipsRaw = (formData.get('metaChipsRaw') as string | null)?.trim() || undefined
  const noteHtml = (formData.get('noteHtml') as string | null)?.trim() || undefined
  const identifierTypeRaw = (formData.get('identifierType') as string | null) ?? 'email'
  const identifierType = identifierTypeRaw === 'cedula' ? 'cedula' : 'email'
  const identifierLabel = (formData.get('identifierLabel') as string | null)?.trim() || undefined
  const metaChips = metaChipsRaw ? metaChipsRaw.split(',').map((s) => s.trim()).filter(Boolean) : undefined
  await createSurvey({ title, slug, description, metaChips, noteHtml, identifierType, identifierLabel })
  redirect('/admin/encuestas')
}

export default async function NuevaEncuestaPage() {
  await requireAdmin()

  return (
    <div style={{ maxWidth: 640 }}>
      <Link href="/admin/encuestas" style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--muted)', textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}>
        ← Volver a Encuestas
      </Link>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', margin: '0 0 4px', color: 'var(--ink)' }}>Nueva encuesta</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 24px' }}>Definí los datos base. Las preguntas se agregan después, en el editor.</p>

      <form action={createSurveyAction} style={{ display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)', padding: '24px' }}>
        <label style={labelStyle}>Título *<input name="title" required placeholder="Ej: Encuesta de compradores" style={inputStyle} /></label>
        <label style={labelStyle}>Slug * (URL)<input name="slug" required placeholder="Ej: compradores" style={inputStyle} /><span style={hintStyle}>Se usará en la URL. Se normaliza automáticamente.</span></label>
        <label style={labelStyle}>Descripción<input name="description" placeholder="Opcional" style={inputStyle} /></label>
        <label style={labelStyle}>Chips meta (coma)<input name="metaChipsRaw" placeholder="Ej: Compradores, 2025" style={inputStyle} /></label>
        <label style={labelStyle}>Nota HTML (se sanitiza)<textarea name="noteHtml" placeholder="Opcional" rows={2} style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} /></label>
        <label style={labelStyle}>Identificador del respondente *
          <select name="identifierType" defaultValue="email" style={{ ...inputStyle, cursor: 'pointer' }}><option value="email">Email</option><option value="cedula">Cédula</option></select>
          <span style={hintStyle}>Requerido para dedup — se guarda hasheado.</span>
        </label>
        <label style={labelStyle}>Label del identificador (opcional)<input name="identifierLabel" placeholder="Ej: Tu email, Número de documento" style={inputStyle} /></label>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="submit" className="btn">Crear encuesta</button>
          <Link href="/admin/encuestas" style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)', textDecoration: 'none', alignSelf: 'center' }}>Cancelar</Link>
        </div>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500, color: 'var(--ink)' }
const hintStyle: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' }
const inputStyle: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 10, padding: '10px 13px', fontSize: 15, fontFamily: 'var(--font-body)', color: 'var(--ink)', background: '#fff', outline: 'none' }
