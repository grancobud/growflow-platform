// Generación de los documentos legales del pack de plantillas (SRS v3.2).
//
// La app ya tiene los datos: entidad, asociados, pacientes, dispensas,
// traslados. Lo que faltaba era el texto. Mismo criterio que el acta: lo que no
// está cargado se marca entre corchetes, nunca se inventa.
//
// El punto de todo esto es sostener UNA distinción jurídica: la entrega no es
// una compraventa. Es el cumplimiento de un mandato que el paciente le dio a la
// ONG para cultivar por su cuenta, y el dinero que entrega es el reembolso de
// los costos de esa gestión. Por eso el término correcto es "Reembolso de
// Costos Operativos" y no "precio", "venta" ni "aporte" a secas — y por eso la
// leyenda del recibo va completa y sin editar.

import type { Entidad, Asociado, Dispensa, Traslado } from './ong'
import type { Paciente } from './registro'
import { fechaEnLetras, pesosEnLetras } from './actaTexto'

// La linea cuyo dato no esta NO SE IMPRIME.
//
// Antes salia «[CUIT]» o «[N° REPROCANN]» dentro del papel. Los corchetes son
// una nota para quien lo esta cargando, no para quien recibe el documento: ahi
// gritan que algo quedo sin hacer, y quedan archivados asi para siempre, porque
// un documento emitido se congela —el texto se guarda para reabrirlo tal cual
// salio—.
//
// El faltante NO se pierde: se sigue juntando en `faltantes`, que es lo que la
// pantalla usa para avisarle al operador ANTES de emitir. Se omite en el papel
// y se avisa en la pantalla.
//
// Se OMITE, no se inventa. Un recibo sin la linea del CUIT esta incompleto; uno
// con un CUIT que no es el de la entidad dice algo falso, y eso queda archivado
// en la base real mezclado con los datos genuinos.
const AUSENTE = '\u0000'
const FALTA = (que: string) => AUSENTE + que

/**
 * Arma el texto salteando las lineas que dependen de un dato que no esta.
 *
 * Y se come el blanco que esas lineas dejan ARRIBA DE TODO: cuando falta la
 * entidad la cabecera entera desaparece y el papel arrancaba con dos lineas
 * vacias, que se ven como un margen raro y delatan que ahi faltaba algo.
 */
const sinHuecos = (lineas: string[]) =>
  lineas.filter(l => !l.includes(AUSENTE)).join('\n').replace(/^\n+/, '')
const fmtPesos = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

/**
 * La leyenda que va al pie de todo recibo por reembolso. Va textual: es lo que
 * distingue el comprobante de una factura de venta, y recortarla le saca
 * justamente el efecto que tiene que tener.
 */
export const LEYENDA_REEMBOLSO =
  'El presente comprobante acredita la recepción del aporte dinerario en concepto de ' +
  '"Reembolso de Costos Operativos", destinado al sostenimiento de la infraestructura ' +
  'institucional y procesos productivos asociados. Esta entrega no constituye una operación ' +
  'de compraventa comercial, sino el cumplimiento del "Mandato de Gestión Operativa Especial" ' +
  'suscripto previamente por el asociado/paciente mandante, en estricto amparo de la Ley ' +
  'Nacional N° 27.350, el Decreto Reglamentario N° 883/2020 y la Resolución Ministerial ' +
  'N° 1780/2025. El material fito-médico detallado es intransferible y de uso terapéutico ' +
  'exclusivo.'

export interface DocumentoGenerado {
  titulo: string
  texto: string
  /** Lo que falta cargar para que salga completo. */
  faltantes: string[]
}

function cabeceraEntidad(e: Entidad | null): string {
  return sinHuecos([
    e?.razon_social || FALTA('razón social'),
    e?.cuit ? `CUIT: ${e.cuit}` : FALTA('CUIT'),
    e?.sede_domicilio || FALTA('domicilio de la sede'),
  ])
}

// ---------------------------------------------------------------------------
// 1. Recibo oficial por reembolso de costos operativos
// ---------------------------------------------------------------------------

export function reciboReembolso(
  d: Dispensa, e: Entidad | null, pac: Paciente | null, aso: Asociado | null,
): DocumentoGenerado {
  const f: string[] = []
  if (!e?.cuit) f.push('el CUIT de la entidad')
  if (!d.recibo_numero) f.push('el número de recibo')
  if (d.aporte == null) f.push('el importe del reembolso')
  if (!pac) f.push('a qué paciente corresponde')
  if (!d.lote_codigo) f.push('el lote del material')
  if (aso && aso.mandato_aceptado === false) f.push('la firma del mandato del asociado')

  const L = [
    cabeceraEntidad(e),
    '',
    `RECIBO OFICIAL NO COMERCIAL N° ${d.recibo_numero ?? FALTA('número')}`,
    `Fecha: ${fechaEnLetras(d.fecha)}`,
    '',
    `ASOCIADO APORTANTE: ${pac?.nombre_completo ?? FALTA('paciente')}` +
      (pac?.dni ? ` (DNI ${pac.dni})` : '') +
      (aso?.legajo ? `  |  Legajo: ${aso.legajo}` : ''),
    `REPROCANN: ${pac?.reprocann_nro ?? FALTA('N° REPROCANN')}`,
    '',
    'CONCEPTO: Aporte por Reembolso de Costos Operativos.',
    'Reintegro de costos directos e indirectos de cultivo, insumos, energía y análisis de',
    'laboratorio. Sin fin de lucro — Ley 27.350.',
    '',
    `Lote asignado: ${d.lote_codigo ?? FALTA('lote')}`,
    `Cantidad entregada: ${d.gramos} g`,
    `Importe abonado: ${d.aporte != null ? fmtPesos(d.aporte) : FALTA('importe')}`,
    // El importe en letras al lado del número. Es lo que impide que a un
    // "$XXX.XXX" ya firmado alguien le agregue un cero. El pack de plantillas
    // lo pide como {{monto_en_letras}} y no hacía falta ningún dato nuevo:
    // salía del importe que ya estaba.
    `Son: ${d.aporte != null ? pesosEnLetras(d.aporte).toUpperCase() : FALTA('importe en letras')}`,
    `Medio de pago: ${d.medio_pago ?? FALTA('medio de pago')}` +
      (d.pago_referencia ? ` (${d.pago_referencia})` : ''),
    '',
    '_______________________________',
    'Tesorería / Dispensario',
    '',
    '---',
    LEYENDA_REEMBOLSO,
  ]
  return { titulo: `Recibo N° ${d.recibo_numero ?? '—'}`, texto: sinHuecos(L), faltantes: f }
}

// ---------------------------------------------------------------------------
// 1b. Comprobante de dispensación
// ---------------------------------------------------------------------------

/**
 * Lo que se le entrega al paciente. El recibo documenta la plata; este documenta
 * la ENTREGA: qué variedad, de qué lote, y cuánto cupo le queda en la ventana de
 * 30 días.
 *
 * El SRS lo especifica con un QR de trazabilidad. Va el identificador en texto:
 * un QR que no apunte a un sistema de verificación real sería decorativo, y en
 * un comprobante legal eso es peor que no ponerlo.
 */
export function comprobanteDispensacion(
  d: Dispensa, e: Entidad | null, pac: Paciente | null,
  cupo: { conNueva: number; tope: number | null; remanente: number | null } | null,
  genetica?: string | null,
): DocumentoGenerado {
  const f: string[] = []
  if (!pac) f.push('a qué paciente corresponde')
  if (!d.lote_codigo) f.push('el lote del material')
  // La variedad sale de la genética VINCULADA, pero si no hay ninguna cae al
  // nombre del producto — que es donde de hecho está.
  //
  // En la asociación las 1.241 dispensas tienen `genetica_id` en null y `producto` con
  // el nombre de la cepa: Cookies, Shuga, Legendary, Purple Lemon. El
  // comprobante mostraba `[variedad]` teniendo el dato al lado, en 1.241
  // documentos. La tabla `geneticas` tiene una sola fila y es lo que están
  // cultivando ahora, no lo que se entregó.
  //
  // No es inventar: es leer lo que se registró al momento de la entrega.
  const variedad = genetica ?? (d.producto?.trim() || null)
  if (!variedad) f.push('la variedad entregada')
  if (!cupo?.tope) f.push('el tope mensual del paciente, para poder informar el remanente')

  const L = [
    'COMPROBANTE DE DISPENSACIÓN TERAPÉUTICA',
    '',
    cabeceraEntidad(e),
    '',
    `ID de dispensación: ${d.id}`,
    `Fecha: ${fechaEnLetras(d.fecha)}`,
    '',
    `PACIENTE: ${pac?.nombre_completo ?? FALTA('paciente')}` + (pac?.dni ? `  |  DNI: ${pac.dni}` : ''),
    `REPROCANN: ${pac?.reprocann_nro ?? FALTA('N° REPROCANN')}`,
    '',
    'DETALLE DE LA ENTREGA:',
    `  Variedad: ${variedad ?? FALTA('variedad')}`,
    `  Presentación: ${d.producto ?? 'flor'}`,
    `  Lote: ${d.lote_codigo ?? FALTA('lote')}`,
    `  Cantidad: ${d.gramos} g`,
    '',
    'CUPO EN VENTANA MÓVIL DE 30 DÍAS:',
    cupo?.tope != null
      ? `  Consumido ${Math.round(cupo.conNueva)} g de ${cupo.tope} g  ·  ` +
        `Remanente ${Math.round(cupo.remanente ?? 0)} g`
      : `  ${FALTA('sin tope cargado no se puede informar el remanente')}`,
    '',
    'Material fito-médico intransferible, de uso terapéutico exclusivo.',
    '',
    '',
    '_______________________________        _______________________________',
    'Firma del paciente                     Operador',
    '',
    '---',
    LEYENDA_REEMBOLSO,
  ]
  return { titulo: `Comprobante de dispensación · ${d.fecha}`, texto: sinHuecos(L), faltantes: f }
}

// ---------------------------------------------------------------------------
// 2. Guía de tránsito interno (entre predios de la propia ONG)
// ---------------------------------------------------------------------------

export function guiaTransitoInterno(t: Traslado, e: Entidad | null): DocumentoGenerado {
  const f: string[] = []
  if (!t.origen) f.push('el predio de origen')
  if (!t.destino) f.push('el predio de destino')
  if (!t.transportista) f.push('el conductor autorizado')
  if (!e?.cuit) f.push('el CUIT de la entidad')
  // Sin el lote la guía no sirve para lo único para lo que existe: si una
  // inspección pregunta de dónde salió el material que está en la sede, con
  // "40 g de flores" no se sigue a ningún lado.
  if (!t.lotes) f.push('qué lote se trasladó')

  const L = [
    'GUÍA DE TRÁNSITO INTERNO DE MATERIAL VEGETAL',
    '',
    cabeceraEntidad(e),
    '',
    `Fecha de emisión: ${fechaEnLetras(t.fecha)}`,
    `Conductor autorizado: ${t.transportista ?? FALTA('conductor')}` +
      (t.transportista_dni ? `  |  DNI: ${t.transportista_dni}` : ''),
    '',
    `ORIGEN:  ${t.origen ?? FALTA('origen')}`,
    `DESTINO: ${t.destino ?? FALTA('destino')}`,
    t.ruta ? `RUTA:    ${t.ruta}` : '',
    [t.hora_salida && `Salida: ${t.hora_salida}`, t.hora_llegada && `Llegada: ${t.hora_llegada}`]
      .filter(Boolean).join('  |  '),
    '',
    'DETALLE DEL MATERIAL TRANSPORTADO:',
    `  Tipo: ${t.tipo_material ?? 'flores'}  |  Cantidad: ${t.cantidad ?? FALTA('cantidad')}`,
    `  Lotes: ${t.lotes ?? FALTA('lotes trasladados')}`,
    '',
    'MOTIVO OPERATIVO: Traslado técnico inter-sedes para redistribución de etapas de',
    'desarrollo biológico, secado o procesamiento fitoterapéutico según protocolo interno',
    'bajo Ley Nacional N° 27.350 y Res. Min. N° 1780/2025. Ambos predios forman parte de la',
    'infraestructura habilitada de la institución.',
    '',
    '',
    '_______________________________        _______________________________',
    'Presidente                             Secretario / Responsable Técnico',
  ].filter(l => l !== '')
  return { titulo: `Guía de tránsito ${t.fecha}`, texto: sinHuecos(L), faltantes: f }
}

// ---------------------------------------------------------------------------
// 3. Declaración jurada de transporte al domicilio del paciente
// ---------------------------------------------------------------------------

export function ddjjTransporteDomicilio(
  t: Traslado, e: Entidad | null, pac: Paciente | null, aso?: Asociado | null,
): DocumentoGenerado {
  const f: string[] = []
  if (!pac) f.push('a qué paciente se le entrega')
  if (!pac?.domicilio) f.push('el domicilio de entrega')
  if (!t.transportista) f.push('el transportista')
  if (!e?.cuit) f.push('el CUIT de la entidad')
  if (!t.lotes) f.push('el lote de origen del material')

  const L = [
    'DECLARACIÓN JURADA DE TRANSPORTE',
    '(Art. 8 Ley 27.350 / Decreto 883/2020)',
    '',
    `REMITENTE: ${e?.razon_social ?? FALTA('razón social')} (CUIT ${e?.cuit ?? FALTA('CUIT')})`,
    `Domicilio de despacho: ${t.origen || e?.sede_domicilio || FALTA('domicilio')}`,
    '',
    // El legajo lo pide el pack de plantillas y estaba cargado en los 211
    // asociados sin que ningún documento lo usara. Es lo que permite encontrar
    // a la persona en el Libro de Asociados: el nombre se repite, el legajo no.
    `DESTINATARIO (PACIENTE): ${pac?.nombre_completo ?? FALTA('paciente')}` +
      (pac?.dni ? `  |  DNI: ${pac.dni}` : '') +
      (aso?.legajo ? `  |  Legajo: ${aso.legajo}` : ''),
    `Código REPROCANN: ${pac?.reprocann_nro ?? FALTA('N° REPROCANN')}`,
    `Domicilio de entrega: ${t.destino || pac?.domicilio || FALTA('domicilio de entrega')}`,
    '',
    'DETALLE DE LA CARGA:',
    `  Producto: CANNABIS SATIVA L. (${t.tipo_material ?? 'flores'})`,
    `  Cantidad: ${t.cantidad ?? FALTA('cantidad')}`,
    `  Lote de origen: ${t.lotes ?? FALTA('lote de origen')}`,
    '  Uso: EXCLUSIVO MEDICINAL / TERAPÉUTICO (Art. 8 Ley 27.350)',
    '',
    `TRANSPORTE: ${t.transportista ?? FALTA('transportista')}` +
      (t.transportista_dni ? ` (DNI ${t.transportista_dni})` : ''),
    t.ruta ? `Recorrido: ${t.ruta}` : '',
    '',
    '',
    '_______________________________',
    `Firma del remitente        Fecha: ${fechaEnLetras(t.fecha)}`,
  ].filter(l => l !== '')
  return { titulo: `DDJJ de transporte ${t.fecha}`, texto: sinHuecos(L), faltantes: f }
}

// ---------------------------------------------------------------------------
// 4. Declaración jurada de vinculación exclusiva y mandato operativo
// ---------------------------------------------------------------------------

export function ddjjMandato(
  aso: Asociado, e: Entidad | null, pac: Paciente | null,
): DocumentoGenerado {
  const f: string[] = []
  if (!pac) f.push('vincular el asociado con su ficha de paciente')
  if (!pac?.dni && !aso.dni) f.push('el DNI')
  if (!pac?.reprocann_nro) f.push('el N° de REPROCANN')
  if (!e?.cuit) f.push('el CUIT de la entidad')

  const hoy = aso.mandato_fecha || new Date().toISOString().slice(0, 10)
  const dni = pac?.dni || aso.dni
  const L = [
    'DECLARACIÓN JURADA DE VINCULACIÓN EXCLUSIVA',
    'Y MANDATO DE GESTIÓN OPERATIVA ESPECIAL',
    '',
    `En ${pac?.localidad || e?.sede_localidad || FALTA('ciudad')}, ` +
      `${pac?.provincia || e?.sede_provincia ? `Provincia de ${pac?.provincia || e?.sede_provincia}, ` : ''}` +
      `a los ${fechaEnLetras(hoy)}, comparece ${pac?.nombre_completo || aso.nombre}, ` +
      `DNI N° ${dni ?? FALTA('DNI')}, domiciliado en ${pac?.domicilio ?? FALTA('domicilio')}, ` +
      `inscripto en REPROCANN bajo N° ${pac?.reprocann_nro ?? FALTA('N° REPROCANN')}, y declara:`,
    '',
    `PRIMERA (MANDATO). Otorga Mandato de Gestión Operativa Especial a favor de ` +
      `${e?.razon_social ?? FALTA('razón social')} (CUIT ${e?.cuit ?? FALTA('CUIT')}), para que ` +
      `ejecute por su cuenta las tareas de cultivo, cosecha y fraccionamiento destinadas a su ` +
      `tratamiento terapéutico, con vinculación exclusiva.`,
    '',
    'SEGUNDA (SOSTENIMIENTO). Reconoce que la entrega fitoterapéutica no es comercial ni',
    'reviste compraventa, comprometiéndose al reembolso de los costos operativos necesarios',
    'para el sostén de la infraestructura común (Ley 27.350).',
    '',
    'TERCERA (EXCLUSIVIDAD). Declara no estar vinculado simultáneamente a otra persona',
    'jurídica ni a un tercero cultivador para el mismo fin, y renuncia a inscribirse como',
    'autocultivador mientras rija el presente mandato.',
    '',
    '',
    '___________________________________________________',
    `Firma del paciente mandante — ${pac?.nombre_completo || aso.nombre}` +
      (dni ? ` (DNI ${dni})` : ''),
  ]
  return { titulo: `Mandato de ${aso.nombre}`, texto: sinHuecos(L), faltantes: f }
}
