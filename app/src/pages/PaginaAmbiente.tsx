// PaginaAmbiente — carga MANUAL de lecturas de ambiente.
//
// Esta instalacion no tiene sensores conectados: las lecturas las toma una
// persona con el termohigrometro, normalmente dos veces por dia. La pantalla
// anterior leia sensores en vivo de Growcast por un webhook a una IP de red
// local, que en esta instalacion no existe y mostraba "sin conexion" para
// siempre.
//
// Tres pestanas, en el orden en que se usan: Cargar (el formulario, que es lo
// que se abre 700 veces al ano), Analisis (lo que esos datos significan) y
// Salas (que se toca una vez cada varios meses).
//
// El calculo vive en lib/ambiente.ts; aca solo hay pantalla.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Thermometer, Droplets, Gauge, Plus, Trash2, RefreshCw, Loader2,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, CloudOff, Building2, Pencil,
  SlidersHorizontal,
} from 'lucide-react'
import { BarraPestanas } from '../components/layout/BarraPestanas'
import { GraficoLinea, type Punto } from '../components/ambiente/GraficoLinea'
import {
  ambienteService, vpd, estadoDe, validar, resumir, interpretar,
  RANGOS, rangosDeSala, tieneRangoPropio, ETAPA_LABEL, TURNO_LABEL, turnoDe,
  type Sala, type Lectura, type Etapa, type Estado,
} from '../lib/ambiente'
import { confirmarBorrado } from '../lib/confirmar'

type Tab = 'cargar' | 'analisis' | 'salas'

const TABS: { id: Tab; label: string }[] = [
  { id: 'cargar', label: 'Cargar' },
  { id: 'analisis', label: 'Análisis' },
  { id: 'salas', label: 'Salas' },
]

const RANGOS_DIAS = [
  { dias: 7, label: '7 días' },
  { dias: 30, label: '30 días' },
  { dias: 0, label: 'Todo' },
]

const COLOR_ESTADO: Record<Estado, string> = {
  bajo: '#60a5fa',   // frio / seco
  ok: '#a3e635',
  alto: '#f87171',
}
const TEXTO_ESTADO: Record<Estado, string> = { bajo: 'bajo', ok: 'en rango', alto: 'alto' }

// Para el datetime-local hace falta la hora local sin zona, no un ISO en UTC.
function paraInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const inputCls = 'w-full bg-[#15151d] border border-[#2a2a3a] rounded-lg px-3 py-2.5 ' +
  'min-h-[44px] text-[16px] sm:text-[13px] text-[#ececf1] ' +
  'focus:outline-none focus:border-[#a3e635]/50 transition-colors'
const labelCls = 'block text-[11px] font-medium text-[#a6a6b5] mb-1.5'
const cardCls = 'bg-[#101016] border border-[#1f1f2b] rounded-xl p-4'
const rotuloAmbiente = 'block text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium'

export default function PaginaAmbiente() {
  const [tab, setTab] = useState<Tab>('cargar')
  const [salas, setSalas] = useState<Sala[]>([])
  const [salaId, setSalaId] = useState<string>('')
  const [lecturas, setLecturas] = useState<Lectura[]>([])
  const [dias, setDias] = useState(7)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Formulario
  const [cuando, setCuando] = useState(() => paraInput(new Date()))
  const [temp, setTemp] = useState('')
  const [humedad, setHumedad] = useState('')
  const [nota, setNota] = useState('')

  const sala = useMemo(() => salas.find(s => s.id === salaId) ?? null, [salas, salaId])
  const etapa: Etapa = sala?.etapa ?? 'vegetativo'
  // El rango efectivo: el de la sala si lo cargó, el de la etapa si no.
  const rangos = useMemo(() => rangosDeSala(sala), [sala])

  const cargarSalas = useCallback(async () => {
    try {
      const ss = await ambienteService.getSalas()
      setSalas(ss)
      // Se recuerda la ultima sala usada: quien carga entra siempre a la misma
      // y elegirla de nuevo cada vez es un toque de mas, dos veces por dia.
      const guardada = localStorage.getItem('ambiente_sala')
      const activa = ss.filter(s => s.activa)
      const elegida = activa.find(s => s.id === guardada) ?? activa[0] ?? null
      setSalaId(elegida?.id ?? '')
    } catch (e) {
      toast.error(`No se pudieron cargar las salas: ${(e as Error).message}`)
    } finally {
      setCargando(false)
    }
  }, [])

  const cargarLecturas = useCallback(async () => {
    if (!salaId) { setLecturas([]); return }
    try {
      setLecturas(await ambienteService.getLecturas(salaId, dias))
    } catch (e) {
      toast.error(`No se pudieron cargar las lecturas: ${(e as Error).message}`)
    }
  }, [salaId, dias])

  useEffect(() => { cargarSalas() }, [cargarSalas])
  useEffect(() => { cargarLecturas() }, [cargarLecturas])
  useEffect(() => { if (salaId) localStorage.setItem('ambiente_sala', salaId) }, [salaId])

  // VPD en vivo mientras se tipea: es lo que ensena que temperatura y humedad
  // no se leen por separado. Sin esto el VPD es un numero que aparece despues
  // y nadie relaciona con lo que acaba de cargar.
  const previa = useMemo(() => {
    const t = parseFloat(temp.replace(',', '.'))
    const h = parseFloat(humedad.replace(',', '.'))
    if (Number.isNaN(t) || Number.isNaN(h)) return null
    if (h < 0 || h > 100 || t < -10 || t > 60) return null
    const v = vpd(t, h)
    return {
      vpd: v,
      temp: estadoDe(t, rangos.temp),
      humedad: estadoDe(h, rangos.humedad),
      estadoVpd: estadoDe(v, rangos.vpd),
    }
  }, [temp, humedad, rangos])

  const guardar = async () => {
    if (!salaId) { toast.error('Elegí una sala.'); return }
    const t = parseFloat(temp.replace(',', '.'))
    const h = parseFloat(humedad.replace(',', '.'))
    const errT = validar('temp', Number.isNaN(t) ? null : t)
    if (errT) { toast.error(errT); return }
    const errH = validar('humedad', Number.isNaN(h) ? null : h)
    if (errH) { toast.error(errH); return }

    setGuardando(true)
    try {
      const online = await ambienteService.guardarLectura({
        sala_id: salaId,
        medido_en: new Date(cuando).toISOString(),
        temp_c: t, humedad_pct: h,
        nota: nota.trim() || null,
      })
      toast.success(online
        ? `Lectura guardada · VPD ${vpd(t, h)} kPa`
        : 'Sin señal: la lectura quedó guardada y se sube sola al volver la conexión.')
      setTemp(''); setHumedad(''); setNota('')
      setCuando(paraInput(new Date()))
      if (online) cargarLecturas()
    } catch (e) {
      toast.error(`No se pudo guardar: ${(e as Error).message}`)
    } finally {
      setGuardando(false)
    }
  }

  // ---- Salas ----
  const [salaNueva, setSalaNueva] = useState('')
  const [etapaNueva, setEtapaNueva] = useState<Etapa>('vegetativo')

  const crearSala = async () => {
    if (!salaNueva.trim()) { toast.error('Poné un nombre.'); return }
    try {
      await ambienteService.crearSala({
        nombre: salaNueva.trim(), etapa: etapaNueva, orden: salas.length,
      })
      setSalaNueva('')
      toast.success('Sala creada')
      cargarSalas()
    } catch (e) {
      toast.error(`No se pudo crear: ${(e as Error).message}`)
    }
  }

  const cambiarEtapa = async (s: Sala, e: Etapa) => {
    try {
      await ambienteService.actualizarSala(s.id, { etapa: e })
      setSalas(prev => prev.map(x => x.id === s.id ? { ...x, etapa: e } : x))
      toast.success(`${s.nombre}: ${ETAPA_LABEL[e]}`)
    } catch (err) {
      toast.error(`No se pudo cambiar: ${(err as Error).message}`)
    }
  }

  /**
   * Guarda los limites propios de una sala. `null` borra el limite y vuelve al
   * de la etapa: es la unica forma de deshacer sin tener que adivinar cual era
   * el valor generico.
   */
  const guardarRangos = async (s: Sala, campos: Partial<Sala>) => {
    try {
      await ambienteService.actualizarSala(s.id, campos)
      setSalas(prev => prev.map(x => x.id === s.id ? { ...x, ...campos } : x))
      toast.success(`${s.nombre}: rangos guardados`)
    } catch (err) {
      toast.error(`No se pudieron guardar: ${(err as Error).message}`)
    }
  }

  // Sin `confirm()`: la confirmación es el segundo toque del propio botón, en
  // `FilaSala`. El diálogo nativo no siempre aparece en un teléfono, y cuando no
  // aparece devuelve false — el borrado no se intentaba nunca y el botón quedaba
  // muerto sin decir nada.
  const borrarSala = async (s: Sala) => {
    try {
      await ambienteService.eliminarSala(s.id)
      toast.success('Sala borrada')
      cargarSalas()
    } catch (e) {
      toast.error(`No se pudo borrar: ${(e as Error).message}`)
    }
  }

  const resumen = useMemo(() => resumir(lecturas, rangos), [lecturas, rangos])
  const hallazgos = useMemo(
    () => interpretar(lecturas, rangos, dias || 365), [lecturas, rangos, dias])

  const serie = (f: (l: Lectura) => number): Punto[] =>
    lecturas.map(l => ({ t: l.medido_en, v: f(l) }))

  const fmtCuando = (iso: string) => new Date(iso).toLocaleString('es-AR',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0f] text-[#d4d4dd] font-sans overflow-hidden">
      {/* LA CABECERA SIGUE EL ANCHO DEL CONTENIDO.
          El contenido de las pestañas vive en `max-w-3xl mx-auto` —768 px
          centrados—, y la cabecera iba a ancho completo. En una ventana de 1440
          eso deja el título arrancando en 274 y el contenido en 485, con el
          botón de refrescar en 1416 y el contenido terminando en 1205: 211 px
          de desfase de cada lado. Se leen como dos bloques sin relación, y el
          botón queda pegado al borde de la ventana en vez de al del contenido.

          En el teléfono no cambia nada: `max-w-3xl` sólo actúa cuando sobra
          ancho. */}
      <div className="bg-[#0a0a0f] border-b border-[#1f1f2b] flex-shrink-0">
        <div className="max-w-3xl mx-auto w-full flex items-center gap-3 px-3 sm:px-6 py-3">
          <div className="min-w-0">
            <h1 className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] text-[#ececf1]">
              Ambiente
            </h1>
            <div className="mt-0.5 text-[10px] sm:text-[11px] text-[#8a8a9c]">
              {sala
                ? `${sala.nombre} · ${ETAPA_LABEL[sala.etapa]} · ${resumen.lecturas} lecturas`
                : 'Lecturas cargadas a mano'}
            </div>
          </div>
          <div className="flex-1" />
          <button onClick={() => { cargarSalas(); cargarLecturas() }}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:bg-[#1c1c27] transition-colors text-[#a6a6b5]"
            title="Refrescar">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="max-w-3xl mx-auto w-full">
          <BarraPestanas pestanas={TABS} activa={tab} onCambio={setTab} />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {cargando ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-[#15151d] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : salas.length === 0 && tab !== 'salas' ? (
          // El estado vacío NO puede taparle la pestaña Salas: es la única
          // pantalla donde se sale de este estado, y cubrirla dejaba el botón
          // "Crear la primera sala" sin efecto visible.
          <SinSalas onIr={() => setTab('salas')} />
        ) : (
          <div className="p-3 sm:p-6 max-w-3xl mx-auto space-y-4">

            {/* EN QUE SALA. Se muestra SIEMPRE, tambien con una sola.
                Antes aparecia solo si habia dos o mas, y era la clase de
                economia que deja un formulario ambiguo: el nombre de la sala
                estaba nada mas que en el subtitulo del encabezado, en gris y
                arriba de todo, asi que abajo se cargaban temperatura y humedad
                sin ver en que sala caian. Con una sola sala no hay nada que
                elegir, pero SI hay algo que saber, y son dos cosas distintas:
                por eso con una sola se dibuja como un rotulo y no como un
                boton, que ademas evita ofrecer una eleccion que no existe. */}
            {tab !== 'salas' && (() => {
              const activas = salas.filter(s => s.activa)
              if (activas.length === 0) return null
              return (
                <div>
                  <span className={rotuloAmbiente}>
                    {tab === 'cargar' ? 'En qué sala se carga' : 'Qué sala se mira'}
                  </span>
                  {activas.length === 1 ? (
                    <div className="mt-1.5 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10">
                      <span className="text-[12px] font-medium text-[#d9f99d]">{activas[0].nombre}</span>
                      <span className="text-[11px] text-[#8a8a9c]">{activas[0].etapa}</span>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex gap-1.5 flex-wrap">
                      {activas.map(s => (
                        <button key={s.id} onClick={() => setSalaId(s.id)}
                          aria-pressed={s.id === salaId}
                          className={`px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[12px] font-medium border transition-colors ${
                            s.id === salaId
                              ? 'border-[#a3e635]/40 bg-[#a3e635]/10 text-[#d9f99d]'
                              : 'border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5] hover:text-[#ececf1]'}`}>
                          {s.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {tab === 'cargar' && (
              <>
                <div className={cardCls}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className={labelCls} htmlFor="amb-cuando">Cuándo se midió</label>
                      <input id="amb-cuando" type="datetime-local" className={inputCls}
                        value={cuando} onChange={e => setCuando(e.target.value)} />
                      {/* Viene puesto en este momento, y hay que decirlo: un
                          campo con una fecha ya escrita se lee como un dato que
                          alguien cargó, no como un default. Quien viene a
                          anotar la lectura de hace un rato no sabía que podía
                          cambiarlo. */}
                      <p className="mt-1 text-[10.5px] text-[#8a8a9c]">
                        Viene puesto en ahora. Si la medición fue antes, cambialo.
                      </p>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="amb-temp">Temperatura (°C)</label>
                      <input id="amb-temp" type="number" inputMode="decimal" step="0.1"
                        className={inputCls} placeholder="24.5"
                        value={temp} onChange={e => setTemp(e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="amb-hr">Humedad (%)</label>
                      <input id="amb-hr" type="number" inputMode="decimal" step="0.1"
                        className={inputCls} placeholder="62"
                        value={humedad} onChange={e => setHumedad(e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls} htmlFor="amb-nota">
                        Nota <span className="text-[#8a8a9c] font-normal">(opcional)</span>
                      </label>
                      <input id="amb-nota" type="text" className={inputCls}
                        placeholder="se cortó la luz, puerta abierta…"
                        value={nota} onChange={e => setNota(e.target.value)} />
                    </div>
                  </div>

                  {previa && (
                    <div className="mt-4 rounded-lg border border-[#2a2a3a] bg-[#15151d] p-3">
                      <div className="text-[10px] text-[#8a8a9c] mb-2">
                        Con esos dos números, en {ETAPA_LABEL[etapa].toLowerCase()}:
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Chip label="Temp" estado={previa.temp} />
                        <Chip label="Humedad" estado={previa.humedad} />
                        <Chip label={`VPD ${previa.vpd}`} estado={previa.estadoVpd} />
                      </div>
                      {previa.estadoVpd !== 'ok' && (
                        <p className="mt-2 text-[11px] text-[#a6a6b5] leading-snug">
                          El VPD ideal en {ETAPA_LABEL[etapa].toLowerCase()} va de{' '}
                          <b className="text-[#d4d4dd]">{rangos.vpd.min}</b> a{' '}
                          <b className="text-[#d4d4dd]">{rangos.vpd.max}</b> kPa.{' '}
                          {previa.estadoVpd === 'alto'
                            ? 'Está alto: el aire pide más agua de la que la planta puede dar. Subí la humedad o bajá la temperatura.'
                            : 'Está bajo: la planta casi no transpira y deja de mover nutrientes. Bajá la humedad o subí la temperatura.'}
                        </p>
                      )}
                    </div>
                  )}

                  <button onClick={guardar} disabled={guardando || !salaId}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 disabled:opacity-40 transition-colors text-[13px] font-medium text-[#d9f99d]">
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Guardar lectura
                  </button>
                </div>

                <UltimasLecturas lecturas={lecturas} fmt={fmtCuando}
                  onBorrar={async (l) => {
                    if (!await confirmarBorrado('¿Borrar esta lectura?')) return
                    try {
                      await ambienteService.eliminarLectura(l.id)
                      toast.success('Lectura borrada'); cargarLecturas()
                    } catch (e) { toast.error(`No se pudo borrar: ${(e as Error).message}`) }
                  }}
                  onGuardar={async (l, temp, hum, nota) => {
                    try {
                      await ambienteService.actualizarLectura(l.id, {
                        temp_c: temp, humedad_pct: hum, nota: nota || null,
                      })
                      toast.success(`Corregida · VPD ${vpd(temp, hum)} kPa`); cargarLecturas()
                    } catch (e) { toast.error(`No se pudo guardar: ${(e as Error).message}`) }
                  }} />
              </>
            )}

            {tab === 'analisis' && (
              <>
                <div className="flex gap-1.5">
                  {RANGOS_DIAS.map(r => (
                    <button key={r.dias} onClick={() => setDias(r.dias)}
                      className={`px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[12px] font-medium border transition-colors ${
                        r.dias === dias
                          ? 'border-[#a3e635]/40 bg-[#a3e635]/10 text-[#d9f99d]'
                          : 'border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5] hover:text-[#ececf1]'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>

                {resumen.lecturas === 0 ? (
                  <div className={`${cardCls} text-center py-10`}>
                    <Gauge className="w-6 h-6 text-[#8a8a9c] mx-auto mb-2" />
                    <div className="text-[13px] text-[#d4d4dd] font-medium">Todavía no hay lecturas</div>
                    <div className="mt-1 text-[11px] text-[#8a8a9c]">
                      Cargá dos o tres desde la pestaña <b>Cargar</b> y acá vas a ver
                      los promedios, los picos y cuándo te fuiste de rango.
                    </div>
                  </div>
                ) : (
                  <>
                    {hallazgos.length > 0 && (
                      <div className={cardCls}>
                        <div className="text-[11px] font-medium text-[#a6a6b5] mb-2.5">Qué dicen estos datos</div>
                        <ul className="space-y-2">
                          {hallazgos.map((h, i) => (
                            <li key={i} className="flex gap-2 text-[12px] leading-snug">
                              {h.nivel === 'ok'
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-[#a3e635] shrink-0 mt-0.5" />
                                : <AlertTriangle className="w-3.5 h-3.5 text-[#facc15] shrink-0 mt-0.5" />}
                              <span className={h.nivel === 'ok' ? 'text-[#a6a6b5]' : 'text-[#d4d4dd]'}>
                                {h.texto}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Metrica titulo="Temperatura" unidad=" °C" icono={<Thermometer className="w-3.5 h-3.5" />}
                      m={resumen.temp} rango={rangos.temp} color="#f59e0b"
                      puntos={serie(l => Number(l.temp_c))} fmt={fmtCuando} />

                    <Metrica titulo="Humedad" unidad=" %" icono={<Droplets className="w-3.5 h-3.5" />}
                      m={resumen.humedad} rango={rangos.humedad} color="#38bdf8"
                      puntos={serie(l => Number(l.humedad_pct))} fmt={fmtCuando} />

                    <Metrica titulo="VPD" unidad=" kPa" icono={<Gauge className="w-3.5 h-3.5" />}
                      m={resumen.vpd} rango={rangos.vpd} color="#a3e635"
                      puntos={serie(l => vpd(Number(l.temp_c), Number(l.humedad_pct)))} fmt={fmtCuando} />

                    {resumen.amplitudTemp != null && (
                      <div className={cardCls}>
                        <div className="text-[11px] font-medium text-[#a6a6b5]">Mañana vs. tarde</div>
                        <div className="mt-1 font-display font-bold text-[22px] text-[#ececf1]">
                          {resumen.amplitudTemp > 0 ? '+' : ''}{resumen.amplitudTemp} °C
                        </div>
                        <p className="mt-1 text-[11px] text-[#8a8a9c] leading-snug">
                          Cuánto sube en promedio de la lectura de la mañana a la de la tarde.
                          Es lo que muestra si el equipo de frío da abasto en las horas de más luz,
                          y se pierde entero si sólo se mira el promedio del día.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {tab === 'salas' && (
              <>
                <div className={cardCls}>
                  <div className="text-[11px] font-medium text-[#a6a6b5] mb-2.5">Sala nueva</div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                    <input type="text" className={inputCls} placeholder="Sala 1, Carpa vegetativo…"
                      value={salaNueva} onChange={e => setSalaNueva(e.target.value)} />
                    <select className={inputCls} value={etapaNueva}
                      onChange={e => setEtapaNueva(e.target.value as Etapa)}>
                      <option value="vegetativo">Vegetativo</option>
                      <option value="floracion">Floración</option>
                    </select>
                    <button onClick={crearSala}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[12px] font-medium text-[#d9f99d]">
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-[#8a8a9c] leading-snug">
                    La etapa define contra qué rango se compara cada lectura: el VPD ideal
                    en vegetativo ({RANGOS.vegetativo.vpd.min}–{RANGOS.vegetativo.vpd.max} kPa)
                    no es el de floración ({RANGOS.floracion.vpd.min}–{RANGOS.floracion.vpd.max} kPa).
                    Cambiala cuando la sala cambie de etapa.
                  </p>
                </div>

                {salas.map(s => (
                  <FilaSala key={s.id} sala={s}
                    onEtapa={e => cambiarEtapa(s, e)}
                    onRangos={c => guardarRangos(s, c)}
                    onBorrar={() => borrarSala(s)} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * Una sala en la pestana Salas, con sus limites propios plegados.
 *
 * Van plegados a proposito: seis campos abiertos por sala convierten una lista
 * de tres salas en un formulario de dieciocho casillas, y el 90 % de las veces
 * el rango de la etapa alcanza. El cartel dice cual esta rigiendo, asi que no
 * hay que abrirlo para saberlo.
 */
function FilaSala({ sala, onEtapa, onRangos, onBorrar }: {
  sala: Sala
  onEtapa: (e: Etapa) => void
  onRangos: (campos: Partial<Sala>) => void
  onBorrar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nombre, setNombre] = useState(sala.nombre)
  /** Un nombre vacío o sin cambios no se guarda: sería borrar el rótulo sin querer. */
  const guardarNombre = () => {
    const n = nombre.trim()
    setEditandoNombre(false)
    if (!n || n === sala.nombre) { setNombre(sala.nombre); return }
    onRangos({ nombre: n } as Partial<Sala>)
  }
  /** Segundo toque para borrar, en vez de `confirm()`.
      El diálogo nativo no siempre aparece en un teléfono —y cuando no aparece,
      devuelve false y el borrado no se intenta nunca: el botón queda muerto sin
      decir nada—. Dos toques con el botón cambiado a «¿Seguro?» no dependen del
      navegador y se ven como el resto de la app. */
  const [confirmando, setConfirmando] = useState(false)
  useEffect(() => {
    if (!confirmando) return
    const t = setTimeout(() => setConfirmando(false), 4000)
    return () => clearTimeout(t)
  }, [confirmando])
  const propios = tieneRangoPropio(sala)
  const r = rangosDeSala(sala)

  // El borrador se guarda como texto: un input numerico vacio es "sin limite",
  // y convertirlo a numero en cada tecla borra el campo cuando escribis "2" de
  // "24" y despues lo corregis.
  const [borr, setBorr] = useState<Record<string, string>>({})
  const campos: { k: keyof Sala; label: string }[] = [
    { k: 'temp_min', label: 'Temp min °C' }, { k: 'temp_max', label: 'Temp max °C' },
    { k: 'hum_min',  label: 'HR min %' },    { k: 'hum_max',  label: 'HR max %' },
    { k: 'vpd_min',  label: 'VPD min kPa' }, { k: 'vpd_max',  label: 'VPD max kPa' },
  ]
  const valor = (k: keyof Sala) =>
    borr[k as string] ?? (sala[k] != null ? String(sala[k]) : '')

  const guardar = () => {
    const cambios: Partial<Sala> = {}
    for (const { k } of campos) {
      const txt = valor(k).trim()
      const nuevo = txt === '' ? null : Number(txt)
      if (nuevo != null && !Number.isFinite(nuevo)) continue
      if ((sala[k] ?? null) !== nuevo) (cambios as Record<string, unknown>)[k as string] = nuevo
    }
    if (!Object.keys(cambios).length) { setAbierto(false); return }
    onRangos(cambios)
    setBorr({}); setAbierto(false)
  }

  const limpiar = () => {
    setBorr({})
    onRangos({ temp_min: null, temp_max: null, hum_min: null, hum_max: null, vpd_min: null, vpd_max: null })
    setAbierto(false)
  }

  return (
    <div className={cardCls}>
      <div className="flex items-center gap-3">
        <Building2 className="w-4 h-4 text-[#8a8a9c] shrink-0" />
        <div className="min-w-0 flex-1">
          {/* EL NOMBRE SE PUEDE CORREGIR.
              Se podían cambiar la etapa y los seis rangos, pero no el nombre:
              una sala mal escrita al crearla había que borrarla —perdiendo sus
              lecturas, que borran en cascada— y volver a cargarla. Editar en
              línea y no un modal: es un campo, y el modal para un campo es más
              pantalla que dato. */}
          {editandoNombre ? (
            <input autoFocus value={nombre} onChange={e => setNombre(e.target.value)}
              onBlur={guardarNombre}
              onKeyDown={e => {
                if (e.key === 'Enter') guardarNombre()
                if (e.key === 'Escape') { setNombre(sala.nombre); setEditandoNombre(false) }
              }}
              className="w-full bg-[#15151d] border border-[#a3e635]/50 rounded-lg px-2 py-1 text-[16px] sm:text-[13px] text-[#ececf1] focus:outline-none focus:border-[#a3e635]/60"
              aria-label="Nombre de la sala" />
          ) : (
            <button onClick={() => setEditandoNombre(true)}
              className="text-[13px] font-medium text-[#ececf1] truncate text-left hover:text-[#bef264] transition-colors w-full"
              title="Renombrar la sala">{sala.nombre}</button>
          )}
          <div className="text-[10px] text-[#8a8a9c]">
            {ETAPA_LABEL[sala.etapa]} · {r.temp.min}–{r.temp.max} °C · {r.humedad.min}–{r.humedad.max} % ·{' '}
            {r.vpd.min}–{r.vpd.max} kPa
            {propios
              ? <span className="text-[#a3e635]"> · rango propio</span>
              : <span> · rango de la etapa</span>}
          </div>
        </div>
        <select value={sala.etapa} onChange={e => onEtapa(e.target.value as Etapa)}
          className="bg-[#15151d] border border-[#2a2a3a] rounded-lg px-2 py-2 min-h-[44px] sm:min-h-0 text-[12px] text-[#d4d4dd] focus:outline-none focus:border-[#a3e635]/60">
          <option value="vegetativo">Vegetativo</option>
          <option value="floracion">Floración</option>
        </select>
        <button onClick={() => setAbierto(v => !v)}
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-2 rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:border-[#a3e635]/40 transition-colors text-[#8a8a9c] hover:text-[#a3e635]"
          title="Rangos de esta sala" aria-label="Rangos de esta sala">
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => { if (confirmando) { onBorrar() } else { setConfirmando(true) } }}
          className={`inline-flex items-center justify-center min-h-[44px] sm:min-h-0 px-2 py-2 rounded-lg border transition-colors ${
            confirmando
              ? 'border-[#7a2820] bg-[#7a2820]/20 text-[#ff8a7a] text-[11px] font-medium'
              : 'min-w-[44px] sm:min-w-0 border-[#2a2a3a] bg-[#15151d] hover:border-[#f87171]/40 text-[#8a8a9c] hover:text-[#f87171]'}`}
          title={confirmando ? 'Tocá otra vez para borrar' : 'Borrar sala'}
          aria-label={confirmando ? 'Confirmar borrado de la sala' : 'Borrar sala'}>
          {confirmando ? '¿Seguro?' : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {abierto && (
        <div className="mt-3 pt-3 border-t border-[#1f1f2b]">
          <p className="text-[11px] text-[#8a8a9c] leading-snug mb-2.5">
            Dejá un campo vacío para usar el valor de la etapa. Sirve cuando el
            target real es más exigente que el rango general: con el de etapa,
            27 °C en vegetativo da verde.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {campos.map(({ k, label }) => (
              <label key={k as string}>
                <span className="block text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-1">{label}</span>
                <input type="number" inputMode="decimal" step="0.1"
                  className={inputCls} placeholder="etapa"
                  value={valor(k)}
                  onChange={e => setBorr(b => ({ ...b, [k as string]: e.target.value }))} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button onClick={guardar}
              className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[12px] font-medium text-[#d9f99d]">
              Guardar
            </button>
            {propios && (
              <button onClick={limpiar}
                className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:border-[#f87171]/40 transition-colors text-[12px] text-[#a6a6b5]">
                Volver al rango de la etapa
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ label, estado }: { label: string; estado: Estado }) {
  return (
    <div className="rounded-lg px-2 py-1.5 text-center border"
      style={{ borderColor: `${COLOR_ESTADO[estado]}55`, background: `${COLOR_ESTADO[estado]}14` }}>
      <div className="text-[10px] text-[#a6a6b5]">{label}</div>
      <div className="text-[11px] font-medium" style={{ color: COLOR_ESTADO[estado] }}>
        {TEXTO_ESTADO[estado]}
      </div>
    </div>
  )
}

function Metrica({ titulo, unidad, icono, m, rango, color, puntos, fmt }: {
  titulo: string; unidad: string; icono: React.ReactNode
  m: { promedio: number | null; maximo: { valor: number; cuando: string } | null
       minimo: { valor: number; cuando: string } | null; fuera: number }
  rango: { min: number; max: number }
  color: string; puntos: Punto[]; fmt: (iso: string) => string
}) {
  return (
    <div className={cardCls}>
      <div className="flex items-center gap-1.5 mb-3">
        <span style={{ color }}>{icono}</span>
        <span className="text-[12px] font-medium text-[#ececf1]">{titulo}</span>
        {m.fuera > 0 && (
          <span className="ml-auto text-[10px] text-[#f87171]">
            {m.fuera} fuera de rango
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Dato etiqueta="Promedio" valor={m.promedio != null ? `${m.promedio}${unidad}` : '—'} />
        <Dato etiqueta="Máximo" valor={m.maximo ? `${m.maximo.valor}${unidad}` : '—'}
          pie={m.maximo ? fmt(m.maximo.cuando) : undefined}
          icono={<TrendingUp className="w-3 h-3" />} />
        <Dato etiqueta="Mínimo" valor={m.minimo ? `${m.minimo.valor}${unidad}` : '—'}
          pie={m.minimo ? fmt(m.minimo.cuando) : undefined}
          icono={<TrendingDown className="w-3 h-3" />} />
      </div>

      <GraficoLinea puntos={puntos} rango={rango} color={color} unidad={unidad} etiqueta={titulo} />
    </div>
  )
}

function Dato({ etiqueta, valor, pie, icono }: {
  etiqueta: string; valor: string; pie?: string; icono?: React.ReactNode
}) {
  return (
    <div className="rounded-lg bg-[#15151d] border border-[#20202c] px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] text-[#8a8a9c]">
        {icono}{etiqueta}
      </div>
      <div className="font-display font-semibold text-[15px] text-[#ececf1] mt-0.5">{valor}</div>
      {pie && <div className="text-[10px] text-[#8a8a9c] mt-0.5 truncate">{pie}</div>}
    </div>
  )
}

function UltimasLecturas({ lecturas, onBorrar, onGuardar, fmt }: {
  lecturas: Lectura[]
  onBorrar: (l: Lectura) => void
  onGuardar: (l: Lectura, temp: number, hum: number, nota: string) => Promise<void>
  fmt: (iso: string) => string
}) {
  const [editando, setEditando] = useState<string | null>(null)
  const [b, setB] = useState({ temp: '', hum: '', nota: '' })
  const ultimas = [...lecturas].reverse().slice(0, 8)
  if (ultimas.length === 0) return null

  const abrir = (l: Lectura) => {
    setEditando(l.id)
    setB({ temp: String(Number(l.temp_c)), hum: String(Number(l.humedad_pct)), nota: l.nota ?? '' })
  }

  const guardar = async (l: Lectura) => {
    const t = parseFloat(b.temp.replace(',', '.'))
    const h = parseFloat(b.hum.replace(',', '.'))
    const e1 = validar('temp', Number.isNaN(t) ? null : t); if (e1) { toast.error(e1); return }
    const e2 = validar('humedad', Number.isNaN(h) ? null : h); if (e2) { toast.error(e2); return }
    await onGuardar(l, t, h, b.nota.trim())
    setEditando(null)
  }

  return (
    <div className={cardCls}>
      <div className="text-[11px] font-medium text-[#a6a6b5] mb-2.5">Últimas lecturas</div>
      <div className="space-y-1.5">
        {ultimas.map(l => editando === l.id ? (
          <div key={l.id} className="py-2 border-b border-[#1f1f2b] last:border-0 space-y-2">
            <div className="text-[10px] text-[#8a8a9c]">{fmt(l.medido_en)}</div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" inputMode="decimal" step="0.1" className={inputCls} placeholder="°C"
                value={b.temp} onChange={e => setB(x => ({ ...x, temp: e.target.value }))} />
              <input type="number" inputMode="decimal" step="0.1" className={inputCls} placeholder="%"
                value={b.hum} onChange={e => setB(x => ({ ...x, hum: e.target.value }))} />
            </div>
            <input type="text" className={inputCls} placeholder="Nota"
              value={b.nota} onChange={e => setB(x => ({ ...x, nota: e.target.value }))} />
            <div className="flex gap-1.5">
              <button onClick={() => guardar(l)}
                className="flex-1 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[12px] font-medium text-[#d9f99d]">
                Guardar
              </button>
              <button onClick={() => setEditando(null)}
                className="px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:bg-[#1c1c27] transition-colors text-[12px] text-[#a6a6b5]">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div key={l.id} className="flex items-center gap-2 text-[12px] py-1.5 border-b border-[#1f1f2b] last:border-0">
            <span className="text-[#8a8a9c] w-[92px] shrink-0 text-[10px]">{fmt(l.medido_en)}</span>
            <span className="text-[#ececf1] tabular-nums">{Number(l.temp_c)} °C</span>
            <span className="text-[#8a8a9c]">·</span>
            <span className="text-[#ececf1] tabular-nums">{Number(l.humedad_pct)} %</span>
            <span className="text-[#8a8a9c]">·</span>
            <span className="text-[#a3e635] tabular-nums">
              {vpd(Number(l.temp_c), Number(l.humedad_pct))}
            </span>
            <span className="text-[10px] text-[#8a8a9c]">{TURNO_LABEL[turnoDe(l.medido_en)]}</span>
            <div className="flex-1" />
            {l.nota && <span className="text-[10px] text-[#8a8a9c] truncate max-w-[90px]" title={l.nota}>{l.nota}</span>}
            <button onClick={() => abrir(l)}
              className="p-2 sm:p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center rounded text-[#8a8a9c] hover:text-[#d9f99d] transition-colors shrink-0"
              title="Corregir lectura">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => onBorrar(l)}
              className="p-2 sm:p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center rounded text-[#8a8a9c] hover:text-[#f87171] transition-colors shrink-0"
              title="Borrar lectura">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function SinSalas({ onIr }: { onIr: () => void }) {
  return (
    <div className="p-6 max-w-md mx-auto text-center py-16">
      <div className="mx-auto w-11 h-11 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-3">
        <CloudOff className="w-5 h-5 text-[#8a8a9c]" />
      </div>
      <div className="font-display font-semibold text-[#d4d4dd] text-[14px]">
        Todavía no hay ninguna sala
      </div>
      <p className="mt-2 text-[12px] text-[#8a8a9c] leading-relaxed">
        Esta instalación no tiene sensores conectados: las lecturas se cargan a mano,
        normalmente dos veces por día. Creá primero la sala o carpa donde vas a medir,
        y después cargás temperatura y humedad. El VPD lo calcula solo.
      </p>
      <button onClick={onIr}
        className="mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[13px] font-medium text-[#d9f99d]">
        <Plus className="w-4 h-4" /> Crear la primera sala
      </button>
    </div>
  )
}
