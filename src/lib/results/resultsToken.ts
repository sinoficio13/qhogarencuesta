/**
 * Token público de resultados — deriva un identificador impredecible por
 * encuesta a partir del surveyId, vía HMAC-SHA256 (Web Crypto, sin Node).
 *
 * Clave de diseño: el token NO se deriva del slug de respuesta, así el link
 * que ya circula entre quienes responden no expone los resultados. Es
 * determinista (mismo survey → mismo token) y no guarda estado en la DB, por
 * lo que para resolver token → encuesta se escanea la lista de encuestas
 * (aceptable: es un tool chico con pocas encuestas).
 *
 * Reusa ADMIN_SESSION_SECRET (ya configurado en prod). Si ese secreto se rota,
 * los links de resultados cambian — aceptable; migrar a una columna dedicada
 * (results_slug) si en algún momento se quiere que el link sea estable e
 * independiente del secreto de sesión.
 */
import { db } from '@/db'
import { surveys } from '@/db/schema'

const TOKEN_LEN = 32

function toBase64Url(bytes: Uint8Array): string {
  let b64 = ''
  for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i])
  return btoa(b64).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Token determinista e impredecible para una encuesta. */
export async function resultsToken(
  surveyId: string,
  secret = process.env.ADMIN_SESSION_SECRET ?? '',
): Promise<string> {
  const enc = new TextEncoder()
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`results:v1:${surveyId}`),
  )
  return toBase64Url(new Uint8Array(sig)).slice(0, TOKEN_LEN)
}

export interface ResultsSurveyRef {
  id: string
  title: string
  slug: string
}

/** Resuelve un token público al survey correspondiente, o null si no matchea. */
export async function findSurveyByResultsToken(
  token: string,
): Promise<ResultsSurveyRef | null> {
  if (!token || token.length !== TOKEN_LEN) return null
  const rows = await db
    .select({ id: surveys.id, title: surveys.title, slug: surveys.slug })
    .from(surveys)
  for (const r of rows) {
    if ((await resultsToken(r.id)) === token) return r
  }
  return null
}
