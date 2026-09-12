// TODO LO QUE HACE QUE UN MODAL SEA UN DIÁLOGO DE VERDAD.
//
// Se llamaba `useCerrarConAtras` y hacía una sola cosa. Se renombró el
// 02/09/2026 al sumarle la semántica y el foco, porque ya no era «el botón
// atrás»: es el contrato de un diálogo, y lo cumplen los 37 de la app llamando
// a esta única función.
//
//   1. el atrás del teléfono lo cierra (y Escape, que es el mismo gesto)
//   2. se anuncia como diálogo: `role="dialog"`, `aria-modal`, y el título
//      de adentro como nombre
//   3. el foco ENTRA al abrirlo, no se puede tabular afuera, y VUELVE a donde
//      estaba al cerrarlo
//
// Los puntos 2 y 3 faltaban en los 37, medido con la revisión de diseño el
// 02/09: cero `role="dialog"` en toda la app, el foco quedaba en el `<body>` al
// abrir un formulario, y tabulando se salía al fondo en las primeras teclas.
// Para quien navega con teclado eso es un formulario al que no se llega; para
// un lector de pantalla, un pedazo de página que apareció sin avisar.
//
// POR QUÉ UN REF Y NO ATRIBUTOS EN EL JSX
//
// Porque son 37 lugares y cuatro atributos cada uno. Escritos a mano, la
// pregunta no es si alguno va a quedar mal, sino cuál: ya pasó con
// `CATEGORIAS_APLIC` y con `COLOR_FASE`, que estaban copiados en dos pantallas
// y se corrigió una sola. Acá el contrato es una línea —`ref={refDialogo}`— y
// lo que ese contrato implica vive en un solo archivo.
//
// EL REF VA EN EL ELEMENTO CON `fixed inset-0`, el contenedor de pantalla
// completa. No en la caja blanca de adentro: el fondo oscuro es hijo del
// contenedor en unos modales y ES el contenedor en otros —`ModalFormulario`
// pinta el `bg-black/60` sobre el mismo div—, así que «la caja» no es un lugar
// que exista igual en los 37. El contenedor sí. Y `aria-modal` sobre él dice
// exactamente lo que hay que decir: todo lo de afuera queda inerte.
//
// EL PROBLEMA DEL ATRÁS
//
// En el celular un modal ocupa casi todo el alto (`max-h-[92vh]`, pegado abajo).
// Lo que queda tocable del fondo es una franja de arriba que suele caer debajo
// de la barra de estado del sistema. Si además el modal no tiene una X —y el
// visor de documentos no la tenía—, no hay ninguna forma de salir.
//
// Y el reflejo de cualquiera en un teléfono es el botón atrás. Que hasta ahora
// no cerraba el modal: te sacaba de la pantalla, o no hacía nada.
//
// CÓMO FUNCIONA
//
// Al abrirse, el modal empuja una entrada al historial. El atrás consume ESA
// entrada en vez de navegar, y ahí cerramos. Es el comportamiento que la gente
// ya espera de cualquier app.
//
// Si el modal se cierra por otro camino —la X, guardar, cancelar— la limpieza
// saca la entrada que habíamos puesto. Sin eso, el siguiente atrás se comería
// una entrada fantasma y parecería que el botón no anda.
//
// De paso, Escape en teclado, que es el mismo gesto del otro lado.

import { useEffect, useRef } from 'react'

// Los `back()` que disparamos NOSOTROS al limpiar, esperando su popstate.
//
// Sin esto, un modal que se desmonta y se vuelve a montar rapido se cierra
// solo. La limpieza hace `back()`, el popstate de ese back tarda un tick, y
// para cuando llega ya hay un listener nuevo escuchando: lo lee como si la
// persona hubiera apretado atras, y cierra el modal que acababa de abrirse.
//
// Pasa justo cuando la pantalla abre el formulario al llegar por `?nueva=`: en
// desarrollo <StrictMode> monta, desmonta y remonta, y el formulario aparecia y
// desaparecia en el mismo frame. Se leia como que la URL no abria nada, y se
// buscó el problema en `useAbrirAlLlegar`, que no tenia nada que ver.
//
// Cuantos ecos de `back()` propios estan viajando.
//
// El contador vive a nivel de modulo y no en un ref: el que empuja el `back()`
// es la instancia que se va, y la que tiene que ignorar el popstate es la que
// llega. Son dos, y un ref no las cruza.
//
// ⚠ ACA HUBO UNA MARCA DE TIEMPO Y ESTABA MAL. La primera version ignoraba el
// popstate que cayera dentro de una ventana de 150 ms desde el back() propio.
// Con datos de prueba andaba, y en produccion no: entre el `back()` y su
// popstate el navegador tiene que despachar el evento, y si el hilo esta
// ocupado renderizando mil doscientas filas eso tarda MUCHO mas de 150 ms. El
// eco llegaba tarde, se leia como un atras de la persona, y cerraba el
// formulario que se acababa de abrir solo. Medido en produccion: el modal
// aparecia y un popstate lo cerraba enseguida.
//
// Ahora no hay reloj. El que dispara el `back()` deja un contador arriba y un
// oyente de un solo uso que lo baja DESPUES del despacho del evento —por eso el
// setTimeout—, asi que mientras el popstate se esta repartiendo entre los
// listeners el contador sigue en pie y el modal nuevo lo ignora. Y como el que
// baja el contador es el mismo que lo subio, no queda colgado cuando el modal
// se cierra con la X y no hay ningun otro escuchando.
let ecosPendientes = 0

// Cada modal sella SU entrada del historial con un numero propio.
//
// Es la defensa que no depende de adivinar quien mando el popstate. Un popstate
// puede venir del atras de la persona, del eco de un back() nuestro, o de una
// extension del navegador que le mete mano al historial —y eso ultimo no lo
// controlamos—. La pregunta que de verdad importa no es de donde vino, sino si
// se llevo puesta MI entrada: si mi sello sigue siendo el estado actual, mi
// modal no es el que tiene que cerrarse, venga de donde venga el evento.
let ultimoSello = 0

/** Saca del historial la entrada del modal, avisando que el popstate es nuestro. */
function volverSinCerrar(): void {
  ecosPendientes++
  window.addEventListener('popstate', () => {
    // Despues del despacho, no durante: si bajara el contador aca mismo, el
    // listener del modal que viene despues en la fila ya lo veria en cero y
    // cerraria justo lo que estamos protegiendo.
    setTimeout(() => { ecosPendientes = Math.max(0, ecosPendientes - 1) }, 0)
  }, { once: true })
  window.history.back()
}

/** Lo que puede recibir el foco adentro del diálogo, en el orden del tabulador. */
const SELECTOR_FOCO = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',')

const focosDe = (caja: HTMLElement) =>
  Array.from(caja.querySelectorAll<HTMLElement>(SELECTOR_FOCO))
    // Lo que no se ve no se tabula: un control adentro de un desplegable
    // cerrado mide cero y llevaría el foco a un lugar invisible.
    .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0)

let nDialogo = 0

/**
 * Devuelve el ref que va en el elemento `fixed inset-0` del modal.
 *
 * @param onCerrar  qué hacer cuando la persona pide cerrar
 * @param activo    para los modales que se dibujan con `{abierto && …}` dentro
 *                  de un componente que vive siempre
 */
export function useDialogo(onCerrar: () => void, activo = true) {
  const refDialogo = useRef<HTMLDivElement | null>(null)

  // QUIÉN TENÍA EL FOCO ANTES, LEÍDO DURANTE EL RENDER Y NO EN UN EFECTO.
  //
  // Parece el lugar equivocado y es el único que funciona. React aplica el
  // `autoFocus` de un campo en el commit, o sea ANTES de que corra cualquier
  // efecto —incluso un `useLayoutEffect`—, así que un hook que lea
  // `document.activeElement` desde un efecto se encuentra con el input del
  // propio modal y no con el botón que lo abrió.
  //
  // Medido el 02/09/2026: de los 21 formularios de la revisión, los 6 que
  // tienen `autoFocus` —Genética, Grupo, Área, Visita, Paciente y Movimiento
  // interno— guardaban su propio campo. Al cerrarse, ese campo ya no existía y
  // no había a dónde volver: el foco quedaba en el `<body>` y el siguiente Tab
  // arrancaba desde arriba de la página.
  //
  // El render es el último instante en que `activeElement` todavía es el botón.
  // Escribir un ref ahí es la inicialización perezosa que React admite: se
  // escribe una sola vez por apertura, y con StrictMode renderizando dos veces
  // el resultado es el mismo.
  // Se lee UNA sola vez por apertura, en el render donde `activo` pasa a true.
  //
  // La primera versión lo vaciaba en el render con `activo` en false, y eso
  // rompía justo a los modales que viven siempre y se controlan con `activo`
  // —el cajón del menú, «Crear grupo»—: al cerrar, React renderiza con
  // `activo: false` ANTES de correr la limpieza del efecto, así que para cuando
  // había que devolver el foco el ref ya estaba vacío. Se marcaba el cierre y
  // enseguida se borraba con qué cerrarlo.
  const focoPrevio = useRef<HTMLElement | null>(null)
  const estabaActivo = useRef(false)
  if (activo && !estabaActivo.current) {
    focoPrevio.current = document.activeElement as HTMLElement | null
  }
  estabaActivo.current = activo
  // Por referencia: si el padre recrea la función en cada render —y casi siempre
  // la recrea, es una flecha en el JSX— ponerla en las dependencias haría que el
  // efecto se rearme solo, empujando una entrada al historial por render.
  const cerrar = useRef(onCerrar)
  // La asignacion va en un efecto, no en el render: escribir un ref mientras se
  // renderiza es lo que React marca como error. Con `useEffect` sin arreglo de
  // dependencias corre despues de cada commit, que es cuando hace falta: el
  // popstate y el Escape siempre llegan despues, nunca durante el render.
  useEffect(() => { cerrar.current = onCerrar })

  useEffect(() => {
    // `activo` es para los modales que se dibujan con `{abierto && (…)}` dentro
    // de un componente que vive siempre. Ahí el hook no se puede montar y
    // desmontar con el modal, así que se le dice cuándo está abierto. Sin esto
    // empujaría una entrada al historial estando cerrado, y el atrás no haría
    // nada visible una vez por cada pantalla visitada.
    if (!activo) return

    const miSello = ++ultimoSello
    window.history.pushState({ modalAbierto: true, modalSello: miSello }, '')

    const alVolver = () => {
      // Mi entrada sigue siendo la actual: este popstate no me saca a mi.
      if (window.history.state?.modalSello === miSello) return
      // El eco de un `back()` de limpieza, no un atras de la persona. No se
      // descuenta aca: de eso se encarga el que lo empujo.
      if (ecosPendientes > 0) return
      cerrar.current()
    }
    // ESCAPE Y TABULADOR, EN EL MISMO OYENTE.
    //
    // El Tab se atiende en captura y sobre `window`, no sobre la caja del
    // diálogo: si el foco ya se escapó al fondo —porque alguien tabuló antes de
    // que este efecto corriera, o porque el navegador lo movió solo— un oyente
    // colgado de la caja no se entera nunca, y la trampa no atrapa justo cuando
    // hace falta.
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { cerrar.current(); return }
      if (e.key !== 'Tab') return
      const caja = refDialogo.current
      if (!caja) return
      const focos = focosDe(caja)
      if (focos.length === 0) { e.preventDefault(); caja.focus(); return }
      const primero = focos[0], ultimo = focos[focos.length - 1]
      const actual = document.activeElement
      // Fuera de la caja: se lo trae de vuelta al extremo por el que iba.
      if (!caja.contains(actual)) {
        e.preventDefault()
        ;(e.shiftKey ? ultimo : primero).focus()
        return
      }
      // Y en los bordes se da la vuelta, que es lo que hace que sea una trampa
      // y no un tope.
      if (e.shiftKey && (actual === primero || actual === caja)) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && actual === ultimo) { e.preventDefault(); primero.focus() }
    }

    window.addEventListener('popstate', alVolver)
    window.addEventListener('keydown', alTeclear, true)

    // EL FOCO ENTRA AL DIÁLOGO, Y ENTRA AL CONTENEDOR — NO AL PRIMER CAMPO.
    //
    // Mandarlo al primer `<input>` es lo que se suele hacer y acá estaría mal:
    // en el teléfono eso levanta el teclado del sistema, que tapa media
    // pantalla justo cuando la persona todavía no leyó de qué se trata el
    // formulario. El contenedor con `tabIndex=-1` recibe el foco sin ser
    // tabulable, el lector de pantalla lee el título, y el primer Tab lleva al
    // primer campo.
    //
    // Si un modal quiere el foco en un campo puntual, para eso está `autoFocus`
    // en ese campo: gana, porque corre después.
    const caja = refDialogo.current
    if (caja) {
      caja.setAttribute('role', 'dialog')
      caja.setAttribute('aria-modal', 'true')
      // El nombre del diálogo es su título, que es el que la persona ve. Sólo
      // se pone un `aria-label` de descarte si no hay ninguno: un diálogo que
      // se anuncia como «diálogo» y nada más no dice qué se abrió.
      const titulo = caja.querySelector('h1, h2, h3, h4')
      if (titulo) {
        if (!titulo.id) titulo.id = `dialogo-titulo-${++nDialogo}`
        caja.setAttribute('aria-labelledby', titulo.id)
      } else if (!caja.hasAttribute('aria-label')) {
        caja.setAttribute('aria-label', 'Diálogo')
      }
      if (!caja.hasAttribute('tabindex')) caja.tabIndex = -1
      if (!caja.contains(document.activeElement)) caja.focus({ preventScroll: true })
    }

    return () => {
      window.removeEventListener('popstate', alVolver)
      window.removeEventListener('keydown', alTeclear, true)
      // EL FOCO VUELVE DE DONDE VINO.
      //
      // Sin esto, cerrar un formulario deja el foco en el `<body>` y el próximo
      // Tab arranca desde el principio de la página: quien abrió el modal desde
      // la fila número cuarenta vuelve arriba de todo. Se comprueba que el
      // elemento siga en el documento, porque muchas veces la fila que lo abrió
      // desaparece justo por lo que el modal acaba de guardar.
      // NO SE VACIA EL REF ACA, y eso importa: en desarrollo <StrictMode>
      // monta, limpia y vuelve a montar, asi que esta limpieza corre una vez de
      // mas ANTES de que el modal se haya usado. Vaciandolo, la apertura buena
      // se quedaba sin nada que devolver — y el render, que es el unico momento
      // en que se puede leer el foco anterior, ya habia pasado. Se vacia en el
      // render, cuando `activo` pasa a false.
      const previo = focoPrevio.current
      // `isConnected` porque muchas veces la fila que abrió el modal desaparece
      // justo por lo que el modal acaba de guardar. Y nunca el `<body>`: ahí
      // `focus()` no hace nada y el chequeo daría por buena una devolución que
      // no ocurrió.
      if (previo && previo !== document.body && previo.isConnected) {
        previo.focus({ preventScroll: true })
      }
      // Sólo si la entrada sigue siendo la nuestra: si el atrás ya la consumió,
      // otro `back()` acá sacaría a la persona de la pantalla.
      // Sólo si la entrada que sigue arriba es la MIA. Con el sello, un modal
      // no le saca del historial la entrada a otro.
      if (window.history.state?.modalSello === miSello) volverSinCerrar()
    }
  }, [activo])

  return refDialogo
}
