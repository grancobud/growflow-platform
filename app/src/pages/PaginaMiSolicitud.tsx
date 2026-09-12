// PaginaMiSolicitud — «¿cómo va lo mío?», con el link propio.
//
// Es la mitad que faltaba del alta. Antes /sumate mostraba tres links y se
// terminaba ahí: quien los completaba no sabía si su formulario había llegado,
// si lo habían dado de alta, o si le tocaba hacer algo. Entraba al día
// siguiente y veía lo mismo.
//
// Va FUERA de RutaRaiz, como /sumate: la abre alguien que todavía no es socio y
// por lo tanto no tiene usuario. Adentro caería en el login.
//
// No lee la tabla: llama a `solicitud_estado`, que es una función de la base
// que devuelve UNA solicitud a quien tenga su token, sin el DNI. Con el token
// no se llega a ningún otro dato del sistema.

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2, Check, Copy, Clock, KeyRound, AlertTriangle, X } from 'lucide-react'
import { Marca } from '../components/Marca'
import {
  solicitudesService, queSigue, etiquetaEstado, colorEstado, type EstadoPublico,
} from '../lib/solicitudes'
import { AdjuntarDocumento } from '../components/ong/AdjuntarDocumento'

export default function PaginaMiSolicitud() {
  const { token = '' } = useParams()
  const [estado, setEstado] = useState<EstadoPublico | null>(null)
  const [cargando, setCargando] = useState(true)
  const [copiado, setCopiado] = useState(false)
  // Sube al subir el adjunto: vuelve a pedir el estado sin recargar la página.
  const [refresco, setRefresco] = useState(0)

  useEffect(() => {
    let vivo = true
    solicitudesService.estado(token)
      .then(e => { if (vivo) setEstado(e) })
      .catch(() => { if (vivo) setEstado(null) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [token, refresco])

  const copiarCodigo = async () => {
    if (!estado?.codigo_vinculacion) return
    try {
      await navigator.clipboard.writeText(estado.codigo_vinculacion)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* el código sigue a la vista */ }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#d4d4dd] font-sans">
      <div className="max-w-xl mx-auto px-4 py-10 sm:py-14">
        <header className="text-center">
          <Marca tamano="lg" centrado />
        </header>

        {cargando ? (
          <p className="mt-10 flex items-center justify-center gap-2 text-[13px] text-[#8a8a9c]">
            <Loader2 className="w-4 h-4 animate-spin" /> Buscando tu solicitud…
          </p>
        ) : !estado ? (
          // Un token que no abre nada no dice si existió o no: dice nada. Si
          // dijera «esa solicitud no existe» sería una forma de ir probando.
          <section className="mt-8 rounded-xl border border-[#1f1f2b] bg-[#101016] p-4 text-center">
            <X aria-hidden className="w-7 h-7 text-[#2a2a3a] mx-auto" strokeWidth={1.5} />
            <h1 className="mt-2 font-display font-semibold text-[15px] text-[#ececf1]">
              Este link no muestra nada
            </h1>
            <p className="mt-1.5 text-[12px] text-[#8a8a9c] leading-relaxed">
              Puede estar incompleto: fijate de copiarlo entero, sin cortar. Si lo perdiste,
              escribile a la asociación — por privacidad no podemos buscar tu solicitud con
              tu documento.
            </p>
            <Link to="/sumate" className="mt-3 inline-block text-[12px] text-[#d9f99d] hover:underline">
              Volver a empezar
            </Link>
          </section>
        ) : (
          <Estado e={estado} copiado={copiado} onCopiar={copiarCodigo}
            token={token} onAdjunto={() => setRefresco(n => n + 1)} />
        )}

        <footer className="mt-8 text-center text-[10px] text-[#8a8a9c]">
          la asociación · Cannabis y Derechos
        </footer>
      </div>
    </div>
  )
}

function Estado({ e, copiado, onCopiar, token, onAdjunto }: {
  e: EstadoPublico; copiado: boolean; onCopiar: () => void
  token: string; onAdjunto: () => void
}) {
  const sigue = queSigue(e)
  const color = colorEstado(e.estado)

  return (
    <>
      <section className="mt-8 rounded-xl border border-[#1f1f2b] bg-[#101016] p-4">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="font-display font-bold text-[17px] text-[#ececf1]">{e.nombre}</h1>
          <span className="ml-auto text-[11px] font-medium px-2 py-1 rounded-lg border"
            style={{ color, borderColor: `${color}55`, background: `${color}14` }}>
            {etiquetaEstado(e.estado)}
          </span>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-1">
          Nos dejaste tus datos el {new Date(e.creada_en).toLocaleDateString('es-AR')}
          {e.entidad ? ` · ${e.entidad}` : ''}
        </p>
      </section>

      {/* Lo único que importa: qué le toca hacer AHORA. Un estado suelto
          —«pendiente»— no dice si hay que esperar o hacer algo, y esa
          diferencia es todo el problema que veníamos a resolver. */}
      <section className="mt-3 rounded-xl border p-4"
        style={{
          borderColor: sigue.tuTurno ? '#404d20' : '#1f1f2b',
          background: sigue.tuTurno ? 'rgba(163,230,53,0.05)' : '#101016',
        }}>
        <div className="flex items-center gap-2">
          {sigue.tuTurno
            ? <Clock aria-hidden className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} />
            : e.estado === 'aceptada'
              ? <Check aria-hidden className="w-4 h-4 text-[#bef264]" strokeWidth={1.8} />
              : <AlertTriangle aria-hidden className="w-4 h-4 text-[#ff8a7a]" strokeWidth={1.8} />}
          <h2 className="font-display font-semibold text-[14px] text-[#ececf1]">{sigue.titulo}</h2>
        </div>
        <p className="text-[12px] text-[#d4d4dd] mt-2 leading-relaxed">{sigue.detalle}</p>

        {sigue.tuTurno && e.codigo_vinculacion && (
          <div className="mt-3 rounded-lg border border-[#2a2a3a] bg-[#0d0d12] p-3">
            <div className="flex items-center gap-1.5">
              <KeyRound aria-hidden className="w-3.5 h-3.5 text-[#a3e635]" strokeWidth={1.8} />
              <span className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">
                Código de vinculación
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <code className="text-[16px] font-mono font-bold text-[#d9f99d] tracking-wide">
                {e.codigo_vinculacion}
              </code>
              <button onClick={onCopiar}
                className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-[#a6a6b5] hover:text-[#ececf1] rounded-lg border border-[#2a2a3a] bg-[#15151d] px-2.5 py-2 min-h-[44px] transition-colors"
                aria-label="Copiar el código de vinculación">
                {copiado
                  ? <><Check className="w-3.5 h-3.5 text-[#bef264]" /> Copiado</>
                  : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
              </button>
            </div>
          </div>
        )}
      </section>

      {sigue.tuTurno && (
        <div className="mt-3 space-y-2">
          <AdjuntarDocumento token={token} tipo="reprocann"
            yaCargado={e.reprocann_cargado} nroCargado={e.reprocann_nro}
            onListo={onAdjunto} />
        </div>
      )}

      <p className="mt-4 text-center text-[11px] text-[#8a8a9c] leading-relaxed">
        Esta página se actualiza sola: volvé a entrar por el mismo link cuando quieras.
      </p>
    </>
  )
}
