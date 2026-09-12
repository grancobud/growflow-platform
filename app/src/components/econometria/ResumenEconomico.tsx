// Resumen económico: el costo por gramo y la trazabilidad completa de cada peso.
// El modelo vive en lib/econometria (resumenEconomico): equipo del Stock
// amortizado por su vida útil + gastos fijos + variables + consumibles.
//
// Mobile-first: en celular cada bloque es una tarjeta apilada y las tablas se
// vuelven listas; en desktop se usan tablas. Los desgloses arrancan cerrados
// para que la pantalla chica no quede infinita.

import { useMemo, useState } from 'react'
import { ChevronDown, Landmark, Wrench, FlaskConical, Droplets, Info } from 'lucide-react'
import {
  gramosParaCosto, mensualEquivalente, labelPeriodicidad,
  type ResumenEconomico, type VidaUtil, type ItemAmortizado,
} from '../../lib/econometria'

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
const fmtG = (n: number) => Math.round(n).toLocaleString('es-AR')
const pct = (parte: number, total: number) => total > 0 ? (parte / total) * 100 : 0

// ---------------------------------------------------------------------------
// 1. El número que importa
// ---------------------------------------------------------------------------

/** Percentil de una lista YA ordenada de menor a mayor. */
function percentil(ordenados: number[], p: number): number {
  if (ordenados.length === 0) return 0
  if (ordenados.length === 1) return ordenados[0]
  const i = (ordenados.length - 1) * p
  const bajo = Math.floor(i), alto = Math.ceil(i)
  return bajo === alto ? ordenados[bajo] : ordenados[bajo] + (ordenados[alto] - ordenados[bajo]) * (i - bajo)
}

export function CostoPorGramo({ eco, material, nCosechas, plantasActivas, plantasEnFlora, rindes, mesesCiclo }: {
  eco: ResumenEconomico
  /** De dónde salen los gramos del denominador. Ver `materialDelCiclo`. */
  material?: { deCosechas: number; deLotesPropios: number } | null
  nCosechas: number; plantasActivas: number
  plantasEnFlora: number; rindes: number[]; mesesCiclo: number
}) {
  const hay = eco.gramos > 0
  const metas = [1000, 2000, 3000].map(p => ({ precio: p, gramos: gramosParaCosto(eco.totalCiclo, p) }))
  const rinde = nCosechas > 0 ? eco.gramos / nCosechas : 0
  // Proyección = lo YA cosechado + lo que falta cortar. Antes era rinde × plantas
  // activas, con dos errores: no sumaba lo cosechado, y contaba como si fueran a
  // dar todas las activas, incluidas las que están en vegetativo y son del ciclo
  // siguiente. Con 12 autos en flora y 20 fem vegetando, proyectaba 32.
  const porCortar = rinde * plantasEnFlora
  const proyectado = eco.gramos + porCortar
  const costoProyectado = proyectado > 0 ? eco.totalCiclo / proyectado : null
  const enVegetativo = Math.max(0, plantasActivas - plantasEnFlora)

  // Escenarios: qué pasa si las que faltan rinden como el peor cuarto de lo ya
  // cosechado, como el promedio, como el mejor cuarto o como la mejor planta.
  // Con pocas cosechas los percentiles no significan nada, así que se piden 4.
  const escenarios = useMemo<{ nombre: string; rinde: number; total: number; costo: number; destacado: boolean }[]>(() => {
    if (rindes.length < 4 || plantasEnFlora <= 0) return []
    const armar = (nombre: string, rinde: number, destacado = false) => {
      const total = eco.gramos + rinde * plantasEnFlora
      return { nombre, rinde, total, costo: eco.totalCiclo / total, destacado }
    }
    return [
      armar('Flojo', percentil(rindes, 0.25)),
      armar('Esperado', rinde, true),          // el promedio de lo ya cosechado
      armar('Bueno', percentil(rindes, 0.75)),
      armar('Óptimo', rindes[rindes.length - 1]),
    ]
  }, [rindes, plantasEnFlora, eco.gramos, eco.totalCiclo, rinde])

  // tabular-nums en la sección entera: los párrafos comparan cifras entre sí
  // ("de $X.XXX a $XX.XXX") y con ancho de dígito variable se corren al recalcular.
  return (
    <section className="rounded-xl bg-gradient-to-br from-[#12160f] to-[#101016] border border-[#2c3a1a] p-4 sm:p-5 tabular-nums">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#7c8b5c] font-medium">Costo por gramo</div>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-display font-bold text-[38px] sm:text-[46px] leading-none text-[#bef264] tabular-nums">
          {hay ? fmt(eco.costoPorGramo ?? 0) : '—'}
        </span>
        {hay && <span className="text-[15px] text-[#7c8b5c] font-medium">/g</span>}
      </div>

      <p className="mt-2 text-[11px] sm:text-[12px] text-[#8a8a9a] leading-relaxed">
        {hay ? (
          <>
            <b className="text-[#d4d4dd]">{fmt(eco.totalCiclo)}</b> que cuesta el ciclo de {mesesCiclo} meses,
            dividido <b className="text-[#d4d4dd]">{fmtG(eco.gramos)}g</b> de producción propia
            {/* DE DONDE SALEN ESOS GRAMOS. Decia «secos cosechados en 15
                cosechas» siempre, y despues del corte los 795 g no venian de
                ninguna cosecha: venian de lotes propios sin cosecha registrada.
                Un denominador que se explica mal es como el numero llego a
                $XX.XXX sin que nadie lo notara. */}
            {material && material.deLotesPropios > 0 && material.deCosechas === 0
              ? <>, cargada como lotes propios (todavía sin cosechas de este ciclo)</>
              : material && material.deLotesPropios > 0
                ? <>: {fmtG(material.deCosechas)}g cosechados en {nCosechas} cosecha{nCosechas === 1 ? '' : 's'} y {fmtG(material.deLotesPropios)}g de lotes propios</>
                : nCosechas > 0 && <>, cosechada en {nCosechas} cosecha{nCosechas === 1 ? '' : 's'}</>}.
            {' '}<span className="text-[#8a8a9c]">Es lo efectivamente gastado: no incluye la lista de compras pendiente.</span>
          </>
        ) : (
          <>Cargá cosechas con peso seco para que se calcule. El ciclo de {mesesCiclo} meses
            cuesta <b className="text-[#d4d4dd]">{fmt(eco.totalCiclo)}</b>.</>
        )}
      </p>

      {/* El mismo costo, pero sumando lo que todavía falta comprar. Va aparte y
          no reemplaza al de arriba: uno es lo que gastaste y el otro lo que
          vas a gastar si comprás toda la lista. Mezclarlos daría un costo por
          gramo que no corresponde a ninguna realidad. */}
      {eco.faltantes > 0 && (
        <div className="mt-3.5 rounded-lg bg-[#15151d]/80 border border-[#2a2a3a] p-3">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#8f8f9f] font-medium">
              Si comprás lo que falta
            </div>
            <div className="flex items-baseline gap-1 ml-auto">
              <span className="font-display font-bold text-[22px] leading-none text-[#facc15] tabular-nums">
                {hay ? fmt(eco.costoPorGramoConFaltantes ?? 0) : '—'}
              </span>
              {hay && <span className="text-[11px] text-[#8a7c3c]">/g</span>}
            </div>
          </div>
          <p className="text-[11px] text-[#8a8a9a] leading-relaxed mt-1.5">
            La lista pendiente suma <b className="text-[#d4d4dd]">{fmt(eco.faltantes)}</b>, pero sobre este ciclo
            pesan <b className="text-[#facc15]">{fmt(eco.faltantesEnCiclo)}</b>: el equipamiento se amortiza en su
            vida útil y no cae entero acá. El ciclo pasa de <b className="text-[#d4d4dd]">{fmt(eco.totalCiclo)}</b> a{' '}
            <b className="text-[#d4d4dd]">{fmt(eco.totalCicloConFaltantes)}</b>
            {hay && eco.costoPorGramo != null && eco.costoPorGramoConFaltantes != null && (
              <>, y el gramo de <b className="text-[#bef264]">{fmt(eco.costoPorGramo)}</b> a{' '}
                <b className="text-[#facc15]">{fmt(eco.costoPorGramoConFaltantes)}</b></>
            )}.
          </p>
          {/* En mobile van apilados como filas etiqueta→monto: a tres columnas
              los montos de siete cifras no entran y la tarjeta se aplasta.
              En desktop, `mt-auto` empuja el monto al piso para que los tres
              queden a la misma altura aunque una etiqueta ocupe dos líneas. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2 mt-2.5">
            {([
              ['Equipo (parte del ciclo)', eco.faltantesDetalle.capexEnCiclo],
              ['Consumibles', eco.faltantesDetalle.consumibles],
              ['Pagos únicos', eco.faltantesDetalle.gastos],
            ] as const).map(([t, v]) => (
              <div key={t}
                className="rounded-lg bg-[#0d0d13] border border-[#1f1f2b] px-2.5 py-1.5
                           flex items-baseline justify-between gap-2 sm:flex-col sm:items-stretch sm:gap-0">
                <div className="text-[10px] sm:text-[10px] text-[#8a8a9c] leading-tight">{t}</div>
                <div className="text-[13px] font-semibold text-[#d4d4dd] tabular-nums
                                text-right sm:text-left whitespace-nowrap sm:mt-auto sm:pt-1">
                  {fmt(v)}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#8a8a9c] leading-snug mt-2">
            Es un escenario, no tu costo real. Cada item se clasifica en la lista de
            {' '}<b className="text-[#8a8a9c]">Insumos faltantes</b>: lo que marques como equipo se amortiza según su
            categoría, y los pagos únicos (honorarios, trámites) caen enteros porque no son un bien.
          </p>
        </div>
      )}

      {/* Proyección: el número que sirve para decidir */}
      {/* Sin cosechas de ESTE ciclo no hay con que proyectar: `rinde` seria
          los gramos divididos cero cosechas. Antes decia «si rinden como las
          ya cosechadas (53g promedio)» sobre 795 g que no cosecho nadie. */}
      {hay && plantasEnFlora > 0 && costoProyectado != null && nCosechas > 0 && (
        <div className="mt-3.5 rounded-lg bg-[#0d120a]/70 border border-[#243018] p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#7c8b5c] font-medium mb-1.5">
            Proyección del ciclo en curso
          </div>
          {/* Sin "~" delante de las cifras: pegado al número se lee como signo
              menos, y "~X.XXXg" parecía un valor negativo. */}
          <p className="text-[11px] text-[#8a8a9a] leading-relaxed">
            Ya cortaste <b className="text-[#d4d4dd]">{fmtG(eco.gramos)}g</b> y te quedan{' '}
            <b className="text-[#d4d4dd]">{plantasEnFlora} planta{plantasEnFlora === 1 ? '' : 's'} en floración</b>.{' '}
            Si rinden como las ya cosechadas (<b className="text-[#d4d4dd]">{fmtG(rinde)}g</b> promedio),
            el ciclo cierra cerca de <b className="text-[#bef264]">{fmtG(proyectado)}g</b> y el costo baja
            a <b className="text-[#bef264] text-[13px]">{fmt(costoProyectado)}/g</b> aproximadamente.
          </p>
          {enVegetativo > 0 && (
            <p className="text-[11px] text-[#7c8b5c] mt-1.5 leading-relaxed">
              No se cuentan {enVegetativo} planta{enVegetativo === 1 ? '' : 's'} en vegetativo: son del ciclo que viene.
            </p>
          )}
        </div>
      )}

      {/* Escenarios con los rindes REALES. Antes había tres precios redondos
          ($X.XXX, $X.XXX, $X.XXX) y cuántos gramos hacían falta para cada uno:
          números inventados que no decían nada del cultivo. Ahora cada escenario
          sale de la distribución de lo ya cosechado. */}
      {escenarios.length > 0 && (
        <div className="mt-3.5">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">
              Cómo puede cerrar el ciclo
            </span>
            <span className="text-[10px] text-[#8a8a9c]">según cómo rindan las {plantasEnFlora} que faltan</span>
          </div>
          {/* Los cuatro son la misma medida a distinto supuesto, así que el
              costo —lo que se compara— va a la misma altura en los cuatro:
              `flex-col` + `mt-auto` sobre el pie. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-stretch">
            {escenarios.map(e => (
              <div key={e.nombre}
                className={`rounded-lg px-2.5 py-2 border flex flex-col ${
                  e.destacado ? 'bg-[#a3e635]/10 border-[#404d20]' : 'bg-[#0d0d13] border-[#1f1f2b]'}`}>
                <div className={`text-[11px] font-medium ${e.destacado ? 'text-[#d9f99d]' : 'text-[#a6a6b5]'}`}>
                  {e.nombre}
                </div>
                <div className="text-[10px] text-[#8a8a9c] tabular-nums mt-0.5">{fmtG(e.rinde)}g por planta</div>
                <div className={`text-[17px] font-semibold tabular-nums leading-none mt-auto pt-1.5 ${
                  e.destacado ? 'text-[#bef264]' : 'text-[#d4d4dd]'}`}>
                  {fmt(e.costo)}<span className="text-[11px] font-normal text-[#8a8a9c] ml-px">/g</span>
                </div>
                <div className="text-[10px] text-[#8a8a9c] tabular-nums mt-1">{fmtG(e.total)}g el ciclo</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#8a8a9c] mt-2 leading-relaxed">
            Sale de tus {nCosechas} cosechas: la peor dio {fmtG(rindes[0] ?? 0)}g y la mejor{' '}
            {fmtG(rindes[rindes.length - 1] ?? 0)}g.
          </p>
        </div>
      )}

      {/* Cuánto hay que producir para bajar el costo a cada valor.
          Se habla de APORTE y no de precio a propósito: la ONG no vende, el
          aporte del paciente cubre el prorrateo de costos. Poner "precio" acá
          es usar el vocabulario que después te expone. */}
      <details className="mt-3 group">
        <summary className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium cursor-pointer hover:text-[#8a8a9a] list-none flex items-center gap-1">
          <span className="group-open:rotate-90 transition-transform inline-block">›</span>
          Cuánto producir para bajar el costo a…
        </summary>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {metas.map(m => (
            <div key={m.precio} className="rounded-lg bg-[#0d0d13] border border-[#1f1f2b] px-2 py-2 text-center">
              <div className="text-[11px] text-[#a6a6b5] tabular-nums">${fmtG(m.precio)}/g</div>
              <div className="text-[15px] font-semibold text-[#d9f99d] tabular-nums leading-tight mt-0.5">
                {fmtG(m.gramos)}g
              </div>
              <div className="text-[10px] text-[#8a8a9c] mt-0.5">por ciclo</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#8a8a9c] mt-2 leading-snug">
          Este es tu <b className="text-[#a6a6b5]">costo</b>, no un precio de lista. La asociación no vende: el aporte
          del paciente cubre el prorrateo de estos costos, y por encima del costo real deja de ser un aporte solidario.
          El registro de dispensas en <b className="text-[#a6a6b5]">O.N.G.</b> compara los dos números.
        </p>
      </details>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 2. Composición: a dónde va cada peso
// ---------------------------------------------------------------------------

export function ComposicionCosto({ eco }: { eco: ResumenEconomico }) {
  const partes = [
    { label: 'Gastos fijos', valor: eco.fijosMes, color: '#fbbf24' },
    { label: 'Amortización', valor: eco.amortizacionMes, color: '#a78bfa' },
    { label: 'Consumibles', valor: eco.consumiblesMes, color: '#34d399' },
    { label: 'Variables', valor: eco.variablesMes, color: '#ff8a7a' },
  ].filter(p => p.valor > 0).sort((a, b) => b.valor - a.valor)

  const total = partes.reduce((s, p) => s + p.valor, 0)
  if (total <= 0) return null

  return (
    <section className="rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 mb-3">
        <h2 className="font-display font-semibold text-[13px] text-[#ececf1]">A dónde va cada peso</h2>
        <span className="text-[11px] text-[#a6a6b5] tabular-nums">
          {fmt(total)}/mes · {fmt(total * eco.mesesCiclo)} por ciclo
        </span>
      </div>

      <div className="flex h-2.5 rounded-full overflow-hidden bg-[#15151d] mb-3">
        {partes.map(p => (
          <div key={p.label} style={{ width: `${pct(p.valor, total)}%`, background: p.color }}
            title={`${p.label}: ${fmt(p.valor)}`} />
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {partes.map(p => (
          <div key={p.label} className="rounded-lg bg-[#0d0d13] border border-[#1a1a24] px-2.5 py-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.color }} />
              <span className="text-[10px] text-[#8a8a9a] truncate">{p.label}</span>
            </div>
            <div className="mt-1 text-[14px] font-semibold text-[#ececf1] tabular-nums leading-none">
              {fmt(p.valor)}
            </div>
            <div className="text-[10px] text-[#8a8a9c] mt-0.5 tabular-nums">
              {pct(p.valor, total).toFixed(0)}% del total
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 3. Desglose: de dónde sale cada número, hasta el ítem
// ---------------------------------------------------------------------------

/** Bloque plegable. Cerrado por defecto para no llenar la pantalla del celular. */
function Bloque({ titulo, subtitulo, icono: Ico, color, total, sufijo, children, defaultOpen = false }: {
  titulo: string; subtitulo: string; icono: typeof Landmark; color: string
  total: number; sufijo?: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [abierto, setAbierto] = useState(defaultOpen)
  return (
    <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] overflow-hidden">
      <button onClick={() => setAbierto(a => !a)}
        className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left hover:bg-[#15151d] transition-colors"
        aria-expanded={abierto}>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
          <Ico className="w-4 h-4" style={{ color }} strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-semibold text-[12px] text-[#ececf1] truncate">{titulo}</span>
          <span className="block text-[10px] text-[#8a8a9c] truncate">{subtitulo}</span>
        </span>
        <span className="text-right flex-shrink-0">
          <span className="block text-[13px] font-semibold text-[#ececf1] tabular-nums leading-none">{fmt(total)}</span>
          <span className="block text-[10px] text-[#8a8a9c] mt-0.5">{sufijo ?? '/mes'}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-[#8a8a9c] flex-shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && <div className="border-t border-[#1f1f2b]">{children}</div>}
    </div>
  )
}

/** Fila de detalle: en celular se apila, en desktop va en línea. */
function Fila({ nombre, nota, valor, porMes, mesesCiclo }: {
  nombre: string; nota?: string; valor?: number; porMes: number; mesesCiclo: number
}) {
  return (
    <div className="px-4 py-2.5 border-b border-[#16161e] last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-[#d4d4dd] leading-snug">{nombre}</div>
          {nota && <div className="text-[10px] text-[#8a8a9c] mt-0.5">{nota}</div>}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[12px] text-[#ececf1] tabular-nums font-medium">{fmt(porMes)}<span className="text-[10px] text-[#8a8a9c]">/mes</span></div>
          <div className="text-[10px] text-[#8a8a9c] tabular-nums mt-0.5">
            {valor != null && valor !== porMes ? <>de {fmt(valor)} · </> : null}
            {fmt(porMes * mesesCiclo)} al ciclo
          </div>
        </div>
      </div>
    </div>
  )
}

function TotalBloque({ label, valor, mesesCiclo }: { label: string; valor: number; mesesCiclo: number }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#0d0d13]">
      <span className="text-[11px] text-[#8a8a9a] font-medium">{label}</span>
      <span className="text-right">
        <span className="block text-[12px] font-semibold text-[#ececf1] tabular-nums">{fmt(valor)}/mes</span>
        <span className="block text-[10px] text-[#8a8a9c] tabular-nums">{fmt(valor * mesesCiclo)} al ciclo</span>
      </span>
    </div>
  )
}

export function DesgloseCostos({ eco, vida }: { eco: ResumenEconomico; vida: VidaUtil }) {
  const m = eco.mesesCiclo
  return (
    <section className="space-y-2.5">
      <h2 className="font-display font-semibold text-[13px] text-[#ececf1] px-1">De dónde sale cada peso</h2>

      {/* Gastos fijos */}
      {eco.fijosMes > 0 && (
        <Bloque titulo="Gastos fijos" subtitulo="Se pagan produzcas o no" icono={Landmark}
          color="#fbbf24" total={eco.fijosMes}>
          {eco.costosFijos.map(c => (
            <Fila key={c.id} nombre={c.nombre} mesesCiclo={m}
              nota={[c.categoria, labelPeriodicidad(c.periodicidad), c.notas].filter(Boolean).join(' · ')}
              porMes={mensualEquivalente(c, m)} />
          ))}
          <TotalBloque label="Total fijos" valor={eco.fijosMes} mesesCiclo={m} />
        </Bloque>
      )}

      {/* Amortización, con detalle por ítem */}
      {eco.amortizacionMes > 0 && (
        <Bloque titulo="Amortización del equipo" subtitulo="Lo invertido, repartido en su vida útil"
          icono={Wrench} color="#a78bfa" total={eco.amortizacionMes}>
          <div className="px-4 py-2.5 bg-[#0d0d13] border-b border-[#1f1f2b] flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-[#8a8a9c] flex-shrink-0 mt-px" />
            <p className="text-[10px] text-[#7a7a8a] leading-relaxed">
              Lo que ya compraste no se cuenta de golpe: cada equipo aporta una fracción por mes
              mientras dure. Invertido: <b className="text-[#a6a6b5]">{fmt(eco.capexInvertido)}</b>.
            </p>
          </div>
          {eco.lineas.map(l => (
            <CategoriaAmortizada key={l.categoria} linea={l} vida={vida} mesesCiclo={m} />
          ))}
          <TotalBloque label="Total amortización" valor={eco.amortizacionMes} mesesCiclo={m} />
        </Bloque>
      )}

      {/* Consumibles */}
      {eco.consumiblesMes > 0 && (
        <Bloque titulo="Consumibles" subtitulo="Se gastan durante el ciclo" icono={FlaskConical}
          color="#34d399" total={eco.consumiblesMes}>
          <div className="px-4 py-2.5 bg-[#0d0d13] border-b border-[#1f1f2b]">
            <p className="text-[10px] text-[#7a7a8a] leading-relaxed">
              Fertilizantes, sustrato, sanidad y semillas del Stock, repartidos en los {m} meses del ciclo.
            </p>
          </div>
          {eco.consumibles.map(i => (
            <Fila key={i.id} nombre={i.nombre} valor={i.valor} porMes={i.porMes} mesesCiclo={m} />
          ))}
          <TotalBloque label="Total consumibles" valor={eco.consumiblesMes} mesesCiclo={m} />
        </Bloque>
      )}

      {/* Variables */}
      {eco.variablesMes > 0 && (
        <Bloque titulo="Costos variables" subtitulo="Cambian según cuánto produzcas" icono={Droplets}
          color="#ff8a7a" total={eco.variablesMes}>
          {eco.costosVariables.map(c => (
            <Fila key={c.id} nombre={c.nombre} mesesCiclo={m}
              nota={[c.categoria, labelPeriodicidad(c.periodicidad), c.notas].filter(Boolean).join(' · ')}
              porMes={mensualEquivalente(c, m)} />
          ))}
          <TotalBloque label="Total variables" valor={eco.variablesMes} mesesCiclo={m} />
        </Bloque>
      )}
    </section>
  )
}

/** Una categoría de equipo, desplegable hasta el ítem individual. */
function CategoriaAmortizada({ linea, vida, mesesCiclo }: {
  linea: ResumenEconomico['lineas'][number]; vida: VidaUtil; mesesCiclo: number
}) {
  const [abierto, setAbierto] = useState(false)
  const meses = vida[linea.categoria] ?? linea.meses
  return (
    <div className="border-b border-[#16161e] last:border-0">
      <button onClick={() => setAbierto(a => !a)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 min-h-[48px] text-left hover:bg-[#15151d] transition-colors">
        <ChevronDown className={`w-3.5 h-3.5 text-[#8a8a9c] flex-shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] text-[#d4d4dd] truncate">{linea.categoria}</span>
          <span className="block text-[10px] text-[#8a8a9c]">
            {fmt(linea.valor)} · {linea.items} ítem{linea.items === 1 ? '' : 's'} · dura {meses} meses
          </span>
        </span>
        <span className="text-right flex-shrink-0">
          <span className="block text-[12px] text-[#c4b5fd] font-medium tabular-nums">{fmt(linea.porMes)}<span className="text-[10px] text-[#8a8a9c]">/mes</span></span>
          <span className="block text-[10px] text-[#8a8a9c] tabular-nums mt-0.5">{fmt(linea.porMes * mesesCiclo)} al ciclo</span>
        </span>
      </button>
      {abierto && (
        <div className="bg-[#0b0b10]">
          {linea.detalle.map((i: ItemAmortizado) => (
            <div key={i.id} className="flex items-start justify-between gap-3 pl-11 pr-4 py-2 border-t border-[#141420]">
              <span className="text-[11px] text-[#a6a6b5] min-w-0 flex-1 leading-snug">{i.nombre}</span>
              <span className="text-right flex-shrink-0">
                <span className="block text-[11px] text-[#c4b5fd] tabular-nums">{fmt(i.porMes)}/mes</span>
                <span className="block text-[10px] text-[#8a8a9c] tabular-nums">de {fmt(i.valor)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. Indicadores de gestión
// ---------------------------------------------------------------------------

export function Indicadores({ eco, plantasActivas }: { eco: ResumenEconomico; plantasActivas: number }) {
  const porDia = eco.totalMes / 30.44
  const porPlanta = plantasActivas > 0 ? eco.totalCiclo / plantasActivas : null
  const items = [
    { label: 'Por día', valor: fmt(porDia), nota: 'lo que corre el reloj' },
    { label: 'Por planta', valor: porPlanta != null ? fmt(porPlanta) : '—', nota: `${plantasActivas} activas · ciclo completo` },
    { label: 'Por ciclo', valor: fmt(eco.totalCiclo), nota: `${eco.mesesCiclo} meses` },
    { label: 'Invertido en equipo', valor: fmt(eco.capexInvertido), nota: `amortiza ${fmt(eco.amortizacionMes)}/mes` },
  ]
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {items.map(i => (
        <div key={i.label} className="rounded-xl bg-[#101016] border border-[#1f1f2b] px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">{i.label}</div>
          <div className="mt-1 text-[16px] sm:text-[17px] font-semibold text-[#ececf1] tabular-nums leading-none">{i.valor}</div>
          <div className="text-[10px] text-[#8a8a9c] mt-1 leading-snug">{i.nota}</div>
        </div>
      ))}
    </section>
  )
}
