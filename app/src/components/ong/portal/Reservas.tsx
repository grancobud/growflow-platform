// Tablero de reservas y retiro en sede (CU-06).
//
// El tablero está ordenado por lo que hay que hacer, no por fecha: primero lo
// que vence hoy, después lo que espera verificación de pago, y al final lo
// cerrado. Una lista cronológica obliga a leerla entera para encontrar lo urgente.
//
// La entrega es el único punto del sistema donde nacen tres cosas a la vez: la
// dispensa, el asiento en el Libro de Caja y el recibo. Salen todas del mismo
// lugar (consolidarEntrega) justamente para que después no dejen de coincidir.

import { useState, useMemo, lazy, Suspense } from 'react'
import { toast } from 'sonner'
import QR from '../../QR'
import {
  Ticket, Search, QrCode, Check, X, Package, Clock, Loader2, Trash2, FileText,
} from 'lucide-react'
import {
  portalService, chequearRetiro, consolidarEntrega, estaVencido, textoRestante, estaVivo,
  etiquetaPago, etiquetaPedido, colorPedido, colorPago, ESTADOS_PEDIDO,
  type Lote, type Pedido, type EstadoPedido,
} from '../../../lib/portal'
import { ongService, type Dispensa, type Entidad, type Asociado, type AsientoCaja } from '../../../lib/ong'
import { reciboReembolso } from '../../../lib/documentosLegales'
import type { Paciente } from '../../../lib/registro'
import { VisorDocumento } from '../ActaParaLibro'
// A pedido, y no con el resto de la pantalla.
//
// `@zxing/browser` + `@zxing/library` son ~400 kB, el bulto más grande de todo
// el panel de la O.N.G. Estaban en el chunk de la página y se descargaban al
// abrirla, para una cámara que se prende cuando alguien toca «Escanear». El
// primer toque tarda un poco más; abrir la pantalla, mucho menos.
const EscanerQR = lazy(() => import('./EscanerQR').then(m => ({ default: m.EscanerQR })))
import { btnPrimario, btnSutil, btnIcono, selectFiltro, campoBase, tarjeta } from '../../../lib/ui'
import { useDialogo } from '../../../lib/useDialogo'
import { confirmarBorrado } from '../../../lib/confirmar'
import { nombreParaMostrar } from '../../../lib/buscarPersonas'


/** Prioridad de atención: lo que vence primero va arriba. */
const PESO_ESTADO: Record<EstadoPedido, number> = {
  Listo_Para_Retiro: 0, Reservado: 1, Entregado: 2, Expirado: 3, Cancelado: 4,
}

export function Reservas({
  pedidos, lotes, pacientes, asociados, dispensas, caja, entidad, onCambio,
}: {
  pedidos: Pedido[]
  lotes: Lote[]
  pacientes: Paciente[]
  asociados: Asociado[]
  dispensas: Dispensa[]
  caja: AsientoCaja[]
  entidad: Entidad | null
  onCambio: () => void
}) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<EstadoPedido | 'todos' | 'vivos'>('vivos')
  const [entregando, setEntregando] = useState<Pedido | null>(null)
  const [qr, setQr] = useState<Pedido | null>(null)
  const [escaneando, setEscaneando] = useState(false)
  const [recibo, setRecibo] = useState<
    { doc: { titulo: string; texto: string; faltantes: string[] }; de: Dispensa | null } | null
  >(null)

  const nombre = (id?: string | null) => {
    const p = pacientes.find(x => x.id === id)
    return p ? nombreParaMostrar(p) : 'sin paciente'
  }
  const codigoLote = (id: string) => lotes.find(l => l.id === id)?.codigo ?? '—'

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    // Índices propios en vez de las funciones de arriba: esas se recrean en cada
    // render y meterlas como dependencia invalidaría el memo siempre.
    const nombres = new Map(pacientes.map(p => [p.id, p.nombre_completo.toLowerCase()]))
    const codigos = new Map(lotes.map(l => [l.id, l.codigo.toLowerCase()]))
    return pedidos
      .filter(p => filtro === 'todos' ? true : filtro === 'vivos' ? estaVivo(p) : p.estado_pedido === filtro)
      .filter(p => !q || p.codigo_reserva.toLowerCase().includes(q) ||
        (nombres.get(p.paciente_id ?? '') ?? '').includes(q) ||
        (codigos.get(p.lote_id) ?? '').includes(q))
      .sort((a, b) => {
        const d = PESO_ESTADO[a.estado_pedido] - PESO_ESTADO[b.estado_pedido]
        if (d !== 0) return d
        // Dentro del mismo estado, lo que vence antes primero.
        return a.fecha_expiracion.localeCompare(b.fecha_expiracion)
      })
  }, [pedidos, filtro, busca, pacientes, lotes])

  const vencidasVivas = pedidos.filter(p => estaVencido(p)).length

  const expirar = async () => {
    try {
      const n = await portalService.expirarVencidas(pedidos)
      toast.success(n === 1 ? '1 reserva marcada como expirada' : `${n} reservas marcadas como expiradas`)
      onCambio()
    } catch (e) { toast.error((e as Error).message) }
  }

  const cambiarPago = async (p: Pedido, estado_pago: Pedido['estado_pago']) => {
    try {
      await portalService.guardarPedido({ id: p.id, estado_pago })
      toast.success(`Pago: ${etiquetaPago(estado_pago).toLowerCase()}`)
      onCambio()
    } catch (e) { toast.error((e as Error).message) }
  }

  const cambiarEstado = async (p: Pedido, estado_pedido: EstadoPedido) => {
    try {
      await portalService.guardarPedido({ id: p.id, estado_pedido })
      toast.success(etiquetaPedido(estado_pedido))
      onCambio()
    } catch (e) { toast.error((e as Error).message) }
  }

  const borrar = async (p: Pedido) => {
    if (p.estado_pedido === 'Entregado') {
      toast.error('Una reserva entregada no se borra: es el respaldo de una dispensa registrada. Anulá la dispensa si hace falta.')
      return
    }
    if (!await confirmarBorrado(`¿Borrar la reserva ${p.codigo_reserva}?`)) return
    try { await portalService.borrarPedido(p.id); toast.success('Reserva borrada'); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }

  const verRecibo = (p: Pedido) => {
    const d = dispensas.find(x => x.id === p.dispensa_id)
    if (!d) { toast.error('No se encontró la dispensa de esta reserva'); return }
    const pac = pacientes.find(x => x.id === d.paciente_id) ?? null
    const aso = asociados.find(a => a.id === p.asociado_id) ?? null
    setRecibo({ doc: reciboReembolso(d, entidad, pac, aso), de: d })
  }

  return (
    <div className="space-y-3">
      <div className={tarjeta}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} />
            <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Reservas</h3>
          </div>
          {vencidasVivas > 0 && (
            <button onClick={expirar} className={btnSutil}>
              <Clock className="w-3.5 h-3.5" /> Expirar {vencidasVivas} vencida{vencidasVivas === 1 ? '' : 's'}
            </button>
          )}
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-[#8a8a9c] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input className={`w-full pl-8 pr-3 py-2 sm:text-[12px] ${campoBase}`} value={busca}
              onChange={e => setBusca(e.target.value)} placeholder="Código, paciente o lote" />
          </div>
          <button onClick={() => setEscaneando(true)} className={btnSutil} title="Escanear QR de retiro">
            <QrCode className="w-3.5 h-3.5" /> Escanear
          </button>
          <select className={selectFiltro} value={filtro} onChange={e => setFiltro(e.target.value as typeof filtro)}>
            <option value="vivos">Pendientes</option>
            <option value="todos">Todas</option>
            {ESTADOS_PEDIDO.map(e => <option key={e.valor} value={e.valor}>{e.label}</option>)}
          </select>
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className={`${tarjeta} text-center py-8`}>
          <Ticket className="w-7 h-7 text-[#2a2a3a] mx-auto" strokeWidth={1.5} />
          <p className="text-[12px] text-[#8a8a9c] mt-2">
            {pedidos.length === 0
              ? 'Todavía no hay reservas. Se crean desde el botón "Reservar".'
              : 'Ninguna reserva coincide con el filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibles.map(p => {
            const vencida = estaVencido(p)
            const chequeo = chequearRetiro(p)
            return (
              <div key={p.id} className={tarjeta}>
                <div className="flex items-start gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[12px] text-[#ececf1]">{p.codigo_reserva}</span>
                      <Chip texto={etiquetaPedido(vencida ? 'Expirado' : p.estado_pedido)}
                        color={colorPedido(vencida ? 'Expirado' : p.estado_pedido)} />
                      <Chip texto={etiquetaPago(p.estado_pago)} color={colorPago(p.estado_pago)} />
                    </div>
                    <p className="text-[12px] text-[#d4d4dd] mt-1">{nombre(p.paciente_id)}</p>
                    <p className="text-[11px] text-[#8a8a9c] mt-0.5">
                      {p.gramos} g de {codigoLote(p.lote_id)} · ${Number(p.monto_reembolso).toLocaleString('es-AR')}
                      {estaVivo(p) && <> · <span style={{ color: vencida ? '#ff8a7a' : '#fbbf24' }}>{textoRestante(p)}</span></>}
                      {p.entregado_en && ` · entregado ${new Date(p.entregado_en).toLocaleDateString('es-AR')}`}
                    </p>
                  </div>
                  <button onClick={() => setQr(p)} className={btnIcono} title="Ver QR" aria-label="Ver QR">
                    <QrCode className="w-3.5 h-3.5" />
                  </button>
                  {p.estado_pedido === 'Entregado' && (
                    <button onClick={() => verRecibo(p)} className={btnIcono} title="Recibo" aria-label="Ver recibo">
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => borrar(p)} className={`${btnIcono} hover:text-[#ff8a7a]`} title="Borrar" aria-label="Borrar reserva">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {estaVivo(p) && !vencida && (
                  <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-[#1f1f2b]">
                    {p.metodo_pago === 'Transferencia_Billetera' && p.estado_pago === 'Pendiente_Verificacion' && (
                      <>
                        <button onClick={() => cambiarPago(p, 'Abonado')} className={btnPrimario}>
                          <Check className="w-3.5 h-3.5" /> Pago verificado
                        </button>
                        <button onClick={() => cambiarPago(p, 'Rechazado')} className={btnSutil}>
                          <X className="w-3.5 h-3.5" /> Rechazar
                        </button>
                      </>
                    )}
                    {p.estado_pedido === 'Reservado' && (
                      <button onClick={() => cambiarEstado(p, 'Listo_Para_Retiro')} className={btnSutil}>
                        <Package className="w-3.5 h-3.5" /> Marcar preparado
                      </button>
                    )}
                    <button onClick={() => setEntregando(p)} disabled={!chequeo.puedeEntregar && !chequeo.cobrarEnSede}
                      className={`${btnPrimario} flex-shrink-0`}>
                      Entregar
                    </button>
                    <button onClick={() => cambiarEstado(p, 'Cancelado')} className={btnSutil}>Cancelar</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {escaneando && (
        <Suspense fallback={null}><EscanerQR onCerrar={() => setEscaneando(false)}
          onLeido={codigo => {
            setEscaneando(false)
            const p = pedidos.find(x => x.codigo_reserva === codigo.trim())
            if (!p) {
              // Se deja el código en el buscador igual: puede ser de otra ONG, o
              // estar bien y ser la lista la que está filtrada.
              setBusca(codigo.trim()); setFiltro('todos')
              toast.error(`No hay ninguna reserva con el código ${codigo.trim()}`)
              return
            }
            setBusca(p.codigo_reserva); setFiltro('todos')
            // Si está para retirar, se abre directo la entrega: en el mostrador,
            // escanear y tener que buscar el botón es un paso de más.
            if (estaVivo(p) && !estaVencido(p)) setEntregando(p)
            else toast.error(`La reserva ${p.codigo_reserva} está ${etiquetaPedido(estaVencido(p) ? 'Expirado' : p.estado_pedido).toLowerCase()}`)
          }} /></Suspense>
      )}

      {qr && (
        <ModalQR pedido={qr} lote={lotes.find(l => l.id === qr.lote_id) ?? null}
          nombre={nombre(qr.paciente_id)} onCerrar={() => setQr(null)} />
      )}

      {entregando && (
        <ModalEntrega pedido={entregando} lote={lotes.find(l => l.id === entregando.lote_id) ?? null}
          paciente={pacientes.find(p => p.id === entregando.paciente_id) ?? null}
          asociado={asociados.find(a => a.id === entregando.asociado_id) ?? null}
          dispensas={dispensas} caja={caja} entidad={entidad}
          onCerrar={() => setEntregando(null)}
          onEntregado={(doc, de) => { setEntregando(null); setRecibo({ doc, de }); onCambio() }} />
      )}

      {recibo && (
        <VisorDocumento titulo={recibo.doc.titulo} texto={recibo.doc.texto} faltantes={recibo.doc.faltantes}
          entidad={entidad}
          onEmitido={onCambio}
          archivo={{
            subtipo: 'Recibo de reembolso',
            numero: recibo.de?.recibo_numero != null ? String(recibo.de.recibo_numero) : null,
            paciente_id: recibo.de?.paciente_id ?? null,
            dispensa_id: recibo.de?.id || null,
            monto: Number(recibo.de?.aporte) || null,
          }}
          nota="Se imprime y se entrega junto con el material. Lleva al pie la leyenda legal obligatoria."
          onCerrar={() => setRecibo(null)} />
      )}
    </div>
  )
}

function Chip({ texto, color }: { texto: string; color: string }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded border"
      style={{ color, borderColor: `${color}55`, background: `${color}14` }}>
      {texto}
    </span>
  )
}

function ModalQR({ pedido, lote, nombre, onCerrar }: {
  pedido: Pedido; lote: Lote | null; nombre: string; onCerrar: () => void
}) {
  const refDialogo1 = useDialogo(onCerrar)
  return (
    <div ref={refDialogo1} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={onCerrar}>
      <div className="relative bg-[#0d0d12] border border-[#1f1f2b] rounded-2xl p-5 text-center max-w-xs w-full"
        onClick={e => e.stopPropagation()}>
        <button onClick={onCerrar} aria-label="Cerrar"
          className="absolute top-1 right-1 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">
          <X className="w-4 h-4" />
        </button>
        <QR value={pedido.codigo_reserva} size={168} />
        <p className="font-mono text-[14px] text-[#ececf1] mt-3">{pedido.codigo_reserva}</p>
        <p className="text-[12px] text-[#a6a6b5] mt-1">{nombre}</p>
        <p className="text-[11px] text-[#8a8a9c] mt-1">
          {pedido.gramos} g de {lote?.codigo ?? '—'} · ${Number(pedido.monto_reembolso).toLocaleString('es-AR')}
        </p>
        <p className="text-[11px] mt-2" style={{ color: estaVencido(pedido) ? '#ff8a7a' : '#fbbf24' }}>
          {new Date(pedido.fecha_expiracion).toLocaleString('es-AR')}
        </p>
        <button onClick={onCerrar} className={`${btnPrimario} w-full mt-4`}>Cerrar</button>
      </div>
    </div>
  )
}

/**
 * CU-06 paso 2 y 3: se valida, se cobra si corresponde, y se consolida.
 *
 * El default de "cobré el efectivo" es apagado y hay que tildarlo a mano: dar por
 * cobrado lo que no se cobró deja un faltante en la caja que aparece un mes
 * después, cuando ya nadie se acuerda de esta entrega.
 */
function ModalEntrega({
  pedido, lote, paciente, asociado, dispensas, caja, entidad, onCerrar, onEntregado,
}: {
  pedido: Pedido
  lote: Lote | null
  paciente: Paciente | null
  asociado: Asociado | null
  dispensas: Dispensa[]
  caja: AsientoCaja[]
  entidad: Entidad | null
  onCerrar: () => void
  /**
   * El recibo generado y la dispensa de la que salio. Van juntos porque el
   * papel se archiva con el numero, el paciente y el monto, y todo eso vive en
   * la dispensa, no en el texto.
   */
  onEntregado: (
    doc: { titulo: string; texto: string; faltantes: string[] },
    de: Dispensa | null,
  ) => void
}) {
  const refDialogo2 = useDialogo(onCerrar)
  const chequeo = chequearRetiro(pedido)
  const [cobrado, setCobrado] = useState(false)
  const [entregadoPor, setEntregadoPor] = useState('')
  const [guardando, setGuardando] = useState(false)

  const proximoRecibo = useMemo(
    () => Math.max(0, ...dispensas.map(d => Number(d.recibo_numero) || 0)) + 1,
    [dispensas])

  const confirmar = async () => {
    if (!lote) { toast.error('No se encontró el lote de esta reserva'); return }
    if (chequeo.cobrarEnSede && !cobrado) {
      toast.error('Marcá que cobraste el efectivo antes de entregar')
      return
    }
    setGuardando(true)
    try {
      const { dispensa, asiento } = consolidarEntrega(pedido, lote, {
        entregadoPor: entregadoPor.trim() || null,
        reciboNumero: proximoRecibo,
      })
      await ongService.guardarDispensa(dispensa)

      // Se relee para agarrar el id que asignó la base: sin él, el pedido queda
      // sin poder señalar de qué entrega salió.
      const frescas = await ongService.getDispensas()
      const nueva = frescas.find(d => d.pago_referencia === pedido.codigo_reserva) ?? null

      await ongService.guardarAsiento({ ...asiento, dispensa_id: nueva?.id ?? null })
      await portalService.guardarPedido({
        id: pedido.id,
        estado_pedido: 'Entregado',
        estado_pago: 'Abonado',
        dispensa_id: nueva?.id ?? null,
        entregado_en: new Date().toISOString(),
      })

      toast.success(`Entregado · recibo N° ${proximoRecibo} · $${Number(pedido.monto_reembolso).toLocaleString('es-AR')} a caja`)
      const emitida = nueva ?? ({ ...dispensa, id: '' } as Dispensa)
      onEntregado(reciboReembolso(emitida, entidad, paciente, asociado), emitida)
    } catch (e) { toast.error((e as Error).message) }
    finally { setGuardando(false) }
  }

  return (
    <div ref={refDialogo2} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onCerrar}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#1f1f2b] flex items-center gap-2">
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
            Entregar {pedido.codigo_reserva}
          </h3>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="ml-auto min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="rounded-lg bg-[#15151d] border border-[#1f1f2b] p-3 space-y-1">
            <p className="text-[12px] text-[#ececf1]">{paciente ? nombreParaMostrar(paciente) : 'sin paciente'}</p>
            <p className="text-[11px] text-[#8a8a9c]">
              DNI {paciente?.dni ?? '—'} · REPROCANN {paciente?.reprocann_nro ?? '—'}
            </p>
            <p className="text-[11px] text-[#a6a6b5] pt-1">
              {pedido.gramos} g de {lote?.codigo ?? '—'} · ${Number(pedido.monto_reembolso).toLocaleString('es-AR')}
            </p>
          </div>

          {chequeo.motivos.map((m, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg px-2.5 py-2 border"
              style={{ background: 'rgba(255,138,122,0.08)', borderColor: 'rgba(255,138,122,0.30)' }}>
              <X className="w-3.5 h-3.5 text-[#ff8a7a] flex-shrink-0 mt-px" />
              <div>
                <p className="text-[11px] text-[#d4d4dd] leading-snug">{m.texto}</p>
                {m.comoSeResuelve && <p className="text-[10px] text-[#8a8a9c] mt-0.5">{m.comoSeResuelve}</p>}
              </div>
            </div>
          ))}

          {chequeo.cobrarEnSede && (
            <label className="flex items-start gap-2 rounded-lg bg-[#15151d] border border-[#2a2a3a] p-3 min-h-[44px] cursor-pointer">
              <input type="checkbox" checked={cobrado} onChange={e => setCobrado(e.target.checked)}
                className="w-4 h-4 accent-[#a3e635] mt-0.5" />
              <span className="text-[11px] text-[#d4d4dd] leading-snug">
                Cobré ${Number(pedido.monto_reembolso).toLocaleString('es-AR')} en efectivo.
                <span className="block text-[10px] text-[#8a8a9c] mt-0.5">
                  Al confirmar se asienta como ingreso en el Libro de Caja.
                </span>
              </span>
            </label>
          )}

          <label>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-1">
              Quién entrega
            </span>
            <input className={`w-full px-3 py-2.5 sm:py-2 sm:text-[12px] ${campoBase}`}
              value={entregadoPor} onChange={e => setEntregadoPor(e.target.value)}
              placeholder="Nombre de quien atiende" />
          </label>

          <p className="text-[11px] text-[#8a8a9c] leading-relaxed">
            Al confirmar se registra la dispensa, se asienta el reembolso en caja
            {caja.length > 0 ? '' : ' (primer asiento del libro)'} y se genera el
            recibo oficial N° {proximoRecibo} con la leyenda legal.
          </p>
        </div>

        <div className="px-4 py-3 border-t border-[#1f1f2b] flex gap-2">
          <button onClick={onCerrar} className={btnSutil}>Cancelar</button>
          <button onClick={confirmar} disabled={!chequeo.puedeEntregar || guardando}
            className={`${btnPrimario} flex-1`}>
            {guardando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Registrando…</> : 'Confirmar entrega'}
          </button>
        </div>
      </div>
    </div>
  )
}
