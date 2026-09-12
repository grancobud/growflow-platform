// El registro de visitas.
//
// POR QUE EXISTE. Lo pidio la asociación y es lo mas valioso que pidieron: «atendemos
// un monton de gente» y de esa gente no queda ningun rastro. El sistema
// registraba la TRANSACCION -la dispensa-; la visita es el ENCUENTRO, y la mayor
// parte de lo que la asociacion hace no termina en una entrega sino en
// informacion, en orientar un tramite, o en alguien que vuelve la semana que
// viene.
//
// Sin esto, la unica respuesta a «cuanta gente atendimos» era contar entregas,
// que es contar justo a los que se llevaron algo.

import { supabase } from './supabase'

/**
 * Por que vino.
 *
 * ES UNA LISTA CORTA Y NO TEXTO LIBRE, y es la decision que hace que el
 * registro sirva o no: un textarea se llena las primeras dos semanas y despues
 * nadie lo completa, y aunque lo completaran no se podria contar nada. Con
 * lista se puede contestar «atendimos 47 personas, 12 eran primera vez, 9 se
 * fueron sin llevarse nada porque les faltaba el REPROCANN».
 *
 * EL VALOR GUARDADO VA SIN TILDES y el `check` de la base lo exige asi. La
 * etiqueta con tildes es cosa de la pantalla: mezclarlas obliga a acordarse de
 * la acentuacion exacta cada vez que alguien escribe SQL a mano.
 */
export const MOTIVOS = [
  { valor: 'Primera vez', label: 'Primera vez' },
  { valor: 'Consulta o informacion', label: 'Consulta o información' },
  { valor: 'Retiro', label: 'Retiro' },
  { valor: 'Seguimiento', label: 'Seguimiento' },
  { valor: 'Tramite REPROCANN', label: 'Trámite REPROCANN' },
  { valor: 'Entrega de documentacion', label: 'Entrega de documentación' },
  { valor: 'Otro', label: 'Otro' },
] as const

/** En que termino. Null = la visita quedo abierta. */
export const RESULTADOS = [
  { valor: 'Se le entrego', label: 'Se le entregó' },
  { valor: 'Solo informacion', label: 'Sólo información' },
  { valor: 'Quedo en volver', label: 'Quedó en volver' },
  { valor: 'Se lo oriento con el REPROCANN', label: 'Se lo orientó con el REPROCANN' },
  { valor: 'Se lo dio de alta', label: 'Se lo dio de alta' },
  { valor: 'Se lo derivo', label: 'Se lo derivó' },
  { valor: 'Otro', label: 'Otro' },
] as const

export type Motivo = typeof MOTIVOS[number]['valor']
export type Resultado = typeof RESULTADOS[number]['valor']

/**
 * Las etiquetas, por accesor y NUNCA por `MAPA[x]` directo.
 *
 * Es la regla del `Record` indexado por un valor de la base: la base se migra
 * por SQL y por la Edge Function `ingesta`, y ninguna de las dos pasa por
 * TypeScript. Un valor nuevo en la columna y un `MAPA[x].label` tumban la
 * pantalla entera -paso el 20/08/2026 con `reprocann_estado` y dejo Pacientes
 * caida en produccion para los 211-.
 */
export const etiquetaMotivo = (v: string | null | undefined): string =>
  MOTIVOS.find(m => m.valor === v)?.label ?? (v || 'Sin motivo')

export const etiquetaResultado = (v: string | null | undefined): string =>
  RESULTADOS.find(r => r.valor === v)?.label ?? (v || 'Sin cerrar')

export interface Visita {
  id: string
  fecha: string
  hora: string | null
  /** Nullable A PROPOSITO: el que viene puede no estar en el padron. */
  paciente_id: string | null
  /** Como se llama, cuando no tiene ficha. Uno de los dos tiene que venir. */
  nombre_libre: string | null
  contacto: string | null
  motivo: string
  /** Null = quedo abierta. Lo mira el cruce `visita_sin_resultado`. */
  resultado: string | null
  atendio: string | null
  user_id: string | null
  notas: string | null
  /**
   * `registrada` la cargo alguien que estaba ahi; `derivada_de_dispensa` la
   * dedujo el sistema al traer el historial.
   *
   * La deducida es una inferencia solida -si hubo entrega, la persona vino- pero
   * el motivo y el resultado los puso el sistema, no un testigo. Sin la marca,
   * «atendimos 47 este mes» no se podria defender: no habria forma de decir
   * cuantas de esas las vio alguien.
   */
  origen: string
  creada_en: string
}

/** Si la visita la dedujo el sistema en vez de registrarla una persona. */
export const esDerivada = (v: Pick<Visita, 'origen'>) => v.origen === 'derivada_de_dispensa'

/** Como mostrar de quien fue la visita, tenga ficha o no. */
export const nombreDeVisita = (
  v: Pick<Visita, 'paciente_id' | 'nombre_libre'>,
  padron: { id: string; nombre_completo: string }[],
): string =>
  (v.paciente_id ? padron.find(p => p.id === v.paciente_id)?.nombre_completo : null)
  ?? v.nombre_libre
  ?? 'Sin identificar'

export interface ResumenVisitas {
  hoy: number
  /**
   * Visitas de los ULTIMOS 30 DIAS, no del mes calendario.
   *
   * Era «este mes» y se cambio el 01/09/2026 mirando la pantalla: ese dia habia
   * 945 visitas cargadas y los contadores decian 0, porque septiembre acababa de
   * empezar. Tecnicamente correcto y en la practica una pantalla muerta el
   * primero de cada mes, justo cuando alguien entra a ver como viene el mes.
   *
   * Una ventana movil contesta la misma pregunta -«cuanta gente atendemos»- y no
   * se cae sola al pasar la medianoche del 31.
   */
  mes: number
  /** Personas distintas en esos 30 dias: la misma persona puede venir tres veces. */
  personasMes: number
  primeraVez: number
  /** Las que quedaron sin cerrar. Da cero cuando todo esta bien. */
  sinResultado: number
  /** Atendidas que no estan en el padron: es la lista de trabajo de admision. */
  sinPadron: number
  /** Cuantas de las del mes las dedujo el sistema y no las vio nadie. */
  derivadasMes: number
}

/**
 * Los numeros que se miran todos los dias.
 *
 * Se cuenta por PERSONA y no solo por visita para el mes: «atendimos 47» y
 * «vinieron 47 personas» no son lo mismo cuando alguien viene tres veces, y el
 * numero que la asociacion quiere dar es el segundo.
 *
 * `hoy` entra por parametro y no se lee de `new Date()` adentro para que se
 * pueda testear sin depender del dia en que corran los tests.
 */
export function resumenVisitas(visitas: Visita[], hoy: string): ResumenVisitas {
  // 30 dias moviles hacia atras, contando hoy. Se calcula con Date y no
  // restandole a la cadena, para que el cruce de mes y de anio no lo rompa.
  const desde = new Date(hoy + 'T00:00:00')
  desde.setDate(desde.getDate() - 29)
  const corte = desde.toISOString().slice(0, 10)
  const delMes = visitas.filter(v => v.fecha >= corte && v.fecha <= hoy)
  const clave = (v: Visita) => v.paciente_id ?? `libre:${(v.nombre_libre ?? '').trim().toLowerCase()}`
  return {
    hoy: visitas.filter(v => v.fecha === hoy).length,
    mes: delMes.length,
    personasMes: new Set(delMes.map(clave)).size,
    primeraVez: delMes.filter(v => v.motivo === 'Primera vez').length,
    sinResultado: visitas.filter(v => !v.resultado).length,
    sinPadron: new Set(visitas.filter(v => !v.paciente_id).map(clave)).size,
    derivadasMes: delMes.filter(esDerivada).length,
  }
}

export const visitasService = {
  async getVisitas(desde?: string): Promise<Visita[]> {
    let q = supabase.from('ong_visitas').select('*')
    if (desde) q = q.gte('fecha', desde)
    const { data, error } = await q.order('fecha', { ascending: false }).order('creada_en', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as Visita[]
  },

  async guardar(v: Partial<Visita>): Promise<Visita> {
    // Se manda EXPLICITO lo que la base pondria por default: el dev local corre
    // en modo demo contra localStorage, donde no hay defaults de Postgres. Es el
    // gotcha que ya costo caro con `activa` en `cultivo_areas`.
    const fila = {
      ...v,
      fecha: v.fecha || new Date().toISOString().slice(0, 10),
      // Vacio es null y no '': un string vacio pasa el check de «es de alguien»
      // por poco y despues se muestra como un nombre en blanco.
      nombre_libre: v.nombre_libre?.trim() || null,
      contacto: v.contacto?.trim() || null,
      atendio: v.atendio?.trim() || null,
      notas: v.notas?.trim() || null,
      resultado: v.resultado || null,
      // Explicito y no al default de la columna: el modo demo corre contra
      // localStorage, donde no hay defaults de Postgres.
      origen: v.origen ?? 'registrada',
    }
    const q = v.id
      ? supabase.from('ong_visitas').update(fila).eq('id', v.id).select().single()
      : supabase.from('ong_visitas').insert(fila).select().single()
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return data as Visita
  },

  async eliminar(id: string): Promise<void> {
    const { error } = await supabase.from('ong_visitas').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
