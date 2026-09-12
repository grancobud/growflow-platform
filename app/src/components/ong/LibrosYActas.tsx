// Libros rubricados y actas. Son el soporte jurídico de todo lo que la
// asociación decide: si no está en el acta, legalmente no sucedió.

import { useState, useCallback } from 'react'
import { useAbrirAlLlegar } from '../../lib/useAbrirAlLlegar'
import { useAvanzarFlujo } from '../../lib/useAvanzarFlujo'
import { GuiaDelFormulario, AyudaCampo } from './GuiaDelFormulario'
import { toast } from 'sonner'
import { BookMarked, Plus, Pencil, Trash2, FileText, AlertTriangle, Check } from 'lucide-react'
import {
  ongService, TIPOS_LIBRO, TIPOS_ACTA, ESTADOS_ACTA, ocupacionLibro,
  UMBRAL_RUBRICA_NUEVA, revisarCorrelatividad,
  type Libro, type Acta, type Entidad,
} from '../../lib/ong'
import { btnPrimario, btnSutil, tarjeta, etiquetaCampo, inputFormulario } from '../../lib/ui'
import { Asistentes, VisorActa } from './ActaParaLibro'
import { useDialogo } from '../../lib/useDialogo'
import { confirmarBorrado } from '../../lib/confirmar'


const nombreLibro = (t: string) => TIPOS_LIBRO.find(x => x.id === t)?.nombre ?? t
const nombreActa = (t: string) => TIPOS_ACTA.find(x => x.id === t)?.nombre ?? t
const fmtFecha = (f?: string | null) =>
  f ? new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export function Libros({ libros, onCambio }: { libros: Libro[]; onCambio: () => void }) {
  const [form, setForm] = useState<Partial<Libro> | null>(null)

  // Para que la accion «Dar de alta un libro» abra el formulario.
  const nuevoLibro = useCallback(() => setForm({}), [setForm])
  useAbrirAlLlegar(nuevoLibro, '1', form != null)

  const guardar = async () => {
    if (!form?.tipo) { toast.error('Elegí el tipo de libro'); return }
    try { await ongService.guardarLibro(form); toast.success('Libro guardado'); setForm(null); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }
  const borrar = async (l: Libro) => {
    if (!(await confirmarBorrado(`¿Borrar el registro del libro "${nombreLibro(l.tipo)}"?`))) return
    try { await ongService.borrarLibro(l.id); toast.success('Borrado'); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }

  const faltantes = TIPOS_LIBRO.filter(t => !libros.some(l => l.tipo === t.id))

  return (
    <div className="space-y-4">
      <div className={tarjeta}>
        <div className="flex items-center gap-2 flex-wrap">
          <BookMarked className="w-4 h-4 text-[#a78bfa]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">Libros</h3>
          <span className="text-[12px] font-mono tabular-nums text-[#a6a6b5]">{libros.length} / {TIPOS_LIBRO.length}</span>
          <button onClick={() => setForm({ numero: 1, folios_usados: 0 })} className={`${btnPrimario} flex-shrink-0`}>
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2">
          La rúbrica es la autorización del registro de comercio para usar ese libro. Sin rúbrica, lo que asentás no se
          inscribe en ningún lado. Al <b className="text-[#a6a6b5]">75%</b> de ocupación conviene rubricar el siguiente.
        </p>
        {faltantes.length > 0 && (
          <p className="text-[11px] text-[#f59e0b] mt-2">
            Sin cargar: {faltantes.map(t => t.nombre).join(', ')}.
          </p>
        )}
      </div>

      {libros.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {libros.map(l => {
            const ocup = ocupacionLibro(l)
            const lleno = ocup != null && ocup >= UMBRAL_RUBRICA_NUEVA
            return (
              <div key={l.id} className={tarjeta}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold text-[13px] text-[#ececf1]">
                      {nombreLibro(l.tipo)} <span className="text-[#8a8a9c]">Nº {l.numero ?? 1}</span>
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1"
                        style={l.rubricado
                          ? { color: '#bef264', background: 'rgba(163,230,53,0.12)', borderColor: '#404d20' }
                          : { color: '#ff8a7a', background: 'rgba(122,40,32,0.15)', borderColor: '#7a2820' }}>
                        {l.rubricado ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {l.rubricado ? `Rubricado ${fmtFecha(l.fecha_rubrica)}` : 'Sin rúbrica'}
                      </span>
                      {l.digital && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#38bdf8]/10 text-[#38bdf8] border border-[#1e3a4a]">Digital</span>}
                    </div>
                    {ocup != null && (
                      <div className="mt-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] text-[#8a8a9c]">{l.folios_usados ?? 0} de {l.folios_totales} folios</span>
                          <span className="text-[11px] font-mono tabular-nums" style={{ color: lleno ? '#f59e0b' : '#a6a6b5' }}>
                            {Math.round(ocup * 100)}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-[#1f1f2b] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, ocup * 100)}%`, background: lleno ? '#f59e0b' : '#a3e635' }} />
                        </div>
                        {lleno && <p className="text-[11px] text-[#f59e0b] mt-1">Pasó el 75%: tramitá la rúbrica del siguiente.</p>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setForm(l)} className={btnSutil} aria-label="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => borrar(l)} className={btnSutil} aria-label="Borrar"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {form && (
        <Modal titulo={form.id ? 'Editar libro' : 'Nuevo libro'} onCerrar={() => setForm(null)}>
          {!form.id && <GuiaDelFormulario id="libro" />}
          <div className="space-y-3">
            <label><span className={etiquetaCampo}>Tipo de libro</span>
              <select className={inputFormulario} value={form.tipo ?? ''} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                <option value="">Elegir…</option>
                <optgroup label="Sociales">
                  {TIPOS_LIBRO.filter(t => t.grupo === 'social').map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </optgroup>
                <optgroup label="Contables">
                  {TIPOS_LIBRO.filter(t => t.grupo === 'contable').map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </optgroup>
              </select></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className={etiquetaCampo}>Número de libro</span>
                <input type="number" min={1} className={inputFormulario} value={form.numero ?? 1} onChange={e => setForm({ ...form, numero: +e.target.value })} /></label>
              <label><span className={etiquetaCampo}>Organismo</span>
                <input className={inputFormulario} value={form.organismo ?? ''} onChange={e => setForm({ ...form, organismo: e.target.value })} placeholder="IGJ / DPPJ" /></label>
              <label><span className={etiquetaCampo}>Folios totales</span>
                <input type="number" className={inputFormulario} value={form.folios_totales ?? ''} onChange={e => setForm({ ...form, folios_totales: e.target.value === '' ? null : +e.target.value })} placeholder="200" />
                <AyudaCampo id="libro" campo="Folios totales" /></label>
              <label><span className={etiquetaCampo}>Folios usados</span>
                <input type="number" className={inputFormulario} value={form.folios_usados ?? 0} onChange={e => setForm({ ...form, folios_usados: +e.target.value })} /></label>
              <label><span className={etiquetaCampo}>Fecha de rúbrica</span>
                <input type="date" className={inputFormulario} value={form.fecha_rubrica ?? ''} onChange={e => setForm({ ...form, fecha_rubrica: e.target.value || null })} /></label>
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <Toggle label="Rubricado" v={!!form.rubricado} on={v => setForm({ ...form, rubricado: v })} />
                <AyudaCampo id="libro" campo="Rubricado" />
              </div>
              <Toggle label="Libro digital" v={!!form.digital} on={v => setForm({ ...form, digital: v })} />
            </div>
            <button onClick={guardar} className={`${btnPrimario} w-full justify-center`}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export function Actas({ actas, libros, asociados = [], autoridades = [], entidad = null, onCambio }: {
  actas: Acta[]; libros: Libro[]
  /** Para elegir los asistentes de una lista en vez de tipearlos. */
  asociados?: { nombre: string; activo?: boolean }[]
  autoridades?: { nombre: string; activo?: boolean }[]
  entidad?: Entidad | null
  onCambio: () => void
}) {
  const [form, setForm] = useState<Partial<Acta> | null>(null)

  // Para que la accion «Redactar un acta» abra el formulario.
  //
  // ⚠ Abre por el MISMO camino que el boton de la pantalla, y no con un
  // `setForm({})`. Asi estaba: el formulario llegaba vacio —sin tipo, sin fecha,
  // sin estado y, sobre todo, SIN NUMERO—, con el titulo cortado en «Nueva acta ·»
  // porque el tipo no existia. El numero correlativo hay que mirarlo a mano en el
  // libro justo cuando el sistema ya sabe cual toca: `proximoNumeroActa` existe
  // desde siempre y este camino no la llamaba.
  //
  // Y un numero de acta repetido o salteado es, textual, de las primeras cosas
  // que mira una inspeccion.
  //
  // El tipo es Comision Directiva: es el acta del paso «El alta en acta» de
  // «Sumar a alguien», que es de donde se llega aca. El formulario NO tiene
  // selector de tipo —se fija al abrir, segun por que boton entraste— asi que
  // para un acta de asamblea hay que entrar por su boton en la pantalla. La
  // numeracion es por tipo: cada libro lleva su propia serie.
  const nuevo = useCallback(async (tipo: string) => {
    const numero = await ongService.proximoNumeroActa(tipo)
    setForm({ tipo, numero, fecha: new Date().toISOString().slice(0, 10), estado: 'borrador', quorum_ok: true })
  }, [setForm])
  const nuevaActa = useCallback(() => { void nuevo('cd') }, [nuevo])
  useAbrirAlLlegar(nuevaActa, '1', form != null)
  const avanzar = useAvanzarFlujo()
  const [verTexto, setVerTexto] = useState<Acta | null>(null)
  // Las autoridades primero: son las que hacen quórum en la Comisión Directiva.
  const candidatos = [
    ...autoridades.filter(a => a.activo !== false).map(a => a.nombre),
    ...asociados.filter(a => a.activo !== false).map(a => a.nombre),
  ].filter((n, i, xs) => n && xs.indexOf(n) === i)
  const problemas = revisarCorrelatividad(actas)

  const guardar = async () => {
    if (!form?.tipo || !form?.numero || !form?.fecha) { toast.error('Tipo, número y fecha son obligatorios'); return }
    try {
      await ongService.guardarActa(form)
      toast.success('Acta guardada'); setForm(null); onCambio()
      // Es el ultimo paso de «Sumar a alguien»: la tarea termina y vuelve al panel.
      avanzar()
    }
    catch (e) { toast.error((e as Error).message) }
  }
  const borrar = async (a: Acta) => {
    if (!(await confirmarBorrado(`¿Borrar el acta ${nombreActa(a.tipo)} Nº ${a.numero}?`))) return
    try { await ongService.borrarActa(a.id); toast.success('Borrada'); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="space-y-4">
      <div className={tarjeta}>
        <div className="flex items-center gap-2 flex-wrap">
          <FileText className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Actas</h3>
          <span className="text-[12px] font-mono tabular-nums text-[#a6a6b5]">{actas.length}</span>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2">
          Cada órgano lleva su propia serie correlativa. Pasar un acta de un órgano al libro de otro es uno de los
          errores más observados.
        </p>
        {/* Uno por renglon en el telefono, en fila cuando hay lugar.
            Con `flex-wrap` los cuatro nombres —de «Actas» a «Comision Revisora
            de Cuentas»— caian en tres renglones de anchos distintos, cada uno
            terminando en un lugar. Como grilla arrancan todos en el mismo
            margen y miden lo mismo. */}
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 mt-3">
          {TIPOS_ACTA.map(t => (
            <button key={t.id} onClick={() => nuevo(t.id)} className={`${btnSutil} justify-center sm:justify-start`}>
              <Plus className="w-3.5 h-3.5" /> {t.nombre}
            </button>
          ))}
        </div>
      </div>

      {problemas.length > 0 && (
        <div className="rounded-xl border p-3 sm:p-4" style={{ background: 'rgba(122,40,32,0.10)', borderColor: '#7a2820' }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-[#ff8a7a]" />
            <h4 className="font-display font-semibold text-[13px] text-[#ff8a7a]">Problemas de correlatividad</h4>
          </div>
          <ul className="space-y-1">
            {problemas.map(p => (
              <li key={p.tipo} className="text-[11px] text-[#c4c4d0]">
                <b>{nombreActa(p.tipo)}:</b>
                {p.faltantes.length > 0 && <> faltan las actas {p.faltantes.join(', ')}.</>}
                {p.repetidos.length > 0 && <> números repetidos: {p.repetidos.join(', ')}.</>}
                {p.fueraDeOrden.length > 0 && <> {p.fueraDeOrden.length} con fecha anterior a la del acta previa.</>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {actas.length === 0 ? (
        <p className="text-[13px] text-[#8a8a9c] text-center py-8">Sin actas cargadas.</p>
      ) : (
        <div className="space-y-2">
          {actas.map(a => (
            <div key={a.id} className={tarjeta}>
              <div className="flex items-start gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-[13px] text-[#ececf1]">
                    {nombreActa(a.tipo)} <span className="text-[#d9f99d]">Nº {a.numero}</span>
                    <span className="text-[#8a8a9c] font-normal"> · {fmtFecha(a.fecha)}</span>
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1.5 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded border border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5]">{a.estado}</span>
                    {a.asistentes != null && <span className="px-1.5 py-0.5 rounded border border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5]">{a.asistentes} asistentes</span>}
                    {a.segunda_convocatoria && <span className="px-1.5 py-0.5 rounded border border-[#1e3a4a] bg-[#38bdf8]/10 text-[#38bdf8]">2ª convocatoria</span>}
                    {!a.quorum_ok && <span className="px-1.5 py-0.5 rounded border border-[#7a2820] bg-[#7a2820]/20 text-[#ff8a7a]">sin quórum</span>}
                  </div>
                  {(a.orden_del_dia?.length ?? 0) > 0 && (
                    <ol className="mt-2 space-y-0.5 list-decimal list-inside">
                      {a.orden_del_dia!.map((p, i) => (
                        <li key={i} className="text-[11px] text-[#a6a6b5]">
                          {p.punto}
                          {p.resultado && <span className="ml-1" style={{ color: p.resultado === 'aprobado' ? '#bef264' : p.resultado === 'rechazado' ? '#ff8a7a' : '#8a8a9c' }}>· {p.resultado}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setVerTexto(a)} className={btnSutil}
                    aria-label="Ver el acta redactada para el libro" title="Ver el acta para el libro">
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setForm(a)} className={btnSutil} aria-label="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => borrar(a)} className={btnSutil} aria-label="Borrar"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {verTexto && <VisorActa acta={verTexto} entidad={entidad}
        onEmitido={onCambio} onCerrar={() => setVerTexto(null)} />}

      {form && (
        <Modal titulo={form.id ? `Editar acta Nº ${form.numero}` : `Nueva acta · ${nombreActa(form.tipo ?? '')}`} onCerrar={() => setForm(null)}>
          {!form.id && <GuiaDelFormulario id="acta" />}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label><span className={etiquetaCampo}>Número</span>
                <input type="number" className={inputFormulario} value={form.numero ?? ''} onChange={e => setForm({ ...form, numero: +e.target.value })} />
                <AyudaCampo id="acta" campo="Número" /></label>
              <label><span className={etiquetaCampo}>Fecha</span>
                <input type="date" className={inputFormulario} value={form.fecha ?? ''} onChange={e => setForm({ ...form, fecha: e.target.value })} /></label>
              <label><span className={etiquetaCampo}>Hora inicio</span>
                <input className={inputFormulario} value={form.hora_inicio ?? ''} onChange={e => setForm({ ...form, hora_inicio: e.target.value })} placeholder="19:00" /></label>
              <label><span className={etiquetaCampo}>Hora fin</span>
                <input className={inputFormulario} value={form.hora_fin ?? ''} onChange={e => setForm({ ...form, hora_fin: e.target.value })} placeholder="20:30" /></label>
              <label><span className={etiquetaCampo}>Quórum requerido</span>
                <input type="number" className={inputFormulario} value={form.quorum_requerido ?? ''}
                  onChange={e => setForm({ ...form, quorum_requerido: e.target.value === '' ? null : +e.target.value })} />
                <AyudaCampo id="acta" campo="Quórum requerido" /></label>
              <label><span className={etiquetaCampo}>Estado</span>
                <select className={inputFormulario} value={form.estado ?? 'borrador'} onChange={e => setForm({ ...form, estado: e.target.value })}>
                  {ESTADOS_ACTA.map(s => <option key={s} value={s}>{s}</option>)}
                </select></label>
            </div>
            <label><span className={etiquetaCampo}>Lugar</span>
              <input className={inputFormulario} value={form.lugar ?? ''} onChange={e => setForm({ ...form, lugar: e.target.value })} /></label>
            <label><span className={etiquetaCampo}>Firmantes</span>
              <input className={inputFormulario} value={form.firmantes ?? ''} onChange={e => setForm({ ...form, firmantes: e.target.value })} placeholder="Presidente y Secretario" /></label>
            <label><span className={etiquetaCampo}>Libro donde se asentó</span>
              <select className={inputFormulario} value={form.libro_id ?? ''} onChange={e => setForm({ ...form, libro_id: e.target.value || null })}>
                <option value="">Todavía no</option>
                {libros.map(l => <option key={l.id} value={l.id}>{nombreLibro(l.tipo)} Nº {l.numero ?? 1}</option>)}
              </select></label>
            <div className="flex flex-wrap gap-4">
              <Toggle label="Hubo quórum" v={form.quorum_ok !== false} on={v => setForm({ ...form, quorum_ok: v })} />
              <Toggle label="2ª convocatoria" v={!!form.segunda_convocatoria} on={v => setForm({ ...form, segunda_convocatoria: v })} />
            </div>
            <Asistentes nombres={form.asistentes_nombres ?? []} candidatos={candidatos}
              requerido={form.quorum_requerido ?? null}
              onChange={n => setForm({ ...form, asistentes_nombres: n, asistentes: n.length })} />
            <AyudaCampo id="acta" campo="Asistentes" />

            <OrdenDelDia puntos={form.orden_del_dia ?? []} onChange={p => setForm({ ...form, orden_del_dia: p })} />
            <button onClick={guardar} className={`${btnPrimario} w-full justify-center`}>Guardar acta</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** Cada punto se trata y se vota por separado: así lo pide la norma. */
function OrdenDelDia({ puntos, onChange }: {
  puntos: NonNullable<Acta['orden_del_dia']>
  onChange: (p: NonNullable<Acta['orden_del_dia']>) => void
}) {
  const [txt, setTxt] = useState('')
  return (
    <div>
      <span className={etiquetaCampo}>Orden del día</span>
      <div className="space-y-1.5 mb-2">
        {puntos.map((p, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg bg-[#15151d] border border-[#1f1f2b] px-2.5 py-2">
            <span className="text-[11px] text-[#8a8a9c] font-mono">{i + 1}.</span>
            <span className="text-[12px] text-[#d4d4dd] flex-1 min-w-0 truncate">{p.punto}</span>
            <select value={p.resultado ?? 'pendiente'}
              onChange={e => onChange(puntos.map((x, j) => j === i ? { ...x, resultado: e.target.value as 'aprobado' | 'rechazado' | 'pendiente' } : x))}
              className="text-[11px] bg-[#101016] border border-[#2a2a3a] rounded px-1.5 py-1 text-[#a6a6b5]">
              <option value="pendiente">pendiente</option>
              <option value="aprobado">aprobado</option>
              <option value="rechazado">rechazado</option>
            </select>
            <button onClick={() => onChange(puntos.filter((_, j) => j !== i))}
              className="text-[#8a8a9c] hover:text-[#ff8a7a] min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center" aria-label="Quitar punto">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input className={inputFormulario} value={txt} onChange={e => setTxt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && txt.trim()) { e.preventDefault(); onChange([...puntos, { punto: txt.trim(), resultado: 'pendiente' }]); setTxt('') } }}
          placeholder="Agregar punto y Enter" />
        <button type="button" onClick={() => { if (txt.trim()) { onChange([...puntos, { punto: txt.trim(), resultado: 'pendiente' }]); setTxt('') } }}
          className={btnSutil} aria-label="Agregar el punto" title="Agregar el punto"><Plus className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

function Toggle({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => on(!v)}
      className="inline-flex items-center gap-2 text-[12px] text-[#d4d4dd] min-h-[44px] sm:min-h-0">
      <span className="w-4 h-4 rounded border flex items-center justify-center"
        style={v ? { background: '#a3e635', borderColor: '#a3e635' } : { borderColor: '#2a2a3a' }}>
        {v && <Check className="w-3 h-3 text-[#07070b]" />}
      </span>
      {label}
    </button>
  )
}

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  const refDialogo = useDialogo(onCerrar)
  return (
    <div ref={refDialogo} className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3" onClick={onCerrar}>
      <div className="bg-[#101016] border border-[#2a2a3a] rounded-xl w-full max-w-lg max-h-[85dvh] overflow-y-auto overscroll-contain" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f2b] sticky top-0 bg-[#101016]">
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">{titulo}</h3>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center text-[#8f8f9f] hover:text-[#ececf1] text-lg">×</button>
        </div>
        <div className="p-4">{children}</div>
        <div className="px-4 py-3 border-t border-[#1f1f2b] sticky bottom-0 bg-[#101016]">
          <button onClick={onCerrar} className="w-full min-h-[44px] flex items-center justify-center rounded-lg border border-[#2a2a3a] text-[12px] text-[#a6a6b5] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
