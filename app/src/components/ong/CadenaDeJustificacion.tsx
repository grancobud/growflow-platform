// La cadena entera en una pantalla, para poder mostrar que cierra.
//
// Coherencia dice cosas sueltas —teléfonos repetidos, recibos sin emitir—. Esto
// dice si el CONJUNTO cierra, que es lo único que a un control le va a importar:
// no va a pedir los números por separado, va a pedir que el de la punta
// justifique al del final.
//
// Va ARRIBA de los chequeos sueltos porque es el marco que los ordena.

import { ArrowDown, Check, X, HelpCircle } from 'lucide-react'
import { cadenaDeJustificacion, laCadenaCierra, type DatosCadena, type Eslabon }
  from '../../lib/cadenaDeJustificacion'

const COLOR = {
  cierra: '#bef264',
  no_cierra: '#ff8a7a',
  sin_datos: '#8a8a9c',
} as const

const ICONO = {
  cierra: Check,
  no_cierra: X,
  sin_datos: HelpCircle,
} as const

function valorDe(e: Eslabon) {
  if (e.unidad === '$') return '$' + Math.round(e.valor).toLocaleString('es-AR')
  if (e.unidad === 'g') return Math.round(e.valor).toLocaleString('es-AR') + ' g'
  return e.valor.toLocaleString('es-AR') + ' ' + e.unidad
}

export function CadenaDeJustificacion({ datos }: { datos: DatosCadena }) {
  const eslabones = cadenaDeJustificacion(datos)
  const cierra = laCadenaCierra(eslabones)
  const rotos = eslabones.filter(e => e.estado === 'no_cierra')
  const sinDatos = eslabones.filter(e => e.estado === 'sin_datos')

  return (
    <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 sm:p-4">
      <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
        La cadena que justifica el cultivo
      </h3>
      <p className="text-[11px] text-[#8a8a9c] mt-1 leading-relaxed">
        La asociación no vende: cultiva <b className="text-[#a6a6b5]">por cuenta de sus socios</b>, y
        cada socio le reembolsa la parte que le toca del costo. Cada eslabón de acá abajo tiene que
        justificar al siguiente. Si uno sube, los demás tienen que subir con él.
      </p>

      <div className={`mt-3 rounded-lg px-3 py-2 text-[12px] font-medium`}
        style={{
          background: cierra ? 'rgba(163,230,53,0.10)' : 'rgba(255,138,122,0.10)',
          color: cierra ? '#d9f99d' : '#ff8a7a',
        }}>
        {cierra
          ? 'La cadena cierra: cada eslabón está justificado por el anterior.'
          : rotos.length > 0
            ? `La cadena se corta en ${rotos.length === 1 ? 'un eslabón' : `${rotos.length} eslabones`}.`
            : 'Todavía no se puede afirmar que cierre: faltan datos.'}
        {sinDatos.length > 0 && rotos.length > 0 && (
          <span className="block text-[11px] font-normal mt-0.5 text-[#8a8a9c]">
            Y hay {sinDatos.length} que no se {sinDatos.length === 1 ? 'puede' : 'pueden'} juzgar
            por falta de datos. Lo que no se sabe no cuenta como que cierra.
          </span>
        )}
      </div>

      <ol className="mt-3 list-none m-0 p-0">
        {eslabones.map((e, i) => {
          const Icono = ICONO[e.estado]
          const color = COLOR[e.estado]
          return (
            <li key={e.clave}>
              <div className="flex items-start gap-2.5 rounded-lg bg-[#15151d] border px-3 py-2.5"
                style={{ borderColor: e.estado === 'no_cierra' ? 'rgba(255,138,122,0.30)' : '#1f1f2b' }}>
                <span aria-hidden
                  className="mt-[2px] w-5 h-5 shrink-0 rounded-full flex items-center justify-center"
                  style={{ background: `${color}22`, color }}>
                  <Icono className="w-3 h-3" strokeWidth={2.6} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="text-[12px] text-[#ececf1]">{e.titulo}</span>
                    <span className="text-[13px] font-mono tabular-nums font-bold" style={{ color }}>
                      {valorDe(e)}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: e.estado === 'cierra' ? '#8a8a9c' : color }}>
                    {e.nota}
                  </p>
                  {/* Qué hacer, no sólo qué está mal: un observable sin salida
                      es una acusación. */}
                  {e.comoSeArregla && (
                    <p className="text-[10px] text-[#a6a6b5] mt-1 leading-relaxed">
                      {e.comoSeArregla}
                    </p>
                  )}
                </div>
              </div>
              {i < eslabones.length - 1 && (
                <div className="flex justify-center py-0.5" aria-hidden>
                  <ArrowDown className="w-3.5 h-3.5 text-[#2a2a3a]" />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
