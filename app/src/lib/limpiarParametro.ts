// Saca un parámetro de la URL sin pisar lo que otro hook acaba de sacar.
//
// El problema aparece cuando dos hooks limpian parámetros distintos en la misma
// pantalla. `useAbrirAlLlegar` saca `nueva` y `useIrASeccion` saca `ir`; los dos
// leen el `search` del MISMO render, así que el segundo escribe una copia que
// todavía tenía el parámetro que el primero acababa de borrar. Se veía como que
// `?nueva=1` no se iba nunca.
//
// La solución es no confiar en NINGUN valor del render: leer `window.location`
// entera —search y pathname— en el momento de escribir, que ya refleja lo que
// pasó recién. Confiar en el pathname del render costó un segundo bug, contado
// abajo.

import type { NavigateFunction } from 'react-router-dom'

export function limpiarParametro(
  clave: string, navegar: NavigateFunction, soloSiEstamosEn?: string,
): void {
  // Si la pantalla ya cambio, esto no es asunto nuestro.
  //
  // El hook que limpia vive en la pantalla que se esta yendo. Cuando `avanzar()`
  // lleva al paso siguiente, la ruta nueva trae SU PROPIO `?nueva=` para abrir
  // el formulario que corresponde alla. Sin este corte, el hook de la pantalla
  // vieja le borraba ese parametro a la pantalla nueva y el formulario no abria:
  // se guardaba el gasto, se llegaba a Documentos, y no pasaba nada.
  //
  // Es el MISMO pathname del render que antes se usaba para escribir —y eso era
  // el bug—: sirve para saber si seguimos donde estabamos, nunca para decidir
  // adonde ir.
  const aca = window.location.pathname
  if (soloSiEstamosEn != null && soloSiEstamosEn !== aca) return
  const params = new URLSearchParams(window.location.search)
  if (!params.has(clave)) return
  params.delete(clave)
  const query = params.toString()
  // EL PATHNAME TAMBIEN SE LEE VIVO, y esa es la parte que costo un bug.
  //
  // Antes lo pasaba el llamador desde su render. Cuando `avanzar()` navegaba a
  // la pantalla del paso siguiente, el hook del componente que se estaba yendo
  // limpiaba `nueva` con SU pathname —el viejo— y reescribia esa ruta encima,
  // deshaciendo la navegacion. Se veia asi: se guardaba un gasto, la barra
  // pasaba al paso 2 y el formulario del comprobante no abria nunca porque la
  // pantalla se quedaba en Economia. La URL lo delataba: search NUEVO —traia el
  // `asiento=` recien puesto— y pathname VIEJO.
  navegar(aca + (query ? `?${query}` : ''), { replace: true })
}
