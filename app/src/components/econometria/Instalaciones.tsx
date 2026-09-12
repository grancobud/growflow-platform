// Econometria › Instalaciones e Insumos. Catalogo de equipos/insumos por sistema
// (Riego, CO2, Automatizacion, ...), proveedores reusables y presupuestos
// versionados. Misma logica que el creador de fertilizantes: catalogo + proveedor
// + armar presupuesto con snapshot de precio.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Plus, X, Loader2, Trash2, Pencil, Boxes, Truck, FileText, ChevronLeft,
  ExternalLink, Package, Printer, BarChart3, Tag, Star, ImagePlus,
} from 'lucide-react'
import {
  instalacionesService, SISTEMAS, UNIDADES_INST, porSistema, totalLinea,
  totalPresupuesto, totalesPorSistema,
  type ItemInstalacion, type ProveedorInstalacion, type Presupuesto, type PresupuestoItem,
  type OfertaInstalacion,
} from '../../lib/instalaciones'
import { useDesbordeHorizontal } from '../../lib/useDesbordeHorizontal'
import { btnPrimario, btnSutil, etiquetaCampo, inputFormulario } from '../../lib/ui'
import { useDialogo } from '../../lib/useDialogo'
import { confirmarBorrado } from '../../lib/confirmar'
import { pedirTexto } from '../../lib/pedirDatos'

// text-[16px] en celular: iOS Safari hace zoom sobre cualquier campo con letra
// menor y deja el formulario descuadrado. En desktop vuelve al tamaño real.
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

// Lee un archivo de imagen, lo reescala a max 1000px y devuelve un data URL JPEG
// (mantiene el peso bajo para guardarlo como base64 en la columna imagen).
function comprimirImagen(file: File, max = 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const escala = Math.min(1, max / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * escala)
        canvas.height = Math.round(img.height * escala)
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('sin canvas')); return }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => reject(new Error('imagen inválida'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('no se pudo leer'))
    reader.readAsDataURL(file)
  })
}

// Presupuesto imprimible: HTML tema claro con branding, tabla por sistema y total.
function imprimirPresupuesto(nombre: string, grupos: { sistema: string; items: PresupuestoItem[] }[], total: number) {
  const filas = grupos.map(g => `
    <tr class="sis"><td colspan="3">${escapeHtml(g.sistema)}</td><td class="r">${fmt(totalPresupuesto(g.items))}</td></tr>
    ${g.items.map(l => `<tr>
      <td>${escapeHtml(l.nombre)}</td>
      <td class="mut">${l.proveedor ? escapeHtml(l.proveedor) : '—'}</td>
      <td class="r mut">${l.cantidad} × ${fmt(l.precio_unit)}</td>
      <td class="r">${fmt(totalLinea(l))}</td>
    </tr>`).join('')}
  `).join('')
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(nombre)}</title>
  <style>
    *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a22;margin:0;padding:32px;max-width:800px}
    h1{font-size:20px;margin:0 0 2px} .sub{color:#6b7280;font-size:12px;margin-bottom:20px}
    .brand{display:flex;align-items:center;gap:8px;color:#4d7c0f;font-weight:700;font-size:13px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:12.5px} th{text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;padding:6px 8px;font-size:10.5px;text-transform:uppercase;letter-spacing:.08em}
    td{padding:6px 8px;border-bottom:1px solid #f0f0f3} .r{text-align:right} .mut{color:#6b7280}
    tr.sis td{background:#f6f7f4;font-weight:700;color:#3f6212;border-top:1px solid #e5e7eb}
    .total{margin-top:16px;display:flex;justify-content:space-between;align-items:center;padding:12px 8px;border-top:2px solid #1a1a22}
    .total b{font-size:20px;color:#3f6212} .foot{margin-top:24px;color:#9ca3af;font-size:10px}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="brand">🌱 GrowFlow · Econometría</div>
  <h1>${escapeHtml(nombre)}</h1>
  <div class="sub">Presupuesto de instalación · ${new Date().toLocaleDateString('es-AR')}</div>
  <table><thead><tr><th>Ítem</th><th>Proveedor</th><th class="r">Cant. × unit.</th><th class="r">Subtotal</th></tr></thead>
  <tbody>${filas}</tbody></table>
  <div class="total"><span>Total presupuesto</span><b>${fmt(total)}</b></div>
  <div class="foot">Generado con GrowFlow · los precios son los guardados al armar el presupuesto (snapshot).</div>
  </body></html>`
  const w = window.open('', '_blank')
  if (!w) { return }
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => w.print(), 300)
}

type Vista = 'catalogo' | 'proveedores' | 'presupuestos'

export default function Instalaciones() {
  const [vista, setVista] = useState<Vista>('catalogo')
  const [items, setItems] = useState<ItemInstalacion[]>([])
  const [proveedores, setProveedores] = useState<ProveedorInstalacion[]>([])
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [cargando, setCargando] = useState(true)

  const [modalItem, setModalItem] = useState<ItemInstalacion | 'nuevo' | null>(null)
  const [modalProv, setModalProv] = useState<ProveedorInstalacion | 'nuevo' | null>(null)
  const [modalOfertas, setModalOfertas] = useState<ItemInstalacion | null>(null)
  const [ofertas, setOfertas] = useState<Pick<OfertaInstalacion, 'id' | 'item_id' | 'precio' | 'elegido'>[]>([])
  const [presupSel, setPresupSel] = useState<Presupuesto | null>(null)
  const [comparar, setComparar] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [its, provs, presups, ofs] = await Promise.all([
        instalacionesService.getItems(),
        instalacionesService.getProveedores(),
        instalacionesService.getPresupuestos(),
        instalacionesService.getTodasOfertas(),
      ])
      setItems(its); setProveedores(provs); setPresupuestos(presups); setOfertas(ofs)
    } catch (err) { toast.error(`Error cargando instalaciones: ${(err as Error).message}`) }
    finally { setCargando(false) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  // item_id -> { n ofertas, mejor precio } para el badge del catálogo.
  const ofertasPorItem = useMemo(() => {
    const m = new Map<string, { n: number; min: number | null }>()
    for (const o of ofertas) {
      const cur = m.get(o.item_id) ?? { n: 0, min: null }
      cur.n += 1
      if (o.precio != null) cur.min = cur.min == null ? Number(o.precio) : Math.min(cur.min, Number(o.precio))
      m.set(o.item_id, cur)
    }
    return m
  }, [ofertas])

  const provPorId = useMemo(() => new Map(proveedores.map(p => [p.id, p])), [proveedores])
  const totalCatalogo = useMemo(
    () => items.reduce((s, i) => s + (i.precio != null ? Number(i.precio) : 0), 0),
    [items],
  )
  const grupos = useMemo(() => porSistema(items), [items])

  const borrarItem = async (i: ItemInstalacion) => {
    if (!(await confirmarBorrado(`¿Borrar "${i.nombre}" del catálogo?`))) return
    try { await instalacionesService.eliminarItem(i.id); toast.success('Ítem borrado'); cargar() }
    catch (err) { toast.error(`No se pudo borrar: ${(err as Error).message}`) }
  }
  const borrarProv = async (p: ProveedorInstalacion) => {
    if (!(await confirmarBorrado(`¿Borrar el proveedor "${p.nombre}"?`))) return
    try { await instalacionesService.eliminarProveedor(p.id); toast.success('Proveedor borrado'); cargar() }
    catch (err) { toast.error(`No se pudo borrar: ${(err as Error).message}`) }
  }

  const { refWrapper: refVistas, refScroller: refScrollVistas } = useDesbordeHorizontal<HTMLDivElement, HTMLDivElement>()

  if (presupSel) {
    return <DetallePresupuesto presupuesto={presupSel} items={items} provPorId={provPorId}
      onVolver={() => { setPresupSel(null); cargar() }} />
  }

  return (
    <div>
      {/* Esta fila no envolvia ni scrolleaba: era un `flex` a secas con tres
          pastillas, un espaciador y el boton de accion. A 375px no entraban, y
          lo que se cortaba contra el borde era el BOTON —«+ Íte…»—, o sea lo
          unico que hay para hacer en la pantalla. Un contenido cortado es malo;
          la accion cortada es una pantalla rota.

          Ahora son dos cosas separadas: las vistas scrollean con el mismo
          degradado que el resto de la app, y la accion baja a su propio renglon
          de ancho completo en el telefono. De `sm:` para arriba vuelven a la
          misma fila, que es donde entraban desde siempre. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
      <div ref={refVistas} className="ct-tabs-fade min-w-0 sm:flex-1">
      <div ref={refScrollVistas} className="scrollbar-none flex items-center gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch]">
        {([['catalogo', 'Catálogo', Boxes], ['proveedores', 'Proveedores', Truck], ['presupuestos', 'Presupuestos', FileText]] as const).map(([v, lbl, Ico]) => (
          <button key={v} onClick={() => setVista(v)}
            className={`flex-shrink-0 min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors flex items-center gap-1.5 ${vista === v ? 'border-[#a3e635]/50 bg-[#a3e635]/10 text-[#d9f99d]' : 'border-[#2a2a3a] bg-[#15151d] text-[#8a8a9c] hover:text-[#a6a6b5]'}`}>
            <Ico className="w-3.5 h-3.5" /> {lbl}
          </button>
        ))}
      </div>
      </div>
        <div className="flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none [&>*]:justify-center sm:[&>*]:justify-start">
        {vista === 'catalogo' && <button onClick={() => setModalItem('nuevo')} className={btnPrimario}><Plus className="w-3.5 h-3.5" /> Ítem</button>}
        {vista === 'proveedores' && <button onClick={() => setModalProv('nuevo')} className={btnPrimario}><Plus className="w-3.5 h-3.5" /> Proveedor</button>}
        {vista === 'presupuestos' && (
          <>
            {presupuestos.length > 1 && (
              <button onClick={() => setComparar(v => !v)} className={comparar ? btnPrimario : btnSutil}>
                <BarChart3 className="w-3.5 h-3.5" /> Comparar
              </button>
            )}
            <NuevoPresupuestoBtn onCreado={cargar} onAbrir={setPresupSel} />
          </>
        )}
        </div>
      </div>

      {cargando ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="rounded-xl bg-[#101016] border border-[#1f1f2b] h-[110px] animate-pulse" />)}
        </div>
      ) : vista === 'catalogo' ? (
        items.length === 0 ? (
          <Vacio icono={Boxes} titulo="Catálogo vacío" texto="Cargá tus equipos e insumos de instalación (bomba, línea de riego, controlador de CO₂, etc.) agrupados por sistema." accion="Agregar ítem" onAccion={() => setModalItem('nuevo')} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-[#8a8a9c]">{items.length} ítems en {grupos.length} sistema{grupos.length === 1 ? '' : 's'}</span>
              <span className="text-[12px] text-[#a6a6b5]">Total catálogo <span className="font-display font-bold text-[#bef264]">{fmt(totalCatalogo)}</span></span>
            </div>
            {grupos.map(g => (
              <div key={g.sistema} className="rounded-xl bg-[#101016] border border-[#1f1f2b] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1f1f2b] bg-[#0d0d12]">
                  <h3 className="font-display font-semibold text-[13px] text-[#ececf1] flex items-center gap-2"><Package className="w-3.5 h-3.5 text-[#38bdf8]" /> {g.sistema}</h3>
                  <span className="text-[12px] font-medium text-[#d9f99d]">{fmt(g.items.reduce((s, i) => s + (i.precio ?? 0), 0))}</span>
                </div>
                <ul className="divide-y divide-[#1f1f2b]/60">
                  {g.items.map(i => {
                    const prov = i.proveedor_id ? provPorId.get(i.proveedor_id) : null
                    const of = ofertasPorItem.get(i.id)
                    return (
                      <li key={i.id} className="flex items-center gap-3 px-4 py-2.5 group">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] text-[#ececf1] truncate">{i.nombre}</span>
                            {(i.marca || i.modelo) && <span className="text-[10px] text-[#8a8a9c]">{[i.marca, i.modelo].filter(Boolean).join(' · ')}</span>}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[#8a8a9c]">
                            {prov ? <span className="text-[#84cc16]">{prov.nombre}</span> : <span className="text-[#8a8a9c]">sin proveedor</span>}
                            {of && of.n > 0 && <button onClick={() => setModalOfertas(i)} className="inline-flex items-center gap-0.5 text-[#fbbf24] hover:underline"><Tag className="w-3 h-3" /> {of.n} oferta{of.n === 1 ? '' : 's'}{of.min != null ? ` · mejor ${fmt(of.min)}` : ''}</button>}
                            {i.url && <a href={i.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[#38bdf8] hover:underline"><ExternalLink className="w-3 h-3" /> link</a>}
                            {i.specs && <span className="truncate">· {i.specs}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-[12px] font-medium text-[#ececf1]">{i.precio != null ? fmt(Number(i.precio)) : '—'}</div>
                          <div className="text-[10px] text-[#8a8a9c]">por {i.unidad || 'u'}</div>
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button onClick={() => setModalOfertas(i)} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#8a8a9c] hover:text-[#fbbf24] hover:bg-[#15151d] rounded-lg transition-colors" title="Ofertas / comparar precios"><Tag className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setModalItem(i)} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#8a8a9c] hover:text-[#d9f99d] hover:bg-[#15151d] rounded-lg transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => borrarItem(i)} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#8a8a9c] hover:text-[#ff8a7a] hover:bg-[#15151d] rounded-lg transition-colors" title="Borrar"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )
      ) : vista === 'proveedores' ? (
        proveedores.length === 0 ? (
          <Vacio icono={Truck} titulo="Sin proveedores" texto="Cargá los proveedores de tu instalación (casa de riego, electricidad, etc.). Después los asignás a cada ítem del catálogo." accion="Agregar proveedor" onAccion={() => setModalProv('nuevo')} />
        ) : (
          <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] overflow-hidden">
            <ul className="divide-y divide-[#1f1f2b]/60">
              {proveedores.map(p => {
                const nItems = items.filter(i => i.proveedor_id === p.id).length
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] text-[#ececf1]">{p.nombre}</span>
                        {p.zona && <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-[#15151d] border border-[#2a2a3a] text-[#a6a6b5]">{p.zona}</span>}
                        <span className="text-[10px] text-[#8a8a9c]">{nItems} ítem{nItems === 1 ? '' : 's'}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-[10px] text-[#8a8a9c]">
                        {p.contacto && <span>{p.contacto}</span>}
                        {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[#38bdf8] hover:underline"><ExternalLink className="w-3 h-3" /> {p.url.replace(/^https?:\/\//, '').slice(0, 32)}</a>}
                      </div>
                      {p.notas && <div className="mt-0.5 text-[10px] text-[#8a8a9c] truncate">{p.notas}</div>}
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button onClick={() => setModalProv(p)} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#8a8a9c] hover:text-[#d9f99d] hover:bg-[#15151d] rounded-lg transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => borrarProv(p)} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#8a8a9c] hover:text-[#ff8a7a] hover:bg-[#15151d] rounded-lg transition-colors" title="Borrar"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      ) : (
        presupuestos.length === 0 ? (
          <Vacio icono={FileText} titulo="Sin presupuestos" texto="Armá una cotización nombrada (ej: 'Setup 4×4 indoor') eligiendo ítems del catálogo. Se guarda el precio del momento." accion="Nuevo presupuesto" onAccion={() => {/* boton arriba */}} />
        ) : comparar ? (
          <CompararPresupuestos presupuestos={presupuestos} onAbrir={setPresupSel} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {presupuestos.map(p => (
              <button key={p.id} onClick={() => setPresupSel(p)}
                className="text-left rounded-xl bg-[#101016] border border-[#1f1f2b] hover:border-[#404d20] transition-colors p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#a78bfa]" />
                  <span className="font-display font-semibold text-[13px] text-[#ececf1]">{p.nombre}</span>
                </div>
                {p.notas && <div className="mt-1 text-[11px] text-[#8a8a9c] line-clamp-2">{p.notas}</div>}
                <div className="mt-2 text-[10px] text-[#8a8a9c]">Abrir para ver el detalle y el total →</div>
              </button>
            ))}
          </div>
        )
      )}

      {modalItem && <ModalItem item={modalItem === 'nuevo' ? null : modalItem} proveedores={proveedores}
        onCerrar={() => setModalItem(null)} onGuardado={() => { setModalItem(null); cargar() }} />}
      {modalProv && <ModalProveedor prov={modalProv === 'nuevo' ? null : modalProv}
        onCerrar={() => setModalProv(null)} onGuardado={() => { setModalProv(null); cargar() }} />}
      {modalOfertas && <ModalOfertas item={modalOfertas} proveedores={proveedores}
        onCerrar={() => setModalOfertas(null)} onCambio={cargar} />}
    </div>
  )
}

// ---- Ofertas de proveedor por ítem: comparar precios, subir foto, elegir mejor ----
function ModalOfertas({ item, proveedores, onCerrar, onCambio }: {
  item: ItemInstalacion; proveedores: ProveedorInstalacion[]; onCerrar: () => void; onCambio: () => void
}) {
  const refDialogo1 = useDialogo(onCerrar)
  const [ofertas, setOfertas] = useState<OfertaInstalacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [edit, setEdit] = useState<OfertaInstalacion | 'nueva' | null>(null)
  const [verImg, setVerImg] = useState<string | null>(null)
  // El visor de la foto tapa al modal de ofertas: el atras cierra el de arriba.
  const refDialogo2 = useDialogo(() => setVerImg(null), verImg != null)
  const provPorId = useMemo(() => new Map(proveedores.map(p => [p.id, p])), [proveedores])

  const cargar = useCallback(async () => {
    try { setOfertas(await instalacionesService.getOfertas(item.id)) }
    catch (err) { toast.error(`Error: ${(err as Error).message}`) }
    finally { setCargando(false) }
  }, [item.id])
  useEffect(() => { cargar() }, [cargar])

  const elegir = async (o: OfertaInstalacion) => {
    try {
      await instalacionesService.elegirOferta(o.id, item.id, o.precio ?? null, o.proveedor_id ?? null)
      toast.success('Precio de referencia actualizado'); await cargar(); onCambio()
    } catch (err) { toast.error(`Error: ${(err as Error).message}`) }
  }
  const borrar = async (o: OfertaInstalacion) => {
    if (!(await confirmarBorrado('¿Borrar esta oferta?'))) return
    try { await instalacionesService.eliminarOferta(o.id); await cargar(); onCambio() }
    catch (err) { toast.error(`Error: ${(err as Error).message}`) }
  }

  const mejor = ofertas.filter(o => o.precio != null).reduce<number | null>((m, o) => m == null ? Number(o.precio) : Math.min(m, Number(o.precio)), null)

  return (
    <div ref={refDialogo1} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onCerrar}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#0d0d12] border-b border-[#1f1f2b] px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-[15px] text-[#ececf1] truncate flex items-center gap-2"><Tag className="w-4 h-4 text-[#fbbf24]" /> Ofertas · {item.nombre}</h2>
            <div className="text-[10px] text-[#8a8a9c]">Cargá cada cotización con su foto y elegí ⭐ la de mejor precio</div>
          </div>
          <button onClick={onCerrar} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 text-[#8a8a9c] hover:text-[#ececf1]" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          {cargando ? (
            <div className="h-24 rounded-xl bg-[#101016] border border-[#1f1f2b] animate-pulse" />
          ) : ofertas.length === 0 ? (
            <p className="text-[12px] text-[#8a8a9c] text-center py-6">Todavía no hay ofertas. Agregá la primera abajo.</p>
          ) : (
            <ul className="space-y-2">
              {ofertas.map(o => {
                const prov = o.proveedor_id ? provPorId.get(o.proveedor_id) : null
                const esMejor = o.precio != null && mejor != null && Number(o.precio) === mejor
                return (
                  <li key={o.id} className={`rounded-xl border p-2.5 flex items-center gap-3 ${o.elegido ? 'border-[#a3e635]/50 bg-[#a3e635]/[0.06]' : 'border-[#1f1f2b] bg-[#101016]'}`}>
                    {o.imagen
                      ? <button onClick={() => setVerImg(o.imagen!)} className="flex-shrink-0"><img src={o.imagen} alt="" width={48} height={48} loading="lazy" className="w-12 h-12 rounded-lg object-cover border border-[#2a2a3a]" /></button>
                      : <div className="w-12 h-12 rounded-lg bg-[#15151d] border border-[#2a2a3a] flex items-center justify-center flex-shrink-0"><ImagePlus className="w-4 h-4 text-[#3a3a48]" /></div>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[12px] font-medium text-[#ececf1]">{o.precio != null ? fmt(Number(o.precio)) : 's/precio'}</span>
                        {esMejor && <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-[#22c55e]/15 text-[#4ade80] border border-[#22c55e]/30">mejor</span>}
                        {o.elegido && <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-[#a3e635]/15 text-[#d9f99d] border border-[#a3e635]/30">referencia</span>}
                      </div>
                      <div className="text-[10px] text-[#8a8a9c] truncate">{prov?.nombre ?? 'sin proveedor'}{o.presentacion ? ` · ${o.presentacion}` : ''}{o.nota ? ` · ${o.nota}` : ''}</div>
                    </div>
                    <button onClick={() => elegir(o)} title="Elegir como referencia" className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 rounded-lg transition-colors ${o.elegido ? 'text-[#a3e635]' : 'text-[#8a8a9c] hover:text-[#a3e635] hover:bg-[#15151d]'}`}><Star className={`w-4 h-4 ${o.elegido ? 'fill-[#a3e635]' : ''}`} /></button>
                    <button onClick={() => setEdit(o)} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#8a8a9c] hover:text-[#d9f99d] hover:bg-[#15151d] rounded-lg" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => borrar(o)} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#8a8a9c] hover:text-[#ff8a7a] hover:bg-[#15151d] rounded-lg" title="Borrar"><Trash2 className="w-3.5 h-3.5" /></button>
                  </li>
                )
              })}
            </ul>
          )}
          <button onClick={() => setEdit('nueva')} className={`${btnSutil} w-full justify-center`}><Plus className="w-3.5 h-3.5" /> Agregar oferta</button>
        </div>
        <div className="px-4 py-3 border-t border-[#1f1f2b] sticky bottom-0 bg-[#0d0d12]">
          <button onClick={onCerrar} className="w-full min-h-[44px] flex items-center justify-center rounded-lg border border-[#2a2a3a] text-[12px] text-[#a6a6b5] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">Cerrar</button>
        </div>
      </div>

      {edit && <ModalOferta item={item} oferta={edit === 'nueva' ? null : edit} proveedores={proveedores}
        onCerrar={() => setEdit(null)} onGuardado={() => { setEdit(null); cargar(); onCambio() }} />}
      {verImg && (
        <div ref={refDialogo2} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4" onClick={() => setVerImg(null)}>
          {/* El contorno, por lo mismo que en FotoPrivada: sobre el negro al 85%
              de este visor, una foto oscura no tiene dónde terminar. */}
          <img src={verImg} alt="" className="max-w-full max-h-full rounded-lg [outline:1px_solid_rgba(255,255,255,0.1)] [outline-offset:-1px]" />
          <button onClick={() => setVerImg(null)} aria-label="Cerrar"
            className="absolute top-3 right-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black/50 text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <button onClick={() => setVerImg(null)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 min-h-[44px] px-6 flex items-center justify-center rounded-lg bg-black/60 border border-white/20 text-[12px] text-white/90 hover:bg-black/80">
            Cerrar
          </button>
        </div>
      )}
    </div>
  )
}

function ModalOferta({ item, oferta, proveedores, onCerrar, onGuardado }: {
  item: ItemInstalacion; oferta: OfertaInstalacion | null; proveedores: ProveedorInstalacion[]; onCerrar: () => void; onGuardado: () => void
}) {
  const [f, setF] = useState<Partial<OfertaInstalacion>>(oferta ?? {})
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const set = (k: keyof OfertaInstalacion, v: unknown) => setF(prev => ({ ...prev, [k]: v }))

  const onFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    try { set('imagen', await comprimirImagen(file)) }
    catch (err) { toast.error(`No se pudo procesar la imagen: ${(err as Error).message}`) }
    finally { setSubiendo(false) }
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      const payload: Partial<OfertaInstalacion> = {
        item_id: item.id, proveedor_id: f.proveedor_id || null,
        precio: f.precio != null && (f.precio as unknown) !== '' ? Number(f.precio) : null,
        presentacion: f.presentacion || null, imagen: f.imagen || null, nota: f.nota || null,
      }
      if (oferta) await instalacionesService.actualizarOferta(oferta.id, payload)
      else await instalacionesService.crearOferta(payload)
      toast.success(oferta ? 'Oferta actualizada' : 'Oferta agregada'); onGuardado()
    } catch (err) { toast.error(`Error: ${(err as Error).message}`) }
    finally { setGuardando(false) }
  }

  return (
    <ModalShell titulo={oferta ? 'Editar oferta' : 'Nueva oferta'} onCerrar={onCerrar} onGuardar={guardar} guardando={guardando}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={etiquetaCampo}>Proveedor</label>
          <select className={inputFormulario} value={f.proveedor_id ?? ''} onChange={e => set('proveedor_id', e.target.value || null)}>
            <option value="">— sin proveedor —</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div><label className={etiquetaCampo}>Precio ($)</label><input type="number" className={inputFormulario} value={f.precio ?? ''} onChange={e => set('precio', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" /></div>
      </div>
      <div><label className={etiquetaCampo}>Presentación</label><input className={inputFormulario} value={f.presentacion ?? ''} onChange={e => set('presentacion', e.target.value)} placeholder="Ej: caja x10 · bolsa 25kg · por hora" /></div>
      <div>
        <label className={etiquetaCampo}>Foto de la cotización (captura ML, etc.)</label>
        <div className="flex items-center gap-3">
          {f.imagen
            ? <img src={f.imagen} alt="" width={64} height={64} className="w-16 h-16 rounded-lg object-cover border border-[#2a2a3a]" />
            : <div className="w-16 h-16 rounded-lg bg-[#15151d] border border-[#2a2a3a] flex items-center justify-center"><ImagePlus className="w-5 h-5 text-[#3a3a48]" /></div>}
          <div className="flex flex-col gap-1.5">
            <label className={`${btnSutil} cursor-pointer`}>
              {subiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />} {f.imagen ? 'Cambiar' : 'Subir foto'}
              <input type="file" accept="image/*" className="hidden" onChange={onFoto} />
            </label>
            {f.imagen && <button onClick={() => set('imagen', null)} className="text-[10px] text-[#ff8a7a] hover:underline text-left">Quitar</button>}
          </div>
        </div>
      </div>
      <div><label className={etiquetaCampo}>Nota</label><input className={inputFormulario} value={f.nota ?? ''} onChange={e => set('nota', e.target.value)} placeholder="Opcional" /></div>
    </ModalShell>
  )
}

function Vacio({ icono: Ico, titulo, texto, accion, onAccion }: { icono: React.ComponentType<{ className?: string }>; titulo: string; texto: string; accion: string; onAccion: () => void }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto w-11 h-11 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-3"><Ico className="w-5 h-5 text-[#8a8a9c]" /></div>
      <div className="font-display font-semibold text-[#d4d4dd] text-[14px]">{titulo}</div>
      <div className="mt-1 text-[11px] text-[#8a8a9c] max-w-md mx-auto">{texto}</div>
      <button onClick={onAccion} className={`${btnPrimario} mt-3`}><Plus className="w-3.5 h-3.5" /> {accion}</button>
    </div>
  )
}

function NuevoPresupuestoBtn({ onCreado, onAbrir }: { onCreado: () => void; onAbrir: (p: Presupuesto) => void }) {
  const [creando, setCreando] = useState(false)
  const crear = async () => {
    const nombre = await pedirTexto('Nuevo presupuesto', {
      etiqueta: 'Nombre', placeholder: 'Setup 4×4 indoor',
    })
    if (!nombre) return
    setCreando(true)
    try {
      const p = await instalacionesService.crearPresupuesto({ nombre })
      toast.success('Presupuesto creado'); onCreado(); onAbrir(p)
    } catch (err) { toast.error(`Error: ${(err as Error).message}`) }
    finally { setCreando(false) }
  }
  return <button onClick={crear} disabled={creando} className={btnPrimario}>{creando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Presupuesto</button>
}

// ---- Detalle de un presupuesto: lineas agrupadas por sistema + totales ----
function DetallePresupuesto({ presupuesto, items, provPorId, onVolver }: {
  presupuesto: Presupuesto; items: ItemInstalacion[]; provPorId: Map<string, ProveedorInstalacion>; onVolver: () => void
}) {
  const [lineas, setLineas] = useState<PresupuestoItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [agregando, setAgregando] = useState(false)

  const cargar = useCallback(async () => {
    try { setLineas(await instalacionesService.getLineas(presupuesto.id)) }
    catch (err) { toast.error(`Error: ${(err as Error).message}`) }
    finally { setCargando(false) }
  }, [presupuesto.id])
  useEffect(() => { cargar() }, [cargar])

  const grupos = useMemo(() => porSistema(lineas), [lineas])
  const total = useMemo(() => totalPresupuesto(lineas), [lineas])
  const porSist = useMemo(() => totalesPorSistema(lineas), [lineas])

  const setCantidad = async (l: PresupuestoItem, cantidad: number) => {
    const c = Math.max(0, cantidad)
    setLineas(prev => prev.map(x => x.id === l.id ? { ...x, cantidad: c } : x))
    try { await instalacionesService.actualizarLinea(l.id, { cantidad: c }) }
    catch (err) { toast.error(`Error: ${(err as Error).message}`); cargar() }
  }
  const borrarLinea = async (l: PresupuestoItem) => {
    try { await instalacionesService.eliminarLinea(l.id); cargar() }
    catch (err) { toast.error(`Error: ${(err as Error).message}`) }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onVolver} className={btnSutil}><ChevronLeft className="w-3.5 h-3.5" /> Volver</button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-bold text-[15px] text-[#ececf1] truncate flex items-center gap-2"><FileText className="w-4 h-4 text-[#a78bfa]" /> {presupuesto.nombre}</h2>
        </div>
        <button onClick={() => imprimirPresupuesto(presupuesto.nombre, grupos, total)} disabled={lineas.length === 0} className={btnSutil} title="Imprimir / PDF"><Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Imprimir</span></button>
        <button onClick={() => setAgregando(true)} className={btnPrimario}><Plus className="w-3.5 h-3.5" /> Ítem</button>
      </div>

      {cargando ? (
        <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] h-40 animate-pulse" />
      ) : lineas.length === 0 ? (
        <Vacio icono={FileText} titulo="Presupuesto vacío" texto="Agregá ítems desde el catálogo o cargalos a mano. Cada línea guarda el precio del momento." accion="Agregar ítem" onAccion={() => setAgregando(true)} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 sm:p-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">Total presupuesto</div>
              <div className="font-display font-bold text-[22px] text-[#bef264] leading-tight">{fmt(total)}</div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {porSist.map(s => (
                <div key={s.sistema} className="text-[11px]">
                  <span className="text-[#8a8a9c]">{s.sistema}: </span><span className="text-[#a6a6b5] font-medium">{fmt(s.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {grupos.map(g => (
            <div key={g.sistema} className="rounded-xl bg-[#101016] border border-[#1f1f2b] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1f1f2b] bg-[#0d0d12]">
                <h3 className="font-display font-semibold text-[13px] text-[#ececf1]">{g.sistema}</h3>
                <span className="text-[12px] font-medium text-[#d9f99d]">{fmt(totalPresupuesto(g.items))}</span>
              </div>
              <ul className="divide-y divide-[#1f1f2b]/60">
                {g.items.map(l => (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] text-[#ececf1] truncate">{l.nombre}</div>
                      <div className="text-[10px] text-[#8a8a9c]">{l.proveedor || 'sin proveedor'} · {fmt(l.precio_unit)} c/u</div>
                    </div>
                    <input type="number" min={0} step={1} value={l.cantidad}
                      onChange={e => setCantidad(l, Number(e.target.value) || 0)}
                      className="w-16 px-2 py-1.5 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[12px] text-[#ececf1] text-center focus:outline-none focus:border-[#a3e635]/60" />
                    <div className="text-right flex-shrink-0 w-24">
                      <div className="text-[12px] font-medium text-[#ececf1]">{fmt(totalLinea(l))}</div>
                    </div>
                    <button onClick={() => borrarLinea(l)} className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#8a8a9c] hover:text-[#ff8a7a] hover:bg-[#15151d] rounded-lg transition-colors flex-shrink-0" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {agregando && <ModalAgregarLinea presupuestoId={presupuesto.id} catalogo={items} provPorId={provPorId}
        onCerrar={() => setAgregando(false)} onGuardado={() => { setAgregando(false); cargar() }} />}
    </div>
  )
}

// ---- Comparar presupuestos: total + desglose por sistema, barras relativas ----
function CompararPresupuestos({ presupuestos, onAbrir }: { presupuestos: Presupuesto[]; onAbrir: (p: Presupuesto) => void }) {
  const [datos, setDatos] = useState<{ p: Presupuesto; total: number; porSist: { sistema: string; total: number }[] }[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const res = await Promise.all(presupuestos.map(async p => {
          const lineas = await instalacionesService.getLineas(p.id)
          return { p, total: totalPresupuesto(lineas), porSist: totalesPorSistema(lineas) }
        }))
        if (vivo) setDatos(res.sort((a, b) => b.total - a.total))
      } catch (err) { toast.error(`Error: ${(err as Error).message}`) }
      finally { if (vivo) setCargando(false) }
    })()
    return () => { vivo = false }
  }, [presupuestos])

  const max = useMemo(() => Math.max(1, ...datos.map(d => d.total)), [datos])
  const sistemas = useMemo(() => {
    const set = new Set<string>()
    datos.forEach(d => d.porSist.forEach(s => set.add(s.sistema)))
    return [...set]
  }, [datos])

  if (cargando) return <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] h-48 animate-pulse" />

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {datos.map(d => (
          <button key={d.p.id} onClick={() => onAbrir(d.p)} className="w-full text-left rounded-xl bg-[#101016] border border-[#1f1f2b] hover:border-[#404d20] transition-colors p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] text-[#ececf1] font-medium truncate">{d.p.nombre}</span>
              <span className="font-display font-bold text-[13px] text-[#bef264] flex-shrink-0 ml-2">{fmt(d.total)}</span>
            </div>
            <div className="h-2 rounded-full bg-[#15151d] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#4d7c0f] to-[#a3e635]" style={{ width: `${(d.total / max) * 100}%` }} />
            </div>
          </button>
        ))}
      </div>

      {sistemas.length > 0 && (
        <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-[#8a8a9c]">
                <th className="text-left font-medium px-3 py-2 sticky left-0 bg-[#101016]">Sistema</th>
                {datos.map(d => <th key={d.p.id} className="text-right font-medium px-3 py-2 whitespace-nowrap max-w-[120px] truncate">{d.p.nombre}</th>)}
              </tr>
            </thead>
            <tbody>
              {sistemas.map(sis => (
                <tr key={sis} className="border-t border-[#1f1f2b]/60">
                  <td className="text-left px-3 py-1.5 text-[#a6a6b5] sticky left-0 bg-[#101016]">{sis}</td>
                  {datos.map(d => {
                    const v = d.porSist.find(s => s.sistema === sis)?.total ?? 0
                    return <td key={d.p.id} className={`text-right px-3 py-1.5 ${v ? 'text-[#ececf1]' : 'text-[#3a3a48]'}`}>{v ? fmt(v) : '—'}</td>
                  })}
                </tr>
              ))}
              <tr className="border-t border-[#1f1f2b] bg-[#0d0d12]">
                <td className="text-left px-3 py-2 font-semibold text-[#d9f99d] sticky left-0 bg-[#0d0d12]">Total</td>
                {datos.map(d => <td key={d.p.id} className="text-right px-3 py-2 font-semibold text-[#bef264]">{fmt(d.total)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ModalAgregarLinea({ presupuestoId, catalogo, provPorId, onCerrar, onGuardado }: {
  presupuestoId: string; catalogo: ItemInstalacion[]; provPorId: Map<string, ProveedorInstalacion>
  onCerrar: () => void; onGuardado: () => void
}) {
  const [modo, setModo] = useState<'catalogo' | 'manual'>('catalogo')
  const [itemId, setItemId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [manual, setManual] = useState<{ nombre: string; sistema: string; proveedor: string; precio_unit: number }>({ nombre: '', sistema: 'Otro', proveedor: '', precio_unit: 0 })
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    setGuardando(true)
    try {
      let payload: Partial<PresupuestoItem>
      if (modo === 'catalogo') {
        const it = catalogo.find(i => i.id === itemId)
        if (!it) { toast.error('Elegí un ítem del catálogo'); setGuardando(false); return }
        const prov = it.proveedor_id ? provPorId.get(it.proveedor_id) : null
        payload = {
          presupuesto_id: presupuestoId, item_id: it.id, nombre: it.nombre, sistema: it.sistema,
          proveedor: prov?.nombre ?? null, precio_unit: Number(it.precio ?? 0), cantidad,
        }
      } else {
        if (!manual.nombre.trim()) { toast.error('Poné un nombre'); setGuardando(false); return }
        payload = {
          presupuesto_id: presupuestoId, nombre: manual.nombre.trim(), sistema: manual.sistema,
          proveedor: manual.proveedor.trim() || null, precio_unit: Number(manual.precio_unit || 0), cantidad,
        }
      }
      await instalacionesService.agregarLinea(payload)
      toast.success('Ítem agregado'); onGuardado()
    } catch (err) { toast.error(`Error: ${(err as Error).message}`) }
    finally { setGuardando(false) }
  }

  return (
    <ModalShell titulo="Agregar ítem al presupuesto" onCerrar={onCerrar} onGuardar={guardar} guardando={guardando}>
      <div className="grid grid-cols-2 gap-2">
        {(['catalogo', 'manual'] as const).map(m => (
          <button key={m} onClick={() => setModo(m)}
            className={`px-3 py-2 rounded-lg text-[12px] font-medium border transition-colors ${modo === m ? 'border-[#a3e635]/50 bg-[#a3e635]/10 text-[#d9f99d]' : 'border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5] hover:text-[#ececf1]'}`}>
            {m === 'catalogo' ? 'Desde catálogo' : 'A mano'}
          </button>
        ))}
      </div>
      {modo === 'catalogo' ? (
        <div>
          <label className={etiquetaCampo}>Ítem del catálogo</label>
          {catalogo.length === 0 ? (
            <p className="text-[11px] text-[#8a8a9c]">El catálogo está vacío. Cargá ítems primero o usá "A mano".</p>
          ) : (
            <select className={inputFormulario} value={itemId} onChange={e => setItemId(e.target.value)}>
              <option value="">— elegí —</option>
              {porSistema(catalogo).map(g => (
                <optgroup key={g.sistema} label={g.sistema}>
                  {g.items.map(i => <option key={i.id} value={i.id}>{i.nombre} · {i.precio != null ? fmt(Number(i.precio)) : 's/precio'}</option>)}
                </optgroup>
              ))}
            </select>
          )}
        </div>
      ) : (
        <>
          <div><label className={etiquetaCampo}>Nombre *</label><input className={inputFormulario} value={manual.nombre} onChange={e => setManual({ ...manual, nombre: e.target.value })} placeholder="Ej: Bomba sumergible 2000 L/h" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={etiquetaCampo}>Sistema</label>
              <select className={inputFormulario} value={manual.sistema} onChange={e => setManual({ ...manual, sistema: e.target.value })}>
                {SISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={etiquetaCampo}>Precio unit. ($)</label><input type="number" className={inputFormulario} value={manual.precio_unit || ''} onChange={e => setManual({ ...manual, precio_unit: Number(e.target.value) || 0 })} placeholder="0" /></div>
          </div>
          <div><label className={etiquetaCampo}>Proveedor</label><input className={inputFormulario} value={manual.proveedor} onChange={e => setManual({ ...manual, proveedor: e.target.value })} placeholder="Opcional" /></div>
        </>
      )}
      <div><label className={etiquetaCampo}>Cantidad</label><input type="number" min={0} step={1} className={inputFormulario} value={cantidad} onChange={e => setCantidad(Number(e.target.value) || 0)} /></div>
    </ModalShell>
  )
}

function ModalItem({ item, proveedores, onCerrar, onGuardado }: { item: ItemInstalacion | null; proveedores: ProveedorInstalacion[]; onCerrar: () => void; onGuardado: () => void }) {
  const [f, setF] = useState<Partial<ItemInstalacion>>(item ?? { sistema: 'Otro', unidad: 'u' })
  const [guardando, setGuardando] = useState(false)
  const set = (k: keyof ItemInstalacion, v: unknown) => setF(prev => ({ ...prev, [k]: v }))

  const guardar = async () => {
    if (!f.nombre?.trim()) { toast.error('Poné un nombre'); return }
    setGuardando(true)
    try {
      const payload: Partial<ItemInstalacion> = {
        nombre: f.nombre!.trim(), sistema: f.sistema || 'Otro', marca: f.marca || null, modelo: f.modelo || null,
        proveedor_id: f.proveedor_id || null, precio: f.precio != null && (f.precio as unknown) !== '' ? Number(f.precio) : null,
        unidad: f.unidad || 'u', specs: f.specs || null, url: f.url || null, notas: f.notas || null,
      }
      if (item) await instalacionesService.actualizarItem(item.id, payload)
      else await instalacionesService.crearItem(payload)
      toast.success(item ? 'Ítem actualizado' : 'Ítem agregado'); onGuardado()
    } catch (err) { toast.error(`Error: ${(err as Error).message}`) }
    finally { setGuardando(false) }
  }

  return (
    <ModalShell titulo={item ? 'Editar ítem' : 'Nuevo ítem'} onCerrar={onCerrar} onGuardar={guardar} guardando={guardando}>
      <div><label className={etiquetaCampo}>Nombre *</label><input className={inputFormulario} value={f.nombre ?? ''} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Controlador de CO₂" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={etiquetaCampo}>Sistema</label>
          <select className={inputFormulario} value={f.sistema ?? 'Otro'} onChange={e => set('sistema', e.target.value)}>
            {SISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={etiquetaCampo}>Proveedor</label>
          <select className={inputFormulario} value={f.proveedor_id ?? ''} onChange={e => set('proveedor_id', e.target.value || null)}>
            <option value="">— sin proveedor —</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={etiquetaCampo}>Marca</label><input className={inputFormulario} value={f.marca ?? ''} onChange={e => set('marca', e.target.value)} placeholder="Opcional" /></div>
        <div><label className={etiquetaCampo}>Modelo</label><input className={inputFormulario} value={f.modelo ?? ''} onChange={e => set('modelo', e.target.value)} placeholder="Opcional" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={etiquetaCampo}>Precio unit. ($)</label><input type="number" className={inputFormulario} value={f.precio ?? ''} onChange={e => set('precio', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" /></div>
        <div>
          <label className={etiquetaCampo}>Unidad</label>
          <select className={inputFormulario} value={f.unidad ?? 'u'} onChange={e => set('unidad', e.target.value)}>
            {UNIDADES_INST.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div><label className={etiquetaCampo}>Specs</label><input className={inputFormulario} value={f.specs ?? ''} onChange={e => set('specs', e.target.value)} placeholder="Ej: 2000 L/h, 40 W" /></div>
      <div><label className={etiquetaCampo}>Link (URL)</label><input className={inputFormulario} value={f.url ?? ''} onChange={e => set('url', e.target.value)} placeholder="https://..." /></div>
      <div><label className={etiquetaCampo}>Notas</label><textarea rows={2} className={inputFormulario + ' resize-none'} value={f.notas ?? ''} onChange={e => set('notas', e.target.value)} /></div>
    </ModalShell>
  )
}

function ModalProveedor({ prov, onCerrar, onGuardado }: { prov: ProveedorInstalacion | null; onCerrar: () => void; onGuardado: () => void }) {
  const [f, setF] = useState<Partial<ProveedorInstalacion>>(prov ?? {})
  const [guardando, setGuardando] = useState(false)
  const set = (k: keyof ProveedorInstalacion, v: unknown) => setF(prev => ({ ...prev, [k]: v }))

  const guardar = async () => {
    if (!f.nombre?.trim()) { toast.error('Poné un nombre'); return }
    setGuardando(true)
    try {
      const payload: Partial<ProveedorInstalacion> = {
        nombre: f.nombre!.trim(), contacto: f.contacto || null, url: f.url || null, zona: f.zona || null, notas: f.notas || null,
      }
      if (prov) await instalacionesService.actualizarProveedor(prov.id, payload)
      else await instalacionesService.crearProveedor(payload)
      toast.success(prov ? 'Proveedor actualizado' : 'Proveedor agregado'); onGuardado()
    } catch (err) { toast.error(`Error: ${(err as Error).message}`) }
    finally { setGuardando(false) }
  }

  return (
    <ModalShell titulo={prov ? 'Editar proveedor' : 'Nuevo proveedor'} onCerrar={onCerrar} onGuardar={guardar} guardando={guardando}>
      <div><label className={etiquetaCampo}>Nombre *</label><input className={inputFormulario} value={f.nombre ?? ''} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Casa de Riego Corrientes" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={etiquetaCampo}>Contacto</label><input className={inputFormulario} value={f.contacto ?? ''} onChange={e => set('contacto', e.target.value)} placeholder="Tel / email / WhatsApp" /></div>
        <div><label className={etiquetaCampo}>Zona</label><input className={inputFormulario} value={f.zona ?? ''} onChange={e => set('zona', e.target.value)} placeholder="Ciudad / provincia" /></div>
      </div>
      <div><label className={etiquetaCampo}>Link (URL)</label><input className={inputFormulario} value={f.url ?? ''} onChange={e => set('url', e.target.value)} placeholder="https://..." /></div>
      <div><label className={etiquetaCampo}>Notas</label><textarea rows={2} className={inputFormulario + ' resize-none'} value={f.notas ?? ''} onChange={e => set('notas', e.target.value)} /></div>
    </ModalShell>
  )
}

function ModalShell({ titulo, children, onCerrar, onGuardar, guardando }: { titulo: string; children: React.ReactNode; onCerrar: () => void; onGuardar: () => void; guardando: boolean }) {
  const refDialogo3 = useDialogo(onCerrar)
  return (
    <div ref={refDialogo3} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onCerrar}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#0d0d12] border-b border-[#1f1f2b] px-4 py-3 flex items-center justify-between">
          <h2 className="font-display font-bold text-[15px] text-[#ececf1]">{titulo}</h2>
          <button onClick={onCerrar} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 text-[#8a8a9c] hover:text-[#ececf1]" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
        <div className="sticky bottom-0 bg-[#0d0d12] border-t border-[#1f1f2b] px-4 py-3 flex justify-end gap-2">
          <button onClick={onCerrar} className={btnSutil}>Cancelar</button>
          <button onClick={onGuardar} disabled={guardando} className={btnPrimario}>{guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Guardar</button>
        </div>
      </div>
    </div>
  )
}
