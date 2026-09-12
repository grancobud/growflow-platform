// Una guía a medio escribir es peor que ninguna.
//
// Si falta el `porQue`, el formulario se abre con un recuadro vacío que ocupa
// lugar y no dice nada. Si una ayuda de campo repite la etiqueta, agrega ruido
// sin agregar información. Y si una acción promete una guía que no existe, el
// recuadro simplemente no aparece y nadie se entera de que falta.

import { describe, it, expect } from 'vitest'
import { GUIAS, guiaDe } from '../guiasFormulario'
import { accionesOng } from '../accionesOng'

const ids = Object.keys(GUIAS)

describe('guías de formulario', () => {
  it('todas tienen título, para qué sirve, y qué hace falta', () => {
    const incompletas = ids.filter(id => {
      const g = GUIAS[id]
      return !g.titulo?.trim() || !g.porQue?.trim()
    })
    expect(incompletas).toEqual([])
  })

  it('el «para qué» explica, no repite el título', () => {
    // «Entregarle a un paciente → Entregás a un paciente» no le sirve a nadie.
    const vagas = ids.filter(id => {
      const g = GUIAS[id]
      return g.porQue.trim().toLowerCase() === g.titulo.trim().toLowerCase()
    })
    expect(vagas).toEqual([])
  })

  it('ninguna ayuda de campo repite la etiqueta del campo', () => {
    const repes: string[] = []
    for (const id of ids) {
      for (const [campo, texto] of Object.entries(GUIAS[id].campos ?? {})) {
        if (texto.trim().toLowerCase() === campo.trim().toLowerCase()) repes.push(`${id}.${campo}`)
      }
    }
    expect(repes).toEqual([])
  })

  it('las ayudas dicen algo, no son una palabra suelta', () => {
    const cortas: string[] = []
    for (const id of ids) {
      for (const [campo, texto] of Object.entries(GUIAS[id].campos ?? {})) {
        if (texto.trim().length < 25) cortas.push(`${id}.${campo}`)
      }
    }
    expect(cortas).toEqual([])
  })

  it('guiaDe devuelve null para lo que no existe, sin explotar', () => {
    expect(guiaDe('no-existe')).toBeNull()
    expect(guiaDe('')).toBeNull()
  })

  it('cada acción que abre un formulario tiene su guía escrita', () => {
    // Si una acción manda a un formulario con ?nueva= es porque ahí se carga
    // algo, y ahí es donde la guía tiene que estar.
    const completo = {
      entidad: null, pacientes: 5,
      lotes: [{ gramos_totales: 1 }], asociados: [], cuotas: [],
    }
    const conFormulario = accionesOng(completo).filter(a => a.ruta.includes('?nueva='))
    expect(conFormulario.length).toBeGreaterThan(0)
    // El vinculo es explicito: cada accion declara que guia usa.
    const sinDeclarar = conFormulario.filter(a => !a.guia)
    expect(sinDeclarar.map(a => a.id)).toEqual([])
    const apuntanAlVacio = conFormulario.filter(a => a.guia && !guiaDe(a.guia))
    expect(apuntanAlVacio.map(a => a.guia)).toEqual([])
  })
  it('TODA acción declara su guía: ninguna queda muda', () => {
    // La guía es lo que convierte un formulario en algo que se puede llenar sin
    // saber de antemano de dónde sale cada dato. Una acción sin guía manda a una
    // pantalla y ahí suelta, que es de donde veníamos.
    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    const sinGuia = accionesOng(vacio).filter(a => !a.guia).map(a => a.id)
    expect(sinGuia).toEqual([])
  })

  it('ninguna acción apunta a una guía que no existe', () => {
    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    const fantasmas = accionesOng(vacio)
      .filter(a => a.guia && !guiaDe(a.guia))
      .map(a => `${a.id} -> ${a.guia}`)
    expect(fantasmas).toEqual([])
  })

  it('ninguna guía queda huérfana: si nadie la usa, o sobra o falta cablearla', () => {
    // El reverso del test de arriba, y el que faltaba. Una guía escrita que
    // ningún formulario ni acción invoca no rompe nada visible —simplemente
    // nunca se muestra—, así que se queda ahí para siempre. Fue exactamente lo
    // que pasó: se escribió `asociado` sin ver que ya existía `socio`, los dos
    // decían lo mismo, y el formulario de Asociados no mostraba ninguna de las
    // dos. Nada falló; la ayuda simplemente no estaba.
    // Se leen las fuentes con import.meta.glob y no con fs: es lo que ya usa
    // Vite, no necesita @types/node, y typechea.
    const fuentes = Object.values(
      import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
    ) as string[]

    // Las que invoca un formulario están escritas a mano en el JSX.
    const enFormularios = new Set<string>()
    for (const src of fuentes) {
      for (const m of src.matchAll(/GuiaDelFormulario\s+id="([a-zA-Z]+)"/g)) {
        enFormularios.add(m[1])
      }
    }
    expect(enFormularios.size).toBeGreaterThan(0) // si el regex deja de matchear, el test no prueba nada

    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    const usadas = new Set([
      ...enFormularios,
      ...accionesOng(vacio).map(a => a.guia).filter(Boolean) as string[],
    ])

    const huerfanas = ids.filter(id => !usadas.has(id))
    expect(huerfanas).toEqual([])
  })
})

describe('ayudas de campo', () => {
  it('ninguna queda huérfana: escrita y sin dibujarse en ningún formulario', () => {
    // El mismo agujero que las guías, un nivel más abajo. `campos` es un
    // Record<string, string> suelto: escribir una clave no obliga a nadie a
    // renderizarla, y `AyudaCampo` con un campo que no existe en la guía no
    // dibuja nada y no falla. Las dos mitades pueden no encontrarse nunca.
    //
    // Cuando eso pasa no hay error: el campo simplemente sale pelado, igual que
    // antes de que alguien se tomara el trabajo de escribir de dónde sale el
    // dato. Fue exactamente el caso: la mitad de las ayudas escritas no llegaba
    // a la pantalla, y las de Autoridades incluían un «Mandato hasta» para un
    // campo que el formulario ni siquiera pedía.
    const fuentes = Object.values(
      import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
    ) as string[]

    const dibujadas = new Set<string>()
    for (const src of fuentes) {
      for (const m of src.matchAll(/AyudaCampo\s+id="([a-zA-Z]+)"\s+campo="([^"]+)"/g)) {
        dibujadas.add(`${m[1]}.${m[2]}`)
      }
    }
    expect(dibujadas.size).toBeGreaterThan(0) // si el regex deja de matchear, el test no prueba nada

    const huerfanas: string[] = []
    for (const id of ids) {
      for (const campo of Object.keys(GUIAS[id].campos ?? {})) {
        if (!dibujadas.has(`${id}.${campo}`)) huerfanas.push(`${id}.${campo}`)
      }
    }
    expect(huerfanas).toEqual([])
  })

  it('ningún AyudaCampo apunta a un campo que nadie escribió', () => {
    // El reverso: `<AyudaCampo campo="Cargo">` con la clave mal tipeada no
    // dibuja nada y no avisa. Se ve idéntico a un campo sin ayuda.
    const fuentes = Object.values(
      import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
    ) as string[]

    const fantasmas: string[] = []
    for (const src of fuentes) {
      for (const m of src.matchAll(/AyudaCampo\s+id="([a-zA-Z]+)"\s+campo="([^"]+)"/g)) {
        if (!GUIAS[m[1]]?.campos?.[m[2]]) fantasmas.push(`${m[1]}.${m[2]}`)
      }
    }
    expect([...new Set(fantasmas)]).toEqual([])
  })
})
