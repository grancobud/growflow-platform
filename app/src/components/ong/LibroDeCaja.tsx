// Libro Diario de Caja: cada peso que entra y sale.
//
// POR QUE ESTA EN SU PROPIO ARCHIVO Y EN SU PROPIA PESTAÑA
//
// Vivía adentro de Seguimiento, que es el seguimiento clínico de los pacientes.
// Dos cosas sin relación en una pantalla, y la pestaña se llamaba «Seguimiento»
// dentro del grupo «Personas». La consecuencia práctica: «Anotar un gasto o un
// pago» —la acción MÁS USADA de todo el sistema, 1.692 veces contra 1.241
// entregas en el último año— dejaba a la persona en la pantalla del seguimiento
// terapéutico, buscando el libro de caja tres secciones más abajo.
//
// Ahora vive en Economía, que es donde alguien lo iría a buscar.
//
// Es uno de los cinco libros obligatorios. De acá sale el balance.
//
// SE FUE EL BOTÓN «ASENTAR REEMBOLSOS» (30/08/2026)
//
// Recorría las entregas buscando cuáles no tenían asiento y los creaba. Existía
// porque guardar una entrega no escribía nada en la caja: la plata entraba
// después, cuando alguien se acordaba de apretarlo.
//
// Un paso que hay que recordar no es un paso, es una trampa: mientras nadie lo
// apretaba, la pantalla mostraba un saldo que se leía como completo y no lo
// era. Ahora el asiento nace con la entrega (ver `guardarDispensa` en lib/ong),
// así que no hay nada que repescar.

import { useState, useCallback, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { BookOpenCheck, Plus, Pencil, Trash2, ArrowLeftRight, X, Loader2 } from 'lucide-react'
import { useAbrirAlLlegar } from '../../lib/useAbrirAlLlegar'
import { useAvanzarFlujo } from '../../lib/useAvanzarFlujo'
import { useIrASeccion } from '../../lib/useIrASeccion'
import { GuiaDelFormulario, AyudaCampo } from './GuiaDelFormulario'
import { ModalFormulario } from './ModalFormulario'
import { Kpi } from './Kpi'
import {
  ongService, CONCEPTOS_CAJA, MEDIOS_PAGO, resumenCaja, revisarMovimientoInterno,
  saldosService,
  type AsientoCaja, type MovimientoInterno, type MedioInterno, type SaldoOrden,
} from '../../lib/ong'
import { btnPrimario, btnSutil, tarjeta, etiquetaCampo, inputFormulario } from '../../lib/ui'
import { confirmarBorrado } from '../../lib/confirmar'
import { useDialogo } from '../../lib/useDialogo'

const fmtPesos = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

export function LibroDeCaja({ caja, onCambio }: {
  caja: AsientoCaja[]
  onCambio: () => void
}) {
  const [asiento, setAsiento] = useState<Partial<AsientoCaja> | null>(null)
  const [interno, setInterno] = useState(false)

  // El mismo asiento en blanco que arma el botón de la pantalla, para que la
  // acción «Anotar un gasto o un pago» abra este formulario y no otro.
  const nuevoAsiento = useCallback(() => setAsiento({
    fecha: new Date().toISOString().slice(0, 10), tipo: 'egreso',
  }), [])
  useAbrirAlLlegar(nuevoAsiento, '1', asiento != null)
  // Clave propia: esta pantalla tiene DOS formularios y `?nueva=1` ya es del
  // asiento comun. Cada hook mira sólo lo suyo (`debeLimpiar`), así que
  // convivir no los confunde — pero la clave tiene que decir cuál.
  const abrirInterno = useCallback(() => setInterno(true), [])
  useAbrirAlLlegar(abrirInterno, 'interno', interno)
  useIrASeccion()

  const ingresos = caja.filter(a => a.tipo === 'ingreso').reduce((s, a) => s + Number(a.monto), 0)
  const egresos = caja.filter(a => a.tipo === 'egreso').reduce((s, a) => s + Number(a.monto), 0)

  // El saldo abierto por medio, que es la pregunta que se hace todos los días:
  // no «cuánto hay» sino «cuánto tiene que haber EN LA CAJA».
  //
  // La cuenta ya existía y estaba entera en Movimientos, tres pestañas más
  // allá y con un nombre que no dice «plata». Quien lleva el control diario
  // llega hasta acá —es donde se anota el gasto, la acción más usada del
  // sistema— ve un solo «Saldo» que mezcla el efectivo con el banco, y
  // concluye que la app no lo tiene.
  const porMedio = useMemo(() => resumenCaja(caja), [caja])

  const borrarAsiento = async (a: AsientoCaja) => {
    if (!(await confirmarBorrado(`¿Borrar el asiento de ${fmtPesos(a.monto)} del ${a.fecha}?`))) return
    try { await ongService.borrarAsiento(a.id); toast.success('Borrado'); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <>
      {/* El id se conserva: las guías y los flujos traen esta sección a la vista
          con `?ir=caja`, y cambiarlo dejaría esos links apuntando al vacío. */}
      <div id="caja" className={tarjeta}>
        <div className="flex items-center gap-2 flex-wrap">
          <BookOpenCheck className="w-4 h-4 text-[#c4b5fd]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">Libro Diario de Caja</h3>
          <div className="w-full sm:w-auto sm:ml-auto flex gap-2">
            {/* La plata que pasa del banco a la mano. Eran DOS asientos a mano
                —uno egreso y otro ingreso, con el mismo importe— y por eso en
                trece meses se anotaron cinco: la caja de efectivo quedó en
                −$10,2M contra $XXX.XXX de traspasos registrados. */}
            <button onClick={() => setInterno(true)}
              className={`${btnSutil} flex-1 sm:flex-none`}>
              <ArrowLeftRight className="w-3.5 h-3.5" /> Movimiento interno
            </button>
            <button onClick={() => setAsiento({ tipo: 'ingreso', fecha: new Date().toISOString().slice(0, 10) })}
              className={`${btnPrimario} flex-1 sm:flex-none`}>
              <Plus className="w-3.5 h-3.5" /> Asiento
            </button>
          </div>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2">
          Es uno de los cinco libros obligatorios: acá se asienta cada peso que entra y sale, y de esto
          sale el balance. Los reembolsos de las entregas <b className="text-[#a6a6b5]">entran solos</b>:
          se asientan al registrar la entrega, así que no hay que cargarlos de nuevo acá.
        </p>

        {/* DOS columnas en el telefono y tres desde `sm`.
            Medido a 375 px: en tres columnas la celda deja 85 px utiles y
            «$XX.XXX.XXX» no entra ni achicado a 14 px. Tres columnas de plata no
            entran en un telefono, y achicar hasta que entre deja una cifra que
            no se lee.

            El SALDO ocupa el ancho completo abajo, que ademas es la jerarquia
            correcta: ingresos y egresos son el detalle, el saldo es el numero
            que se viene a mirar. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#1f1f2b] auto-rows-fr">
          <Kpi t="Ingresos" v={fmtPesos(ingresos)} c="#bef264" />
          <Kpi t="Egresos" v={fmtPesos(egresos)} c="#ff8a7a" />
          <Kpi t="Saldo" v={fmtPesos(ingresos - egresos)}
            ancho="col-span-2 sm:col-span-1"
            c={ingresos - egresos >= 0 ? '#ececf1' : '#ff8a7a'} />
        </div>

        {caja.length > 0 && (
          <p className="text-[11px] text-[#8a8a9c] mt-2">
            De ese saldo, <span className="text-[#ececf1] tabular-nums">{fmtPesos(porMedio.netoEfectivo)}</span> en
            efectivo y <span className="text-[#ececf1] tabular-nums">{fmtPesos(porMedio.netoTransferencia)}</span> en
            transferencia
            {porMedio.netoOtros !== 0 && <>
              ; <span className="text-[#fbbf24] tabular-nums">{fmtPesos(porMedio.netoOtros)}</span> sin
              discriminar, en asientos mixtos, en «Otro» o sin medio de pago
            </>}.{' '}
            <Link to="/ong/movimientos" className="text-[#a3e635] hover:underline">
              Ver el movimiento del día
            </Link>
          </p>
        )}

        {caja.length === 0 ? (
          <p className="text-[12px] text-[#8a8a9c] text-center py-5">Sin asientos cargados.</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {caja.slice(0, 15).map(a => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg bg-[#15151d] border border-[#1f1f2b] px-3 py-2 min-h-[44px]">
                <span className="w-1 h-8 rounded-full flex-shrink-0"
                  style={{ background: a.tipo === 'ingreso' ? '#a3e635' : '#ff8a7a' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-[#ececf1] truncate">{a.concepto}</p>
                  <p className="text-[10px] text-[#8a8a9c] tabular-nums truncate">
                    {a.fecha}{a.detalle ? ` · ${a.detalle}` : ''}{a.medio ? ` · ${a.medio}` : ''}
                  </p>
                </div>
                <span className="text-[13px] font-semibold tabular-nums flex-shrink-0"
                  style={{ color: a.tipo === 'ingreso' ? '#d9f99d' : '#ff8a7a' }}>
                  {a.tipo === 'ingreso' ? '+' : '−'}{fmtPesos(a.monto)}
                </span>
                {/* Editar, no solo borrar.
                    Un asiento cargado sin su comprobante no se podia corregir: habia
                    que borrarlo y cargarlo de nuevo, y con eso se pierde la fecha en
                    que se asento y cualquier cosa que ya colgara de el. El guardado
                    ya sabia actualizar —si el asiento trae id hace update— y lo unico
                    que faltaba era la forma de abrirlo. */}
                <button onClick={() => setAsiento(a)} className={btnSutil} aria-label="Editar asiento">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => borrarAsiento(a)} className={btnSutil} aria-label="Borrar asiento">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {asiento && <ModalAsiento form={asiento} setForm={setAsiento} onCambio={onCambio} />}
      {interno && <ModalMovimientoInterno onCerrar={() => setInterno(false)}
        onGuardado={() => { setInterno(false); onCambio() }} />}
    </>
  )
}

function ModalAsiento({ form, setForm, onCambio }: {
  form: Partial<AsientoCaja>; setForm: (a: Partial<AsientoCaja> | null) => void; onCambio: () => void
}) {
  const tipo = form.tipo ?? 'ingreso'
  const avanzar = useAvanzarFlujo()

  // TODA SALIDA DE PLATA POR EL MISMO BOTÓN (01/09/2026, pedido de Socio).
  //
  // Eran dos caminos que no se parecían: el gasto se anotaba acá y el pago a un
  // proveedor había que ir a buscarlo a otra pestaña, orden por orden. El que
  // atiende no distingue «asiento de caja» de «pago contra una orden»: sabe que
  // salió plata y quiere anotarla.
  //
  // Va ADENTRO de este modal y no en un botón nuevo: la acción ya se llama
  // «Anotar un gasto o un pago» y hasta hoy sólo hacía la primera mitad. Una
  // tercera puerta para lo mismo es cómo se llega a dos lugares donde arreglar
  // el mismo bug.
  const [modo, setModo] = useState<'gasto' | 'proveedor'>('gasto')
  const [ordenes, setOrdenes] = useState<SaldoOrden[]>([])
  const [ordenSel, setOrdenSel] = useState('')
  const [guardandoPago, setGuardandoPago] = useState(false)

  // Se piden al abrir y no al elegir «pago a proveedor»: si se pidieran ahí, el
  // desplegable aparecería vacío el primer segundo y se lee como que no hay
  // ninguna orden.
  useEffect(() => {
    saldosService.getOrdenes(true)
      .then(setOrdenes)
      .catch(e => console.warn('[caja] no se pudieron cargar las órdenes:', (e as Error).message))
  }, [])

  const orden = ordenes.find(o => o.orden_servicio === ordenSel) ?? null

  const guardarPago = async () => {
    if (!orden) { toast.error('Elegí a quién se le paga'); return }
    if (!form.monto || form.monto <= 0) { toast.error('Poné el monto'); return }
    setGuardandoPago(true)
    try {
      const r = await saldosService.registrarPago({
        orden_servicio: orden.orden_servicio,
        proveedor: orden.proveedor ?? '',
        fecha: form.fecha || new Date().toISOString().slice(0, 10),
        monto: Number(form.monto),
        medio: form.medio || null,
      })
      // El pago SIEMPRE se da por bueno: ya se guardó. Ver `registrarPago`.
      toast.success(Number(form.monto) >= Number(orden.saldo) ? 'Orden saldada' : 'Pago anotado')
      if (!r.asentado) {
        toast.warning('El pago quedó anotado, pero no se pudo asentar en la caja.', {
          description: 'Cargalo a mano en Movimientos para que el saldo cierre.',
          duration: 12000,
        })
      }
      setForm(null)
      onCambio()
    } catch (e) { toast.error((e as Error).message) }
    finally { setGuardandoPago(false) }
  }

  const guardar = async () => {
    if (modo === 'proveedor') return guardarPago()
    if (!form.concepto) { toast.error('Elegí el concepto'); return }
    if (!form.monto || form.monto <= 0) { toast.error('Poné el monto'); return }
    try {
      const guardado = await ongService.guardarAsiento(form)

      // UN ASIENTO CON FECHA PASADA SE GUARDA Y NO SE VE, y eso lleva a
      // cargarlo de nuevo.
      //
      // La lista muestra los quince más recientes POR FECHA, y Movimientos abre
      // filtrado en «Hoy». Un asiento del 18 queda debajo de todos los del 19 y
      // fuera del filtro: el toast decía «guardado» y no aparecía en ningún
      // lado. El 23/08/2026 eso dejó TRES asientos idénticos de $XX.XXX en el
      // libro real de la asociación, cargados uno atrás del otro.
      //
      // Que se guarde no alcanza: hay que decir dónde quedó.
      const hoy = new Date().toISOString().slice(0, 10)
      const fecha = guardado?.fecha ?? form.fecha
      if (fecha && fecha !== hoy) {
        toast.success(`Asiento guardado con fecha ${fecha}`, {
          description: 'Ojo: no aparece arriba de la lista ni en el filtro «Hoy», '
            + 'porque se ordena por fecha. Está entre los de ese día.',
          duration: 8000,
        })
      } else {
        toast.success('Asiento guardado')
      }
      setForm(null)
      onCambio()
      // El paso que sigue —en «Anotar un gasto» y en «Comprarle a un proveedor»—
      // es el comprobante que respalda ESTE asiento. Se va con el id puesto para
      // que llegue con el monto y la fecha ya cargados.
      avanzar(guardado?.id ? { asiento: guardado.id } : undefined)
    }
    catch (e) { toast.error((e as Error).message) }
  }
  return (
    <ModalFormulario titulo="Anotar un gasto o un pago" onCerrar={() => setForm(null)} onGuardar={guardar}>
      {!form.id && <GuiaDelFormulario id="gasto" />}

      {/* LA PREGUNTA QUE FALTABA. Sólo en un asiento NUEVO y sólo en egreso:
          editar uno viejo no puede convertirlo en un pago a proveedor, y un
          ingreso no es una salida de plata. */}
      {!form.id && tipo === 'egreso' && (
        <div>
          <span className={etiquetaCampo}>¿Qué salida es?</span>
          <div className="flex gap-2 mt-1.5">
            {([['gasto', 'Gasto operativo'], ['proveedor', 'Pago a proveedor']] as const).map(([m, txt]) => (
              <button key={m} type="button" onClick={() => setModo(m)}
                className={`flex-1 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border text-[12px] font-medium transition-colors ${
                  modo === m
                    ? 'border-[#a3e635]/50 bg-[#a3e635]/10 text-[#d9f99d]'
                    : 'border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5] hover:text-[#ececf1]'}`}>
                {txt}
              </button>
            ))}
          </div>
          {modo === 'proveedor' && (
            <p className="text-[10px] text-[#8a8a9c] mt-1.5 leading-relaxed">
              Descuenta de lo que se le debe <b className="text-[#a6a6b5]">y</b> sale de la caja.
              Antes eran dos cargas en dos pantallas.
            </p>
          )}
        </div>
      )}

      {/* PAGO A PROVEEDOR: se elige la orden, no se escribe nada.
          El monto viene puesto con el saldo, que es el caso normal —se salda—,
          y se puede bajar para un pago parcial. */}
      {modo === 'proveedor' && !form.id ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2"><span className={etiquetaCampo}>A quién se le paga</span>
            <select className={inputFormulario} value={ordenSel}
              onChange={e => {
                setOrdenSel(e.target.value)
                const o = ordenes.find(x => x.orden_servicio === e.target.value)
                if (o) setForm({ ...form, monto: Number(o.saldo) })
              }}>
              <option value="">Elegir…</option>
              {ordenes.map(o => (
                <option key={o.orden_servicio} value={o.orden_servicio}>
                  {o.proveedor ?? 'Sin proveedor'} · {o.orden_servicio} · debe ${Math.round(Number(o.saldo)).toLocaleString('es-AR')}
                </option>
              ))}
            </select>
            {/* NUNCA SE FRENA AL OPERADOR: si no hay órdenes abiertas se dice
                por qué y se le deja el otro camino, en vez de un desplegable
                vacío que parece roto. */}
            {ordenes.length === 0 && (
              <p className="text-[10px] text-[#fbbf24] mt-1.5 leading-relaxed">
                No hay órdenes con saldo pendiente. Si igual salió plata, anotala
                como <b>gasto operativo</b> acá arriba.
              </p>
            )}</label>
          <label><span className={etiquetaCampo}>Cuánto se paga</span>
            <input type="number" inputMode="decimal" className={inputFormulario} value={form.monto ?? ''}
              onChange={e => setForm({ ...form, monto: e.target.value === '' ? undefined : +e.target.value })} />
            {orden && Number(form.monto) < Number(orden.saldo) && (
              <span className="block text-[10px] text-[#8a8a9c] mt-1">
                Queda debiendo ${Math.round(Number(orden.saldo) - Number(form.monto ?? 0)).toLocaleString('es-AR')}
              </span>
            )}</label>
          <label><span className={etiquetaCampo}>Fecha</span>
            <input type="date" className={inputFormulario} value={form.fecha ?? ''}
              onChange={e => setForm({ ...form, fecha: e.target.value })} /></label>
          <label className="col-span-2"><span className={etiquetaCampo}>Medio de pago</span>
            <select className={inputFormulario} value={form.medio ?? ''}
              onChange={e => setForm({ ...form, medio: e.target.value })}>
              <option value="">Elegir…</option>
              {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
            </select></label>
          {guardandoPago && <p className="col-span-2 text-[11px] text-[#8a8a9c]">Guardando…</p>}
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3">
        <label><span className={etiquetaCampo}>Tipo</span>
          <select className={inputFormulario} value={tipo}
            onChange={e => setForm({ ...form, tipo: e.target.value as 'ingreso' | 'egreso', concepto: undefined })}>
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </select>
              <AyudaCampo id="gasto" campo="Tipo" /></label>
        <label><span className={etiquetaCampo}>Fecha</span>
          <input type="date" className={inputFormulario} value={form.fecha ?? ''}
            onChange={e => setForm({ ...form, fecha: e.target.value })} /></label>
        <label className="col-span-2"><span className={etiquetaCampo}>Concepto</span>
          <select className={inputFormulario} value={form.concepto ?? ''}
            onChange={e => setForm({ ...form, concepto: e.target.value })}>
            <option value="">Elegir…</option>
            {CONCEPTOS_CAJA[tipo].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
              <AyudaCampo id="gasto" campo="Concepto" /></label>
        <label><span className={etiquetaCampo}>Monto</span>
          <input type="number" className={inputFormulario} value={form.monto ?? ''}
            onChange={e => setForm({ ...form, monto: e.target.value === '' ? undefined : +e.target.value })} /></label>
        {/* Lista y no texto libre.
            Era un input con el placeholder «Efectivo / transferencia», y un
            placeholder no obliga: en la base quedó un «Tranferencia» sin la
            ese, que no cae en ningún medio y por lo tanto no figura en el
            arqueo. El medio del asiento ES la cuenta de dónde está la plata;
            escrito de dos maneras deja de serlo.

            Un valor viejo que no esté en la lista se conserva como opción
            propia: abrir un asiento a editar no puede cambiarle el medio solo. */}
        <label><span className={etiquetaCampo}>Medio</span>
          <select className={inputFormulario} value={form.medio ?? ''}
            onChange={e => setForm({ ...form, medio: e.target.value || undefined })}>
            <option value="">Elegir…</option>
            {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
            {form.medio && !MEDIOS_PAGO.some(m => m === form.medio) && (
              <option value={form.medio}>{form.medio}</option>
            )}
          </select>
              <AyudaCampo id="gasto" campo="Medio" /></label>
      </div>
      )}
      {/* El detalle es del gasto libre: un pago a proveedor ya lleva su rastro
          —la orden y la referencia— escrito por `asientoDePago`. */}
      {modo !== 'proveedor' && (
      <label><span className={etiquetaCampo}>Detalle</span>
        <input className={inputFormulario} value={form.detalle ?? ''}
          onChange={e => setForm({ ...form, detalle: e.target.value })} />
              <AyudaCampo id="gasto" campo="Detalle" /></label>
      )}
    </ModalFormulario>
  )
}

/**
 * La plata que pasa del banco a la mano, o al reves.
 *
 * NO ES UN ASIENTO MAS: son DOS, y por eso tiene formulario propio. Uno que sale
 * de un medio y otro que entra en el otro, con el mismo importe. Anotarlo a mano
 * eran dos formularios y acordarse de que el importe coincidiera, y el resultado
 * medido fue cinco traspasos en trece meses contra $10,2 millones de caja en
 * negativo.
 *
 * Lo que lo hace seguro es que SUMA CERO al total: mueve el reparto entre medios
 * y nunca el resultado. Desde esta pantalla no se puede inventar un ingreso ni
 * tapar un deficit, que es justo lo que no hay que poder hacer.
 */
function ModalMovimientoInterno({ onCerrar, onGuardado }: {
  onCerrar: () => void; onGuardado: () => void
}) {
  const [f, setF] = useState<MovimientoInterno>({
    fecha: new Date().toISOString().slice(0, 10),
    // El caso normal es sacar del banco para pagar en mano: viene puesto asi.
    desde: 'Transferencia', hacia: 'Efectivo', monto: 0, detalle: '',
  })
  const [guardando, setGuardando] = useState(false)
  const refDialogo = useDialogo(onCerrar)

  const problema = revisarMovimientoInterno(f)

  const guardar = async () => {
    if (problema) { toast.error(problema); return }
    setGuardando(true)
    try {
      await ongService.guardarMovimientoInterno(f)
      toast.success('Movimiento interno registrado')
      onGuardado()
    } catch (e) { toast.error((e as Error).message) }
    finally { setGuardando(false) }
  }

  const invertir = () => setF(x => ({ ...x, desde: x.hacia, hacia: x.desde }))

  return (
    <div ref={refDialogo} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onCerrar}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#1f1f2b] flex items-center gap-2 flex-shrink-0">
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">Movimiento interno</h3>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <p className="text-[11px] text-[#8a8a9c] leading-relaxed">
            La misma plata cambia de lugar: sale de un medio y entra en el otro.
            <b className="text-[#a6a6b5]"> El saldo total no se mueve</b> — es lo que anota una
            extracción del banco para pagar en efectivo.
          </p>

          <div className="flex items-end gap-2">
            <label className="flex-1 min-w-0"><span className={etiquetaCampo}>Sale de</span>
              <select className={inputFormulario} value={f.desde}
                onChange={e => setF(x => ({ ...x, desde: e.target.value as MedioInterno }))}>
                <option value="Transferencia">Transferencia</option>
                <option value="Efectivo">Efectivo</option>
              </select></label>
            <button type="button" onClick={invertir} title="Invertir" aria-label="Invertir"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#2a2a3a] bg-[#15151d] text-[#8a8a9c] hover:text-[#d9f99d] transition-colors flex-shrink-0">
              <ArrowLeftRight className="w-4 h-4" />
            </button>
            <label className="flex-1 min-w-0"><span className={etiquetaCampo}>Entra en</span>
              <select className={inputFormulario} value={f.hacia}
                onChange={e => setF(x => ({ ...x, hacia: e.target.value as MedioInterno }))}>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
              </select></label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label><span className={etiquetaCampo}>Cuánto</span>
              <input className={inputFormulario} type="number" inputMode="decimal" autoFocus
                value={f.monto || ''} onChange={e => setF(x => ({ ...x, monto: Number(e.target.value) }))} /></label>
            <label><span className={etiquetaCampo}>Fecha</span>
              <input className={inputFormulario} type="date" value={f.fecha}
                onChange={e => setF(x => ({ ...x, fecha: e.target.value }))} /></label>
          </div>

          <label className="block"><span className={etiquetaCampo}>Detalle (opcional)</span>
            <input className={inputFormulario} placeholder="Extracción para pagar la luz"
              value={f.detalle ?? ''} onChange={e => setF(x => ({ ...x, detalle: e.target.value }))} /></label>
        </div>

        <div className="px-4 py-3 border-t border-[#1f1f2b] flex items-center gap-2 flex-shrink-0">
          <button onClick={onCerrar} className={btnSutil}>Cancelar</button>
          <button onClick={guardar} disabled={guardando || problema != null}
            className={`${btnPrimario} ml-auto disabled:opacity-50`}>
            {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
            Registrar
          </button>
        </div>
      </div>
    </div>
  )
}
