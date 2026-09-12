// El número de orden lo elige una persona y no puede repetirse: los pagos se
// ligan a la orden POR EL NÚMERO. Ya pasó que OS38 quedara cargado dos veces,
// con fechas y montos distintos, y se descubrió meses después en un cruce.

import { describe, it, expect } from 'vitest'
import { proximoNumeroDeOrden, numeroRepetido } from '../numeroDeOrden'

/** Un gasto con ese número, que es lo único que la serie OS numera. */
const g = (numero: string | null | undefined) => ({ tipo: 'gasto', numero })

describe('proximoNumeroDeOrden', () => {
  it('arranca en OS1 cuando no hay ninguno', () => {
    expect(proximoNumeroDeOrden([])).toBe('OS1')
  })

  it('sigue del mayor, no de la cantidad', () => {
    // Con huecos en la serie, contar daría un número ya usado.
    expect(proximoNumeroDeOrden([g('OS1'), g('OS5'), g('OS3')])).toBe('OS6')
  })

  it('ignora lo que no sigue el formato, sin romperse', () => {
    // «OS38-B» salió de desdoblar una orden repetida, y hay series ajenas.
    expect(proximoNumeroDeOrden(
      [g('OS38'), g('OS38-B'), g('A-0001'), g(null), g(undefined), g('')]))
      .toBe('OS39')
  })

  it('no se confunde con minúsculas ni espacios', () => {
    expect(proximoNumeroDeOrden([g(' os7 '), g('OS2')])).toBe('OS8')
  })

  it('un número enorme no rompe la cuenta', () => {
    expect(proximoNumeroDeOrden([g('OS999')])).toBe('OS1000')
  })

  // ⚠️ EL BUG QUE ENCONTRÓ la organización EL 04/09/2026, con estas palabras:
  // «registré dispensas de prueba y la app les asignó OSxxx, cuando en el
  // sistema que veníamos usando las OSxxx las usamos para ingresar lotes».
  //
  // `OS` numera ÓRDENES DE SERVICIO: el ingreso de un lote al stock, y la clave
  // por la que se le imputan los pagos. Un documento emitido que toma un OS
  // hace dos daños, y el segundo es el caro: se queda con un número ajeno, y
  // CORRE LA SERIE, así que el próximo ingreso real recibe otro.
  describe('la serie OS es sólo de los gastos', () => {
    it('un documento emitido con OS no corre la serie', () => {
      // Pasó tres veces en producción: OS116, OS119 y OS120 quedaron en
      // comprobantes de dispensa. Si contaran, el próximo ingreso saldría
      // OS121 y los tres números del medio quedarían perdidos.
      expect(proximoNumeroDeOrden([
        g('OS5'),
        { tipo: 'emitido', numero: 'OS119' },
        { tipo: 'emitido', numero: 'OS120' },
      ])).toBe('OS6')
    })

    it('y sin ningún gasto arranca en OS1, por más emitidos que haya', () => {
      expect(proximoNumeroDeOrden([
        { tipo: 'emitido', numero: 'OS40' },
        { tipo: 'emitido', numero: '846' },
      ])).toBe('OS1')
    })

    it('un documento sin tipo tampoco cuenta', () => {
      // La función decide por lo que el documento DICE ser, no por su forma.
      expect(proximoNumeroDeOrden([{ numero: 'OS99' }, g('OS3')])).toBe('OS4')
    })
  })
})

describe('numeroRepetido', () => {
  const docs = [{ id: 'a', numero: 'OS38' }, { id: 'b', numero: 'OS39' }]

  it('avisa cuando el número ya está usado por otro', () => {
    expect(numeroRepetido('OS38', docs)).toBe(true)
  })

  it('no se marca a sí mismo al editar', () => {
    // Sin esto, abrir un documento existente lo acusaría de repetir su propio
    // número y nadie podría guardar una edición.
    expect(numeroRepetido('OS38', docs, 'a')).toBe(false)
  })

  it('compara sin distinguir mayúsculas ni espacios', () => {
    expect(numeroRepetido(' os38 ', docs)).toBe(true)
  })

  it('un número vacío no es un repetido', () => {
    expect(numeroRepetido('', docs)).toBe(false)
    expect(numeroRepetido(null, docs)).toBe(false)
  })
})
