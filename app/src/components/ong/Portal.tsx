// Portal de autodispensación: el circuito completo del SRS v3.2.
//
// Catálogo → reserva → 72 horas → retiro. Las tres vistas están en la misma
// pantalla porque son el mismo circuito visto desde tres momentos, y separarlas
// en pestañas lejanas obligaría a saltar entre ellas para responder algo tan
// básico como "¿de qué lote salía esta reserva?".
//
// Al abrir se expiran las reservas vencidas. No hay cron: si nadie corriera esa
// limpieza, el material de una reserva que nadie retiró quedaría apartado para
// siempre y el catálogo mostraría menos disponible del que hay.

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Store, Plus, Package, Ticket } from 'lucide-react'
import { portalService, resumenCatalogo, estaVivo, estaVencido, type Lote, type Pedido } from '../../lib/portal'
import type { Dispensa, FeedbackClinico, Asociado, Entidad, AsientoCaja } from '../../lib/ong'
import type { Paciente } from '../../lib/registro'
import { Catalogo } from './portal/Catalogo'
import { Reservas } from './portal/Reservas'
import { NuevaReserva } from './portal/NuevaReserva'
import { btnPrimario } from '../../lib/ui'

type Vista = 'reservas' | 'catalogo'

interface Genetica { id: string; nombre: string }

export function Portal({
  pacientes, asociados, dispensas, feedbacks, caja, entidad, geneticas,
  gramosCosechados = 0, documentos = [], onCambio,
}: {
  pacientes: Paciente[]
  asociados: Asociado[]
  dispensas: Dispensa[]
  feedbacks: FeedbackClinico[]
  caja: AsientoCaja[]
  entidad: Entidad | null
  geneticas: Genetica[]
  /** Pasa al catálogo, que avisa si lo cosechado todavía no es un lote. */
  gramosCosechados?: number
  /** Sólo por su proveedor: la lista se comparte con el comprobante de gasto. */
  documentos?: { proveedor?: string | null }[]
  onCambio: () => void
}) {
  // La solapa puede venir pedida por la URL: `?vista=catalogo`.
  //
  // El flujo de comprar material manda acá a crear el lote, y los lotes viven en
  // Catálogo. Abrir siempre en Reservas dejaba en la pantalla correcta y en la
  // solapa equivocada, que es la mitad del problema que la guía vino a resolver.
  const vistaPedida = new URLSearchParams(window.location.search).get('vista')
  const [vista, setVista] = useState<Vista>(
    vistaPedida === 'catalogo' || vistaPedida === 'reservas' ? vistaPedida : 'reservas')
  const [lotes, setLotes] = useState<Lote[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [cargando, setCargando] = useState(true)
  const [reservando, setReservando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [l, p] = await Promise.all([portalService.getLotes(), portalService.getPedidos()])
      setLotes(l)
      const vencidas = p.filter(x => estaVencido(x))
      if (vencidas.length > 0) {
        await portalService.expirarVencidas(p)
        setPedidos(await portalService.getPedidos())
        toast.info(vencidas.length === 1
          ? '1 reserva venció y su material volvió al inventario'
          : `${vencidas.length} reservas vencieron y su material volvió al inventario`)
      } else {
        setPedidos(p)
      }
    } catch (e) {
      toast.error(`Error cargando el portal: ${(e as Error).message}`)
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // El portal toca dispensas y caja al entregar, así que refresca las dos cosas.
  const refrescar = useCallback(() => { cargar(); onCambio() }, [cargar, onCambio])

  const r = resumenCatalogo(lotes, pedidos)
  const pendientes = pedidos.filter(p => estaVivo(p) && !estaVencido(p)).length

  const VISTAS: { id: Vista; label: string; icono: typeof Package; badge?: number }[] = [
    { id: 'reservas', label: 'Reservas', icono: Ticket, badge: pendientes },
    { id: 'catalogo', label: 'Catálogo', icono: Package, badge: r.lotes },
  ]

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} />
              <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Autodispensación</h3>
            </div>
            <p className="text-[11px] text-[#8a8a9c] mt-1.5 leading-relaxed max-w-prose">
              El paciente reserva del catálogo, tiene 72 horas para retirar y en la sede se valida y se
              entrega. Recién ahí nace la dispensa, el asiento en caja y el recibo: una reserva sin
              retirar todavía no es una entrega.
            </p>
          </div>
          <button onClick={() => setReservando(true)} disabled={cargando} className={btnPrimario}>
            <Plus className="w-3.5 h-3.5" /> Reservar
          </button>
        </div>

        <div className="flex gap-1.5 mt-3 flex-wrap">
          {VISTAS.map(v => {
            const Icono = v.icono
            const activa = vista === v.id
            return (
              <button key={v.id} onClick={() => setVista(v.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border text-[12px] transition-colors"
                style={activa
                  ? { borderColor: '#404d20', background: 'rgba(163,230,53,0.12)', color: '#d9f99d' }
                  : { borderColor: '#2a2a3a', background: '#15151d', color: '#a6a6b5' }}>
                <Icono className="w-3.5 h-3.5" />
                {v.label}
                {v.badge != null && v.badge > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#15151d] border border-[#2a2a3a] text-[#a6a6b5] tabular-nums">
                    {v.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {cargando ? (
        <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] py-10 text-center">
          <p className="text-[12px] text-[#8a8a9c]">Cargando el portal…</p>
        </div>
      ) : vista === 'catalogo' ? (
        <Catalogo lotes={lotes} pedidos={pedidos} dispensas={dispensas} geneticas={geneticas}
          gramosCosechados={gramosCosechados}
          documentos={documentos} onCambio={cargar} />
      ) : (
        <Reservas {...{ pedidos, lotes, pacientes, asociados, dispensas, caja, entidad }}
          onCambio={refrescar} />
      )}

      {reservando && (
        <NuevaReserva {...{ lotes, pedidos, pacientes, asociados, dispensas, feedbacks, entidad }}
          onCerrar={() => setReservando(false)} onCambio={refrescar} />
      )}
    </div>
  )
}
