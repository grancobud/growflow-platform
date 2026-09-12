// Los colores y los formatos de número de los gráficos.
//
// Viven acá y no al lado de los componentes porque un archivo que exporta
// componentes Y constantes rompe el recargado en caliente de Vite: al tocar una
// constante, React no puede saber si el componente cambió y remonta el árbol
// entero, perdiendo el estado de la pantalla.

/** Lo que entra, y todo lo que está bien. */
export const VERDE = '#a3e635'
/** Lo que sale, y lo que hay que mirar. */
export const CORAL = '#ff8a7a'
/** Las personas. */
export const LILA = '#c4b5fd'
/** Las advertencias y lo que se acumula. */
export const AMBAR = '#fbbf24'
export const GRIS = '#8a8a9c'
export const REJILLA = '#1f1f2b'

export const fmtPesos = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

/** $X.XXX.XXX no entra en un eje: ahí va $1,2 M. */
export const fmtCorto = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace('.', ',')} M`
  if (a >= 1_000) return `$${Math.round(n / 1000)} k`
  return `$${Math.round(n)}`
}

export const fmtNum = (n: number) => Math.round(n).toLocaleString('es-AR')

/** Un porcentaje chico con un decimal, uno grande sin ninguno. */
export const fmtPct = (v: number | null) =>
  v == null ? '—' : `${(v * 100).toFixed(v < 0.1 ? 1 : 0).replace('.', ',')}%`
