// Marca de esta instalación: GrowFlow · la asociación.
//
// Vive en un solo lugar a propósito. La marca aparece en el login (desktop y
// mobile), en el sidebar y en el encabezado del panel; tenerla copiada en los
// cuatro es lo que dejó "Mi Cultivo" dando vueltas por la app después de que
// la instalación pasó a ser de la asociación.
//
// Si mañana cambia el nombre o el logo, se toca acá y listo.

import { Leaf } from 'lucide-react'
// `LOCKUP` ya es, en este archivo, el mapa de anchos por tamaño. Se importa
// con alias para no pisarlo.
import { EMBLEMA, LOCKUP as ARCHIVO_LOCKUP } from '../lib/marca'

/**
 * Los dos archivos del logo de la asociación, en `public/`. Si falta alguno se omite
 * sin romper: son imagenes que provee la asociacion.
 *
 * EMBLEMA es el disco con el zorro, y va donde el espacio manda: el sidebar, el
 * encabezado, el acta impresa. LOCKUP es el logo entero —zorro, ASOCIACION y
 * «powered by GrowFlow»— y va solo donde hay aire para leerlo, que hoy es el
 * login. A 44 px de alto el «powered by» no se lee, asi que meterlo en una fila
 * seria poner un texto que nadie puede leer.
 */
const EMBLEMA_ORG = EMBLEMA
const LOCKUP_ORG = ARCHIVO_LOCKUP

/**
 * Alto/ancho del lockup, medido sobre el archivo (418x473).
 *
 * Se reserva el espacio con `aspect-ratio` para que la caja tenga su tamaño
 * final ANTES de que la imagen cargue: sin eso el bloque salta cuando entra, y
 * en el login —que es lo primero que se ve— el salto se nota.
 *
 * ⚠ TIENE QUE COINCIDIR CON EL ARCHIVO. Si se reemplaza el logo por uno de
 * otra forma y esto no se toca, el `aspect-ratio` reserva una caja que no es
 * la del dibujo: el logo sale con aire de más a los costados o recortado, y no
 * hay nada que avise. El archivo entregado el 27/08/2026 venía en un lienzo de
 * 854x556 con más de la mitad en transparente; se recortó al contenido real
 * —418x473— justamente para que la caja y el dibujo sean lo mismo.
 */
const PROPORCION_LOCKUP = '418 / 473'

/** El emblema es cuadrado: 256×256 en `public/logo-asociacion.png`. */
const PROPORCION_EMBLEMA = '1 / 1'

/**
 * Ancho del lockup por tamaño.
 *
 * `centrado` NO es solo el login: el SIDEBAR tambien lo usa, con tamaño `sm`, y
 * mide 240 px de ancho. Con un ancho unico el logo entero se comia 200 px de
 * alto ahi adentro y empujaba el menu para abajo.
 */
const LOCKUP: Record<Tamano, string> = {
  sm: 'w-24',   // no se usa: en `sm` va el emblema, ver abajo
  md: 'w-32 sm:w-36',
  lg: 'w-40 sm:w-48',
}

type Tamano = 'sm' | 'md' | 'lg'

const CAJA: Record<Tamano, string> = {
  sm: 'w-9 h-9 rounded-lg',
  md: 'w-11 h-11 rounded-xl',
  lg: 'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl',
}
const HOJA: Record<Tamano, string> = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6 sm:w-7 sm:h-7',
}
const TITULO: Record<Tamano, string> = {
  sm: 'text-[16px]',
  md: 'text-[18px]',
  lg: 'text-[20px] sm:text-2xl',
}
/**
 * El logo de la asociación va a la MISMA altura que la caja del isotipo, para que los
 * dos se lean como piezas del mismo tamaño. Si se cambian los valores de CAJA,
 * cambiar estos en paralelo.
 */
/**
 * Alto del emblema de la asociación, al 92% de la caja del isotipo.
 *
 * NO son la misma medida a proposito, aunque parezca un error. El isotipo de
 * GrowFlow es una caja oscura translucida con borde; el de la asociación es un disco
 * BLANCO. A igual altura el disco pesa mucho mas y se lee como si fuera mas
 * grande que su vecino. Al 92% los dos se leen del mismo tamaño.
 *
 * Se probo componiendo la fila a 100%, 92% y 84%: a 100% el disco domina, a 84%
 * queda chico. Si algun dia el emblema cambia por uno oscuro o sin fondo, esto
 * hay que volver a mirarlo — la correccion es por el brillo, no por la forma.
 *
 * Los valores son los de CAJA multiplicados por 0,92: 36->33, 44->40, 48->44 y
 * 56->52. Si se cambian los de CAJA, estos van detras.
 */
const AJENO: Record<Tamano, string> = {
  sm: 'h-[33px]',
  md: 'h-10',
  lg: 'h-11 sm:h-[52px]',
}

/**
 * Isotipo solo, sin texto. Lo usa el sidebar colapsado, donde no entra la marca
 * completa pero tiene que quedar algo que identifique la app.
 */
export function IsotipoSolo({ tamano = 'sm' }: { tamano?: Tamano }) {
  return <IsotipoGrowFlow tamano={tamano} />
}

/** Isotipo de GrowFlow: la hoja con el puntito de "en vivo". */
function IsotipoGrowFlow({ tamano }: { tamano: Tamano }) {
  return (
    <div className={`relative bg-[#a3e635]/15 backdrop-blur-sm border border-[#404d20] flex items-center justify-center flex-shrink-0 ${CAJA[tamano]}`}>
      <Leaf className={`text-[#bef264] ${HOJA[tamano]}`} strokeWidth={2} />
      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#bef264] shadow-[0_0_6px_rgba(163,230,53,0.8)]" />
    </div>
  )
}

/**
 * Logo de la asociación. Es una imagen provista por la asociación, así que puede no
 * estar: si falla la carga se esconde sola en vez de dejar el ícono roto.
 */
function LogoOrg({ tamano }: { tamano: Tamano }) {
  return (
    <img
      src={EMBLEMA_ORG}
      alt="la asociación"
      // ⚠️ LA PROPORCIÓN VA DECLARADA, igual que en el lockup de abajo.
      //
      // `AJENO` fija el ALTO y el ancho quedaba en `auto`, así que hasta que la
      // imagen cargaba el navegador le daba cero de ancho y todo lo que está al
      // lado —el nombre en el sidebar, el título del encabezado— arrancaba
      // pegado al borde y saltaba a su lugar al terminar de bajarla. El emblema
      // es cuadrado (256×256), así que un `1 / 1` reserva la caja exacta.
      style={{ aspectRatio: PROPORCION_EMBLEMA }}
      className={`w-auto object-contain flex-shrink-0 ${AJENO[tamano]}`}
      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
    />
  )
}

/**
 * Marca completa: isotipo + "GrowFlow · la asociación" + logo de la asociación.
 *
 * @param tamano   escala del bloque
 * @param centrado apila y centra (login en mobile); por defecto va en fila
 * @param soloTexto omite los logos y deja el nombre (encabezados compactos)
 */
export function Marca({ tamano = 'md', centrado = false, soloTexto = false }: {
  tamano?: Tamano
  centrado?: boolean
  soloTexto?: boolean
}) {
  // `leading-none` sirve para una linea sola. Cuando el ancho no alcanza y el
  // nombre parte en dos —el sidebar mide 240px— las lineas se tocan y el bloque
  // se lee apretado. `leading-tight` le da el aire justo sin desalinear nada.
  const nombre = (
    <div className={`font-display font-bold text-[#ececf1] tracking-tight leading-tight ${TITULO[tamano]}`}>
      GrowFlow <span className="text-[#8a8a9c] font-semibold">·</span> <span className="text-[#d9f99d]">la asociación</span>
    </div>
  )

  if (soloTexto) return nombre

  // Centrado —el login— es el unico lugar con aire para el logo entero.
  //
  // No lleva el texto «GrowFlow · la asociación» al lado: el lockup YA dice ASOCIACION y
  // «powered by GrowFlow», asi que el texto repetiria las dos cosas. Y si la
  // imagen no carga, el `onError` deja ver el bloque de siempre, que sigue
  // diciendo quien es.
  // EL LOCKUP SOLO DONDE SE LEE.
  //
  // `centrado` no es solo el login: el SIDEBAR tambien lo usa, con tamaño `sm`.
  // Ahi el logo entero entra a 96 px de ancho, y a ese tamaño «powered by
  // GrowFlow» queda en unos 4 px por letra: es poner un texto que nadie puede
  // leer. En `sm` va el emblema con el nombre al lado, como estaba.
  if (centrado && tamano !== 'sm') {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <img
          src={LOCKUP_ORG}
          alt="la asociación · powered by GrowFlow"
          style={{ aspectRatio: PROPORCION_LOCKUP }}
          className={`h-auto object-contain ${LOCKUP[tamano]}`}
          onError={e => {
            const img = e.currentTarget as HTMLImageElement
            img.style.display = 'none'
            img.nextElementSibling?.classList.remove('hidden')
          }}
        />
        <div className="hidden flex-col items-center gap-2.5">
          <div className="flex items-center justify-center gap-3">
            <IsotipoGrowFlow tamano={tamano} />
            <LogoOrg tamano={tamano} />
          </div>
          {nombre}
        </div>
      </div>
    )
  }

  if (centrado) {
    return (
      <div className="flex flex-col items-center gap-2.5 text-center">
        <div className="flex items-center justify-center gap-3">
          <IsotipoGrowFlow tamano={tamano} />
          <LogoOrg tamano={tamano} />
        </div>
        {nombre}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 min-w-0">
      <IsotipoGrowFlow tamano={tamano} />
      <div className="min-w-0">{nombre}</div>
      <LogoOrg tamano={tamano} />
    </div>
  )
}
