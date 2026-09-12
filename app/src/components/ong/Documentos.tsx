// Archivo de papeles de la asociación, de las dos puntas.
//
// Emitidos: lo que la ONG entrega y va a nombre de alguien (constancia de socio,
// recibo de cuota, comprobante de dispensa).
// Gastos: el respaldo de que la plata salió. Sin comprobante, el costo por gramo
// que muestra Econometría es una afirmación sin prueba, y el aporte del paciente
// se compara contra un número que no se puede defender.
//
// Los archivos van a un bucket PRIVADO: en la base se guarda el path y se pide
// una URL firmada para verlos (ver lib/archivos.ts).

import { useMemo, useState, useCallback } from 'react'
import { useAbrirAlLlegar } from '../../lib/useAbrirAlLlegar'
import { useAvanzarFlujo } from '../../lib/useAvanzarFlujo'
import { idDeLaUrl } from '../../lib/contextoDeFlujo'
import { GuiaDelFormulario, AyudaCampo, OjoDelFormulario } from './GuiaDelFormulario'
import { tipoDocumentoDe } from '../../lib/tiposDocumento'
import { proximoNumeroDeOrden, numeroRepetido } from '../../lib/numeroDeOrden'
import { toast } from 'sonner'
import {
  FileStack, Plus, Pencil, Trash2, Upload, Paperclip, ExternalLink, X,
  Loader2, ReceiptText, FileCheck2, AlertTriangle, ChevronRight, FileText,
} from 'lucide-react'
import {
  ongService, resumenDocumentos, gastosPorConcepto, BUCKET_DOCS,
  SUBTIPOS_EMITIDO, SUBTIPOS_GASTO, CATEGORIAS_GASTO,
  type DocumentoONG, type Asociado, type Dispensa, type Entidad, type AsientoCaja,
} from '../../lib/ong'
import { urlFirmada } from '../../lib/archivos'
import { PlantillasInstitucionales, type VariedadFicha } from './PlantillasInstitucionales'
import { VisorDocumento } from './ActaParaLibro'
import type { Paciente } from '../../lib/registro'
import { btnPrimario, btnSutil, tarjeta, etiquetaCampo, inputFormulario } from '../../lib/ui'
import { SelectorProveedor } from './SelectorProveedor'
import { SelectorPersona } from './SelectorPersona'
import { proveedoresPorRubro, type ConProveedor } from '../../lib/proveedores'
import { useDialogo } from '../../lib/useDialogo'
import { confirmarBorrado } from '../../lib/confirmar'
import { Kpi } from './Kpi'

const fmtPesos = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

export function Documentos({ documentos, asociados, pacientes, dispensas, caja, entidad = null, autoridades = [], variedades = [], actas = [], lotes = [], onCambio }: {
  documentos: DocumentoONG[]; asociados: Asociado[]; pacientes: Paciente[]
  dispensas: Dispensa[]
  /** Para el registro de caja del respaldo histórico. */
  caja?: AsientoCaja[]
  /** Lo que necesitan las plantillas institucionales para completarse solas. */
  entidad?: Entidad | null
  autoridades?: { nombre: string; cargo: string; activo?: boolean }[]
  variedades?: VariedadFicha[]
  actas?: { numero: number; fecha: string; tipo: string }[]
  /** Para que la lista de proveedores sea la misma que la del lote. */
  lotes?: ConProveedor[]
  onCambio: () => void
}) {
  const [vista, setVista] = useState<'emitido' | 'gasto'>('emitido')
  const [form, setForm] = useState<Partial<DocumentoONG> | null>(null)
  /** El documento abierto en grande. Se lee y se imprime desde ahí. */
  /**
   * El documento abierto, CON su texto.
   *
   * El listado ya no trae `notas` —eran 950 kB de papeles en cada carga— así
   * que al abrir uno hay que ir a buscarlo. Es una consulta por id y sólo
   * cuando alguien toca «Ver e imprimir».
   */
  const [viendo, setViendo] = useState<DocumentoONG | null>(null)

  const verDocumento = async (d: DocumentoONG) => {
    // Se abre YA, con lo que hay, y el texto llega cuando llega. Esperar la
    // consulta para recién ahí abrir el visor se siente como que el botón no
    // hizo nada.
    setViendo(d)
    if (d.notas != null) return
    try {
      const notas = await ongService.getNotasDocumento(d.id)
      setViendo(v => (v && v.id === d.id ? { ...v, notas } : v))
    }
    catch (e) { toast.error(`No se pudo traer el texto: ${(e as Error).message}`) }
  }
  const r = useMemo(() => resumenDocumentos(documentos), [documentos])
  const lista = documentos.filter(d => d.tipo === vista)

  /**
   * Cuantos papeles se dibujan de una. Mismo motivo que en Dispensas: son 1.551
   * documentos y ponerlos todos en el DOM al abrir la pantalla la hace lenta en
   * un telefono. Se muestran los mas nuevos y el resto se trae con el boton.
   */
  const [tope, setTope] = useState(40)

  const nuevo = useCallback(
    () => setForm({ tipo: vista, fecha: new Date().toISOString().slice(0, 10) }),
    [vista])

  // `?nueva=gasto` abre el formulario YA en comprobante de gasto, sin depender
  // de en que solapa estaba parada la pantalla. La accion «Comprar material»
  // viene a cargar una orden, y si abriera en «documento emitido» habria que
  // cambiar el tipo a mano antes de empezar.
  // También cambia la vista, y no es cosmético: si sólo se abriera el formulario,
  // al cerrarlo la pantalla seguiría en «Emitidos» y el botón de arriba ofrecería
  // el formulario contrario. Alguien que viene guiado a cargar una orden termina
  // emitiendo una constancia de socio sin que nada avise.
  //
  // Y si viene de «Anotar un gasto» o de «Comprarle a un proveedor», el asiento
  // de caja ya cargado viaja en la URL: el comprobante llega con la fecha, el
  // monto y el concepto puestos, en vez de pedir de nuevo lo que se acaba de
  // tipear en la pantalla anterior.
  const nuevoGasto = useCallback(() => {
    const id = idDeLaUrl(window.location.search, 'asiento')
    const a = id ? caja?.find(x => x.id === id) : null
    setVista('gasto')
    setForm({
      tipo: 'gasto',
      fecha: a?.fecha ?? new Date().toISOString().slice(0, 10),
      monto: a?.monto ?? null,
      // El concepto del asiento es la mejor descripcion que tenemos: dice en
      // que se fue la plata. `detalle` es mas especifico cuando existe.
      descripcion: a ? (a.detalle?.trim() || a.concepto) : null,
    })
  }, [caja])
  useAbrirAlLlegar(nuevoGasto, 'gasto', form != null)

  // Y `?nueva=1` abre el de documento emitido, que es el otro lado de la misma
  // pantalla. Faltaba: la accion «Emitir un documento» llegaba con `nueva=1`,
  // nadie lo leia, y quedaba en la lista con el parametro colgado en la URL.
  const nuevoEmitido = useCallback(() => {
    setVista('emitido')
    setForm({ tipo: 'emitido', fecha: new Date().toISOString().slice(0, 10) })
  }, [])
  useAbrirAlLlegar(nuevoEmitido, '1', form != null)

  // Y `?nueva=dispensa` abre el MISMO formulario de emitido pero ya en la clase
  // que el paso viene a pedir, y ligado a la entrega que lo trajo.
  //
  // Con `nueva=1` a secas abria en «Sin especificar» y con el select de dispensa
  // en «—»: la persona llegaba guiada hasta un formulario que no sabia nada de
  // lo que acababa de hacer, y tenia que elegir a mano la clase de papel y
  // despues buscar su entrega entre las ultimas cien.
  //
  // La entrega se lee de la URL viva y no del `search` del render: este callback
  // tiene que ser estable —si cambia, el efecto que lo llama se redispara— y
  // corre dentro de un efecto, cuando la URL ya es la definitiva.
  const nuevoComprobanteDispensa = useCallback(() => {
    const entrega = idDeLaUrl(window.location.search, 'entrega')
    const d = entrega ? dispensas.find(x => x.id === entrega) : null
    setVista('emitido')
    setForm({
      tipo: 'emitido',
      subtipo: 'Comprobante de dispensa',
      fecha: d?.fecha ?? new Date().toISOString().slice(0, 10),
      dispensa_id: d?.id ?? null,
      paciente_id: d?.paciente_id ?? null,
      monto: d?.aporte ?? null,
    })
  }, [dispensas])
  useAbrirAlLlegar(nuevoComprobanteDispensa, 'dispensa', form != null)

  const borrar = async (d: DocumentoONG) => {
    if (!(await confirmarBorrado(`¿Borrar "${d.descripcion || d.archivo_nombre || 'el documento'}"${d.archivo_path ? ' y su archivo' : ''}?`))) return
    try { await ongService.borrarDocumento(d); toast.success('Borrado'); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="space-y-4">
      <div className={tarjeta}>
        <div className="flex items-center gap-2 flex-wrap">
          <FileStack className="w-4 h-4 text-[#c4b5fd]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">Documentos</h3>
          <button onClick={nuevo} className={`${btnPrimario} flex-shrink-0`}>
            <Plus className="w-3.5 h-3.5" /> {vista === 'emitido' ? 'Emitir documento' : 'Cargar comprobante'}
          </button>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2">
          Dos puntas: lo que la asociación <b className="text-[#a6a6b5]">emite</b> a nombre de alguien, y los
          <b className="text-[#a6a6b5]"> comprobantes de gasto</b> que respaldan lo que se pagó. Sin comprobante,
          el costo por gramo es un número que no se puede defender.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#1f1f2b] auto-rows-fr">
          <Kpi t="Emitidos" v={String(r.emitidos)} c="#c4b5fd" />
          <Kpi t="Comprobantes" v={String(r.gastos)} c="#38bdf8" />
          <Kpi t="Gasto respaldado" v={fmtPesos(r.totalGastos)} c="#facc15" />
          <Kpi t="Con archivo" v={`${r.gastosConArchivo + r.emitidosConArchivo}/${documentos.length}`}
            c={documentos.length > 0 && r.gastosConArchivo + r.emitidosConArchivo < documentos.length ? '#f59e0b' : '#bef264'} />
        </div>

        <div className="flex gap-2 mt-3">
          {(['emitido', 'gasto'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)}
              className={`flex items-center gap-1.5 text-[12px] px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border transition-colors ${
                vista === v ? 'border-[#a3e635]/50 bg-[#a3e635]/10 text-[#d9f99d]' : 'border-[#2a2a3a] text-[#8f8f9f] hover:text-[#d4d4dd]'}`}>
              {v === 'emitido' ? <FileCheck2 className="w-3.5 h-3.5" /> : <ReceiptText className="w-3.5 h-3.5" />}
              {v === 'emitido' ? 'Emitidos' : 'Gastos'}
              <span className="font-mono tabular-nums text-[11px] opacity-70">{v === 'emitido' ? r.emitidos : r.gastos}</span>
            </button>
          ))}
        </div>
      </div>

      {viendo && (
        <VisorDocumento
          titulo={viendo.descripcion || viendo.subtipo || 'Documento'}
          texto={viendo.notas ?? ''}
          // Lo que quedó entre corchetes al emitirlo: se marca igual que en las
          // plantillas, para que se vea qué falta antes de firmar.
          faltantes={[...(viendo.notas ?? '').matchAll(/\[([^\]]+)\]/g)]
            .map(m => m[1])
            .filter((v, i, a) => a.indexOf(v) === i)}
          entidad={entidad}
          yaArchivado
          nota={'Para completar lo que está entre corchetes, cerrá esto y tocá el lápiz: el texto se edita ahí y queda guardado.'}
          onCerrar={() => setViendo(null)} />
      )}

      <PlantillasInstitucionales {...{ entidad, asociados, pacientes, autoridades, variedades, actas, dispensas, documentos, caja }}
        onEmitido={onCambio} />

      {/* Reparto del gasto por rubro: el cruce contra Econometría */}
      {vista === 'gasto' && r.porCategoria.length > 0 && (
        <div className={tarjeta}>
          <h3 className="font-display font-semibold text-[13px] text-[#ececf1]">Gasto respaldado por rubro</h3>
          <div className="mt-2 space-y-1.5">
            {r.porCategoria.map(c => (
              <Rubro key={c.categoria} c={c} total={r.totalGastos} documentos={documentos} />
            ))}
          </div>
          <p className="text-[11px] text-[#8a8a9c] mt-2">
            Este total es sólo lo que tiene comprobante cargado acá. Econometría calcula el costo con todos
            los insumos, tengan papel o no: si los números no coinciden, faltan comprobantes.
            Tocá un rubro para ver en qué se fue.
          </p>
        </div>
      )}

      {lista.length === 0 ? (
        <p className="text-[13px] text-[#8a8a9c] text-center py-8">
          {vista === 'emitido'
            ? 'Todavía no emitiste ningún documento.'
            : 'Todavía no cargaste comprobantes de gasto.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lista.slice(0, tope).map(d => (
            <Ficha key={d.id} d={d} asociados={asociados} pacientes={pacientes}
              onEditar={() => setForm(d)} onBorrar={() => borrar(d)}
              onVer={() => verDocumento(d)} />
          ))}
          {lista.length > tope && (
            <button onClick={() => setTope(t => t + 200)}
              className={`${btnSutil} w-full justify-center md:col-span-2`}>
              Ver más · quedan {(lista.length - tope).toLocaleString('es-AR')}
            </button>
          )}
        </div>
      )}

      {form && (
        <FormDocumento form={form} setForm={setForm} asociados={asociados}
          pacientes={pacientes} dispensas={dispensas} documentos={documentos}
          lotes={lotes} onCambio={onCambio} />
      )}
    </div>
  )
}

function Ficha({ d, asociados, pacientes, onEditar, onBorrar, onVer }: {
  d: DocumentoONG; asociados: Asociado[]; pacientes: Paciente[]
  onEditar: () => void; onBorrar: () => void
  /** Abre el documento en el visor. Sólo para los emitidos, que traen texto. */
  onVer: () => void
}) {
  // Un emitido guarda el documento entero; un gasto, una nota corta. El corte
  // por saltos de línea es más fiable que por largo: una nota puede ser larga y
  // seguir siendo una nota.
  //
  // Se mira `notas_preview` —los primeros 120 caracteres, columna generada— y
  // no `notas`, que el listado ya no trae: eran 950 kB de papeles bajando en
  // cada carga de la pantalla. El salto de línea de un documento emitido
  // aparece mucho antes del caracter 120, así que el criterio no cambia.
  const resumen = d.notas_preview ?? d.notas ?? ''
  const esDocumentoLargo = d.tipo === 'emitido' && resumen.includes('\n')
  const [abriendo, setAbriendo] = useState(false)
  const aNombreDe = d.asociado_id
    ? asociados.find(a => a.id === d.asociado_id)?.nombre
    : d.paciente_id ? pacientes.find(p => p.id === d.paciente_id)?.nombre_completo : null

  const abrir = async () => {
    if (!d.archivo_path) return
    setAbriendo(true)
    try { window.open(await urlFirmada(BUCKET_DOCS, d.archivo_path), '_blank', 'noopener') }
    catch (e) { toast.error(`No se pudo abrir: ${(e as Error).message}`) }
    finally { setAbriendo(false) }
  }

  return (
    <div className={tarjeta}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-[13px] text-[#ececf1] truncate">
            {d.descripcion || d.subtipo || 'Sin descripción'}
          </p>
          <p className="text-[10px] text-[#8a8a9c] mt-0.5 truncate">
            {[d.subtipo, d.numero && `Nº ${d.numero}`, d.fecha].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEditar} className={btnSutil} aria-label="Editar"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onBorrar} className={btnSutil} aria-label="Borrar"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-2">
        {d.monto != null && (
          <span className="text-[13px] font-mono tabular-nums font-bold text-[#facc15]">{fmtPesos(d.monto)}</span>
        )}
        {d.proveedor && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f2b] text-[#a6a6b5]">{d.proveedor}</span>}
        {d.categoria && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f2b] text-[#a6a6b5]">{d.categoria}</span>}
        {aNombreDe && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#38bdf8]/15 text-[#38bdf8]">{aNombreDe}</span>}
      </div>

      {/* Un documento emitido guarda su TEXTO COMPLETO en notas. Volcarlo acá
          llenaba la ficha con 3.000 caracteres; ahora se abre en el visor, que
          es donde además se imprime. Las notas cortas de un gasto se siguen
          mostrando como antes. */}
      {resumen && (esDocumentoLargo ? (
        <button onClick={onVer}
          className="mt-2 w-full flex items-center gap-2 rounded-lg bg-[#15151d] border border-[#1f1f2b] px-2.5 py-2 min-h-[44px] text-left hover:border-[#38bdf8]/40 transition-colors">
          <FileText className="w-3.5 h-3.5 text-[#38bdf8] flex-shrink-0" />
          <span className="text-[11px] text-[#a6a6b5] truncate min-w-0 flex-1">
            {(resumen.split('\n').find(l => l.trim()) ?? '').slice(0, 60)}…
          </span>
          <span className="text-[10px] text-[#38bdf8] flex-shrink-0">Ver e imprimir</span>
        </button>
      ) : (
        <p className="text-[11px] text-[#8a8a9c] mt-2">{resumen}</p>
      ))}

      <div className="mt-2 pt-2 border-t border-[#1f1f2b]">
        {d.archivo_path ? (
          <button onClick={abrir} disabled={abriendo}
            className="flex items-center gap-1.5 text-[11px] text-[#38bdf8] hover:underline py-2 min-h-[44px] sm:min-h-0">
            {abriendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
            <span className="truncate max-w-[220px]">{d.archivo_nombre || 'Ver archivo'}</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </button>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] text-[#f59e0b] py-1">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
            Sin archivo adjunto: es una anotación, no un respaldo.
          </p>
        )}
      </div>
    </div>
  )
}

function FormDocumento({ form, setForm, asociados, pacientes, dispensas, documentos, lotes = [], onCambio }: {
  form: Partial<DocumentoONG>; setForm: (f: Partial<DocumentoONG> | null) => void
  asociados: Asociado[]; pacientes: Paciente[]; dispensas: Dispensa[]
  /** Para sugerir el próximo número libre y avisar si uno se repite. */
  documentos: DocumentoONG[]
  /**
   * Los lotes, SÓLO por su proveedor.
   *
   * La lista de proveedores tiene que ser una sola entre el comprobante y el
   * lote: si cada formulario mirara su propia tabla, el mismo proveedor se
   * ofrecería con un nombre distinto según desde dónde se cargue, que es
   * exactamente el problema que el desplegable viene a resolver.
   */
  lotes?: ConProveedor[]
  onCambio: () => void
}) {
  // El hook vive ACÁ y no en `Documentos`, que es donde estaba: el `ref` que
  // devuelve tiene que ir en el elemento del modal, y el modal lo dibuja este
  // componente. Desde el padre el ref no cruza — y como el padre igual pasaba
  // el `activo`, el atrás funcionaba y nadie se enteraba de que el hook estaba
  // en otro lado.
  const refDialogo = useDialogo(() => setForm(null))
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const avanzar = useAvanzarFlujo()
  const esGasto = form.tipo === 'gasto'

  // Los proveedores ya usados, de las DOS fuentes, con su rubro deducido.
  // Ver `lib/proveedores.ts`.
  const proveedores = useMemo(
    () => proveedoresPorRubro({ documentos, lotes }), [documentos, lotes])

  const proximo = useMemo(() => proximoNumeroDeOrden(documentos), [documentos])
  const repetido = useMemo(
    () => numeroRepetido(form.numero, documentos, form.id), [form.numero, form.id, documentos])

  const subir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) { toast.error('El archivo supera los 15 MB'); return }
    setSubiendo(true)
    try {
      const { path, nombre } = await ongService.subirArchivoDocumento(file)
      setForm({ ...form, archivo_path: path, archivo_nombre: nombre })
      toast.success('Archivo subido')
    } catch (err) { toast.error(`No se pudo subir: ${(err as Error).message}`) }
    finally { setSubiendo(false) }
  }

  const guardar = async () => {
    if (!form.fecha) { toast.error('Poné la fecha'); return }
    setGuardando(true)
    try {
      await ongService.guardarDocumento(form)
      toast.success('Documento guardado')
      setForm(null)
      onCambio()
      // La entrega sigue viaje: el paso que viene es el seguimiento de ESA
      // misma, y sin el id no tiene sobre cuál abrirse.
      const entrega = idDeLaUrl(window.location.search, 'entrega')
      avanzar(entrega ? { entrega } : undefined)
    }
    catch (e) { toast.error((e as Error).message) }
    finally { setGuardando(false) }
  }

  return (
    <div ref={refDialogo} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={() => setForm(null)}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#1f1f2b] sticky top-0 bg-[#0d0d12] flex items-center gap-2">
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
            {form.id ? 'Editar documento' : esGasto ? 'Nuevo comprobante de gasto' : 'Nuevo documento emitido'}
          </h3>
          <button onClick={() => setForm(null)} aria-label="Cerrar"
            className="ml-auto min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {/* Cada lado de la pantalla tiene su guia: emitir una constancia y
              cargar el comprobante de una compra no se parecen en nada. */}
          {!form.id && (esGasto
            ? <GuiaDelFormulario id="comprar" />
            : <GuiaDelFormulario id="documento" />)}
          <div className="grid grid-cols-2 gap-3">
            <label><span className={etiquetaCampo}>Tipo</span>
              <select className={inputFormulario} value={form.tipo ?? 'emitido'}
                onChange={e => setForm({ ...form, tipo: e.target.value as DocumentoONG['tipo'], subtipo: null })}>
                <option value="emitido">Emitido por la ONG</option>
                <option value="gasto">Comprobante de gasto</option>
              </select></label>
            <label><span className={etiquetaCampo}>Clase</span>
              <select className={inputFormulario} value={form.subtipo ?? ''}
                onChange={e => setForm({ ...form, subtipo: e.target.value || null })}>
                <option value="">Sin especificar</option>
                {(esGasto ? SUBTIPOS_GASTO : SUBTIPOS_EMITIDO).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <AyudaCampo id="comprar" campo="Clase" />
              <QueEsEsteComprobante clase={form.subtipo} /></label>
            <label><span className={etiquetaCampo}>Fecha</span>
              <input type="date" className={inputFormulario} value={form.fecha ?? ''}
                onChange={e => setForm({ ...form, fecha: e.target.value })} /></label>
            <label><span className={etiquetaCampo}>Número</span>
              <input className={inputFormulario} value={form.numero ?? ''} placeholder="0001-00001234"
                onChange={e => setForm({ ...form, numero: e.target.value || null })} />
              <AyudaCampo id="comprar" campo="Número" />

              {/* Sugerido, no impuesto: el número puede venir del proveedor o de
                  una serie que la asociación ya usaba en papel.

                  ⚠️ Y SOLO PARA GASTOS. `OS` es la serie de las ordenes de
                  servicio —el ingreso de un lote al stock, y la clave por la
                  que se le imputan los pagos—. Este boton se le ofrecia tambien
                  a quien emitia un comprobante de dispensa, que no es una orden
                  de nada: tres se llevaron OS116, OS119 y OS120, que son los
                  numeros con los que el Sistema de Gestion identifica los
                  ingresos de los lotes del 29/08. */}
              {!form.id && !form.numero && esGasto && (
                <button type="button" onClick={() => setForm({ ...form, numero: proximo })}
                  className="mt-1.5 inline-flex items-center gap-1 px-2 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-[11px] text-[#d9f99d] hover:bg-[#a3e635]/10 transition-colors">
                  Usar {proximo}, que es el próximo libre
                </button>
              )}
              {repetido && (
                <p className="mt-1.5 text-[11px] text-[#ff8a7a] leading-relaxed">
                  Ese número ya está usado. Los pagos se ligan a la orden por el
                  número: si está repetido, no se puede saber a cuál se le pagó.
                </p>
              )}</label>
          </div>

          <label><span className={etiquetaCampo}>Descripción</span>
            <input className={inputFormulario} value={form.descripcion ?? ''}
              placeholder={esGasto ? 'Compra de sustrato' : 'Constancia de socio activo'}
              onChange={e => setForm({ ...form, descripcion: e.target.value || null })} /></label>

          {esGasto ? (
            <div className="grid grid-cols-2 gap-3">
              <label><span className={etiquetaCampo}>Monto</span>
                <input type="number" className={inputFormulario} value={form.monto ?? ''}
                  onChange={e => setForm({ ...form, monto: e.target.value === '' ? null : +e.target.value })} />
              <AyudaCampo id="comprar" campo="Monto" /></label>
              <label><span className={etiquetaCampo}>Rubro</span>
                <select className={inputFormulario} value={form.categoria ?? ''}
                  onChange={e => setForm({ ...form, categoria: e.target.value || null })}>
                  <option value="">Sin rubro</option>
                  {CATEGORIAS_GASTO.map(c => <option key={c} value={c}>{c}</option>)}
                </select></label>
              <div className="col-span-2"><span className={etiquetaCampo}>Proveedor</span>
                {/* Un comprobante puede ser de cualquier cosa, asi que la
                    prioridad la marca el rubro ya elegido arriba: cargando
                    «Sustrato» se buscan insumos, no productores. */}
                <SelectorProveedor valor={form.proveedor} lista={proveedores}
                  prioridad={form.categoria ? 'insumos' : undefined}
                  onCambio={p => setForm({ ...form, proveedor: p })} />
              <AyudaCampo id="comprar" campo="Proveedor" /></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label><span className={etiquetaCampo}>Asociado</span>
                  <select className={inputFormulario} value={form.asociado_id ?? ''}
                    onChange={e => setForm({ ...form, asociado_id: e.target.value || null })}>
                    <option value="">—</option>
                    {asociados.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select></label>
                <label><span className={etiquetaCampo}>Paciente</span>
                  <SelectorPersona personas={pacientes} valor={form.paciente_id}
                    onElegir={id => setForm({ ...form, paciente_id: id })} /></label>
              </div>
              <label><span className={etiquetaCampo}>Dispensa que respalda</span>
                <select className={inputFormulario} value={form.dispensa_id ?? ''}
                  onChange={e => setForm({ ...form, dispensa_id: e.target.value || null })}>
                  <option value="">—</option>
                  {dispensas.slice(0, 100).map(d => (
                    <option key={d.id} value={d.id}>{d.fecha} · {d.gramos} g</option>
                  ))}
                </select></label>
              <label><span className={etiquetaCampo}>Monto (si corresponde)</span>
                <input type="number" className={inputFormulario} value={form.monto ?? ''}
                  onChange={e => setForm({ ...form, monto: e.target.value === '' ? null : +e.target.value })} /></label>
            </>
          )}

          {/* Un emitido guarda el documento entero acá: en un input de una línea
              no se puede completar lo que quedó entre corchetes. */}
          <label><span className={etiquetaCampo}>
            {form.tipo === 'emitido' ? 'Texto del documento' : 'Notas'}
          </span>
            {form.tipo === 'emitido' ? (
              <textarea className={`${inputFormulario} font-mono leading-relaxed`} rows={16}
                value={form.notas ?? ''}
                onChange={e => setForm({ ...form, notas: e.target.value || null })} />
            ) : (
              <input className={inputFormulario} value={form.notas ?? ''}
                onChange={e => setForm({ ...form, notas: e.target.value || null })} />
            )}
          </label>
          {form.tipo === 'emitido' && (form.notas ?? '').includes('[') && (
            <p className="text-[10px] text-[#fbbf24] -mt-1">
              Lo que está entre corchetes es lo que faltaba al emitirlo. Completalo
              acá y queda guardado en el documento.
            </p>
          )}

          {/* Archivo */}
          <div className="rounded-lg bg-[#101016] border border-[#1f1f2b] p-3">
            <span className={etiquetaCampo}>Archivo</span>
            {form.archivo_path ? (
              <div className="flex items-center gap-2">
                <Paperclip className="w-3.5 h-3.5 text-[#38bdf8] flex-shrink-0" />
                <span className="text-[12px] text-[#d4d4dd] truncate flex-1">{form.archivo_nombre}</span>
                <button onClick={() => setForm({ ...form, archivo_path: null, archivo_nombre: null })}
                  className={btnSutil} aria-label="Quitar archivo"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#2a2a3a] py-3 min-h-[44px] cursor-pointer text-[12px] text-[#7dd3fc] hover:border-[#404d20]">
                {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {subiendo ? 'Subiendo…' : 'Subir PDF o foto'}
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={subir} disabled={subiendo} />
              </label>
            )}
            <p className="text-[10px] text-[#8a8a9c] mt-2">
              Va a un bucket privado: sólo se ve con sesión iniciada y el enlace caduca.
            </p>
          </div>
        </div>
        {!form.id && esGasto && <div className="px-4 pb-3"><OjoDelFormulario id="comprar" /></div>}
        <div className="px-4 py-3 border-t border-[#1f1f2b] flex gap-2 sticky bottom-0 bg-[#0d0d12]">
          <button onClick={() => setForm(null)} className={btnSutil}>Cancelar</button>
          <button onClick={guardar} disabled={guardando || subiendo} className={`${btnPrimario} flex-1`}>
            {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}


/**
 * Un rubro del gasto, que se abre y muestra en qué se fue.
 *
 * El rubro más grande —Gasto Operativo— no tiene subcategoría en la planilla:
 * el concepto está en el texto libre del comprobante. Se agrupa ignorando
 * acentos y mayúsculas, porque venía partido justo en los dos más caros
 * (alquiler y viáticos).
 */
function Rubro({ c, total, documentos }: {
  c: { categoria: string; monto: number; n: number }
  total: number
  documentos: DocumentoONG[]
}) {
  const [abierto, setAbierto] = useState(false)
  const conceptos = useMemo(
    () => abierto ? gastosPorConcepto(documentos, c.categoria) : [],
    [abierto, documentos, c.categoria])
  const TOPE = 8
  const resto = conceptos.slice(TOPE)
  const restoMonto = resto.reduce((s, x) => s + x.monto, 0)

  return (
    <div>
      <button onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center gap-2 text-left min-h-[44px] sm:min-h-0 sm:py-0.5">
        <ChevronRight className={`w-3 h-3 text-[#8a8a9c] flex-shrink-0 transition-transform ${abierto ? 'rotate-90' : ''}`} />
        <span className="text-[11px] text-[#a6a6b5] w-28 sm:w-40 truncate flex-shrink-0">{c.categoria}</span>
        <div className="flex-1 h-1.5 rounded-full bg-[#15151d] overflow-hidden">
          <div className="h-full rounded-full bg-[#38bdf8]"
            style={{ width: `${total > 0 ? (c.monto / total) * 100 : 0}%` }} />
        </div>
        <span className="text-[11px] font-mono tabular-nums text-[#ececf1] flex-shrink-0">{fmtPesos(c.monto)}</span>
      </button>

      {abierto && (
        <div className="ml-5 mt-1.5 mb-2 space-y-1">
          {conceptos.length === 0 ? (
            <p className="text-[11px] text-[#8a8a9c]">Sin descripción cargada en este rubro.</p>
          ) : (
            <>
              {conceptos.slice(0, TOPE).map(x => (
                <div key={x.concepto} className="flex items-baseline gap-2 text-[11px]">
                  <span className="text-[#d4d4dd] truncate min-w-0 flex-1">{x.concepto}</span>
                  {/* Avisar cuándo se juntaron formas distintas de escribirlo:
                      si no, el total parece salido de la nada. */}
                  {x.grafias > 1 && (
                    <span className="text-[10px] text-[#8a8a9c] flex-shrink-0"
                      title={`${x.grafias} formas de escribirlo, sumadas`}>
                      {x.grafias} grafías
                    </span>
                  )}
                  <span className="text-[10px] text-[#8a8a9c] flex-shrink-0">{x.comprobantes}</span>
                  <span className="font-mono tabular-nums text-[#a6a6b5] flex-shrink-0">{fmtPesos(x.monto)}</span>
                </div>
              ))}
              {resto.length > 0 && (
                <div className="flex items-baseline gap-2 text-[11px] text-[#8a8a9c] pt-0.5">
                  <span className="truncate min-w-0 flex-1">y {resto.length} concepto{resto.length === 1 ? '' : 's'} más</span>
                  <span className="font-mono tabular-nums flex-shrink-0">{fmtPesos(restoMonto)}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Qué es la clase de comprobante que está elegida.
 *
 * El desplegable ofrece catorce y sólo dice el nombre. «Certificado de
 * vinculación» y «Constancia de socio» suenan parecido y no son lo mismo: uno
 * prueba que la persona está vinculada en REPROCANN y el otro que es miembro de
 * la asociación civil. Elegir mal no da error — el documento sale igual, con el
 * título equivocado, y se descubre cuando alguien lo presenta.
 *
 * Con «Sin especificar» no dibuja nada: ahí no hay nada que explicar todavía.
 */
function QueEsEsteComprobante({ clase }: { clase?: string | null }) {
  const t = tipoDocumentoDe(clase)
  if (!t) return null
  return (
    <div className="mt-1.5 rounded-lg bg-[#15151d] border border-[#2a2a3a] px-2.5 py-2">
      <p className="text-[11px] text-[#d4d4dd] leading-relaxed">{t.paraQue}</p>
      <p className="text-[10px] text-[#8a8a9c] mt-1 leading-relaxed">
        <span className="text-[#a6a6b5]">Cuándo:</span> {t.cuando}
      </p>
    </div>
  )
}
