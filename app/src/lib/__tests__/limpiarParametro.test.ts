// Limpiar un parámetro no puede llevarte de vuelta a la pantalla anterior.
//
// EL BUG, del 23/08/2026: se cargaba un gasto, aparecía «Asiento guardado», la
// barra pasaba al paso 2 —«El comprobante que lo respalda»— y el formulario del
// comprobante NO se abría. La pantalla se quedaba en Economía.
//
// Medido en el navegador, la URL terminaba así:
//
//     /ong/economia?flujo=gasto&paso=2&asiento=a797ff67…
//
// El `search` era el NUEVO —trae el `asiento=` que puso `avanzar()`— y el
// pathname era el VIEJO. Esa combinación sólo la puede producir esta función:
// leía `window.location.search` en el momento de escribir, pero el `pathname`
// se lo pasaba el llamador desde su render. Cuando `avanzar()` navegaba a otra
// pantalla, el hook del componente que se estaba yendo limpiaba `nueva` y
// reescribía el pathname viejo encima, pisando la navegación.
//
// No hubo ningún `popstate`: no era el `back()` del modal, que fue el primer
// sospechoso por parecido con el bug anterior.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { limpiarParametro } from '../limpiarParametro'
import type { NavigateFunction } from 'react-router-dom'

/**
 * Pone la URL viva, que es la que la función tiene que mirar.
 *
 * Los tests de este repo corren en Node y NO hay jsdom, así que `window` no
 * existe: se arma el mínimo que la función usa. Es a propósito que sea tan
 * poquito —sólo `location`—, porque deja a la vista qué es lo único que esta
 * función toca del navegador.
 */
function enLaUrl(url: string) {
  const u = new URL(url, 'https://app.test')
  const g = globalThis as unknown as { window?: { location: unknown } }
  if (!g.window) g.window = { location: {} }
  g.window.location = { pathname: u.pathname, search: u.search, href: u.href }
}

describe('limpiarParametro', () => {
  let navegar: NavigateFunction

  beforeEach(() => { navegar = vi.fn() as unknown as NavigateFunction })

  it('saca el parámetro y deja los demás', () => {
    enLaUrl('/ong/dispensas?nueva=1&flujo=entregar&paso=1')
    limpiarParametro('nueva', navegar)
    expect(navegar).toHaveBeenCalledWith('/ong/dispensas?flujo=entregar&paso=1', { replace: true })
  })

  it('no toca nada si el parámetro ya no está', () => {
    enLaUrl('/ong/dispensas?flujo=entregar')
    limpiarParametro('nueva', navegar)
    expect(navegar).not.toHaveBeenCalled()
  })

  it('usa el pathname de la URL VIVA, no el de la pantalla que se está yendo', () => {
    // El corazón del bug. `avanzar()` ya llevó a /ong/documentos, y el hook que
    // limpia vive en el componente que se está yendo. Si la función usara el
    // pathname de ese render —/ong/economia— desharía la navegación.
    enLaUrl('/ong/documentos?nueva=gasto&flujo=gasto&paso=2&asiento=abc')
    limpiarParametro('nueva', navegar)
    const destino = (navegar as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]
    expect(destino).toContain('/ong/documentos')
    expect(destino).not.toContain('/ong/economia')
  })

  it('conserva el resto de la URL viva al limpiar', () => {
    enLaUrl('/ong/documentos?nueva=gasto&flujo=gasto&paso=2&asiento=abc')
    limpiarParametro('nueva', navegar)
    expect(navegar).toHaveBeenCalledWith(
      '/ong/documentos?flujo=gasto&paso=2&asiento=abc', { replace: true })
  })

  it('NO limpia si la pantalla ya cambió: ese parámetro es de la pantalla nueva', () => {
    // El segundo tramo del mismo bug. `avanzar()` llevó a Documentos, y la ruta
    // del paso 2 trae SU propio `?nueva=gasto` para abrir el comprobante allá.
    // El hook que limpia vive en Economía, que se está yendo: si borra, le saca
    // el parámetro a la pantalla nueva y el formulario no abre nunca.
    enLaUrl('/ong/documentos?nueva=gasto&flujo=gasto&paso=2')
    limpiarParametro('nueva', navegar, '/ong/economia')
    expect(navegar).not.toHaveBeenCalled()
  })

  it('sí limpia cuando seguimos en la misma pantalla', () => {
    enLaUrl('/ong/dispensas?nueva=1&flujo=entregar')
    limpiarParametro('nueva', navegar, '/ong/dispensas')
    expect(navegar).toHaveBeenCalledWith('/ong/dispensas?flujo=entregar', { replace: true })
  })

  it('deja la ruta sin «?» cuando no queda ningún parámetro', () => {
    enLaUrl('/ong/pacientes?nueva=1')
    limpiarParametro('nueva', navegar)
    expect(navegar).toHaveBeenCalledWith('/ong/pacientes', { replace: true })
  })

  it('reemplaza la entrada, no agrega una: atrás sigue llevando a donde estabas', () => {
    enLaUrl('/ong/dispensas?nueva=1')
    limpiarParametro('nueva', navegar)
    expect(navegar).toHaveBeenCalledWith(expect.anything(), { replace: true })
  })
})
