// El código de lote es la clave del vínculo, no una etiqueta.
//
// `ong_dispensas` no tiene `lote_id`: engancha por `lote_codigo`, texto contra
// texto. Un código repetido descuenta stock del lote equivocado, y uno
// renombrado después de entregar rompe el vínculo sin que nada avise. Estos
// tests cuidan las dos cosas.

import { describe, it, expect } from 'vitest'
import {
  proximoCodigoDeLote, codigoRepetido, loteQueUsaElCodigo, codigoBloqueado,
} from '../codigoDeLote'

/**
 * Los 14 primeros códigos REALES heredados de CODIGOS_HEREDADOS, tal cual están en la base.
 *
 * Son el caso feo de verdad: 101 lotes que vinieron de la planilla, cada uno con
 * el formato que se le ocurrió a quien lo cargó. Ninguno sigue `LOTE-nnn`, y
 * ninguno se va a renumerar.
 */
const CODIGOS_HEREDADOS = [
  '#1COOP2526', 'A-7826', 'A-F14726', 'A-G14726', 'A-PR25726', 'AC-PA1509',
  'AC-V01', 'AC-V1911', 'C-CK050426', 'C-CK30426', 'C-CK40426', 'C-CK9526',
  'Cafe-L01', 'CFK-V01',
]

describe('proximoCodigoDeLote', () => {
  it('sin ningún lote arranca en LOTE-001', () => {
    // Es el estado real de Chaco al escribir esto: 0 lotes, la serie empieza
    // limpia. Por eso se pudo elegir el formato sin arrastrar nada.
    expect(proximoCodigoDeLote([])).toBe('LOTE-001')
  })

  it('sigue la serie', () => {
    expect(proximoCodigoDeLote(['LOTE-001'])).toBe('LOTE-002')
    expect(proximoCodigoDeLote(['LOTE-001', 'LOTE-002', 'LOTE-003'])).toBe('LOTE-004')
  })

  it('mira el MAYOR, no la cantidad', () => {
    // Si contara cuántos hay, borrar un lote del medio haría que el próximo
    // repitiera un código ya usado — y repetir es justamente lo que no puede
    // pasar.
    expect(proximoCodigoDeLote(['LOTE-001', 'LOTE-007'])).toBe('LOTE-008')
  })

  it('pasa de tres dígitos sin romperse', () => {
    // El padding es para que se lea prolijo, no un límite.
    expect(proximoCodigoDeLote(['LOTE-999'])).toBe('LOTE-1000')
  })

  it('ignora los códigos CODIGOS_HEREDADOS para el cálculo, pero no los toca', () => {
    // No siguen el formato, así que la serie nueva arranca de cero y convive con
    // ellos. Lo que NO puede pasar es que los rompa o los renumere.
    expect(proximoCodigoDeLote(CODIGOS_HEREDADOS)).toBe('LOTE-001')
    expect(proximoCodigoDeLote([...CODIGOS_HEREDADOS, 'LOTE-004'])).toBe('LOTE-005')
  })

  it('aguanta nulos, vacíos y espacios de más', () => {
    // La base permite null y la planilla dejó celdas en blanco.
    expect(proximoCodigoDeLote([null, undefined, '', '   '])).toBe('LOTE-001')
    expect(proximoCodigoDeLote(['  LOTE-012  '])).toBe('LOTE-013')
  })

  it('no se deja engañar por algo que sólo se PARECE al formato', () => {
    // `LOTE-2601` del seed demo sí cuenta, es del formato. `LOTE-A` y
    // `LOTE-001-B` no, y tomarlos daría un número inventado.
    expect(proximoCodigoDeLote(['LOTE-A', 'LOTE-001-B', 'MILOTE-9'])).toBe('LOTE-001')
    expect(proximoCodigoDeLote(['lote-005'])).toBe('LOTE-006')
  })
})

describe('codigoRepetido', () => {
  const lotes = [{ id: 'a', codigo: 'LOTE-001' }, { id: 'b', codigo: 'Cafe-L01' }]

  it('detecta el repetido', () => {
    expect(codigoRepetido('LOTE-001', lotes)).toBe(true)
  })

  it('compara como lo compara una persona: sin caso ni espacios', () => {
    // Dos lotes que se llaman `lote-001` y `LOTE-001 ` son el mismo código para
    // cualquiera que los lea, y el join por texto los trataría como distintos.
    expect(codigoRepetido('  lote-001 ', lotes)).toBe(true)
    expect(codigoRepetido('cafe-l01', lotes)).toBe(true)
  })

  it('un lote no es duplicado de sí mismo', () => {
    // Sin esto, guardar un lote sin tocarle el código sería imposible.
    expect(codigoRepetido('LOTE-001', lotes, 'a')).toBe(false)
  })

  it('el vacío no cuenta como repetido', () => {
    // De que falte el código ya se encarga otra validación, con su propio
    // mensaje. Este no tiene que opinar.
    expect(codigoRepetido('', lotes)).toBe(false)
    expect(codigoRepetido(null, lotes)).toBe(false)
  })

  it('devuelve cuál es el otro lote, para poder nombrarlo', () => {
    expect(loteQueUsaElCodigo('lote-001', lotes)?.id).toBe('a')
    expect(loteQueUsaElCodigo('LOTE-999', lotes)).toBeUndefined()
  })
})

describe('codigoBloqueado', () => {
  const lote = { id: 'a', codigo: 'LOTE-001' }

  it('un lote sin movimientos se puede corregir', () => {
    // Es el caso del tipeo: cargaste mal y lo arreglás. Bloquear acá sería
    // molestar sin proteger nada.
    expect(codigoBloqueado(lote, [], [])).toBe(false)
  })

  it('un lote que ya entregó queda cerrado', () => {
    // Renombrarlo dejaría la dispensa apuntando a un código que ya no existe, y
    // el descuento de stock deja de encontrarlo. En silencio.
    expect(codigoBloqueado(lote, [], [{ lote_codigo: 'LOTE-001' }])).toBe(true)
  })

  it('una reserva también lo cierra', () => {
    // La reserva todavía no es una entrega, pero ya aparta material de ESE lote.
    expect(codigoBloqueado(lote, [{ lote_id: 'a' }], [])).toBe(true)
  })

  it('los movimientos de OTRO lote no lo cierran', () => {
    expect(codigoBloqueado(lote, [{ lote_id: 'z' }], [{ lote_codigo: 'LOTE-777' }])).toBe(false)
  })

  it('el lote que todavía no existe nunca está bloqueado', () => {
    // Un lote nuevo no tiene id, así que nada puede estar apuntándolo.
    expect(codigoBloqueado({ codigo: 'LOTE-001' }, [], [{ lote_codigo: 'LOTE-001' }])).toBe(false)
  })
})
