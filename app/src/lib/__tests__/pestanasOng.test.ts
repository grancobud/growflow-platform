// La relación pestaña ↔ grupo tiene un invariante que no avisa cuando se rompe.
//
// La segunda fila de la barra muestra sólo las pestañas del grupo elegido. Una
// pestaña que se agrega y no se mete en ningún grupo queda INALCANZABLE: no da
// error, no rompe nada, y no se ve. La pantalla simplemente deja de existir para
// quien la busca, y eso se descubre cuando alguien pregunta dónde está.

import { describe, it, expect } from 'vitest'
import { TABS, GRUPOS, GRUPO_DE, TABS_DE_PLATA, esTab, type Tab } from '../pestanasOng'

describe('pestañas de O.N.G.', () => {
  it('toda pestaña está en algún grupo', () => {
    const huerfanas = TABS.filter(t => !GRUPO_DE.has(t.id)).map(t => t.id)
    expect(huerfanas).toEqual([])
  })

  it('ninguna pestaña está en dos grupos', () => {
    const vistas = GRUPOS.flatMap(g => g.tabs)
    const repetidas = vistas.filter((t, i) => vistas.indexOf(t) !== i)
    expect(repetidas).toEqual([])
  })

  it('ningún grupo nombra una pestaña que no existe', () => {
    const ids = new Set(TABS.map(t => t.id))
    const fantasmas = GRUPOS.flatMap(g => g.tabs).filter(t => !ids.has(t))
    expect(fantasmas).toEqual([])
  })

  it('ningún grupo queda vacío: sería un botón que no lleva a ningún lado', () => {
    expect(GRUPOS.filter(g => g.tabs.length === 0).map(g => g.id)).toEqual([])
  })

  it('los ids de pestaña sirven como segmento de URL', () => {
    // Van en /ong/<id>: con una mayúscula, un espacio o un acento, el link que
    // arma Coherencia no matchearía la ruta.
    const feos = TABS.map(t => t.id).filter(id => !/^[a-z][a-z0-9-]*$/.test(id))
    expect(feos).toEqual([])
  })

  it('esTab reconoce las que existen y rechaza el resto', () => {
    expect(esTab('entidad')).toBe(true)
    expect(esTab('inventada')).toBe(false)
    expect(esTab(undefined)).toBe(false)
    expect(esTab('')).toBe(false)
  })

  it('el grupo Panel arranca en Estado, que es la pantalla de entrada', () => {
    expect(GRUPOS[0].tabs[0]).toBe<Tab>('estado')
  })
})

// Las pestanias que muestran plata.
//
// Salio de probar el rol `administrador_sistema` el 30/08/2026: entraba a
// Movimientos y veia «$XX / $XX / 0 asientos», y a Economia «Sin asientos
// cargados». No era un error de carga: era el RLS devolviendole cero filas. Una
// pantalla vacia por permiso se lee como una pantalla rota.
describe('TABS_DE_PLATA', () => {
  it('todas existen', () => {
    for (const t of TABS_DE_PLATA) {
      expect(TABS.some(x => x.id === t)).toBe(true)
    }
  })

  // `documentos` no es «papeles»: son 1.551 comprobantes por $X,X millones,
  // incluidas las retribuciones de los socios. Y `proveedores` muestra pagos.
  it('incluye las cuatro que muestran importes', () => {
    expect(TABS_DE_PLATA).toContain('movimientos')
    expect(TABS_DE_PLATA).toContain('economia')
    expect(TABS_DE_PLATA).toContain('documentos')
    expect(TABS_DE_PLATA).toContain('proveedores')
  })

  // Si se esconden, tienen que seguir alcanzables para quien SI ve plata: una
  // pestania que no esta en ningun grupo es una pantalla que dejo de existir.
  it('todas siguen viviendo en un grupo', () => {
    for (const t of TABS_DE_PLATA) {
      expect(GRUPO_DE.get(t)).toBeTruthy()
    }
  })

  it('no esconde nada que no muestre plata', () => {
    expect(TABS_DE_PLATA).not.toContain('estado')
    expect(TABS_DE_PLATA).not.toContain('pacientes')
    expect(TABS_DE_PLATA).not.toContain('actas')
    expect(TABS_DE_PLATA).not.toContain('entidad')
  })
})
