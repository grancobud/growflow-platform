// ============================================================================
// GrowFlow - capa de datos del cultivo
// Esquema simplificado: geneticas, plantas, eventos, cosechas
// ============================================================================

import { supabase } from './supabase'

export type TipoGenetica = 'Feminizada' | 'Automatica' | 'Regular' | 'Esqueje' | 'Desconocido'
export type FasePlanta =
  | 'Germinacion' | 'Plantula' | 'Vegetativo' | 'Floracion'
  | 'Secado' | 'Curado' | 'Cosechada' | 'Muerta'
export type TipoEvento =
  | 'Riego' | 'Fertilizacion' | 'Poda' | 'Trasplante' | 'CambioFase'
  | 'Entrenamiento' | 'Problema' | 'Foto' | 'Nota'

export const FASES: FasePlanta[] = [
  'Germinacion', 'Plantula', 'Vegetativo', 'Floracion',
  'Secado', 'Curado', 'Cosechada', 'Muerta',
]
/**
 * Fases a partir de las cuales una planta cuenta para la cosecha de ESTE ciclo.
 * Las que están en germinación, plántula o vegetativo son del ciclo siguiente:
 * incluirlas al proyectar el rinde lo infla (a Gastón le pasa con las
 * feminizadas vegetando mientras se cosechan las automáticas).
 */
export const FASES_COSECHABLES = new Set<string>(['Floracion', 'Secado', 'Curado', 'Cosechada'])

// ---------------------------------------------------------------------------
// LA FASE DE UNA AUTOMATICA SE DERIVA DE LA EDAD (31/08/2026)
//
// Una automatica florece por EDAD, no por fotoperiodo: nadie la cambia de luz,
// asi que no hay ningun momento que obligue a marcar el cambio de fase. Y nadie
// va a mover sesenta fichas a mano.
//
// El costo de no derivarla no es cosmetico. El tope de la Res. 1780 se mide
// sobre las plantas EN FLORACION: con las 60 automaticas de la asociación marcadas en
// Vegetativo, el sistema declaraba CERO en floracion —el dia 30 de un ciclo de
// 8 a 10 semanas— y eso es subdeclarar ante un control.
//
// Se DERIVA, no se guarda. Mismo criterio que el VPD de ambiente y la capacidad
// de un area: un derivado guardado se desincroniza del dato que lo origina
// apenas alguien corrige la fecha de germinacion. Lo guardado sigue siendo lo
// que la persona escribio, y se puede ver (`fase_guardada`).
//
// LAS 4 SEMANAS SON UN DEFAULT, NO LA REGLA. Lo fijo Gaston (31/08/2026), que
// es quien cultiva: una automatica hace aproximadamente cuatro semanas de vege y
// ahi empieza a florecer. Pero DEPENDE DE LA GENETICA —un "super auto" puede
// hacer seis semanas o mas— y encima pesan el fenotipo y las condiciones de
// cultivo.
//
// Por eso son dos cosas y no una:
//   - el default, aca abajo, para la variedad de la que no se sabe nada;
//   - la excepcion por variedad, en `geneticas.tiempo_vege_dias`, que ya se
//     carga desde la ficha de genetica y desde la linea de tiempo.
//
// El default no se toca para acomodar una variedad: se le carga el vege a esa
// variedad. Si no, cada ajuste mueve las plantas de todas las demas.
// ---------------------------------------------------------------------------

/**
 * Dias de vegetativo de una automatica cuando la genetica no dice otra cosa.
 * Es tambien el default que ya usaba la linea de tiempo para proyectar.
 */
export const DIA_FLORA_AUTOMATICA = 28

/**
 * Fases anteriores a la floracion: las unicas sobre las que se deriva.
 *
 * Nunca se pisa `Secado`, `Curado`, `Cosechada` ni `Muerta`: esas las marco una
 * persona sobre algo que paso de verdad, y la edad no puede contradecirlas.
 */
const FASES_PREFLORA = new Set<FasePlanta>(['Germinacion', 'Plantula', 'Vegetativo'])

/** Lo minimo que hace falta para decidir la fase. */
export interface DatosDeFase {
  tipo?: TipoGenetica | null
  fase: FasePlanta
  dias_de_vida?: number | null
  /** Vege de la genetica, si lo cargaron. Manda sobre `DIA_FLORA_AUTOMATICA`. */
  tiempo_vege_dias?: number | null
}

/** Desde que dia se cuenta en floracion esta planta, con la excepcion de su variedad. */
export const diaDeFloraDe = (p: DatosDeFase): number =>
  p.tiempo_vege_dias != null && p.tiempo_vege_dias > 0
    ? p.tiempo_vege_dias
    : DIA_FLORA_AUTOMATICA

/**
 * La fase que hay que MOSTRAR y CONTAR, que no siempre es la guardada.
 *
 * Devuelve la guardada tal cual salvo que se trate de una automatica en fase
 * pre-floracion con edad suficiente. Sin `tipo` o sin `dias_de_vida` no deriva:
 * un dato que falta no habilita a inventar el que sigue.
 */
export function faseEfectiva(p: DatosDeFase): FasePlanta {
  if (p.tipo !== 'Automatica') return p.fase
  if (!FASES_PREFLORA.has(p.fase)) return p.fase
  if (p.dias_de_vida == null || p.dias_de_vida < diaDeFloraDe(p)) return p.fase
  return 'Floracion'
}

/** Si lo que se esta mostrando lo dedujo el sistema y no lo escribio nadie. */
export const faseFueDerivada = (p: { fase: FasePlanta; fase_guardada?: FasePlanta | null }): boolean =>
  p.fase_guardada != null && p.fase_guardada !== p.fase

/**
 * Deja una fila de `resumen_plantas` con la fase que hay que mostrar.
 *
 * Va en la capa de datos y no en cada pantalla a proposito: hay una decena de
 * lugares que cuentan `fase === 'Floracion'` —el cupo, el rinde, la cosecha,
 * econometria, el panel— y derivar en algunos dejaria dos pantallas mostrando
 * numeros distintos sobre las mismas plantas.
 */
export function conFaseEfectiva<T extends DatosDeFase>(p: T): T & { fase_guardada?: FasePlanta | null } {
  const efectiva = faseEfectiva(p)
  return efectiva === p.fase ? p : { ...p, fase: efectiva, fase_guardada: p.fase }
}

/**
 * C4: la sub-fase. "Vegetativo temprano" se aplanaba a "Vegetativo".
 *
 * Va como campo aparte y NO como fase nueva: `FASES_COSECHABLES` y media app
 * razonan sobre `fase`, y meter variantes ahi obligaria a revisar cada
 * comparacion. Como sub-fase es un detalle que suma cuando esta y no molesta
 * cuando falta.
 */
export const SUBFASES: Record<string, readonly string[]> = {
  Germinacion: ['Remojo', 'Radicula', 'Cotiledones'],
  Plantula:    ['Primer par', 'Tercer par'],
  Vegetativo:  ['Temprano', 'Pleno', 'Pre-flora'],
  Floracion:   ['Estiramiento', 'Cuaje', 'Engorde', 'Maduracion', 'Lavado'],
  Secado:      ['Colgado', 'Manicurado'],
  Curado:      ['Frascos', 'Estabilizado'],
}

/** Las sub-fases de una fase, o vacio si esa fase no tiene. */
export const subfasesDe = (fase: string | null | undefined): readonly string[] =>
  SUBFASES[fase ?? ''] ?? []

/**
 * Colores por fase. Vivia DUPLICADA en PaginaPanel.tsx y PaginaPlantas.tsx, con
 * las ocho filas escritas dos veces.
 */
export const COLOR_FASE: Record<FasePlanta, { text: string; bg: string; border: string }> = {
  Germinacion: { text: '#d9f99d', bg: 'rgba(163,230,53,0.10)', border: '#404d20' },
  Plantula:    { text: '#d9f99d', bg: 'rgba(163,230,53,0.10)', border: '#404d20' },
  Vegetativo:  { text: '#bef264', bg: 'rgba(163,230,53,0.14)', border: '#404d20' },
  Floracion:   { text: '#c4b5fd', bg: 'rgba(139,92,246,0.12)', border: '#463a66' },
  Secado:      { text: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: '#5a4a20' },
  Curado:      { text: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: '#5a4a20' },
  Cosechada:   { text: '#8f8f9f', bg: 'rgba(180,180,200,0.06)', border: '#2a2a3a' },
  Muerta:      { text: '#ff8a7a', bg: 'rgba(122,40,32,0.15)', border: '#7a2820' },
}

/**
 * SIEMPRE por acá, nunca COLOR_FASE[x] directo.
 *
 * `fase` es una columna de texto de la base y la base se migra por SQL y por la
 * Edge Function `ingesta`, que no pasan por TypeScript. Un valor que el front no
 * conoce devuelve undefined y tumba la pantalla entera al leerle `.text` — paso
 * de verdad el 20/08/2026 con `reprocann_estado = 'Sin registro'`, que dejo la
 * pestana Pacientes caida en produccion. El tipo da una falsa sensacion de
 * exhaustividad sobre datos que vienen de afuera.
 */
export const colorFase = (f: string | null | undefined) =>
  COLOR_FASE[f as FasePlanta] ?? COLOR_FASE.Cosechada

export const TIPOS_EVENTO: TipoEvento[] = [
  'Riego', 'Fertilizacion', 'Poda', 'Trasplante', 'CambioFase',
  'Entrenamiento', 'Problema', 'Foto', 'Nota',
]
export const TIPOS_GENETICA: TipoGenetica[] = [
  'Feminizada', 'Automatica', 'Regular', 'Esqueje', 'Desconocido',
]
export const SUSTRATOS = [
  'Coco 100%',
  'Coco 100% Reutilizado',
  'Coco Mix',
  'Coco Mix Reutilizado',
  'Coco + Sustrato',
  'Coco + Sustrato Reutilizado',
  // C1: los dos del ensayo de la asociación. Faltaban, y por eso el Grupo B quedo con
  // `sustrato` en null: no habia forma de cargarlo sin mentir.
  'Coco + perlita',
  'Organico',
  'Dwc',
] as const

/**
 * C2: las categorias de aplicacion. Vivian DUPLICADAS en PaginaSala.tsx y en
 * PaginaTablas.tsx, con la misma lista escrita dos veces: cambiar una dejaba a
 * las dos pantallas ofreciendo opciones distintas sobre LA MISMA columna.
 *
 * `Inoculante` es nueva: micorrizas y trichodermas caian en "Otro" junto con
 * todo lo demas, y son lo que distingue al Grupo B.
 */
export const CATEGORIAS_APLIC = [
  'Fumigacion', 'Insecticida', 'Fungicida', 'Foliar',
  'Acaricida', 'Bactericida', 'Inoculante', 'Otro',
] as const

export type Genotipo = 'Indica' | 'Sativa' | 'Hibrida' | 'Ruderalis'
export type Altura = 'Baja' | 'Media' | 'Alta'
export type Dificultad = 'Facil' | 'Media' | 'Dificil'
export type Ambiente = 'Indoor' | 'Outdoor' | 'Invernadero' | 'Mixto'

export const GENOTIPOS: Genotipo[] = ['Indica', 'Sativa', 'Hibrida', 'Ruderalis']
export const ALTURAS: Altura[] = ['Baja', 'Media', 'Alta']
export const DIFICULTADES: Dificultad[] = ['Facil', 'Media', 'Dificil']
export const AMBIENTES: Ambiente[] = ['Indoor', 'Outdoor', 'Invernadero', 'Mixto']

export interface Genetica {
  id: string
  nombre: string
  banco: string | null
  tipo: TipoGenetica
  thc_estimado: number | null
  cbd_estimado: number | null
  tiempo_flora_dias: number | null
  notas: string | null
  creado_en: string
  // ficha ampliada (todos opcionales)
  genotipo?: Genotipo | null
  indica_pct?: number | null
  sativa_pct?: number | null
  linaje?: string | null
  tiempo_vege_dias?: number | null
  altura?: Altura | null
  rendimiento_g?: string | null
  /**
   * Ciclo completo desde semilla, como lo publica el banco.
   *
   * TEXTO porque casi siempre es un rango —«8 a 10»— y porque en las
   * automáticas es el dato que reemplaza al tiempo de floración: el banco no
   * publica cuánto dura la flora sola. Cargar ese rango en
   * `tiempo_flora_dias` diría «63 días de flora», que es falso.
   */
  ciclo_semanas?: string | null
  dificultad?: Dificultad | null
  terpenos?: string | null
  efectos?: string | null
  usos_medicinales?: string | null
  ambiente?: Ambiente | null
  resistencia?: string | null
  stretch?: string | null
  foto_url?: string | null
  color?: string | null
  inicio_flora?: string | null   // fecha de paso a 12/12 del cultivo actual (para estimar cosecha de fem)
}

export interface Planta {
  id: string
  codigo: string | null
  genetica_id: string | null
  madre_id: string | null
  paciente_id: string | null
  apodo: string | null
  fecha_germinacion: string | null
  fecha_cosecha: string | null
  fecha_envasado: string | null
  fase: FasePlanta
  sustrato: string | null
  maceta: string | null
  ubicacion: string | null
  activa: boolean
  /** C4: detalle dentro de la fase. Opcional; ver SUBFASES. */
  subfase?: string | null
  notas: string | null
  creado_en: string
  actualizado_en: string
  geneticas?: Pick<Genetica, 'nombre' | 'banco' | 'tipo'> | null
}

// Genera un codigo de trazabilidad unico y legible para una planta.
// Formato: <ABBR>-<5 base36>, ej "GG-7F3A9". ABBR sale del nombre de la genetica.
export function generarCodigoPlanta(nombreGenetica?: string | null): string {
  const abbr = (nombreGenetica ?? '')
    .normalize('NFD').replace(/[^a-zA-Z]/g, '')
    .slice(0, 3).toUpperCase() || 'GF'
  let sufijo = ''
  for (let i = 0; i < 5; i++) sufijo += '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 34)]
  return `${abbr}-${sufijo}`
}

export interface Evento {
  id: string
  /** Null cuando el evento es de un grupo o de un lote entero (ver lib/grupos.ts). */
  planta_id: string | null
  /** Exactamente uno de planta_id / grupo_id / lote_id viene cargado. */
  grupo_id?: string | null
  lote_id?: string | null
  tipo: TipoEvento
  fecha: string
  detalle: string | null
  foto_url: string | null
  mensaje_original: string | null
  creado_en: string
}

export interface ResumenPlanta {
  id: string
  codigo: string | null
  nombre: string
  genetica: string | null
  banco: string | null
  tipo: TipoGenetica | null
  /** Vege de la genetica. Lo expone la vista para poder derivar la fase. */
  tiempo_vege_dias?: number | null
  /** La fase que hay que mostrar y contar. Ojo: puede venir DERIVADA, ver `faseEfectiva`. */
  fase: FasePlanta
  /**
   * Lo que dice la ficha, cuando difiere de `fase`. Null si nadie derivo nada.
   * Es lo que va en un editor: un `select` que muestra la derivada rebota al
   * valor viejo apenas se guarda, y parece que el cambio no funciono.
   */
  fase_guardada?: FasePlanta | null
  fecha_germinacion: string | null
  dias_de_vida: number | null
  sustrato: string | null
  maceta: string | null
  ubicacion: string | null
  activa: boolean
  paciente_id: string | null
  paciente_nombre: string | null
  ultimo_riego: string | null
  total_eventos: number
}

// Item unificado de la linea de tiempo (historia clinica) de una planta.
/**
 * Una aplicación como la devuelve la base, con lo mínimo que la línea de tiempo
 * necesita. Se escribe la forma UNA vez en vez de castear a `any` en cada uso:
 * si mañana la consulta deja de traer `dosis`, el compilador lo dice acá.
 */
interface FilaAplicacion {
  id: string
  fecha: string
  categoria?: string | null
  producto?: string | null
  dosis?: string | null
  notas?: string | null
}

/** Saca las aplicaciones de la respuesta, que puede venir vacía o con error. */
const aplicacionesDeLaPlanta = (r: { data?: unknown } | null): FilaAplicacion[] =>
  ((r?.data ?? []) as FilaAplicacion[])

/**
 * Una cosecha con la genetica de su planta, como la trae el join. Se escribe la
 * forma una vez: si la consulta deja de traer el anidado, lo dice el compilador
 * y no un «Sin genetica» en toda la tabla.
 */
interface FilaEstadistica {
  peso_seco_g?: number | null
  peso_humedo_g?: number | null
  valoracion?: number | null
  plantas?: { geneticas?: { nombre?: string | null } | null } | null
}

export interface ItemHistoria {
  id: string
  tipo: string
  fecha: string
  detalle: string | null
  foto_url: string | null
  esCosecha?: boolean
}

export interface Cosecha {
  id: string
  planta_id: string | null
  fecha: string
  peso_humedo_g: number | null
  peso_seco_g: number | null
  notas_curado: string | null
  notas_sabor: string | null
  valoracion: number | null
  creado_en: string
}

function lanzar(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export const cultivoService = {
  // --- geneticas ---
  async getGeneticas(): Promise<Genetica[]> {
    const { data, error } = await supabase.from('geneticas').select('*').order('nombre')
    lanzar(error)
    return (data ?? []) as Genetica[]
  },

  async getGenetica(id: string): Promise<Genetica> {
    const { data, error } = await supabase.from('geneticas').select('*').eq('id', id).single()
    lanzar(error)
    return data as Genetica
  },

  async crearGenetica(g: Partial<Genetica> & { nombre: string }): Promise<Genetica> {
    const { data, error } = await supabase.from('geneticas').insert(g).select().single()
    lanzar(error)
    return data as Genetica
  },

  async actualizarGenetica(id: string, g: Partial<Genetica>): Promise<void> {
    const { error } = await supabase.from('geneticas').update(g).eq('id', id)
    lanzar(error)
  },

  async subirFotoGenetica(file: File): Promise<string> {
    return this.subirFoto(file)
  },

  /**
   * Saca el archivo del bucket.
   *
   * Se llama al quitar una foto. Si falla NO se propaga: lo que importa es que
   * la ficha deje de apuntarla; un archivo que quedó dando vueltas es basura,
   * no un error que valga la pena mostrarle a nadie. Se avisa por consola para
   * que quede rastro.
   */
  async borrarFoto(nombre: string): Promise<void> {
    const { error } = await supabase.storage.from('fotos').remove([nombre])
    if (error) console.warn('No se pudo borrar la foto del storage:', error.message)
  },

  // --- plantas ---
  async getResumenPlantas(soloActivas = true): Promise<ResumenPlanta[]> {
    let q = supabase.from('resumen_plantas').select('*')
    if (soloActivas) q = q.eq('activa', true)
    const { data, error } = await q
    lanzar(error)
    // Orden natural: #2 antes que #10 (el order de SQL es alfabetico puro)
    return ((data ?? []) as ResumenPlanta[]).map(conFaseEfectiva).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
  },

  async getPlanta(id: string): Promise<Planta> {
    const { data, error } = await supabase
      .from('plantas')
      .select('*, geneticas:genetica_id (nombre, banco, tipo)')
      .eq('id', id)
      .single()
    lanzar(error)
    return data as Planta
  },

  async crearPlanta(p: Partial<Planta>): Promise<Planta> {
    const conCodigo = p.codigo ? p : { ...p, codigo: generarCodigoPlanta(null) }
    const { data, error } = await supabase.from('plantas').insert(conCodigo).select().single()
    lanzar(error)
    return data as Planta
  },

  async getPlantaPorCodigo(codigo: string): Promise<Planta | null> {
    const { data, error } = await supabase
      .from('plantas')
      .select('*, geneticas:genetica_id (nombre, banco, tipo)')
      .eq('codigo', codigo)
      .maybeSingle()
    lanzar(error)
    return (data as Planta) ?? null
  },

  async getPlantasDePaciente(pacienteId: string): Promise<ResumenPlanta[]> {
    const { data, error } = await supabase.from('resumen_plantas').select('*').eq('paciente_id', pacienteId)
    lanzar(error)
    return ((data ?? []) as ResumenPlanta[]).map(conFaseEfectiva).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
  },

  // Linea de tiempo unificada: eventos + aplicaciones + cosechas (mas reciente primero).
  async getLineaTiempo(plantaId: string): Promise<ItemHistoria[]> {
    const [evs, cosechas, aplic] = await Promise.all([
      this.getEventos(plantaId, 300),
      this.getCosechas(),
      supabase.from('aplicaciones').select('id,fecha,categoria,producto,dosis,notas').eq('planta_id', plantaId),
    ])
    const cos = (cosechas as Cosecha[]).filter(c => c.planta_id === plantaId)
    const lista: ItemHistoria[] = [
      ...evs.map(e => ({ id: e.id, tipo: e.tipo, fecha: e.fecha, detalle: e.detalle, foto_url: e.foto_url })),
      ...(aplicacionesDeLaPlanta(aplic).map(a => ({
        id: a.id, tipo: 'Aplicacion', fecha: a.fecha, foto_url: null,
        detalle: [a.categoria, a.producto, a.dosis, a.notas].filter(Boolean).join(' · '),
      }))),
      ...cos.map(c => ({
        id: c.id, tipo: 'Cosecha', fecha: c.fecha, esCosecha: true, foto_url: null,
        detalle: [c.peso_seco_g ? `${c.peso_seco_g}g secos` : null, c.peso_humedo_g ? `${c.peso_humedo_g}g húmedos` : null,
          c.valoracion ? `★ ${c.valoracion}/10` : null, c.notas_sabor, c.notas_curado].filter(Boolean).join(' · ') || 'Cosecha',
      })),
    ]
    lista.sort((a, b) => b.fecha.localeCompare(a.fecha))
    return lista
  },

  async actualizarPlanta(id: string, p: Partial<Planta>): Promise<void> {
    const { error } = await supabase.from('plantas').update(p).eq('id', id)
    lanzar(error)
  },

  // --- eventos ---
  async getEventos(plantaId?: string, limit = 50): Promise<Evento[]> {
    let q = supabase.from('eventos').select('*')
    if (plantaId) q = q.eq('planta_id', plantaId)
    const { data, error } = await q.order('fecha', { ascending: false }).order('creado_en', { ascending: false }).limit(limit)
    lanzar(error)
    return (data ?? []) as Evento[]
  },

  async crearEvento(e: Partial<Evento>): Promise<Evento> {
    const { data, error } = await supabase.from('eventos').insert(e).select().single()
    lanzar(error)
    return data as Evento
  },

  async eliminarPlanta(id: string): Promise<void> {
    // Los eventos asociados caen en cascada (FK on delete cascade)
    const { error } = await supabase.from('plantas').delete().eq('id', id)
    lanzar(error)
  },

  async eliminarEvento(id: string): Promise<void> {
    const { error } = await supabase.from('eventos').delete().eq('id', id)
    lanzar(error)
  },

  /**
   * Corregir un evento ya cargado. Antes solo se podia borrar y volver a
   * cargarlo, o editarlo desde Tablas: para arreglar una fecha mal tipeada eso
   * es mucho trabajo, y lo que termina pasando es que el dato queda mal.
   */
  async actualizarEvento(id: string, e: Partial<Evento>): Promise<void> {
    const { error } = await supabase.from('eventos').update(e).eq('id', id)
    lanzar(error)
  },

  async eliminarGenetica(id: string): Promise<void> {
    // Las plantas que la usaban quedan con genetica null (FK on delete set null)
    const { error } = await supabase.from('geneticas').delete().eq('id', id)
    lanzar(error)
  },

  // --- cosechas ---
  async getCosechas(): Promise<Cosecha[]> {
    const { data, error } = await supabase.from('cosechas').select('*').order('fecha', { ascending: false })
    lanzar(error)
    return (data ?? []) as Cosecha[]
  },

  async crearCosecha(c: Partial<Cosecha>): Promise<Cosecha> {
    const { data, error } = await supabase.from('cosechas').insert(c).select().single()
    lanzar(error)
    return data as Cosecha
  },

  /**
   * Saca plantas de la Sala de Riego y libera sus lugares.
   * Al registrar una cosecha, el trigger de la DB ya cierra la planta de esa
   * cosecha; esto es para las demás plantas de una cosecha por variedad, que
   * comparten un único registro.
   */
  async cerrarPlantas(ids: string[]): Promise<void> {
    if (!ids.length) return
    const { error } = await supabase.from('plantas')
      .update({ activa: false, slot: null, fase: 'Cosechada' })
      .in('id', ids)
    lanzar(error)
  },

  async actualizarCosecha(id: string, c: Partial<Cosecha>): Promise<void> {
    const { error } = await supabase.from('cosechas').update(c).eq('id', id)
    lanzar(error)
  },

  async eliminarCosecha(id: string): Promise<void> {
    const { error } = await supabase.from('cosechas').delete().eq('id', id)
    lanzar(error)
  },

  // --- fotos ---
  // Devuelve el PATH dentro del bucket, no una URL publica: el bucket `fotos`
  // es privado y las fotos se muestran con <FotoPrivada>, que pide una URL
  // firmada. Guardar la URL publica dejaria la foto accesible sin login.
  async subirFoto(file: File): Promise<string> {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(nombre, file, {
      cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg',
    })
    if (error) throw new Error(error.message)
    return nombre
  },

  // --- estadisticas ---
  async getEstadisticasCosecha(): Promise<EstadisticaGenetica[]> {
    const { data, error } = await supabase
      .from('cosechas')
      .select('peso_seco_g, peso_humedo_g, valoracion, plantas:planta_id (genetica_id, geneticas:genetica_id (nombre))')
    lanzar(error)
    const acc: Record<string, EstadisticaGenetica> = {}
    for (const c of (data ?? []) as FilaEstadistica[]) {
      const nombre = c.plantas?.geneticas?.nombre ?? 'Sin genética'
      const e = acc[nombre] ?? (acc[nombre] = { genetica: nombre, cosechas: 0, peso_seco_g: 0, peso_humedo_g: 0, valoraciones: [] })
      e.cosechas++
      e.peso_seco_g += c.peso_seco_g ?? 0
      e.peso_humedo_g += c.peso_humedo_g ?? 0
      if (c.valoracion != null) e.valoraciones.push(c.valoracion)
    }
    return Object.values(acc).sort((a, b) => b.peso_seco_g - a.peso_seco_g)
  },
}

export interface EstadisticaGenetica {
  genetica: string
  cosechas: number
  peso_seco_g: number
  peso_humedo_g: number
  valoraciones: number[]
}
