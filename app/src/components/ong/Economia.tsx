// Cómo viene la plata, mes a mes, desde el primer movimiento.
//
// Lo que faltaba: la app podía responder "cuánto entró en agosto" —el filtro de
// Movimientos— y "cuánto se debe" —Proveedores— pero no "cómo venimos". Con 13
// meses cargados esa pregunta tiene una respuesta incómoda que ningún total
// histórico muestra: sobre $62,9M movidos el neto acumulado es de $XXX.XXX, un
// 0,9%, y varios meses cierran en NEGATIVO.
//
// SIN LIBRERIA DE GRAFICOS, igual que `GraficoLinea` del módulo de ambiente. La
// casa no tiene ninguna y sumar una son cientos de kB en el bundle de una app
// que se abre desde el celular. Son barras y una línea: SVG a mano alcanza.

import { useMemo } from 'react'
import { tarjeta } from '../../lib/ui'
import { TrendingUp, Landmark, Repeat, Wallet, Scale } from 'lucide-react'
import {
  serieMensual, gastosRecurrentes, movimientosPorCategoria, contrasteCostos,
  type AsientoCaja, type DocumentoONG, type SaldoProveedor,
} from '../../lib/ong'
import { Kpi } from './Kpi'

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
/** Para los ejes: $XX.XXX.XXX no entra en una etiqueta de gráfico. */
const corto = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (a >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(Math.round(n))
}
const MES_CORTO = ['', 'E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const etiquetaMes = (mes: string) => MES_CORTO[Number(mes.slice(5))] ?? '?'

export function Economia({ caja, documentos, saldos, fijosCargadosMes }: {
  caja: AsientoCaja[]
  documentos: DocumentoONG[]
  saldos: SaldoProveedor[]
  /** Lo que Econometría supone que se gasta por mes. Null si no cargó. */
  fijosCargadosMes?: number | null
}) {
  const serie = useMemo(() => serieMensual(caja), [caja])
  const fijos = useMemo(() => gastosRecurrentes(documentos), [documentos])
  const porCat = useMemo(() => movimientosPorCategoria(caja), [caja])

  const t = useMemo(() => {
    const entro = serie.reduce((s, m) => s + m.entro, 0)
    const salio = serie.reduce((s, m) => s + m.salio, 0)
    const enRojo = serie.filter(m => m.neto < 0).length
    return { entro, salio, neto: entro - salio, enRojo, meses: serie.length }
  }, [serie])

  const deuda = useMemo(
    () => saldos.reduce((s, x) => s + (Number(x.saldo) || 0), 0), [saldos])

  // El piso mensual: lo que hay que juntar todos los meses antes de nada.
  const piso = useMemo(
    () => fijos.reduce((s, x) => s + x.promedioMensual, 0), [fijos])

  // Lo que Econometría supone contra lo que los comprobantes dicen.
  const contraste = useMemo(
    () => fijosCargadosMes != null && fijosCargadosMes > 0
      ? contrasteCostos(fijosCargadosMes, documentos) : null,
    [fijosCargadosMes, documentos])

  if (serie.length === 0) {
    return (
      <div className={`${tarjeta} text-center py-8`}>
        <Wallet className="w-7 h-7 text-[#2a2a3a] mx-auto" strokeWidth={1.5} />
        <p className="text-[12px] text-[#8a8a9c] mt-2">
          Todavía no hay movimientos de caja cargados.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className={tarjeta}>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
            Cómo viene la plata
          </h3>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mb-3">
          {t.meses} meses, desde {serie[0].mes} hasta {serie[serie.length - 1].mes}.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 auto-rows-fr">
          <Kpi t="Entró" v={pesos(t.entro)} c="#a3e635" />
          <Kpi t="Salió" v={pesos(t.salio)} c="#ff8a7a" />
          <Kpi t="Resultado" v={`${t.neto >= 0 ? '+' : '−'}${pesos(Math.abs(t.neto))}`}
            c={t.neto >= 0 ? '#a3e635' : '#ff8a7a'} />
          <Kpi t="Deuda" v={pesos(deuda)} c={deuda > 0 ? '#fbbf24' : '#38bdf8'} />
        </div>
        {/* El margen sobre lo movido dice más que el resultado solo: $XXX.XXX
            suena a mucho hasta que se ve que es el 0,9% de lo que pasó. */}
        {t.entro > 0 && (
          <p className="text-[10px] text-[#8a8a9c] mt-2">
            El resultado es el {((t.neto / t.entro) * 100).toFixed(1)}% de lo que entró
            {t.enRojo > 0 && `, y ${t.enRojo} de los ${t.meses} meses cerraron en negativo`}.
            {deuda > t.neto && t.neto > 0 && ' La deuda con proveedores es mayor que todo lo acumulado.'}
          </p>
        )}
      </div>

      <BarrasMensuales serie={serie} />
      <LineaAcumulado serie={serie} />

      {fijos.length > 0 && (
        <div className={tarjeta}>
          <div className="flex items-center gap-2 mb-1">
            <Repeat className="w-4 h-4 text-[#fbbf24]" strokeWidth={1.8} />
            <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
              Gastos fijos
            </h3>
          </div>
          <p className="text-[11px] text-[#8a8a9c] mb-3">
            Los que aparecen en 3 meses o más: el piso que hay que juntar todos
            los meses antes de cualquier otra cosa — unos {pesos(piso)}.
          </p>
          <div className="space-y-1.5">
            {fijos.slice(0, 10).map(x => (
              <div key={x.concepto} className="flex items-baseline gap-2 text-[11px]">
                <span className="text-[#d4d4dd] truncate min-w-0 flex-1">{x.concepto}</span>
                <span className="text-[10px] text-[#8a8a9c] shrink-0">{x.meses} meses</span>
                <span className="tabular-nums text-[#a6a6b5] shrink-0 w-[86px] text-right">
                  {pesos(x.promedioMensual)}<span className="text-[10px] text-[#8a8a9c]">/mes</span>
                </span>
                <span className="tabular-nums text-[#d4d4dd] shrink-0 w-[92px] text-right">{pesos(x.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {contraste && contraste.meses > 0 && (
        <div className={tarjeta}>
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-4 h-4 text-[#a78bfa]" strokeWidth={1.8} />
            <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
              Lo que Econometría supone vs. lo que se gastó
            </h3>
          </div>
          <p className="text-[11px] text-[#8a8a9c] mb-3">
            Econometría calcula el costo por gramo con costos cargados a mano.
            Estos son los comprobantes reales de los últimos {contraste.meses} meses.
          </p>
          <div className="grid grid-cols-2 gap-2 auto-rows-fr">
            <Kpi t="Cargado a mano" v={pesos(contraste.cargadoMes)} c="#a78bfa" />
            <Kpi t="Gasto real" v={pesos(contraste.realMes)} c="#38bdf8" />
          </div>
          {/* El 15% es el umbral en que la diferencia deja de ser ruido de un mes
              flojo y pasa a mover el costo por gramo de forma visible. */}
          {contraste.brechaPct != null && Math.abs(contraste.brechaPct) > 15 && (
            <p className="text-[11px] text-[#fbbf24] mt-2 leading-relaxed">
              Se carga un {Math.abs(contraste.brechaPct).toFixed(0)}%
              {contraste.brecha > 0 ? ' más' : ' menos'} de lo que se gasta
              {' '}({contraste.brecha > 0 ? '+' : '−'}{pesos(Math.abs(contraste.brecha))} por mes).
              El costo por gramo que muestra Econometría sale de ese número, no de
              los comprobantes. Ninguno de los dos está mal por sí solo — uno es
              proyección y el otro es historia— pero conviene saber cuál estás
              mirando.
            </p>
          )}
        </div>
      )}

      {porCat.salidas.length > 0 && (
        <div className={tarjeta}>
          <div className="flex items-center gap-2 mb-2">
            <Landmark className="w-4 h-4 text-[#ff8a7a]" strokeWidth={1.8} />
            <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
              En qué se fue todo
            </h3>
          </div>
          <div className="space-y-1.5">
            {porCat.salidas.slice(0, 8).map(x => {
              const pct = t.salio > 0 ? (x.monto / t.salio) * 100 : 0
              return (
                <div key={x.categoria}>
                  <div className="flex items-baseline gap-2 text-[11px]">
                    <span className="text-[#d4d4dd] truncate min-w-0 flex-1">{x.categoria}</span>
                    <span className="tabular-nums text-[#a6a6b5] shrink-0">{pesos(x.monto)}</span>
                    <span className="tabular-nums text-[10px] text-[#8a8a9c] shrink-0 w-[40px] text-right">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-[#1f1f2b] overflow-hidden">
                    <div className="h-full rounded-full bg-[#ff8a7a]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Entradas y salidas por mes, espalda contra espalda.
 *
 * Las dos barras comparten escala a propósito: es la única forma de ver de un
 * vistazo el mes en que la salida pasó a la entrada. Con escalas propias los
 * dos meses se verían iguales.
 */
function BarrasMensuales({ serie }: { serie: ReturnType<typeof serieMensual> }) {
  const max = Math.max(...serie.map(m => Math.max(m.entro, m.salio)), 1)
  const W = 100 / serie.length

  return (
    <div className={tarjeta}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-3">
        Entró y salió, mes a mes
      </div>
      <div className="overflow-x-auto">
        <svg viewBox="0 0 100 44" preserveAspectRatio="none"
          className="w-full h-[150px] min-w-[280px]" role="img"
          aria-label="Entradas y salidas por mes">
          {serie.map((m, i) => {
            const x = i * W
            const hE = (m.entro / max) * 19
            const hS = (m.salio / max) * 19
            return (
              <g key={m.mes}>
                {/* Entró crece hacia arriba desde el centro; salió hacia abajo. */}
                <rect x={x + W * 0.14} y={20 - hE} width={W * 0.34} height={hE} fill="#a3e635" rx="0.3" />
                <rect x={x + W * 0.52} y={20} width={W * 0.34} height={hS} fill="#ff8a7a" rx="0.3" />
              </g>
            )
          })}
          <line x1="0" y1="20" x2="100" y2="20" stroke="#2a2a3a" strokeWidth="0.2" />
        </svg>
        <div className="flex min-w-[280px]">
          {serie.map(m => (
            <div key={m.mes} className="text-center text-[10px] text-[#8a8a9c]"
              style={{ width: `${W}%` }} title={m.mes}>
              {etiquetaMes(m.mes)}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-[#8a8a9c]">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-[#a3e635]" /> entró
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-[#ff8a7a]" /> salió
        </span>
        <span className="ml-auto tabular-nums">tope {corto(max)}</span>
      </div>
    </div>
  )
}

/**
 * El acumulado. Es el gráfico que contesta "¿estamos juntando o gastando?".
 *
 * Lleva la línea del cero marcada: sin ella una curva que sube desde −2M parece
 * una buena noticia.
 */
function LineaAcumulado({ serie }: { serie: ReturnType<typeof serieMensual> }) {
  const vals = serie.map(m => m.acumulado)
  const max = Math.max(...vals, 0)
  const min = Math.min(...vals, 0)
  const span = max - min || 1
  const y = (v: number) => 28 - ((v - min) / span) * 26
  const x = (i: number) => serie.length === 1 ? 50 : (i / (serie.length - 1)) * 100
  const d = serie.map((m, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(m.acumulado).toFixed(2)}`).join(' ')
  const ultimo = serie[serie.length - 1].acumulado
  const color = ultimo >= 0 ? '#a3e635' : '#ff8a7a'

  return (
    <div className={tarjeta}>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">
          Acumulado
        </span>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
          {ultimo >= 0 ? '+' : '−'}{pesos(Math.abs(ultimo))}
        </span>
      </div>
      <svg viewBox="0 0 100 30" preserveAspectRatio="none"
        className="w-full h-[110px]" role="img" aria-label="Resultado acumulado">
        <line x1="0" y1={y(0)} x2="100" y2={y(0)} stroke="#2a2a3a"
          strokeWidth="0.25" strokeDasharray="1.5 1.5" />
        <path d={d} fill="none" stroke={color} strokeWidth="0.7"
          vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <p className="text-[10px] text-[#8a8a9c] mt-1">
        La línea punteada es el cero. Máximo {corto(max)}, mínimo {corto(min)}.
      </p>
    </div>
  )
}

