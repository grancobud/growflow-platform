import { describe, it, expect } from 'vitest'
import {
  filtrarPersonas, ordenarPorApellido, nombreParaMostrar, nombresRepetidos, normalizar,
} from '../buscarPersonas'

/**
 * Los nombres son los del padrón real la organización al 09/09/2026, con los dos
 * criterios de carga mezclados: hay «Juan Pablo Dorrego» (nombre primero) y hay
 * «Cabrera Walter Ariel» (apellido primero). Es justamente por esa mezcla que
 * el buscador compara palabra contra palabra en cualquier orden.
 */
const p = (nombre: string, extra: Record<string, unknown> = {}) => ({
  id: nombre, nombre_completo: nombre,
  apellido: nombre.split(' ').slice(-1)[0],
  nombres: nombre.split(' ').slice(0, -1).join(' ') || null,
  ...extra,
})

const PADRON = [
  p('Juan cruz Núñez Ravenna'),
  p('Juan Pablo Dorrego'),
  p('Cabrera Walter Ariel'),
  p('Marcelo Bermejo'),
  p('Ana Flor Pineda'),
  p('Martin Andrés Pineda'),
]

describe('filtrarPersonas', () => {
  it('encuentra escribiendo dos palabras sueltas del nombre', () => {
    // El pedido textual: «que yo ponga Juan cruz nomás y saque todos los Juan cruz».
    const r = filtrarPersonas(PADRON, 'juan cruz')
    expect(r.map(x => x.nombre_completo)).toEqual(['Juan cruz Núñez Ravenna'])
  })

  it('no importa el ORDEN en que se escriben las palabras', () => {
    // Quien busca no sabe si lo cargaron «Nombre Apellido» o al revés.
    expect(filtrarPersonas(PADRON, 'dorrego juan')).toHaveLength(1)
    expect(filtrarPersonas(PADRON, 'juan dorrego')).toHaveLength(1)
  })

  it('ignora acentos y mayúsculas', () => {
    expect(filtrarPersonas(PADRON, 'NUNEZ')).toHaveLength(1)
    expect(filtrarPersonas(PADRON, 'andres')).toHaveLength(1)
  })

  it('cada palabra ACHICA la búsqueda, no la agranda', () => {
    // Con «alguna» en vez de «todas», seguir tecleando devolvería más, que es
    // lo contrario de lo que uno espera.
    expect(filtrarPersonas(PADRON, 'pineda')).toHaveLength(2)
    expect(filtrarPersonas(PADRON, 'pineda martin')).toHaveLength(1)
  })

  it('busca por PREFIJO de palabra, no por subcadena', () => {
    // «ana» no puede devolver a Juana ni a Santana: quien busca a Ana no
    // reconoce esa lista como respuesta a lo que preguntó.
    const conJuana = [...PADRON, p('Juana Bustos')]
    expect(filtrarPersonas(conJuana, 'ana').map(x => x.nombre_completo)).toEqual(['Ana Flor Pineda'])
  })

  it('encuentra por código y por DNI, que es lo que a veces se tiene a mano', () => {
    const lista = [p('Marcelo Bermejo', { codigo: 'PAC-024', dni: '30123456' })]
    expect(filtrarPersonas(lista, 'PAC-024')).toHaveLength(1)
    expect(filtrarPersonas(lista, '3012')).toHaveLength(1)
  })

  it('sin nada escrito devuelve todo', () => {
    expect(filtrarPersonas(PADRON, '')).toHaveLength(PADRON.length)
    expect(filtrarPersonas(PADRON, '   ')).toHaveLength(PADRON.length)
  })

  it('lo que no existe devuelve vacío y no rompe', () => {
    expect(filtrarPersonas(PADRON, 'zzzz')).toEqual([])
  })
})

describe('nombreParaMostrar', () => {
  it('el apellido va PRIMERO', () => {
    expect(nombreParaMostrar({ nombre_completo: 'Juan Pablo Dorrego', apellido: 'Dorrego', nombres: 'Juan Pablo' }))
      .toBe('Dorrego, Juan Pablo')
  })

  it('sin apellido separado cae al nombre completo tal cual', () => {
    // Mostrar «, » con la mitad vacía sería peor que no reordenar.
    expect(nombreParaMostrar({ nombre_completo: 'Arielmartinez' })).toBe('Arielmartinez')
    expect(nombreParaMostrar({ nombre_completo: 'X', apellido: '  ' })).toBe('X')
  })

  it('con apellido y sin nombres no deja la coma colgada', () => {
    expect(nombreParaMostrar({ nombre_completo: 'Miranda', apellido: 'Miranda', nombres: null }))
      .toBe('Miranda')
  })
})

describe('ordenarPorApellido', () => {
  it('ordena por apellido, no por nombre', () => {
    const r = ordenarPorApellido(PADRON).map(x => nombreParaMostrar(x))
    expect(r[0]).toBe('Ariel, Cabrera Walter')
    expect(r[1]).toBe('Bermejo, Marcelo')
    expect(r[2]).toBe('Dorrego, Juan Pablo')
  })

  it('a igual apellido, ordena por el nombre', () => {
    const r = ordenarPorApellido([p('Martin Andrés Pineda'), p('Ana Flor Pineda')])
      .map(x => nombreParaMostrar(x))
    expect(r).toEqual(['Pineda, Ana Flor', 'Pineda, Martin Andrés'])
  })

  it('no muta la lista que recibe', () => {
    const original = [...PADRON]
    ordenarPorApellido(PADRON)
    expect(PADRON).toEqual(original)
  })
})

describe('nombresRepetidos', () => {
  it('detecta a dos personas con el mismo nombre', () => {
    // Pasó de verdad: hubo tres «Rocio Maidana» activas al mismo tiempo. Sin
    // esto la lista ofrece dos renglones idénticos y elegir es adivinar.
    const r = nombresRepetidos([p('Rocio Maidana'), p('Rocio Maidana'), p('Marcelo Bermejo')])
    expect(r.has(normalizar('Rocio Maidana'))).toBe(true)
    expect(r.has(normalizar('Marcelo Bermejo'))).toBe(false)
  })

  it('las diferencias de acento y mayúscula NO son dos personas distintas', () => {
    expect(nombresRepetidos([p('Rocío Maidana'), p('rocio maidana')]).size).toBe(1)
  })
})
