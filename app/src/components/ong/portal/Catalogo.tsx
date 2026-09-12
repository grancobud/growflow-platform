// Catálogo terapéutico: las partidas listas para dispensar.
//
// Cada tarjeta muestra tres números distintos y no uno solo, porque "quedan 200 g"
// significa cosas diferentes según dónde esté el material: lo entregado ya no
// está, lo reservado está apartado esperando un retiro, y lo disponible es lo
// único que se puede comprometer hoy.

import { useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { Package, Plus, Pencil, Trash2, FlaskConical, AlertTriangle, X } from 'lucide-react'
import {
  portalService, disponibleDeLote, resumenCatalogo, PRODUCTOS_LOTE,
  ORIGENES_LOTE, origenDeLote, materialSinLotear,
  type Lote, type Pedido, type OrigenLote,
} from '../../../lib/portal'
import { UNIDADES, sufijoUnidad, type Dispensa, type Unidad } from '../../../lib/ong'
import { proximoCodigoDeLote, loteQueUsaElCodigo, codigoBloqueado } from '../../../lib/codigoDeLote'
import { cultivoService } from '../../../lib/cultivo'
import { SelectorProveedor } from '../SelectorProveedor'
import { proveedoresPorRubro, type ConProveedor } from '../../../lib/proveedores'
import { btnPrimario, btnSutil, btnIcono, inputFormulario, tarjeta, etiquetaCampo, sinAutocorreccion } from '../../../lib/ui'
import { AyudaCampo } from '../GuiaDelFormulario'
import { useDialogo } from '../../../lib/useDialogo'
import { useAbrirAlLlegar } from '../../../lib/useAbrirAlLlegar'
import { useAvanzarFlujo } from '../../../lib/useAvanzarFlujo'
import { confirmarBorrado } from '../../../lib/confirmar'

/**
 * El valor que marca «crear una» en el desplegable de genética.
 *
 * Lleva un prefijo que no puede ser un uuid: si fuera algo como `nueva` y
 * alguna vez un id se le pareciera, elegir esa genética abriría el formulario
 * de alta en vez de seleccionarla.
 */
const NUEVA_GENETICA = '__nueva_genetica__'


interface Genetica { id: string; nombre: string }

export function Catalogo({ lotes, pedidos, dispensas = [], geneticas, gramosCosechados = 0, documentos = [], onCambio }: {
  lotes: Lote[]
  pedidos: Pedido[]
  /**
   * Lo entregado por mostrador. Sin esto el catálogo sólo descontaba reservas
   * del portal y mostraba como disponible material que ya no estaba: una
   * instalación que dispensa sin usar reservas veía el lote entero intacto.
   */
  dispensas?: Dispensa[]
  geneticas: Genetica[]
  /**
   * Lo cosechado, para avisar cuando ese material todavía no es un lote.
   *
   * Ver `materialSinLotear`: el paso cosecha → lote no existía en ninguna
   * pantalla, así que quien cosechaba no encontraba después nada para entregar.
   */
  gramosCosechados?: number
  /** Sólo por su proveedor: la lista se comparte con el comprobante de gasto. */
  documentos?: ConProveedor[]
  onCambio: () => void
}) {
  const [editando, setEditando] = useState<Partial<Lote> | null>(null)
  const [soloActivos, setSoloActivos] = useState(true)

  // El paso «El lote con ese material» de «Comprarle a un proveedor» abre este
  // formulario al llegar.
  //
  // Es el paso que más se saltea de todo el sistema, y el que peor se paga: sin
  // lote figura la plata y no figura la mercadería, y el faltante recién aparece
  // semanas después en el balance de materia, cuando ya nadie lo relaciona con
  // aquella compra. Dejar en la solapa correcta y que hubiera que encontrar el
  // botón era la mitad del problema que la guía venía a resolver.
  //
  // `origen: 'comprado'` porque a esta pantalla se llega comprando. El material
  // propio entra por una cosecha, no por acá.
  //
  // El código viene puesto: es la clave con la que la dispensa engancha al lote
  // —`ong_dispensas` guarda `lote_codigo`, no `lote_id`— así que dejarlo a que
  // cada uno invente el formato es dejar la traza al azar. Se sugiere y se puede
  // corregir; lo que no se puede es repetir.
  const nuevoLote = useCallback(
    () => setEditando({ origen: 'comprado', codigo: proximoCodigoDeLote(lotes.map(l => l.codigo)) }),
    [setEditando, lotes])
  useAbrirAlLlegar(nuevoLote, 'lote', editando != null)

  /**
   * Lo cosechado que todavía no está en ningún lote.
   *
   * Es el paso que faltaba del circuito cosecha → lote → dispensa. Sin lote el
   * material existe en Cultivo y no existe para entregar: la dispensa engancha
   * por `lote_codigo`, así que el desplegable de lote no tiene qué ofrecer.
   */
  const sinLotear = materialSinLotear(gramosCosechados, lotes)

  /**
   * `origen: 'propio'` es lo que evita contarlo dos veces: el ingreso ya lo
   * aportan las cosechas, así que un lote propio no vuelve a sumar. Poner acá
   * «comprado» —o `propio_sin_cosecha`— duplicaría el material.
   */
  const loteDeCosecha = () => setEditando({
    origen: 'propio',
    gramos_totales: sinLotear,
    codigo: proximoCodigoDeLote(lotes.map(l => l.codigo)),
  })
  const avanzar = useAvanzarFlujo()

  const r = resumenCatalogo(lotes, pedidos, dispensas)
  /**
   * EL CATALOGO MUESTRA LO QUE HAY, no todo lo que existio.
   *
   * Antes el filtro miraba SOLO el interruptor `activo`, asi que un lote
   * agotado seguia en la lista con «disponible 0» hasta que alguien se acordara
   * de desactivarlo a mano. Como nadie se acuerda, la lista se llena de lotes
   * vacios y el que si tiene material se pierde entre ellos: el 28/08/2026
   * habia seis lotes en el catalogo de la asociación y solo cuatro con algo adentro.
   *
   * Ahora tambien se van los que quedaron en cero. El interruptor sigue
   * mandando —desactivar retira un lote aunque le quede material— y destildarlo
   * muestra todo, que es como se revisa el historial.
   */
  const visibles = soloActivos
    ? lotes.filter(l => l.activo !== false
        && disponibleDeLote(l, pedidos, dispensas).disponible > 0)
    : lotes

  const borrar = async (l: Lote) => {
    const conPedidos = pedidos.filter(p => p.lote_id === l.id).length
    if (conPedidos > 0) {
      toast.error(`El lote ${l.codigo} tiene ${conPedidos} reserva(s) asociada(s). Desactivalo en vez de borrarlo, así el historial no pierde el origen del material.`)
      return
    }
    if (!await confirmarBorrado(`¿Borrar el lote ${l.codigo}?`)) return
    try { await portalService.borrarLote(l.id); toast.success('Lote borrado'); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="space-y-3">
      {/* EL PASO QUE FALTABA DEL CIRCUITO.
          De la asociación cargaron quince cosechas el 27/08/2026 y después no
          encontraban nada para dispensar. No fallaba nada: una entrega engancha
          por `lote_codigo`, y ese material nunca había llegado a ser un lote.
          El alta de lote existía —acá mismo— pero nada decía que hubiera que
          pasar por ella, y venía marcada «comprado» porque a esta pantalla se
          llegaba comprando. */}
      {sinLotear > 0 && (
        <div className={`${tarjeta} border-[#1d3a5a] bg-[#38bdf8]/[0.06]`}>
          <p className="font-display font-semibold text-[13px] text-[#7dd3fc]">
            Cosechaste {Math.round(sinLotear).toLocaleString('es-AR')} g que todavía no son un lote
          </p>
          <p className="text-[11px] text-[#a6a6b5] leading-relaxed mt-1">
            Para poder entregar ese material hace falta cargarlo como lote: la entrega se anota
            contra un <b className="text-[#c9cabf]">código de lote</b>, así que mientras no exista
            no aparece en el desplegable al anotar una dispensa.
          </p>
          <button type="button" onClick={loteDeCosecha}
            className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[12px] font-medium text-[#d9f99d]">
            <Plus className="w-3.5 h-3.5" /> Cargar el lote de la cosecha
          </button>
        </div>
      )}
      <div className={tarjeta}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} />
            <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Catálogo terapéutico</h3>
          </div>
          <button onClick={() => setEditando({ producto: 'flor', activo: true })} className={btnPrimario}>
            <Plus className="w-3.5 h-3.5" /> Lote
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {[
            { l: 'Lotes activos', v: String(r.lotes) },
            { l: 'Disponible', v: `${Math.round(r.disponible)} g`, c: '#a3e635' },
            { l: 'Reservado', v: `${Math.round(r.reservado)} g`, c: '#a78bfa' },
            { l: 'Entregado', v: `${Math.round(r.entregado)} g` },
            ...(r.otrasUnidades > 0
              ? [{ l: 'Otras unidades', v: `${r.otrasUnidades} lote${r.otrasUnidades === 1 ? '' : 's'}`, c: '#8a8a9c' }]
              : []),
            { l: 'Vale en stock', v: `$${Math.round(r.enStock).toLocaleString('es-AR')}`, c: '#38bdf8' },
            { l: 'Invertido', v: `$${Math.round(r.invertido).toLocaleString('es-AR')}`, c: '#8a8a9c' },
          ].map(k => (
            <div key={k.l} className="rounded-lg bg-[#15151d] border border-[#1f1f2b] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">{k.l}</p>
              <p className="font-display font-semibold text-[17px] mt-0.5" style={{ color: k.c ?? '#ececf1' }}>{k.v}</p>
            </div>
          ))}
        </div>
        {r.sinCosto > 0 && (
          <p className="text-[10px] text-[#8a8a9c] mt-2">
            {r.sinCosto} lote{r.sinCosto === 1 ? '' : 's'} sin costo cargado: no
            entran a esos dos totales.
          </p>
        )}

        {r.sinAnalisis > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/30 px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-[#fbbf24] mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-[#d4d4dd] leading-snug">
              {r.sinAnalisis} lote{r.sinAnalisis === 1 ? '' : 's'} sin informe cromatográfico cargado.
              La Resolución 1780 pide un análisis por cada lote producido.
            </p>
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-[11px] text-[#a6a6b5] px-1 min-h-[44px] sm:min-h-0">
        <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)}
          className="w-4 h-4 accent-[#a3e635]" />
        Mostrar sólo lo que tiene material
      </label>

      {visibles.length === 0 ? (
        <div className={`${tarjeta} text-center py-8`}>
          <Package className="w-7 h-7 text-[#2a2a3a] mx-auto" strokeWidth={1.5} />
          {/* NO ES LO MISMO no tener lotes que tenerlos todos agotados, y desde
              que la lista esconde los vacios los dos casos llegan acá. Decir
              «todavía no hay lotes cargados» cuando hay veinte agotados manda a
              cargar de cero a alguien que en realidad tiene que reponer. */}
          <p className="text-[12px] text-[#8a8a9c] mt-2 max-w-md mx-auto leading-relaxed">
            {lotes.length === 0
              ? 'Todavía no hay lotes cargados. Un lote es una partida ya fraccionada y lista para dispensar; es lo que el paciente ve en el portal y lo que después figura en el comprobante.'
              : `Los ${lotes.length} lotes cargados están agotados o retirados: no queda material para entregar. Cuando entre material nuevo, cargalo como lote.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {visibles.map(l => {
            const d = disponibleDeLote(l, pedidos, dispensas)
            const pct = d.totales > 0 ? (d.disponible / d.totales) * 100 : 0
            const gen = geneticas.find(g => g.id === l.genetica_id)
            return (
              <div key={l.id} className={tarjeta}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-[13px] text-[#ececf1]">{l.codigo}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#15151d] border border-[#2a2a3a] text-[#a6a6b5]">
                        {l.producto}
                      </span>
                      {l.activo === false && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#15151d] text-[#8a8a9c]">inactivo</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#8a8a9c] mt-1">
                      {gen?.nombre ?? 'sin genética asignada'}
                      {l.fecha_elaboracion ? ` · elaborado ${l.fecha_elaboracion}` : ''}
                    </p>
                  </div>
                  <button onClick={() => setEditando(l)} className={btnIcono} title="Editar" aria-label="Editar lote">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => borrar(l)} className={`${btnIcono} hover:text-[#ff8a7a]`} title="Borrar" aria-label="Borrar lote">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-3">
                  <div className="flex items-end justify-between gap-2">
                    <p className="font-display font-semibold text-[20px] text-[#a3e635] leading-none">
                      {Math.round(d.disponible)} <span className="text-[12px] text-[#8a8a9c] font-normal">{d.sufijo} disponibles</span>
                    </p>
                    <p className="text-[10px] text-[#8a8a9c]">de {Math.round(d.totales)} {d.sufijo}</p>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[#15151d] overflow-hidden flex">
                    <div className="bg-[#a3e635]" style={{ width: `${pct}%` }} />
                    <div className="bg-[#a78bfa]" style={{ width: `${d.totales > 0 ? (d.reservado / d.totales) * 100 : 0}%` }} />
                  </div>
                  <p className="text-[10px] text-[#8a8a9c] mt-1.5">
                    {Math.round(d.reservado)} {d.sufijo} reservados · {Math.round(d.entregado)} {d.sufijo} entregados
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-[#1f1f2b] flex items-center gap-3 flex-wrap text-[11px]">
                  {l.fecha_analisis ? (
                    <span className="inline-flex items-center gap-1 text-[#a6a6b5]">
                      <FlaskConical className="w-3 h-3 text-[#a3e635]" />
                      THC {l.thc_pct ?? '—'}% · CBD {l.cbd_pct ?? '—'}%
                      {l.laboratorio ? ` · ${l.laboratorio}` : ''}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[#fbbf24]">
                      <AlertTriangle className="w-3 h-3" /> sin análisis de lote
                    </span>
                  )}
                  <span className="text-[#8a8a9c] ml-auto">
                    {origenDeLote(l) === 'comprado'
                      ? `comprado${l.proveedor ? ` · ${l.proveedor}` : ''}`
                      : 'cultivo propio'}
                    {' · '}
                    {l.aporte_por_gramo
                      ? `$${Number(l.aporte_por_gramo).toLocaleString('es-AR')}/${d.sufijo}`
                      : 'sin aporte cargado'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editando && (
        <ModalLote lote={editando} geneticas={geneticas}
          lotes={lotes} pedidos={pedidos} dispensas={dispensas} documentos={documentos}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            onCambio()
            // Si esto era un paso de «Comprarle a un proveedor», el que sigue es
            // el pago. Fuera de un flujo no hace nada y queda como estaba.
            avanzar()
          }} />
      )}
    </div>
  )
}

function ModalLote({ lote, geneticas, lotes, pedidos, dispensas, documentos, onCerrar, onGuardado }: {
  lote: Partial<Lote>
  geneticas: Genetica[]
  lotes: Lote[]
  pedidos: Pedido[]
  dispensas: Dispensa[]
  /**
   * Los comprobantes, SÓLO por su proveedor: la lista tiene que ser la misma
   * que la del comprobante de gasto. Ver `lib/proveedores.ts`.
   */
  documentos: ConProveedor[]
  onCerrar: () => void
  onGuardado: () => void
}) {
  const refDialogo = useDialogo(onCerrar)
  const [f, setF] = useState<Partial<Lote>>(lote)
  const [guardando, setGuardando] = useState(false)
  const set = (k: keyof Lote, v: unknown) => setF(x => ({ ...x, [k]: v }))

  // Las genéticas se guardan en estado propio: cuando se crea una desde acá
  // aparece en el desplegable sin recargar la pantalla ni cerrar el lote.
  const [gens, setGens] = useState<Genetica[]>(geneticas)
  const [nombreGen, setNombreGen] = useState<string | null>(null)
  const [creandoGen, setCreandoGen] = useState(false)

  // ⚠ Se mira el lote ORIGINAL, no `f`: si mirara lo editado, cambiar el código
  // en pantalla haría que el bloqueo se evaluara contra el valor nuevo y se
  // soltara solo.
  const bloqueado = codigoBloqueado(lote, pedidos, dispensas)

  // Los proveedores ya usados, de las DOS fuentes, con su rubro deducido.
  // Ver `lib/proveedores.ts`.
  const proveedores = useMemo(
    () => proveedoresPorRubro({ lotes, documentos }), [lotes, documentos])

  /**
   * La genética que falta se crea acá mismo, pidiendo sólo el nombre.
   *
   * La ficha completa tiene ~20 campos y vive en otra pantalla: mandar a
   * llenarla en el medio de cargar un lote tira el lote a medio cargar. Lo único
   * que se sabe seguro en este momento es cómo se llama; el resto se completa
   * después en Cultivo › Genéticas.
   */
  const crearGenetica = async () => {
    const nombre = (nombreGen ?? '').trim()
    if (!nombre) { toast.error('Poné el nombre de la genética'); return }
    if (gens.some(g => g.nombre.trim().toLowerCase() === nombre.toLowerCase())) {
      toast.error(`Ya existe una genética que se llama ${nombre}`); return
    }
    setCreandoGen(true)
    try {
      const g = await cultivoService.crearGenetica({ nombre })
      setGens(xs => [...xs, { id: g.id, nombre: g.nombre }].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      set('genetica_id', g.id)
      setNombreGen(null)
      toast.success(`Genética ${nombre} creada`)
    } catch (e) { toast.error((e as Error).message) }
    finally { setCreandoGen(false) }
  }

  // El margen se muestra sólo cuando los dos números están: con uno solo sería
  // el aporte disfrazado de margen.
  const nOrNull = (v: unknown) =>
    v != null && String(v).trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null
  const cAporte = nOrNull(f.aporte_por_gramo)
  const cCosto = nOrNull(f.costo_por_gramo)
  const margen = cAporte != null && cCosto != null ? cAporte - cCosto : null

  const guardar = async () => {
    if (!f.codigo?.trim()) { toast.error('El lote necesita un código'); return }
    // Un código repetido NO se guarda, y acá es más estricto que el número de
    // orden de servicio a propósito: allá el número es una etiqueta, acá es la
    // clave con la que la dispensa encuentra su lote. Repetirlo descuenta stock
    // del lote equivocado y ensucia el recibo, sin que nada falle.
    const otro = loteQueUsaElCodigo(f.codigo, lotes, f.id)
    if (otro) {
      toast.error(`El código ${otro.codigo} ya lo usa otro lote. El código es lo que liga la entrega al material, así que no puede repetirse.`)
      return
    }
    if (!(Number(f.gramos_totales) > 0)) { toast.error('Poné cuántos gramos tiene el lote'); return }
    setGuardando(true)
    try {
      await portalService.guardarLote({
        ...f,
        codigo: f.codigo.trim(),
        gramos_totales: Number(f.gramos_totales),
        thc_pct: f.thc_pct != null && f.thc_pct !== ('' as unknown) ? Number(f.thc_pct) : null,
        cbd_pct: f.cbd_pct != null && f.cbd_pct !== ('' as unknown) ? Number(f.cbd_pct) : null,
        aporte_por_gramo: f.aporte_por_gramo ? Number(f.aporte_por_gramo) : null,
        // `origen` va explícito y no se deja al default de la columna: el
        // default lo pone Postgres y el dev local corre en modo demo contra
        // localStorage, donde no hay defaults.
        origen: (f.origen as OrigenLote | undefined) ?? 'comprado',
        unidad: (f.unidad as Unidad | undefined) ?? 'g',
        // Vacío es "no lo sé", no cero. Un cero acá inventa margen del 100 %.
        costo_por_gramo: f.costo_por_gramo != null && String(f.costo_por_gramo).trim() !== ''
          ? Number(f.costo_por_gramo) : null,
        proveedor: f.proveedor?.trim() ? f.proveedor.trim() : null,
      })
      toast.success(f.id ? 'Lote actualizado' : 'Lote creado')
      onGuardado()
    } catch (e) { toast.error((e as Error).message) }
    finally { setGuardando(false) }
  }

  return (
    <div ref={refDialogo} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onCerrar}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#1f1f2b] flex items-center gap-2">
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
            {f.id ? `Lote ${f.codigo}` : 'Nuevo lote'}
          </h3>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="ml-auto min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label><span className={etiquetaCampo}>Código</span>
              <input className={inputFormulario} {...sinAutocorreccion} value={f.codigo ?? ''} placeholder="LOTE-001"
                readOnly={bloqueado} aria-readonly={bloqueado}
                onChange={e => set('codigo', e.target.value)} />
              {bloqueado
                ? <p className="mt-1 text-[10px] leading-snug text-[#c9a227]">
                    Este lote ya tiene movimientos, así que el código no se toca: las entregas
                    lo encuentran por el código, y cambiarlo las dejaría apuntando a la nada.
                  </p>
                : <AyudaCampo id="lote" campo="Código" />}</label>
            <label><span className={etiquetaCampo}>Producto</span>
              <select className={inputFormulario} value={f.producto ?? 'flor'} onChange={e => set('producto', e.target.value)}>
                {PRODUCTOS_LOTE.map(p => <option key={p} value={p}>{p}</option>)}
              </select></label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label><span className={etiquetaCampo}>Cantidad total</span>
              <input className={inputFormulario} type="number" inputMode="decimal" value={f.gramos_totales ?? ''}
                onChange={e => set('gramos_totales', e.target.value)} /></label>
            <label><span className={etiquetaCampo}>Aporte por {sufijoUnidad(f.unidad)} ($)</span>
              <input className={inputFormulario} type="number" inputMode="decimal" value={f.aporte_por_gramo ?? ''}
                onChange={e => set('aporte_por_gramo', e.target.value)} /></label>
          </div>

          {/* A1: de dónde salió el material y qué costó. Sin esto el margen por
              lote no lo calcula nadie cuando el material se compra: Econometría
              deriva el costo de los insumos del ciclo, y una partida comprada no
              tiene ciclo. */}
          {/* A3: la unidad. Sin esto el aceite se cuenta en "gramos" y el balance
              de materia suma frascos con flor. Sólo lo que está en gramos entra
              al balance y a los totales del catálogo. */}
          <label className="block"><span className={etiquetaCampo}>Se mide en</span>
            <select className={inputFormulario} value={(f.unidad as string) ?? 'g'}
              onChange={e => set('unidad', e.target.value)}>
              {UNIDADES.map(u => <option key={u.valor} value={u.valor}>{u.label}</option>)}
            </select>
            <span className="block mt-1 text-[10px] text-[#8a8a9c]">
              Gramos para flor. Unidades para aceite, papeles o accesorios: eso no
              entra al balance de materia vegetal.
            </span></label>

          <div className="grid grid-cols-2 gap-3">
            <label><span className={etiquetaCampo}>Origen</span>
              <select className={inputFormulario} value={(f.origen as string) ?? 'comprado'}
                onChange={e => set('origen', e.target.value)}>
                {ORIGENES_LOTE.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
              </select></label>
            <label><span className={etiquetaCampo}>Costo por {sufijoUnidad(f.unidad)} ($)</span>
              <input className={inputFormulario} type="number" inputMode="decimal"
                placeholder="dejalo vacío si no lo sabés"
                value={f.costo_por_gramo ?? ''}
                onChange={e => set('costo_por_gramo', e.target.value)} /></label>
          </div>

          {(f.origen ?? 'comprado') === 'comprado' && (
            <div className="block"><span className={etiquetaCampo}>Proveedor</span>
              {/* Un lote SIEMPRE se le compra a alguien que vende material:
                  ese grupo va primero. */}
              <SelectorProveedor valor={f.proveedor} lista={proveedores}
                prioridad="material"
                onCambio={p => set('proveedor', p)} /></div>
          )}

          {margen != null && (
            <p className="text-[11px] text-[#8a8a9c] -mt-1">
              Margen por gramo:{' '}
              <span className={margen >= 0 ? 'text-[#a3e635]' : 'text-[#ff8a7a]'}>
                ${margen.toLocaleString('es-AR')}
              </span>{' '}
              — aporte menos costo. Si da negativo, el aporte no cubre lo que costó el material.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label><span className={etiquetaCampo}>Genética</span>
              <select className={inputFormulario}
                value={nombreGen != null ? NUEVA_GENETICA : (f.genetica_id ?? '')}
                onChange={e => {
                  if (e.target.value === NUEVA_GENETICA) { setNombreGen(''); return }
                  setNombreGen(null)
                  set('genetica_id', e.target.value || null)
                }}>
                <option value="">Sin asignar</option>
                {gens.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                <option value={NUEVA_GENETICA}>➕ Crear una genética nueva</option>
              </select>
              {nombreGen != null && (
                <div className="mt-1.5 flex gap-1.5">
                  <input className={inputFormulario} autoFocus value={nombreGen}
                    placeholder="Cómo se llama"
                    onChange={e => setNombreGen(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); crearGenetica() } }} />
                  <button type="button" className={btnPrimario} disabled={creandoGen}
                    onClick={crearGenetica}>{creandoGen ? '…' : 'Crear'}</button>
                </div>
              )}</label>
            <label><span className={etiquetaCampo}>Fecha de elaboración</span>
              <input className={inputFormulario} type="date" value={f.fecha_elaboracion ?? ''}
                onChange={e => set('fecha_elaboracion', e.target.value || null)} /></label>
          </div>

          <div className="pt-2 border-t border-[#1f1f2b]">
            <p className="text-[11px] text-[#8a8a9c] mb-2">
              Informe cromatográfico. La 1780 lo pide por lote producido; los valores de la ficha de
              la genética son estimados y no lo reemplazan.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label><span className={etiquetaCampo}>THC %</span>
                <input className={inputFormulario} type="number" inputMode="decimal" value={f.thc_pct ?? ''}
                  onChange={e => set('thc_pct', e.target.value)} /></label>
              <label><span className={etiquetaCampo}>CBD %</span>
                <input className={inputFormulario} type="number" inputMode="decimal" value={f.cbd_pct ?? ''}
                  onChange={e => set('cbd_pct', e.target.value)} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <label><span className={etiquetaCampo}>Laboratorio</span>
                <input className={inputFormulario} value={f.laboratorio ?? ''}
                  onChange={e => set('laboratorio', e.target.value)} /></label>
              <label><span className={etiquetaCampo}>Fecha del análisis</span>
                <input className={inputFormulario} type="date" value={f.fecha_analisis ?? ''}
                  onChange={e => set('fecha_analisis', e.target.value || null)} /></label>
            </div>
          </div>

          <label><span className={etiquetaCampo}>Notas</span>
            <input className={inputFormulario} value={f.notas ?? ''} onChange={e => set('notas', e.target.value)} /></label>

          <label className="flex items-center gap-2 text-[12px] text-[#a6a6b5] pt-1 min-h-[44px] sm:min-h-0">
            <input type="checkbox" checked={f.activo !== false} onChange={e => set('activo', e.target.checked)}
              className="w-4 h-4 accent-[#a3e635]" />
            Activo (aparece en el catálogo para reservar)
          </label>
        </div>

        <div className="px-4 py-3 border-t border-[#1f1f2b] flex gap-2">
          <button onClick={onCerrar} className={btnSutil}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className={`${btnPrimario} flex-1`}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
