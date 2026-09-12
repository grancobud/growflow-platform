// Plantillas institucionales.
//
// Estos documentos no cuelgan de un registro: una designación o un comodato no
// salen de una dispensa como sale un recibo. Por eso van en su propia lista, y
// se completan con lo que la app ya sabe de la entidad, las autoridades y las
// variedades en cultivo.
//
// Son los instrumentos que la Resolución 1780 pide y que hasta acá eran sólo un
// tilde en la lista de requisitos. Un tilde dice "lo tengo"; esto es el papel.

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { FileSignature, Archive, Loader2, X } from 'lucide-react'
import { ddjjMandato } from '../../lib/documentosLegales'
import { designacion, comodato, informeGeneticas } from '../../lib/documentosInstitucionales'
import { constanciaCupo, padronVinculados, registroEntregas, registroCaja } from '../../lib/constanciasOperativas'
import { emitirRespaldoHistorico, ongService } from '../../lib/ong'
import type { DocumentoGenerado } from '../../lib/documentosLegales'
import type { Entidad, Asociado, Dispensa, DocumentoONG, AsientoCaja } from '../../lib/ong'
import type { Paciente } from '../../lib/registro'
import { estatutoModelo } from '../../lib/estatutoModelo'
import { VisorDocumento } from './ActaParaLibro'
import { btnPrimario, btnSutil, tarjeta, etiquetaCampo, inputFormulario } from '../../lib/ui'
import { useDialogo } from '../../lib/useDialogo'


type Plantilla =
  | 'director_medico' | 'responsable_tecnico'
  | 'comodato_sede' | 'comodato_predio'
  | 'geneticas' | 'mandato'
  // Las de abajo no se completan a mano: salen de lo que ya está cargado.
  | 'cupo' | 'padron' | 'entregas' | 'estatuto'

const PLANTILLAS: { id: Plantilla; label: string; detalle: string }[] = [
  { id: 'director_medico', label: 'Designación de Director Médico',
    detalle: 'Constancia del acto de la Comisión Directiva. Remite al acta donde se resolvió.' },
  { id: 'responsable_tecnico', label: 'Designación de Responsable Técnico',
    detalle: 'Quien responde por el cultivo y firma el plan de cultivo.' },
  { id: 'comodato_sede', label: 'Comodato de sede social',
    detalle: 'Acredita el uso del inmueble. ARCA lo pide para la exención de ganancias.' },
  { id: 'comodato_predio', label: 'Comodato de predio de cultivo',
    detalle: 'Uno por predio. Va junto con la georreferenciación y el aviso al municipio.' },
  { id: 'estatuto', label: 'Estatuto (modelo pre-visado)',
    detalle: 'El Anexo II de la Disp. Gral. 010-24, ya aprobado por el organismo. Se completa solo.' },
  { id: 'geneticas', label: 'Informe de genéticas',
    detalle: 'Declara las variedades en cultivo y el compromiso de análisis por lote.' },
  { id: 'mandato', label: 'Mandato de gestión operativa',
    detalle: 'Lo firma cada asociado. Es lo que sostiene que la entrega no es una compraventa.' },
  { id: 'cupo', label: 'Constancia de cupo REPROCANN',
    detalle: 'Bajo qué permisos cultiva la asociación, persona por persona. Se emite sola.' },
  { id: 'padron', label: 'Padrón de personas vinculadas',
    detalle: 'El listado que piden cuando preguntan quiénes son. Se emite solo.' },
  { id: 'entregas', label: 'Registro de entregas',
    detalle: 'Lo entregado en el período, con lote y aporte. Se emite solo.' },
]

/** Las que no piden ningún dato: se arman con lo que la app ya tiene. */
const AUTOMATICAS: Plantilla[] = ['cupo', 'padron', 'entregas', 'estatuto']

export interface VariedadFicha {
  nombre: string
  tipo?: string | null
  thc_estimado?: number | null
  cbd_estimado?: number | null
}

export function PlantillasInstitucionales({
  entidad, asociados, pacientes, autoridades, variedades, actas, dispensas, documentos, caja, onEmitido,
}: {
  /** Para refrescar la lista de emitidos después de guardar uno. */
  onEmitido?: () => void
  /** Para el registro de entregas. Opcional: sin esto esa constancia sale vacía. */
  dispensas?: Dispensa[]
  /** Los ya emitidos, para no duplicar al generar el respaldo histórico. */
  documentos?: DocumentoONG[]
  /** Para el registro de caja: los 1.690 asientos no tienen ningún comprobante. */
  caja?: AsientoCaja[]
  entidad: Entidad | null
  asociados: Asociado[]
  pacientes: Paciente[]
  autoridades: { nombre: string; cargo: string; activo?: boolean }[]
  variedades: VariedadFicha[]
  actas: { numero: number; fecha: string; tipo: string }[]
}) {
  const [abierta, setAbierta] = useState<Plantilla | null>(null)
  const refDialogo = useDialogo(() => setAbierta(null), abierta != null)
  const [quien, setQuien] = useState('')
  const [dato, setDato] = useState('')
  const [doc, setDoc] = useState<DocumentoGenerado | null>(null)

  const activas = autoridades.filter(a => a.activo !== false)
  // El acta de CD más reciente es a la que suele remitir una designación.
  const ultimaCD = actas
    .filter(a => a.tipo === 'cd')
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]

  const [respaldando, setRespaldando] = useState(false)

  /**
   * Las variedades que se ENTREGARON, sacadas de `producto`.
   *
   * la asociación compra casi todo: dispensó 20 variedades y cultiva una. Van al
   * informe en su propia sección, dicho lo que son —adquiridas a terceros—
   * porque meterlas entre las "afectadas a su producción" declararía un cultivo
   * que no existe.
   */
  const dispensadas = useMemo(() => {
    const m = new Map<string, { nombre: string; entregas: number; gramos: number }>()
    for (const d of dispensas ?? []) {
      const n = (d.producto ?? '').trim()
      if (!n) continue
      const e = m.get(n.toLocaleLowerCase('es-AR')) ?? { nombre: n, entregas: 0, gramos: 0 }
      e.entregas += 1
      if ((d.unidad ?? 'g') === 'g') e.gramos += Number(d.gramos) || 0
      m.set(n.toLocaleLowerCase('es-AR'), e)
    }
    return [...m.values()].sort((a, b) => b.gramos - a.gramos)
  }, [dispensas])

  // Respalda TODO lo entregado, un registro por mes. Ver `emitirRespaldoHistorico`:
  // uno por entrega serían 1.241 filas donde después hay que buscar.
  const respaldar = async () => {
    if (!dispensas?.length && !caja?.length) { toast.error('No hay nada que respaldar'); return }
    setRespaldando(true)
    try {
      // Dos registros por mes: uno de lo que se ENTREGÓ y otro de lo que se
      // MOVIÓ de plata. Van separados porque respaldan cosas distintas y se
      // presentan ante autoridades distintas — el de entregas es sanitario, el
      // de caja es contable.
      const rE = await emitirRespaldoHistorico(dispensas ?? [], documentos ?? [],
        (delMes, desde) => {
          const doc = registroEntregas(delMes, desde, '', entidad)
          return { titulo: `Registro de entregas ${desde.slice(0, 7)}`, texto: doc.texto }
        })
      const rC = await emitirRespaldoHistorico(
        // `emitirRespaldoHistorico` agrupa por `fecha`, que los asientos tienen
        // igual que las dispensas: alcanza con el cast.
        (caja ?? []) as unknown as Dispensa[], documentos ?? [],
        (delMes, desde, hasta) => {
          const doc = registroCaja(delMes as unknown as Parameters<typeof registroCaja>[0],
            desde, hasta, entidad)
          return { titulo: `Registro de caja ${desde.slice(0, 7)}`, texto: doc.texto }
        })
      // Las de FOTO: una por entidad, no una por mes. Se emiten con la fecha de
      // hoy porque describen el estado actual, no un período cerrado.
      //
      // Se saltean si ya hay una emitida con el mismo título. Reemitirlas cada
      // vez llenaría la lista de versiones que sólo difieren en la fecha, y la
      // que vale es la última — pero la anterior tampoco se puede pisar, porque
      // quizá ya se presentó.
      const yaHay = new Set((documentos ?? [])
        .filter(x => x.tipo === 'emitido').map(x => (x.descripcion ?? '').trim()))
      const fotos = [
        constanciaCupo(pacientes, entidad),
        padronVinculados(pacientes, entidad),
        // El informe de genéticas sólo si hay variedades: uno vacío no dice nada.
        ...(variedades.length > 0 || dispensadas.length > 0
          ? [informeGeneticas(variedades.map(v => ({
              nombre: v.nombre, tipo: v.tipo, thc: v.thc_estimado, cbd: v.cbd_estimado,
            })), entidad, undefined, dispensadas)]
          : []),
      ]
      let fotosEmitidas = 0, fotosSalteadas = 0
      for (const g of fotos) {
        if (yaHay.has(g.titulo.trim())) { fotosSalteadas += 1; continue }
        await ongService.guardarDocumento({
          tipo: 'emitido', subtipo: 'Constancia',
          fecha: new Date().toLocaleDateString('en-CA'),
          descripcion: g.titulo, notas: g.texto,
        })
        fotosEmitidas += 1
      }

      const total = rE.emitidos + rC.emitidos + fotosEmitidas
      const yaEstaban = rE.salteados + rC.salteados + fotosSalteadas
      toast.success(total > 0
        ? `${total} registro(s) emitido(s)${yaEstaban ? `, ${yaEstaban} ya estaban` : ''}`
        : 'Ya estaba todo respaldado')
      onEmitido?.()
    } catch (e) {
      toast.error(`No se pudo emitir: ${(e as Error).message}`)
    } finally { setRespaldando(false) }
  }

  const generar = (p: Plantilla) => {
    if (p === 'cupo') { setDoc(constanciaCupo(pacientes, entidad)); return }
    if (p === 'padron') { setDoc(padronVinculados(pacientes, entidad)); return }
    if (p === 'entregas') {
      // Por defecto el semestre en curso: es el período que pide el informe del
      // director médico, así que es el que se va a emitir casi siempre.
      const hoy = new Date()
      const desde = `${hoy.getFullYear()}-${hoy.getMonth() < 6 ? '01-01' : '07-01'}`
      setDoc(registroEntregas(dispensas ?? [], desde, hoy.toLocaleDateString('en-CA'), entidad))
      return
    }
    if (p === 'estatuto') {
      setDoc(estatutoModelo(entidad))
      return
    }
    if (p === 'geneticas') {
      setDoc(informeGeneticas(
        variedades.map(v => ({ nombre: v.nombre, tipo: v.tipo, thc: v.thc_estimado, cbd: v.cbd_estimado })),
        entidad, quien || undefined, dispensadas))
      return
    }
    if (p === 'mandato') {
      const aso = asociados.find(a => a.nombre === quien)
      if (!aso) { toast.error('Elegí el asociado'); return }
      const pac = pacientes.find(x => x.nombre_completo === aso.nombre) ?? null
      setDoc(ddjjMandato(aso, entidad, pac))
      return
    }
    if (p === 'comodato_sede' || p === 'comodato_predio') {
      setDoc(comodato(p === 'comodato_sede' ? 'sede_social' : 'predio_cultivo',
        { comodante: quien || undefined, direccion: dato || undefined }, entidad))
      return
    }
    setDoc(designacion(p, {
      nombre: quien || undefined,
      matricula: p === 'director_medico' ? dato || undefined : undefined,
      titulo: p === 'responsable_tecnico' ? dato || undefined : undefined,
      actaNumero: ultimaCD?.numero,
      actaFecha: ultimaCD?.fecha,
    }, entidad))
  }

  const cfg = PLANTILLAS.find(p => p.id === abierta)
  const esDesignacion = abierta === 'director_medico' || abierta === 'responsable_tecnico'
  const esComodato = abierta === 'comodato_sede' || abierta === 'comodato_predio'

  const etiquetaDato = abierta === 'director_medico' ? 'Matrícula y registro REFEPS'
    : abierta === 'responsable_tecnico' ? 'Título o acreditación'
    : esComodato ? 'Dirección del inmueble' : null
  const etiquetaQuien = esComodato ? 'Quién cede el inmueble'
    : abierta === 'geneticas' ? 'Responsable técnico que firma'
    : abierta === 'mandato' ? 'Asociado' : 'Persona designada'

  return (
    <div className={tarjeta}>
      <div className="flex items-center gap-2 flex-wrap">
        <FileSignature className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} />
        <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">Plantillas institucionales</h3>
        {/* Respaldar todo lo entregado, de la más vieja a la más nueva. Es
            idempotente: los meses ya emitidos se saltean. */}
        {((dispensas?.length ?? 0) > 0 || (caja?.length ?? 0) > 0) && (
          <button onClick={respaldar} disabled={respaldando}
            className={`${btnSutil} flex-shrink-0 disabled:opacity-50`}>
            {respaldando
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Archive className="w-3.5 h-3.5" />}
            {respaldando ? 'Emitiendo…' : 'Respaldar todo el histórico'}
          </button>
        )}
      </div>
      <p className="text-[11px] text-[#8a8a9c] mt-2">
        Los instrumentos que pide la Resolución 1780 y que hasta acá eran sólo un tilde en la lista de
        requisitos. Se completan con lo que ya está cargado; lo que falte queda marcado entre corchetes.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
        {PLANTILLAS.map(p => (
          <button key={p.id}
            onClick={() => {
              // Las automáticas no piden nada: pedir un dato que no se usa sería
              // un paso de más para que la persona apriete Enter.
              if (AUTOMATICAS.indexOf(p.id) >= 0) { generar(p.id); return }
              setAbierta(p.id); setQuien(''); setDato('')
            }}
            className="text-left rounded-lg bg-[#15151d] border border-[#1f1f2b] hover:border-[#404d20] px-3 py-2.5 min-h-[44px] transition-colors">
            <p className="text-[12px] text-[#ececf1]">{p.label}</p>
            <p className="text-[10px] text-[#8a8a9c] leading-snug mt-0.5">{p.detalle}</p>
          </button>
        ))}
      </div>

      {abierta && cfg && (
        <div ref={refDialogo} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
          onClick={() => setAbierta(null)}>
          <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain"
            onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-[#1f1f2b] flex items-center gap-2">
              <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">{cfg.label}</h3>
              <button onClick={() => setAbierta(null)} aria-label="Cerrar"
                className="ml-auto min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <label><span className={etiquetaCampo}>{etiquetaQuien}</span>
                {abierta === 'mandato' ? (
                  <select className={inputFormulario} value={quien} onChange={e => setQuien(e.target.value)}>
                    <option value="">Elegir…</option>
                    {asociados.map(a => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                  </select>
                ) : (
                  <input className={inputFormulario} value={quien} onChange={e => setQuien(e.target.value)}
                    list={esDesignacion ? 'autoridades-lista' : undefined}
                    placeholder="Nombre y apellido" />
                )}
              </label>
              <datalist id="autoridades-lista">
                {activas.map(a => <option key={a.nombre} value={a.nombre}>{a.cargo}</option>)}
              </datalist>

              {etiquetaDato && (
                <label><span className={etiquetaCampo}>{etiquetaDato}</span>
                  <input className={inputFormulario} value={dato} onChange={e => setDato(e.target.value)} /></label>
              )}

              {abierta === 'geneticas' && (
                <p className="text-[11px] text-[#8a8a9c] leading-relaxed">
                  Se van a declarar las {variedades.length} variedad{variedades.length === 1 ? '' : 'es'} cargadas
                  en Genéticas, con el perfil de cada ficha.
                </p>
              )}

              {esDesignacion && (
                <p className="text-[11px] text-[#8a8a9c] leading-relaxed">
                  {ultimaCD
                    ? `Va a remitir al Acta de Comisión Directiva N° ${ultimaCD.numero} del ${ultimaCD.fecha}.`
                    : 'No hay actas de Comisión Directiva cargadas: el documento va a salir sin la referencia al acta, que es lo que prueba dónde se resolvió.'}
                </p>
              )}
            </div>

            <div className="px-4 py-3 border-t border-[#1f1f2b] flex gap-2">
              <button onClick={() => setAbierta(null)} className={btnSutil}>Cancelar</button>
              <button onClick={() => { generar(abierta); setAbierta(null) }} className={`${btnPrimario} flex-1`}>
                Generar
              </button>
            </div>
          </div>
        </div>
      )}

      {doc && (
        <VisorDocumento titulo={doc.titulo} texto={doc.texto} faltantes={doc.faltantes}
          onEmitido={onEmitido} entidad={entidad}
          archivo={{ subtipo: PLANTILLAS.find(p => p.id === abierta)?.label ?? 'Documento institucional' }}
          nota="Se imprime y se firma. Lo que quedó entre corchetes hay que completarlo a mano o cargarlo en la app y volver a generarlo."
          onCerrar={() => setDoc(null)} />
      )}
    </div>
  )
}
