// Ambiente por carga manual: el calculo y los datos, sin nada de UI.
//
// Esta instalacion no tiene sensores conectados. Las lecturas las toma una
// persona con el termohigrometro, dos veces por dia, y de ahi sale todo lo
// demas. Por eso el modulo se ocupa de tres cosas y nada mas: leer y escribir
// lecturas, derivar el VPD, y resumir una serie en algo que se pueda leer.
//
// El VPD NO se guarda en la base: se calcula cada vez a partir de temp y
// humedad. Guardar un derivado es garantizar que un dia alguien corrija la
// temperatura y el VPD quede contando otra historia.
//
// Todo lo que no se puede calcular devuelve null y NO cero. Un promedio de 0 °C
// se leeria como "hizo mucho frio" en vez de "todavia no cargaste nada".

import { supabase } from './supabase'
import { colaPush } from './offlineDb'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Etapa = 'vegetativo' | 'floracion'

export const ETAPA_LABEL: Record<Etapa, string> = {
  vegetativo: 'Vegetativo',
  floracion: 'Floración',
}

export interface Sala {
  id: string
  nombre: string
  etapa: Etapa
  activa: boolean
  orden: number
  /**
   * Limites propios de la sala. Null = usa el de la etapa. Se guardan sueltos y
   * no como un objeto para poder afinar un solo limite sin tener que redefinir
   * los seis: el target de la asociación es 24-26 C, y con el rango de etapa (22-28)
   * el semaforo daba verde a 27.
   */
  temp_min?: number | null
  temp_max?: number | null
  hum_min?: number | null
  hum_max?: number | null
  vpd_min?: number | null
  vpd_max?: number | null
}

export interface Lectura {
  id: string
  sala_id: string
  medido_en: string
  temp_c: number
  humedad_pct: number
  nota: string | null
}

// ---------------------------------------------------------------------------
// VPD
//
// VPD del aire = SVP(temp) · (1 − HR/100), con SVP por Tetens. Es la misma
// formula que usa la pantalla de sensores en vivo de la instalacion de origen:
// si las dos difirieran, el mismo cultivo daria numeros distintos segun quien
// lo mire.
// ---------------------------------------------------------------------------

/** Presion de vapor de saturacion en kPa. */
export const svp = (tC: number) => 0.6108 * Math.exp((17.27 * tC) / (tC + 237.3))

/** VPD del aire en kPa, redondeado a dos decimales. */
export const vpd = (tC: number, hr: number) => +(svp(tC) * (1 - hr / 100)).toFixed(2)

// Rangos por etapa. El de VPD sale de la bibliografia de cultivo indoor
// (vege 0.8–1.2, flora 1.2–1.6 kPa); temp y humedad acompanian.
export interface Rango { min: number; max: number }
export interface Rangos { temp: Rango; humedad: Rango; vpd: Rango }

export const RANGOS: Record<Etapa, Rangos> = {
  vegetativo: {
    temp: { min: 22, max: 28 },
    humedad: { min: 55, max: 70 },
    vpd: { min: 0.8, max: 1.2 },
  },
  floracion: {
    temp: { min: 20, max: 26 },
    humedad: { min: 40, max: 55 },
    vpd: { min: 1.2, max: 1.6 },
  },
}

/**
 * El rango efectivo de una sala: lo suyo si lo cargo, el de la etapa si no.
 * Se resuelve limite por limite —no rango por rango— para que cargar solo el
 * maximo de temperatura no arrastre un minimo inventado.
 */
export function rangosDeSala(sala: Pick<Sala,
  'etapa' | 'temp_min' | 'temp_max' | 'hum_min' | 'hum_max' | 'vpd_min' | 'vpd_max'
> | null | undefined): Rangos {
  const base = RANGOS[sala?.etapa ?? 'vegetativo']
  if (!sala) return base
  const n = (v: number | null | undefined, def: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : def
  return {
    temp:    { min: n(sala.temp_min, base.temp.min),    max: n(sala.temp_max, base.temp.max) },
    humedad: { min: n(sala.hum_min,  base.humedad.min), max: n(sala.hum_max,  base.humedad.max) },
    vpd:     { min: n(sala.vpd_min,  base.vpd.min),     max: n(sala.vpd_max,  base.vpd.max) },
  }
}

/** Si la sala tiene al menos un limite propio. Lo usa la pantalla para avisar. */
export const tieneRangoPropio = (s: Sala) =>
  [s.temp_min, s.temp_max, s.hum_min, s.hum_max, s.vpd_min, s.vpd_max]
    .some(v => typeof v === 'number' && Number.isFinite(v))

export type Estado = 'bajo' | 'ok' | 'alto'

export function estadoDe(valor: number, r: Rango): Estado {
  if (valor < r.min) return 'bajo'
  if (valor > r.max) return 'alto'
  return 'ok'
}

// ---------------------------------------------------------------------------
// Turno
//
// Se DERIVA de la hora en vez de pedirlo como campo: es un dato que el sistema
// ya tiene, y cada campo que no se pide es un campo que no se completa mal.
// El corte a las 14 h parte el dia en la lectura de la manana y la de la tarde.
// ---------------------------------------------------------------------------

export type Turno = 'manana' | 'tarde'

export const turnoDe = (iso: string): Turno =>
  new Date(iso).getHours() < 14 ? 'manana' : 'tarde'

export const TURNO_LABEL: Record<Turno, string> = {
  manana: 'mañana',
  tarde: 'tarde',
}

// ---------------------------------------------------------------------------
// Validacion de carga
//
// Guardas de tipeo, no de clima. La base ya rechaza lo imposible, pero un error
// que llega a la base y vuelve como excepcion de Postgres no le dice nada a
// quien esta cargando con una mano y sosteniendo el termohigrometro con la otra.
// ---------------------------------------------------------------------------

export interface Limite { min: number; max: number; label: string }

export const LIMITES: Record<'temp' | 'humedad', Limite> = {
  temp: { min: -10, max: 60, label: 'La temperatura' },
  humedad: { min: 0, max: 100, label: 'La humedad' },
}

/** Devuelve el motivo del rechazo, o null si el valor sirve. */
export function validar(campo: 'temp' | 'humedad', valor: number | null): string | null {
  const l = LIMITES[campo]
  if (valor === null || Number.isNaN(valor)) return `${l.label} es obligatoria.`
  if (valor < l.min || valor > l.max) {
    return `${l.label} tiene que estar entre ${l.min} y ${l.max}. ¿Se coló un dígito?`
  }
  return null
}

// ---------------------------------------------------------------------------
// Resumen de una serie
// ---------------------------------------------------------------------------

export interface Extremo { valor: number; cuando: string }

export interface ResumenMetrica {
  promedio: number | null
  maximo: Extremo | null
  minimo: Extremo | null
  /** Cuantas lecturas cayeron fuera del rango de la etapa. */
  fuera: number
}

export interface Resumen {
  lecturas: number
  temp: ResumenMetrica
  humedad: ResumenMetrica
  vpd: ResumenMetrica
  /** Diferencia promedio entre la lectura de la tarde y la de la manana. */
  amplitudTemp: number | null
  ultima: Lectura | null
}

const vacia = (): ResumenMetrica => ({ promedio: null, maximo: null, minimo: null, fuera: 0 })

function resumirMetrica(
  puntos: { v: number; cuando: string }[], rango: Rango,
): ResumenMetrica {
  if (puntos.length === 0) return vacia()
  let max = puntos[0], min = puntos[0], suma = 0, fuera = 0
  for (const p of puntos) {
    suma += p.v
    if (p.v > max.v) max = p
    if (p.v < min.v) min = p
    if (estadoDe(p.v, rango) !== 'ok') fuera++
  }
  return {
    promedio: +(suma / puntos.length).toFixed(1),
    maximo: { valor: max.v, cuando: max.cuando },
    minimo: { valor: min.v, cuando: min.cuando },
    fuera,
  }
}

export function resumir(lecturas: Lectura[], rangos: Rangos): Resumen {
  const r = rangos
  if (lecturas.length === 0) {
    return {
      lecturas: 0, temp: vacia(), humedad: vacia(), vpd: vacia(),
      amplitudTemp: null, ultima: null,
    }
  }
  const ordenadas = [...lecturas].sort((a, b) => a.medido_en.localeCompare(b.medido_en))
  const pt = (f: (l: Lectura) => number) =>
    ordenadas.map(l => ({ v: f(l), cuando: l.medido_en }))

  // Amplitud dia/noche: cuanto sube de la manana a la tarde. Es lo que muestra
  // si el equipo da abasto, y se pierde entero si se mira solo el promedio.
  const mananas = ordenadas.filter(l => turnoDe(l.medido_en) === 'manana')
  const tardes = ordenadas.filter(l => turnoDe(l.medido_en) === 'tarde')
  const prom = (ls: Lectura[]) => ls.reduce((s, l) => s + Number(l.temp_c), 0) / ls.length
  const amplitudTemp = mananas.length && tardes.length
    ? +(prom(tardes) - prom(mananas)).toFixed(1)
    : null

  return {
    lecturas: ordenadas.length,
    temp: resumirMetrica(pt(l => Number(l.temp_c)), r.temp),
    humedad: resumirMetrica(pt(l => Number(l.humedad_pct)), r.humedad),
    vpd: resumirMetrica(pt(l => vpd(Number(l.temp_c), Number(l.humedad_pct))), r.vpd),
    amplitudTemp,
    ultima: ordenadas[ordenadas.length - 1],
  }
}

// ---------------------------------------------------------------------------
// Lectura en castellano
//
// Los graficos muestran QUE paso; esto dice QUE SIGNIFICA. Es la diferencia
// entre una pantalla que se mira y una que se entiende: sin esto, quien carga
// los datos ve lineas lindas y no sabe si tiene que hacer algo.
// ---------------------------------------------------------------------------

export interface Hallazgo {
  nivel: 'ok' | 'alerta'
  texto: string
}

export function interpretar(lecturas: Lectura[], rangos: Rangos, dias: number): Hallazgo[] {
  const res = resumir(lecturas, rangos)
  if (res.lecturas === 0) return []

  const out: Hallazgo[] = []
  const r = rangos
  const periodo = `En ${dias} día${dias === 1 ? '' : 's'}`

  // De cada metrica interesa lo mismo: cuantas veces se fue de rango y hacia
  // donde. Decir "3 veces alta" es accionable; "promedio 71 %" no tanto.
  //
  // `nombre` va al empezar la oracion y `enMedio` en el medio: bajar el primero
  // a minusculas con toLowerCase() convertia "El VPD" en "el vpd", que se lee
  // como un error de tipeo en vez de una sigla.
  const linea = (
    nombre: string, enMedio: string, valorDe: (l: Lectura) => number,
    m: ResumenMetrica, rango: Rango, unidad: string,
  ) => {
    if (m.fuera === 0) {
      out.push({ nivel: 'ok', texto: `${nombre} se mantuvo en rango las ${res.lecturas} lecturas.` })
      return
    }
    const altas = lecturas.filter(l => valorDe(l) > rango.max)
    const haciaArriba = altas.length >= m.fuera - altas.length
    const turnos = new Set(altas.map(l => turnoDe(l.medido_en)))
    const cuando = altas.length > 0 && turnos.size === 1
      ? `, siempre de ${TURNO_LABEL[[...turnos][0]]}`
      : ''
    out.push({
      nivel: 'alerta',
      texto: `${periodo}, ${enMedio} quedó fuera de rango ${m.fuera} ` +
        `${m.fuera === 1 ? 'vez' : 'veces'} (sobre todo ${haciaArriba ? 'por encima' : 'por debajo'} ` +
        `de ${haciaArriba ? rango.max : rango.min}${unidad})${cuando}.`,
    })
  }

  const temp = (l: Lectura) => Number(l.temp_c)
  const hum = (l: Lectura) => Number(l.humedad_pct)
  const v = (l: Lectura) => vpd(Number(l.temp_c), Number(l.humedad_pct))

  linea('La temperatura', 'la temperatura', temp, res.temp, r.temp, ' °C')
  linea('La humedad', 'la humedad', hum, res.humedad, r.humedad, ' %')
  linea('El VPD', 'el VPD', v, res.vpd, r.vpd, ' kPa')

  if (res.amplitudTemp != null && res.amplitudTemp >= 6) {
    out.push({
      nivel: 'alerta',
      texto: `Entre la mañana y la tarde la temperatura sube ${res.amplitudTemp} °C en promedio. ` +
        `Un salto así suele querer decir que el equipo de frío no llega en las horas de más luz.`,
    })
  }

  return out
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

export const ambienteService = {
  async getSalas(): Promise<Sala[]> {
    const { data, error } = await supabase
      .from('ambiente_salas').select('*').order('orden').order('nombre')
    if (error) throw error
    return (data ?? []) as Sala[]
  },

  async crearSala(s: { nombre: string; etapa: Etapa; orden?: number }): Promise<Sala> {
    // `activa` va explicito y no se deja al default de la columna: el default lo
    // pone Postgres y el dev local corre en modo demo contra localStorage, donde
    // no hay defaults. Sin esto la sala se guarda, la pantalla la filtra por
    // `activa` y no aparece nunca — alta con toast de exito y nada en pantalla.
    // Es el mismo gotcha que ya costo caro en `cultivo_areas`.
    const { data, error } = await supabase
      .from('ambiente_salas').insert({ ...s, activa: true }).select().single()
    if (error) throw error
    return data as Sala
  },

  async actualizarSala(id: string, s: Partial<Sala>): Promise<void> {
    const { error } = await supabase.from('ambiente_salas').update(s).eq('id', id)
    if (error) throw error
  },

  async eliminarSala(id: string): Promise<void> {
    const { error } = await supabase.from('ambiente_salas').delete().eq('id', id)
    if (error) throw error
  },

  /** Lecturas de una sala desde hace `dias`. `dias = 0` trae todo. */
  async getLecturas(salaId: string, dias: number): Promise<Lectura[]> {
    let q = supabase.from('ambiente_lecturas').select('*').eq('sala_id', salaId)
    if (dias > 0) {
      const desde = new Date()
      desde.setDate(desde.getDate() - dias)
      q = q.gte('medido_en', desde.toISOString())
    }
    const { data, error } = await q.order('medido_en', { ascending: true })
    if (error) throw error
    return (data ?? []) as Lectura[]
  },

  /**
   * Guarda una lectura. Si no hay senal la deja en la cola offline en vez de
   * perderla: esto se carga adentro de una sala de cultivo, que es justo donde
   * el wifi no llega. La cola la sincroniza sola al volver la conexion.
   *
   * Devuelve true si entro directo, false si quedo encolada.
   */
  async guardarLectura(l: {
    sala_id: string; medido_en: string; temp_c: number
    humedad_pct: number; nota: string | null
  }): Promise<boolean> {
    if (!navigator.onLine) {
      await colaPush({ tabla: 'ambiente_lecturas', operacion: 'insert', payload: l })
      return false
    }
    const { error } = await supabase.from('ambiente_lecturas').insert(l)
    if (error) {
      // Un fallo de red con el navegador creyendose online termina igual en la
      // cola: el dato se tomo, perderlo por un corte no es una opcion.
      await colaPush({ tabla: 'ambiente_lecturas', operacion: 'insert', payload: l })
      return false
    }
    return true
  },

  /** Corregir una lectura ya cargada, sin tener que borrarla y rehacerla. */
  async actualizarLectura(id: string, l: Partial<Lectura>): Promise<void> {
    const { error } = await supabase.from('ambiente_lecturas').update(l).eq('id', id)
    if (error) throw error
  },

  async eliminarLectura(id: string): Promise<void> {
    const { error } = await supabase.from('ambiente_lecturas').delete().eq('id', id)
    if (error) throw error
  },

  /**
   * La ultima lectura de cualquier sala. La usa el Panel para recordar la carga:
   * una rutina de dos veces por dia se sostiene si algo la recuerda, y el Panel
   * es la pantalla que se abre primero.
   */
  async ultimaLectura(): Promise<Lectura | null> {
    const { data, error } = await supabase
      .from('ambiente_lecturas').select('*')
      .order('medido_en', { ascending: false }).limit(1)
    if (error) throw error
    return ((data ?? [])[0] as Lectura) ?? null
  },
}

/**
 * Si falta la lectura del turno en curso. Devuelve null cuando no hay con que
 * responder —sin salas creadas todavia— para que el Panel no rete a nadie por
 * no cargar algo que no puede cargar.
 */
export function faltaLecturaDelTurno(ultima: Lectura | null, haySalas: boolean): boolean | null {
  if (!haySalas) return null
  if (!ultima) return true
  const ahora = new Date()
  const u = new Date(ultima.medido_en)
  const mismoDia = u.toDateString() === ahora.toDateString()
  return !(mismoDia && turnoDe(ultima.medido_en) === turnoDe(ahora.toISOString()))
}
