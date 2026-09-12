// Documentos institucionales: los instrumentos jurídicos que la Resolución
// 1780/2025 lista como parte del pilar administrativo y del fito-médico, y que
// hasta ahora en la app existían sólo como un tilde en la lista de requisitos.
//
// Un tilde dice "lo tengo". Estos son el documento en sí.

import type { Entidad } from './ong'
import { fechaEnLetras } from './actaTexto'
import type { DocumentoGenerado } from './documentosLegales'

const FALTA = (q: string) => `[${q}]`

function cabecera(e: Entidad | null): string {
  return [
    e?.razon_social || FALTA('razón social'),
    e?.cuit ? `CUIT: ${e.cuit}` : FALTA('CUIT'),
    e?.sede_domicilio || FALTA('domicilio de la sede'),
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Designaciones: Director Médico y Responsable Técnico
// ---------------------------------------------------------------------------

export interface DatosDesignacion {
  nombre?: string
  matricula?: string
  titulo?: string
  actaNumero?: number
  actaFecha?: string
}

/**
 * La 1780 exige designar un Director Médico (registrado en REFEPS) y un
 * Responsable Técnico. La designación es un acto de la Comisión Directiva, así
 * que el documento se redacta como constancia de ese acto y remite al acta:
 * una constancia que no puede señalar dónde se resolvió no prueba nada.
 */
export function designacion(
  rol: 'director_medico' | 'responsable_tecnico',
  d: DatosDesignacion,
  e: Entidad | null,
): DocumentoGenerado {
  const esMedico = rol === 'director_medico'
  const f: string[] = []
  if (!d.nombre) f.push('el nombre de la persona designada')
  if (esMedico && !d.matricula) f.push('la matrícula y el registro REFEPS')
  if (!esMedico && !d.titulo) f.push('el título o la acreditación técnica')
  if (!d.actaNumero) f.push('el acta de Comisión Directiva que lo designó')
  if (!e?.cuit) f.push('el CUIT de la entidad')

  const L = [
    esMedico
      ? 'CONSTANCIA DE DESIGNACIÓN DE DIRECTOR MÉDICO'
      : 'CONSTANCIA DE DESIGNACIÓN DE RESPONSABLE TÉCNICO',
    '',
    cabecera(e),
    '',
    `Se hace constar que ${e?.razon_social ?? FALTA('razón social')}, en cumplimiento de lo ` +
      'dispuesto por la Resolución Ministerial N° 1780/2025, ha designado a ' +
      `${d.nombre ?? FALTA('nombre')} en el cargo de ` +
      `${esMedico ? 'Director Médico' : 'Responsable Técnico'} de la institución.`,
    '',
    esMedico
      ? `Matrícula profesional: ${d.matricula ?? FALTA('matrícula')}. Inscripto en la Red Federal de ` +
        'Registros de Profesionales de la Salud (REFEPS), con formación académica específica ' +
        'acreditada en investigación o tratamiento con cannabis medicinal.'
      : `Acreditación: ${d.titulo ?? FALTA('título o acreditación')}. Profesional en producción ` +
        'agrícola o investigación vegetal, con conocimiento de la normativa aplicable.',
    '',
    esMedico
      ? 'OBLIGACIONES. Presentar la declaración jurada semestral con los procedimientos ' +
        'terapéuticos, dosis, concentración de cannabinoides, frecuencia, ratio, evolución y ' +
        'beneficios del tratamiento de los usuarios vinculados.'
      : 'OBLIGACIONES. Elaborar el plan de cultivo en carácter de declaración jurada y registrar ' +
        'los procedimientos de producción, guarda y movimientos internos del material vegetal.',
    '',
    d.actaNumero
      ? `Designación resuelta por Acta de Comisión Directiva N° ${d.actaNumero}` +
        (d.actaFecha ? ` del ${fechaEnLetras(d.actaFecha)}` : '') + '.'
      : `Designación resuelta por ${FALTA('acta de Comisión Directiva')}.`,
    '',
    '',
    '_______________________________        _______________________________',
    'Presidente                             Persona designada',
  ]
  return {
    titulo: esMedico ? 'Designación de Director Médico' : 'Designación de Responsable Técnico',
    texto: L.join('\n'),
    faltantes: f,
  }
}

// ---------------------------------------------------------------------------
// Comodato de inmueble
// ---------------------------------------------------------------------------

export interface DatosComodato {
  comodante?: string
  comodanteDni?: string
  direccion?: string
  localidad?: string
  meses?: number
  desde?: string
}

/**
 * El comodato acredita que la ONG puede usar un inmueble sin ser propietaria.
 * Hace falta para dos cosas distintas: la sede social —que ARCA pide para dar
 * la exención de ganancias— y cada predio de cultivo, que la 1780 exige
 * declarar y notificar al municipio.
 */
export function comodato(
  destino: 'sede_social' | 'predio_cultivo',
  d: DatosComodato,
  e: Entidad | null,
): DocumentoGenerado {
  const esSede = destino === 'sede_social'
  const f: string[] = []
  if (!d.comodante) f.push('quién cede el inmueble (comodante)')
  if (!d.comodanteDni) f.push('el DNI del comodante')
  if (!d.direccion) f.push('la dirección del inmueble')
  if (!e?.cuit) f.push('el CUIT de la entidad')

  const desde = d.desde || new Date().toISOString().slice(0, 10)
  const L = [
    esSede
      ? 'CONTRATO DE COMODATO — SEDE SOCIAL ADMINISTRATIVA'
      : 'CONTRATO DE COMODATO — PREDIO DE CULTIVO',
    '',
    `Entre ${d.comodante ?? FALTA('comodante')}` +
      (d.comodanteDni ? `, DNI N° ${d.comodanteDni}` : '') +
      ', en adelante EL COMODANTE, y ' +
      `${e?.razon_social ?? FALTA('razón social')} (CUIT ${e?.cuit ?? FALTA('CUIT')}), ` +
      'en adelante LA COMODATARIA, se conviene:',
    '',
    'PRIMERA (OBJETO). El comodante entrega en préstamo de uso gratuito el inmueble ubicado en ' +
      `${d.direccion ?? FALTA('dirección')}` + (d.localidad ? `, ${d.localidad}` : '') + '.',
    '',
    esSede
      ? 'SEGUNDA (DESTINO). El inmueble se destina exclusivamente a sede social administrativa de ' +
        'la comodataria, donde funcionarán sus órganos sociales, se conservarán los libros y la ' +
        'documentación social, y se recibirán las notificaciones dirigidas a la entidad.'
      : 'SEGUNDA (DESTINO). El inmueble se destina exclusivamente a predio de cultivo de la ' +
        'comodataria en el marco de la Ley Nacional N° 27.350 y la Resolución Ministerial ' +
        'N° 1780/2025. Será declarado como tal ante el REPROCANN con su georreferenciación y ' +
        'notificado fehacientemente a la autoridad jurisdiccional que corresponda.',
    '',
    `TERCERA (PLAZO). Se celebra por el término de ${d.meses ?? 24} meses a partir del ` +
      `${fechaEnLetras(desde)}, renovable de común acuerdo entre las partes.`,
    '',
    'CUARTA (GRATUIDAD). El préstamo es gratuito. La comodataria toma a su cargo los gastos de ' +
    'conservación y los servicios que consuma.',
    '',
    'QUINTA (SIN FIN DE LUCRO). Las partes reconocen que la comodataria es una asociación civil ' +
    'sin fin de lucro y que el inmueble no se afecta a actividad comercial alguna.',
    '',
    '',
    '_______________________________        _______________________________',
    'El comodante                           La comodataria',
  ]
  return {
    titulo: esSede ? 'Comodato de sede social' : 'Comodato de predio de cultivo',
    texto: L.join('\n'),
    faltantes: f,
  }
}

// ---------------------------------------------------------------------------
// Informe de variedades genéticas y compromiso de análisis
// ---------------------------------------------------------------------------

export interface VariedadDeclarada {
  nombre: string
  tipo?: string | null
  thc?: number | null
  cbd?: number | null
}

/**
 * La 1780 pide un informe cromatográfico por lote. Este documento declara qué
 * variedades hay en cultivo y asume el compromiso de analizarlas: es lo que se
 * presenta mientras los análisis de cada lote se van produciendo.
 *
 * Aclara explícitamente que los valores de la ficha son estimados de la
 * genética y no reemplazan el análisis del lote, porque presentarlos como
 * resultado sería declarar algo que no se midió.
 */
/**
 * `dispensadas`: las variedades que se ENTREGARON sin salir del cultivo propio.
 *
 * la asociación compra casi todo: dispenso 20 variedades —Cookies, Shuga, Legendary,
 * Purple Lemon— y cultiva UNA. Meterlas todas en la lista de "afectadas a su
 * produccion" declararia un cultivo que no existe.
 *
 * Van en su propia seccion, dicho lo que son: adquiridas a terceros. Asi el
 * informe queda completo —es lo que la entidad efectivamente manejo— sin
 * mentir sobre que cultiva.
 *
 * El compromiso de analisis por lote aplica a las DOS: la 1780 lo pide tanto a
 * las ONG como a los terceros cultivadores.
 */
export function informeGeneticas(
  variedades: VariedadDeclarada[], e: Entidad | null, responsable?: string,
  dispensadas: { nombre: string; entregas: number; gramos: number }[] = [],
): DocumentoGenerado {
  const f: string[] = []
  if (!variedades.length && !dispensadas.length) f.push('cargar las variedades en cultivo')
  if (!responsable) f.push('el responsable técnico que firma')
  if (!e?.cuit) f.push('el CUIT de la entidad')

  const filas = variedades.length
    ? variedades.map((v, i) => {
        const perfil = [
          v.tipo,
          v.thc != null ? `THC ${v.thc}%` : null,
          v.cbd != null ? `CBD ${v.cbd}%` : null,
        ].filter(Boolean).join(' · ')
        return `  ${i + 1}) ${v.nombre}` + (perfil ? ` — ${perfil}` : ` — ${FALTA('perfil sin cargar')}`)
      })
    : [`  ${FALTA('sin variedades cargadas')}`]

  const L = [
    'INFORME DE VARIEDADES GENÉTICAS Y COMPROMISO DE ANÁLISIS',
    '(Resolución Ministerial N° 1780/2025)',
    '',
    cabecera(e),
    '',
    `${e?.razon_social ?? FALTA('razón social')} declara las siguientes variedades genéticas ` +
      'afectadas a su producción:',
    '',
    ...filas,
  ]
  if (dispensadas.length) {
    L.push('')
    L.push('VARIEDADES ADQUIRIDAS A TERCEROS Y DISPENSADAS')
    L.push('')
    L.push('Las siguientes NO provienen del cultivo propio: se adquirieron a')
    L.push('cultivadores registrados y se entregaron a las personas vinculadas.')
    L.push('')
    dispensadas.forEach((v, i) => {
      L.push(`  ${i + 1}) ${v.nombre} — ${v.entregas} entrega(s) · ${Math.round(v.gramos)} g`)
    })
  }
  L.push(...[
    '',
    'COMPROMISO. La institución se compromete a presentar un informe cromatográfico por cada lote',
    'producido, con determinación de cannabinoides por método validado, conservando los',
    'protocolos y resultados a disposición de la autoridad sanitaria.',
    '',
    'Los valores de perfil declarados son estimados de la genética y no reemplazan el análisis',
    'de cada lote.',
    '',
    '',
    '_______________________________',
    `${responsable ?? FALTA('responsable técnico')} — Responsable Técnico`,
  ])
  return { titulo: 'Informe de genéticas', texto: L.join('\n'), faltantes: f }
}
