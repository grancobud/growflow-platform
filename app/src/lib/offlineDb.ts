// Cache offline con Dexie - guarda lecturas pesadas para cuando no hay wifi
// Las escrituras se encolan en `pendientes` para reenviar cuando vuelve la conexion

import Dexie, { type Table } from 'dexie'
import { supabase } from './supabase'

const MAX_INTENTOS = 5

export interface CacheEntry {
  key: string
  data: any
  fecha: number
}

export interface OperacionPendiente {
  id?: number
  tabla: string
  operacion: 'insert' | 'update' | 'delete'
  payload: any
  filtros?: any
  fecha: number
  intentos: number
  ultimo_error?: string
}

class BaseOffline extends Dexie {
  cache!: Table<CacheEntry>
  pendientes!: Table<OperacionPendiente>

  constructor() {
    // EL NOMBRE DE LA BASE NO SE TOCA, AUNQUE DIGA CANNTRACE.
    //
    // Dexie abre la base por este string. Cambiarlo no la renombra: crea una
    // NUEVA base vacia y deja la vieja donde estaba, invisible. Y en la vieja
    // esta la cola de `pendientes` — las operaciones que alguien cargo adentro
    // de una sala, donde no llega el wifi, esperando a subir.
    //
    // O sea que renombrarlo por prolijidad es perder datos que el operador cree
    // guardados, en silencio y sin ningun error. El string es un identificador
    // interno que no ve nadie; el costo de que sea feo es cero.
    super('canntrace_offline')
    this.version(1).stores({
      cache: 'key, fecha',
      pendientes: '++id, tabla, fecha',
    })
  }
}

export const offlineDb = new BaseOffline()

// Guardar lectura en cache
export async function cacheGuardar(key: string, data: any) {
  try {
    await offlineDb.cache.put({ key, data, fecha: Date.now() })
  } catch (e) {
    console.warn('cache write failed:', e)
  }
}

// Recuperar de cache (con TTL en ms, default 1 hora)
export async function cacheLeer<T>(key: string, ttlMs = 3600_000): Promise<T | null> {
  try {
    const e = await offlineDb.cache.get(key)
    if (!e) return null
    if (Date.now() - e.fecha > ttlMs) return null
    return e.data as T
  } catch {
    return null
  }
}

// Encolar operacion pendiente para sincronizar despues
export async function colaPush(op: Omit<OperacionPendiente, 'id' | 'fecha' | 'intentos'>) {
  await offlineDb.pendientes.add({
    ...op,
    fecha: Date.now(),
    intentos: 0,
  })
}

export async function colaContar(): Promise<number> {
  return offlineDb.pendientes.count()
}

export async function colaListar(): Promise<OperacionPendiente[]> {
  return offlineDb.pendientes.toArray()
}

export async function colaQuitar(id: number) {
  await offlineDb.pendientes.delete(id)
}

export async function colaLimpiarFallidas() {
  await offlineDb.pendientes.where('intentos').aboveOrEqual(MAX_INTENTOS).delete()
}

export interface ResultadoSync {
  intentados: number
  exitosos: number
  fallidos: number
  errores: { id: number; tabla: string; mensaje: string }[]
}

// Procesa la cola de operaciones pendientes contra Supabase.
// Se debe llamar cuando window.navigator.onLine === true.
// Evita doble ejecucion con el flag `sincronizando`.
let sincronizando = false
export async function colaSync(): Promise<ResultadoSync> {
  const r: ResultadoSync = { intentados: 0, exitosos: 0, fallidos: 0, errores: [] }
  if (sincronizando) return r
  sincronizando = true
  try {
    // Solo los que no agotaron reintentos, orden FIFO (fecha ASC)
    const items = await offlineDb.pendientes
      .where('intentos')
      .below(MAX_INTENTOS)
      .sortBy('fecha')

    for (const op of items) {
      if (op.id === undefined) continue
      r.intentados++
      try {
        let error: any = null
        if (op.operacion === 'insert') {
          const res = await supabase.from(op.tabla).insert(op.payload)
          error = res.error
        } else if (op.operacion === 'update') {
          let q = supabase.from(op.tabla).update(op.payload)
          if (op.filtros) for (const [k, v] of Object.entries(op.filtros)) q = q.eq(k, v as any)
          const res = await q
          error = res.error
        } else if (op.operacion === 'delete') {
          let q = supabase.from(op.tabla).delete()
          if (op.filtros) for (const [k, v] of Object.entries(op.filtros)) q = q.eq(k, v as any)
          const res = await q
          error = res.error
        } else {
          error = new Error(`Operacion desconocida: ${op.operacion}`)
        }

        if (error) {
          r.fallidos++
          r.errores.push({ id: op.id, tabla: op.tabla, mensaje: error.message || String(error) })
          await offlineDb.pendientes.update(op.id, {
            intentos: op.intentos + 1,
            ultimo_error: error.message || String(error),
          })
        } else {
          r.exitosos++
          await offlineDb.pendientes.delete(op.id)
        }
      } catch (e: any) {
        r.fallidos++
        r.errores.push({ id: op.id, tabla: op.tabla, mensaje: e?.message || String(e) })
        await offlineDb.pendientes.update(op.id, {
          intentos: op.intentos + 1,
          ultimo_error: e?.message || String(e),
        })
      }
    }
    return r
  } finally {
    sincronizando = false
  }
}

export function isSincronizando() {
  return sincronizando
}
