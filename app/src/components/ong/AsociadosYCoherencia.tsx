// Registro de Asociados, categorías del estatuto, cuotas y el tablero que corre
// los mismos cruces que hace una inspección.
//
// Ojo con la distinción: los ASOCIADOS son la estructura societaria (pagan
// cuota, votan). Los que reciben cannabis necesitan REPROCANN vinculado a esta
// ONG. Se superponen pero no son lo mismo, y por eso el vínculo con el paciente
// es opcional.

import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { GuiaDelFormulario } from './GuiaDelFormulario'
import { useAbrirAlLlegar } from '../../lib/useAbrirAlLlegar'
import {
  Users, Plus, Pencil, Trash2, Tags, Coins, ClipboardCheck, Receipt,
  CheckCircle2, AlertTriangle, XCircle, HelpCircle, Check, ArrowRight,
} from 'lucide-react'
import { CadenaDeJustificacion } from './CadenaDeJustificacion'
import type { DatosCadena } from '../../lib/cadenaDeJustificacion'
import { rindePorPlanta } from '../../lib/rindeDeGeneticas'
import { estadoDelAnalisis } from '../../lib/estadoDelAnalisis'
import {
  ongService, chequeosCoherencia, resumenCobranza, periodoActual, DONDE_SE_ARREGLA,
  type Asociado, type CategoriaSocio, type Cuota, type Acta, type Libro,
  type Dispensa, type LoteIngreso, type AsientoCaja,
  loteEsComprado, esSalidaSinPaciente, separarProduccionPropia,
  type Entidad, type Chequeo, type CuotaEmitida,
} from '../../lib/ong'
import type { Paciente } from '../../lib/registro'
import { btnPrimario, btnSutil, tarjeta, etiquetaCampo, inputFormulario } from '../../lib/ui'
import { useDialogo } from '../../lib/useDialogo'
import { confirmarBorrado } from '../../lib/confirmar'
import { Kpi } from './Kpi'
import { SelectorPersona } from './SelectorPersona'

const fmtPesos = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

export function Asociados({ asociados, categorias, cuotas, actas, pacientes, cuotasEmitidas, onCambio }: {
  asociados: Asociado[]; categorias: CategoriaSocio[]; cuotas: Cuota[]
  actas: Acta[]; pacientes: Paciente[]; cuotasEmitidas: CuotaEmitida[]; onCambio: () => void
}) {
  const [form, setForm] = useState<Partial<Asociado> | null>(null)

  // Para que la accion «Dar de alta un asociado» abra el formulario al llegar.
  // Estaba la guia adentro del modal pero no lo que abre el modal: la accion
  // dejaba en la lista, que es de donde veniamos.
  const nuevoAsociado = useCallback(() => setForm({ activo: true }), [setForm])
  useAbrirAlLlegar(nuevoAsociado, '1', form != null)
  const [cat, setCat] = useState<Partial<CategoriaSocio> | null>(null)
  const [cuo, setCuo] = useState<Partial<Cuota> | null>(null)

  const guardar = async () => {
    if (!form?.nombre) { toast.error('El nombre es obligatorio'); return }
    try { await ongService.guardarAsociado(form); toast.success('Asociado guardado'); setForm(null); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }
  const borrar = async (a: Asociado) => {
    if (!(await confirmarBorrado(`¿Borrar a ${a.nombre} del registro de asociados?`))) return
    try { await ongService.borrarAsociado(a.id); toast.success('Borrado'); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }

  const activos = asociados.filter(a => a.activo !== false)

  return (
    <div className="space-y-4">
      {/* Categorías del estatuto */}
      <div className={tarjeta}>
        <div className="flex items-center gap-2 flex-wrap">
          <Tags className="w-4 h-4 text-[#c4b5fd]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">Categorías del estatuto</h3>
          <button onClick={() => setCat({ con_voto: true })} className={`${btnSutil} flex-shrink-0`}><Plus className="w-3.5 h-3.5" /> Agregar</button>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2">
          Cargalas tal como figuran en el estatuto. Usar una categoría que no existe ahí es uno de los errores que más
          observan. No todas requieren REPROCANN: puede haber socios sólo para eventos o talleres.
        </p>
        {/* Una por renglon en el telefono, y los distintivos alineados.
            Con `flex-wrap` cada categoria medía lo que medía su texto: «Nivel 1
            - Estandar» terminaba en un lugar, «Nivel 2 - Intermedio» en otro y
            «Nivel 3 - Frecuente» en un tercero, las tres arrancando igual y
            terminando distinto. Como grilla miden lo mismo, y el `flex-1` del
            nombre manda REPROCANN y «sin voto» al margen derecho, asi que los
            distintivos forman una columna en vez de quedar donde los deja el
            largo del nombre. */}
        {categorias.length > 0 && (
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 mt-3">
            {categorias.map(c => (
              <button key={c.id} onClick={() => setCat(c)}
                className="flex items-center gap-1.5 text-left text-[11px] px-2.5 py-1.5 rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:border-[#404d20] text-[#d4d4dd] min-h-[44px] sm:min-h-0">
                <span className="flex-1 min-w-0 truncate sm:flex-none">{c.nombre}</span>
                {c.requiere_reprocann && <span className="flex-shrink-0 text-[10px] text-[#bef264]">REPROCANN</span>}
                {!c.con_voto && <span className="flex-shrink-0 text-[10px] text-[#8a8a9c]">sin voto</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cuotas */}
      <div className={tarjeta}>
        <div className="flex items-center gap-2 flex-wrap">
          <Coins className="w-4 h-4 text-[#facc15]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">Cuotas</h3>
          <button onClick={() => setCuo({ tipo: 'social' })} className={`${btnSutil} flex-shrink-0`}><Plus className="w-3.5 h-3.5" /> Agregar</button>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2">
          Hay dos y conviene no mezclarlas: la <b className="text-[#a6a6b5]">social</b> (pertenencia) y la
          de <b className="text-[#a6a6b5]">cultivo</b> (prorrateo de costos). Ninguna es una venta. El valor tiene que
          estar aprobado en un acta: una charla informal no sirve como prueba.
        </p>
        {cuotas.length > 0 && (
          <div className="space-y-1.5 mt-3">
            {cuotas.map(c => {
              const acta = actas.find(a => a.id === c.acta_id)
              return (
                <button key={c.id} onClick={() => setCuo(c)}
                  className="w-full text-left rounded-lg bg-[#15151d] border border-[#1f1f2b] px-3 py-2 hover:border-[#404d20] min-h-[44px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] text-[#ececf1]">{c.categoria || 'Todas las categorías'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f2b] text-[#a6a6b5]">{c.tipo ?? 'social'}</span>
                    <span className="w-full sm:w-auto sm:ml-auto mt-1 sm:mt-0 text-[15px] sm:text-[13px] font-mono tabular-nums text-[#d9f99d]">{fmtPesos(c.valor)}</span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: acta ? '#8a8a9c' : '#ff8a7a' }}>
                    {acta ? `Aprobada en acta Nº ${acta.numero} del ${acta.fecha}` : 'Sin acta que la apruebe'}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Cobranza del período: el cruce que más observan */}
      <Cobranza {...{ asociados, cuotas, cuotasEmitidas, onCambio }} />

      {/* Registro de asociados */}
      <div className={tarjeta}>
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">Registro de Asociados</h3>
          <span className="text-[12px] font-mono tabular-nums text-[#a6a6b5]">{activos.length} activos</span>
          <button onClick={() => setForm({ activo: true })} className={`${btnPrimario} flex-shrink-0`}><Plus className="w-3.5 h-3.5" /> Agregar</button>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2">
          Los primeros son los fundadores. El alta se aprueba primero en acta de Comisión Directiva y recién después se
          vuelca acá: los dos registros tienen que coincidir siempre.
        </p>
      </div>

      {asociados.length === 0 ? (
        <p className="text-[13px] text-[#8a8a9c] text-center py-8">Sin asociados cargados.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {asociados.map(a => {
            const acta = actas.find(x => x.id === a.acta_alta_id)
            return (
              <div key={a.id} className={tarjeta}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold text-[13px] text-[#ececf1] truncate">
                      {a.nombre} {a.fundador && <span className="text-[10px] text-[#facc15]">fundador</span>}
                    </p>
                    <p className="text-[11px] text-[#8a8a9c] mt-0.5">{a.categoria || 'Sin categoría'}{a.dni ? ` · DNI ${a.dni}` : ''}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {a.vinculado_reprocann
                        ? <Mini ok txt="Vinculado en REPROCANN" />
                        : <Mini txt="Sin vincular" />}
                      {acta ? <Mini ok txt={`Alta en acta Nº ${acta.numero}`} /> : !a.fundador && <Mini txt="Alta sin acta" alerta />}
                      {a.activo === false && <Mini txt="Baja" alerta />}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setForm(a)} className={btnSutil} aria-label="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => borrar(a)} className={btnSutil} aria-label="Borrar"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {form && (
        <Modal titulo={form.id ? 'Editar asociado' : 'Nuevo asociado'} onCerrar={() => setForm(null)}>
          <div className="space-y-3">
            {!form.id && <GuiaDelFormulario id="asociado" />}
            <div className="grid grid-cols-2 gap-2">
              <label><span className={etiquetaCampo}>Nombre</span>
                <input className={inputFormulario} value={form.nombre ?? ''} onChange={e => setForm({ ...form, nombre: e.target.value })} /></label>
              <label><span className={etiquetaCampo}>DNI</span>
                <input className={inputFormulario} value={form.dni ?? ''} onChange={e => setForm({ ...form, dni: e.target.value })} /></label>
            </div>
            <label><span className={etiquetaCampo}>Categoría</span>
              <select className={inputFormulario} value={form.categoria ?? ''} onChange={e => setForm({ ...form, categoria: e.target.value || null })}>
                <option value="">Sin categoría</option>
                {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
              {categorias.length === 0 && <span className="text-[10px] text-[#f59e0b]">Cargá primero las categorías del estatuto.</span>}
            </label>
            <label><span className={etiquetaCampo}>Paciente vinculado (opcional)</span>
              <SelectorPersona personas={pacientes} valor={form.paciente_id}
                placeholder="Buscar, o dejar vacío si no es paciente de la ONG…"
                onElegir={id => setForm({ ...form, paciente_id: id })} /></label>
            <label><span className={etiquetaCampo}>Acta que aprobó el alta</span>
              <select className={inputFormulario} value={form.acta_alta_id ?? ''} onChange={e => setForm({ ...form, acta_alta_id: e.target.value || null })}>
                <option value="">Sin acta</option>
                {actas.filter(a => a.tipo === 'cd').map(a => <option key={a.id} value={a.id}>CD Nº {a.numero} · {a.fecha}</option>)}
              </select></label>
            <div className="grid grid-cols-2 gap-2">
              <label><span className={etiquetaCampo}>Fecha de alta</span>
                <input type="date" className={inputFormulario} value={form.fecha_alta ?? ''} onChange={e => setForm({ ...form, fecha_alta: e.target.value || null })} /></label>
              <label><span className={etiquetaCampo}>Vinculación REPROCANN</span>
                <input type="date" className={inputFormulario} value={form.fecha_vinculacion ?? ''} onChange={e => setForm({ ...form, fecha_vinculacion: e.target.value || null })} /></label>
            </div>
            <div className="flex flex-wrap gap-4">
              <Toggle label="Activo" v={form.activo !== false} on={v => setForm({ ...form, activo: v })} />
              <Toggle label="Fundador" v={!!form.fundador} on={v => setForm({ ...form, fundador: v })} />
              <Toggle label="Vinculado en REPROCANN" v={!!form.vinculado_reprocann} on={v => setForm({ ...form, vinculado_reprocann: v })} />
            </div>
            <button onClick={guardar} className={`${btnPrimario} w-full justify-center`}>Guardar</button>
          </div>
        </Modal>
      )}

      {cat && (
        <Modal titulo={cat.id ? 'Editar categoría' : 'Nueva categoría'} onCerrar={() => setCat(null)}>
          <div className="space-y-3">
            <label><span className={etiquetaCampo}>Nombre (como figura en el estatuto)</span>
              <input className={inputFormulario} value={cat.nombre ?? ''} onChange={e => setCat({ ...cat, nombre: e.target.value })} placeholder="Activo / Adherente / Honorario" /></label>
            <div className="flex flex-wrap gap-4">
              <Toggle label="Requiere REPROCANN" v={!!cat.requiere_reprocann} on={v => setCat({ ...cat, requiere_reprocann: v })} />
              <Toggle label="Con voz y voto" v={cat.con_voto !== false} on={v => setCat({ ...cat, con_voto: v })} />
            </div>
            <div className="flex gap-2">
              <button onClick={async () => {
                if (!cat.nombre) { toast.error('El nombre es obligatorio'); return }
                try { await ongService.guardarCategoria(cat); toast.success('Categoría guardada'); setCat(null); onCambio() }
                catch (e) { toast.error((e as Error).message) }
              }} className={`${btnPrimario} flex-1 justify-center`}>Guardar</button>
              {cat.id && <button onClick={async () => {
                if (!(await confirmarBorrado(`¿Borrar la categoría "${cat.nombre}"?`))) return
                try { await ongService.borrarCategoria(cat.id!); setCat(null); onCambio() } catch (e) { toast.error((e as Error).message) }
              }} className={btnSutil}><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        </Modal>
      )}

      {cuo && (
        <Modal titulo={cuo.id ? 'Editar cuota' : 'Nueva cuota'} onCerrar={() => setCuo(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label><span className={etiquetaCampo}>Tipo</span>
                <select className={inputFormulario} value={cuo.tipo ?? 'social'} onChange={e => setCuo({ ...cuo, tipo: e.target.value })}>
                  <option value="social">Social (pertenencia)</option>
                  <option value="cultivo">Cultivo (prorrateo de costos)</option>
                </select></label>
              <label><span className={etiquetaCampo}>Valor</span>
                <input type="number" className={inputFormulario} value={cuo.valor ?? ''} onChange={e => setCuo({ ...cuo, valor: +e.target.value })} /></label>
            </div>
            <label><span className={etiquetaCampo}>Categoría (vacío = todas)</span>
              <select className={inputFormulario} value={cuo.categoria ?? ''} onChange={e => setCuo({ ...cuo, categoria: e.target.value || null })}>
                <option value="">Todas</option>
                {categorias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select></label>
            <label><span className={etiquetaCampo}>Acta que la aprobó</span>
              <select className={inputFormulario} value={cuo.acta_id ?? ''} onChange={e => setCuo({ ...cuo, acta_id: e.target.value || null })}>
                <option value="">Sin acta</option>
                {actas.map(a => <option key={a.id} value={a.id}>Nº {a.numero} · {a.fecha}</option>)}
              </select></label>
            <label><span className={etiquetaCampo}>Vigente desde</span>
              <input type="date" className={inputFormulario} value={cuo.vigente_desde ?? ''} onChange={e => setCuo({ ...cuo, vigente_desde: e.target.value || null })} /></label>
            <div className="flex gap-2">
              <button onClick={async () => {
                if (!cuo.valor) { toast.error('Cargá el valor'); return }
                try { await ongService.guardarCuota(cuo); toast.success('Cuota guardada'); setCuo(null); onCambio() }
                catch (e) { toast.error((e as Error).message) }
              }} className={`${btnPrimario} flex-1 justify-center`}>Guardar</button>
              {cuo.id && <button onClick={async () => {
                try { await ongService.borrarCuota(cuo.id!); setCuo(null); onCambio() } catch (e) { toast.error((e as Error).message) }
              }} className={btnSutil}><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/**
 * Emisión y cobro de la cuota del período. Sin esto no se puede hacer el cruce
 * que más observaciones genera: asociados registrados contra ingresos por
 * cuotas sociales.
 */
function Cobranza({ asociados, cuotas, cuotasEmitidas, onCambio }: {
  asociados: Asociado[]; cuotas: Cuota[]; cuotasEmitidas: CuotaEmitida[]; onCambio: () => void
}) {
  const [periodo, setPeriodo] = useState(periodoActual())
  const [emitiendo, setEmitiendo] = useState(false)
  const [emit, setEmit] = useState<Partial<CuotaEmitida> | null>(null)
  const r = useMemo(() => resumenCobranza(periodo, cuotasEmitidas, asociados), [periodo, cuotasEmitidas, asociados])
  const delPeriodo = cuotasEmitidas.filter(e => e.periodo === periodo)
  const nombre = (id?: string | null) => asociados.find(a => a.id === id)?.nombre ?? '—'

  const emitir = async () => {
    setEmitiendo(true)
    try {
      const n = await ongService.emitirCuotasDelPeriodo(periodo, asociados, cuotas, cuotasEmitidas)
      toast[n > 0 ? 'success' : 'info'](
        n > 0 ? `${n} cuota${n === 1 ? '' : 's'} emitida${n === 1 ? '' : 's'}` : 'No quedaban cuotas por emitir')
      onCambio()
    } catch (e) { toast.error((e as Error).message) } finally { setEmitiendo(false) }
  }
  const togglePago = async (c: CuotaEmitida) => {
    try {
      await ongService.guardarCuotaEmitida({
        id: c.id, pagada: !c.pagada,
        fecha_pago: !c.pagada ? new Date().toISOString().slice(0, 10) : null,
      })
      onCambio()
    } catch (e) { toast.error((e as Error).message) }
  }
  const borrarEmitida = async (c: CuotaEmitida, luego?: () => void) => {
    if (!(await confirmarBorrado(`¿Borrar la cuota de ${nombre(c.asociado_id)} del período ${c.periodo}?`))) return
    try { await ongService.borrarCuotaEmitida(c.id); toast.success('Borrada'); luego?.(); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className={tarjeta}>
      <div className="flex items-center gap-2 flex-wrap">
        <Receipt className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
        <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">Cobranza del período</h3>
        <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[12px] text-[#ececf1] min-h-[44px] sm:min-h-0" />
        {/* A ancho completo cuando baja de renglon: con el titulo y el mes ya
            ocupando la primera fila, este boton caia solo, pegado a la izquierda
            y con todo el ancho vacio al lado. */}
        <button onClick={emitir} disabled={emitiendo || asociados.length === 0}
          className={`${btnPrimario} w-full sm:w-auto justify-center`}>
          <Plus className="w-3.5 h-3.5" /> Emitir a los activos
        </button>
      </div>
      <p className="text-[11px] text-[#8a8a9c] mt-2">
        Lo que un control cruza: cuántos asociados figuran registrados contra cuántas cuotas ingresaron.
        Si alguien figura como asociado, tiene que tener su cuota.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#1f1f2b] auto-rows-fr">
        <Kpi t="Activos" v={String(r.asociadosActivos)} c="#a6a6b5" />
        <Kpi t="Emitidas" v={String(r.emitidas)} c={r.sinEmitir > 0 ? '#ff8a7a' : '#d9f99d'} />
        <Kpi t="Cobradas" v={`${r.pagadas}/${r.emitidas}`} c="#bef264" />
        <Kpi t="Ingresado" v={fmtPesos(r.montoCobrado)} c="#facc15" />
      </div>
      {r.sinEmitir > 0 && (
        <p className="text-[11px] text-[#ff8a7a] mt-2">
          {r.sinEmitir} asociado{r.sinEmitir === 1 ? '' : 's'} activo{r.sinEmitir === 1 ? '' : 's'} sin cuota emitida en este período.
        </p>
      )}
      {cuotas.length === 0 && (
        <p className="text-[11px] text-[#f59e0b] mt-2">
          Cargá primero el valor de la cuota (aprobado en acta) para poder emitirlas.
        </p>
      )}

      {delPeriodo.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {delPeriodo.map(c => (
            <div key={c.id}
              className="flex items-center gap-2 rounded-lg bg-[#15151d] border border-[#1f1f2b] px-2 sm:px-3 py-2 min-h-[44px]">
              {/* El toggle de pago es lo que más se usa: queda en el cuerpo de la fila */}
              <button onClick={() => togglePago(c)} className="flex items-center gap-2 flex-1 min-w-0 text-left self-stretch min-h-[40px]"
                aria-label={c.pagada ? 'Marcar como impaga' : 'Marcar como pagada'}>
                <span className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                  style={c.pagada ? { background: '#a3e635', borderColor: '#a3e635' } : { borderColor: '#2a2a3a' }}>
                  {c.pagada && <Check className="w-3 h-3 text-[#07070b]" />}
                </span>
                <span className="text-[12px] text-[#ececf1] truncate">{nombre(c.asociado_id)}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f2b] text-[#a6a6b5] flex-shrink-0">{c.tipo}</span>
                <span className="ml-auto text-[12px] font-mono tabular-nums flex-shrink-0"
                  style={{ color: c.pagada ? '#bef264' : '#8a8a9c' }}>{fmtPesos(c.monto)}</span>
              </button>
              <button onClick={() => setEmit(c)} className={btnSutil} aria-label="Editar cuota"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => borrarEmitida(c)} className={btnSutil} aria-label="Borrar cuota"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {emit && (
        <Modal titulo={`Cuota de ${nombre(emit.asociado_id)}`} onCerrar={() => setEmit(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label><span className={etiquetaCampo}>Período</span>
                <input type="month" className={inputFormulario} value={emit.periodo ?? ''}
                  onChange={e => setEmit({ ...emit, periodo: e.target.value })} /></label>
              <label><span className={etiquetaCampo}>Monto</span>
                <input type="number" className={inputFormulario} value={emit.monto ?? ''}
                  onChange={e => setEmit({ ...emit, monto: +e.target.value })} /></label>
              <label><span className={etiquetaCampo}>Tipo</span>
                <select className={inputFormulario} value={emit.tipo ?? 'social'} onChange={e => setEmit({ ...emit, tipo: e.target.value })}>
                  <option value="social">social</option>
                  <option value="cultivo">cultivo</option>
                </select></label>
              <label><span className={etiquetaCampo}>Fecha de pago</span>
                <input type="date" className={inputFormulario} value={emit.fecha_pago ?? ''}
                  onChange={e => setEmit({ ...emit, fecha_pago: e.target.value || null })} /></label>
            </div>
            <label><span className={etiquetaCampo}>Medio de pago</span>
              <input className={inputFormulario} value={emit.medio ?? ''} placeholder="Efectivo / transferencia"
                onChange={e => setEmit({ ...emit, medio: e.target.value })} /></label>
            <label><span className={etiquetaCampo}>Notas</span>
              <input className={inputFormulario} value={emit.notas ?? ''}
                onChange={e => setEmit({ ...emit, notas: e.target.value })} /></label>
            <Toggle label="Pagada" v={!!emit.pagada} on={v => setEmit({ ...emit, pagada: v })} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={async () => {
              try { await ongService.guardarCuotaEmitida(emit); toast.success('Cuota actualizada'); setEmit(null); onCambio() }
              catch (e) { toast.error((e as Error).message) }
            }} className={`${btnPrimario} flex-1`}>Guardar</button>
            <button onClick={() => borrarEmitida(emit as CuotaEmitida, () => setEmit(null))} className={btnSutil}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}


// ===================== COHERENCIA =====================

const ICONO: Record<Chequeo['estado'], { Ic: typeof CheckCircle2; color: string; label: string }> = {
  ok: { Ic: CheckCircle2, color: '#bef264', label: 'En regla' },
  alerta: { Ic: AlertTriangle, color: '#f59e0b', label: 'Atención' },
  error: { Ic: XCircle, color: '#ff8a7a', label: 'Observable' },
  sin_datos: { Ic: HelpCircle, color: '#8a8a9c', label: 'Sin datos' },
}

/**
 * Con fallback aunque el estado sea una unión de TypeScript y no venga de la
 * base: los cruces se agregan seguido —hoy entraron tres— y un estado nuevo sin
 * su entrada acá deja la pantalla de Coherencia en blanco justo cuando alguien
 * la está mirando para una inspección.
 */
const iconoChequeo = (e: Chequeo['estado']) => ICONO[e] ?? ICONO.sin_datos

export function Coherencia(props: {
  entidad: Entidad | null; actas: Acta[]; libros: Libro[]; asociados: Asociado[]
  categorias: CategoriaSocio[]; cuotas: Cuota[]; pacientes: number; plantasFloracion: number
  /** Para la cadena que justifica el cultivo. */
  gramosCosechados?: number
  /** Los lotes, con su origen: de aca sale si el material comprado tiene respaldo. */
  lotes?: LoteIngreso[]
  dispensas?: Dispensa[]
  caja?: AsientoCaja[]
  /**
   * Los pagos a proveedor y la fecha de corte, para el cruce `pagos_sin_asiento`.
   *
   * ⚠ ESTE COMPONENTE ARMA SU PROPIA LISTA con `chequeosCoherencia(props)`, no
   * usa la que calcula `PaginaONG` para los contadores. Un dato que se le pasa a
   * una y no a la otra deja el cruce fuera de la pantalla sin ningun error: pasó
   * el 01/09/2026 y costó media hora encontrarlo. Al agregar un cruce que
   * necesite un dato nuevo, hay que pasarlo en LOS DOS lugares.
   */
  pagosProveedor?: { id: string; proveedor: string; fecha: string; monto: number }[]
  fechaCorte?: string | null
  /** Para sacar el rinde esperado de la ficha de cada variedad. */
  plantas?: { genetica_id?: string | null; fase?: string | null }[]
  geneticas?: { id: string; rendimiento_g?: string | null }[]
  /**
   * Los saldos con proveedores: lo que se debe tambien es costo.
   *
   * Lleva el `proveedor` porque hay que poder sacar la produccion propia: lo
   * que la asociacion se «compra» a si misma no se le debe a nadie.
   */
  saldos?: { proveedor?: string | null; saldo?: number | string | null }[]
}) {
  const chequeos = chequeosCoherencia(props)
  const errores = chequeos.filter(c => c.estado === 'error').length
  const alertas = chequeos.filter(c => c.estado === 'alerta').length

  // La cadena entera, que es el marco que ordena a los chequeos sueltos.
  //
  // El material COMPRADO se cuenta aparte del cosechado a proposito: es el
  // eslabon que se corta cuando los socios terminan justificando una compra en
  // vez de un cultivo.
  const enGramos = (u?: string | null) => !u || u === 'g' || u === 'gramos'
  const datosCadena: DatosCadena = {
    sociosVinculados: props.pacientes,
    plantasPorSocio: props.entidad?.plantas_por_paciente ?? 9,
    plantasEnFloracion: props.plantasFloracion,
    // Lo define el cultivo —o el Director Tecnico—, no el sistema. Sin ese
    // numero el eslabon dice que no se puede saber, que es la verdad.
    // El rinde sale de la ficha de CADA VARIEDAD —«Producción: +145/Planta»—,
    // ponderado por cuántas plantas hay de cada una. El campo suelto de la
    // entidad queda como respaldo, para el caso de que las fichas no lo
    // declaren pero el Director Técnico sí lo haya fijado.
    //
    // Si no hay ninguno de los dos, sigue en null y el eslabón dice «no se
    // puede saber», que es la verdad: el sistema no estima un rinde solo.
    rindeEsperadoPorPlantaG:
      rindePorPlanta(props.plantas ?? [], props.geneticas ?? [])
      ?? props.entidad?.rinde_esperado_planta_g ?? null,
    gramosCosechados: props.gramosCosechados ?? 0,
    // «De proveedores» son los que se le COMPRARON a alguien, y nada mas.
    //
    // Sumaba todos los lotes. En la asociación eso son X.XXX g de cultivo propio sin
    // cosecha registrada contados como compra a terceros: la nota decía
    // «X.XXX g de proveedores» cuando de proveedores eran 4.283. Esta pantalla
    // existe para sostener que la asociación cultiva en vez de comprar y
    // revender, así que el error iba justo contra su propio argumento.
    gramosComprados: (props.lotes ?? [])
      .filter(l => enGramos(l.unidad) && loteEsComprado(l))
      .reduce((t, l) => t + (Number(l.gramos_totales) || 0), 0),
    gramosPropiosSinCosecha: (props.lotes ?? [])
      .filter(l => enGramos(l.unidad) && l.origen === 'propio_sin_cosecha')
      .reduce((t, l) => t + (Number(l.gramos_totales) || 0), 0),
    gramosEntregados: (props.dispensas ?? []).reduce((t, d) => t + (Number(d.gramos) || 0), 0),
    costosOperativos: (props.caja ?? [])
      .filter(a => a.tipo === 'egreso').reduce((t, a) => t + (Number(a.monto) || 0), 0),
    ingresosDeReembolso: (props.caja ?? [])
      .filter(a => a.tipo === 'ingreso').reduce((t, a) => t + (Number(a.monto) || 0), 0),
    // Lo que falta pagarle a proveedores es costo igual: el material ya se
    // recibio y ya se entrego. Sin esto, una compra grande sin pagar hace que
    // el reembolso parezca de sobra cuando en realidad falta.
    // Sin la producción propia. `separarProduccionPropia` existe desde que la
    // pantalla de Proveedores tuvo el mismo problema, y acá no se estaba usando:
    // en la asociación el cultivo propio entró como 46 órdenes de compra a sí mismos
    // por $XX.XXX.XXX, de las cuales se «pagaron» $XXX.XXX. Eso daba
    // $XX.XXX.XXX de deuda con uno mismo, que la cadena sumaba al costo: $101 M
    // contra $72,5 M de reembolso, o sea un faltante inventado de $28,5 M.
    deudaConProveedores: separarProduccionPropia(
      props.saldos ?? [], props.entidad?.proveedor_propio).terceros
      .reduce((t, s) => t + Math.max(0, Number(s.saldo) || 0), 0),

    // Los lotes COMPRADOS y que les falta. La cosecha propia a veces alcanza y a
    // veces no; lo que falta se le pide a un proveedor, y ese material se
    // respalda con de quien vino y con que analisis, no con las plantas propias.
    ...(() => {
      const comprados = (props.lotes ?? []).filter(l => loteEsComprado(l))
      return {
        lotesComprados: comprados.length,
        lotesSinProveedor: comprados.filter(l => !l.proveedor?.trim()).length,
        // Sólo los que entraron CON el requisito vigente. Los anteriores no
        // están en falta: un análisis no se puede hacer sobre material que ya
        // se entregó y se consumió, así que exigírselo dejaría la cadena rota
        // para siempre. Llevan su constancia con la fecha en que entraron.
        lotesSinAnalisis: comprados.filter(l => estadoDelAnalisis(l) === 'falta').length,
        lotesConAnalisisViejo:
          comprados.filter(l => estadoDelAnalisis(l) === 'anterior_al_requisito').length,
      }
    })(),

    // Lo que hace falta para poder decir que el aporte cubre el costo en vez de
    // superarlo. Va por gramo y no por totales: el costo sale del precio al que
    // entró cada lote, así que no depende de cómo se imputó cada gasto.
    ...(() => {
      const lotesEnG = (props.lotes ?? []).filter(l => enGramos(l.unidad))
      const conCosto = lotesEnG.filter(l => l.costo_por_gramo != null)
      const gramosConCosto = conCosto.reduce((t, l) => t + (Number(l.gramos_totales) || 0), 0)
      const costoTotal = conCosto.reduce(
        (t, l) => t + (Number(l.costo_por_gramo) || 0) * (Number(l.gramos_totales) || 0), 0)
      // Sólo las entregas que se cobraron: repartir el aporte entre todos los
      // gramos —incluidos los X.XXX g que se entregan sin cargo— hace ver un
      // precio por gramo mucho más bajo que el que se cobra de verdad.
      //
      // Y se excluyen las salidas que no van a una persona aunque tengan monto:
      // hay 4 asientos de merma y consumo interno con $XXX.XXX y cero gramos, y
      // dos de migración del saldo de caja inicial. Ese dinero no es el aporte
      // de un socio —una merma no le cobra a nadie— y contarlo subía el aporte
      // por gramo de $X.XXX a $X.XXX sobre gramos que no existen.
      const cobradas = (props.dispensas ?? []).filter(
        d => (Number(d.aporte) || 0) > 0 && (Number(d.gramos) || 0) > 0 && !esSalidaSinPaciente(d))
      return {
        costoMaterialPorGramo: gramosConCosto > 0 ? costoTotal / gramosConCosto : null,
        gramosCobrados: cobradas.reduce((t, d) => t + (Number(d.gramos) || 0), 0),
        aportesCobrados: cobradas.reduce((t, d) => t + (Number(d.aporte) || 0), 0),
        // Todo lo que no es comprarle material a un proveedor: es lo que el
        // margen tiene que sostener.
        gastosNoMaterial: (props.caja ?? [])
          .filter(a => a.tipo === 'egreso' && !/proveedor|pago a /i.test(
            `${a.concepto ?? ''} ${a.detalle ?? ''}`))
          .reduce((t, a) => t + (Number(a.monto) || 0), 0),
      }
    })(),
  }

  return (
    <div className="space-y-4">
      <CadenaDeJustificacion datos={datosCadena} />
      <div className={tarjeta}>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardCheck className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Coherencia entre libros</h3>
        </div>
        <p className="text-[11px] text-[#8a8a9c]">
          Los organismos de control no miran sólo que estén los papeles: verifican que todos los libros cuenten la misma
          historia. Las <b className="text-[#a6a6b5]">inconsistencias entre libros</b>, más que la falta de
          documentación, son la principal causa de observaciones. Acá corren esos mismos cruces.
        </p>
        <div className="flex flex-wrap gap-3 mt-3">
          <Contador n={errores} txt="observables" color="#ff8a7a" />
          <Contador n={alertas} txt="para revisar" color="#f59e0b" />
          <Contador n={chequeos.filter(c => c.estado === 'ok').length} txt="en regla" color="#bef264" />
        </div>
      </div>

      <div className="space-y-2">
        {chequeos.map(c => {
          const { Ic, color, label } = iconoChequeo(c.estado)
          const destino = DONDE_SE_ARREGLA[c.clave]
          // Lo que ya está en regla no lleva a ningún lado: no hay nada que ir a
          // hacer, y un link ahí invita a tocar lo que anda.
          const linkeable = destino && c.estado !== 'ok'
          return (
            <div key={c.clave} className="rounded-lg bg-[#15151d] border border-[#1f1f2b] px-3 py-2.5">
              <div className="flex items-start gap-2">
                <Ic aria-hidden className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[13px] font-medium text-[#ececf1]">{c.titulo}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color, background: `${color}1a` }}>{label}</span>
                    {/* Ver la nota del mismo caso en PaginaONG (Vencimientos):
                        con `ml-auto` a secas el valor cae solo al renglon de
                        abajo pegado a la derecha, sin columna que lo sostenga. */}
                    <span className="w-full sm:w-auto sm:ml-auto mt-1 sm:mt-0 text-[15px] sm:text-[12px] font-mono tabular-nums" style={{ color }}>{c.valor}</span>
                  </div>
                  <p className="text-[11px] text-[#a6a6b5] mt-1 [text-wrap:pretty]">{c.detalle}</p>
                  {linkeable && (
                    <Link to={destino.ruta}
                      aria-label={`Ir a ${destino.donde} para resolver: ${c.titulo}`}
                      className="inline-flex items-center gap-1 mt-2 px-2 py-1.5 -ml-2 min-h-[44px] sm:min-h-0 rounded-lg text-[11px] font-medium text-[#d9f99d] hover:bg-[#a3e635]/10 transition-colors">
                      Ir a {destino.donde}
                      <ArrowRight aria-hidden className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Contador({ n, txt, color }: { n: number; txt: string; color: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[20px] font-mono tabular-nums font-bold leading-none" style={{ color }}>{n}</span>
      <span className="text-[11px] text-[#8a8a9c]">{txt}</span>
    </div>
  )
}

// ===================== auxiliares =====================

function Mini({ txt, ok, alerta }: { txt: string; ok?: boolean; alerta?: boolean }) {
  const c = ok ? { t: '#bef264', b: 'rgba(163,230,53,0.12)', br: '#404d20' }
    : alerta ? { t: '#ff8a7a', b: 'rgba(122,40,32,0.15)', br: '#7a2820' }
      : { t: '#8f8f9f', b: 'rgba(180,180,200,0.06)', br: '#2a2a3a' }
  return <span className="text-[10px] px-1.5 py-0.5 rounded border" style={{ color: c.t, background: c.b, borderColor: c.br }}>{txt}</span>
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
