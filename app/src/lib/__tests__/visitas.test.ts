// El registro de visitas.
//
// Se testea lo que produce NÚMEROS que alguien va a mirar y repetir en voz
// alta: «este mes atendimos 47 personas». Si eso está mal, está mal en un
// informe, no en una pantalla.

import { describe, it, expect } from 'vitest'
import {
  resumenVisitas, etiquetaMotivo, etiquetaResultado, nombreDeVisita, esDerivada,
  MOTIVOS, RESULTADOS, type Visita,
} from '../visitas'

const v = (p: Partial<Visita>): Visita => ({
  id: Math.random().toString(36).slice(2),
  fecha: '2026-08-31', hora: null,
  paciente_id: null, nombre_libre: null, contacto: null,
  motivo: 'Consulta o informacion', resultado: 'Solo informacion',
  atendio: null, user_id: null, notas: null, origen: 'registrada', creada_en: '2026-08-31T10:00:00Z',
  ...p,
})

const PADRON = [
  { id: 'p1', nombre_completo: 'Marta Gómez' },
  { id: 'p2', nombre_completo: 'Hugo Miranda' },
]

describe('resumenVisitas', () => {
  it('cuenta PERSONAS y no visitas para el mes', () => {
    // Es la diferencia que importa: «atendimos 47» y «vinieron 47 personas» no
    // son lo mismo cuando alguien viene tres veces, y el número que la
    // asociación quiere dar afuera es el segundo.
    const r = resumenVisitas([
      v({ fecha: '2026-08-03', paciente_id: 'p1' }),
      v({ fecha: '2026-08-11', paciente_id: 'p1' }),
      v({ fecha: '2026-08-20', paciente_id: 'p1' }),
      v({ fecha: '2026-08-22', paciente_id: 'p2' }),
    ], '2026-09-01')
    expect(r.mes).toBe(4)
    expect(r.personasMes).toBe(2)
  })

  it('la misma persona sin ficha no cuenta dos veces por escribirla distinto', () => {
    // Sin normalizar, «  juan perez » y «Juan Perez» son dos personas y el
    // contador de gente atendida se infla solo.
    const r = resumenVisitas([
      v({ fecha: '2026-08-05', nombre_libre: 'Juan Perez' }),
      v({ fecha: '2026-08-19', nombre_libre: '  juan perez ' }),
    ], '2026-08-31')
    expect(r.personasMes).toBe(1)
    expect(r.sinPadron).toBe(1)
  })

  it('la ventana son 30 días móviles, no el mes calendario', () => {
    // ⚠ EL CASO QUE LO CAMBIÓ. Era «este mes» y el 01/09/2026 la pantalla decía
    // 0 sobre 945 visitas cargadas, porque septiembre acababa de empezar.
    // Correcto y muerto: el primero de cada mes, justo cuando alguien entra a
    // ver cómo viene, los contadores estaban todos en cero.
    const r = resumenVisitas([
      v({ fecha: '2026-08-31', paciente_id: 'p1' }),
      v({ fecha: '2026-08-20', paciente_id: 'p2' }),
    ], '2026-09-01')
    expect(r.mes).toBe(2)
    expect(r.personasMes).toBe(2)
  })

  it('lo que quedó fuera de la ventana no cuenta', () => {
    const r = resumenVisitas([
      v({ fecha: '2026-08-03', paciente_id: 'p1' }),  // día 30 hacia atrás: entra
      v({ fecha: '2026-08-02', paciente_id: 'p2' }),  // día 31: queda afuera
    ], '2026-09-01')
    expect(r.mes).toBe(1)
  })

  it('el corte cruza el cambio de año sin romperse', () => {
    const r = resumenVisitas([
      v({ fecha: '2025-12-20', paciente_id: 'p1' }),
      v({ fecha: '2026-01-05', paciente_id: 'p2' }),
    ], '2026-01-10')
    expect(r.mes).toBe(2)
  })

  it('«sin cerrar» son las que quedaron sin resultado, de cualquier mes', () => {
    // Una visita abierta de julio sigue abierta en agosto: acotarla al mes la
    // haría desaparecer sola, que es lo contrario de para lo que sirve.
    const r = resumenVisitas([
      v({ fecha: '2026-07-10', paciente_id: 'p1', resultado: null }),
      v({ fecha: '2026-08-30', paciente_id: 'p2', resultado: 'Se le entrego' }),
    ], '2026-08-31')
    expect(r.sinResultado).toBe(1)
  })

  it('«hoy» es hoy, no las últimas 24 horas', () => {
    const r = resumenVisitas([
      v({ fecha: '2026-08-31' }), v({ fecha: '2026-08-30' }),
    ], '2026-08-31')
    expect(r.hoy).toBe(1)
  })

  it('sin visitas, todo en cero y sin romperse', () => {
    expect(resumenVisitas([], '2026-08-31'))
      .toEqual({ hoy: 0, mes: 0, personasMes: 0, primeraVez: 0, sinResultado: 0, sinPadron: 0, derivadasMes: 0 })
  })
})

describe('las visitas que trajo el historial', () => {
  // Se dedujeron 945 visitas de las 1.059 entregas con paciente: una por
  // PERSONA y DIA, no una por entrega. Los 98 días en que alguien se llevó dos
  // lotes son una visita, no dos.
  it('una deducida se distingue de una registrada', () => {
    expect(esDerivada(v({ origen: 'derivada_de_dispensa' }))).toBe(true)
    expect(esDerivada(v({ origen: 'registrada' }))).toBe(false)
  })

  it('el resumen dice cuántas del mes las dedujo el sistema', () => {
    // Sin esto «atendimos 3 este mes» no se puede defender: no hay forma de
    // decir cuántas de esas las vio alguien.
    const r = resumenVisitas([
      v({ fecha: '2026-08-02', paciente_id: 'p1', origen: 'derivada_de_dispensa' }),
      v({ fecha: '2026-08-09', paciente_id: 'p2', origen: 'derivada_de_dispensa' }),
      v({ fecha: '2026-08-30', paciente_id: 'p1', origen: 'registrada' }),
      v({ fecha: '2026-07-01', paciente_id: 'p1', origen: 'derivada_de_dispensa' }),
    ], '2026-08-31')
    expect(r.mes).toBe(3)
    expect(r.derivadasMes).toBe(2)
    expect(r.personasMes).toBe(2)
  })

  it('las deducidas vienen cerradas, así que no inflan «sin cerrar»', () => {
    const r = resumenVisitas([
      v({ paciente_id: 'p1', origen: 'derivada_de_dispensa', resultado: 'Se le entrego' }),
    ], '2026-08-31')
    expect(r.sinResultado).toBe(0)
  })
})

describe('la visita que nace con la entrega', () => {
  // `guardarDispensa` engancha la entrega a la visita de ese día y la crea si no
  // existe. Acá se prueba la REGLA, que es lo que se puede probar sin base: una
  // persona que viene una vez y se lleva dos lotes son DOS entregas y UNA visita.
  //
  // Es el mismo criterio con el que se dedujeron las 945 del historial. Si no
  // fuera así, el contador de gente atendida se inflaría justo con quien vino
  // una sola vez, que es el número que la asociación dice afuera.
  const mismaVisita = (a: { paciente_id: string; fecha: string },
                       b: { paciente_id: string; fecha: string }) =>
    a.paciente_id === b.paciente_id && a.fecha === b.fecha

  it('dos entregas del mismo día a la misma persona son UNA visita', () => {
    expect(mismaVisita({ paciente_id: 'p1', fecha: '2026-09-01' },
                       { paciente_id: 'p1', fecha: '2026-09-01' })).toBe(true)
  })

  it('la misma persona otro día es otra visita', () => {
    expect(mismaVisita({ paciente_id: 'p1', fecha: '2026-09-01' },
                       { paciente_id: 'p1', fecha: '2026-09-02' })).toBe(false)
  })

  it('el mismo día pero otra persona es otra visita', () => {
    expect(mismaVisita({ paciente_id: 'p1', fecha: '2026-09-01' },
                       { paciente_id: 'p2', fecha: '2026-09-01' })).toBe(false)
  })

  it('la que nace de una entrega va MARCADA como deducida', () => {
    // El encuentro es real, pero el motivo y el resultado los puso el sistema.
    // Sin la marca, el panel no podría decir cuántas vio alguien.
    const nacida = v({ paciente_id: 'p1', motivo: 'Retiro',
                       resultado: 'Se le entrego', origen: 'derivada_de_dispensa' })
    expect(esDerivada(nacida)).toBe(true)
    expect(resumenVisitas([nacida], '2026-08-31').derivadasMes).toBe(1)
  })
})

describe('nombreDeVisita', () => {
  it('la ficha del padrón manda sobre el nombre escrito a mano', () => {
    expect(nombreDeVisita({ paciente_id: 'p1', nombre_libre: 'marta' }, PADRON)).toBe('Marta Gómez')
  })

  it('sin ficha, el nombre escrito', () => {
    expect(nombreDeVisita({ paciente_id: null, nombre_libre: 'Ana Ruiz' }, PADRON)).toBe('Ana Ruiz')
  })

  it('una ficha que ya no está no deja la fila en blanco', () => {
    // `paciente_id` es `ON DELETE SET NULL`, pero entre que se borra la ficha y
    // que la pantalla recarga, la visita puede apuntar a alguien que no está.
    expect(nombreDeVisita({ paciente_id: 'borrado', nombre_libre: null }, PADRON))
      .toBe('Sin identificar')
  })
})

describe('las etiquetas', () => {
  // La regla del `Record` indexado por un valor de la base: un valor nuevo
  // cargado por SQL no puede tumbar la pantalla. Ya pasó con `reprocann_estado`
  // el 20/08 y dejó Pacientes caída en producción para los 211.
  it('un valor que el front no conoce se muestra tal cual, no rompe', () => {
    expect(etiquetaMotivo('Algo Nuevo Cargado Por SQL')).toBe('Algo Nuevo Cargado Por SQL')
    expect(etiquetaResultado('Otro Valor')).toBe('Otro Valor')
  })

  it('sin resultado dice que está sin cerrar, no vacío', () => {
    expect(etiquetaResultado(null)).toBe('Sin cerrar')
    expect(etiquetaMotivo(null)).toBe('Sin motivo')
  })

  it('los valores GUARDADOS van sin tildes, porque el check de la base los exige', () => {
    // Si alguien agrega un motivo con tilde, el formulario guarda y Postgres lo
    // rechaza: el `check` de `ong_visitas` lista los valores en ASCII. Falla
    // acá, que es barato, en vez de en el mostrador con alguien enfrente.
    const conTilde = [...MOTIVOS, ...RESULTADOS]
      .map(x => x.valor)
      .filter(x => x !== x.normalize('NFD').replace(/[̀-ͯ]/g, ''))
    expect(conTilde).toEqual([])
  })

  it('toda etiqueta que se muestra tiene su valor, y son únicos', () => {
    for (const lista of [MOTIVOS, RESULTADOS]) {
      const valores = lista.map(x => x.valor)
      expect(new Set(valores).size).toBe(valores.length)
      expect(lista.every(x => x.label.trim().length > 0)).toBe(true)
    }
  })
})
