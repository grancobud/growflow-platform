// Las cosas que se hacen, dichas como las diría una persona.
//
// La navegación por pestañas responde «¿dónde está X?», y para preguntar eso hay
// que saber de antemano que X existe y cómo se llama. Esto responde la otra
// pregunta, que es la que uno se hace de verdad: «¿qué quiero hacer?».
//
// No es una pantalla nueva ni un camino paralelo: cada acción termina en el
// MISMO formulario al que se llega por su pestaña. Si fueran dos lugares
// distintos habría dos formas de hacer lo mismo y ninguna sería la buena.
//
// Lo que aporta además del idioma es saber si la acción se puede hacer. Una
// botonera que ofrece seis cosas y falla en tres es peor que no tenerla, así que
// cada acción se pregunta si están sus condiciones y, cuando no, dice cuál falta
// y adónde ir a cargarla.

import type { Entidad, LoteIngreso, Cuota, Asociado } from './ong'

/**
 * Los grupos, en una sola lista.
 *
 * El tipo de `Accion['grupo']` sale de acá, y el panel y los tests leen lo
 * mismo: con la lista escrita en tres lugares, agregar un grupo compilaba, se
 * veía bien, y hacía fallar un test por una razón que no tenía nada que ver.
 */
export const GRUPOS_ACCION = [
  'panel', 'institucional', 'personas', 'operacion', 'papeles', 'cultivo', 'costos',
] as const

export type GrupoAccion = typeof GRUPOS_ACCION[number]

/**
 * Cada cuanto se hace una accion de la portada.
 *
 * Tres y no cinco: mas grupos con una accion cada uno es una lista con titulos
 * en el medio, que ocupa mas y agrupa menos.
 */
export type RitmoAccion = 'diario' | 'seguido' | 'mensual'

/** Como se llama cada ritmo en pantalla. */
export const TITULO_RITMO: Record<RitmoAccion, string> = {
  diario: 'Todos los días',
  seguido: 'Cada tanto',
  mensual: 'Fin de mes',
}

/** El orden en que van los grupos: lo mas frecuente primero. */
export const ORDEN_RITMO: RitmoAccion[] = ['diario', 'seguido', 'mensual']

/**
 * Como se llama cada area en pantalla, y en que orden van.
 *
 * Vivia adentro de `QueQuieroHacer`, que es un componente de la O.N.G. El Panel
 * principal necesita lo mismo —tiene que poder ofrecer las acciones de cultivo,
 * que son NUEVE y no llegaban a ningun lado— y copiar la lista habria dejado dos
 * verdades: agregar un grupo en una y olvidarlo en la otra.
 */
export const GRUPOS_ACCION_ORDEN: { id: GrupoAccion; label: string }[] = [
  { id: 'operacion', label: 'Operación' },
  { id: 'cultivo', label: 'Cultivo y ambiente' },
  { id: 'personas', label: 'Personas' },
  { id: 'costos', label: 'Costos' },
  { id: 'papeles', label: 'Papeles' },
  { id: 'institucional', label: 'Institucional' },
  { id: 'panel', label: 'Panel' },
]

export interface Accion {
  id: string
  /** En primera persona y con el verbo adelante: es lo que la persona quiere. */
  label: string
  /**
   * El grupo al que pertenece, con los MISMOS cinco nombres que la barra de
   * pestañas. Dos mapas mentales distintos para la misma app es peor que uno
   * imperfecto.
   */
  grupo: GrupoAccion
  /**
   * Nombre del icono de lucide-react. En grilla el icono hace de ancla: al
   * tercer dia uno reconoce la forma antes de leer la palabra.
   */
  icono: string
  /**
   * Si va en la pantalla de entrada. Las frecuentes a un toque, el resto a dos:
   * meter las treinta y nueve en la entrada seria el mismo error que las
   * dieciocho pestañas en una fila.
   */
  /**
   * Que permiso hace falta para poder hacerla.
   *
   * NACIO EL 01/09/2026 y resuelve el mismo problema que `PERMISO_DE_TAB`: la
   * portada mostraba las TREINTA Y NUEVE acciones a todo el mundo, sin mirar el
   * LAS SEIS DEL MOSTRADOR usan `ver_mostrador` y no `ver_institucional`
   * -entregar, cargar un lote, anotar una visita, reservar, entregar una
   * reserva y registrar una devolucion-. Son las que hace quien atiende, y
   * darselas por `ver_institucional` le abriria de paso el estatuto, los libros
   * y las actas. Las otras se quedan donde estaban a proposito: un acta o un
   * alta de asociado no son del mostrador.
   *
   * rol. Un cultivador veia «Anotar un gasto o un pago» en su pantalla de
   * entrada, la tocaba, y la base se lo rechazaba. Una accion que no se puede
   * hacer no es una accion: es una promesa rota en la pantalla mas usada.
   *
   * Es OBLIGATORIO y no opcional a proposito, igual que `PERMISO_DE_TAB` es un
   * `Record` completo: una accion nueva no compila hasta que alguien decida
   * quien puede hacerla. Un default silencioso es exactamente como se cuela una
   * accion que no le corresponde a nadie.
   */
  permiso: string
  frecuente?: boolean
  /**
   * Posicion en la portada. Menor va primero.
   *
   * Sale de CONTAR el uso real en la base de produccion, no de agrupar por
   * tema. Doce meses, agosto 2025 a agosto 2026:
   *
   *   1.692  asientos de caja      → anotar un gasto o un pago
   *   1.241  dispensas             → entregarle a un paciente
   *     701  documentos de gasto   → comprarle a un proveedor
   *     211  asociados             → sumar a alguien
   *     102  traslados             → mover material
   *       0  cuotas emitidas       → cobrar las cuotas
   *
   * «Cobrar las cuotas del mes» estaba en la portada y no se uso NI UNA VEZ en
   * el anio. Ocupaba el lugar de algo que si se usa, y ademas empujaba a
   * «anotar un gasto» —lo mas frecuente de todo— al cuarto puesto.
   */
  ordenPortada?: number

  /**
   * Cada cuanto se hace, para agrupar la portada.
   *
   * Sale de los mismos numeros que `ordenPortada` —el uso real de un anio— y no
   * de una intuicion: 1.692 asientos de caja y 1.241 entregas son de todos los
   * dias; 102 traslados en el mismo periodo, no.
   *
   * Agrupar por esto contesta la pregunta que nadie hace en voz alta —«¿me
   * estoy olvidando de algo?»— que una grilla de seis tarjetas iguales no puede
   * contestar: ahi las seis pesan lo mismo y no se ve que dos son la rutina y
   * una es de fin de mes.
   *
   * OBLIGATORIO EN LAS DE PORTADA. Hay un test que lo exige: sin ritmo una
   * accion cae en un grupo «otras» que no le dice nada a nadie.
   */
  ritmo?: RitmoAccion
  /** Una línea de qué pasa si la elegís. */
  detalle: string
  ruta: string
  /**
   * El id del flujo de lib/flujosOng.ts, cuando la tarea no termina en un solo
   * formulario. Al elegir la accion se engancha `?flujo=` en la ruta y la barra
   * de pasos acompaña hasta el final.
   */
  flujo?: string
  /**
   * El id de la guia de lib/guiasFormulario.ts que se muestra al abrir ese
   * formulario. Va explicito y no derivado del id de la accion porque no
   * siempre coinciden: «Sumar a alguien» abre la guia `paciente`, y esa misma
   * guia se ve tambien entrando por la pestaña. Una guia puede servir a varias
   * puertas de entrada.
   */
  guia?: string
  /**
   * `lista`     — se puede hacer y va a salir bien.
   * `aviso`     — se puede hacer, pero algo va a salir incompleto.
   * `bloqueada` — no se puede todavía.
   *
   * La diferencia entre `aviso` y `bloqueada` importa: sin CUIT se puede
   * entregar igual —el material sale y hay que registrarlo— pero el recibo va a
   * salir con [CUIT] entre corchetes. Bloquear ahí sería mentir sobre lo que el
   * sistema puede hacer, y además dejaría entregas sin registrar.
   */
  estado: 'lista' | 'aviso' | 'bloqueada'
  /** Qué falta. Sólo cuando el estado no es `lista`. */
  motivo?: string
  /** Dónde se carga lo que falta. */
  rutaMotivo?: string
}

const vacio = (v: unknown) => !(v != null && String(v).trim() !== '')

/**
 * Si la acción te saca de la O.N.G.
 *
 * Quince de las treinta y nueve llevan a otra parte de la app: cultivo,
 * ambiente, econometría, stock, tablas. Son parte del circuito —el material que
 * se entrega sale del cultivo— y por eso están en la lista; pero mezcladas sin
 * distinción con las de la O.N.G. hacen que el panel parezca de todo y de nada.
 *
 * Se deduce de la ruta y no se declara a mano: declarado, alguien mueve la ruta
 * y la marca se queda diciendo lo contrario. La ruta es el hecho.
 */
export const saleDeLaOng = (a: Pick<Accion, 'ruta'>) => !a.ruta.startsWith('/ong')

/**
 * Las cuatro pestañas que SON el cultivo.
 *
 * Sale de `PaginaCultivo`, y por eso está acá y no allá: la usa `saleDeCultivo`
 * para decidir la flecha, y si viviera en la pantalla habría que importarla
 * desde la lógica, que es al revés de como va todo lo demás en este archivo.
 */
export const RUTAS_CULTIVO = ['/plantas', '/geneticas', '/linea-tiempo', '/sala'] as const

/**
 * Si la acción deja la sección Cultivo.
 *
 * La flecha diagonal de `FilaAccion` significa «esto te lleva afuera», y afuera
 * de qué depende de la pantalla: `/plantas` deja la O.N.G. pero NO deja el
 * cultivo. Con una sola función, la botonera de Cultivo pondría la flecha en
 * las ocho acciones y no diría nada.
 *
 * De las ocho, las que sí se van son las dos de ambiente. La novena era
 * «programar un recordatorio», que vivía en el Calendario; el Calendario se
 * retiró el 29/08/2026 y la acción se fue con él.
 */
export const saleDeCultivo = (a: Pick<Accion, 'ruta'>) =>
  !RUTAS_CULTIVO.some(r => a.ruta.startsWith(r))

/**
 * Las acciones del cultivo, aparte del resto.
 *
 * Se sacan de `accionesOng` porque son las únicas nueve que NO dependen de los
 * datos de la O.N.G.: las nueve son `estado: 'lista'` incondicional. Eso las
 * hace las únicas que una pantalla puede mostrar sin cargar entidad, lotes,
 * asociados y cuotas — que es lo que necesita la botonera de Cultivo, donde
 * nada de eso está a mano ni haría falta traer.
 *
 * Siguen entrando a `accionesOng`, que las agrega tal cual. Una sola lista: si
 * estuvieran escritas dos veces, agregar una acción de cultivo la haría
 * aparecer en una pantalla y no en la otra.
 */
export const ACCIONES_CULTIVO: Accion[] = [
  {
    id: 'genetica', permiso: 'editar_cultivo', label: 'Crear una genética', guia: 'genetica',
    grupo: 'cultivo', icono: 'Dna',
    detalle: 'Suma una variedad al banco, que es lo que después se elige al cargar plantas.',
    ruta: '/geneticas?nueva=1&guia=genetica', estado: 'lista',
  },
  {
    id: 'plantas', permiso: 'editar_cultivo', label: 'Cargar plantas', guia: 'plantas',
    grupo: 'cultivo', icono: 'Sprout',
    detalle: 'Da de alta las plantas y las ubica en la sala.',
    // `nueva=planta`: la clave la espera `PaginaPlantas` desde siempre. La
    // mandaba el paso 2 del viejo flujo de cosecha, que se retiro el 29/08 al
    // volverlo de un solo paso; desde entonces la accion decia «da de alta las
    // plantas» y dejaba en la lista.
    ruta: '/plantas?nueva=planta&guia=plantas', estado: 'lista',
  },
  {
    id: 'floracion', permiso: 'editar_cultivo', label: 'Pasar plantas a floración', guia: 'floracion',
    grupo: 'cultivo', icono: 'Flower2',
    detalle: 'Sólo las de floración cuentan contra el tope del REPROCANN.',
    ruta: '/plantas?guia=floracion', estado: 'lista',
  },
  {
    id: 'riego', permiso: 'editar_cultivo', label: 'Regar o fumigar una sala', guia: 'riego',
    grupo: 'cultivo', icono: 'Droplets',
    detalle: 'La misma aplicación en todas las plantas del área, de un toque.',
    ruta: '/sala?guia=riego', estado: 'lista',
  },
  {
    id: 'evento', permiso: 'editar_cultivo', label: 'Registrar algo en una planta', guia: 'evento',
    grupo: 'cultivo', icono: 'ClipboardList',
    detalle: 'Una poda, un trasplante, una plaga: lo que le pasó a una planta puntual.',
    ruta: '/linea-tiempo?guia=evento', estado: 'lista',
  },
  {
    id: 'area', permiso: 'editar_cultivo', label: 'Crear un área de cultivo', guia: 'area',
    grupo: 'cultivo', icono: 'LayoutGrid',
    detalle: 'Cada carpa, cama o sector con sus medidas.',
    ruta: '/sala?nueva=area&guia=area', estado: 'lista',
  },
  {
    // ⚠️ `editar_cultivo` Y NO `ver_ambiente`: crear una sala es armar la
    // instalacion, no operarla. Con `ver_ambiente` la accion se le ofrecia al
    // mostrador, al director medico y al auditor, y la policy de
    // `ambiente_salas` no tiene a ninguno de los tres: los tres la tocaban y la
    // base los rechazaba. Cargar una LECTURA si es del mostrador, y esa se
    // queda en `ver_ambiente` con su permiso de escritura ya corregido.
    id: 'salaAmbiente', permiso: 'editar_cultivo', label: 'Crear una sala de ambiente', guia: 'salaAmbiente',
    grupo: 'cultivo', icono: 'Thermometer',
    detalle: 'El espacio del que se miden temperatura y humedad.',
    ruta: '/ambiente?guia=salaAmbiente', estado: 'lista',
  },
  {
    id: 'lectura', permiso: 'ver_ambiente', label: 'Cargar una lectura de ambiente', guia: 'lectura',
    grupo: 'cultivo', icono: 'Gauge',
    detalle: 'Temperatura y humedad. De acá salen los promedios, los picos y el VPD.',
    ruta: '/ambiente?guia=lectura', estado: 'lista',
  },
]

export function accionesOng(datos: {
  entidad: Entidad | null
  pacientes: number
  lotes: LoteIngreso[]
  asociados: Asociado[]
  cuotas: Cuota[]
}): Accion[] {
  const { entidad, pacientes, lotes, asociados, cuotas } = datos

  const sinCuit = vacio(entidad?.cuit)
  const hayLotes = lotes.length > 0
  const hayPacientes = pacientes > 0
  const activos = asociados.filter(a => a.activo !== false).length
  const hayCuota = cuotas.some(c => c.valor > 0)

  const acciones: Accion[] = [
    {
      id: 'entregar', permiso: 'ver_mostrador',
      flujo: 'entregar',
      grupo: 'operacion',
      icono: 'PackageOpen',
      frecuente: true, ordenPortada: 2, ritmo: 'diario',  // 1.241 dispensas en el anio
      guia: 'entregar',
      label: 'Entregarle productos a un paciente',
      detalle: 'Sale material y entra el aporte por reembolso de costos. No es una venta.',
      ruta: '/ong/dispensas?nueva=1',
      // Sin gente o sin material no hay entrega posible. El CUIT no bloquea:
      // la entrega ocurre igual y no registrarla es peor que un recibo feo.
      ...(!hayPacientes
        ? { estado: 'bloqueada' as const,
            motivo: 'todavía no hay ningún paciente cargado',
            rutaMotivo: '/ong/pacientes' }
        : !hayLotes
          ? { estado: 'bloqueada' as const,
              motivo: 'no hay lotes cargados: no se puede entregar material que no ingresó',
              rutaMotivo: '/ong/cupo' }
          : sinCuit
            ? { estado: 'aviso' as const,
                motivo: 'el recibo va a salir sin CUIT',
                rutaMotivo: '/ong/entidad' }
            : { estado: 'lista' as const }),
    },
    {
      id: 'sumar', permiso: 'ver_institucional',
      grupo: 'personas',
      icono: 'UserPlus',
      frecuente: true, ordenPortada: 5, ritmo: 'seguido',  // 211 altas: seguido, no todos los dias
      guia: 'paciente',
      flujo: 'sumar',
      label: 'Sumar a alguien',
      detalle: 'Dar de alta un paciente vinculado o un socio de la asociación.',
      ruta: '/ong/pacientes?nueva=1',
      estado: 'lista',
    },
    {
      id: 'comprar', permiso: 'ver_plata',
      grupo: 'operacion',
      icono: 'ShoppingCart',
      frecuente: true, ordenPortada: 4, ritmo: 'seguido',  // 701 comprobantes, en tandas
      guia: 'comprar',
      flujo: 'comprar',
      label: 'Adquirir productos de un proveedor',
      detalle: 'Cargar la orden de servicio con su comprobante.',
      // A Documentos y no a Proveedores: esa pantalla es de sólo lectura, ahí se
      // MIRA el saldo por proveedor pero no se carga nada.
      ruta: '/ong/documentos?nueva=gasto',
      estado: 'lista',
    },
    {
      id: 'gasto', permiso: 'ver_plata',
      grupo: 'operacion',
      icono: 'Receipt',
      flujo: 'gasto',
      frecuente: true, ordenPortada: 1, ritmo: 'diario',  // 1.692 asientos de caja, lo mas frecuente de todo
      guia: 'gasto',
      label: 'Anotar un gasto o un pago',
      // El detalle DICE que las dos salidas van por aca, porque hasta el
      // 01/09/2026 la accion prometia «un gasto o un pago» y solo hacia la
      // primera mitad: el pago a proveedor habia que ir a buscarlo a otra
      // pestaña, orden por orden.
      detalle: 'Toda salida de plata: un gasto operativo o un pago a un proveedor.',
      // El libro de caja vive en Economía. Movimientos es la vista que junta
      // caja y dispensas en una línea de tiempo, y no tiene formulario.
      ruta: '/ong/economia?nueva=1',
      estado: 'lista',
    },
    {
      // ⚠️ `editar_cuotas` Y NO `ver_plata`: emitir la cuota del periodo escribe
      // en `ong_cuotas_emitidas`, cuya policy es administrador,
      // administrador_sistema y administrativo. `ver_plata` ademas lo tienen el
      // auditor —que por definicion no escribe— y el mostrador. El permiso
      // nuevo copia exactamente la lista de la base.
      id: 'cobrar', permiso: 'editar_cuotas',
      grupo: 'personas',
      icono: 'Coins',
      guia: 'cuotas',
      label: 'Cobrar las cuotas del mes',
      detalle: 'Emitir la cuota del período para todos los asociados activos.',
      ruta: '/ong/asociados?guia=cuotas',
      ...(activos === 0
        ? { estado: 'bloqueada' as const,
            motivo: 'no hay asociados activos a quienes emitirles',
            rutaMotivo: '/ong/asociados' }
        : !hayCuota
          ? { estado: 'bloqueada' as const,
              motivo: 'falta el valor de la cuota, aprobado en acta',
              rutaMotivo: '/ong/actas' }
          : { estado: 'lista' as const }),
    },
    {
      id: 'mover', permiso: 'ver_cumplimiento',
      grupo: 'operacion',
      icono: 'Truck',
      frecuente: true, ordenPortada: 6, ritmo: 'seguido',  // 102 traslados en el anio
      guia: 'traslado',
      flujo: 'mover',
      label: 'Trasladar productos a otro lugar',
      detalle: 'Registrar el traslado y preparar la carta de porte que lo ampara.',
      ruta: '/ong/declaraciones?nueva=traslado',
      ...(!hayLotes
        ? { estado: 'bloqueada' as const,
            motivo: 'no hay lotes cargados para trasladar',
            rutaMotivo: '/ong/cupo' }
        : sinCuit
          ? { estado: 'aviso' as const,
              motivo: 'la guía de tránsito va a salir sin CUIT',
              rutaMotivo: '/ong/entidad' }
          : { estado: 'lista' as const }),
    },

    // --- Las que no son de todos los dias. Mismo idioma, dos toques. ---
    {
      id: 'devolucion', permiso: 'ver_mostrador',
      guia: 'devolucion',
      label: 'Registrar una devolución',
      grupo: 'operacion', icono: 'Undo2',
      detalle: 'Cuando le devolviste plata a alguien: sale de caja y la entrega queda sin aporte.',
      ruta: '/ong/dispensas?guia=devolucion',
      estado: 'lista',
    },
    {
      id: 'seguimiento', permiso: 'ver_clinico',
      guia: 'feedback',
      label: 'Cargar el reporte de seguimiento',
      // `ClipboardHeart` no existe en lucide y esta accion venia mostrando el
      // circulo gris de reserva. Se descubrio al pasar los iconos a un mapa
      // explicito; con `import * as` no fallaba nada, simplemente no se veia.
      grupo: 'personas', icono: 'HeartPulse',
      detalle: 'Cómo le fue con lo que retiró. Sin esto no puede reservar sola por el portal.',
      ruta: '/ong/seguimiento?guia=feedback',
      estado: 'lista',
    },
    {
      id: 'cosecha', permiso: 'editar_cultivo',
      // La guia explica el orden —genetica, planta, peso— y el «ojo» de que sin
      // LOTE el material no se puede entregar.
      guia: 'cosecha',
      // VA EN LA PORTADA, y va DERECHO A DONDE SE HACE.
      //
      // Tuvo un flujo de tres pantallas —Geneticas, Plantas, Cosecha— y era al
      // reves de como se usa: en el caso normal la variedad ya esta en el banco
      // y las plantas ya estan cargadas, asi que obligaba a recorrer dos
      // pantallas donde no habia nada que hacer para recien llegar a pesar. El
      // paso 1 encima abria un alta de variedad NUEVA teniendo veintiseis
      // cargadas: «registro nueva cosecha y me manda a nueva genetica, nada que
      // ver».
      //
      // Ahora es un solo lugar: `nueva=cosecha` abre el selector de variedad,
      // elegis de las que ya estan listas y seguis al peso. Los otros dos pasos
      // son la excepcion —cuando falta la planta— y de eso avisa la pantalla,
      // que dice cuales del banco no tienen ninguna.
      // VUELVE A LA PORTADA el 01/09/2026, pedido por Gaston, pero al grupo
      // «cada tanto» y no a «todos los dias»: sigue siendo una tarea de una vez
      // por ciclo. El 31/08 se la habia sacado entera; el punto de aquel dia era
      // que no ocupara el lugar del lote en lo diario, y eso se mantiene.
      frecuente: true, ordenPortada: 11,
      // El bloque de abajo queda como estaba, que es de donde salio la decision. Habia entrado el 27/08 porque alguien se trabo aca; el 31/08 se
      // trabo otra vez, y al mirar la base quedo claro que esta era la puerta
      // EQUIVOCADA: de 105 lotes, 103 no vienen de ninguna cosecha. Cosechar
      // paso 15 veces, todas cargadas el mismo dia.
      //
      // No se saca del sistema: sigue en su grupo con su guia, a un toque de
      // «ver todo». Lo que se saca es la prioridad, que es un espacio de siete
      // lugares y se lo estaba comiendo la tarea que pasa una vez por ciclo.
      ritmo: 'mensual',  // una vez por ciclo, no por semana
      label: 'Registrar una cosecha',
      grupo: 'operacion', icono: 'Scissors',
      detalle: 'Elegís la variedad que cosechaste y cargás el peso.',
      ruta: '/cosecha?nueva=cosecha&guia=cosecha',
      estado: 'lista',
    },
    {
      id: 'lote', permiso: 'ver_mostrador',
      guia: 'lote',
      // VA EN LA PORTADA, Y ANTES QUE LA COSECHA (31/08/2026).
      //
      // Estaba detras de «ver todo» y la cosecha en la portada, que para esta
      // asociacion es al reves de como trabaja. Medido sobre su base: de 105
      // lotes, 103 NO vienen de una cosecha -73 comprados y 30
      // `propio_sin_cosecha`- y solo 2 si. Cargar un lote es semanal; cosechar
      // paso 15 veces, todas el mismo dia.
      //
      // No es cosmetico: el operador fue a «Registrar una cosecha» a cargar el
      // material del fin de semana, choco con que la cosecha exige una planta
      // suya, y quedo sin poder dispensar. La accion que hace todas las semanas
      // no puede estar escondida detras de la que hace una vez por ciclo.
      frecuente: true, ordenPortada: 7, ritmo: 'seguido',  // 105 lotes en el anio
      label: 'Crear un lote',
      grupo: 'operacion', icono: 'Boxes',
      detalle: 'El material queda disponible para entregar. Sin lote no se puede dispensar.',
      // Los lotes viven en la solapa CATÁLOGO, y el portal abre en Reservas si
      // nadie le pide otra cosa: sin `vista` la tarjeta dejaba en la pantalla
      // correcta y en la solapa equivocada. Y la clave es `lote` y no `1`
      // porque es la que espera `useAbrirAlLlegar` en Catalogo.tsx — con `1` el
      // formulario no abría nunca.
      ruta: '/ong/portal?vista=catalogo&nueva=lote&guia=lote',
      estado: 'lista',
    },
    {
      id: 'acta', permiso: 'ver_institucional',
      guia: 'acta',
      label: 'Redactar un acta',
      grupo: 'institucional', icono: 'ScrollText',
      detalle: 'Deja la reunión lista para transcribir al libro, con control de quórum.',
      ruta: '/ong/actas?nueva=1',
      estado: 'lista',
    },
    {
      id: 'libro', permiso: 'ver_institucional',
      guia: 'libro',
      label: 'Dar de alta un libro',
      grupo: 'institucional', icono: 'BookMarked',
      detalle: 'Con su rúbrica, que es la autorización del registro para usarlo.',
      ruta: '/ong/libros?nueva=1',
      estado: 'lista',
    },
    {
      id: 'revisar', permiso: 'ver_ong', label: 'Revisar qué no cierra', guia: 'revisar',
      grupo: 'panel', icono: 'ClipboardCheck',
      detalle: 'Los cruces entre libros, que es lo que se mira en una inspección.',
      ruta: '/ong/coherencia?guia=revisar', estado: 'lista',
    },
    // --- Cultivo. Viven fuera de la O.N.G. pero son parte del circuito: el
    // --- material que se entrega sale de acá. ---
    ...ACCIONES_CULTIVO,

    // --- Costos. De acá sale el costo por gramo, que es lo que sostiene que el
    // --- aporte de un paciente sea un reembolso y no otra cosa. ---
    {
      // NO va en la portada: no es una tarea de todos los dias ni de cada
      // tanto, es lo que se anota cuando se saca plata del banco. Lo que hacia
      // falta era que EXISTIERA en algun lado ademas del boton de adentro del
      // libro, para que se pueda encontrar buscando.
      id: 'movimiento', permiso: 'ver_plata', label: 'Pasar plata del banco a la caja', guia: 'movimiento',
      grupo: 'costos', icono: 'ArrowLeftRight',
      detalle: 'Una extracción, o al revés. El saldo total no se mueve.',
      ruta: '/ong/economia?nueva=interno&guia=movimiento', estado: 'lista',
    },
    {
      id: 'costo', permiso: 'ver_econometria', label: 'Cargar un costo', guia: 'costo',
      frecuente: true, ordenPortada: 9, ritmo: 'seguido',
      grupo: 'costos', icono: 'Calculator',
      detalle: 'De acá sale el costo por gramo, contra el que se compara cada aporte.',
      ruta: '/econometria?vista=costos&nueva=1&guia=costo', estado: 'lista',
    },
    {
      id: 'insumo', permiso: 'ver_econometria', label: 'Cargar un insumo al inventario', guia: 'insumo',
      frecuente: true, ordenPortada: 10, ritmo: 'seguido',
      grupo: 'costos', icono: 'PackagePlus',
      detalle: 'Lo que hay y lo que se consume. Lo consumido entra en el costo del ciclo.',
      ruta: '/stock?nueva=insumo&guia=insumo', estado: 'lista',
    },
    {
      id: 'equipo', permiso: 'ver_econometria', label: 'Cargar un equipo y su amortización', guia: 'equipo',
      grupo: 'costos', icono: 'Wrench',
      detalle: 'Se reparte a lo largo de su vida útil en vez de golpear un solo mes.',
      ruta: '/econometria?vista=instalaciones&guia=equipo', estado: 'lista',
    },
    {
      id: 'mantenimiento', permiso: 'ver_econometria', label: 'Programar un mantenimiento', guia: 'mantenimiento',
      grupo: 'costos', icono: 'Settings',
      detalle: 'Filtros, limpieza o revisión de un equipo, para que no se pase.',
      ruta: '/stock?nueva=mantenimiento&guia=mantenimiento', estado: 'lista',
    },

    // --- Lo que faltaba de la O.N.G. ---
    {
      // LA VISITA VA EN LA PORTADA. Es lo que mas veces por dia pasa en la
      // sede: se atiende gente que se lleva algo y gente que no, y hasta hoy
      // solo quedaba registro de los primeros.
      id: 'visita', permiso: 'ver_mostrador', label: 'Registrar una visita', guia: 'visita',
      // Tercera y `diario` POR DEDUCCION, no por un numero medido: la tabla es
      // nueva y no tiene historia. Pero toda dispensa ocurre DENTRO de una
      // visita, mas las que no terminan en entrega, asi que las visitas no
      // pueden ser menos que las 1.248 dispensas del anio. Va despues de
      // dispensas y no antes porque contra la caja -1.692 asientos- no hay
      // forma de saberlo todavia.
      frecuente: true, ordenPortada: 3, ritmo: 'diario',
      grupo: 'personas', icono: 'DoorOpen',
      detalle: 'Toda persona que se atiende, se lleve algo o no.',
      ruta: '/ong/visitas?nueva=1&guia=visita', estado: 'lista',
    },
    {
      id: 'asociado', permiso: 'ver_institucional', label: 'Dar de alta un asociado', guia: 'asociado',
      grupo: 'personas', icono: 'Users',
      detalle: 'El padrón societario, que es distinto del de pacientes.',
      // `nueva=1` para que ABRA el alta y no deje en la lista: el hook ya
      // existia en `AsociadosYCoherencia` y ninguna ruta se lo mandaba.
      ruta: '/ong/asociados?nueva=1', estado: 'lista',
    },
    // Reservar y retirar son el camino B de una entrega: en vez de dar el
    // material en el momento, el paciente lo aparta y lo retira dentro de las 72
    // horas. Terminan en la misma dispensa que el camino directo.
    //
    // Por eso piden lo mismo que 'entregar' y las tres estaban declaradas
    // 'lista' fijo, sin validar nada. Con la base vacía quedaba una portada
    // incoherente: «Entregarle productos» bloqueada por falta de lotes, y estas
    // dos habilitadas al lado. NuevaReserva filtra por lotes con disponible > 0,
    // así que quien entraba encontraba un selector vacío y ningún motivo.
    {
      id: 'reserva', permiso: 'ver_mostrador', label: 'Hacer una reserva', guia: 'reserva',
      grupo: 'operacion', icono: 'Ticket',
      detalle: 'El paciente aparta material y tiene 72 horas para retirarlo.',
      ruta: '/ong/portal?guia=reserva',
      ...(!hayPacientes
        ? { estado: 'bloqueada' as const,
            motivo: 'todavía no hay ningún paciente cargado',
            rutaMotivo: '/ong/pacientes' }
        : !hayLotes
          ? { estado: 'bloqueada' as const,
              motivo: 'no hay lotes cargados: no se puede apartar material que no ingresó',
              rutaMotivo: '/ong/cupo' }
          : { estado: 'lista' as const }),
    },
    {
      id: 'retiro', permiso: 'ver_mostrador', label: 'Entregar una reserva en la sede', guia: 'retiro',
      frecuente: true, ordenPortada: 8, ritmo: 'seguido',
      grupo: 'operacion', icono: 'ScanLine',
      detalle: 'Valida el pago, descuenta el stock y emite el recibo.',
      ruta: '/ong/portal?guia=retiro',
      // Lo ideal sería exigir además que haya alguna reserva viva. No se hace
      // acá porque los pedidos los carga el Portal por su cuenta y no llegan a
      // esta función: pedirlos obligaría a que la portada dispare una consulta
      // más en cada apertura, para afinar un aviso que el propio Portal ya da al
      // entrar. Con lotes en cero el bloqueo alcanza, que es el caso real de una
      // instalación que arranca.
      ...(!hayLotes
        ? { estado: 'bloqueada' as const,
            motivo: 'no hay lotes cargados, así que no puede haber reservas',
            rutaMotivo: '/ong/cupo' }
        : { estado: 'lista' as const }),
    },
    {
      id: 'plantilla', permiso: 'ver_plata', label: 'Generar una plantilla institucional', guia: 'plantilla',
      grupo: 'papeles', icono: 'FilePlus',
      detalle: 'Designaciones, comodatos, informe de genéticas y mandato.',
      ruta: '/ong/documentos?guia=plantilla', estado: 'lista',
    },
    {
      id: 'informeMedico', permiso: 'ver_clinico', label: 'Generar el informe del Director Médico', guia: 'informeMedico',
      grupo: 'papeles', icono: 'Stethoscope',
      detalle: 'Cruza diagnóstico, lotes recibidos y lo que cada persona reportó.',
      ruta: '/ong/seguimiento?guia=informeMedico', estado: 'lista',
    },
    {
      id: 'requisitos', permiso: 'ver_cumplimiento', label: 'Marcar los requisitos de la 1780', guia: 'requisitos',
      grupo: 'institucional', icono: 'ListChecks',
      detalle: 'Lo que la Resolución exige y quién responde por cada cosa.',
      // `?ir=` baja hasta la lista: `/ong` pelado deja arriba de todo, y la
      // lista es lo ultimo de una pantalla larga.
      ruta: '/ong?ir=requisitos&guia=requisitos', estado: 'lista',
    },
    {
      id: 'exportar', permiso: 'ver_tablas', label: 'Exportar o importar datos', guia: 'exportar',
      grupo: 'papeles', icono: 'Database',
      detalle: 'Bajar cualquier tabla a un archivo, o subir datos en lote.',
      ruta: '/tablas?guia=exportar', estado: 'lista',
    },
    {
      id: 'autoridad', permiso: 'ver_institucional',
      label: 'Cargar una autoridad',
      guia: 'autoridad',
      grupo: 'institucional', icono: 'UserCog',
      detalle: 'Quién ocupa cada cargo y desde cuándo, con su grupo familiar.',
      ruta: '/ong/autoridades?nueva=1',
      estado: 'lista',
    },
    {
      id: 'predio', permiso: 'ver_cumplimiento',
      label: 'Cargar un predio',
      guia: 'predio',
      grupo: 'institucional', icono: 'MapPin',
      detalle: 'La sede social y los predios donde se cultiva, con su comodato.',
      ruta: '/ong/predios?nueva=1',
      estado: 'lista',
    },
    {
      id: 'entidad', permiso: 'ver_institucional',
      guia: 'entidad',
      flujo: 'arranque',
      label: 'Cargar los datos de la entidad',
      grupo: 'institucional', icono: 'Building2',
      detalle: 'CUIT, razón social y objeto social. Sin esto ningún documento sale completo.',
      ruta: '/ong/entidad',
      estado: 'lista',
    },
    {
      id: 'ddjj', permiso: 'ver_cumplimiento', flujo: 'presentar',
      guia: 'ddjj',
      label: 'Presentar la declaración jurada',
      grupo: 'papeles', icono: 'FileCheck',
      detalle: 'La semestral del REPROCANN. Se arma sola y se presenta por TAD.',
      ruta: '/ong/pacientes?guia=ddjj',
      estado: 'lista',
    },
    {
      id: 'cerrar', permiso: 'ver_plata',
      guia: 'cerrarMes',
      label: 'Cerrar el mes',
      grupo: 'papeles', icono: 'CalendarCheck',
      flujo: 'cerrar',
      detalle: 'Cuotas, registros del mes, y revisar que Coherencia no tenga errores.',
      ruta: '/ong/asociados?guia=cerrarMes',
      estado: 'lista',
    },
    {
      id: 'documento', permiso: 'ver_plata',
      guia: 'documento',
      label: 'Emitir un documento',
      grupo: 'papeles', icono: 'FileText',
      detalle: 'Constancias, certificados y las plantillas institucionales.',
      ruta: '/ong/documentos?nueva=1',
      estado: 'lista',
    },
  ]

  // La accion que tiene flujo arranca en su paso 1, para que la barra de pasos
  // aparezca desde el principio en vez de recien en el segundo.
  for (const a of acciones) {
    if (!a.flujo) continue
    const sep = a.ruta.includes('?') ? '&' : '?'
    a.ruta = `${a.ruta}${sep}flujo=${a.flujo}&paso=1`
  }

  // Lo que se puede hacer, primero. Quien entra a hacer algo no quiere leer
  // cuatro cosas que no puede antes de encontrar la que sí.
  const peso = { lista: 0, aviso: 1, bloqueada: 2 }
  return acciones.sort((a, b) => peso[a.estado] - peso[b.estado])
}
