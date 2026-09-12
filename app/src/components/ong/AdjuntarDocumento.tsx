// Subir un documento desde el link propio de la persona.
//
// Sirve para los dos que se piden: la constancia de REPROCANN y el DNI. Vive
// acá y no adentro de una pantalla porque lo usan dos: el formulario, apenas
// termina de enviarse, y la pantalla del token cuando la persona vuelve.
//
// NO SUBE A STORAGE DIRECTO. Va contra la Edge Function `solicitud-adjunto`,
// que valida el token y escribe con service role. Darle a `anon` permiso de
// subida sobre `documentos` sería abrir escritura pública en un bucket que
// guarda credenciales de personas reales, y la clave anónima está en el bundle.

import { useState } from 'react'
import { etiquetaCampo } from '../../lib/ui'
import { Check, Upload, Loader2, AlertTriangle } from 'lucide-react'
import { solicitudesService } from '../../lib/solicitudes'
import { numeroDeReprocann } from '../../lib/datosDelFormulario'

const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[13px] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#a3e635]/60 transition-colors'

export function AdjuntarDocumento({
  token, tipo, yaCargado, nroCargado, onListo, compacto = false,
}: {
  token: string
  tipo: 'reprocann' | 'dni'
  yaCargado: boolean
  /** Sólo para `reprocann`: el número ya guardado, si lo hay. */
  nroCargado?: string | null
  onListo?: () => void
  /** Sin el marco propio, para cuando ya va dentro de una tarjeta. */
  compacto?: boolean
}) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [nro, setNro] = useState(nroCargado ?? '')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  const esRepro = tipo === 'reprocann'
  const titulo = esRepro ? 'Tu constancia de REPROCANN' : 'Tu DNI'

  // La misma regla que usa el importador y que revalida la Edge Function. Se
  // avisa mientras escribe, no después de subir 8 MB para nada.
  const nroRaro = esRepro && nro.trim() !== '' && numeroDeReprocann(nro.trim()) === null

  const subir = async () => {
    if (!archivo) return
    setSubiendo(true)
    setError(null)
    try {
      await solicitudesService.adjuntarDocumento(token, tipo, archivo, esRepro ? nro : undefined)
      setListo(true)
      onListo?.()
    } catch (e) {
      setError((e as Error).message)
    } finally { setSubiendo(false) }
  }

  const marco = compacto
    ? 'rounded-lg border border-[#2a2a3a] bg-[#0d0d12] p-3'
    : 'rounded-xl border border-[#1f1f2b] bg-[#101016] p-4'

  if (listo || yaCargado) {
    return (
      <div className={compacto
        ? 'rounded-lg border border-[#404d20] bg-[#a3e635]/5 p-3'
        : 'rounded-xl border border-[#404d20] bg-[#a3e635]/5 p-4'}>
        <div className="flex items-center gap-2">
          <Check aria-hidden className="w-4 h-4 text-[#bef264]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[13px] text-[#ececf1]">
            {titulo} ya llegó
          </h3>
        </div>
        <p className="mt-1 text-[11px] text-[#a6a6b5] leading-relaxed">
          Lo recibimos{esRepro && nroCargado
            ? <> con el número <code className="font-mono text-[#d9f99d]">{nroCargado}</code></>
            : null}. No hace falta que lo mandes de nuevo.
        </p>
      </div>
    )
  }

  return (
    <div className={marco}>
      <div className="flex items-center gap-2">
        <Upload aria-hidden className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} />
        <h3 className="font-display font-semibold text-[13px] text-[#ececf1]">{titulo}</h3>
      </div>
      <p className="mt-1 text-[11px] text-[#a6a6b5] leading-relaxed">
        {esRepro
          ? 'Una foto del carnet o el PDF de la constancia. Si todavía estás con el trámite, dejalo para después: este link te sigue sirviendo.'
          : 'Una foto de ambos lados, o el PDF. Es lo que respalda que los datos que cargaste son tuyos.'}
      </p>

      <div className="mt-3 space-y-3">
        {esRepro && (
          <label>
            <span className={etiquetaCampo}>Número de la credencial (opcional)</span>
            <input value={nro} onChange={e => setNro(e.target.value)}
              className={inputCls} placeholder="El que figura en el carnet" />
            {nroRaro && (
              <span className="block text-[10px] text-[#fbbf24] mt-1 leading-snug">
                Eso no parece un número de credencial. Si no lo tenés a mano, dejalo
                vacío y subí igual la constancia.
              </span>
            )}
          </label>
        )}

        <label>
          <span className={etiquetaCampo}>El archivo</span>
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={e => { setArchivo(e.target.files?.[0] ?? null); setError(null) }}
            className="block w-full text-[12px] text-[#a6a6b5] file:mr-3 file:py-2.5 file:px-3 file:rounded-lg file:border-0 file:text-[12px] file:font-medium file:bg-[#15151d] file:text-[#d9f99d] file:cursor-pointer" />
          <span className="block text-[10px] text-[#8a8a9c] mt-1 leading-snug">
            PDF o imagen, hasta 20 MB.
          </span>
        </label>

        {error && (
          <p className="flex items-start gap-1.5 text-[12px] text-[#ff8a7a] rounded-lg bg-[#7a2820]/15 border border-[#7a2820] p-2.5 leading-relaxed">
            <AlertTriangle aria-hidden className="w-3.5 h-3.5 flex-shrink-0 mt-px" />{error}
          </p>
        )}

        <button onClick={subir} disabled={!archivo || subiendo}
          className="w-full inline-flex items-center justify-center gap-2 text-[13px] text-[#07070b] bg-[#a3e635] hover:bg-[#bef264] disabled:opacity-50 rounded-lg px-3 py-3 min-h-[44px] font-medium transition-colors">
          {subiendo
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo…</>
            : <><Upload className="w-4 h-4" /> Subir</>}
        </button>
      </div>
    </div>
  )
}
