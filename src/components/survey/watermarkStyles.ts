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
 * Devuelve el style de la capa de marca de agua para un patrón + imagen dados.
 * Retorna null para 'none' (el caller no debe renderizar nada).
 */
export function watermarkLayerStyle(
  style: WatermarkStyle,
  image: string,
): CSSProperties | null {
  switch (style) {
    case 'centered':
      // FIXED al viewport: una sola estampa centrada que queda visible mientras
      // se scrollea (en un form largo, un único logo absoluto se vería una sola
      // vez en el medio). En producción se ancla a la pantalla; en el preview del
      // admin queda contenida porque la tarjeta tiene `transform` (crea contexto
      // de contención para fixed).
      return {
        position: 'fixed',
        inset: 0,
        backgroundImage: `url(${image})`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        // responsivo: ~360px en desktop, se achica en móvil para no tocar los bordes
        backgroundSize: 'min(360px, 72vw) auto',
        opacity: 0.1,
        pointerEvents: 'none',
        zIndex: 2,
      }
    case 'tiled':
      return {
        // Capa sobredimensionada (200%) y rotada: al rotar -22°, una capa del
        // doble del tamaño SIEMPRE cubre el contenedor sin dejar huecos en las
        // esquinas. El contenedor padre debe tener overflow:hidden para recortar.
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        transform: 'rotate(-22deg)',
        transformOrigin: 'center',
        backgroundImage: `url(${image})`,
        backgroundRepeat: 'repeat',
        backgroundSize: '150px auto',
        opacity: 0.09,
        pointerEvents: 'none',
        zIndex: 2,
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
        opacity: 0.18,
        pointerEvents: 'none',
        zIndex: 2,
      }
    case 'none':
    default:
      return null
  }
}
