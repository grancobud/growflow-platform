// PaginaHistoriaPlanta — "historia clínica" de una planta, destino del QR (/p/:codigo).
// Muestra código + QR, genética completa, paciente asignado y la línea de tiempo
// (eventos + riegos + aplicaciones + cosechas). Por privacidad no expone la patología.

import { useState, useEffect, useCallback } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useParams, Link } from 'react-router-dom'
import {
  Leaf, Loader2, ArrowLeft, Droplets, Scissors, FlaskConical, StickyNote, Sprout,
  Flower2, Repeat, AlertTriangle, RefreshCw, Image as ImageIcon, Scale, SprayCan, IdCard, Dna, X,
} from 'lucide-react'
import {
  cultivoService, type Planta, type Genetica, type ItemHistoria,
} from '../lib/cultivo'
import { registroService, type Paciente } from '../lib/registro'
import { FotoPrivada } from '../components/FotoPrivada'
import QR from '../components/QR'
import { useDialogo } from '../lib/useDialogo'
import { nombreParaMostrar } from '../lib/buscarPersonas'

const ICONO: Record<string, { Ic: LucideIcon; color: string }> = {
  Riego: { Ic: Droplets, color: '#38bdf8' }, Fertilizacion: { Ic: FlaskConical, color: '#bef264' },
  Poda: { Ic: Scissors, color: '#c4b5fd' }, Trasplante: { Ic: Repeat, color: '#fb923c' },
  CambioFase: { Ic: Flower2, color: '#e879f9' }, Entrenamiento: { Ic: RefreshCw, color: '#facc15' },
  Problema: { Ic: AlertTriangle, color: '#ff6b5a' }, Foto: { Ic: ImageIcon, color: '#94a3b8' },
  Nota: { Ic: StickyNote, color: '#f59e0b' }, Aplicacion: { Ic: SprayCan, color: '#c4b5fd' },
}

const fmt = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })

function Chip({ label, valor }: { label: string; valor: React.ReactNode }) {
  if (valor == null || valor === '' ) return null
  return (
    <div className="rounded-lg border border-[#1f1f2b] bg-[#0d0d13] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">{label}</div>
      <div className="text-[12px] text-[#d4d4dd] mt-0.5">{valor}</div>
    </div>
  )
}

export default function PaginaHistoriaPlanta() {
  const { codigo } = useParams<{ codigo: string }>()
  const [planta, setPlanta] = useState<Planta | null>(null)
  const [genetica, setGenetica] = useState<Genetica | null>(null)
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [items, setItems] = useState<ItemHistoria[]>([])
  const [cargando, setCargando] = useState(true)
  const [noExiste, setNoExiste] = useState(false)
  const [visor, setVisor] = useState<string | null>(null)
  const refDialogo = useDialogo(() => setVisor(null), visor != null)

  const cargar = useCallback(async () => {
    if (!codigo) return
    setCargando(true)
    try {
      const p = await cultivoService.getPlantaPorCodigo(codigo)
      if (!p) { setNoExiste(true); return }
      setPlanta(p)
      const [tl, gen, pac] = await Promise.all([
        cultivoService.getLineaTiempo(p.id),
        p.genetica_id ? cultivoService.getGenetica(p.genetica_id).catch(() => null) : Promise.resolve(null),
        p.paciente_id ? registroService.getPaciente(p.paciente_id).catch(() => null) : Promise.resolve(null),
      ])
      setItems(tl); setGenetica(gen); setPaciente(pac)
    } catch {
      setNoExiste(true)
    } finally {
      setCargando(false)
    }
  }, [codigo])

  useEffect(() => { cargar() }, [cargar])

  const urlQR = `${window.location.origin}/p/${codigo}`

  if (cargando) {
    return <div className="flex-1 flex items-center justify-center bg-[#0a0a0f]"><Loader2 className="w-6 h-6 text-[#bef264] animate-spin" /></div>
  }
  if (noExiste || !planta) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0f] text-center px-6">
        <div className="w-12 h-12 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-3"><Leaf className="w-6 h-6 text-[#8a8a9c]" /></div>
        <div className="font-display font-semibold text-[#d4d4dd]">Código no encontrado</div>
        <div className="mt-1 text-[12px] text-[#8a8a9c]">No existe ninguna planta con el código <span className="font-mono text-[#a6a6b5]">{codigo}</span>.</div>
        <Link to="/plantas" className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2a2a3a] bg-[#15151d] text-[12px] text-[#a6a6b5] hover:text-[#ececf1]"><ArrowLeft className="w-3.5 h-3.5" /> Volver a Plantas</Link>
      </div>
    )
  }

  const g = genetica
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#0a0a0f] text-[#d4d4dd] font-sans">
      <div className="sticky top-0 z-40 bg-[#0a0a0f] border-b border-[#1f1f2b]">
        <div className="flex items-center gap-3 px-3 sm:px-6 py-3">
          <Link to="/plantas" className="p-1.5 rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#15151d]"><ArrowLeft className="w-4 h-4" /></Link>
          <div className="min-w-0">
            <h1 className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] text-[#ececf1] truncate">Historia clínica</h1>
            <div className="mt-0.5 text-[10px] text-[#8a8a9c] font-mono">{planta.codigo}</div>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-6 py-4 pb-20 max-w-3xl mx-auto">
        {/* Cabecera: identidad + QR */}
        <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 sm:p-4 flex flex-col sm:flex-row gap-4 items-start">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sprout className="w-4 h-4 text-[#bef264]" />
              <h2 className="font-display font-bold text-[16px] text-[#ececf1] truncate">{planta.apodo ?? g?.nombre ?? 'Planta'}</h2>
            </div>
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-[#15151d] border border-[#2a2a3a] px-2 py-1 font-mono text-[12px] text-[#d9f99d]">{planta.codigo}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Chip label="Genética" valor={g?.nombre ?? '—'} />
              <Chip label="Fase" valor={planta.fase} />
              <Chip label="Sustrato" valor={planta.sustrato} />
              <Chip label="Maceta" valor={planta.maceta} />
              <Chip label="Germinación" valor={planta.fecha_germinacion ? fmt(planta.fecha_germinacion) : null} />
              <Chip label="Ubicación" valor={planta.ubicacion} />
              <Chip label="Cosecha" valor={planta.fecha_cosecha ? fmt(planta.fecha_cosecha) : 'Pendiente'} />
              <Chip label="Envasado" valor={planta.fecha_envasado ? fmt(planta.fecha_envasado) : 'Pendiente'} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 mx-auto sm:mx-0">
            <QR value={urlQR} size={120} />
            <span className="text-[10px] text-[#8a8a9c]">Escaneá para esta historia</span>
          </div>
        </div>

        {/* Paciente asignado */}
        <div className="mt-3 rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2"><IdCard className="w-4 h-4 text-[#a78bfa]" /><h3 className="font-display font-semibold text-[12px] text-[#ececf1]">Paciente asignado</h3></div>
          {paciente ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] text-[#ececf1] truncate">{nombreParaMostrar(paciente)}</div>
                <div className="text-[11px] text-[#8a8a9c]">{paciente.reprocann_nro ? `REPROCANN ${paciente.reprocann_nro}` : 'Sin N° REPROCANN'} · {paciente.reprocann_estado}</div>
              </div>
              <Link to="/registro" className="text-[11px] text-[#bef264] hover:underline flex-shrink-0">Ver registro</Link>
            </div>
          ) : (
            <p className="text-[11px] text-[#8a8a9c]">Esta planta todavía no está asignada a ningún paciente.</p>
          )}
        </div>

        {/* Ficha de genética (resumen) */}
        {g && (g.genotipo || g.thc_estimado != null || g.usos_medicinales) && (
          <div className="mt-3 rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2"><Dna className="w-4 h-4 text-[#38bdf8]" /><h3 className="font-display font-semibold text-[12px] text-[#ececf1]">Genética</h3></div>
            <div className="grid grid-cols-2 gap-2">
              <Chip label="Genotipo" valor={g.genotipo} />
              <Chip label="THC / CBD" valor={[g.thc_estimado != null ? `THC ${g.thc_estimado}%` : null, g.cbd_estimado != null ? `CBD ${g.cbd_estimado}%` : null].filter(Boolean).join(' · ') || null} />
              <Chip label="Banco" valor={g.banco} />
              <Chip label="Flora" valor={g.tiempo_flora_dias != null ? `${g.tiempo_flora_dias} días` : null} />
            </div>
            {g.usos_medicinales && <div className="mt-2"><Chip label="Usos medicinales" valor={g.usos_medicinales} /></div>}
          </div>
        )}

        {/* Línea de tiempo */}
        <div className="mt-3 rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 sm:p-4">
          <h3 className="font-display font-semibold text-[12px] text-[#ececf1] mb-3">Línea de tiempo ({items.length})</h3>
          {items.length === 0 ? (
            <p className="text-[11px] text-[#8a8a9c] py-4 text-center">Sin registros todavía.</p>
          ) : (
            <ol className="relative border-l border-[#2a2a3a] ml-2">
              {items.map(it => {
                const cfg = ICONO[it.tipo] ?? (it.esCosecha ? { Ic: Scale, color: '#f59e0b' } : ICONO.Nota)
                return (
                  <li key={it.id} className="relative pl-6 pb-5 last:pb-1">
                    <span className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-[#101016] border-2 flex items-center justify-center" style={{ borderColor: cfg.color }}>
                      <cfg.Ic className="w-2 h-2" style={{ color: cfg.color }} />
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] font-semibold text-[#ececf1]">{it.esCosecha ? 'Cosecha' : it.tipo}</span>
                      <span className="text-[10px] text-[#8a8a9c] tabular-nums font-mono">{fmt(it.fecha)}</span>
                    </div>
                    {it.detalle && <p className="text-[11px] text-[#a6a6b5] mt-0.5 leading-snug">{it.detalle}</p>}
                    {it.foto_url && <FotoPrivada valor={it.foto_url} onClick={() => setVisor(it.foto_url)} className="mt-2 rounded-lg border border-[#1f1f2b] max-h-44 object-cover cursor-zoom-in" />}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>

      {visor && (
        <div ref={refDialogo} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setVisor(null)}>
          <FotoPrivada valor={visor} className="max-w-full max-h-full rounded-lg" />
          {/* Tocar en cualquier lado ya cerraba, pero sobre una foto a pantalla
              completa nadie adivina que el fondo es un boton. */}
          <button onClick={() => setVisor(null)} aria-label="Cerrar"
            className="absolute top-3 right-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black/50 text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <button onClick={() => setVisor(null)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 min-h-[44px] px-6 flex items-center justify-center rounded-lg bg-black/60 border border-white/20 text-[12px] text-white/90 hover:bg-black/80">
            Cerrar
          </button>
        </div>
      )}
    </div>
  )
}
