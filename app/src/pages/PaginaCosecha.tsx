// PaginaCosecha — apartado dedicado para cargar el rinde (gramos) por variedad.
// Dos modos de carga: total por variedad (un solo número) o por planta individual.
// Ranking por gramos secos + valoración/cata. Agrega por genética client-side
// (funciona igual en modo demo y en Supabase).

import { useState, useEffect, useCallback, useMemo } from 'react'
import { etiquetaCampo, presionBoton } from '../lib/ui'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import {
  Scale, Scissors, Trophy, X, Loader2, Plus, Star, Layers, Sprout, RefreshCw, Pencil, Trash2, ChevronDown,
  ArrowRight,
} from 'lucide-react'
import { cultivoService, FASES_COSECHABLES, type ResumenPlanta, type Cosecha } from '../lib/cultivo'
import { useDialogo } from '../lib/useDialogo'
import { useAbrirAlLlegar } from '../lib/useAbrirAlLlegar'
import { RendimientoDeCultivo } from '../components/cosecha/RendimientoDeCultivo'
import { StockDeLotes } from '../components/cosecha/StockDeLotes'
import { FilaTocable } from '../components/ui/FilaTocable'
import { confirmarBorrado } from '../lib/confirmar'

// Los 16px del input no son estéticos: abajo de eso iOS hace zoom al tocar el
// campo y te deja la pantalla corrida. En desktop se achica con el sm:.
const inputCls = 'w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[13px] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#a3e635]/60 transition-colors'
// Copia local del btnPrimario de lib/ui: mismo diseno pero 13px y mas alto.
// Lleva la misma presion que el compartido a proposito — dos botones que se
// ven identicos y responden distinto al toque se leen como un bug.
const btnPrimario = `inline-flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 ${presionBoton} text-[13px] font-medium text-[#d9f99d] disabled:opacity-50`

const SIN_GEN = 'Sin genética'

// Fases a partir de las cuales tiene sentido cargar cosecha.

// Chip de tipo de genética (Auto/Fem/…) — color + abreviatura.
const COLOR_TIPO: Record<string, { label: string; text: string; bg: string; border: string }> = {
  Automatica:  { label: 'AUTO', text: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: '#5a4a20' },
  Feminizada:  { label: 'FEM',  text: '#c4b5fd', bg: 'rgba(139,92,246,0.12)', border: '#463a66' },
  Regular:     { label: 'REG',  text: '#38bdf8', bg: 'rgba(56,189,248,0.10)', border: '#1e3a4a' },
  Esqueje:     { label: 'ESQ',  text: '#bef264', bg: 'rgba(163,230,53,0.12)', border: '#404d20' },
  Desconocido: { label: '¿?',   text: '#8f8f9f', bg: 'rgba(180,180,200,0.06)', border: '#2a2a3a' },
}
function ChipTipo({ tipo }: { tipo?: string | null }) {
  if (!tipo) return null
  const c = COLOR_TIPO[tipo] ?? COLOR_TIPO.Desconocido
  return (
    <span className="text-[11px] font-semibold tracking-wide rounded px-1.5 py-0.5 border flex-shrink-0" title={tipo}
      style={{ color: c.text, background: c.bg, borderColor: c.border }}>{c.label}</span>
  )
}

interface FilaVariedad {
  genetica: string
  plantas: ResumenPlanta[]
  pesoSeco: number
  pesoHumedo: number
  nCosechas: number
  valoraciones: number[]
  cosechas: Cosecha[]
  /** Plantas de la variedad que ya salieron de la sala. */
  cerradas: number
  /** Las que siguen en pie y ya se podrían cosechar. */
  faltan: number
}

const hoy = () => new Date().toISOString().slice(0, 10)
const prom = (vs: number[]) => (vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null)

export default function PaginaCosecha() {
  const [plantas, setPlantas] = useState<ResumenPlanta[]>([])
  const [cosechas, setCosechas] = useState<Cosecha[]>([])
  /**
   * El banco entero, para poder decir POR QUE falta una variedad.
   *
   * Las filas de esta pantalla se arman desde las PLANTAS, asi que una variedad
   * cargada en el banco pero sin ninguna planta no aparece por ningun lado. Fue
   * literalmente el mensaje que abrio todo esto: «en cosechadas solo me figuran
   * las Avocado». No fallaba nada — faltaban las plantas, y la pantalla no tenia
   * como decirlo porque ni sabia que esas variedades existian.
   */
  const [banco, setBanco] = useState<{ id: string; nombre: string }[]>([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState<FilaVariedad | null>(null)
  /** El selector de variedad: el primer paso de registrar una cosecha. */
  const [eligiendo, setEligiendo] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [ps, cs, gs] = await Promise.all([
        cultivoService.getResumenPlantas(false), // incluye cosechadas/inactivas
        cultivoService.getCosechas(),
        cultivoService.getGeneticas(),
      ])
      setPlantas(ps)
      setCosechas(cs)
      setBanco(gs.map(g => ({ id: g.id, nombre: g.nombre })))
    } catch (err) {
      toast.error(`Error cargando cosecha: ${(err as Error).message}`)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Agrupa plantas por genética y suma las cosechas registradas.
  const filas = useMemo<FilaVariedad[]>(() => {
    const porGen = new Map<string, FilaVariedad>()
    for (const p of plantas) {
      const g = p.genetica ?? SIN_GEN
      let f = porGen.get(g)
      if (!f) { f = { genetica: g, plantas: [], pesoSeco: 0, pesoHumedo: 0, nCosechas: 0, valoraciones: [], cosechas: [], cerradas: 0, faltan: 0 }; porGen.set(g, f) }
      f.plantas.push(p)
    }
    const plantaGen = new Map(plantas.map(p => [p.id, p.genetica ?? SIN_GEN]))
    for (const c of cosechas) {
      const g = (c.planta_id && plantaGen.get(c.planta_id)) || SIN_GEN
      const f = porGen.get(g)
      if (!f) continue
      f.nCosechas++
      f.pesoSeco += c.peso_seco_g ?? 0
      f.pesoHumedo += c.peso_humedo_g ?? 0
      if (c.valoracion != null) f.valoraciones.push(c.valoracion)
      f.cosechas.push(c)
    }
    // Cuántas plantas de cada variedad quedaron cerradas y cuántas siguen en pie.
    // Cargando planta por planta es normal terminar a medias, y sin esto la
    // variedad figuraba como "ya cargada" con las 5 plantas aunque hubieras
    // pesado 2: después las otras 3 aparecían en Plantas y parecía un error.
    for (const f of porGen.values()) {
      f.cerradas = f.plantas.filter(p => p.fase === 'Cosechada' || !p.activa).length
      f.faltan = f.plantas.filter(p => p.activa && p.fase !== 'Cosechada' && FASES_COSECHABLES.has(p.fase)).length
    }
    return [...porGen.values()].sort((a, b) => b.pesoSeco - a.pesoSeco)
  }, [plantas, cosechas])

  const totalSeco = filas.reduce((a, f) => a + f.pesoSeco, 0)
  const totalCosechas = filas.reduce((a, f) => a + f.nCosechas, 0)

  // Desglose por tipo de genética. El tipo vive en la planta, así que se toma de
  // la primera de cada variedad (todas las plantas de una variedad comparten
  // genética).
  const porTipo = useMemo(() => {
    const vacio = () => ({ variedades: 0, plantas: 0, cosechas: 0, gramos: 0 })
    const acc = { auto: vacio(), fem: vacio(), otras: vacio() }
    for (const f of filas) {
      const t = f.plantas[0]?.tipo
      const k = t === 'Automatica' ? 'auto' : t === 'Feminizada' ? 'fem' : 'otras'
      acc[k].variedades++
      acc[k].plantas += f.plantas.length
      acc[k].cosechas += f.nCosechas
      acc[k].gramos += f.pesoSeco
    }
    return acc
  }, [filas])
  const conRinde = filas.filter(f => f.pesoSeco > 0)
  // Con carga planta por planta se puede quedar a mitad de camino: la variedad
  // tiene rinde cargado pero le siguen quedando plantas en pie.
  const aMedias = conRinde.filter(f => f.faltan > 0)
  const terminadas = conRinde.filter(f => f.faltan === 0)
  // Una variedad está para cosechar si alguna planta llegó a floración. Las que
  // siguen en vegetativo/germinación no se cosechan todavía y sólo ensucian la
  // lista (hoy: 9 variedades feminizadas en vegetativo).
  const [tab, setTab] = useState<'carga' | 'rendimiento' | 'stock'>('carga')
  const sinCargar = filas.filter(f => f.pesoSeco <= 0)
  const pendientes = sinCargar.filter(f => f.plantas.some(p => FASES_COSECHABLES.has(p.fase)))
  const creciendo = sinCargar.filter(f => !f.plantas.some(p => FASES_COSECHABLES.has(p.fase)))
  const maxSeco = Math.max(1, ...filas.map(f => f.pesoSeco))

  /**
   * Variedades del banco que no tienen NINGUNA planta cargada.
   *
   * Son las que no pueden aparecer en esta pantalla, y la unica razon por la que
   * alguien no encuentra lo que cosecho. Decirlo aca —donde se lo busca— evita
   * el recorrido a ciegas por Geneticas y Plantas.
   */
  /**
   * El boton «Registrar una cosecha» del Panel abre el selector al llegar.
   *
   * La clave `cosecha` tiene que ser la misma que la de la ruta de la accion.
   */
  const abrirSelector = useCallback(() => setEligiendo(true), [])
  useAbrirAlLlegar(abrirSelector, 'cosecha', eligiendo || modal != null)

  const sinPlantas = useMemo(() => {
    const conPlanta = new Set(plantas.map(p => p.genetica ?? SIN_GEN))
    return banco.filter(g => !conPlanta.has(g.nombre)).map(g => g.nombre)
  }, [banco, plantas])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden ct-page-scroll bg-[#0a0a0f] text-[#d4d4dd] font-sans">
      <div className="sticky top-0 z-40 bg-[#0a0a0f] border-b border-[#1f1f2b]">
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3">
          <div className="min-w-0">
            <h1 className="font-display font-bold tracking-tight text-[16px] sm:text-[17px] text-[#ececf1]">Cosecha</h1>
            <div className="mt-0.5 text-[12px] sm:text-[12px] text-[#8a8a9c]">Cargá los gramos que te dio cada variedad</div>
          </div>
          <div className="flex-1" />
          <button onClick={cargar} className="p-2.5 sm:p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:bg-[#1c1c27] transition-colors text-[#a6a6b5]" title="Refrescar" aria-label="Refrescar">
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {/* Cargar el rinde y analizarlo son dos momentos distintos: uno es
            escribir después de cosechar, el otro es mirar para decidir qué
            plantar. Mezclados en una sola pantalla, el análisis empuja el
            formulario para abajo justo cuando venís a cargar. */}
        <div className="flex gap-1 px-3 sm:px-6 -mb-px overflow-x-auto">
          {([['carga', 'Cargar el rinde'], ['rendimiento', 'Rendimiento'],
             ['stock', 'Stock']] as const).map(([k, t]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-2 min-h-[44px] sm:min-h-0 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === k ? 'border-[#a3e635] text-[#d9f99d]' : 'border-transparent text-[#8a8a9c] hover:text-[#d4d4dd]'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 sm:px-6 py-4 sm:py-5 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {tab === 'rendimiento' && <RendimientoDeCultivo />}
        {/* Stock vive acá y no en la O.N.G. porque a esa pantalla el cultivador
            no entra: no tiene `ver_ong`, y dárselo le abriría pacientes y
            solicitudes. Quien produce el material tiene que poder ver cuánto
            queda de lo que produjo. */}
        {tab === 'stock' && <StockDeLotes />}
        <div className={tab === 'carga' ? '' : 'hidden'}>
        {/* Totales. Autos y feminizadas van separadas: son ciclos distintos —las
            autos se cosechan mientras las fem todavía vegetan— y verlas sumadas
            en un solo número no dice nada. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <Total label="Total seco" valor={totalSeco.toLocaleString('es-AR')} unidad="g" />
          <Total label="Cosechadas" valor={String(totalCosechas)}
            sub={porTipo.auto.cosechas > 0 || porTipo.fem.cosechas > 0
              ? `${porTipo.auto.cosechas} auto · ${porTipo.fem.cosechas} fem`
              : 'ninguna todavía'} />
          <Total label="Variedades automáticas" valor={String(porTipo.auto.variedades)}
            sub={`${porTipo.auto.plantas} planta${porTipo.auto.plantas === 1 ? '' : 's'}`} />
          <Total label="Variedades feminizadas" valor={String(porTipo.fem.variedades)}
            sub={`${porTipo.fem.plantas} planta${porTipo.fem.plantas === 1 ? '' : 's'}`} />
        </div>

        {/* Desktop: ranking fijo a la izquierda, variedades en grilla a la derecha.
            Mobile: todo apilado. Antes eran 15 tarjetas en una sola columna angosta. */}
        {/* POR QUE NO ESTA LA VARIEDAD QUE COSECHASTE.
            VA ARRIBA DEL GRID, NO ADENTRO. Estuvo un rato adentro con
            `col-span-2` y el ranking —que es `lg:sticky`— se le montaba encima
            al scrollear: el aviso tiene fondo semitransparente, asi que se leian
            los dos textos superpuestos. Ademas es un mensaje de la pantalla
            entera, no de una de las dos columnas.
            Las filas de abajo salen de las PLANTAS, asi que una variedad del
            banco sin ninguna planta cargada no aparece. Es exactamente lo que
            pasó en la asociación —«en cosechadas solo me figuran las Avocado»— y no
            habia forma de darse cuenta desde acá: la pantalla ni sabia que
            esas variedades existian.
            Se dice donde se la busca, en vez de mandar a recorrer Genéticas y
            Plantas a ciegas. */}
        {!cargando && sinPlantas.length > 0 && (
          <div className="mt-4 rounded-xl border border-[#1d3a5a] bg-[#38bdf8]/[0.06] p-3">
            <p className="text-[12px] font-medium text-[#7dd3fc]">
              ¿No encontrás una variedad que cosechaste?
            </p>
            <p className="text-[11px] text-[#a6a6b5] leading-relaxed mt-1">
              Acá sólo aparecen las variedades que tienen <b className="text-[#c9cabf]">plantas
              cargadas</b>, porque la cosecha se registra sobre la planta. Estas{' '}
              {sinPlantas.length === 1 ? 'está' : `${sinPlantas.length} están`} en el banco pero
              todavía sin ninguna planta:
            </p>
            <p className="text-[11px] text-[#d4d4dd] mt-1.5">
              {sinPlantas.slice(0, 8).join(' · ')}
              {sinPlantas.length > 8 ? ` y ${sinPlantas.length - 8} más` : ''}
            </p>
            <Link to="/plantas"
              className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[12px] font-medium text-[#d9f99d]">
              Cargar las plantas que cosechaste
            </Link>
          </div>
        )}
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(320px,380px)_1fr] items-start">

          {/* Ranking */}
          {conRinde.length > 0 && (
            <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] overflow-hidden lg:sticky lg:top-[76px]">
              <div className="px-4 py-3 border-b border-[#1f1f2b] flex items-center gap-2">
                <Scale className="w-3.5 h-3.5 text-[#bef264]" />
                <h2 className="font-display font-semibold text-[14px] text-[#ececf1]">Ranking por gramos secos</h2>
                <span className="ml-auto text-[11px] text-[#8a8a9c] tabular-nums">{conRinde.length} de {filas.length}</span>
              </div>
              <ul className="divide-y divide-[#1f1f2b] max-h-[52dvh] lg:max-h-[calc(100vh-190px)] overflow-y-auto overscroll-contain ct-page-scroll">
                {conRinde.map((f, i) => {
                  const v = prom(f.valoraciones)
                  const porPlanta = f.plantas.length ? f.pesoSeco / f.plantas.length : 0
                  return (
                    <li key={f.genetica} className="px-4 py-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        {i === 0 && <Trophy className="w-3.5 h-3.5 text-[#f59e0b] flex-shrink-0" />}
                        <span className="text-[12px] font-medium text-[#ececf1] truncate">{f.genetica}</span>
                        <span className="ml-auto font-display font-bold text-[15px] text-[#d9f99d] tabular-nums flex-shrink-0">
                          {f.pesoSeco.toLocaleString('es-AR')} g
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#1c1c27] overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#4d7c0f] to-[#a3e635]" style={{ width: `${(f.pesoSeco / maxSeco) * 100}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[12px] text-[#8a8a9c] tabular-nums">
                        <span>{f.plantas.length} pl. · {porPlanta.toLocaleString('es-AR', { maximumFractionDigits: 0 })} g/pl.</span>
                        {f.pesoHumedo > 0 && <span>{Math.round((f.pesoSeco / f.pesoHumedo) * 100)}% seco/húmedo</span>}
                        {v != null && <span className="text-[#c4b5fd]">★ {v.toFixed(1)}/10</span>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Variedades: primero las que faltan cargar */}
          <div className={conRinde.length > 0 ? '' : 'lg:col-span-2'}>
            {cargando ? (
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[74px] bg-[#101016] border border-[#1f1f2b] rounded-xl animate-pulse" />)}
              </div>
            ) : filas.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto w-11 h-11 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-3"><Sprout className="w-5 h-5 text-[#8a8a9c]" /></div>
                <div className="font-display font-semibold text-[#d4d4dd] text-[15px]">Sin plantas cargadas</div>
                <div className="mt-1 text-[13px] text-[#8a8a9c]">Cargá plantas en /plantas y volvé para registrar la cosecha.</div>
              </div>
            ) : (
              <div className="space-y-4">
                {pendientes.length > 0 && (
                  <GrupoVariedades titulo="Listas para cosechar" cantidad={pendientes.length} color="#a78bfa"
                    subtitulo={mezclaDeTipos(pendientes)} filas={pendientes} onCargar={setModal} />
                )}
                {aMedias.length > 0 && (
                  <GrupoVariedades titulo="A medio cosechar" cantidad={aMedias.length} color="#fcd34d"
                    subtitulo={`${mezclaDeTipos(aMedias)} · les quedan plantas en pie`}
                    filas={aMedias} onCargar={setModal} />
                )}
                {terminadas.length > 0 && (
                  <GrupoVariedades titulo="Terminadas" cantidad={terminadas.length} color="#a3e635"
                    subtitulo={mezclaDeTipos(terminadas)} filas={terminadas} onCargar={setModal} />
                )}
                {creciendo.length > 0 && (
                  <GrupoVariedades titulo="Todavía creciendo" cantidad={creciendo.length} color="#8a8a9c"
                    subtitulo={`${mezclaDeTipos(creciendo)} · no llegaron a floración`}
                    filas={creciendo} onCargar={setModal} plegable />
                )}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* El selector encadena al peso: elegis la variedad y se abre su carga.
          Es el mismo ModalCarga que abre el boton «Cargar» de cada tarjeta, asi
          que hay un solo formulario de peso y no dos que se puedan desincronizar. */}
      {eligiendo && (
        <SelectorVariedad listas={pendientes} aMedias={aMedias}
          onElegir={f => { setEligiendo(false); setModal(f) }}
          onCerrar={() => setEligiendo(false)} />
      )}
      {modal && <ModalCarga fila={modal} onCerrar={() => setModal(null)} onGuardado={() => { setModal(null); cargar() }} />}
    </div>
  )
}

// ---------------------------------------------------------------------------

function Total({ label, valor, unidad, sub }: { label: string; valor: string; unidad?: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 sm:p-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium leading-tight line-clamp-2">{label}</p>
      <p className="font-display font-bold text-[20px] sm:text-[26px] text-[#ececf1] mt-1 leading-none tabular-nums">
        {valor}{unidad && <span className="text-[14px] text-[#8a8a9c]"> {unidad}</span>}
      </p>
      {sub && <p className="text-[11px] text-[#8a8a9c] mt-1 truncate">{sub}</p>}
    </div>
  )
}

/** Variedades en grilla: 2 columnas en celular, 3 en pantalla grande. */

/** "5 automáticas", "3 fem", o "2 auto · 1 fem" si el grupo está mezclado. */
function mezclaDeTipos(filas: FilaVariedad[]): string {
  const n = { auto: 0, fem: 0, otras: 0 }
  for (const f of filas) {
    const t = f.plantas[0]?.tipo
    n[t === 'Automatica' ? 'auto' : t === 'Feminizada' ? 'fem' : 'otras']++
  }
  const partes: string[] = []
  if (n.auto) partes.push(`${n.auto} automática${n.auto === 1 ? '' : 's'}`)
  if (n.fem) partes.push(`${n.fem} feminizada${n.fem === 1 ? '' : 's'}`)
  if (n.otras) partes.push(`${n.otras} otra${n.otras === 1 ? '' : 's'}`)
  return partes.join(' · ')
}

function GrupoVariedades({ titulo, cantidad, color, subtitulo, filas, onCargar, plegable = false }: {
  titulo: string; cantidad: number; color: string; subtitulo?: string
  filas: FilaVariedad[]; onCargar: (f: FilaVariedad) => void; plegable?: boolean
}) {
  // Las que todavía crecen arrancan cerradas: no hay nada que hacer con ellas.
  const [abierto, setAbierto] = useState(!plegable)

  const claseEncabezado = 'w-full flex items-center gap-2 px-1 mb-2 text-left'
  const encabezado = (
    <>
      <Layers aria-hidden className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
      <span className="font-display font-semibold text-[12px]" style={{ color }}>{titulo}</span>
      <span className="text-[11px] text-[#8a8a9c] tabular-nums flex-shrink-0">{cantidad}</span>
      {subtitulo && <span className="text-[11px] text-[#8a8a9c] truncate hidden sm:inline">· {subtitulo}</span>}
    </>
  )

  return (
    <section>
      {/*
        Botón sólo cuando de verdad se pliega.

        Antes era siempre un `button` con `disabled` cuando no había nada que
        plegar. Visualmente daba igual, pero un lector de pantalla anunciaba
        "botón, no disponible" sobre lo que es un encabezado de sección: hace
        prometer una acción que no existe. Cuando no se pliega es un `div` y se
        lee como lo que es.
      */}
      {plegable ? (
        <button onClick={() => setAbierto(a => !a)}
          aria-expanded={abierto}
          className={`${claseEncabezado} min-h-[44px] sm:min-h-[40px] cursor-pointer`}>
          {encabezado}
          <ChevronDown aria-hidden className={`w-3.5 h-3.5 text-[#8a8a9c] ml-auto flex-shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <div className={claseEncabezado}>{encabezado}</div>
      )}
      {/* EN FILA, COMO EL RESTO DE LA APP.
          Eran tarjetas `auto-fill` de 150px con un boton adentro: la tercera
          version de la misma fila, y la unica que no se parecia a las otras
          dos. El boton ademas repetia el area tocable de la tarjeta que ya lo
          contenia — dos blancos para una sola accion. Ahora la fila ENTERA abre
          la carga, que es lo que uno intenta tocar igual.
          Se va con esto el problema que resolvia el `auto-fill`: el nombre ya
          no compite con el chip por 55px, porque el chip bajo al metadato. */}
      {!abierto ? null : (
      <div className="grid gap-1.5 sm:grid-cols-2">
        {filas.map(f => (
          <FilaTocable key={f.genetica} onClick={() => onCargar(f)}
            etiqueta={`${f.pesoSeco > 0 ? 'Ver o editar' : 'Cargar'} el rinde de ${f.genetica}`}>
            <Scissors aria-hidden className="w-[18px] h-[18px] text-[#a3e635] flex-shrink-0" strokeWidth={1.8} />
            <span className="min-w-0 flex-1">
              <span className="block font-display font-semibold text-[12px] text-[#ececf1] leading-tight [text-wrap:pretty]">
                {f.genetica}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-[#8a8a9c] mt-0.5 tabular-nums flex-wrap">
                <ChipTipo tipo={f.plantas[0]?.tipo} />
                {/* Cuantas de las plantas ya se cosecharon, no cuantas tiene la
                    variedad: con la carga planta por planta casi nunca coinciden. */}
                {f.pesoSeco > 0
                  ? <>{f.cerradas} de {f.plantas.length} planta{f.plantas.length !== 1 ? 's' : ''}</>
                  : <>{f.plantas.length} planta{f.plantas.length !== 1 ? 's' : ''}</>}
                {f.pesoSeco > 0 && <span className="text-[#a3e635]">· {f.pesoSeco.toLocaleString('es-AR')} g</span>}
              </span>
              {f.pesoSeco > 0 && f.faltan > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-[#fcd34d] mt-0.5">
                  <Sprout aria-hidden className="w-3 h-3 flex-shrink-0" />
                  {f.faltan} sin cosechar todavía
                </span>
              )}
            </span>
            <Plus aria-hidden className="w-4 h-4 text-[#6e6e80] flex-shrink-0 mt-0.5" />
          </FilaTocable>
        ))}
      </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

/**
 * PASO 1 DE REGISTRAR UNA COSECHA: elegir la variedad.
 *
 * Antes esto eran TRES PANTALLAS encadenadas —Genéticas, Plantas, Cosecha— y el
 * botón del Panel te dejaba en la primera. Pero en el caso normal la variedad ya
 * está en el banco y las plantas ya están cargadas: recorrer las tres para
 * llegar a pesar no tenía sentido, y el paso 1 encima abría un alta de variedad
 * nueva teniendo veintiséis en el banco.
 *
 * El registro empieza donde termina: elegís de las que YA están listas y seguís
 * al peso. Los otros dos pasos son la excepción —cuando falta la planta— y para
 * eso está el aviso de la pantalla, que dice cuáles del banco no tienen ninguna.
 *
 * ORDENADO POR LO QUE ESTÁ LISTO: primero las que tienen plantas en floración,
 * después las que quedaron a medias. Las que todavía crecen no se ofrecen: no
 * hay nada que pesar ahí.
 */
function SelectorVariedad({ listas, aMedias, onElegir, onCerrar }: {
  listas: FilaVariedad[]
  aMedias: FilaVariedad[]
  onElegir: (f: FilaVariedad) => void
  onCerrar: () => void
}) {
  const refDialogo1 = useDialogo(onCerrar)
  const grupos = [
    { titulo: 'Listas para cosechar', filas: listas, color: '#a78bfa' },
    { titulo: 'Empezadas, les faltan plantas', filas: aMedias, color: '#fbbf24' },
  ].filter(g => g.filas.length > 0)

  return (
    <div ref={refDialogo1} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCerrar} />
      <div className="relative w-full max-w-lg max-h-[85dvh] overflow-y-auto overscroll-contain rounded-xl bg-[#101016] border border-[#2a2a3a] shadow-2xl">
        <div className="sticky top-0 bg-[#101016] flex items-center justify-between px-5 py-3.5 border-b border-[#1f1f2b]">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-[14px] text-[#ececf1]">¿Qué variedad cosechaste?</h2>
            <p className="text-[11px] text-[#8a8a9c] mt-0.5">Elegí una y después cargás el peso.</p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 text-[#8a8a9c] hover:text-[#ececf1]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {grupos.length === 0 ? (
            /* Sin nada en floración no hay cosecha que registrar, y decir por qué
               ahorra buscar un botón que no va a aparecer. */
            <p className="text-[12px] text-[#a6a6b5] leading-relaxed py-4 text-center">
              No hay ninguna variedad lista para cosechar: para que aparezca acá tiene que tener
              plantas en floración. Cargalas en Plantas y volvé.
            </p>
          ) : grupos.map(g => (
            <div key={g.titulo}>
              <p className="text-[10px] uppercase tracking-[0.14em] font-medium mb-2" style={{ color: g.color }}>
                {g.titulo} · {g.filas.length}
              </p>
              <div className="space-y-1.5">
                {g.filas.map(f => (
                  <button key={f.genetica} onClick={() => onElegir(f)}
                    className="w-full flex items-center gap-3 text-left rounded-lg bg-[#15151d] border border-[#2a2a3a] hover:border-[#a3e635]/50 hover:bg-[#1c1c27] transition-colors px-3 py-2.5 min-h-[44px]">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] text-[#ececf1] truncate">{f.genetica}</span>
                      <span className="block text-[10px] text-[#8a8a9c] tabular-nums">
                        {f.faltan} planta{f.faltan === 1 ? '' : 's'} por pesar
                        {f.pesoSeco > 0 ? ` · ya lleva ${Math.round(f.pesoSeco)} g` : ''}
                      </span>
                    </span>
                    <ArrowRight aria-hidden className="w-4 h-4 text-[#8a8a9c] flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* La salida para el caso que trajo todo esto: la variedad no aparece
              porque no tiene plantas. */}
          <div className="pt-3 border-t border-[#1f1f2b]">
            <p className="text-[11px] text-[#8a8a9c] leading-relaxed">
              ¿No está la que cosechaste? Es porque todavía no tiene plantas cargadas: la cosecha
              se registra sobre la planta.
            </p>
            <Link to="/plantas" onClick={onCerrar}
              className="inline-flex items-center gap-1.5 mt-2 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:bg-[#1c1c27] transition-colors text-[11px] text-[#a6a6b5]">
              Cargar las plantas
            </Link>
          </div>

          {/* La salida al pie, como todos los modales: la X de arriba se pierde
              cuando la lista es larga y hay que scrollear para volver a verla. */}
          <button onClick={onCerrar}
            className="w-full px-4 py-2.5 min-h-[44px] rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:bg-[#1c1c27] transition-colors text-[12px] text-[#a6a6b5]">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalCarga({ fila, onCerrar, onGuardado }: { fila: FilaVariedad; onCerrar: () => void; onGuardado: () => void }) {
  const refDialogo2 = useDialogo(onCerrar)
  const [modo, setModo] = useState<'total' | 'planta'>(fila.plantas.length > 1 ? 'total' : 'planta')
  const [guardando, setGuardando] = useState(false)
  const [editId, setEditId] = useState<string | null>(null) // id de la cosecha en edición

  // --- estado modo total ---
  const [fecha, setFecha] = useState(hoy())
  const [seco, setSeco] = useState('')
  const [valoracion, setValoracion] = useState(0)
  const [sabor, setSabor] = useState('')
  const [curado, setCurado] = useState('')

  const resetForm = () => { setEditId(null); setSeco(''); setValoracion(0); setSabor(''); setCurado(''); setFecha(hoy()) }
  const editar = (c: Cosecha) => {
    setEditId(c.id); setModo('total')
    setFecha(c.fecha)
    setSeco(c.peso_seco_g?.toString() ?? '')
    setValoracion(c.valoracion ?? 0)
    setSabor(c.notas_sabor ?? '')
    setCurado((c.notas_curado ?? '').replace(/\s*·?\s*Total de variedad \([^)]*\)/, '').trim())
  }
  const borrar = async (c: Cosecha) => {
    if (!(await confirmarBorrado('¿Borrar esta cosecha? No se puede deshacer.'))) return
    try { await cultivoService.eliminarCosecha(c.id); toast.success('Cosecha borrada'); onGuardado() }
    catch (err) { toast.error(`Error: ${(err as Error).message}`) }
  }

  // --- estado modo por planta (map plantaId -> {seco, humedo, val}) ---
  const [porPlanta, setPorPlanta] = useState<Record<string, { seco: string; humedo: string; val: number }>>({})
  // Apagado por defecto. Venía prendido asumiendo que se cosecha la variedad
  // entera de una, pero Gastón cosecha de a poco (fechas distintas por planta) y
  // eso le cerró 10 plantas que no había cosechado. Cerrar una planta es difícil
  // de revertir —pierde el lugar en la sala—, así que el default seguro es NO
  // tocar las que no se pesaron.
  const [cerrarResto, setCerrarResto] = useState(false)
  const setPP = (id: string, k: 'seco' | 'humedo' | 'val', v: string | number) =>
    setPorPlanta(m => {
      const cur = m[id] ?? { seco: '', humedo: '', val: 0 }
      return { ...m, [id]: { ...cur, [k]: v } }
    })

  // Acepta undefined: el mapa de pesos por planta arranca vacío, así que
  // porPlanta[id]?.seco no existe hasta que se escribe algo en ese campo.
  const num = (s?: string | null) => (!s || s.trim() === '' ? null : parseFloat(s.replace(',', '.')))

  const guardarTotal = async () => {
    const pesoSeco = num(seco)
    if (pesoSeco == null) { toast.error('Cargá el peso seco'); return }
    setGuardando(true)
    try {
      if (editId) {
        // Editar una cosecha existente.
        await cultivoService.actualizarCosecha(editId, {
          fecha, peso_seco_g: pesoSeco,
          valoracion: valoracion || null,
          notas_sabor: sabor.trim() || null,
          notas_curado: curado.trim() || null,
        })
        toast.success('Cosecha actualizada')
      } else {
        // Nueva: se registra en una planta representativa de la variedad (la primera).
        const rep = fila.plantas[0]
        if (!rep) {
          // EL CALLEJON SIN SALIDA, con salida (31/08/2026).
          //
          // Decia «Esta variedad no tiene plantas» y ahi terminaba. El operador
          // de la asociación quedo trabado justo aca: habia manicurado el fin de
          // semana, vino a cargar el material y la app le pidio una planta que
          // no existe, porque ese material no salio de sus plantas. Sin poder
          // seguir, tampoco podia dispensar.
          //
          // No se afloja la cosecha -una cosecha sin planta no significa nada y
          // ademas suma dos veces al balance de materia-: se dice cual ES el
          // camino y se lleva hasta ahi.
          toast.error('Esta variedad no tiene plantas cargadas, y una cosecha se registra sobre una planta.', {
            description: 'Si el material vino de afuera o de un cultivo que no está en el sistema, no es una cosecha: cargalo como lote y queda listo para entregar.',
            duration: 12000,
            action: {
              label: 'Cargar como lote',
              // Recarga entera y no `navigate`: `useAbrirAlLlegar` lee `vista` y
              // `nueva` UNA sola vez, al montar. Navegando dentro de la SPA el
              // componente no se remonta y el formulario no abre -que es
              // exactamente el bug que ya costo caro el 27/08.
              onClick: () => { window.location.href = '/ong/portal?vista=catalogo&nueva=lote&guia=lote' },
            },
          })
          setGuardando(false); return
        }
        await cultivoService.crearCosecha({
          planta_id: rep.id, fecha,
          peso_seco_g: pesoSeco, peso_humedo_g: null,
          valoracion: valoracion || null,
          notas_sabor: sabor.trim() || null,
          notas_curado: [curado.trim() || null, `Total de variedad (${fila.plantas.length} pl.)`].filter(Boolean).join(' · '),
        })
        // La cosecha queda en una sola planta, pero se cosechó la variedad entera:
        // el trigger cierra la representativa y acá salen de la Sala las demás.
        const otras = fila.plantas.filter(p => p.id !== rep.id && p.activa).map(p => p.id)
        await cultivoService.cerrarPlantas(otras)
        toast.success(`Cosecha de ${fila.genetica} registrada${otras.length ? ` · ${otras.length + 1} plantas fuera de la Sala` : ''}`)
      }
      onGuardado()
    } catch (err) { toast.error(`Error: ${(err as Error).message}`); setGuardando(false) }
  }

  const guardarPorPlanta = async () => {
    const entradas = Object.entries(porPlanta).filter(([, v]) => num(v.seco) != null)
    if (entradas.length === 0) { toast.error('Cargá el peso de al menos una planta'); return }
    setGuardando(true)
    try {
      for (const [plantaId, v] of entradas) {
        await cultivoService.crearCosecha({
          planta_id: plantaId, fecha,
          peso_seco_g: num(v.seco), peso_humedo_g: null,
          valoracion: v.val || null,
        })
      }
      // Las plantas que no se pesaron siguen en la sala. Si se cosechó la
      // variedad entera hay que sacarlas igual, si no quedan como "en floración"
      // para siempre y la variedad figura a medio cosechar.
      let cerradas = 0
      if (cerrarResto) {
        // Se cierran TODAS las de la variedad, incluidas las que se acaban de
        // pesar. A esas ya las cerró el trigger de la DB, así que el update es
        // redundante ahí, pero en modo demo no hay trigger y de esta forma las
        // dos vías terminan igual.
        const pesadas = new Set(entradas.map(([id]) => id))
        const abiertas = fila.plantas.filter(p => p.activa && p.fase !== 'Cosechada')
        if (abiertas.length) {
          await cultivoService.cerrarPlantas(abiertas.map(p => p.id))
          cerradas = abiertas.filter(p => !pesadas.has(p.id)).length
        }
      }
      toast.success(`${entradas.length} cosecha${entradas.length !== 1 ? 's' : ''} registrada${entradas.length !== 1 ? 's' : ''}`
        + (cerradas ? ` · ${cerradas} planta${cerradas !== 1 ? 's' : ''} más fuera de la sala` : ''))
      onGuardado()
    } catch (err) { toast.error(`Error: ${(err as Error).message}`); setGuardando(false) }
  }

  return (
    <div ref={refDialogo2} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCerrar} />
      <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain rounded-xl bg-[#101016] border border-[#2a2a3a] shadow-2xl">
        <div className="sticky top-0 bg-[#101016] flex items-center justify-between px-5 py-3.5 border-b border-[#1f1f2b]">
          <h2 className="font-display font-semibold text-[15px] text-[#ececf1] flex items-center gap-2">
            <Scissors className="w-4 h-4 text-[#bef264]" /> Cosecha · {fila.genetica}
          </h2>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="p-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-1 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors"><X className="w-5 h-5 sm:w-4 sm:h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Cosechas ya cargadas (editar / borrar) */}
          {fila.cosechas.length > 0 && (
            <div className="rounded-lg bg-[#15151d] border border-[#2a2a3a] overflow-hidden">
              <div className="px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium border-b border-[#2a2a3a]">Cosechas cargadas</div>
              <ul className="divide-y divide-[#20202c]">
                {fila.cosechas.map(c => (
                  <li key={c.id} className={`flex items-center gap-2 px-3 py-2 ${editId === c.id ? 'bg-[#a3e635]/8' : ''}`}>
                    <div className="min-w-0 flex-1 text-[12px] text-[#d4d4dd] truncate tabular-nums">
                      <span className="font-semibold text-[#d9f99d]">{(c.peso_seco_g ?? 0).toLocaleString('es-AR')} g</span>
                      <span className="text-[#8a8a9c]"> · {c.fecha}</span>
                      {c.valoracion != null && <span className="text-[#c4b5fd]"> · ★{c.valoracion}</span>}
                    </div>
                    {/* 44px y separados: en el celular median 22px y estaban
                        pegados, así que era fácil darle a Borrar queriendo Editar. */}
                    <button onClick={() => editar(c)} aria-label="Editar"
                      className="p-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-1 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#bef264] hover:bg-[#bef264]/10 transition-colors" title="Editar"><Pencil className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></button>
                    <button onClick={() => borrar(c)} aria-label="Borrar"
                      className="p-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-1 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ff8a7a] hover:bg-[#ff8a7a]/10 transition-colors" title="Borrar"><Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {editId && (
            <div className="flex items-center justify-between rounded-lg bg-[#a3e635]/10 border border-[#404d20] px-3 py-2">
              <span className="text-[12px] text-[#d9f99d]">Editando una cosecha cargada</span>
              <button onClick={resetForm} className="text-[12px] text-[#a6a6b5] hover:text-[#ececf1] underline">Cancelar</button>
            </div>
          )}

          {/* Selector de modo */}
          {!editId && fila.plantas.length > 1 && (
            <div className="flex gap-1.5 p-1 rounded-lg bg-[#15151d] border border-[#2a2a3a]">
              {(['total', 'planta'] as const).map(m => (
                <button key={m} onClick={() => setModo(m)}
                  className={`flex-1 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${modo === m ? 'bg-[#a3e635]/15 text-[#d9f99d] border border-[#404d20]' : 'text-[#a6a6b5] hover:text-[#ececf1]'}`}>
                  {m === 'total' ? 'Total variedad' : 'Por planta'}
                </button>
              ))}
            </div>
          )}

          <div>
            <label className={etiquetaCampo}>Fecha de cosecha</label>
            <input type="date" className={inputCls} value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>

          {modo === 'total' ? (
            <>
              <div>
                <label className={etiquetaCampo}>Peso seco (g)</label>
                <input type="number" inputMode="decimal" className={inputCls} placeholder="480" value={seco} onChange={e => setSeco(e.target.value)} autoFocus />
              </div>
              {!editId && <p className="text-[12px] text-[#8a8a9c] -mt-2">Se registra el total de las {fila.plantas.length} plantas de {fila.genetica}.</p>}
              <div>
                <label className={etiquetaCampo}>Valoración</label>
                <Estrellas valor={valoracion} onChange={setValoracion} />
              </div>
              <div><label className={etiquetaCampo}>Notas de sabor / cata</label><input className={inputCls} placeholder="Cítrico, terroso, efecto relajante..." value={sabor} onChange={e => setSabor(e.target.value)} /></div>
              <div><label className={etiquetaCampo}>Notas de curado</label><input className={inputCls} placeholder="3 semanas en frascos, 62% HR..." value={curado} onChange={e => setCurado(e.target.value)} /></div>
              <button onClick={guardarTotal} disabled={guardando} className={`${btnPrimario} w-full justify-center`}>
                {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />} {editId ? 'Guardar cambios' : 'Guardar cosecha'}
              </button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                {fila.plantas.map(p => {
                  const v = porPlanta[p.id]
                  // Las ya cosechadas se marcan en rojo para no cargarlas dos veces.
                  const yaCosechada = p.fase === 'Cosechada'
                  return (
                    <div key={p.id}
                      className={`rounded-lg p-3 border ${yaCosechada ? 'bg-[#1a1214] border-[#7a2820]' : 'bg-[#15151d] border-[#2a2a3a]'}`}>
                      <div className="flex items-center gap-1.5 text-[13px] font-medium mb-2 min-w-0">
                        <span className={`truncate ${yaCosechada ? 'text-[#ff8a7a]' : 'text-[#ececf1]'}`}>
                          {p.codigo || p.nombre || 'Planta'}
                        </span>
                        {yaCosechada ? (
                          <span className="text-[11px] font-semibold tracking-wide rounded px-1.5 py-0.5 border flex-shrink-0"
                            style={{ color: '#ff8a7a', background: 'rgba(122,40,32,0.25)', borderColor: '#7a2820' }}>
                            YA COSECHADA
                          </span>
                        ) : (
                          <span className="text-[#8a8a9c] font-normal flex-shrink-0">· {p.fase}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 items-end">
                        <div><label className="block text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-1">Seco g</label><input type="number" inputMode="decimal" className={inputCls} placeholder="120" value={v?.seco ?? ''} onChange={e => setPP(p.id, 'seco', e.target.value)} /></div>
                        <div><label className="block text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-1">Valoración ★</label>
                          <select className={inputCls} value={v?.val ?? 0} onChange={e => setPP(p.id, 'val', Number(e.target.value))}>
                            <option value={0}>—</option>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Marcar una planta como cosechada es difícil de deshacer: pierde
                  el lugar en la sala. Por eso va apagado y se dice EXACTAMENTE
                  cuántas plantas se van a cerrar. */}
              {(() => {
                const sinPeso = fila.plantas.filter(p =>
                  p.activa && p.fase !== 'Cosechada' && num(porPlanta[p.id]?.seco) == null).length
                if (sinPeso === 0) return null
                return (
                  <label className={`flex items-start gap-2.5 mb-3 cursor-pointer rounded-lg border p-3 transition-colors ${
                    cerrarResto ? 'border-[#78500f] bg-[#f59e0b]/10' : 'border-[#2a2a3a] bg-[#15151d]'}`}>
                    <input type="checkbox" checked={cerrarResto} onChange={e => setCerrarResto(e.target.checked)}
                      className="w-4 h-4 mt-0.5 accent-[#facc15] flex-shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-[13px] text-[#ececf1]">
                        Dar por cosechadas las {sinPeso} planta{sinPeso !== 1 ? 's' : ''} que no pesé
                      </span>
                      <span className={`block text-[12px] mt-0.5 leading-snug ${cerrarResto ? 'text-[#fcd34d]' : 'text-[#8a8a9c]'}`}>
                        {cerrarResto
                          ? `Van a salir de la sala sin rinde cargado y liberan su lugar. Tildalo sólo si cosechaste la variedad entera.`
                          : 'Dejalo sin tildar si vas a seguir cosechando el resto más adelante.'}
                      </span>
                    </span>
                  </label>
                )
              })()}
              <button onClick={guardarPorPlanta} disabled={guardando} className={`${btnPrimario} w-full justify-center`}>
                {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />} Guardar cosechas
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Estrellas({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <button key={n} type="button" onClick={() => onChange(n === valor ? 0 : n)} className="p-0.5" title={`${n}/10`}>
          <Star className={`w-4 h-4 ${n <= valor ? 'text-[#f59e0b] fill-[#f59e0b]' : 'text-[#3a3a48]'}`} />
        </button>
      ))}
      {valor > 0 && <span className="ml-1.5 text-[12px] text-[#c4b5fd] tabular-nums">{valor}/10</span>}
    </div>
  )
}
