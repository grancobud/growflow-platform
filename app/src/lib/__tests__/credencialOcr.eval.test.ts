// EVAL DEL OCR DE CREDENCIALES: no comprueba que el código ande, comprueba
// que el SISTEMA CON EL MODELO ADENTRO no deje pasar un dato que no puede ser
// cierto.
//
// LA DIFERENCIA CON UN TEST NORMAL.
//
// Un test dice sí o no. Un eval dice CUÁNTO, porque del otro lado hay un modelo
// y un modelo no acierta siempre: acierta un porcentaje, y ese porcentaje se
// mueve cuando cambia el modelo, el prompt o la calidad del escaneo. Lo que se
// vigila acá son dos números distintos:
//
//   COBERTURA   de los campos que la credencial tiene, cuántos se extraen bien.
//               Puede bajar sin que sea grave: se cargan a mano.
//
//   CONTAMINACIÓN  cuántos campos MALOS se aceptan como buenos. Tiene que ser
//                  cero. Un DNI equivocado en una ficha de paciente no se nota
//                  hasta que se nota mal.
//
// Son dos cosas y se confunden todo el tiempo. Un sistema que rechaza todo tiene
// contaminación cero y no sirve. Uno que acepta todo tiene cobertura perfecta y
// es peor que no tener OCR.
//
// LAS ENTRADAS SON SALIDAS REALES DEL MODELO, NO INVENTADAS.
//
// Los casos de abajo son las formas en que qwen3-vl falla leyendo estos PDF:
// puntos del DNI que copia tal cual, meses imposibles cuando el renglón está
// borroso, el encabezado del formulario en lugar del nombre, el estado en
// minúscula, y el número de plantas con un dígito de más. Los datos personales
// son inventados; los MODOS DE FALLA no.
//
// Si mañana se cambia el modelo, este archivo dice en segundos si mejoró o
// empeoró, sin abrir el navegador ni buscar un PDF.

import { describe, it, expect } from 'vitest'
import { normalizarCredencial, avisosDeCoherencia } from '../credencialOcr'
import type { DatosCredencial } from '../ocr'

interface Caso {
  nombre: string
  /** Lo que devolvió el modelo. */
  salida: Record<string, unknown>
  /** Lo que tendría que quedar. Un campo ausente acá es un campo que debe rechazarse. */
  esperado: DatosCredencial
}

const CASOS: Caso[] = [
  {
    nombre: 'lectura limpia: pasa todo',
    salida: {
      nombre_completo: 'Ana Flor Pineda',
      dni: '30111222',
      fecha_nacimiento: '1985-04-12',
      telefono: '3624100200',
      email: 'ana@ejemplo.com',
      localidad: 'Resistencia',
      provincia: 'Chaco',
      domicilio: 'Belgrano 100',
      reprocann_nro: 'a1bCde1234567',
      reprocann_estado: 'Vigente',
      reprocann_emision: '2026-01-10',
      reprocann_vencimiento: '2027-01-10',
      modalidad: 'Cultivo propio',
      plantas_habilitadas: 9,
      m2_habilitados: 15,
      patologia: 'Dolor cronico',
      medico_tratante: 'Marcelo Bermejo',
      matricula_medico: '12345',
    },
    esperado: {
      nombre_completo: 'Ana Flor Pineda', dni: '30111222', fecha_nacimiento: '1985-04-12',
      telefono: '3624100200', email: 'ana@ejemplo.com', localidad: 'Resistencia',
      provincia: 'Chaco', domicilio: 'Belgrano 100', reprocann_nro: 'a1bCde1234567',
      reprocann_estado: 'Vigente', reprocann_emision: '2026-01-10',
      reprocann_vencimiento: '2027-01-10', modalidad: 'Cultivo propio',
      plantas_habilitadas: 9, m2_habilitados: 15, patologia: 'Dolor cronico',
      medico_tratante: 'Marcelo Bermejo', matricula_medico: '12345',
    },
  },
  {
    nombre: 'el DNI viene con los puntos impresos: se normaliza, no se rechaza',
    salida: { dni: '30.111.222', telefono: '(3624) 10-0200' },
    esperado: { dni: '30111222', telefono: '3624100200' },
  },
  {
    nombre: 'fecha con forma correcta pero que no existe: se rechaza',
    // El caso que la regex vieja dejaba pasar. 31 de febrero.
    salida: { fecha_nacimiento: '1985-02-31', reprocann_emision: '2026-13-01' },
    esperado: {},
  },
  {
    nombre: 'el modelo copió el encabezado del formulario en vez del nombre',
    salida: { nombre_completo: 'APELLIDO Y NOMBRE', dni: '30111222' },
    esperado: { dni: '30111222' },
  },
  {
    nombre: 'un dígito de más en las plantas habilitadas',
    // 90 plantas no es una credencial personal, es un 9 con un cero pegado.
    salida: { plantas_habilitadas: 900, m2_habilitados: 15 },
    esperado: { m2_habilitados: 15 },
  },
  {
    nombre: 'el estado en minúscula no es el estado',
    // Se rechaza a propósito: aceptar variantes sueltas es cómo se termina con
    // cuatro maneras de escribir «Vigente» en la base.
    salida: { reprocann_estado: 'vigente', modalidad: 'cultivo propio' },
    esperado: {},
  },
  {
    nombre: 'DNI de seis dígitos: falta uno',
    salida: { dni: '301112', nombre_completo: 'Ana Flor Pineda' },
    esperado: { nombre_completo: 'Ana Flor Pineda' },
  },
  {
    nombre: 'vence antes de emitirse: cada fecha está bien, el par es imposible',
    salida: { reprocann_emision: '2026-01-10', reprocann_vencimiento: '2025-01-10' },
    esperado: { reprocann_emision: '2026-01-10' },
  },
  {
    nombre: 'credencial ilegible: no revienta, rechaza todo',
    salida: { nombre_completo: '???', dni: 'XXXXXXX', fecha_nacimiento: '--' },
    esperado: {},
  },
  {
    nombre: 'campos ausentes no son campos rechazados',
    // Una credencial sin email no tiene un error de email.
    salida: { dni: '30111222', email: '', telefono: null },
    esperado: { dni: '30111222' },
  },
]

describe('eval del OCR de credenciales', () => {
  // ─── El número que tiene que ser cero ──────────────────────────────────────
  it('CONTAMINACIÓN: ningún campo malo se acepta como bueno', () => {
    const colados: string[] = []
    for (const caso of CASOS) {
      const { campos } = normalizarCredencial(caso.salida)
      for (const clave of Object.keys(campos) as (keyof DatosCredencial)[]) {
        if (!(clave in caso.esperado)) {
          colados.push(`${caso.nombre} → ${clave} = ${JSON.stringify(campos[clave])}`)
        } else if (campos[clave] !== caso.esperado[clave]) {
          colados.push(`${caso.nombre} → ${clave} quedó ${JSON.stringify(campos[clave])} y debía ser ${JSON.stringify(caso.esperado[clave])}`)
        }
      }
    }
    expect(colados).toEqual([])
  })

  // ─── El número que se vigila, y puede moverse ─────────────────────────────
  it('COBERTURA: se extrae el 100% de los campos que sí eran válidos', () => {
    let esperados = 0, obtenidos = 0
    const faltantes: string[] = []
    for (const caso of CASOS) {
      const { campos } = normalizarCredencial(caso.salida)
      for (const clave of Object.keys(caso.esperado) as (keyof DatosCredencial)[]) {
        esperados++
        if (campos[clave] === caso.esperado[clave]) obtenidos++
        else faltantes.push(`${caso.nombre} → ${clave}`)
      }
    }
    // Se imprime aunque pase: el valor del eval es el número, no el verde.
    console.log(`[eval OCR] cobertura ${obtenidos}/${esperados} campos (${Math.round(obtenidos / esperados * 100)}%)`)
    expect(faltantes).toEqual([])
  })

  it('todo campo rechazado dice por qué', () => {
    for (const caso of CASOS) {
      for (const r of normalizarCredencial(caso.salida).rechazos) {
        expect(r.motivo.length, `${caso.nombre} → ${r.campo}`).toBeGreaterThan(5)
        expect(r).toHaveProperty('recibido')
      }
    }
  })

  it('no revienta con cualquier cosa en lugar de un objeto', () => {
    for (const basura of [null, undefined, 'texto suelto', 42, [], NaN]) {
      expect(() => normalizarCredencial(basura)).not.toThrow()
      expect(normalizarCredencial(basura).campos).toEqual({})
    }
  })
})

describe('coherencia entre el estado y el vencimiento', () => {
  const HOY = new Date('2026-09-12T00:00:00Z')

  it('avisa cuando dice Vigente y ya venció', () => {
    const avisos = avisosDeCoherencia(
      { reprocann_estado: 'Vigente', reprocann_vencimiento: '2026-01-01' }, HOY)
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toContain('2026-01-01')
  })

  it('avisa cuando dice Vencido y todavía no venció', () => {
    expect(avisosDeCoherencia(
      { reprocann_estado: 'Vencido', reprocann_vencimiento: '2027-01-01' }, HOY)).toHaveLength(1)
  })

  it('no avisa cuando cierran', () => {
    expect(avisosDeCoherencia(
      { reprocann_estado: 'Vigente', reprocann_vencimiento: '2027-01-01' }, HOY)).toEqual([])
  })

  // Un aviso no es un rechazo: los dos datos pueden estar bien leídos y aun así
  // no cerrar. Lo resuelve una persona mirando el papel.
  it('la contradicción NO borra los campos', () => {
    const { campos, rechazos } = normalizarCredencial(
      { reprocann_estado: 'Vigente', reprocann_vencimiento: '2020-01-01' })
    expect(campos.reprocann_estado).toBe('Vigente')
    expect(campos.reprocann_vencimiento).toBe('2020-01-01')
    expect(rechazos).toEqual([])
  })
})
