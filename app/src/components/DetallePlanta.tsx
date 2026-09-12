// DetallePlanta — modal con la linea de tiempo completa de una planta + fotos.
// Eventos ordenados cronologicamente (germino -> trasplantes -> poda -> flora -> cosecha),
// con miniaturas, subida de fotos y visor a pantalla completa.

import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  X, Camera, Loader2, Droplets, Scissors, FlaskConical, StickyNote,
  Sprout, Flower2, Repeat, AlertTriangle, RefreshCw, Image as ImageIcon, Scale, SprayCan,
  QrCode, ExternalLink, IdCard, Pencil,
} from 'lucide-react'
import { cultivoService, faseFueDerivada, type ResumenPlanta, type Cosecha } from '../lib/cultivo'
import type { LucideIcon } from 'lucide-react'
import { gruposService, type EventoConNivel, type NivelEvento } from '../lib/grupos'
import { registroService, type Paciente } from '../lib/registro'
import { supabase } from '../lib/supabase'
import { FotoPrivada } from './FotoPrivada'
import QR from './QR'
import { useDialogo } from '../lib/useDialogo'
import { SelectorPersona } from './ong/SelectorPersona'

/** Lo que la línea de tiempo usa de una aplicación. Mismo criterio que en lib/cultivo. */
interface FilaAplicacionDetalle {
  id: string; fecha: string
  categoria?: string | null; producto?: string | null
  dosis?: string | null; notas?: string | null
}

const ICONO: Record<string, { Ic: LucideIcon; color: string }> = {
  Riego: { Ic: Droplets, color: '#38bdf8' },
  Fertilizacion: { Ic: FlaskConical, color: '#bef264' },
  Poda: { Ic: Scissors, color: '#c4b5fd' },
  Trasplante: { Ic: Repeat, color: '#fb923c' },
  CambioFase: { Ic: Flower2, color: '#e879f9' },
  Entrenamiento: { Ic: RefreshCw, color: '#facc15' },
  Problema: { Ic: AlertTriangle, color: '#ff6b5a' },
  Foto: { Ic: ImageIcon, color: '#94a3b8' },
  Nota: { Ic: StickyNote, color: '#f59e0b' },
  Aplicacion: { Ic: SprayCan, color: '#c4b5fd' },
}

interface Item {
  id: string
  tipo: string
  fecha: string
  detalle: string | null
  foto_url: string | null
  esCosecha?: boolean
  /** A qué nivel se registró: la planta, su grupo o todo el lote. */
  nivel?: NivelEvento
  nivelNombre?: string | null
}

export default function DetallePlanta({ planta, onCerrar, onCambio }: {
  planta: ResumenPlanta
  onCerrar: () => void
  onCambio: () => void
}) {
  const refDialogo = useDialogo(onCerrar)
  const [items, setItems] = useState<Item[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [visor, setVisor] = useState<string | null>(null)
  const [mostrarQR, setMostrarQR] = useState(false)
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [pacienteId, setPacienteId] = useState<string>(planta.paciente_id ?? '')
  const [fechas, setFechas] = useState({ cosecha: '', envasado: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [evs, cosechas, aplic] = await Promise.all([
        // Trae lo de la planta MAS lo de su grupo y su lote. Sin esto, un riego
        // al grupo entero dejaria de verse en la planta que lo recibio, y B2
        // seria un retroceso: registrar una vez no puede significar ver menos.
        gruposService.timelineDePlanta(planta.id, 200),
        cultivoService.getCosechas(),
        supabase.from('aplicaciones').select('id,fecha,categoria,producto,dosis,notas').eq('planta_id', planta.id),
      ])
      const cos = (cosechas as Cosecha[]).filter(c => c.planta_id === planta.id)
      const lista: Item[] = [
        ...(evs as EventoConNivel[]).map(e => ({
          id: e.id, tipo: e.tipo, fecha: e.fecha, detalle: e.detalle, foto_url: e.foto_url,
          nivel: e.nivel, nivelNombre: e.nivelNombre,
        })),
        ...((aplic.data ?? []) as FilaAplicacionDetalle[]).map(a => ({
          id: a.id, tipo: 'Aplicacion', fecha: a.fecha, foto_url: null,
          detalle: [a.categoria, a.producto, a.dosis, a.notas].filter(Boolean).join(' · '),
        })),
        ...cos.map(c => ({
          id: c.id, tipo: 'Cosecha', fecha: c.fecha, esCosecha: true, foto_url: null,
          detalle: [c.peso_seco_g ? `${c.peso_seco_g}g secos` : null, c.peso_humedo_g ? `${c.peso_humedo_g}g húmedos` : null,
            c.valoracion ? `★ ${c.valoracion}/10` : null, c.notas_sabor, c.notas_curado].filter(Boolean).join(' · ') || 'Cosecha',
        })),
      ]
      // Mas reciente arriba; si comparten fecha, mantener orden de insercion
      lista.sort((a, b) => b.fecha.localeCompare(a.fecha))
      setItems(lista)
    } catch (err) {
      toast.error(`Error cargando línea de tiempo: ${(err as Error).message}`)
    } finally {
      setCargando(false)
    }
  }, [planta.id])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { registroService.getPacientes().then(setPacientes).catch(() => {}) }, [])
  useEffect(() => {
    cultivoService.getPlanta(planta.id)
      .then(p => setFechas({ cosecha: p.fecha_cosecha ?? '', envasado: p.fecha_envasado ?? '' }))
      .catch(() => {})
  }, [planta.id])

  const guardarFecha = async (campo: 'fecha_cosecha' | 'fecha_envasado', valor: string) => {
    setFechas(f => ({ ...f, [campo === 'fecha_cosecha' ? 'cosecha' : 'envasado']: valor }))
    try {
      await cultivoService.actualizarPlanta(planta.id, { [campo]: valor || null })
      onCambio()
    } catch (err) {
      toast.error(`No se pudo guardar: ${(err as Error).message}`)
    }
  }

  const asignarPaciente = async (id: string) => {
    setPacienteId(id)
    try {
      await cultivoService.actualizarPlanta(planta.id, { paciente_id: id || null })
      toast.success(id ? 'Paciente asignado' : 'Asignación quitada')
      onCambio()
    } catch (err) {
      toast.error(`No se pudo asignar: ${(err as Error).message}`)
    }
  }

  const urlQR = `${window.location.origin}/p/${planta.codigo ?? ''}`

  const subirFoto = async (file: File) => {
    setSubiendo(true)
    try {
      const url = await cultivoService.subirFoto(file)
      await cultivoService.crearEvento({ planta_id: planta.id, tipo: 'Foto', foto_url: url, detalle: null })
      toast.success('Foto agregada')
      cargar()
      onCambio()
    } catch (err) {
      toast.error(`No se pudo subir: ${(err as Error).message}`)
    } finally {
      setSubiendo(false)
    }
  }

  // Edicion en linea del timeline. Se editan los dos campos que se cargan mal
  // en la practica —la fecha y el texto—, no la fila entera: para el resto esta
  // Tablas, y un formulario completo aca convertiria el timeline en otra cosa.
  //
  // La cosecha es la excepcion: su "detalle" es un resumen armado con cinco
  // campos (pesos, valoracion, notas), asi que dejarlo editar como texto libre
  // escribiria una cadena que despues nadie puede volver a interpretar.
  const editable = (it: Item) => !it.esCosecha
  const [editando, setEditando] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<{ fecha: string; detalle: string }>({ fecha: '', detalle: '' })

  const abrirEdicion = (it: Item) => {
    setEditando(it.id)
    setBorrador({ fecha: it.fecha, detalle: it.detalle ?? '' })
  }

  const guardarEdicion = async (it: Item) => {
    const fecha = borrador.fecha
    if (!fecha) { toast.error('La fecha no puede quedar vacía.'); return }
    try {
      if (it.tipo === 'Aplicacion') {
        // En aplicaciones el texto del timeline junta cuatro columnas, asi que
        // lo editado va a `notas`: es la unica que es texto libre de verdad.
        const { error } = await supabase.from('aplicaciones')
          .update({ fecha, notas: borrador.detalle || null }).eq('id', it.id)
        if (error) throw new Error(error.message)
      } else {
        await cultivoService.actualizarEvento(it.id, { fecha, detalle: borrador.detalle || null })
      }
      setEditando(null)
      toast.success('Corregido')
      cargar(); onCambio()
    } catch (err) {
      toast.error(`No se pudo guardar: ${(err as Error).message}`)
    }
  }

  const borrar = async (it: Item) => {
    try {
      if (it.esCosecha) {
        const { error } = await supabase.from('cosechas').delete().eq('id', it.id)
        if (error) throw new Error(error.message)
      } else if (it.tipo === 'Aplicacion') {
        const { error } = await supabase.from('aplicaciones').delete().eq('id', it.id)
        if (error) throw new Error(error.message)
      } else {
        await cultivoService.eliminarEvento(it.id)
      }
      cargar(); onCambio()
    } catch (err) {
      toast.error(`No se pudo borrar: ${(err as Error).message}`)
    }
  }

  const fmt = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })

  return (
    <div ref={refDialogo} className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onCerrar} />
      <div className="relative w-full sm:max-w-lg sm:max-h-[88dvh] flex flex-col bg-[#101016] sm:rounded-xl border-y sm:border border-[#2a2a3a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#1f1f2b] flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-bold text-[16px] text-[#ececf1] truncate">{planta.nombre}</h2>
            <p className="text-[11px] text-[#8a8a9c] truncate">
              {planta.genetica ?? 'Sin genética'}{planta.dias_de_vida != null ? ` · día ${planta.dias_de_vida}` : ''} · {planta.fase}
            </p>
            {/* La ficha es el unico lugar con espacio para explicar por que el
                sistema cuenta una fase que nadie escribio. */}
            {faseFueDerivada(planta) && (
            <p className="text-[10px] text-[#f59e0b] truncate">
              Automática: se cuenta en floración por edad. En la ficha figura {planta.fase_guardada}.</p>
            )}
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={subiendo}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[11px] font-medium text-[#d9f99d] disabled:opacity-50">
            {subiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Foto</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = '' }} />
          <button onClick={onCerrar} className="p-1 text-[#8a8a9c] hover:text-[#ececf1]" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Codigo / QR / paciente */}
        <div className="px-5 py-3 border-b border-[#1f1f2b] flex-shrink-0 space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {planta.codigo && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#15151d] border border-[#2a2a3a] px-2 py-1 font-mono text-[11px] text-[#d9f99d]">
                {planta.codigo}
              </span>
            )}
            <button onClick={() => setMostrarQR(v => !v)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:border-[#404d20] text-[11px] text-[#a6a6b5] hover:text-[#ececf1] transition-colors">
              <QrCode className="w-3.5 h-3.5" /> {mostrarQR ? 'Ocultar QR' : 'Ver QR'}
            </button>
            {planta.codigo && (
              <Link to={`/p/${planta.codigo}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:border-[#404d20] text-[11px] text-[#a6a6b5] hover:text-[#ececf1] transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Historia completa
              </Link>
            )}
          </div>
          {mostrarQR && planta.codigo && (
            <div className="flex items-center gap-3 py-1">
              <QR value={urlQR} size={110} />
              <div className="text-[10px] text-[#8f8f9f] leading-relaxed">
                Escaneá este QR con la cámara del teléfono para abrir la historia clínica de la planta.
                <div className="font-mono text-[#8a8a9c] mt-1 break-all">{urlQR}</div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <IdCard className="w-3.5 h-3.5 text-[#a78bfa] flex-shrink-0" />
            <span className="text-[10px] text-[#8a8a9c] uppercase tracking-[0.14em]">Paciente</span>
            <div className="flex-1 min-w-0">
              <SelectorPersona personas={pacientes} valor={pacienteId || null}
                placeholder="Buscar, o dejar sin asignar…"
                etiquetaExtra={p => p.reprocann_nro ?? null}
                onElegir={id => asignarPaciente(id ?? '')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-1">Fecha de cosecha</label>
              <input type="date" value={fechas.cosecha} onChange={e => guardarFecha('fecha_cosecha', e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[11px] text-[#ececf1] focus:outline-none focus:border-[#a3e635]/60" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-1">Fecha de envasado</label>
              <input type="date" value={fechas.envasado} onChange={e => guardarFecha('fecha_envasado', e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[11px] text-[#ececf1] focus:outline-none focus:border-[#a3e635]/60" />
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cargando ? (
            <div className="py-10 text-center"><Loader2 className="w-5 h-5 text-[#bef264] animate-spin mx-auto" /></div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto w-10 h-10 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-2">
                <Sprout className="w-5 h-5 text-[#8a8a9c]" />
              </div>
              <p className="text-[12px] text-[#8f8f9f]">Sin eventos todavía</p>
              <p className="text-[11px] text-[#8a8a9c] mt-1">Sacá una foto o registrá riegos y podas.</p>
            </div>
          ) : (
            <ol className="relative border-l border-[#2a2a3a] ml-2">
              {items.map(it => {
                const cfg = ICONO[it.tipo] ?? (it.esCosecha ? { Ic: Scale, color: '#f59e0b' } : ICONO.Nota)
                return (
                  <li key={it.id} className="group relative pl-6 pb-5 last:pb-1">
                    <span className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-[#101016] border-2 flex items-center justify-center"
                      style={{ borderColor: cfg.color }}>
                      <cfg.Ic className="w-2 h-2" style={{ color: cfg.color }} />
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] font-semibold text-[#ececf1]">{it.esCosecha ? 'Cosecha' : it.tipo}</span>
                      <span className="text-[10px] text-[#8a8a9c] tabular-nums font-mono">{fmt(it.fecha)}</span>
                      {/* Un evento del grupo o del lote se ve en TODAS sus
                          plantas. Sin este cartel parecería que se registró en
                          ésta, y no se entendería por qué borrarlo lo saca de
                          las otras 59. */}
                      {it.nivel && it.nivel !== 'planta' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[#7dd3fc] whitespace-nowrap">
                          {it.nivel === 'grupo' ? 'todo el grupo' : 'todo el lote'}
                          {it.nivelNombre ? ` · ${it.nivelNombre}` : ''}
                        </span>
                      )}
                      {/* Los controles se revelan al pasar el mouse SOLO en
                          desktop. En mobile no hay hover: con `opacity-0` a
                          secas quedaban invisibles y no habia forma de borrar
                          nada desde el telefono. */}
                      <div className="ml-auto flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {editable(it) && (
                          <button onClick={() => editando === it.id ? setEditando(null) : abrirEdicion(it)}
                            className="p-2 sm:p-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center text-[#8a8a9c] hover:text-[#d9f99d] rounded transition-colors"
                            title="Corregir">
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        <button onClick={() => borrar(it)}
                          className="p-2 sm:p-1 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center text-[#8a8a9c] hover:text-[#ff8a7a] rounded transition-colors"
                          title="Borrar" aria-label="Cerrar">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {editando === it.id ? (
                      <div className="mt-2 rounded-lg border border-[#2a2a3a] bg-[#15151d] p-2.5 space-y-2">
                        <input type="date" value={borrador.fecha}
                          onChange={e => setBorrador(b => ({ ...b, fecha: e.target.value }))}
                          className="w-full bg-[#1c1c27] border border-[#2a2a3a] rounded px-2 py-2 min-h-[44px] sm:min-h-0 text-[16px] sm:text-[12px] text-[#ececf1] focus:outline-none focus:border-[#a3e635]/50" />
                        <input type="text" value={borrador.detalle}
                          onChange={e => setBorrador(b => ({ ...b, detalle: e.target.value }))}
                          placeholder={it.tipo === 'Aplicacion' ? 'Notas' : 'Detalle'}
                          className="w-full bg-[#1c1c27] border border-[#2a2a3a] rounded px-2 py-2 min-h-[44px] sm:min-h-0 text-[16px] sm:text-[12px] text-[#ececf1] focus:outline-none focus:border-[#a3e635]/50" />
                        {it.tipo === 'Aplicacion' && (
                          <p className="text-[10px] text-[#8a8a9c] leading-snug">
                            En una aplicación esto edita las <b>notas</b>. Producto, dosis y
                            categoría se corrigen desde <i>Tablas</i>.
                          </p>
                        )}
                        <div className="flex gap-1.5">
                          <button onClick={() => guardarEdicion(it)}
                            className="flex-1 px-3 py-2 min-h-[44px] sm:min-h-0 rounded border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[12px] font-medium text-[#d9f99d]">
                            Guardar
                          </button>
                          <button onClick={() => setEditando(null)}
                            className="px-3 py-2 min-h-[44px] sm:min-h-0 rounded border border-[#2a2a3a] bg-[#15151d] hover:bg-[#1c1c27] transition-colors text-[12px] text-[#a6a6b5]">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      it.detalle && <p className="text-[11px] text-[#a6a6b5] mt-0.5 leading-snug">{it.detalle}</p>
                    )}
                    {it.foto_url && (
                      <FotoPrivada valor={it.foto_url} onClick={() => setVisor(it.foto_url)}
                        className="mt-2 rounded-lg border border-[#1f1f2b] max-h-44 object-cover cursor-zoom-in" />
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>

      {/* Visor de foto */}
      {visor && (
        <div className="absolute inset-0 z-10 bg-black/90 flex items-center justify-center p-4" onClick={() => setVisor(null)}>
          <FotoPrivada valor={visor} className="max-w-full max-h-full rounded-lg" />
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setVisor(null)} aria-label="Cerrar">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  )
}
