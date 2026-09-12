// Un flujo mal armado no falla: te lleva a una pantalla que no sirve y te deja
// pensando que ya está. Estos tests cuidan lo que no se ve al mirarlo andar.

import { describe, it, expect } from 'vitest'
import { FLUJOS, flujoDe, pasoSaneado, rutaDePaso, type DatosFlujo } from '../flujosOng'
import { esTab } from '../pestanasOng'
import { accionesOng } from '../accionesOng'

const ids = Object.keys(FLUJOS)

describe('flujos', () => {
  it('ninguno tiene un solo paso: eso no es un flujo, es una acción', () => {
    const flacos = ids.filter(id => FLUJOS[id].pasos.length < 2)
    expect(flacos).toEqual([])
  })

  it('todo paso dice qué hacer y por qué importa', () => {
    const mudos: string[] = []
    for (const id of ids) {
      FLUJOS[id].pasos.forEach((p, i) => {
        if (!p.titulo?.trim() || !p.porQue?.trim()) mudos.push(`${id}[${i + 1}]`)
      })
    }
    expect(mudos).toEqual([])
  })

  it('el «por qué» convence, no repite el título', () => {
    const flojos: string[] = []
    for (const id of ids) {
      FLUJOS[id].pasos.forEach((p, i) => {
        if (p.porQue.trim().length < 30) flojos.push(`${id}[${i + 1}]`)
      })
    }
    expect(flojos).toEqual([])
  })

  it('todo paso de la O.N.G. cae en una pestaña que existe', () => {
    const rotas: string[] = []
    for (const id of ids) {
      for (const p of FLUJOS[id].pasos) {
        if (!p.ruta.startsWith('/ong/')) continue
        if (!esTab(p.ruta.replace('/ong/', '').split('?')[0])) rotas.push(`${id}: ${p.ruta}`)
      }
    }
    expect(rotas).toEqual([])
  })

  it('el id del flujo coincide con su clave', () => {
    const desalineados = ids.filter(id => FLUJOS[id].id !== id)
    expect(desalineados).toEqual([])
  })

  it('todo flujo que una acción declara existe de verdad', () => {
    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    const fantasmas = accionesOng(vacio)
      .filter(a => a.flujo && !flujoDe(a.flujo))
      .map(a => `${a.id} -> ${a.flujo}`)
    expect(fantasmas).toEqual([])
  })

  it('un paso fuera de rango no rompe: se recorta', () => {
    // La URL la escribe cualquiera. Un ?paso=99 no vale una pantalla de error.
    const f = FLUJOS.comprar
    expect(pasoSaneado(f, '99')).toBe(f.pasos.length)
    expect(pasoSaneado(f, '0')).toBe(1)
    expect(pasoSaneado(f, '-3')).toBe(1)
    expect(pasoSaneado(f, 'hola')).toBe(1)
    expect(pasoSaneado(f, null)).toBe(1)
    expect(pasoSaneado(f, '2.7')).toBe(2)
  })

  it('la ruta de un paso arrastra el flujo, para que la barra siga viva', () => {
    const r = rutaDePaso(FLUJOS.comprar, 2)
    expect(r).toContain('flujo=comprar')
    expect(r).toContain('paso=2')
  })

  it('respeta el separador cuando la ruta ya trae query', () => {
    // El paso 1 de comprar lleva ?nueva=gasto: si se pegara otro ? en vez de &,
    // el flujo se perdería y la barra no aparecería nunca.
    const r = rutaDePaso(FLUJOS.comprar, 1)
    expect(r).toBe('/ong/documentos?nueva=gasto&flujo=comprar&paso=1')
    expect(r.split('?')).toHaveLength(2)
  })

  it('flujoDe no explota con lo que no existe', () => {
    expect(flujoDe('inventado')).toBeNull()
    expect(flujoDe(null)).toBeNull()
    expect(flujoDe(undefined)).toBeNull()
    expect(flujoDe('')).toBeNull()
  })
})

describe('estado de los pasos', () => {
  // Un tilde que miente es peor que ninguno: deja a alguien creyendo que ya hizo
  // algo que no hizo. Por eso sólo los pasos verificables tienen `estado`, y los
  // que lo tienen se prueban en los dos sentidos.
  const base = () => ({
    pacientesActivos: [] as { tope_mensual_g?: number | null }[],
    asociadosSinActa: 0,
    traslados: [] as { carta_porte_presentada?: boolean }[],
    dispensas: [] as { recibo_numero?: number | null; gramos?: number }[],
    documentos: [] as { subtipo?: string | null; descripcion?: string | null }[],
    cuotasEmitidas: [] as { periodo: string }[],
    periodo: '2026-08',
    mes: '2026-08',
    erroresDeCoherencia: 0,
    faltanteDeMateria: 0,
    hayEntidadConCuit: false,
    autoridades: 0,
    predios: 0,
    librosRubricados: 0,
    ddjj: [] as { periodo: string; presentada?: boolean | null }[],
    semestre: '2026-S2',
  })

  const estadoDe = (flujo: string, paso: number, d: ReturnType<typeof base>) =>
    FLUJOS[flujo].pasos[paso - 1].estado?.(d)

  it('el tope se marca hecho sólo cuando no falta ninguno', () => {
    expect(estadoDe('sumar', 2, { ...base(), pacientesActivos: [{ tope_mensual_g: 30 }] })?.hecho).toBe(true)
    const falta = estadoDe('sumar', 2, {
      ...base(), pacientesActivos: [{ tope_mensual_g: 30 }, { tope_mensual_g: null }] })
    expect(falta?.hecho).toBe(false)
    expect(falta?.nota).toContain('1 paciente sin tope')
  })

  it('un tope en cero no cuenta como tope cargado', () => {
    expect(estadoDe('sumar', 2, { ...base(), pacientesActivos: [{ tope_mensual_g: 0 }] })?.hecho).toBe(false)
  })

  it('la carta de porte mira los traslados sin presentar', () => {
    expect(estadoDe('mover', 2, {
      ...base(), traslados: [{ carta_porte_presentada: true }] })?.hecho).toBe(true)
    const falta = estadoDe('mover', 2, {
      ...base(), traslados: [{ carta_porte_presentada: true }, {}] })
    expect(falta?.hecho).toBe(false)
    expect(falta?.nota).toContain('1 traslado sin carta')
  })

  it('el recibo se cuenta sólo sobre las entregas que lo llevan', () => {
    // Consumo interno y merma no llevan recibo de aporte: pedirlo marcaría en
    // rojo filas que están bien. Y una entrega SIN aporte tampoco lo lleva: el
    // recibo es por reembolso de costos, así que sin plata no documenta nada y
    // gastaría un número del libro.
    //
    // Este test miraba sólo los gramos, y con eso el paso pedía recibos que no
    // existen: el 23/08/2026 decía «1121 entregas sin recibo» cuando las que
    // correspondían eran 846, y no se tildaba ni emitiéndolas todas.
    const sinRecibo = (d: Partial<DatosFlujo['dispensas'][number]>) =>
      estadoDe('entregar', 2, { ...base(), dispensas: [{ recibo_numero: null, ...d }] })?.hecho

    // No llevan recibo, así que el paso está bien:
    expect(sinRecibo({ gramos: 0, aporte: 0, modalidad: 'Paciente' })).toBe(true)
    expect(sinRecibo({ gramos: 3, aporte: 0, modalidad: 'Paciente' })).toBe(true)
    expect(sinRecibo({ gramos: 3, aporte: 9000, modalidad: 'Consumo interno' })).toBe(true)
    expect(sinRecibo({ gramos: 3, aporte: 9000, modalidad: 'Merma' })).toBe(true)

    // Ésta sí lo lleva, y falta:
    expect(sinRecibo({ gramos: 3, aporte: 9000, modalidad: 'Paciente' })).toBe(false)
  })

  it('las cuotas se miran del período en curso, no de cualquiera', () => {
    expect(estadoDe('cerrar', 1, {
      ...base(), cuotasEmitidas: [{ periodo: '2026-07' }] })?.hecho).toBe(false)
    expect(estadoDe('cerrar', 1, {
      ...base(), cuotasEmitidas: [{ periodo: '2026-08' }] })?.hecho).toBe(true)
  })

  it('los registros del mes son DOS: entregas y caja', () => {
    const uno = estadoDe('cerrar', 2, { ...base(), documentos: [
      { subtipo: 'Registro mensual', descripcion: 'Registro de entregas 2026-08' }] })
    expect(uno?.hecho).toBe(false)
    expect(uno?.nota).toContain('falta uno')
    expect(estadoDe('cerrar', 2, { ...base(), documentos: [
      { subtipo: 'Registro mensual', descripcion: 'Registro de entregas 2026-08' },
      { subtipo: 'Registro mensual', descripcion: 'Registro de caja 2026-08' }] })?.hecho).toBe(true)
  })

  it('un registro de otro mes no cuenta para éste', () => {
    expect(estadoDe('cerrar', 2, { ...base(), documentos: [
      { subtipo: 'Registro mensual', descripcion: 'Registro de entregas 2026-07' },
      { subtipo: 'Registro mensual', descripcion: 'Registro de caja 2026-07' }] })?.hecho).toBe(false)
  })

  it('el lote nunca se da por hecho: no se puede saber cuál es de esta compra', () => {
    // Lo honesto acá no es un tilde sino el faltante del balance, que sí se ve.
    const sinFaltante = estadoDe('comprar', 2, base())
    expect(sinFaltante?.hecho).toBe(false)
    expect(sinFaltante?.nota).toContain('cierra')
    const conFaltante = estadoDe('comprar', 2, { ...base(), faltanteDeMateria: 250 })
    expect(conFaltante?.nota).toContain('250 g')
  })

  it('una buena noticia no se pinta de advertencia', () => {
    // «El balance de materia cierra» es buena noticia y aun asi el paso NO esta
    // hecho: que el total cierre no prueba que ESTA compra tenga su lote. Sin
    // separar las dos cosas, esa nota salia en naranja y se leia como problema.
    const bien = estadoDe('comprar', 2, base())
    expect(bien?.hecho).toBe(false)
    expect(bien?.tono).toBe('bueno')

    const mal = estadoDe('comprar', 2, { ...base(), faltanteDeMateria: 250 })
    expect(mal?.hecho).toBe(false)
    expect(mal?.tono).toBe('aviso')
  })

  it('el paso del lote manda a la solapa donde se crean, no a Reservas', () => {
    // El portal abre en Reservas. Sin la vista pedida, el paso dejaba en la
    // pantalla correcta y en la solapa equivocada.
    expect(FLUJOS.comprar.pasos[1].ruta).toContain('vista=catalogo')
  })

  it('los pasos que abren un formulario dicen qué tener a mano', () => {
    // Llegar al formulario y recien ahi darse cuenta de que falta el papel
    // obliga a salir, buscarlo y volver a empezar.
    const mudos: string[] = []
    for (const id of Object.keys(FLUJOS)) {
      FLUJOS[id].pasos.forEach((p, i) => {
        if (p.ruta.includes('nueva=') && !p.teneAMano?.length) mudos.push(`${id}[${i + 1}]`)
      })
    }
    expect(mudos).toEqual([])
  })

  it('el nombre de cada flujo dice quién hace qué', () => {
    // «Comprar material» a secas se puede leer al reves —como si alguien le
    // comprara a la asociacion— y eso ya paso.
    expect(FLUJOS.comprar.label).toContain('proveedor')
    // «Entregar» y no «vender»: lo que la persona paga es un reembolso de
    // costos, y de eso depende que la operacion este amparada.
    expect(FLUJOS.entregar.label.toLowerCase()).not.toContain('vend')
  })

  it('comprar termina verificando que la compra cerró', () => {
    const ultimo = FLUJOS.comprar.pasos[FLUJOS.comprar.pasos.length - 1]
    expect(ultimo.ruta).toContain('coherencia')
  })

  it('todo paso con estado devuelve también una nota que lo explique', () => {
    const mudos: string[] = []
    for (const id of Object.keys(FLUJOS)) {
      FLUJOS[id].pasos.forEach((p, i) => {
        if (p.estado && !p.estado(base()).nota) mudos.push(`${id}[${i + 1}]`)
      })
    }
    expect(mudos).toEqual([])
  })

  // ---------- Presentar la declaración jurada ----------

  it('la declaración se marca armada sólo cuando existe la del semestre en curso', () => {
    // Una declaración de OTRO semestre no sirve: la del período corriente es la
    // que vence. Contar cualquiera dejaría el paso en verde con la que vence sin
    // armar.
    const d = base()
    expect(estadoDe('presentar', 2, d)?.hecho).toBe(false)

    d.ddjj = [{ periodo: '2026-S1', presentada: true }]
    expect(estadoDe('presentar', 2, d)?.hecho).toBe(false)

    d.ddjj = [{ periodo: '2026-S2' }]
    expect(estadoDe('presentar', 2, d)?.hecho).toBe(true)
  })

  it('armar no es presentar: el último paso los distingue', () => {
    // Es la confusión que el flujo viene a evitar. Una declaración armada y sin
    // presentar deja el vencimiento corriendo, y por la pantalla se ve igual de
    // completa que una presentada.
    const d = base()
    expect(estadoDe('presentar', 4, d)?.nota).toMatch(/armarla/)

    d.ddjj = [{ periodo: '2026-S2', presentada: false }]
    const armada = estadoDe('presentar', 4, d)
    expect(armada?.hecho).toBe(false)
    expect(armada?.nota).toMatch(/sin presentar/)

    d.ddjj = [{ periodo: '2026-S2', presentada: true }]
    expect(estadoDe('presentar', 4, d)?.hecho).toBe(true)
  })

  it('el mínimo de cinco personas vinculadas se cuenta, no se asume', () => {
    const d = base()
    d.pacientesActivos = Array.from({ length: 4 }, () => ({ tope_mensual_g: 40 }))
    expect(estadoDe('presentar', 1, d)?.hecho).toBe(false)
    d.pacientesActivos.push({ tope_mensual_g: 40 })
    expect(estadoDe('presentar', 1, d)?.hecho).toBe(true)
  })

  it('un paso que sale de la O.N.G. tiene barra igual, porque está en el layout', () => {
    // ESTE TEST CAMBIÓ DE SENTIDO EL 27/08/2026, y el anterior lo anticipaba:
    // «si algún día la barra se dibuja en el layout, este test es lo que hay que
    // borrar, y a propósito: obliga a decidirlo, no a descubrirlo».
    //
    // Se decidió. `cosechar` es el primer flujo cuyos pasos viven en Cultivo
    // —genética, planta, peso— porque ahí es donde se cargan, y no hay forma de
    // moverlos. Así que `PageTransition` dibuja la barra fuera de /ong.
    //
    // Lo que el test cuida ahora es lo mismo de antes, por el otro lado: que
    // ningún paso quede en una ruta donde la barra NO se dibuja. Hoy se dibuja
    // en las dos: adentro la pone PaginaONG con `datos`, afuera el layout sin
    // ellos. Lo único que no puede pasar es que un paso apunte a `/sumate` o al
    // login, que están fuera del layout con sesión.
    const sinBarra: string[] = []
    for (const f of Object.values(FLUJOS)) {
      f.pasos.forEach((p, i) => {
        if (p.ruta.startsWith('/sumate') || p.ruta.startsWith('/login')) {
          sinBarra.push(`${f.id} paso ${i + 1}: ${p.ruta}`)
        }
      })
    }
    expect(sinBarra).toEqual([])
  })

  it('la barra no se dibuja dos veces: adentro de /ong la pone PaginaONG', () => {
    // Si `PageTransition` dibujara la barra tambien en /ong saldrian dos, y la
    // de arriba sin las marcas de «ya hecho». El guardia esta en el layout
    // (`enOng`), y este test deja escrito por que existe.
    const dentro = Object.values(FLUJOS)
      .flatMap(f => f.pasos.map(p => p.ruta))
      .filter(r => r.startsWith('/ong'))
    expect(dentro.length).toBeGreaterThan(0)
  })
})
