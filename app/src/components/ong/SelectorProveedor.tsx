// El proveedor se elige de una lista, no se escribe de memoria.
//
// El campo era texto libre y el formulario tenía que pedir «escribilo siempre
// igual» — un pedido que sólo se puede cumplir a fuerza de memoria, sobre un
// campo que se completa meses después de la compra anterior. Como la pantalla de
// Proveedores agrupa por ese texto (`v_saldo_proveedores`), el mismo proveedor
// con dos grafías aparece partido en dos en todos los totales, y el saldo de
// cada mitad está mal.
//
// Ofrecer lo ya usado no es comodidad: es lo que hace que el segundo comprobante
// caiga en el mismo nombre que el primero.
//
// Es el mismo patrón que la genética que falta en el lote: la lista, más una
// opción para cargar uno nuevo SIN salir del formulario. Irse a otra pantalla a
// dar de alta el proveedor tiraría el comprobante a medio cargar, y el final
// previsible es dejarlo vacío y seguir.

import { useState } from 'react'
import { toast } from 'sonner'
import {
  proveedorYaExiste, normalizarProveedor,
  type ProveedorUsado, type RubroProveedor,
} from '../../lib/proveedores'
import { btnPrimario, inputFormulario } from '../../lib/ui'

/** Valor centinela del desplegable. No puede confundirse con un nombre real. */
const NUEVO = '__nuevo_proveedor__'

/**
 * Los grupos del desplegable, y cómo se llaman en la pantalla.
 *
 * La lista mezclaba a quien vende flores con el contador y con la luz. Con
 * quince proveedores todavía se lee; el problema es que quien carga un lote
 * tiene que descartar de a uno los que no le pueden vender material, y quien
 * carga un gasto operativo ve primero a quince productores.
 *
 * Los nombres son los de la vida real, no los de la base: nadie dice
 * «Aprovisionamiento» cuando está cargando una compra.
 */
const GRUPO: Record<'material' | 'insumos' | 'sin_clasificar', string> = {
  material: 'Material que se dispensa',
  insumos: 'Insumos y servicios',
  sin_clasificar: 'Sin clasificar todavía',
}

const grupoDe = (r: RubroProveedor | null) => r ?? 'sin_clasificar'

export function SelectorProveedor({ valor, lista, onCambio, id, prioridad }: {
  /** El proveedor cargado, o null. */
  valor: string | null | undefined
  /** Los que ya se usaron, con su rubro deducido. */
  lista: ProveedorUsado[]
  onCambio: (proveedor: string | null) => void
  /** Para ligar la etiqueta, cuando hay más de uno en la misma pantalla. */
  id?: string
  /**
   * Qué rubro va primero.
   *
   * La pantalla sabe qué se está cargando —un lote es material, un comprobante
   * puede ser cualquier cosa— y ese grupo va arriba. No se OCULTAN los otros:
   * un proveedor nuevo cae en «Sin clasificar» hasta que tenga un comprobante,
   * y esconderlo obligaría a cargarlo de nuevo.
   */
  prioridad?: RubroProveedor
}) {
  // `null` = no se está cargando uno nuevo. `''` = se abrió el campo, vacío.
  const [nuevo, setNuevo] = useState<string | null>(null)

  // Un proveedor que está cargado en la fila pero NO en la lista tiene que
  // seguir viéndose: pasa al editar un comprobante viejo cuyo proveedor se
  // escribió distinto de todos los demás. Sin esto el desplegable lo mostraría
  // como «Sin especificar» y guardarlo lo borraría sin avisar.
  const actual = normalizarProveedor(valor)
  const nombres = lista.map(p => p.nombre)
  const opciones: ProveedorUsado[] = actual && !proveedorYaExiste(actual, nombres)
    ? [...lista, { nombre: actual, rubro: null }]
    : lista

  // El grupo prioritario primero y «Sin clasificar» siempre último: es el cajón
  // de lo que todavía no se sabe, no una tercera categoría de proveedor.
  const orden: ('material' | 'insumos' | 'sin_clasificar')[] =
    prioridad === 'insumos'
      ? ['insumos', 'material', 'sin_clasificar']
      : ['material', 'insumos', 'sin_clasificar']

  const grupos = orden
    .map(g => ({
      g,
      items: opciones
        .filter(p => grupoDe(p.rubro) === g)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    }))
    .filter(x => x.items.length > 0)

  const confirmar = () => {
    const nombre = normalizarProveedor(nuevo)
    if (!nombre) { toast.error('Poné el nombre del proveedor'); return }
    // Si ya existe con otra grafía, se usa la que ya está. Es el momento exacto
    // en que nace el duplicado, y el único en que alguien puede evitarlo sin
    // adivinar después cuál de las dos era.
    const yaEsta = proveedorYaExiste(nombre, opciones.map(p => p.nombre))
    if (yaEsta && yaEsta !== nombre) {
      toast.info(`Ya existe como «${yaEsta}». Se usa ese, así los totales no se parten en dos.`)
      onCambio(yaEsta)
    } else {
      onCambio(nombre)
    }
    setNuevo(null)
  }

  return (
    <>
      <select
        id={id}
        className={inputFormulario}
        value={nuevo != null ? NUEVO : (actual || '')}
        onChange={e => {
          if (e.target.value === NUEVO) { setNuevo(''); return }
          setNuevo(null)
          onCambio(e.target.value || null)
        }}>
        <option value="">Sin especificar</option>
        {/* Un solo grupo no se rotula: un `optgroup` con todo adentro es una
            etiqueta que no separa nada de nada. */}
        {grupos.length === 1
          ? grupos[0].items.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)
          : grupos.map(({ g, items }) => (
            <optgroup key={g} label={GRUPO[g]}>
              {items.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
            </optgroup>
          ))}
        <option value={NUEVO}>➕ Cargar un proveedor nuevo</option>
      </select>

      {nuevo != null && (
        <div className="mt-1.5 flex gap-1.5">
          <input
            className={inputFormulario}
            autoFocus
            value={nuevo}
            placeholder="A quién se le compró"
            onChange={e => setNuevo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmar() } }} />
          <button type="button" className={btnPrimario} onClick={confirmar}>Usar</button>
        </div>
      )}
    </>
  )
}
