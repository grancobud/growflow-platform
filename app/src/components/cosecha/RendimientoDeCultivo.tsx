// Rendimiento del cultivo — qué rinde, cuánto cuesta y cuál conviene volver a plantar.
//
// Vivía en /estadisticas, que ahora es de la asociación —personas, plata,
// evolución—. Esto mira los datos de Cosecha, así que se mudó a donde están:
// es la pestaña «Rendimiento» de esa pantalla.
//
// Criterios de los gráficos:
//  - Todo lo que compara MAGNITUD usa una sola rampa de verde (más = más
//    oscuro/intenso). Ponerle un color distinto a cada genética sería gastar el
//    canal de color en repetir lo que ya dice el largo de la barra.
//  - Nada de doble eje: dos medidas de escala distinta van en dos gráficos.
//  - Un cero calculado se muestra como "—". Un "0 g/planta" se lee como "rinde
//    cero" cuando en realidad significa "todavía no hay con qué calcularlo".

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  BarChart3, RefreshCw, Scale, Trophy, Sprout, CalendarRange,
  Table2, LineChart, Target, AlertTriangle,
} from 'lucide-react'
import {
  estadisticasService, resumir, porGenetica, porMes, gramosPorVatio, plantasCosechadas, mermaSecado,
  compararConAnterior, serieReciente, type Comparacion,
  type CosechaDetallada, type MetricasGenetica,
} from '../../lib/estadisticas'
import { cultivoService, type ResumenPlanta } from '../../lib/cultivo'
import { stockService } from '../../lib/stock'
import { econometriaService, resumenEconomico, configService, VIDA_UTIL_DEFECTO, type VidaUtil } from '../../lib/econometria'
import { btnSutil, tarjeta } from '../../lib/ui'

// Rampa secuencial de un solo hue, validada para fondo oscuro: lightness
// monótona, saltos visibles entre pasos y el extremo claro despegado del fondo.
const RAMPA = ['#3f6212', '#65a30d', '#84cc16', '#a3e635', '#d9f99d']
const ACENTO = '#a3e635'
const TENUE = '#2a2a3a'

const fmtG = (n: number) => Math.round(n).toLocaleString('es-AR')
const fmtPesos = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const nombreMesLargo = (k: string) => {
  const [a, m] = k.split('-').map(Number)
  return `${MESES_LARGO[m - 1]} ${a}`
}
const nombreMes = (k: string) => {
  const [a, m] = k.split('-').map(Number)
  return `${MESES[m - 1]} ${String(a).slice(2)}`
}

export function RendimientoDeCultivo() {
  const [cosechas, setCosechas] = useState<CosechaDetallada[]>([])
  const [plantas, setPlantas] = useState<ResumenPlanta[]>([])
  const [vatiosLuz, setVatiosLuz] = useState(0)
  const [costoPorGramo, setCostoPorGramo] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [verTabla, setVerTabla] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [cs, pl, insumos] = await Promise.all([
        estadisticasService.getCosechasDetalladas(),
        cultivoService.getResumenPlantas(false),
        stockService.getInsumos(),
      ])
      setCosechas(cs); setPlantas(pl)
      // g/W se mide sobre la luz, no sobre el consumo total del cuarto.
      setVatiosLuz(insumos
        .filter(i => i.categoria === 'Iluminacion' && i.potencia_w)
        .reduce((s, i) => s + Number(i.potencia_w) * (Number(i.cantidad) || 1), 0))
      try {
        const [costos, vida, par] = await Promise.all([
          econometriaService.getCostos(),
          configService.get<VidaUtil>('vida_util_meses', VIDA_UTIL_DEFECTO),
          configService.get<{ meses_ciclo: number }>('parametros', { meses_ciclo: 4 }),
        ])
        const gramos = cs.reduce((s, c) => s + (c.peso_seco_g ?? 0), 0)
        const eco = resumenEconomico({ insumos, costos, vida, mesesCiclo: par.meses_ciclo, gramosCosechados: gramos })
        setCostoPorGramo(eco.costoPorGramo && eco.costoPorGramo > 0 ? eco.costoPorGramo : null)
      } catch { /* sin econometría el resto de la página funciona igual */ }
    } catch (err) {
      toast.error(`Error cargando estadísticas: ${(err as Error).message}`)
    } finally { setCargando(false) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const r = useMemo(() => resumir(cosechas), [cosechas])
  const gens = useMemo(() => porGenetica(cosechas), [cosechas])
  const meses = useMemo(() => porMes(cosechas), [cosechas])
  const cosechadas = plantasCosechadas(cosechas)
  const gPorPlanta = cosechadas > 0 ? r.totalSeco / cosechadas : null
  const gW = gramosPorVatio(r.totalSeco, vatiosLuz)
  const activas = plantas.filter(p => p.activa !== false)
  // Contra el período anterior: un número suelto no dice si vas mejorando.
  const cmpPeso = useMemo(() => compararConAnterior(cosechas, c => c.peso_seco_g), [cosechas])
  const cmpNota = useMemo(() => compararConAnterior(cosechas, c => c.valoracion), [cosechas])
  const seriePeso = useMemo(() => serieReciente(cosechas, c => c.peso_seco_g), [cosechas])
  const serieNota = useMemo(() => serieReciente(cosechas, c => c.valoracion), [cosechas])

  if (cargando) {
    return (
      <Marco onRefrescar={cargar} cargando>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className={`${tarjeta} h-[76px] animate-pulse`} />)}
        </div>
        <div className={`${tarjeta} h-[220px] animate-pulse`} />
        <div className={`${tarjeta} h-[300px] animate-pulse`} />
      </Marco>
    )
  }

  if (r.cosechas === 0) {
    return (
      <Marco onRefrescar={cargar}>
        <div className="py-20 text-center">
          <div className="mx-auto w-11 h-11 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-3">
            <BarChart3 className="w-5 h-5 text-[#8a8a9c]" />
          </div>
          <div className="font-display font-semibold text-[#d4d4dd] text-[14px]">Todavía no hay cosechas con peso</div>
          <div className="mt-1 text-[11px] text-[#8a8a9c] max-w-sm mx-auto leading-relaxed">
            Registrá una cosecha con su peso seco y acá vas a ver el rendimiento por genética, la evolución
            en el tiempo y cuánto te está costando cada gramo.
          </div>
          {activas.length > 0 && (
            <p className="mt-3 text-[11px] text-[#7c8b5c]">
              Tenés {activas.length} planta{activas.length === 1 ? '' : 's'} en curso.
            </p>
          )}
        </div>
      </Marco>
    )
  }

  return (
    <Marco onRefrescar={cargar}>
      {/* Hero + tiles. El hero va con cifras proporcionales a propósito: a 48px
          las tabulares dejan huecos entre dígitos y el número se ve flojo. */}
      <section className={`${tarjeta} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">Total cosechado</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display font-bold text-[42px] sm:text-[52px] leading-none text-[#bef264]">
                {(r.totalSeco / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
              </span>
              <span className="text-[14px] text-[#7c8b5c] font-medium">kg secos</span>
            </div>
          </div>
          <p className="text-[11px] text-[#8a8a9a] leading-relaxed max-w-sm">
            {r.cosechas} cosecha{r.cosechas === 1 ? '' : 's'} de {gens.length} genética{gens.length === 1 ? '' : 's'}
            {r.mejor?.genetica && <>. La mejor fue <b className="text-[#d4d4dd]">{r.mejor.genetica}</b> con {fmtG(r.mejor.peso_seco_g ?? 0)} g</>}
            {r.peor && r.peor.peso_seco_g != null && <>, la más floja {fmtG(r.peor.peso_seco_g)} g</>}.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#1f1f2b] mt-4 rounded-lg overflow-hidden border border-[#1f1f2b]">
          <Tile t="Por cosecha" v={r.promedioPorCosecha != null ? `${fmtG(r.promedioPorCosecha)} g` : '—'}
            delta={cmpPeso} serie={seriePeso} sub="promedio" />
          <Tile t="Por planta" v={gPorPlanta != null ? `${fmtG(gPorPlanta)} g` : '—'}
            sub={cosechadas > 0 ? `${cosechadas} planta${cosechadas === 1 ? '' : 's'}` : 'sin plantas cosechadas'} />
          <Tile t="Gramos por vatio" v={gW != null ? gW.toFixed(2) : '—'}
            sub={gW != null ? `${fmtG(vatiosLuz)} W de luz` : 'cargá la potencia'}
            color={gW == null ? undefined : gW >= 1 ? '#bef264' : gW >= 0.6 ? '#facc15' : '#ff8a7a'}
            meta={gW != null ? { valor: gW, bueno: 1 } : undefined} />
          <Tile t="Costo por gramo" v={costoPorGramo != null ? fmtPesos(costoPorGramo) : '—'}
            sub={costoPorGramo != null ? 'según Econometría' : 'cargá costos'} />
          <Tile t="Merma de secado" v={r.merma != null ? `${r.merma.toFixed(0)}%` : '—'}
            sub={r.merma != null ? (r.merma >= 70 && r.merma <= 82 ? 'en rango normal' : 'fuera de 70-82%') : 'falta peso húmedo'}
            color={r.merma == null ? undefined : r.merma >= 70 && r.merma <= 82 ? '#bef264' : '#facc15'} />
          <Tile t="Valoración" v={r.valoracion != null ? `${r.valoracion.toFixed(1)}` : '—'}
            delta={cmpNota} serie={serieNota} sub="sobre 10" />
          <Tile t="Ciclo" v={r.diasCicloPromedio != null ? `${Math.round(r.diasCicloPromedio)} d` : '—'}
            sub="germinación a corte" />
          <Tile t="En curso" v={String(activas.length)}
            sub={`${activas.filter(p => p.fase === 'Floracion').length} en floración`} />
        </div>
      </section>

      {/* En pantalla ancha la producción y el scatter van lado a lado: son dos
          lecturas distintas del mismo período y comparten el aire. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <ProduccionPorMes meses={meses} />
        <RindeVsCalidad gens={gens} />
      </div>

      <RankingGeneticas gens={gens} verTabla={verTabla} onVerTabla={setVerTabla} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <UltimasCosechas cosechas={cosechas} />
        <EstadoDelCultivo plantas={activas} />
      </div>
    </Marco>
  )
}

// ---------------------------------------------------------------------------

// Sin encabezado propio: esto es una pestaña de Cosecha, que ya trae el suyo.
// Dos títulos apilados diciendo casi lo mismo es la marca de una pantalla que
// se pegó adentro de otra sin mirar.
function Marco({ children, onRefrescar, cargando }: {
  children: React.ReactNode; onRefrescar: () => void; cargando?: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-[11px] text-[#8a8a9c]">Rendimiento, eficiencia y qué conviene repetir</p>
        <button onClick={onRefrescar}
          className="ml-auto inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:bg-[#1c1c27] transition-colors text-[#a6a6b5]"
          title="Refrescar" aria-label="Refrescar">
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {children}
    </div>
  )
}

/**
 * Stat tile: etiqueta, valor, y —cuando hay con qué— la variación contra el
 * período anterior y una sparkline de las últimas cosechas. El delta es lo que
 * convierte el número en información: "169 g" no dice nada, "169 g, 12% más que
 * antes" sí.
 */
function Tile({ t, v, sub, color, delta, serie, meta }: {
  t: string; v: string; sub?: string; color?: string
  delta?: Comparacion | null
  serie?: number[]
  /** Para las métricas con un objetivo conocido (g/W): dibuja el avance. */
  meta?: { valor: number; bueno: number }
}) {
  const pct = delta?.pct ?? null
  const sube = pct != null && pct > 0
  return (
    <div className="bg-[#101016] p-3 min-w-0">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium leading-tight line-clamp-2">{t}</div>
      <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
        <span className="text-[17px] font-display font-bold leading-none" style={{ color: color ?? '#ececf1' }}>{v}</span>
        {pct != null && Math.abs(pct) >= 1 && (
          <span className="text-[11px] font-medium tabular-nums leading-none"
            style={{ color: sube ? '#bef264' : '#ff8a7a' }}
            title={`Últimas ${delta!.n} contra las ${delta!.n} anteriores`}>
            {sube ? '↑' : '↓'}{Math.abs(pct).toFixed(0)}%
          </span>
        )}
      </div>
      {serie && serie.length >= 4
        ? <Sparkline datos={serie} color={color ?? ACENTO} />
        : meta
          ? <Medidor valor={meta.valor} bueno={meta.bueno} color={color ?? ACENTO} />
          : <div className="h-[14px]" />}
      {sub && <div className="text-[10px] text-[#8a8a9c] truncate">{sub}</div>}
    </div>
  )
}

/** Doce puntos de tendencia. Sin ejes ni números: es contexto, no una lectura. */
function Sparkline({ datos, color }: { datos: number[]; color: string }) {
  const max = Math.max(...datos), min = Math.min(...datos)
  const rango = max - min || 1
  const pts = datos.map((d, i) =>
    `${(i / (datos.length - 1)) * 100},${100 - ((d - min) / rango) * 100}`).join(' ')
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-[14px] my-1 overflow-visible"
      aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="6"
        vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
      {/* El último punto en sólido: es el valor que está arriba en grande */}
      <circle cx="100" cy={100 - ((datos[datos.length - 1] - min) / rango) * 100} r="7"
        fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Avance contra un objetivo conocido, para las métricas que lo tienen. */
function Medidor({ valor, bueno, color }: { valor: number; bueno: number; color: string }) {
  return (
    <div className="h-1 rounded-full bg-[#1f1f2b] my-1.5 overflow-hidden" title={`Objetivo: ${bueno}`}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (valor / bueno) * 100)}%`, background: color }} />
    </div>
  )
}

function Encabezado({ Ic, titulo, nota, extra }: {
  Ic: typeof Scale; titulo: string; nota?: string; extra?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap px-4 sm:px-5 py-3 border-b border-[#1f1f2b]">
      <Ic className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACENTO }} strokeWidth={1.8} />
      <h2 className="font-display font-semibold text-[14px] text-[#ececf1]">{titulo}</h2>
      {nota && <span className="text-[11px] text-[#8a8a9c]">{nota}</span>}
      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Producción en el tiempo. Una sola medida, un solo color: el eje ya dice todo.
// ---------------------------------------------------------------------------

function ProduccionPorMes({ meses }: { meses: { mes: string; seco: number; cosechas: number }[] }) {
  if (meses.length < 2) return null
  const max = Math.max(...meses.map(m => m.seco), 1)
  const total = meses.reduce((s, m) => s + m.seco, 0)
  const activos = meses.filter(m => m.seco > 0)
  const mejor = meses.reduce((a, b) => b.seco > a.seco ? b : a)

  return (
    <section className={tarjeta}>
      <Encabezado Ic={LineChart} titulo="Producción por mes"
        nota={`${fmtG(total)} g en ${meses.length} mes${meses.length === 1 ? '' : 'es'}`} />
      <div className="p-4 sm:p-5">
        {/* Ancho MÁXIMO por columna: con dos meses cargados, un flex-1 les daba
            media pantalla a cada una y el gráfico parecía otra cosa. Se alinean
            a la izquierda y crecen hasta 56px, como una serie temporal real. */}
        <div className="flex items-end gap-[3px] h-[120px]" role="img"
          aria-label={`Producción mensual: ${activos.map(m => `${nombreMes(m.mes)} ${fmtG(m.seco)} gramos`).join(', ')}`}>
          {meses.map(m => (
            <div key={m.mes} className="flex-1 max-w-[56px] min-w-0 h-full flex flex-col justify-end items-center group relative">
              {m.seco > 0 && (
                <span className="absolute -top-1 text-[10px] text-[#a6a6b5] tabular-nums opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 bg-[#0a0a0f] px-1 rounded">
                  {fmtG(m.seco)} g · {m.cosechas}
                </span>
              )}
              <div className="w-full rounded-t-[4px] transition group-hover:brightness-125"
                style={{
                  height: `${Math.max(m.seco > 0 ? 4 : 2, (m.seco / max) * 100)}%`,
                  background: m.seco > 0 ? (m.mes === mejor.mes ? '#bef264' : ACENTO) : TENUE,
                }} />
            </div>
          ))}
          <div className="flex-1" />
        </div>
        <div className="flex gap-[3px] mt-1.5">
          {meses.map((m, i) => (
            <div key={m.mes} className="flex-1 max-w-[56px] min-w-0 text-center text-[10px] text-[#8a8a9c] truncate">
              {meses.length <= 10 || i % 2 === 0 ? nombreMes(m.mes) : ''}
            </div>
          ))}
          <div className="flex-1" />
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2.5 leading-relaxed">
          El mejor mes fue <b className="text-[#a6a6b5]">{nombreMes(mejor.mes)}</b> con {fmtG(mejor.seco)} g.
          Los meses sin cosecha se muestran igual, en cero: saltearlos haría parecer que el cultivo nunca paró.
        </p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Ranking por genética, con la tabla completa a un clic.
// ---------------------------------------------------------------------------

function RankingGeneticas({ gens, verTabla, onVerTabla }: {
  gens: MetricasGenetica[]; verTabla: boolean; onVerTabla: (v: boolean) => void
}) {
  const max = Math.max(...gens.map(g => g.seco), 1)
  // El color refuerza el orden del ranking, que ya es la información del gráfico.
  const tono = (i: number) => RAMPA[Math.min(RAMPA.length - 1, RAMPA.length - 1 - Math.floor((i / Math.max(1, gens.length - 1)) * (RAMPA.length - 1)))]

  return (
    <section className={tarjeta}>
      <Encabezado Ic={Scale} titulo="Rendimiento por genética" nota={`${gens.length} variedad${gens.length === 1 ? '' : 'es'}`}
        extra={
          <button onClick={() => onVerTabla(!verTabla)} className={btnSutil}>
            <Table2 className="w-3.5 h-3.5" /> {verTabla ? 'Ver gráfico' : 'Ver tabla'}
          </button>
        } />

      {verTabla ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] tabular-nums">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium border-b border-[#1f1f2b]">
                <th className="text-left font-medium px-4 py-2">Genética</th>
                <th className="text-right font-medium px-2 py-2">Total</th>
                <th className="text-right font-medium px-2 py-2">Cosechas</th>
                <th className="text-right font-medium px-2 py-2">Por cosecha</th>
                <th className="text-right font-medium px-2 py-2">Merma</th>
                <th className="text-right font-medium px-2 py-2">Ciclo</th>
                <th className="text-right font-medium px-4 py-2">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f2b]/60">
              {gens.map(g => (
                <tr key={g.genetica} className="hover:bg-[#15151d]">
                  <td className="px-4 py-2 text-[#ececf1] max-w-[160px] truncate">{g.genetica}</td>
                  <td className="px-2 py-2 text-right text-[#d9f99d] font-medium">{fmtG(g.seco)} g</td>
                  <td className="px-2 py-2 text-right text-[#a6a6b5]">{g.cosechas}</td>
                  <td className="px-2 py-2 text-right text-[#a6a6b5]">{fmtG(g.porCosecha)} g</td>
                  <td className="px-2 py-2 text-right text-[#a6a6b5]">{g.merma != null ? `${g.merma.toFixed(0)}%` : '—'}</td>
                  <td className="px-2 py-2 text-right text-[#a6a6b5]">{g.diasCiclo != null ? `${Math.round(g.diasCiclo)} d` : '—'}</td>
                  <td className="px-4 py-2 text-right text-[#a6a6b5]">{g.valoracion != null ? g.valoracion.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="divide-y divide-[#1f1f2b]">
          {gens.map((g, i) => (
            <li key={g.genetica} className="px-4 sm:px-5 py-3 group">
              <div className="flex items-center gap-2 mb-1.5">
                {i === 0 && <Trophy className="w-3.5 h-3.5 text-[#f59e0b] flex-shrink-0" aria-label="La que más rindió" />}
                <span className="text-[12px] font-medium text-[#ececf1] truncate">{g.genetica}</span>
                <span className="ml-auto font-display font-bold text-[14px] text-[#d9f99d] tabular-nums flex-shrink-0">
                  {fmtG(g.seco)} g
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#15151d] overflow-hidden">
                <div className="h-full rounded-full transition group-hover:brightness-125"
                  style={{ width: `${(g.seco / max) * 100}%`, background: tono(i) }} />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-[#8a8a9c] tabular-nums">
                <span>{g.cosechas} cosecha{g.cosechas === 1 ? '' : 's'}</span>
                <span>{fmtG(g.porCosecha)} g c/u</span>
                {g.diasCiclo != null && <span>{Math.round(g.diasCiclo)} d de ciclo</span>}
                {g.merma != null && <span>{g.merma.toFixed(0)}% de merma</span>}
                {g.valoracion != null && <span className="text-[#c4b5fd]">★ {g.valoracion.toFixed(1)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Rinde contra calidad: la que decide qué se vuelve a plantar.
// ---------------------------------------------------------------------------

function RindeVsCalidad({ gens }: { gens: MetricasGenetica[] }) {
  const conAmbos = gens.filter(g => g.valoracion != null && g.porCosecha > 0)
  if (conAmbos.length < 2) return null

  // Los dos ejes se ajustan a lo que hay. Con rendimientos de 162 a 230 g, un
  // eje que arranca en 0 empuja todos los puntos contra el borde derecho y la
  // diferencia entre genéticas —que es lo que el gráfico tiene que mostrar—
  // deja de verse.
  const rindes = conAmbos.map(g => g.porCosecha)
  const gMin = Math.min(...rindes), gMax = Math.max(...rindes)
  const spanG = Math.max(1, (gMax - gMin) * 1.25)
  const baseG = Math.max(0, gMin - (gMax - gMin) * 0.12)
  const medioG = baseG + spanG / 2
  // El eje de notas se ajusta a lo que hay, con al menos 2 puntos de rango: si
  // todas las genéticas puntúan entre 7 y 9, un eje 0-10 las apila arriba y el
  // gráfico no muestra la diferencia que justamente se quiere ver.
  const notas = conAmbos.map(g => g.valoracion ?? 0)
  const notaMin = Math.max(0, Math.floor(Math.min(...notas) - 0.5))
  const notaMax = Math.min(10, Math.ceil(Math.max(...notas) + 0.5))
  const rango = Math.max(2, notaMax - notaMin)
  const notaMedia = notaMin + rango / 2
  const W = 100, H = 100  // se dibuja en porcentaje y escala con el contenedor

  return (
    <section className={tarjeta}>
      <Encabezado Ic={Target} titulo="Rinde contra calidad" nota="arriba a la derecha, las que conviene repetir" />
      <div className="p-4 sm:p-5">
        <div className="relative w-full aspect-[16/10] sm:aspect-[2/1] mb-5">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full"
            role="img" aria-label={`Rendimiento contra valoración de ${conAmbos.length} genéticas`}>
            {/* Cuadrantes: el cruce marca la media de rinde y el 7 de nota */}
            <line x1="50" y1="0" x2="50" y2={H} stroke={TENUE} strokeWidth="0.3" strokeDasharray="2 2" />
            <line x1="0" y1="50" x2={W} y2="50" stroke={TENUE} strokeWidth="0.3" strokeDasharray="2 2" />
          </svg>
          {/* Los puntos van en HTML: así el label es texto real y no se deforma
              con el preserveAspectRatio del SVG. */}
          {conAmbos.map(g => {
            const x = ((g.porCosecha - baseG) / spanG) * 100
            const y = ((notaMax - (g.valoracion ?? 0)) / rango) * 100
            const bueno = g.porCosecha >= medioG && (g.valoracion ?? 0) >= notaMedia
            return (
              <div key={g.genetica} className="absolute group"
                style={{ left: `${Math.min(94, Math.max(2, x))}%`, top: `${Math.min(92, Math.max(4, y))}%`, transform: 'translate(-50%,-50%)' }}>
                <div className="w-2.5 h-2.5 rounded-full ring-2 ring-[#101016] transition-transform group-hover:scale-150"
                  style={{ background: bueno ? '#bef264' : '#65a30d' }} />
                <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 text-[10px] text-[#8a8a9a] whitespace-nowrap
                                 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0a0a0f] px-1 rounded z-10 tabular-nums">
                  {g.genetica} · {fmtG(g.porCosecha)} g · ★{g.valoracion?.toFixed(1)}
                </span>
              </div>
            )
          })}
          <span className="absolute left-0 top-1 text-[10px] text-[#8a8a9c] tabular-nums">nota {notaMax}</span>
          <span className="absolute left-0 bottom-1 text-[10px] text-[#8a8a9c] tabular-nums">nota {notaMin}</span>
          <span className="absolute left-0 -bottom-4 text-[10px] text-[#8a8a9c] tabular-nums">{fmtG(baseG)} g</span>
          <span className="absolute right-0 -bottom-4 text-[10px] text-[#8a8a9c] tabular-nums">{fmtG(baseG + spanG)} g</span>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-3 leading-relaxed">
          Cada punto es una genética: a la derecha las que más rinden por cosecha, arriba las que mejor puntuaste.
          Las de <b style={{ color: '#bef264' }}>verde claro</b> están en el cuadrante bueno de las dos cosas.
          Los dos ejes se ajustan al rango real de tus datos ({fmtG(baseG)}–{fmtG(baseG + spanG)} g,
          nota {notaMin}–{notaMax}): con escalas fijas desde cero quedarían todas amontonadas en una esquina.
          Pasá el dedo o el mouse por encima para ver cuál es cada una.
        </p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// El detalle corte por corte: los promedios esconden la corrida que salió mal.
// ---------------------------------------------------------------------------

type Criterio = 'fecha' | 'peso' | 'nota'

const CRITERIOS: { id: Criterio; label: string }[] = [
  { id: 'fecha', label: 'Fecha' },
  { id: 'peso', label: 'Peso' },
  { id: 'nota', label: 'Nota' },
]

/**
 * El detalle corte por corte. Los promedios esconden la corrida que salió mal.
 *
 * Ordenada por fecha se agrupa por mes, con el total del período en el
 * encabezado: es el patrón de cualquier lista cronológica larga (un extracto
 * bancario, un historial) y resuelve el problema real de una lista de 18 filas
 * iguales, que es no tener dónde apoyar la vista. El encabezado además aporta
 * un dato que antes no estaba: cuánto rindió cada mes.
 *
 * Ordenada por peso o por nota la agrupación se apaga sola: mezclar meses
 * dentro de un grupo llamado "agosto" sería mentir sobre el contenido.
 */
function UltimasCosechas({ cosechas }: { cosechas: CosechaDetallada[] }) {
  const [todas, setTodas] = useState(false)
  const [orden, setOrden] = useState<Criterio>('fecha')
  const conPeso = cosechas.filter(c => (c.peso_seco_g ?? 0) > 0)

  const ordenadas = useMemo(() => {
    const xs = [...conPeso]
    if (orden === 'peso') return xs.sort((a, b) => (b.peso_seco_g ?? 0) - (a.peso_seco_g ?? 0))
    if (orden === 'nota') return xs.sort((a, b) => (b.valoracion ?? -1) - (a.valoracion ?? -1))
    return xs.sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [conPeso, orden])

  if (!conPeso.length) return null
  const lista = todas ? ordenadas : ordenadas.slice(0, 8)
  const max = Math.max(...conPeso.map(c => c.peso_seco_g ?? 0))

  // Grupos sólo cuando la lista está en orden cronológico.
  const grupos: { clave: string; items: CosechaDetallada[] }[] = []
  if (orden === 'fecha') {
    for (const c of lista) {
      const k = c.fecha.slice(0, 7)
      const ultimo = grupos[grupos.length - 1]
      if (ultimo?.clave === k) ultimo.items.push(c)
      else grupos.push({ clave: k, items: [c] })
    }
  } else {
    grupos.push({ clave: '', items: lista })
  }

  return (
    <section className={tarjeta}>
      <Encabezado Ic={CalendarRange} titulo="Cosecha por cosecha"
        nota={`${conPeso.length} registro${conPeso.length === 1 ? '' : 's'}`}
        extra={
          <div className="flex items-center gap-1 rounded-lg border border-[#2a2a3a] overflow-hidden">
            {CRITERIOS.map(o => (
              <button key={o.id} onClick={() => setOrden(o.id)}
                className={`px-2.5 py-2 sm:py-1 min-h-[44px] sm:min-h-0 text-[11px] font-medium transition-colors ${
                  orden === o.id ? 'bg-[#a3e635]/15 text-[#d9f99d]' : 'text-[#8a8a9c] hover:text-[#d4d4dd]'}`}>
                {o.label}
              </button>
            ))}
          </div>
        } />

      <div>
        {grupos.map(g => (
          <div key={g.clave || 'todos'}>
            {g.clave && <CabeceraMes clave={g.clave} items={g.items} />}
            <ul className="divide-y divide-[#1f1f2b]">
              {g.items.map(c => (
                <FilaCosecha key={c.id} c={c} max={max} conFechaCorta={orden === 'fecha'} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {conPeso.length > 8 && (
        <div className="px-4 sm:px-5 py-2.5 border-t border-[#1f1f2b]">
          <button onClick={() => setTodas(!todas)} className={`${btnSutil} w-full justify-center`}>
            {todas ? 'Ver sólo las últimas 8' : `Ver las ${conPeso.length}`}
          </button>
        </div>
      )}
    </section>
  )
}

/** Corte de mes: da el ritmo visual y de paso dice cuánto rindió el período. */
function CabeceraMes({ clave, items }: { clave: string; items: CosechaDetallada[] }) {
  const total = items.reduce((s, c) => s + (c.peso_seco_g ?? 0), 0)
  return (
    <div className="sticky top-0 z-10 flex items-baseline gap-2 px-4 sm:px-5 py-1.5 bg-[#0d0d13] border-y border-[#1f1f2b]">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">
        {nombreMesLargo(clave)}
      </span>
      <span className="flex-1 border-b border-dashed border-[#1f1f2b]" />
      <span className="text-[11px] text-[#8a8a9c] tabular-nums">
        {items.length} corte{items.length === 1 ? '' : 's'}
      </span>
      <span className="text-[11px] font-semibold text-[#a6a6b5] tabular-nums">{fmtG(total)} g</span>
    </div>
  )
}

function FilaCosecha({ c, max, conFechaCorta }: {
  c: CosechaDetallada; max: number; conFechaCorta: boolean
}) {
  const m = mermaSecado(c.peso_humedo_g, c.peso_seco_g)
  const [a, mes, dia] = c.fecha.split('-')
  return (
    <li className="px-4 sm:px-5 py-2.5 flex items-center gap-3 hover:bg-[#15151d] transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[#ececf1] truncate">{c.genetica ?? 'Sin genética'}</span>
          {c.valoracion != null && (
            <span className="text-[10px] text-[#c4b5fd] flex-shrink-0 tabular-nums">★ {c.valoracion.toFixed(1)}</span>
          )}
        </div>
        <div className="text-[10px] text-[#8a8a9c] tabular-nums flex flex-wrap gap-x-2.5">
          {/* Dentro de un grupo que ya dice el mes, la fecha completa es ruido */}
          <span>{conFechaCorta ? `${dia}/${mes}` : `${dia}/${mes}/${a.slice(2)}`}</span>
          {c.dias_ciclo != null && <span>{c.dias_ciclo} d</span>}
          {m != null && <span>{m.toFixed(0)}% merma</span>}
        </div>
      </div>
      {/* Barra y cifra forman un solo bloque alineado a la derecha: suelta en el
          medio de la fila no se anclaba a nada y se leía como decoración. */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="hidden sm:block w-20 h-1 rounded-full bg-[#1c1c27] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${((c.peso_seco_g ?? 0) / max) * 100}%`, background: ACENTO }} />
        </div>
        <span className="text-[14px] font-semibold text-[#d9f99d] tabular-nums w-16 text-right">
          {fmtG(c.peso_seco_g ?? 0)} g
        </span>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Qué hay hoy en el cultivo.
// ---------------------------------------------------------------------------

const ORDEN_FASE = ['Germinacion', 'Plantula', 'Vegetativo', 'Floracion'] as const
const ETIQUETA: Record<string, string> = {
  Germinacion: 'Germinación', Plantula: 'Plántula', Vegetativo: 'Vegetativo', Floracion: 'Floración',
}

function EstadoDelCultivo({ plantas }: { plantas: ResumenPlanta[] }) {
  if (!plantas.length) return null
  const conteo = ORDEN_FASE.map((f, i) => ({
    fase: f,
    n: plantas.filter(p => p.fase === f).length,
    // Fases = escala ordenada (el ciclo avanza), así que rampa, no colores sueltos.
    color: RAMPA[i + 1] ?? ACENTO,
  })).filter(c => c.n > 0)
  const total = conteo.reduce((s, c) => s + c.n, 0)
  const sinRiego = plantas.filter(p => !p.ultimo_riego).length

  return (
    <section className={tarjeta}>
      <Encabezado Ic={Sprout} titulo="El cultivo hoy" nota={`${plantas.length} planta${plantas.length === 1 ? '' : 's'} activa${plantas.length === 1 ? '' : 's'}`} />
      <div className="p-4 sm:p-5">
        <div className="flex h-2.5 rounded-full overflow-hidden bg-[#15151d] gap-[2px]">
          {conteo.map(c => (
            <div key={c.fase} style={{ width: `${(c.n / total) * 100}%`, background: c.color }}
              title={`${ETIQUETA[c.fase]}: ${c.n}`} />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {conteo.map(c => (
            <div key={c.fase} className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: c.color }} />
              <span className="text-[11px] text-[#8a8a9a] truncate">{ETIQUETA[c.fase]}</span>
              <span className="ml-auto text-[12px] font-semibold text-[#ececf1] tabular-nums">{c.n}</span>
            </div>
          ))}
        </div>
        {sinRiego > 0 && (
          <p className="flex items-start gap-1.5 text-[11px] text-[#f59e0b] mt-3">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" strokeWidth={1.8} />
            <span>{sinRiego} planta{sinRiego === 1 ? '' : 's'} sin ningún riego registrado.</span>
          </p>
        )}
      </div>
    </section>
  )
}
