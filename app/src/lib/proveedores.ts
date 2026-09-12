// La lista de proveedores, sacada de lo que ya se cargó.
//
// No hay tabla de proveedores del lado ONG: el proveedor es una columna de texto
// en `ong_documentos` y en `ong_lotes`, y la pantalla de Proveedores —vía
// `v_saldo_proveedores`— agrupa por ese texto. O sea que el nombre ES la clave,
// igual que el código de lote.
//
// Y por eso el formulario tenía que pedir «escribilo siempre igual»: un pedido
// que sólo se puede cumplir a fuerza de memoria, sobre un campo que se completa
// meses después. El mismo proveedor escrito de dos formas se parte en dos en
// todos los totales, y de ahí salió el cruce `beneficiarios_grafia`.
//
// Ofrecer lo que ya existe no es una comodidad: es lo que hace que el segundo
// comprobante del mismo proveedor caiga en el mismo nombre que el primero.
//
// ⚠ No inventa un maestro de proveedores. Un proveedor «existe» porque alguien
// lo usó, que es exactamente lo que la base ya dice hoy. Si algún día hacen
// falta CUIT, contacto o condiciones de pago, eso sí es una tabla y es otro
// proyecto.

/** Cualquier fila que nombre un proveedor. */
export interface ConProveedor {
  proveedor?: string | null
}

/** Un comprobante: nombra un proveedor y dice en qué categoría entró el gasto. */
export interface ComprobanteConProveedor extends ConProveedor {
  categoria?: string | null
}

/**
 * A qué se le compra.
 *
 * `material` es de quien se compra LO QUE SE DISPENSA: lo que entra a un lote.
 * `insumos` es todo lo demás que se paga — sustrato, nutrientes, energía,
 * honorarios, retribuciones.
 *
 * ⚠ La línea no es «producto vs. servicio», y por eso el segundo no se llama
 * `servicio`: el sustrato es un producto y no es material dispensable. Lo que
 * separa a los dos grupos es si ese proveedor puede aparecer en un lote.
 *
 * `null` es no saberlo, y se dice `null` en vez de meterlo en uno de los dos:
 * un proveedor recién cargado todavía no tiene de dónde deducirlo, y
 * adivinarle un rubro lo esconde del grupo donde lo van a buscar.
 */
export type RubroProveedor = 'material' | 'insumos'

export interface ProveedorUsado {
  nombre: string
  rubro: RubroProveedor | null
}

/**
 * La categoría con la que se cargan las compras de material dispensable.
 *
 * ⚠ HAY DOS VOCABULARIOS DE CATEGORIA EN LA MISMA COLUMNA.
 *
 * El desplegable del formulario ofrece `CATEGORIAS_GASTO` («Nutrientes»,
 * «Sustrato», «Energía», «Honorarios»…), y ninguna de esas es material
 * dispensable: son los insumos y los gastos de la operación. «Aprovisionamiento»
 * NO está en esa lista — entró por el importador de la planilla, y es la que
 * marca la compra del material que después se dispensa.
 *
 * O sea que las dos señales de `material` cubren cosas distintas y las dos
 * hacen falta: el lote, y esta categoría para el proveedor al que todavía no se
 * le cargó ningún lote.
 *
 * Se compara sin acentos y sin caso porque el valor viene de un importador y no
 * de un `check` de la base.
 */
const CATEGORIA_MATERIAL = 'aprovisionamiento'

const sinAcentos = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * «N/A» no es un proveedor: es el marcador de «no aplica» de los gastos
 * operativos.
 *
 * En la base de la asociación hay 299 comprobantes con ese valor, y hasta ahora el
 * desplegable lo ofrecía como si fuera alguien a quien se le compra. Elegirlo
 * no rompe nada —la columna es texto— pero mete una fila fantasma en el saldo
 * de proveedores, que agrupa por ese mismo texto.
 *
 * Es el mismo criterio que ya usa el cruce `beneficiarios_grafia`, que también
 * lo ignora. Se listan las formas que aparecen y no un patrón amplio: «NA» a
 * secas puede ser un nombre real.
 */
const NO_APLICA = new Set(['n/a', 'n.a.', 'na/', 'no aplica', 'sin proveedor'])

export const esNoAplica = (nombre: string | null | undefined): boolean =>
  NO_APLICA.has(sinAcentos(String(nombre ?? '').trim()))

/** Igual que lo compara una persona: sin espacios de más y sin importar el caso. */
export const normalizarProveedor = (p: string | null | undefined): string =>
  String(p ?? '').trim().replace(/\s+/g, ' ')

const clave = (p: string | null | undefined): string =>
  normalizarProveedor(p).toLowerCase()

/**
 * Los proveedores ya usados, ordenados alfabéticamente y sin repetir.
 *
 * Recibe varias fuentes porque el mismo proveedor aparece en los comprobantes y
 * en los lotes, y una lista que mire sólo una de las dos vuelve a ofrecer un
 * nombre distinto según desde qué formulario se cargue — que es el problema que
 * esto viene a resolver.
 *
 * ⚠ Cuando el mismo nombre está escrito de dos formas —`Pinito` y `PINITO`—
 * gana **la más usada**, no la primera ni la última. La grafía que más veces se
 * eligió es la que la asociación reconoce; ofrecer la otra empujaría a seguir
 * partiendo los totales. Las dos siguen existiendo en sus filas: esto elige qué
 * OFRECER, no reescribe nada.
 */
export function listaDeProveedores(...fuentes: ConProveedor[][]): string[] {
  const cuenta = new Map<string, Map<string, number>>()
  for (const filas of fuentes) {
    for (const f of filas) {
      const nombre = normalizarProveedor(f.proveedor)
      if (!nombre || esNoAplica(nombre)) continue
      const k = clave(nombre)
      const grafias = cuenta.get(k) ?? new Map<string, number>()
      grafias.set(nombre, (grafias.get(nombre) ?? 0) + 1)
      cuenta.set(k, grafias)
    }
  }
  const elegidas: string[] = []
  for (const grafias of cuenta.values()) {
    let mejor = ''
    let max = -1
    for (const [nombre, n] of grafias) {
      // A igual uso gana la alfabéticamente menor: sin desempate explícito el
      // orden dependería del de inserción y la lista se movería sola.
      if (n > max || (n === max && nombre.localeCompare(mejor) < 0)) { mejor = nombre; max = n }
    }
    elegidas.push(mejor)
  }
  return elegidas.sort((a, b) => a.localeCompare(b, 'es'))
}

/**
 * Si ese nombre ya está en la lista, sin importar cómo esté escrito.
 *
 * Sirve para avisar antes de crear «PINITO» cuando ya existe «Pinito»: es el
 * momento exacto en que se produce el duplicado, y el único en que alguien puede
 * decidir sin adivinar.
 */
export function proveedorYaExiste(nombre: string, lista: string[]): string | undefined {
  const k = clave(nombre)
  if (!k) return undefined
  return lista.find(p => clave(p) === k)
}

/**
 * Los proveedores ya usados, cada uno con su rubro.
 *
 * EL RUBRO NO SE GUARDA: SE DEDUCE DE DÓNDE APARECE
 *
 * No hay tabla de proveedores, así que no hay dónde poner una columna `rubro`
 * —y agregarla sería inventar el maestro que este módulo evita a propósito—.
 * Pero el dato ya está: a quién se le compra material se sabe porque su nombre
 * está en un lote o en un comprobante de Aprovisionamiento.
 *
 * Contra los datos reales de la asociación las dos señales coinciden exactamente: los
 * once proveedores que tienen lote son los once que tienen comprobantes de
 * Aprovisionamiento, ninguno mezclado. Los otros cuatro de Aprovisionamiento
 * todavía no tienen lote cargado, y por eso la señal del lote sola no alcanza.
 *
 * ⚠ `material` gana sobre `insumos` cuando aparecen las dos. A un proveedor de
 * material se le puede pagar además un flete o un análisis: sigue siendo de
 * quien se compra el material, que es como lo busca quien carga un lote.
 */
export function proveedoresPorRubro(fuentes: {
  lotes?: ConProveedor[]
  documentos?: ComprobanteConProveedor[]
}): ProveedorUsado[] {
  const lotes = fuentes.lotes ?? []
  const documentos = fuentes.documentos ?? []

  // La grafía canónica sale del mismo lugar de siempre —la más usada— para que
  // el nombre que se ofrece acá sea idéntico al que agrupa `v_saldo_proveedores`.
  const nombres = listaDeProveedores(lotes, documentos)

  const material = new Set<string>()
  const insumos = new Set<string>()

  for (const l of lotes) {
    const k = clave(l.proveedor)
    if (k) material.add(k)
  }
  for (const d of documentos) {
    const k = clave(d.proveedor)
    if (!k) continue
    const cat = sinAcentos(String(d.categoria ?? '').trim())
    // Sin categoría no se deduce nada. Un comprobante sin clasificar no dice si
    // lo que se compró entra al stock o no.
    if (!cat) continue
    if (cat === CATEGORIA_MATERIAL) material.add(k)
    else insumos.add(k)
  }

  return nombres.map(nombre => {
    const k = clave(nombre)
    const rubro: RubroProveedor | null =
      material.has(k) ? 'material' : insumos.has(k) ? 'insumos' : null
    return { nombre, rubro }
  })
}
