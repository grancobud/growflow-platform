// PaginaGeneticas — fichero ampliado de genéticas en formato de fichas.
// Cards con foto/chips; modal de detalle+edición con toda la info relevante
// para cultivo medicinal (genotipo, cannabinoides, terpenos, usos, tiempos...).

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Dna, Plus, X, Search, Loader2, Trash2, Pencil, Upload, Sprout, FlaskConical, Clock, Scale } from 'lucide-react'
import {
  cultivoService, TIPOS_GENETICA, GENOTIPOS, ALTURAS, DIFICULTADES, AMBIENTES,
  type Genetica,
} from '../lib/cultivo'
import { MODO_DEMO } from '../lib/supabase'
import { FotoPrivada } from '../components/FotoPrivada'
import { btnPrimario, btnSutil, etiquetaCampo, inputFormulario, rotuloSeccion } from '../lib/ui'
import { AyudaCampo } from '../components/ong/GuiaDelFormulario'
import { useDialogo } from '../lib/useDialogo'
import { confirmarBorrado } from '../lib/confirmar'
import { useAbrirAlLlegar } from '../lib/useAbrirAlLlegar'

// text-[16px] en celular: iOS Safari hace zoom sobre cualquier campo con letra
// menor y deja el formulario descuadrado. En desktop vuelve al tamaño real.

const COLOR_GENOTIPO: Record<string, { text: string; bg: string; border: string }> = {
  Indica:    { text: '#c4b5fd', bg: 'rgba(139,92,246,0.12)', border: '#463a66' },
  Sativa:    { text: '#bef264', bg: 'rgba(163,230,53,0.14)', border: '#404d20' },
  Hibrida:   { text: '#38bdf8', bg: 'rgba(56,189,248,0.10)', border: '#1e3a4a' },
  Ruderalis: { text: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: '#5a4a20' },
}

export default function PaginaGeneticas() {
  const [geneticas, setGeneticas] = useState<Genetica[]>([])
  /**
   * Cuántas plantas VIVAS hay de cada genética, por nombre.
   *
   * Lo pidió la asociación el 02/09/2026: en el banco hay veintiséis variedades y
   * mirándolas no se sabe cuál está en la carpa. Y aclaró que NO se borra
   * ninguna — la que no se está cultivando se marca, no desaparece: el banco es
   * el historial de lo que la asociación consiguió alguna vez, y esa lista sirve
   * justamente para volver a pedir una.
   *
   * Se cuenta por NOMBRE y no por id: `resumen_plantas` expone el nombre de la
   * genética, no su clave. Es lo mismo que ya hace Plantas para filtrar.
   */
  const [plantasPorGenetica, setPlantasPorGenetica] = useState<Map<string, number>>(new Map())
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  /**
   * Arranca mostrando SOLO lo que está en las salas.
   *
   * Socio pidió que aparecieran «las que están siendo cultivadas no más» y
   * Gastón que no se borrara ninguna. Las dos cosas son ciertas y no se
   * contradicen: la lista corta es la que se usa todos los días, y el banco
   * entero es el historial de lo que la asociación consiguió alguna vez — que
   * es lo que se mira cuando hay que volver a pedir una variedad.
   *
   * Así que se filtra, no se borra, y el filtro se puede apagar de un toque.
   * De 26 tarjetas a las 8 que importan, sin perder las otras 18.
   */
  const [soloEnCultivo, setSoloEnCultivo] = useState(true)
  const [modalForm, setModalForm] = useState(false)
  const [editar, setEditar] = useState<Genetica | null>(null)
  const [verFicha, setVerFicha] = useState<Genetica | null>(null)
  // «Crear una genetica» abre el alta al llegar, en vez de dejar en la lista
  // con el boton todavia por encontrar. Es lo mismo que hace toda accion que
  // promete dar de alta algo.
  const nuevaGenetica = useCallback(() => { setEditar(null); setModalForm(true) }, [])
  useAbrirAlLlegar(nuevaGenetica, '1', modalForm)
  const cargar = useCallback(async () => {
    // Las plantas activas van en su propio `catch`: si fallan, el banco se ve
    // igual y lo único que falta es el cartelito. Un banco que no carga porque
    // no se pudieron contar las plantas sería cambiar una pantalla por un chip.
    cultivoService.getResumenPlantas(true)
      .then(ps => {
        const m = new Map<string, number>()
        for (const p of ps) {
          const g = (p.genetica ?? '').trim()
          if (g) m.set(g, (m.get(g) ?? 0) + 1)
        }
        setPlantasPorGenetica(m)
      })
      .catch(() => {})
    try { setGeneticas(await cultivoService.getGeneticas()) }
    catch (err) { toast.error(`Error cargando genéticas: ${(err as Error).message}`) }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const borrar = async (g: Genetica) => {
    if (!(await confirmarBorrado(`¿Borrar la genética "${g.nombre}"? Las plantas que la usan quedan sin genética.`))) return
    try { await cultivoService.eliminarGenetica(g.id); toast.success('Genética borrada'); cargar() }
    catch (err) { toast.error(`No se pudo borrar: ${(err as Error).message}`) }
  }

  const q = busqueda.trim().toLowerCase()

  /**
   * Primero las que tienen algo para mostrar, y las vacias al final.
   *
   * Estaban en orden alfabetico puro, asi que las fichas sin cargar quedaban
   * intercaladas: «Cookies» entre CFK y El Gaucho, «EXTERIOR NN» entre El Gaucho
   * y Fancy. Scrolleando, la lista alternaba entre una ficha completa con foto y
   * un cuadro con el nombre y nada mas.
   *
   * Se ordena por lo que la tarjeta REALMENTE dibuja, y en tres escalones:
   *
   *   1. Con foto y con ficha  — las que se ven enteras
   *   2. Con ficha pero sin foto
   *   3. Con foto pero sin ficha — «Purple Lemon» y «Shuga»: se ven, y una
   *      tarjeta con imagen metida entre los cuadros vacios corta la lista
   *   4. Sin nada — las NN y las que todavia no se cargaron
   *
   * Adentro de cada escalon sigue el orden alfabetico de siempre, con
   * `localeCompare` en español para que las tildes y la ñ caigan donde
   * corresponde. No se esconde ninguna: cambia el orden, no la lista.
   */
  const conFicha = (g: Genetica) =>
    !!(g.banco || g.linaje || g.thc_estimado != null || g.terpenos || g.ciclo_semanas)
  const escalon = (g: Genetica) =>
    g.foto_url && conFicha(g) ? 0 : conFicha(g) ? 1 : g.foto_url ? 2 : 3

  /** Plantas vivas de esta genética. Cero es «no se está cultivando». */
  const enCultivo = (g: Genetica) => plantasPorGenetica.get(g.nombre.trim()) ?? 0

  const filtradas = geneticas
    // Buscar apaga el filtro por su cuenta: quien escribe el nombre de una
    // variedad la está buscando en el banco entero, no entre las que tiene.
    .filter(g => !soloEnCultivo || q || enCultivo(g) > 0)
    .filter(g =>
      !q || g.nombre.toLowerCase().includes(q) || (g.banco ?? '').toLowerCase().includes(q) || (g.linaje ?? '').toLowerCase().includes(q))
    .slice()
    // LO QUE ESTÁ EN CULTIVO VA PRIMERO, antes que el orden por ficha.
    //
    // Es la pregunta que se le hace a esta pantalla —«¿cuál tengo?»— y hasta
    // ahora había que leer las veintiséis para contestarla. El orden viejo
    // (foto, ficha, nada) sigue mandando adentro de cada mitad: no se reemplaza,
    // se le antepone uno.
    .sort((a, b) =>
      Number(enCultivo(b) > 0) - Number(enCultivo(a) > 0)
      || escalon(a) - escalon(b)
      || a.nombre.localeCompare(b.nombre, 'es'))

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#0a0a0f] text-[#d4d4dd] font-sans">
      <div className="sticky top-0 z-40 bg-[#0a0a0f] border-b border-[#1f1f2b]">
        <div className="flex items-center flex-wrap gap-2 sm:gap-x-4 px-3 sm:px-6 py-3">
          <div className="min-w-0">
            <h1 className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] text-[#ececf1]">Genéticas</h1>
            {/* Cuántas hay y cuántas están en la carpa. El total solo no
                contesta la pregunta con la que se entra acá. */}
            <div className="mt-0.5 text-[10px] sm:text-[11px] text-[#8a8a9c]">
              {geneticas.length} en el banco
              {plantasPorGenetica.size > 0 && (
                <> · <span className="text-[#bef264]">{geneticas.filter(g => enCultivo(g) > 0).length} con stock</span></>
              )}
            </div>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8a8a9c]" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar nombre / banco"
              className="pl-8 pr-3 py-2 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[12px] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#a3e635]/60 w-[170px] min-h-[44px] sm:min-h-0" />
          </div>
          <button type="button" onClick={() => setSoloEnCultivo(v => !v)}
            aria-pressed={soloEnCultivo}
            title={soloEnCultivo ? 'Ver también las que no están en las salas' : 'Ver sólo las que están en las salas'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg border text-[11px] font-medium transition-colors ${
              soloEnCultivo
                ? 'border-[#404d20] bg-[#a3e635]/10 text-[#d9f99d]'
                : 'border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5] hover:text-[#ececf1]'}`}>
            <Sprout className="w-3.5 h-3.5" />
            {soloEnCultivo ? 'En cultivo' : 'Todas'}
          </button>
          <button onClick={() => { setEditar(null); setModalForm(true) }} className={btnPrimario}>
            <Plus className="w-3.5 h-3.5" /> <span>Genética</span>
          </button>
        </div>
      </div>

      <div className="px-3 sm:px-6 py-4 pb-20">
        {cargando ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded-xl bg-[#101016] border border-[#1f1f2b] h-[150px] animate-pulse" />)}
          </div>
        ) : filtradas.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto w-11 h-11 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-3"><Dna className="w-5 h-5 text-[#8a8a9c]" /></div>
            <div className="font-display font-semibold text-[#d4d4dd] text-[14px]">{geneticas.length === 0 ? 'Sin genéticas cargadas' : 'Sin resultados'}</div>
            <div className="mt-1 text-[11px] text-[#8a8a9c]">
              {geneticas.length === 0
                ? 'Creá la primera ficha de genética.'
                : soloEnCultivo && !q
                  ? `No hay ninguna en las salas. El banco tiene ${geneticas.length}: tocá «En cultivo» para verlas.`
                  : 'Probá con otra búsqueda.'}
            </div>
          </div>
        ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:auto-rows-fr">
            {/* `md:auto-rows-fr` y no `auto-rows-fr` a secas.
              `auto-rows-fr` iguala todas las filas a la mas alta. Con DOS o tres
              columnas eso es lo que se quiere: las tarjetas de una misma fila
              miden lo mismo. Pero en el telefono la grilla es de UNA columna, asi
              que cada tarjeta es su propia fila — y todas quedaban estiradas al
              alto de la mas alta, la que tiene foto. Medido el 29/08/2026: las
              fichas vacias median 548 px para mostrar cuarenta caracteres.
              Emparejar solo tiene sentido cuando hay mas de una por fila. */}
            {filtradas.map(g => {
              const cg = g.genotipo ? COLOR_GENOTIPO[g.genotipo] : null
              return (
                <div key={g.id} className="group relative rounded-xl bg-[#101016] border border-[#1f1f2b] hover:border-[#404d20] transition-colors overflow-hidden h-full flex flex-col">
                  {/* LA TARJETA ENTERA ES EL BOTON, y va tapando todo por debajo
                      del resto. Antes habia TRES blancos para DOS acciones: el
                      nombre abria la edicion y abajo «Ver ficha» y «Editar
                      ficha» repetian lo mismo — y con 26 geneticas, de las
                      cuales 23 no tienen ningun dato cargado, la tarjeta era
                      dos botones y nada mas.
                      Va absoluto y no envolviendo: adentro queda el boton de
                      borrar, y un boton dentro de otro es HTML invalido. */}
                  <button type="button" onClick={() => setVerFicha(g)}
                    aria-label={`Ver la ficha de ${g.nombre}`}
                    className="absolute inset-0 z-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a3e635]/60" />
                  {/* PROPORCIÓN, no alto fijo.
                      `h-28` son 112 px contra una tarjeta de ~350: una franja de
                      3:1. Las fotos de las variedades son del pack del banco, que
                      viene en 3:2, así que `object-cover` recortaba más de la
                      mitad de la imagen —arriba y abajo— para meterla en esa
                      franja. Con `aspect-video` el recorte es mínimo y la foto se
                      lee. El alto sale del ancho de la tarjeta, así que sigue
                      siendo proporcional en las tres grillas. */}
                  {g.foto_url && (
                    <div className="aspect-video bg-[#15151d] overflow-hidden">
                      {/* `contain` y no `cover`: la foto ENTERA, aunque sobren
                          bandas. Cada pack viene con una proporción distinta
                          —el de Epic es 3:2— y con `cover` cualquier imagen que
                          no fuera 16:9 perdía los bordes: se cortaba el nombre
                          de la variedad o el logo del banco, que es justo lo que
                          identifica la foto. Preferible más chica y completa. */}
                      <FotoPrivada valor={g.foto_url} className="w-full h-full object-contain object-center" />
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-display font-semibold text-[14px] text-[#ececf1] truncate group-hover:text-[#bef264] transition-colors block max-w-full">
                          {g.nombre}
                        </span>
                        <p className="text-[11px] text-[#8a8a9c] truncate mt-0.5">
                          {g.banco ?? 'Sin banco'}{g.tipo ? ` · ${g.tipo}` : ''}
                        </p>
                      </div>
                      {cg && <span className="px-2 py-0.5 rounded-full border text-[10px] font-medium flex-shrink-0" style={{ color: cg.text, background: cg.bg, borderColor: cg.border }}>{g.genotipo}</span>}
                    </div>

                    {/* CON STOCK / SIN STOCK. Ninguna se borra: la que no está en
                        la carpa se marca y se queda.

                        El número va al lado y no reemplaza a la palabra: «3
                        plantas» dice cuánto, «Con stock» dice qué mirar de un
                        vistazo, y en una grilla de veintiséis tarjetas lo que se
                        barre es el color. */}
                    <div className="mt-2">
                      {enCultivo(g) > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#404d20] bg-[#a3e635]/12 text-[10px] font-medium text-[#bef264]">
                          <Sprout aria-hidden className="w-3 h-3" strokeWidth={1.8} />
                          Con stock
                          <span className="text-[#a6a6b5] tabular-nums">
                            · {enCultivo(g)} {enCultivo(g) === 1 ? 'planta' : 'plantas'}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#7a2820] bg-[#7a2820]/15 text-[10px] font-medium text-[#ff8a7a]">
                          Sin stock
                        </span>
                      )}
                    </div>

                    {g.linaje && <p className="mt-2 text-[10px] text-[#8f8f9f] italic truncate">{g.linaje}</p>}

                    <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#8f8f9f] tabular-nums">
                      {g.thc_estimado != null && <span className="inline-flex items-center gap-1"><FlaskConical className="w-3 h-3 text-[#bef264]" />THC {g.thc_estimado}%</span>}
                      {g.cbd_estimado != null && <span>CBD {g.cbd_estimado}%</span>}
                      {g.tiempo_flora_dias != null && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3 text-[#c4b5fd]" />{g.tiempo_flora_dias}d flora</span>}
                      {/* El ciclo y el rinde son los dos datos por los que se elige una
                          variedad, y la tarjeta no los mostraba: había que abrir la ficha
                          para saber cuánto tarda y cuánto da. */}
                      {g.ciclo_semanas && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3 text-[#c4b5fd]" />{g.ciclo_semanas} sem.</span>}
                      {g.rendimiento_g && <span className="inline-flex items-center gap-1 text-[#bef264]"><Scale className="w-3 h-3" />{g.rendimiento_g}</span>}
                      {g.altura && <span className="inline-flex items-center gap-1"><Sprout className="w-3 h-3 text-[#34c97a]" />Planta {g.altura.toLowerCase()}</span>}
                    </div>

                    {/* SABOR y USOS, en ese orden.
                        El sabor es lo primero que se pregunta de una variedad y
                        estaba sólo adentro de la ficha: había que abrir para
                        saber a qué sabe. Los dos van juntos bajo la misma línea
                        y cada uno aparece sólo si tiene dato — un rótulo con la
                        nada debajo ocupa el mismo lugar y no dice nada. */}
                    {(g.terpenos || g.usos_medicinales) && (
                      <div className="mt-2.5 pt-2.5 border-t border-[#1f1f2b] space-y-2">
                        {g.terpenos && (
                          <div>
                            <span className={rotuloSeccion}>Sabor</span>
                            <p className="text-[11px] text-[#a6a6b5] mt-0.5 line-clamp-2">{g.terpenos}</p>
                          </div>
                        )}
                        {g.usos_medicinales && (
                          <div>
                            <span className={rotuloSeccion}>Usos</span>
                            <p className="text-[11px] text-[#a6a6b5] mt-0.5 line-clamp-2">{g.usos_medicinales}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Borrar es lo unico que NO puede vivir en el click de la
                        tarjeta: es lo unico que no se deshace. */}
                    <div className="mt-auto pt-3 flex items-center gap-1.5">
                      <span className="text-[10px] text-[#8a8a9c] group-hover:text-[#7c8b5c] transition-colors">Ver ficha</span>
                      <button onClick={() => borrar(g)}
                        className="inline-flex items-center justify-center relative z-10 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#8a8a9c] hover:text-[#ff8a7a] hover:bg-[#15151d] rounded-lg transition-colors ml-auto"
                        aria-label={`Borrar la genética ${g.nombre}`} title="Borrar"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modalForm && <ModalGeneticaFicha genetica={editar} onCerrar={() => setModalForm(false)} onGuardado={() => { setModalForm(false); cargar() }} />}
      {verFicha && (
        <ModalVerFicha genetica={verFicha} onCerrar={() => setVerFicha(null)}
          onEditar={() => { setEditar(verFicha); setVerFicha(null); setModalForm(true) }} />
      )}
    </div>
  )
}

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  const refDialogo = useDialogo(onCerrar)
  return (
    <div ref={refDialogo} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCerrar} />
      <div className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto overscroll-contain rounded-xl bg-[#101016] border border-[#2a2a3a] shadow-2xl">
        <div className="sticky top-0 bg-[#101016] flex items-center justify-between px-5 py-3.5 border-b border-[#1f1f2b]">
          <h2 className="font-display font-semibold text-[14px] text-[#ececf1]">{titulo}</h2>
          <button onClick={onCerrar} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 text-[#8a8a9c] hover:text-[#ececf1]" aria-label="Cerrar"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
        <div className="px-4 py-3 border-t border-[#1f1f2b] sticky bottom-0 bg-[#101016]">
          <button onClick={onCerrar} className="w-full min-h-[44px] flex items-center justify-center rounded-lg border border-[#2a2a3a] text-[12px] text-[#a6a6b5] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">Cerrar</button>
        </div>
      </div>
    </div>
  )
}

type FormG = {
  nombre: string; banco: string; tipo: string; genotipo: string; indica_pct: string; sativa_pct: string
  linaje: string; thc: string; cbd: string; flora: string; vege: string; altura: string; rendimiento: string
  dificultad: string; ambiente: string; terpenos: string; efectos: string; usos: string; resistencia: string
  stretch: string; notas: string; ciclo: string
}

function ModalGeneticaFicha({ genetica, onCerrar, onGuardado }: {
  genetica: Genetica | null; onCerrar: () => void; onGuardado: () => void
}) {
  const g = genetica
  const [form, setForm] = useState<FormG>({
    nombre: g?.nombre ?? '', banco: g?.banco ?? '', tipo: g?.tipo ?? 'Feminizada',
    genotipo: g?.genotipo ?? '', indica_pct: g?.indica_pct?.toString() ?? '', sativa_pct: g?.sativa_pct?.toString() ?? '',
    linaje: g?.linaje ?? '', thc: g?.thc_estimado?.toString() ?? '', cbd: g?.cbd_estimado?.toString() ?? '',
    flora: g?.tiempo_flora_dias?.toString() ?? '', vege: g?.tiempo_vege_dias?.toString() ?? '',
    altura: g?.altura ?? '', rendimiento: g?.rendimiento_g ?? '', dificultad: g?.dificultad ?? '',
    ciclo: g?.ciclo_semanas ?? '',
    ambiente: g?.ambiente ?? '', terpenos: g?.terpenos ?? '', efectos: g?.efectos ?? '',
    usos: g?.usos_medicinales ?? '', resistencia: g?.resistencia ?? '', stretch: g?.stretch ?? '', notas: g?.notas ?? '',
  })
  const [fotoUrl, setFotoUrl] = useState<string | null>(g?.foto_url ?? null)
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const set = (k: keyof FormG, v: string) => setForm(f => ({ ...f, [k]: v }))

  /**
   * Subir la foto la GUARDA, si la genética ya existe.
   *
   * Antes sólo cargaba el archivo al bucket y dejaba la URL en el estado del
   * formulario: si cerrabas sin tocar «Guardar», la foto se veía en pantalla,
   * quedaba ocupando lugar en el storage y la ficha seguía sin imagen. Pasó con
   * la primera que se subió. Subir una foto es una acción explícita: no tiene
   * por qué depender de otro guardado.
   */
  /**
   * Quita la foto de la ficha y borra el archivo.
   *
   * Dos toques, como en las salas: el diálogo nativo no siempre aparece en un
   * teléfono y cuando no aparece devuelve false, así que el botón queda muerto
   * sin decir nada.
   *
   * Si la genética ya existe se persiste en el acto, por lo mismo que subir:
   * quitar una foto es una acción explícita y no tiene por qué depender de que
   * después alguien toque «Guardar».
   */
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false)
  useEffect(() => {
    if (!confirmandoQuitar) return
    const t = setTimeout(() => setConfirmandoQuitar(false), 4000)
    return () => clearTimeout(t)
  }, [confirmandoQuitar])
  const quitarFoto = async () => {
    if (!confirmandoQuitar) { setConfirmandoQuitar(true); return }
    setConfirmandoQuitar(false)
    const anterior = fotoUrl
    setFotoUrl(null)
    try {
      if (g?.id) await cultivoService.actualizarGenetica(g.id, { foto_url: null })
      if (anterior) await cultivoService.borrarFoto(anterior)
      toast.success('Foto quitada')
    } catch (e) { setFotoUrl(anterior); toast.error((e as Error).message) }
  }

  const subirFoto = async (file: File) => {
    setSubiendo(true)
    try {
      const url = await cultivoService.subirFotoGenetica(file)
      setFotoUrl(url)
      // No se llama a `onGuardado`: eso cierra el modal, y quien acaba de subir
      // una foto casi siempre sigue completando la ficha.
      if (g?.id) await cultivoService.actualizarGenetica(g.id, { foto_url: url })
      toast.success(g?.id ? 'Foto guardada' : 'Foto cargada — se guarda con la ficha')
    }
    catch (err) { toast.error(`No se pudo subir: ${(err as Error).message}`) }
    finally { setSubiendo(false) }
  }

  const numNull = (s: string, entero = false) => s.trim() === '' ? null : (entero ? parseInt(s) : parseFloat(s))
  const txtNull = (s: string) => s.trim() || null

  const guardar = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    setGuardando(true)
    // `& { nombre: string }` es lo que exige el alta. Estaba resuelto con un
    // `as any` en la llamada, que callaba justo la unica condicion que hay.
    const payload: Partial<Genetica> & { nombre: string } = {
      nombre: form.nombre.trim(), banco: txtNull(form.banco), tipo: form.tipo as Genetica['tipo'],
      genotipo: (form.genotipo || null) as Genetica['genotipo'],
      indica_pct: numNull(form.indica_pct, true), sativa_pct: numNull(form.sativa_pct, true),
      linaje: txtNull(form.linaje), thc_estimado: numNull(form.thc), cbd_estimado: numNull(form.cbd),
      tiempo_flora_dias: numNull(form.flora, true), tiempo_vege_dias: numNull(form.vege, true),
      ciclo_semanas: form.ciclo.trim() || null,
      altura: (form.altura || null) as Genetica['altura'], rendimiento_g: txtNull(form.rendimiento),
      dificultad: (form.dificultad || null) as Genetica['dificultad'], ambiente: (form.ambiente || null) as Genetica['ambiente'],
      terpenos: txtNull(form.terpenos), efectos: txtNull(form.efectos), usos_medicinales: txtNull(form.usos),
      resistencia: txtNull(form.resistencia), stretch: txtNull(form.stretch), notas: txtNull(form.notas),
      foto_url: fotoUrl,
    }
    try {
      if (g) { await cultivoService.actualizarGenetica(g.id, payload); toast.success('Ficha actualizada') }
      else { await cultivoService.crearGenetica(payload); toast.success(`Genética "${form.nombre}" creada`) }
      onGuardado()
    } catch (err) { toast.error(`Error: ${(err as Error).message}`); setGuardando(false) }
  }

  return (
    <Modal titulo={g ? 'Editar ficha de genética' : 'Nueva genética'} onCerrar={onCerrar}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className={etiquetaCampo}>Nombre *</label><input autoFocus className={inputFormulario} placeholder="Gorilla Glue #4" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
            <AyudaCampo id="genetica" campo="Nombre" /></div>
          <div><label className={etiquetaCampo}>Banco</label><input className={inputFormulario} placeholder="GG Strains" value={form.banco} onChange={e => set('banco', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={etiquetaCampo}>Tipo</label>
            <select className={inputFormulario} value={form.tipo} onChange={e => set('tipo', e.target.value)}>{TIPOS_GENETICA.map(t => <option key={t} value={t}>{t}</option>)}</select>
          </div>
          <div><label className={etiquetaCampo}>Genotipo</label>
            <select className={inputFormulario} value={form.genotipo} onChange={e => set('genotipo', e.target.value)}><option value="">—</option>{GENOTIPOS.map(t => <option key={t} value={t}>{t}</option>)}</select>
          </div>
          <div><label className={etiquetaCampo}>Indica/Sativa %</label>
            <div className="flex gap-1">
              <input className={inputFormulario} type="number" placeholder="60" value={form.indica_pct} onChange={e => set('indica_pct', e.target.value)} title="% Indica" />
              <input className={inputFormulario} type="number" placeholder="40" value={form.sativa_pct} onChange={e => set('sativa_pct', e.target.value)} title="% Sativa" />
            </div>
          </div>
        </div>
        <div><label className={etiquetaCampo}>Linaje / Cruza</label><input className={inputFormulario} placeholder="Chem's Sister x Sour Dubb x Chocolate Diesel" value={form.linaje} onChange={e => set('linaje', e.target.value)} /></div>

        <div className="pt-2 border-t border-[#1f1f2b]"><div className="text-[10px] uppercase tracking-[0.14em] text-[#a78bfa] mb-2">Cannabinoides y tiempos</div></div>
        <div className="grid grid-cols-4 gap-3">
          <div><label className={etiquetaCampo}>THC %</label><input className={inputFormulario} type="number" step="0.1" placeholder="25" value={form.thc} onChange={e => set('thc', e.target.value)} /></div>
          <div><label className={etiquetaCampo}>CBD %</label><input className={inputFormulario} type="number" step="0.1" placeholder="0.1" value={form.cbd} onChange={e => set('cbd', e.target.value)} /></div>
          <div><label className={etiquetaCampo}>Vege (días)</label><input className={inputFormulario} type="number" placeholder="28" value={form.vege} onChange={e => set('vege', e.target.value)} /></div>
          <div><label className={etiquetaCampo}>Flora (días)</label><input className={inputFormulario} type="number" placeholder="63" value={form.flora} onChange={e => set('flora', e.target.value)} /></div>
        </div>

        <div className="pt-2 border-t border-[#1f1f2b]"><div className="text-[10px] uppercase tracking-[0.14em] text-[#a78bfa] mb-2">Cultivo</div></div>
        <div className="grid grid-cols-4 gap-3">
          <div><label className={etiquetaCampo}>Altura</label><select className={inputFormulario} value={form.altura} onChange={e => set('altura', e.target.value)}><option value="">—</option>{ALTURAS.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
          <div><label className={etiquetaCampo}>Dificultad</label><select className={inputFormulario} value={form.dificultad} onChange={e => set('dificultad', e.target.value)}><option value="">—</option>{DIFICULTADES.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
          <div><label className={etiquetaCampo}>Ambiente</label><select className={inputFormulario} value={form.ambiente} onChange={e => set('ambiente', e.target.value)}><option value="">—</option>{AMBIENTES.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
          <div><label className={etiquetaCampo}>Rendimiento</label><input className={inputFormulario} placeholder="+145/Planta" value={form.rendimiento} onChange={e => set('rendimiento', e.target.value)} /></div>
          {/* Texto y no número: el banco publica un rango («8 a 10»). En las
              automáticas es EL dato de tiempo, porque no publican cuánto dura la
              flora sola — y cargar el ciclo entero en «Flora» diría que la
              floración dura eso, que es falso. */}
          <div><label className={etiquetaCampo}>Ciclo (semanas, desde semilla)</label><input className={inputFormulario} placeholder="8 a 10" value={form.ciclo} onChange={e => set('ciclo', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={etiquetaCampo}>Stretch (flora)</label><input className={inputFormulario} placeholder="x2 altura" value={form.stretch} onChange={e => set('stretch', e.target.value)} /></div>
          <div><label className={etiquetaCampo}>Resistencia</label><input className={inputFormulario} placeholder="Hongos / plagas" value={form.resistencia} onChange={e => set('resistencia', e.target.value)} /></div>
        </div>

        <div className="pt-2 border-t border-[#1f1f2b]"><div className="text-[10px] uppercase tracking-[0.14em] text-[#a78bfa] mb-2">Perfil y usos</div></div>
        <div><label className={etiquetaCampo}>Terpenos / Aroma</label><input className={inputFormulario} placeholder="Mirceno, limoneno · cítrico, pino" value={form.terpenos} onChange={e => set('terpenos', e.target.value)} /></div>
        <div><label className={etiquetaCampo}>Efectos</label><input className={inputFormulario} placeholder="Relajante, corporal, sedante" value={form.efectos} onChange={e => set('efectos', e.target.value)} /></div>
        <div><label className={etiquetaCampo}>Usos medicinales</label><input className={inputFormulario} placeholder="Dolor crónico, insomnio, apetito" value={form.usos} onChange={e => set('usos', e.target.value)} /></div>

        <div className="pt-2 border-t border-[#1f1f2b]"><div className="text-[10px] uppercase tracking-[0.14em] text-[#a78bfa] mb-2">Foto</div></div>
        {MODO_DEMO && <p className="text-[10px] text-[#f59e0b] -mt-1">Modo demo: la foto queda en este navegador.</p>}
        <div className="flex items-center gap-3 flex-wrap">
          {fotoUrl && <FotoPrivada valor={fotoUrl} className="w-14 h-14 rounded-lg object-cover border border-[#2a2a3a]" />}
          <label className={`${btnSutil} cursor-pointer`}>
            {subiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {fotoUrl ? 'Cambiar foto' : 'Subir foto'}
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f) }} />
          </label>
          {/* QUITAR. Se podía subir y cambiar, pero no sacar: una foto puesta por
              error quedaba para siempre y la única salida era subir otra encima.
              Confirmación en el propio botón, sin `confirm()` nativo — el mismo
              criterio que en las salas de Ambiente. */}
          {fotoUrl && (
            <button type="button" onClick={quitarFoto}
              className={`${btnSutil} ${confirmandoQuitar ? 'border-[#7a2820] bg-[#7a2820]/20 text-[#ff8a7a]' : ''}`}>
              <Trash2 className="w-3.5 h-3.5" />
              {confirmandoQuitar ? '¿Seguro?' : 'Quitar foto'}
            </button>
          )}
        </div>

        <div><label className={etiquetaCampo}>Notas</label><textarea className={inputFormulario} rows={2} placeholder="Observaciones propias del cultivo..." value={form.notas} onChange={e => set('notas', e.target.value)} /></div>

        <button onClick={guardar} disabled={guardando} className={`${btnPrimario} w-full justify-center`}>
          {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : g ? <Sprout className="w-3.5 h-3.5" /> : <Dna className="w-3.5 h-3.5" />}
          {g ? 'Guardar cambios' : 'Crear genética'}
        </button>
      </div>
    </Modal>
  )
}

function CampoFicha({ label, valor }: { label: string; valor: React.ReactNode }) {
  if (valor == null || valor === '') return null
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-0.5">{label}</div>
      <div className="text-[12px] text-[#ececf1] break-words">{valor}</div>
    </div>
  )
}

function ModalVerFicha({ genetica, onCerrar, onEditar }: {
  genetica: Genetica; onCerrar: () => void
  /** Sin esto la ficha seria un callejon: se entra a mirar y no se puede corregir. */
  onEditar: () => void
}) {
  const g = genetica
  const cg = g.genotipo ? COLOR_GENOTIPO[g.genotipo] : null
  const indicaSativa = (g.indica_pct != null || g.sativa_pct != null)
    ? `${g.indica_pct ?? '?'}% Indica · ${g.sativa_pct ?? '?'}% Sativa` : null
  return (
    <Modal titulo={`Ficha: ${g.nombre}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        {g.foto_url && <FotoPrivada valor={g.foto_url} className="w-full max-h-52 rounded-lg object-cover border border-[#2a2a3a]" />}
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#8a8a9c]">
          {cg && <span className="px-2 py-0.5 rounded-full border text-[11px] font-medium" style={{ color: cg.text, background: cg.bg, borderColor: cg.border }}>{g.genotipo}</span>}
          {g.tipo && <span>{g.tipo}</span>}
          {g.banco && <span>· {g.banco}</span>}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <CampoFicha label="Linaje / Cruza" valor={g.linaje} />
          <CampoFicha label="Indica / Sativa" valor={indicaSativa} />
          <CampoFicha label="THC" valor={g.thc_estimado != null ? `${g.thc_estimado}%` : null} />
          <CampoFicha label="CBD" valor={g.cbd_estimado != null ? `${g.cbd_estimado}%` : null} />
          <CampoFicha label="Vege" valor={g.tiempo_vege_dias != null ? `${g.tiempo_vege_dias} días` : null} />
          <CampoFicha label="Flora" valor={g.tiempo_flora_dias != null ? `${g.tiempo_flora_dias} días` : null} />
          <CampoFicha label="Altura" valor={g.altura} />
          <CampoFicha label="Dificultad" valor={g.dificultad} />
          <CampoFicha label="Ambiente" valor={g.ambiente} />
          <CampoFicha label="Rendimiento" valor={g.rendimiento_g} />
          <CampoFicha label="Ciclo" valor={g.ciclo_semanas ? `${g.ciclo_semanas} semanas` : null} />
          <CampoFicha label="Stretch (flora)" valor={g.stretch} />
          <CampoFicha label="Resistencia" valor={g.resistencia} />
        </div>
        <CampoFicha label="Terpenos / Aroma" valor={g.terpenos} />
        <CampoFicha label="Efectos" valor={g.efectos} />
        <CampoFicha label="Usos medicinales" valor={g.usos_medicinales} />
        <CampoFicha label="Notas" valor={g.notas} />
        {/* Editar primero y con peso: se entra a la ficha a mirar, y lo que
            sigue casi siempre es corregir algo que falta. Cerrar es la salida,
            no la accion. */}
        <div className="flex gap-2">
          <button onClick={onEditar} className={`${btnPrimario} flex-1 justify-center`}>
            <Pencil className="w-3.5 h-3.5" /> Editar ficha
          </button>
          <button onClick={onCerrar} className={`${btnSutil} justify-center`}>Cerrar</button>
        </div>
      </div>
    </Modal>
  )
}
