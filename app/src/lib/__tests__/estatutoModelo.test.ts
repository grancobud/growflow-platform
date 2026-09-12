// El estatuto es un instrumento legal: se presenta como sale.
//
// Por eso lo que se prueba no es el formato sino que el texto esté COMPLETO y
// que los dos huecos del modelo queden efectivamente completados. Un estatuto al
// que le falta un artículo, o que sale con «{{DENOMINACION}}» sin reemplazar,
// no se nota leyendo la pantalla y sí se nota en la mesa de entradas.

import { describe, it, expect } from 'vitest'
import { estatutoModelo, MODELO_CHACO } from '../estatutoModelo'
import type { Entidad } from '../ong'

const entidad = (extra: Partial<Entidad> = {}): Entidad => ({
  id: 'e1',
  razon_social: 'Asociación Civil Ñandú',
  sede_localidad: 'Resistencia',
  ...extra,
} as Entidad)

describe('estatuto modelo pre-visado', () => {
  it('trae los 39 artículos del Anexo II', () => {
    // Si la transcripción se corta —y se transcribió desde un PDF, así que
    // puede— el estatuto sale incompleto sin que nada avise.
    const { texto } = estatutoModelo(entidad())
    const articulos = texto.match(/ARTÍCULO\s*\d+/g) ?? []
    expect(articulos.length).toBe(39)
    expect(texto).toContain('ARTÍCULO 1:')
    expect(texto).toContain('ARTÍCULO 39:')
  })

  it('no deja ningún marcador sin reemplazar', () => {
    const { texto } = estatutoModelo(entidad())
    expect(texto).not.toMatch(/\{\{[A-Z_]+\}\}/)
  })

  it('pone la denominación y la localidad de la entidad', () => {
    const { texto, faltantes } = estatutoModelo(entidad({
      razon_social: 'Asociación Civil Ñandú',
      sede_localidad: 'Sáenz Peña',
    }))
    expect(texto).toContain('«Asociación Civil Ñandú»')
    // El modelo dice Resistencia; si la entidad declara otra localidad, manda
    // la suya: el estatuto dice dónde queda constituida y eso no sale de una
    // plantilla.
    expect(texto).toContain('En la Ciudad de Sáenz Peña')
    expect(texto).not.toContain('En la Ciudad de Resistencia')
    expect(faltantes).toEqual([])
  })

  it('sin entidad marca los huecos entre corchetes y los enumera', () => {
    // Preferimos que el hueco se vea a que alguien firme un estatuto con un
    // dato inventado.
    const { texto, faltantes } = estatutoModelo(null)
    expect(texto).toContain('[razón social]')
    expect(texto).toContain('[localidad de la sede]')
    expect(faltantes).toHaveLength(2)
  })

  it('las constantes del modelo coinciden con lo que dice su articulado', () => {
    // Estos números se usan en otras pantallas —vencimientos, cargos— y su
    // fuente es este estatuto. Si alguien los edita a mano, el texto y la
    // constante dejan de decir lo mismo y gana el que nadie mira.
    const { texto } = estatutoModelo(entidad())
    expect(MODELO_CHACO.cierreEjercicioDia).toBe(30)
    expect(MODELO_CHACO.cierreEjercicioMes).toBe(6)
    expect(texto).toContain('30 de junio')
    expect(MODELO_CHACO.mandatoAnios).toBe(2)
    expect(texto).toContain('durará dos años')
    for (const cargo of MODELO_CHACO.cargos) {
      expect(texto.toLowerCase()).toContain(cargo.split(' ')[0].toLowerCase())
    }
  })

  it('avisa cuando la entidad no es de la jurisdicción del modelo', () => {
    // El articulado entero remite a la Inspección General del Chaco: es el
    // organismo que pre-visó ESTE texto. Presentarlo en otra provincia no
    // sirve, y es mejor decirlo acá que descubrirlo en la mesa de entradas.
    const { faltantes, texto } = estatutoModelo(entidad({ sede_provincia: 'Buenos Aires' }))
    expect(faltantes.join(' ')).toMatch(/Buenos Aires/)
    expect(faltantes.join(' ')).toMatch(/Chaco/)
    // No bloquea: el texto sale igual, con el aviso.
    expect(texto).toContain('ARTÍCULO 1:')
  })

  it('no avisa nada si la entidad es del Chaco', () => {
    const { faltantes } = estatutoModelo(entidad({ sede_provincia: 'Chaco' }))
    expect(faltantes).toEqual([])
  })
})
