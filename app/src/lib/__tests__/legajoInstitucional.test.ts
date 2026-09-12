import { describe, it, expect } from 'vitest'
import {
  vigenteDe, faltantes, sinArchivo,
  type PapelInstitucional, type TipoLegajo,
} from '../legajoInstitucional'

const doc = (p: Partial<PapelInstitucional> & { tipo: TipoLegajo }): PapelInstitucional => ({
  id: Math.random().toString(36).slice(2),
  titulo: 'Papel', numero: null, fecha: null, vigente: true,
  persona_juridica: null, archivo_path: 'institucional/x.pdf',
  archivo_nombre: 'x.pdf', notas: null, creado_en: '', ...p,
})

// LO QUE ESTOS TESTS FIJAN es la diferencia entre «no está» y «no tiene el
// PDF». Un legajo que grita «falta el estatuto» cuando la ficha está cargada y
// sólo falta adjuntar el archivo enseña a ignorar el aviso, y entonces el
// aviso no sirve para el día en que de verdad falta.

describe('vigenteDe', () => {
  it('encuentra el estatuto vigente', () => {
    const d = vigenteDe([doc({ tipo: 'Estatuto', titulo: 'Coop Ñandú' })], 'Estatuto')
    expect(d?.titulo).toBe('Coop Ñandú')
  })

  it('entre dos vigentes gana el más nuevo: la reforma manda', () => {
    const d = vigenteDe([
      doc({ tipo: 'Estatuto', titulo: 'original', fecha: '2023-11-13' }),
      doc({ tipo: 'Estatuto', titulo: 'reformado', fecha: '2025-04-02' }),
    ], 'Estatuto')
    expect(d?.titulo).toBe('reformado')
  })

  it('un papel SIN fecha no le gana a uno fechado: no puede demostrar que lo reemplazó', () => {
    const d = vigenteDe([
      doc({ tipo: 'Estatuto', titulo: 'fechado', fecha: '2023-11-13' }),
      doc({ tipo: 'Estatuto', titulo: 'sin fecha' }),
    ], 'Estatuto')
    expect(d?.titulo).toBe('fechado')
  })

  it('el reformado no cuenta si se lo marcó no vigente', () => {
    expect(vigenteDe([doc({ tipo: 'Estatuto', vigente: false })], 'Estatuto')).toBeNull()
  })

  it('no confunde tipos: un acta no hace de estatuto', () => {
    expect(vigenteDe([doc({ tipo: 'Acta constitutiva' })], 'Estatuto')).toBeNull()
  })

  // La entidad puede no estar operativa y el estatuto seguir vigente. Es el
  // caso literal que trajo Gastón con la cooperativa, y por eso `vigente` es
  // del papel y no de la entidad.
  it('la entidad parada no apaga su estatuto', () => {
    const d = vigenteDe([doc({
      tipo: 'Estatuto', vigente: true,
      persona_juridica: 'Cooperativa de Trabajo la organización Limitada',
    })], 'Estatuto')
    expect(d?.persona_juridica).toBe('Cooperativa de Trabajo la organización Limitada')
  })
})

describe('faltantes', () => {
  it('sin nada cargado faltan los dos obligatorios', () => {
    expect(faltantes([])).toEqual(['Estatuto', 'Acta constitutiva'])
  })

  it('con el estatuto cargado sólo falta el acta', () => {
    expect(faltantes([doc({ tipo: 'Estatuto' })])).toEqual(['Acta constitutiva'])
  })

  it('el reglamento NO es obligatorio: no marcarlo es la decisión', () => {
    const f = faltantes([doc({ tipo: 'Estatuto' }), doc({ tipo: 'Acta constitutiva' })])
    expect(f).toEqual([])
  })

  it('un estatuto marcado no vigente sigue contando como faltante', () => {
    expect(faltantes([doc({ tipo: 'Estatuto', vigente: false })])).toContain('Estatuto')
  })
})

describe('sinArchivo', () => {
  it('la ficha existe pero el PDF no: no es un faltante, es un papel sin respaldo', () => {
    const sinPdf = doc({ tipo: 'Estatuto', archivo_path: null })
    expect(faltantes([sinPdf])).toEqual(['Acta constitutiva'])
    expect(sinArchivo([sinPdf])).toHaveLength(1)
  })

  it('con archivo no aparece', () => {
    expect(sinArchivo([doc({ tipo: 'Estatuto' })])).toHaveLength(0)
  })
})
