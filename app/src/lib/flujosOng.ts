// Las tareas que no terminan en un formulario.
//
// «Comprar material» son tres cosas en tres pantallas distintas, y la que se
// olvida siempre es la última. Guardás el comprobante, el modal se cierra, y ahí
// la guía te suelta: la plata quedó registrada y el material no existe para
// entregar. Eso no da error en el momento — aparece semanas después en el
// balance de materia, cuando ya nadie relaciona el faltante con aquel día.
//
// Un flujo es la lista de esos pasos, con el motivo de cada uno.
//
// El paso actual va en la URL (`?flujo=comprar&paso=2`) y no en el estado del
// componente. Asi se puede cerrar la pestaña y volver, mandarle el link a otra
// persona para que siga, y el boton atras retrocede de paso en vez de salirse.
//
// Ningún flujo bloquea. Siempre se puede salir a mitad de camino: es una guía
// para quien no sabe el orden, no un riel para quien sí.
//
// El circuito tiene DOS lados y conviene verlos como espejo:
//
//   COMPRAR   entra material, sale plata. Orden → comprobante → lote → pago.
//   ENTREGAR  sale material, entra plata. Entrega → recibo → caja → seguimiento.
//
// El material recorre los dos: entra por un lote y sale por una entrega. Si un
// paso del medio falta, los extremos siguen cerrando solos y el faltante aparece
// mucho después, en el balance de materia.

/** Lo que el sistema puede mirar para saber si un paso ya está hecho. */
export interface DatosFlujo {
  pacientesActivos: { tope_mensual_g?: number | null }[]
  asociadosSinActa: number
  traslados: { carta_porte_presentada?: boolean }[]
  dispensas: { recibo_numero?: number | null; gramos?: number;
               aporte?: number | null; modalidad?: string | null }[]
  documentos: { subtipo?: string | null; descripcion?: string | null }[]
  cuotasEmitidas: { periodo: string }[]
  periodo: string
  /** El mes en curso, `2026-08`, para buscar su registro mensual. */
  mes: string
  erroresDeCoherencia: number
  /** Gramos que faltan en el balance de materia. Cero o menos es que cierra. */
  faltanteDeMateria: number
  /** La puesta en marcha: sin esto ningún documento sale completo. */
  hayEntidadConCuit: boolean
  autoridades: number
  predios: number
  librosRubricados: number
  /** Las declaraciones juradas ya armadas, para saber si la del semestre existe. */
  ddjj: { periodo: string; presentada?: boolean | null }[]
  /** El semestre en curso, `2026-S2`. Es el período de la declaración. */
  semestre: string
}

export interface PasoFlujo {
  /** Qué hay que hacer, corto. */
  titulo: string
  /** Por qué importa. Es lo que hace que alguien no lo saltee. */
  porQue: string
  /** Adónde se hace. Lleva `?nueva=` si ahí se abre un formulario. */
  ruta: string
  /**
   * Lo que hay que tener a mano ANTES de empezar el paso.
   *
   * Va antes de mandar a la pantalla y no adentro del formulario, que es donde
   * estaba. Llegar al formulario y recién ahí darse cuenta de que falta el
   * papel obliga a salir, buscarlo, y volver a empezar. Dicho antes, se junta
   * todo de una y se entra una sola vez.
   */
  teneAMano?: string[]
  /**
   * Si el paso ya está hecho, mirando los datos.
   *
   * Es OPCIONAL a propósito, y la mayoría no lo tiene. «Cargá el comprobante de
   * esta compra» no se puede verificar: hay setecientos comprobantes y ninguno
   * dice a qué compra pertenece. Poner un tilde ahí sería adivinar, y un tilde
   * que miente es peor que ninguno — deja a alguien creyendo que ya hizo algo
   * que no hizo.
   *
   * Donde no se puede saber, el paso avanza cuando la persona toca el botón.
   *
   * `nota` es la otra mitad, y a veces vale más que el tilde: no dice si ESTA
   * compra tiene su lote, pero sí que quedan cosas de ese tipo sin hacer.
   *
   * `tono` existe porque las dos cosas no siempre coinciden. «El balance de
   * materia cierra» es buena noticia y aun así el paso NO está hecho —no se
   * puede saber si esta compra tiene su lote—. Sin separarlos, esa nota salía
   * en naranja de advertencia y se leía como un problema.
   *
   * Sin especificar, el tono sale de `hecho`, que es lo habitual.
   */
  estado?: (d: DatosFlujo) => {
    hecho: boolean
    nota?: string
    tono?: 'bueno' | 'aviso'
  }
}

const plural = (n: number, uno: string, varios: string) =>
  `${n} ${n === 1 ? uno : varios}`

export interface Flujo {
  id: string
  /** El nombre de la tarea, igual que en el panel de acciones. */
  label: string
  pasos: PasoFlujo[]
}

export const FLUJOS: Record<string, Flujo> = {
  arranque: {
    id: 'arranque',
    label: 'Poner la asociación en marcha',
    pasos: [
      {
        titulo: 'Los datos de la entidad',
        porQue: 'Es la cabecera de todos los documentos que el sistema emite. Sin CUIT, cada recibo y cada acta salen con [CUIT] entre corchetes y hay que rehacerlos.',
        teneAMano: [
          'el estatuto',
          'razón social y CUIT',
          'domicilio de la sede y matrícula de personería',
        ],
        ruta: '/ong/entidad',
        estado: d => d.hayEntidadConCuit
          ? { hecho: true, nota: 'la entidad está cargada con su CUIT' }
          : { hecho: false, nota: 'sin esto, ningún documento sale completo' },
      },
      {
        titulo: 'Quiénes son las autoridades',
        porQue: 'De acá salen las designaciones de Director Médico y Responsable Técnico. Y el grupo familiar de cada una es lo único que permite verificar que no haya parentesco cruzado con la Revisora de Cuentas.',
        teneAMano: [
          'nombre, DNI y cargo de cada una',
          'el acta que las designó',
          'el grupo familiar de cada persona',
        ],
        ruta: '/ong/autoridades?nueva=1',
        estado: d => d.autoridades > 0
          ? { hecho: true, nota: `${d.autoridades} en funciones` }
          : { hecho: false, nota: 'ninguna cargada' },
      },
      {
        titulo: 'Dónde funciona y dónde se cultiva',
        porQue: 'La sede social y el predio de cultivo, cada uno con su comodato. Pueden ser el mismo lugar o no.',
        teneAMano: ['la dirección exacta', 'el comodato o el título'],
        ruta: '/ong/predios?nueva=1',
        estado: d => d.predios > 0
          ? { hecho: true, nota: `${d.predios} declarado${d.predios === 1 ? '' : 's'}` }
          : { hecho: false, nota: 'ninguno declarado' },
      },
      {
        titulo: 'Los siete libros, con su rúbrica',
        porQue: 'Un libro sin rúbrica no vale por más que esté escrito: la rúbrica es la autorización del registro para usarlo.',
        teneAMano: [
          'el organismo que los rubricó',
          'fecha y número de rúbrica de cada uno',
          'cuántos folios tiene cada libro',
        ],
        ruta: '/ong/libros?nueva=1',
        estado: d => d.librosRubricados >= 7
          ? { hecho: true, nota: 'los siete rubricados' }
          : { hecho: false, nota: `${d.librosRubricados} de 7 rubricados` },
      },
      {
        titulo: 'El padrón de personas',
        porQue: 'Es lo que habilita cuántas plantas podés tener en floración. Cada ficha necesita DNI, REPROCANN y tope mensual.',
        teneAMano: ['los REPROCANN de cada persona', 'el tope que le corresponde a cada una'],
        ruta: '/ong/pacientes',
        estado: d => {
          const sin = d.pacientesActivos.filter(p => !p.tope_mensual_g).length
          return sin === 0 && d.pacientesActivos.length > 0
            ? { hecho: true, nota: `${d.pacientesActivos.length} con su tope cargado` }
            : { hecho: false, nota: `${sin} de ${d.pacientesActivos.length} sin tope mensual` }
        },
      },
    ],
  },

  comprar: {
    id: 'comprar',
    // Dice DE QUIÉN viene. «Comprar material» a secas se puede leer al revés
    // —como si alguien le comprara a la asociación— y eso ya pasó.
    //
    // Y dice «adquirir», no «comprarle». No todo lo que entra por acá es una
    // compra a un tercero: la produccion propia tambien se carga como orden de
    // servicio, y llamarla compra fue exactamente lo que hizo que $XX.XXX.XXX de
    // material propio de la asociación figuraran como deuda con proveedores.
    label: 'Adquirir productos de un proveedor',
    pasos: [
      {
        titulo: 'El comprobante del proveedor',
        teneAMano: [
          'la factura, ticket o remito que te dio',
          'el nombre del proveedor, escrito siempre igual',
          'cuánto costó en total',
          'un número de orden que no hayas usado antes',
        ],
        porQue: 'Elegí la clase según lo que te dieron: factura A, B o C si es fiscal, ticket si fue una compra chica, remito si la mercadería llegó y la factura viene después. Sin comprobante, el costo por gramo es un número que no se puede defender.',
        ruta: '/ong/documentos?nueva=gasto',
      },
      {
        titulo: 'El lote con ese material',
        teneAMano: [
          'un código para el lote',
          'cuántos gramos entraron',
          'de qué genética o producto es',
        ],
        porQue: 'Sin lote el material no se puede entregar: figura la plata y no figura la mercadería. Es el paso que más se saltea, y el faltante recién aparece en el balance de materia.',
        // Con `vista=catalogo` porque los lotes se crean ahí. El portal abre en
        // Reservas, así que sin esto el paso dejaba en la pantalla correcta pero
        // en la solapa equivocada, que es la mitad del problema que vino a
        // resolver la guía.
        ruta: '/ong/portal?vista=catalogo&nueva=lote',
        // No se puede saber si ESTA compra tiene su lote, pero sí si el balance
        // de materia cierra. Un faltante ahí suele ser justamente esto: una
        // compra que se cargó y cuyo lote nunca se creó.
        // `hecho` siempre en false: que el balance cierre no prueba que ESTA
        // compra tenga su lote, sólo que no falta material en el total.
        estado: d => d.faltanteDeMateria > 0
          ? { hecho: false, tono: 'aviso',
              nota: `faltan ${Math.round(d.faltanteDeMateria)} g en el balance: puede ser un lote sin cargar` }
          : { hecho: false, tono: 'bueno', nota: 'el balance de materia cierra' },
      },
      {
        titulo: 'El pago al proveedor',
        teneAMano: [
          'cuánto le pagaste',
          'por qué medio: efectivo o transferencia',
          'el comprobante de la transferencia, si pagaste así',
        ],
        porQue: 'El egreso de caja, con su comprobante de transferencia si pagaste así. Si todavía no le pagaste, salteá este paso y volvé cuando lo hagas.',
        // El Libro Diario vive en Economia, debajo del analisis del mes. Va con
        // `ir=caja` para llegar a la seccion y no al grafico.
        ruta: '/ong/economia?nueva=1&ir=caja',
      },
      {
        titulo: 'Que la compra haya cerrado',
        porQue: 'El material que entró tiene que aparecer en el balance. Si no cierra, quedó algo a medias: casi siempre es el lote.',
        ruta: '/ong/coherencia',
        estado: d => d.faltanteDeMateria > 0
          ? { hecho: false, tono: 'aviso',
              nota: `faltan ${Math.round(d.faltanteDeMateria)} g: revisá si el lote quedó sin cargar` }
          : { hecho: true, nota: 'el balance de materia cierra' },
      },
    ],
  },

  entregar: {
    id: 'entregar',
    // «Entregar» y no «vender», y no es una preferencia de estilo: lo que la
    // persona paga es un reembolso de costos, no un precio. De eso depende que
    // la operación esté amparada por la Ley 27.350.
    label: 'Entregarle productos a un paciente',
    pasos: [
      {
        titulo: 'La entrega',
        teneAMano: [
          'quién viene a retirar',
          'de qué lote sale el material',
          'cuántos gramos se lleva',
          'cuánto aporta y por qué medio',
        ],
        porQue: 'A quién, de qué lote, cuántos gramos y cuánto aportó. El lote es el que hace que el material se descuente de algún lado.',
        ruta: '/ong/dispensas?nueva=1',
      },
      {
        titulo: 'El recibo del aporte',
        teneAMano: ['la entrega ya cargada, para poder ligarle el recibo'],
        porQue: 'Es lo que prueba que fue un reembolso de costos y no una venta: sin él, el aporte queda sin respaldo. El formulario abre ya en la clase «Comprobante de dispensa», ligado a la entrega que acabás de cargar.',
        // `nueva=dispensa` y no `nueva=1` a secas: son dos formularios distintos
        // en la misma pantalla, y el de documento emitido abre con la clase en
        // «Sin especificar». Había que descubrir el select y elegir a mano
        // justo el papel que el paso venía a pedir.
        ruta: '/ong/documentos?nueva=dispensa',
        estado: d => {
          // Solo lo que de verdad lleva recibo. El recibo es por reembolso de
          // costos: donde no hubo aporte no documenta nada y gastaria un numero
          // del libro, y el consumo interno y la merma ni siquiera tienen a
          // quien emitirselo —van sin paciente—. Contandolos, el paso pedia
          // recibos que no existen y no se tildaba nunca: el 23/08/2026 decia
          // «1121 entregas sin recibo» cuando las que correspondian eran 846.
          const sin = d.dispensas.filter(x =>
            x.modalidad === 'Paciente' && (x.aporte ?? 0) > 0 && !x.recibo_numero).length
          return sin === 0
            ? { hecho: true, nota: 'todas las entregas tienen su recibo' }
            : { hecho: false, nota: `${plural(sin, 'entrega', 'entregas')} sin recibo emitido` }
        },
      },
      {
        titulo: 'El reporte de seguimiento',
        // Se guarda y no se puede editar ni borrar: es la evidencia que va al
        // informe del director médico. Por eso lo que hay que tener a mano no
        // son papeles sino lo que la persona reportó, dicho antes de abrir.
        teneAMano: [
          'qué alivio le dio, del 1 al 5',
          'qué efectos adversos tuvo, si tuvo alguno',
          'cómo lo estuvo usando: cuánto y cada cuánto',
        ],
        porQue: 'Cómo le fue con lo que retiró. Lo carga la persona, y sin él no puede reservar sola por el portal —en el mostrador se entrega igual—. Si todavía no lo completó, salteá este paso.',
        // Sin `?entrega=` el formulario no abre, y está bien que no abra: un
        // reporte de seguimiento no se puede editar ni borrar una vez guardado,
        // así que abrirlo sobre la entrega adivinada deja evidencia clínica
        // colgada de la entrega equivocada. Llegando desde el paso anterior el
        // id viaja en la URL y no hay nada que adivinar.
        ruta: '/ong/seguimiento?nueva=1&ir=pendientes',
      },
    ],
  },

  sumar: {
    id: 'sumar',
    label: 'Sumar a alguien',
    pasos: [
      {
        titulo: 'La ficha de la persona',
        teneAMano: [
          'nombre y DNI',
          'el número de REPROCANN y hasta cuándo vale',
          'la patología y el médico que la indicó',
          'el tope mensual que le corresponde',
        ],
        porQue: 'Nombre, DNI, REPROCANN, patología y médico. Sin DNI no se puede saber si ya está cargada con otro nombre.',
        ruta: '/ong/pacientes?nueva=1',
      },
      {
        titulo: 'El tope mensual',
        porQue: 'Va en la misma ficha y es el campo que más se olvida. Sin tope, el control de los 30 días NO corre para esa persona. El formulario reabre la ficha de la persona que acabás de cargar.',
        teneAMano: ['el tope en gramos que le corresponde por mes'],
        // `nueva=tope` reabre la ficha que trae `?paciente=` en modo edición, y
        // sin ese id no abre nada: un tope cargado en la ficha de otra persona
        // no se ve, simplemente deja pasar entregas que debería frenar.
        ruta: '/ong/pacientes?nueva=tope',
        estado: d => {
          const sin = d.pacientesActivos.filter(p => !p.tope_mensual_g).length
          return sin === 0
            ? { hecho: true, nota: 'todos tienen su tope cargado' }
            : { hecho: false, nota: `${plural(sin, 'paciente', 'pacientes')} sin tope` }
        },
      },
      {
        titulo: 'El alta en acta',
        porQue: 'El alta se aprueba en acta de Comisión Directiva y recién después vale. Una sola acta puede ratificar varias.',
        teneAMano: [
          'la fecha de la reunión y el número de acta que sigue',
          'quiénes estuvieron, para el quórum',
          'a quién o a quiénes se da de alta',
        ],
        ruta: '/ong/actas?nueva=1',
        estado: d => d.asociadosSinActa === 0
          ? { hecho: true, nota: 'todas las altas están respaldadas' }
          : { hecho: false, nota: `${plural(d.asociadosSinActa, 'alta', 'altas')} sin acta` },
      },
    ],
  },

  // Es el flujo de la accion MAS usada del sistema: 1.692 asientos de caja en
  // el ultimo anio, contra 1.241 entregas. Son solo dos pasos, y el segundo es
  // el que se saltea.
  gasto: {
    id: 'gasto',
    label: 'Anotar un gasto o un pago',
    pasos: [
      {
        titulo: 'El asiento en el libro',
        teneAMano: [
          'cuanto fue y de que',
          'por que medio se pago',
          'la fecha real del movimiento',
        ],
        porQue: 'Cada peso que entra y sale va al Libro Diario de Caja, que es uno de los cinco obligatorios. De aca sale el balance.',
        ruta: '/ong/economia?nueva=1',
      },
      {
        titulo: 'El comprobante que lo respalda',
        teneAMano: ['la factura, el ticket o el comprobante de la transferencia'],
        porQue: 'Un gasto asentado sin comprobante queda sin respaldo, y el costo por gramo pasa a ser un numero que no se puede defender. Si el gasto no tiene papel —una compra chica sin ticket— salteá este paso.',
        ruta: '/ong/documentos?nueva=gasto',
      },
    ],
  },

  mover: {
    id: 'mover',
    label: 'Trasladar productos a otro lugar',
    pasos: [
      {
        titulo: 'El traslado',
        teneAMano: [
          'de dónde sale y a dónde va',
          'quién lo lleva, con su DNI',
          'quién lo recibe',
          'qué material y cuánto',
        ],
        porQue: 'Origen, destino, transportista y destinatario. Los cuatro son obligatorios para poder emitir la carta.',
        ruta: '/ong/declaraciones?nueva=traslado',
      },
      {
        titulo: 'La carta de porte, por TAD',
        porQue: 'Se presenta fuera de la app. Sin ella el traslado no está amparado, aunque el material ya se haya movido.',
        ruta: '/ong/declaraciones',
        estado: d => {
          const sin = d.traslados.filter(t => !t.carta_porte_presentada).length
          return sin === 0
            ? { hecho: true, nota: 'todos los traslados tienen su carta' }
            : { hecho: false, nota: `${plural(sin, 'traslado', 'traslados')} sin carta de porte` }
        },
      },
    ],
  },

  presentar: {
    id: 'presentar',
    label: 'Presentar la declaración jurada del semestre',
    pasos: [
      {
        titulo: 'Que el padrón esté al día',
        porQue: 'La declaración informa cuántas personas vinculadas hay. La 1780 pide cinco como mínimo.',
        ruta: '/ong/pacientes',
        estado: d => d.pacientesActivos.length >= 5
          ? { hecho: true, nota: `${plural(d.pacientesActivos.length, 'persona vinculada', 'personas vinculadas')}` }
          : { hecho: false, nota: `hay ${d.pacientesActivos.length} y el mínimo es 5` },
      },
      {
        titulo: 'Armar la declaración',
        porQue: 'Se completa sola con las plantas y las personas que hay cargadas, así que el cultivo tiene que estar al día ANTES: si no, se declara un número que no es el real. Lo que salga entre corchetes es un dato que falta, y así no se puede presentar.',
        // `nueva=ddjj`: esta pantalla tiene tres formularios —declaración,
        // traslado y el de marcarla presentada— y cada uno tiene su clave.
        ruta: '/ong/declaraciones?nueva=ddjj',
        teneAMano: [
          'el cultivo cargado al día, sobre todo las plantas en floración',
          'quién es el responsable técnico que la firma',
        ],
        estado: d => {
          const del = d.ddjj.find(x => x.periodo === d.semestre)
          return del
            ? { hecho: true, nota: `la de ${d.semestre} ya está armada` }
            : { hecho: false, nota: `todavía no existe la de ${d.semestre}` }
        },
      },
      {
        titulo: 'Revisar que no quede nada abierto',
        porQue: 'Los errores de Coherencia no frenan la app, pero sí una presentación: es lo que se mira del otro lado.',
        ruta: '/ong/coherencia',
        estado: d => d.erroresDeCoherencia === 0
          ? { hecho: true, nota: 'sin observables' }
          : { hecho: false, nota: `${plural(d.erroresDeCoherencia, 'observable', 'observables')} sin resolver` },
      },
      {
        titulo: 'Marcarla presentada',
        porQue: 'Armar no es presentar. Hasta que no se tilda, el vencimiento del semestre sigue contando como pendiente. El formulario reabre la declaración del semestre en curso, con el tilde a mano.',
        ruta: '/ong/declaraciones?nueva=presentada',
        teneAMano: ['el comprobante o número de trámite de la presentación'],
        estado: d => {
          const del = d.ddjj.find(x => x.periodo === d.semestre)
          if (!del) return { hecho: false, nota: 'primero hay que armarla' }
          return del.presentada
            ? { hecho: true, nota: `${d.semestre} presentada` }
            : { hecho: false, nota: 'armada, pero todavía sin presentar' }
        },
      },
    ],
  },

  cerrar: {
    id: 'cerrar',
    label: 'Cerrar el mes',
    pasos: [
      {
        titulo: 'Emitir las cuotas',
        porQue: 'El cruce entre asociados e ingresos por cuotas es el que más observaciones genera.',
        ruta: '/ong/asociados',
        estado: d => {
          const n = d.cuotasEmitidas.filter(c => c.periodo === d.periodo).length
          return n > 0
            ? { hecho: true, nota: `${plural(n, 'cuota emitida', 'cuotas emitidas')} en ${d.periodo}` }
            : { hecho: false, nota: `todavía no se emitió ninguna de ${d.periodo}` }
        },
      },
      {
        titulo: 'Los registros del mes',
        porQue: 'El registro de entregas y el de caja, que son los que se muestran si los piden.',
        ruta: '/ong/documentos',
        estado: d => {
          const del = d.documentos.filter(x =>
            x.subtipo === 'Registro mensual' && (x.descripcion ?? '').includes(d.mes))
          return del.length >= 2
            ? { hecho: true, nota: 'entregas y caja, los dos emitidos' }
            : { hecho: false, nota: del.length === 1 ? 'falta uno de los dos' : `sin registros de ${d.mes}` }
        },
      },
      {
        titulo: 'Revisar Coherencia',
        porQue: 'Que no queden errores. Las alertas se miran; los errores frenan una presentación.',
        ruta: '/ong/coherencia',
        estado: d => d.erroresDeCoherencia === 0
          ? { hecho: true, nota: 'sin observables' }
          : { hecho: false, nota: `${plural(d.erroresDeCoherencia, 'observable', 'observables')} sin resolver` },
      },
    ],
  },
}

export const flujoDe = (id: string | null | undefined): Flujo | null =>
  (id && FLUJOS[id]) || null

/**
 * El número de paso saneado: entre 1 y la cantidad de pasos.
 *
 * La URL la escribe cualquiera, y un `?paso=99` no vale una pantalla de error.
 */
/** Una linea del resumen: un paso del flujo, con lo que se sabe de el. */
export interface LineaResumen {
  titulo: string
  /** Ya paso, o el sistema pudo verificar que esta hecho. */
  hecho: boolean
  /** Es el paso en el que estas parado. */
  aca: boolean
  /** Lo que el sistema ve, o null donde no se puede saber. */
  nota: string | null
  tono: 'bueno' | 'aviso' | null
}

/**
 * Como viene la tarea ENTERA, no solo el paso en el que estas.
 *
 * La barra mostraba la nota del paso actual y nada del resto, asi que para
 * saber si algo habia quedado colgado —los pacientes sin tope, las altas sin
 * acta— habia que recorrer los pasos de a uno. Al cerrar el formulario, que es
 * cuando uno levanta la cabeza y pregunta «como viene esto», la respuesta no
 * estaba en ningun lado.
 *
 * Un paso se da por hecho por lo que el sistema VE, si puede verlo; y si no puede,
 * por haber quedado atras. Lo verificado vale aunque no hayas llegado: mandar a
 * alguien a hacer algo ya hecho es la forma mas rapida de que deje de creerle a
 * la guia. Y donde no se puede saber —cual comprobante va con cual compra— la
 * nota queda en null y no se inventa un tilde.
 */
export function resumenDeFlujo(
  flujo: Flujo, datos: DatosFlujo, paso: number,
): LineaResumen[] {
  return flujo.pasos.map((p, i) => {
    const n = i + 1
    const est = p.estado?.(datos) ?? null
    return {
      titulo: p.titulo,
      // Cuando el sistema PUEDE mirar, manda lo que ve y no por donde anduviste:
      // se avanza de paso con «despues lo hago», que es un boton que existe a
      // proposito. Marcar hecho por haber pasado daba un tilde verde con la nota
      // en naranja justo debajo, diciendo las dos cosas a la vez.
      hecho: est ? !!est.hecho : n < paso,
      aca: n === paso,
      nota: est?.nota ?? null,
      tono: est ? (est.tono ?? (est.hecho ? 'bueno' : 'aviso')) : null,
    }
  })
}
export function pasoSaneado(flujo: Flujo, crudo: string | null | undefined): number {
  const n = Number(crudo)
  if (!Number.isFinite(n)) return 1
  return Math.min(Math.max(Math.trunc(n), 1), flujo.pasos.length)
}

/**
 * La ruta de un paso, con el flujo enganchado para que la barra siga viva.
 *
 * `extras` es lo que el paso anterior descubrió y éste necesita: el id de la
 * entrega recién creada, para que el recibo se ligue a ESA y no a la que haya
 * que buscar a mano en una lista de mil doscientas.
 */
export function rutaDePaso(
  flujo: Flujo, paso: number, extras?: Record<string, string>,
): string {
  const p = flujo.pasos[paso - 1]
  if (!p) return '/ong'
  const [base, query] = p.ruta.split('?')
  const params = new URLSearchParams(query)
  params.set('flujo', flujo.id)
  params.set('paso', String(paso))
  for (const [k, v] of Object.entries(extras ?? {})) params.set(k, v)
  return `${base}?${params}`
}
