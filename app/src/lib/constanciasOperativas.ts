// Constancias que salen de lo que ya está cargado, no de lo que alguien tipea.
//
// Las plantillas institucionales de `documentosInstitucionales.ts` son
// instrumentos jurídicos: alguien completa nombres y fechas. Estas son otra
// cosa — son la FOTO de un dato que la app ya tiene y que en una inspección hay
// que poder mostrar en papel:
//
//   cuántas plantas ampara el REPROCANN y de quiénes
//   quiénes son los vinculados
//   qué se entregó en el período
//   qué respalda cada gasto
//
// Nadie las escribe: se emiten. Por eso no llevan campos a completar; llevan
// `faltantes` cuando el dato de origen está incompleto, que es distinto: avisan
// que la constancia sale coja, no que falte tipear.

import type { Entidad } from './ong'
import type { DocumentoGenerado } from './documentosLegales'
import { fechaEnLetras } from './actaTexto'

const FALTA = (q: string) => `[${q}]`
const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

function cabecera(e: Entidad | null): string {
  return [
    e?.razon_social || FALTA('razón social'),
    e?.cuit ? `CUIT: ${e.cuit}` : FALTA('CUIT'),
    e?.sede_domicilio || FALTA('domicilio de la sede'),
  ].join('\n')
}

function pie(e: Entidad | null): string[] {
  return [
    '',
    `Emitida en ${e?.sede_domicilio ? e.sede_domicilio.split(',').pop()?.trim() : FALTA('localidad')}, ` +
      `a los ${fechaEnLetras(new Date().toLocaleDateString('en-CA'))}.`,
    '',
    '',
    '_______________________________',
    'Firma y sello',
    FALTA('nombre y cargo de quien firma'),
  ]
}

export interface PacienteConstancia {
  codigo?: string | null
  nombre_completo: string
  dni?: string | null
  reprocann_nro?: string | null
  reprocann_estado?: string | null
  plantas_habilitadas?: number | null
  m2_habilitados?: number | null
  activo?: boolean
}

/**
 * Constancia de cupo REPROCANN.
 *
 * Responde la pregunta que hace una inspección: bajo qué permisos cultiva esta
 * asociación. El cultivo no tiene cupo propio — tiene la suma de lo que aportó
 * cada persona vinculada, y por eso la constancia los lista uno por uno con su
 * número. Un total sin el detalle no se puede verificar.
 */
export function constanciaCupo(
  padron: PacienteConstancia[], e: Entidad | null,
): DocumentoGenerado {
  const activos = padron.filter(p => p.activo !== false)
  const conNro = activos.filter(p => p.reprocann_nro && String(p.reprocann_nro).trim())
  const plantas = conNro.reduce((s, p) => s + (Number(p.plantas_habilitadas) || 0), 0)
  const m2 = conNro.reduce((s, p) => s + (Number(p.m2_habilitados) || 0), 0)

  const f: string[] = []
  if (!e?.cuit) f.push('el CUIT de la entidad')
  if (conNro.length === 0) f.push('al menos una persona con número de REPROCANN')
  const sinPlantas = conNro.filter(p => !(Number(p.plantas_habilitadas) > 0)).length
  if (sinPlantas > 0) f.push(`las plantas habilitadas de ${sinPlantas} persona(s)`)
  if (m2 === 0) f.push('los metros cuadrados habilitados (ninguna persona los tiene cargados)')

  const L = [
    cabecera(e),
    '',
    'CONSTANCIA DE CUPO REPROCANN',
    '',
    'La entidad deja constancia de que el cultivo que desarrolla se ampara en los',
    'permisos individuales del Registro del Programa de Cannabis (REPROCANN) que',
    'aportan las personas vinculadas que se detallan, conforme la Resolución',
    '1780/2025 y concordantes.',
    '',
    `Personas vinculadas activas: ${activos.length}`,
    `Con número de REPROCANN: ${conNro.length}`,
    `Plantas en floración amparadas: ${plantas}`,
    `Superficie amparada: ${m2 > 0 ? `${m2} m²` : FALTA('m² habilitados')}`,
    '',
    'DETALLE POR PERSONA',
    '',
  ]
  for (const p of conNro) {
    L.push([
      (p.codigo ?? '').padEnd(9),
      p.nombre_completo,
      p.dni ? `DNI ${p.dni}` : FALTA('DNI'),
      `REPROCANN ${p.reprocann_nro}`,
      `${Number(p.plantas_habilitadas) || 0} plantas`,
    ].join(' · '))
  }
  // Las que no tienen número se nombran igual: omitirlas haría parecer que el
  // padrón es más chico y más prolijo de lo que es.
  const sinNro = activos.length - conNro.length
  if (sinNro > 0) {
    L.push('')
    L.push(`Hay además ${sinNro} persona(s) vinculada(s) sin número de REPROCANN,`)
    L.push('que no aportan cupo y cuyas entregas se registran fuera del amparo.')
  }
  L.push(...pie(e))
  return { titulo: 'Constancia de cupo REPROCANN', texto: L.join('\n'), faltantes: f }
}

/**
 * Padrón de personas vinculadas.
 *
 * Es el listado que se presenta cuando piden "quiénes son". Va con DNI porque
 * sin documento no identifica a nadie, y marca a quién le falta.
 */
export function padronVinculados(
  padron: PacienteConstancia[], e: Entidad | null,
): DocumentoGenerado {
  const activos = padron.filter(p => p.activo !== false)
  const sinDni = activos.filter(p => !(p.dni && String(p.dni).trim())).length

  const f: string[] = []
  if (!e?.cuit) f.push('el CUIT de la entidad')
  if (sinDni > 0) f.push(`el DNI de ${sinDni} persona(s)`)

  const L = [
    cabecera(e),
    '',
    'PADRÓN DE PERSONAS VINCULADAS',
    '',
    `Total de personas vinculadas activas: ${activos.length}`,
    `Con documento registrado: ${activos.length - sinDni}`,
    '',
  ]
  for (const p of activos) {
    L.push([
      (p.codigo ?? '').padEnd(9),
      p.nombre_completo,
      p.dni ? `DNI ${p.dni}` : FALTA('DNI'),
      p.reprocann_nro ? `REPROCANN ${p.reprocann_nro}` : (p.reprocann_estado ?? 'sin registro'),
    ].join(' · '))
  }
  L.push(...pie(e))
  return { titulo: 'Padrón de personas vinculadas', texto: L.join('\n'), faltantes: f }
}

export interface DispensaConstancia {
  fecha: string
  gramos?: number | null
  unidad?: string | null
  aporte?: number | null
  producto?: string | null
  lote_codigo?: string | null
  modalidad?: string | null
}

/**
 * Registro de entregas de un período.
 *
 * El equivalente en papel de la pestaña Dispensas. Separa lo entregado a
 * personas de lo que salió por consumo interno, merma o saldo inicial: sumarlos
 * daría un total de material que no fue a nadie.
 */
export function registroEntregas(
  dispensas: DispensaConstancia[], desde: string, hasta: string, e: Entidad | null,
): DocumentoGenerado {
  const enRango = dispensas
    .filter(d => d.fecha && (!desde || d.fecha >= desde) && (!hasta || d.fecha <= hasta))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const aPersonas = enRango.filter(d => (d.modalidad ?? 'Paciente') === 'Paciente')
  const otras = enRango.filter(d => (d.modalidad ?? 'Paciente') !== 'Paciente')
  const enGramos = (ds: DispensaConstancia[]) =>
    ds.filter(d => (d.unidad ?? 'g') === 'g').reduce((s, d) => s + (Number(d.gramos) || 0), 0)
  const aporte = aPersonas.reduce((s, d) => s + (Number(d.aporte) || 0), 0)
  const sinCantidad = enRango.filter(
    d => (Number(d.aporte) || 0) > 0 && !((Number(d.gramos) || 0) > 0)).length

  const f: string[] = []
  if (!e?.cuit) f.push('el CUIT de la entidad')
  if (enRango.length === 0) f.push('entregas en el período elegido')
  // Es lo que hace que el registro no cierre: sale material y el papel dice 0.
  if (sinCantidad > 0) {
    f.push(`la cantidad de ${sinCantidad} entrega(s) que tienen aporte cobrado y cantidad en cero`)
  }

  const L = [
    cabecera(e),
    '',
    'REGISTRO DE ENTREGAS',
    `Período: ${desde || FALTA('desde')} al ${hasta || FALTA('hasta')}`,
    '',
    `Entregas a personas vinculadas: ${aPersonas.length} · ${Math.round(enGramos(aPersonas))} g`,
    `Aportes recibidos: ${pesos(aporte)}`,
    otras.length > 0
      ? `Otros movimientos (consumo interno, merma, saldo inicial): ${otras.length} · ${Math.round(enGramos(otras))} g`
      : 'Sin movimientos de consumo interno ni merma en el período.',
    '',
    'DETALLE',
    '',
  ]
  for (const d of aPersonas) {
    L.push([
      d.fecha,
      `${Number(d.gramos) || 0} ${d.unidad ?? 'g'}`.padStart(7),
      d.producto ?? FALTA('producto'),
      d.lote_codigo ? `lote ${d.lote_codigo}` : FALTA('lote'),
      pesos(Number(d.aporte) || 0),
    ].join(' · '))
  }
  L.push(...pie(e))
  return { titulo: 'Registro de entregas', texto: L.join('\n'), faltantes: f }
}

export interface AsientoConstancia {
  fecha: string
  tipo: string
  concepto?: string | null
  detalle?: string | null
  monto?: number | null
  medio?: string | null
}

/**
 * Registro de caja de un periodo: el respaldo de los movimientos de plata.
 *
 * POR QUE HACE FALTA
 * Los 1.690 asientos de caja no estan vinculados a NINGUN comprobante:
 * `documento_id` y `dispensa_id` estan en cero en los 1.690. Los 701 gastos si
 * tienen su registro en `ong_documentos`, pero ninguno tiene archivo adjunto y
 * ninguno esta ligado a su asiento.
 *
 * O sea: la plata se movio y no hay papel que lo acompanie. Este documento es
 * ese papel — el libro de caja del mes, con cada movimiento y sus totales.
 *
 * Separa por MEDIO ademas de por tipo: un arqueo se hace contra el efectivo que
 * hay en la caja, no contra el total, y mezclarlos hace que no cierre nunca.
 */
export function registroCaja(
  asientos: AsientoConstancia[], desde: string, hasta: string, e: Entidad | null,
): DocumentoGenerado {
  const enRango = asientos
    .filter(a => a.fecha && (!desde || a.fecha >= desde) && (!hasta || a.fecha <= hasta))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const suma = (t: string, medio?: string) => enRango
    .filter(a => a.tipo === t && (!medio || (a.medio ?? '') === medio))
    .reduce((s, a) => s + (Number(a.monto) || 0), 0)
  const entro = suma('ingreso'), salio = suma('egreso')

  const f: string[] = []
  if (!e?.cuit) f.push('el CUIT de la entidad')
  if (enRango.length === 0) f.push('movimientos en el período elegido')
  const sinMedio = enRango.filter(a => !(a.medio && String(a.medio).trim())).length
  if (sinMedio > 0) f.push(`el medio de pago de ${sinMedio} movimiento(s)`)

  const L = [
    cabecera(e),
    '',
    'REGISTRO DE CAJA',
    `Período: ${desde || FALTA('desde')} al ${hasta || FALTA('hasta')}`,
    '',
    `Movimientos: ${enRango.length}`,
    `Entró:  ${pesos(entro)}   (efectivo ${pesos(suma('ingreso', 'Efectivo'))} · transferencia ${pesos(suma('ingreso', 'Transferencia'))})`,
    `Salió:  ${pesos(salio)}   (efectivo ${pesos(suma('egreso', 'Efectivo'))} · transferencia ${pesos(suma('egreso', 'Transferencia'))})`,
    `Resultado del período: ${entro - salio >= 0 ? '+' : '−'}${pesos(Math.abs(entro - salio))}`,
    '',
    'DETALLE',
    '',
  ]
  for (const a of enRango) {
    L.push([
      a.fecha,
      (a.tipo === 'ingreso' ? 'ENTRA' : 'SALE ').padEnd(5),
      pesos(Number(a.monto) || 0).padStart(12),
      (a.medio || FALTA('medio')).padEnd(14),
      a.concepto ?? '',
      a.detalle ? `· ${a.detalle}` : '',
    ].join(' ').trimEnd())
  }
  L.push(...pie(e))
  return { titulo: 'Registro de caja', texto: L.join('\n'), faltantes: f }
}

export interface DDJJConstancia {
  periodo: string
  fecha_presentacion?: string | null
  plantas_total?: number | null
  plantas_floracion?: number | null
  pacientes_vinculados?: number | null
  variedades?: string | null
  presentada?: boolean
  notas?: string | null
}

/**
 * Declaracion jurada semestral de la Resolucion 1780/2025.
 *
 * Es el papel que faltaba: la app ya guardaba la DDJJ —y la prellenaba con lo
 * que sabe del cultivo— pero no habia forma de imprimirla para presentarla.
 *
 * POR QUE SE IMPRIME LO GUARDADO Y NO SE RECALCULA
 * Una DDJJ presentada es una FOTO del cultivo en ese momento. Si el documento
 * recalculara al vuelo, reimprimir la declaracion de hace un anio mostraria las
 * plantas de hoy y ya no seria lo que se presento. Se declara lo declarado.
 *
 * La firma el RESPONSABLE TECNICO, que es quien responde por el cultivo ante la
 * autoridad — no el presidente. Si no esta designado, sale entre corchetes: una
 * DDJJ sin responsable tecnico identificado no se puede presentar.
 */
export function ddjjSemestral(
  d: DDJJConstancia, e: Entidad | null, responsableTecnico?: string | null,
): DocumentoGenerado {
  const f: string[] = []
  if (!e?.cuit) f.push('el CUIT de la entidad')
  if (!responsableTecnico) f.push('el responsable técnico que firma la declaración')
  if (d.plantas_total == null) f.push('el total de plantas')
  if (d.plantas_floracion == null) f.push('las plantas en floración')
  if (d.pacientes_vinculados == null) f.push('los pacientes vinculados')
  if (!d.variedades) f.push('las variedades en cultivo')

  const [anio, sem] = d.periodo.split('-S')
  const cierre = sem === '1' ? `30 de junio de ${anio}` : `31 de diciembre de ${anio}`
  const n = (v: number | null | undefined, q: string) =>
    v == null ? FALTA(q) : String(v)

  const L = [
    cabecera(e),
    '',
    'DECLARACIÓN JURADA SEMESTRAL',
    'Resolución 1780/2025 — Programa de Cannabis (REPROCANN)',
    '',
    `Período declarado: ${d.periodo}  (cierre al ${cierre})`,
    d.fecha_presentacion
      ? `Presentada el ${fechaEnLetras(d.fecha_presentacion)}`
      : 'SIN PRESENTAR',
    '',
    'La entidad declara bajo juramento que, al cierre del período indicado, el',
    'cultivo que desarrolla presenta la siguiente situación:',
    '',
    `  Plantas en cultivo (total):        ${n(d.plantas_total, 'plantas total')}`,
    `  Plantas en floración:              ${n(d.plantas_floracion, 'plantas en floración')}`,
    `  Personas vinculadas:               ${n(d.pacientes_vinculados, 'pacientes vinculados')}`,
    '',
    '  Variedades en cultivo:',
    `    ${d.variedades || FALTA('variedades')}`,
  ]
  // Las plantas en floracion son las que cuentan contra el cupo del REPROCANN:
  // decirlo en el documento evita que alguien lea el total como si fuera el
  // numero regulado.
  if (d.plantas_floracion != null) {
    L.push('')
    L.push('  Las plantas en floración son las que se imputan al cupo aportado por')
    L.push('  las personas vinculadas, conforme el régimen del REPROCANN.')
  }
  if (d.notas) {
    L.push('')
    L.push('OBSERVACIONES')
    L.push(`  ${d.notas}`)
  }
  L.push('')
  L.push('El firmante declara que los datos consignados son exactos y se ajustan a')
  L.push('los registros de producción, guarda y movimientos internos que lleva la')
  L.push('entidad, los que quedan a disposición de la autoridad de aplicación.')
  L.push('')
  L.push(`Emitida en ${e?.sede_domicilio ? e.sede_domicilio.split(',').pop()?.trim() : FALTA('localidad')}, a los ${fechaEnLetras(new Date().toLocaleDateString('en-CA'))}.`)
  L.push('')
  L.push('')
  L.push('_______________________________')
  L.push(responsableTecnico || FALTA('nombre del responsable técnico'))
  L.push('Responsable técnico')
  return { titulo: `DDJJ semestral ${d.periodo}`, texto: L.join('\n'), faltantes: f }
}
