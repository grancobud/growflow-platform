// PaginaSala — tablero visual de riego, adaptado de registro-de-riego.
// Cada planta es un cuadradito coloreado por dias sin riego.
// Modos: Regar (tap = riego de hoy, tap de nuevo = deshacer), Mover (planta -> slot),
// Genetica (elegis una y "pintas" plantas). Todo persiste en Supabase.
//
// Las areas (carpas, camas, sectores) las crea cada instalacion desde esta misma
// pantalla y viven en la tabla `cultivo_areas`. Antes eran una constante con la
// disposicion fisica de la instalacion de origen: al forkear, la instalacion
// nueva veia cinco carpas que nunca habia creado.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { btnSutil, btnIcono, etiquetaCampo } from '../lib/ui'
import { toast } from 'sonner'
import { Droplets, Move, Dna, RefreshCw, Download, Upload, X, Loader2, SprayCan, Plus, Pencil, Trash2, LayoutGrid, ChevronDown, TestTube } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CATEGORIAS_APLIC } from '../lib/cultivo'
import { gruposService, type GrupoCultivo } from '../lib/grupos'
import {
  areasService, sugerirGrilla, capacidad, medidaTexto, kwhDia, kwhMes,
  TIPOS_AREA, TIPO_AREA_LABEL, LIMITE_LADO,
  type Area, type TipoArea,
} from '../lib/areas'
import { ambienteService } from '../lib/ambiente'
import { useDialogo } from '../lib/useDialogo'
import { Desplegable } from '../components/ui/Desplegable'
import { ModalFormulario } from '../components/ong/ModalFormulario'
import { useAnchoDesde, SM } from '../lib/useAnchoDesde'
import { pedirDatos } from '../lib/pedirDatos'
import { confirmarAccion, confirmarBorrado } from '../lib/confirmar'
import { useAbrirAlLlegar } from '../lib/useAbrirAlLlegar'

// Paleta amplia para distinguir muchas genéticas (>=24 colores bien diferenciados).
const COLORES_GEN = [
  '#e6553e', '#f59e0b', '#facc15', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef',
  '#ec4899', '#f87171', '#a3e635', '#67e8f9', '#c4b5fd', '#ffffff',
  '#fb923c', '#eab308', '#4ade80', '#2dd4bf', '#60a5fa',
  '#a78bfa', '#f472b6', '#fda4af',
]

const ESTADOS = {
  hoy: '#34c97a', reciente: '#e2b93b', atrasada: '#e05252', nunca: '#5a6a7a',
}


interface Planta { id: string; apodo: string | null; codigo: string | null; slot: string | null; genetica_id: string | null; activa: boolean }
interface Genetica { id: string; nombre: string }
type Modo = 'regar' | 'escorrentia' | 'fumigar' | 'mover' | 'genetica'

function hoyStr() { return new Date().toLocaleDateString('en-CA') }

// text-[16px] en mobile a proposito: menos de 16 y iOS hace zoom al enfocar.
const inputReceta = 'px-2 py-1 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[11px] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#38bdf8]/60 min-h-[44px] sm:min-h-0'

/**
 * Las dos filas que esta pantalla lee de la base, con lo minimo que usa.
 *
 * Se escribe la forma UNA vez en vez de castear a `any` en cada uso: si mañana
 * la consulta deja de traer `ultimo_riego`, el compilador lo dice aca y no en
 * una pantalla en blanco.
 */
interface FilaRiego { id: string; ultimo_riego: string | null }

/**
 * Los dos formatos que acepta el importador de la sala.
 *
 * `plants` es el localStorage de la app vieja —riegos en timestamps— y `plantas`
 * el export de esta. Los dos campos son opcionales porque el archivo lo pega una
 * persona: puede venir cualquier cosa, y por eso `JSON.parse` devuelve `unknown`.
 */
interface DumpImportado {
  formato?: string
  plants?: Record<string, { slot?: string | null; gen?: string | null; riegos?: number[] }>
  plantas?: { apodo?: string; slot?: string | null; genetica?: string | null; riegos?: string[] }[]
}
interface FilaEventoRiego { planta_id: string | null; fecha: string }

export default function PaginaSala() {
  const [plantas, setPlantas] = useState<Planta[]>([])
  const [geneticas, setGeneticas] = useState<Genetica[]>([])
  // `string | null` y no `string`: una planta puede no tener ningun riego, y la
  // vista lo lee con `riegos[id]` esperando `undefined` o una fecha. El tipo
  // decia que siempre habia fecha y el dato decia otra cosa — lo tapaba un
  // `any` en la carga, y salio al tipar la fila (01/09/2026).
  const [riegos, setRiegos] = useState<Record<string, string | null>>({}) // planta_id -> ultima fecha de riego
  const [modo, setModo] = useState<Modo>('regar')
  const [genSel, setGenSel] = useState<string>('')
  const [moviendo, setMoviendo] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [areas, setAreas] = useState<Area[]>([])
  const [modalArea, setModalArea] = useState<Area | 'nueva' | null>(null)
  // `nueva=area` abre el alta de area al llegar. La clave NO es `1`: esta
  // pantalla tiene mas de un formulario y la clave tiene que decir cual.
  const nuevaArea = useCallback(() => setModalArea('nueva'), [])
  useAbrirAlLlegar(nuevaArea, 'area', modalArea != null)
  /** Nombre con el que abrir el alta, cuando viene sugerido desde Ambiente. */
  const [nombreSugerido, setNombreSugerido] = useState('')
  /**
   * Si la receta esta abierta EN EL TELEFONO. En pantalla ancha se ve siempre.
   *
   * Arranca cerrada porque los ocho campos —fecha, volumen, pH, escorrentia
   * ml/EC/pH, EC, PPM, factor— entran de a dos por fila a 375px y se comen
   * media pantalla, empujando el tablero fuera de la vista. Y son OPCIONALES:
   * se riega tocando plantas sin llenar ninguno.
   *
   * El boton que la abre muestra lo que hay cargado, asi que cerrada no
   * esconde el dato: lo resume.
   */
  const [recetaAbierta, setRecetaAbierta] = useState(false)
  // El corte de `sm:`, que es el que usa el boton que la abre. Desde ahi la
  // receta se ve siempre y no hay nada que desplegar.
  const anchoSm = useAnchoDesde(SM)
  /**
   * Las salas cargadas en Ambiente.
   *
   * Se leen ACA, en Cultivo, por un motivo concreto: «sala» son dos cosas
   * distintas en la app y nada lo decia. `ambiente_salas` es donde se cargan
   * temperatura y humedad; `cultivo_areas` es donde viven las plantas. Alguien
   * de la asociación creo «Sala 1» en Ambiente, fue a Plantas y no le aparecia — la app
   * lo dejo hacer y despues no le ofrecio nada.
   *
   * No se unifican los dos conceptos a proposito: una sala fisica puede tener
   * varias camas, y de hecho ahi hay una «Cama Sala 2». Lo que faltaba era el
   * puente.
   */
  const [salasAmbiente, setSalasAmbiente] = useState<{ nombre: string }[]>([])
  const [modalImport, setModalImport] = useState(false)
  const refDialogo1 = useDialogo(() => setModalImport(false), modalImport)
  const [textoImport, setTextoImport] = useState('')
  const [importando, setImportando] = useState(false)
  // Receta de riego del dia: se aplica a cada planta que toques (igual que mezclas una solucion y regas varias)
  // `fecha` arranca en hoy pero es editable: antes iba hardcodeada a hoyStr() y
  // un riego de ayer no se podia cargar sin mentir la fecha. `ec` es lo que mide
  // el instrumento de la asociación; el ppm se deriva.
  const [receta, setReceta] = useState({
    fecha: hoyStr(), volumen: '', ec: '', ppm: '', ph: '',
  })
  /**
   * LA ESCORRENTIA NO ES PARTE DE LA RECETA. (29/08/2026)
   *
   * Estaba aca adentro, en los mismos tres campos que el volumen y el pH, y eso
   * es un error de modelo: la receta es lo que ENTRA —una sola solucion, la
   * misma para las sesenta plantas que riegues con ella— y la escorrentia es lo
   * que SALE de UNA maceta. Se mide macetero por macetero y da distinto en cada
   * uno; ahi esta todo su valor diagnostico.
   *
   * Con los tres campos en la receta, tocar sesenta plantas escribia el mismo
   * «escorrentia 300 ml, EC 2.03» en las sesenta. Ninguna de esas sesenta
   * lecturas se habia medido: es un dato inventado con cara de medicion, y
   * despues alguien lo compara contra el riego y decide un lavado de sales.
   *
   * Ahora se carga de a una: modo Escorrentia, tocas la planta, y el formulario
   * dice de cual es. Se abre con lo que ya haya guardado ese dia, para poder
   * CORREGIR una lectura mal cargada — que es el otro caso real.
   */
  const [escPlanta, setEscPlanta] = useState<Planta | null>(null)
  const [esc, setEsc] = useState({ ml: '', ec: '', ph: '' })
  const [escCargando, setEscCargando] = useState(false)
  /** Cual planta pidio la ultima lectura: si cerras el modal antes de que
      vuelva la consulta, la respuesta vieja no debe pisar el formulario. */
  const escPedido = useRef<string | null>(null)
  const [grupos, setGrupos] = useState<GrupoCultivo[]>([])
  const [conteoGrupo, setConteoGrupo] = useState<Record<string, number>>({})
  /**
   * Factor del medidor: 500 (Hanna) o 700 (Truncheon). Sin el, un ppm no se
   * puede interpretar — "600 ppm" es EC 1,2 con factor 500 y EC 0,857 con 700.
   */
  const [ppmFactor, setPpmFactor] = useState(500)
  // Receta de aplicacion (modo fumigar)
  const [recetaA, setRecetaA] = useState({ categoria: 'Fumigacion', producto: '', dosis: '' })

  /**
   * Salas de Ambiente que todavia no tienen un area de cultivo.
   *
   * El match es por CONTENCION y no por igualdad: el area de la Sala 2 se llama
   * «Cama Sala 2», que es como la nombra la gente —una sala puede tener varias
   * camas—. Comparar exacto la daria por faltante y sugeriria crear un duplicado.
   */
  const salasSinArea = useMemo(() => {
    const nombres = areas.map(a => a.nombre.toLowerCase())
    return salasAmbiente.filter(s =>
      !nombres.some(n => n.includes(s.nombre.trim().toLowerCase())))
  }, [areas, salasAmbiente])

  /**
   * Lo cargado en la receta, en una linea.
   *
   * Es lo que hace que plegarla sea plegar y no ocultar: el boton cerrado
   * muestra esto. Sin resumen, alguien podria regar sesenta plantas creyendo
   * que la receta esta vacia cuando tiene el pH de ayer.
   *
   * La fecha entra SOLO si no es hoy, que es el unico caso en que sorprende.
   */
  const resumenReceta = useMemo(() => {
    const p: string[] = []
    if (receta.fecha !== hoyStr()) p.push(receta.fecha)
    if (receta.volumen.trim()) p.push(`${receta.volumen} ml`)
    if (receta.ph.trim()) p.push(`pH ${receta.ph}`)
    if (receta.ec.trim()) p.push(`EC ${receta.ec}`)
    if (receta.ppm.trim()) p.push(`${receta.ppm} ppm`)
    return p.join(' · ')
  }, [receta])

  const cargar = useCallback(async () => {
    try {
      const [pl, gen, ri, ar, gr, cg] = await Promise.all([
        supabase.from('plantas').select('id,apodo,codigo,slot,genetica_id,activa').eq('activa', true),
        supabase.from('geneticas').select('id,nombre').order('nombre'),
        supabase.from('resumen_plantas').select('id,ultimo_riego').eq('activa', true),
        areasService.getAreas(),
        gruposService.getGrupos(),
        gruposService.conteoPorGrupo(),
      ])
      setGrupos(gr); setConteoGrupo(cg)
      setPlantas((pl.data ?? []) as Planta[])
      setGeneticas((gen.data ?? []) as Genetica[])
      setRiegos(Object.fromEntries(
        (ri.data ?? [] as FilaRiego[]).map((r: FilaRiego) => [r.id, r.ultimo_riego])))
      setAreas(ar)
      // Aparte y tolerante: es una sugerencia, no contenido. Si falla, la
      // pantalla anda igual.
      ambienteService.getSalas()
        .then(ss => setSalasAmbiente(ss.filter(x => x.activa !== false)))
        .catch(() => {})
    } catch (err) {
      toast.error(`Error cargando sala: ${(err as Error).message}`)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const porSlot = useMemo(() => {
    const m: Record<string, Planta> = {}
    for (const p of plantas) if (p.slot) m[p.slot] = p
    return m
  }, [plantas])
  // Sin ubicar = las que no tienen slot, MAS las huerfanas: las que apuntan a
  // un area que ya no existe (se borro, o el slot viene de otra instalacion).
  // Si no se contaran, esas plantas no aparecerian en ningun lado: ni en el
  // tablero, porque su area no se dibuja, ni aca. Desaparecidas sin aviso.
  const sinUbicar = useMemo(() => {
    if (cargando) return []
    return plantas.filter(p => !p.slot || !areas.some(a => p.slot!.startsWith(a.id + '-')))
  }, [plantas, areas, cargando])
  const colorGen = useCallback((gid: string | null) => {
    if (!gid) return null
    const i = geneticas.findIndex(g => g.id === gid)
    return i >= 0 ? COLORES_GEN[i % COLORES_GEN.length] : null
  }, [geneticas])

  // Numeración correlativa POR genética: dentro de cada genética las plantas se
  // numeran 1, 2, 3… (ordenadas por su número global/apodo), independientes del
  // número global. Así cada genética empieza desde el #1.
  const numeroPorGenetica = useMemo(() => {
    const apodoNum = (p: Planta) => {
      const n = parseInt((p.apodo ?? '').replace(/\D/g, ''), 10)
      return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
    }
    const porGen: Record<string, Planta[]> = {}
    for (const p of plantas) {
      if (!p.genetica_id) continue
      ;(porGen[p.genetica_id] ??= []).push(p)
    }
    const m: Record<string, number> = {}
    for (const gid in porGen) {
      porGen[gid].slice().sort((a, b) => apodoNum(a) - apodoNum(b))
        .forEach((p, i) => { m[p.id] = i + 1 })
    }
    return m
  }, [plantas])

  const estadoRiego = (p: Planta) => {
    const f = riegos[p.id]
    if (!f) return 'nunca'
    const dias = Math.floor((new Date(hoyStr() + 'T00:00:00').getTime() - new Date(f + 'T00:00:00').getTime()) / 86400000)
    if (dias <= 0) return 'hoy'
    if (dias <= 2) return 'reciente'
    return 'atrasada'
  }
  const diasSinRiego = (p: Planta) => {
    const f = riegos[p.id]
    if (!f) return '—'
    const dias = Math.floor((new Date(hoyStr() + 'T00:00:00').getTime() - new Date(f + 'T00:00:00').getTime()) / 86400000)
    return dias <= 0 ? 'hoy' : `${dias}d`
  }

  const num = (v: string) => v.trim() === '' ? null : Number(v)

  const recetaResumen = () => {
    const partes = [
      receta.volumen && `${receta.volumen}ml`,
      receta.ec && `EC ${receta.ec}`,
      receta.ppm && `${receta.ppm}ppm`,
      receta.ph && `pH${receta.ph}`,
    ].filter(Boolean)
    return partes.join(' · ') || null
  }
  const recetaAResumen = () => {
    const partes = [recetaA.categoria, recetaA.producto, recetaA.dosis].filter(Boolean)
    return partes.join(' · ') || recetaA.categoria
  }

  // Inserta riego (rico) + evento Riego (timeline/sala/chat) para una lista de plantas
  const registrarRiegos = async (ids: string[]) => {
    const det = recetaResumen()
    const cuando = receta.fecha || hoyStr()
    // Sin escorrentia, a proposito: ver el comentario del estado `escPlanta`. Lo
    // que entra se aplica a todas; lo que sale se carga planta por planta.
    await supabase.from('riegos').insert(ids.map(id => ({
      planta_id: id, fecha: cuando,
      volumen_ml: num(receta.volumen),
      ec: num(receta.ec), ppm: num(receta.ppm), ppm_factor: ppmFactor,
      ph: num(receta.ph),
    })))
    await supabase.from('eventos').insert(ids.map(id => ({ planta_id: id, tipo: 'Riego', fecha: cuando, detalle: det })))
  }

  /**
   * Riega un GRUPO entero: UNA fila de riego y UNA de evento, no una por planta.
   *
   * Es el punto de B2. Regar las 60 del Proyecto Demo eran 120 filas —hay 600
   * riegos en apenas 10 fechas— y corregir ese riego obligaba a corregir 60. El
   * evento igual se ve en la linea de tiempo de cada planta del grupo, con un
   * cartel que aclara que fue al grupo entero.
   */
  /**
   * Un grupo nuevo, con nombre y sustrato.
   *
   * Se pide el sustrato porque es lo que distingue un grupo de otro: dos grupos
   * con el mismo sustrato son el mismo riego, y entonces son un grupo solo.
   */
  const nuevoGrupo = async () => {
    // Los dos campos en UN dialogo. Eran dos `prompt` encadenados: cancelar el
    // segundo dejaba el nombre ya escrito y tirado, y en un telefono el dialogo
    // nativo puede no aparecer -y entonces devuelve null, o sea que el boton no
    // hace nada y tampoco dice por que.
    const r = await pedirDatos({
      titulo: 'Nuevo grupo de cultivo',
      descripcion: 'El sustrato es lo que distingue un grupo de otro: dos grupos con el mismo sustrato son el mismo riego.',
      campos: [
        { nombre: 'nombre', etiqueta: 'Nombre', placeholder: 'Coco, Orgánico, Cama 2' },
        { nombre: 'sustrato', etiqueta: 'Sustrato', requerido: false, placeholder: 'Coco 70/30, suelo vivo…' },
      ],
      confirmLabel: 'Crear grupo',
    })
    if (!r) return
    const nombre = r.nombre
    const sustrato = r.sustrato || null
    try {
      await gruposService.crearGrupo({ nombre, sustrato })
      toast.success(`Grupo «${nombre}» creado`)
      cargar()
    } catch (e) { toast.error(`No se pudo crear: ${(e as Error).message}`) }
  }

  const regarGrupo = async (g: GrupoCultivo) => {
    const n = conteoGrupo[g.id] ?? 0
    // `confirmarAccion`: registra un riego, no borra nada. Ver la trampa 13 del
    // TRASPASO: «18 lugares con el mismo patron» no es «18 con el mismo problema».
    if (!await confirmarAccion({
      titulo: `¿Registrar este riego para ${g.nombre}?`,
      descripcion: `${n} planta${n === 1 ? '' : 's'}. ${recetaResumen() || 'Sin receta cargada'}. `
        + `Queda una sola anotación, no ${n}.`,
      confirmLabel: 'Registrar',
    })) return
    try {
      const cuando = receta.fecha || hoyStr()
      await gruposService.riegoDeGrupo(g.id, {
        fecha: cuando,
        volumen_ml: num(receta.volumen),
        ec: num(receta.ec), ppm: num(receta.ppm), ppm_factor: ppmFactor,
        ph: num(receta.ph),
      })
      await gruposService.eventoDeGrupo(g.id, {
        tipo: 'Riego', fecha: cuando,
        detalle: `Riego al grupo · ${recetaResumen() || 'sin receta'}`,
      })
      toast.success(`${g.nombre}: riego registrado para ${n} plantas en una sola anotación`)
      cargar()
    } catch (err) {
      toast.error(`No se pudo registrar: ${(err as Error).message}`)
    }
  }

  // Inserta aplicacion (fumigacion/insecticida/etc) para una lista de plantas
  const registrarAplicaciones = async (ids: string[]) => {
    const { error } = await supabase.from('aplicaciones').insert(ids.map(id => ({
      planta_id: id, fecha: hoyStr(),
      categoria: recetaA.categoria, producto: recetaA.producto || null, dosis: recetaA.dosis || null,
    })))
    if (error) throw new Error(error.message)
  }

  /**
   * Abre la carga de escorrentia de UNA planta, con lo que ya tenga ese dia.
   *
   * Precargar no es un lujo: el caso que lo pidio fue «capaz esa esta mal». Si
   * el formulario abriera vacio, corregir una lectura equivocada seria escribir
   * tres numeros nuevos sin ver los viejos, y no habria forma de saber si lo que
   * estaba cargado era 300 o 3000.
   */
  const abrirEscorrentia = async (p: Planta) => {
    escPedido.current = p.id
    setEscPlanta(p); setEsc({ ml: '', ec: '', ph: '' }); setEscCargando(true)
    const cuando = receta.fecha || hoyStr()
    const { data } = await supabase.from('riegos')
      .select('escurrido_ml,escurrido_ec,escurrido_ph')
      .eq('planta_id', p.id).eq('fecha', cuando).limit(1)
    if (escPedido.current !== p.id) return
    const f = (data ?? [])[0] as { escurrido_ml: number | null; escurrido_ec: number | null; escurrido_ph: number | null } | undefined
    if (f) setEsc({
      ml: f.escurrido_ml == null ? '' : String(f.escurrido_ml),
      ec: f.escurrido_ec == null ? '' : String(f.escurrido_ec),
      ph: f.escurrido_ph == null ? '' : String(f.escurrido_ph),
    })
    setEscCargando(false)
  }

  const cerrarEscorrentia = () => { escPedido.current = null; setEscPlanta(null) }

  /**
   * Guarda la escorrentia de esa planta en el riego de esa fecha.
   *
   * Si la planta todavia no tiene riego ese dia se crea la fila: se puede medir
   * lo que escurrio de un riego que cargaste ayer, o de uno que hizo otra
   * persona. Vaciar los tres campos borra la lectura, que es como se deshace una
   * mal cargada.
   */
  const guardarEscorrentia = async () => {
    if (!escPlanta) return
    const cuando = receta.fecha || hoyStr()
    const ml = num(esc.ml), ec = num(esc.ec), ph = num(esc.ph)
    const campos = {
      escurrio: ml != null && ml > 0,
      escurrido_ml: ml, escurrido_ec: ec, escurrido_ph: ph,
      escurrido_ppm: ec == null ? null : Math.round(ec * ppmFactor),
    }
    try {
      const { data, error: eSel } = await supabase.from('riegos').select('id')
        .eq('planta_id', escPlanta.id).eq('fecha', cuando).limit(1)
      if (eSel) throw new Error(eSel.message)
      const fila = (data ?? [])[0] as { id: string } | undefined
      const { error } = fila
        ? await supabase.from('riegos').update(campos).eq('id', fila.id)
        : await supabase.from('riegos').insert({ planta_id: escPlanta.id, fecha: cuando, ppm_factor: ppmFactor, ...campos })
      if (error) throw new Error(error.message)
      const vacia = ml == null && ec == null && ph == null
      toast.success(vacia
        ? `Escorrentía borrada en ${escPlanta.codigo ?? 'la planta'}`
        : `${escPlanta.codigo ?? 'Planta'}: escorrentía guardada`)
      cerrarEscorrentia()
    } catch (e) {
      toast.error(`No se pudo guardar: ${(e as Error).message}`)
    }
  }

  const clickPlanta = async (p: Planta) => {
    if (modo === 'regar') {
      const regadaHoy = riegos[p.id] === hoyStr()
      try {
        if (regadaHoy) {
          await supabase.from('eventos').delete().eq('planta_id', p.id).eq('tipo', 'Riego').eq('fecha', hoyStr())
          await supabase.from('riegos').delete().eq('planta_id', p.id).eq('fecha', hoyStr())
          const { data } = await supabase.from('resumen_plantas').select('ultimo_riego').eq('id', p.id).single()
          setRiegos(r => ({ ...r, [p.id]: (data as { ultimo_riego?: string | null } | null)?.ultimo_riego ?? null }))
        } else {
          await registrarRiegos([p.id])
          setRiegos(r => ({ ...r, [p.id]: hoyStr() }))
        }
      } catch (err) {
        toast.error(`No se pudo registrar: ${(err as Error).message}`)
      }
    } else if (modo === 'escorrentia') {
      abrirEscorrentia(p)
    } else if (modo === 'fumigar') {
      try {
        await registrarAplicaciones([p.id])
        toast.success(`${recetaAResumen()} → ${p.apodo ?? 'planta'}`)
      } catch (err) {
        toast.error(`No se pudo registrar: ${(err as Error).message}`)
      }
    } else if (modo === 'mover') {
      setMoviendo(m => m === p.id ? null : p.id)
    } else if (modo === 'genetica') {
      if (!genSel) { toast.info('Elegí una genética primero'); return }
      const nueva = p.genetica_id === genSel ? null : genSel
      try {
        await supabase.from('plantas').update({ genetica_id: nueva }).eq('id', p.id)
        setPlantas(ps => ps.map(x => x.id === p.id ? { ...x, genetica_id: nueva } : x))
      } catch (err) {
        toast.error(`No se pudo asignar: ${(err as Error).message}`)
      }
    }
  }

  const regarCarpa = async (carpa: Area) => {
    const pendientes = plantas.filter(p => p.slot?.startsWith(carpa.id + '-') && riegos[p.id] !== hoyStr())
    if (pendientes.length === 0) { toast.info(`${carpa.nombre}: ya está toda regada hoy`); return }
    try {
      await registrarRiegos(pendientes.map(p => p.id))
      setRiegos(r => ({ ...r, ...Object.fromEntries(pendientes.map(p => [p.id, hoyStr()])) }))
      toast.success(`${carpa.nombre}: ${pendientes.length} plantas regadas${recetaResumen() ? ' (' + recetaResumen() + ')' : ''}`)
    } catch (err) {
      toast.error(`No se pudo regar la carpa: ${(err as Error).message}`)
    }
  }

  const clickSlot = async (slot: string, carpa: Area) => {
    if (modo !== 'mover' || !moviendo) return
    try {
      await supabase.from('plantas').update({ slot, ubicacion: carpa.nombre }).eq('id', moviendo)
      setPlantas(ps => ps.map(x => x.id === moviendo ? { ...x, slot } : x))
      setMoviendo(null)
    } catch (err) {
      toast.error(`No se pudo mover: ${(err as Error).message}`)
    }
  }

  const carpaNombre = (slot: string | null) => areas.find(c => slot?.startsWith(c.id + '-'))?.nombre ?? null

  const borrarArea = async (a: Area) => {
    const ocupadas = plantas.filter(p => p.slot?.startsWith(a.id + '-')).length
    if (!await confirmarBorrado(`¿Borrar «${a.nombre}»?`, ocupadas > 0
      ? `Las ${ocupadas} plantas que tiene adentro NO se borran: vuelven a «Sin ubicar».`
      : undefined)) return
    try {
      const sueltas = await areasService.eliminar(a.id)
      toast.success(sueltas > 0 ? `Area borrada · ${sueltas} plantas quedaron sin ubicar` : 'Area borrada')
      cargar()
    } catch (err) {
      toast.error(`No se pudo borrar: ${(err as Error).message}`)
    }
  }

  // Drag & drop: arrastra una planta a un slot. Si el slot tiene otra planta,
  // se intercambian (la que estaba pasa al lugar de origen).
  const soltarEnSlot = async (slotDestino: string, carpa: Area, plantaDestino?: Planta) => {
    const origenId = moviendo
    setMoviendo(null)
    if (!origenId) return
    const origen = plantas.find(p => p.id === origenId)
    if (!origen || origen.slot === slotDestino) return
    try {
      if (plantaDestino && plantaDestino.id !== origenId) {
        const slotOrigen = origen.slot
        await supabase.from('plantas').update({ slot: slotDestino, ubicacion: carpa.nombre }).eq('id', origen.id)
        await supabase.from('plantas').update({ slot: slotOrigen, ubicacion: carpaNombre(slotOrigen) }).eq('id', plantaDestino.id)
        setPlantas(ps => ps.map(x => x.id === origen.id ? { ...x, slot: slotDestino } : x.id === plantaDestino.id ? { ...x, slot: slotOrigen } : x))
      } else {
        await supabase.from('plantas').update({ slot: slotDestino, ubicacion: carpa.nombre }).eq('id', origen.id)
        setPlantas(ps => ps.map(x => x.id === origen.id ? { ...x, slot: slotDestino } : x))
      }
    } catch (err) {
      toast.error(`No se pudo mover: ${(err as Error).message}`)
    }
  }

  // ----- Export / Import -----
  const exportar = async () => {
    try {
      const { data: evs } = await supabase.from('eventos')
        .select('planta_id,fecha').eq('tipo', 'Riego').order('fecha')
      const riegosPorPlanta: Record<string, string[]> = {}
      for (const e of (evs ?? []) as FilaEventoRiego[]) {
        if (!e.planta_id) continue
        ;(riegosPorPlanta[e.planta_id] = riegosPorPlanta[e.planta_id] ?? []).push(e.fecha)
      }
      const dump = {
        formato: 'growflow-sala-v1',
        exportado: new Date().toISOString(),
        geneticas: geneticas.map(g => g.nombre),
        plantas: plantas.map(p => ({
          apodo: p.apodo,
          slot: p.slot,
          genetica: geneticas.find(g => g.id === p.genetica_id)?.nombre ?? null,
          riegos: riegosPorPlanta[p.id] ?? [],
        })),
      }
      const json = JSON.stringify(dump)
      await navigator.clipboard.writeText(json)
      toast.success(`Exportado al portapapeles (${plantas.length} plantas)`)
    } catch (err) {
      toast.error(`No se pudo exportar: ${(err as Error).message}`)
    }
  }

  const importar = async () => {
    // `unknown` y no `any`: esto es un archivo que pega una persona, o sea que
    // puede tener CUALQUIER forma. Con `any` el compilador dejaba escribir
    // `d.plants.loQueSea` sin chistar sobre algo que quizas ni es un objeto.
    let d: unknown
    try { d = JSON.parse(textoImport) } catch { toast.error('Eso no es un JSON válido'); return }
    const dump = (d ?? {}) as DumpImportado
    setImportando(true)
    try {
      // Normalizar ambos formatos a: [{apodo, slot, genetica, riegos:[YYYY-MM-DD]}]
      let items: { apodo: string; slot: string | null; genetica: string | null; riegos: string[] }[] = []
      if (dump.plants && typeof dump.plants === 'object') {
        // Formato registro-riego-v1 (localStorage de la app vieja): riegos en timestamps
        items = Object.entries(dump.plants).map(([n, p]) => ({
          apodo: `#${n}`,
          slot: p.slot ?? null,
          genetica: p.gen ?? null,
          riegos: [...new Set((p.riegos ?? []).map((ts: number) => new Date(ts).toLocaleDateString('en-CA')))] as string[],
        }))
      } else if (dump.formato === 'growflow-sala-v1' && Array.isArray(dump.plantas)) {
        // El `?? ''` no es defensa de mas: `apodo` es opcional en el tipo
        // porque el archivo lo pega una persona, y una fila sin apodo entraria
        // como `undefined` a una lista que promete `string`.
        items = dump.plantas.map(p => ({
          apodo: p.apodo ?? '', slot: p.slot ?? null, genetica: p.genetica ?? null,
          riegos: [...new Set(p.riegos ?? [])] as string[],
        }))
      } else {
        toast.error('Formato no reconocido (esperaba registro-riego-v1 o growflow-sala-v1)')
        return
      }

      // Mapas actuales
      const genPorNombre = new Map(geneticas.map(g => [g.nombre.toLowerCase(), g.id]))
      const plantaPorApodo = new Map(plantas.map(p => [p.apodo ?? '', p]))
      const { data: evsExist } = await supabase.from('eventos').select('planta_id,fecha').eq('tipo', 'Riego')
      const yaRegada = new Set((evsExist ?? [] as FilaEventoRiego[])
        .map((e: FilaEventoRiego) => `${e.planta_id}|${e.fecha}`))

      let nuevasPlantas = 0, riegosImportados = 0, genAsignadas = 0
      for (const item of items) {
        if (!item.apodo) continue
        // Genetica: buscar o crear
        let genId: string | null = null
        if (item.genetica) {
          genId = genPorNombre.get(item.genetica.toLowerCase()) ?? null
          if (!genId) {
            const { data: ng, error } = await supabase.from('geneticas')
              .insert({ nombre: item.genetica, tipo: 'Desconocido' }).select().single()
            if (error) throw new Error(error.message)
            genId = (ng as { id: string }).id
            genPorNombre.set(item.genetica.toLowerCase(), genId!)
          }
        }
        // Planta: actualizar o crear
        let planta = plantaPorApodo.get(item.apodo)
        if (planta) {
          const upd: Partial<Planta> = {}
          if (item.slot) upd.slot = item.slot
          if (genId) upd.genetica_id = genId
          if (Object.keys(upd).length) {
            const { error } = await supabase.from('plantas').update(upd).eq('id', planta.id)
            if (error) throw new Error(error.message)
            if (genId) genAsignadas++
          }
        } else {
          const { data: np, error } = await supabase.from('plantas')
            .insert({ apodo: item.apodo, fase: 'Vegetativo', slot: item.slot, genetica_id: genId, activa: true })
            .select().single()
          if (error) throw new Error(error.message)
          planta = np as Planta
          plantaPorApodo.set(item.apodo, planta!)
          nuevasPlantas++
        }
        // Riegos: insertar los que falten (dedupe por planta+fecha)
        const faltantes = item.riegos.filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f) && !yaRegada.has(`${planta!.id}|${f}`))
        if (faltantes.length) {
          const { error } = await supabase.from('eventos')
            .insert(faltantes.map(f => ({ planta_id: planta!.id, tipo: 'Riego', fecha: f, mensaje_original: 'import' })))
          if (error) throw new Error(error.message)
          faltantes.forEach(f => yaRegada.add(`${planta!.id}|${f}`))
          riegosImportados += faltantes.length
        }
      }
      toast.success(`Importado: ${riegosImportados} riegos, ${genAsignadas} genéticas asignadas, ${nuevasPlantas} plantas nuevas`)
      setModalImport(false)
      setTextoImport('')
      cargar()
    } catch (err) {
      toast.error(`Error importando: ${(err as Error).message}`)
    } finally {
      setImportando(false)
    }
  }

  const regadasHoy = plantas.filter(p => riegos[p.id] === hoyStr()).length

  const renderPlanta = (p: Planta) => {
    const est = estadoRiego(p)
    const gc = colorGen(p.genetica_id)
    const genNombre = geneticas.find(g => g.id === p.genetica_id)?.nombre ?? null
    const nGen = numeroPorGenetica[p.id]
    // LA CELDA MUESTRA EL CODIGO DE LA PLANTA. (29/08/2026)
    //
    // Antes mostraba el numero del apodo —el «12» de «PA-A #12»— en grande. Es
    // un numero de tablero: sirve para no confundir dos cuadraditos vecinos, y
    // para nada mas. El codigo (AVO-00012) es el identificador real, el que va
    // en la trazabilidad, el que figura en la ficha y en la linea de tiempo. Si
    // la celda no lo dice, para pasar del tablero a la ficha hay que adivinar.
    //
    // Entra en 52px porque se parte en dos renglones por el guion, que es
    // exactamente donde el codigo ya viene partido: prefijo arriba, numero
    // abajo. Y entra CHICO: son cinco digitos, no dos, asi que el cuerpo baja de
    // 52/3.2 a 52/4.4. El numero deja de gritar, que es justo lo que se pidio.
    //
    // El prefijo va atenuado y tracked: es «AVO» en las sesenta plantas, o sea
    // que no distingue ninguna. Se muestra igual porque sin el no es el codigo,
    // pero no compite con la parte que si cambia.
    const codigo = p.codigo?.trim() || null
    const cx = codigo?.match(/^(.*)-([^-]+)$/)
    const prefijo = cx?.[1] ?? null
    // Sin codigo se cae al apodo, como antes. Hay instalaciones sin codificar.
    const nucleo = cx?.[2] ?? (codigo ?? (p.apodo ?? '?').replace('#', '').split(/\s+/).pop() ?? '?')
    // EL CUERPO ES FIJO, NO PROPORCIONAL A LA CELDA. (30/08/2026)
    //
    // Estuvo atado al `--slot` y ese fue el error de fondo: cada vez que la
    // celda cambiaba de tamaño, la letra la seguia. Con la celda chica la letra
    // quedo en 9,4px —entraba y no se leia— y al agrandar la celda salto a 14,
    // que en una grilla de sesenta cuadraditos grita.
    //
    // El tamaño de letra no es una consecuencia del ancho disponible: es una
    // decision de legibilidad. Doce pixeles tabulares es lo que se lee de un
    // vistazo sin dominar la celda, y no cambia porque la cama se dibuje de una
    // manera o de otra. Lo que se adapta es la CELDA, que para eso hay lugar.
    const cuerpo = nucleo.length <= 2 ? 15
      : nucleo.length <= 5 ? 12
        : nucleo.length <= 7 ? 10 : 8.5
    // El prefijo es «AVO» en las sesenta plantas: es contexto, no dato. Va al
    // piso de lo legible en mayusculas y se atenua, para que la parte que si
    // cambia —el numero— sea la que se ve primero.
    const capital = prefijo && prefijo.length > 4 ? 7 : 8
    return (
      <button key={p.id} onClick={() => clickPlanta(p)}
        draggable={modo === 'mover'}
        onDragStart={e => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setMoviendo(p.id) }}
        onDragEnd={() => setMoviendo(null)}
        title={`${codigo ? codigo + ' · ' : ''}${genNombre ? `${genNombre} (${nGen} de la variedad)` : (p.apodo ?? 'Planta')} · riego: ${diasSinRiego(p)}`}
        className={`absolute inset-[2px] rounded-lg bg-[#1c1c27] flex flex-col items-center justify-center gap-[1px] px-0 py-[2px] overflow-hidden transition-transform active:scale-95 ${
          modo === 'mover' ? 'cursor-grab active:cursor-grabbing' : ''
        } ${
          moviendo === p.id ? 'ring-2 ring-[#38bdf8] scale-105 z-10 opacity-60' : ''
        }`}
        style={{ border: `2.5px solid ${ESTADOS[est as keyof typeof ESTADOS]}` }}>
        {prefijo && (
          <span style={{ fontSize: `${capital}px`, letterSpacing: '0.08em' }}
            className="font-display font-semibold leading-none text-[#8a8a9c] uppercase whitespace-nowrap max-w-full overflow-hidden">{prefijo}</span>
        )}
        <span style={{ fontSize: `${cuerpo}px` }}
          className="font-display font-bold leading-none text-[#ececf1] tabular-nums whitespace-nowrap max-w-full overflow-hidden">{nucleo}</span>
        {/* LA VARIEDAD, POR COLOR. Es lo que la leyenda de arriba ya explica
            —«puntito de color = genetica»— y ocupa 3px en vez de un renglon con
            un «Avoc…» que no alcanza a decir nada. El nombre entero esta en el
            `title`, junto con el numero de la variedad y los dias sin riego. */}
        {gc && (
          <span aria-hidden className="absolute left-[3px] right-[3px] bottom-[2px] h-[3px] rounded-full"
            style={{ background: gc }} />
        )}
      </button>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#0a0a0f] text-[#d4d4dd] font-sans">
      {/* EL PUENTE ENTRE AMBIENTE Y CULTIVO.
          «Sala» son dos cosas: en Ambiente se cargan temperatura y humedad, y
          acá viven las plantas. Alguien creó «Sala 1» en Ambiente, fue a
          Plantas y no le aparecía. No fallaba nada — simplemente no había
          ningún área, y nada lo decía.
          No se unifican los conceptos: una sala puede tener varias camas. Lo
          que faltaba era avisar. */}
      {salasSinArea.length > 0 && (
        <div className="mx-3 sm:mx-6 mt-3 rounded-xl border border-[#1d3a5a] bg-[#38bdf8]/[0.06] p-3">
          <p className="text-[12px] font-medium text-[#7dd3fc]">
            {salasSinArea.length === 1
              ? 'Tenés una sala en Ambiente sin área de cultivo'
              : `Tenés ${salasSinArea.length} salas en Ambiente sin área de cultivo`}
          </p>
          <p className="text-[11px] text-[#a6a6b5] leading-relaxed mt-1">
            Las salas de <b className="text-[#c9cabf]">Ambiente</b> sirven para cargar temperatura
            y humedad. Para poner plantas hace falta un <b className="text-[#c9cabf]">área de
            cultivo</b>, que es lo que se crea acá. Son dos cosas distintas: una sala puede tener
            varias camas.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {salasSinArea.map(sa => (
              <button key={sa.nombre} type="button"
                onClick={() => { setNombreSugerido(sa.nombre); setModalArea('nueva') }}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[12px] font-medium text-[#d9f99d]">
                <Plus className="w-3.5 h-3.5" /> Crear el área de «{sa.nombre}»
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="sticky top-0 z-40 bg-[#0a0a0f] border-b border-[#1f1f2b]">
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] text-[#ececf1]">Sala de Riego</h1>
            <div className="mt-0.5 text-[10px] sm:text-[11px] text-[#8a8a9c]">
              <span className="text-[#34c97a] font-semibold tabular-nums">{regadasHoy}</span> / {plantas.length} regadas hoy
            </div>
          </div>
          <div className="flex-1" />
          {/* LAS UTILIDADES SON CHICAS Y VAN ARRIBA, CON EL TITULO.
              Estaban en un renglon propio de ancho completo: tres botones de
              117px cada uno, o sea que exportar, importar y refrescar --tres
              tareas de mantenimiento que se hacen una vez por mes-- pesaban mas
              que los cinco modos, que son PARA LO QUE SE ENTRA a esta pantalla.
              La jerarquia estaba dada vuelta.

              Ahora son tres cuadrados de 44 al lado del titulo, y el renglon
              entero que ocupaban se lo queda la botonera de modos. Solo icono:
              agrupados y del mismo tamaño se leen como un grupo de utilidades
              sin necesidad de etiqueta, y el `title` las nombra. */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={exportar} className={btnIcono}
              title="Exportar: copiar todos los datos de la sala al portapapeles"
              aria-label="Exportar los datos de la sala">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={() => setModalImport(true)} className={btnIcono}
              title="Importar: pegar datos exportados (de la app vieja o de GrowFlow)"
              aria-label="Importar datos a la sala">
              <Upload className="w-4 h-4" />
            </button>
            <button onClick={cargar} className={btnIcono} title="Refrescar" aria-label="Refrescar">
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* LOS MODOS, QUE SON EL TRABAJO DE ESTA PANTALLA.
            Renglon propio y ancho completo. Antes eran cinco iconos sin nombre
            apretados al costado del titulo: para saber en cual estabas parado
            habia que reconocer un glifo de 14px, y para descubrir que existe el
            modo Escorrentia habia que tocarlos de a uno.

            EL ACTIVO DICE SU NOMBRE Y LOS DEMAS NO. Con las cinco etiquetas no
            entran a 375px («Escorrentia» sola se lleva 62), y sin ninguna la
            barra no dice nada. Que se abra la que esta elegida resuelve las dos:
            siempre se lee en que modo estas, y las otras cuatro quedan como
            destinos a los que se llega tocando. Los inactivos se reparten el
            sobrante en partes iguales, asi que la fila nunca queda despareja. */}
        <div role="tablist" aria-label="Modo de trabajo"
          className="mx-3 sm:mx-6 flex rounded-lg border border-[#2a2a3a] overflow-hidden">
          {([['regar', Droplets, 'Regar'], ['escorrentia', TestTube, 'Escorrentía'], ['fumigar', SprayCan, 'Fumigar'], ['mover', Move, 'Mover'], ['genetica', Dna, 'Genética']] as const).map(([m, Ic, lbl]) => {
            const activo = modo === m
            return (
              <button key={m} role="tab" aria-selected={activo} aria-label={lbl}
                onClick={() => { setModo(m); setMoviendo(null) }}
                className={`inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-3 text-[11px] font-medium whitespace-nowrap transition-colors ${
                  activo ? 'flex-none bg-[#a3e635]/15 text-[#d9f99d]' : 'flex-1 min-w-0 bg-[#15151d] text-[#8a8a9c] hover:text-[#a6a6b5]'
                }`}>
                <Ic className="w-4 h-4 flex-shrink-0" />
                {activo ? <span>{lbl}</span> : <span className="hidden sm:inline">{lbl}</span>}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2 px-3 sm:px-6 pt-2 flex-wrap">
          {modo === 'genetica' && (
            <select value={genSel} onChange={e => setGenSel(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[11px] text-[#ececf1] focus:outline-none focus:border-[#a3e635]/60 min-h-[44px] sm:min-h-0">
              <option value="">Elegir genética...</option>
              {geneticas.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          )}
        </div>
        {/* Leyenda */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 sm:px-6 pb-2.5 text-[10px] text-[#8a8a9c]">
          {[['Regada hoy', ESTADOS.hoy], ['1-2 días', ESTADOS.reciente], ['3+ días', ESTADOS.atrasada], ['Sin registro', ESTADOS.nunca]].map(([l, c]) => (
            <span key={l} className="inline-flex items-center gap-1.5">
              <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c }} /> {l}
            </span>
          ))}
          {/* La aclaracion del puntito se lleva una fila entera del telefono
              para explicar un detalle que se entiende mirando. */}
          <span className="hidden sm:inline text-[#8a8a9c]">· puntito de color = genética</span>
          {modo === 'mover' && <span className="text-[#38bdf8]">Modo mover: arrastrá una planta a otro lugar. Si la soltás sobre otra, se intercambian. (También podés tocar y elegir el slot.)</span>}
          {modo === 'genetica' && <span className="text-[#c4b5fd]">Modo genética: elegí una y tocá las plantas para asignarla</span>}
          {modo === 'escorrentia' && <span className="text-[#7dd3fc]">Modo escorrentía: tocá UNA planta y cargá lo que escurrió de ESA maceta. Se mide de a una, por eso no está en la receta.</span>}
        </div>
        {/* Receta de riego: se aplica a cada planta que toques */}
        {modo === 'regar' && (
          <div className="px-3 sm:px-6 pb-2.5">
          {/* El boton que la abre, solo en el telefono. Dice lo que hay
              cargado: cerrada resume el dato, no lo esconde. */}
          <button type="button" onClick={() => setRecetaAbierta(v => !v)}
            aria-expanded={recetaAbierta}
            className="sm:hidden w-full inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg border border-[#2a2a3a] bg-[#15151d] text-[11px] text-left">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium shrink-0">
              Receta
            </span>
            <span className={`min-w-0 truncate ${resumenReceta ? 'text-[#7dd3fc]' : 'text-[#8a8a9c]'}`}>
              {resumenReceta || 'sin datos — opcional'}
            </span>
            <ChevronDown aria-hidden
              className={`w-4 h-4 ml-auto shrink-0 text-[#8a8a9c] transition-transform ${recetaAbierta ? 'rotate-180' : ''}`} />
          </button>
          {/* GRILLA EN EL TELÉFONO, FILA EN DESKTOP.
              Los ocho campos llevaban anchos fijos —150, 140, 120, 110 px—
              dentro de un `flex-wrap`. A 375 px quedan 351 útiles: entran dos y
              sobra un hueco distinto en cada fila, así que los diez controles
              caían en SEIS filas de anchos desparejos. Medido en vivo.

              Dos columnas iguales no dejan huecos y se leen como una ficha. Los
              anchos fijos siguen valiendo de `sm:` para arriba, que es donde la
              fila entra entera y cada campo puede medir lo que su contenido
              pide. */}
          <Desplegable abierto={recetaAbierta} sinRecorte={anchoSm}
            className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:items-center sm:flex-wrap sm:pt-0">
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">Receta:</span>
            {/* La fecha es editable. Antes iba fija en hoy y un riego de ayer no
                se podia cargar sin falsear el dato. */}
            <input type="date" value={receta.fecha} max={hoyStr()}
              onChange={e => setReceta(r => ({ ...r, fecha: e.target.value }))}
              className={`${inputReceta} w-full sm:w-[150px] ${receta.fecha !== hoyStr() ? 'border-[#fbbf24]/60 text-[#fbbf24]' : ''}`} />
            {receta.fecha !== hoyStr() && (
              <span className="col-span-2 sm:col-auto text-[10px] text-[#fbbf24]">riego atrasado</span>
            )}
            {([['volumen', 'Volumen ml', '2000'], ['ph', 'pH', '6.2']] as const).map(([k, ph, eg]) => (
              <input key={k} type="number" inputMode="decimal" value={receta[k]}
                onChange={e => setReceta(r => ({ ...r, [k]: e.target.value }))}
                placeholder={`${ph} (ej ${eg})`}
                className={`${inputReceta} w-full sm:w-[120px]`} />
            ))}
            {/* EC y PPM son la misma lectura en dos unidades. Se escribe la que
                mide tu instrumento y la otra se completa sola, con el factor a
                la vista: sin el factor un ppm no se puede interpretar. */}
            <input type="number" inputMode="decimal" step="0.01" value={receta.ec}
              onChange={e => {
                const v = e.target.value
                setReceta(r => ({ ...r, ec: v, ppm: v.trim() === '' ? '' : String(Math.round(Number(v) * ppmFactor)) }))
              }}
              placeholder="EC mS/cm (ej 1.2)"
              className={`${inputReceta} w-full sm:w-[140px]`} />
            <input type="number" inputMode="decimal" value={receta.ppm}
              onChange={e => {
                const v = e.target.value
                setReceta(r => ({ ...r, ppm: v, ec: v.trim() === '' ? '' : String(+(Number(v) / ppmFactor).toFixed(2)) }))
              }}
              placeholder="PPM (ej 600)"
              className={`${inputReceta} w-full sm:w-[120px]`} />
            <select value={ppmFactor}
              onChange={e => {
                const f = Number(e.target.value)
                setPpmFactor(f)
                // Se recalcula el ppm desde el EC, que es lo que se midio.
                setReceta(r => r.ec.trim() === '' ? r : { ...r, ppm: String(Math.round(Number(r.ec) * f)) })
              }}
              className={`${inputReceta} w-full sm:w-[110px]`} title="Factor del medidor">
              <option value={500}>×500</option>
              <option value={700}>×700</option>
            </select>
            <span className="col-span-2 sm:col-auto text-[10px] text-[#8a8a9c]">se guarda en cada planta que toques</span>
          </Desplegable>
          </div>
        )}
        {/* B2: aplicar la receta a un GRUPO entero, en una sola anotacion.
            Sin esto un riego a las 60 plantas son 120 filas y corregirlo son 60
            ediciones. El boton dice cuantas plantas alcanza, para que quede
            claro que no es lo mismo que tocar una. */}
        {/* En el telefono esto ocupaba 152px por dos botones: el titulo, el
            pie y cada boton se llevaban una fila entera. Ahora los botones van
            a la par —el sustrato y el pie solo en pantalla ancha, donde sobra
            lugar— y el bloque baja a una fila. */}
        {modo === 'regar' && grupos.length > 0 && (
          <div className="flex items-center flex-wrap gap-2 px-3 sm:px-6 pb-2.5">
            <span className="w-full sm:w-auto text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">
              <span className="sm:hidden">o de una vez:</span>
              <span className="hidden sm:inline">o registrala de una vez para:</span>
            </span>
            {grupos.map(g => (
              <button key={g.id} onClick={() => regarGrupo(g)}
                className="flex-1 sm:flex-none min-w-0 inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-[#38bdf8]/40 bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 transition-colors text-[12px] text-[#7dd3fc]">
                <Droplets aria-hidden className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{g.nombre}</span>
                <span className="text-[#8a8a9c] shrink-0">
                  ({conteoGrupo[g.id] ?? 0}<span className="hidden sm:inline"> plantas{g.sustrato ? ` · ${g.sustrato}` : ''}</span>)
                </span>
              </button>
            ))}
            {/* CREAR GRUPO, acá y no escondido en otra pantalla.
                Los grupos existían y no había forma de agregar uno: los dos que
                estaban se habían cargado a mano en la base. El lugar donde se
                los usa es el lugar donde se los crea. */}
            {/* `flex-1` como los botones de grupo de al lado: sin el, «Grupo A»
                se estiraba y este quedaba angosto en la misma fila. */}
            <button onClick={nuevoGrupo} className={`${btnSutil} flex-1 sm:flex-none justify-center sm:justify-start`}>
              <Plus aria-hidden className="w-3.5 h-3.5" /> Crear grupo
            </button>
            <span className="hidden sm:inline text-[10px] text-[#8a8a9c]">queda UNA anotación, no una por planta</span>
          </div>
        )}
        {/* Receta de fumigacion/aplicacion */}
        {modo === 'fumigar' && (
          <div className="flex items-center flex-wrap gap-2 px-3 sm:px-6 pb-2.5">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">Aplicación:</span>
            <select value={recetaA.categoria} onChange={e => setRecetaA(r => ({ ...r, categoria: e.target.value }))}
              className="px-2 py-1 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[11px] text-[#ececf1] focus:outline-none focus:border-[#c4b5fd]/60 min-h-[44px] sm:min-h-0">
              {CATEGORIAS_APLIC.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={recetaA.producto} onChange={e => setRecetaA(r => ({ ...r, producto: e.target.value }))}
              placeholder="Producto (ej Neem)"
              className="w-[150px] px-2 py-1 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[11px] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#c4b5fd]/60 min-h-[44px] sm:min-h-0" />
            <input value={recetaA.dosis} onChange={e => setRecetaA(r => ({ ...r, dosis: e.target.value }))}
              placeholder="Dosis (ej 5ml/L)"
              className="w-[130px] px-2 py-1 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[11px] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#c4b5fd]/60 min-h-[44px] sm:min-h-0" />
            <span className="text-[10px] text-[#c4b5fd]">tocá las plantas a las que les aplicaste</span>
          </div>
        )}
      </div>

      <div className="px-3 sm:px-6 py-5 pb-20">
        {/* Sin areas todavia: no dibujamos un tablero inventado. */}
        {!cargando && areas.length === 0 ? (
          <div className="max-w-md mx-auto text-center rounded-xl bg-[#101016] border border-dashed border-[#2a2a3a] px-6 py-10">
            <LayoutGrid className="w-7 h-7 mx-auto mb-3 text-[#8a8a9c]" />
            <h2 className="font-display font-semibold text-[15px] text-[#ececf1] mb-1.5">Todavía no hay áreas</h2>
            <p className="text-[12px] text-[#8f8f9f] leading-relaxed mb-5">
              Un área es cada lugar donde ponés plantas: una carpa, una cama, un sector.
              Creá la primera con sus medidas y cuántas plantas entran, y el tablero se dibuja solo.
            </p>
            <button onClick={() => setModalArea('nueva')}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[12px] font-medium text-[#d9f99d]">
              <Plus className="w-4 h-4" /> Crear la primera área
            </button>
          </div>
        ) : (
        <div className="flex flex-wrap justify-center items-start gap-4">
          {areas.map(carpa => {
            // LA CAMA SE DIBUJA PARADA EN EL TELEFONO.
            //
            // «Cama Sala 2» son 15 columnas por 4 filas. Acostada mide 15 × 63 =
            // 945px: en un telefono de 375 entran cinco columnas de quince y las
            // otras diez se buscan scrolleando al costado, adentro de una
            // tarjeta, que es el unico scroll horizontal de toda la app.
            //
            // Parada son 4 columnas por 15 filas: entra el ANCHO entero y lo que
            // sobra se scrollea hacia abajo, como todo lo demas. La cama no
            // cambia, cambia desde donde se la mira — es la misma rotacion que
            // uno hace con la cabeza al pararse en la punta en vez de al costado.
            //
            // Solo cuando conviene: si el area ya es mas alta que ancha, rotarla
            // la empeora; y si tiene mas de seis filas, paradas no entrarian.
            const parada = !anchoSm && carpa.cols > carpa.rows && carpa.rows <= 6
            const colsVista = parada ? carpa.rows : carpa.cols
            const totalSlots = carpa.cols * carpa.rows
            /**
             * De la posicion en pantalla al indice REAL del slot.
             *
             * El id del slot (`area-0`, `area-1`…) no se toca: las plantas ya
             * estan asignadas a esos ids y renumerarlos las moveria de lugar en
             * la base. Lo unico que cambia es en que orden se dibujan.
             */
            const indiceReal = (pos: number) => parada
              ? (pos % carpa.rows) * carpa.cols + Math.floor(pos / carpa.rows)
              : pos
            const anchoCelda = parada ? 76 : 64
            return (
            <div key={carpa.id} style={{ maxWidth: colsVista * (anchoCelda + 5) + 20 }}
              className="w-full lg:w-auto rounded-xl bg-[#101016] border-2 border-[#1f1f2b] p-2.5">
              <h2 className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#8a8a9c] mb-2 whitespace-nowrap">
                <span className="truncate min-w-0">
                  {carpa.nombre}{' '}
                  <span className="font-normal text-[#8a8a9c]">{medidaTexto(carpa)}</span>
                </span>
                <span className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => setModalArea(carpa)}
                    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 rounded text-[#8a8a9c] hover:text-[#ececf1] transition-colors"
                    title={`Editar ${carpa.nombre}`} aria-label={`Editar ${carpa.nombre}`}>
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => borrarArea(carpa)}
                    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 rounded text-[#8a8a9c] hover:text-[#e05252] transition-colors"
                    title={`Borrar ${carpa.nombre}`} aria-label={`Borrar ${carpa.nombre}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
                {modo === 'regar' && (
                  <button onClick={() => regarCarpa(carpa)}
                    className="inline-flex items-center justify-center gap-1 px-2 py-1.5 sm:px-1.5 sm:py-0.5 min-h-[44px] sm:min-h-0 rounded border border-[#1d3a5a] bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 text-[10px] text-[#38bdf8] transition-colors"
                    title={`Regar todas las plantas de ${carpa.nombre}`}>
                    <Droplets className="w-2.5 h-2.5" /> todas
                  </button>
                )}
                <span className="text-[#34c97a] tabular-nums shrink-0">
                  {Array.from({ length: carpa.cols * carpa.rows }).filter((_, i) => {
                    const p = porSlot[`${carpa.id}-${i}`]
                    return p && riegos[p.id] === hoyStr()
                  }).length}/{Array.from({ length: carpa.cols * carpa.rows }).filter((_, i) => porSlot[`${carpa.id}-${i}`]).length}
                </span>
              </h2>
              {/* EL TABLERO NO SE COMPRIME: SCROLLEA.
                  Las columnas eran `minmax(0, 52px)`, o sea 52px si entraban y
                  lo que fuera si no. Un area de 15 columnas en un telefono de
                  375px dejaba cada planta en 19px: ni se leen ni se tocan.
                  Ahora la celda mide siempre lo mismo.

                  Parada (ver arriba) la cama entra entera a lo ancho y la celda
                  puede ser de 76px, que es donde el codigo respira sin que la
                  letra tenga que crecer. El `overflow-x` queda igual: es la red
                  para las areas que no se pueden rotar. */}
              <div className="overflow-x-auto -mx-0.5 px-0.5">
              <div className="grid gap-[5px] w-max"
                style={{ gridTemplateColumns: `repeat(${colsVista}, ${anchoCelda}px)`, ['--slot' as string]: `${anchoCelda}px` }}>
                {Array.from({ length: totalSlots }).map((_, pos) => {
                  const i = indiceReal(pos)
                  const slot = `${carpa.id}-${i}`
                  const p = porSlot[slot]
                  return (
                    <div key={slot}
                      onClick={() => !p && clickSlot(slot, carpa)}
                      onDragOver={e => { if (modo === 'mover' && moviendo && moviendo !== p?.id) e.preventDefault() }}
                      onDrop={e => { e.preventDefault(); soltarEnSlot(slot, carpa, p) }}
                      className={`relative aspect-square rounded-[9px] border border-dashed transition-colors ${
                        modo === 'mover' && moviendo && moviendo !== p?.id
                          ? 'border-[#38bdf8] bg-[#38bdf8]/10 cursor-pointer'
                          : 'border-[#2a2a3a]'
                      }`}>
                      {p && renderPlanta(p)}
                    </div>
                  )
                })}
              </div>
              </div>
            </div>
          )})}
          <button onClick={() => setModalArea('nueva')}
            className="self-center inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl border border-dashed border-[#2a2a3a] hover:border-[#404d20] bg-[#101016] hover:bg-[#15151d] transition-colors text-[12px] text-[#8f8f9f] hover:text-[#d9f99d]">
            <Plus className="w-4 h-4" /> Nueva área
          </button>
        </div>
        )}

        {/* Bandeja sin ubicar */}
        {sinUbicar.length > 0 && (
          <div className="mt-5 rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 max-w-2xl mx-auto">
            <h2 className="text-[11px] font-semibold text-[#8a8a9c] mb-2">Sin ubicar ({sinUbicar.length}) — en modo mover, tocá una y después un slot libre</h2>
            <div className="flex flex-wrap gap-[5px]">
              {sinUbicar.map(p => (
                <div key={p.id} className="relative w-[52px] h-[52px]">{renderPlanta(p)}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal crear / editar area */}
      {/* La carga de escorrentia, de a UNA planta.
          El codigo va arriba de todo y en su propia franja porque es lo unico
          que hace confiable a esta lectura: quien la carga tiene que poder
          verificar, sin cerrar el formulario, que esta escribiendo en la maceta
          que acaba de medir. */}
      {escPlanta && (
        <ModalFormulario titulo="Escorrentía de una planta"
          onCerrar={cerrarEscorrentia} onGuardar={guardarEscorrentia}>
          <div className="rounded-xl bg-[#15151d] border border-[#1f1f2b] px-3 py-2.5 text-center">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">Planta</div>
            <div className="font-mono font-semibold text-[18px] tabular-nums text-[#ececf1] mt-1 break-all">
              {escPlanta.codigo ?? escPlanta.apodo ?? 'sin código'}
            </div>
            <div className="text-[11px] text-[#8a8a9c] mt-1">
              {geneticas.find(g => g.id === escPlanta.genetica_id)?.nombre ?? 'sin genética'}
              {' · '}{receta.fecha || hoyStr()}
            </div>
          </div>
          {/* Lo que ENTRO, para comparar. Una escorrentia sola no dice nada: el
              dato es la diferencia contra el riego. Si la receta esta vacia se
              dice, en vez de mostrar un renglon con dos guiones. */}
          <div className="text-[11px] text-[#8a8a9c] text-center leading-relaxed">
            {receta.ec.trim() || receta.ph.trim()
              ? <>Entró: {receta.ec.trim() && <b className="text-[#a6a6b5]">EC {receta.ec}</b>}
                  {receta.ec.trim() && receta.ph.trim() && ' · '}
                  {receta.ph.trim() && <b className="text-[#a6a6b5]">pH {receta.ph}</b>}</>
              : 'La receta no tiene EC ni pH cargados, así que no hay con qué comparar.'}
          </div>
          {escCargando ? (
            <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-[#8a8a9c]">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando lo que ya haya cargado…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([['ml', 'Escorrentía ml', '300', '1'],
                 ['ec', 'Escorrentía EC', '2.03', '0.01'],
                 ['ph', 'Escorrentía pH', '5.8', '0.1']] as const).map(([k, lbl, eg, step]) => (
                <div key={k}>
                  <label className={etiquetaCampo} htmlFor={`esc-${k}`}>{lbl}</label>
                  <input id={`esc-${k}`} type="number" inputMode="decimal" step={step}
                    value={esc[k]} onChange={e => setEsc(v => ({ ...v, [k]: e.target.value }))}
                    placeholder={`ej ${eg}`}
                    className="w-full px-2 py-1 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#7dd3fc]/60 min-h-[44px] tabular-nums" />
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-[#8a8a9c] leading-relaxed">
            Se guarda sólo en esta planta. Si dejás los tres campos vacíos, se borra
            la lectura que tenía ese día.
          </p>
        </ModalFormulario>
      )}
      {modalArea && (
        <ModalArea
          area={modalArea === 'nueva' ? null : modalArea}
          nombreInicial={nombreSugerido}
          orden={areas.length}
          onClose={() => { setModalArea(null); setNombreSugerido('') }}
          onGuardado={() => { setModalArea(null); setNombreSugerido(''); cargar() }}
        />
      )}

      {/* Modal Import */}
      {modalImport && (
        <div ref={refDialogo1} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModalImport(false)} />
          <div className="relative w-full max-w-lg rounded-xl bg-[#101016] border border-[#2a2a3a] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1f1f2b]">
              <h2 className="font-display font-semibold text-[14px] text-[#ececf1]">Importar datos</h2>
              <button onClick={() => setModalImport(false)} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 text-[#8a8a9c] hover:text-[#ececf1]" aria-label="Cerrar">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[11px] text-[#8f8f9f] leading-relaxed">
                Pegá acá el JSON exportado. Acepta el export de GrowFlow o el localStorage de la app vieja
                (en esa app, abrí la consola con F12 y ejecutá{' '}
                <code className="font-mono text-[10px] text-[#c4b5fd] bg-[#15151d] px-1 py-0.5 rounded">copy(localStorage.getItem('registro-riego-v1'))</code>
                {' '}para copiarlo). Los riegos se suman sin duplicar; las genéticas y posiciones se actualizan.
              </p>
              <textarea
                autoFocus rows={8} value={textoImport}
                onChange={e => setTextoImport(e.target.value)}
                placeholder='{"plants":{"1":{"slot":"c1-0","riegos":[...]},...}}'
                className="w-full px-3 py-2 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[11px] font-mono text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#a3e635]/60 transition-colors resize-y min-h-[44px] sm:min-h-0"
              />
              <button onClick={importar} disabled={importando || !textoImport.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[12px] font-medium text-[#d9f99d] disabled:opacity-50">
                {importando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Importar
              </button>
              <button onClick={() => setModalImport(false)} className="w-full min-h-[44px] flex items-center justify-center rounded-lg border border-[#2a2a3a] text-[12px] text-[#a6a6b5] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal de alta / edicion de un area
//
// Se piden las medidas y cuantas plantas entran, y de ahi sale la grilla
// sugerida. Filas y columnas quedan editables: un espacio real no siempre entra
// en la grilla mas prolija, y forzarlo dibujaria un tablero que no se parece a
// lo que hay. La capacidad no se pide dos veces: es filas x columnas.
// ---------------------------------------------------------------------------

function ModalArea({ area, orden, nombreInicial = '', onClose, onGuardado }: {
  area: Area | null
  orden: number
  /**
   * Nombre con el que abrir el alta.
   *
   * Viene del aviso de «salas de Ambiente sin área»: se abre el formulario con
   * el nombre puesto para que la persona no tenga que acordarse de cómo lo
   * escribió del otro lado. Sólo aplica al ALTA — editando manda el del área.
   */
  nombreInicial?: string
  onClose: () => void
  onGuardado: () => void
}) {
  const refDialogo2 = useDialogo(onClose)
  const [nombre, setNombre] = useState(area?.nombre ?? nombreInicial)
  const [tipo, setTipo] = useState<TipoArea>(area?.tipo ?? 'carpa')
  const [ancho, setAncho] = useState(area?.ancho_m != null ? String(area.ancho_m) : '')
  const [largo, setLargo] = useState(area?.largo_m != null ? String(area.largo_m) : '')
  const [cantidad, setCantidad] = useState(area ? String(capacidad(area)) : '')
  const [cols, setCols] = useState(area?.cols ?? 3)
  const [rows, setRows] = useState(area?.rows ?? 3)
  // B5: potencia instalada y horas de luz. Con los dos, el consumo del area sale
  // solo; con uno solo no se estima nada (media multiplicacion no es una
  // estimacion conservadora, es un numero inventado).
  const [watts, setWatts] = useState(area?.watts != null ? String(area.watts) : '')
  const [horasLuz, setHorasLuz] = useState(area?.horas_luz != null ? String(area.horas_luz) : '')
  const [guardando, setGuardando] = useState(false)

  // Escribir la cantidad re-sugiere la grilla. Tocar filas o columnas a mano
  // manda: se refleja en la cantidad y no se vuelve a pisar.
  const cambiarCantidad = (v: string) => {
    setCantidad(v)
    const n = parseInt(v, 10)
    if (Number.isFinite(n) && n > 0) {
      const g = sugerirGrilla(n)
      setCols(g.cols); setRows(g.rows)
    }
  }
  const cambiarLado = (cual: 'cols' | 'rows', v: string) => {
    const n = Math.max(1, Math.min(parseInt(v, 10) || 1, LIMITE_LADO))
    const c = cual === 'cols' ? n : cols
    const r = cual === 'rows' ? n : rows
    setCols(c); setRows(r); setCantidad(String(c * r))
  }

  const num = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null }
  const puedeGuardar = nombre.trim().length > 0 && !guardando

  const guardar = async () => {
    if (!puedeGuardar) return
    setGuardando(true)
    try {
      const datos = {
        nombre: nombre.trim(), tipo,
        ancho_m: num(ancho), largo_m: num(largo),
        cols, rows, orden: area?.orden ?? orden,
        watts: num(watts), horas_luz: num(horasLuz),
      }
      if (area) await areasService.actualizar(area.id, datos)
      else await areasService.crear(datos)
      toast.success(area ? 'Área actualizada' : `Área creada · ${cols * rows} lugares`)
      onGuardado()
    } catch (err) {
      toast.error(`No se pudo guardar: ${(err as Error).message}`)
      setGuardando(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[12px] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#a3e635]/60 transition-colors min-h-[44px] sm:min-h-0'
  
  return (
    <div ref={refDialogo2} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-[#101016] border border-[#2a2a3a] shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1f1f2b]">
          <h2 className="font-display font-semibold text-[14px] text-[#ececf1]">
            {area ? `Editar ${area.nombre}` : 'Nueva área'}
          </h2>
          <button onClick={onClose} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 text-[#8a8a9c] hover:text-[#ececf1]" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={etiquetaCampo} htmlFor="area-tipo">Qué es</label>
              <select id="area-tipo" value={tipo} onChange={e => setTipo(e.target.value as TipoArea)} className={inputCls}>
                {TIPOS_AREA.map(t => <option key={t} value={t}>{TIPO_AREA_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label className={etiquetaCampo} htmlFor="area-nombre">Nombre</label>
              <input id="area-nombre" autoFocus value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder={`${TIPO_AREA_LABEL[tipo]} 1`} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={etiquetaCampo}>Medidas del espacio</label>
            <div className="flex items-center gap-2">
              <input value={ancho} onChange={e => setAncho(e.target.value)} inputMode="decimal"
                placeholder="Ancho" aria-label="Ancho en metros" className={inputCls} />
              <span className="text-[12px] text-[#8a8a9c] shrink-0">×</span>
              <input value={largo} onChange={e => setLargo(e.target.value)} inputMode="decimal"
                placeholder="Largo" aria-label="Largo en metros" className={inputCls} />
              <span className="text-[12px] text-[#8a8a9c] shrink-0">m</span>
            </div>
            <p className="text-[10px] text-[#8a8a9c] mt-1">Van en el cartel del área. Opcionales.</p>
          </div>

          {/* B5: potencia. Es lo que permite repartir la factura de luz entre
              areas en vez de cargar un total a mano por ciclo. */}
          <div>
            <label className={etiquetaCampo}>Iluminación (opcional)</label>
            <div className="grid grid-cols-2 gap-2">
              <input value={watts} onChange={e => setWatts(e.target.value)}
                inputMode="numeric" placeholder="Watts (ej 480)" className={inputCls} />
              <input value={horasLuz} onChange={e => setHorasLuz(e.target.value)}
                inputMode="decimal" placeholder="Horas/día (ej 18)" className={inputCls} />
            </div>
            <p className="text-[10px] text-[#8a8a9c] mt-1">
              {(() => {
                const k = kwhDia({ watts: num(watts), horas_luz: num(horasLuz) })
                const m = kwhMes({ watts: num(watts), horas_luz: num(horasLuz) })
                return k != null
                  ? `Consume ${k} kWh por día · ${m} kWh al mes (30 días).`
                  : 'Con los dos datos calculamos el consumo del área. Con uno solo, no.'
              })()}
            </p>
          </div>

          <div>
            <label className={etiquetaCampo} htmlFor="area-cant">Cuántas plantas entran</label>
            <input id="area-cant" value={cantidad} onChange={e => cambiarCantidad(e.target.value)}
              inputMode="numeric" placeholder="ej 12" className={inputCls} />
            <p className="text-[10px] text-[#8a8a9c] mt-1">Proponemos la grilla; si no coincide con el espacio real, corregila abajo.</p>
          </div>

          <div className="rounded-lg bg-[#15151d] border border-[#1f1f2b] p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className={etiquetaCampo} htmlFor="area-cols">Columnas</label>
                <input id="area-cols" type="number" min={1} max={LIMITE_LADO} value={cols}
                  onChange={e => cambiarLado('cols', e.target.value)} className={inputCls} />
              </div>
              <span className="text-[12px] text-[#8a8a9c] pb-3">×</span>
              <div className="flex-1">
                <label className={etiquetaCampo} htmlFor="area-rows">Filas</label>
                <input id="area-rows" type="number" min={1} max={LIMITE_LADO} value={rows}
                  onChange={e => cambiarLado('rows', e.target.value)} className={inputCls} />
              </div>
              <div className="pb-2 text-right">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">Lugares</div>
                <div className="text-[16px] font-semibold text-[#d9f99d] tabular-nums leading-tight">{cols * rows}</div>
              </div>
            </div>
            {/* Vista previa: lo que se va a dibujar en el tablero. */}
            <div className="mt-3 grid gap-[3px] justify-center" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 14px))` }}>
              {Array.from({ length: cols * rows }).map((_, i) => (
                <div key={i} className="aspect-square rounded-[3px] border border-dashed border-[#2a2a3a]" />
              ))}
            </div>
          </div>

          {area && (
            <p className="text-[10px] text-[#e2b93b] leading-relaxed">
              Achicar la grilla puede dejar fuera plantas que estén en los últimos lugares:
              no se borran, pero dejan de verse hasta que las vuelvas a ubicar.
            </p>
          )}

          <button onClick={guardar} disabled={!puedeGuardar}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[12px] font-medium text-[#d9f99d] disabled:opacity-50">
            {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {area ? 'Guardar cambios' : 'Crear área'}
          </button>
          <button onClick={onClose} className="w-full min-h-[44px] flex items-center justify-center rounded-lg border border-[#2a2a3a] text-[12px] text-[#a6a6b5] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
