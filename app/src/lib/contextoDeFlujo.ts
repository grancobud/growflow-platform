// Lo que un paso de flujo descubre y el siguiente necesita.
//
// Los flujos son secuencias sobre UNA cosa: «Entregarle a un paciente» son tres
// pasos sobre una entrega, «Anotar un gasto» son dos sobre un asiento, «Sumar a
// alguien» son tres sobre una persona. Cada paso vive en otra pantalla, asi que
// el unico lugar donde el id puede viajar es la URL — el estado de un
// componente no cruza una navegacion, y guardarlo aparte sobreviviria a la
// tarea y apareceria pegado en la proxima.
//
// Estan todas las claves juntas y no una constante suelta por pantalla porque
// el que escribe el parametro y el que lo lee estan en archivos distintos: una
// sola de las dos puntas equivocandose de nombre rompe el flujo en silencio, y
// el paso abre igual, solo que vacio.

/** Los datos que un paso le puede pasar al siguiente. */
export const CLAVES_DE_CONTEXTO = ['entrega', 'asiento', 'paciente', 'lote', 'traslado'] as const

export type ClaveDeContexto = typeof CLAVES_DE_CONTEXTO[number]

/** El id que trae la URL para esa clave, o null si no viene ninguno. */
export function idDeLaUrl(search: string, clave: ClaveDeContexto): string | null {
  const v = new URLSearchParams(search).get(clave)
  return v && v.trim() ? v : null
}
