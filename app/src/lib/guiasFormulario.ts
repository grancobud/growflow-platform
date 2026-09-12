// Lo que hay que saber antes de llenar cada formulario, en castellano.
//
// Un formulario con catorce campos vacíos no dice para qué sirve, qué hace falta
// tener a mano, ni de dónde sale cada dato. Quien lo llena por primera vez tiene
// que deducirlo, y cuando deduce mal el error aparece semanas después en un
// cruce que nadie relaciona con ese día.
//
// Esto vive como DATOS y no como texto adentro de cada pantalla por dos razones.
// Se puede leer sin abrir el formulario —el manual y las acciones muestran el
// mismo texto, así que lo que leés antes de entrar es lo que ves adentro—, y se
// puede testear que ninguna guía quede sin escribir.
//
// El tono importa: cada línea dice de dónde SALE el dato o qué pasa si está mal,
// no qué formato tiene. «Fecha de la entrega» no le sirve a nadie; «si es de
// otro mes, el registro mensual la va a contar donde no va» sí.

export interface GuiaFormulario {
  /** Qué estás por hacer, con el verbo adelante. */
  titulo: string
  /** Para qué sirve, en una línea. Lo que cambia en el sistema al guardar. */
  porQue: string
  /** Qué conviene tener a mano ANTES de empezar. */
  necesitas: string[]
  /**
   * Ayuda por campo: `nombre del campo` → de dónde sale el dato.
   *
   * La clave es el nombre del campo tal como se ve en pantalla, no el de la
   * base: quien lee esto está mirando la etiqueta, no el esquema.
   */
  campos?: Record<string, string>
  /** Lo que suele salir mal acá. Se muestra al pie, no arriba. */
  ojo?: string
}

export const GUIAS: Record<string, GuiaFormulario> = {
  entregar: {
    titulo: 'Entregarle a un paciente',
    porQue: 'Queda registrado el material que sale, se descuenta del lote, y se emite el recibo por el aporte.',
    necesitas: [
      'a quién se le entrega',
      'de qué lote sale el material',
      'cuántos gramos',
      'cuánto aportó y por qué medio',
    ],
    campos: {
      'Paciente': 'La persona que recibe. Su cupo de 30 días se calcula solo con lo que ya retiró.',
      'Fecha': 'El día en que salió el material. Si ponés una de otro mes, el registro mensual la va a contar donde no va.',
      'Lote': 'De acá sale el material y de acá se descuenta. Sin lote, el stock queda alto y el balance de materia no cierra.',
      'Gramos': 'Lo que se entregó de verdad. Dejarlo en cero con aporte cobrado es la falla más cara: no la detecta ningún otro cruce, porque sumar cero no cambia ningún total.',
      'Reembolso ($)': 'La plata que entra por esta entrega. Es un reembolso de costos: por encima de tu costo real deja de serlo y se parece a una venta.',
      'Medio de pago': 'Con qué se pagó. Va a la caja como el medio del asiento, y es lo que después permite arquear el efectivo por separado del banco. Si el pago se partió —una parte en efectivo y otra por transferencia— elegí «Mixto» y cargá cuánto entró por cada uno: cada medio va a la caja como su propia fila. Un pago partido cargado con un solo medio deja el arqueo sin poder cerrar.',
      'Con receta': 'Tildalo sólo si existe la receta. Es lo único que ampara una entrega de más de 40 g.',
    },
    ojo: 'Si le devolviste plata a alguien, no lo cargues como aporte negativo: guardá la entrega con lo que realmente entró y usá el botón de devolución.',
  },

  paciente: {
    titulo: 'Sumar un paciente',
    porQue: 'Lo suma al padrón de personas vinculadas, que es lo que habilita cuántas plantas podés tener en floración.',
    necesitas: [
      'nombre y DNI',
      'el número de REPROCANN y su estado',
      'la patología y el médico que la indicó',
      'el tope mensual que le corresponde',
    ],
    campos: {
      'DNI': 'Es lo único que identifica a una persona de forma estable. Sin él no se puede saber si ya está cargada con otro nombre.',
      'N° de registro': 'El número de REPROCANN prueba que el trámite existe. Sin él, en una inspección sus entregas no se pueden justificar.',
      'Patología / Indicación': 'Lo que justifica el uso. El registro no pide sólo el número: pide también esto.',
      'Médico tratante': 'Quién indicó el tratamiento. Va junto con la patología.',
      'Tope mensual (g)': 'Sale del REPROCANN de cada persona; el sistema no lo puede inventar. Sin tope cargado, el control de los 30 días NO corre para ella y se le puede entregar de más sin que nada avise.',
    },
    ojo: 'Antes de cargarlo, buscalo por DNI. La misma persona con dos fichas parte su historial de consumo, que es justo lo que mira el cupo.',
  },


  comprar: {
    titulo: 'Comprar material',
    porQue: 'Deja registrada la orden de servicio con su comprobante, que es lo que respalda el gasto y contra lo que se imputan los pagos.',
    necesitas: [
      'a qué proveedor',
      'qué producto y cuánto',
      'el costo, y el número de orden',
    ],
    campos: {
      'Número': 'El de la orden de servicio. No se puede repetir: los pagos se ligan a la orden por el número, y si está repetido no se sabe a cuál se le pagó.',
      'Proveedor': 'Escribilo siempre igual. El mismo proveedor con dos grafías aparece partido en dos en todos los totales.',
      'Monto': 'Lo que costó. Es lo que después se contrasta contra los pagos para sacar el saldo.',
      'Clase': 'Qué comprobante es: factura, ticket, remito. De acá sale si el gasto está respaldado.',
    },
    ojo: 'Cargar la orden no alcanza: el material recién se puede entregar cuando existe el LOTE. Si te salteás ese paso, la plata figura y el material no, y eso aparece recién en el balance.',
  },

  gasto: {
    titulo: 'Anotar un gasto o un pago',
    porQue: 'Asienta la salida en el libro de caja, que es lo que tiene que coincidir con los comprobantes. Si es un pago a un proveedor, elegí esa opción arriba: además de salir de la caja, descuenta de lo que se le debe. Antes eran dos cargas en dos pantallas distintas.',
    necesitas: [
      'a quién se le pagó',
      'cuánto y por qué medio',
      'el comprobante, si lo hay',
    ],
    campos: {
      'Tipo': 'Si la plata entra o sale. Un gasto es egreso; un aporte o una cuota, ingreso.',
      'Concepto': 'De qué se trata. Es lo que agrupa el movimiento en los informes por categoría.',
      'Medio': 'De acá sale la conciliación con el banco y el arqueo de caja. Lo que no sea efectivo ni transferencia se cuenta aparte, porque no se sabe en cuál de las dos está.',
      'Detalle': 'A quién se le pagó o de quién vino. Escribilo siempre igual: el mismo nombre con dos grafías aparece partido en dos.',
    },
  },

  cuotas: {
    titulo: 'Cobrar las cuotas del mes',
    porQue: 'Emite la cuota del período para todos los asociados activos de una sola vez.',
    necesitas: [
      'el valor de la cuota vigente, aprobado en acta',
      'el padrón de asociados al día',
    ],
    ojo: 'El cruce entre asociados registrados e ingresos por cuotas es el que más observaciones genera. Emitirlas todos los meses, aunque después alguna no se cobre, es lo que hace que ese cruce cierre.',
  },

  // ---------- La puesta en marcha. Se carga una vez y habilita el resto. ----------

  entidad: {
    titulo: 'Cargar los datos de la entidad',
    porQue: 'Es la cabecera de TODOS los documentos que el sistema emite. Sin esto, cada recibo, acta y declaración sale con [CUIT] entre corchetes.',
    necesitas: [
      'el estatuto a mano',
      'razón social y CUIT',
      'domicilio de la sede',
      'la matrícula de personería jurídica',
      'la fecha de cierre de ejercicio',
    ],
    campos: {
      'CUIT': 'Va en cada documento que emitís. Es el dato que más se nota cuando falta, porque aparece entre corchetes en todos.',
      'Razón social': 'El nombre exacto como figura en el estatuto, no el de fantasía.',
      'Objeto cannábico': 'Tildalo sólo si el estatuto declara el objeto de estudio, investigación o uso medicinal del cannabis. Sin eso la ONG no se puede inscribir en REPROCANN, y una asociación preexistente se adecúa reformando el estatuto.',
      'Cierre de ejercicio': 'De acá salen los plazos del balance y de la asamblea ordinaria.',
    },
    ojo: 'Es lo primero que conviene cargar. Todo lo demás se puede hacer sin esto, pero los papeles salen incompletos y hay que rehacerlos.',
  },

  autoridad: {
    titulo: 'Cargar una autoridad',
    porQue: 'Deja asentado quién ocupa cada cargo y desde cuándo. Las designaciones de Director Médico y Responsable Técnico se completan solas con esta lista.',
    necesitas: [
      'nombre, DNI y cargo',
      'el acta que la designó',
      'desde cuándo y hasta cuándo dura el mandato',
      'el grupo familiar de la persona',
    ],
    campos: {
      'Cargo': 'El que define el estatuto: presidente, secretario, tesorero, revisor de cuentas.',
      'Grupo familiar': 'Poné la misma etiqueta a quienes sean parientes o compartan domicilio. Es lo único que permite verificar que no haya parentesco cruzado entre la Comisión Directiva y la Revisora de Cuentas, que es causal de observación; dentro de una misma comisión sí está permitido.',
      'Mandato hasta': 'Un mandato vencido invalida las decisiones que se tomen después.',
    },
    ojo: 'También hace falta el certificado de antecedentes penales de cada integrante de la CD y de la Revisora.',
  },

  predio: {
    titulo: 'Cargar un predio',
    porQue: 'Declara dónde funciona la asociación y dónde se cultiva. Los comodatos de sede y de predio de cultivo salen de acá.',
    necesitas: [
      'la dirección exacta',
      'si es sede social, predio de cultivo, o las dos cosas',
      'el contrato de comodato o el título',
      'si el municipio fue notificado',
    ],
    campos: {
      'Georreferenciado': 'Las coordenadas del predio de cultivo, que el REPROCANN pide.',
    },
  },

  libro: {
    titulo: 'Dar de alta un libro',
    porQue: 'Registra uno de los siete libros obligatorios con su rúbrica, que es la autorización del registro para usarlo.',
    necesitas: [
      'qué libro es',
      'el organismo que lo rubricó',
      'la fecha y el número de rúbrica',
      'cuántos folios tiene',
    ],
    campos: {
      'Rubricado': 'Sin rúbrica el libro NO vale, por más que esté escrito. Es un acto del registro público, no algo que la asociación se dé a sí misma.',
      'Folios totales': 'Sirve para avisarte cuando el libro llegue al 75% y haya que rubricar el siguiente antes de quedarse sin lugar.',
    },
    ojo: 'Los siete: Actas de Comisión Directiva, Actas de Asamblea, Asistencia a reuniones, Actas de Comisión Revisora, Registro de Asociados, Libro Diario, e Inventario y Balances.',
  },

  acta: {
    titulo: 'Redactar un acta',
    porQue: 'Deja la reunión lista para transcribir al libro, con el control de quórum y los firmantes.',
    necesitas: [
      'fecha, hora de inicio y de cierre',
      'quiénes asistieron, con nombre y apellido',
      'qué se trató y qué se resolvió',
      'el número que le toca en el libro',
    ],
    campos: {
      'Número': 'Correlativo y sin saltos. Un número repetido o faltante es de las primeras cosas que se miran.',
      'Asistentes': 'Los nombres, no el total: sin ellos el quórum no se puede demostrar. Pueden entrar personas que no son socias —contador, escribano— y también cuentan como presentes.',
      'Quórum requerido': 'El mínimo que pide el estatuto para poder sesionar. Se carga para poder contrastarlo.',
    },
    ojo: 'Una sola acta puede ratificar muchas altas de asociados a la vez, con el detalle en un anexo. No hace falta una por persona.',
  },

  // ---------- Lo demás del circuito ----------

  // DICE EL ORDEN, y no solo que se pide.
  //
  // Una cosecha cuelga de UNA PLANTA, y una planta necesita su genetica. Quien
  // entra directo a Cosecha solo ve lo que ya esta plantado y concluye que la
  // app «no muestra» lo que cosecho.
  //
  // Paso el 27/08/2026 en la asociación: cosecharon tres geneticas nuevas en la Sala 1
  // y en la pantalla de Cosecha solo les figuraba Avocado, la unica plantada. No
  // era un error: faltaban los dos pasos de antes y nada los decia.
  //
  // Va como guia y no como flujo a proposito: la barra de flujo se dibuja dentro
  // de PaginaONG y estos tres pasos viven en Cultivo, asi que un flujo dejaria a
  // la persona sin barra en el primer paso. `GuiaAlLlegar` esta en el layout y
  // se ve en cualquier pantalla.
  cosecha: {
    // Describia un recorrido de tres pantallas que ya no existe: «son tres
    // pantallas y cada una necesita la anterior», con los pasos numerados. El
    // registro pasó a ser uno solo —elegís la variedad y cargás el peso— y una
    // guía que explica un camino viejo manda a recorrer pantallas donde no hay
    // nada que hacer.
    titulo: 'Registrar una cosecha',
    porQue: 'Esto es para el material que salió de TUS plantas cargadas: la cosecha se registra sobre la planta, así que acá sólo aparecen las variedades que tienen plantas en floración. Si el material vino de afuera —comprado, o de un cultivo que no está en el sistema— esto no es una cosecha: creá el lote directamente y listo.',
    necesitas: [
      'el peso húmedo y el peso seco',
      'si cargás planta por planta, el peso de cada una',
    ],
    ojo: 'El peso SECO es el que cuenta: alimenta el balance de materia y el costo por gramo. Y cargar la cosecha no alcanza para entregar — el material recién se dispensa cuando existe el LOTE.',
  },

  movimiento: {
    titulo: 'Pasar plata del banco a la caja',
    porQue: 'La misma plata cambia de lugar: sale de un medio y entra en el otro. Es lo que anota una extracción para pagar algo en efectivo, y es lo que faltaba: la caja de efectivo daba en negativo porque los pagos en mano estaban y las extracciones que los financiaron no.',
    necesitas: ['de dónde sale y a dónde entra', 'cuánto'],
    ojo: 'El saldo TOTAL no se mueve: son dos asientos por el mismo importe. Desde acá no se puede inventar un ingreso — sólo cambiar de lugar lo que ya está.',
  },
  visita: {
    titulo: 'Registrar una visita',
    porQue: 'El sistema registra lo que se ENTREGA; la visita registra a quien se ATIENDE. La mayor parte de lo que hace la asociación no termina en una entrega sino en información, y de eso no quedaba ningún rastro.',
    necesitas: [
      'quién vino: su ficha del padrón, o el nombre si todavía no está',
      'por qué vino',
    ],
    ojo: 'Se puede dejar sin cerrar y completar el resultado después: la visita queda contada igual. Y si la persona no está en el padrón, cargala igual — eso es justamente lo que esta pantalla vino a no perder.',
  },
  lote: {
    titulo: 'Crear un lote',
    porQue: 'Es lo que hace que el material se pueda entregar. Sin lote, lo que entró figura en la contabilidad y no existe para dispensar.',
    necesitas: [
      'un código para identificarlo',
      'cuántos gramos tiene',
      'de qué genética o producto es',
      'de dónde vino: cosecha propia o compra',
    ],
    campos: {
      'Código': 'Con este código el material viaja por todo el sistema: es lo que después se elige al entregar y lo que aparece en el recibo.',
    },
  },

  documento: {
    titulo: 'Emitir un documento',
    porQue: 'Genera un papel a nombre de alguien, con la cabecera de la entidad y su numeración.',
    necesitas: [
      'a quién va dirigido',
      'qué clase de documento es',
      'la fecha',
    ],
    ojo: 'Lo que sale entre corchetes es un dato que falta cargar. Preferimos que se vea el hueco antes que rellenarlo con algo inventado en un papel que se firma.',
  },

  ddjj: {
    titulo: 'Presentar la declaración jurada',
    porQue: 'Es la semestral que pide la Resolución 1780. Se arma sola con lo que el sistema ya sabe.',
    necesitas: [
      'el CUIT de la entidad cargado',
      'quién es el responsable técnico que firma',
      'las plantas y variedades al día',
    ],
    ojo: 'Armarla acá no la presenta. El trámite se hace por TAD, fuera de la app, y recién ahí se tilda como presentada.',
  },

  feedback: {
    titulo: 'Cargar el reporte de seguimiento',
    porQue: 'Es el reporte clínico de cómo le fue a la persona con lo que retiró. Alimenta el informe semestral del Director Médico.',
    necesitas: [
      'de qué entrega se trata',
      'cuánto le alivió, del 1 al 5',
      'si tuvo efectos adversos',
      'qué dosis usó de verdad',
    ],
    ojo: 'Una vez cargado NO se puede editar ni borrar por ningún camino. Es el único dato del sistema con esa regla, y es a propósito: un reporte clínico que se puede cambiar después no sirve como antecedente.',
  },

  devolucion: {
    titulo: 'Registrar una devolución',
    porQue: 'Deja constancia de la plata que se le devolvió a alguien: sale de caja y la entrega queda sin aporte.',
    necesitas: [
      'la entrega a la que corresponde',
      'cuánto se devolvió',
    ],
    ojo: 'Si en realidad fue un signo mal tipeado y no una devolución, corregí el importe con Editar en vez de usar esto. Las dos lecturas dan números distintos y sólo vos sabés cuál pasó.',
  },

  cerrarMes: {
    titulo: 'Cerrar el mes',
    porQue: 'Deja el período listo para mostrar: las cuotas emitidas, los dos registros del mes, y Coherencia sin observables.',
    necesitas: [
      'las entregas y los gastos del mes ya cargados',
      'el valor de la cuota vigente',
    ],
    ojo: 'El cruce entre asociados registrados e ingresos por cuotas es el que más observaciones genera. Emitir las cuotas todos los meses, aunque después alguna no se cobre, es lo que hace que ese cruce cierre.',
  },

  // ---------- Cultivo ----------

  genetica: {
    titulo: 'Crear una genética',
    porQue: 'Suma una variedad al banco. Es lo que después se elige al cargar plantas y lo que aparece en el informe de genéticas que pide la 1780.',
    necesitas: ['el nombre de la variedad', 'si es índica, sativa o híbrida', 'el THC y CBD estimados, si los sabés'],
    campos: {
      'Nombre': 'Escribilo siempre igual. La misma variedad con dos nombres aparece partida en dos en los rendimientos.',
    },
    ojo: 'Con el nombre alcanza para empezar. El resto se completa cuando tengas el análisis.',
  },

  plantas: {
    titulo: 'Cargar plantas',
    porQue: 'Da de alta las plantas y las ubica en la sala. Las que están en floración son las que cuentan contra el tope del REPROCANN.',
    necesitas: ['de qué genética', 'cuántas', 'en qué fase están', 'en qué área de la sala van'],
    campos: {
      'Fase': 'Sólo las de FLORACIÓN cuentan contra el cupo. Las de vegetativo o enraizando no.',
    },
    ojo: 'Antes de pasarlas a floración, mirá el Cupo REPROCANN: el tope depende de cuántas personas vinculadas tengas.',
  },

  area: {
    titulo: 'Crear un área de cultivo',
    porQue: 'Es cada carpa, cama o sector con sus medidas. Permite regar o fumigar un área entera de un toque en vez de planta por planta.',
    necesitas: ['un nombre para el área', 'las medidas', 'cuántas plantas entran'],
  },

  riego: {
    titulo: 'Regar o fumigar una sala',
    porQue: 'Registra la misma aplicación en todas las plantas del área de una sola vez, en lugar de repetirla una por una.',
    necesitas: ['qué área', 'qué se aplicó y en qué dosis', 'la fecha'],
    ojo: 'Queda anotado en la línea de tiempo de cada planta del área. Si después hay que corregir una sola, se edita desde su ficha.',
  },

  evento: {
    titulo: 'Registrar algo en una planta',
    porQue: 'Anota lo que le pasó a una planta puntual: una poda, un trasplante, una plaga, un cambio de fase.',
    necesitas: ['qué planta', 'qué pasó', 'la fecha'],
  },

  floracion: {
    titulo: 'Pasar plantas a floración',
    porQue: 'Cambia la fase, y con eso las plantas empiezan a contar contra el tope que habilita el REPROCANN de las personas vinculadas.',
    necesitas: ['qué plantas', 'la fecha del cambio'],
    ojo: 'Fijate primero en Cupo REPROCANN cuántas te habilita el padrón. Pasar de más deja el cultivo por encima del tope declarado.',
  },

  // ---------- Ambiente ----------

  salaAmbiente: {
    titulo: 'Crear una sala de ambiente',
    porQue: 'Es el espacio del que se miden temperatura y humedad. Cada sala tiene sus propios rangos según la fase que aloja.',
    necesitas: ['un nombre', 'qué fase vive ahí: vegetativo, floración o secado'],
  },

  lectura: {
    titulo: 'Cargar una lectura de ambiente',
    porQue: 'Anota temperatura y humedad de una sala. De estas lecturas salen los promedios, los picos y el VPD.',
    necesitas: ['la sala', 'temperatura y humedad', 'la hora'],
    ojo: 'Conviene cargar dos por día, una de luces encendidas y otra de apagadas. Con una sola el promedio miente.',
  },

  // ---------- Costos ----------

  costo: {
    titulo: 'Cargar un costo',
    porQue: 'Es de acá que sale el costo por gramo, y el costo por gramo es lo que hace que un aporte sea un reembolso y no otra cosa.',
    necesitas: ['de qué es el costo', 'cuánto', 'si es fijo mensual o por única vez'],
    campos: {
      'Periodicidad': 'Los fijos se reparten mes a mes; los variables se imputan donde caen. Confundirlos hace que el costo por gramo salte de un mes a otro sin motivo.',
    },
    ojo: 'Sin costos cargados, el control de «Reembolso vs. costo real» no puede correr y el aporte queda sin nada contra qué compararse.',
  },

  insumo: {
    titulo: 'Cargar un insumo al inventario',
    porQue: 'Lleva la cuenta de lo que hay y de lo que se consume. Lo consumido entra en el costo del ciclo.',
    necesitas: ['qué insumo', 'cuánto entró', 'a qué precio'],
  },

  equipo: {
    titulo: 'Cargar un equipo y su amortización',
    porQue: 'Un equipo no se gasta el mes que se compra: se reparte a lo largo de su vida útil. Eso es lo que evita que el costo por gramo se dispare ese mes.',
    necesitas: ['qué equipo', 'cuánto costó', 'cuántos meses de vida útil'],
  },

  mantenimiento: {
    titulo: 'Programar un mantenimiento',
    porQue: 'Agenda el cambio de filtros, la limpieza o la revisión de un equipo, para que no se pase.',
    necesitas: ['qué equipo', 'cada cuánto', 'la última vez que se hizo'],
  },

  // ---------- ONG que faltaban ----------

  asociado: {
    titulo: 'Dar de alta un asociado',
    porQue: 'Lo suma al padrón societario, que es distinto del de pacientes: acá va quien es miembro de la asociación civil y paga cuota.',
    necesitas: ['nombre y datos de contacto', 'la categoría que define el estatuto', 'el acta que aprobó el alta'],
    ojo: 'La misma persona puede ser socio y paciente, o sólo una de las dos. Son dos padrones y se cargan por separado.',
  },

  reserva: {
    titulo: 'Hacer una reserva',
    porQue: 'El paciente aparta material del catálogo y tiene 72 horas para retirarlo. Recién al retirar nace la dispensa.',
    necesitas: ['quién reserva', 'de qué lote y cuánto', 'cómo va a pagar el aporte'],
    ojo: 'Una reserva sin retirar NO es una entrega: el material sigue en el lote y vuelve al inventario si vence.',
  },

  retiro: {
    titulo: 'Entregar en la sede',
    porQue: 'Cierra una reserva: valida el pago, descuenta el stock, asienta la caja y emite el recibo. Es el momento en que la reserva se convierte en dispensa.',
    necesitas: ['el código de la reserva o su QR', 'el DNI de quien retira'],
  },

  plantilla: {
    titulo: 'Generar una plantilla institucional',
    porQue: 'Arma los instrumentos que pide la 1780 con lo que ya está cargado: designaciones, comodatos, informe de genéticas y mandato.',
    necesitas: ['los datos de la entidad y las autoridades cargados'],
    ojo: 'Lo que salga entre corchetes es un dato que falta. Preferimos que se vea el hueco antes que rellenarlo con algo inventado en un papel que se firma.',
  },

  informeMedico: {
    titulo: 'Generar el informe del Director Médico',
    porQue: 'Cruza el diagnóstico de cada paciente con los lotes que recibió y lo que reportó. Es el informe semestral que la autoridad sanitaria le exige al director médico.',
    necesitas: ['el director médico designado', 'los reportes de seguimiento cargados'],
    ojo: 'Sin reportes de seguimiento el informe sale vacío: la curva de alivio se arma con lo que cada persona reportó.',
  },

  requisitos: {
    titulo: 'Marcar los requisitos de la 1780',
    porQue: 'Es la lista de lo que la Resolución exige, con quién responde por cada cosa. De acá salen los avisos de lo que falta.',
    necesitas: ['saber quién es el responsable técnico y quién el director médico'],
  },

  exportar: {
    titulo: 'Exportar o importar datos',
    porQue: 'Baja cualquier tabla a un archivo, o sube datos en lote. Sirve para respaldar y para cargar mucho de una vez.',
    necesitas: ['qué tabla', 'y si vas a importar, el archivo con las columnas que corresponden'],
    ojo: 'Es la salida de emergencia, no la forma habitual de cargar. Lo que se carga por acá se saltea las validaciones de las pantallas.',
  },

  revisar: {
    titulo: 'Revisar qué no cierra',
    porQue: 'Cruza los datos de todas las pantallas y marca lo que no coincide entre sí. Es lo que se mira antes de cualquier presentación.',
    necesitas: ['nada: se calcula solo con lo que ya está cargado'],
    ojo: 'Los organismos de control no miran sólo que estén los papeles: verifican que todos los libros cuenten la misma historia. Las inconsistencias entre libros, más que la falta de documentación, son la principal causa de observaciones.',
  },

  traslado: {
    titulo: 'Mover material a otro lado',
    porQue: 'Registra el traslado y prepara la guía para llevar impresa. La carta de porte se presenta aparte, por TAD.',
    necesitas: [
      'origen y destino',
      'quién lo transporta y su DNI',
      'quién lo recibe',
      'qué material y cuánto',
    ],
    campos: {
      'Transportista': 'Obligatorio para la carta de porte. Sin este dato la carta no se puede emitir, aunque el material se haya movido.',
      'DNI del transportista': 'Va en la carta de porte junto al nombre.',
      'Destinatario final': 'Quién recibe. También es obligatorio para la carta.',
      'Cantidad': 'El tope cambia según el tipo: 40 g de flores, 6 frascos, y las plantas dependen de lo que cada persona tenga autorizado.',
    },
    ojo: 'Tildar «carta de porte presentada» NO dice que el traslado ocurrió: dice que el trámite se hizo por TAD, fuera de la app. Sin esa presentación el traslado no está amparado.',
  },
}

/** La guía de una acción, o null si esa acción todavía no tiene una escrita. */
export const guiaDe = (id: string): GuiaFormulario | null => GUIAS[id] ?? null
