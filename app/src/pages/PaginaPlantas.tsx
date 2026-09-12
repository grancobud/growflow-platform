// PaginaPlantas — gestion de plantas y geneticas del cultivo personal.
// Lista con cards, alta de genetica/planta, registro rapido de eventos y cambio de fase.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Leaf, Plus, X, Droplets, Scissors, FlaskConical, StickyNote,
  Dna, Loader2, ChevronDown, ChevronUp, Flower2, Trash2, Search, SlidersHorizontal,
} from 'lucide-react'
import {
  cultivoService, generarCodigoPlanta, FASES, TIPOS_GENETICA, SUSTRATOS,
  type ResumenPlanta, type Genetica, type Evento, type FasePlanta, type TipoEvento, colorFase,
  faseFueDerivada } from '../lib/cultivo'
import { registroService, type Paciente } from '../lib/registro'
import DetallePlanta from '../components/DetallePlanta'
import { btnPrimario, btnSutil, nombreTocable, selectFiltro, etiquetaCampo, inputFormulario } from '../lib/ui'
import { AyudaCampo } from '../components/ong/GuiaDelFormulario'
import { useAbrirAlLlegar } from '../lib/useAbrirAlLlegar'
import { useDialogo } from '../lib/useDialogo'
import { Desplegable } from '../components/ui/Desplegable'
import { useAnchoDesde, SM } from '../lib/useAnchoDesde'
import { confirmarBorrado } from '../lib/confirmar'
import { SelectorPersona } from '../components/ong/SelectorPersona'


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
    <span className="text-[10px] font-semibold tracking-wide rounded px-1.5 py-0.5 border" title={tipo}
      style={{ color: c.text, background: c.bg, borderColor: c.border }}>{c.label}</span>
  )
}

// text-[16px] en celular: iOS Safari hace zoom sobre cualquier campo con letra
// menor y deja el formulario descuadrado. En desktop vuelve al tamaño real.
// El de `lib/ui.ts`, más lo que la grilla necesita.
//
// Estaba redefinido acá entero, que es la copia que `ui.ts` existe para evitar.
// El `w-full max-w-none` es sólo del teléfono: adentro de la grilla de dos
// columnas cada celda ya fija el ancho, y el tope de 170 px dejaba un hueco.
// De `sm:` para arriba vuelve a ser el de siempre.
// El ancho lo pone la CELDA de la grilla, no el contenido.
//
// Antes, de 640px para arriba, esto volvia a `w-auto max-w-[170px]` y cada
// select media lo que medía su texto: a 660 px daban 143, 95, 116 y 170, o sea
// una fila que terminaba en 572 contra un contenido que llega a 636. Sumado al
// buscador —que quedaba en 234— y a «Riego pendiente» —en 145—, eran tres filas
// que terminaban en tres lugares distintos. Eso es lo que se lee como
// desalineado, aunque cada control por separado esté bien.
const filtroEnGrilla = `${selectFiltro} w-full max-w-none`

// "Tarea pendiente" derivable de los datos reales: el riego. Una planta en fase
// de crecimiento tiene riego pendiente si pasaron RIEGO_PENDIENTE_DIAS+ del último
// riego registrado (o si nunca se registró uno).
const RIEGO_PENDIENTE_DIAS = 3
const FASES_VIVAS: FasePlanta[] = ['Germinacion', 'Plantula', 'Vegetativo', 'Floracion']
function diasSinRiego(ultimoRiego: string | null): number | null {
  if (!ultimoRiego) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const r = new Date(ultimoRiego + 'T00:00:00')
  return Math.round((hoy.getTime() - r.getTime()) / 86400000)
}
function tieneRiegoPendiente(p: ResumenPlanta): boolean {
  if (!FASES_VIVAS.includes(p.fase)) return false
  const d = diasSinRiego(p.ultimo_riego)
  return d === null || d >= RIEGO_PENDIENTE_DIAS
}

export default function PaginaPlantas() {
  const [plantas, setPlantas] = useState<ResumenPlanta[]>([])
  const [geneticas, setGeneticas] = useState<Genetica[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [verInactivas, setVerInactivas] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [modalPlanta, setModalPlanta] = useState(false)
  const [modalGenetica, setModalGenetica] = useState(false)
  /** Si los filtros estan desplegados EN EL TELEFONO. En pantalla ancha van siempre. */
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  // `sm:` de Tailwind, que es el corte que usa la botonera de filtros. Desde ahí
  // no hay nada que desplegar: se ven siempre.
  const anchoSm = useAnchoDesde(SM)

  /** El paso 2 de «Registrar una cosecha» abre el alta al llegar. Ver el
      comentario del paso 1 en `PaginaGeneticas`: misma razón, misma regla de
      que la clave coincida con la de la ruta. */
  const abrirNuevaPlanta = useCallback(() => setModalPlanta(true), [])
  useAbrirAlLlegar(abrirNuevaPlanta, 'planta', modalPlanta)
  const [expandida, setExpandida] = useState<string | null>(null)
  const [eventosPlanta, setEventosPlanta] = useState<Record<string, Evento[]>>({})
  const [detalle, setDetalle] = useState<ResumenPlanta | null>(null)
  // --- filtros ---
  const [busqueda, setBusqueda] = useState('')
  const [fGenetica, setFGenetica] = useState('')
  const [fFase, setFFase] = useState<FasePlanta | ''>('')
  const [fUbicacion, setFUbicacion] = useState('')
  const [fPaciente, setFPaciente] = useState('')
  const [soloRiego, setSoloRiego] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [resumen, gens, pacs] = await Promise.all([
        cultivoService.getResumenPlantas(!verInactivas),
        cultivoService.getGeneticas(),
        registroService.getPacientes().catch(() => []),
      ])
      setPlantas(resumen)
      setGeneticas(gens)
      setPacientes(pacs)
    } catch (err) {
      toast.error(`Error cargando plantas: ${(err as Error).message}`)
    } finally {
      setCargando(false)
    }
  }, [verInactivas])

  useEffect(() => { cargar() }, [cargar])

  const toggleEventos = async (plantaId: string) => {
    if (expandida === plantaId) { setExpandida(null); return }
    setExpandida(plantaId)
    if (!eventosPlanta[plantaId]) {
      try {
        const evs = await cultivoService.getEventos(plantaId, 15)
        setEventosPlanta(prev => ({ ...prev, [plantaId]: evs }))
      } catch { /* la card muestra vacio */ }
    }
  }

  const registrarEvento = async (plantaId: string, tipo: TipoEvento, detalle?: string) => {
    try {
      await cultivoService.crearEvento({ planta_id: plantaId, tipo, detalle: detalle ?? null })
      toast.success(`${tipo} registrado`)
      setEventosPlanta(prev => { const { [plantaId]: _, ...rest } = prev; return rest })
      cargar()
    } catch (err) {
      toast.error(`No se pudo registrar: ${(err as Error).message}`)
    }
  }

  const registrarCosecha = async (plantaId: string, pesoSeco: number, valoracion?: number) => {
    try {
      await cultivoService.crearCosecha({
        planta_id: plantaId,
        fecha: new Date().toISOString().slice(0, 10),
        peso_seco_g: pesoSeco,
        valoracion: valoracion || null,
      })
      // Pasa la planta a fase Cosechada
      await cultivoService.crearEvento({ planta_id: plantaId, tipo: 'CambioFase', detalle: 'Cosechada' })
      toast.success(`Cosecha registrada: ${pesoSeco} g`)
      cargar()
    } catch (err) {
      toast.error(`No se pudo registrar la cosecha: ${(err as Error).message}`)
    }
  }

  const eliminarPlanta = async (p: ResumenPlanta) => {
    if (!(await confirmarBorrado(`¿Borrar "${p.nombre}" y todos sus eventos? No se puede deshacer.`))) return
    try {
      await cultivoService.eliminarPlanta(p.id)
      toast.success(`"${p.nombre}" borrada`)
      setExpandida(null)
      cargar()
    } catch (err) {
      toast.error(`No se pudo borrar: ${(err as Error).message}`)
    }
  }

  const eliminarEvento = async (plantaId: string, eventoId: string) => {
    try {
      await cultivoService.eliminarEvento(eventoId)
      toast.success('Evento borrado')
      const evs = await cultivoService.getEventos(plantaId, 15)
      setEventosPlanta(prev => ({ ...prev, [plantaId]: evs }))
      cargar()
    } catch (err) {
      toast.error(`No se pudo borrar: ${(err as Error).message}`)
    }
  }

  const cambiarFase = async (plantaId: string, fase: FasePlanta) => {
    try {
      await cultivoService.crearEvento({ planta_id: plantaId, tipo: 'CambioFase', detalle: fase })
      toast.success(`Fase: ${fase}`)
      cargar()
    } catch (err) {
      toast.error(`No se pudo cambiar fase: ${(err as Error).message}`)
    }
  }

  // Opciones de filtro derivadas de las plantas cargadas
  const geneticasUnicas = useMemo(
    () => Array.from(new Set(plantas.map(p => p.genetica).filter((g): g is string => !!g))).sort((a, b) => a.localeCompare(b, 'es')),
    [plantas])
  const ubicacionesUnicas = useMemo(
    () => Array.from(new Set(plantas.map(p => p.ubicacion).filter((u): u is string => !!u))).sort((a, b) => a.localeCompare(b, 'es')),
    [plantas])
  const pacientesUnicos = useMemo(() => {
    const m = new Map<string, string>()
    plantas.forEach(p => { if (p.paciente_id) m.set(p.paciente_id, p.paciente_nombre ?? 'Paciente') })
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [plantas])
  const fasesPresentes = useMemo(() => FASES.filter(f => plantas.some(p => p.fase === f)), [plantas])

  const q = busqueda.trim().toLowerCase()
  const plantasFiltradas = useMemo(() => plantas.filter(p =>
    (!q || p.nombre.toLowerCase().includes(q) || (p.codigo ?? '').toLowerCase().includes(q) || (p.genetica ?? '').toLowerCase().includes(q)) &&
    (!fGenetica || p.genetica === fGenetica) &&
    (!fFase || p.fase === fFase) &&
    (!fUbicacion || p.ubicacion === fUbicacion) &&
    (!fPaciente || p.paciente_id === fPaciente) &&
    (!soloRiego || tieneRiegoPendiente(p))
  ).sort((a, b) => {
    // Agrupar por variedad (genética) y, dentro, por número de planta.
    const ga = a.genetica ?? '￿', gb = b.genetica ?? '￿'
    const g = ga.localeCompare(gb, 'es')
    if (g !== 0) return g
    return a.nombre.localeCompare(b.nombre, 'es', { numeric: true })
  }), [plantas, q, fGenetica, fFase, fUbicacion, fPaciente, soloRiego])
  const riegoPendienteCount = useMemo(() => plantas.filter(tieneRiegoPendiente).length, [plantas])
  const hayFiltros = !!(q || fGenetica || fFase || fUbicacion || fPaciente || soloRiego)
  /**
   * Los filtros puestos SIN contar el buscador, que queda siempre a la vista.
   *
   * Es lo que hace que plegarlos no los esconda: el boton dice cuantos hay
   * activos, asi que nadie se queda mirando una lista filtrada sin entender por
   * que le falta la mitad de las plantas.
   */
  const nFiltros = [fGenetica, fFase, fUbicacion, fPaciente].filter(Boolean).length + (soloRiego ? 1 : 0)
  const limpiarFiltros = () => { setBusqueda(''); setFGenetica(''); setFFase(''); setFUbicacion(''); setFPaciente(''); setSoloRiego(false) }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#0a0a0f] text-[#d4d4dd] font-sans">
      <div className="sticky top-0 z-40 bg-[#0a0a0f] border-b border-[#1f1f2b]">
        <div className="flex items-center flex-wrap gap-2 sm:gap-x-4 px-3 sm:px-6 py-3">
          <div className="min-w-0">
            <h1 className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] text-[#ececf1]">Plantas</h1>
            <div className="mt-0.5 text-[10px] sm:text-[11px] text-[#8a8a9c]">
              {hayFiltros ? `${plantasFiltradas.length} de ${plantas.length}` : `${plantas.length} ${verInactivas ? 'en total' : 'activas'}`} · {geneticas.length} genéticas
            </div>
          </div>
          <div className="flex-1" />
          <button onClick={() => setVerInactivas(v => !v)} className={btnSutil}>
            {verInactivas ? 'Solo activas' : 'Ver todas'}
          </button>
          <button onClick={() => setModalGenetica(true)} className={btnSutil}>
            <Dna className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Genética</span>
          </button>
          <button onClick={() => setModalPlanta(true)} className={btnPrimario}>
            <Plus className="w-3.5 h-3.5" /> Planta
          </button>
        </div>
      </div>

      <div className="px-3 sm:px-6 py-4 pb-20">
        {!cargando && plantas.length > 0 && (
          <div className="mb-4">
          {/* EN EL TELEFONO LOS FILTROS ARRANCAN PLEGADOS.
              Son siete controles de 44px de alto y a 375px entran de a uno por
              fila: tres filas y media de filtros antes de ver la primera planta.
              El buscador se queda afuera —es el que se usa siempre— y el resto
              se abre cuando hace falta. El boton dice cuantos hay puestos, asi
              que plegados no esconden nada. */}
          <div className="flex flex-wrap items-center gap-3">
            {/* `flex-1` de 640 para arriba, PERO CON TOPE DE 440 px EN DESKTOP.
                Medido el 05/09/2026 a 1160 px de ventana: el buscador daba 847
                px de ancho y 36 de alto para escribir un nombre de planta. Un
                rectangulo oscuro vacio del ancho de la pantalla, con el
                placeholder perdido en la punta izquierda. la asociación lo vio y dijo
                «horrible barra».

                El tope va solo en `lg:`. Abajo de eso el ancho disponible es
                poco y el buscador tiene que aprovecharlo entero; el problema
                aparece cuando sobra lugar, no cuando falta.

                ⚠️ EL NUMERO NO ES A OJO: SON TRES COLUMNAS DE LA GRILLA DE
                ABAJO. La fila de filtros es `lg:grid-cols-5` con `gap-3`, o sea
                cinco columnas de `c = (W - 4g) / 5`. Tres columnas mas los dos
                gaps que las unen dan `3c + 2g = 0.6W - 0.4g`, y con `g = 12px`
                eso es `60% - 4.8px`. El borde derecho del buscador cae EXACTO
                sobre el del tercer filtro.

                ⚠️ SI CAMBIA EL `gap` DE LA GRILLA, CAMBIA ESTE NUMERO. Son la
                misma cuenta escrita en dos lados: `0.4 * gap`. Con `gap-2` era
                `3.2px`; se paso a `gap-3` el 05/09/2026 y por eso dice `4.8px`.

                Importa que sea una linea de la grilla y no un ancho lindo. El
                buscador no llega hasta el borde de las tarjetas —y no tiene por
                que: un campo de busqueda anclado a la izquierda de una barra de
                herramientas es lo normal—, pero termina donde termina algo. Un
                corte a los 440 px se lee como que quedo a medias; uno que se
                apoya en una columna se lee como puesto ahi. */}
            <div className="relative flex-1 min-w-0 lg:max-w-[calc(60%_-_4.8px)]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8a8a9c]" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar nombre / código / genética"
                className="pl-8 pr-3 py-2 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[12px] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#a3e635]/60 min-h-[44px] sm:min-h-0 w-full" />
            </div>
            <button type="button" onClick={() => setFiltrosAbiertos(v => !v)}
              aria-expanded={filtrosAbiertos}
              className={`sm:hidden inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg border text-[11px] font-medium transition-colors ${
                nFiltros > 0 ? 'border-[#404d20] bg-[#a3e635]/10 text-[#d9f99d]' : 'border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5]'}`}>
              <SlidersHorizontal aria-hidden className="w-3.5 h-3.5" />
              Filtros{nFiltros > 0 ? ` (${nFiltros})` : ''}
            </button>
          </div>

          {/* El `mt-2` pasó a `pt-2`: el margen queda fuera del alto que mide el
              desplegable, y esos ocho píxeles se recortarían con el panel abierto. */}
          {/* ⚠️ `sm:pt-3`, NO `sm:pt-0`. Estaba en cero, así que en desktop la
              fila de filtros arrancaba pegada al borde de abajo del buscador:
              dos cajas con borde propio, separadas por nada. la asociación lo vio y
              dijo «me importa que no se toquen».

              El cero venía de que el `pt-2` es del teléfono —tiene que ir por
              dentro para que el desplegable no lo recorte al plegarse— y en
              `sm:` el panel está siempre abierto, así que alguien lo apagó sin
              poner nada en su lugar.

              Y `gap-3` en vez de `gap-2`: entre cinco controles con borde,
              ocho píxeles de fondo casi del mismo color se leen como una
              costura, no como una separación. Doce ya se ven. */}
          {/* GRILLA EN TODOS LOS ANCHOS, no grilla en el teléfono y fila suelta arriba.
              Con `sm:flex sm:flex-wrap` cada control media lo que medía su texto y
              la fila terminaba donde caía: el borde derecho quedaba distinto en
              cada renglón. Una grilla alinea por construcción — todas las celdas
              miden igual y el renglón lleno termina en el margen.
              Y a diferencia de `flex-1` dentro de `flex-wrap`, si el último
              renglón queda con un solo control, ése NO se estira a lo ancho de
              toda la pantalla: se queda del ancho de su columna. */}
          <Desplegable abierto={filtrosAbiertos} sinRecorte={anchoSm}
            className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 sm:pt-3 lg:grid-cols-5">
            <select value={fGenetica} onChange={e => setFGenetica(e.target.value)} className={filtroEnGrilla} title="Filtrar por genética">
              <option value="">Toda genética</option>
              {geneticasUnicas.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={fFase} onChange={e => setFFase(e.target.value as FasePlanta | '')} className={filtroEnGrilla} title="Filtrar por fase">
              <option value="">Toda fase</option>
              {fasesPresentes.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {ubicacionesUnicas.length > 0 && (
              <select value={fUbicacion} onChange={e => setFUbicacion(e.target.value)} className={filtroEnGrilla} title="Filtrar por ubicación">
                <option value="">Toda ubicación</option>
                {ubicacionesUnicas.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            )}
            {pacientesUnicos.length > 0 && (
              <select value={fPaciente} onChange={e => setFPaciente(e.target.value)} className={filtroEnGrilla} title="Filtrar por paciente asignado">
                <option value="">Todo paciente</option>
                {pacientesUnicos.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
              </select>
            )}
            <button onClick={() => setSoloRiego(v => !v)}
              className={`inline-flex w-full items-center justify-center gap-1.5 px-2.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg border text-[11px] font-medium transition-colors ${soloRiego ? 'border-[#5a4a20] bg-[#f59e0b]/12 text-[#f59e0b]' : 'border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5] hover:text-[#ececf1] hover:border-[#404d20]'}`}
              title="Plantas que necesitan riego: 3+ días sin regar (o sin registro)">
              <Droplets className="w-3.5 h-3.5" /> Riego pendiente{riegoPendienteCount > 0 ? ` (${riegoPendienteCount})` : ''}
            </button>
            {hayFiltros && (
              <button onClick={limpiarFiltros} className="inline-flex w-full items-center justify-center gap-1 px-2 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[11px] text-[#8a8a9c] hover:text-[#ff8a7a] transition-colors" title="Limpiar filtros">
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
          </Desplegable>
          </div>
        )}
        {cargando ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-[#101016] border border-[#1f1f2b] h-[140px] animate-pulse" />
            ))}
          </div>
        ) : plantas.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto w-11 h-11 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-3">
              <Leaf className="w-5 h-5 text-[#8a8a9c]" />
            </div>
            <div className="font-display font-semibold text-[#d4d4dd] text-[14px]">Sin plantas cargadas</div>
            <div className="mt-1 text-[11px] text-[#8a8a9c]">Arrancá creando una genética y después la planta.</div>
          </div>
        ) : plantasFiltradas.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto w-11 h-11 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-3">
              <Leaf className="w-5 h-5 text-[#8a8a9c]" />
            </div>
            <div className="font-display font-semibold text-[#d4d4dd] text-[14px]">Sin resultados</div>
            <div className="mt-1 text-[11px] text-[#8a8a9c]">Ninguna planta coincide con los filtros.</div>
            <button onClick={limpiarFiltros} className={`${btnSutil} mt-3`}><X className="w-3.5 h-3.5" /> Limpiar filtros</button>
          </div>
        ) : (
          // SIN `items-start`: las tarjetas de una fila se estiran al mismo alto.
          // Con el tope alineado, la que tenia un renglon de mas —un nombre de
          // paciente largo— dejaba a sus vecinas cortadas arriba y las barras de
          // botones quedaban a tres alturas distintas. El comentario va como
          // comentario de JS y no de JSX: adentro de un ternario, un {/* */}
          // suelto antes del elemento deja dos hijos en la expresion y no compila.
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {plantasFiltradas.map(p => {
              const cf = colorFase(p.fase)
              const abierta = expandida === p.id
              const riegoPend = tieneRiegoPendiente(p)
              // `@container`: lo de adentro responde al ancho de LA TARJETA, no
              // al de la ventana.
              //
              // La grilla es `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`, así que
              // la tarjeta es MÁS ANGOSTA en escritorio que en el teléfono: ~350 px
              // a 390 de ventana, ~250 a 768 —cuando entra la segunda columna— y
              // 368 a 1440. Con breakpoints de viewport se mostraban los textos de
              // los cinco botones justo a 768, que es el ancho en el que peor
              // entran. El comentario va ACÁ y no adentro del `return`: suelto
              // antes del elemento deja dos hijos en la expresión y no compila.
              return (
                <div key={p.id} className="@container flex flex-col rounded-xl bg-[#101016] border border-[#1f1f2b] hover:border-[#404d20] transition-colors overflow-hidden">
                  <div className="p-3 sm:p-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <button onClick={() => setDetalle(p)}
                          className={`font-display font-semibold text-[14px] text-[#ececf1] truncate hover:text-[#bef264] transition-colors text-left ${nombreTocable}`}
                          title="Ver línea de tiempo">{p.nombre}</button>
                        <p className="text-[11px] text-[#8a8a9c] truncate mt-0.5">
                          {p.genetica ?? 'Sin genética'}{p.banco ? ` · ${p.banco}` : ''}
                        </p>
                        {/* El chip, el codigo y el paciente en la MISMA linea que
                            la genetica: eran tres renglones de cabecera para tres
                            datos cortos, en una tarjeta que se repite sesenta
                            veces. El codigo baja a 9.5px y se lee igual porque es
                            monoespaciado.

                            ⚠️ SIN `flex-wrap`, Y ESO ES EL ARREGLO. Con wrap, un
                            nombre de paciente largo —«Facundo Ruben Benitez»— no
                            entraba en lo que sobraba y se iba al renglon de
                            abajo: esa tarjeta crecia y quedaba desalineada de sus
                            vecinas. El `max-w` fijo no alcanzaba porque el corte
                            depende de cuanto ocupan el chip y el codigo, que
                            varian. Ahora el nombre se lleva el espacio que queda
                            y se corta ahi. */}
                        <div className="flex items-center gap-1.5 mt-1 min-w-0">
                          <span className="flex-shrink-0"><ChipTipo tipo={p.tipo} /></span>
                          {p.codigo && <span className="font-mono text-[10px] text-[#8a8a9c] bg-[#15151d] border border-[#20202c] rounded px-1.5 py-0.5 flex-shrink-0">{p.codigo}</span>}
                          {p.paciente_nombre && <span className="text-[10px] text-[#a78bfa] truncate min-w-0" title={p.paciente_nombre}>· {p.paciente_nombre}</span>}
                        </div>
                      </div>
                      {/* Cuando la fase la dedujo el sistema (automatica pasada de
                          edad) el chip lo dice con un asterisco: sin eso, el chip
                          y el desplegable de abajo muestran cosas distintas sobre
                          la misma planta y parece un bug. La explicacion entera
                          esta en la ficha, que es donde hay lugar para darla. */}
                      <span className="px-2 py-0.5 rounded-full border text-[10px] font-medium flex-shrink-0"
                        style={{ color: cf.text, background: cf.bg, borderColor: cf.border }}
                        title={faseFueDerivada(p)
                          ? `Automatica de dia ${p.dias_de_vida}: se cuenta en floracion. En la ficha figura ${p.fase_guardada}.`
                          : undefined}>
                        {p.fase}{faseFueDerivada(p) ? '*' : ''}
                      </span>
                      <button onClick={() => eliminarPlanta(p)}
                        className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 -mr-1 text-[#8a8a9c] hover:text-[#ff8a7a] hover:bg-[#15151d] rounded transition-colors flex-shrink-0"
                        title="Borrar planta">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#8f8f9f] tabular-nums">
                      {p.dias_de_vida != null && <span>Día {p.dias_de_vida}</span>}
                      {p.sustrato && <span>{p.sustrato}</span>}
                      {p.maceta && <span>{p.maceta}</span>}
                      {p.ultimo_riego && <span className="inline-flex items-center gap-1"><Droplets className="w-3 h-3 text-[#38bdf8]" />{new Date(p.ultimo_riego + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>}
                      {riegoPend && <span className="inline-flex items-center gap-1 text-[#f59e0b]" title="Riego pendiente: 3+ días sin regar o sin registro"><Droplets className="w-3 h-3" /> Riego pendiente</span>}
                    </div>

                    {/* Acciones rapidas: GRILLA en el telefono, fila en desktop.
                        Son seis controles de CINCO anchos distintos —cuatro
                        botones de ícono de 44 px, «Cosecha» de 84 y el select de
                        fase de 124—. En un `flex-wrap` a 390 px eso deja los
                        cinco primeros en una fila con 69 px de aire muerto a la
                        derecha y el select solo en la de abajo. Medido.

                        Cuatro columnas iguales: los íconos ocupan una cada uno y
                        los dos anchos ocupan dos, así que las dos filas llenan la
                        tarjeta y todo arranca en la misma grilla. En `sm:` vuelve
                        a la fila, donde los botones muestran su texto y cada uno
                        mide lo que su contenido pide. */}
                    {/* `mt-auto`: la barra baja al pie de la tarjeta. Como todas
                        las tarjetas de la fila miden lo mismo, las barras quedan
                        a la misma altura aunque una cabecera tenga un dato mas
                        que otra. Era lo que se veia «chocado». */}
                    <div className="mt-auto pt-3 grid grid-cols-4 gap-1.5 @md:flex @md:flex-wrap">
                      <button onClick={() => registrarEvento(p.id, 'Riego')} className={btnSutil} title="Registrar riego" aria-label="Registrar riego">
                        <Droplets aria-hidden className="w-3.5 h-3.5 text-[#38bdf8]" /> <span className="hidden @md:inline">Riego</span>
                      </button>
                      <button onClick={() => registrarEvento(p.id, 'Fertilizacion')} className={btnSutil} title="Registrar fertilización" aria-label="Registrar fertilización">
                        <FlaskConical aria-hidden className="w-3.5 h-3.5 text-[#bef264]" /> <span className="hidden @md:inline">Ferti</span>
                      </button>
                      <button onClick={() => registrarEvento(p.id, 'Poda')} className={btnSutil} title="Registrar poda" aria-label="Registrar poda">
                        <Scissors aria-hidden className="w-3.5 h-3.5 text-[#c4b5fd]" /> <span className="hidden @md:inline">Poda</span>
                      </button>
                      <NotaRapida onGuardar={(txt) => registrarEvento(p.id, 'Nota', txt)} />
                      <CosechaRapida onGuardar={(peso, val) => registrarCosecha(p.id, peso, val)} />
                      {/* Lo GUARDADO, no lo derivado: un editor que arranca en un
                          valor que la base no tiene rebota al viejo apenas se
                          guarda y se lee como que el cambio no funciono. */}
                      <select
                        value={p.fase_guardada ?? p.fase}
                        onChange={e => cambiarFase(p.id, e.target.value as FasePlanta)}
                        className="col-span-3 w-full @md:w-auto px-2 py-1.5 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[11px] text-[#a6a6b5] focus:outline-none focus:border-[#a3e635]/60 cursor-pointer min-h-[44px] sm:min-h-0 sm:max-w-none"
                        title="Cambiar fase" aria-label="Cambiar fase">
                        {FASES.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Historial expandible.
                      SOLO SI HAY ALGO QUE VER. Con cero eventos era un boton de
                      44px que decia «Historial (0)» y al tocarlo abria un vacio:
                      44px por planta, en una lista de sesenta, para no llevar a
                      ningun lado. */}
                  {p.total_eventos > 0 && (
                  <button onClick={() => toggleEventos(p.id)}
                    className="w-full flex items-center justify-center gap-1 py-1.5 min-h-[44px] sm:min-h-0 border-t border-[#1f1f2b] text-[10px] text-[#8a8a9c] hover:text-[#a6a6b5] hover:bg-[#15151d] transition-colors">
                    {abierta ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {abierta ? 'Ocultar historial' : `Historial (${p.total_eventos})`}
                  </button>
                  )}
                  {abierta && (
                    <div className="border-t border-[#1f1f2b] max-h-52 overflow-y-auto">
                      {!eventosPlanta[p.id] ? (
                        <div className="py-4 text-center"><Loader2 className="w-4 h-4 text-[#bef264] animate-spin mx-auto" /></div>
                      ) : eventosPlanta[p.id].length === 0 ? (
                        <p className="py-4 text-center text-[11px] text-[#8a8a9c]">Sin eventos</p>
                      ) : (
                        <ul className="divide-y divide-[#1f1f2b]">
                          {eventosPlanta[p.id].map(e => (
                            <li key={e.id} className="group flex items-center gap-2.5 px-4 py-2">
                              <span className="text-[12px] text-[#8a8a9c] tabular-nums font-mono flex-shrink-0">
                                {new Date(e.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                              </span>
                              <span className="text-[11px] font-medium text-[#d4d4dd] flex-shrink-0">{e.tipo}</span>
                              {e.detalle && <span className="text-[11px] text-[#8a8a9c] truncate">{e.detalle}</span>}
                              <button onClick={() => eliminarEvento(p.id, e.id)}
                                className="ml-auto p-1 text-[#8a8a9c] opacity-0 group-hover:opacity-100 hover:text-[#ff8a7a] rounded transition flex-shrink-0"
                                title="Borrar evento" aria-label="Cerrar">
                                <X className="w-3 h-3" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modalGenetica && (
        <ModalGenetica onCerrar={() => setModalGenetica(false)} onCreada={() => { setModalGenetica(false); cargar() }} />
      )}
      {modalPlanta && (
        <ModalPlanta geneticas={geneticas} pacientes={pacientes} onCerrar={() => setModalPlanta(false)}
          onCreada={() => { setModalPlanta(false); cargar() }}
          onNuevaGenetica={() => { setModalPlanta(false); setModalGenetica(true) }} />
      )}
      {detalle && (
        <DetallePlanta planta={detalle} onCerrar={() => setDetalle(null)} onCambio={cargar} />
      )}
    </div>
  )
}

function NotaRapida({ onGuardar }: { onGuardar: (txt: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className={btnSutil} title="Agregar nota" aria-label="Agregar nota">
        <StickyNote aria-hidden className="w-3.5 h-3.5 text-[#f59e0b]" /> <span className="hidden @md:inline">Nota</span>
      </button>
    )
  }
  return (
    <div className="col-span-full flex items-center gap-1.5 w-full">
      <input autoFocus value={texto} onChange={e => setTexto(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && texto.trim()) { onGuardar(texto.trim()); setTexto(''); setAbierto(false) }
          if (e.key === 'Escape') { setTexto(''); setAbierto(false) }
        }}
        placeholder="Escribí la nota y Enter..." className={inputFormulario} />
      <button onClick={() => { setTexto(''); setAbierto(false) }} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#8a8a9c] hover:text-[#ff8a7a]" aria-label="Cerrar">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function CosechaRapida({ onGuardar }: { onGuardar: (pesoSeco: number, valoracion?: number) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [peso, setPeso] = useState('')
  const [val, setVal] = useState(0)
  const guardar = () => {
    const p = parseFloat(peso.replace(',', '.'))
    if (!p || p <= 0) { toast.error('Cargá el peso seco (g)'); return }
    onGuardar(p, val || undefined); setPeso(''); setVal(0); setAbierto(false)
  }
  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className={`${btnSutil} border-[#404d20] text-[#d9f99d]`} title="Registrar cosecha (peso seco)" aria-label="Registrar cosecha">
        <Scissors className="w-3.5 h-3.5 text-[#bef264]" /> Cosecha
      </button>
    )
  }
  return (
    <div className="col-span-full flex items-center gap-1.5 w-full">
      <input autoFocus type="number" inputMode="decimal" value={peso} onChange={e => setPeso(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') { setPeso(''); setAbierto(false) } }}
        placeholder="Peso seco (g)" className={inputFormulario} />
      <select value={val} onChange={e => setVal(Number(e.target.value))} className={inputFormulario} title="Valoración" style={{ width: 70 }}>
        <option value={0}>★</option>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <button onClick={guardar} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#bef264] hover:text-[#d9f99d]" title="Guardar cosecha"><Scissors className="w-3.5 h-3.5" /></button>
      <button onClick={() => { setPeso(''); setAbierto(false) }} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#8a8a9c] hover:text-[#ff8a7a]" aria-label="Cerrar"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  const refDialogo = useDialogo(onCerrar)
  return (
    <div ref={refDialogo} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCerrar} />
      <div className="relative w-full max-w-md rounded-xl bg-[#101016] border border-[#2a2a3a] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1f1f2b]">
          <h2 className="font-display font-semibold text-[14px] text-[#ececf1]">{titulo}</h2>
          <button onClick={onCerrar} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 text-[#8a8a9c] hover:text-[#ececf1]" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        <div className="px-4 py-3 border-t border-[#1f1f2b] sticky bottom-0 bg-[#101016]">
          <button onClick={onCerrar} className="w-full min-h-[44px] flex items-center justify-center rounded-lg border border-[#2a2a3a] text-[12px] text-[#a6a6b5] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">Cerrar</button>
        </div>
      </div>
    </div>
  )
}

function ModalGenetica({ onCerrar, onCreada }: { onCerrar: () => void; onCreada: () => void }) {
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ nombre: '', banco: '', tipo: 'Feminizada', thc: '', flora: '', notas: '' })

  const guardar = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    setGuardando(true)
    try {
      await cultivoService.crearGenetica({
        nombre: form.nombre.trim(),
        banco: form.banco.trim() || null,
        tipo: form.tipo as Genetica['tipo'],
        thc_estimado: form.thc ? parseFloat(form.thc) : null,
        tiempo_flora_dias: form.flora ? parseInt(form.flora) : null,
        notas: form.notas.trim() || null,
      })
      toast.success(`Genética "${form.nombre}" creada`)
      onCreada()
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Nueva genética" onCerrar={onCerrar}>
      <div className="space-y-3">
        <div>
          <label className={etiquetaCampo}>Nombre *</label>
          <input autoFocus className={inputFormulario} placeholder="Gorilla Glue #4" value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={etiquetaCampo}>Banco</label>
            <input className={inputFormulario} placeholder="Dinafem" value={form.banco}
              onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} />
          </div>
          <div>
            <label className={etiquetaCampo}>Tipo</label>
            <select className={inputFormulario} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
              {TIPOS_GENETICA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={etiquetaCampo}>THC estimado %</label>
            <input className={inputFormulario} type="number" step="0.1" placeholder="22" value={form.thc}
              onChange={e => setForm(f => ({ ...f, thc: e.target.value }))} />
          </div>
          <div>
            <label className={etiquetaCampo}>{form.tipo === 'Automatica' ? 'Días totales' : 'Días de flora'}</label>
            <input className={inputFormulario} type="number" placeholder={form.tipo === 'Automatica' ? '75' : '63'} value={form.flora}
              onChange={e => setForm(f => ({ ...f, flora: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className={etiquetaCampo}>Notas</label>
          <textarea className={inputFormulario} rows={2} placeholder="Resistente a hongos, estira en flora..." value={form.notas}
            onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
        </div>
        <button onClick={guardar} disabled={guardando} className={`${btnPrimario} w-full justify-center`}>
          {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Dna className="w-3.5 h-3.5" />}
          Crear genética
        </button>
      </div>
    </Modal>
  )
}

function ModalPlanta({ geneticas, pacientes, onCerrar, onCreada, onNuevaGenetica }: {
  geneticas: Genetica[]
  pacientes: Paciente[]
  onCerrar: () => void
  onCreada: () => void
  onNuevaGenetica: () => void
}) {
  const [guardando, setGuardando] = useState(false)
  const hoy = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    genetica_id: geneticas[0]?.id ?? '', paciente_id: '', apodo: '', fecha: hoy,
    fase: 'Germinacion', sustrato: '', maceta: '', ubicacion: '', cantidad: '1',
  })

  const guardar = async () => {
    const n = Math.max(1, Math.min(50, parseInt(form.cantidad) || 1))
    setGuardando(true)
    const nombreGen = geneticas.find(g => g.id === form.genetica_id)?.nombre ?? null
    try {
      for (let i = 0; i < n; i++) {
        await cultivoService.crearPlanta({
          codigo: generarCodigoPlanta(nombreGen),
          genetica_id: form.genetica_id || null,
          paciente_id: form.paciente_id || null,
          apodo: form.apodo.trim() ? (n > 1 ? `${form.apodo.trim()} #${i + 1}` : form.apodo.trim()) : null,
          fecha_germinacion: form.fecha || null,
          fase: form.fase as FasePlanta,
          sustrato: form.sustrato.trim() || null,
          maceta: form.maceta.trim() || null,
          ubicacion: form.ubicacion.trim() || null,
        })
      }
      toast.success(n > 1 ? `${n} plantas creadas` : 'Planta creada')
      onCreada()
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Nueva planta" onCerrar={onCerrar}>
      <div className="space-y-3">
        <div>
          <label className={etiquetaCampo}>Genética</label>
          <div className="flex gap-2">
            <select className={inputFormulario} value={form.genetica_id} onChange={e => setForm(f => ({ ...f, genetica_id: e.target.value }))}>
              <option value="">Sin genética</option>
              {geneticas.map(g => <option key={g.id} value={g.id}>{g.nombre}{g.banco ? ` (${g.banco})` : ''}</option>)}
            </select>
            <button onClick={onNuevaGenetica} className={`${btnSutil} flex-shrink-0`} title="Crear genética nueva">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={etiquetaCampo}>Apodo</label>
            <input className={inputFormulario} placeholder="La gorda" value={form.apodo}
              onChange={e => setForm(f => ({ ...f, apodo: e.target.value }))} />
          </div>
          <div>
            <label className={etiquetaCampo}>Cantidad</label>
            <input className={inputFormulario} type="number" min="1" max="50" value={form.cantidad}
              onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={etiquetaCampo}>Fecha germinación</label>
            <input className={inputFormulario} type="date" value={form.fecha}
              onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          </div>
          <div>
            <label className={etiquetaCampo}>Fase</label>
            <select className={inputFormulario} value={form.fase} onChange={e => setForm(f => ({ ...f, fase: e.target.value }))}>
              {FASES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <AyudaCampo id="plantas" campo="Fase" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={etiquetaCampo}>Sustrato</label>
            <select className={inputFormulario} value={form.sustrato}
              onChange={e => setForm(f => ({ ...f, sustrato: e.target.value }))}>
              <option value="">Sin definir</option>
              {SUSTRATOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={etiquetaCampo}>Maceta</label>
            <input className={inputFormulario} placeholder="20L tela" value={form.maceta}
              onChange={e => setForm(f => ({ ...f, maceta: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className={etiquetaCampo}>Ubicación</label>
          <input className={inputFormulario} placeholder="Indoor carpa 120x120" value={form.ubicacion}
            onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))} />
        </div>
        <div>
          <label className={etiquetaCampo}>Paciente asignado</label>
          <SelectorPersona personas={pacientes} valor={form.paciente_id || null}
            placeholder="Buscar, o dejar sin asignar…"
            etiquetaExtra={p => p.reprocann_nro ?? null}
            onElegir={id => setForm(f => ({ ...f, paciente_id: id ?? '' }))} />
          <p className="mt-1 text-[10px] text-[#8a8a9c]">Se genera un código QR único por planta para su historia clínica.</p>
        </div>
        <button onClick={guardar} disabled={guardando} className={`${btnPrimario} w-full justify-center`}>
          {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flower2 className="w-3.5 h-3.5" />}
          Crear {parseInt(form.cantidad) > 1 ? `${form.cantidad} plantas` : 'planta'}
        </button>
      </div>
    </Modal>
  )
}
