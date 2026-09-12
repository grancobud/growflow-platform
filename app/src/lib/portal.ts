// Portal de autodispensación (SRS v3.2: CU-04, CU-05, CU-06 y RN-06).
//
// El circuito es: el paciente reserva del catálogo → paga o se compromete a
// pagar → tiene 72 horas para retirar → en la sede se valida y se entrega. Recién
// ahí nace la dispensa, el asiento en caja y el recibo. Antes de eso no pasó nada
// contable: una reserva no es una entrega.
//
// Dos decisiones que sostienen todo lo demás:
//
// 1. El disponible de un lote NO se guarda, se calcula. Un contador que se
//    actualiza por trigger se desincroniza el día que algo falla a mitad de
//    camino, y en un inventario fito-médico un número que miente es peor que no
//    tener el número.
//
// 2. El cupo de 30 días cuenta lo entregado MÁS lo reservado y todavía vivo. Si
//    sólo contara entregas, cinco reservas simultáneas pasarían el tope las cinco
//    y el exceso se descubriría en el mostrador, con el material ya comprometido.

import { supabase } from './supabase'
import type { Dispensa, FeedbackClinico, Asociado, AsientoCaja, Unidad } from './ong'
import { feedbackPendiente, sufijoUnidad } from './ong'
import type { Paciente } from './registro'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Partida fraccionada y lista para dispensar: el catálogo terapéutico. */
export interface Lote {
  id: string
  codigo: string
  producto: string
  genetica_id?: string | null
  cosecha_id?: string | null
  gramos_totales: number
  fecha_elaboracion?: string | null
  /** Informe cromatográfico por lote: lo exige la Resolución 1780/2025. */
  thc_pct?: number | null
  cbd_pct?: number | null
  laboratorio?: string | null
  fecha_analisis?: string | null
  analisis_path?: string | null
  aporte_por_gramo?: number | null
  /**
   * De donde salio el material. Sin esto el modelo asume cultivo propio: un
   * lote sin `cosecha_id` era indistinguible de uno comprado, y el ingreso real
   * de una instalacion que compra a terceros no se podia sumar.
   */
  origen?: OrigenLote | null
  /** En que se mide `gramos_totales`. Ver UNIDADES en ong.ts. */
  unidad?: Unidad | null
  /** Costo del gramo puesto en el estante. Null = sin cargar, NO cero. */
  costo_por_gramo?: number | null
  proveedor?: string | null
  activo?: boolean
  notas?: string | null
  creado_en?: string
}

export type OrigenLote = 'propio' | 'comprado' | 'propio_sin_cosecha'

export const ORIGENES_LOTE: { valor: OrigenLote; label: string; ayuda: string }[] = [
  { valor: 'propio',   label: 'Cultivo propio', ayuda: 'Salio de una cosecha de la instalacion.' },
  { valor: 'comprado', label: 'Comprado',       ayuda: 'Se adquirio a un tercero con orden de servicio.' },
  {
    valor: 'propio_sin_cosecha',
    label: 'Propio, sin cosecha registrada',
    ayuda: 'Es produccion de la asociacion pero la cosecha nunca se cargo. Suma al ingreso y queda marcado como pendiente de trazar.',
  },
]

/**
 * Un lote sin `origen` cargado se decide por `cosecha_id`: si no viene de
 * ninguna cosecha no pudo salir del cultivo propio. Hace falta porque el codigo
 * corre contra filas anteriores a la migracion, donde la columna no existe.
 */
export const origenDeLote = (l: Pick<Lote, 'origen' | 'cosecha_id'>): OrigenLote =>
  l.origen === 'propio' || l.origen === 'comprado' || l.origen === 'propio_sin_cosecha'
    ? l.origen
    : (l.cosecha_id ? 'propio' : 'comprado')

/**
 * Cuanto material cosechado todavia no esta puesto en ningun lote.
 *
 * EL HUECO QUE TAPA. El circuito para entregar material propio es
 * cosecha → lote → dispensa, y el paso del medio no existia en ninguna
 * pantalla: `cosecha_id` se leia para decidir el origen de un lote, pero
 * ninguna pantalla lo escribia y el alta de lote no ofrecia elegir una cosecha.
 * El 27/08/2026 en la asociación cargaron quince cosechas y despues no encontraban
 * nada para dispensar — no fallaba nada, simplemente el material nunca habia
 * llegado a ser un lote, y una entrega engancha por `lote_codigo`.
 *
 * SE MIDE EN GRAMOS, NO POR COSECHA. Un lote puede juntar varias cosechas —las
 * quince de ese dia eran 21,4 g cada una, y quince lotes de 21,4 g no los usa
 * nadie— y `ong_lotes.cosecha_id` es una sola FK, asi que aparear de a uno
 * daria por pendiente lo que ya se cargo. Comparar totales no puede dar un
 * falso positivo: o el gramo esta en un lote propio o no esta.
 *
 * NO CUENTA LOS LOTES COMPRADOS ni los `propio_sin_cosecha`: esos entraron por
 * su cuenta y ya suman al ingreso por separado. Contarlos aca daria el material
 * propio por lotado usando material de otro lado.
 */
export function materialSinLotear(
  gramosCosechados: number, lotes: Pick<Lote, 'origen' | 'cosecha_id' | 'gramos_totales' | 'unidad'>[] = [],
): number {
  const enLotesPropios = lotes
    .filter(l => (l.unidad ?? 'g') === 'g' && origenDeLote(l) === 'propio')
    .reduce((s, l) => s + (Number(l.gramos_totales) || 0), 0)
  // Nunca negativo: que haya MAS lote propio que cosecha es otro problema
  // —falta cargar una cosecha— y de ese se ocupa el balance de materia.
  return Math.max(0, (Number(gramosCosechados) || 0) - enLotesPropios)
}

/**
 * Produccion propia cuya cosecha nunca se registro.
 *
 * SUMA AL INGRESO, igual que un lote comprado, porque el material existio y se
 * dispenso. Lo que NO hace es decir que salio de una cosecha: eso es
 * justamente lo que no consta.
 *
 * Existe porque `propio` y `comprado` no alcanzaban para el caso real: en
 * la asociación hay X.XXX g de produccion propia cargados como compra a si mismos, y
 * marcarlos `propio` los saca del ingreso —su cosecha «ya estaria contada»— sin
 * que haya ninguna cosecha que los reponga. El stock quedaba en -X.XXX g.
 */
export const esPropioSinCosecha = (l: Pick<Lote, 'origen' | 'cosecha_id'>) =>
  origenDeLote(l) === 'propio_sin_cosecha'

export const esComprado = (l: Pick<Lote, 'origen' | 'cosecha_id'>) =>
  origenDeLote(l) === 'comprado'


export interface Pedido {
  id: string
  codigo_reserva: string
  lote_id: string
  paciente_id?: string | null
  asociado_id?: string | null
  gramos: number
  monto_reembolso: number
  metodo_pago: MetodoPago
  estado_pago: EstadoPago
  estado_pedido: EstadoPedido
  fecha_expiracion: string
  comprobante_path?: string | null
  comprobante_nombre?: string | null
  dispensa_id?: string | null
  entregado_en?: string | null
  notas?: string | null
  creado_en?: string
}

export type MetodoPago = 'Transferencia_Billetera' | 'Efectivo_Sede'
export type EstadoPago = 'Pendiente_Verificacion' | 'Pendiente_Efectivo' | 'Abonado' | 'Rechazado'
export type EstadoPedido = 'Reservado' | 'Listo_Para_Retiro' | 'Entregado' | 'Expirado' | 'Cancelado'

export const METODOS_PAGO: { valor: MetodoPago; label: string; detalle: string }[] = [
  { valor: 'Transferencia_Billetera', label: 'Transferencia o billetera',
    detalle: 'Adjunta el comprobante y queda pendiente de verificación.' },
  { valor: 'Efectivo_Sede', label: 'Efectivo en la sede',
    detalle: 'Se cobra en el mostrador al momento del retiro.' },
]

export const ESTADOS_PAGO: { valor: EstadoPago; label: string; color: string }[] = [
  { valor: 'Pendiente_Verificacion', label: 'A verificar', color: '#fbbf24' },
  { valor: 'Pendiente_Efectivo', label: 'Paga en sede', color: '#8a8a9c' },
  { valor: 'Abonado', label: 'Abonado', color: '#a3e635' },
  { valor: 'Rechazado', label: 'Rechazado', color: '#ff8a7a' },
]

export const ESTADOS_PEDIDO: { valor: EstadoPedido; label: string; color: string }[] = [
  { valor: 'Reservado', label: 'Reservado', color: '#a78bfa' },
  { valor: 'Listo_Para_Retiro', label: 'Listo para retirar', color: '#38bdf8' },
  { valor: 'Entregado', label: 'Entregado', color: '#a3e635' },
  { valor: 'Expirado', label: 'Expirado', color: '#8a8a9c' },
  { valor: 'Cancelado', label: 'Cancelado', color: '#8a8a9c' },
]

export const PRODUCTOS_LOTE = ['flor', 'aceite', 'extracto', 'tópico', 'otro'] as const

/** RN-06: las horas que el material queda apartado esperando el retiro. */
export const HORAS_RESERVA = 72

export const etiquetaPago = (v: EstadoPago) => ESTADOS_PAGO.find(e => e.valor === v)?.label ?? v
export const etiquetaPedido = (v: EstadoPedido) => ESTADOS_PEDIDO.find(e => e.valor === v)?.label ?? v
export const colorPedido = (v: EstadoPedido) => ESTADOS_PEDIDO.find(e => e.valor === v)?.color ?? '#8a8a9c'
export const colorPago = (v: EstadoPago) => ESTADOS_PAGO.find(e => e.valor === v)?.color ?? '#8a8a9c'

// ---------------------------------------------------------------------------
// Vencimiento (RN-06)
// ---------------------------------------------------------------------------

/** Los estados en los que el pedido todavía tiene material apartado. */
export const ESTADOS_VIVOS: EstadoPedido[] = ['Reservado', 'Listo_Para_Retiro']

export const estaVivo = (p: Pedido) => ESTADOS_VIVOS.includes(p.estado_pedido)

export function vencimiento(desde: Date = new Date(), horas = HORAS_RESERVA): string {
  return new Date(desde.getTime() + horas * 3600_000).toISOString()
}

/**
 * Un pedido vivo cuya fecha de expiración ya pasó. Está vencido de hecho aunque
 * la base todavía lo muestre como 'Reservado': el estado se corrige al abrir la
 * pantalla, no hay un cron que lo haga a las tres de la mañana.
 */
export function estaVencido(p: Pedido, ahora: Date = new Date()): boolean {
  return estaVivo(p) && new Date(p.fecha_expiracion).getTime() <= ahora.getTime()
}

/** Horas que faltan para que expire. Negativo si ya pasó. */
export function horasRestantes(p: Pedido, ahora: Date = new Date()): number {
  return (new Date(p.fecha_expiracion).getTime() - ahora.getTime()) / 3600_000
}

export function textoRestante(p: Pedido, ahora: Date = new Date()): string {
  const h = horasRestantes(p, ahora)
  if (h <= 0) return 'vencida'
  if (h < 1) return `vence en ${Math.max(1, Math.round(h * 60))} min`
  if (h < 24) return `vence en ${Math.round(h)} h`
  // Se redondea a horas ANTES de partir en días: redondear el resto por separado
  // daba "2 d 24 h" cuando faltaban 71,99 horas.
  const total = Math.round(h)
  const dias = Math.floor(total / 24)
  const resto = total % 24
  return resto === 0 ? `vence en ${dias} d` : `vence en ${dias} d ${resto} h`
}

// ---------------------------------------------------------------------------
// Disponibilidad del lote
// ---------------------------------------------------------------------------

export interface Disponibilidad {
  totales: number
  /** Apartado por reservas todavía vivas. */
  reservado: number
  /** Todo lo que salió del lote: portal + mostrador. */
  entregado: number
  /** La parte de `entregado` que salió por una reserva del portal. */
  porPedido: number
  /** La parte de `entregado` que salió por una dispensa de mostrador. */
  porDispensa: number
  disponible: number
  /** 'g' | 'u' | 'ml' — para que la pantalla no diga "21 g" de 21 frascos. */
  sufijo: string
}

/**
 * Lo que queda de un lote. Descuenta lo entregado y lo que está apartado por
 * reservas vivas: el material de una reserva sin retirar no está libre, aunque
 * físicamente siga en el frasco.
 */
export function disponibleDeLote(
  lote: Lote, pedidos: Pedido[], dispensas: Dispensa[] = [], ahora: Date = new Date(),
): Disponibilidad {
  const suyos = pedidos.filter(p => p.lote_id === lote.id)
  const porPedido = suyos
    .filter(p => p.estado_pedido === 'Entregado')
    .reduce((s, p) => s + (Number(p.gramos) || 0), 0)
  // Material que salio por mostrador, sin pasar por el portal. Es la via por la
  // que sale TODO en una instalacion que no usa reservas: contar solo pedidos
  // daba un catalogo con stock que ya no estaba en el estante.
  const porDispensa = dispensas
    .filter(d => d.lote_codigo != null && d.lote_codigo === lote.codigo)
    .reduce((s, d) => s + (Number(d.gramos) || 0), 0)
  const entregado = porPedido + porDispensa
  const reservado = suyos
    .filter(p => estaVivo(p) && !estaVencido(p, ahora))
    .reduce((s, p) => s + (Number(p.gramos) || 0), 0)
  const totales = Number(lote.gramos_totales) || 0
  return {
    totales, reservado, entregado, porPedido, porDispensa,
    disponible: Math.max(0, totales - entregado - reservado),
    sufijo: sufijoUnidad(lote.unidad),
  }
}

/** Total del catálogo disponible, para el encabezado. */
export function resumenCatalogo(
  lotes: Lote[], pedidos: Pedido[], dispensas: Dispensa[] = [], ahora: Date = new Date(),
) {
  const activos = lotes.filter(l => l.activo !== false)
  // Los totales del encabezado suman SOLO los lotes en gramos. Sumar frascos de
  // aceite con gramos de flor da un numero que no significa nada, y era lo que
  // hacia: 21 frascos entraban al total como si fueran 21 g.
  const enGramos = activos.filter(l => sufijoUnidad(l.unidad) === 'g')
  const d = enGramos.map(l => disponibleDeLote(l, pedidos, dispensas, ahora))
  // Cuanto vale esto. La app venia CAPTURANDO el costo por gramo en el alta del
  // lote y no lo sumaba en ningun lado: el dato estaba guardado y era invisible,
  // igual que pasaba con los asientos de caja. la asociación lo miraba en la hoja
  // Inventario porque en la app no habia donde.
  //
  // `costo_por_gramo` es por unidad de medida, no por gramo: en un lote de
  // frascos es el costo del frasco. Por eso cantidad x costo sirve para los dos
  // y da exacto contra el total de la planilla.
  const valorDe = (l: Lote) => (Number(l.gramos_totales) || 0) * (Number(l.costo_por_gramo) || 0)
  // Lo invertido va sobre TODOS los lotes, no solo los activos: es lo que se
  // gasto en mercaderia desde que arrancaron, incluyendo lo ya entregado.
  const invertido = lotes.reduce((s, l) => s + valorDe(l), 0)
  const enStock = activos.reduce((s, l) => {
    const costo = Number(l.costo_por_gramo) || 0
    if (!costo) return s
    return s + disponibleDeLote(l, pedidos, dispensas, ahora).disponible * costo
  }, 0)
  return {
    lotes: activos.length,
    /** Cuantos de `lotes` no se miden en gramos y por eso no entran a los totales. */
    otrasUnidades: activos.length - enGramos.length,
    disponible: d.reduce((s, x) => s + x.disponible, 0),
    reservado: d.reduce((s, x) => s + x.reservado, 0),
    entregado: d.reduce((s, x) => s + x.entregado, 0),
    sinAnalisis: activos.filter(l => !l.fecha_analisis).length,
    invertido,
    enStock,
    /** Lotes sin costo cargado: no entran a los dos totales de arriba. */
    sinCosto: lotes.filter(l => !(Number(l.costo_por_gramo) > 0)).length,
  }
}

// ---------------------------------------------------------------------------
// Código de reserva
// ---------------------------------------------------------------------------

/**
 * Formato del SRS: RSV-8921-2026. Los cuatro dígitos son para que la persona
 * pueda dictarlo por teléfono; la unicidad la garantiza la base, así que si el
 * azar repite uno se reintenta.
 */
export function codigoReserva(existentes: string[] = [], anio?: number): string {
  const y = anio ?? new Date().getFullYear()
  const usados = new Set(existentes)
  for (let i = 0; i < 50; i++) {
    const n = 1000 + Math.floor(Math.random() * 9000)
    const c = `RSV-${n}-${y}`
    if (!usados.has(c)) return c
  }
  return `RSV-${Date.now().toString().slice(-4)}-${y}`
}

export const montoSugerido = (lote: Lote, gramos: number): number =>
  Math.round((Number(lote.aporte_por_gramo) || 0) * (Number(gramos) || 0))

// ---------------------------------------------------------------------------
// Cupo móvil de 30 días, contando reservas
// ---------------------------------------------------------------------------

export interface CupoConReservas {
  entregado: number
  /** Apartado por reservas vivas dentro de la ventana. */
  reservado: number
  comprometido: number
  tope: number | null
  remanente: number | null
  desde: string
  hasta: string
}

/**
 * RN-02 aplicado al portal. Cuenta lo entregado en los últimos 30 días MÁS lo
 * que la persona ya tiene reservado y sin retirar.
 *
 * Sólo con entregas, cinco reservas simultáneas pasarían el tope las cinco y el
 * exceso aparecería recién en el mostrador, con el material ya comprometido.
 */
export function cupoConReservas(
  pacienteId: string, dispensas: Dispensa[], pedidos: Pedido[],
  topeMensualG: number | null, ahora: Date = new Date(), excluirPedidoId?: string,
): CupoConReservas {
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const desde = new Date(ahora); desde.setDate(desde.getDate() - 30)
  const hasta = iso(ahora)

  const entregado = dispensas
    .filter(d => d.paciente_id === pacienteId && d.fecha >= iso(desde) && d.fecha <= hasta)
    .reduce((s, d) => s + (Number(d.gramos) || 0), 0)

  // Las entregadas ya están contadas del lado de las dispensas: sumarlas otra vez
  // acá haría que cada retiro descuente el doble del cupo.
  const reservado = pedidos
    .filter(p => p.paciente_id === pacienteId && p.id !== excluirPedidoId &&
      estaVivo(p) && !estaVencido(p, ahora))
    .reduce((s, p) => s + (Number(p.gramos) || 0), 0)

  const comprometido = entregado + reservado
  return {
    entregado, reservado, comprometido, tope: topeMensualG,
    remanente: topeMensualG != null ? Math.max(0, topeMensualG - comprometido) : null,
    desde: iso(desde), hasta,
  }
}

// ---------------------------------------------------------------------------
// Habilitación del paciente (CU-05, pasos 1 y 2)
// ---------------------------------------------------------------------------

export interface Bloqueo {
  /** 'error' impide reservar; 'alerta' deja pasar avisando. */
  nivel: 'error' | 'alerta'
  regla: string
  texto: string
  /** Qué tiene que hacer alguien para destrabarlo. */
  comoSeResuelve?: string
}

export interface EstadoPaciente {
  paciente: Paciente
  asociado: Asociado | null
  bloqueos: Bloqueo[]
  puedeReservar: boolean
  cupo: CupoConReservas
  /** Entrega anterior sin reporte: hay que completar la encuesta primero (RN-05). */
  dispensaSinReporte: Dispensa | null
  mandatoPendiente: boolean
}

const vencido = (fecha?: string | null, hoy = new Date()) =>
  !!fecha && new Date(fecha + 'T23:59:59').getTime() < hoy.getTime()

/**
 * Evalúa si una persona puede reservar, y si no, por qué exactamente.
 *
 * Devuelve todos los motivos juntos en vez de cortar en el primero: si a alguien
 * le falta el mandato Y tiene el REPROCANN vencido, enterarse de a una cosa por
 * visita es la peor manera de resolverlo.
 */
export function evaluarPaciente(
  paciente: Paciente,
  opts: {
    asociados: Asociado[]
    dispensas: Dispensa[]
    feedbacks: FeedbackClinico[]
    pedidos: Pedido[]
    ahora?: Date
  },
): EstadoPaciente {
  const ahora = opts.ahora ?? new Date()
  const asociado = opts.asociados.find(a =>
    a.paciente_id === paciente.id || a.nombre === paciente.nombre_completo) ?? null
  const bloqueos: Bloqueo[] = []

  // RN-01: el estado del REPROCANN.
  //
  // El SRS v3.2 lo define como bloqueo duro (HTTP 403). la asociación decidio el
  // 20/08/2026 que NO bloquee: 141 de sus 211 pacientes no tienen registro y
  // bloquearlos seria dejar sin acceso a gente que ya venia siendo atendida.
  // Entra en su lugar la tarifa de transicion (ver ong_tarifas): quien no lo
  // tiene paga la plena mientras lo gestiona.
  //
  // AVISA FUERTE Y NO SE PUEDE PERDER DE VISTA. Que no bloquee no es que no
  // importe: sin REPROCANN vinculado la entrega no esta amparada por la 27.350,
  // y quien la autoriza tiene que verlo escrito en el momento de autorizarla.
  // Por eso queda como `alerta` en vez de desaparecer.
  if (!paciente.reprocann_nro) {
    bloqueos.push({
      nivel: 'alerta', regla: 'RN-01',
      texto: 'Sin número de REPROCANN: la entrega no está amparada y va con tarifa de transición.',
      comoSeResuelve: 'Cargá el número en la ficha apenas lo tramite.',
    })
  } else if (vencido(paciente.reprocann_vencimiento, ahora)) {
    bloqueos.push({
      nivel: 'alerta', regla: 'RN-01',
      texto: `El REPROCANN venció el ${paciente.reprocann_vencimiento}.`,
      comoSeResuelve: 'Hay que renovarlo antes de la próxima entrega.',
    })
  } else if (paciente.reprocann_estado && paciente.reprocann_estado !== 'Vigente') {
    bloqueos.push({
      nivel: 'alerta', regla: 'RN-01',
      texto: `El REPROCANN figura como "${paciente.reprocann_estado}", no vigente.`,
    })
  }

  // Esto NO es la regla del REPROCANN y sigue siendo bloqueo duro: una ficha
  // dada de baja es alguien que la entidad decidio que no recibe mas. Que RN-01
  // haya pasado a aviso no lo alcanza.
  if (paciente.activo === false) {
    bloqueos.push({ nivel: 'error', regla: 'Ficha de baja', texto: 'La ficha está dada de baja.' })
  }

  // RN-03 / CU-04: sin mandato firmado la entrega parecería una compraventa.
  const mandatoPendiente = !asociado?.mandato_aceptado
  if (mandatoPendiente) {
    bloqueos.push({
      nivel: 'error', regla: 'RN-03 · CU-04',
      texto: asociado
        ? 'No firmó el Mandato de Gestión Operativa Especial.'
        : 'No figura como asociado de la entidad.',
      comoSeResuelve: asociado
        ? 'Se firma desde acá mismo, con el botón "Firmar mandato".'
        : 'Primero hay que darlo de alta como asociado.',
    })
  }

  // RN-05: la entrega anterior sin reporte bloquea la siguiente.
  const dispensaSinReporte = feedbackPendiente(opts.dispensas, opts.feedbacks, paciente.id)
  if (dispensaSinReporte) {
    bloqueos.push({
      nivel: 'error', regla: 'RN-05',
      texto: `La entrega del ${dispensaSinReporte.fecha} no tiene reporte de seguimiento.`,
      comoSeResuelve: 'Completá la Encuesta de Seguimiento Terapéutico para destrabar el catálogo.',
    })
  }

  const cupo = cupoConReservas(
    paciente.id, opts.dispensas, opts.pedidos,
    paciente.tope_mensual_g != null ? Number(paciente.tope_mensual_g) : null, ahora)

  if (cupo.tope == null) {
    bloqueos.push({
      nivel: 'alerta', regla: 'RN-02',
      texto: 'No tiene tope mensual cargado, así que el cupo no se puede controlar.',
      comoSeResuelve: 'Cargá "tope mensual (g)" en la ficha del paciente.',
    })
  } else if (cupo.remanente === 0) {
    bloqueos.push({
      nivel: 'error', regla: 'RN-02',
      texto: `Ya tiene comprometidos ${cupo.comprometido} g de ${cupo.tope} g en los últimos 30 días.`,
      comoSeResuelve: `Se libera cupo a partir del ${cupo.desde} en adelante, a medida que las entregas salgan de la ventana.`,
    })
  }

  return {
    paciente, asociado, bloqueos,
    puedeReservar: !bloqueos.some(b => b.nivel === 'error'),
    cupo, dispensaSinReporte, mandatoPendiente,
  }
}

// ---------------------------------------------------------------------------
// Revisión de una reserva concreta (CU-05, paso 3)
// ---------------------------------------------------------------------------

export function revisarReserva(
  gramos: number, lote: Lote | null, estado: EstadoPaciente | null,
  pedidos: Pedido[], dispensas: Dispensa[] = [], ahora: Date = new Date(),
): Bloqueo[] {
  const av: Bloqueo[] = [...(estado?.bloqueos ?? [])]
  if (!lote) {
    av.push({ nivel: 'error', regla: 'RN-06', texto: 'Elegí de qué lote sale el material.' })
    return av
  }
  if (!(gramos > 0)) {
    av.push({ nivel: 'error', regla: 'RN-06', texto: 'Poné cuántos gramos se reservan.' })
    return av
  }

  const d = disponibleDeLote(lote, pedidos, dispensas, ahora)
  if (gramos > d.disponible) {
    av.push({
      nivel: 'error', regla: 'RN-06',
      texto: `El lote ${lote.codigo} tiene ${d.disponible} g disponibles` +
        (d.reservado > 0 ? ` (${d.reservado} g ya están apartados por otras reservas)` : '') + '.',
    })
  }

  if (estado?.cupo.tope != null && estado.cupo.remanente != null && gramos > estado.cupo.remanente) {
    av.push({
      nivel: 'error', regla: 'RN-02',
      texto: `Le quedan ${estado.cupo.remanente} g de cupo en los últimos 30 días ` +
        `(${estado.cupo.entregado} g entregados + ${estado.cupo.reservado} g reservados de ${estado.cupo.tope} g).`,
    })
  }

  if (!lote.fecha_analisis) {
    av.push({
      nivel: 'alerta', regla: 'Res. 1780',
      texto: `El lote ${lote.codigo} no tiene informe cromatográfico cargado.`,
      comoSeResuelve: 'La 1780 pide un análisis por lote producido.',
    })
  }
  if (!lote.aporte_por_gramo) {
    av.push({
      nivel: 'alerta', regla: 'RN-04',
      texto: 'El lote no tiene aporte por gramo cargado: el monto del reembolso queda en cero.',
    })
  }
  return av
}

// ---------------------------------------------------------------------------
// Retiro en sede (CU-06)
// ---------------------------------------------------------------------------

export interface ChequeoRetiro {
  puedeEntregar: boolean
  /** Falta cobrar en el mostrador antes de entregar. */
  cobrarEnSede: boolean
  motivos: Bloqueo[]
}

/**
 * Lo que el operador tiene que mirar antes de entregar. La regla del SRS es
 * distinta según el medio: la transferencia la valida administración de
 * antemano, el efectivo se cobra en el momento.
 */
export function chequearRetiro(p: Pedido, ahora: Date = new Date()): ChequeoRetiro {
  const motivos: Bloqueo[] = []

  if (p.estado_pedido === 'Entregado') {
    motivos.push({ nivel: 'error', regla: 'CU-06', texto: 'Esta reserva ya fue entregada.' })
  }
  if (p.estado_pedido === 'Expirado' || p.estado_pedido === 'Cancelado') {
    motivos.push({
      nivel: 'error', regla: 'RN-06',
      texto: `La reserva está ${etiquetaPedido(p.estado_pedido).toLowerCase()}: el material volvió al inventario.`,
      comoSeResuelve: 'Hay que generar una reserva nueva.',
    })
  } else if (estaVencido(p, ahora)) {
    motivos.push({
      nivel: 'error', regla: 'RN-06',
      texto: `Las 72 horas vencieron el ${new Date(p.fecha_expiracion).toLocaleString('es-AR')}.`,
      comoSeResuelve: 'Hay que generar una reserva nueva.',
    })
  }

  if (p.estado_pago === 'Rechazado') {
    motivos.push({ nivel: 'error', regla: 'CU-06', texto: 'El pago figura como rechazado.' })
  }
  // Por billetera, administración tiene que haberlo marcado abonado ANTES.
  if (p.metodo_pago === 'Transferencia_Billetera' && p.estado_pago !== 'Abonado') {
    motivos.push({
      nivel: 'error', regla: 'CU-06',
      texto: 'El pago por transferencia todavía no está verificado por administración.',
      comoSeResuelve: 'Revisá el comprobante y marcá el pedido como abonado.',
    })
  }

  const cobrarEnSede = p.metodo_pago === 'Efectivo_Sede' && p.estado_pago !== 'Abonado'
  return { puedeEntregar: !motivos.some(m => m.nivel === 'error'), cobrarEnSede, motivos }
}

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------

export const BUCKET_COMPROBANTES = 'documentos'

export const portalService = {
  async getLotes(): Promise<Lote[]> {
    const { data, error } = await supabase.from('ong_lotes').select('*').order('creado_en', { ascending: false })
    if (error) throw error
    return (data ?? []) as Lote[]
  },

  async guardarLote(l: Partial<Lote>): Promise<void> {
    const { id, ...campos } = l
    const { error } = id
      ? await supabase.from('ong_lotes').update(campos).eq('id', id)
      : await supabase.from('ong_lotes').insert(campos)
    if (error) throw error
  },

  async borrarLote(id: string): Promise<void> {
    const { error } = await supabase.from('ong_lotes').delete().eq('id', id)
    if (error) throw error
  },

  async getPedidos(): Promise<Pedido[]> {
    const { data, error } = await supabase.from('ong_pedidos').select('*').order('creado_en', { ascending: false })
    if (error) throw error
    return (data ?? []) as Pedido[]
  },

  async guardarPedido(p: Partial<Pedido>): Promise<void> {
    const { id, ...campos } = p
    const { error } = id
      ? await supabase.from('ong_pedidos').update(campos).eq('id', id)
      : await supabase.from('ong_pedidos').insert(campos)
    if (error) throw error
  },

  async borrarPedido(id: string): Promise<void> {
    const { error } = await supabase.from('ong_pedidos').delete().eq('id', id)
    if (error) throw error
  },

  /**
   * Marca como expiradas las reservas que pasaron las 72 horas y devuelve
   * cuántas fueron. Se corre al abrir la pantalla: no hay cron, y una reserva
   * vencida que sigue figurando como viva mantiene material apartado de gusto.
   */
  async expirarVencidas(pedidos: Pedido[], ahora: Date = new Date()): Promise<number> {
    const vencidas = pedidos.filter(p => estaVencido(p, ahora))
    if (!vencidas.length) return 0
    const { error } = await supabase.from('ong_pedidos')
      .update({ estado_pedido: 'Expirado' })
      .in('id', vencidas.map(p => p.id))
    if (error) throw error
    return vencidas.length
  },

  /**
   * CU-04: deja registrado el momento exacto y el origen de la firma del
   * mandato. La fecha sola no acredita cuándo se firmó, y el SRS pide timestamp
   * e IP porque es lo que sostiene que la entrega no es una compraventa.
   */
  async firmarMandato(asociadoId: string, ip: string | null, version = 'v1'): Promise<void> {
    const ahora = new Date()
    const { error } = await supabase.from('ong_asociados').update({
      mandato_aceptado: true,
      mandato_fecha: ahora.toISOString().slice(0, 10),
      mandato_hora: ahora.toISOString(),
      ip_firma_mandato: ip,
      mandato_version: version,
    }).eq('id', asociadoId)
    if (error) throw error
  },

  async subirComprobante(file: File): Promise<{ path: string; nombre: string }> {
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `comprobantes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from(BUCKET_COMPROBANTES).upload(path, file)
    if (error) throw error
    return { path, nombre: file.name }
  },
}

/**
 * La IP desde la que se firma el mandato. Si el servicio no responde se firma
 * igual con null: bloquear una firma legítima porque un tercero está caído sería
 * peor que registrar la firma sin ese dato.
 */
export async function ipPublica(): Promise<string | null> {
  try {
    const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) })
    if (!r.ok) return null
    const j = await r.json()
    return typeof j?.ip === 'string' ? j.ip : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Consolidación de la entrega (CU-06, paso 3)
// ---------------------------------------------------------------------------

export interface ResultadoEntrega {
  dispensa: Partial<Dispensa>
  asiento: Partial<AsientoCaja>
}

/**
 * Arma la dispensa y el asiento de caja que nacen de un retiro.
 *
 * No los graba: los devuelve para que quien llama los guarde en orden y pueda
 * cortar si algo falla. La dispensa es el hecho registrable; el asiento es su
 * contrapartida en el Libro de Caja. Que salgan del mismo lugar es lo que evita
 * que después no cierren entre sí.
 */
export function consolidarEntrega(
  p: Pedido, lote: Lote, opts: { entregadoPor?: string | null; reciboNumero?: number | null } = {},
): ResultadoEntrega {
  const hoy = new Date().toISOString().slice(0, 10)
  return {
    dispensa: {
      paciente_id: p.paciente_id ?? null,
      fecha: hoy,
      producto: lote.producto,
      genetica_id: lote.genetica_id ?? null,
      gramos: Number(p.gramos),
      aporte: Number(p.monto_reembolso) || 0,
      lote_codigo: lote.codigo,
      medio_pago: p.metodo_pago === 'Efectivo_Sede' ? 'Efectivo' : 'Transferencia',
      pago_referencia: p.codigo_reserva,
      entregado_por: opts.entregadoPor ?? null,
      recibo_numero: opts.reciboNumero ?? null,
      notas: `Retiro de la reserva ${p.codigo_reserva}.`,
    },
    asiento: {
      fecha: hoy,
      tipo: 'ingreso',
      concepto: 'Reembolso de costos operativos',
      detalle: `Reserva ${p.codigo_reserva} · lote ${lote.codigo} · ${p.gramos} g`,
      monto: Number(p.monto_reembolso) || 0,
      medio: p.metodo_pago === 'Efectivo_Sede' ? 'Efectivo' : 'Transferencia',
    },
  }
}
