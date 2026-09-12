// Una botonera que ofrece seis cosas y falla en tres es peor que no tenerla.
//
// Lo que hace que estas acciones valgan la pena no es el idioma: es que sepan si
// se pueden hacer. Estos tests cuidan justamente eso, porque una condición mal
// puesta se ve igual que una bien puesta hasta que alguien la toca.

import { describe, it, expect } from 'vitest'
import { FLUJOS } from '../flujosOng'
import { accionesOng, GRUPOS_ACCION, ACCIONES_CULTIVO, RUTAS_CULTIVO, saleDeCultivo } from '../accionesOng'
import type { Entidad, LoteIngreso, Cuota, Asociado } from '../ong'
import { PERMISOS_ROL } from '../../hooks/useAuth'
import { esTab } from '../pestanasOng'

/** Una asociación andando: todo cargado. Cada test rompe sólo lo suyo. */
const completo = () => ({
  entidad: { id: 'e', cuit: '30-1234-5' } as Entidad,
  pacientes: 10,
  lotes: [{ gramos_totales: 500 }] as LoteIngreso[],
  asociados: [{ id: 'a', nombre: 'X', activo: true }] as Asociado[],
  cuotas: [{ id: 'c', valor: 5000 }] as Cuota[],
})

const buscar = (datos: Parameters<typeof accionesOng>[0], id: string) =>
  accionesOng(datos).find(a => a.id === id)!

describe('accionesOng', () => {
  it('con todo cargado, ninguna queda bloqueada', () => {
    const as = accionesOng(completo())
    expect(as.filter(a => a.estado !== 'lista')).toEqual([])
  })

  it('las frecuentes son pocas: las de todos los días', () => {
    // Si crecen, la pantalla de entrada vuelve a ser una lista larga y estamos
    // en el mismo problema que las dieciocho pestañas.
    //
    // Es un tope, no una cifra exacta. Estaba clavado en seis, y cuando se
    // sacó «cobrar las cuotas» de la portada —cero usos en un año contra 1.692
    // asientos de caja— el test falló por haber MEJORADO la pantalla. Un test
    // que se opone a sacar lo que no se usa está pidiendo lo contrario de lo
    // que quiere.
    //
    // Subio a siete el 27/08/2026, al entrar «registrar una cosecha». Es la
    // otra mitad de la regla: el tope frena que la portada se convierta en
    // lista, no que entre algo que se hace todos los dias. Cosechar lo es —y
    // el pedido salio de alguien que se quedo trabado justamente ahi.
    // Subió a 11 el 01/09/2026, y esta vez por PEDIDO EXPRESO de Gastón: quiso
    // cosecha, lote, entregar una reserva, cargar un costo y cargar un insumo en
    // la portada. El tope existe para que la pantalla de entrada no vuelva a ser
    // una lista, y sigue cumpliendo eso porque la portada está AGRUPADA POR
    // RITMO: «todos los días» quedó en tres, que es lo que se mira de reojo. Las
    // otras ocho caen en «cada tanto», que es una segunda lectura.
    //
    // Si esto vuelve a subir sin que nadie lo pida, ahí sí se rompió el criterio.
    const n = accionesOng(completo()).filter(a => a.frecuente).length
    expect(n).toBeGreaterThanOrEqual(4)
    expect(n).toBeLessThanOrEqual(11)
    // Lo que de verdad protege la pantalla: lo DIARIO tiene que seguir siendo poco.
    const diarias = accionesOng(completo()).filter(a => a.frecuente && a.ritmo === 'diario')
    expect(diarias.length).toBeLessThanOrEqual(4)
  })

  it('la portada tiene un orden declarado, y sin empates', () => {
    // El orden sale de contar el uso real en producción. Sin `ordenPortada` la
    // tarjeta cae al final por el `?? 99` del panel, que es un desempate mudo:
    // se ve prolijo y nadie se entera de que quedó sin declarar.
    const f = accionesOng(completo()).filter(a => a.frecuente)
    const sinOrden = f.filter(a => a.ordenPortada == null).map(a => a.id)
    expect(sinOrden).toEqual([])
    const puestos = f.map(a => a.ordenPortada)
    expect(new Set(puestos).size).toBe(puestos.length)
  })

  it('toda acción de la portada abre un flujo, no un formulario suelto', () => {
    // Es lo que se siente como «no se entiende cómo seguir»: tocás una tarjeta,
    // se abre un formulario, guardás, el modal se cierra y ahí te suelta. Las
    // de la portada son las que más se repiten, así que son las que más caro
    // pagan quedarse a mitad de camino.
    //
    // LA EXCEPCIÓN ES LA TAREA QUE TERMINA EN UN SOLO PASO. Lo que el flujo
    // resuelve es encadenar pantallas; una acción que empieza y termina en el
    // mismo formulario no tiene nada que encadenar, y ponerle un flujo de
    // adorno fue peor: «registrar una cosecha» tuvo tres pasos —Genéticas,
    // Plantas, Cosecha— y obligaba a recorrer dos pantallas donde no había nada
    // que hacer, porque en el caso normal la variedad y las plantas ya están.
    //
    // Se declaran a mano para que sacar un flujo sea una decisión y no algo que
    // se descubre después.
    const SIN_FLUJO: Record<string, string> = {
      cosecha: 'un solo paso: elegís la variedad y cargás el peso, en la misma pantalla',
      // Existe el flujo `comprar` y su segundo paso ES este formulario, pero no
      // sirve como flujo de esta acción: encadena comprobante, pago y cierre de
      // la compra, y la mitad de los lotes la organización no se compran -30 de 105
      // son `propio_sin_cosecha`, material propio de un cultivo que no está en
      // el sistema-. Mandar eso por un circuito de compra pediría un proveedor
      // y un comprobante que no existen.
      lote: 'un solo paso: el código, los gramos y de dónde vino, en el mismo formulario',
      // Se registra parada en el mostrador, con la persona enfrente: quién
      // vino, por qué y en qué terminó, todo en el mismo formulario. Encadenar
      // pantallas es exactamente lo que no puede pasar ahí.
      visita: 'un solo paso: quién vino, por qué y en qué terminó, en el mismo formulario',
      // Las cuatro que entraron a la portada el 01/09 por pedido de Gastón.
      // Todas empiezan y terminan en su propio formulario.
      costo: 'un solo paso: el concepto y el importe, en la misma pantalla',
      insumo: 'un solo paso: el insumo y su cantidad, en la misma pantalla',
      retiro: 'un solo paso: se busca la reserva y se marca entregada',
    }
    const mudas = accionesOng(completo())
      .filter(a => a.frecuente && !a.flujo && !SIN_FLUJO[a.id])
      .map(a => a.id)
    expect(mudas).toEqual([])

    // Y que la excepción no sobreviva a la acción que la justifica.
    const ids = new Set(accionesOng(completo()).map(a => a.id))
    expect(Object.keys(SIN_FLUJO).filter(k => !ids.has(k))).toEqual([])
  })

  it('toda acción declara qué permiso pide, y es uno que existe', () => {
    // Sin esto la portada mostraba las 39 a todo el mundo: un cultivador veía
    // «Anotar un gasto o un pago» en su pantalla de entrada, la tocaba, y la
    // base se lo rechazaba. Una acción que no se puede hacer no es una acción,
    // es una promesa rota en la pantalla más usada del sistema.
    //
    // La lista de permisos válidos se saca de `PERMISOS_ROL`, no se escribe a
    // mano: un permiso inventado —`ver_finanzas` en vez de `ver_plata`— no se
    // le concede a NADIE, así que la acción desaparecería para todos sin que
    // nada falle. Es el mismo error silencioso que las claves de `?nueva=`.
    const validos = new Set(Object.values(PERMISOS_ROL).flat())
    const rotas = accionesOng(completo())
      .filter(a => !a.permiso || !validos.has(a.permiso))
      .map(a => `${a.id}: ${a.permiso ?? '(sin permiso)'}`)
    expect(rotas).toEqual([])
  })

  it('cada rol ve algo que puede hacer, y nadie ve lo que no le toca', () => {
    // El invariante que de verdad importa: que el filtro no deje a alguien con
    // una pantalla de entrada vacía —que se lee como rota— ni le muestre a
    // alguien lo que la base le va a negar.
    const puede = (rol: keyof typeof PERMISOS_ROL) => {
      const suyos = new Set<string>(PERMISOS_ROL[rol])
      return accionesOng(completo()).filter(a => suyos.has(a.permiso))
    }

    // Nadie se queda sin nada que hacer.
    for (const rol of ['administrador', 'administrativo', 'cultivador',
                       'director_medico', 'director_cultivo'] as const) {
      expect(puede(rol).length).toBeGreaterThan(0)
    }

    // Y lo que no le toca, no lo ve. El cultivador trabaja la sala: no ve plata.
    const delCultivador = puede('cultivador').map(a => a.id)
    expect(delCultivador).not.toContain('gasto')
    expect(delCultivador).not.toContain('entregar')
    expect(delCultivador).toContain('plantas')

    // El director de cultivo firma traslados y declaraciones, y no ve fichas.
    const delDirCultivo = puede('director_cultivo').map(a => a.id)
    expect(delDirCultivo).toContain('mover')
    expect(delDirCultivo).not.toContain('seguimiento')
    expect(delDirCultivo).not.toContain('gasto')

    // El director médico ve el seguimiento y no la caja.
    const delDirMedico = puede('director_medico').map(a => a.id)
    expect(delDirMedico).toContain('seguimiento')
    expect(delDirMedico).not.toContain('gasto')
  })

  it('toda acción declara grupo e icono', () => {
    const rotas = accionesOng(completo())
      .filter(a => !GRUPOS_ACCION.includes(a.grupo) || !a.icono?.trim())
      .map(a => a.id)
    expect(rotas).toEqual([])
  })

  it('ningún id de acción está repetido', () => {
    const ids = accionesOng(completo()).map(a => a.id)
    expect(ids.filter((x, i) => ids.indexOf(x) !== i)).toEqual([])
  })

  it('sin pacientes no se puede entregar, y manda a cargarlos', () => {
    const a = buscar({ ...completo(), pacientes: 0 }, 'entregar')
    expect(a.estado).toBe('bloqueada')
    expect(a.motivo).toContain('paciente')
    expect(a.rutaMotivo).toBe('/ong/pacientes')
  })

  it('sin lotes no se puede entregar: no sale material que no ingresó', () => {
    const a = buscar({ ...completo(), lotes: [] }, 'entregar')
    expect(a.estado).toBe('bloqueada')
    expect(a.rutaMotivo).toBe('/ong/cupo')
  })

  it('sin CUIT se entrega igual, con aviso de que el recibo sale incompleto', () => {
    // Bloquear acá sería mentir sobre lo que el sistema puede hacer, y encima
    // dejaría entregas sin registrar. El material sale con recibo feo o sin
    // registro: lo segundo es peor.
    const a = buscar({ ...completo(), entidad: { id: 'e' } as Entidad }, 'entregar')
    expect(a.estado).toBe('aviso')
    expect(a.motivo).toContain('CUIT')
    expect(a.rutaMotivo).toBe('/ong/entidad')
  })

  it('la falta de pacientes pesa más que la de CUIT', () => {
    // Las dos fallan a la vez al arrancar de cero. Tiene que ganar la que
    // impide hacer la acción, no la que sólo afea el papel.
    const a = buscar({ ...completo(), pacientes: 0, entidad: null }, 'entregar')
    expect(a.estado).toBe('bloqueada')
  })

  it('sin cuota aprobada no se puede cobrar, y manda a las actas', () => {
    const a = buscar({ ...completo(), cuotas: [] }, 'cobrar')
    expect(a.estado).toBe('bloqueada')
    expect(a.motivo).toContain('acta')
    expect(a.rutaMotivo).toBe('/ong/actas')
  })

  it('una cuota en cero no cuenta como cuota', () => {
    const a = buscar({ ...completo(), cuotas: [{ id: 'c', valor: 0 }] as Cuota[] }, 'cobrar')
    expect(a.estado).toBe('bloqueada')
  })

  it('los asociados dados de baja no habilitan el cobro', () => {
    const a = buscar({ ...completo(),
      asociados: [{ id: 'a', nombre: 'X', activo: false }] as Asociado[] }, 'cobrar')
    expect(a.estado).toBe('bloqueada')
    expect(a.motivo).toContain('activos')
  })

  it('sumar, comprar y anotar un gasto nunca se bloquean', () => {
    // No dependen de nada cargado: son justamente por donde se empieza.
    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    for (const id of ['sumar', 'comprar', 'gasto']) {
      expect(buscar(vacio, id).estado).toBe('lista')
    }
  })

  it('lo que se puede hacer va primero', () => {
    const estados = accionesOng({ entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] })
      .map(a => a.estado)
    const peso = { lista: 0, aviso: 1, bloqueada: 2 }
    expect(estados).toEqual([...estados].sort((x, y) => peso[x] - peso[y]))
  })

  it('toda acción bloqueada dice adónde ir a destrabarla', () => {
    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    const mudas = accionesOng(vacio)
      .filter(a => a.estado !== 'lista')
      .filter(a => !a.motivo || !a.rutaMotivo)
      .map(a => a.id)
    expect(mudas).toEqual([])
  })

  it('toda ruta de la O.N.G. apunta a una pestaña que existe', () => {
    // Hay acciones que mandan FUERA de la O.N.G. —cargar una cosecha vive en
    // Cultivo— y esas se saltean. Las que empiezan con /ong/ tienen que caer en
    // una pestaña real, sin la query.
    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    const rutas = accionesOng(vacio).flatMap(a => [a.ruta, a.rutaMotivo]).filter(Boolean) as string[]
    const rotas = rutas
      .filter(r => r.startsWith('/ong/'))
      .filter(r => !esTab(r.replace('/ong/', '').split('?')[0]))
    expect(rotas).toEqual([])
  })

  it('los parámetros de la ruta son sólo los que el sistema entiende', () => {
    // `nueva` lo lee useAbrirAlLlegar, `ir` useIrASeccion, `guia` GuiaAlLlegar,
    // `vista` Portal.tsx para elegir solapa, y `flujo`/`paso` la barra de pasos.
    // Cualquier otro se ignora en silencio y la accion no hace
    // lo que promete.
    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    const conocidos = new Set(['nueva', 'ir', 'guia', 'flujo', 'paso', 'vista'])
    const desconocidos: string[] = []
    for (const a of accionesOng(vacio)) {
      const q = a.ruta.split('?')[1]
      if (!q) continue
      for (const par of q.split('&')) {
        const clave = par.split('=')[0]
        if (!conocidos.has(clave)) desconocidos.push(`${a.id}: ${clave}`)
      }
    }
    expect(desconocidos).toEqual([])
  })

  it('la acción con flujo arranca en el paso 1', () => {
    // Si arrancara sin `paso`, la barra aparecería recién al avanzar y el primer
    // paso quedaría sin guía, que es justo cuando más hace falta.
    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    const conFlujo = accionesOng(vacio).filter(a => a.flujo)
    expect(conFlujo.length).toBeGreaterThan(0)
    const malas = conFlujo.filter(a => !a.ruta.includes('paso=1'))
    expect(malas.map(a => a.id)).toEqual([])
  })
  it('todo grupo que una acción usa está en la lista oficial', () => {
    // La lista vivía en tres lugares —el tipo, el panel y este test— y agregar
    // un grupo compilaba, se veía bien, y hacía fallar un test por una razón
    // que no tenía nada que ver. Ahora sale de un solo lado.
    const usados = [...new Set(accionesOng(completo()).map(a => a.grupo))]
    const huerfanos = usados.filter(g => !GRUPOS_ACCION.includes(g))
    expect(huerfanos).toEqual([])
  })

  it('ningún grupo de la lista queda sin acciones', () => {
    // Un grupo vacío dibuja un encabezado y nada debajo.
    const usados = new Set(accionesOng(completo()).map(a => a.grupo))
    const vacios = GRUPOS_ACCION.filter(g => !usados.has(g))
    expect(vacios).toEqual([])
  })

  it('las acciones cubren toda la app, no sólo la O.N.G.', () => {
    // La mitad de lo que la app hace —cultivo, ambiente, costos— vivía fuera
    // del panel: quien entraba a buscar «cargar un costo» no lo encontraba.
    const rutas = accionesOng(completo()).map(a => a.ruta)
    expect(rutas.some(r => !r.startsWith('/ong'))).toBe(true)
  })

  it('todo «?ir=» apunta a un ancla que existe en la pantalla', () => {
    // Una accion puede llevar a la pantalla correcta y aun asi dejar al usuario
    // mirando otra cosa: `?ir=` baja hasta la seccion. Pero si el `id` no existe
    // —o alguien lo renombra— el hook no encuentra nada y falla en silencio: se
    // llega arriba de todo, sin ningun aviso de que la seccion estaba mas abajo.
    //
    // Fue peor que eso una vez: la lista de la 1780 vivia dentro de un
    // componente que hacia return temprano cuando no habia entidad cargada, asi
    // que en una instalacion nueva la palabra «requisito» no aparecia en toda la
    // pantalla a la que la accion llevaba.
    const fuentes = Object.values(
      import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
    ) as string[]
    const anclas = new Set<string>()
    for (const src of fuentes) {
      for (const m of src.matchAll(/\bid="([a-zA-Z][\w-]*)"/g)) anclas.add(m[1])
    }
    expect(anclas.size).toBeGreaterThan(0) // si el regex deja de matchear, esto no prueba nada

    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    const rutas = [
      ...accionesOng(vacio).map(a => a.ruta),
      ...Object.values(FLUJOS).flatMap(f => f.pasos.map(p => p.ruta)),
    ]
    const rotas = rutas
      .map(r => new URLSearchParams(r.split('?')[1] ?? '').get('ir'))
      .filter((x): x is string => !!x)
      .filter(id => !anclas.has(id))
    expect(rotas).toEqual([])
  })

  it('la acción que abre un flujo empieza donde empieza el flujo', () => {
    // La accion enganchа `?flujo=X&paso=1`, asi que la pantalla a la que lleva
    // tiene que ser la del paso 1. Si no, la barra anuncia «paso 1: cargá las
    // plantas» parada en otra pantalla, y hay que navegar a mano hasta el lugar
    // que el paso ya nombraba: exactamente el trabajo que el flujo venia a
    // ahorrar. Los seis flujos originales lo cumplian por costumbre; el septimo
    // lo rompio, y nada aviso.
    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    const sinPuerta = accionesOng(vacio)
      .filter(a => a.flujo)
      .filter(a => {
        const paso1 = FLUJOS[a.flujo!]?.pasos[0]
        if (!paso1) return true
        if (a.ruta.split('?')[0] !== paso1.ruta.split('?')[0]) return true
        // Y ademas el `nueva=`, que es lo que abre el formulario.
        //
        // Comparar solo el pathname dejaba pasar el caso peor: la accion lleva
        // a la pantalla correcta y sin `nueva=`, asi que llega a la LISTA. Se
        // ve bien —es la pantalla que el paso nombraba— y hay que encontrar el
        // boton a mano. El test quedaba en verde justo cuando el flujo dejaba
        // de ser operativo.
        const claveDelPaso = new URLSearchParams(paso1.ruta.split('?')[1]).get('nueva')
        const claveDeLaAccion = new URLSearchParams(a.ruta.split('?')[1]).get('nueva')
        return claveDelPaso !== claveDeLaAccion
      })
      .map(a => `${a.id}: ${a.ruta} != ${FLUJOS[a.flujo!]?.pasos[0]?.ruta}`)
    expect(sinPuerta).toEqual([])
  })

  it('toda acción muestra su guía en algún lado: en el formulario o en la URL', () => {
    // Habia veintisiete acciones que declaraban una guia y llevaban a pantallas
    // sin formulario propio —el banco de geneticas, el ambiente, los costos—.
    // La guia estaba escrita y NUNCA se dibujaba. No fallaba nada: la accion
    // simplemente soltaba en la puerta, que es de lo que veniamos.
    //
    // Ahora hay TRES formas validas de mostrarla, y toda accion tiene que usar
    // una: el modal la dibuja con <GuiaDelFormulario id="X">, la ruta se lleva
    // `?guia=X`, o —si la accion abre un flujo— la lleva alguno de sus pasos.
    //
    // La tercera se sumo el 27/08/2026. En un flujo de varias pantallas la guia
    // no siempre va en la primera: la de `cosecha` explica que el peso seco es
    // el que cuenta y que sin lote no se puede entregar, y eso sirve en el paso
    // 3, no en el 1. Ponerla ademas en el 1 dibujaba dos paneles diciendo lo
    // mismo, porque ahi ya esta la barra del flujo.
    //
    // Lo que el test sigue cuidando es lo mismo de antes: que una guia escrita
    // se muestre EN ALGUN LADO. Que este en otro paso es una ubicacion; no
    // mostrarse nunca es lo que veniamos a evitar.
    const fuentes = Object.entries(
      import.meta.glob('../../**/*.tsx', { query: '?raw', import: 'default', eager: true }),
    ) as [string, string][]
    const enFormulario = new Set<string>()
    for (const [, src] of fuentes) {
      for (const m of src.matchAll(/GuiaDelFormulario\s+id="([a-zA-Z]+)"/g)) enFormulario.add(m[1])
    }
    expect(enFormulario.size).toBeGreaterThan(0)

    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    const guiaEnAlgunPaso = (a: { guia?: string; flujo?: string }) =>
      (a.flujo ? FLUJOS[a.flujo]?.pasos ?? [] : [])
        .some(p => new URLSearchParams(p.ruta.split('?')[1] ?? '').get('guia') === a.guia)

    const mudas = accionesOng(vacio)
      .filter(a => a.guia)
      .filter(a => !enFormulario.has(a.guia!))
      .filter(a => new URLSearchParams(a.ruta.split('?')[1] ?? '').get('guia') !== a.guia)
      .filter(a => !guiaEnAlgunPaso(a))
      .map(a => `${a.id} (${a.guia}) -> ${a.ruta}`)
    expect(mudas).toEqual([])
  })

  it('la tarjeta del lote cae en Catálogo y con la clave que Catálogo espera', () => {
    // El 27/08/2026 «Crear un lote» no hacía nada: se abría el portal, se veía
    // la guía arriba, y abajo NO había ningún formulario. Dos errores en la
    // misma cadena de query, y cada uno solo bastaba para romperla:
    //
    //   1. Sin `vista`, Portal.tsx abre en Reservas. Los lotes están en
    //      Catálogo, así que dejaba en la pantalla correcta y en la solapa
    //      equivocada — el mismo problema que `?vista=` vino a resolver para el
    //      flujo de comprar material, que sí lo usa.
    //   2. `?nueva=1` no dispara nada: `useAbrirAlLlegar` en Catalogo.tsx pide
    //      la clave `lote`, porque el portal tiene más de un formulario.
    //
    // Ninguno de los dos rompe el build ni tira un error en consola: la acción
    // simplemente no pasa nada, que es la forma más cara de fallar. Por eso el
    // test lee las CLAVES DEL CÓDIGO y no una copia escrita acá: una lista
    // repetida a mano se desincroniza igual que se desincronizó la ruta.
    const fuentes = Object.entries(
      import.meta.glob('../../**/*.tsx', { query: '?raw', import: 'default', eager: true }),
    ) as [string, string][]

    const catalogo = fuentes.find(([r]) => r.endsWith('portal/Catalogo.tsx'))
    expect(catalogo, 'no se encontró Catalogo.tsx').toBeTruthy()
    const claves = [...catalogo![1].matchAll(/useAbrirAlLlegar\([^,]+,\s*'([^']+)'/g)].map(m => m[1])
    expect(claves.length).toBeGreaterThan(0)

    const lote = buscar(completo(), 'lote')
    const q = new URLSearchParams(lote.ruta.split('?')[1] ?? '')
    expect(q.get('vista'), `${lote.ruta} tiene que pedir la solapa`).toBe('catalogo')
    expect(claves, `${lote.ruta} abre con nueva=${q.get('nueva')}`).toContain(q.get('nueva'))
  })

  it('la acción que abre un formulario del portal dice en qué solapa está', () => {
    // Ojo con la tentación de exigir `vista` a TODA acción del portal: `reserva`
    // y `retiro` van sin él a propósito, porque el default —Reservas— es
    // justamente el suyo. La primera versión de este test las marcaba como
    // rotas, y estaban bien.
    //
    // Lo que sí es un error es abrir un FORMULARIO sin decir la solapa: el
    // formulario vive en una de las dos, y si la vista no coincide no se dibuja.
    const malas = accionesOng(completo())
      .filter(a => a.ruta.startsWith('/ong/portal'))
      .filter(a => new URLSearchParams(a.ruta.split('?')[1] ?? '').get('nueva'))
      .filter(a => !new URLSearchParams(a.ruta.split('?')[1] ?? '').get('vista'))
      .map(a => `${a.id} -> ${a.ruta}`)
    expect(malas).toEqual([])
  })
})

describe('los iconos de las acciones', () => {
  it('todo icono que declara una accion existe en el mapa', async () => {
    // El mapa se nombra icono por icono para que el empaquetador deje solo esos:
    // con `import * as Iconos from 'lucide-react'` entraban los ~1500 de la
    // libreria —597 KB— para usar treinta y seis, y se bajaban al ABRIR la app.
    //
    // El costo de nombrarlos es que hay que acordarse de agregarlos, y de eso se
    // ocupa este test. Sin el, un icono nuevo no rompe nada: sale un circulito
    // gris que nadie relaciona con haber tocado `accionesOng`.
    //
    // Ya paso una vez al reves: `ClipboardHeart` NO existe en lucide y la accion
    // de seguimiento venia mostrando el circulo de reserva. Con `import * as`
    // tampoco fallaba — simplemente no se veia.
    const { ICONOS_ACCION } = await import('../iconosAccion')
    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    const faltan = [...new Set(accionesOng(vacio).map(a => a.icono).filter(Boolean))]
      .filter(n => !ICONOS_ACCION[n as string])
    expect(faltan).toEqual([])
  })

  it('el mapa no arrastra iconos que ya no usa nadie', async () => {
    // La otra mitad: un icono que quedo en el mapa despues de sacar su accion
    // sigue entrando al bundle sin que nada lo muestre.
    const { ICONOS_ACCION } = await import('../iconosAccion')
    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    const usados = new Set(accionesOng(vacio).map(a => a.icono).filter(Boolean))
    expect(Object.keys(ICONOS_ACCION).filter(n => !usados.has(n))).toEqual([])
  })
})

describe('el ritmo de la portada', () => {
  it('toda accion de la portada declara cada cuanto se hace', () => {
    // La portada se agrupa por ritmo. Sin `ritmo` la accion cae en un bloque
    // suelto al final, sin titulo, que no le dice nada a nadie — y peor: se ve
    // como un error de la pantalla, no como un dato que falta.
    const sinRitmo = accionesOng(completo())
      .filter(a => a.frecuente && !a.ritmo)
      .map(a => a.id)
    expect(sinRitmo).toEqual([])
  })

  it('el ritmo no contradice el orden, que sale del uso real', () => {
    // `ordenPortada` salio de contar un anio de produccion: 1.692 asientos de
    // caja, 1.241 dispensas, 102 traslados. El ritmo sale de los MISMOS numeros,
    // asi que lo diario no puede quedar despues de lo mensual — si pasa, uno de
    // los dos se toco sin mirar el otro.
    const peso = { diario: 0, seguido: 1, mensual: 2 } as const
    const enPortada = accionesOng(completo())
      .filter(a => a.frecuente && a.ritmo)
      .sort((x, y) => (x.ordenPortada ?? 99) - (y.ordenPortada ?? 99))
    const pesos = enPortada.map(a => peso[a.ritmo as keyof typeof peso])
    expect(pesos).toEqual([...pesos].sort((x, y) => x - y))
  })
})

// La botonera de Cultivo muestra ACCIONES_CULTIVO directamente, sin pasar por
// `accionesOng` — porque no tiene a mano entidad, lotes, asociados ni cuotas.
// Estos tests cuidan las dos cosas que eso da por sentado.
describe('las acciones del cultivo, que se muestran solas', () => {
  it('son las mismas que ve la O.N.G.: una sola lista', () => {
    const enOng = accionesOng(completo()).filter(a => a.grupo === 'cultivo')
    expect(enOng.map(a => a.id)).toEqual(ACCIONES_CULTIVO.map(a => a.id))
  })

  it('no dependen de ningún dato: si dependieran, la botonera de Cultivo mentiría', () => {
    // Cultivo las dibuja sin cargar nada. Una acción de este grupo que mirara
    // los lotes se vería «lista» ahí y bloqueada en la O.N.G., que es peor que
    // no ofrecerla: manda a una pantalla donde no se puede hacer lo que dice.
    const vacio = { entidad: null, pacientes: 0, lotes: [], asociados: [], cuotas: [] }
    const conNada = accionesOng(vacio).filter(a => a.grupo === 'cultivo')
    expect(conNada.map(a => a.estado)).toEqual(ACCIONES_CULTIVO.map(() => 'lista'))
    expect(conNada.some(a => a.motivo)).toBe(false)
  })

  it('la flecha marca sólo las que dejan el cultivo', () => {
    const seVan = ACCIONES_CULTIVO.filter(saleDeCultivo).map(a => a.id)
    expect(seVan).toEqual(['salaAmbiente', 'lectura'])
  })

  it('cada ruta de RUTAS_CULTIVO tiene al menos una acción que la use', () => {
    // Si una pestaña deja de tener acción, la botonera ofrece ocho caminos a
    // tres pantallas y la cuarta queda sin puerta de entrada desde acá.
    for (const r of RUTAS_CULTIVO) {
      expect(ACCIONES_CULTIVO.some(a => a.ruta.startsWith(r))).toBe(true)
    }
  })
})
