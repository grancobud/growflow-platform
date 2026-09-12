// Lo que faltaba para cerrar el circuito del acta: elegir quiénes asistieron, y
// sacar el texto redactado para pasarlo al libro.
//
// Los libros de la asociación son físicos y rubricados. Antes se cargaban los
// datos acá y después había que redactar el acta aparte, a mano. Ahora se carga
// una vez y sale lista para imprimir y pegar.

import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, Printer, Users, Save, X } from 'lucide-react'
import { redactarActa, faltantesDelActa } from '../../lib/actaTexto'
import { ongService, type Acta, type Entidad } from '../../lib/ong'
import { pdfDelDocumento, nombreDePdf, registroDeEntidad, renglonesDelRegistro } from '../../lib/pdfDocumento'
import { EMBLEMA } from '../../lib/marca'
import { btnPrimario, btnSutil, etiquetaCampo, inputFormulario } from '../../lib/ui'
import { useDialogo } from '../../lib/useDialogo'


/**
 * Quiénes asistieron. El libro de Asistencia a reuniones pide los nombres, no
 * el total: sin ellos el quórum es la palabra contra el registro.
 *
 * Se eligen de una lista —autoridades primero, que son las que hacen quórum— y
 * queda un campo libre para quien no esté en ninguna: el contador, el escribano,
 * un invitado.
 */
export function Asistentes({ nombres, candidatos, requerido, onChange }: {
  nombres: string[]
  candidatos: string[]
  requerido: number | null
  onChange: (n: string[]) => void
}) {
  const [libre, setLibre] = useState('')

  const toggle = (n: string) =>
    onChange(nombres.includes(n) ? nombres.filter(x => x !== n) : [...nombres, n])

  const agregarLibre = () => {
    const n = libre.trim()
    if (!n) return
    if (!nombres.includes(n)) onChange([...nombres, n])
    setLibre('')
  }

  const falta = requerido != null ? requerido - nombres.length : null
  const extras = nombres.filter(n => !candidatos.includes(n))

  return (
    <div className="rounded-lg bg-[#101016] border border-[#1f1f2b] p-3">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={etiquetaCampo}>
          <Users className="w-3 h-3 inline mr-1 -mt-0.5" />Asistentes
        </span>
        <span className="text-[11px] tabular-nums ml-auto font-medium"
          style={{ color: falta != null && falta > 0 ? '#ff8a7a' : '#bef264' }}>
          {nombres.length}{requerido != null ? ` de ${requerido}` : ''}
          {falta != null && falta > 0 ? ` · faltan ${falta} para el quórum` : ''}
        </span>
      </div>

      {candidatos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {candidatos.map(n => {
            const puesto = nombres.includes(n)
            return (
              <button key={n} type="button" onClick={() => toggle(n)}
                className="text-[11px] px-2.5 py-2 sm:py-1 min-h-[44px] sm:min-h-0 rounded-lg border transition-colors"
                style={puesto
                  ? { borderColor: '#404d20', background: 'rgba(163,230,53,0.12)', color: '#d9f99d' }
                  : { borderColor: '#2a2a3a', background: '#15151d', color: '#a6a6b5' }}>
                {puesto ? '✓ ' : ''}{n}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex gap-2 mt-2">
        <input value={libre} onChange={e => setLibre(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarLibre() } }}
          placeholder="Otro asistente (contador, invitado…)" className={inputFormulario} />
        <button type="button" onClick={agregarLibre} className={btnSutil}>Sumar</button>
      </div>

      {extras.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {extras.map(n => (
            <button key={n} type="button" onClick={() => toggle(n)}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-[#404d20] bg-[#a3e635]/12 text-[#d9f99d]"
              aria-label={`Quitar ${n}`}>
              {n} ×
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** El acta redactada, para imprimir y pegar en el libro o transcribir. */
export function VisorActa({ acta, entidad, onCerrar, onEmitido }: {
  acta: Acta; entidad: Entidad | null; onCerrar: () => void; onEmitido?: () => void
}) {
  return (
    <VisorDocumento titulo={`Acta N° ${acta.numero} · para el libro`}
      texto={redactarActa(acta, entidad)} faltantes={faltantesDelActa(acta, entidad)}
      nota={'Los libros son físicos y rubricados: esto se imprime y se pega, o se transcribe. ' +
        'El formato sigue el uso habitual de las actas de asociación civil, que es lo que se espera en una inspección.'}
      entidad={entidad}
      archivo={{ subtipo: 'Acta', numero: String(acta.numero) }}
      onEmitido={onEmitido}
      onCerrar={onCerrar} />
  )
}

/**
 * Con qué datos queda archivado el papel.
 *
 * Sin esto el documento se guarda igual, pero como «Otro» y sin dueño: aparece
 * en la lista y no se lo puede encontrar por paciente ni por número. Seis meses
 * después, en una inspección, «está en algún lado» y «se puede mostrar» no son
 * lo mismo.
 */
export interface ArchivoDelDocumento {
  /** La clase real del papel, como se la nombra en la vida real. */
  subtipo: string
  /** El número del talonario, si este papel lleva. */
  numero?: string | null
  paciente_id?: string | null
  dispensa_id?: string | null
  /** La plata que documenta, si documenta plata. */
  monto?: number | null
}

/**
 * Visor de cualquier documento generado: acta, recibo, guía de tránsito,
 * mandato. Todos terminan en papel, así que todos comparten lo mismo — texto en
 * serif, aviso de lo que falta, copiar e imprimir con márgenes de hoja.
 */
export function VisorDocumento({
  titulo, texto, faltantes, nota, extra, onCerrar, onEmitido, entidad, archivo, yaArchivado,
}: {
  titulo: string; texto: string; faltantes: string[]; nota?: string
  /** Controles propios del documento, p. ej. alternar entre dos versiones. */
  extra?: React.ReactNode
  onCerrar: () => void
  /** Si viene, aparece "Emitir": guarda el documento para poder verlo después. */
  onEmitido?: () => void
  /**
   * La entidad entera, no solo el nombre.
   *
   * Antes esta prop era `entidadNombre` y las nueve pantallas le pasaban
   * `entidad?.razon_social`: todas tenian la entidad a mano y le sacaban un
   * campo. Con la entidad completa el membrete puede llevar tambien el CUIT y
   * el organismo de control, que es lo que identifica a la persona juridica
   * cuando el papel ya salio de la app.
   *
   * Si falta, el membrete sale con "GrowFlow" y sin bloque registral.
   */
  entidad?: Entidad | null
  /** Cómo se clasifica y a quién pertenece lo que se archiva. */
  archivo?: ArchivoDelDocumento
  /**
   * Este documento SALE del archivo: se está reabriendo uno ya emitido.
   *
   * Se declara a propósito en vez de deducirlo de que no venga `onEmitido`.
   * Sin marca, «este papel todavía no se puede archivar» y «este papel ya está
   * archivado» se escriben igual —los dos son la ausencia de un prop— y no hay
   * forma de distinguir el visor al que le falta cablear el archivado del que
   * no debe archivar nunca. Volver a emitirlo lo duplicaría.
   */
  yaArchivado?: boolean
}) {
  const faltan = faltantes
  const [emitiendo, setEmitiendo] = useState(false)

  // Un solo camino de la entidad al papel: el PDF y la vista de impresion leen
  // de aca. Cuando cada uno se armaba su membrete por su lado, lo que se
  // archivaba y lo que se firmaba podian diferir sin que nada avisara.
  const entidadNombre = entidad?.razon_social ?? null
  const registro = registroDeEntidad(entidad)

  // En el celular este modal ocupa casi toda la pantalla y no tenía X: la única
  // salida era tocar el fondo, una franja de arriba que cae debajo de la barra
  // de estado. Quedabas encerrado.
  const refDialogo = useDialogo(onCerrar)

  // Emitir = dejar constancia de que este documento existió, con su texto y su
  // fecha. Antes se podía generar, copiar e imprimir, pero no quedaba registro:
  // la pestaña Documentos decía "EMITIDOS 0" con seis plantillas andando. Un
  // documento que no se puede volver a ver no sirve en una inspección seis
  // meses después.
  const emitir = async () => {
    setEmitiendo(true)
    try {
      const hoy = new Date().toLocaleDateString('en-CA')

      // El PDF se archiva junto con el texto, no en su lugar.
      //
      // El texto es lo que permite reabrir el documento adentro de la app; el
      // PDF es lo que sale de la app y sigue valiendo afuera: se manda por
      // mail, se adjunta a un expediente, se presenta en una mesa de entradas.
      //
      // Si el PDF falla, el documento se archiva IGUAL. Perder el archivo
      // adjunto es molesto; perder la constancia de que el papel se emitió es
      // lo que no se puede recuperar después.
      let archivado: { path: string; nombre: string } | null = null
      try {
        const blob = await pdfDelDocumento({
          titulo, texto, entidadNombre: entidadNombre ?? null,
          emitido: new Date().toLocaleDateString('es-AR'),
          registro,
        })
        const nombre = nombreDePdf(titulo, hoy)
        archivado = await ongService.subirArchivoDocumento(
          new File([blob], nombre, { type: 'application/pdf' }))
      } catch (e) {
        toast.warning(`El documento se guarda, pero no se pudo archivar el PDF: ${(e as Error).message}`)
      }

      await ongService.guardarDocumento({
        archivo_path: archivado?.path ?? null,
        archivo_nombre: archivado?.nombre ?? null,
        tipo: 'emitido',
        // El subtipo lo declara cada pantalla, porque es la única que sabe qué
        // papel está emitiendo. Antes era la constante 'Constancia' para todos:
        // no sólo mentía sobre la clase, sino que ni siquiera era una de las
        // válidas, así que la lista mostraba nueve papeles distintos con la
        // misma etiqueta inexistente.
        subtipo: archivo?.subtipo ?? 'Otro',
        numero: archivo?.numero ?? null,
        paciente_id: archivo?.paciente_id ?? null,
        dispensa_id: archivo?.dispensa_id ?? null,
        monto: archivo?.monto ?? null,
        fecha: hoy,
        descripcion: titulo,
        // El texto completo va en notas: así se reabre tal cual se emitió,
        // aunque los datos de origen hayan cambiado después.
        notas: texto,
      })
      toast.success('Documento emitido y guardado')
      onEmitido?.()
    } catch (e) {
      toast.error(`No se pudo guardar: ${(e as Error).message}`)
    } finally { setEmitiendo(false) }
  }

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); toast.success('Documento copiado') }
    catch { toast.error('No se pudo copiar al portapapeles') }
  }

  // Ventana aparte con formato de documento institucional: el destino es el
  // papel o el PDF, no la pantalla.
  //
  // POR QUE ESTE FORMATO Y NO TEXTO PELADO
  // Antes salía como un volcado en serif, sin membrete ni pie. Un documento que
  // se presenta ante una autoridad y no dice de quién es ni cuándo se emitió no
  // se distingue de un borrador. Ahora lleva membrete con el logo, la entidad,
  // la fecha de emisión y numeración de página.
  //
  // Se imprime en CLARO aunque la app sea oscura: es tinta sobre papel. Los
  // acentos de color quedan en el verde de la casa, que es lo único de la marca
  // que sobrevive a una fotocopia en blanco y negro sin volverse una mancha.
  //
  // El logo va por URL y no embebido: si no carga, el documento sale igual con
  // el nombre de la entidad. Un membrete roto no puede impedir imprimir.
  const imprimir = () => {
    const w = window.open('', '_blank', 'width=820,height=900')
    if (!w) { toast.error('El navegador bloqueó la ventana. Permitile abrir ventanas.'); return }
    const esc = (t: string) => t.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
    const emitido = new Date().toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
    w.document.write([
      '<!doctype html><html lang="es"><head><meta charset="utf-8">',
      `<title>${esc(titulo)}</title>`,
      '<style>',
      // Membrete y pie repetidos en cada hoja: un documento de varias páginas
      // tiene que poder separarse sin perder de quién es.
      '@page{margin:2.2cm 2cm 2.4cm;size:A4}',
      '*{box-sizing:border-box}',
      'body{font-family:Georgia,"Times New Roman",serif;font-size:11pt;line-height:1.7;',
      'color:#111;margin:0;background:#fff}',
      '.membrete{display:flex;align-items:center;gap:14px;padding-bottom:10px;',
      'border-bottom:2.5px solid #4d7c0f;margin-bottom:12px}',
      // El bloque registral: mismo cuerpo chico y mismo orden que en el PDF.
      // Si los dos no se leen como el mismo papel, en una inspeccion hay que
      // explicar por que difieren.
      '.reg{font-family:system-ui,sans-serif;font-size:7pt;color:#78716c;',
      'line-height:1.6;margin:0 0 16px}',
      '.membrete img{height:46px;width:auto}',
      '.membrete .n{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;',
      'font-weight:700;font-size:13pt;letter-spacing:-.2px;color:#1a2e05;line-height:1.2}',
      '.membrete .s{font-family:system-ui,sans-serif;font-size:8.5pt;color:#57534e;',
      'text-transform:uppercase;letter-spacing:1.1px;margin-top:3px}',
      '.membrete .f{margin-left:auto;text-align:right;font-family:system-ui,sans-serif;',
      'font-size:8.5pt;color:#57534e;line-height:1.5}',
      'h1{font-family:system-ui,sans-serif;font-size:12.5pt;letter-spacing:.4px;',
      'text-transform:uppercase;color:#1a2e05;margin:0 0 14px;padding-bottom:6px;',
      'border-bottom:1px solid #e7e5e4}',
      'pre{font-family:Georgia,"Times New Roman",serif;font-size:10.5pt;line-height:1.7;',
      'white-space:pre-wrap;word-wrap:break-word;margin:0}',
      '.pie{position:fixed;bottom:0;left:0;right:0;padding-top:6px;',
      'border-top:1px solid #e7e5e4;font-family:system-ui,sans-serif;font-size:7.5pt;',
      'color:#78716c;display:flex;justify-content:space-between}',
      // Los corchetes de lo que falta se resaltan también en papel: quien firma
      // tiene que ver qué está sin completar antes de firmar.
      '.falta{background:#fef9c3;padding:0 2px;border-radius:2px}',
      '@media print{.pie{position:fixed}}',
      '</style></head><body>',
      '<div class="membrete">',
      `<img src="${window.location.origin}${EMBLEMA}" alt="" onerror="this.remove()">`,
      '<div><div class="n">', esc(entidadNombre || 'GrowFlow'), '</div>',
      '<div class="s">Trazabilidad y vida institucional</div></div>',
      `<div class="f">Emitido<br><strong>${emitido}</strong>`,
      registro?.cuit ? `<br>CUIT ${esc(registro.cuit)}` : '',
      '</div>',
      '</div>',
      // Cada renglon se arma con lo que haya, y el que queda vacio no se
      // dibuja: un rotulo con una raya al lado dice que la asociacion no tiene
      // el dato, cuando lo que paso es que no se cargo.
      renglonesDelRegistro(registro).length
        ? `<div class="reg">${renglonesDelRegistro(registro).map(esc).join('<br>')}</div>`
        : '',
      `<h1>${esc(titulo)}</h1>`,
      // El resaltado de faltantes se aplica sobre el texto YA escapado, para no
      // abrir un agujero de inyección con el contenido del documento.
      `<pre>${esc(texto).replace(/\[([^\]]+)\]/g, '<span class="falta">[$1]</span>')}</pre>`,
      `<div class="pie"><span>${esc(titulo)}</span><span>${emitido}</span></div>`,
      '</body></html>',
    ].join(''))
    w.document.close(); w.focus()
    // Un tick para que el logo cargue antes de abrir el diálogo: sin esto el
    // preview sale sin membrete la primera vez.
    setTimeout(() => w.print(), 250)
  }

  return (
    <div ref={refDialogo} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onCerrar}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#1f1f2b] sticky top-0 bg-[#0d0d12] flex items-center gap-2 flex-wrap">
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">{titulo}</h3>
          {extra}
          <div className="w-full sm:w-auto sm:ml-auto flex gap-2 items-center">
            <button onClick={copiar} className={btnSutil}><Copy className="w-3.5 h-3.5" /> Copiar</button>
            {/* Lo que sale del archivo no se vuelve a emitir: sería el mismo
                papel guardado dos veces, con dos fechas de emisión distintas. */}
            {onEmitido && !yaArchivado && (
              <button onClick={emitir} disabled={emitiendo} className={`${btnSutil} disabled:opacity-50`}>
                <Save className="w-3.5 h-3.5" /> {emitiendo ? 'Guardando…' : 'Emitir'}
              </button>
            )}
            {yaArchivado && (
              <span className="self-center text-[11px] text-[#8a8a9c]">Ya archivado</span>
            )}
            <button onClick={imprimir} className={btnPrimario}><Printer className="w-3.5 h-3.5" /> Imprimir</button>
            <button onClick={onCerrar} aria-label="Cerrar"
              className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {faltan.length > 0 && (
            <div className="rounded-lg bg-[#5a4a20]/15 border border-[#5a4a20] p-2.5 mb-3">
              <p className="text-[11px] text-[#fbbf24] leading-relaxed">
                Falta cargar {faltan.join(', ')}. En el texto queda marcado entre corchetes: completalo a mano
                o cargá el dato y volvé a abrir esto.
              </p>
            </div>
          )}
          {/* Serif y ancho de lectura: es un documento, no una pantalla */}
          <pre className="whitespace-pre-wrap font-serif text-[12px] leading-[1.75] text-[#d4d4dd] bg-[#0a0a0f] rounded-lg border border-[#1f1f2b] p-4 overflow-x-auto">
            {texto}
          </pre>
          {nota && <p className="text-[10px] text-[#8a8a9c] mt-2 leading-relaxed">{nota}</p>}
        </div>
        <div className="px-4 py-3 border-t border-[#1f1f2b] sticky bottom-0 bg-[#0d0d12]">
          <button onClick={onCerrar} className="w-full min-h-[44px] flex items-center justify-center rounded-lg border border-[#2a2a3a] text-[12px] text-[#a6a6b5] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
