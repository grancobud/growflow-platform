// Saldo con proveedores.
//
// La pregunta "¿cuánto le debemos a Lisa Culti A?" no se podía hacer. Las
// órdenes de servicio tenían el saldo escrito ADENTRO de la descripción —sirve
// para leerlo de a uno y para nada más— y los pagos no estaban en ningún lado.
//
// Los números salen de dos vistas que los CALCULAN sumando los pagos, no de
// una columna que haya que mantener sincronizada. Un saldo guardado se
// desincroniza al primer pago que alguien corrija; uno calculado no puede.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { tarjeta, etiquetaCampo } from '../../lib/ui'
import { toast } from 'sonner'
import { Loader2, Landmark, AlertTriangle, ChevronRight, Sprout } from 'lucide-react'
import {
  saldosService, totalesProveedores, produccionPorProductor, separarProduccionPropia,
  MEDIOS_PAGO,
  type SaldoProveedor, type SaldoOrden, type LoteIngreso, type Entidad,
} from '../../lib/ong'
import { ModalFormulario } from './ModalFormulario'

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

export function Proveedores({ lotes = [], entidad }: {
  lotes?: LoteIngreso[]
  /** Para saber con qué nombre figura la propia entidad. Ver `proveedor_propio`. */
  entidad?: Entidad | null
}) {
  const [filas, setFilas] = useState<SaldoProveedor[]>([])
  const [ordenes, setOrdenes] = useState<SaldoOrden[]>([])
  const [abierto, setAbierto] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [pagando, setPagando] = useState<SaldoOrden | null>(null)

  const cargar = useCallback(async () => {
    try {
      const [p, o] = await Promise.all([
        saldosService.getPorProveedor(),
        saldosService.getOrdenes(true),
      ])
      setFilas(p); setOrdenes(o)
    } catch (e) {
      toast.error(`No se pudo cargar el saldo: ${(e as Error).message}`)
    } finally { setCargando(false) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  // La produccion propia sale del saldo ANTES de cualquier total: no se le debe
  // a nadie. Si la entidad no declaro un nombre propio, `propia` va vacio y todo
  // sigue exactamente como antes.
  const { terceros, propia } = useMemo(
    () => separarProduccionPropia(filas, entidad?.proveedor_propio), [filas, entidad])
  const t = useMemo(() => totalesProveedores(terceros), [terceros])
  const tPropia = useMemo(() => totalesProveedores(propia), [propia])
  // Productor y proveedor son la misma persona: la planilla usa dos columnas
  // para lo mismo. Mostrarlo acá y no en una pantalla aparte es lo que deja
  // ver de una que a Lisa le compraste 810 g y no le debes nada.
  const produccion = useMemo(() => produccionPorProductor(lotes), [lotes])
  const gramosTotal = useMemo(
    () => produccion.reduce((s2, x) => s2 + x.gramos, 0), [produccion])
  const conSaldo = useMemo(() => terceros.filter(f => Number(f.saldo) > 0), [terceros])
  const maxSaldo = useMemo(
    () => conSaldo.reduce((m, f) => Math.max(m, Number(f.saldo) || 0), 0), [conSaldo])

  if (cargando) {
    return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#a3e635]" /></div>
  }

  if (filas.length === 0) {
    return (
      <div className={`${tarjeta} text-center py-8`}>
        <Landmark className="w-7 h-7 text-[#2a2a3a] mx-auto" strokeWidth={1.5} />
        <p className="text-[12px] text-[#8a8a9c] mt-2">
          Todavía no hay órdenes de servicio cargadas. El saldo se arma solo:
          cada orden suma lo comprado y cada pago lo descuenta.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {pagando && (
        <ModalPago orden={pagando} onCerrar={() => setPagando(null)}
          onGuardado={() => { setPagando(null); cargar() }} />
      )}
      <div className={tarjeta}>
        <div className="flex items-center gap-2 mb-1">
          <Landmark className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Saldo con proveedores</h3>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mb-3">
          Lo comprado por orden de servicio menos lo efectivamente pagado. Es lo
          que tenés que poder responder si te preguntan cuánto se debe.
        </p>

        <div className="grid grid-cols-3 gap-2">
          <Caja t="Comprado" v={pesos(t.comprado)} c="#a6a6b5" />
          <Caja t="Pagado" v={pesos(t.pagado)} c="#a3e635" />
          <Caja t="Saldo" v={pesos(t.saldo)} c={t.saldo > 0 ? '#fbbf24' : '#38bdf8'} />
        </div>

        {t.pctPagado != null && (
          <>
            <div className="mt-3 h-1.5 rounded-full bg-[#1f1f2b] overflow-hidden">
              <div className="h-full rounded-full bg-[#a3e635]" style={{ width: `${Math.min(100, t.pctPagado)}%` }} />
            </div>
            <p className="text-[10px] text-[#8a8a9c] mt-1">
              Pagado el {t.pctPagado.toFixed(1)}% de {t.ordenes} órdenes ·
              {' '}{t.conSaldo} de {t.proveedores} proveedores con saldo.
            </p>
          </>
        )}
      </div>

      {/* La produccion propia, aparte y ANTES de la lista.
          Va arriba porque es plata grande y quien mira el saldo tiene que ver
          de una que ese numero no es deuda. Enterrarla abajo dejaria la duda de
          si esta contada o no. */}
      {propia.length > 0 && (
        <div className={`${tarjeta} border-[#404d20] bg-[#a3e635]/[0.05]`}>
          <div className="flex items-center gap-2 mb-1">
            <Sprout className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} />
            <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
              Producción propia
            </h3>
          </div>
          <p className="text-[11px] text-[#8a8a9c] mb-2.5">
            Cargado a nombre de <b className="text-[#a6a6b5]">{entidad?.proveedor_propio}</b>,
            que es la propia asociación. No es deuda: no se le debe a nadie, así que
            no suma al saldo de arriba.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12px]">
            <span className="text-[#8a8a9c]">
              Producido <b className="text-[#d9f99d] tabular-nums font-semibold">{pesos(tPropia.comprado)}</b>
            </span>
            <span className="text-[#8a8a9c]">
              en <b className="text-[#a6a6b5] tabular-nums">{tPropia.ordenes}</b> órdenes
            </span>
          </div>
          <p className="text-[11px] text-[#8a8a9c] mt-2 leading-relaxed">
            Se sigue registrando porque es lo que costó producirlo, y de ahí sale el
            costo por gramo. Lo que cambia es que no cuenta como deuda.
          </p>
        </div>
      )}

      {conSaldo.map(f => {
        const saldo = Number(f.saldo) || 0
        const pct = Number(f.comprado) > 0 ? (Number(f.pagado) / Number(f.comprado)) * 100 : 0
        const suyas = ordenes.filter(o => o.proveedor === f.proveedor)
        const esta = abierto === f.proveedor
        // Un proveedor que concentra la mayor parte de la deuda merece que se lo
        // mire dos veces: suele ser una cuenta interna anotada como compra, no
        // una deuda con un tercero.
        const domina = t.saldo > 0 && saldo / t.saldo > 0.5
        return (
          <div key={f.proveedor} className={tarjeta}>
            <button
              onClick={() => setAbierto(esta ? null : f.proveedor)}
              className="w-full flex items-center gap-2 text-left min-h-[44px]">
              <ChevronRight className={`w-3.5 h-3.5 text-[#8a8a9c] shrink-0 transition-transform ${esta ? 'rotate-90' : ''}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-[#ececf1] truncate">{f.proveedor}</div>
                <div className="text-[10px] text-[#8a8a9c]">
                  {f.ordenes} orden{f.ordenes === 1 ? '' : 'es'} · {f.ordenes_con_saldo} con saldo ·
                  {' '}{pesos(Number(f.pagado))} de {pesos(Number(f.comprado))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[13px] font-semibold tabular-nums" style={{ color: saldo > 0 ? '#fbbf24' : '#38bdf8' }}>
                  {pesos(saldo)}
                </div>
                <div className="text-[10px] text-[#8a8a9c]">{Math.round(pct)}% pagado</div>
              </div>
            </button>

            <div className="mt-2 h-1 rounded-full bg-[#1f1f2b] overflow-hidden">
              <div className="h-full rounded-full bg-[#fbbf24]"
                style={{ width: `${maxSaldo > 0 ? (saldo / maxSaldo) * 100 : 0}%` }} />
            </div>

            {domina && !entidad?.proveedor_propio && (
              <p className="flex items-start gap-1.5 text-[11px] text-[#fbbf24] mt-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                Concentra el {Math.round((saldo / t.saldo) * 100)}% de todo el saldo.
                Si el nombre es el de la propia entidad, revisá si es deuda con un
                tercero o producción propia anotada como orden de servicio: no es
                lo mismo y cambia el total.
              </p>
            )}

            {esta && (
              <div className="mt-3 pt-3 border-t border-[#1f1f2b] space-y-1.5">
                {suyas.length === 0 ? (
                  <p className="text-[11px] text-[#8a8a9c]">Sin órdenes con saldo.</p>
                ) : suyas.map(o => (
                  <div key={`${o.orden_servicio}-${o.fecha ?? ''}-${o.total}`} className="flex items-baseline gap-2 text-[11px] flex-wrap">
                    <span className="font-mono text-[#a6a6b5]">{o.orden_servicio}</span>
                    <span className="text-[10px] text-[#8a8a9c]">{o.fecha ?? 'sin fecha'}</span>
                    {/* Qué trajo la orden. El código estaba adentro de la
                        descripción y no se podía cruzar contra el catálogo. */}
                    {o.lote_codigo && (
                      <span className="font-mono text-[10px] text-[#38bdf8]">{o.lote_codigo}</span>
                    )}
                    <span className="text-[10px] text-[#8a8a9c]">
                      {o.pagos} pago{o.pagos === 1 ? '' : 's'}
                    </span>
                    <span className="ml-auto text-[#8a8a9c] tabular-nums">
                      {pesos(Number(o.pagado))} / {pesos(Number(o.total))}
                    </span>
                    <span className="tabular-nums font-medium text-[#fbbf24] w-[92px] text-right">
                      {pesos(Number(o.saldo))}
                    </span>
                    {/* El boton va POR ORDEN y no por proveedor: sin saber que
                        orden quedo saldada, no se puede contestar cuando alguien
                        reclama una factura vieja. */}
                    <button type="button" onClick={() => setPagando(o)}
                      className="text-[11px] px-2.5 py-1.5 min-h-[44px] rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[#d9f99d]">
                      Anotar pago
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {conSaldo.length === 0 && (
        <div className={`${tarjeta} text-center py-6`}>
          <p className="text-[12px] text-[#a3e635]">
            No queda saldo pendiente con ningún proveedor.
          </p>
        </div>
      )}

      {produccion.length > 0 && (
        <div className={tarjeta}>
          <div className="flex items-center gap-2 mb-1">
            <Sprout className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} />
            <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
              Producción por productor
            </h3>
          </div>
          <p className="text-[11px] text-[#8a8a9c] mb-3">
            Cuánto entregó cada uno, sobre {Math.round(gramosTotal).toLocaleString('es-AR')} g
            en total. Sólo suma lo que se mide en gramos: los frascos van aparte.
          </p>
          <div className="space-y-2">
            {produccion.map(x => {
              const pct = gramosTotal > 0 ? (x.gramos / gramosTotal) * 100 : 0
              return (
                <div key={x.productor}>
                  <div className="flex items-baseline gap-2 text-[12px]">
                    <span className="text-[#ececf1] truncate min-w-0 flex-1">{x.productor}</span>
                    <span className="text-[10px] text-[#8a8a9c] shrink-0">
                      {x.lotes} lote{x.lotes === 1 ? '' : 's'}
                      {x.otrasUnidades > 0 && ` · ${x.otrasUnidades} fuera de gramos`}
                    </span>
                    <span className="tabular-nums text-[#d4d4dd] shrink-0 w-[86px] text-right">
                      {x.gramos.toLocaleString('es-AR')} g
                    </span>
                    <span className="tabular-nums text-[10px] text-[#8a8a9c] shrink-0 w-[42px] text-right">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-[#1f1f2b] overflow-hidden">
                    <div className="h-full rounded-full bg-[#a3e635]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Caja({ t, v, c }: { t: string; v: string; c: string }) {
  return (
    <div className="rounded-lg px-2 py-2 text-center border"
      style={{ borderColor: `${c}44`, background: `${c}11` }}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">{t}</div>
      <div className="text-[13px] font-semibold mt-0.5 tabular-nums" style={{ color: c }}>{v}</div>
    </div>
  )
}


const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[13px] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#a3e635]/60 transition-colors'

/**
 * Anotar un pago contra una orden.
 *
 * NO EXISTIA. La app calculaba el saldo restando los pagos y no tenia donde
 * cargar uno: los 157 que habia entraron todos por importacion. O sea que una
 * deuda pagada se quedaba en la pantalla para siempre, y la unica salida era
 * editar la tabla a mano desde `Tablas`.
 *
 * ARRANCA CON EL SALDO COMPLETO. Es lo que se paga casi siempre —una orden se
 * salda entera— y el que paga parcial lo baja. Al reves, arrancando en cero,
 * todos tendrian que escribir el numero completo todas las veces.
 *
 * ⚠ NO DEJA PAGAR DE MAS. Un pago mayor al saldo deja la orden en negativo y el
 * total del proveedor miente para abajo: parece que le deben menos de lo que le
 * deben. Es el mismo error que los lotes sobregirados, del otro lado.
 */
function ModalPago({ orden, onCerrar, onGuardado }: {
  orden: SaldoOrden
  onCerrar: () => void
  onGuardado: () => void
}) {
  const saldo = Number(orden.saldo) || 0
  const [monto, setMonto] = useState(String(saldo))
  const [fecha, setFecha] = useState(new Date().toLocaleDateString('en-CA'))
  const [medio, setMedio] = useState<string>('')
  const [referencia, setReferencia] = useState('')
  const [guardando, setGuardando] = useState(false)

  const n = Number(String(monto).replace(',', '.'))
  const invalido = !Number.isFinite(n) || n <= 0 ? 'Poné un monto mayor a cero'
    : n > saldo ? `No puede ser mayor al saldo (${pesos(saldo)})`
    : !fecha ? 'Falta la fecha'
    : null

  const guardar = async () => {
    if (invalido) { toast.error(invalido); return }
    setGuardando(true)
    try {
      const r = await saldosService.registrarPago({
        orden_servicio: orden.orden_servicio,
        proveedor: orden.proveedor ?? '',
        fecha, monto: n,
        medio: medio || null,
        referencia,
      })
      // El pago SIEMPRE se da por bueno: ya se guardó. Si además no se pudo
      // asentar en la caja se avisa aparte, sin frenar y sin empujar a
      // reintentar —un reintento acá duplica el pago—.
      toast.success(n === saldo ? 'Orden saldada' : 'Pago anotado')
      if (!r.asentado) {
        toast.warning('El pago quedó anotado, pero no se pudo asentar en la caja.', {
          description: 'Cargalo a mano en Movimientos para que el saldo cierre.',
          duration: 12000,
        })
      }
      onGuardado()
    } catch (e) {
      toast.error(`No se pudo guardar: ${(e as Error).message}`)
    } finally { setGuardando(false) }
  }

  return (
    <ModalFormulario titulo={`Anotar pago · ${orden.orden_servicio}`}
      onCerrar={onCerrar} onGuardar={guardando ? () => {} : guardar}>
      <p className="text-[11px] text-[#a6a6b5] leading-relaxed">
        {orden.proveedor} · saldo <b className="text-[#fbbf24] tabular-nums">{pesos(saldo)}</b> de{' '}
        <span className="tabular-nums">{pesos(Number(orden.total))}</span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label><span className={etiquetaCampo}>Monto</span>
          <input className={inputCls} value={monto} inputMode="decimal"
            onChange={e => setMonto(e.target.value)} /></label>
        <label><span className={etiquetaCampo}>Fecha</span>
          <input type="date" className={inputCls} value={fecha}
            onChange={e => setFecha(e.target.value)} /></label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label><span className={etiquetaCampo}>Medio</span>
          <select className={inputCls} value={medio} onChange={e => setMedio(e.target.value)}>
            <option value="">Sin especificar</option>
            {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
          </select></label>
        <label><span className={etiquetaCampo}>Referencia</span>
          <input className={inputCls} value={referencia} placeholder="N° de transferencia, recibo…"
            onChange={e => setReferencia(e.target.value)} /></label>
      </div>

      {invalido && <p className="text-[11px] text-[#ff8a7a]">{invalido}</p>}

      <p className="text-[11px] text-[#8a8a9c] leading-relaxed">
        El saldo no se marca: se calcula restando los pagos. Esto no se anota en el
        libro de caja — son dos registros distintos y cruzarlos contaría el pago dos veces.
      </p>
    </ModalFormulario>
  )
}