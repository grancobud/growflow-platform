// Filtros para lo que llega del formulario de alta.
//
// El importador mapea cada columna del CSV a un campo por parecido de nombre.
// Eso alcanza para el 90% de los casos, pero falla feo en uno: la pregunta
// «¿Tenés REPROCANN?» contiene la palabra «reprocann», así que cae en
// `reprocann_nro` y ahí queda guardada la opción del desplegable en vez de un
// número.
//
// En la base de la asociación hubo ocho fichas con textos como «NO TENGO, QUIERO
// RECIBIR INFO AL RESPECTO» adentro del campo del número. Y no era un problema
// estético: la app deriva el estado del REPROCANN de si ese campo está vacío o
// no, así que esas fichas figuraban «En trámite» — el estado con el que se
// puede dispensar sin que la entrega quede marcada como sin respaldo. Alguien
// que declaró NO tener REPROCANN quedaba habilitado a retirar.
//
// Viven acá y no en el componente porque también los usan los tests, y un
// archivo que exporta componentes y funciones a la vez rompe el fast refresh.

/**
 * El número de REPROCANN, o null si lo que vino no es un número.
 *
 * Se descarta en vez de intentar corregirse: adentro de «NO TENGO, QUIERO
 * RECIBIR INFO AL RESPECTO» no hay ningún número que rescatar. La ficha entra
 * sin número, que es la verdad de lo que esa persona declaró.
 */
export function numeroDeReprocann(v: string): string | null {
  // Un REPROCANN real trae una tirada larga de dígitos, sola o detrás del
  // prefijo alfanumérico de la credencial (por ejemplo «a1bCde1234567»). El
  // prefijo se conserva: es parte del código que figura en el papel.
  return /[0-9]{4,}/.test(v) ? v : null
}

/**
 * El documento, o null si son ceros o texto.
 *
 * Un DNI cargado como «0» es peor que uno vacío: ocupa el lugar del dato y hace
 * que la ficha figure como identificada cuando no lo está. Se conserva el
 * formato tal como vino —con puntos o sin ellos— porque normalizarlo acá
 * escondería diferencias que conviene ver al revisar el padrón.
 */
export function documento(v: string): string | null {
  const d = v.replace(/\D/g, '')
  return d && !/^0+$/.test(d) ? v : null
}
