// Declaración jurada semestral y cartas de porte (Resolución 1780/2025).
//
// Las dos obligaciones que no avisa nadie: no llega notificación, el plazo
// simplemente corre. La DDJJ se arma sola con los datos que la app ya tiene
// —plantas totales, en floración, pacientes vinculados y variedades— así que
// lo único que queda por hacer es revisarla y marcarla presentada.

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useAbrirAlLlegar } from '../../lib/useAbrirAlLlegar'
import { useAvanzarFlujo } from '../../lib/useAvanzarFlujo'
import { GuiaDelFormulario, AyudaCampo, OjoDelFormulario } from './GuiaDelFormulario'
import { toast } from 'sonner'
import {
  FileSpreadsheet, Truck, Plus, Pencil, Trash2, Check, AlertTriangle, Wand2, FileText, X,
} from 'lucide-react'
import {
  ongService, semestreActual, finDeSemestre, revisarTraslado, TOPES_TRASLADO,
  type DDJJ, type Traslado, type Entidad, type Asociado,
} from '../../lib/ong'
import type { Paciente } from '../../lib/registro'
import { guiaTransitoInterno, ddjjTransporteDomicilio } from '../../lib/documentosLegales'
import { ddjjSemestral } from '../../lib/constanciasOperativas'
import { VisorDocumento } from './ActaParaLibro'
import { btnPrimario, btnSutil, tarjeta, etiquetaCampo, inputFormulario } from '../../lib/ui'
import { useDialogo } from '../../lib/useDialogo'
import { confirmarBorrado } from '../../lib/confirmar'
import { SelectorPersona } from './SelectorPersona'
import { nombreParaMostrar } from '../../lib/buscarPersonas'


export function Declaraciones({ ddjj, traslados, pacientes, asociados = [], cultivo, entidad = null, responsableTecnico, onCambio }: {
  ddjj: DDJJ[]
  traslados: Traslado[]
  pacientes: Paciente[]
  /** Para el legajo del destinatario en la DDJJ de transporte. */
  asociados?: Asociado[]
  /** Para el encabezado de los documentos de traslado. */
  entidad?: Entidad | null
  /** Quien firma la DDJJ: responde por el cultivo, no es el presidente. */
  responsableTecnico?: string | null
  /** Lo que la app sabe hoy del cultivo, para prellenar la declaración. */
  cultivo: { plantasTotal: number; plantasFloracion: number; pacientesVinculados: number; variedades: string[] }
  onCambio: () => void
}) {
  const [form, setForm] = useState<Partial<DDJJ> | null>(null)
  const [tras, setTras] = useState<Partial<Traslado> | null>(null)

  // `?nueva=traslado` y no `?nueva=1`: esta pantalla tiene DOS formularios,
  // el de declaración jurada y el de traslado, y la acción quiere el segundo.
  const nuevoTraslado = useCallback(() => setTras({
    fecha: new Date().toISOString().slice(0, 10), tipo_material: 'flores',
  }), [])
  useAbrirAlLlegar(nuevoTraslado, 'traslado', tras != null)

  // `?nueva=ddjj` arma la declaración del semestre en curso, que es el paso
  // «Armar la declaración» de «Presentar la declaración jurada».
  //
  // `armarRef` existe porque `armar` se recrea en cada render —depende de los
  // numeros del cultivo, que llegan por props— y un callback inestable
  // redispara el efecto que lo llama. La marca del hook lo frena, pero el
  // criterio de la casa es no apoyarse en eso.
  const armarRef = useRef<() => void>(() => {})
  const abrirDeclaracion = useCallback(() => armarRef.current(), [])
  // ⚠ `useAbrirAlLlegar(abrirDeclaracion, 'ddjj', form != null)` NO va acá: los efectos corren
  // en el orden en que se declaran, asi que si el hook se llama antes de que el
  // efecto de abajo llene `armarRef`, dispara la funcion vacia y no abre nada.
  // La llamada esta despues de `armar`, junto a la asignacion del ref.

  // Y `?nueva=presentada` reabre la del semestre en curso para tildarla.
  //
  // Armar no es presentar: hasta que no se tilda, el vencimiento sigue contando
  // como pendiente. Sin la del semestre no abre nada — no hay nada que marcar,
  // y abrir la de otro período haría declarar presentado un semestre que no es.
  const abrirParaMarcar = useCallback(() => {
    // `semestreActual()` y no la constante `periodo`, que se declara mas abajo.
    const del = ddjj.find(d => d.periodo === semestreActual())
    if (del) setForm(del)
  }, [ddjj])
  useAbrirAlLlegar(abrirParaMarcar, 'presentada', form != null)
  // Qué documento sale de cada traslado: entre predios propios va la guía de
  // tránsito interno; a un paciente, la DDJJ del art. 8.
  const [doc, setDoc] = useState<{ t: Traslado; tipo: 'interno' | 'domicilio' } | null>(null)
  // La DDJJ para imprimir. Se guarda la fila, no se recalcula: una declaración
  // presentada es una foto del cultivo en ese momento.
  const [docDdjj, setDocDdjj] = useState<DDJJ | null>(null)
  const periodo = semestreActual()
  const actual = ddjj.find(d => d.periodo === periodo)

  // Qué le falta a cada declaración para poder presentarse. Sale del mismo
  // generador que imprime el documento, así que la lista de la pantalla y los
  // corchetes del papel no pueden discrepar.
  const faltantesDe = (d: DDJJ) => ddjjSemestral(d, entidad, responsableTecnico).faltantes

  // Los traslados se parten en dos porque son dos documentos distintos, con
  // firmantes distintos. Contarlos juntos escondía que acá no hay ni uno solo
  // que vaya al domicilio de un paciente.
  const internos = traslados.filter(t => !t.paciente_id).length
  const aDomicilio = traslados.length - internos
  const conCarta = traslados.filter(t => t.carta_porte_presentada).length

  const armar = () => setForm({
    periodo,
    plantas_total: cultivo.plantasTotal,
    plantas_floracion: cultivo.plantasFloracion,
    pacientes_vinculados: cultivo.pacientesVinculados,
    variedades: cultivo.variedades.join(', '),
    fecha_presentacion: new Date().toISOString().slice(0, 10),
  })
  // El ref se llena antes de que el hook de abajo lo use: mismo commit, y este
  // efecto esta declarado primero.
  useEffect(() => { armarRef.current = armar })
  useAbrirAlLlegar(abrirDeclaracion, 'ddjj', form != null)

  const borrarDDJJ = async (d: DDJJ) => {
    if (!(await confirmarBorrado(`¿Borrar la declaración de ${d.periodo}?`))) return
    try { await ongService.borrarDDJJ(d.id); toast.success('Borrada'); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }
  const borrarTras = async (t: Traslado) => {
    if (!(await confirmarBorrado(`¿Borrar el traslado del ${t.fecha}?`))) return
    try { await ongService.borrarTraslado(t.id); toast.success('Borrado'); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="space-y-4">
      {/* ---------------- Declaración jurada semestral ---------------- */}
      <div className={tarjeta}>
        <div className="flex items-center gap-2 flex-wrap">
          <FileSpreadsheet className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">Declaración jurada semestral</h3>
          {!actual && (
            <button onClick={armar} className={`${btnPrimario} flex-shrink-0`}>
              <Wand2 className="w-3.5 h-3.5" /> Armar la de {periodo}
            </button>
          )}
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2">
          La Resolución 1780 la exige cada seis meses: cantidad de plantas en total y en floración, pacientes
          vinculados y las variedades usadas. No llega ninguna notificación, el plazo corre solo.
        </p>

        <Ayuda titulo="Qué es esta declaración y para qué sirve">
          <P t="Qué declara">
            La situación del cultivo <b className="text-[#a6a6b5]">al cierre del semestre</b>: cuántas plantas
            hay en total, cuántas de ésas están en floración, cuántas personas están vinculadas y qué
            variedades se cultivaron. Nada más que eso.
          </P>
          <P t="Por qué importan las de floración">
            Son las únicas que se imputan al cupo. El cultivo no tiene cupo propio: tiene la suma de los
            permisos REPROCANN que aportó cada persona vinculada. Las plantas en vegetativo o enraizando no
            cuentan contra ese techo, pero sí van en el total.
          </P>
          <P t="Quién la firma">
            El <b className="text-[#a6a6b5]">responsable técnico</b>, que es quien responde por el cultivo ante
            la autoridad — no el presidente. Si no está designado, el documento sale con el nombre entre
            corchetes y no se puede presentar así.
          </P>
          <P t="Cuándo">
            El período corre solo y cierra el último día del semestre ({finDeSemestre(periodo)} para el actual).
            Nadie avisa: no llega notificación ni intimación previa. El tablero de Vencimientos la muestra como
            pendiente hasta que se marca presentada.
          </P>
          <P t="Armar ≠ presentar">
            El botón «Armar» crea la declaración con los datos que la app tiene hoy y la deja guardada para
            revisar. El trámite se hace <b className="text-[#a6a6b5]">por TAD</b>, fuera de la app; recién ahí
            se tilda «Ya la presenté». Mientras el tilde esté apagado, el documento se imprime igual pero dice
            SIN PRESENTAR, que es lo que corresponde.
          </P>
          <P t="Por qué se imprime lo guardado y no lo de hoy">
            Una declaración presentada es una <b className="text-[#a6a6b5]">foto</b> del cultivo en ese momento.
            Si el papel recalculara al vuelo, reimprimir la de hace un año mostraría las plantas de hoy y ya no
            sería lo que se presentó. Por eso el número del recuadro de acá abajo y el del documento pueden no
            coincidir: el recuadro es hoy, el documento es lo declarado.
          </P>
          <P t="Un campo vacío no se completa a ojo">
            Cuando falta un dato el documento lo saca entre corchetes en vez de poner un número plausible. Un
            hueco visible es información; un número inventado es una declaración jurada falsa.
          </P>
        </Ayuda>

        <div className="rounded-lg bg-[#15151d] border border-[#1f1f2b] p-3 mt-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-2">
            Lo que la app sabe hoy · período {periodo} · cierra el {finDeSemestre(periodo)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Dato t="Plantas" v={String(cultivo.plantasTotal)} />
            <Dato t="En floración" v={String(cultivo.plantasFloracion)} />
            <Dato t="Pacientes" v={String(cultivo.pacientesVinculados)} />
            <Dato t="Variedades" v={String(cultivo.variedades.length)} />
          </div>
        </div>

        {ddjj.length === 0 ? (
          <p className="text-[12px] text-[#8a8a9c] text-center py-5">Todavía no armaste ninguna declaración.</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {ddjj.map(d => {
              const faltan = faltantesDe(d)
              return (
                <div key={d.id} className="rounded-lg bg-[#15151d] border border-[#1f1f2b] px-2 sm:px-3 py-2">
                  <div className="flex items-center gap-2 min-h-[44px]">
                    <span className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                      style={d.presentada ? { background: '#a3e635', borderColor: '#a3e635' } : { borderColor: '#5a4a20' }}>
                      {d.presentada && <Check className="w-3 h-3 text-[#07070b]" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-[#ececf1]">{d.periodo}</p>
                      <p className="text-[10px] text-[#8a8a9c] tabular-nums truncate">
                        {d.plantas_total ?? '—'} plantas · {d.plantas_floracion ?? '—'} en flor · {d.pacientes_vinculados ?? '—'} pacientes
                        {d.presentada && d.fecha_presentacion ? ` · presentada ${d.fecha_presentacion}` : ' · sin presentar'}
                      </p>
                    </div>
                    <button onClick={() => setDocDdjj(d)} className={btnSutil} aria-label="Ver el documento"><FileText className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setForm(d)} className={btnSutil} aria-label="Editar declaración"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => borrarDDJJ(d)} className={btnSutil} aria-label="Borrar declaración"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  {/* Qué le falta para poder presentarse. Sin esto había que
                      abrir el documento y buscar los corchetes a ojo. */}
                  {faltan.length > 0 && (
                    <p className="flex items-start gap-1.5 text-[11px] text-[#e0b341] mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" strokeWidth={1.8} />
                      <span>Para presentarla falta {faltan.join(', ')}.</span>
                    </p>
                  )}
                  {d.notas && (
                    <p className="text-[10px] text-[#8a8a9c] leading-snug mt-1">{d.notas}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {docDdjj && (() => {
        const g = ddjjSemestral(docDdjj, entidad, responsableTecnico)
        return <VisorDocumento titulo={g.titulo} texto={g.texto} faltantes={g.faltantes}
          entidad={entidad} onEmitido={onCambio}
          archivo={{ subtipo: 'DDJJ semestral' }}
          nota={'Se imprime lo GUARDADO, no lo que la app sabe hoy: una declaración presentada es una foto ' +
            'del cultivo en ese momento y tiene que poder mostrarse igual dentro de dos años. La firma el ' +
            'responsable técnico, que es quien responde por el cultivo ante la autoridad.'}
          onCerrar={() => setDocDdjj(null)} />
      })()}

      {/* ---------------- Traslados / cartas de porte ---------------- */}
      <div className={tarjeta}>
        <div className="flex items-center gap-2 flex-wrap">
          <Truck className="w-4 h-4 text-[#c4b5fd]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">Traslados y cartas de porte</h3>
          <button onClick={nuevoTraslado}
            className={`${btnPrimario} flex-shrink-0`}>
            <Plus className="w-3.5 h-3.5" /> Registrar traslado
          </button>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2">
          Cada traslado necesita su carta de porte por TAD. Los topes son por persona representada:
          hasta <b className="text-[#a6a6b5]">{TOPES_TRASLADO.flores.tope} g</b> de flores,{' '}
          <b className="text-[#a6a6b5]">{TOPES_TRASLADO.frascos.tope} frascos</b> de 30 ml,
          o las plantas que tenga autorizadas.
        </p>

        <Ayuda titulo="Cuál de los dos documentos sale, y quién lo firma">
          <P t="Guía de tránsito interno">
            Para mover material <b className="text-[#a6a6b5]">entre predios de la propia institución</b>. No hay
            un paciente del otro lado: el material sigue siendo de la entidad, sólo cambia de lugar. La firman
            el Presidente y el Responsable Técnico. Es el documento que sale cuando el traslado no tiene
            paciente asignado.
          </P>
          <P t="DDJJ de transporte a domicilio">
            Para llevarle el material <b className="text-[#a6a6b5]">a la persona representada</b>, a su
            domicilio. La firma el responsable del despacho y acompaña físicamente al transporte. Sale cuando
            el traslado tiene un paciente elegido.
          </P>
          <P t="Los topes son por persona, no por viaje">
            {TOPES_TRASLADO.flores.tope} g de flores secas, {TOPES_TRASLADO.frascos.tope} frascos de 30 ml de
            aceite, o hasta la cantidad de plantas que esa persona tenga autorizadas en su REPROCANN — por eso
            el tope de plantas no es un número fijo y depende de a quién se le lleva.
          </P>
          <P t="Qué significa el borde rojo">
            Que ese traslado no está en condiciones: o pasa el tope, o le falta un dato obligatorio de la carta
            de porte (origen, destino, transportista, destinatario final), o todavía no se presentó por TAD. El
            motivo exacto aparece debajo de la fila.
          </P>
          <P t="Presentar es un trámite aparte">
            El tilde de «carta de porte presentada» no dice que el traslado ocurrió: dice que el trámite se hizo
            por TAD. Por eso los traslados que se derivaron de las órdenes de servicio están todos sin tildar —
            el movimiento consta, la presentación no.
          </P>
        </Ayuda>

        {traslados.length === 0 ? (
          <p className="text-[12px] text-[#8a8a9c] text-center py-5">Sin traslados registrados.</p>
        ) : (
          <>
          <div className="rounded-lg bg-[#15151d] border border-[#1f1f2b] p-3 mt-3">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-2">
              Los {traslados.length} traslados registrados
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Dato t="Entre predios" v={String(internos)} />
              <Dato t="A domicilio" v={String(aDomicilio)} />
              <Dato t="Carta presentada" v={`${conCarta}/${traslados.length}`} />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {traslados.map(t => {
              const pac = pacientes.find(p => p.id === t.paciente_id)
              const rev = revisarTraslado(t, pac?.plantas_habilitadas ?? null)
              const u = TOPES_TRASLADO[t.tipo_material ?? 'flores']
              return (
                <div key={t.id} className="rounded-lg bg-[#15151d] border px-3 py-2"
                  style={{ borderColor: rev.ok ? '#1f1f2b' : '#7a2820' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] text-[#ececf1]">{t.fecha}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f2b] text-[#a6a6b5]">
                      {t.cantidad ?? '—'} {u.unidad}
                    </span>
                    {pac && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#38bdf8]/15 text-[#38bdf8]">{nombreParaMostrar(pac)}</span>}
                    <div className="w-full sm:w-auto sm:ml-auto flex gap-1">
                      <button onClick={() => setDoc({ t, tipo: t.paciente_id ? 'domicilio' : 'interno' })}
                        className={btnSutil} title={t.paciente_id ? 'DDJJ de transporte a domicilio' : 'Guía de tránsito interno'}
                        aria-label="Generar el documento del traslado">
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setTras(t)} className={btnSutil} aria-label="Editar traslado"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => borrarTras(t)} className={btnSutil} aria-label="Borrar traslado"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#8a8a9c] mt-1 truncate">
                    {[t.origen, t.destino].filter(Boolean).join(' → ') || 'Sin origen ni destino'}
                    {t.transportista ? ` · ${t.transportista}` : ''}
                  </p>
                  {/* Qué lote viajó. Es lo que hace que la guía sirva para
                      seguir el material hasta su origen. */}
                  <p className="text-[10px] mt-0.5 truncate">
                    {t.lotes
                      ? <span className="text-[#a6a6b5]">Lote {t.lotes}</span>
                      : <span className="text-[#8a8a9c] italic">Sin lote: la guía sale sin decir qué material se movió</span>}
                  </p>
                  {rev.motivos.map(m => (
                    <p key={m} className="flex items-start gap-1.5 text-[11px] text-[#ff8a7a] mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" strokeWidth={1.8} />{m}
                    </p>
                  ))}
                </div>
              )
            })}
          </div>
          </>
        )}
      </div>

      {doc && (() => {
        const pac = pacientes.find(p => p.id === doc.t.paciente_id) ?? null
        const aso = pac ? asociados.find(a => a.paciente_id === pac.id) ?? null : null
        const g = doc.tipo === 'domicilio'
          ? ddjjTransporteDomicilio(doc.t, entidad, pac, aso)
          : guiaTransitoInterno(doc.t, entidad)
        return <VisorDocumento titulo={g.titulo} texto={g.texto} faltantes={g.faltantes}
          entidad={entidad}
          onEmitido={onCambio}
          archivo={{
            subtipo: doc.tipo === 'domicilio' ? 'DDJJ de transporte a domicilio' : 'Guía de tránsito interno',
            paciente_id: doc.t.paciente_id ?? null,
          }}
          nota={doc.tipo === 'domicilio'
            ? 'Acompaña el traslado hasta el domicilio del paciente. Va firmada por el responsable del despacho.'
            : 'Para mover material entre predios de la propia institución. La firman el Presidente y el Responsable Técnico.'}
          onCerrar={() => setDoc(null)} />
      })()}

      {form && <ModalDDJJ form={form} setForm={setForm} onCambio={onCambio} />}
      {tras && <ModalTraslado form={tras} setForm={setTras} pacientes={pacientes} onCambio={onCambio} />}
    </div>
  )
}

/**
 * El detalle largo, plegado.
 *
 * Gastón pidió explícitamente "qué es para qué cada cosa" en esta pantalla. El
 * problema es que quien ya lo sabe no quiere leerlo cada vez, así que va en un
 * `details` cerrado: el que necesita la explicación la encuentra, el que no,
 * ve una línea. Cerrado por defecto y no `open`, porque la pantalla ya arranca
 * con dos secciones y un recuadro de números.
 */
function Ayuda({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <details className="mt-3 rounded-lg border border-[#1f1f2b] bg-[#0d0d12] overflow-hidden group">
      <summary className="px-3 py-2.5 min-h-[44px] sm:min-h-0 flex items-center cursor-pointer select-none text-[11px] text-[#a6a6b5] hover:text-[#ececf1] transition-colors">
        <span className="text-[#8a8a9c] mr-1.5 transition-transform group-open:rotate-90">›</span>
        {titulo}
      </summary>
      <div className="px-3 pb-3 space-y-2.5">{children}</div>
    </details>
  )
}

/** Un párrafo del detalle: título corto arriba, explicación abajo. */
function P({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">{t}</div>
      <p className="text-[11px] text-[#a6a6b5] leading-relaxed mt-0.5">{children}</p>
    </div>
  )
}

function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c]">{t}</div>
      <div className="text-[16px] font-mono tabular-nums font-bold text-[#d9f99d] mt-0.5">{v}</div>
    </div>
  )
}

function Modal({ titulo, onCerrar, children, onGuardar }: {
  titulo: string; onCerrar: () => void; children: React.ReactNode; onGuardar: () => void
}) {
  const refDialogo = useDialogo(onCerrar)
  return (
    <div ref={refDialogo} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onCerrar}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#1f1f2b] sticky top-0 bg-[#0d0d12] flex items-center gap-2">
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">{titulo}</h3>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="ml-auto min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
        <div className="px-4 py-3 border-t border-[#1f1f2b] flex gap-2 sticky bottom-0 bg-[#0d0d12]">
          <button onClick={onCerrar} className={btnSutil}>Cancelar</button>
          <button onClick={onGuardar} className={`${btnPrimario} flex-1`}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

function Toggle({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => on(!v)}
      className="flex items-center gap-2 text-[12px] text-[#d4d4dd] py-2 min-h-[44px] sm:min-h-0">
      <span className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
        style={v ? { background: '#a3e635', borderColor: '#a3e635' } : { borderColor: '#2a2a3a' }}>
        {v && <Check className="w-3 h-3 text-[#07070b]" />}
      </span>
      {label}
    </button>
  )
}

function ModalDDJJ({ form, setForm, onCambio }: {
  form: Partial<DDJJ>; setForm: (f: Partial<DDJJ> | null) => void; onCambio: () => void
}) {
  const avanzar = useAvanzarFlujo()
  const guardar = async () => {
    if (!form.periodo) { toast.error('Falta el período'); return }
    try {
      await ongService.guardarDDJJ(form)
      toast.success('Declaración guardada'); setForm(null); onCambio()
      // En «Presentar la declaración jurada» el paso que sigue es revisar
      // Coherencia; desde el ultimo paso, vuelve al panel.
      avanzar()
    }
    catch (e) { toast.error((e as Error).message) }
  }
  return (
    <Modal titulo={`Declaración jurada ${form.periodo ?? ''}`} onCerrar={() => setForm(null)} onGuardar={guardar}>
      <div className="grid grid-cols-2 gap-3">
        <label><span className={etiquetaCampo}>Período</span>
          <input className={inputFormulario} value={form.periodo ?? ''} placeholder="2026-S1"
            onChange={e => setForm({ ...form, periodo: e.target.value })} /></label>
        <label><span className={etiquetaCampo}>Fecha de presentación</span>
          <input type="date" className={inputFormulario} value={form.fecha_presentacion ?? ''}
            onChange={e => setForm({ ...form, fecha_presentacion: e.target.value || null })} /></label>
        <label><span className={etiquetaCampo}>Plantas en total</span>
          <input type="number" className={inputFormulario} value={form.plantas_total ?? ''}
            onChange={e => setForm({ ...form, plantas_total: e.target.value === '' ? null : +e.target.value })} /></label>
        <label><span className={etiquetaCampo}>En floración</span>
          <input type="number" className={inputFormulario} value={form.plantas_floracion ?? ''}
            onChange={e => setForm({ ...form, plantas_floracion: e.target.value === '' ? null : +e.target.value })} /></label>
        <label className="col-span-2"><span className={etiquetaCampo}>Pacientes vinculados</span>
          <input type="number" className={inputFormulario} value={form.pacientes_vinculados ?? ''}
            onChange={e => setForm({ ...form, pacientes_vinculados: e.target.value === '' ? null : +e.target.value })} /></label>
      </div>
      <label><span className={etiquetaCampo}>Variedades usadas</span>
        <input className={inputFormulario} value={form.variedades ?? ''}
          onChange={e => setForm({ ...form, variedades: e.target.value })} /></label>
      <label><span className={etiquetaCampo}>Notas</span>
        <input className={inputFormulario} value={form.notas ?? ''}
          onChange={e => setForm({ ...form, notas: e.target.value })} /></label>
      <Toggle label="Ya la presenté por TAD" v={!!form.presentada} on={v => setForm({ ...form, presentada: v })} />
    </Modal>
  )
}

function ModalTraslado({ form, setForm, pacientes, onCambio }: {
  form: Partial<Traslado>; setForm: (f: Partial<Traslado> | null) => void
  pacientes: Paciente[]; onCambio: () => void
}) {
  const pac = pacientes.find(p => p.id === form.paciente_id)
  const rev = useMemo(() => revisarTraslado(form as Traslado, pac?.plantas_habilitadas ?? null), [form, pac])
  const avanzar = useAvanzarFlujo()
  const guardar = async () => {
    if (!form.fecha) { toast.error('Falta la fecha'); return }
    try {
      await ongService.guardarTraslado(form)
      toast.success('Traslado guardado'); setForm(null); onCambio()
      // El paso que sigue en «Trasladar productos» es la carta de porte, que se
      // presenta por TAD y no tiene formulario acá: la barra lo anuncia y espera.
      avanzar()
    }
    catch (e) { toast.error((e as Error).message) }
  }
  const u = TOPES_TRASLADO[form.tipo_material ?? 'flores']

  return (
    <Modal titulo={form.id ? 'Editar traslado' : 'Mover material a otro lado'} onCerrar={() => setForm(null)} onGuardar={guardar}>
      {!form.id && <GuiaDelFormulario id="traslado" />}
      <div className="grid grid-cols-2 gap-3">
        <label><span className={etiquetaCampo}>Fecha</span>
          <input type="date" className={inputFormulario} value={form.fecha ?? ''}
            onChange={e => setForm({ ...form, fecha: e.target.value })} /></label>
        <label><span className={etiquetaCampo}>Paciente</span>
          <SelectorPersona personas={pacientes} valor={form.paciente_id}
            onElegir={id => setForm({ ...form, paciente_id: id })} /></label>
        <label><span className={etiquetaCampo}>Qué se traslada</span>
          <select className={inputFormulario} value={form.tipo_material ?? 'flores'}
            onChange={e => setForm({ ...form, tipo_material: e.target.value as Traslado['tipo_material'] })}>
            {(Object.entries(TOPES_TRASLADO) as [keyof typeof TOPES_TRASLADO, { label: string }][])
              .map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select></label>
        <label><span className={etiquetaCampo}>Cantidad ({u.unidad})</span>
          <input type="number" step="0.1" className={inputFormulario} value={form.cantidad ?? ''}
            onChange={e => setForm({ ...form, cantidad: e.target.value === '' ? null : +e.target.value })} />
          <AyudaCampo id="traslado" campo="Cantidad" /></label>
        <label><span className={etiquetaCampo}>Origen</span>
          <input className={inputFormulario} value={form.origen ?? ''} placeholder="Predio de cultivo"
            onChange={e => setForm({ ...form, origen: e.target.value })} /></label>
        <label><span className={etiquetaCampo}>Destino</span>
          <input className={inputFormulario} value={form.destino ?? ''}
            onChange={e => setForm({ ...form, destino: e.target.value })} /></label>
        <label><span className={etiquetaCampo}>Hora de salida</span>
          <input className={inputFormulario} value={form.hora_salida ?? ''} placeholder="14:30"
            onChange={e => setForm({ ...form, hora_salida: e.target.value })} /></label>
        <label><span className={etiquetaCampo}>Hora de llegada</span>
          <input className={inputFormulario} value={form.hora_llegada ?? ''} placeholder="16:00"
            onChange={e => setForm({ ...form, hora_llegada: e.target.value })} /></label>
        <label><span className={etiquetaCampo}>Transportista</span>
          <input className={inputFormulario} value={form.transportista ?? ''}
            onChange={e => setForm({ ...form, transportista: e.target.value })} />
              <AyudaCampo id="traslado" campo="Transportista" /></label>
        <label><span className={etiquetaCampo}>DNI del transportista</span>
          <input className={inputFormulario} value={form.transportista_dni ?? ''}
            onChange={e => setForm({ ...form, transportista_dni: e.target.value })} />
              <AyudaCampo id="traslado" campo="DNI del transportista" /></label>
      </div>
      <label><span className={etiquetaCampo}>Lotes que viajan</span>
        <input className={inputFormulario} value={form.lotes ?? ''} placeholder="CO-01, SH-PC260126"
          onChange={e => setForm({ ...form, lotes: e.target.value || null })} />
        <span className="text-[10px] text-[#8a8a9c] leading-snug block mt-1">
          Separados por coma si viaja más de uno. Sin esto la guía dice
          «40 g de flores» y no se puede seguir el material hasta su origen.
        </span></label>
      <label><span className={etiquetaCampo}>Ruta</span>
        <input className={inputFormulario} value={form.ruta ?? ''} placeholder="Ruta 2 hasta km 40, luego Av. ..."
          onChange={e => setForm({ ...form, ruta: e.target.value })} /></label>
      <label><span className={etiquetaCampo}>Destinatario final</span>
        <input className={inputFormulario} value={form.destinatario ?? ''}
          onChange={e => setForm({ ...form, destinatario: e.target.value })} />
              <AyudaCampo id="traslado" campo="Destinatario final" /></label>
      <Toggle label="Carta de porte presentada por TAD" v={!!form.carta_porte_presentada}
        on={v => setForm({ ...form, carta_porte_presentada: v })} />

      {/* Validación en vivo: si algo no cierra conviene verlo antes de guardar */}
      {rev.motivos.length > 0 && (
        <div className="rounded-lg bg-[#7a2820]/10 border border-[#7a2820] p-2.5 space-y-1">
          {rev.motivos.map(m => (
            <p key={m} className="flex items-start gap-1.5 text-[11px] text-[#ff8a7a]">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" strokeWidth={1.8} />{m}
            </p>
          ))}
        </div>
      )}
      {!form.id && <OjoDelFormulario id="traslado" />}
    </Modal>
  )
}
