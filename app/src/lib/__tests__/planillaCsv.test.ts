// La planilla que se baja para controlar.
//
// Un CSV mal escapado no falla: abre igual, con las columnas corridas. Y una
// planilla de control con las columnas corridas es peor que no tener planilla,
// porque se le cree.

import { describe, it, expect } from 'vitest'
import {
  celdaCsv, tablaCsv, hojaCsv, nombreDeArchivo,
  planillaLotes, planillaDispensas, planillaCaja,
} from '../planillaCsv'

describe('celdaCsv', () => {
  it('el texto simple va tal cual', () => {
    expect(celdaCsv('flor')).toBe('flor')
  })

  it('cita lo que tiene coma', () => {
    // El caso real: un proveedor que se llama «Pinar, S.A.» partiría la fila en
    // dos columnas y todo lo que sigue quedaría corrido una posición.
    expect(celdaCsv('Pinar, S.A.')).toBe('"Pinar, S.A."')
  })

  it('duplica las comillas de adentro', () => {
    expect(celdaCsv('Lote "viejo"')).toBe('"Lote ""viejo"""')
  })

  it('cita los saltos de línea', () => {
    // Las notas se escriben con Enter adentro.
    expect(celdaCsv('linea1\nlinea2')).toBe('"linea1\nlinea2"')
  })

  it('cita el punto y coma', () => {
    // Excel en configuración regional española usa `;` como separador: sin citar,
    // una nota con punto y coma parte la fila en esa máquina y no en la de al lado.
    expect(celdaCsv('uno;dos')).toBe('"uno;dos"')
  })

  it('los números van sin comillas', () => {
    // Entre comillas Excel los lee como texto y no se pueden sumar, que es
    // exactamente para lo que se baja la planilla.
    expect(celdaCsv(1250.5)).toBe('1250.5')
    expect(celdaCsv(0)).toBe('0')
  })

  it('el vacío y lo que no es número quedan vacíos', () => {
    // Un `NaN` escrito tal cual aparece como texto en una columna de plata.
    expect(celdaCsv(null)).toBe('')
    expect(celdaCsv(undefined)).toBe('')
    expect(celdaCsv(NaN)).toBe('')
  })
})

describe('tablaCsv', () => {
  it('arma encabezado y filas con CRLF', () => {
    // CRLF porque esto se abre en Excel en Windows.
    expect(tablaCsv(['a', 'b'], [[1, 'x'], [2, 'y']])).toBe('a,b\r\n1,x\r\n2,y')
  })

  it('la tabla vacía deja el encabezado', () => {
    // Una planilla sin filas pero con encabezado dice «no hay nada». Un archivo
    // en blanco parece un error de descarga.
    expect(tablaCsv(['a', 'b'], [])).toBe('a,b')
  })
})

describe('hojaCsv', () => {
  it('arranca con el BOM', () => {
    // Sin BOM, Excel abre como ANSI y «Argüello» sale «ArgÃ¼ello» — en una
    // planilla que es toda nombres de personas.
    const h = hojaCsv(['Paciente'], [['María Luz Argüello']])
    expect(h.charCodeAt(0)).toBe(0xFEFF)
    expect(h).toContain('María Luz Argüello')
  })
})

describe('nombreDeArchivo', () => {
  it('lleva la fecha para que no se pisen', () => {
    expect(nombreDeArchivo('lotes', new Date(2026, 7, 27))).toBe('lotes-2026-08-27.csv')
  })

  it('rellena mes y día con cero', () => {
    expect(nombreDeArchivo('caja', new Date(2026, 0, 5))).toBe('caja-2026-01-05.csv')
  })
})

describe('las tres hojas', () => {
  it('lotes: el código primero, que es la clave', () => {
    const csv = planillaLotes([{
      codigo: 'LOTE-001', producto: 'flor', gramos_totales: 120,
      proveedor: 'Pinar, S.A.', costo_por_gramo: 2600, activo: true,
    }])
    expect(csv.split('\r\n')[0]).toContain('Código')
    expect(csv).toContain('LOTE-001')
    expect(csv).toContain('"Pinar, S.A."')
    expect(csv).toContain('sí')
  })

  it('lotes: sin unidad ni origen usa el mismo default que la app', () => {
    // La app manda `g` y `comprado` explícitos al guardar; la planilla tiene que
    // decir lo mismo o los dos lados discrepan sobre el mismo lote.
    const csv = planillaLotes([{ codigo: 'LOTE-002' }])
    expect(csv).toContain('g,comprado')
  })

  it('lotes: un lote inactivo se ve', () => {
    // Desactivar es lo que se hace en vez de borrar un lote con movimientos, así
    // que la planilla tiene que poder distinguirlos.
    expect(planillaLotes([{ codigo: 'LOTE-003', activo: false }])).toContain(',no')
  })

  it('dispensas: nombra el lote del que salió', () => {
    const csv = planillaDispensas([{
      fecha: '2026-08-27', paciente_nombre: 'Fernando Ariel Ocampo',
      lote_codigo: 'LOTE-001', gramos: 40, aporte: 15000,
    }])
    expect(csv).toContain('LOTE-001')
    expect(csv).toContain('Fernando Ariel Ocampo')
  })

  it('caja: el monto sale como número', () => {
    const csv = planillaCaja([{ fecha: '2026-08-27', concepto: 'Aporte', monto: 15000 }])
    expect(csv).toContain(',15000,')
  })

  it('las tres soportan estar vacías', () => {
    // Chaco no arrancó la operación: hoy las tres bajan sin filas, y tienen que
    // bajar igual.
    for (const csv of [planillaLotes([]), planillaDispensas([]), planillaCaja([])]) {
      expect(csv.split('\r\n')).toHaveLength(1)
      expect(csv.length).toBeGreaterThan(1)
    }
  })
})
