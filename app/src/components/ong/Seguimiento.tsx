// Seguimiento terapéutico (PROMs).
//
// El Libro Diario de Caja vivía acá y se fue a Economía, que es donde alguien
// lo iría a buscar. Ver components/ong/LibroDeCaja.tsx.
//
// El seguimiento es obligación de la ONG, no del paciente: sin los reportes no
// hay informe semestral que presentar, y el Director Médico no tiene con qué
// trabajar. Por eso la entrega siguiente se bloquea si falta el reporte de la
// anterior (RN-05).
//
// Un reporte enviado NO se edita ni se borra (RN-07). La tabla no tiene policies
// de update ni delete, así que la base lo rechaza aunque esta pantalla se
// equivoque: un dato clínico reescrito no sirve como evidencia.

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useAbrirAlLlegar } from '../../lib/useAbrirAlLlegar'
import { useAvanzarFlujo } from '../../lib/useAvanzarFlujo'
import { idDeLaUrl } from '../../lib/contextoDeFlujo'
import { estadoDelSeguimiento, SEGUIMIENTO_EXIGIBLE_DESDE } from '../../lib/estadoDelSeguimiento'
import { ModalFormulario } from './ModalFormulario'
import { Kpi } from './Kpi'
import { toast } from 'sonner'
import {
  Stethoscope, Plus, AlertTriangle, Lock, FileText, Activity,
} from 'lucide-react'
import {
  ongService, feedbackPendiente, EFECTOS_ADVERSOS, ESCALA_ALIVIO,
  semestreActual, finDeSemestre, semestreDe,
  type Dispensa, type FeedbackClinico, type Entidad,
} from '../../lib/ong'
import type { Paciente } from '../../lib/registro'
import { btnPrimario, tarjeta, etiquetaCampo, inputFormulario } from '../../lib/ui'
import { armarInforme, tendencia, redactarInformeSemestral, MINIMO_PARA_TENDENCIA } from '../../lib/informeMedico'
import { VisorDocumento } from './ActaParaLibro'
import { nombreParaMostrar } from '../../lib/buscarPersonas'


export function Seguimiento({ dispensas, feedbacks, pacientes, entidad = null, directorMedico = null, onCambio }: {
  dispensas: Dispensa[]
  feedbacks: FeedbackClinico[]
  pacientes: Paciente[]
  entidad?: Entidad | null
  /** Quién firma el informe: sale del requisito 'director_medico'. */
  directorMedico?: string | null
  onCambio: () => void
}) {
  const [form, setForm] = useState<{ dispensa: Dispensa } | null>(null)

  // El ultimo paso de «Entregarle a un paciente» abre el reporte de la entrega
  // que el flujo viene arrastrando.
  //
  // SOLO de esa: si la URL no trae `?entrega=`, no se abre nada y la pantalla
  // queda en la lista de pendientes. Adivinar «la mas reciente sin reporte»
  // seria comodo y esta mal — un reporte no se puede editar ni borrar una vez
  // guardado, asi que abrirlo sobre la entrega equivocada deja evidencia
  // clinica colgada de una entrega que no es, y sin forma de sacarla.
  const abrirLaDelFlujo = useCallback(() => {
    const id = idDeLaUrl(window.location.search, 'entrega')
    const d = id ? dispensas.find(x => x.id === id) : null
    if (d) setForm({ dispensa: d })
  }, [dispensas])
  useAbrirAlLlegar(abrirLaDelFlujo, '1', form != null)

  /**
   * Llegó el paso del reporte y no sabemos de qué entrega es.
   *
   * Pasaba al avanzar con el botón de la barra —que hasta hoy no arrastraba el
   * `?entrega=`— y sigue pudiendo pasar con una recarga o entrando al flujo por
   * la mitad. El resultado era una pantalla con el «tené a mano», un botón
   * «Terminé» y NINGÚN formulario: nada decía que faltaba elegir la entrega, ni
   * que la lista de abajo era donde se elegía.
   *
   * Se dice, y se dice acá arriba, que es donde la persona está mirando.
   */
  const params = new URLSearchParams(window.location.search)
  const faltaLaEntrega = params.get('flujo') === 'entregar'
    && !idDeLaUrl(window.location.search, 'entrega')

  /**
   * El orden se decide UNA sola vez, al montar.
   *
   * `faltaLaEntrega` se recalcula en cada render leyendo `window.location.search`,
   * y la URL cambia sola: `useAbrirAlLlegar` limpia el `?nueva=`. Si el orden
   * colgara de el, la pantalla se reacomodaria de golpe debajo del dedo.
   */
  const [tareaPrimero] = useState(faltaLaEntrega)

  /**
   * Traer la tarea a la vista, no solamente dibujarla.
   *
   * El aviso vivia dentro de «Seguimiento terapeutico», que va DESPUES del Panel
   * del Director Medico: medido en produccion quedaba a 4836 px con la pagina en
   * scrollTop 0 — cinco pantallas y media abajo. El arreglo anterior lo dio por
   * resuelto porque el nodo estaba en el DOM, y estar en el DOM no es estar a la
   * vista. El `id="pendientes"` que decia servir para «traerla a la vista» no lo
   * usaba nadie: era un ancla muerta.
   *
   * Se scrollea el CONTENEDOR a mano y no con `scrollIntoView`: la app scrollea
   * en un div propio y no en el documento, y ahi `scrollIntoView` no mueve nada
   * (ver PaginaManual.tsx). Se descuenta la cabecera pegajosa, o el aviso queda
   * tapado justo por ella.
   *
   * Se reintenta mientras la seccion no exista —la pantalla llega con spinner y
   * trae los datos despues—, con el mismo techo que `useIrASeccion`.
   */
  useEffect(() => {
    if (!tareaPrimero) return

    // Se CORRIGE hasta que queda quieto, en vez de scrollear una vez.
    //
    // Scrollear apenas el nodo existe no alcanza: el panel de arriba sigue
    // trayendo datos y cambiando de alto despues, asi que el destino se mueve
    // debajo del scroll ya hecho. Medido en produccion a 430 px, el aviso
    // terminaba en top -277 —pasado de largo— mientras que a 375 y 390 caia
    // bien. Es una carrera, y por eso aparecia en un ancho y no en los otros.
    //
    // Se vuelve a medir cada tick y se reacomoda hasta que el desvio es menor a
    // dos pixeles dos veces seguidas.
    let intentos = 0
    let estables = 0
    let cancelado = false

    // Si la persona toca la pantalla, manda ella. Seguir corrigiendo seria
    // pelearle el scroll al dedo.
    const cancelar = () => { cancelado = true }
    window.addEventListener('wheel', cancelar, { passive: true })
    window.addEventListener('touchstart', cancelar, { passive: true })

    const timer = window.setInterval(() => {
      if (cancelado) { window.clearInterval(timer); return }
      const destino = document.getElementById('elegir-entrega')
      const caja = destino?.closest<HTMLElement>('.overflow-y-auto')
      if (destino && caja) {
        const sticky = caja.querySelector<HTMLElement>(':scope > .sticky')
        const margen = (sticky?.offsetHeight ?? 0) + 8
        const desvio = destino.getBoundingClientRect().top
          - caja.getBoundingClientRect().top - margen
        if (Math.abs(desvio) <= 2) {
          if (++estables >= 2) { window.clearInterval(timer); return }
        } else {
          estables = 0
          caja.scrollTo({ top: caja.scrollTop + desvio, behavior: 'auto' })
        }
      }
      if (++intentos >= 40) window.clearInterval(timer)
    }, 100)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('wheel', cancelar)
      window.removeEventListener('touchstart', cancelar)
    }
  }, [tareaPrimero])

  const nombre = (id?: string | null) =>
    (() => { const p = pacientes.find(x => x.id === id); return p ? nombreParaMostrar(p) : 'Sin paciente' })()

  // Entregas sin reporte, que son las que bloquean la siguiente.
  /**
   * Las entregas que DEBEN reporte, no todas las que no lo tienen.
   *
   * Filtraba por «tiene paciente y no tiene reporte» y listaba 1.058 entregas
   * —un anio entero de operacion— cuando la asociacion empezo a registrar el
   * reporte el 24/08/2026. Una lista de mil cosas para hacer que nadie va a
   * hacer, y que ademas no se PUEDE hacer: un reporte dice cuanto alivio dio y
   * que efectos adversos hubo, y eso solo lo sabe quien recibio el material.
   * Reconstruirlo hoy seria inventarlo.
   *
   * `estadoDelSeguimiento` ya resolvia esto y ya lo usaba `feedbackPendiente`
   * para el bloqueo del portal: lo anterior al requisito no esta en falta y
   * lleva su constancia con la fecha. Faltaba aplicarlo aca. Con el corte del
   * 24/08/2026 la lista pasa de 1.058 a 1, y ese 1 es una entrega real que
   * todavia espera su reporte — el circuito sigue vivo para lo que viene.
   */
  const pendientes = useMemo(() =>
    dispensas
      .filter(d => d.paciente_id && estadoDelSeguimiento(d, feedbacks) === 'falta')
      .sort((a, b) => b.fecha.localeCompare(a.fecha)),
  [dispensas, feedbacks])

  /** Las que no se piden porque son anteriores al requisito. Se dicen, no se esconden. */
  const amparadas = useMemo(() =>
    dispensas.filter(d => d.paciente_id
      && estadoDelSeguimiento(d, feedbacks) === 'anterior_al_requisito').length,
  [dispensas, feedbacks])

  // Personas cuya ÚLTIMA entrega no tiene reporte.
  //
  // Decía «con la próxima entrega bloqueada», y eso no era cierto en el
  // mostrador: ahí se avisa y se entrega igual. Sí lo es en el portal, donde el
  // paciente se autogestiona y el catálogo no se le destraba, así que el texto
  // dice exactamente eso y no más.
  const bloqueados = useMemo(() => {
    const ids = [...new Set(dispensas.map(d => d.paciente_id).filter(Boolean))] as string[]
    return ids
      .map(id => ({ id, d: feedbackPendiente(dispensas, feedbacks, id) }))
      .filter(x => x.d) as { id: string; d: Dispensa }[]
  }, [dispensas, feedbacks])

  const alivioPromedio = feedbacks.length
    ? feedbacks.reduce((s, f) => s + f.escala_alivio, 0) / feedbacks.length
    : null
  const conAdversos = feedbacks.filter(f =>
    f.efectos_adversos.some(e => e !== 'Ninguno')).length


  return (
    <div className="flex flex-col gap-4">
      {/* Cuando el flujo llega sin saber de que entrega es el reporte, la tarea
          va PRIMERO: el Panel del Director Medico mide unos 4300 px y dejaba el
          aviso y la lista fuera de alcance. Se reordena con `order` en vez de
          mover el JSX para no desmontar y volver a montar el panel. */}
      <div className={tareaPrimero ? 'order-2' : 'order-1'}>
        <PanelMedico {...{ pacientes, dispensas, feedbacks, entidad, directorMedico, onCambio }} />
      </div>

      {/* ------------------ Seguimiento terapéutico ------------------ */}
      <div className={`${tarjeta} ${tareaPrimero ? 'order-1' : 'order-2'}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <Stethoscope className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Seguimiento terapéutico</h3>
          <span className="text-[11px] text-[#8a8a9c] tabular-nums ml-auto">
            {feedbacks.length} reporte{feedbacks.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2">
          Después de cada entrega el paciente reporta cómo le fue. Es obligación de la ONG llevarlo:
          sin estos reportes no hay informe semestral del director médico que presentar. Una vez enviado,
          el reporte no se puede editar ni borrar.
        </p>

        {feedbacks.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#1f1f2b] auto-rows-fr">
            <Kpi t="Alivio promedio" v={alivioPromedio != null ? `${alivioPromedio.toFixed(1)}/5` : '—'}
              c={alivioPromedio == null ? undefined : alivioPromedio >= 3.5 ? '#bef264' : '#facc15'} />
            <Kpi t="Con efectos adversos" v={`${conAdversos}/${feedbacks.length}`}
              c={conAdversos > 0 ? '#facc15' : '#bef264'} />
            <Kpi t="Entregas sin reporte" v={String(pendientes.length)}
              c={pendientes.length > 0 ? '#ff8a7a' : '#bef264'} />
          </div>
        )}

        {bloqueados.length > 0 && (
          <div className="rounded-lg bg-[#7a2820]/10 border border-[#7a2820] p-2.5 mt-3">
            <p className="flex items-start gap-1.5 text-[11px] text-[#ff8a7a] leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" strokeWidth={1.8} />
              <span>
                {bloqueados.length} paciente{bloqueados.length === 1 ? '' : 's'} con la última entrega
                sin reporte: {bloqueados.map(b => nombre(b.id)).join(', ')}. Se les puede entregar
                en el mostrador; lo que no pueden es reservar solos por el portal.
              </span>
            </p>
          </div>
        )}

        {/* El `id` deja que el paso 3 del flujo traiga esta lista a la vista
            cuando no sabe de qué entrega se trata: en vez de no abrir nada, la
            persona elige a quién le carga el reporte. */}
        {faltaLaEntrega && (
          <div id="elegir-entrega"
            className="rounded-lg bg-[#5a4a20]/15 border border-[#5a4a20] p-2.5 mt-3">
            <p className="flex items-start gap-1.5 text-[11px] text-[#fbbf24] leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" strokeWidth={1.8} />
              <span>
                <b>Elegí de qué entrega es el reporte</b>, en la lista de abajo. El flujo llegó
                hasta acá sin decir cuál, y un reporte no se puede editar ni borrar una vez
                guardado: cargarlo sobre la entrega equivocada no se deshace.
              </span>
            </p>
          </div>
        )}

        {amparadas > 0 && (
          /* Que 1.057 entregas no pidan reporte NO puede quedar mudo: sin esta
             linea la pantalla pasa de mil pendientes a uno y parece que se
             perdieron los datos. Dice cuantas son y desde cuando se pide. */
          <p className="text-[11px] text-[#8a8a9c] mt-3 leading-relaxed">
            {amparadas} entrega{amparadas === 1 ? '' : 's'} anterior{amparadas === 1 ? '' : 'es'} al{' '}
            <b className="text-[#a6a6b5]">{SEGUIMIENTO_EXIGIBLE_DESDE}</b> no piden reporte: es desde
            cuando la asociación lo registra. No están en falta — el reporte no se puede reconstruir
            después, porque lo que dice sólo lo sabe quien recibió el material.
          </p>
        )}

        {pendientes.length > 0 && (
          <div className="mt-3" id="pendientes">
            <div className={etiquetaCampo}>Entregas esperando reporte</div>
            <div className="space-y-1.5">
              {pendientes.slice(0, 8).map(d => (
                <div key={d.id} className="flex items-center gap-2 rounded-lg bg-[#15151d] border border-[#5a4a20] px-3 py-2 min-h-[44px]">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-[#ececf1] truncate">{nombre(d.paciente_id)}</p>
                    <p className="text-[10px] text-[#8a8a9c] tabular-nums">{d.fecha} · {d.gramos} g</p>
                  </div>
                  <button onClick={() => setForm({ dispensa: d })} className={btnPrimario}>
                    <Plus className="w-3.5 h-3.5" /> Cargar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {feedbacks.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#1f1f2b]">
            <div className={etiquetaCampo}>Reportes cargados</div>
            {/* QUE UN REPORTE NO SE EDITA hay que DECIRLO.
                Estaba dicho sólo con el candado de cada fila, que es un ícono de
                12px sin texto, y la pregunta que llegó fue exactamente «dónde se
                modifica». Buscar diez minutos un botón que no existe —y que a
                propósito no existe— es peor que leer una línea. */}
            <p className="text-[11px] text-[#8a8a9c] leading-relaxed mb-2">
              Un reporte cargado <b className="text-[#a6a6b5]">no se edita ni se borra</b>: es lo
              que la persona declaró sobre su tratamiento, y es la base del informe semestral del
              director médico. Si algo quedó mal, cargá el dato corregido en el reporte de la
              entrega siguiente.
            </p>
            <div className="space-y-1.5">
              {feedbacks.slice(0, 10).map(f => {
                const d = dispensas.find(x => x.id === f.dispensa_id)
                const esc = ESCALA_ALIVIO.find(e => e.valor === f.escala_alivio)
                const adversos = f.efectos_adversos.filter(e => e !== 'Ninguno')
                return (
                  <div key={f.id} className="rounded-lg bg-[#15151d] border border-[#1f1f2b] px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] text-[#ececf1]">{nombre(f.paciente_id)}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f2b] text-[#a6a6b5]">
                        Alivio {f.escala_alivio}/5 · {esc?.label}
                      </span>
                      {adversos.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f59e0b]/15 text-[#fbbf24]">
                          {adversos.join(', ')}
                        </span>
                      )}
                      <Lock className="w-3 h-3 text-[#8a8a9c] ml-auto flex-shrink-0"
                        aria-label="Reporte inmutable" />
                    </div>
                    <p className="text-[10px] text-[#8a8a9c] mt-1">
                      {d ? `Entrega del ${d.fecha} · ${d.gramos} g · ` : ''}Dosis usada: {f.dosificacion_real}
                    </p>
                    {f.observaciones && (
                      <p className="text-[11px] text-[#a6a6b5] mt-1 leading-relaxed">{f.observaciones}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {feedbacks.length === 0 && pendientes.length === 0 && (
          <p className="text-[12px] text-[#8a8a9c] text-center py-5">
            Cuando registres dispensas van a aparecer acá para cargar su seguimiento.
          </p>
        )}
      </div>


      {form && (
        <ModalFeedback dispensa={form.dispensa} nombre={nombre(form.dispensa.paciente_id)}
          onCerrar={() => setForm(null)} onCambio={onCambio} />
      )}
    </div>
  )
}

/**
 * La Encuesta de Seguimiento Terapéutico. Se exporta porque el portal la abre
 * también: RN-05 bloquea la reserva cuando falta un reporte, y el bloqueo se
 * tiene que poder destrabar en el mismo lugar donde aparece.
 */
export function ModalFeedback({ dispensa, nombre, onCerrar, onCambio }: {
  dispensa: Dispensa; nombre: string; onCerrar: () => void; onCambio: () => void
}) {
  const avanzar = useAvanzarFlujo()
  const [alivio, setAlivio] = useState(3)
  const [efectos, setEfectos] = useState<string[]>(['Ninguno'])
  const [detalle, setDetalle] = useState('')
  const [dosis, setDosis] = useState('')
  const [obs, setObs] = useState('')

  // "Ninguno" es excluyente: no puede haber ningún efecto y a la vez cefalea.
  const toggleEfecto = (e: string) => {
    if (e === 'Ninguno') { setEfectos(['Ninguno']); return }
    const sin = efectos.filter(x => x !== 'Ninguno')
    setEfectos(sin.includes(e) ? (sin.filter(x => x !== e).length ? sin.filter(x => x !== e) : ['Ninguno'])
                               : [...sin, e])
  }

  const guardar = async () => {
    if (!dosis.trim()) { toast.error('Poné la dosis que usó realmente'); return }
    if (efectos.includes('Otro') && !detalle.trim()) { toast.error('Detallá cuál fue el otro efecto'); return }
    try {
      await ongService.guardarFeedback({
        dispensa_id: dispensa.id, paciente_id: dispensa.paciente_id ?? null,
        escala_alivio: alivio, efectos_adversos: efectos,
        efectos_detalle: detalle.trim() || null,
        dosificacion_real: dosis.trim(), observaciones: obs.trim() || null,
      })
      toast.success('Reporte guardado'); onCerrar(); onCambio()
      // Es el ultimo paso de «Entregarle a un paciente»: la tarea termino y se
      // vuelve al panel, en vez de dejar la barra de pasos colgada arriba de
      // una pantalla donde ya no queda nada por hacer.
      avanzar()
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <ModalFormulario titulo={`Seguimiento · ${nombre}`} onCerrar={onCerrar} onGuardar={guardar}
      aviso="Una vez guardado no se puede editar ni borrar: es la evidencia del seguimiento y va al informe del director médico. Revisalo antes.">
      <p className="text-[11px] text-[#a6a6b5]">
        Entrega del {dispensa.fecha} · {dispensa.gramos} g
      </p>

      <div>
        <span className={etiquetaCampo}>Alivio de los síntomas</span>
        <div className="flex gap-1.5 flex-wrap">
          {ESCALA_ALIVIO.map(e => (
            <button key={e.valor} type="button" onClick={() => setAlivio(e.valor)}
              className="flex-1 min-w-[64px] px-2 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-lg border text-[11px] transition-colors"
              style={alivio === e.valor
                ? { borderColor: '#404d20', background: 'rgba(163,230,53,0.14)', color: '#d9f99d' }
                : { borderColor: '#2a2a3a', background: '#15151d', color: '#a6a6b5' }}>
              <span className="block font-semibold tabular-nums">{e.valor}</span>
              <span className="block text-[10px]">{e.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={etiquetaCampo}>Efectos adversos</span>
        <div className="flex gap-1.5 flex-wrap">
          {EFECTOS_ADVERSOS.map(e => (
            <button key={e} type="button" onClick={() => toggleEfecto(e)}
              className="px-2.5 py-2 sm:py-1 min-h-[44px] sm:min-h-0 rounded-lg border text-[11px] transition-colors"
              style={efectos.includes(e)
                ? { borderColor: '#5a4a20', background: 'rgba(245,158,11,0.14)', color: '#fbbf24' }
                : { borderColor: '#2a2a3a', background: '#15151d', color: '#a6a6b5' }}>
              {e}
            </button>
          ))}
        </div>
      </div>

      {efectos.includes('Otro') && (
        <label><span className={etiquetaCampo}>Cuál</span>
          <input className={inputFormulario} value={detalle} onChange={e => setDetalle(e.target.value)} /></label>
      )}

      <label><span className={etiquetaCampo}>Dosis que usó realmente</span>
        <input className={inputFormulario} value={dosis} onChange={e => setDosis(e.target.value)}
          placeholder="3 gotas cada 8 hs · 0,2 g vaporizado a la noche" /></label>

      <label><span className={etiquetaCampo}>Observaciones sobre su calidad de vida</span>
        <input className={inputFormulario} value={obs} onChange={e => setObs(e.target.value)} /></label>
    </ModalFormulario>
  )
}

// ---------------------------------------------------------------------------
// Panel del Director Médico (CU-07)
//
// Correlaciona lo que vivía en tres lugares separados: el diagnóstico, los lotes
// entregados y lo que el paciente reportó. Esa correlación ES el informe
// semestral que le exigen al director médico.
//
// La app reúne y ordena la evidencia; el dictamen clínico lo pone el
// profesional. Por eso el informe sale con el apartado de dictamen en blanco.
// ---------------------------------------------------------------------------

function PanelMedico({ pacientes, dispensas, feedbacks, entidad, directorMedico, onCambio }: {
  pacientes: Paciente[]; dispensas: Dispensa[]; feedbacks: FeedbackClinico[]
  entidad: Entidad | null; directorMedico: string | null
  /** Para refrescar la lista de Documentos cuando el informe queda archivado. */
  onCambio: () => void
}) {
  const [periodo, setPeriodo] = useState(semestreActual())
  const [verInforme, setVerInforme] = useState(false)
  const inf = useMemo(
    () => armarInforme(periodo, pacientes, dispensas, feedbacks),
    [periodo, pacientes, dispensas, feedbacks])

  // Los semestres que tienen movimiento, para no ofrecer períodos vacíos.
  const periodos = useMemo(() => {
    const ps = new Set(dispensas.filter(d => d.fecha).map(d => semestreDe(d.fecha)))
    ps.add(semestreActual())
    return [...ps].sort().reverse()
  }, [dispensas])

  if (!dispensas.length) return null

  const doc = redactarInformeSemestral(inf, entidad?.razon_social ?? null, directorMedico)

  return (
    <div className={tarjeta}>
      {/* El titulo lleva `flex-1 min-w-0` y el boton NO lleva `ml-auto`.
          Es la trampa 7.12 del traspaso: con `sm:ml-auto` el boton no tiene
          margen en el telefono, cae solo a la segunda fila y queda pegado a la
          izquierda con todo el ancho vacio al lado. `flex-1` en el hermano
          empuja sin `ml-auto` y ademas encoge el titulo antes de que el boton
          tenga que bajar de renglon. Cuando igual baja, baja a ancho completo:
          una fila propia ocupada entera se lee como una decision, media fila
          suelta se lee como un error. */}
      <div className="flex items-center gap-2 flex-wrap">
        <Activity className="w-4 h-4 flex-shrink-0 text-[#f472b6]" strokeWidth={1.8} />
        <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0 truncate">Panel del Director Médico</h3>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)}
          className="flex-shrink-0 px-2 py-1.5 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[12px] text-[#ececf1] min-h-[44px] sm:min-h-0">
          {periodos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={() => setVerInforme(true)} className={`${btnPrimario} w-full sm:w-auto justify-center`}
          disabled={inf.pacientes.length === 0}>
          <FileText className="w-3.5 h-3.5" /> Informe semestral
        </button>
      </div>
      <p className="text-[11px] text-[#8a8a9c] mt-2">
        Cruza el diagnóstico de cada paciente con los lotes que recibió y lo que reportó. Es el informe
        que la autoridad sanitaria le exige al director médico cada seis meses. Cierra el {finDeSemestre(periodo)}.
      </p>

      {inf.pacientes.length === 0 ? (
        <p className="text-[12px] text-[#8a8a9c] text-center py-5">Sin entregas en este período.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#1f1f2b] auto-rows-fr">
            <Kpi t="Pacientes" v={String(inf.pacientes.length)} />
            <Kpi t="Entregas" v={`${inf.totalEntregas} · ${Math.round(inf.totalGramos)} g`} />
            <Kpi t="Cobertura" v={inf.cobertura != null ? `${inf.cobertura.toFixed(0)}%` : '—'}
              c={inf.cobertura == null ? undefined : inf.cobertura >= 90 ? '#bef264' : '#facc15'} />
            <Kpi t="Alivio promedio" v={inf.alivioPromedio != null ? `${inf.alivioPromedio.toFixed(1)}/5` : '—'}
              c={inf.alivioPromedio == null ? undefined : inf.alivioPromedio >= 3.5 ? '#bef264' : '#facc15'} />
          </div>

          <div className="mt-3 space-y-2">
            {inf.pacientes.map(s => {
              const t = tendencia(s.curvaAlivio)
              return (
                <div key={s.paciente.id} className="rounded-lg bg-[#15151d] border border-[#1f1f2b] px-3 py-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] text-[#ececf1]">{nombreParaMostrar(s.paciente)}</span>
                    {s.paciente.patologia && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f2b] text-[#a6a6b5]">
                        {s.paciente.patologia}
                      </span>
                    )}
                    {t && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={t === 'mejora' ? { background: 'rgba(163,230,53,0.14)', color: '#bef264' }
                          : t === 'empeora' ? { background: 'rgba(122,40,32,0.2)', color: '#ff8a7a' }
                          : { background: '#1f1f2b', color: '#a6a6b5' }}>
                        {t === 'mejora' ? 'En mejoría' : t === 'empeora' ? 'En desmejora' : 'Estable'}
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-[#8a8a9c] tabular-nums flex-shrink-0">
                      {s.entregas.length} entrega{s.entregas.length === 1 ? '' : 's'} · {Math.round(s.gramosTotales)} g
                    </span>
                  </div>

                  {/* La curva: cada punto es un reporte, en el orden de las entregas */}
                  {s.curvaAlivio.length > 0 && (
                    <div className="flex items-end gap-1 h-8 mt-2">
                      {s.curvaAlivio.map((v, i) => (
                        <div key={i} className="w-2.5 rounded-t-[3px]" title={`Reporte ${i + 1}: ${v}/5`}
                          style={{ height: `${(v / 5) * 100}%`, background: v >= 4 ? '#bef264' : v >= 3 ? '#a3e635' : '#facc15' }} />
                      ))}
                      <span className="text-[10px] text-[#8a8a9c] ml-1.5 tabular-nums self-center">
                        {s.curvaAlivio.join(' → ')}
                        {!s.tendenciaConfiable && ` · faltan ${MINIMO_PARA_TENDENCIA - s.curvaAlivio.length} para leer tendencia`}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-[#8a8a9c]">
                    {s.efectos.length > 0
                      ? <span className="text-[#fbbf24]">{s.efectos.map(e => `${e.efecto} ×${e.veces}`).join(', ')}</span>
                      : s.reportes.length > 0 && <span>Sin efectos adversos</span>}
                    {s.lotes.length > 0 && <span>Lotes: {s.lotes.join(', ')}</span>}
                    {s.sinReporte > 0 && (
                      <span className="text-[#ff8a7a]">{s.sinReporte} entrega{s.sinReporte === 1 ? '' : 's'} sin reporte</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {verInforme && (
        <VisorDocumento titulo={`Informe semestral ${periodo}`} texto={doc.texto} faltantes={doc.faltantes}
          entidad={entidad}
          onEmitido={onCambio}
          archivo={{ subtipo: 'Informe semestral' }}
          nota={'La app reúne y ordena la evidencia; el dictamen clínico lo pone el profesional. Por eso el ' +
            'apartado del dictamen sale en blanco para completar y firmar.'}
          onCerrar={() => setVerInforme(false)} />
      )}
    </div>
  )
}
