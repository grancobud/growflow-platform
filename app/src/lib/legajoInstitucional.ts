// EL LEGAJO INSTITUCIONAL: los papeles que constituyen a la entidad.
//
// Estatuto, acta constitutiva, reglamento, matrícula, poderes. Nació el
// 03/09/2026 porque no había dónde ponerlos: `ong_documentos` sólo acepta
// `'emitido'` o `'gasto'` por CHECK en la base, y el estatuto no es ninguno de
// los dos —no lo emite la asociación a nombre de alguien, y no respalda que
// salió plata—. La base lo rechazaba.
//
// ⚠️ NO CONFUNDIR CON `lib/documentosInstitucionales.ts`, que es su vecino y
// hace lo contrario: ese GENERA texto (designaciones, comodatos, informe de
// genéticas) para que la app emita el documento. Este ARCHIVA el papel que ya
// existe y llega en PDF. El motivo de que sean dos módulos es que uno no
// guarda nada y el otro no redacta nada.
//
// El motivo de que sea una tabla aparte y no un tercer `tipo` en
// `ong_documentos` está en la migración
// `20260903120000_documentos_institucionales.sql`. Resumido: la vista
// `v_saldo_ordenes` agrupa cualquier `ong_documentos` con `numero` y `monto`
// como una orden de servicio con saldo, así que una matrícula cargada como
// «Nº 1234» aparecería en el saldo de proveedores.

import { supabase } from './supabase'

/** Los papeles que existen. Cerrado igual que el CHECK de la base. */
export const TIPOS_LEGAJO = [
  'Estatuto', 'Acta constitutiva', 'Reglamento interno',
  'Matrícula / Resolución', 'Poder / Autorización',
  'Reforma de estatuto', 'Otro',
] as const

export type TipoLegajo = typeof TIPOS_LEGAJO[number]

export interface PapelInstitucional {
  id: string
  tipo: TipoLegajo
  titulo: string
  numero: string | null
  fecha: string | null
  /**
   * ⚠️ NO ES `activo`.
   *
   * Un estatuto deja de estar vigente cuando se lo REFORMA, no cuando la
   * entidad para de operar. La distinción la trajo Gastón textual: «descargué
   * el de la coop, aunque no esté operativa el estatuto está vigente».
   */
  vigente: boolean
  /** Vacío se lee como «la entidad de esta instalación». */
  persona_juridica: string | null
  archivo_path: string | null
  archivo_nombre: string | null
  notas: string | null
  creado_en: string
}

export type PapelNuevo =
  Partial<Omit<PapelInstitucional, 'id' | 'creado_en'>> & { tipo: TipoLegajo }

/** Bajo qué prefijo del bucket `documentos` viven estos archivos. */
export const PREFIJO_LEGAJO = 'institucional'

/**
 * El papel vigente de un tipo.
 *
 * Puede haber varios cargados —el original y sus reformas— y lo que se quiere
 * mostrar arriba es el que rige hoy. Entre dos vigentes gana el más nuevo por
 * fecha; sin fecha cargada pierde, porque un papel sin fecha no puede
 * demostrar que reemplazó a otro.
 */
export function vigenteDe(
  docs: PapelInstitucional[], tipo: TipoLegajo,
): PapelInstitucional | null {
  const c = docs.filter(d => d.tipo === tipo && d.vigente)
  if (c.length === 0) return null
  return c.slice().sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))[0]
}

/**
 * Qué le falta al legajo.
 *
 * Sólo el estatuto y el acta constitutiva: son los dos que ninguna entidad
 * puede no tener. El reglamento y los poderes son opcionales de verdad, y
 * marcarlos en rojo entrena a ignorar el rojo — la misma razón por la que el
 * arqueo tolera un gramo.
 */
export const OBLIGATORIOS: TipoLegajo[] = ['Estatuto', 'Acta constitutiva']

export function faltantes(docs: PapelInstitucional[]): TipoLegajo[] {
  return OBLIGATORIOS.filter(t => vigenteDe(docs, t) == null)
}

/**
 * Un papel sin archivo es una anotación, no un respaldo.
 *
 * Se cuenta aparte de los faltantes: la ficha existe, así que decir «falta el
 * estatuto» sería mentira; lo que falta es el PDF.
 */
export function sinArchivo(docs: PapelInstitucional[]): PapelInstitucional[] {
  return docs.filter(d => !d.archivo_path)
}

export const legajoService = {
  async listar(): Promise<PapelInstitucional[]> {
    const { data, error } = await supabase
      .from('ong_documentos_institucionales')
      .select('*')
      .order('fecha', { ascending: false, nullsFirst: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as PapelInstitucional[]
  },

  /**
   * ⚠️ `vigente` VA EXPLÍCITO, no se deja al default de la columna.
   *
   * El default lo pone Postgres y el modo demo corre contra `localStorage`: en
   * demo la fila se guardaría sin `vigente`, `vigenteDe` la descartaría por
   * falsy, y quedaría un alta con toast de éxito y una pantalla que dice que
   * no hay estatuto. Es el pozo que ya dejaron el `activa` de las áreas y el
   * `activo` del plan de cultivo.
   */
  async guardar(d: PapelNuevo & { id?: string }): Promise<void> {
    const { id, ...resto } = d
    const { data: u } = await supabase.auth.getUser()
    const campos = { vigente: true, ...resto, user_id: u?.user?.id ?? null }
    const { error } = id
      ? await supabase.from('ong_documentos_institucionales').update(campos).eq('id', id)
      : await supabase.from('ong_documentos_institucionales').insert(campos)
    if (error) throw new Error(error.message)
  },

  async borrar(d: PapelInstitucional): Promise<void> {
    // El archivo se va con la ficha: si no, queda basura en el bucket que
    // nadie puede ver ni borrar desde la app. Mismo criterio que
    // `ongService.borrarDocumento`.
    if (d.archivo_path) {
      const { error } = await supabase.storage.from('documentos').remove([d.archivo_path])
      if (error && !/not found/i.test(error.message)) throw new Error(error.message)
    }
    const { error } = await supabase
      .from('ong_documentos_institucionales').delete().eq('id', d.id)
    if (error) throw new Error(error.message)
  },

  /** Sube al bucket privado bajo `institucional/` y devuelve el path. */
  async subirArchivo(file: File): Promise<{ path: string; nombre: string }> {
    const limpio = file.name.replace(/[^\w.-]+/g, '_')
    const path = `${PREFIJO_LEGAJO}/${Date.now()}_${limpio}`
    const { error } = await supabase.storage.from('documentos').upload(path, file, {
      contentType: file.type || 'application/octet-stream', upsert: false,
    })
    if (error) throw new Error(error.message)
    return { path, nombre: file.name }
  },
}
