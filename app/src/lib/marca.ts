// Los archivos del logo, en un solo lugar.
//
// La ruta estaba escrita dos veces: `EMBLEMA_ORG` en `components/Marca.tsx`
// —que es lo que se ve en pantalla— y otra vez a mano adentro del HTML de
// impresión del acta. Dos copias de la misma ruta con `onerror` que borra la
// imagen sin decir nada: cambiar el archivo en un lado y no en el otro deja el
// documento impreso sin membrete, y no falla nada.
//
// Vive en `lib` y no en `Marca.tsx` porque también lo usa el generador de PDF,
// que es un módulo pelado: un archivo de componentes que además exporta
// constantes rompe el fast refresh de Vite y el lint lo marca.
//
// Cada instalación reemplaza estos dos archivos por los suyos. Es el único
// lugar donde hay que tocar el nombre.

/**
 * El disco con el zorro. Va donde el espacio manda: el sidebar, el encabezado,
 * el acta impresa y el membrete del PDF.
 */
export const EMBLEMA = '/logo-organizacion.svg'

/**
 * El logo entero —zorro, ASOCIACION y «powered by GrowFlow»—. Va sólo donde hay
 * aire para leerlo, que hoy es el login: a 44 px de alto el «powered by» no se
 * lee, así que meterlo en una fila sería poner un texto que nadie puede leer.
 */
export const LOCKUP = '/logo-organizacion-completo.svg'
