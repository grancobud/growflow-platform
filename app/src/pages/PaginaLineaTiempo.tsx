// PaginaLineaTiempo — Gantt del cultivo por variedad, con logica de ciclo real:
//  - Automaticas: el tiempo de la ficha es el CICLO TOTAL (semilla -> cosecha).
//  - Feminizadas (fotoperiodicas): el vegetativo es INDEFINIDO; los dias de la
//    ficha son SOLO de floracion y corren desde que se pasa a 12/12 (inicio_flora).
// Cada variedad se puede editar (germinacion, dias de vege/flora, paso a flora).

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarRange, Sprout, Pencil, X, Loader2, ExternalLink, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cultivoService, DIA_FLORA_AUTOMATICA, type Genetica } from '../lib/cultivo'
import { btnPrimario, btnSutil, etiquetaCampo, inputFormulario } from '../lib/ui'
import { useDialogo } from '../lib/useDialogo'

const VERDE = '#a8cf8e', LILA = '#c9b8e8', GRIS = '#b7b3c2'

// text-[16px] en celular: iOS Safari hace zoom sobre cualquier campo con letra
// menor y deja el formulario descuadrado. En desktop vuelve al tamaño real.

const hoyISO = () => new Date().toISOString().slice(0, 10)
const diff = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
const sumar = (f: string, d: number) => { const x = new Date(f + 'T00:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }
const fmt = (f: string | null) => f ? new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'

interface PlantaMin {
  id: string; genetica_id: string | null; fecha_germinacion: string | null
  fase: string; activa: boolean; codigo: string | null; apodo: string | null
}

interface Perfil {
  gen: Genetica
  /**
   * Las plantas de ESTA tanda, para poder desplegarlas.
   *
   * La pantalla agrupa por tanda —genetica + fecha de germinacion— y no por
   * genetica: la misma variedad sembrada en dos fechas son dos ciclos
   * distintos, con dos dias de vida y dos cosechas estimadas. Agrupando por
   * genetica, `perfilDe` se quedaba con la germinacion MAS VIEJA de todas y la
   * segunda tanda no aparecia en ningun lado.
   */
  plantas: PlantaMin[]
  cantidad: number
  auto: boolean
  germinacion: string | null
  diasVida: number
  floraDias: number
  vegeRefDias: number
  inicioFlora: string | null
  // derivados
  enFlora: boolean
  vegeSeg: number      // dias de vegetativo (auto: estimado; fem: reales o en curso)
  floraSeg: number     // dias de floracion (de la ficha)
  total: number
  hoyDias: number      // posicion del marcador "hoy" en dias dentro del total
  cosecha: string | null
  estado: string
  faltan: number | null
}

/** Agrupa por tanda: la misma genetica sembrada otro dia es otra linea. */
function claveDeTanda(p: PlantaMin) { return `${p.genetica_id ?? '-'}|${p.fecha_germinacion ?? '-'}` }

function perfilDe(gen: Genetica, plantas: PlantaMin[]): Perfil | null {
  const activas = plantas.filter(p => p.activa !== false)
  if (activas.length === 0) return null
  const gers = activas.map(p => p.fecha_germinacion).filter(Boolean).sort() as string[]
  const germinacion = gers[0] || null
  const diasVida = germinacion ? Math.max(0, diff(germinacion, hoyISO())) : 0
  const auto = gen.tipo === 'Automatica'
  const floraDias = gen.tiempo_flora_dias || (auto ? 75 : 63)
  const vegeRefDias = gen.tiempo_vege_dias || (auto ? DIA_FLORA_AUTOMATICA : 40)
  const inicioFlora = gen.inicio_flora || null

  let vegeSeg: number, floraSeg: number, total: number, hoyDias: number
  let cosecha: string | null = null, estado: string, faltan: number | null = null, enFlora = false

  if (auto) {
    // ciclo total = floraDias (la ficha de auto es semilla->cosecha)
    total = floraDias
    floraSeg = Math.max(14, Math.round(floraDias * 0.55))
    vegeSeg = floraDias - floraSeg
    hoyDias = Math.min(total, diasVida)
    cosecha = germinacion ? sumar(germinacion, floraDias) : null
    faltan = Math.max(0, floraDias - diasVida)
    estado = diasVida >= floraDias ? 'Lista para cosechar' : 'En ciclo'
  } else if (inicioFlora) {
    // fem en floracion: cuenta desde el flip
    enFlora = true
    const vegeReal = germinacion ? Math.max(1, diff(germinacion, inicioFlora)) : vegeRefDias
    const diasFlora = Math.max(0, diff(inicioFlora, hoyISO()))
    vegeSeg = vegeReal
    floraSeg = floraDias
    total = vegeReal + floraDias
    hoyDias = Math.min(total, vegeReal + diasFlora)
    cosecha = sumar(inicioFlora, floraDias)
    faltan = Math.max(0, floraDias - diasFlora)
    estado = diasFlora >= floraDias ? 'Lista para cosechar' : 'En floración'
  } else {
    // fem en vegetativo: indefinido. Proyecta floracion como referencia (gris)
    vegeSeg = Math.max(diasVida, 7)
    floraSeg = floraDias
    total = vegeSeg + floraDias
    hoyDias = Math.min(vegeSeg, diasVida)
    cosecha = null
    faltan = null
    estado = 'En vegetativo'
  }
  return { gen, plantas: activas, cantidad: activas.length, auto, germinacion, diasVida, floraDias, vegeRefDias, inicioFlora, enFlora, vegeSeg, floraSeg, total, hoyDias, cosecha, estado, faltan }
}

export default function PaginaLineaTiempo() {
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [cargando, setCargando] = useState(true)
  const [edit, setEdit] = useState<Perfil | null>(null)
  /** Que tandas tienen la lista de plantas abierta. */
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [gens, { data: pls }] = await Promise.all([
        cultivoService.getGeneticas(),
        supabase.from('plantas').select('id,genetica_id,fecha_germinacion,fase,activa,codigo,apodo'),
      ])
      const plantas = (pls ?? []) as PlantaMin[]
      // Una linea POR TANDA, no por genetica.
      const porTanda = new Map<string, PlantaMin[]>()
      for (const pl of plantas.filter(x => x.activa !== false)) {
        const k = claveDeTanda(pl)
        porTanda.set(k, [...(porTanda.get(k) ?? []), pl])
      }
      const out: Perfil[] = []
      for (const [, delaTanda] of porTanda) {
        const g = gens.find(x => x.id === delaTanda[0].genetica_id)
        if (!g) continue
        const p = perfilDe(g, delaTanda)
        if (p) out.push(p)
      }
      // Las mas nuevas primero adentro de cada variedad: es la que se esta mirando.
      out.sort((a, b) => (a.auto === b.auto ? 0 : a.auto ? 1 : -1)
        || a.gen.nombre.localeCompare(b.gen.nombre, 'es')
        || (b.germinacion ?? '').localeCompare(a.germinacion ?? ''))
      setPerfiles(out)
    } catch (err) { toast.error(`Error cargando línea de tiempo: ${(err as Error).message}`) }
    finally { setCargando(false) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const maxTotal = useMemo(() => Math.max(90, ...perfiles.map(p => p.total)), [perfiles])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#0a0a0f] text-[#d4d4dd] font-sans">
      <div className="sticky top-0 z-40 bg-[#0a0a0f] border-b border-[#1f1f2b]">
        <div className="flex items-center flex-wrap gap-2 px-3 sm:px-6 py-3">
          <h1 className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] text-[#ececf1] flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-[#bef264]" /> Línea de tiempo
          </h1>
          <span className="text-[10px] sm:text-[11px] text-[#8a8a9c]">
            {perfiles.length} {perfiles.length === 1 ? 'tanda' : 'tandas'}
            {(() => { const v = new Set(perfiles.map(p => p.gen.id)).size
              return v !== perfiles.length ? ` · ${v} ${v === 1 ? 'variedad' : 'variedades'}` : '' })()}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-3 sm:px-6 pb-2.5 text-[10px] text-[#a6a6b5]">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: VERDE }} /> Vegetativo</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: LILA }} /> Floración</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: GRIS, opacity: .5 }} /> estimado (sin empezar)</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0 border-t-2 border-dashed border-[#bef264]" /> hoy</span>
        </div>
      </div>

      {cargando ? (
        <div className="px-3 sm:px-6 py-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-[#101016] border border-[#1f1f2b] animate-pulse" />)}
        </div>
      ) : perfiles.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mx-auto w-11 h-11 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-3"><Sprout className="w-5 h-5 text-[#8a8a9c]" /></div>
          <div className="font-display font-semibold text-[#d4d4dd] text-[14px]">Sin plantas activas</div>
          <div className="mt-1 text-[11px] text-[#8a8a9c]">Cargá plantas con fecha de germinación para ver su línea de tiempo.</div>
        </div>
      ) : (
        <div className="px-3 sm:px-6 py-4 pb-24 space-y-2.5">
          {perfiles.map(p => {
            const clave = `${p.gen.id}|${p.germinacion ?? '-'}`
            // Si la variedad tiene mas de una tanda, la fecha es lo que las
            // distingue: sin eso serian dos tarjetas con el mismo titulo.
            const variasTandas = perfiles.filter(x => x.gen.id === p.gen.id).length > 1
            const abierta = abiertas.has(clave)
            const anchoBarra = Math.round((p.total / maxTotal) * 100)
            const vegePct = (p.vegeSeg / p.total) * 100
            const floraPct = (p.floraSeg / p.total) * 100
            const hoyPct = Math.min(100, (p.hoyDias / p.total) * 100)
            const lista = p.estado === 'Lista para cosechar'
            // la floracion va "apagada" mientras la fem no arrancó flora
            const floraApagada = !p.auto && !p.enFlora
            return (
              <div key={clave} className="rounded-xl bg-[#101016] border border-[#1f1f2b] hover:border-[#404d20] transition-colors p-3 sm:p-3.5">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-display font-semibold text-[13px] text-[#ececf1]">{p.gen.nombre}</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium border"
                    style={p.auto ? { background: 'rgba(143,208,198,0.10)', borderColor: '#1e4a44', color: '#8ed0c6' } : { background: 'rgba(201,184,232,0.10)', borderColor: '#463a66', color: '#c9b8e8' }}>
                    {p.auto ? 'Automática' : 'Feminizada'}
                  </span>
                  {p.gen.genotipo && <span className="text-[10px] text-[#8a8a9c]">{p.gen.genotipo}</span>}
                  {variasTandas && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[#1f1f2b] text-[#a6a6b5]">
                      sembrada {fmt(p.germinacion)}
                    </span>
                  )}
                  <span className="text-[10px] text-[#8a8a9c]">· {p.cantidad} pl.</span>
                  {/* El espaciador SOLO en pantalla ancha.
                      A 390 px esta cabecera no entra en una fila —nombre,
                      badge, genotipo y cantidad ya se la llevan— y el
                      espaciador se come el sobrante del primer renglón: los
                      chips quedan separados por un hueco de 126 px y el estado
                      con el lápiz bajan solos. Es el mismo caso del `ml-auto`,
                      con otra clase. Sin él, todo fluye a la izquierda y las dos
                      filas arrancan parejas. */}
                  <div className="hidden sm:block flex-1" />
                  <span className="text-[11px] font-medium" style={{ color: lista ? '#bef264' : (p.enFlora ? LILA : VERDE) }}>{p.estado}</span>
                  <button onClick={() => setEdit(p)} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 text-[#8a8a9c] hover:text-[#d9f99d] hover:bg-[#15151d] rounded-lg transition-colors" title="Editar / ver ficha"><Pencil className="w-3.5 h-3.5" /></button>
                </div>
                <div className="relative" style={{ width: `${anchoBarra}%`, minWidth: '200px' }}>
                  <div className="relative h-7 rounded-md overflow-hidden flex">
                    <div style={{ width: `${vegePct}%`, background: VERDE + '4d' }} />
                    <div style={{ width: `${floraPct}%`, background: LILA + (floraApagada ? '1f' : '4d') }} />
                  </div>
                  <div className="absolute top-0 left-0 h-7 rounded-l-md pointer-events-none" style={{ width: `${hoyPct}%`, background: lista ? 'rgba(190,242,100,0.16)' : 'rgba(255,255,255,0.06)', borderRight: '2px dashed #bef264' }} />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-[#8a8a9c]">
                  <span>Germinó: {fmt(p.germinacion)} · <span className="text-[#a6a6b5] tabular-nums">día {p.diasVida}</span></span>
                  {p.auto
                    ? <span>{lista ? 'Ciclo cumplido' : `faltan ~${p.faltan} días`} · cosecha estimada <span className="text-[#a6a6b5]">{fmt(p.cosecha)}</span></span>
                    : p.enFlora
                      ? <span>En flora desde {fmt(p.inicioFlora)} · {lista ? 'a cosechar' : `faltan ~${p.faltan} días`} · cosecha <span className="text-[#a6a6b5]">{fmt(p.cosecha)}</span></span>
                      : <span className="text-[#8f8f9f]">Vegetativo indefinido (fotoperiódica) — editá "pasó a floración" para estimar la cosecha</span>}
                </div>

                {/* Las plantas de la tanda, con su codigo.
                    La barra es de la tanda entera, pero cada planta tiene su
                    codigo y su ficha. Va cerrada por defecto: a esta pantalla se
                    entra a mirar los tiempos, no el padron. */}
                <button onClick={() => setAbiertas(prev => {
                  const n = new Set(prev)
                  if (n.has(clave)) n.delete(clave); else n.add(clave)
                  return n
                })}
                  className="mt-2 inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 sm:py-1 text-[11px] text-[#8f8f9f] hover:text-[#d4d4dd] transition-colors">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${abierta ? 'rotate-180' : ''}`} />
                  {abierta ? 'Ocultar las plantas' : `Ver las ${p.cantidad} plantas`}
                </button>
                {abierta && (
                  <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-1.5">
                    {p.plantas.map(pl => (
                      <div key={pl.id}
                        className="min-w-0 rounded-lg bg-[#15151d] border border-[#1f1f2b] px-2 py-1.5 min-h-[44px] sm:min-h-0 flex flex-col justify-center">
                        <span className="truncate text-[11px] font-mono tabular-nums text-[#d4d4dd]">{pl.codigo ?? '—'}</span>
                        {pl.apodo && <span className="truncate text-[10px] text-[#8a8a9c]">{pl.apodo}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <p className="text-[10px] text-[#8a8a9c] pt-2">En automáticas el tiempo de la ficha es el ciclo total (semilla a cosecha). En feminizadas el vegetativo es indefinido; los días de floración corren desde que las pasás a 12/12. La línea punteada marca hoy.</p>
        </div>
      )}

      {edit && <ModalEditar perfil={edit} onCerrar={() => setEdit(null)} onGuardado={() => { setEdit(null); cargar() }} />}
    </div>
  )
}

function ModalEditar({ perfil, onCerrar, onGuardado }: { perfil: Perfil; onCerrar: () => void; onGuardado: () => void }) {
  const refDialogo = useDialogo(onCerrar)
  const g = perfil.gen
  const [germ, setGerm] = useState(perfil.germinacion ?? '')
  const [vege, setVege] = useState<string>(g.tiempo_vege_dias != null ? String(g.tiempo_vege_dias) : '')
  const [flora, setFlora] = useState<string>(g.tiempo_flora_dias != null ? String(g.tiempo_flora_dias) : '')
  const [inicioFlora, setInicioFlora] = useState(g.inicio_flora ?? '')
  const [guardando, setGuardando] = useState(false)

  // preview de cosecha
  const fd = Number(flora) || perfil.floraDias
  const cosechaPrev = perfil.auto
    ? (germ ? sumar(germ, fd) : null)
    : (inicioFlora ? sumar(inicioFlora, fd) : null)

  const guardar = async () => {
    setGuardando(true)
    try {
      await cultivoService.actualizarGenetica(g.id, {
        tiempo_vege_dias: vege === '' ? null : Number(vege),
        tiempo_flora_dias: flora === '' ? null : Number(flora),
        inicio_flora: !perfil.auto && inicioFlora ? inicioFlora : (!perfil.auto ? null : g.inicio_flora ?? null),
      })
      // SOLO LAS PLANTAS DE ESTA TANDA, no las de toda la variedad.
      //
      // Los dos updates de abajo filtraban por `genetica_id` a secas. Con una
      // sola siembra por variedad daba igual, pero con dos tandas de la misma
      // genetica corregir la fecha de una pisaba la fecha de la OTRA, y marcar
      // el paso a floracion mandaba a flora tambien a las que acababan de
      // germinar. Se filtra ademas por la fecha de germinacion, que es lo que
      // define la tanda.
      if (germ && germ !== (perfil.germinacion ?? '')) {
        const q = supabase.from('plantas').update({ fecha_germinacion: germ }).eq('genetica_id', g.id)
        await (perfil.germinacion == null
          ? q.is('fecha_germinacion', null)
          : q.eq('fecha_germinacion', perfil.germinacion))
      }
      // si es fem y se marcó el paso a flora, poner las plantas en floracion
      if (!perfil.auto && inicioFlora) {
        const q = supabase.from('plantas').update({ fase: 'Floracion' })
          .eq('genetica_id', g.id).neq('fase', 'Cosechada')
        await (perfil.germinacion == null
          ? q.is('fecha_germinacion', null)
          : q.eq('fecha_germinacion', perfil.germinacion))
      }
      toast.success('Ficha actualizada'); onGuardado()
    } catch (err) { toast.error(`Error: ${(err as Error).message}`) }
    finally { setGuardando(false) }
  }

  return (
    <div ref={refDialogo} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onCerrar}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#0d0d12] border-b border-[#1f1f2b] px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-[15px] text-[#ececf1] truncate">{g.nombre}</h2>
            <div className="text-[10px] text-[#8a8a9c]">{perfil.auto ? 'Automática' : 'Feminizada'}{g.genotipo ? ' · ' + g.genotipo : ''}{g.banco ? ' · ' + g.banco : ''}</div>
          </div>
          <button onClick={onCerrar} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 text-[#8a8a9c] hover:text-[#ececf1]" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div><label className={etiquetaCampo}>Fecha de germinación</label><input type="date" className={inputFormulario} value={germ} onChange={e => setGerm(e.target.value)} /><p className="text-[10px] text-[#8a8a9c] mt-1">Se aplica a las {perfil.cantidad} plantas de esta variedad.</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={etiquetaCampo}>{perfil.auto ? 'Ciclo total (días)' : 'Vegetativo de referencia (días)'}</label><input type="number" min={1} className={inputFormulario} value={perfil.auto ? flora : vege} onChange={e => perfil.auto ? setFlora(e.target.value) : setVege(e.target.value)} /></div>
            <div><label className={etiquetaCampo}>{perfil.auto ? 'Tramo de flora (días)' : 'Floración (días)'}</label><input type="number" min={1} className={inputFormulario} value={flora} onChange={e => setFlora(e.target.value)} disabled={perfil.auto} /></div>
          </div>
          {!perfil.auto && (
            <div>
              <label className={etiquetaCampo}>Pasó a floración (12/12) el…</label>
              <input type="date" className={inputFormulario} value={inicioFlora} onChange={e => setInicioFlora(e.target.value)} />
              <p className="text-[10px] text-[#8a8a9c] mt-1">Dejalo vacío si sigue en vegetativo. Al ponerlo, se calcula la cosecha y las plantas pasan a floración.</p>
            </div>
          )}
          <div className="rounded-lg bg-[#15151d] border border-[#2a2a3a] px-3 py-2.5 text-[12px]">
            <span className="text-[#8a8a9c]">Cosecha estimada: </span>
            <span className="text-[#d9f99d] font-medium">{cosechaPrev ? fmt(cosechaPrev) : (perfil.auto ? '—' : 'definí el paso a floración')}</span>
          </div>
          <Link to="/geneticas" className="inline-flex items-center gap-1.5 text-[11px] text-[#8ed0c6] hover:text-[#bef264]"><ExternalLink className="w-3.5 h-3.5" /> Ver / editar la ficha completa en Genéticas</Link>
        </div>
        <div className="sticky bottom-0 bg-[#0d0d12] border-t border-[#1f1f2b] px-4 py-3 flex justify-end gap-2">
          <button onClick={onCerrar} className={btnSutil}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className={btnPrimario}>{guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}Guardar</button>
        </div>
      </div>
    </div>
  )
}
