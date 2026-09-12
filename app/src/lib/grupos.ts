// Lotes y grupos de cultivo (B1 y B2 de la orden de trabajo).
//
// POR QUE EXISTE
// El grupo experimental vivía en el PREFIJO DEL APODO: las 60 plantas del
// Proyecto la asociación se llamaban `PA-A #1`…`PA-A #45` y `PA-B #1`…`PA-B #15`, y esa
// cadena era lo único que decía que eran dos grupos con sustratos distintos.
// Renombrar una planta borraba el dato.
//
// Y los eventos que no eran de una planta sino de todo el lote no tenían dónde
// ir: quedaron cuatro huérfanos, sin planta, con el nivel escrito en el texto —
// "[Lote] Proyecto Demo - siembra", "[Grupo A] Fase de consolidación…".
// Guardados y en ninguna pantalla.
//
// SON DOS COSAS, NO UNA
//   LOTE  — la corrida: mismo día de germinación, misma genética. Es la unidad
//           que se compara contra otra corrida.
//   GRUPO — la división DENTRO de la corrida: lo que se hace distinto a
//           propósito. Es la unidad del experimento.
//
// La planta apunta al GRUPO y el lote sale del grupo. Un solo camino hasta el
// dato: si la planta guardara también el lote, planta y grupo podrían decir
// lotes distintos y no habría forma de saber cuál manda.

import { supabase } from './supabase'
import type { Evento } from './cultivo'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface LoteCultivo {
  id: string
  nombre: string
  fecha_germinacion: string | null
  genetica_id: string | null
  area_id: string | null
  notas: string | null
  activo: boolean
  creado_en?: string
}

export interface GrupoCultivo {
  id: string
  lote_id: string
  nombre: string
  /** Lo que se hace distinto en este grupo. Vacío si el lote no es un experimento. */
  sustrato: string | null
  maceta: string | null
  /** La hipótesis en una línea: es lo que después explica por qué se comparó. */
  variable: string | null
  notas: string | null
  orden: number
}

/** A qué nivel se registró algo. Un evento cuelga de UNO de los tres. */
export type NivelEvento = 'planta' | 'grupo' | 'lote'

export const NIVEL_LABEL: Record<NivelEvento, string> = {
  planta: 'esta planta',
  grupo: 'todo el grupo',
  lote: 'todo el lote',
}

/** Un evento con el nivel resuelto, para poder dibujarlo distinto. */
export interface EventoConNivel extends Evento {
  grupo_id?: string | null
  lote_id?: string | null
  nivel: NivelEvento
  /** "Grupo A" o "Proyecto la asociación", para el cartelito de la fila. */
  nivelNombre?: string | null
}

export const nivelDe = (e: { planta_id?: string | null; grupo_id?: string | null; lote_id?: string | null }): NivelEvento =>
  e.grupo_id ? 'grupo' : e.lote_id ? 'lote' : 'planta'

// ---------------------------------------------------------------------------

export const gruposService = {
  async getLotes(): Promise<LoteCultivo[]> {
    const { data, error } = await supabase
      .from('cultivo_lotes').select('*').eq('activo', true)
      .order('fecha_germinacion', { ascending: false })
    if (error) throw error
    return (data ?? []) as LoteCultivo[]
  },

  async getGrupos(loteId?: string): Promise<GrupoCultivo[]> {
    let q = supabase.from('cultivo_grupos').select('*')
    if (loteId) q = q.eq('lote_id', loteId)
    const { data, error } = await q.order('orden').order('nombre')
    if (error) throw error
    return (data ?? []) as GrupoCultivo[]
  },

  async crearLote(l: Partial<LoteCultivo>): Promise<LoteCultivo> {
    // `activo` explícito y no al default de la columna: el default lo pone
    // Postgres y el dev local corre en modo demo contra localStorage, donde no
    // hay defaults. Es el gotcha que ya costó caro en `cultivo_areas`.
    const { data, error } = await supabase
      .from('cultivo_lotes').insert({ ...l, activo: l.activo ?? true }).select().single()
    if (error) throw error
    return data as LoteCultivo
  },

  async crearGrupo(g: Partial<GrupoCultivo>): Promise<GrupoCultivo> {
    const { data, error } = await supabase
      .from('cultivo_grupos').insert(g).select().single()
    if (error) throw error
    return data as GrupoCultivo
  },

  async actualizarGrupo(id: string, g: Partial<GrupoCultivo>): Promise<void> {
    const { error } = await supabase.from('cultivo_grupos').update(g).eq('id', id)
    if (error) throw error
  },

  /** Mueve una planta a un grupo (o la saca, con null). */
  async asignarPlanta(plantaId: string, grupoId: string | null): Promise<void> {
    const { error } = await supabase.from('plantas').update({ grupo_id: grupoId }).eq('id', plantaId)
    if (error) throw error
  },

  /**
   * La línea de tiempo COMPLETA de una planta: lo suyo, lo de su grupo y lo de
   * su lote, mezclado por fecha.
   *
   * Sin esto, B2 sería un retroceso: un riego al grupo dejaría de aparecer en la
   * planta que lo recibió. Es lo que hace que registrar una vez no signifique
   * ver menos.
   */
  async timelineDePlanta(plantaId: string, limit = 60): Promise<EventoConNivel[]> {
    const { data: pl } = await supabase
      .from('plantas').select('grupo_id').eq('id', plantaId).maybeSingle()
    const grupoId = (pl as { grupo_id?: string | null } | null)?.grupo_id ?? null

    let loteId: string | null = null
    let nombreGrupo: string | null = null
    let nombreLote: string | null = null
    if (grupoId) {
      const { data: g } = await supabase
        .from('cultivo_grupos').select('nombre,lote_id').eq('id', grupoId).maybeSingle()
      const gg = g as { nombre?: string; lote_id?: string } | null
      nombreGrupo = gg?.nombre ?? null
      loteId = gg?.lote_id ?? null
      if (loteId) {
        const { data: l } = await supabase
          .from('cultivo_lotes').select('nombre').eq('id', loteId).maybeSingle()
        nombreLote = (l as { nombre?: string } | null)?.nombre ?? null
      }
    }

    // Se piden por separado y se mezclan acá. Un `.or()` con tres columnas
    // nullable es fácil de escribir mal y difícil de leer después.
    const consultas = [supabase.from('eventos').select('*').eq('planta_id', plantaId)]
    if (grupoId) consultas.push(supabase.from('eventos').select('*').eq('grupo_id', grupoId))
    if (loteId) consultas.push(supabase.from('eventos').select('*').eq('lote_id', loteId))

    const res = await Promise.all(consultas)
    const filas: EventoConNivel[] = []
    for (const r of res) {
      if (r.error) throw r.error
      for (const e of (r.data ?? []) as EventoConNivel[]) {
        const nivel = nivelDe(e)
        filas.push({
          ...e, nivel,
          nivelNombre: nivel === 'grupo' ? nombreGrupo : nivel === 'lote' ? nombreLote : null,
        })
      }
    }
    filas.sort((a, b) =>
      (b.fecha ?? '').localeCompare(a.fecha ?? '') ||
      (b.creado_en ?? '').localeCompare(a.creado_en ?? ''))
    return filas.slice(0, limit)
  },

  /**
   * Registra un evento para TODO un grupo, en una sola fila.
   *
   * Es el punto de B2: regar las 60 plantas del Proyecto la asociación generaba 60
   * filas de riego y 60 de evento —hay 600 riegos en apenas 10 fechas, y 600 de
   * los 724 eventos son Riego— y corregir ese riego obligaba a corregir 60
   * filas. Así es una, y se corrige una.
   */
  async eventoDeGrupo(grupoId: string, e: { tipo: string; fecha: string; detalle?: string | null }): Promise<void> {
    const { error } = await supabase.from('eventos').insert({
      grupo_id: grupoId, planta_id: null,
      tipo: e.tipo, fecha: e.fecha, detalle: e.detalle ?? null,
    })
    if (error) throw error
  },

  async riegoDeGrupo(grupoId: string, r: {
    fecha: string; volumen_ml?: number | null; ec?: number | null
    ppm?: number | null; ppm_factor?: number; ph?: number | null; notas?: string | null
    /** Escorrentía: lo que SALE. Contra el riego dice si se acumulan sales. */
    escurrido_ml?: number | null; escurrido_ec?: number | null
    escurrido_ph?: number | null; escurrido_ppm?: number | null
  }): Promise<void> {
    const esc = r.escurrido_ml ?? null
    const { error } = await supabase.from('riegos').insert({
      grupo_id: grupoId, planta_id: null,
      fecha: r.fecha, volumen_ml: r.volumen_ml ?? null,
      ec: r.ec ?? null, ppm: r.ppm ?? null, ppm_factor: r.ppm_factor ?? 500,
      ph: r.ph ?? null, notas: r.notas ?? null,
      escurrio: esc != null && esc > 0, escurrido_ml: esc,
      escurrido_ec: r.escurrido_ec ?? null,
      escurrido_ph: r.escurrido_ph ?? null,
      escurrido_ppm: r.escurrido_ppm ?? null,
    })
    if (error) throw error
  },

  /**
   * Cuántas plantas tiene cada grupo. Para el cartel y para el resumen.
   *
   * Se filtra en JS y no con `.not('grupo_id','is',null)`: el shim del modo demo
   * (lib/demo/demoClient.ts) no implementa `.not()`, así que esa consulta
   * explotaba en local y se llevaba puesto el `Promise.all` de la pantalla
   * entera. Contra Supabase real funcionaba, o sea que el bug sólo aparecía
   * corriendo el dev server — el peor lugar para esconderse.
   */
  async conteoPorGrupo(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('plantas').select('grupo_id').eq('activa', true)
    if (error) throw error
    const m: Record<string, number> = {}
    for (const p of (data ?? []) as { grupo_id?: string | null }[]) {
      if (!p.grupo_id) continue
      m[p.grupo_id] = (m[p.grupo_id] ?? 0) + 1
    }
    return m
  },
}
