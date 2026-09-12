/**
 * LO QUE SE LE PRESENTA AL MINISTERIO DE SALUD.
 *
 * Los cuatro entregables de la Res. 1780/2025 estaban repartidos por toda la
 * app —el padrón acá, las plantas allá, el informe médico en Seguimiento— y
 * nadie podía contestar la única pregunta que importa antes de una
 * presentación: si con esto se puede presentar o no.
 *
 * Primero el control, después los papeles. Al revés se genera un PDF prolijo
 * con seis renglones incompletos y se manda igual, porque el que lo genera no
 * tiene forma de saber que están incompletos.
 */
import { useMemo, useState } from 'react'
import { FileText, ShieldCheck, AlertTriangle, XCircle, Mail } from 'lucide-react'
import {
  estadoDeLaNomina, sePuedePresentar, nominaDeUsuarios, ddjjSemestral,
  PASOS_PRESENTACION, CORREO_REPROCANN_ONG,
  type DatosNomina, type RequisitoNomina,
} from '../../lib/nominaMinisterio'
import type { DocumentoGenerado } from '../../lib/documentosLegales'
import { VisorDocumento } from './ActaParaLibro'
import { tarjeta, btnPrimario, btnSutil } from '../../lib/ui'

const COLOR: Record<RequisitoNomina['estado'], string> = {
  ok: '#a3e635', alerta: '#facc15', error: '#ff8a7a',
}
/**
 * El accesor con `??`, no el indexado directo. Es la regla de la casa: el día
 * que aparezca un estado nuevo tiene que salir un color, no un `undefined`.
 */
const colorDe = (e: string) => COLOR[e as RequisitoNomina['estado']] ?? COLOR.alerta

const Icono = ({ estado }: { estado: RequisitoNomina['estado'] }) =>
  estado === 'ok' ? <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: COLOR.ok }} strokeWidth={1.8} />
    : estado === 'alerta' ? <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: COLOR.alerta }} strokeWidth={1.8} />
      : <XCircle className="w-4 h-4 shrink-0" style={{ color: COLOR.error }} strokeWidth={1.8} />

export function NominaMinisterio({ datos, geneticas, onCambio }: {
  datos: DatosNomina
  /** Las variedades registradas que se están cultivando, para la DDJJ. */
  geneticas: string[]
  onCambio: () => void
}) {
  /**
   * El documento abierto Y qué clase de papel es.
   *
   * El subtipo viaja junto y no se deduce del título: es con lo que se archiva,
   * y un papel archivado como «Otro» entra a la lista y después no se lo puede
   * encontrar, que es justo para lo que se archiva.
   */
  const [doc, setDoc] = useState<{ doc: DocumentoGenerado; subtipo: string } | null>(null)
  const hoy = new Date().toISOString().slice(0, 10)

  const requisitos = useMemo(() => estadoDeLaNomina(datos), [datos])
  const listo = sePuedePresentar(requisitos)
  const errores = requisitos.filter(r => r.estado === 'error').length

  return (
    <div className="px-3 sm:px-6 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] space-y-4">

      {/* PRIMERO SI SE PUEDE PRESENTAR, DESPUÉS LOS BOTONES.
          Un botón de «generar» arriba de todo invita a generar y mandar sin
          mirar, que es exactamente el error que esta pantalla viene a evitar. */}
      <div className={`${tarjeta} ${listo ? 'border-[#2a3a1d]' : 'border-[#3a1d1d]'}`}>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
            Nómina y presentaciones al Ministerio de Salud
          </h3>
        </div>
        <p className="text-[12px] text-[#a6a6b5] leading-relaxed">
          La Res. 1780/2025 pide cuatro cosas: la <b className="text-[#ececf1]">nómina</b> de usuarios
          permitidos, un informe <b className="text-[#ececf1]">cromatográfico por lote</b>, una{' '}
          <b className="text-[#ececf1]">DDJJ semestral</b> con plantas y pacientes, y el{' '}
          <b className="text-[#ececf1]">informe semestral del Director Médico</b>. Todo en PDF a{' '}
          <span className="font-mono text-[#d9f99d]">{CORREO_REPROCANN_ONG}</span>.
        </p>
        <p className="mt-2 text-[12px]" style={{ color: listo ? COLOR.ok : COLOR.error }}>
          {listo
            ? 'Con los datos de hoy se puede presentar.'
            : `Todavía no se puede presentar: ${errores} ${errores === 1 ? 'requisito' : 'requisitos'} sin cumplir.`}
        </p>
      </div>

      {/* El control, requisito por requisito. */}
      <div className={tarjeta}>
        <h3 className="font-display font-semibold text-[14px] text-[#ececf1] mb-3">Qué falta</h3>
        <div className="divide-y divide-[#2a2a3a]">
          {requisitos.map(r => (
            <div key={r.clave} className="py-2.5 flex gap-2.5">
              <div className="pt-0.5"><Icono estado={r.estado} /></div>
              <div className="min-w-0">
                <p className="text-[13px] text-[#ececf1]">
                  {r.titulo}{' '}
                  <span className="font-mono text-[12px]" style={{ color: colorDe(r.estado) }}>{r.valor}</span>
                </p>
                <p className="text-[11px] text-[#8a8a9c] leading-relaxed mt-0.5">{r.detalle}</p>
                {r.quienes && (
                  <p className="text-[11px] text-[#a6a6b5] mt-1">
                    Les falta a: <span className="text-[#c9cabf]">{r.quienes}</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Los documentos que esta pantalla sí puede armar. */}
      <div className={tarjeta}>
        <h3 className="font-display font-semibold text-[14px] text-[#ececf1] mb-1">Generar</h3>
        <p className="text-[12px] text-[#8a8a9c] mb-3">
          Salen con los datos de hoy. Los renglones incompletos van marcados, no se omiten:
          una nómina más corta que el padrón real es lo primero que una inspección pregunta.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimario}
            onClick={() => setDoc({
              doc: nominaDeUsuarios(datos.padron, datos.entidad, hoy),
              subtipo: 'Nómina de usuarios (Min. Salud)',
            })}>
            Nómina de usuarios
          </button>
          <button className={btnSutil}
            onClick={() => setDoc({
              doc: ddjjSemestral(datos, hoy, geneticas),
              // NO es «DDJJ semestral» a secas: esa clase ya existe y es la del
              // cultivo, que firma el responsable técnico. Ésta es la de la
              // 1780 y la firma el representante legal. Con el mismo nombre,
              // dentro de dos años nadie sabe cuál presentó a quién.
              subtipo: 'DDJJ semestral REPROCANN (Min. Salud)',
            })}>
            DDJJ semestral
          </button>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-3">
          El <b className="text-[#a6a6b5]">informe del Director Médico</b> se arma en Seguimiento, con la
          evolución de cada paciente. Las <b className="text-[#a6a6b5]">cromatografías</b> las emite el
          laboratorio y se adjuntan a cada lote.
        </p>
      </div>

      {/* Los pasos. Van acá y no en el manual: se leen en el momento de hacerlo. */}
      <div className={tarjeta}>
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Cómo se presenta</h3>
        </div>
        <ol className="space-y-3">
          {PASOS_PRESENTACION.map((p, i) => (
            <li key={p.titulo} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full border border-[#2a2a3a] bg-[#15151d] grid place-items-center font-mono text-[11px] text-[#a6a6b5]">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] text-[#ececf1]">{p.titulo}</p>
                <p className="text-[11px] text-[#8a8a9c] leading-relaxed">{p.detalle}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {doc && (
        <VisorDocumento
          titulo={doc.doc.titulo} texto={doc.doc.texto} faltantes={doc.doc.faltantes}
          entidad={datos.entidad}
          // Se archiva porque una presentación ante el Estado tiene que poder
          // mostrarse dentro de dos años tal como se presentó, y no como la app
          // la calcularía hoy. Es el paso 5 de la lista de abajo.
          onEmitido={onCambio}
          archivo={{ subtipo: doc.subtipo }}
          nota={`Se presenta en PDF a ${CORREO_REPROCANN_ONG}. Lo firma el representante legal. `
            + 'Al emitirlo queda archivado: esa copia es la constancia de qué se presentó y cuándo.'}
          onCerrar={() => setDoc(null)} />
      )}
    </div>
  )
}
