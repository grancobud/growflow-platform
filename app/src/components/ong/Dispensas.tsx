// Registro de dispensas: a quién se le entregó cannabis, cuánto y con qué
// reembolso de costos. Es lo que conecta el cultivo con lo institucional y lo
// que prueba que el dinero cubre costos en vez de ser el precio de una venta.
//
// El termino importa: "Reembolso de Costos Operativos" dice de que es reembolso
// y contra que obligacion (el mandato que el paciente le dio a la ONG). "Aporte"
// a secas no dice ninguna de las dos cosas.

import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { HandCoins, Plus, Pencil, Trash2, AlertTriangle, XCircle, Scale, Receipt, Undo2 } from 'lucide-react'
import {
  ongService, revisarDispensa, resumirDispensas, balanceMateria, saldoDeLotes, PRODUCTOS_DISPENSA,
  MEDIOS_PAGO, resumirAcciones, tipoDeMovimiento, labelMovimiento, deudaPorSocio,
  type LoteIngreso, type SaldoLote,
  TOPE_TRASLADO_INDIVIDUAL_G,
  feedbackPendiente, cupoMovil30Dias,
  type Dispensa, type Asociado, type Entidad, type FeedbackClinico, type AsientoCaja,
  type DocumentoONG,
} from '../../lib/ong'
import type { Paciente } from '../../lib/registro'
import { reciboReembolso, comprobanteDispensacion } from '../../lib/documentosLegales'
import { VisorDocumento } from './ActaParaLibro'
import type { Genetica } from '../../lib/cultivo'
import { btnPrimario, btnSutil, tarjeta, etiquetaCampo, inputFormulario } from '../../lib/ui'
import { pedirDatos } from '../../lib/pedirDatos'
import { SelectorPersona } from './SelectorPersona'
import { nombreParaMostrar } from '../../lib/buscarPersonas'
import { useAbrirAlLlegar } from '../../lib/useAbrirAlLlegar'
import { useAvanzarFlujo } from '../../lib/useAvanzarFlujo'
import { GuiaDelFormulario, AyudaCampo, OjoDelFormulario } from './GuiaDelFormulario'
import { EmitirRecibosPendientes } from './EmitirRecibosPendientes'
import { leyendaDelMandato } from '../../lib/estadoDelMandato'
import { useDialogo } from '../../lib/useDialogo'
import { useConfirm } from '../../hooks/useConfirm'
import { Kpi } from './Kpi'

const fmtPesos = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

/**
 * Como se lee el saldo de un lote en el desplegable.
 *
 * Los tres casos se dicen distinto a proposito. «Quedan -172 g» es la frase que
 * aparece cuando algo ya esta mal, y es justo ahi donde peor se entiende: no
 * quedan -172, salieron 172 de mas. Un lote agotado tampoco es «quedan 0», es
 * que se entrego entero.
 */
const etiquetaSaldo = (x: SaldoLote) => {
  const n = (v: number) => Math.round(v).toLocaleString('es-AR')
  if (x.restante > 0) return `quedan ${n(x.restante)} ${x.unidad} de ${n(x.ingreso)}`
  if (x.restante === 0) return `agotado (se entregaron los ${n(x.ingreso)} ${x.unidad})`
  return `sobregirado: salieron ${n(x.entregado)} ${x.unidad} de ${n(x.ingreso)}`
}
const fmtFecha = (f?: string | null) =>
  f ? new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export function Dispensas({ dispensas, pacientes, asociados, geneticas, costoPorGramo, gramosCosechados, lotes = [], entidad = null, feedbacks = [], caja = [], documentos = [], onCambio }: {
  dispensas: Dispensa[]
  pacientes: Paciente[]
  asociados: Asociado[]
  geneticas: Genetica[]
  costoPorGramo: number | null
  gramosCosechados: number
  /** Los lotes: por acá entra el material que no salió del cultivo propio. */
  lotes?: LoteIngreso[]
  /** Para el encabezado del recibo por reembolso. */
  entidad?: Entidad | null
  /** Para el bloqueo por reporte de seguimiento pendiente (RN-05). */
  feedbacks?: FeedbackClinico[]
  /** Para no asentar dos veces la misma devolución. */
  caja?: AsientoCaja[]
  /** Para saber a qué entrega ya se le emitió el recibo y no emitirlo dos veces. */
  documentos?: DocumentoONG[]
  onCambio: () => void
}) {
  const [form, setForm] = useState<Partial<Dispensa> | null>(null)

  // Los mismos valores por defecto que pone el botón de arriba. Se extrae para
  // que la acción «Entregarle a un paciente» abra EXACTAMENTE el mismo
  // formulario y no una variante parecida.
  const nuevaDispensa = useCallback(() => setForm({
    fecha: new Date().toISOString().slice(0, 10), producto: 'flor', modalidad: 'retiro',
  }), [])
  useAbrirAlLlegar(nuevaDispensa, '1', form != null)
  const avanzar = useAvanzarFlujo()
  const [recibo, setRecibo] = useState<Dispensa | null>(null)

  /**
   * Cuantas entregas se dibujan de una.
   *
   * MEDIDO EN PRODUCCION EL 29/08/2026: esta pantalla ponia las 1.248 entregas
   * en el DOM al abrirla — 45.555 nodos y 4,3 segundos hasta que aparecia algo.
   * Lo sano para un telefono son mil quinientos o tres mil nodos.
   *
   * Y no era solo el DOM: por cada fila se llama `revisarDispensa` pasandole
   * `todas: dispensas`, asi que con 1.248 filas eran 1.248 x 1.248 — un millon
   * y medio de comparaciones cada vez que la pantalla se vuelve a dibujar.
   *
   * Se muestran las mas nuevas, que son las que se miran. El resto sigue estando
   * y se trae con el boton: no se oculta nada, se dibuja cuando hace falta.
   */
  const [tope, setTope] = useState(50)
  const [vista, setVista] = useState<'recibo' | 'comprobante'>('recibo')
  /**
   * «Se lo lleva y queda debiendo».
   *
   * NO es lo mismo que dejar el reembolso vacío, y esa es toda la razón por la
   * que existe: hasta hoy «todavía no cargué el aporte» y «no pagó» se
   * escribían igual, y el sistema tenía que adivinar cuál de las dos era.
   */
  const [quedaADeber, setQuedaADeber] = useState(false)
  const r = useMemo(() => resumirDispensas(dispensas), [dispensas])
  const bal = useMemo(() => balanceMateria(gramosCosechados, dispensas, lotes), [gramosCosechados, dispensas, lotes])
  /**
   * Los lotes que se ofrecen al anotar una entrega.
   *
   * Antes se listaban TODOS, con lo que habia ingresado cada uno. Como no decia
   * cuanto quedaba, la unica forma de saber de cual descontar era ir a la
   * planilla a buscar el numero de lote — y un lote agotado se ofrecia igual
   * que uno lleno.
   *
   * Ahora quedan los que tienen material, con el saldo a la vista.
   *
   * EL LOTE YA ELEGIDO SE OFRECE SIEMPRE, tenga saldo o no. Sin esto, editar
   * una entrega vieja cuyo lote quedo en cero borraba la unica referencia de
   * donde habia salido ese material: el `value` del select no encuentra su
   * `option`, el campo se ve vacio, y guardar lo pisa con null.
   */
  const lotesOfrecidos = useMemo(() => {
    const elegido = String(form?.lote_codigo ?? '').trim().toUpperCase()
    // Un lote desactivado no se ofrece, aunque le quede material: es el estado
    // con el que el Catalogo lo retira del estante. El ya elegido es la
    // excepcion de siempre — si no, editar una entrega vieja perderia su lote.
    const desactivados = new Set(lotes
      .filter(l => l.activo === false)
      .map(l => String(l.codigo ?? '').trim().toUpperCase()))
    return saldoDeLotes(lotes, dispensas)
      .filter(x => x.codigo.trim().toUpperCase() === elegido
        || (x.restante > 0 && !desactivados.has(x.codigo.trim().toUpperCase())))
  }, [lotes, dispensas, form?.lote_codigo])

  const hayCosto = costoPorGramo != null && costoPorGramo > 0
  // Tope de la ventana de 30 días: sale de la ficha del paciente y puede no
  // estar cargado, en cuyo caso la validación no corre.
  const topeDe = (id?: string | null) =>
    pacientes.find(p => p.id === id)?.tope_mensual_g ?? null
  // RN-01: el certificado caído bloquea la entrega. Es distinto de "no vinculado".
  const reprocannVencidoDe = (id?: string | null) => {
    const pac = pacientes.find(p => p.id === id)
    if (!pac) return undefined
    const hoy = new Date().toISOString().slice(0, 10)
    return pac.reprocann_estado === 'Vencido' ||
      (!!pac.reprocann_vencimiento && pac.reprocann_vencimiento < hoy)
  }
  // RN-05: la entrega anterior sin reporte AVISA acá (en el portal sí bloquea).
  const sinFeedbackDe = (id?: string | null) =>
    id ? feedbackPendiente(dispensas, feedbacks, id) : null
  const asociadoDe = (id?: string | null) => {
    const pac = pacientes.find(p => p.id === id)
    return asociados.find(a => a.nombre === pac?.nombre_completo)
  }
  const mandatoDe = (id?: string | null) => {
    const aso = asociadoDe(id)
    return aso ? aso.mandato_aceptado !== false : undefined
  }
  /** Por qué no hay firma, cuando la persona se asoció antes de que se pidiera. */
  const leyendaMandatoDe = (id?: string | null) => {
    const aso = asociadoDe(id)
    return aso ? leyendaDelMandato(aso) : null
  }

  // Un paciente está "vinculado" si figura como asociado con la vinculación hecha.
  const vinculado = (pacienteId?: string | null) =>
    !!pacienteId && asociados.some(a => a.paciente_id === pacienteId && a.vinculado_reprocann)

  const confirmar = useConfirm()
  // Apellido primero, como en toda la app.
  const nombrePaciente = (id?: string | null) => {
    const p = pacientes.find(x => x.id === id)
    return p ? nombreParaMostrar(p) : 'Sin paciente'
  }
  const nombreGenetica = (id?: string | null) => geneticas.find(g => g.id === id)?.nombre

  /**
   * Quién retira, para saber si su retiro sin aporte es deuda o parte de su pago.
   * La regla vive en `tipoDeMovimiento`, una sola vez: acá sólo se le pasa la
   * ficha, así la pantalla y el servicio no pueden decir cosas distintas.
   */
  const quienRetira = pacientes.find(p => p.id === form?.paciente_id) ?? null
  const tipoQueSeVaAGuardar = form
    ? tipoDeMovimiento(quedaADeber ? { ...form, aporte: 0 } : form, quienRetira)
    : null

  /**
   * Quiénes quedaron debiendo. En GRAMOS y no en pesos, a propósito: los gramos
   * están en la entrega y los pesos todavía no —la tarifa sugiere, no impone—.
   * Un saldo en pesos deducido de la tarifa es un número que el primer socio
   * que lo discuta tumba, y con él la confianza en toda la pantalla.
   */
  const deudores = useMemo(() => deudaPorSocio(dispensas), [dispensas])
  const totalAdeudado = deudores.reduce((t, v) => t + Math.max(0, v.saldo ?? 0), 0)
  const gramosSinDeclarar = deudores.reduce((t, v) => t + v.gramosSinDeclarar, 0)

  const cobrarDeuda = async (id: string) => {
    const pac = pacientes.find(p => p.id === id)
    const datos = await pedirDatos({
      titulo: `Cobrar deuda de ${pac ? nombreParaMostrar(pac) : 'el socio'}`,
      descripcion: 'Entra plata y no sale material. Se asienta en la caja, atado a esta persona.',
      campos: [
        { nombre: 'monto', etiqueta: 'Monto ($)', placeholder: '0' },
        { nombre: 'medio', etiqueta: 'Medio de pago', valorInicial: 'Transferencia' },
        { nombre: 'fecha', etiqueta: 'Fecha', valorInicial: new Date().toISOString().slice(0, 10) },
      ],
      confirmLabel: 'Registrar el cobro',
    })
    if (!datos) return
    const monto = Number(datos.monto)
    if (!(monto > 0)) { toast.error('El monto tiene que ser mayor a cero'); return }
    try {
      await ongService.registrarCobroDeDeuda({
        paciente_id: id, codigo: pac?.codigo ?? null,
        monto, medio: datos.medio, fecha: datos.fecha,
      })
      toast.success(`${fmtPesos(monto)} entraron a la caja como cobro de deuda`)
      onCambio()
    }
    catch (e) { toast.error((e as Error).message) }
  }

  const guardar = async () => {
    if (!form?.gramos || form.gramos <= 0) { toast.error('Cargá los gramos entregados'); return }
    if (!form?.fecha) { toast.error('Cargá la fecha'); return }
    if (quedaADeber && !form.paciente_id) {
      toast.error('Para que quede a deber hay que decir quién se lo lleva')
      return
    }
    try {
      // El interruptor vacía el aporte y fija el tipo. Se manda el tipo y no
      // sólo el aporte en cero porque son dos cosas distintas: cero es «no
      // pagó» y null sigue siendo «todavía no lo cargué».
      const aGuardar = quedaADeber
        ? { ...form, aporte: null, medio_pago: null, aporte_desglose: null,
            tipo_movimiento: tipoQueSeVaAGuardar,
            // La retribución del equipo no genera deuda: guardarle un esperado
            // sería declarar que se le va a cobrar.
            aporte_esperado: tipoQueSeVaAGuardar === 'entrega_a_cuenta' ? form.aporte_esperado ?? null : null }
        : { ...form, aporte_esperado: null }
      const { dispensa: guardada, caja: enCaja } = await ongService.guardarDispensa(aGuardar)
      // MOVER PLATA EN AUTOMATICO ESTA BIEN; HACERLO EN SILENCIO NO.
      //
      // El asiento ahora nace con la entrega, y eso incluye el caso incomodo:
      // vaciar el aporte de una entrega ya asentada BORRA su ingreso. Es lo
      // correcto —un ingreso sin entrega que lo declare es plata que la caja
      // cuenta y nadie respalda— pero es plata saliendo del libro, y el aviso
      // lo tiene que decir con el monto.
      const r = resumirAcciones(enCaja)
      toast.success(
        r.verbo === 'creo' ? `Entrega registrada, y ${fmtPesos(r.monto)} entraron a la caja`
          : r.verbo === 'corrigio' ? `Entrega guardada, y el asiento de caja quedó en ${fmtPesos(r.monto)}`
            : r.verbo === 'borro' ? `Entrega guardada, y ${fmtPesos(r.monto)} salieron de la caja`
              : quedaADeber
                ? `Registrada como ${labelMovimiento(tipoQueSeVaAGuardar).toLowerCase()}: no entró plata a la caja`
                : 'Entrega registrada')
      setForm(null)
      setQuedaADeber(false)
      onCambio()
      // Si esto es un paso de «Entregarle a un paciente», el paso siguiente es
      // el recibo de ESTA entrega. Se va con el id puesto: sin eso el paso
      // siguiente abre igual pero hay que buscar la entrega a mano en la lista,
      // que es el trabajo que el flujo viene a sacar del medio.
      avanzar(guardada?.id ? { entrega: guardada.id } : undefined)
    }
    catch (e) { toast.error((e as Error).message) }
  }
  /**
   * Borrar una entrega, y con ella la plata que entro por esa entrega.
   *
   * DOS COSAS ESTABAN MAL.
   *
   * 1. Usaba `window.confirm()`. En el telefono ese dialogo puede no aparecer,
   *    y cuando no aparece devuelve `false`: el boton no hacia NADA y tampoco
   *    decia por que. Es el mismo problema que ya se habia arreglado en Sala.
   *    Ahora usa el confirm propio de la app, que es un modal de verdad.
   *
   * 2. Dejaba la plata suelta. La FK de `ong_caja` hacia la dispensa es
   *    SET NULL, asi que borrar la entrega dejaba su reembolso ADENTRO de la
   *    caja, solo que sin nada que lo explique: el saldo seguia contando un
   *    ingreso que ya no tiene entrega detras. Los gramos si volvian solos,
   *    porque `saldoDeLotes` los calcula restando las dispensas — la plata no,
   *    porque un asiento es una fila.
   *
   * Ahora se borran juntos y la confirmacion lo dice con el monto, porque
   * borrar plata de la caja no puede pasar en silencio.
   */
  const borrar = async (d: Dispensa) => {
    const asientos = caja.filter(a => a.dispensa_id === d.id)
    const monto = asientos.reduce((t, a) => t + Math.abs(Number(a.monto) || 0), 0)
    const ok = await confirmar({
      titulo: `¿Borrar la entrega de ${d.gramos} g?`,
      descripcion:
        `Es la entrega a ${nombrePaciente(d.paciente_id)} del ${d.fecha}`
        + (d.lote_codigo ? `, del lote ${d.lote_codigo}` : '') + '. '
        + `Los ${d.gramos} g vuelven al saldo del lote.`
        + (asientos.length
          ? ` Y se borran tambien ${asientos.length} asiento${asientos.length === 1 ? '' : 's'} de caja `
            + `por ${fmtPesos(monto)}, que entraron por esta entrega: si quedaran, la caja `
            + 'seguiria contando esa plata sin nada que la respalde.'
          : ''),
      confirmLabel: 'Borrar',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      for (const a of asientos) await ongService.borrarAsiento(a.id)
      await ongService.borrarDispensa(d.id)
      toast.success(asientos.length ? `Borrada, y ${fmtPesos(monto)} salieron de caja` : 'Borrada')
      onCambio()
    } catch (e) { toast.error((e as Error).message) }
  }

  const devolver = async (d: Dispensa) => {
    const monto = fmtPesos(Math.abs(Number(d.aporte) || 0))
    // Devolver NO borra nada: registra un egreso. Por eso va con el confirm
    // comun y no con el de borrado, que pinta el boton de rojo y dice «Borrar».
    const ok = await confirmar({
      titulo: `¿Registrar ${monto} como devolución a ${nombrePaciente(d.paciente_id)}?`,
      descripcion: 'Sale de caja como egreso atado a esta entrega, y la entrega queda con '
        + 'aporte cero. Si en realidad era un signo mal tipeado, no uses esto: '
        + 'corregí el importe con Editar.',
      confirmLabel: 'Registrar devolución',
      variant: 'warning',
    })
    if (!ok) return
    try {
      await ongService.registrarDevolucion(d, caja)
      toast.success('Devolución registrada en caja')
      onCambio()
    } catch (e) { toast.error((e as Error).message) }
  }

  // Aviso en vivo mientras se carga, para no guardar algo mal y enterarse después.
  /** El pago se partio en mas de un medio: el total pasa a ser la suma. */
  const esMixto = form?.medio_pago === 'Mixto'

  const avisosForm = form
    ? revisarDispensa(
        { ...form, gramos: form.gramos ?? 0, fecha: form.fecha ?? '' } as Dispensa,
        {
          pacienteVinculado: form.paciente_id ? vinculado(form.paciente_id) : undefined,
          costoPorGramo, todas: dispensas,
          topeMensualG: topeDe(form.paciente_id),
          mandatoAceptado: mandatoDe(form.paciente_id),
          mandatoLeyenda: leyendaMandatoDe(form.paciente_id),
          reprocannVencido: reprocannVencidoDe(form.paciente_id),
          dispensaSinFeedback: sinFeedbackDe(form.paciente_id),
        })
    : []

  return (
    <div className="space-y-4">
      {/* Los recibos que nunca se emitieron. Va arriba de todo porque es una
          deuda del libro, no una tarea del día: al 23/08/2026 eran 846. */}
      <EmitirRecibosPendientes {...{ dispensas, documentos, pacientes, asociados, entidad }}
        onCambio={onCambio} />
      <div className={tarjeta}>
        <div className="flex items-center gap-2 flex-wrap">
          <HandCoins className="w-4 h-4 text-[#bef264]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">Dispensas</h3>
          <button onClick={nuevaDispensa}
            className={`${btnPrimario} flex-shrink-0`}><Plus className="w-3.5 h-3.5" /> Registrar</button>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2">
          Sólo se dispensa a pacientes con REPROCANN vinculado a esta ONG. Lo que entrega el paciente es un
          <b className="text-[#a6a6b5]"> reembolso de costos operativos</b>, no un precio: por encima del costo real
          deja de ser reembolso y empieza a parecerse a una venta.
        </p>
        {dispensas.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#1f1f2b] auto-rows-fr">
            <Kpi t="Entregado" v={`${r.gramos.toLocaleString('es-AR')} g`} c="#bef264" />
            <Kpi t="Dispensas" v={String(r.total)} c="#a6a6b5" />
            <Kpi t="Pacientes" v={String(r.pacientes)} c="#38bdf8" />
            <Kpi t="Reembolso por gramo"
              v={r.aportePorGramo != null ? `${fmtPesos(r.aportePorGramo)}/g` : '—'}
              c={hayCosto && r.aportePorGramo && r.aportePorGramo > costoPorGramo! * 1.05 ? '#ff8a7a' : '#d9f99d'} />
          </div>
        )}
        {/* Un costo en 0 no es "gratis" sino "todavía no se pudo calcular": sin
            gramos cosechados o sin costos cargados no hay contra qué comparar. */}
        {hayCosto && r.aportePorGramo != null ? (
          <p className="text-[11px] mt-2"
            style={{ color: r.aportePorGramo > costoPorGramo! * 1.05 ? '#ff8a7a' : '#8a8a9c' }}>
            Tu costo real de producción es <b className="font-mono">{fmtPesos(costoPorGramo!)}/g</b>.
            {r.aportePorGramo > costoPorGramo! * 1.05
              ? ' El reembolso lo está superando: por encima del costo real deja de ser reembolso.'
              : ' El reembolso está por debajo del costo, como corresponde.'}
          </p>
        ) : dispensas.length > 0 && (
          <p className="text-[11px] text-[#8a8a9c] mt-2">
            Todavía no se puede comparar contra el costo: falta cargar costos o gramos cosechados en Econometría.
          </p>
        )}
      </div>

      {/* QUIÉNES QUEDARON DEBIENDO (08/09/2026)
          Antes esto no se podía contestar: un retiro sin aporte y una entrega
          con el aporte todavía sin cargar se escribían igual. */}
      {deudores.length > 0 && (
        <div className={tarjeta}>
          <div className="flex items-center gap-2 mb-1">
            <HandCoins className="w-4 h-4 text-[#facc15]" strokeWidth={1.8} />
            <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Quedan a deber</h3>
          </div>
          <p className="text-[12px] text-[#8a8a9c] mb-3">
            {deudores.length} {deudores.length === 1 ? 'socio' : 'socios'} ·{' '}
            {deudores.reduce((t, v) => t + v.gramos, 0).toLocaleString('es-AR')} g retirados sin aporte
            {totalAdeudado > 0 && <> · <span className="font-mono text-[#facc15]">{fmtPesos(totalAdeudado)}</span> declarados</>}.
            {gramosSinDeclarar > 0 && <>
              {' '}Hay <span className="text-[#c9cabf]">{gramosSinDeclarar.toLocaleString('es-AR')} g</span>{' '}
              sin monto acordado: se cuentan en gramos y no en pesos. Deducirlos de la tarifa daría
              un número que nadie firmó.
            </>}
          </p>
          <div className="divide-y divide-[#2a2a3a]">
            {deudores.slice(0, 10).map(v => (
              <div key={v.paciente_id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] text-[#ececf1] truncate">{nombrePaciente(v.paciente_id)}</p>
                  <p className="text-[11px] text-[#8a8a9c]">
                    {v.saldo != null
                      ? <span className="font-mono text-[#facc15]">{fmtPesos(v.saldo)}</span>
                      : <span className="font-mono text-[#facc15]">{v.gramos.toLocaleString('es-AR')} g</span>}
                    {' '}en {v.retiros} {v.retiros === 1 ? 'retiro' : 'retiros'} · último {v.ultimo}
                    {v.pagado > 0 && <> · ya pagó <span className="font-mono text-[#d9f99d]">{fmtPesos(v.pagado)}</span></>}
                    {v.saldo != null && v.gramosSinDeclarar > 0 &&
                      <> · y {v.gramosSinDeclarar.toLocaleString('es-AR')} g sin monto acordado</>}
                  </p>
                </div>
                <button className={btnSutil} onClick={() => cobrarDeuda(v.paciente_id)}>Cobrar</button>
              </div>
            ))}
          </div>
          {deudores.length > 10 && (
            <p className="text-[11px] text-[#8a8a9c] mt-2">
              y {deudores.length - 10} más.
            </p>
          )}
        </div>
      )}

      {/* Balance de materia: lo primero que se pregunta en un control de
          trazabilidad. Cosechaste tanto, entregaste tanto, y la diferencia es
          lo que tenés que poder mostrar. */}
      {(bal.ingresado > 0 || dispensas.length > 0) && (
        <div className={tarjeta}>
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
            <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Balance de materia</h3>
          </div>
          <p className="text-[11px] text-[#8a8a9c] mb-3">
            De lo que entró a lo entregado. La diferencia es el stock que deberías tener.
          </p>
          <div className="flex items-stretch gap-2 flex-wrap sm:flex-nowrap">
            <Caja t="Ingresado" v={`${Math.round(bal.ingresado).toLocaleString('es-AR')} g`} c="#bef264" />
            <Flecha />
            <Caja t="Entregado" v={`${Math.round(bal.dispensado).toLocaleString('es-AR')} g`} c="#a78bfa" />
            <Flecha signo="=" />
            <Caja t="Stock" v={`${Math.round(bal.stock).toLocaleString('es-AR')} g`}
              c={bal.inconsistente ? '#ff8a7a' : '#38bdf8'} />
          </div>
          {/* De dónde salió lo ingresado. Sin esto, una entidad que compra el
              material ve un total que no puede explicar contra sus cosechas. */}
          <p className="text-[10px] text-[#8a8a9c] mt-2">
            {Math.round(bal.cosechado).toLocaleString('es-AR')} g cosechados
            {' · '}
            {Math.round(bal.comprado).toLocaleString('es-AR')} g comprados a terceros
          </p>
          {/* Lo que no se mide en gramos queda afuera del balance a propósito.
              Se dice, para que el número no parezca incompleto sin explicación. */}
          {bal.fueraDeBalance > 0 && (
            <p className="text-[10px] text-[#8a8a9c] mt-1">
              {bal.fueraDeBalance} entrega{bal.fueraDeBalance === 1 ? '' : 's'} fuera de este balance
              (aceite, accesorios): no se miden en gramos.
            </p>
          )}
          {bal.pctDispensado != null && !bal.inconsistente && (
            <>
              <div className="mt-3 h-1.5 rounded-full bg-[#1f1f2b] overflow-hidden">
                <div className="h-full rounded-full bg-[#a78bfa]" style={{ width: `${Math.min(100, bal.pctDispensado)}%` }} />
              </div>
              <p className="text-[10px] text-[#8a8a9c] mt-1">
                Entregaste el {bal.pctDispensado.toFixed(1)}% de lo que ingresó.
              </p>
            </>
          )}
          {bal.inconsistente && (
            <p className="flex items-start gap-1.5 text-[11px] text-[#ff8a7a] mt-2">
              <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              Entregaste más de lo que ingresó. No es posible: puede faltar cargar
              lotes comprados, o haber un error en cosechas o dispensas.
            </p>
          )}
        </div>
      )}

      {dispensas.length === 0 ? (
        <p className="text-[13px] text-[#8a8a9c] text-center py-8">Sin dispensas registradas.</p>
      ) : (
        <div className="space-y-2">
          {dispensas.slice(0, tope).map(d => {
            const avisos = revisarDispensa(d, {
              pacienteVinculado: d.paciente_id ? vinculado(d.paciente_id) : undefined,
              costoPorGramo, todas: dispensas,
              topeMensualG: topeDe(d.paciente_id), mandatoAceptado: mandatoDe(d.paciente_id),
              mandatoLeyenda: leyendaMandatoDe(d.paciente_id),
              reprocannVencido: reprocannVencidoDe(d.paciente_id),
              dispensaSinFeedback: sinFeedbackDe(d.paciente_id),
            })
            // Misma caída que en el comprobante: si no hay genética vinculada,
            // la variedad está en `producto`. Las 1.241 tienen genetica_id en
            // null y el nombre de la cepa en producto.
            const gen = nombreGenetica(d.genetica_id) ?? (d.producto?.trim() || null)
            return (
              <div key={d.id} className={tarjeta}>
                <div className="flex items-start gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold text-[13px] text-[#ececf1]">
                      {nombrePaciente(d.paciente_id)}
                      <span className="text-[#d9f99d] font-mono"> · {d.gramos} g</span>
                      <span className="text-[#8a8a9c] font-normal"> · {fmtFecha(d.fecha)}</span>
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1.5 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded border border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5]">{d.producto}</span>
                      {gen && <span className="px-1.5 py-0.5 rounded border border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5]">{gen}</span>}
                      <span className="px-1.5 py-0.5 rounded border border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5]">{d.modalidad}</span>
                      {d.con_receta && <span className="px-1.5 py-0.5 rounded border border-[#404d20] bg-[#a3e635]/10 text-[#bef264]">con receta</span>}
                      {d.aporte != null && <span className="px-1.5 py-0.5 rounded border border-[#2a2a3a] bg-[#15151d] text-[#facc15]">{fmtPesos(d.aporte)}</span>}
                    </div>
                    {avisos.map((a, i) => (
                      <p key={i} className="flex items-start gap-1.5 text-[11px] mt-1.5"
                        style={{ color: a.nivel === 'error' ? '#ff8a7a' : '#f59e0b' }}>
                        {a.nivel === 'error' ? <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                        {a.texto}
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setRecibo(d)} className={btnSutil}
                      aria-label="Recibo por reembolso de costos" title="Recibo por reembolso">
                      <Receipt className="w-3.5 h-3.5" />
                    </button>
                    {(d.aporte ?? 0) < 0 && (
                      <button onClick={() => devolver(d)} className={btnSutil}
                        aria-label="Registrar como devolución"
                        title="El aporte está en negativo. Registrarlo como devolución: sale de caja y la entrega queda sin aporte.">
                        <Undo2 className="w-3.5 h-3.5 text-[#facc15]" />
                      </button>
                    )}
                    <button onClick={() => setForm(d)} className={btnSutil} aria-label="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => borrar(d)} className={btnSutil} aria-label="Borrar"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            )
          })}
          {dispensas.length > tope && (
            <button onClick={() => setTope(t => t + 200)}
              className={`${btnSutil} w-full justify-center`}>
              Ver más · quedan {(dispensas.length - tope).toLocaleString('es-AR')}
            </button>
          )}
        </div>
      )}

      {recibo && (() => {
        const pac = pacientes.find(p => p.id === recibo.paciente_id) ?? null
        // El asociado se ubica por nombre: la dispensa apunta al paciente y el
        // mandato lo firma el asociado, que suele ser la misma persona.
        const aso = asociados.find(a => a.nombre === pac?.nombre_completo) ?? null
        // Los dos papeles de una entrega: uno documenta la plata, el otro la
        // entrega y el cupo que queda. Van juntos porque salen del mismo hecho.
        const cupo = recibo.paciente_id && pac?.tope_mensual_g
          ? cupoMovil30Dias(dispensas, recibo.paciente_id, recibo.fecha, pac.tope_mensual_g, recibo.id)
          : null
        const doc = vista === 'recibo'
          ? reciboReembolso(recibo, entidad, pac, aso)
          : comprobanteDispensacion(recibo, entidad, pac, cupo, nombreGenetica(recibo.genetica_id))

        // Numerar es un acto deliberado, no un efecto de abrir la pantalla: si
        // el número se asignara al abrir, mirar diez recibos quemaría diez
        // números del talonario. Por eso es un botón, y sólo aparece cuando
        // todavía no tiene.
        const numerar = async () => {
          try {
            const n = await ongService.asignarNumeroRecibo(recibo.id)
            setRecibo({ ...recibo, recibo_numero: n })
            toast.success(`Recibo N° ${n}`)
            onCambio()
          } catch (e) { toast.error((e as Error).message) }
        }
        return <VisorDocumento titulo={doc.titulo} texto={doc.texto} faltantes={doc.faltantes}
          entidad={entidad}
          onEmitido={onCambio}
          archivo={{
            subtipo: vista === 'recibo' ? 'Recibo de reembolso' : 'Comprobante de dispensa',
            numero: recibo.recibo_numero != null ? String(recibo.recibo_numero) : null,
            paciente_id: recibo.paciente_id ?? null,
            dispensa_id: recibo.id || null,
            monto: vista === 'recibo' ? (Number(recibo.aporte) || null) : null,
          }}
          nota={vista === 'recibo'
            ? 'Documenta el dinero. La leyenda del pie va completa: es lo que sostiene que la entrega no es una ' +
              'compraventa sino el reembolso de los costos de un mandato.'
            : 'Documenta la entrega: variedad, lote y cuánto cupo le queda en la ventana de 30 días.'}
          extra={
            <div className="flex items-center gap-2 flex-wrap">
            {vista === 'recibo' && !recibo.recibo_numero && (
              <button onClick={numerar} className={btnSutil}>
                <Receipt className="w-3.5 h-3.5" /> Darle número
              </button>
            )}
            <div className="flex rounded-lg border border-[#2a2a3a] overflow-hidden">
              {(['recibo', 'comprobante'] as const).map(v => (
                <button key={v} onClick={() => setVista(v)}
                  className={`px-2.5 py-2 sm:py-1 min-h-[44px] sm:min-h-0 text-[11px] font-medium transition-colors ${
                    vista === v ? 'bg-[#a3e635]/15 text-[#d9f99d]' : 'text-[#8a8a9c] hover:text-[#d4d4dd]'}`}>
                  {v === 'recibo' ? 'Recibo' : 'Comprobante'}
                </button>
              ))}
            </div>
            </div>
          }
          onCerrar={() => setRecibo(null)} />
      })()}

      {form && (
        <Modal titulo={form.id ? 'Editar dispensa' : 'Entregarle a un paciente'}
          onCerrar={() => { setForm(null); setQuedaADeber(false) }} onGuardar={guardar}>
          <div className="space-y-3">
            {!form.id && <GuiaDelFormulario id="entregar" />}
            <label><span className={etiquetaCampo}>Paciente</span>
              {/* Era un `<select>` con las 151 fichas: para entregarle a alguien
                  había que scrollear hasta encontrarlo. Ahora se escribe. */}
              <SelectorPersona
                personas={pacientes}
                valor={form.paciente_id}
                onElegir={id => setForm({ ...form, paciente_id: id })}
                etiquetaExtra={p => (vinculado(p.id) ? null : 'sin vincular')} />
              <AyudaCampo id="entregar" campo="Paciente" /></label>

            {/* El lote FALTABA, y no es un detalle de comodidad.
                Sin lote la entrega no se descuenta de ningún lado: el stock
                queda alto, el lote no aparece sobregirado, y el balance de
                materia no cierra. Sólo el flujo de reserva del portal lo
                asignaba, así que toda entrega cargada a mano rompía el cruce. */}
            <label><span className={etiquetaCampo}>Lote</span>
              <select className={inputFormulario} value={form.lote_codigo ?? ''}
                onChange={e => setForm({ ...form, lote_codigo: e.target.value || null })}>
                <option value="">Sin especificar</option>
                {lotesOfrecidos.map(x => (
                  <option key={x.codigo} value={x.codigo}>{x.codigo} — {etiquetaSaldo(x)}</option>
                ))}
              </select>
              {/* Que el desplegable quede vacio no es lo mismo que no haya
                  lotes: puede ser que esten todos entregados. Decirlo evita que
                  se cargue la entrega «sin especificar», que es justamente lo
                  que despues no descuenta de ningun lado. */}
              {lotesOfrecidos.length === 0 && lotes.length > 0 && (
                <span className="mt-1 block text-[11px] text-[#f59e0b]">
                  Los {lotes.length} lotes cargados ya se entregaron enteros. Si esta entrega sale
                  de material nuevo, cargá primero el lote de ingreso.
                </span>
              )}
              <AyudaCampo id="entregar" campo="Lote" /></label>

            <div className="grid grid-cols-2 gap-3">
              <label><span className={etiquetaCampo}>Fecha</span>
                <input type="date" className={inputFormulario} value={form.fecha ?? ''} onChange={e => setForm({ ...form, fecha: e.target.value })} />
                <AyudaCampo id="entregar" campo="Fecha" /></label>
              <label><span className={etiquetaCampo}>Gramos</span>
                <input type="number" step="0.1" className={inputFormulario} value={form.gramos ?? ''} onChange={e => setForm({ ...form, gramos: +e.target.value })} />
                <AyudaCampo id="entregar" campo="Gramos" /></label>
              <label><span className={etiquetaCampo}>Producto</span>
                <select className={inputFormulario} value={form.producto ?? 'flor'} onChange={e => setForm({ ...form, producto: e.target.value })}>
                  {PRODUCTOS_DISPENSA.map(p => <option key={p} value={p}>{p}</option>)}
                </select></label>
              <label><span className={etiquetaCampo}>Genética</span>
                <select className={inputFormulario} value={form.genetica_id ?? ''} onChange={e => setForm({ ...form, genetica_id: e.target.value || null })}>
                  <option value="">Sin especificar</option>
                  {geneticas.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select></label>
              <label><span className={etiquetaCampo}>Reembolso ($)</span>
                {/* Con el pago partido el total lo calcula la suma y el campo se
                    bloquea. Dejarlo editable permitiria un total que no coincide
                    con su propio desglose, que es justo el descuadre que este
                    campo viene a resolver. */}
                <input type="number" className={inputFormulario} value={quedaADeber ? '' : (form.aporte ?? '')}
                  readOnly={esMixto || quedaADeber} disabled={esMixto || quedaADeber}
                  title={quedaADeber ? 'Queda a deber: no entra plata hoy'
                    : esMixto ? 'Con pago partido, el total es la suma del desglose' : undefined}
                  onChange={e => setForm({ ...form, aporte: e.target.value === '' ? null : +e.target.value })} />
                <AyudaCampo id="entregar" campo="Reembolso ($)" /></label>

              {/* SE LO LLEVA Y QUEDA DEBIENDO (08/09/2026)
                  Un gesto, no una taxonomia. Socio carga con gente esperando: si
                  tuviera que elegir entre siete tipos, elegiria mal, y a los dos
                  meses la cuenta corriente seria basura. El tipo lo deduce el
                  sistema y la pantalla lo dice, para que se pueda desmentir. */}
              <div className="col-span-2">
                <label className="flex items-center gap-2.5 min-h-[44px] sm:min-h-0 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-[#a3e635]"
                    checked={quedaADeber}
                    onChange={e => {
                      setQuedaADeber(e.target.checked)
                      // Se precarga SOLO si hay un acuerdo en la ficha. Sin
                      // acuerdo el campo queda vacío: un monto sugerido que
                      // nadie pactó se guarda tal cual y despues se discute.
                      const acordado = quienRetira?.aporte_acordado_g
                      if (e.target.checked && acordado && form.gramos) {
                        setForm({ ...form, aporte_esperado: Math.round(acordado * form.gramos) })
                      }
                    }} />
                  <span className="text-[13px] text-[#a6a6b5]">Se lo lleva y queda debiendo</span>
                </label>
                {quedaADeber && (
                  <p className="mt-1 text-[12px] text-[#8a8a9c]">
                    Se registra como <span className="text-[#d9f99d]">{labelMovimiento(tipoQueSeVaAGuardar).toLowerCase()}</span>.
                    {tipoQueSeVaAGuardar === 'retribucion_en_especie'
                      ? ' No genera deuda: es parte del pago de quien trabaja.'
                      : ' No entra plata a la caja hoy.'}
                  </p>
                )}
                {/* LO ACORDADO SE DECLARA, NO SE DEDUCE.
                    Calcularlo como gramos x tarifa daria un numero que nadie
                    firmo: la tarifa sugiere y no impone, y 703 de 704 aportes
                    son multiplos de mil. Se precarga desde el acuerdo de la
                    ficha cuando lo hay, y queda editable siempre. */}
                {quedaADeber && tipoQueSeVaAGuardar === 'entrega_a_cuenta' && (
                  <label className="block mt-2">
                    <span className={etiquetaCampo}>Debería aportar ($)</span>
                    <input type="number" className={inputFormulario}
                      value={form.aporte_esperado ?? ''}
                      placeholder={quienRetira?.aporte_acordado_g ? undefined : 'Si no se acordó un monto, dejalo vacío'}
                      onChange={e => setForm({ ...form, aporte_esperado: e.target.value === '' ? null : +e.target.value })} />
                    <span className="text-[11px] text-[#8a8a9c]">
                      {form.aporte_esperado == null
                        ? 'Vacío es «no se acordó cuánto», que no es lo mismo que cero. El retiro se registra igual y el saldo queda en gramos.'
                        : <>Queda debiendo <span className="font-mono text-[#facc15]">{fmtPesos(form.aporte_esperado)}</span>.</>}
                    </span>
                  </label>
                )}
              </div>
              {/* EL MEDIO DE PAGO NO ESTABA. (30/08/2026)
                  El formulario no tenia el campo, asi que toda entrega cargada
                  desde la app guardaba `medio_pago` en null y su asiento caia en
                  «sin discriminar»: hoy son $X.XXX.XXX sobre 1.827 asientos, y
                  con el efectivo en −$X.XXX.XXX —un numero imposible— nadie
                  puede hacer un arqueo. */}
              <label><span className={etiquetaCampo}>Medio de pago</span>
                <select className={inputFormulario} value={quedaADeber ? '' : (form.medio_pago ?? '')}
                  disabled={quedaADeber}
                  onChange={e => {
                    const medio = e.target.value || null
                    // Salir de «Mixto» borra el desglose: si quedara colgado, la
                    // caja seguiria partiendo el asiento por un desglose que la
                    // pantalla ya no muestra.
                    setForm(medio === 'Mixto'
                      ? { ...form, medio_pago: medio, aporte_desglose: form.aporte_desglose ?? { Efectivo: 0, Transferencia: 0 } }
                      : { ...form, medio_pago: medio, aporte_desglose: null })
                  }}>
                  <option value="">Sin especificar</option>
                  {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <AyudaCampo id="entregar" campo="Medio de pago" /></label>
              {esMixto && (
                <div className="col-span-2 rounded-lg border border-[#2a2a3a] bg-[#15151d] p-3">
                  <p className="text-[11px] text-[#a6a6b5] leading-relaxed mb-2.5">
                    Cuánto entró por cada medio. Cada uno va a la caja como su
                    propia fila, que es lo que permite arquear el efectivo por
                    separado del banco.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {(['Efectivo', 'Transferencia'] as const).map(medio => (
                      <label key={medio}><span className={etiquetaCampo}>{medio} ($)</span>
                        <input type="number" className={inputFormulario}
                          value={form.aporte_desglose?.[medio] || ''}
                          onChange={e => {
                            const des = { ...(form.aporte_desglose ?? {}), [medio]: e.target.value === '' ? 0 : +e.target.value }
                            const total = Object.values(des).reduce((t, n) => t + (Number(n) || 0), 0)
                            setForm({ ...form, aporte_desglose: des, aporte: total })
                          }} />
                      </label>
                    ))}
                  </div>
                  <p className="text-[12px] text-[#d4d4dd] mt-2.5 pt-2.5 border-t border-[#1f1f2b] tabular-nums">
                    Total: <b className="text-[#bef264]">{fmtPesos(Number(form.aporte) || 0)}</b>
                  </p>
                </div>
              )}
              <label><span className={etiquetaCampo}>Modalidad</span>
                <select className={inputFormulario} value={form.modalidad ?? 'retiro'} onChange={e => setForm({ ...form, modalidad: e.target.value })}>
                  <option value="retiro">Retiro en sede</option>
                  <option value="envio">Envío</option>
                </select></label>
            </div>
            <label><span className={etiquetaCampo}>Entregado por</span>
              <input className={inputFormulario} value={form.entregado_por ?? ''} onChange={e => setForm({ ...form, entregado_por: e.target.value })} /></label>
            <button type="button" onClick={() => setForm({ ...form, con_receta: !form.con_receta })}
              className="inline-flex items-center gap-2 text-[12px] text-[#d4d4dd] min-h-[44px] sm:min-h-0">
              <span className="w-4 h-4 rounded border flex items-center justify-center text-[10px] text-[#07070b]"
                style={form.con_receta ? { background: '#a3e635', borderColor: '#a3e635' } : { borderColor: '#2a2a3a' }}>
                {form.con_receta ? '✓' : ''}
              </span>
              Respaldada con receta (necesario arriba de {TOPE_TRASLADO_INDIVIDUAL_G} g)
            </button>
            <AyudaCampo id="entregar" campo="Con receta" />

            {avisosForm.length > 0 && (
              <div className="rounded-lg border p-2.5 space-y-1"
                style={{ background: 'rgba(122,40,32,0.08)', borderColor: '#5a3a30' }}>
                {avisosForm.map((a, i) => (
                  <p key={i} className="text-[11px]" style={{ color: a.nivel === 'error' ? '#ff8a7a' : '#f59e0b' }}>{a.texto}</p>
                ))}
              </div>
            )}
            {!form.id && <OjoDelFormulario id="entregar" />}
          </div>
        </Modal>
      )}
    </div>
  )
}

function Caja({ t, v, c }: { t: string; v: string; c: string }) {
  return (
    <div className="flex-1 min-w-[92px] rounded-lg bg-[#15151d] border border-[#1f1f2b] px-3 py-2.5 text-center">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">{t}</div>
      <div className="text-[16px] font-mono tabular-nums font-bold mt-1" style={{ color: c }}>{v}</div>
    </div>
  )
}

function Flecha({ signo = '−' }: { signo?: string }) {
  return <div className="flex items-center text-[#8a8a9c] text-[15px] font-mono px-0.5">{signo}</div>
}


/**
 * El pie pegajoso lleva la ACCIÓN, no sólo el cierre.
 *
 * Tenía «Cerrar» fijo abajo y «Guardar» adentro del contenido que scrollea. En
 * el formulario de entrega —el más usado del sistema— el contenido mide 1.367 px
 * contra 717 de panel: la acción principal quedaba a 650 px de scroll mientras
 * la que casi nadie toca estaba siempre a la vista. Al revés de lo que hace
 * `ModalFormulario`, que ya lleva Cancelar + Guardar en el pie.
 */
function Modal({ titulo, onCerrar, onGuardar, children }: {
  titulo: string; onCerrar: () => void; onGuardar?: () => void; children: React.ReactNode
}) {
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
        <div className="px-4 py-3 border-t border-[#1f1f2b] sticky bottom-0 bg-[#101016] flex gap-2">
          <button onClick={onCerrar} className="min-h-[44px] px-4 flex items-center justify-center rounded-lg border border-[#2a2a3a] text-[12px] text-[#a6a6b5] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">
            {onGuardar ? 'Cancelar' : 'Cerrar'}
          </button>
          {onGuardar && (
            <button onClick={onGuardar} className={`${btnPrimario} flex-1 justify-center`}>Guardar</button>
          )}
        </div>
      </div>
    </div>
  )
}
