/**
 * ELEGIR UNA PERSONA ESCRIBIENDO, NO SCROLLEANDO.
 *
 * Era un `<select>` con el padrón entero: 151 renglones para encontrar a uno.
 * Socio lo dijo así: «tengo que scrollear hasta encontrar el nombre;
 * estaría bueno que ponga Juan cruz nomás y saque todos los Juan cruz».
 *
 * Tres decisiones que sostienen eso:
 *
 * 1. Se busca por CUALQUIER palabra, en cualquier orden. Los nombres están
 *    cargados con dos criterios distintos —«Juan Pablo Donnet» y «Aguirre
 *    Walter Ariel»— y quien busca no tiene por qué saber cuál le tocó.
 * 2. Se muestra APELLIDO primero, como en toda la app.
 * 3. El código PAC-xxx aparece SÓLO cuando hay dos personas con el mismo
 *    nombre. Ponerlo siempre llena la lista de ruido; no ponerlo nunca deja
 *    dos renglones idénticos y elegir pasa a ser adivinar.
 */
import { useMemo, useRef, useState, useEffect, lazy, Suspense } from 'react'
import { Search, X, Check, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import {
  filtrarPersonas, ordenarPorApellido, nombreParaMostrar, nombresRepetidos, normalizar,
  buscarPorCodigo, type PersonaBuscable,
} from '../../lib/buscarPersonas'
import { inputFormulario } from '../../lib/ui'

/**
 * El lector de QR, cargado sólo cuando se lo abre: trae zxing, que es pesado y
 * no tiene por qué estar en el bundle de todo el que abre un formulario.
 */
const EscanerQR = lazy(() => import('./portal/EscanerQR').then(m => ({ default: m.EscanerQR })))

export function SelectorPersona<T extends PersonaBuscable & { apellido?: string | null; nombres?: string | null }>({
  personas, valor, onElegir, placeholder = 'Buscar por apellido, nombre, código o DNI…',
  etiquetaExtra, autoFocus,
}: {
  personas: T[]
  valor: string | null | undefined
  onElegir: (id: string | null) => void
  placeholder?: string
  /** Un texto opcional por persona, p. ej. «sin vincular». */
  etiquetaExtra?: (p: T) => string | null
  autoFocus?: boolean
}) {
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  const ordenadas = useMemo(() => ordenarPorApellido(personas), [personas])
  const repetidos = useMemo(() => nombresRepetidos(personas), [personas])
  const filtradas = useMemo(() => filtrarPersonas(ordenadas, q), [ordenadas, q])
  const elegida = useMemo(() => personas.find(p => p.id === valor) ?? null, [personas, valor])

  // Cerrar al tocar afuera. Sin esto la lista queda abierta tapando el
  // formulario y hay que elegir a alguien para salir.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  // Ya hay alguien elegido: se muestra el nombre y un botón para cambiarlo. El
  // buscador reaparece recién si se toca «cambiar», así el formulario no se
  // reabre solo cada vez que se vuelve al campo.
  if (elegida && !abierto) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 rounded-lg border border-[#2a2a3a] bg-[#15151d] px-3 min-h-[44px] flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-[#a3e635]" strokeWidth={2} />
          <span className="text-[13px] text-[#ececf1] truncate">
            {nombreParaMostrar(elegida)}
            {repetidos.has(normalizar(elegida.nombre_completo ?? '')) && elegida.codigo && (
              <span className="text-[#8a8a9c]"> · {elegida.codigo}</span>
            )}
          </span>
        </div>
        <button type="button" onClick={() => { setQ(''); setAbierto(true) }}
          className="shrink-0 min-h-[44px] px-3 rounded-lg border border-[#2a2a3a] text-[12px] text-[#a6a6b5] hover:border-[#38bdf8]/40">
          Cambiar
        </button>
      </div>
    )
  }

  return (
    <div ref={caja} className="relative">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6e6e80] pointer-events-none" strokeWidth={1.8} />
        <input
          className={`${inputFormulario} pl-9 pr-[88px]`}
          value={q}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={e => { setQ(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)} />
        {/* ESCANEAR EL CARNET. Es lo que cierra el circulo del QR: el carnet
            lleva el codigo del socio y aca se lo lee. Sin esto, el QR del
            carnet seria un adorno — que es justo lo que no queriamos. */}
        <button type="button" onClick={() => setEscaneando(true)}
          aria-label="Escanear el carnet del socio"
          className="absolute right-11 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center text-[#8a8a9c] hover:text-[#a3e635]">
          <ScanLine className="w-4 h-4" strokeWidth={1.8} />
        </button>
        {q && (
          <button type="button" onClick={() => setQ('')}
            // «Limpiar» y no la otra palabra: esto no elimina ningún dato,
            // vacía el campo de búsqueda. El test `borrarSinEditar` rastrea esa
            // palabra en los aria-label para encontrar pantallas que eliminan
            // algo sin dejar corregirlo, y saltó con razón cuando la usé acá.
            aria-label="Limpiar la búsqueda"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center text-[#8a8a9c] hover:text-[#ececf1]">
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        )}
      </div>

      {escaneando && (
        <Suspense fallback={null}>
          <EscanerQR onCerrar={() => setEscaneando(false)}
            onLeido={texto => {
              setEscaneando(false)
              const cod = texto.trim()
              // La busqueda vive en `buscarPorCodigo`, con los tests que
              // recorren el viaje entero: carnet emitido → QR → ficha.
              const p = buscarPorCodigo(personas, cod)
              if (p) { onElegir(p.id); setQ(''); setAbierto(false); return }
              // No se encontro: el codigo queda en el buscador igual. Puede ser
              // de otra asociacion, o estar bien y ser la lista la que esta
              // filtrada — pasa lo mismo con el escaner de reservas.
              setQ(cod); setAbierto(true)
              toast.error(`No hay ningun socio con el codigo ${cod}`)
            }} />
        </Suspense>
      )}

      {abierto && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-[#2a2a3a] bg-[#15151d] shadow-xl">
          {filtradas.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-[#8a8a9c]">
              Nadie con «{q}». Puede estar cargado con el apellido primero, o con otra grafía.
            </p>
          ) : (
            <>
              {/* Cuántos hay, para saber si vale la pena seguir escribiendo. */}
              <p className="px-3 pt-2 pb-1 text-[10px] text-[#6e6e80]">
                {filtradas.length === personas.length
                  ? `${personas.length} personas`
                  : `${filtradas.length} de ${personas.length}`}
              </p>
              {filtradas.slice(0, 60).map(p => {
                const extra = etiquetaExtra?.(p)
                return (
                  <button type="button" key={p.id}
                    onClick={() => { onElegir(p.id); setAbierto(false); setQ('') }}
                    className="w-full text-left px-3 min-h-[44px] py-2 hover:bg-[#1f1f2b] border-t border-[#1f1f2b] first:border-t-0">
                    <span className="text-[13px] text-[#ececf1]">{nombreParaMostrar(p)}</span>
                    {repetidos.has(normalizar(p.nombre_completo ?? '')) && p.codigo && (
                      <span className="text-[11px] text-[#facc15]"> · {p.codigo}</span>
                    )}
                    {extra && <span className="text-[11px] text-[#8a8a9c]"> — {extra}</span>}
                  </button>
                )
              })}
              {filtradas.length > 60 && (
                <p className="px-3 py-2 text-[11px] text-[#8a8a9c] border-t border-[#1f1f2b]">
                  y {filtradas.length - 60} más. Escribí un poco más para achicar la lista.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
