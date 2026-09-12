// Cuándo una solicitud de alta puede resolverse sola.
//
// El circuito ya existía entero: `ong_solicitudes` tiene estado, motivo,
// paciente_id y asociado_id, y alguien de la asociación miraba la bandeja y
// hacía clic. Esto reemplaza ese clic, no inventa un circuito nuevo.
//
// LO QUE NO PASA LA GUARDA NO SE RECHAZA. Queda pendiente, con el motivo
// escrito, y aparece en la bandeja como aparece hoy. Rechazar solo a alguien que
// quiere sumarse es una decisión que no le corresponde a un sistema: lo único
// que hace acá el automatismo es ahorrarle el clic a los casos que no tienen
// nada que mirar.
//
// ⚠ SIN CAPTCHA, por decisión de Gastón del 23/08/2026. Estas guardas frenan lo
// más obvio —sin un DNI que parezca un DNI no entra nadie, y un duplicado
// tampoco— pero NO reemplazan a un captcha: un bot que invente documentos
// distintos las pasa igual. Si algún día aparecen solicitudes basura en el
// padrón, es acá donde hay que mirar primero.

/** Lo que trae la solicitud, que es lo que la persona escribió en `/sumate`. */
export interface SolicitudNueva {
  nombre: string
  dni: string
  telefono?: string | null
  email?: string | null
}

/** Contra qué se mide la solicitud. */
export interface ContextoAlta {
  /**
   * El padrón actual, ENTERO: archivados incluidos.
   *
   * Filtrado por activos no sirve para esto. Una ficha dada de baja sigue
   * siendo la misma persona, y al 26/08/2026 hay 71 asociados activos cuya
   * ficha de paciente está archivada.
   */
  padron: FichaDelPadron[]
  vinculados: number
  topeVinculados: number
  /**
   * Cuántos socios sostiene HOY el cultivo, según la cadena de justificación.
   *
   * `null` cuando no se puede calcular —falta el rinde por planta, que declara
   * el Director Técnico—. En ese caso la guarda no bloquea: dejar el alta
   * automática muerta por un dato que falta, y encima sin decirlo, es peor que
   * no tenerla.
   */
  sociosQueSostieneElCultivo: number | null
}

export interface VeredictoAlta {
  aprobar: boolean
  /** Por qué no. Se escribe en `ong_solicitudes.motivo`, y lo lee una persona. */
  motivo: string | null
}

/** Sin puntos ni espacios, que es la única forma de comparar dos documentos. */
const soloDigitos = (s?: string | null) => (s ?? '').replace(/\D/g, '')

const normalizarMail = (s?: string | null) => (s ?? '').trim().toLowerCase()

/**
 * Un nombre listo para comparar: sin tildes, sin mayúsculas, sin espacios de más.
 *
 * NORMALIZA MÁS DE LO QUE NORMALIZA `beneficiarios_grafia`, y es a propósito.
 * Aquel cruce compara sólo mayúsculas y espacios porque su resultado es afirmar
 * que dos nombres son el MISMO beneficiario; normalizar de más ahí junta gente
 * distinta. Acá el resultado es mandar una solicitud a revisión humana, así que
 * el costo de los dos errores es asimétrico:
 *
 *   · marcar de más  → alguien mira la bandeja y sigue de largo
 *   · marcar de menos → una ficha duplicada, y las entregas viejas colgando de
 *                       la vieja mientras la nueva arranca en cero
 *
 * Con esa asimetría conviene errar marcando de más.
 */
const normalizarNombre = (s?: string | null) =>
  (s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // saca las tildes
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')                        // puntos, comas, guiones
    .replace(/\s+/g, ' ')
    .trim()

/** Sólo los dígitos de un teléfono, y sin el 0 ni el 15 de más. */
const normalizarTelefono = (s?: string | null) => {
  const d = (s ?? '').replace(/\D/g, '')
  return d.length >= 8 ? d.slice(-8) : ''   // los últimos 8 son los que no cambian
}

/**
 * La ficha del padrón que PUEDE ser esta misma persona, sin que el DNI lo diga.
 *
 * Existe por un caso concreto y contado: al 31/08/2026 hay **40 fichas sin DNI**
 * cargado, de las cuales 28 están activas y 27 acumulan **536 entregas** — o sea
 * las personas que más retiran. Como el enganche mira `dni === dni` y esas fichas
 * lo tienen en null, esas 40 personas al completar el formulario NO enganchaban
 * con su ficha: se les creaba una nueva, con el historial en la vieja.
 *
 * NO ENGANCHA NADA. Sólo devuelve la sospecha, para frenar y que la mire alguien.
 * Enganchar por nombre o teléfono sería escribir sobre la ficha equivocada, que
 * es exactamente lo que el resto de este archivo evita: hay al menos dos pares
 * de socios que comparten número y no son la misma persona.
 */
export function fichaSospechosa(
  sol: SolicitudNueva, padron: FichaDelPadron[],
): { ficha: FichaDelPadron; porque: string } | null {
  const nombre = normalizarNombre(sol.nombre)
  const tel = normalizarTelefono(sol.telefono)

  // El nombre primero: es la coincidencia que más veces acierta.
  if (nombre.length >= 6) {
    const f = padron.find(p => normalizarNombre(p.nombre_completo) === nombre)
    if (f) return { ficha: f, porque: 'tiene el mismo nombre' }
  }
  if (tel) {
    const f = padron.find(p => normalizarTelefono(p.telefono) === tel)
    if (f) return { ficha: f, porque: 'tiene el mismo teléfono' }
  }
  const mail = normalizarMail(sol.email)
  if (mail) {
    const f = padron.find(p => normalizarMail(p.email) === mail)
    if (f) return { ficha: f, porque: 'tiene el mismo mail' }
  }
  return null
}

/** Un DNI argentino: siete u ocho dígitos. */
const pareceDni = (dni: string) => /^\d{7,8}$/.test(dni)

const no = (motivo: string): VeredictoAlta => ({ aprobar: false, motivo })

/**
 * Los mismos controles del alta automatica, para la carga a mano.
 *
 * Al padron se entra por dos puertas —la solicitud publica y el formulario de
 * Pacientes— y hasta el 24/08/2026 solo la primera controlaba algo. Ese dia
 * entraron 12 fichas cargadas a mano y salieron 4 duplicados de gente que ya
 * estaba (Juan Albez con el MISMO DNI, y tres mas por telefono) y 5 documentos
 * imposibles: dos "0", un CUIL de once digitos y once ceros seguidos.
 *
 * Devuelve avisos, no un rechazo, y esa es la diferencia con `puedeAprobarseSola`:
 * la carga a mano la hace alguien que puede tener el caso raro delante. Hay dos
 * pares de socios que comparten telefono y NO son la misma persona —apellido y
 * REPROCANN distintos—, asi que bloquear por telefono repetido seria impedir un
 * alta legitima. Avisar deja decidir a quien esta mirando la ficha.
 */
export function avisosDeFichaNueva(
  ficha: { dni?: string | null; telefono?: string | null; nombre_completo?: string | null },
  padron: { id?: string; dni?: string | null; telefono?: string | null; nombre_completo?: string | null }[],
  excluirId?: string,
): string[] {
  const avisos: string[] = []
  const otros = padron.filter(p => !excluirId || p.id !== excluirId)

  const dni = soloDigitos(ficha.dni)
  if (dni && !pareceDni(dni)) {
    avisos.push(`El DNI «${ficha.dni}» no tiene forma de documento: son ${dni.length} dígitos y un DNI tiene 7 u 8. Si es un CUIL, va sólo el número del medio.`)
  }
  if (dni && pareceDni(dni)) {
    const igual = otros.find(p => soloDigitos(p.dni) === dni)
    if (igual) {
      avisos.push(`Ese DNI ya está en el padrón, en la ficha de ${igual.nombre_completo ?? 'otra persona'}. Dos fichas de la misma persona rompen el cupo de 30 días y el total de vinculados que se declara.`)
    }
  }

  const tel = soloDigitos(ficha.telefono)
  if (tel.length >= 8) {
    const igual = otros.find(p => soloDigitos(p.telefono) === tel)
    if (igual) {
      const mismoNombre = (igual.nombre_completo ?? '').trim().toLowerCase()
        === (ficha.nombre_completo ?? '').trim().toLowerCase()
      avisos.push(mismoNombre
        ? `${igual.nombre_completo} ya está en el padrón con ese mismo teléfono. Parece la misma persona cargada dos veces.`
        : `Ese teléfono ya figura en la ficha de ${igual.nombre_completo ?? 'otra persona'}. Puede ser un familiar —pasa— pero conviene confirmarlo antes de guardar.`)
    }
  }
  return avisos
}

export function puedeAprobarseSola(
  sol: SolicitudNueva, ctx: ContextoAlta,
): VeredictoAlta {
  if (!sol.nombre?.trim()) {
    return no('La solicitud llegó sin nombre. Hay que completarlo antes de darle el alta.')
  }

  const dni = soloDigitos(sol.dni)
  if (!dni) {
    return no('La solicitud llegó sin DNI, que es lo único que identifica a una persona ' +
      'de forma estable. Sin él no se puede saber si ya está en el padrón con otro nombre.')
  }
  if (!pareceDni(dni)) {
    return no(`El DNI cargado («${sol.dni}») no tiene la forma de un documento. ` +
      'Conviene confirmarlo con la persona antes de darle el alta.')
  }

  // ── que no esté ya, por los tres caminos por los que se repite una ficha ───
  if (ctx.padron.some(p => soloDigitos(p.dni) === dni)) {
    return no('Ese DNI ya está en el padrón. Puede ser la misma persona pidiendo el alta ' +
      'de nuevo: conviene mirar la ficha que ya existe antes de crear otra.')
  }

  const tel = soloDigitos(sol.telefono)
  if (tel.length >= 6 && ctx.padron.some(p => soloDigitos(p.telefono) === tel)) {
    return no('Ese teléfono ya figura en el padrón. Puede ser la misma persona con otra ' +
      'ficha, o un familiar que comparte el número: las dos cosas las tiene que mirar alguien.')
  }

  const mail = normalizarMail(sol.email)
  if (mail && ctx.padron.some(p => normalizarMail(p.email) === mail)) {
    return no('Ese mail ya figura en el padrón. Puede ser la misma persona con otra ficha.')
  }

  // ── el tope de la Resolución 1780 ─────────────────────────────────────────
  if (ctx.vinculados >= ctx.topeVinculados) {
    return no(`El padrón está en el tope de ${ctx.topeVinculados} vinculados. El tope es ` +
      'ampliable por solicitud, o se puede desvincular a quien no retira hace tiempo.')
  }

  // ── la ecuación: no admitir más de lo que el cultivo sostiene ──────────────
  if (ctx.sociosQueSostieneElCultivo != null
      && ctx.vinculados >= ctx.sociosQueSostieneElCultivo) {
    return no(`Hoy el cultivo sostiene ${ctx.sociosQueSostieneElCultivo} socios y ya hay ` +
      `${ctx.vinculados}. Sumar uno más sin subir el cupo de plantas y la biomasa rompe la ` +
      'cadena por arriba: quedan socios que el cultivo no puede justificar.')
  }

  return { aprobar: true, motivo: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tres caminos, no dos: alta, ACTUALIZACION, o freno.
//
// `puedeAprobarseSola` contesta «¿le doy el alta?» con si o no, y para el alta
// de alguien nuevo esta bien. Pero desde la campana del 26/08/2026 la pregunta
// cambio: el link se le manda a los 211 socios que YA ESTAN, para que firmen el
// mandato y carguen su REPROCANN. Para esa persona las dos respuestas son
// malas. «Si» le crea una ficha duplicada. «No» la manda a una bandeja de 211
// items y deja su firma huerfana en ong_solicitudes, sin llegar nunca al
// asociado.
//
// La respuesta correcta es la tercera: NO ES UN ALTA, ES UNA ACTUALIZACION DE
// LEGAJO. Se engancha a la ficha que ya tiene y se le aplica lo que trajo.
//
// POR QUE SOLO POR DNI, Y NO POR TELEFONO NI MAIL
//
// Enganchar es escribir sobre la ficha de una persona real. Con el DNI eso es
// seguro: identifica de forma estable y es lo unico que lo hace. Con el
// telefono no: en el padron hay al menos dos pares de socios que comparten
// numero y NO son la misma persona —apellido y REPROCANN distintos—, asi que
// enganchar por telefono le escribiria la firma del mandato al familiar
// equivocado. Esos casos siguen frenandose para que los mire alguien.
//
// LOS ARCHIVADOS CUENTAN. Una ficha dada de baja sigue siendo la misma persona:
// al 26/08/2026 hay 71 asociados activos cuya ficha de paciente esta archivada,
// y son justo los que el dedup no veia. Enganchar a una ficha archivada NO la
// reactiva sola —eso lo decide una persona— pero la reconoce, que es lo que
// evita el duplicado.

/** A quien engancharse, cuando la solicitud es de alguien que ya esta. */
export interface FichaDelPadron {
  id?: string
  dni?: string | null
  telefono?: string | null
  email?: string | null
  nombre_completo?: string | null
  activo?: boolean
  /** El código que la persona sacó en REPROCANN. Es lo que la hace VINCULADA. */
  codigo_vinculacion?: string | null
}

/**
 * CUÁNTAS PERSONAS REPRESENTA LA ASOCIACIÓN. No cuántos socios tiene.
 *
 * La Res. 1780/2025 dice que se puede «representar bajo el rol de cultivador
 * como máximo 150 personas», y representar es tener a alguien VINCULADO: con su
 * código de REPROCANN entregado. Ser socio de la asociación es otra cosa.
 *
 * ⚠️ Contar activos en vez de vinculados frenaba TODAS las altas. El 09/09/2026
 * la asociación tenía 150 socios activos, el tope en 150 y CERO vinculados: alguien
 * completó `/sumate`, la solicitud quedó en revisión, y al querer darle el alta
 * el sistema la rechazaba por un tope que en realidad estaba en 0 de 150.
 */
export const contarVinculados = (padron: FichaDelPadron[]): number =>
  padron.filter(p => p.activo !== false && (p.codigo_vinculacion ?? '').trim() !== '').length

export type DecisionSolicitud =
  /** Persona nueva: crear ficha de paciente y de asociado. */
  | { via: 'alta'; motivo: null }
  /** Ya esta: engancharla a esta ficha y aplicarle lo que trajo. */
  | { via: 'actualizar'; ficha: FichaDelPadron; motivo: string }
  /** Que lo mire alguien. */
  | { via: 'frenar'; motivo: string }

/**
 * Que hacer con una solicitud, mirando el padron ENTERO.
 *
 * `padron` tiene que venir completo, archivados incluidos. Filtrado por activos
 * esta funcion no puede hacer su trabajo: devolveria 'alta' para gente que ya
 * esta, que es exactamente el duplicado que hubo que deshacer a mano el
 * 25/08/2026 con PAC-XXX, PAC-XXX y PAC-XXX.
 */
export function decidirSolicitud(
  sol: SolicitudNueva, ctx: ContextoAlta,
): DecisionSolicitud {
  const dni = soloDigitos(sol.dni)

  // El enganche por DNI va PRIMERO, antes que cualquier guarda de alta: el tope
  // de vinculados y la ecuacion del cultivo miden si entra UNO MAS, y acá no
  // entra nadie nuevo. Frenar una actualizacion de legajo por el tope seria
  // frenarla por un cupo que esta persona ya ocupa.
  if (dni && pareceDni(dni)) {
    const ficha = ctx.padron.find(p => soloDigitos(p.dni) === dni)
    if (ficha) {
      return {
        via: 'actualizar',
        ficha,
        motivo: `Ya estaba en el padrón con ese DNI${
          ficha.nombre_completo ? `, como ${ficha.nombre_completo}` : ''
        }${ficha.activo === false ? ' (ficha archivada)' : ''}. `
          + 'No se creó una ficha nueva: se actualizó la que ya tenía.',
      }
    }
  }

  // Sin DNI utilizable no se engancha NADA, ni siquiera con teléfono o mail
  // coincidente: sin documento no hay forma de estar seguro de que es la misma
  // persona, y escribir sobre la ficha equivocada es peor que no hacer nada.
  //
  // PERO NO ENGANCHAR NO ES LO MISMO QUE DAR DE ALTA A CIEGAS, y hasta el
  // 31/08/2026 acá había un solo camino después del DNI: crear ficha nueva.
  //
  // El caso que lo destapó: hay 40 fichas SIN DNI cargado —28 activas, 27 con
  // entregas, 536 entregas entre todas—. Esas personas al completar el
  // formulario no enganchaban con su ficha porque no hay `dni` contra el cual
  // comparar, así que se les creaba una nueva y el historial quedaba en la
  // vieja. Son, además, las que más retiran.
  //
  // La tercera vía es la que este archivo ya usa para todo lo demás: FRENAR y
  // que lo mire una persona. No decide nada — deja la solicitud pendiente con
  // el motivo escrito, que es exactamente lo que dice el encabezado.
  const sospecha = fichaSospechosa(sol, ctx.padron)
  if (sospecha) {
    const { ficha, porque } = sospecha
    return {
      via: 'frenar',
      motivo: `Puede ser alguien que ya está en el padrón: ${porque} que `
        + `${ficha.nombre_completo ?? 'una ficha cargada'}`
        + `${ficha.activo === false ? ' (archivada)' : ''}`
        + `${ficha.dni ? '' : ', que no tiene DNI cargado'}. `
        + 'No se creó ficha nueva para no duplicarla. Revisalo y, si es la misma '
        + 'persona, cargale el DNI a la ficha que ya existe.',
    }
  }

  const v = puedeAprobarseSola(sol, ctx)
  return v.aprobar
    ? { via: 'alta', motivo: null }
    : { via: 'frenar', motivo: v.motivo! }
}

/**
 * CUÁLES SOLICITUDES MIRA EL ALTA AUTOMÁTICA.
 *
 * ⚠️ «Verificando» NO PUEDE SER UN CALLEJÓN SIN SALIDA, y lo era. El alta
 * automática miraba sólo `estado === 'pendiente'`, así que en el momento en que
 * alguien tocaba «Verificando» —el botón que está ahí para decir «esto lo estoy
 * mirando»— la solicitud pasaba a `en_revision` y no volvía a evaluarse nunca
 * más. Quedaba en la bandeja, abierta, sin motivo escrito y sin ficha.
 *
 * Le pasó a Luis Sebastian Ruvira el 09/09/2026: completó `/sumate`, alguien la
 * marcó como verificando, y desde ahí el sistema dejó de tocarla. Sumado al bug
 * del tope —que frenaba TODAS las altas— el resultado fue una persona que se
 * anotó y no aparecía en ningún lado.
 *
 * El corte que importa no es el estado sino `paciente_id`: con ficha enganchada
 * ya está resuelta, sin ficha sigue esperando, la haya mirado alguien o no.
 */
export const esperandoAlta = <T extends { estado: string; paciente_id?: string | null }>(
  filas: T[],
): T[] => filas.filter(s =>
  (s.estado === 'pendiente' || s.estado === 'en_revision') && !s.paciente_id)
