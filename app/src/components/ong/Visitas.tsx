// La pantalla de visitas.
//
// EL REQUISITO REAL ES EL TIEMPO. Esto se carga parado en el mostrador, con
// alguien enfrente, desde un telefono. Si tarda mas de quince segundos no se
// carga, y una tabla vacia es exactamente como mueren estas pantallas.
//
// De ahi todo lo demas: la fecha ya viene puesta, quien atiende ya viene
// puesto, y motivo y resultado son botones de un toque en vez de desplegables.
// La nota libre existe pero va al final y plegada: sirve para el caso raro, no
// para sostener el registro.

import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { DoorOpen, Plus, X, Pencil, Trash2, Search, Loader2 } from 'lucide-react'
import {
  visitasService, resumenVisitas, etiquetaMotivo, etiquetaResultado,
  MOTIVOS, RESULTADOS, nombreDeVisita, esDerivada, type Visita,
} from '../../lib/visitas'
import { confirmarBorrado } from '../../lib/confirmar'
import { useAbrirAlLlegar } from '../../lib/useAbrirAlLlegar'
import { useDialogo } from '../../lib/useDialogo'
import { btnPrimario, btnSutil, tarjeta, rotuloSeccion } from '../../lib/ui'
import { Kpi } from './Kpi'
import { filtrarPersonas, nombreParaMostrar } from '../../lib/buscarPersonas'

const hoyStr = () => new Date().toISOString().slice(0, 10)

const inputCls = 'w-full px-3 py-2 min-h-[44px] rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[13px] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#a3e635]/60'

/** Un boton de eleccion unica. Un toque, sin desplegable. */
function Chip({ activo, onClick, children }: {
  activo: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg border text-[12px] font-medium transition-colors ${
        activo
          ? 'border-[#a3e635]/50 bg-[#a3e635]/10 text-[#d9f99d]'
          : 'border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5] hover:text-[#ececf1]'}`}>
      {children}
    </button>
  )
}

export function Visitas({ visitas, padron, nombreUsuario, onCambio }: {
  visitas: Visita[]
  /** El padron completo, para poder enganchar la visita a una ficha. */
  padron: { id: string; nombre_completo: string }[]
  /** Quien esta usando el sistema: se propone como «atendio». */
  nombreUsuario: string | null
  onCambio: () => void
}) {
  const [form, setForm] = useState<Partial<Visita> | null>(null)
  const [busqueda, setBusqueda] = useState('')
  // CUANTAS FILAS SE DIBUJAN. Al traer el historial esto pasó de 0 a 945 filas
  // de una, y 945 tarjetas en un teléfono es una pantalla que tarda en aparecer
  // y se mueve a los tirones. La lista está ordenada por fecha descendente, así
  // que las primeras son las que alguien vino a mirar.
  const [tope, setTope] = useState(40)

  const nueva = useCallback(() => setForm({
    fecha: hoyStr(), motivo: 'Consulta o informacion', atendio: nombreUsuario ?? '',
  }), [nombreUsuario])
  useAbrirAlLlegar(nueva, '1', form != null)

  const r = useMemo(() => resumenVisitas(visitas, hoyStr()), [visitas])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return visitas
    return visitas.filter(v =>
      nombreDeVisita(v, padron).toLowerCase().includes(q)
      || etiquetaMotivo(v.motivo).toLowerCase().includes(q)
      || (v.notas ?? '').toLowerCase().includes(q))
  }, [visitas, padron, busqueda])

  const borrar = async (v: Visita) => {
    if (!await confirmarBorrado(`¿Borrar la visita de ${nombreDeVisita(v, padron)}?`,
      'La entrega que haya salido de esta visita NO se borra: queda sin la visita detrás.')) return
    try { await visitasService.eliminar(v.id); toast.success('Visita borrada'); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="space-y-3">
      <div className={tarjeta}>
        <div className="flex items-center gap-2 flex-wrap">
          <DoorOpen className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">
            Visitas a la sede
          </h3>
          <button onClick={nueva} className={btnPrimario}>
            <Plus className="w-3.5 h-3.5" /> Visita
          </button>
        </div>
        <p className="text-[11px] text-[#8a8a9c] leading-relaxed mt-2">
          Toda persona que se atiende, se lleve algo o no. Una visita puede terminar en una
          entrega o sólo en información — las dos cuentan como gente atendida.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#1f1f2b] auto-rows-fr">
          <Kpi t="Hoy" v={String(r.hoy)} c="#bef264" />
          <Kpi t="Personas · 30 días" v={String(r.personasMes)} c="#38bdf8" />
          <Kpi t="Primera vez" v={String(r.primeraVez)} c="#a78bfa" />
          <Kpi t="Sin cerrar" v={String(r.sinResultado)} c={r.sinResultado > 0 ? '#f59e0b' : '#bef264'} />
        </div>

        {/* De donde sale el numero que se dice afuera. Una visita deducida de una
            entrega es una inferencia solida -si hubo entrega, la persona vino-
            pero no la vio nadie: el motivo y el resultado los puso el sistema.
            Decirlo es lo que hace que «atendimos N» se pueda defender. */}
        {r.derivadasMes > 0 && (
          <p className="text-[11px] text-[#8a8a9c] mt-2 leading-relaxed">
            {r.derivadasMes} de las {r.mes} de los últimos 30 días {r.derivadasMes === 1 ? 'se dedujo' : 'se dedujeron'} de
            una entrega registrada, no {r.derivadasMes === 1 ? 'la cargó' : 'las cargó'} nadie a mano.
            Van marcadas en la lista.
          </p>
        )}

        {/* Los dos cruces que hacen que esto valga, dichos donde se miran.
            Siguen la leccion de las entregas en cero: un error que no mueve
            ningun agregado no lo detecta ningun cruce que sume. */}
        {r.sinPadron > 0 && (
          <p className="text-[11px] text-[#7dd3fc] mt-2 leading-relaxed">
            {r.sinPadron} persona{r.sinPadron === 1 ? '' : 's'} atendida{r.sinPadron === 1 ? '' : 's'} que
            todavía no {r.sinPadron === 1 ? 'está' : 'están'} en el padrón. No es un error: es a quién
            falta darle el alta.
          </p>
        )}
      </div>

      <div className={tarjeta}>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#6e6e80] absolute left-3 top-1/2 -translate-y-1/2" />
          <input className={`${inputCls} pl-9`} placeholder="Buscar por nombre, motivo o nota"
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>

        {filtradas.length === 0 ? (
          <p className="text-[12px] text-[#8a8a9c] text-center py-6">
            {visitas.length === 0
              ? 'Todavía no hay visitas cargadas. La primera se carga con el botón de arriba.'
              : 'Ninguna visita coincide con la búsqueda.'}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {filtradas.slice(0, tope).map(v => (
              <li key={v.id} className="group rounded-lg border border-[#1f1f2b] bg-[#101016] p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[#ececf1] truncate">
                      {nombreDeVisita(v, padron)}
                      {!v.paciente_id && (
                        <span className="ml-1.5 text-[10px] text-[#7dd3fc]">· sin ficha</span>
                      )}
                      {esDerivada(v) && (
                        <span className="ml-1.5 text-[10px] text-[#8a8a9c]" title="Deducida de una entrega registrada: no la cargó nadie a mano">
                          · deducida
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-[#8a8a9c] mt-0.5">
                      {v.fecha}{v.hora ? ` · ${v.hora.slice(0, 5)}` : ''} · {etiquetaMotivo(v.motivo)}
                      {v.atendio ? ` · atendió ${v.atendio}` : ''}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${v.resultado ? 'text-[#a6a6b5]' : 'text-[#f59e0b]'}`}>
                      {etiquetaResultado(v.resultado)}
                    </p>
                    {v.notas && <p className="text-[11px] text-[#8a8a9c] mt-1 leading-relaxed">{v.notas}</p>}
                  </div>
                  {/* `sm:` ADELANTE a proposito: con `opacity-0` a secas estos
                      controles quedan INVISIBLES en el telefono, porque ahi no
                      hay hover. Ya paso con el timeline y con Ambiente. */}
                  <div className="flex items-center gap-1 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setForm(v)} title="Editar"
                      className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 flex items-center justify-center text-[#8a8a9c] hover:text-[#d9f99d] hover:bg-[#15151d] rounded-lg transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => borrar(v)} title="Borrar"
                      className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 flex items-center justify-center text-[#8a8a9c] hover:text-[#ff8a7a] hover:bg-[#15151d] rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {filtradas.length > tope && (
          <button onClick={() => setTope(t => t + 100)}
            className={`${btnSutil} w-full mt-3 justify-center`}>
            Mostrar 100 más · {filtradas.length - tope} sin mostrar de {filtradas.length}
          </button>
        )}
      </div>

      {form && (
        <ModalVisita visita={form} padron={padron}
          onCerrar={() => setForm(null)}
          onGuardado={() => { setForm(null); onCambio() }} />
      )}
    </div>
  )
}

function ModalVisita({ visita, padron, onCerrar, onGuardado }: {
  visita: Partial<Visita>
  padron: { id: string; nombre_completo: string }[]
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [f, setF] = useState<Partial<Visita>>(visita)
  const [guardando, setGuardando] = useState(false)
  // El atras del telefono cierra el modal. Sin esto te saca de la pantalla
  // entera, porque abrir un modal no cambia el historial.
  const refDialogo = useDialogo(onCerrar)
  // «No está / es nuevo» arranca elegido si la visita no tiene ficha, para que
  // editar una visita de alguien sin padrón no la reescriba como ficha vacía.
  const [esNuevo, setEsNuevo] = useState(!visita.paciente_id && !!visita.id
    ? true : !visita.paciente_id && !visita.id ? false : false)
  const [buscaPadron, setBuscaPadron] = useState('')

  const set = <K extends keyof Visita>(k: K, v: Visita[K]) => setF(x => ({ ...x, [k]: v }))

  const candidatos = useMemo(() => {
    const q = buscaPadron.trim().toLowerCase()
    if (!q) return []
    // Mismo criterio que el resto de la app: cualquier palabra, en cualquier
    // orden. Con `includes` sobre el nombre entero, «peralta ana» no encontraba
    // a «Ana Flor Peralta».
    return filtrarPersonas(padron, q).slice(0, 6)
  }, [padron, buscaPadron])

  const elegido = f.paciente_id ? padron.find(p => p.id === f.paciente_id) : null
  const identificada = !!f.paciente_id || !!(f.nombre_libre ?? '').trim()

  const guardar = async () => {
    if (!identificada) { toast.error('Decí quién vino: elegí la ficha o escribí el nombre'); return }
    if (!f.motivo) { toast.error('Elegí por qué vino'); return }
    setGuardando(true)
    try {
      await visitasService.guardar(f)
      toast.success(f.id ? 'Visita actualizada' : 'Visita registrada')
      onGuardado()
    } catch (e) { toast.error((e as Error).message) }
    finally { setGuardando(false) }
  }

  return (
    <div ref={refDialogo} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onCerrar}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92dvh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#1f1f2b] flex items-center gap-2 flex-shrink-0">
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">
            {f.id ? 'Editar la visita' : 'Nueva visita'}
          </h3>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div>
            <span className={rotuloSeccion}>Quién vino</span>
            <div className="flex gap-2 mt-1.5">
              <Chip activo={!esNuevo} onClick={() => setEsNuevo(false)}>Está en el padrón</Chip>
              {/* Bien a la vista y no escondido: es el caso que la pantalla
                  vino a capturar, la gente que hoy no queda registrada. */}
              <Chip activo={esNuevo} onClick={() => { setEsNuevo(true); set('paciente_id', null) }}>
                No está / es nuevo
              </Chip>
            </div>

            {!esNuevo ? (
              <div className="mt-2">
                {elegido ? (
                  <div className="flex items-center gap-2 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/[0.06] px-3 py-2">
                    <span className="text-[13px] text-[#d9f99d] flex-1 min-w-0 truncate">{nombreParaMostrar(elegido)}</span>
                    <button onClick={() => { set('paciente_id', null); setBuscaPadron('') }} className={btnSutil}>Cambiar</button>
                  </div>
                ) : (
                  <>
                    <input className={inputCls} autoFocus placeholder="Buscar en el padrón por nombre"
                      value={buscaPadron} onChange={e => setBuscaPadron(e.target.value)} />
                    {candidatos.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {candidatos.map(p => (
                          <li key={p.id}>
                            <button onClick={() => { set('paciente_id', p.id); setBuscaPadron('') }}
                              className="w-full text-left px-3 py-2 min-h-[44px] rounded-lg border border-[#2a2a3a] bg-[#15151d] text-[13px] text-[#ececf1] hover:border-[#a3e635]/50 transition-colors">
                              {nombreParaMostrar(p)}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-2">
                <input className={inputCls} autoFocus placeholder="Nombre y apellido"
                  value={f.nombre_libre ?? ''} onChange={e => set('nombre_libre', e.target.value)} />
                <input className={inputCls} placeholder="Teléfono o contacto (opcional)"
                  value={f.contacto ?? ''} onChange={e => set('contacto', e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <span className={rotuloSeccion}>Por qué vino</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {MOTIVOS.map(m => (
                <Chip key={m.valor} activo={f.motivo === m.valor} onClick={() => set('motivo', m.valor)}>
                  {m.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <span className={rotuloSeccion}>En qué terminó</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {RESULTADOS.map(x => (
                <Chip key={x.valor} activo={f.resultado === x.valor}
                  onClick={() => set('resultado', f.resultado === x.valor ? null : x.valor)}>
                  {x.label}
                </Chip>
              ))}
            </div>
            {!f.resultado && (
              <p className="text-[10px] text-[#8a8a9c] mt-1.5">
                Se puede dejar sin cerrar y completarlo después: la visita queda contada igual.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label><span className={rotuloSeccion}>Fecha</span>
              <input type="date" className={inputCls} value={f.fecha ?? hoyStr()}
                onChange={e => set('fecha', e.target.value)} /></label>
            <label><span className={rotuloSeccion}>Atendió</span>
              <input className={inputCls} value={f.atendio ?? ''} placeholder="Quién la atendió"
                onChange={e => set('atendio', e.target.value)} /></label>
          </div>

          <label className="block"><span className={rotuloSeccion}>Nota (opcional)</span>
            <textarea className={`${inputCls} min-h-[72px]`} rows={2}
              placeholder="Lo que no entra en las opciones de arriba"
              value={f.notas ?? ''} onChange={e => set('notas', e.target.value)} /></label>
        </div>

        {/* El boton de guardar va en el PIE FIJO. El modal de pacientes tenia
            «Cerrar» fijo abajo y la accion principal despues de treinta campos de
            scroll: lo unico visible donde uno busca guardar decia Cerrar. */}
        <div className="px-4 py-3 border-t border-[#1f1f2b] flex items-center gap-2 flex-shrink-0">
          <button onClick={onCerrar} className={btnSutil}>Cancelar</button>
          <button onClick={guardar} disabled={guardando || !identificada}
            className={`${btnPrimario} ml-auto disabled:opacity-50`}>
            {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {f.id ? 'Guardar' : 'Registrar visita'}
          </button>
        </div>
      </div>
    </div>
  )
}
