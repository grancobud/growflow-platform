// Movimientos de caja: lo que entró y lo que salió, por período.
//
// La base tenía 1.690 asientos en `ong_caja` y NINGUNA pantalla que los
// mostrara: la tabla sólo se escribía —el portal asienta al entregar— y no se
// leía en ningún lado. La plata estaba guardada y era invisible.
//
// El diseño sale de la hoja FINANZAS de la planilla, que es donde la asociación mira
// esto hoy: entradas y salidas por medio, el neto, y el movimiento del día con
// un filtro por fechas. Los números de esa hoja y los de la base ya se
// contrastaron y dan igual — 165.000 de neto en efectivo y 422.500 en
// transferencia, exacto.

import { useState, useMemo } from 'react'
import { tarjeta, btnSutil } from '../../lib/ui'
import { Wallet, ArrowDownLeft, ArrowUpRight, Package, HandCoins, Tags } from 'lucide-react'
import {
  resumenCaja, enRango, sufijoUnidad, retirosPorSocio, aportePromedio,
  movimientosPorCategoria,
  type AsientoCaja, type Dispensa, type DocumentoONG, type CategoriaCaja,
} from '../../lib/ong'

const inputCls = 'px-2 py-1 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[12px] text-[#ececf1] focus:outline-none focus:border-[#38bdf8]/60 min-h-[44px] sm:min-h-0'
// El signo va ANTES del peso: `$-592.821` se lee como un precio raro y no como
// una deuda. Es el mismo menos —U+2212, no un guion— que usa el libro de caja.
const pesos = (n: number) => {
  const r = Math.round(n)
  return `${r < 0 ? '−$' : '$'}${Math.abs(r).toLocaleString('es-AR')}`
}
const hoyStr = () => new Date().toLocaleDateString('en-CA')
/** «2026-08-24» → «24/08/2026». El ISO no se lee en una frase. */
const fechaLarga = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('es-AR',
    { day: '2-digit', month: '2-digit', year: 'numeric' })

/** Rangos de uso diario. El de la planilla es "hoy"; los otros son los que se piden después. */
const ATAJOS: { id: string; label: string; desde: () => string }[] = [
  { id: 'hoy', label: 'Hoy', desde: hoyStr },
  { id: '7', label: '7 días', desde: () => corrido(7) },
  { id: '30', label: '30 días', desde: () => corrido(30) },
  { id: 'todo', label: 'Todo', desde: () => '' },
]

function corrido(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() - dias + 1)
  return d.toLocaleDateString('en-CA')
}

export function Movimientos({ caja, dispensas, documentos = [] }: {
  caja: AsientoCaja[]
  dispensas: Dispensa[]
  /** Sólo para los retiros por socio: la retribución vive en documentos. */
  documentos?: DocumentoONG[]
}) {
  const [desde, setDesde] = useState(hoyStr)
  const [hasta, setHasta] = useState(hoyStr)

  /** El día del asiento más reciente. Es lo que el vacío ofrece como destino. */
  const ultimoDia = useMemo(
    () => caja.reduce<string | null>((max, a) => (!max || a.fecha > max ? a.fecha : max), null),
    [caja])

  const delRango = useMemo(() => enRango(caja, desde, hasta), [caja, desde, hasta])
  const r = useMemo(() => resumenCaja(delRango), [delRango])
  // El saldo acumulado NO depende del filtro: es lo que hay en la caja hoy,
  // independientemente del período que se esté mirando.
  const acumulado = useMemo(() => resumenCaja(caja), [caja])

  const dispRango = useMemo(() => enRango(dispensas, desde, hasta), [dispensas, desde, hasta])
  // Sólo suma gramos lo que se mide en gramos: los frascos de aceite y los
  // accesorios se cuentan aparte, igual que en el balance de materia.
  const gramos = useMemo(
    () => dispRango.filter(d => sufijoUnidad(d.unidad) === 'g')
      .reduce((s, d) => s + (Number(d.gramos) || 0), 0), [dispRango])
  const otrasUnidades = useMemo(
    () => dispRango.filter(d => sufijoUnidad(d.unidad) !== 'g').length, [dispRango])
  const aporte = useMemo(
    () => dispRango.reduce((s, d) => s + (Number(d.aporte) || 0), 0), [dispRango])
  // El promedio va sobre las entregas que EFECTIVAMENTE aportaron. El
  // indicador de la planilla divide por todas, incluyendo consumo interno y
  // merma, y por eso le da ~29% menos de lo que realmente se aporta.
  const prom = useMemo(() => aportePromedio(dispRango), [dispRango])
  // Los retiros NO se filtran por período: la pregunta es cuánto retiró cada
  // socio en total, que es como la mira la planilla.
  const retiros = useMemo(() => retirosPorSocio(documentos), [documentos])
  const retirado = useMemo(
    () => retiros.reduce((s, r) => s + r.total, 0), [retiros])
  // Esto SI respeta el filtro: la pregunta es en qué se fue la plata del período.
  const porCat = useMemo(() => movimientosPorCategoria(delRango), [delRango])

  const aplicar = (id: string) => {
    const a = ATAJOS.find(x => x.id === id)
    if (!a) return
    setDesde(a.desde())
    setHasta(id === 'todo' ? '' : hoyStr())
  }

  const activo = ATAJOS.find(a =>
    a.desde() === desde && (a.id === 'todo' ? hasta === '' : hasta === hoyStr()))?.id

  return (
    <div className="space-y-3">
      <div className={tarjeta}>
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Movimientos</h3>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mb-3">
          Lo que entró y lo que salió en el período. El saldo de abajo es lo que
          hay hoy y no depende del filtro.
        </p>

        <div className="flex items-end gap-2 flex-wrap">
          {ATAJOS.map(a => (
            <button key={a.id} onClick={() => aplicar(a.id)}
              className={`px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border text-[12px] transition-colors ${
                activo === a.id
                  ? 'border-[#38bdf8]/50 bg-[#38bdf8]/10 text-[#7dd3fc]'
                  : 'border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5] hover:text-[#ececf1]'}`}>
              {a.label}
            </button>
          ))}
          {/* Las dos fechas van JUNTAS, en su propia caja.
              Sueltas dentro del `flex-wrap`, a 375 px los cuatro atajos se
              comen el renglón, «Desde» baja solo y su `ml-auto` lo tira contra
              el borde derecho, y «Hasta» baja al renglón siguiente pegado a la
              izquierda: dos campos del mismo par, escalonados en diagonal.
              Agrupados ocupan medio ancho cada uno y quedan al lado. El
              `ml-auto` sobrevive sólo de `sm:` para arriba, que es donde
              entran todos en una línea y tiene sentido empujarlos a la
              derecha. */}
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <label className="flex-1 sm:flex-none">
              <span className="block text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-1">Desde</span>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className={`${inputCls} w-full`} />
            </label>
            <label className="flex-1 sm:flex-none">
              <span className="block text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-1">Hasta</span>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className={`${inputCls} w-full`} />
            </label>
          </div>
        </div>
      </div>

      {r.asientos === 0 ? (
        // EL VACÍO TIENE QUE DECIR ADÓNDE IR.
        //
        // La pantalla abre en «Hoy» a propósito: es el control diario. Pero un
        // día sin movimientos —que son la mayoría— dejaba a quien entra a ver
        // la caja frente a la nada y un consejo genérico: «probá con un rango
        // más ancho», sin decir cuál. En la asociación, entrar un martes cualquiera
        // significaba tener que adivinar.
        //
        // Ahora dice cuándo fue el último movimiento y lleva ahí de un toque.
        <div className={`${tarjeta} text-center py-8`}>
          <p className="text-[12px] text-[#8a8a9c]">
            {ultimoDia
              ? `Sin movimientos hoy. El último fue el ${fechaLarga(ultimoDia)}.`
              : 'No hay ningún movimiento cargado todavía.'}
          </p>
          {ultimoDia && (
            <button onClick={() => { setDesde(ultimoDia); setHasta(ultimoDia) }}
              className={`${btnSutil} mt-3`}>
              Ver ese día
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Bloque titulo="Entró" icono={<ArrowDownLeft className="w-4 h-4" />} color="#a3e635"
            total={r.entradas.total} d={r.entradas} />
          <Bloque titulo="Salió" icono={<ArrowUpRight className="w-4 h-4" />} color="#ff8a7a"
            total={r.salidas.total} d={r.salidas} />
        </div>
      )}

      {r.asientos > 0 && (
        <div className={tarjeta}>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <span className="text-[12px] text-[#a6a6b5]">
              Resultado del período · {r.asientos} asiento{r.asientos === 1 ? '' : 's'}
            </span>
            <span className="text-[16px] font-semibold tabular-nums"
              style={{ color: r.neto >= 0 ? '#a3e635' : '#ff8a7a' }}>
              {r.neto >= 0 ? '+' : '−'}{pesos(Math.abs(r.neto))}
            </span>
          </div>
        </div>
      )}

      <div className={tarjeta}>
        <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-2">
          Saldo acumulado · todo el historial
        </div>
        {/* «Sin discriminar» aparece cuando hay, y con eso las tarjetas vuelven
            a sumar el neto total.
            Las dos de arriba solas escondían 92 asientos por $17,7M en la asociación
            —59 «Mixto», 32 sin medio y un «Tranferencia» mal escrito— debajo de
            un texto que decía que eso era el arqueo. Un arqueo al que le falta
            plata y no lo dice es peor que no tenerlo. */}
        {/* Tres columnas NO entran a 375 px: medido, quedan 103 px por tarjeta y
            los rótulos se parten en dos líneas. En el teléfono van dos arriba y
            «Sin discriminar» ancha abajo, que además es la que necesita el
            renglón de explicación al lado. */}
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
          <Caja t="Efectivo" v={pesos(acumulado.netoEfectivo)}
            c={acumulado.netoEfectivo >= 0 ? '#a3e635' : '#ff8a7a'} />
          <Caja t="Transferencia" v={pesos(acumulado.netoTransferencia)}
            c={acumulado.netoTransferencia >= 0 ? '#a3e635' : '#ff8a7a'} />
          {acumulado.netoOtros !== 0 && (
            <div className="col-span-2 sm:col-span-1">
              <Caja t="Sin discriminar" v={pesos(acumulado.netoOtros)} c="#fbbf24" />
            </div>
          )}
        </div>
        {/* EL TOTAL, ESCRITO.
            Tres números que hay que sumar de memoria —y uno de ellos negativo—
            no son un saldo. En la asociación da $XX.XXX + $XXX.XXX − $XXX.XXX: quien
            mira las dos primeras se lleva $XXX.XXX cuando lo que hay es
            $XX.XXX, treinta veces menos. El total va escrito para que nadie
            tenga que hacer esa cuenta. */}
        {acumulado.netoOtros !== 0 && (
          <div className="flex items-baseline justify-between gap-3 mt-2 pt-2 border-t border-[#1f1f2b]">
            <span className="text-[12px] text-[#a6a6b5]">Saldo total</span>
            <span className="text-[16px] font-semibold tabular-nums"
              style={{ color: acumulado.neto >= 0 ? '#ececf1' : '#ff8a7a' }}>
              {pesos(acumulado.neto)}
            </span>
          </div>
        )}
        <p className="text-[10px] text-[#8a8a9c] mt-2">
          Es lo que tenés que poder mostrar si te piden arqueo: entradas menos
          salidas, sobre {acumulado.asientos} asientos.
          {acumulado.netoOtros !== 0 && ' «Sin discriminar» son los asientos sin medio de pago '
            + 'o con uno que no es efectivo ni transferencia: no se sabe en cuál de las dos está esa plata, '
            + 'así que no se puede contar ni en la caja ni en el banco.'}
        </p>
      </div>

      {dispRango.length > 0 && (
        <div className={tarjeta}>
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-[#a78bfa]" strokeWidth={1.8} />
            <span className="text-[12px] font-medium text-[#ececf1]">Entregas del período</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Caja t="Entregas" v={String(dispRango.length)} c="#a78bfa" />
            <Caja t="Gramos" v={`${Math.round(gramos).toLocaleString('es-AR')} g`} c="#a78bfa" />
            <Caja t="Aporte" v={pesos(aporte)} c="#a78bfa" />
          </div>
          {otrasUnidades > 0 && (
            <p className="text-[10px] text-[#8a8a9c] mt-2">
              {otrasUnidades} entrega{otrasUnidades === 1 ? '' : 's'} fuera del total en
              gramos (aceite, accesorios): no se miden en gramos.
            </p>
          )}
          {prom.porEntrega != null && (
            <p className="text-[10px] text-[#8a8a9c] mt-2">
              Promedio {pesos(prom.porEntrega)} por entrega, sobre las {prom.conAporte} que
              aportaron{prom.sinAporte > 0 && `; las otras ${prom.sinAporte} son consumo interno, merma o saldo inicial y no aportan`}.
            </p>
          )}
        </div>
      )}

      {(porCat.entradas.length > 0 || porCat.salidas.length > 0) && (
        <div className={tarjeta}>
          <div className="flex items-center gap-2 mb-1">
            <Tags className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
            <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
              De qué entró y en qué se fue
            </h3>
          </div>
          <p className="text-[11px] text-[#8a8a9c] mb-3">
            Del período elegido. En las salidas es la categoría del gasto; en las
            entradas, la variedad que se entregó — así lo lleva el libro diario.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Ranking titulo="Entró" filas={porCat.entradas} color="#a3e635" />
            <Ranking titulo="Salió" filas={porCat.salidas} color="#ff8a7a" />
          </div>
        </div>
      )}

      {retiros.length > 0 && (
        <div className={tarjeta}>
          <div className="flex items-center gap-2 mb-1">
            <HandCoins className="w-4 h-4 text-[#fbbf24]" strokeWidth={1.8} />
            <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
              Retiros por socio
            </h3>
          </div>
          <p className="text-[11px] text-[#8a8a9c] mb-3">
            Retribución cobrada por cada socio, sobre todo el historial —
            {' '}{pesos(retirado)} en total. No depende del filtro de arriba.
          </p>
          <div className="space-y-2">
            {retiros.map(r => {
              const pct = retirado > 0 ? (r.total / retirado) * 100 : 0
              return (
                <div key={r.socio}>
                  <div className="flex items-baseline gap-2 text-[12px]">
                    <span className="text-[#ececf1] truncate min-w-0 flex-1">{r.socio}</span>
                    <span className="text-[10px] text-[#8a8a9c] shrink-0">
                      {r.pagos} pago{r.pagos === 1 ? '' : 's'}
                    </span>
                    <span className="tabular-nums text-[#d4d4dd] shrink-0 w-[104px] text-right">
                      {pesos(r.total)}
                    </span>
                    <span className="tabular-nums text-[10px] text-[#8a8a9c] shrink-0 w-[42px] text-right">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-[#1f1f2b] overflow-hidden">
                    <div className="h-full rounded-full bg-[#fbbf24]" style={{ width: `${pct}%` }} />
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

function Bloque({ titulo, icono, color, total, d }: {
  titulo: string; icono: React.ReactNode; color: string; total: number
  d: { efectivo: number; transferencia: number; otros: number }
}) {
  return (
    <div className={tarjeta}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color }}>
        {icono}
        <span className="text-[12px] font-medium">{titulo}</span>
        <span className="ml-auto text-[15px] font-semibold tabular-nums">{pesos(total)}</span>
      </div>
      <div className="space-y-1 text-[11px]">
        <Fila l="Efectivo" v={pesos(d.efectivo)} />
        <Fila l="Transferencia" v={pesos(d.transferencia)} />
        {/* `otros` sólo aparece si hay: la planilla contempla dos medios, pero en
            los pagos ya salió una "Nota de Crédito" y un total que no suma sus
            partes confunde más que una fila de más. */}
        {d.otros !== 0 && <Fila l="Otros medios" v={pesos(d.otros)} />}
      </div>
    </div>
  )
}

/** Top 6 y el resto agrupado: una lista de 25 categorías no se lee en un teléfono. */
function Ranking({ titulo, filas, color }: {
  titulo: string; filas: CategoriaCaja[]; color: string
}) {
  if (filas.length === 0) return null
  const TOPE = 6
  const top = filas.slice(0, TOPE)
  const resto = filas.slice(TOPE)
  const restoMonto = resto.reduce((s, x) => s + x.monto, 0)
  const total = filas.reduce((s, x) => s + x.monto, 0)
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] mb-2" style={{ color }}>
        {titulo} · {pesos(total)}
      </div>
      <div className="space-y-1.5">
        {top.map(x => {
          const pct = total > 0 ? (x.monto / total) * 100 : 0
          return (
            <div key={x.categoria}>
              <div className="flex items-baseline gap-2 text-[11px]">
                <span className="text-[#d4d4dd] truncate min-w-0 flex-1">{x.categoria}</span>
                <span className="text-[10px] text-[#8a8a9c] shrink-0">{x.asientos}</span>
                <span className="tabular-nums text-[#d4d4dd] shrink-0">{pesos(x.monto)}</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-[#1f1f2b] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          )
        })}
        {resto.length > 0 && (
          <div className="flex items-baseline gap-2 text-[11px] text-[#8a8a9c] pt-1">
            <span className="truncate min-w-0 flex-1">y {resto.length} categoría{resto.length === 1 ? '' : 's'} más</span>
            <span className="tabular-nums shrink-0">{pesos(restoMonto)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Fila({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[#8a8a9c]">{l}</span>
      <span className="text-[#d4d4dd] tabular-nums">{v}</span>
    </div>
  )
}

/**
 * El número va ABAJO, no debajo del rótulo.
 *
 * Con las tres del arqueo al lado, «EN EFECTIVO» entraba en un renglón y «EN
 * TRANSFERENCIA» y «SIN DISCRIMINAR» en dos: los tres montos quedaban a tres
 * alturas distintas, que es lo primero que se ve porque son lo único que se
 * está comparando.
 *
 * Acortar los rótulos lo arregla HOY. `justify-between` sobre la altura de la
 * grilla lo arregla siempre: el número queda anclado al piso de la tarjeta y un
 * rótulo que se parta —en otro idioma, en una pantalla más angosta, con un
 * rótulo nuevo más largo— ya no lo puede mover.
 */
function Caja({ t, v, c }: { t: string; v: string; c: string }) {
  return (
    <div className="h-full flex flex-col justify-between gap-1 rounded-lg px-2 py-2 text-center border"
      style={{ borderColor: `${c}44`, background: `${c}11` }}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">{t}</div>
      <div className="text-[13px] font-semibold tabular-nums" style={{ color: c }}>{v}</div>
    </div>
  )
}
