// Grafico de una metrica del ambiente en el tiempo, en SVG a mano.
//
// Sin libreria de graficos: el proyecto no tiene ninguna y sumar uno de estos
// paquetes por una pantalla son cientos de kB en el bundle de una app que se
// abre desde el celular adentro de una sala.
//
// Lo que hace distinto a este grafico de una linea cualquiera es la BANDA del
// rango ideal pintada de fondo. Con la banda no hace falta leer ningun numero
// para responder la unica pregunta que importa: cuando me fui de rango. Los
// puntos fuera quedan marcados con un circulo lleno.

import { useMemo } from 'react'
import type { Rango } from '../../lib/ambiente'
import { estadoDe } from '../../lib/ambiente'

export interface Punto { t: string; v: number }

const W = 320
const H = 120
const PAD_X = 6
const PAD_Y = 10

export function GraficoLinea({ puntos, rango, color, unidad, etiqueta }: {
  puntos: Punto[]
  rango: Rango
  color: string
  unidad: string
  etiqueta: string
}) {
  const g = useMemo(() => {
    if (puntos.length === 0) return null

    // La escala incluye SIEMPRE la banda del rango: si el eje se ajustara solo
    // a los datos, un cultivo perfecto mostraria la banda ocupando toda la
    // pantalla y uno pesimo no la mostraria, que es al reves de lo util.
    const vals = puntos.map(p => p.v)
    const lo = Math.min(...vals, rango.min)
    const hi = Math.max(...vals, rango.max)
    const span = hi - lo || 1
    const margen = span * 0.12

    const min = lo - margen
    const max = hi + margen
    const y = (v: number) => PAD_Y + (H - PAD_Y * 2) * (1 - (v - min) / (max - min))
    const x = (i: number) => puntos.length === 1
      ? W / 2
      : PAD_X + (W - PAD_X * 2) * (i / (puntos.length - 1))

    return {
      min, max, y, x,
      linea: puntos.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' '),
      bandaY: y(rango.max),
      bandaAlto: Math.max(1, y(rango.min) - y(rango.max)),
      marcas: puntos.map((p, i) => ({
        cx: x(i), cy: y(p.v), fuera: estadoDe(p.v, rango) !== 'ok', t: p.t, v: p.v,
      })),
    }
  }, [puntos, rango])

  if (!g) {
    return (
      <div className="h-[120px] flex items-center justify-center text-[11px] text-[#8a8a9c]">
        Sin lecturas en este período.
      </div>
    )
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}
        preserveAspectRatio="none" role="img"
        aria-label={`${etiqueta}: ${puntos.length} lecturas, rango ideal ${rango.min} a ${rango.max}${unidad}`}>
        {/* Banda del rango ideal */}
        <rect x="0" y={g.bandaY} width={W} height={g.bandaAlto}
          fill="#a3e635" opacity="0.10" />
        <line x1="0" x2={W} y1={g.bandaY} y2={g.bandaY}
          stroke="#a3e635" strokeWidth="0.5" opacity="0.35" strokeDasharray="3 3" />
        <line x1="0" x2={W} y1={g.bandaY + g.bandaAlto} y2={g.bandaY + g.bandaAlto}
          stroke="#a3e635" strokeWidth="0.5" opacity="0.35" strokeDasharray="3 3" />

        <polyline points={g.linea} fill="none" stroke={color}
          strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />

        {g.marcas.map((m, i) => (
          <circle key={i} cx={m.cx} cy={m.cy} r={m.fuera ? 2.6 : 1.6}
            fill={m.fuera ? '#f87171' : color}
            opacity={m.fuera ? 1 : 0.7}>
            <title>{`${fmt(m.t)} · ${m.v}${unidad}`}</title>
          </circle>
        ))}
      </svg>

      <div className="flex justify-between text-[10px] text-[#8a8a9c] mt-1 px-0.5">
        <span>{fmt(puntos[0].t)}</span>
        <span className="text-[#a3e635]/70">
          ideal {rango.min}–{rango.max}{unidad}
        </span>
        <span>{fmt(puntos[puntos.length - 1].t)}</span>
      </div>
    </div>
  )
}
