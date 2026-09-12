// Quién puede borrar el `?nueva=` de la URL.
//
// Es una función de tres líneas y las dos condiciones fallaron, con el mismo
// síntoma las dos veces: el paso 2 de «Sumar a alguien» decía «paso 2 de 3» y no
// abría nada. Ningún error, ningún test rojo, nada en consola — la pantalla
// simplemente no hacía lo que la barra decía que iba a hacer.
//
// El hook no se puede montar acá: el proyecto no tiene testing-library y vitest
// corre en `node` a propósito. Por eso la decisión vive afuera del hook.

import { describe, it, expect } from 'vitest'
import { debeLimpiar } from '../useAbrirAlLlegar'

describe('debeLimpiar', () => {
  it('el hook borra lo suyo', () => {
    expect(debeLimpiar('1', '1', true)).toBe(true)
    expect(debeLimpiar('tope', 'tope', true)).toBe(true)
  })

  it('NO borra el parámetro de otro hook', () => {
    // El caso medido: «Sumar a alguien» guarda la ficha con `nueva=1`, el flujo
    // navega al paso 2 poniendo `nueva=tope`, y recién ahí el modal del paso 1
    // termina de cerrarse. Si limpiara por nombre de parámetro se llevaría
    // puesto el del paso siguiente:
    //   pushState     ?nueva=tope&flujo=sumar&paso=2&paciente=…
    //   replaceState  ?flujo=sumar&paso=2&paciente=…
    expect(debeLimpiar('tope', '1', true)).toBe(false)
    expect(debeLimpiar('1', 'tope', true)).toBe(false)
  })

  it('NO borra si este hook nunca abrió nada', () => {
    // La segunda mitad del mismo bug, y la más difícil de ver: en Pacientes hay
    // UN modal que sirve para las dos cosas, así que los dos hooks reciben el
    // mismo booleano de «hay algo abierto». Sin este filtro, el hook de `tope`
    // se atribuía la apertura del formulario del hook de `1`, y al cerrarse ese
    // modal borraba su propio `nueva=tope` por un formulario que nunca abrió.
    expect(debeLimpiar('tope', 'tope', false)).toBe(false)
  })

  it('sin parámetro en la URL no hay nada que borrar', () => {
    expect(debeLimpiar(null, '1', true)).toBe(false)
  })

  it('no confunde una clave con otra que la contiene', () => {
    // `nueva=1` y `nueva=10` son formularios distintos. La comparación es
    // exacta, no por prefijo.
    expect(debeLimpiar('10', '1', true)).toBe(false)
  })
})
