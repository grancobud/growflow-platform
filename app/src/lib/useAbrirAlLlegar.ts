// Abre un formulario apenas se llega a la pantalla, si la URL lo pide.
//
// Las acciones de «¿Qué querés hacer?» dejaban en la LISTA. Después de elegir
// «Entregarle a un paciente» todavía había que encontrar el botón de nueva
// dispensa, que es exactamente el paso que la acción venía a evitar: la guía
// acompañaba hasta la puerta y ahí soltaba.
//
// Con `?nueva=1` el formulario ya está abierto al llegar.
//
// El parámetro se limpia con `limpiarParametro`, que lee la URL viva en vez del
// valor del render: en esta misma pantalla hay otro hook sacando `ir`, y si los
// dos escribieran su copia del render, el segundo restauraría lo que el primero
// borró.
//
// Y se limpia enseguida, que no es un detalle: si quedara en la URL,
// cerrar el formulario y recargar volvería a abrirlo, y el botón «atrás» del
// navegador quedaría atrapado reabriéndolo una y otra vez. Se reemplaza la
// entrada del historial en vez de agregar una nueva, así que atrás sigue
// llevando a donde estabas antes.

import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { limpiarParametro } from './limpiarParametro'

/**
 * Si a ESTE hook le toca borrar el `?nueva=` que hay ahora en la URL.
 *
 * Está afuera del hook para poder probarla: son dos condiciones chicas que ya
 * fallaron las dos, y cada una dejó el mismo síntoma —un paso del flujo que no
 * abre nada y no dice por qué—.
 *
 * @param enLaUrl  El `?nueva=` que hay AHORA (la URL viva, no la del render).
 * @param clave    La clave de este hook.
 * @param abrio    Si este hook llegó a abrir su formulario.
 */
export function debeLimpiar(
  enLaUrl: string | null, clave: string, abrio: boolean,
): boolean {
  // Lo que hay en la URL es de OTRO hook: borrarlo le rompe el paso a él.
  if (enLaUrl !== clave) return false
  // Y si este hook nunca abrió nada, no tiene nada que limpiar. Dos hooks de la
  // misma pantalla comparten el booleano de «hay un modal abierto», así que sin
  // esto uno se atribuye la apertura del otro.
  return abrio
}

/**
 * @param abrir  Qué hacer al llegar. Típicamente `() => setForm({...})`.
 *               Puede devolver `false` para decir «todavía no puedo» —por
 *               ejemplo, la fila que hay que abrir aún no llegó de la base— y
 *               entonces se vuelve a intentar en el próximo render en vez de
 *               darse por hecho. No devolver nada cuenta como abierto.
 * @param clave  El valor que tiene que traer `?nueva=` para que dispare. Sirve
 *               cuando una pantalla tiene más de un formulario: `?nueva=traslado`
 *               abre el de traslados y no el de declaraciones juradas.
 */
export function useAbrirAlLlegar(abrir: () => void | boolean, clave = '1', abierto?: boolean) {
  const { search, pathname } = useLocation()
  const navegar = useNavigate()
  // Una sola vez por llegada. Sin esto, cualquier re-render que ocurra antes de
  // que la URL se limpie vuelve a abrir el formulario y pisa lo tipeado.
  const yaAbrio = useRef(false)

  // Si el formulario llegó a estar abierto en ESTE montaje. Es lo que separa
  // «todavía no abrió» de «ya lo abrió y la persona lo cerró».
  const estuvoAbierto = useRef(false)

  // ⚠ Sólo se limpia el `nueva` PROPIO.
  //
  // En una misma pantalla hay más de un hook mirando el mismo parámetro con
  // claves distintas, y el flujo «Sumar a alguien» los encadena: se guarda la
  // ficha (`nueva=1`), el flujo navega al paso 2 poniendo `nueva=tope`, y recién
  // entonces el modal del paso 1 termina de cerrarse y dispara SU limpieza. Como
  // borraba por NOMBRE de parámetro, se llevaba puesto el `nueva=tope` del paso
  // siguiente. Medido interceptando el history:
  //
  //   pushState     ?nueva=tope&flujo=sumar&paso=2&paciente=…   <- avanzar()
  //   replaceState  ?flujo=sumar&paso=2&paciente=…              <- limpiarParametro
  //
  // La barra decía «paso 2 de 3» y la pantalla no hacía nada. El paso 2 nunca
  // llegó a estar roto: la URL que necesitaba se la borraba el paso 1.
  //
  // Lee la URL VIVA y no el `search` del render: para cuando esto corre, la
  // navegación al paso siguiente ya ocurrió.
  const limpiarSiEsMio = useCallback(() => {
    const enLaUrl = new URLSearchParams(window.location.search).get('nueva')
    if (!debeLimpiar(enLaUrl, clave, yaAbrio.current)) return
    limpiarParametro('nueva', navegar, pathname)
  }, [clave, navegar, pathname])

  useEffect(() => {
    const params = new URLSearchParams(search)
    if (params.get('nueva') !== clave) return
    // Abrir una sola vez por montaje.
    //
    // ⚠ El latch se pone cuando el formulario ABRIO DE VERDAD, no cuando se
    // intentó. Estaba al revés —se marcaba antes de llamar— y eso mataba al
    // único caso que necesita reintentar: el paso «El tope mensual» de «Sumar a
    // alguien» reabre la ficha de la persona que se acaba de crear, buscándola
    // por el id que trae la URL. Entre que se guarda y que la lista se recarga
    // pasan cientos de milisegundos, así que el primer intento no la encuentra y
    // no abre nada. Con el latch ya puesto, el reintento que las dependencias
    // permiten —`abrir` cambia de identidad cuando llega la lista— quedaba
    // bloqueado, y el paso 2 no abría NUNCA: la barra decía «paso 2 de 3» y no
    // pasaba nada.
    //
    // Un `abrir` que devuelve `false` dice «todavía no puedo». Los que no
    // devuelven nada se comportan como antes.
    if (!yaAbrio.current) {
      if (abrir() !== false) yaAbrio.current = true
    }

    // Cuando el llamador informa si el formulario está abierto, el parámetro NO
    // se borra por tiempo: se borra cuando el formulario se cierra de verdad.
    //
    // Es la diferencia entre suponer y saber. Borrarlo apenas se llama a
    // `abrir()` —o un tick después— apuesta a que el formulario va a sobrevivir,
    // y a veces no sobrevive: la pantalla se vuelve a montar mientras llegan los
    // datos y el formulario muere con ella. Si para entonces la URL ya estaba
    // limpia, nada lo reabre: queda la barra de pasos arriba y ningún
    // formulario. Medido en producción, con miles de filas: el modal aparecía y
    // desaparecía sin que ningún `popstate` lo tocara.
    //
    // Dejando el parámetro puesto mientras el formulario vive, el montaje nuevo
    // lo vuelve a leer y abre de nuevo, tarde lo que tarde.
    if (abierto !== undefined) return

    // El parámetro se borra en el commit SIGUIENTE, y no si este componente se
    // fue antes.
    //
    // Borrarlo en el mismo momento que se abre el formulario da por hecho que
    // el formulario va a sobrevivir, y muchas veces no sobrevive: la pantalla
    // de la O.N.G. monta sus tablas recién cuando llegan los datos, así que el
    // componente puede montarse y volver a montarse mientras la base contesta.
    // Si en ese momento la URL ya estaba limpia, el formulario abierto moría
    // con el montaje viejo y NADA lo volvía a abrir: quedaba la barra de pasos
    // arriba, la pantalla correcta abajo, y ningún formulario. Con datos de
    // prueba no se ve —todo llega en un frame— y con miles de filas sí.
    //
    // Dejando el parámetro puesto, el montaje nuevo lo vuelve a leer y abre de
    // nuevo. Se repara solo en vez de depender de que el primer intento salga
    // bien.
    //
    // Y acá también se limpia SÓLO el propio: para cuando este timeout corre, el
    // flujo ya pudo haber navegado al paso siguiente y puesto SU `nueva`.
    const alSiguienteCommit = setTimeout(() => limpiarSiEsMio(), 0)
    return () => clearTimeout(alSiguienteCommit)
  }, [search, pathname, clave, abrir, navegar, abierto, limpiarSiEsMio])

  // El parámetro se va cuando el formulario se cerró, no antes.
  //
  // Si no se sacara, cerrar y recargar volvería a abrirlo, y el botón «atrás»
  // quedaría atrapado reabriéndolo. Se reemplaza la entrada del historial en vez
  // de agregar una nueva, así que atrás sigue llevando a donde estabas.
  // `search` está en las dependencias a propósito, y `estuvoAbierto` NO se baja:
  // el modal, al cerrarse, hace `history.back()` para sacar su entrada, y ese
  // back DESHACE la navegación que acababa de limpiar el parámetro —volviendo a
  // una entrada que todavía lo tenía—. Reaccionando también al cambio de
  // `search`, la limpieza se vuelve a aplicar sobre la URL restaurada y termina
  // ganando. Sin bucle: cuando el parámetro ya no está, `limpiarParametro` sale
  // sin tocar nada.
  useEffect(() => {
    if (abierto === undefined) return
    // ⚠ «Estuvo abierto» significa que lo abrió ESTE hook, no que haya un modal
    // abierto en la pantalla.
    //
    // Dos hooks de la misma pantalla suelen compartir el MISMO booleano —en
    // Pacientes los dos reciben `modalForm`, porque hay un solo modal que sirve
    // para las dos cosas—. Sin `yaAbrio`, el hook de `tope` marcaba «estuve
    // abierto» mientras lo que estaba abierto era el formulario del hook de `1`,
    // y al cerrarse ese modal corría SU limpieza sobre un `nueva=tope` que él
    // mismo acababa de recibir del flujo. O sea: se borraba su propio parámetro
    // por un formulario que nunca abrió, y el paso 2 quedaba mudo.
    //
    // Con este filtro, cada hook limpia sólo después de haber abierto de verdad.
    if (abierto) { if (yaAbrio.current) estuvoAbierto.current = true; return }
    if (!estuvoAbierto.current) return
    limpiarSiEsMio()

    // Y otra vez cuando vuelva el eco del `back()`.
    //
    // La limpieza de arriba se aplica sobre la entrada del MODAL, que es la que
    // esta arriba en ese momento. La entrada de ABAJO nunca se toco, y todavia
    // tiene el parametro. Cuando el modal se desmonta hace `history.back()` para
    // sacar la suya, esa entrada de abajo vuelve a ser la actual, y el parametro
    // reaparece en la barra de direcciones. Recargar esa URL reabre el
    // formulario que la persona acababa de cerrar.
    //
    // Medido en el build de produccion, cerrando con la X:
    //     MODAL DESAPARECIO :: /ong/dispensas          <- limpia
    //     POPSTATE          :: /ong/dispensas?nueva=1  <- el back lo resucita
    //
    // Cerrando con el atras no pasa: ahi la entrada del modal ya la consumio la
    // persona, no hay `back()` de limpieza, y la URL queda limpia sola.
    //
    // Se escucha el `popstate` NATIVO y no el `search` del router. Tener
    // `search` en las dependencias deberia alcanzar, y no alcanza: el modal
    // empuja su entrada con `history.pushState` directo, sin pasar por el
    // router, asi que el router nunca supo de esa entrada y el ida y vuelta lo
    // deja sin novedad que propagar. El evento del navegador, en cambio, llega
    // siempre. `limpiarParametro` ya lee la URL viva, no la del render.
    const alVolver = () => {
      // Si el atras llevo a OTRA pantalla, no es asunto nuestro: limpiar aca
      // reescribiria la URL de una ruta que ya no es esta.
      if (window.location.pathname !== pathname) return
      limpiarSiEsMio()
    }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [abierto, search, pathname, navegar, limpiarSiEsMio])
}
