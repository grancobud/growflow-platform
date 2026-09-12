// CU-04 y CU-05: onboarding legal y auto-reserva.
//
// El orden de la pantalla es el orden en que el SRS manda evaluar: primero quién
// es la persona y si está habilitada, y recién después qué se lleva. Al revés
// —elegir el material y enterarse al final de que el REPROCANN venció— es la
// forma más rápida de que alguien discuta el bloqueo con el material ya elegido.
//
// Los bloqueos que se pueden resolver en el momento traen su botón al lado. Un
// cartel que dice "falta firmar el mandato" y no ofrece firmarlo obliga a salir,
// buscar otra pantalla y volver a empezar.

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
// Vía el wrapper compartido: react-qr-code es CJS y el import directo llega como
// objeto, no como componente. Rompe recién al renderizar, no al compilar.
import QR from '../../QR'
import {
  ShieldCheck, AlertTriangle, ClipboardList, FileSignature, Upload, Check, Loader2, X,
} from 'lucide-react'
import {
  portalService, evaluarPaciente, revisarReserva, disponibleDeLote, codigoReserva,
  montoSugerido, vencimiento, ipPublica, METODOS_PAGO,
  type Lote, type Pedido, type MetodoPago, type Bloqueo,
} from '../../../lib/portal'
import { ddjjMandato } from '../../../lib/documentosLegales'
import type { Dispensa, FeedbackClinico, Asociado, Entidad } from '../../../lib/ong'
import type { Paciente } from '../../../lib/registro'
import { ModalFeedback } from '../Seguimiento'
import { VisorDocumento } from '../ActaParaLibro'
import { btnPrimario, btnSutil, inputFormulario, etiquetaCampo } from '../../../lib/ui'
import { useDialogo } from '../../../lib/useDialogo'
import { SelectorPersona } from '../SelectorPersona'
import { nombreParaMostrar } from '../../../lib/buscarPersonas'


export function NuevaReserva({
  lotes, pedidos, pacientes, asociados, dispensas, feedbacks, entidad, onCerrar, onCambio,
}: {
  lotes: Lote[]
  pedidos: Pedido[]
  pacientes: Paciente[]
  asociados: Asociado[]
  dispensas: Dispensa[]
  feedbacks: FeedbackClinico[]
  entidad: Entidad | null
  onCerrar: () => void
  onCambio: () => void
}) {
  const [pacienteId, setPacienteId] = useState('')
  const [loteId, setLoteId] = useState('')
  const [gramos, setGramos] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>('Efectivo_Sede')
  const [comprobante, setComprobante] = useState<File | null>(null)
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [firmando, setFirmando] = useState(false)
  const [verMandato, setVerMandato] = useState(false)
  const [encuesta, setEncuesta] = useState<Dispensa | null>(null)
  const [creada, setCreada] = useState<Pedido | null>(null)

  const paciente = pacientes.find(p => p.id === pacienteId) ?? null
  const lote = lotes.find(l => l.id === loteId) ?? null

  const estado = useMemo(
    () => paciente ? evaluarPaciente(paciente, { asociados, dispensas, feedbacks, pedidos }) : null,
    [paciente, asociados, dispensas, feedbacks, pedidos])

  const g = Number(gramos) || 0
  const avisos = useMemo(
    () => paciente ? revisarReserva(g, lote, estado, pedidos, dispensas) : [],
    [paciente, g, lote, estado, pedidos, dispensas])
  // En modo beta los errores se siguen viendo —en rojo, con su regla— pero no
  // frenan. El freno no se borra: se suspende, y Coherencia avisa que esta asi.
  const hayError = avisos.some(a => a.nivel === 'error')
  const bloqueado = hayError && !entidad?.modo_beta
  const monto = lote ? montoSugerido(lote, g) : 0

  const disponibles = lotes.filter(l => l.activo !== false && disponibleDeLote(l, pedidos, dispensas).disponible > 0)

  // CU-04: la firma queda con timestamp e IP, que es lo que acredita cuándo y
  // desde dónde se aceptó el mandato.
  const firmarMandato = async () => {
    if (!estado?.asociado) return
    setFirmando(true)
    try {
      const ip = await ipPublica()
      await portalService.firmarMandato(estado.asociado.id, ip)
      toast.success(ip
        ? `Mandato firmado · ${new Date().toLocaleString('es-AR')} desde ${ip}`
        : 'Mandato firmado. No se pudo registrar la IP, quedó el timestamp.')
      onCambio()
    } catch (e) { toast.error((e as Error).message) }
    finally { setFirmando(false) }
  }

  const reservar = async () => {
    if (!paciente || !lote) return
    setGuardando(true)
    try {
      let comp: { path: string; nombre: string } | null = null
      if (metodo === 'Transferencia_Billetera' && comprobante) {
        comp = await portalService.subirComprobante(comprobante)
      }
      const codigo = codigoReserva(pedidos.map(p => p.codigo_reserva))
      const asociado = estado?.asociado ?? null
      const nuevo: Partial<Pedido> = {
        codigo_reserva: codigo,
        lote_id: lote.id,
        paciente_id: paciente.id,
        asociado_id: asociado?.id ?? null,
        gramos: g,
        monto_reembolso: monto,
        metodo_pago: metodo,
        estado_pago: metodo === 'Transferencia_Billetera' ? 'Pendiente_Verificacion' : 'Pendiente_Efectivo',
        estado_pedido: 'Reservado',
        fecha_expiracion: vencimiento(),
        comprobante_path: comp?.path ?? null,
        comprobante_nombre: comp?.nombre ?? null,
        notas: notas.trim() || null,
      }
      await portalService.guardarPedido(nuevo)
      const frescos = await portalService.getPedidos()
      setCreada(frescos.find(p => p.codigo_reserva === codigo) ?? (nuevo as Pedido))
      toast.success(`Reserva ${codigo} creada · 72 h para retirar`)
      onCambio()
    } catch (e) { toast.error((e as Error).message) }
    finally { setGuardando(false) }
  }

  // Paso final: el QR de retiro que el paciente presenta en la sede.
  if (creada) {
    return (
      <Marco titulo={`Reserva ${creada.codigo_reserva}`} onCerrar={onCerrar}
        pie={null}>
        <div className="text-center">
          <QR value={creada.codigo_reserva} size={168} />
          <p className="font-mono text-[15px] text-[#ececf1] mt-3">{creada.codigo_reserva}</p>
          <p className="text-[12px] text-[#a6a6b5] mt-1">
            {creada.gramos} g de {lote?.codigo} · ${monto.toLocaleString('es-AR')}
          </p>
          <p className="text-[11px] text-[#fbbf24] mt-2">
            Vence el {new Date(creada.fecha_expiracion).toLocaleString('es-AR')}
          </p>
          <p className="text-[11px] text-[#8a8a9c] mt-3 leading-relaxed">
            Mostrá este código en la sede junto con el DNI. Pasadas las 72 horas la reserva expira
            y el material vuelve al inventario.
          </p>
        </div>
      </Marco>
    )
  }

  return (
    <>
      <Marco titulo="Nueva reserva" onCerrar={onCerrar}
        pie={
          <>
            {hayError && entidad?.modo_beta && (
              <p className="text-[11px] text-[#fbbf24] leading-relaxed mb-2">
                Hay bloqueos activos, pero el <b>modo beta</b> está prendido y no frenan.
                Se registra igual y queda constancia de lo que faltaba.
              </p>
            )}
            <button onClick={reservar} disabled={bloqueado || guardando || !paciente || !lote}
              className={`${btnPrimario} flex-1`}>
              {guardando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reservando…</> : 'Reservar 72 h'}
            </button>
          </>
        }>

        <label><span className={etiquetaCampo}>1 · Quién retira</span>
          <SelectorPersona personas={pacientes} valor={pacienteId}
            onElegir={id => setPacienteId(id ?? '')} />
        </label>

        {estado && (
          <>
            <FichaHabilitacion estado={estado} />

            {estado.mandatoPendiente && estado.asociado && (
              <div className="rounded-lg bg-[#15151d] border border-[#2a2a3a] p-3 space-y-2">
                <p className="text-[11px] text-[#d4d4dd] leading-relaxed">
                  <FileSignature className="w-3.5 h-3.5 inline text-[#a3e635] mr-1" />
                  Hace falta la Declaración Jurada de Vinculación Exclusiva y Mandato de Gestión
                  Operativa. Es lo que sostiene que la entrega no es una compraventa.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setVerMandato(true)} className={btnSutil}>Leer el texto</button>
                  <button onClick={firmarMandato} disabled={firmando} className={btnPrimario}>
                    {firmando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Firmando…</>
                      : <><Check className="w-3.5 h-3.5" /> Firmar mandato</>}
                  </button>
                </div>
              </div>
            )}

            {estado.dispensaSinReporte && (
              <button onClick={() => setEncuesta(estado.dispensaSinReporte)}
                className="w-full text-left rounded-lg bg-[#15151d] border border-[#2a2a3a] hover:border-[#404d20] p-3 min-h-[44px] transition-colors">
                <p className="text-[11px] text-[#d4d4dd] leading-relaxed">
                  <ClipboardList className="w-3.5 h-3.5 inline text-[#a3e635] mr-1" />
                  Completar la Encuesta de Seguimiento Terapéutico de la entrega del{' '}
                  {estado.dispensaSinReporte.fecha} para destrabar el catálogo.
                </p>
              </button>
            )}
          </>
        )}

        {estado?.puedeReservar && (
          <>
            <div className="pt-2 border-t border-[#1f1f2b]">
              <label><span className={etiquetaCampo}>2 · De qué lote</span>
                <select className={inputFormulario} value={loteId} onChange={e => setLoteId(e.target.value)}>
                  <option value="">Elegir lote…</option>
                  {disponibles.map(l => {
                    const d = disponibleDeLote(l, pedidos, dispensas)
                    return (
                      <option key={l.id} value={l.id}>
                        {l.codigo} · {l.producto} · {Math.round(d.disponible)} g disponibles
                      </option>
                    )
                  })}
                </select>
              </label>
              {disponibles.length === 0 && (
                <p className="text-[11px] text-[#fbbf24] mt-1.5">
                  No hay lotes con material disponible. Cargá uno en el catálogo.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label><span className={etiquetaCampo}>Gramos</span>
                <input className={inputFormulario} type="number" inputMode="decimal" value={gramos}
                  onChange={e => setGramos(e.target.value)} placeholder="0" /></label>
              <div>
                <span className={etiquetaCampo}>Reembolso</span>
                <div className="px-3 py-2.5 sm:py-2 rounded-lg bg-[#15151d] border border-[#2a2a3a] min-h-[44px] sm:min-h-0 flex items-center">
                  <span className="font-display font-semibold text-[15px] text-[#a3e635]">
                    ${monto.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <span className={etiquetaCampo}>3 · Cómo paga</span>
              <div className="space-y-1.5">
                {METODOS_PAGO.map(m => (
                  <button key={m.valor} type="button" onClick={() => setMetodo(m.valor)}
                    className="w-full text-left px-3 py-2.5 min-h-[44px] rounded-lg border transition-colors"
                    style={metodo === m.valor
                      ? { borderColor: '#404d20', background: 'rgba(163,230,53,0.10)' }
                      : { borderColor: '#2a2a3a', background: '#15151d' }}>
                    <p className="text-[12px]" style={{ color: metodo === m.valor ? '#d9f99d' : '#ececf1' }}>
                      {m.label}
                    </p>
                    <p className="text-[10px] text-[#8a8a9c] mt-0.5">{m.detalle}</p>
                  </button>
                ))}
              </div>
            </div>

            {metodo === 'Transferencia_Billetera' && (
              <label className="block">
                <span className={etiquetaCampo}>Comprobante</span>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#15151d] border border-[#2a2a3a] min-h-[44px]">
                  <Upload className="w-3.5 h-3.5 text-[#8a8a9c] flex-shrink-0" />
                  <span className="text-[11px] text-[#a6a6b5] truncate">
                    {comprobante?.name ?? 'Adjuntar (opcional ahora, obligatorio para acreditar)'}
                  </span>
                </div>
                <input type="file" accept="image/*,application/pdf" className="sr-only"
                  onChange={e => setComprobante(e.target.files?.[0] ?? null)} />
              </label>
            )}

            <label><span className={etiquetaCampo}>Notas</span>
              <input className={inputFormulario} value={notas} onChange={e => setNotas(e.target.value)} /></label>
          </>
        )}

        {avisos.filter(a => !estado?.bloqueos.includes(a)).map((a, i) => <Aviso key={i} a={a} />)}
      </Marco>

      {verMandato && estado?.asociado && (() => {
        const doc = ddjjMandato(estado.asociado, entidad, paciente)
        return <VisorDocumento titulo={doc.titulo} texto={doc.texto} faltantes={doc.faltantes}
          entidad={entidad}
          onEmitido={onCambio}
          archivo={{ subtipo: 'Mandato de cultivo solidario', paciente_id: paciente?.id ?? null }}
          nota="Se imprime y se firma en papel. El botón 'Firmar mandato' registra la aceptación en el sistema con fecha, hora e IP."
          onCerrar={() => setVerMandato(false)} />
      })()}

      {encuesta && (
        <ModalFeedback dispensa={encuesta} nombre={paciente ? nombreParaMostrar(paciente) : ''}
          onCerrar={() => setEncuesta(null)} onCambio={onCambio} />
      )}
    </>
  )
}

function FichaHabilitacion({ estado }: { estado: ReturnType<typeof evaluarPaciente> }) {
  const { cupo } = estado
  return (
    <div className="rounded-lg bg-[#15151d] border border-[#1f1f2b] p-3">
      <div className="flex items-center gap-2">
        {estado.puedeReservar
          ? <ShieldCheck className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} />
          : <AlertTriangle className="w-4 h-4 text-[#ff8a7a]" strokeWidth={1.8} />}
        <p className="text-[12px] font-medium" style={{ color: estado.puedeReservar ? '#d9f99d' : '#ff8a7a' }}>
          {estado.puedeReservar ? 'Habilitado para reservar' : 'No puede reservar todavía'}
        </p>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {[
          { l: 'Entregado 30 d', v: `${Math.round(cupo.entregado)} g` },
          { l: 'Reservado', v: `${Math.round(cupo.reservado)} g` },
          { l: 'Cupo libre', v: cupo.remanente != null ? `${Math.round(cupo.remanente)} g` : '—',
            c: cupo.remanente === 0 ? '#ff8a7a' : '#a3e635' },
        ].map(k => (
          <div key={k.l}>
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">{k.l}</p>
            <p className="font-display font-semibold text-[14px] mt-0.5" style={{ color: k.c ?? '#ececf1' }}>{k.v}</p>
          </div>
        ))}
      </div>

      {estado.bloqueos.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {estado.bloqueos.map((b, i) => <Aviso key={i} a={b} />)}
        </div>
      )}
    </div>
  )
}

function Aviso({ a }: { a: Bloqueo }) {
  const err = a.nivel === 'error'
  return (
    <div className="flex items-start gap-2 rounded-lg px-2.5 py-2 border"
      style={err
        ? { background: 'rgba(255,138,122,0.08)', borderColor: 'rgba(255,138,122,0.30)' }
        : { background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.30)' }}>
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" style={{ color: err ? '#ff8a7a' : '#fbbf24' }} />
      <div className="min-w-0">
        <p className="text-[11px] text-[#d4d4dd] leading-snug">
          <span className="text-[#8a8a9c] font-mono text-[10px] mr-1">{a.regla}</span>
          {a.texto}
        </p>
        {a.comoSeResuelve && (
          <p className="text-[10px] text-[#8a8a9c] mt-0.5 leading-snug">{a.comoSeResuelve}</p>
        )}
      </div>
    </div>
  )
}

function Marco({ titulo, onCerrar, pie, children }: {
  titulo: string; onCerrar: () => void; pie: React.ReactNode; children: React.ReactNode
}) {
  const refDialogo = useDialogo(onCerrar)
  return (
    <div ref={refDialogo} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onCerrar}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#1f1f2b] sticky top-0 bg-[#0d0d12] z-10 flex items-center gap-2">
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">{titulo}</h3>
          {/* La X vive en el marco, no en el pie: el pie lo arma cada uso y
              puede no traer ningun boton que cierre. */}
          <button onClick={onCerrar} aria-label="Cerrar"
            className="ml-auto min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
        <div className="px-4 py-3 border-t border-[#1f1f2b] flex gap-2 sticky bottom-0 bg-[#0d0d12]">
          <button onClick={onCerrar} className={btnSutil}>Cancelar</button>
          {pie}
        </div>
      </div>
    </div>
  )
}
