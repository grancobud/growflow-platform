// Los pasos para que alguien se sume, listos para mandar.
//
// Se usa en dos lados con la misma fuente de datos (lib/altaSocios.ts): adentro
// de `O.N.G. > Pacientes`, donde quien atiende necesita el link a mano, y en la
// pagina publica /sumate, que es la que se pone en la bio de Instagram.
//
// El boton de copiar existe porque el uso real es mandar el link por WhatsApp,
// no abrirlo: quien atiende no va a hacer el tramite, se lo pasa a la persona.

import { useState } from 'react'
import { ExternalLink, Copy, Check } from 'lucide-react'
import { PASOS_ALTA } from '../../lib/altaSocios'

/**
 * Los pasos pueden apuntar afuera (argentina.gob.ar) o adentro (`/sumate`).
 *
 * Los de adentro se guardan relativos, porque el dominio de la instalacion no
 * se conoce en tiempo de compilacion. Pero el uso real de esta pantalla es
 * COPIAR el link y mandarlo por WhatsApp, y «/sumate» pegado en un chat no
 * lleva a ningun lado. Se resuelve contra el origen actual: los absolutos pasan
 * sin tocar, los relativos se completan.
 */
function urlAbsoluta(url: string): string {
  try {
    return new URL(url, window.location.origin).href
  } catch {
    return url
  }
}

export function PasosAlta({ compacto = false, omitir = [] }: {
  compacto?: boolean
  /**
   * Numeros de paso que NO se dibujan.
   *
   * Existe por `/sumate`: ahi el paso 1 es «completar el formulario» y el
   * formulario esta arriba, en la misma pantalla. Ofrecerle a alguien un boton
   * para ir a donde ya esta es ruido, y encima hace dudar de si lo que estaba
   * completando era lo correcto.
   *
   * Se omite en vez de marcarlo como hecho porque cuando esa lista se lee, la
   * persona TODAVIA no lo completo: decirle «listo» seria mentirle. Lo que
   * necesita ahi es lo que viene despues.
   *
   * En `O.N.G. > Pacientes` no se omite nada: quien atiende manda los tres.
   */
  omitir?: number[]
}) {
  const pasos = PASOS_ALTA.filter(p => !omitir.includes(p.n))
  const [copiado, setCopiado] = useState<number | null>(null)

  const copiar = async (n: number, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(n)
      setTimeout(() => setCopiado(c => (c === n ? null : c)), 1800)
    } catch {
      // Sin permiso de portapapeles no se rompe nada: el link sigue clickeable.
    }
  }

  return (
    <div className={compacto ? 'space-y-2' : 'space-y-3'}>
      {pasos.map(p => (
        <div key={p.n}
          className={`rounded-xl border bg-[#101016] ${compacto ? 'p-3' : 'p-4'} ${
            p.opcional ? 'border-[#1f1f2b]' : 'border-[#2a2a3a]'}`}>
          <div className="flex items-start gap-3">
            <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold border ${
              p.opcional
                ? 'border-[#2a2a3a] bg-[#15151d] text-[#8a8a9c]'
                : 'border-[#404d20] bg-[#a3e635]/10 text-[#d9f99d]'}`}>
              {p.n}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-medium text-[#ececf1]">{p.titulo}</span>
                {p.opcional && (
                  <span className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium border border-[#2a2a3a] rounded px-1.5 py-0.5">
                    opcional · pago
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-[#a6a6b5] leading-snug">{p.detalle}</p>

              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                <a href={urlAbsoluta(p.url)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[12px] font-medium text-[#d9f99d]">
                  <ExternalLink className="w-3.5 h-3.5" /> {p.accion}
                </a>
                <button onClick={() => copiar(p.n, urlAbsoluta(p.url))}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:bg-[#1c1c27] transition-colors text-[12px] text-[#a6a6b5]"
                  title="Copiar el link para mandarlo">
                  {copiado === p.n
                    ? <><Check className="w-3.5 h-3.5 text-[#a3e635]" /> Copiado</>
                    : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
