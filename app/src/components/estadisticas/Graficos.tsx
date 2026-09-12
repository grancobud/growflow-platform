// Los gráficos de la pantalla de estadísticas, dibujados a mano en SVG.
//
// POR QUÉ A MANO Y NO CON UNA LIBRERÍA
// El resto de la app ya dibuja así, y una librería de gráficos pesa más que
// todo lo que hay acá junto. Además, en SVG plano el gráfico entra en el mismo
// flujo responsive que el resto: `viewBox` + ancho 100% y listo.
//
// CRITERIOS QUE VALEN PARA TODOS
//
// · El color se gasta en distinguir COSAS DISTINTAS (lo que entra de lo que
//   sale), nunca en repetir lo que ya dice el largo de la barra. Una escala de
//   diez colores para diez productos es ruido: el orden ya los ordena.
// · Nada de doble eje. Dos medidas con escalas distintas van en dos gráficos:
//   superpuestas, la relación entre las curvas la elige quien fija la escala.
// · El eje siempre arranca en cero. Recortarlo agranda diferencias que no son.
// · Cada dato lleva su `<title>`: es el tooltip nativo del navegador, funciona
//   con el dedo y no necesita estado ni JavaScript.

import type { ReactNode } from 'react'
import { tarjeta } from '../../lib/ui'
import { VERDE, CORAL, LILA, AMBAR, GRIS, REJILLA, fmtPesos, fmtCorto, fmtNum, fmtPct } from '../../lib/formatoGrafico'

// Los colores y los formatos viven en su propio archivo: exportarlos desde acá
// rompería el recargado en caliente (un archivo con componentes Y constantes
// remonta todo al tocar cualquiera de las dos cosas).

export function Panel({ titulo, ayuda, extra, children, className = '' }: {
  titulo: string; ayuda?: string; extra?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`${tarjeta} p-3 sm:p-4 ${className}`}>
      <div className="flex items-start gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-[13px] text-[#ececf1]">{titulo}</h3>
          {/* La ayuda dice cómo LEER el gráfico, no repite el título. */}
          {ayuda && <p className="text-[11px] text-[#8a8a9c] leading-relaxed mt-0.5">{ayuda}</p>}
        </div>
        {extra && <div className="ml-auto flex-shrink-0">{extra}</div>}
      </div>
      {children}
    </section>
  )
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <div className="h-[120px] flex items-center justify-center text-center px-4">
      <p className="text-[11px] text-[#8a8a9c] leading-relaxed">{children}</p>
    </div>
  )
}

/** El cartelito de arriba: un número grande con su comparación. */
export function Kpi({ etiqueta, valor, pie, color = '#ececf1', icono }: {
  etiqueta: string; valor: string; pie?: ReactNode; color?: string; icono?: ReactNode
}) {
  return (
    <div className={`${tarjeta} p-3`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">
        {icono}<span className="truncate">{etiqueta}</span>
      </div>
      <div className="font-display font-bold text-[19px] sm:text-[23px] leading-none mt-1.5 tabular-nums"
        style={{ color }}>{valor}</div>
      {pie && <div className="text-[11px] text-[#8a8a9c] mt-1 tabular-nums">{pie}</div>}
    </div>
  )
}

/** La flechita de variación. Verde no es «bueno»: es «subió». */
export function Variacion({ v, invertido = false }: { v: number | null; invertido?: boolean }) {
  if (v == null) return <span className="text-[#8a8a9c]">sin base para comparar</span>
  const sube = v > 0
  const bueno = invertido ? !sube : sube
  return (
    <span style={{ color: Math.abs(v) < 0.005 ? GRIS : bueno ? VERDE : CORAL }}>
      {sube ? '▲' : v < 0 ? '▼' : '='} {fmtPct(Math.abs(v))}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export interface ParMes { clave: string; etiqueta: string; a: number; b: number }

/**
 * Dos series por mes, una al lado de la otra.
 *
 * Apiladas se leería mal: lo que interesa de ingresos y egresos es cuál es más
 * alto en cada mes, y en una pila la de arriba arranca a una altura distinta
 * cada vez, así que comparar de un vistazo se vuelve imposible.
 */
export function BarrasPares({ datos, rotuloA, rotuloB, colorA = VERDE, colorB = CORAL, formato = fmtCorto, alto = 200 }: {
  datos: ParMes[]; rotuloA: string; rotuloB: string
  colorA?: string; colorB?: string; formato?: (n: number) => string; alto?: number
}) {
  if (!datos.length) return <Vacio>Todavía no hay movimientos cargados.</Vacio>

  const max = Math.max(...datos.flatMap(d => [d.a, d.b]), 1)
  const W = 100, H = 100
  const paso = W / datos.length
  const ancho = Math.min(paso * 0.34, 5)

  return (
    <div>
      <div className="flex items-center gap-3 mb-2 text-[10px] text-[#8a8a9c]">
        <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: colorA }} />{rotuloA}</span>
        <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: colorB }} />{rotuloB}</span>
        <span className="ml-auto tabular-nums">máx {formato(max)}</span>
      </div>
      <div className="relative" style={{ height: alto }}>
        {/* Tres líneas de referencia: sin ellas, la altura de una barra sólo se
            puede comparar con la de al lado, no leer como cantidad. */}
        {[0, 0.5, 1].map(p => (
          <div key={p} className="absolute inset-x-0 border-t border-dashed" style={{ borderColor: REJILLA, top: `${(1 - p) * 100}%` }} />
        ))}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          {datos.map((d, i) => {
            const x = i * paso + paso / 2
            const ha = (d.a / max) * H, hb = (d.b / max) * H
            return (
              <g key={d.clave}>
                <rect x={x - ancho - 0.4} y={H - ha} width={ancho} height={ha} fill={colorA} rx="0.6">
                  <title>{`${d.etiqueta} · ${rotuloA}: ${formato(d.a)}`}</title>
                </rect>
                <rect x={x + 0.4} y={H - hb} width={ancho} height={hb} fill={colorB} rx="0.6">
                  <title>{`${d.etiqueta} · ${rotuloB}: ${formato(d.b)}`}</title>
                </rect>
              </g>
            )
          })}
        </svg>
      </div>
      <EjeMeses datos={datos} />
    </div>
  )
}

/** Una sola serie por mes. */
export function BarrasSimples({ datos, color = VERDE, formato = fmtNum, alto = 160, rotulo }: {
  datos: { clave: string; etiqueta: string; v: number }[]
  color?: string; formato?: (n: number) => string; alto?: number; rotulo?: string
}) {
  if (!datos.length) return <Vacio>Todavía no hay nada cargado.</Vacio>
  const max = Math.max(...datos.map(d => d.v), 1)
  const paso = 100 / datos.length
  const ancho = Math.min(paso * 0.6, 7)

  return (
    <div>
      {rotulo && (
        <div className="flex items-center gap-2 mb-2 text-[10px] text-[#8a8a9c]">
          <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color }} />{rotulo}</span>
          <span className="ml-auto tabular-nums">máx {formato(max)}</span>
        </div>
      )}
      <div className="relative" style={{ height: alto }}>
        {[0, 0.5, 1].map(p => (
          <div key={p} className="absolute inset-x-0 border-t border-dashed" style={{ borderColor: REJILLA, top: `${(1 - p) * 100}%` }} />
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          {datos.map((d, i) => {
            const h = (d.v / max) * 100
            return (
              <rect key={d.clave} x={i * paso + (paso - ancho) / 2} y={100 - h} width={ancho} height={h} fill={color} rx="0.6">
                <title>{`${d.etiqueta}: ${formato(d.v)}`}</title>
              </rect>
            )
          })}
        </svg>
      </div>
      <EjeMeses datos={datos} />
    </div>
  )
}

/**
 * Los meses de abajo. Con muchos, se saltean para que no se pisen.
 *
 * A 9px no se leian. Lo que hacia falta no era achicar mas la letra sino
 * mostrar MENOS meses: se sube a 10.5px y se saltea antes —de a dos desde los
 * siete meses en vez de los diez— asi el eje dice menos fechas pero legibles,
 * que es para lo que esta.
 */
function EjeMeses({ datos }: { datos: { clave: string; etiqueta: string }[] }) {
  const cada = datos.length > 14 ? 3 : datos.length > 7 ? 2 : 1
  return (
    <div className="flex mt-1.5">
      {datos.map((d, i) => (
        <div key={d.clave} className="flex-1 text-center text-[10px] text-[#8a8a9c] truncate">
          {i % cada === 0 ? d.etiqueta : ''}
        </div>
      ))}
    </div>
  )
}

/**
 * Una curva con el área pintada, para lo que se acumula.
 *
 * Admite valores negativos: el saldo de una asociación puede quedar en rojo, y
 * un gráfico que apoya todo sobre el piso lo escondería.
 */
export function AreaAcumulada({ datos, color = LILA, formato = fmtCorto, alto = 160 }: {
  datos: { clave: string; etiqueta: string; v: number }[]
  color?: string; formato?: (n: number) => string; alto?: number
}) {
  if (datos.length < 2) return <Vacio>Hace falta más de un mes para ver una evolución.</Vacio>

  const vs = datos.map(d => d.v)
  const max = Math.max(...vs, 0), min = Math.min(...vs, 0)
  const rango = max - min || 1
  const W = 100, H = 100
  const x = (i: number) => (i / (datos.length - 1)) * W
  const y = (v: number) => H - ((v - min) / rango) * H
  const linea = datos.map((d, i) => `${x(i)},${y(d.v)}`).join(' ')
  const cero = y(0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-[10px] text-[#8a8a9c] tabular-nums">
        <span>mín {formato(min)}</span><span>máx {formato(max)}</span>
      </div>
      <div className="relative" style={{ height: alto }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
          <defs>
            <linearGradient id="areaAcum" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <polygon points={`0,${cero} ${linea} ${W},${cero}`} fill="url(#areaAcum)" />
          {/* El cero se marca aparte: es la línea que separa tener de deber. */}
          <line x1="0" y1={cero} x2={W} y2={cero} stroke={REJILLA} strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          <polyline points={linea} fill="none" stroke={color} strokeWidth="2"
            vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          {datos.map((d, i) => (
            <circle key={d.clave} cx={x(i)} cy={y(d.v)} r="2.5" fill="#0d0d12" stroke={color} strokeWidth="1.5"
              vectorEffect="non-scaling-stroke">
              <title>{`${d.etiqueta}: ${formato(d.v)}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <EjeMeses datos={datos} />
    </div>
  )
}

/** Barras horizontales: para nombres largos, que en vertical no entran. */
export function BarrasHorizontales({ datos, color = VERDE, formato = fmtPesos, tope = 8 }: {
  datos: { etiqueta: string; valor: number; nota?: string }[]
  color?: string; formato?: (n: number) => string; tope?: number
}) {
  if (!datos.length) return <Vacio>Nada para mostrar todavía.</Vacio>
  const lista = datos.slice(0, tope)
  const max = Math.max(...lista.map(d => d.valor), 1)

  return (
    <div className="space-y-2">
      {lista.map(d => (
        <div key={d.etiqueta}>
          <div className="flex items-baseline gap-2 text-[11px]">
            <span className="text-[#d4d4dd] truncate min-w-0">{d.etiqueta}</span>
            {d.nota && <span className="text-[10px] text-[#8a8a9c] flex-shrink-0">{d.nota}</span>}
            <span className="ml-auto text-[#ececf1] tabular-nums flex-shrink-0">{formato(d.valor)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#15151d] mt-1 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(d.valor / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * El reparto de un total en pedazos.
 *
 * Una dona y no una torta: el agujero del medio deja lugar al total, que es el
 * número que se busca primero. Y a partir del quinto pedazo todo va a «otros»,
 * porque una dona de quince gajos no se lee.
 */
export function Dona({ datos, total, unidad = '', colores = [VERDE, LILA, AMBAR, CORAL, '#4a4a58'] }: {
  datos: { etiqueta: string; n: number; parte: number }[]
  total: number; unidad?: string; colores?: string[]
}) {
  if (!datos.length) return <Vacio>Nada para repartir todavía.</Vacio>

  const visibles = datos.slice(0, 4)
  const resto = datos.slice(4).reduce((s, d) => s + d.n, 0)
  const gajos = resto > 0
    ? [...visibles, { etiqueta: 'Otros', n: resto, parte: resto / Math.max(total, 1) }]
    : visibles

  const R = 15.9155           // circunferencia = 100, así el dasharray son %

  // Dónde arranca cada gajo, calculado ANTES de dibujar. Ir acumulando adentro
  // del map muta una variable mientras React renderiza, que es de las cosas que
  // funcionan hasta que el render se repite.
  const arranques = gajos.map((_, i) =>
    gajos.slice(0, i).reduce((s, g) => s + g.parte * 100, 0))

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 42 42" className="w-[104px] h-[104px] flex-shrink-0 -rotate-90">
        <circle cx="21" cy="21" r={R} fill="none" stroke="#15151d" strokeWidth="5" />
        {gajos.map((g, i) => {
          const largo = g.parte * 100
          return (
            <circle key={g.etiqueta} cx="21" cy="21" r={R} fill="none"
              stroke={colores[i % colores.length]} strokeWidth="5"
              strokeDasharray={`${largo} ${100 - largo}`} strokeDashoffset={-arranques[i]}>
              <title>{`${g.etiqueta}: ${fmtNum(g.n)} ${unidad} (${fmtPct(g.parte)})`}</title>
            </circle>
          )
        })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {gajos.map((g, i) => (
          <li key={g.etiqueta} className="flex items-baseline gap-1.5 text-[11px]">
            <i className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: colores[i % colores.length] }} />
            <span className="text-[#d4d4dd] truncate">{g.etiqueta}</span>
            <span className="ml-auto text-[#8a8a9c] tabular-nums flex-shrink-0">{fmtPct(g.parte)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * La curva de concentración: qué parte del total explican las primeras N.
 *
 * La diagonal es el reparto perfectamente parejo. Cuanto más se despega la
 * curva de esa diagonal, de menos gente depende la asociación.
 */
export function CurvaConcentracion({ curva, alto = 150 }: {
  curva: { i: number; parteAcum: number }[]; alto?: number
}) {
  if (curva.length < 3) return <Vacio>Hacen falta más personas con aporte para medir la concentración.</Vacio>
  const n = curva.length
  const pts = curva.map(p => `${(p.i / n) * 100},${100 - p.parteAcum * 100}`).join(' ')

  return (
    <div className="relative" style={{ height: alto }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="conc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={AMBAR} stopOpacity="0.28" />
            <stop offset="100%" stopColor={AMBAR} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={`0,100 ${pts} 100,100`} fill="url(#conc)" />
        <line x1="0" y1="100" x2="100" y2="0" stroke={REJILLA} strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <polyline points={pts} fill="none" stroke={AMBAR} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/** Barritas simples, para los días de la semana. */
export function Barritas({ datos, color = LILA, alto = 90 }: {
  datos: { dia: string; n: number }[]; color?: string; alto?: number
}) {
  const max = Math.max(...datos.map(d => d.n), 1)
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: alto }}>
        {datos.map(d => (
          <div key={d.dia} className="flex-1 flex flex-col justify-end" title={`${d.dia}: ${fmtNum(d.n)}`}>
            <div className="rounded-t-sm" style={{ height: `${(d.n / max) * 100}%`, background: color, minHeight: d.n > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {datos.map(d => (
          <div key={d.dia} className="flex-1 text-center">
            <div className="text-[10px] text-[#8a8a9c]">{d.dia}</div>
            <div className="text-[10px] text-[#a6a6b5] tabular-nums">{d.n}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Una sola barra partida en pedazos, para cuando el total es lo de menos. */
export function BarraPartida({ partes, colores = [VERDE, LILA, AMBAR, CORAL, '#4a4a58'] }: {
  partes: { etiqueta: string; n: number; parte: number }[]; colores?: string[]
}) {
  if (!partes.length) return null
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-[#15151d]">
        {partes.map((p, i) => (
          <div key={p.etiqueta} style={{ width: `${p.parte * 100}%`, background: colores[i % colores.length] }}
            title={`${p.etiqueta}: ${fmtNum(p.n)} (${fmtPct(p.parte)})`} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {partes.map((p, i) => (
          <li key={p.etiqueta} className="flex items-center gap-1.5 text-[11px] text-[#a6a6b5]">
            <i className="w-2 h-2 rounded-sm" style={{ background: colores[i % colores.length] }} />
            {p.etiqueta}<span className="text-[#8a8a9c] tabular-nums">{fmtPct(p.parte)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
