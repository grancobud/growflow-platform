// PaginaPacientes — "Registro": fichero de pacientes REPROCANN de la asociacion.
// Cards con estado de credencial + alerta de vencimiento, detalle con visor de PDF,
// alta/edicion con carga de credencial (PDF) y foto.

import { useState, useEffect, useCallback } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  IdCard, Plus, X, Search, Loader2, Trash2, Pencil, Upload, FileText,
  ExternalLink, User, Phone, Mail, MapPin, Stethoscope, ShieldCheck, AlertTriangle, Sprout, Ruler, KeyRound,
} from 'lucide-react'
import { PASOS_ALTA } from '../lib/altaSocios'
import {
  registroService, ESTADOS_REPROCANN, MODALIDADES, diasParaVencer, urlDeCredencial,
  type Paciente, type EstadoReprocann,
} from '../lib/registro'
import { cultivoService, type ResumenPlanta } from '../lib/cultivo'
import { MODO_DEMO } from '../lib/supabase'
import { leerCredencial, OCR_DISPONIBLE } from '../lib/ocr'
import { FotoPrivada } from '../components/FotoPrivada'
import { btnPrimario, btnSutil, nombreTocable, etiquetaCampo, inputFormulario, sinAutocorreccion } from '../lib/ui'
import { GuiaDelFormulario, AyudaCampo, OjoDelFormulario } from '../components/ong/GuiaDelFormulario'
import { useAbrirAlLlegar } from '../lib/useAbrirAlLlegar'
import { useAvanzarFlujo } from '../lib/useAvanzarFlujo'
import { idDeLaUrl } from '../lib/contextoDeFlujo'
import { avisosDeFichaNueva } from '../lib/altaAutomatica'
import { useDialogo } from '../lib/useDialogo'
import { confirmarBorrado } from '../lib/confirmar'
import { nombreParaMostrar, normalizar } from '../lib/buscarPersonas'
import { CarnetSocio } from '../components/ong/CarnetSocio'
import { ongService, type Entidad } from '../lib/ong'

type Colores = { text: string; bg: string; border: string }

const COLOR_ESTADO: Record<EstadoReprocann, Colores> = {
  Vigente:        { text: '#bef264', bg: 'rgba(163,230,53,0.14)', border: '#404d20' },
  'En tramite':   { text: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: '#5a4a20' },
  Vencido:        { text: '#ff8a7a', bg: 'rgba(122,40,32,0.15)', border: '#7a2820' },
  Rechazado:      { text: '#8f8f9f', bg: 'rgba(180,180,200,0.06)', border: '#2a2a3a' },
  'Sin registro': { text: '#8f8f9f', bg: 'rgba(180,180,200,0.06)', border: '#2a2a3a' },
}

/**
 * Un estado que la base tiene y el front no conocia tumbaba la pantalla entera
 * con "Cannot read properties of undefined (reading 'text')". Paso de verdad al
 * agregar 'Sin registro' en la base sin agregarlo aca.
 *
 * El front NO puede asumir que conoce todos los valores de una columna de texto:
 * la base se migra sola, por SQL y por la Edge Function `ingesta`. Un color de
 * mas es un detalle; una pantalla caida no.
 */
const colorDe = (e: string | null | undefined): Colores =>
  COLOR_ESTADO[e as EstadoReprocann] ?? COLOR_ESTADO.Rechazado

// text-[16px] en celular: iOS Safari hace zoom sobre cualquier campo con letra
// menor y deja el formulario descuadrado. En desktop vuelve al tamaño real.

const fmtFecha = (f: string | null) =>
  f ? new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

function BadgeVencimiento({ p }: { p: Paciente }) {
  const d = diasParaVencer(p)
  if (d == null) return null
  if (d < 0) return <span className="inline-flex items-center gap-1 text-[10px] text-[#ff8a7a]"><AlertTriangle className="w-3 h-3" />Vencida hace {Math.abs(d)}d</span>
  if (d <= 30) return <span className="inline-flex items-center gap-1 text-[10px] text-[#f59e0b]"><AlertTriangle className="w-3 h-3" />Vence en {d}d</span>
  return <span className="inline-flex items-center gap-1 text-[10px] text-[#8a8a9c]"><ShieldCheck className="w-3 h-3" />Vence {fmtFecha(p.reprocann_vencimiento)}</span>
}

/**
 * `embebida`: se renderiza como pestaña de otra pantalla (hoy, dentro de
 * O.N.G.). Deja de traer su propio scroller y su propio título —los pone el
 * contenedor— pero conserva la barra de búsqueda, el filtro y el alta.
 */
export default function PaginaPacientes({ embebida = false, prefill = null, onPrefillUsado }: {
  embebida?: boolean
  /**
   * Datos con los que abrir el alta, cuando se llega desde una solicitud.
   *
   * Va como prop y NO por la URL: el DNI es un dato personal y una URL queda en
   * el historial, en el registro del servidor y en cualquier link que alguien
   * comparta sin mirar.
   *
   * Es un objeto suelto y no un Paciente a medio armar a proposito: el guardado
   * decide crear o actualizar segun reciba «paciente», asi que un paciente
   * falso con id vacio intentaria ACTUALIZAR una ficha que no existe.
   */
  prefill?: { nombre_completo: string; dni: string; email: string | null; telefono: string | null } | null
  /** Para que quien mando el prefill sepa que ya se uso y no lo repita. */
  onPrefillUsado?: () => void
} = {}) {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  /**
   * `sin_fecha` no es un estado de REPROCANN: es la contradiccion entre dos
   * campos —dice «Vigente» y no hay vencimiento cargado— y por eso va en el
   * mismo selector pero separada de la lista de estados.
   *
   * Existe porque es una lista sobre la que hay que ACCIONAR: a esas personas
   * hay que pedirles la fecha, y para eso hace falta verlas juntas con su
   * telefono y su mail. El cruce de Coherencia dice cuantas son; esto dice
   * quienes, y es la pantalla —detras del login— el unico lugar donde ese dato
   * personal tiene que estar.
   */
  const [filtroEstado, setFiltroEstado] = useState<EstadoReprocann | 'Todos' | 'sin_fecha'>('Todos')
  // Archivar NO es borrar: la ficha se conserva porque puede tener entregas
  // colgando y esas no se tocan. Pero hasta ahora la lista traia activas y
  // archivadas mezcladas y sin distinguirlas, asi que la misma persona
  // aparecia dos veces y no habia forma de saber cual era cual. Por defecto
  // se muestran las activas, que es lo que se usa todos los dias.
  const [verArchivados, setVerArchivados] = useState<'activos' | 'archivados' | 'todos'>('activos')
  const [modalForm, setModalForm] = useState(false)
  const [editar, setEditar] = useState<Paciente | null>(null)

  // Lo mismo que hace el boton de arriba, para que la accion «Sumar a alguien»
  // abra este formulario y no deje en la lista.
  const nuevoPaciente = useCallback(() => { setEditar(null); setModalForm(true) }, [])
  useAbrirAlLlegar(nuevoPaciente, '1', modalForm)
  const avanzar = useAvanzarFlujo()

  // El paso «El tope mensual» de «Sumar a alguien» reabre la ficha de la persona
  // que se acaba de cargar.
  //
  // El tope vive en la MISMA ficha del paso anterior, y es un paso aparte porque
  // es el campo que más se olvida: sin tope, el control de los 30 días no corre
  // para esa persona y nada avisa. Antes el paso dejaba en la lista y había que
  // encontrarla entre 211.
  //
  // SOLO la que trae la URL: sin `?paciente=` no abre nada. Abrir «la última
  // cargada» pondría el tope de una persona en la ficha de otra, y un tope
  // equivocado no se ve — simplemente deja pasar entregas que debería frenar.
  //
  // ⚠ Devuelve `false` cuando la persona todavia no llego en la recarga. Entre
  // que se guarda la ficha y que la lista vuelve de la base pasan cientos de
  // milisegundos, y el paso 2 se abre en el medio: sin este aviso, el hook daba
  // el intento por bueno y no reintentaba, asi que la ficha NO se reabria nunca
  // y el paso quedaba mudo. Con `false` se vuelve a probar cuando llega la lista.
  const abrirFichaDelFlujo = useCallback(() => {
    const id = idDeLaUrl(window.location.search, 'paciente')
    if (!id) return          // Sin id no hay nada que reintentar: no es una espera.
    const p = pacientes.find(x => x.id === id)
    if (!p) return false     // Todavia no llego. Reintentar.
    setEditar(p); setModalForm(true)
  }, [pacientes])
  useAbrirAlLlegar(abrirFichaDelFlujo, 'tope', modalForm)

  // Llegar con datos de una solicitud abre el alta sola: quien acepta no tiene
  // que buscar el boton ni volver a tipear lo que la persona ya escribio.
  useEffect(() => {
    if (prefill) { setEditar(null); setModalForm(true) }
  }, [prefill])
  const [detalle, setDetalle] = useState<Paciente | null>(null)
  /** El carnet de socio abierto. Sale del padrón: no hay dato nuevo que cargar. */
  const [carnet, setCarnet] = useState<Paciente | null>(null)
  const [entidad, setEntidad] = useState<Entidad | null>(null)

  // La entidad se pide la PRIMERA vez que se abre un carnet, no al montar: es
  // una fila y no justifica sumarla a la carga del padrón, pero el carnet la
  // necesita para el encabezado.
  useEffect(() => {
    if (!carnet || entidad) return
    ongService.getEntidad()
      .then(setEntidad)
      .catch(e => console.warn('[Pacientes] no se pudo cargar la entidad:', (e as Error).message))
  }, [carnet, entidad])

  const cargar = useCallback(async () => {
    try {
      setPacientes(await registroService.getPacientes())
    } catch (err) {
      toast.error(`Error cargando pacientes: ${(err as Error).message}`)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const borrar = async (p: Paciente) => {
    if (!(await confirmarBorrado(`¿Borrar la ficha de "${nombreParaMostrar(p)}"? No se puede deshacer.`))) return
    try {
      await registroService.eliminarPaciente(p.id)
      toast.success('Ficha borrada')
      setDetalle(null)
      cargar()
    } catch (err) {
      toast.error(`No se pudo borrar: ${(err as Error).message}`)
    }
  }

  const archivadas = pacientes.filter(p => p.activo === false).length
  const q = busqueda.trim().toLowerCase()
  const filtrados = pacientes.filter(p => {
    const archivada = p.activo === false
    if (verArchivados === 'activos' && archivada) return false
    if (verArchivados === 'archivados' && !archivada) return false
    if (filtroEstado === 'sin_fecha') {
      if (p.reprocann_estado !== 'Vigente' || p.reprocann_vencimiento) return false
    } else if (filtroEstado !== 'Todos' && p.reprocann_estado !== filtroEstado) return false
    if (!q) return true
    // El codigo entra a la busqueda: es como la asociación nombra a la gente a diario.
    return (normalizar(p.nombre_completo).includes(normalizar(q))
      || (p.codigo ?? '').toLowerCase().includes(q)
      || (p.dni ?? '').toLowerCase().includes(q)
      || (p.reprocann_nro ?? '').toLowerCase().includes(q))
  })

  return (
    // Ojo: acá NO va un componente calculado en el render. Definirlo adentro hace
    // que React lo trate como un tipo nuevo en cada pasada, remonte todo el
    // subárbol y el buscador pierda el foco en cada tecla.
    <div className={embebida ? 'space-y-4' : 'flex-1 overflow-y-auto bg-[#0a0a0f] text-[#d4d4dd] font-sans'}>
      <div className={embebida
        ? 'rounded-xl bg-[#101016] border border-[#1f1f2b] px-3 sm:px-4 py-3'
        : 'sticky top-0 z-40 bg-[#0a0a0f] border-b border-[#1f1f2b]'}>
        <div className={`flex items-center flex-wrap gap-2 sm:gap-x-4 ${embebida ? '' : 'px-3 sm:px-6 py-3'}`}>
          <div className="min-w-0">
            {!embebida && <h1 className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] text-[#ececf1]">Registro</h1>}
            <div className={embebida
              ? 'text-[12px] text-[#a6a6b5]'
              : 'mt-0.5 text-[10px] sm:text-[11px] text-[#8a8a9c]'}>
              {/* Cuenta lo que se esta viendo, no el total de filas de la tabla:
                  decir "223 pacientes" con 80 archivadas adentro es un numero
                  que no coincide con nada que se declare afuera. */}
              {filtrados.length} paciente{filtrados.length === 1 ? '' : 's'} · REPROCANN
              {archivadas > 0 && verArchivados === 'activos' && (
                <> · <button onClick={() => setVerArchivados('archivados')}
                  className="text-[#8a8a9c] hover:text-[#a6a6b5] underline">
                  {archivadas} archivada{archivadas === 1 ? '' : 's'}</button></>
              )}
            </div>
          </div>
          {/* Los cuatro controles van juntos en su propio bloque.
              Antes colgaban sueltos del mismo `flex-wrap` que el titulo, con un
              `<div className="flex-1" />` de espaciador en el medio. En el
              escritorio eso empujaba bien, pero en el telefono el espaciador se
              come el resto de la PRIMERA fila y deja a los controles cayendo de
              a dos, con anchos distintos: buscador y «Todos» arriba, «Activas» y
              un boton de 44px abajo. Cuatro filas de tres anchos.
              Agrupados, el bloque ocupa el ancho entero en el telefono y se
              ordena solo: el buscador una fila, los dos filtros mitad y mitad, y
              el boton entero. En el escritorio vuelve a ser una sola fila a la
              derecha, ahora con `ml-auto` sobre un bloque que YA ocupa todo el
              ancho en mobile, asi que no cae la trampa 7.12. */}
          <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8a8a9c]" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar nombre / DNI / N°"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[12px] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#a3e635]/60 min-h-[44px] sm:min-h-0" />
            </div>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)}
              className="flex-1 min-w-0 sm:flex-none px-2.5 py-2 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[11px] text-[#a6a6b5] focus:outline-none focus:border-[#a3e635]/60 cursor-pointer min-h-[44px] sm:min-h-0">
              <option value="Todos">Todos</option>
              {ESTADOS_REPROCANN.map(e => <option key={e} value={e}>{e}</option>)}
              <option value="sin_fecha">⚠ Vigente sin fecha</option>
            </select>
            <select value={verArchivados} onChange={e => setVerArchivados(e.target.value as typeof verArchivados)}
              aria-label="Fichas activas o archivadas"
              className="flex-1 min-w-0 sm:flex-none px-2.5 py-2 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[11px] text-[#a6a6b5] focus:outline-none focus:border-[#a3e635]/60 cursor-pointer min-h-[44px] sm:min-h-0">
              <option value="activos">Activas</option>
              <option value="archivados">Archivadas</option>
              <option value="todos">Activas + archivadas</option>
            </select>
            {/* El texto deja de esconderse en mobile: el boton ahora ocupa una
                fila entera, y una fila entera con un «+» solo no dice que hace. */}
            <button onClick={nuevoPaciente} className={`${btnPrimario} w-full sm:w-auto justify-center`}>
              <Plus className="w-3.5 h-3.5" /> Paciente
            </button>
          </div>
        </div>
      </div>

      <div className={embebida ? '' : 'px-3 sm:px-6 py-4 pb-20'}>
        {/* Tarjeta resumen de habilitaciones REPROCANN */}
        <ResumenHabilitaciones pacientes={pacientes} />

        {cargando ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-[#101016] border border-[#1f1f2b] h-[128px] animate-pulse" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto w-11 h-11 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-3">
              <IdCard className="w-5 h-5 text-[#8a8a9c]" />
            </div>
            <div className="font-display font-semibold text-[#d4d4dd] text-[14px]">
              {pacientes.length === 0 ? 'Sin pacientes cargados' : 'Sin resultados'}
            </div>
            <div className="mt-1 text-[11px] text-[#8a8a9c]">
              {pacientes.length === 0 ? 'Agregá la primera ficha de paciente REPROCANN.' : 'Probá con otro filtro o búsqueda.'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
            {filtrados.map(p => {
              const ce = colorDe(p.reprocann_estado)
              // La inicial del APELLIDO, que es por lo que está ordenada la lista.
              const inicial = (nombreParaMostrar(p) || '?').charAt(0).toUpperCase()
              return (
                <div key={p.id} className="rounded-xl bg-[#101016] border border-[#1f1f2b] hover:border-[#404d20] transition-colors overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#a3e635]/12 border border-[#404d20] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {p.foto_url
                          ? <FotoPrivada valor={p.foto_url} className="w-full h-full object-cover" />
                          : <span className="text-[14px] font-display font-bold text-[#d9f99d]">{inicial}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <button onClick={() => setDetalle(p)}
                          className={`font-display font-semibold text-[14px] text-[#ececf1] truncate hover:text-[#bef264] transition-colors text-left block max-w-full ${nombreTocable}`}
                          title="Ver ficha">{nombreParaMostrar(p)}</button>
                        {/* C3: el codigo tenia su lugar en `notas` y no se veia
                            en ningun lado. Es el que la asociación usa a diario. */}
                        {p.codigo && (
                          <span className="ml-2 font-mono text-[10px] text-[#8a8a9c]">{p.codigo}</span>
                        )}
                        <p className="text-[11px] text-[#8a8a9c] truncate mt-0.5">
                          {p.dni ? `DNI ${p.dni}` : 'Sin DNI'}{p.reprocann_nro ? ` · N° ${p.reprocann_nro}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="px-2 py-0.5 rounded-full border text-[10px] font-medium"
                          style={{ color: ce.text, background: ce.bg, borderColor: ce.border }}>
                          {p.reprocann_estado}
                        </span>
                        {/* Sin esto una ficha archivada se ve igual que una viva,
                            y con la misma persona cargada dos veces no hay forma
                            de saber cual de las dos es la que cuenta. */}
                        {p.activo === false && (
                          <span className="px-2 py-0.5 rounded-full border border-[#3a3a4a] bg-[#15151d] text-[10px] font-medium text-[#8a8a9c]">
                            Archivada
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <BadgeVencimiento p={p} />
                      <div className="flex items-center gap-2">
                        {p.socio && <span className="text-[10px] text-[#a78bfa]">Socio</span>}
                        {p.credencial_url && <FileText className="w-3.5 h-3.5 text-[#38bdf8]" aria-label="Tiene credencial PDF" />}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button onClick={() => setDetalle(p)} className={btnSutil}><User className="w-3.5 h-3.5" /> Ver ficha</button>
                      <button onClick={() => setCarnet(p)} className={btnSutil}
                        title="El carnet que la persona muestra en la sede"><IdCard className="w-3.5 h-3.5" /> Carnet</button>
                      <button onClick={() => { setEditar(p); setModalForm(true) }} className={btnSutil}><Pencil className="w-3.5 h-3.5" /> Editar</button>
                      <button onClick={() => borrar(p)} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#8a8a9c] hover:text-[#ff8a7a] hover:bg-[#15151d] rounded-lg transition-colors ml-auto" title="Borrar ficha">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modalForm && (
        <ModalPaciente paciente={editar} prefill={editar ? null : prefill} padron={pacientes}
          onCerrar={() => { setModalForm(false); onPrefillUsado?.() }}
          onGuardado={creado => {
            setModalForm(false); onPrefillUsado?.(); cargar()
            // El paso que sigue es el tope mensual de ESTA persona. En una
            // edición no viene ninguno creado y se usa el que se estaba editando.
            const id = creado?.id ?? editar?.id
            avanzar(id ? { paciente: id } : undefined)
          }} />
      )}
      {detalle && (
        <ModalDetalle paciente={detalle} onCerrar={() => setDetalle(null)}
          onEditar={() => { setEditar(detalle); setDetalle(null); setModalForm(true) }}
          onBorrar={() => borrar(detalle)} />
      )}

      {/* La entidad se pide sólo cuando se abre un carnet: es una fila y no
          justifica sumarla a la carga de la pantalla. */}
      {carnet && (
        <CarnetSocio paciente={carnet} entidad={entidad} onCerrar={() => setCarnet(null)} />
      )}
    </div>
  )
}

function ResumenHabilitaciones({ pacientes }: { pacientes: Paciente[] }) {
  const totalPlantas = pacientes.reduce((acc, p) => acc + (p.plantas_habilitadas ?? 0), 0)
  const totalM2 = pacientes.reduce((acc, p) => acc + (p.m2_habilitados ?? 0), 0)
  const conHabilitacion = pacientes.filter(p => (p.plantas_habilitadas ?? 0) > 0 || (p.m2_habilitados ?? 0) > 0).length
  return (
    /* ALINEADO AL RESTO DE LA APP, que este bloque no seguia.
       Tenia el UNICO gradiente de la O.N.G., tres colores de acento —lima,
       cian y violeta— y los numeros en Sora a 26px. El resto del sistema
       muestra 29 cifras en MONO y solo 2 en display: estas dos.
       Un dato va en mono; el gradiente y el violeta decorativo no dicen nada
       —el violeta significa «paciente» en el resto de la app— y un solo acento
       es lo que el sistema declara. La jerarquia la hace el tamanio, que se
       queda. */
    <div className="mb-4 rounded-xl border border-[#404d20] bg-[#101016] p-4">
      {/* MOBILE PRIMERO, y las dos cifras en celda como los KPI.
          Era `justify-between` con `flex-wrap`: en el escritorio dejaba el
          titulo a un lado y los numeros al otro, pero en el telefono envuelve y
          `justify-between` deja de separar nada — las dos cifras quedaban
          pegadas al borde izquierdo, con el separador de 1 px entre medio y
          todo el ancho vacio a la derecha.
          Ahora las dos cifras van en una grilla de dos celdas iguales,
          centradas y del mismo alto que los KPI de la O.N.G. El separador de
          1 px se va: con dos cajas ya no hay nada que separar. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">Habilitación REPROCANN total</div>
          <div className="text-[11px] text-[#8a8a9c] mt-0.5">Suma de lo habilitado a {conHabilitacion} de {pacientes.length} pacientes</div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex-shrink-0 sm:w-[300px]">
          <div className="min-h-[72px] flex flex-col items-center justify-center text-center
            rounded-[10px] bg-[#15151d] border border-[#1f1f2b] px-2 py-3">
            <div className="flex items-center justify-center gap-1.5 text-[#bef264]">
              <Sprout aria-hidden className="w-5 h-5 flex-shrink-0" />
              <span className="font-mono font-bold text-[24px] tabular-nums leading-none">{totalPlantas}</span>
            </div>
            <div className="w-full text-[10px] text-[#8f8f9f] mt-1.5 truncate">plantas habilitadas</div>
          </div>
          {/* En el mismo lima que las plantas: los metros no son otra cosa,
              son la otra forma de medir la misma habilitacion. El cian
              significa «riego» en el resto de la app. */}
          <div className="min-h-[72px] flex flex-col items-center justify-center text-center
            rounded-[10px] bg-[#15151d] border border-[#1f1f2b] px-2 py-3">
            <div className="flex items-center justify-center gap-1.5 text-[#bef264]">
              <Ruler aria-hidden className="w-5 h-5 flex-shrink-0" />
              <span className="font-mono font-bold text-[24px] tabular-nums leading-none">{totalM2 % 1 === 0 ? totalM2 : totalM2.toFixed(2)}</span>
            </div>
            <div className="w-full text-[10px] text-[#8f8f9f] mt-1.5 truncate">m² habilitados</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * El modal de las fichas de paciente.
 *
 * ⚠ `accion` no es opcional por comodidad: es donde va el botón que GUARDA.
 *
 * La barra de abajo queda fija y antes tenía sólo «Cerrar», mientras el botón de
 * guardar vivía al final del cuerpo, que en la ficha de un paciente son treinta
 * campos de scroll. O sea: lo único visible en el lugar donde uno busca guardar
 * decía «Cerrar». Quien cargaba una ficha entera se encontraba con un botón que
 * la descarta, y la única salida aparente era perder lo escrito.
 *
 * Por eso la acción principal viaja al pie, al lado de Cerrar y no debajo de
 * treinta campos.
 */
function Modal({ titulo, ancho = 'max-w-lg', onCerrar, accion, children }: {
  titulo: string
  ancho?: string
  onCerrar: () => void
  /** El botón principal, fijo al pie. Sin esto el modal es de sólo lectura. */
  accion?: React.ReactNode
  children: React.ReactNode
}) {
  const refDialogo = useDialogo(onCerrar)
  return (
    <div ref={refDialogo} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCerrar} />
      <div className={`relative w-full ${ancho} max-h-[90dvh] overflow-y-auto overscroll-contain rounded-xl bg-[#101016] border border-[#2a2a3a] shadow-2xl`}>
        <div className="sticky top-0 bg-[#101016] flex items-center justify-between px-5 py-3.5 border-b border-[#1f1f2b]">
          <h2 className="font-display font-semibold text-[14px] text-[#ececf1]">{titulo}</h2>
          <button onClick={onCerrar} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 text-[#8a8a9c] hover:text-[#ececf1]" aria-label="Cerrar"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
        <div className="px-4 py-3 border-t border-[#1f1f2b] sticky bottom-0 bg-[#101016] flex gap-2">
          <button onClick={onCerrar} className={`${accion ? 'w-auto px-4' : 'w-full'} min-h-[44px] flex items-center justify-center rounded-lg border border-[#2a2a3a] text-[12px] text-[#a6a6b5] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors`}>Cerrar</button>
          {accion && <div className="flex-1">{accion}</div>}
        </div>
      </div>
    </div>
  )
}

/**
 * Qué hacer cuando la persona todavía no tiene la credencial.
 *
 * El formulario pide «el número de REPROCANN y su estado» y, si no lo tiene, no
 * decía cómo conseguirlo: el link oficial estaba en otra pantalla. Acá se
 * muestra en el punto exacto donde aparece el problema.
 *
 * El texto cambia según el estado porque no es lo mismo empezar el trámite que
 * renovarlo, y decir «sacá el REPROCANN» a quien lo tiene vencido es hacerle
 * repetir un camino que ya hizo.
 */
function AyudaReprocann({ estado }: { estado: string }) {
  const paso = PASOS_ALTA.find(p => p.n === 2)
  if (!paso) return null
  const vencido = estado === 'Vencido'
  return (
    <div className="rounded-lg border border-[#a78bfa]/30 bg-[#a78bfa]/5 p-3 space-y-2">
      <p className="text-[11px] text-[#c4b5fd] leading-relaxed">
        {vencido
          ? 'La credencial está vencida. La renovación se hace en el mismo lugar que el trámite original, y hasta que esté al día la entrega no queda amparada por la 27.350.'
          : 'Todavía no tiene credencial. El trámite lo hace la persona en el sitio del Estado, junto con su médico: el sistema no lo puede iniciar ni inventar el número.'}
      </p>
      <a href={paso.url} target="_blank" rel="noopener noreferrer"
        className={`${btnSutil} inline-flex`}>
        <ExternalLink className="w-3.5 h-3.5" /> {vencido ? 'Renovar en Mi Argentina' : paso.accion}
      </a>
      <p className="text-[10px] text-[#8a8a9c] leading-relaxed">
        Cuando lo tenga, volvé a esta ficha y cargá el número, la emisión y el vencimiento
        mirando la credencial. <strong className="text-[#a6a6b5]">Tener credencial no alcanza:</strong> además
        tiene que designar a la asociación como su cultivador, y eso se confirma en Asociados.
      </p>
    </div>
  )
}

function Dato({ icono: Icono, label, valor }: { icono?: LucideIcon; label: string; valor: React.ReactNode }) {
  if (valor == null || valor === '' || valor === '—') return null
  return (
    <div className="flex items-start gap-2 py-1.5">
      {Icono && <Icono className="w-3.5 h-3.5 text-[#8a8a9c] mt-0.5 flex-shrink-0" />}
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">{label}</div>
        <div className="text-[12px] text-[#d4d4dd] break-words">{valor}</div>
      </div>
    </div>
  )
}

function ModalDetalle({ paciente: p, onCerrar, onEditar, onBorrar }: {
  paciente: Paciente; onCerrar: () => void; onEditar: () => void; onBorrar: () => void
}) {
  const ce = colorDe(p.reprocann_estado)
  const [plantasPac, setPlantasPac] = useState<ResumenPlanta[]>([])
  useEffect(() => { cultivoService.getPlantasDePaciente(p.id).then(setPlantasPac).catch(() => {}) }, [p.id])
  const usoPlantas = plantasPac.filter(pl => pl.activa).length
  // La credencial no tiene link permanente: se pide una URL firmada cada vez que
  // se abre la ficha. null = todavía resolviendo; 'error' = no se pudo, se avisa
  // en vez de dejar un visor en blanco.
  const [cred, setCred] = useState<{ url: string } | 'error' | null>(null)
  useEffect(() => {
    if (!p.credencial_url) return
    let vigente = true
    urlDeCredencial(p.credencial_url)
      .then(u => { if (vigente) setCred(u ? { url: u } : 'error') })
      .catch(() => { if (vigente) setCred('error') })
    return () => { vigente = false }
  }, [p.credencial_url])
  return (
    <Modal titulo={p.codigo ? `${nombreParaMostrar(p)} · ${p.codigo}` : nombreParaMostrar(p)}
      ancho="max-w-2xl" onCerrar={onCerrar}>
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="px-2 py-0.5 rounded-full border text-[10px] font-medium"
          style={{ color: ce.text, background: ce.bg, borderColor: ce.border }}>{p.reprocann_estado}</span>
        {p.socio && <span className="px-2 py-0.5 rounded-full border border-[#463a66] bg-[#8b5cf6]/12 text-[10px] text-[#c4b5fd]">Socio</span>}
        {p.modalidad && <span className="text-[11px] text-[#8a8a9c]">{p.modalidad}</span>}
        <div className="flex-1" />
        <BadgeVencimiento p={p} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
        <Dato icono={IdCard} label="DNI" valor={p.dni} />
        <Dato icono={IdCard} label="N° REPROCANN" valor={p.reprocann_nro} />
        <Dato icono={KeyRound} label="Código de vinculación" valor={p.codigo_vinculacion} />
        <Dato icono={User} label="Nacimiento" valor={fmtFecha(p.fecha_nacimiento)} />
        <Dato label="Emisión / Vencimiento" valor={`${fmtFecha(p.reprocann_emision)} → ${fmtFecha(p.reprocann_vencimiento)}`} />
        <Dato icono={Phone} label="Teléfono" valor={p.telefono} />
        <Dato icono={Mail} label="Email" valor={p.email} />
        <Dato icono={MapPin} label="Localidad" valor={[p.localidad, p.provincia].filter(Boolean).join(', ')} />
        <Dato icono={MapPin} label="Domicilio" valor={p.domicilio} />
        <Dato icono={Stethoscope} label="Patología / Indicación" valor={p.patologia} />
        <Dato icono={Stethoscope} label="Médico tratante" valor={[p.medico_tratante, p.matricula_medico && `Mat. ${p.matricula_medico}`].filter(Boolean).join(' · ')} />
        <Dato label="Alta en asociación" valor={fmtFecha(p.fecha_alta)} />
        <Dato icono={Sprout} label="Plantas habilitadas" valor={p.plantas_habilitadas != null ? `${usoPlantas} / ${p.plantas_habilitadas} en uso` : null} />
        <Dato icono={Ruler} label="m² habilitados" valor={p.m2_habilitados != null ? `${p.m2_habilitados} m²` : null} />
      </div>
      {p.notas && <div className="mt-2"><Dato label="Notas" valor={p.notas} /></div>}

      {/* Credencial PDF */}
      <div className="mt-4 pt-4 border-t border-[#1f1f2b]">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-2">Credencial REPROCANN</div>
        {p.credencial_url ? (
          cred === 'error' ? (
            <p className="text-[11px] text-[#f0a5a5]">No se pudo abrir la credencial. Recargá la página o volvé a subir el archivo.</p>
          ) : !cred ? (
            <p className="text-[11px] text-[#8a8a9c]">Abriendo la credencial…</p>
          ) : (
            <div>
              <div className="rounded-lg overflow-hidden border border-[#2a2a3a] bg-[#15151d]">
                <iframe src={cred.url} title="Credencial" className="w-full h-[360px]" />
              </div>
              <a href={cred.url} target="_blank" rel="noreferrer" className={`${btnSutil} mt-2`}>
                <ExternalLink className="w-3.5 h-3.5" /> Abrir en pestaña nueva
              </a>
            </div>
          )
        ) : (
          <p className="text-[11px] text-[#8a8a9c]">Sin credencial cargada. Editá la ficha para subir el PDF.</p>
        )}
      </div>

      {/* Plantas asignadas */}
      <div className="mt-4 pt-4 border-t border-[#1f1f2b]">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-2">Plantas en cultivo para este paciente ({plantasPac.length})</div>
        {plantasPac.length === 0 ? (
          <p className="text-[11px] text-[#8a8a9c]">Todavía no hay plantas asignadas. Asigná el paciente desde la planta (Plantas → ver ficha).</p>
        ) : (
          <ul className="space-y-1.5">
            {plantasPac.map(pl => (
              <li key={pl.id} className="flex items-center gap-2 rounded-lg border border-[#1f1f2b] bg-[#0d0d13] px-3 py-2">
                <Sprout className="w-3.5 h-3.5 text-[#bef264] flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-[12px] text-[#ececf1]">{pl.nombre}</span>
                  {pl.codigo && <span className="ml-2 font-mono text-[10px] text-[#8a8a9c]">{pl.codigo}</span>}
                </div>
                <span className="text-[10px] text-[#8a8a9c]">{pl.fase}</span>
                {pl.codigo && <Link to={`/p/${pl.codigo}`}
                  /* El area tocable crece con un pseudo-elemento y no con padding:
                     esto vive en una fila `flex` de 34px y agrandarlo de verdad
                     estiraria el renglon de cada planta. Medía 35x15. */
                  className="relative after:absolute after:-inset-x-2 after:-inset-y-3.5 after:content-[''] sm:after:hidden text-[10px] text-[#bef264] hover:underline flex-shrink-0">Historia</Link>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <button onClick={onEditar} className={`${btnPrimario} flex-1 justify-center`}><Pencil className="w-3.5 h-3.5" /> Editar</button>
        <button onClick={onBorrar} aria-label="Borrar el paciente" title="Borrar el paciente" className="px-3 py-2 min-w-[44px] rounded-lg border border-[#7a2820] bg-[#7a2820]/15 hover:bg-[#7a2820]/25 text-[12px] text-[#ff8a7a] transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </Modal>
  )
}

type FormState = {
  nombre_completo: string; dni: string; fecha_nacimiento: string; telefono: string; email: string
  localidad: string; provincia: string; domicilio: string
  reprocann_nro: string; codigo_vinculacion: string
  reprocann_estado: EstadoReprocann; reprocann_emision: string; reprocann_vencimiento: string
  modalidad: string; patologia: string; medico_tratante: string; matricula_medico: string
  plantas_habilitadas: string; m2_habilitados: string; tope_mensual_g: string
  socio: boolean; fecha_alta: string; notas: string
}

function ModalPaciente({ paciente, prefill = null, padron = [], onCerrar, onGuardado }: {
  paciente: Paciente | null
  prefill?: { nombre_completo: string; dni: string; email: string | null; telefono: string | null } | null
  /** El padrón que ya existe, para avisar antes de crear a alguien dos veces. */
  padron?: Paciente[]
  onCerrar: () => void
  /** Recibe la ficha creada, para que el paso siguiente del flujo sepa cuál es. */
  onGuardado: (creado?: Paciente) => void
}) {
  const hoy = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState<FormState>({
    nombre_completo: paciente?.nombre_completo ?? prefill?.nombre_completo ?? '',
    dni: paciente?.dni ?? prefill?.dni ?? '',
    fecha_nacimiento: paciente?.fecha_nacimiento ?? '',
    telefono: paciente?.telefono ?? prefill?.telefono ?? '',
    email: paciente?.email ?? prefill?.email ?? '', localidad: paciente?.localidad ?? '', provincia: paciente?.provincia ?? '',
    domicilio: paciente?.domicilio ?? '', reprocann_nro: paciente?.reprocann_nro ?? '',
    codigo_vinculacion: paciente?.codigo_vinculacion ?? '',
    reprocann_estado: paciente?.reprocann_estado ?? 'En tramite',
    reprocann_emision: paciente?.reprocann_emision ?? '', reprocann_vencimiento: paciente?.reprocann_vencimiento ?? '',
    modalidad: paciente?.modalidad ?? '', patologia: paciente?.patologia ?? '',
    medico_tratante: paciente?.medico_tratante ?? '', matricula_medico: paciente?.matricula_medico ?? '',
    plantas_habilitadas: paciente?.plantas_habilitadas?.toString() ?? '', m2_habilitados: paciente?.m2_habilitados?.toString() ?? '',
    tope_mensual_g: paciente?.tope_mensual_g?.toString() ?? '',
    socio: paciente?.socio ?? true, fecha_alta: paciente?.fecha_alta ?? hoy, notas: paciente?.notas ?? '',
  })
  const [credencialUrl, setCredencialUrl] = useState<string | null>(paciente?.credencial_url ?? null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(paciente?.foto_url ?? null)
  const [subiendo, setSubiendo] = useState<'pdf' | 'foto' | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  /** Lo que se encontró al revisar la ficha contra el padrón. Vacío = todo bien. */
  const [avisos, setAvisos] = useState<string[]>([])

  // Genérico y no `any`: así el CAMPO decide qué tipo admite. Con `any` se
  // podía poner un texto donde va un número y no lo avisaba nadie.
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    // Si cambia un dato de los que se revisan, el aviso anterior ya no aplica y
    // el botón tiene que volver a chequear en vez de guardar de una.
    if (k === 'dni' || k === 'telefono' || k === 'nombre_completo') setAvisos([])
    setForm(f => ({ ...f, [k]: v }))
  }

  // Autocompletar desde el PDF de la credencial (OCR local). Tambien sube el PDF.
  const autocompletar = async (file: File) => {
    if (file.type !== 'application/pdf') { toast.error('Subí el PDF de la credencial REPROCANN'); return }
    setLeyendo(true)
    try {
      const [d] = await Promise.all([
        leerCredencial(file),
        registroService.subirCredencial(file).then(setCredencialUrl).catch(() => {}),
      ])
      const ESTADOS = ESTADOS_REPROCANN as readonly string[]
      const MODS = MODALIDADES as readonly string[]
      setForm(f => ({
        ...f,
        nombre_completo: d.nombre_completo || f.nombre_completo,
        dni: d.dni || f.dni,
        fecha_nacimiento: /^\d{4}-\d{2}-\d{2}$/.test(d.fecha_nacimiento || '') ? d.fecha_nacimiento! : f.fecha_nacimiento,
        telefono: d.telefono || f.telefono,
        email: d.email || f.email,
        localidad: d.localidad || f.localidad,
        provincia: d.provincia || f.provincia,
        domicilio: d.domicilio || f.domicilio,
        reprocann_nro: d.reprocann_nro || f.reprocann_nro,
        reprocann_estado: (ESTADOS.includes(d.reprocann_estado || '') ? d.reprocann_estado : f.reprocann_estado) as EstadoReprocann,
        reprocann_emision: /^\d{4}-\d{2}-\d{2}$/.test(d.reprocann_emision || '') ? d.reprocann_emision! : f.reprocann_emision,
        reprocann_vencimiento: /^\d{4}-\d{2}-\d{2}$/.test(d.reprocann_vencimiento || '') ? d.reprocann_vencimiento! : f.reprocann_vencimiento,
        modalidad: MODS.includes(d.modalidad || '') ? d.modalidad! : f.modalidad,
        plantas_habilitadas: d.plantas_habilitadas != null && d.plantas_habilitadas !== '' ? String(d.plantas_habilitadas) : f.plantas_habilitadas,
        m2_habilitados: d.m2_habilitados != null && d.m2_habilitados !== '' ? String(d.m2_habilitados) : f.m2_habilitados,
        patologia: d.patologia || f.patologia,
        medico_tratante: d.medico_tratante || f.medico_tratante,
        matricula_medico: d.matricula_medico || f.matricula_medico,
      }))
      toast.success('Datos leídos de la credencial. Revisalos y guardá.')
    } catch (err) {
      toast.error(`No se pudo leer la credencial: ${(err as Error).message}`)
    } finally {
      setLeyendo(false)
    }
  }

  const subirPdf = async (file: File) => {
    if (file.type !== 'application/pdf') { toast.error('La credencial debe ser un PDF'); return }
    setSubiendo('pdf')
    try { setCredencialUrl(await registroService.subirCredencial(file)); toast.success('Credencial cargada') }
    catch (err) { toast.error(`No se pudo subir: ${(err as Error).message}`) }
    finally { setSubiendo(null) }
  }
  const subirFoto = async (file: File) => {
    setSubiendo('foto')
    try { setFotoUrl(await registroService.subirFotoPaciente(file)); toast.success('Foto cargada') }
    catch (err) { toast.error(`No se pudo subir: ${(err as Error).message}`) }
    finally { setSubiendo(null) }
  }

  // `forzar` llega por parámetro y no por estado a propósito: setAvisosConfirmados
  // no habría surtido efecto todavía cuando guardar() lee el valor.
  const guardar = async (forzar = false) => {
    if (!form.nombre_completo.trim()) { toast.error('El nombre es obligatorio'); return }
    // Los mismos controles que el alta automática ya le hace a las solicitudes
    // públicas. Avisan, no bloquean: quien carga a mano puede tener el caso raro
    // delante —dos socios que comparten teléfono y no son la misma persona— y ahí
    // el aviso alcanza. Sin esto entraron 4 duplicados y 5 DNI imposibles.
    if (!forzar) {
      const encontrados = avisosDeFichaNueva(
        { dni: form.dni, telefono: form.telefono, nombre_completo: form.nombre_completo },
        padron, paciente?.id)
      if (encontrados.length) { setAvisos(encontrados); return }
    }
    setGuardando(true)
    const limpio = (s: string) => s.trim() || null
    // Ver la nota del mismo caso en PaginaGeneticas: el alta exige el nombre y
    // el payload ya lo trae; decirlo deja que el compilador lo verifique.
    const payload: Partial<Paciente> & { nombre_completo: string } = {
      nombre_completo: form.nombre_completo.trim(), dni: limpio(form.dni),
      fecha_nacimiento: form.fecha_nacimiento || null, telefono: limpio(form.telefono), email: limpio(form.email),
      localidad: limpio(form.localidad), provincia: limpio(form.provincia), domicilio: limpio(form.domicilio),
      reprocann_nro: limpio(form.reprocann_nro), codigo_vinculacion: limpio(form.codigo_vinculacion),
      reprocann_estado: form.reprocann_estado,
      reprocann_emision: form.reprocann_emision || null, reprocann_vencimiento: form.reprocann_vencimiento || null,
      modalidad: (form.modalidad || null) as Paciente['modalidad'],
      patologia: limpio(form.patologia), medico_tratante: limpio(form.medico_tratante), matricula_medico: limpio(form.matricula_medico),
      plantas_habilitadas: form.plantas_habilitadas.trim() === '' ? null : parseInt(form.plantas_habilitadas),
      m2_habilitados: form.m2_habilitados.trim() === '' ? null : parseFloat(form.m2_habilitados),
      tope_mensual_g: form.tope_mensual_g.trim() === '' ? null : parseFloat(form.tope_mensual_g),
      socio: form.socio, fecha_alta: form.fecha_alta || null, notas: limpio(form.notas),
      credencial_url: credencialUrl, foto_url: fotoUrl,
    }
    try {
      let creado: Paciente | undefined
      if (paciente) { await registroService.actualizarPaciente(paciente.id, payload); toast.success('Ficha actualizada') }
      else { creado = await registroService.crearPaciente(payload); toast.success('Paciente agregado') }
      onGuardado(creado)
    } catch (err) {
      toast.error(`Error: ${(err as Error).message}`); setGuardando(false)
    }
  }

  return (
    <Modal titulo={paciente ? 'Editar ficha' : 'Sumar un paciente'} ancho="max-w-2xl" onCerrar={onCerrar}
      accion={
        <button
          onClick={() => guardar(avisos.length > 0)}
          disabled={guardando}
          className={`${btnPrimario} w-full justify-center`}>
          {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <IdCard className="w-3.5 h-3.5" />}
          {avisos.length > 0
            ? 'Guardar igual'
            : paciente ? 'Guardar cambios' : 'Agregar paciente'}
        </button>
      }>
      <div className="space-y-3">
        {!paciente && <GuiaDelFormulario id="paciente" />}
        {OCR_DISPONIBLE && (
          <label className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed border-[#a78bfa]/40 bg-[#a78bfa]/5 hover:bg-[#a78bfa]/10 transition-colors cursor-pointer ${leyendo ? 'opacity-60 pointer-events-none' : ''}`}>
            {leyendo ? <Loader2 className="w-4 h-4 animate-spin text-[#c4b5fd]" /> : <FileText className="w-4 h-4 text-[#c4b5fd]" />}
            <span className="text-[12px] font-medium text-[#c4b5fd]">
              {leyendo ? 'Leyendo la credencial con IA local…' : 'Subir credencial PDF y autocompletar'}
            </span>
            <input type="file" accept="application/pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) autocompletar(f); e.target.value = '' }} />
          </label>
        )}
        <div>
          <label className={etiquetaCampo}>Nombre completo *</label>
          <input autoFocus className={inputFormulario} placeholder="Juan Pérez" value={form.nombre_completo}
            onChange={e => set('nombre_completo', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={etiquetaCampo}>DNI</label><input className={inputFormulario} {...sinAutocorreccion} placeholder="30.123.456" value={form.dni} onChange={e => set('dni', e.target.value)} /><AyudaCampo id="paciente" campo="DNI" /></div>
          <div><label className={etiquetaCampo}>Nacimiento</label><input type="date" className={inputFormulario} value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={etiquetaCampo}>Teléfono</label><input className={inputFormulario} placeholder="11 5555-5555" value={form.telefono} onChange={e => set('telefono', e.target.value)} /></div>
          <div><label className={etiquetaCampo}>Email</label><input className={inputFormulario} type="email" placeholder="paciente@mail.com" value={form.email} onChange={e => set('email', e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={etiquetaCampo}>Localidad</label><input className={inputFormulario} value={form.localidad} onChange={e => set('localidad', e.target.value)} /></div>
          <div><label className={etiquetaCampo}>Provincia</label><input className={inputFormulario} value={form.provincia} onChange={e => set('provincia', e.target.value)} /></div>
        </div>
        <div><label className={etiquetaCampo}>Domicilio</label><input className={inputFormulario} value={form.domicilio} onChange={e => set('domicilio', e.target.value)} /></div>

        <div className="pt-2 border-t border-[#1f1f2b]"><div className="text-[10px] uppercase tracking-[0.14em] text-[#a78bfa] mb-2">REPROCANN</div></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={etiquetaCampo}>N° de registro</label><input className={inputFormulario} {...sinAutocorreccion} value={form.reprocann_nro} onChange={e => set('reprocann_nro', e.target.value)} /><AyudaCampo id="paciente" campo="N° de registro" /></div>
          {/* EL CODIGO DE VINCULACION ES DE ESTA PERSONA, y va acá porque acá es
              donde se carga: lo saca ella en Mi Argentina y se lo pasa a la
              asociación. Hasta el 02/09/2026 habia UNO SOLO, en la entidad, con
              una ayuda que decia lo contrario —que la ONG se lo daba a la
              gente—. Se corrigió con el circuito publico, que ya lo contaba
              bien. */}
          <div><label className={etiquetaCampo}>Código de vinculación</label>
            <input className={inputFormulario} {...sinAutocorreccion} value={form.codigo_vinculacion}
              onChange={e => set('codigo_vinculacion', e.target.value)} placeholder="El que trae la persona" />
            <p className="mt-1 text-[10.5px] text-[#8a8a9c]">
              Lo saca la persona en REPROCANN y se lo da a la asociación. Sin esto no se la puede vincular.
            </p>
          </div>
          <div><label className={etiquetaCampo}>Estado</label>
            <select className={inputFormulario} value={form.reprocann_estado} onChange={e => set('reprocann_estado', e.target.value as EstadoReprocann)}>
              {ESTADOS_REPROCANN.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={etiquetaCampo}>Emisión</label><input type="date" className={inputFormulario} value={form.reprocann_emision} onChange={e => set('reprocann_emision', e.target.value)} /></div>
          <div><label className={etiquetaCampo}>Vencimiento</label><input type="date" className={inputFormulario} value={form.reprocann_vencimiento} onChange={e => set('reprocann_vencimiento', e.target.value)} /></div>
        </div>

        {/* Si la persona no tiene credencial vigente, el trámite se empieza acá.
            Antes la ficha te pedía «el número de REPROCANN y su estado» y, si no
            lo tenía, no decía qué hacer: la respuesta —el link oficial— vivía en
            otra pantalla. Es el mismo criterio que crear la genética que falta
            sin salir del lote: el momento de resolverlo es cuando aparece.

            ⚠ Esto NO carga nada ni cambia el estado: el trámite lo hace la
            persona en el sitio del Estado, con su médico. Acá sólo se acompaña.
            El número y el estado los pone quien revisa, mirando la credencial. */}
        {form.reprocann_estado !== 'Vigente' && <AyudaReprocann estado={form.reprocann_estado} />}
        <div className="grid grid-cols-2 gap-3">
          <div><label className={etiquetaCampo}>Modalidad</label>
            <select className={inputFormulario} value={form.modalidad} onChange={e => set('modalidad', e.target.value)}>
              <option value="">Sin definir</option>
              {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-[12px] text-[#d4d4dd] cursor-pointer min-h-[44px] sm:min-h-0">
              <input type="checkbox" checked={form.socio} onChange={e => set('socio', e.target.checked)} className="accent-[#a3e635]" />
              Socio de la asociación
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={etiquetaCampo}>Plantas habilitadas</label><input className={inputFormulario} type="number" min="0" placeholder="9" value={form.plantas_habilitadas} onChange={e => set('plantas_habilitadas', e.target.value)} /></div>
          <div><label className={etiquetaCampo}>m² habilitados</label><input className={inputFormulario} type="number" min="0" step="0.5" placeholder="4" value={form.m2_habilitados} onChange={e => set('m2_habilitados', e.target.value)} /></div>
        </div>
        <div>
          <label className={etiquetaCampo}>Tope mensual (g)</label>
          <input className={inputFormulario} type="number" min="0" step="1" placeholder="40"
            value={form.tope_mensual_g} onChange={e => set('tope_mensual_g', e.target.value)} />
          <p className="mt-1 text-[10px] text-[#8a8a9c]">
            Cuántos gramos puede recibir en 30 días. Sin este dato no se puede controlar el cupo
            y las reservas del portal salen sin límite.
          </p>
        <AyudaCampo id="paciente" campo="Tope mensual (g)" /></div>

        <div className="pt-2 border-t border-[#1f1f2b]"><div className="text-[10px] uppercase tracking-[0.14em] text-[#a78bfa] mb-2">Datos médicos (opcional)</div></div>
        <div><label className={etiquetaCampo}>Patología / Indicación</label><input className={inputFormulario} placeholder="Dolor crónico, epilepsia, insomnio..." value={form.patologia} onChange={e => set('patologia', e.target.value)} /><AyudaCampo id="paciente" campo="Patología / Indicación" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={etiquetaCampo}>Médico tratante</label><input className={inputFormulario} value={form.medico_tratante} onChange={e => set('medico_tratante', e.target.value)} /><AyudaCampo id="paciente" campo="Médico tratante" /></div>
          <div><label className={etiquetaCampo}>Matrícula</label><input className={inputFormulario} {...sinAutocorreccion} value={form.matricula_medico} onChange={e => set('matricula_medico', e.target.value)} /></div>
        </div>

        <div className="pt-2 border-t border-[#1f1f2b]"><div className="text-[10px] uppercase tracking-[0.14em] text-[#a78bfa] mb-2">Adjuntos</div></div>
        {MODO_DEMO && <p className="text-[10px] text-[#f59e0b] -mt-1">Modo demo: los archivos quedan en este navegador (límite de tamaño).</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={etiquetaCampo}>Credencial (PDF)</label>
            <label className={`${btnSutil} w-full justify-center cursor-pointer`}>
              {subiendo === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : credencialUrl ? <FileText className="w-3.5 h-3.5 text-[#38bdf8]" /> : <Upload className="w-3.5 h-3.5" />}
              {credencialUrl ? 'PDF cargado' : 'Subir PDF'}
              <input type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirPdf(f) }} />
            </label>
          </div>
          <div>
            <label className={etiquetaCampo}>Foto</label>
            <label className={`${btnSutil} w-full justify-center cursor-pointer`}>
              {subiendo === 'foto' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {fotoUrl ? 'Foto cargada' : 'Subir foto'}
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f) }} />
            </label>
          </div>
        </div>

        <div><label className={etiquetaCampo}>Notas</label><textarea className={inputFormulario} rows={2} value={form.notas} onChange={e => set('notas', e.target.value)} /></div>

        {!paciente && <OjoDelFormulario id="paciente" />}

        {avisos.length > 0 && (
          <div className="rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/[0.07] p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#f59e0b] font-medium">
              {avisos.length === 1 ? 'Revisá esto antes de guardar' : 'Revisá esto antes de guardar'}
            </p>
            <ul className="space-y-1.5">
              {avisos.map((a, i) => (
                <li key={i} className="text-[12px] text-[#d4d4dd] leading-relaxed">• {a}</li>
              ))}
            </ul>
            <p className="text-[11px] text-[#8a8a9c]">
              Si aun así corresponde cargarla, guardá de nuevo y se crea igual.
            </p>
          </div>
        )}

      </div>
    </Modal>
  )
}
