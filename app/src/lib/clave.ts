// Qué se le pide a una contraseña.
//
// Vive acá y no en `PaginaClave` porque un archivo que exporta un componente Y
// funciones rompe el fast refresh de Vite y sube el lint. Es la misma razón por
// la que `confirmarBorrado` vive en `lib/confirmar.ts`.

/**
 * El mínimo de GoTrue es 6. Se piden 8 porque estas cuentas ven el padrón
 * entero, las fichas clínicas y la caja: seis es lo que acepta el servidor, no
 * lo que corresponde a lo que hay del otro lado.
 */
export const LARGO_MINIMO_CLAVE = 8

/**
 * Qué le falta a la clave, o null si está bien.
 *
 * Devuelve el motivo y no un booleano: el botón se deshabilita igual, pero
 * además hay que poder decir POR QUE, que es lo que evita que alguien pruebe
 * tres veces sin entender qué quiere la pantalla.
 */
export function loQueFaltaEnLaClave(clave: string, repetida: string): string | null {
  if (clave.length < LARGO_MINIMO_CLAVE) {
    return `Tiene que tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`
  }
  if (clave !== repetida) return 'Las dos no coinciden.'
  return null
}
