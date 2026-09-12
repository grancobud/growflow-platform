/**
 * LO QUE HAY QUE PRESENTARLE AL MINISTERIO DE SALUD (Res. 1780/2025)
 *
 * No es una pantalla más: es la obligación que sostiene el permiso. El
 * certificado de una asociación civil vale UN AÑO (art. 10), y en el medio hay
 * informes semestrales. Cuando vence, lo que se entrega deja de estar amparado
 * por la 27.350.
 *
 * Todo se manda en PDF por correo a reprocannong@msal.gov.ar.
 *
 * Son CUATRO entregables distintos y conviene no confundirlos:
 *
 *   1. La NÓMINA de usuarios permitidos — nombre, apellido, DNI y domicilio,
 *      más la conformidad de cada uno y su renuncia a ser autocultivador.
 *   2. Un informe CROMATOGRÁFICO por lote.
 *   3. Un informe SEMESTRAL en carácter de declaración jurada: plantas totales
 *      y en floración, pacientes vinculados y variedad genética.
 *   4. Un informe SEMESTRAL DEL DIRECTOR MÉDICO, paciente por paciente, con
 *      procedimiento, dosis, concentración de THC, analítica, ratio, dilución
 *      y dosificaciones. Ese lo redacta `informeMedico.ts` y lo firma una
 *      persona: acá sólo se dice si están los datos.
 *
 * ESTE ARCHIVO NO INVENTA NINGÚN DATO. Lo que falta se nombra, y el documento
 * sale con el hueco a la vista. Un padrón donde falta un DNI se presenta
 * incompleto y se corrige; uno donde el DNI se completó solo es un documento
 * falso presentado ante el Estado.
 */
import type { Entidad } from './ong'
import type { Paciente } from './registro'
import { fechaEnLetras } from './actaTexto'
import type { DocumentoGenerado } from './documentosLegales'

/**
 * El correo al que va todo, en PDF. Sale de la Res. 1780/2025.
 *
 * ⚠️ CONVIENE CONFIRMARLO ANTES DE CADA PRESENTACIÓN. El Decreto 27/2026 movió
 * el REPROCANN de la órbita del Ministerio de Salud a SEDRONAR, y este correo es
 * `@msal.gov.ar`. SEDRONAR sigue dependiendo del Ministerio, así que lo más
 * probable es que siga andando —al 09/09/2026 no hay ninguna comunicación
 * oficial que lo cambie— pero un mail que rebota es una presentación que no se
 * hizo, y de eso nadie se entera hasta que vence el certificado.
 */
export const CORREO_REPROCANN_ONG = 'reprocannong@msal.gov.ar'

/**
 * ANEXO IV. Los topes son POR PERSONA REPRESENTADA, salvo el de personas.
 *
 * Cambian sólo si cambia la resolución: no son parámetros de la instalación, y
 * por eso viven acá y no en `ong_entidad`. Si alguien los edita porque «no le
 * dan los números», el sistema deja de medir la ley y pasa a medir un deseo.
 */
export const TOPES_1780 = {
  personasRepresentadas: 150,
  plantasFlorecidasPorPersona: 9,
  m2IndoorPorPersona: 6,
  m2OutdoorPorPersona: 15,
  domiciliosDeCultivo: 3,
  gramosPorTraslado: 40,
} as const

export interface RequisitoNomina {
  clave: string
  titulo: string
  estado: 'ok' | 'alerta' | 'error'
  valor: string
  detalle: string
  /** A quiénes les falta el dato, para poder ir a buscarlos. */
  quienes?: string
}

export interface DatosNomina {
  entidad: Entidad | null
  padron: Paciente[]
  plantasActivas: number
  plantasEnFloracion: number
  /**
   * Null cuando no se sabe, y entonces el requisito NO se dibuja.
   *
   * Es el mismo criterio del cupo: un tope que no se puede calcular es peor que
   * ninguno, porque parece que está controlado. La superficie vive en las áreas
   * de cultivo, y esta pantalla no siempre las tiene cargadas.
   */
  m2Cultivados: number | null
  domicilios: number
  lotes: { codigo?: string | null; thc_pct?: number | null; analisis_path?: string | null }[]
}

const nombra = (ps: Paciente[], tope = 4) =>
  ps.slice(0, tope).map(p => p.nombre_completo || p.codigo || 'sin nombre').join(', ')
  + (ps.length > tope ? ` y ${ps.length - tope} más` : '')

const vacio = (v: unknown) => v == null || String(v).trim() === ''

/**
 * Qué falta para poder presentar. Es el checklist, no el documento.
 *
 * Cada requisito dice CUÁNTOS y QUIÉNES: un cruce que sólo dice «faltan datos»
 * manda a una búsqueda a ciegas sobre 151 fichas, y un cruce que hace eso se
 * aprende a ignorar.
 */
export function estadoDeLaNomina(d: DatosNomina): RequisitoNomina[] {
  const r: RequisitoNomina[] = []
  const activos = d.padron.filter(p => p.activo)
  const n = activos.length

  // 1. EL TOPE SE MIDE SOBRE LAS REPRESENTADAS, NO SOBRE EL PADRÓN.
  //
  // La primera versión contaba los activos y daba «151 de 150» en rojo, con un
  // detalle que mandaba a decidir a quién se deja afuera. Estaba mal, y el error
  // no era del padrón sino de la medición: la 1780 dice que la asociación
  // «podrá representar bajo el rol de cultivador como máximo 150 personas», y
  // representar es tener a alguien VINCULADO. La nómina misma es la de «los
  // usuarios permitidos por el REPROCANN para los cuales solicitan el registro»
  // — o sea los que traen su código.
  //
  // Ser socio de la asociación y estar representado ante el Ministerio son dos
  // cosas distintas. Confundirlas empujaba a dar de baja a una persona real para
  // arreglar un número que nunca estuvo mal.
  const vinculadas = activos.filter(p => !vacio(p.codigo_vinculacion)).length
  const sobran = vinculadas - TOPES_1780.personasRepresentadas
  r.push(sobran > 0
    ? {
      clave: 'tope_personas', titulo: 'Personas representadas', estado: 'error',
      valor: `${vinculadas} de ${TOPES_1780.personasRepresentadas}`,
      detalle: `Hay ${sobran} vinculada${sobran === 1 ? '' : 's'} por encima del máximo que la `
        + 'Res. 1780/2025 permite representar. La nómina no puede presentarse así: hay que decidir '
        + 'a quién se deja de representar, y eso lo resuelve la asociación, no el sistema.',
    }
    : {
      clave: 'tope_personas', titulo: 'Personas representadas',
      estado: vinculadas >= TOPES_1780.personasRepresentadas ? 'alerta' : 'ok',
      valor: `${vinculadas} de ${TOPES_1780.personasRepresentadas}`,
      detalle: vinculadas >= TOPES_1780.personasRepresentadas
        ? 'Está justo en el tope: la próxima vinculación deja a la asociación fuera de la norma.'
        : `Quedan ${TOPES_1780.personasRepresentadas - vinculadas} lugares para vincular.`,
    })

  // Y aparte: el padrón puede ser más grande que el tope, y eso NO es una
  // infracción — es que no van a entrar todos. Se avisa una sola vez, acá, en
  // vez de dejar que aparezca como un error cuando se intente vincular al 151.
  if (n > TOPES_1780.personasRepresentadas) {
    r.push({
      clave: 'padron_mayor_al_tope', titulo: 'Padrón sobre el tope', estado: 'alerta',
      valor: `${n} socios, ${TOPES_1780.personasRepresentadas} representables`,
      detalle: `La asociación tiene ${n} socios activos y sólo puede representar a `
        + `${TOPES_1780.personasRepresentadas}. No es una infracción —serlo y estar vinculado son `
        + 'cosas distintas— pero significa que hay que elegir a quiénes se vincula.',
    })
  }

  // 2, 3 y 4. Los campos que la nómina exige por persona. Van separados porque
  //    se completan en momentos distintos y con fuentes distintas.
  const sinDni = activos.filter(p => vacio(p.dni))
  r.push(sinDni.length > 0
    ? {
      clave: 'nomina_dni', titulo: 'DNI en la nómina', estado: 'error',
      valor: `faltan ${sinDni.length}`,
      detalle: 'La nómina se presenta con nombre, apellido, DNI y domicilio. Sin el DNI la persona '
        + 'no se puede identificar y su renglón queda incompleto.',
      quienes: nombra(sinDni),
    }
    : {
      clave: 'nomina_dni', titulo: 'DNI en la nómina', estado: 'ok', valor: 'completo',
      detalle: `Las ${n} personas tienen DNI cargado.`,
    })

  const sinDom = activos.filter(p => vacio(p.domicilio))
  r.push(sinDom.length > 0
    ? {
      clave: 'nomina_domicilio', titulo: 'Domicilio en la nómina', estado: 'error',
      valor: `faltan ${sinDom.length}`,
      detalle: 'El domicilio es uno de los cuatro campos que la resolución pide por persona.',
      quienes: nombra(sinDom),
    }
    : {
      clave: 'nomina_domicilio', titulo: 'Domicilio en la nómina', estado: 'ok', valor: 'completo',
      detalle: `Las ${n} personas tienen domicilio cargado.`,
    })

  const sinVinc = activos.filter(p => vacio(p.codigo_vinculacion))
  r.push(sinVinc.length > 0
    ? {
      clave: 'nomina_vinculacion', titulo: 'Código de vinculación', estado: 'error',
      valor: `faltan ${sinVinc.length} de ${n}`,
      detalle: 'Cada persona saca SU código en REPROCANN —es gratuito y lo hace sola— y se lo da a '
        + 'la asociación. Sin ese código no está vinculada, y una nómina de personas no vinculadas '
        + 'no acredita nada.',
      quienes: nombra(sinVinc),
    }
    : {
      clave: 'nomina_vinculacion', titulo: 'Código de vinculación', estado: 'ok', valor: 'completo',
      detalle: `Las ${n} personas están vinculadas.`,
    })

  // 5. Los topes de cultivo. Se miden por persona representada, así que el
  //    techo se mueve con el padrón.
  const techoPlantas = n * TOPES_1780.plantasFlorecidasPorPersona
  r.push({
    clave: 'tope_plantas', titulo: 'Plantas en floración',
    estado: d.plantasEnFloracion > techoPlantas ? 'error' : 'ok',
    valor: `${d.plantasEnFloracion} de ${techoPlantas}`,
    detalle: d.plantasEnFloracion > techoPlantas
      ? 'Por encima de las 9 plantas florecidas por persona representada que fija el Anexo IV.'
      : `El Anexo IV permite ${TOPES_1780.plantasFlorecidasPorPersona} plantas florecidas por persona representada.`,
  })

  if (d.m2Cultivados != null) {
    const techoM2 = n * TOPES_1780.m2IndoorPorPersona
    r.push({
      clave: 'tope_superficie', titulo: 'Superficie cultivada',
      estado: d.m2Cultivados > techoM2 ? 'error' : 'ok',
      valor: `${d.m2Cultivados} m² de ${techoM2}`,
      detalle: `El Anexo IV permite ${TOPES_1780.m2IndoorPorPersona} m² indoor por persona representada `
        + `(${TOPES_1780.m2OutdoorPorPersona} m² si es exterior).`,
    })
  }

  r.push({
    clave: 'tope_domicilios', titulo: 'Domicilios de cultivo',
    estado: d.domicilios > TOPES_1780.domiciliosDeCultivo ? 'error' : 'ok',
    valor: `${d.domicilios} de ${TOPES_1780.domiciliosDeCultivo}`,
    detalle: `El artículo 14 prohíbe cultivar en más de ${TOPES_1780.domiciliosDeCultivo} domicilios.`,
  })

  // 6. La cromatografía. Va POR LOTE, y es el requisito que más lejos está de
  //    poder cumplirse solo: depende de un laboratorio.
  const sinAnalisis = d.lotes.filter(l => l.thc_pct == null && vacio(l.analisis_path))
  r.push(sinAnalisis.length > 0
    ? {
      clave: 'cromatografia', titulo: 'Informe cromatográfico por lote', estado: 'alerta',
      valor: `${sinAnalisis.length} de ${d.lotes.length} sin análisis`,
      detalle: 'La resolución pide un informe cromatográfico por lote. Es alerta y no error porque '
        + 'no se arregla cargando un campo: lo emite un laboratorio y lleva tiempo.',
    }
    : {
      clave: 'cromatografia', titulo: 'Informe cromatográfico por lote', estado: 'ok',
      valor: `${d.lotes.length} lotes`, detalle: 'Todos con análisis cargado.',
    })

  // 7. Los datos de la propia entidad, que encabezan cada papel.
  const faltaEntidad = [
    vacio(d.entidad?.razon_social) ? 'la razón social' : null,
    vacio(d.entidad?.cuit) ? 'el CUIT' : null,
    vacio(d.entidad?.sede_domicilio) ? 'el domicilio de la sede' : null,
  ].filter(Boolean) as string[]
  r.push(faltaEntidad.length > 0
    ? {
      clave: 'entidad', titulo: 'Datos de la entidad', estado: 'error',
      valor: `faltan ${faltaEntidad.length}`,
      detalle: `Sin ${faltaEntidad.join(', ')} la presentación no tiene encabezado y no se sabe quién presenta.`,
    }
    : {
      clave: 'entidad', titulo: 'Datos de la entidad', estado: 'ok', valor: 'completos',
      detalle: 'Razón social, CUIT y domicilio cargados.',
    })

  return r
}

/** Si con esto se puede presentar o todavía no. */
export const sePuedePresentar = (rs: RequisitoNomina[]) => !rs.some(r => r.estado === 'error')

// ---------------------------------------------------------------------------
// Los documentos
// ---------------------------------------------------------------------------

// Mismo mecanismo que `documentosLegales`: la línea que depende de un dato que
// no está se OMITE, no se inventa. Un papel con un CUIT que no es el de la
// entidad dice algo falso, y esto se presenta ante el Estado.
const AUSENTE = ''
const FALTA = (que: string) => AUSENTE + que
const sinHuecos = (l: string[]) => l.filter(x => !x.includes(AUSENTE)).join('\n').replace(/^\n+/, '')

function cabecera(e: Entidad | null, hoy: string): string[] {
  return [
    e?.razon_social || FALTA('razón social'),
    e?.cuit ? `CUIT: ${e.cuit}` : FALTA('CUIT'),
    e?.sede_domicilio || FALTA('domicilio de la sede'),
    '',
    `Fecha: ${fechaEnLetras(hoy)}`,
    '',
  ]
}

/**
 * DOCUMENTO 1. La nómina de usuarios permitidos.
 *
 * Va NUMERADA y con los cuatro campos en el mismo orden que los pide la
 * resolución. Quien recibe esto compara contra el REPROCANN: cualquier otro
 * orden obliga a leer cada renglón dos veces.
 *
 * ⚠ Los renglones incompletos SE INCLUYEN, marcados. Sacarlos daría una nómina
 * prolija y más corta que el padrón real, y esa diferencia es exactamente lo
 * que una inspección pregunta.
 */
export function nominaDeUsuarios(
  padron: Paciente[], e: Entidad | null, hoy: string,
): DocumentoGenerado {
  const activos = padron.filter(p => p.activo)
  const f: string[] = []
  if (vacio(e?.razon_social)) f.push('la razón social de la entidad')
  if (vacio(e?.cuit)) f.push('el CUIT')
  const sinDni = activos.filter(p => vacio(p.dni)).length
  const sinDom = activos.filter(p => vacio(p.domicilio)).length
  const sinVinc = activos.filter(p => vacio(p.codigo_vinculacion)).length
  if (sinDni) f.push(`el DNI de ${sinDni} ${sinDni === 1 ? 'persona' : 'personas'}`)
  if (sinDom) f.push(`el domicilio de ${sinDom} ${sinDom === 1 ? 'persona' : 'personas'}`)
  if (sinVinc) f.push(`el código de vinculación de ${sinVinc} ${sinVinc === 1 ? 'persona' : 'personas'}`)
  if (activos.length > TOPES_1780.personasRepresentadas) {
    f.push(`bajar el padrón a ${TOPES_1780.personasRepresentadas}: hay ${activos.length}`)
  }

  const filas = activos.map((p, i) => {
    const campos = [
      p.nombre_completo || '— falta nombre —',
      p.dni ? `DNI ${p.dni}` : '— falta DNI —',
      p.domicilio || '— falta domicilio —',
      p.codigo_vinculacion ? `Vinc. ${p.codigo_vinculacion}` : '— falta código de vinculación —',
    ]
    return `${String(i + 1).padStart(3, ' ')}. ${campos.join('  |  ')}`
  })

  const L = [
    ...cabecera(e, hoy),
    'NÓMINA DE USUARIOS PERMITIDOS POR EL REPROCANN',
    'Res. 1780/2025 — Ministerio de Salud de la Nación',
    '',
    `Total de personas representadas: ${activos.length} (máximo permitido: ${TOPES_1780.personasRepresentadas})`,
    '',
    ...filas,
    '',
    '---',
    'Se deja constancia de que cada persona listada prestó su conformidad para ser',
    'representada por esta asociación y renunció a inscribirse como autocultivador,',
    'conforme lo exige la Res. 1780/2025.',
    '',
    '_______________________________',
    'Firma del representante legal',
  ]
  return { titulo: 'Nómina de usuarios permitidos', texto: sinHuecos(L), faltantes: f }
}

/**
 * DOCUMENTO 3. La declaración jurada semestral.
 *
 * Cuatro números y una lista de genéticas. Es el más corto de los cuatro y el
 * que más seguido se presenta.
 */
export function ddjjSemestral(
  d: DatosNomina, hoy: string, geneticas: string[],
): DocumentoGenerado {
  const activos = d.padron.filter(p => p.activo)
  const vinculados = activos.filter(p => !vacio(p.codigo_vinculacion))
  const f: string[] = []
  if (vacio(d.entidad?.cuit)) f.push('el CUIT de la entidad')
  if (geneticas.length === 0) f.push('la variedad genética registrada')
  if (vinculados.length === 0) f.push('el código de vinculación de al menos una persona')

  const L = [
    ...cabecera(d.entidad, hoy),
    'INFORME SEMESTRAL EN CARÁCTER DE DECLARACIÓN JURADA',
    'Res. 1780/2025 — Ministerio de Salud de la Nación',
    '',
    `Cantidad total de plantas: ${d.plantasActivas}`,
    `Cantidad de plantas en floración: ${d.plantasEnFloracion}`,
    `Cantidad de pacientes vinculados: ${vinculados.length}`,
    `Personas representadas en el padrón: ${activos.length}`,
    geneticas.length > 0
      ? `Variedad genética registrada utilizada: ${geneticas.join(', ')}`
      : FALTA('variedad genética'),
    '',
    d.m2Cultivados != null ? `Superficie cultivada declarada: ${d.m2Cultivados} m²` : FALTA('superficie'),
    `Domicilios de cultivo: ${d.domicilios}`,
    '',
    '---',
    'Declaro bajo juramento que los datos consignados son fiel expresión de la verdad.',
    '',
    '_______________________________',
    'Firma del representante legal',
  ]
  return { titulo: 'DDJJ semestral', texto: sinHuecos(L), faltantes: f }
}

/**
 * Los pasos de la presentación, para que no haya que buscarlos en la resolución.
 * Es texto y no una automatización a propósito: el correo lo manda una persona,
 * que es la que firma.
 */
export const PASOS_PRESENTACION = [
  {
    titulo: 'Completar lo que falta',
    detalle: 'Los renglones incompletos se presentan marcados, pero cada uno es una observación. '
      + 'El control de arriba dice qué falta y a quiénes.',
  },
  {
    titulo: 'Generar los documentos',
    detalle: 'La nómina y la DDJJ semestral salen de acá. El informe del Director Médico sale de '
      + 'Seguimiento, y las cromatografías las emite el laboratorio: se adjuntan al lote.',
  },
  {
    titulo: 'Firmarlos',
    detalle: 'La nómina y la DDJJ las firma el representante legal; el informe de pacientes, el '
      + 'Director Médico. Un sistema no puede firmar una declaración jurada.',
  },
  {
    titulo: `Enviarlos en PDF a ${CORREO_REPROCANN_ONG}`,
    detalle: 'Es la vía que fija la Res. 1780/2025. Conviene confirmar la dirección antes de mandar: '
      + 'el Decreto 27/2026 pasó el REPROCANN a SEDRONAR y esta casilla es del Ministerio de Salud. '
      + 'Y guardar el correo enviado: es la única constancia de que la presentación se hizo, y de qué fecha.',
  },
  {
    titulo: 'Archivar la constancia',
    detalle: 'El certificado de la asociación vale un año (art. 10) y los informes son semestrales. '
      + 'Guardar la fecha de envío es lo que permite saber cuándo toca el siguiente.',
  },
] as const
