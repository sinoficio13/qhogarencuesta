/**
 * DTO mapper: DB row shapes → SurveyView DTO (public survey rendering).
 * PURE — no DB imports, no framework deps.
 */

/** Patrón de marca de agua por encuesta. Fuente de verdad del tipo (capa lib). */
export type WatermarkStyle = 'none' | 'centered' | 'tiled' | 'corner'

/** Coacciona un valor crudo de DB a un WatermarkStyle válido (default 'none'). */
export function normalizeWatermarkStyle(value: string | null | undefined): WatermarkStyle {
  return value === 'centered' || value === 'tiled' || value === 'corner'
    ? value
    : 'none'
}

// ── DB row types (mirror schema, no Drizzle inference dependency) ─────────────

export interface DbOption {
  id: string
  questionId: string
  position: number
  text: string
  isControl: boolean
}

export interface DbScaleRow {
  id: string
  questionId: string
  position: number
  labelHtml: string
}

export interface DbQuestion {
  id: string
  surveyId: string
  position: number
  type: 'single' | 'multi' | 'scale' | 'open'
  text: string
  hint: string | null
  hintWhy: string | null
  isRequired: boolean
  maxSelect: number | null
  options: DbOption[]
  scaleRows: DbScaleRow[]
}

export interface DbAgency {
  id: string
  slug: string
  name: string
  logo: string
}

export interface SurveyDbRow {
  id: string
  slug: string
  title: string
  description: string | null
  metaChips: string[] | null
  noteHtml: string | null
  isActive: boolean
  // PIVOT dedup fields
  identifierType: string | null
  identifierLabel: string | null
  // Agencia de campo (co-branding). null cuando la encuesta no tiene agencia.
  agency?: DbAgency | null
  // Marca de agua por encuesta
  watermarkImage?: string | null
  watermarkStyle?: string | null
  questions: DbQuestion[]
}

// ── View DTO types (server → client props) ────────────────────────────────────

export interface OptionView {
  id: string
  text: string
  isControl: boolean
}

export interface ScaleRowView {
  id: string
  labelHtml: string
}

export interface QuestionView {
  id: string
  type: 'single' | 'multi' | 'scale' | 'open'
  text: string
  hint: string | null
  hintWhy: string | null
  isRequired: boolean
  maxSelect: number | null
  /** Present for single/multi questions; absent for scale/open */
  options?: OptionView[]
  /** Present for scale questions; absent for single/multi/open */
  scaleRows?: ScaleRowView[]
}

export interface AgencyView {
  name: string
  logo: string
}

export interface SurveyView {
  id: string
  slug: string
  title: string
  description: string | null
  metaChips: string[] | null
  noteHtml: string | null
  /** PIVOT dedup: 'email' | 'cedula' — which identifier to collect */
  identifierType: 'email' | 'cedula'
  /** Optional custom label for the identifier field shown in the form */
  identifierLabel: string | null
  /** Agencia de campo para co-branding; null si la encuesta no tiene agencia */
  agency: AgencyView | null
  /** URL de la imagen de marca de agua; null si no hay */
  watermarkImage: string | null
  /** Patrón de marca de agua; 'none' si no se muestra */
  watermarkStyle: WatermarkStyle
  questions: QuestionView[]
}

// ── Mapper ────────────────────────────────────────────────────────────────────

export function toSurveyView(row: SurveyDbRow | null): SurveyView | null {
  if (!row) return null

  const questions: QuestionView[] = row.questions
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((q) => {
      const base = {
        id: q.id,
        type: q.type,
        text: q.text,
        hint: q.hint,
        hintWhy: q.hintWhy,
        isRequired: q.isRequired,
        maxSelect: q.maxSelect,
      }

      if (q.type === 'single' || q.type === 'multi') {
        const options: OptionView[] = q.options
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((o) => ({ id: o.id, text: o.text, isControl: o.isControl }))
        return { ...base, options }
      }

      if (q.type === 'scale') {
        const scaleRows: ScaleRowView[] = q.scaleRows
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((r) => ({ id: r.id, labelHtml: r.labelHtml }))
        return { ...base, scaleRows }
      }

      // 'open' — no options or scaleRows
      return base
    })

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    metaChips: row.metaChips,
    noteHtml: row.noteHtml,
    identifierType: (row.identifierType === 'cedula' ? 'cedula' : 'email') as 'email' | 'cedula',
    identifierLabel: row.identifierLabel ?? null,
    agency: row.agency ? { name: row.agency.name, logo: row.agency.logo } : null,
    watermarkImage: row.watermarkImage ?? null,
    watermarkStyle: normalizeWatermarkStyle(row.watermarkStyle),
    questions,
  }
}
