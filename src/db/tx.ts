/**
 * withTx — ejecuta un bloque en una transacción si el driver la soporta, o
 * secuencialmente (sobre el `db` directo) si NO la soporta.
 *
 * Por qué: el driver de producción es neon-http (HTTP/serverless), que NO
 * soporta transacciones interactivas y tira "No transactions support in
 * neon-http driver". node-postgres (local) sí las soporta. Este helper hace
 * que el mismo código corra en ambos.
 *
 * IMPORTANTE: en el camino sin transacción NO hay atomicidad (rollback). Los
 * usos actuales son seguros igual:
 *  - submitSurvey: el dedup lo garantiza el índice único (survey_id,
 *    identifier_hash), no la transacción.
 *  - reorder*: usan un enfoque de dos pasadas (offset +10000 → final) que evita
 *    colisiones de UNIQUE(parent, position) sin depender de la transacción.
 */
import { db } from './index'

type DBOrTx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db

export function isNoTxError(err: unknown): boolean {
  return err instanceof Error && /No transactions support/i.test(err.message)
}

export async function withTx<T>(fn: (tx: DBOrTx) => Promise<T>): Promise<T> {
  try {
    return await db.transaction((tx) => fn(tx))
  } catch (err) {
    if (isNoTxError(err)) {
      // Driver sin transacciones (neon-http): correr sobre el db directo.
      return await fn(db)
    }
    throw err
  }
}
