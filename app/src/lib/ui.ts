/**
 * LA ESCALA DE GRISES, Y POR QUÉ TIENE TRES NIVELES Y NO CUATRO.
 *
 * Medida contra WCAG AA (4.5:1 para texto, 3:1 para iconos y controles), sobre
 * los fondos reales de la app y en el PEOR de ellos:
 *
 *   #ececf1  texto principal      16.10  ✔
 *   #a6a6b5  texto secundario      7.89  ✔
 *   #8a8a9c  rótulos y ayuda       4.85  ✔   (5.59 sobre el fondo de la app)
 *   #6e6e80  SÓLO iconos           3.63  ✔ para no-texto, ✘ para texto
 *
 * HABÍA UN CUARTO NIVEL, `#5a5a68`, y daba **2.80**. Eso no es un tecnicismo:
 * es texto que en un teléfono a plena luz en Resistencia no se ve. Se usaba en
 * 29 lugares, y en la mayoría era texto de ayuda de 10px — justo lo que alguien
 * lee cuando no sabe qué hacer.
 *
 * No se reemplazó por un tono intermedio porque NO EXISTE: entre 2.80 y 4.5, en
 * un fondo casi negro, no hay lugar. Ese es el hallazgo — la escala tenía un
 * nivel de más. Los 29 usos se repartieron según lo que cada uno ES:
 *
 *   texto y placeholders (20) → el nivel de «rótulos y ayuda»
 *   iconos decorativos (9)    → #6e6e80, que con 3:1 le alcanza y le sobra
 *
 * SE PIERDE UNA DISTINCIÓN Y ESTÁ BIEN: en «Fuera de la O.N.G.» el título y su
 * explicación quedaron del mismo color, y ahora los separa el uppercase en vez
 * del tono. Perder una distinción que era invisible no es perder nada.
 *
 * EL NIVEL DE RÓTULOS ERA `#7d7d8e` Y SE MOVIÓ A `#8a8a9c` EL 02/09/2026.
 *
 * El 01/09 quedó anotado acá mismo como deuda: daba 4.49 sobre la fila #15151d,
 * «un centésimo abajo del umbral», y mover el gris más usado de la app parecía
 * desproporcionado para un centésimo.
 *
 * No era un centésimo. Al extender la revisión automática a las solapas de
 * O.N.G. y a los formularios —donde vive la mayor parte de este gris, porque es
 * el color de los rótulos de campo— apareció el número real: sobre las tarjetas
 * teñidas de aviso y de estado baja a **4.05**. La medición vieja era optimista
 * porque sólo miraba diez pantallas y ninguna era un formulario. Es la misma
 * lección de siempre, una vez más: se mide sobre lo que el navegador dibuja, y
 * hay que asegurarse de estar mirando DONDE el color efectivamente se usa.
 *
 * `#8a8a9c` despeja 4.5 en todos los fondos medidos, con 4.85 en el peor, y
 * sigue claramente por debajo de `#a6a6b5`, así que la jerarquía de tres niveles
 * se mantiene. Son 735 usos, todos texto o placeholder — ninguno borde ni fondo,
 * verificado antes de reemplazar.
 *
 * NO REINTRODUCIR UN GRIS MÁS OSCURO QUE #6e6e80, y #6e6e80 sólo para iconos.
 * Un «·» separador en `GuiaDelFormulario` estaba pintado con el de iconos y daba
 * 3.63 siendo texto: un separador que no se ve parte el renglón igual que una
 * palabra que no se lee.
 */

/**
 * EL HUNDIDO AL TOCAR. La única respuesta que el mostrador ve al instante.
 *
 * En el teléfono no hay hover: entre que el dedo toca «Registrar visita» y que
 * aparece el toast pasan los milisegundos que tarda la base, y en ese hueco la
 * pantalla no dice NADA. Quien atiende no sabe si el toque entró, así que
 * vuelve a tocar — y eso es una visita cargada dos veces. El `hover:` que ya
 * estaba sólo contesta con mouse, o sea justo donde no hace falta.
 *
 * Por qué 97% y no el 96% del manual: acá los botones son anchos y de una
 * línea, y con 96% el borde se despega visiblemente del de al lado. Lo que se
 * busca es que se sienta, no que se vea.
 *
 * `transition-[…]` en vez de `transition-all`: `all` transiciona TAMBIÉN lo que
 * el navegador tiene que recalcular —alto, ancho, posición— y en una lista de
 * cien filas eso se paga en cada toque. Se nombran las cuatro que cambian.
 *
 * Se escribe `97%` y compila a `scale:.97`. Si alguna vez hay que verificar a
 * mano que la clase existe, buscar en el CSS de `dist` por `scale:.97` y NO por
 * `0.97`: el minificador come el cero de adelante, así que grepear el número
 * como está escrito acá da cero resultados y parece que la clase no se generó.
 *
 * `motion-reduce:` lo apaga para quien pidió menos movimiento en el sistema. El
 * color sigue transicionando: eso no es movimiento. Y hace falta explícito
 * aunque `index.css` ya tenga un `transform:none!important` global para
 * `:active`: esa regla apunta a `transform`, y Tailwind 4 usa la propiedad
 * `scale`, que es otra. La global no lo alcanza.
 *
 * LAS DOS ESCALAS SON LITERALES A PROPÓSITO. Armarlas con un template
 * (`scale-[${n}]`) deja a Tailwind sin la clase: escanea texto, no evalúa
 * código, y la clase simplemente no se genera. Mismo final silencioso.
 */
export const presionBoton = 'transition-[color,background-color,border-color,transform] active:scale-[97%] motion-reduce:active:scale-100'

/** Igual, para una fila o tarjeta entera: más ancha, así que se hunde menos. */
export const presionFila = 'transition-[color,background-color,border-color,transform] active:scale-[98%] motion-reduce:active:scale-100'

/**
 * Estilos de botón compartidos.
 *
 * Estas dos constantes estaban copiadas y pegadas en 20 archivos. Cuando se
 * corrigió el alto táctil en Cosecha, se corrigió una sola copia y las otras
 * diez quedaron en 31 px: por eso viven acá y se importan.
 *
 * min-h-[44px] sólo en celular: es el mínimo para tocar con el dedo sin errarle.
 * De sm: para arriba se apaga, porque con mouse no hace falta y en desktop
 * botones de 44 px de alto en una barra quedan enormes.
 */
export const btnPrimario = `inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 ${presionBoton} text-[12px] font-medium text-[#d9f99d] disabled:opacity-50`

export const btnSutil = `inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:bg-[#1c1c27] hover:border-[#404d20] ${presionBoton} text-[11px] text-[#a6a6b5] hover:text-[#ececf1]`

/**
 * Botón de sólo ícono (lápiz, tacho, refrescar).
 *
 * El ícono mide 14 px, así que sin un mínimo explícito el botón queda de 22×22
 * y en el celular se le erra. El área táctil crece sin agrandar el ícono ni
 * empujar el layout: en desktop vuelve a ser compacto.
 */
export const btnIcono = `inline-flex items-center justify-center flex-shrink-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-1.5 rounded-lg ${presionBoton} text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#15151d]`

/**
 * Nombre clickeable dentro de una tarjeta (una planta, un paciente, una genética).
 *
 * El texto mide 21 px de alto y con el dedo se le erra. No se puede resolver con
 * `min-h-[44px]` como en los botones: eso empujaría el subtítulo que va abajo y
 * descuadraría la tarjeta entera.
 *
 * El truco es padding con margen negativo que lo compensa: el área táctil crece
 * a 45 px, el layout no se mueve un píxel, y de `sm:` para arriba se apaga todo
 * porque con mouse no hace falta.
 *
 * Vive acá y no copiado en cada página por lo mismo que las otras: ya había
 * pasado que se corrigiera en Plantas y quedaran Pacientes y Genéticas en 21 px.
 *
 * `min-w-[44px]` es del 02/09/2026: el alto ya estaba resuelto pero el ANCHO no,
 * y una planta se llama «#3». Quedaba un objetivo de 31 px de ancho por 45 de
 * alto — alto suficiente, angosto de más. No mueve el layout por la misma razón
 * que el resto: el texto va alineado a la izquierda adentro de un `flex-1`, así
 * que ensanchar la caja de un nombre corto no corre nada de lugar.
 */
export const nombreTocable =
  'py-3 -my-3 pr-3 -mr-3 min-w-[44px] sm:py-0 sm:my-0 sm:pr-0 sm:mr-0 sm:min-w-0'

/**
 * Campos de formulario y de filtro.
 *
 * El 16 px en celular no es estético: iOS Safari hace zoom automático sobre
 * cualquier input con letra menor y deja la página descuadrada. De sm: para
 * arriba baja al tamaño real de la interfaz.
 */
export const campoBase = 'text-[16px] rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#a3e635]/60 transition-colors min-h-[44px] sm:min-h-0'

export const inputFormulario = `w-full px-3 py-2.5 sm:py-2 sm:text-[12px] ${campoBase}`

/**
 * Para los campos donde el teclado del teléfono ESTORBA: códigos, DNI, CUIT,
 * matrículas, números de registro.
 *
 * Android e iOS autocorrigen y ponen mayúscula inicial por defecto. En un campo
 * de texto libre eso ayuda; en `LOT-2601` o en un DNI, cambia el dato que la
 * persona escribió — y lo cambia DESPUÉS, mientras mira otra cosa. Un código
 * mal guardado por una autocorrección no se ve hasta que algo no cruza.
 *
 * Se spread-ea (`<input {...sinAutocorreccion} />`) y no es una clase porque son
 * atributos, no estilo. Vive acá por lo mismo que el resto: escrito a mano en
 * cada campo, se corrige en uno y quedan los otros.
 */
export const sinAutocorreccion = {
  spellCheck: false,
  autoCapitalize: 'off',
  autoCorrect: 'off',
} as const

/** Select o input de una barra de filtros: más chico y no ocupa todo el ancho. */
export const selectFiltro = `px-2.5 py-2 sm:text-[11px] cursor-pointer max-w-[170px] ${campoBase} text-[#a6a6b5]`

/**
 * El rótulo de una sección: «TODOS LOS DÍAS», «RANKING POR GRAMOS SECOS».
 *
 * Estaba escrito a mano 190 veces con CUATRO tamaños (9,5 · 10 · 10,5 · 11,5) y
 * CUATRO trackings (0,12 · 0,13 · 0,14 · 0,16). Ninguna de esas diferencias
 * comunicaba nada —entre 9,5 y 10px, o entre 0,12 y 0,14 de tracking, no hay
 * jerarquía que alguien perciba—, pero hacían que dos secciones vecinas no se
 * vieran iguales, que es lo que se lee como app sin terminar.
 *
 * Se unificaron el 28/08/2026. Concatenar los modificadores de layout que haga
 * falta (`mb-1`, `truncate`, `whitespace-nowrap`); lo que no se cambia es el
 * tamaño, el tracking ni el color.
 */
export const rotuloSeccion = 'text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium'

/**
 * La etiqueta de un campo de formulario.
 *
 * Es `rotuloSeccion` en bloque y con aire abajo, y estaba redefinida como
 * `const labelCls` local en 26 archivos — las 26 idénticas, carácter por
 * carácter. Sale de acá para que el día que el rótulo cambie, cambien los 26.
 */
export const etiquetaCampo = `block ${rotuloSeccion} mb-1`

/**
 * La tarjeta. El contenedor de casi todo lo que se ve.
 *
 * Estaba escrita a mano en 68 archivos y DEFINIDA como `const card` local en 24,
 * con cuatro paddings distintos para la misma cosa: `p-3 sm:p-4` (21 veces),
 * `p-4` (15), `p-5` (9) y `p-8` (3). Entre 16 y 20 px de padding nadie percibe
 * jerarquía —no comunican nada— pero hacen que dos pantallas vecinas no se vean
 * iguales, que es exactamente lo que se lee como app sin terminar. Es el mismo
 * problema que tenían la escala de texto y los rótulos, en el contenedor.
 *
 * Gana `p-3 sm:p-4`, que es el más usado y el único que baja el padding en el
 * teléfono: a 375 px, 16 px de aire por lado se comen el 9% del ancho.
 *
 * `tarjetaLimpia` es la misma sin padding, para las que lo manejan adentro
 * —una lista con filas a sangre, una cabecera fija— y llevan `overflow-hidden`.
 */
export const tarjeta = 'rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 sm:p-4'
export const tarjetaLimpia = 'rounded-xl bg-[#101016] border border-[#1f1f2b]'

/**
 * El título de una tarjeta o de una sección.
 *
 * Estaba escrito con SIETE tamaños (12 · 13 · 14 · 15 · 16 · 17 · 20), y los dos
 * que se llevaban casi todo eran 14 (124 usos) y 13 (48). Entre 13 y 14 px no
 * hay jerarquía que alguien perciba; lo que hay es que la misma clase de título
 * se ve distinta según la pantalla en la que caigas.
 *
 * Va en 14, que es el mayoritario. Si hacen falta dos niveles, la respuesta es
 * el peso o el color, no un píxel de diferencia — la misma regla que la escala
 * de cuerpo.
 */
export const tituloSeccion = 'font-display font-semibold text-[14px] text-[#ececf1]'
