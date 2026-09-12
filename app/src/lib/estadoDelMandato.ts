// Quién firmó el Mandato de Gestión Operativa, quién no, y quién se asoció
// antes de que se pidiera.
//
// EL PROBLEMA
//
// Al 23/08/2026 la asociación tenía 209 asociados activos y CERO mandatos firmados. No
// era descuido: hasta ese día no había DÓNDE firmarlo — el alta la tipeaba
// alguien a mano desde lo que llegaba por WhatsApp. Y sin mandato, la regla
// RN-03 marca error en cada entrega, así que el libro entero quedaba observado
// por un papel que nunca se le pidió a nadie.
//
// LO QUE NO SE HIZO
//
// Marcarlos como firmados. Habría sido fabricar el consentimiento de 209
// personas identificadas, con fecha, hora y versión — que es exactamente lo que
// le da apariencia de prueba a una firma.
//
// LO QUE SE HIZO
//
// Dejar constancia de lo que de verdad pasó: esa gente se asoció cuando el
// mandato no era requisito. No se inventa nada y encima es verificable, porque
// la fecha de alta lo dice. La constancia lleva LA FECHA EN QUE LA PERSONA SE
// ASOCIÓ, que ya está en la ficha.
//
// Y separa dos cosas que «marcarlos como firmados» mezclaba: el que se asoció
// antes del requisito hay que regularizarlo, pero no está en falta; el que se
// asoció después teniendo el paso disponible y no firmó, sí.

/**
 * Desde cuándo el mandato se pide en el alta.
 *
 * Es el día en que `/sumate` empezó a pedir la firma. Antes de esta fecha no
 * había dónde firmarlo, así que a quien se asoció antes no se le puede reprochar
 * que no lo haya hecho.
 *
 * ⚠ Cambiar esta fecha cambia a quién ampara la constancia. Es una decisión
 * explícita, no un número para ajustar hasta que los números den bien.
 */
export const MANDATO_EXIGIBLE_DESDE = '2026-08-23'

export type EstadoMandato =
  /** Lo firmó. */
  | 'firmado'
  /** Se asoció antes de que se pidiera: hay que regularizarlo, pero no está en falta. */
  | 'anterior_al_requisito'
  /** Se asoció con el paso disponible y no está: es un paso salteado. */
  | 'falta'

export function estadoDelMandato(a: {
  mandato_aceptado?: boolean | null
  fecha_alta?: string | null
  /** Cuándo entró la ficha al sistema. Ver abajo por qué también cuenta. */
  creado_en?: string | null
}): EstadoMandato {
  if (a.mandato_aceptado) return 'firmado'
  // Sin fecha de alta NO se da por anterior porque sí: sería regalarle la
  // excusa a cualquier ficha incompleta, incluida una cargada hoy.
  if (a.fecha_alta) {
    return a.fecha_alta < MANDATO_EXIGIBLE_DESDE ? 'anterior_al_requisito' : 'falta'
  }
  // PERO LA FECHA DE CREACION TAMBIEN ES UN HECHO, y sirve para lo mismo.
  //
  // En la asociación hay 30 asociados sin `fecha_alta` cuya ficha se CREO el
  // 21/08/2026, dos dias antes de que el mandato se exigiera. No se sabe cuando
  // se asociaron —el dato nunca se cargo— pero si se sabe que su ficha ya
  // existia cuando el requisito no existia. Pedirles la firma retroactivamente
  // es pedirles algo que no habia donde hacer.
  //
  // Sin esto quedaban en 'falta', que es BLOQUEO DURO: 30 personas a las que no
  // se les podia registrar una entrega por un dato que nadie les pidio nunca.
  //
  // No afloja la regla para las fichas nuevas: una creada hoy tiene
  // `creado_en` posterior al requisito y sigue cayendo en 'falta'.
  if (a.creado_en && a.creado_en.slice(0, 10) < MANDATO_EXIGIBLE_DESDE) {
    return 'anterior_al_requisito'
  }
  return 'falta'
}

/**
 * La leyenda que explica por qué esa ficha no tiene firma.
 *
 * Va con la fecha en que la persona se asoció, que es el dato que sostiene la
 * explicación: no es una excusa general, es un hecho de ESA ficha.
 */
export function leyendaDelMandato(a: {
  mandato_aceptado?: boolean | null
  fecha_alta?: string | null
  creado_en?: string | null
}): string | null {
  if (estadoDelMandato(a) !== 'anterior_al_requisito') return null
  // La leyenda dice QUE fecha esta usando. Si es la de creacion de la ficha lo
  // aclara en vez de hacerla pasar por fecha de asociacion: no es lo mismo, y
  // quien lea la constancia tiene que poder saber cual de las dos es.
  return a.fecha_alta
    ? `Se asoció el ${a.fecha_alta}, cuando el Mandato de Gestión Operativa todavía no `
      + 'se requería en el alta. Queda pendiente de regularizar.'
    : `Su ficha se cargó el ${a.creado_en?.slice(0, 10)}, antes de que el Mandato de Gestión `
      + 'Operativa se requiriera. No tiene fecha de asociación cargada. Queda pendiente de regularizar.'
}
