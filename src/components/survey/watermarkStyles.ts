/**
 * watermarkStyles — única fuente de verdad para los patrones de marca de agua.
 *
 * Consumido por el render público (Watermark.tsx) y por el preview en vivo del
 * admin (WatermarkSettings.tsx). Si cambia un patrón, cambia en los dos lados.
 *
 * Los valores de opacidad/tamaño salieron del preview comparativo aprobado.
 */
import type { CSSProperties } from 'react'
import type { WatermarkStyle } from '@/lib/dto/surveyShape'

export type { WatermarkStyle }

export const WATERMARK_STYLES: readonly WatermarkStyle[] = [
  'none',
  'centered',
  'tiled',
  'corner',
] as const

export const WATERMARK_LABELS: Record<WatermarkStyle, string> = {
  none: 'Ninguna',
  centered: 'Centrada',
  tiled: 'Mosaico',
  corner: 'Esquina',
}

/**
 * Capa base común a centered/tiled: absoluta, como OVERLAY por encima del
 * contenido (las tarjetas del form son blanco opaco → una capa detrás quedaría
 * tapada). pointer-events:none deja pasar clicks y selección al formulario.
 */
const base: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 2,
}

/**
 * Devuelve el style de la capa de marca de agua para un patrón + imagen dados.
 * Retorna null para 'none' (el caller no debe renderizar nada).
 */
export function watermarkLayerStyle(
  style: WatermarkStyle,
  image: string,
): CSSProperties | null {
  switch (style) {
    case 'centered':
      return {
        ...base,
        backgroundImage: `url(${image})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundSize: '380px auto',
        opacity: 0.06,
      }
    case 'tiled':
      return {
        ...base,
        // se agranda y rota para que el mosaico quede en diagonal y cubra al recortar
        inset: '-30%',
        transform: 'rotate(-22deg)',
        backgroundImage: `url(${image})`,
        backgroundRepeat: 'repeat',
        backgroundSize: '150px auto',
        opacity: 0.05,
      }
    case 'corner':
      return {
        position: 'absolute',
        bottom: 18,
        right: 18,
        width: 190,
        height: 'auto',
        backgroundImage: `url(${image})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'contain',
        // alto fijo para reservar espacio; el contenido va por encima igual
        aspectRatio: '330 / 140',
        opacity: 0.12,
        pointerEvents: 'none',
        zIndex: 2,
      }
    case 'none':
    default:
      return null
  }
}
