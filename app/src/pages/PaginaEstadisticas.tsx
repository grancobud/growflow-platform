// Estadísticas — la asociación: la gente, la plata y las entregas.
//
// Hasta el 23/08/2026 esta pantalla analizaba el cultivo (rinde por genética,
// gramos por vatio). Eso se mudó a Cosecha → «Rendimiento», que es donde están
// los datos que mira. Acá quedó lo institucional, que no tenía dónde verse: en
// qué se va la plata, de dónde viene, cuánta gente hay y si crece o se achica.
//
// CÓMO ESTÁ ORDENADA
// De arriba abajo va de lo general a lo particular: primero los seis números
// que se miran todos los días, después la evolución mes a mes, después el
// detalle de cada cosa. Quien entra treinta segundos se lleva los seis de
// arriba; quien viene a entender algo baja.
//
// LO QUE NO HACE
// No inventa proyecciones ni promedios móviles. Con trece meses de historia,
// una tendencia dibujada es una opinión disfrazada de dato.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  BarChart3, RefreshCw, Users, TrendingUp, TrendingDown, Wallet, Package,
  AlertTriangle, ShieldCheck, CalendarDays, HandCoins, ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ongService, type AsientoCaja, type Dispensa, type Asociado } from '../lib/ong'
import { registroService, type Paciente } from '../lib/registro'
import {
  serieMensual, porRubro, repartoPor, concentracion, porDiaDeSemana,
  resumenPersonas, topProductos, personasQueVuelven, mandatosFirmados, ultimos, dividir,
  type MesOng,
} from '../lib/estadisticasOng'
import {
  Panel, Kpi, Variacion, BarrasPares, BarrasSimples, AreaAcumulada, BarrasHorizontales,
  Dona, CurvaConcentracion, Barritas, BarraPartida,
} from '../components/estadisticas/Graficos'
import { fmtPesos, fmtCorto, fmtNum, fmtPct, VERDE, CORAL, LILA, AMBAR } from '../lib/formatoGrafico'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const rotuloMes = (clave: string) => {
  const [a, m] = clave.split('-').map(Number)
  return `${MESES[m - 1]} ${String(a).slice(2)}`
}
const hoyISO = () => new Date().toISOString().slice(0, 10)

/** Cuántos meses se miran. «Todo» es el default: 13 meses entran holgados. */
const VENTANAS = [
  { id: 6, label: '6 meses' },
  { id: 12, label: '12 meses' },
  { id: 0, label: 'Todo' },
] as const

export default function PaginaEstadisticas() {
  const [caja, setCaja] = useState<AsientoCaja[]>([])
  const [dispensas, setDispensas] = useState<Dispensa[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [asociados, setAsociados] = useState<Asociado[]>([])
  const [cargando, setCargando] = useState(true)
  const [ventana, setVentana] = useState<number>(0)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [c, d, p, a] = await Promise.all([
        ongService.getCaja(),
        ongService.getDispensas(),
        registroService.getPacientes(),
        ongService.getAsociados(),
      ])
      setCaja(c); setDispensas(d); setPacientes(p); setAsociados(a)
    } catch (e) {
      toast.error(`No se pudieron leer los datos: ${(e as Error).message}`)
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const serieCompleta = useMemo(
    () => serieMensual(caja, dispensas, pacientes), [caja, dispensas, pacientes])
  const serie = useMemo(
    () => (ventana > 0 ? serieCompleta.slice(-ventana) : serieCompleta), [serieCompleta, ventana])

  // El recorte de meses vale para los gráficos de evolución, pero los rubros y
  // los repartos tienen que mirar lo mismo: si no, la torta dice una cosa y las
  // barras de al lado otra, y las dos parecen del mismo período.
  const desde = serie.length ? serie[0].clave : ''
  const cajaVentana = useMemo(() => caja.filter(c => c.fecha.slice(0, 7) >= desde), [caja, desde])
  const dispVentana = useMemo(() => dispensas.filter(d => d.fecha.slice(0, 7) >= desde), [dispensas, desde])

  const total = useMemo(() => ultimos(serie, serie.length), [serie])
  const mesActual = serie[serie.length - 1] as MesOng | undefined
  const mesAnterior = serie[serie.length - 2] as MesOng | undefined

  const ingresos = useMemo(() => porRubro(cajaVentana, 'ingreso'), [cajaVentana])
  const egresos = useMemo(() => porRubro(cajaVentana, 'egreso'), [cajaVentana])
  const conc = useMemo(() => concentracion(dispVentana), [dispVentana])
  const personas = useMemo(() => resumenPersonas(pacientes, hoyISO()), [pacientes])
  const vuelven = useMemo(() => personasQueVuelven(dispensas, hoyISO()), [dispensas])
  const mandatos = useMemo(() => mandatosFirmados(asociados), [asociados])
  const productos = useMemo(() => topProductos(dispVentana, 8), [dispVentana])
  const medios = useMemo(() => repartoPor(cajaVentana, c => c.medio), [cajaVentana])
  const modalidades = useMemo(() => repartoPor(dispVentana, d => d.modalidad), [dispVentana])
  const semana = useMemo(() => porDiaDeSemana(dispVentana), [dispVentana])

  const aportePorGramo = dividir(total.aporte, total.gramos)

  const hayDatos = serieCompleta.length > 0

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden ct-page-scroll bg-[#0a0a0f] text-[#d4d4dd] font-sans">
      <div className="sticky top-0 z-40 bg-[#0a0a0f] border-b border-[#1f1f2b]">
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3">
          <div className="min-w-0">
            <h1 className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] text-[#ececf1]">Estadísticas</h1>
            <div className="mt-0.5 text-[10px] sm:text-[11px] text-[#8a8a9c] truncate">
              La asociación: la gente, la plata y las entregas
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1 rounded-lg border border-[#2a2a3a] bg-[#15151d] p-0.5">
            {VENTANAS.map(v => (
              <button key={v.id} onClick={() => setVentana(v.id)}
                className={`px-2.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-md text-[11px] transition-colors whitespace-nowrap ${
                  ventana === v.id ? 'bg-[#a3e635]/15 text-[#d9f99d]' : 'text-[#8a8a9c] hover:text-[#d4d4dd]'}`}>
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={cargar} title="Refrescar" aria-label="Refrescar"
            className="p-2.5 sm:p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:bg-[#1c1c27] transition-colors text-[#a6a6b5]">
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-3 sm:px-6 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] space-y-3 sm:space-y-4 max-w-6xl mx-auto">

        {!hayDatos && !cargando && (
          <section className="rounded-xl bg-[#101016] border border-[#1f1f2b] p-8 text-center">
            <BarChart3 className="w-8 h-8 mx-auto text-[#4a4a58]" strokeWidth={1.5} />
            <h2 className="font-display font-semibold text-[15px] text-[#ececf1] mt-3">Todavía no hay nada que medir</h2>
            <p className="text-[12px] text-[#8a8a9c] mt-1.5 max-w-md mx-auto leading-relaxed">
              Estas cuentas salen del libro de caja, de las entregas y del padrón. En cuanto cargues
              el primer movimiento, acá vas a ver la evolución mes a mes.
            </p>
            <Link to="/ong/economia" className="inline-flex items-center gap-1.5 mt-4 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 text-[12px] text-[#d9f99d]">
              Ir al libro de caja <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </section>
        )}

        {hayDatos && <>
          {/* ── Los seis números de todos los días ───────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3">
            <Kpi etiqueta="Personas" valor={fmtNum(personas.vinculadas)}
              icono={<Users className="w-3 h-3" />} color={LILA}
              pie={<>{personas.activas} activas · {mesActual ? `+${mesActual.altas} este mes` : ''}</>} />
            <Kpi etiqueta="Retiraron (90 días)" valor={fmtNum(vuelven.recientes)}
              icono={<HandCoins className="w-3 h-3" />}
              pie={<>{vuelven.vuelven} ya venían · {vuelven.nuevas} nuevas</>} />
            <Kpi etiqueta={`Entró (${total.meses} m)`} valor={fmtCorto(total.ingresos)}
              icono={<TrendingUp className="w-3 h-3" />} color={VERDE}
              pie={mesActual && mesAnterior
                ? <>último mes <Variacion v={mesAnterior.ingresos > 0 ? (mesActual.ingresos - mesAnterior.ingresos) / mesAnterior.ingresos : null} /></>
                : undefined} />
            <Kpi etiqueta={`Salió (${total.meses} m)`} valor={fmtCorto(total.egresos)}
              icono={<TrendingDown className="w-3 h-3" />} color={CORAL}
              pie={mesActual && mesAnterior
                ? <>último mes <Variacion invertido v={mesAnterior.egresos > 0 ? (mesActual.egresos - mesAnterior.egresos) / mesAnterior.egresos : null} /></>
                : undefined} />
            <Kpi etiqueta="Resultado" valor={fmtCorto(total.resultado)}
              icono={<Wallet className="w-3 h-3" />} color={total.resultado >= 0 ? VERDE : CORAL}
              pie={<>{fmtPct(dividir(total.resultado, total.ingresos))} de lo que entró</>} />
            <Kpi etiqueta="Entregado" valor={`${fmtNum(total.gramos)} g`}
              icono={<Package className="w-3 h-3" />} color={AMBAR}
              pie={<>{fmtNum(total.entregas)} entregas · {aportePorGramo != null ? `${fmtPesos(aportePorGramo)}/g` : '—'}</>} />
          </div>

          {/* ── La plata ─────────────────────────────────────────────────── */}
          <Panel titulo="La plata, mes a mes"
            ayuda="Lo que entró contra lo que salió. Dos barras por mes y no una pila: lo que importa es cuál de las dos es más alta.">
            <BarrasPares rotuloA="Entró" rotuloB="Salió"
              datos={serie.map(m => ({ clave: m.clave, etiqueta: rotuloMes(m.clave), a: m.ingresos, b: m.egresos }))} />
          </Panel>

          <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
            <Panel titulo="Lo que queda acumulado"
              ayuda="La suma de todos los resultados. Si la curva baja, ese mes se gastó más de lo que entró.">
              <AreaAcumulada color={total.resultado >= 0 ? LILA : CORAL}
                datos={serie.map(m => ({ clave: m.clave, etiqueta: rotuloMes(m.clave), v: m.saldo }))} />
            </Panel>

            <Panel titulo="El resultado de cada mes"
              ayuda="Ingresos menos egresos, sin arrastrar nada del mes anterior.">
              <AreaAcumulada color={VERDE}
                datos={serie.map(m => ({ clave: m.clave, etiqueta: rotuloMes(m.clave), v: m.resultado }))} />
            </Panel>
          </div>

          <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
            <Panel titulo="De dónde viene"
              ayuda="Los conceptos se agrupan por rubro: las entregas van juntas en vez de figurar una por persona."
              extra={<span className="text-[11px] text-[#8a8a9c] tabular-nums">{fmtPesos(total.ingresos)}</span>}>
              <BarrasHorizontales datos={ingresos.map(r => ({ etiqueta: r.etiqueta, valor: r.total, nota: `${r.n}×` }))} color={VERDE} />
            </Panel>

            <Panel titulo="En qué se va"
              ayuda="Lo mismo del otro lado. Es la lista que hay que poder defender ante quien pregunte."
              extra={<span className="text-[11px] text-[#8a8a9c] tabular-nums">{fmtPesos(total.egresos)}</span>}>
              <BarrasHorizontales datos={egresos.map(r => ({ etiqueta: r.etiqueta, valor: r.total, nota: `${r.n}×` }))} color={CORAL} />
            </Panel>
          </div>

          {/* ── La gente ─────────────────────────────────────────────────── */}
          <Panel titulo="La gente, mes a mes"
            ayuda="Cuántas personas se sumaron y cuántas retiraron material. Las dos son personas, así que comparten escala.">
            <BarrasPares rotuloA="Se sumaron" rotuloB="Retiraron" colorA={LILA} colorB={VERDE} formato={fmtNum}
              datos={serie.map(m => ({ clave: m.clave, etiqueta: rotuloMes(m.clave), a: m.altas, b: m.personas }))} />
          </Panel>

          <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
            <Panel titulo="Cómo creció el padrón"
              ayuda="El acumulado de personas vinculadas. Una meseta significa que dejaron de entrar.">
              <AreaAcumulada color={LILA} formato={fmtNum}
                datos={serie.map(m => ({ clave: m.clave, etiqueta: rotuloMes(m.clave), v: m.acumuladas }))} />
            </Panel>

            <Panel titulo="De cuánta gente depende"
              ayuda="Cada punto es una persona más, de la que más aporta a la que menos. La diagonal sería el reparto perfectamente parejo."
              extra={conc.parteTop10 != null
                ? <span className="text-[11px] text-[#fbbf24] tabular-nums">top 10 = {fmtPct(conc.parteTop10)}</span>
                : undefined}>
              <CurvaConcentracion curva={conc.curva} />
              {conc.parteTop10 != null && (
                <p className="text-[11px] text-[#a6a6b5] mt-2 leading-relaxed">
                  Diez personas de {conc.personas} explican el <b className="text-[#fbbf24]">{fmtPct(conc.parteTop10)}</b> del
                  aporte. Cuanto más alto ese número, más se siente en la caja que se vaya una sola.
                </p>
              )}
            </Panel>
          </div>

          {/* ── Las entregas ─────────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
            <Panel titulo="Cuánto material salió"
              ayuda="Gramos entregados por mes, de cualquier producto.">
              <BarrasSimples color={AMBAR} rotulo="gramos" formato={n => `${fmtNum(n)} g`}
                datos={serie.map(m => ({ clave: m.clave, etiqueta: rotuloMes(m.clave), v: m.gramos }))} />
            </Panel>

            <Panel titulo="Reembolso por gramo"
              ayuda="El aporte del mes dividido por los gramos del mes. Si sube mucho, deja de parecerse a un reembolso de costos.">
              <AreaAcumulada color={CORAL} formato={n => `${fmtPesos(n)}/g`}
                datos={serie.map(m => ({
                  clave: m.clave, etiqueta: rotuloMes(m.clave), v: dividir(m.aporte, m.gramos) ?? 0,
                }))} />
            </Panel>
          </div>

          <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
            <Panel titulo="Qué se entrega"
              ayuda="Los ocho productos que más gramos movieron en el período."
              extra={<span className="text-[11px] text-[#8a8a9c] tabular-nums">{fmtNum(total.gramos)} g</span>}>
              <BarrasHorizontales color={AMBAR} formato={n => `${fmtNum(n)} g`}
                datos={productos.map(p => ({ etiqueta: p.producto, valor: p.gramos, nota: `${p.n}×` }))} />
            </Panel>

            <div className="space-y-3 sm:space-y-4">
              <Panel titulo="Por qué medio se mueve la plata"
                ayuda="De acá sale la conciliación con el banco: lo que no es efectivo tiene que tener respaldo.">
                <Dona datos={medios} total={cajaVentana.length} unidad="movimientos" />
              </Panel>

              <Panel titulo="Para qué sale el material"
                ayuda="Lo que va a una persona, lo que se consume adentro y lo que se pierde.">
                <BarraPartida partes={modalidades.slice(0, 5)} />
              </Panel>
            </div>
          </div>

          {/* ── El estado del padrón ─────────────────────────────────────── */}
          <div className="grid lg:grid-cols-3 gap-3 sm:gap-4">
            <Panel titulo="REPROCANN" className="lg:col-span-2"
              ayuda="Sin registro vigente, la entrega no está amparada. Los que vencen dentro de 60 días todavía llegan a renovar.">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Cifra n={personas.reprocannVigente} t="Vigentes" color={VERDE} icono={<ShieldCheck className="w-3 h-3" />} />
                <Cifra n={personas.reprocannPorVencer} t="Vencen en 60 días" color={AMBAR} icono={<CalendarDays className="w-3 h-3" />} />
                <Cifra n={personas.reprocannVencido} t="Vencidos" color={CORAL} icono={<AlertTriangle className="w-3 h-3" />} />
                <Cifra n={personas.reprocannSinRegistro} t="Sin registro" color="#8a8a9c" />
              </div>
              <div className="mt-3 pt-3 border-t border-[#1f1f2b]">
                <div className="flex items-baseline gap-2 text-[11px]">
                  <span className="text-[#a6a6b5]">Mandato de gestión firmado</span>
                  <span className="ml-auto text-[#ececf1] tabular-nums">{mandatos.con} de {mandatos.total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#15151d] mt-1.5 overflow-hidden">
                  <div className="h-full rounded-full bg-[#a3e635]"
                    style={{ width: `${(mandatos.total > 0 ? mandatos.con / mandatos.total : 0) * 100}%` }} />
                </div>
                <p className="text-[11px] text-[#8a8a9c] mt-1.5 leading-relaxed">
                  Es el papel que sostiene que la entrega no es una compraventa.
                </p>
              </div>
            </Panel>

            <Panel titulo="El ritmo de la semana"
              ayuda="En qué días se entrega. Sirve para saber cuándo hace falta gente en la sede.">
              <Barritas datos={semana} />
            </Panel>
          </div>

        </>}

        {cargando && !hayDatos && (
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-[74px] rounded-xl bg-[#101016] border border-[#1f1f2b] animate-pulse" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Cifra({ n, t, color, icono }: { n: number; t: string; color: string; icono?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[#15151d] border border-[#1f1f2b] p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">
        {icono}<span className="truncate">{t}</span>
      </div>
      <div className="font-display font-bold text-[18px] leading-none mt-1 tabular-nums" style={{ color }}>{n}</div>
    </div>
  )
}
