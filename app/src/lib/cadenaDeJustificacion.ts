// La cadena que hay que poder mostrar entera, y que cierre.
//
// DE DONDE SALE ESTO
//
// Se lo planteo a la asociación gente de Bruma Fitomedicina, y es la respuesta a la
// pregunta que la asociacion venia haciendose: por que habria que vincular
// gente. Vincular no es sumar clientes: es de donde sale el permiso para tener
// las plantas.
//
// Una asociacion de cultivo solidario no vende. Cultiva POR CUENTA de sus
// socios, y cada socio le reembolsa la parte que le toca del costo. Toda la
// legalidad se apoya en esa frase, y la unica forma de probarla es una cadena
// donde cada eslabon justifica al siguiente:
//
//   socios → cupo de plantas del DT → biomasa → costos → reembolso
//
// Si un numero sube, los demas tienen que subir proporcional y
// justificadamente. Cada desajuste tiene un nombre feo:
//
//   mas socios que plantas      socios de adorno para inflar el padron
//   mas plantas que socios      cultivo sin amparo
//   mas biomasa que plantas     material que entro de otro lado
//   mas ingresos que costos     lucro, y ahi se cae el «sin fines de lucro»
//   mas costos que ingresos     alguien la esta financiando, y a cambio de que
//
// POR QUE ES UNA PANTALLA Y NO UN OBSERVABLE MAS
//
// Coherencia dice cosas sueltas —telefonos repetidos, recibos sin emitir—. Esto
// dice si el CONJUNTO cierra, que es lo unico que a un control le va a importar:
// no va a pedir los cinco numeros por separado, va a pedir que el de la punta
// justifique al del final.

/** Lo que hace falta para medir la cadena. Todo en gramos y en pesos. */
export interface DatosCadena {
  /** Socios con vinculo vigente: son la fuente del derecho a cultivar. */
  sociosVinculados: number
  /** Cuantas plantas en floracion habilita cada socio. Sale del estatuto. */
  plantasPorSocio: number
  /** Las que hay HOY en floracion. Las de vegetativo no cuentan contra el cupo. */
  plantasEnFloracion: number
  /**
   * Gramos que se espera de cada planta. Lo define el cultivo —o el Director
   * Tecnico—, no el sistema: sin este numero la biomasa no se puede juzgar y el
   * eslabon lo dice, en vez de inventar un tilde.
   */
  rindeEsperadoPorPlantaG: number | null
  /** Biomasa propia, la que salio de esas plantas. */
  gramosCosechados: number
  /** Material que entro comprado. NO esta justificado por el cupo de plantas. */
  gramosComprados: number
  gramosEntregados: number
  /**
   * Los lotes que entraron COMPRADOS, y que les falta.
   *
   * la asociación a veces cultiva y a veces compra. El material comprado no se
   * justifica con las plantas de los socios —no salio de ahi— sino con de QUIEN
   * vino y con que analisis: esa es su cadena de origen.
   */
  lotesComprados: number
  lotesSinProveedor: number
  lotesSinAnalisis: number
  /**
   * Los que entraron ANTES de que el analisis se pidiera.
   *
   * No estan en falta —un analisis no se puede hacer sobre material que ya se
   * entrego y se consumio— pero se cuentan aparte para poder decirlo: que la
   * cadena cierre no puede significar que el tema no exista.
   */
  lotesConAnalisisViejo?: number
  /**
   * Material propio que NO esta en `gramosCosechados`.
   *
   * Son los lotes con `origen: 'propio_sin_cosecha'`: cultivo de la asociacion
   * cuya cosecha nunca se registro. Existe y hay que contarlo en la biomasa,
   * pero es propio, no comprado.
   *
   * Va aparte porque este eslabon no cuenta gramos: sostiene el argumento de
   * que la asociacion CULTIVA para sus socios en vez de comprar y revender.
   * Metidos en `gramosComprados`, la nota decia «X.XXX g de proveedores» cuando
   * de proveedores eran 4.283: la propia pantalla que justifica el cultivo
   * declaraba que la mitad del material se habia comprado afuera.
   */
  gramosPropiosSinCosecha?: number
  costosOperativos: number
  /**
   * Lo que se le debe a proveedores: comprado menos pagado.
   *
   * ES COSTO AUNQUE TODAVIA NO SALIO DE LA CAJA. El material ya se recibio y ya
   * se entrego a los socios; que el pago siga pendiente no lo hace mas barato.
   * Mirando solo la caja, la asociación mostraba $8,8 M de excedente el 23/08/2026 y al
   * mismo tiempo tenia ~$32 M sin pagarle a proveedores: el excedente era de la
   * caja, no de la asociacion.
   */
  deudaConProveedores: number
  ingresosDeReembolso: number
  /**
   * Lo que cuesta el material segun los lotes, por gramo.
   *
   * Es la via mas directa para saber si el aporte lucra: no depende de como se
   * imputaron los gastos en la caja, sale del precio al que entro cada lote.
   * Null si los lotes no tienen el costo cargado.
   */
  costoMaterialPorGramo?: number | null
  /** Gramos que efectivamente se cobraron. Los entregados sin cargo no van aca. */
  gramosCobrados?: number
  /** Lo aportado por esos gramos. */
  aportesCobrados?: number
  /**
   * Gastos que NO son compra de material.
   *
   * Se separan a proposito de `costosOperativos`, que mezcla las dos cosas: para
   * juzgar si hay lucro hay que comparar el margen sobre el material contra los
   * gastos que ese margen tiene que sostener.
   */
  gastosNoMaterial?: number
}

export type EstadoEslabon = 'cierra' | 'no_cierra' | 'sin_datos'

export interface Eslabon {
  clave: string
  titulo: string
  valor: number
  unidad: string
  /** Cuanto habilita sobre el eslabon siguiente, o null si no habilita un tope. */
  habilita: number | null
  estado: EstadoEslabon
  /** Que dice el desvio, en una linea. */
  nota: string
  /** Que hacer si no cierra. Null cuando cierra. */
  comoSeArregla: string | null
}

/**
 * Cuanto se le permite al reembolso apartarse de los costos antes de llamarlo
 * excedente.
 *
 * No es cero a proposito: los gastos y los ingresos no caen el mismo dia, y un
 * corte a fin de mes siempre agarra alguna diferencia de tiempo. Lo que la
 * tolerancia NO cubre es un desvio sostenido, que es justo lo que hay que ver.
 */
const TOLERANCIA_REEMBOLSO = 0.05

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
const gramos = (n: number) => `${Math.round(n).toLocaleString('es-AR')} g`

export function cadenaDeJustificacion(d: DatosCadena): Eslabon[] {
  const cupo = d.sociosVinculados * d.plantasPorSocio
  /** Todo lo propio: lo cosechado con registro, mas lo propio sin cosecha cargada. */
  const propioTotal = d.gramosCosechados + (d.gramosPropiosSinCosecha ?? 0)
  const biomasaTotal = propioTotal + d.gramosComprados
  const esperado = d.rindeEsperadoPorPlantaG != null
    ? d.plantasEnFloracion * d.rindeEsperadoPorPlantaG
    : null

  // ── 1 · los socios, que son de donde sale todo ──────────────────────────────
  const socios: Eslabon = d.sociosVinculados === 0
    ? { clave: 'socios', titulo: 'Socios admitidos', valor: 0, unidad: 'socios',
        habilita: 0, estado: 'sin_datos',
        nota: 'Sin socios vinculados no hay nada que justifique una planta.',
        comoSeArregla: 'Vincular socios con su REPROCANN: es de donde sale el derecho a cultivar.' }
    : { clave: 'socios', titulo: 'Socios admitidos', valor: d.sociosVinculados,
        unidad: 'socios', habilita: cupo, estado: 'cierra',
        nota: `Habilitan ${cupo} plantas en floración, a ${d.plantasPorSocio} por socio.`,
        comoSeArregla: null }

  // ── 2 · el cupo de plantas que el DT firma sobre esos socios ────────────────
  const sobranPlantas = d.plantasEnFloracion - cupo
  const plantas: Eslabon = sobranPlantas > 0
    ? { clave: 'plantas', titulo: 'Plantas en floración', valor: d.plantasEnFloracion,
        unidad: 'plantas', habilita: esperado, estado: 'no_cierra',
        nota: `${sobranPlantas} plantas por encima de las ${cupo} que los socios justifican.`,
        comoSeArregla: 'Sumar socios que las justifiquen, o bajar las plantas en floración. ' +
          'Una planta sin socio que la sostenga es cultivo sin amparo.' }
    : { clave: 'plantas', titulo: 'Plantas en floración', valor: d.plantasEnFloracion,
        unidad: 'plantas', habilita: esperado, estado: 'cierra',
        nota: cupo > 0
          ? `Dentro del cupo de ${cupo}. Nadie obliga a usarlo entero.`
          : 'Sin cupo que las habilite.',
        comoSeArregla: null }

  // ── 3 · la biomasa, propia y comprada, cada una con su respaldo ────────────
  //
  // A VECES SE CULTIVA Y A VECES SE COMPRA, y las dos cosas se justifican
  // distinto. Lo cosechado se mide contra lo que las plantas pueden dar. Lo
  // comprado NO: no salio de esas plantas, asi que lo que lo respalda es de
  // quien vino y con que analisis. Exigirle el rinde propio al material comprado
  // dejaria la cadena trabada para siempre en una asociacion que no cultiva, y
  // no marcaria nada de lo que de verdad le falta.
  const faltanPapeles = d.lotesSinProveedor + d.lotesSinAnalisis > 0
  // Contra TODO lo propio, no sólo lo cosechado con registro.
  //
  // Este es el cruce que hace una inspección: si el material propio supera lo
  // que las plantas declaradas pueden dar, hay biomasa sin origen. Mirando sólo
  // `gramosCosechados` se le escapaba justo el material que no tiene cosecha
  // detrás — en la asociación, X.XXX g contra 100 registrados—, que es el que más
  // necesita que alguien lo contraste.
  const propioDeMas = esperado != null && propioTotal > esperado
  let biomasa: Eslabon

  if (propioTotal > 0 && esperado == null) {
    // Hay cultivo propio y no hay con que juzgarlo.
    biomasa = { clave: 'biomasa', titulo: 'Biomasa', valor: biomasaTotal, unidad: 'g',
      habilita: null, estado: 'sin_datos',
      nota: 'Falta el rinde esperado por planta: sin ese número no hay contra qué comparar lo cosechado.',
      comoSeArregla: 'Cargar el rendimiento en la ficha de cada variedad, en Cultivo › Genéticas. ' +
        'La ficha del banco suele traerlo como «Producción: +145/Planta».' }
  } else if (propioDeMas) {
    const sobra = propioTotal - (esperado ?? 0)
    biomasa = { clave: 'biomasa', titulo: 'Biomasa', valor: biomasaTotal, unidad: 'g',
      habilita: null, estado: 'no_cierra',
      nota: `Se cosecharon ${gramos(sobra)} más de lo que esas plantas pueden dar.`,
      comoSeArregla: 'Revisar el rinde declarado o el conteo de plantas. Biomasa de más es ' +
        'material sin origen que lo justifique.' }
  } else if (faltanPapeles) {
    const partes: string[] = []
    if (d.lotesSinProveedor > 0) {
      partes.push(`${d.lotesSinProveedor} sin proveedor identificado`)
    }
    if (d.lotesSinAnalisis > 0) partes.push(`${d.lotesSinAnalisis} sin análisis de laboratorio`)
    biomasa = { clave: 'biomasa', titulo: 'Biomasa', valor: biomasaTotal, unidad: 'g',
      habilita: null, estado: 'no_cierra',
      nota: `Del material comprado: ${partes.join(' y ')}.`,
      comoSeArregla: 'El material que no salió del cultivo propio se respalda con de quién ' +
        'vino y con qué análisis. Completar el proveedor de cada lote y adjuntarle el ' +
        'análisis en Operación › Autodispensación › Lotes.' }
  } else {
    const nota = d.gramosComprados > 0 && propioTotal > 0
      ? `${gramos(propioTotal)} del cultivo propio y ${gramos(d.gramosComprados)} de proveedores, con su respaldo.`
      : d.gramosComprados > 0
        // Que la cadena cierre no puede significar que el tema no exista: si hay
        // lotes amparados por la constancia, se dicen igual.
        ? d.lotesConAnalisisViejo
          ? `${gramos(d.gramosComprados)} de proveedores. ${d.lotesConAnalisisViejo} lotes son `
            + 'anteriores a que se pidiera el análisis, y quedan pendientes de regularizar.'
          : `${gramos(d.gramosComprados)} de proveedores, cada lote con su origen identificado.`
        : `Dentro de los ${gramos(esperado ?? 0)} que las plantas en floración pueden dar.`
    biomasa = { clave: 'biomasa', titulo: 'Biomasa', valor: biomasaTotal, unidad: 'g',
      habilita: null, estado: 'cierra', nota, comoSeArregla: null }
  }
  // ── 4 · lo que costó producirla, pagado Y debido ────────────────────────────
  const costoTotal = d.costosOperativos + Math.max(0, d.deudaConProveedores)
  const costos: Eslabon = costoTotal > 0
    ? { clave: 'costos', titulo: 'Costos operativos', valor: costoTotal, unidad: '$',
        habilita: costoTotal, estado: 'cierra',
        nota: d.deudaConProveedores > 0
          ? `${pesos(d.costosOperativos)} asentados en la caja, más ${pesos(d.deudaConProveedores)} que se le deben a proveedores.`
          : `${pesos(d.costosOperativos)} asentados en el Libro Diario de Caja.`,
        comoSeArregla: null }
    : { clave: 'costos', titulo: 'Costos operativos', valor: 0, unidad: '$',
        habilita: null, estado: 'sin_datos',
        nota: 'Sin costos asentados no se puede saber qué habría que reembolsar.',
        comoSeArregla: 'Asentar los egresos en el Libro Diario de Caja.' }

  // ── 5 · lo que los socios reembolsaron de ese costo ─────────────────────────
  let reembolso: Eslabon
  if (costoTotal <= 0) {
    reembolso = { clave: 'reembolso', titulo: 'Reembolso de los socios',
      valor: d.ingresosDeReembolso, unidad: '$', habilita: null, estado: 'sin_datos',
      nota: 'Sin costos cargados no hay contra qué medirlo.',
      comoSeArregla: 'Asentar los egresos para poder cruzarlos contra lo que entró.' }
  } else {
    // Contra el costo TOTAL, no contra lo que salió de la caja: si no, una
    // compra grande sin pagar hace que el reembolso parezca de sobra.
    const dif = d.ingresosDeReembolso - costoTotal
    const desvio = Math.abs(dif) / costoTotal
    if (desvio <= TOLERANCIA_REEMBOLSO) {
      reembolso = { clave: 'reembolso', titulo: 'Reembolso de los socios',
        valor: d.ingresosDeReembolso, unidad: '$', habilita: null, estado: 'cierra',
        nota: `Parejo con los costos: ${pesos(Math.abs(dif))} de diferencia.`,
        comoSeArregla: null }
    } else if (dif > 0) {
      reembolso = { clave: 'reembolso', titulo: 'Reembolso de los socios',
        valor: d.ingresosDeReembolso, unidad: '$', habilita: null, estado: 'no_cierra',
        nota: `Excedente de ${pesos(dif)} sobre los costos.`,
        comoSeArregla: 'Un reembolso que supera al costo deja de ser reembolso. Hay que poder ' +
          'decir qué es ese excedente —fondo de reserva, inversión pendiente— o bajar el aporte.' }
    } else {
      reembolso = { clave: 'reembolso', titulo: 'Reembolso de los socios',
        valor: d.ingresosDeReembolso, unidad: '$', habilita: null, estado: 'no_cierra',
        nota: `Faltan ${pesos(-dif)} para cubrir los costos.`,
        comoSeArregla: 'Si los socios no cubren el costo, hay que poder decir quién lo está ' +
          'financiando y a cambio de qué. Ojo con la deuda a proveedores: mientras no se ' +
          'pague, la caja se ve mejor de lo que está.' }
    }
  }

  // ── 6 · si el aporte lucra o solo cubre ─────────────────────────────────────
  //
  // El eslabon anterior compara totales de la caja. Este mide otra cosa y por eso
  // vale aparte: cuanto se cobra POR GRAMO contra cuanto cuesta ESE gramo. No
  // depende de como se imputo cada gasto, sale del precio al que entro el lote.
  //
  // El criterio no es un porcentaje inventado. El margen sobre el material es lo
  // unico con que se pagan alquiler, energia y todo lo demas: si ese margen no
  // alcanza a cubrir esos gastos, es aritmeticamente imposible que haya lucro, y
  // eso se puede mostrar sin pedirle a nadie que confie.
  const cpg = d.costoMaterialPorGramo
  const gc = d.gramosCobrados
  const ac = d.aportesCobrados
  const gnm = d.gastosNoMaterial
  let margen: Eslabon
  if (cpg == null || !gc || ac == null || gnm == null) {
    margen = { clave: 'margen', titulo: 'El aporte cubre y no lucra', valor: 0, unidad: '$',
      habilita: null, estado: 'sin_datos',
      nota: 'Falta el costo por gramo de los lotes o la separación de gastos.',
      comoSeArregla: 'Cargá el costo por gramo en los lotes: es lo que permite demostrar que ' +
        'el aporte cubre el costo en vez de superarlo.' }
  } else {
    const aportePorGramo = ac / gc
    const bruto = Math.round((aportePorGramo - cpg) * gc)
    if (bruto <= gnm) {
      margen = { clave: 'margen', titulo: 'El aporte cubre y no lucra', valor: bruto, unidad: '$',
        habilita: null, estado: 'cierra',
        nota: `Se aporta ${pesos(Math.round(aportePorGramo))} por gramo y el material cuesta ` +
          `${pesos(Math.round(cpg))}. Los ${pesos(bruto)} de diferencia no alcanzan a cubrir ` +
          `los ${pesos(gnm)} de gastos, así que no hay excedente que pueda ser lucro.`,
        comoSeArregla: null }
    } else {
      margen = { clave: 'margen', titulo: 'El aporte cubre y no lucra', valor: bruto, unidad: '$',
        habilita: null, estado: 'no_cierra',
        nota: `El margen sobre el material da ${pesos(bruto)} y los gastos son ${pesos(gnm)}: ` +
          `sobran ${pesos(bruto - gnm)}.`,
        comoSeArregla: 'Un excedente sobre el costo hay que poder explicarlo: a qué se destina ' +
          'y por decisión de quién. Si no, deja de ser reembolso de costos.' }
    }
  }

  return [socios, plantas, biomasa, costos, reembolso, margen]
}

/** La cadena cierra sólo si NINGÚN eslabón está roto. Lo que no se sabe, no cierra ni rompe. */
export function laCadenaCierra(eslabones: Eslabon[]): boolean {
  return eslabones.every(e => e.estado === 'cierra')
}
