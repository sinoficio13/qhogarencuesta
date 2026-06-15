/**
 * Watermark — capa de marca de agua para una encuesta.
 *
 * Renderiza la imagen según el patrón configurado, o null si no hay imagen
 * o el patrón es 'none'. Debe ir dentro de un contenedor `position:relative`,
 * con el contenido del formulario en una capa `zIndex >= 1` por encima.
 */
import { watermarkLayerStyle, type WatermarkStyle } from './watermarkStyles'

export function Watermark({
  image,
  style,
}: {
  image: string | null
  style: WatermarkStyle
}) {
  if (!image || style === 'none') return null

  const layer = watermarkLayerStyle(style, image)
  if (!layer) return null

  return <div aria-hidden style={layer} />
}
