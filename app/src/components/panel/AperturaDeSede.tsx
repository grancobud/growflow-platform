// LA RUTINA DE ABRIR LA SEDE, QUE ES PARA LO QUE SE USA EL PANEL.
//
// Lo pidió la asociación el 02/09/2026, y con el orden puesto: «llega el encargado a
// abrir: 1 toma los valores de la sala, 2 controla caja, 3 controla stock, 4
// asienta novedades». Eso no es una lista de indicadores, es un procedimiento —y
// un procedimiento se dibuja como tal: numerado, en orden, y cada paso diciendo
// si ya está hecho.
//
// LO QUE HABÍA ANTES ERAN CUATRO NÚMEROS QUE NO SE USAN PARA NADA a esa hora:
// plantas activas, en floración, riegos de hoy y gramos cosechados. Son ciertos
// y son lindos, y ninguno se mira al abrir la puerta. Ocupaban el lugar de los
// tres que sí: el ambiente, la caja y el stock.
//
// CADA PASO SE MUESTRA SÓLO SI EL ROL LO PUEDE HACER, y por eso el padre pasa
// `null` en vez de un cero. No es lo mismo «la caja está en cero» que «a vos la
// caja no te toca»: el primero es un dato y el segundo es una pantalla que no
// deberías ver. Un cultivador ve el paso 1 y nada más, y la lista se numera con
// lo que le quedó, sin huecos.

import { Link } from 'react-router-dom'
import { Thermometer, Wallet, Package, ClipboardList, Check, ChevronRight } from 'lucide-react'
import type { ResumenCaja } from '../../lib/ong'

/** Un lote con lo que le queda, ya calculado por el padre. */
export interface LoteEnStock {
  codigo: string
  producto: string
  disponible: number
  sufijo: string
}

export interface EstadoAmbiente {
  /** `null` cuando no hay salas cargadas: no hay rutina que reclamar todavía. */
  falta: boolean | null
  detalle: string
  turno: string
}

const fmtPesos = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

/**
 * Un paso de la rutina.
 *
 * EL TILDE SOLO SE PONE CUANDO EL SISTEMA SABE QUE ESTA HECHO, y de los cuatro
 * pasos eso pasa en UNO: la lectura de ambiente, que deja una fila.
 *
 * Mirar la caja, mirar el stock y asentar novedades no dejan rastro de haber
 * ocurrido. Un tilde ahi no informa: afirma algo que nadie comprobo, y sobre la
 * pantalla que se usa para saber que falta hacer. La primera version los pintaba
 * a los tres en verde apenas cargaba la pagina — la rutina aparecia terminada
 * antes de empezar.
 *
 * Asi que hay tres estados y no dos: pendiente (ambar, con el numero), hecho
 * (verde, con el tilde) y —el que faltaba— sin saber, que muestra el numero en
 * gris. El paso sigue estando y sigue enumerado; lo unico que no hace es
 * mentir sobre si ya paso.
 */
type EstadoPaso = 'pendiente' | 'hecho' | 'sin_saber'

function Paso({ n, estado, icono: Ic, titulo, valor, a, onIr }: {
  n: number
  estado: EstadoPaso
  icono: typeof Wallet
  titulo: string
  valor: React.ReactNode
  /** A dónde se va a hacer este paso. Uno de los dos, no los dos. */
  a?: string
  onIr?: () => void
}) {
  const pendiente = estado === 'pendiente'
  const marca = {
    pendiente: 'border-[#5a4a20] bg-[#facc15]/[0.12] text-[#facc15]',
    hecho: 'border-[#404d20] bg-[#a3e635]/[0.12] text-[#bef264]',
    sin_saber: 'border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5]',
  }[estado]
  const dentro = (
    <>
      <span aria-hidden
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-display font-bold border ${marca}`}>
        {estado === 'hecho' ? <Check className="w-3.5 h-3.5" strokeWidth={2.4} /> : n}
      </span>
      <Ic aria-hidden className={`w-4 h-4 flex-shrink-0 ${pendiente ? 'text-[#facc15]' : 'text-[#8a8a9c]'}`} strokeWidth={1.8} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-[#ececf1]">{titulo}</span>
        <span className="block text-[11px] text-[#a6a6b5] mt-0.5 [text-wrap:pretty]">{valor}</span>
      </span>
      <ChevronRight aria-hidden className="w-4 h-4 text-[#6e6e80] flex-shrink-0" />
    </>
  )
  const cls = 'w-full flex items-center gap-3 px-3 sm:px-4 py-3 min-h-[44px] text-left '
    + 'border-t border-[#1f1f2b] first:border-t-0 hover:bg-[#15151d] transition-colors'

  return a
    ? <Link to={a} className={cls}>{dentro}</Link>
    : <button type="button" onClick={onIr} className={cls}>{dentro}</button>
}

export function AperturaDeSede({ ambiente, caja, stock, arqueoDeHoy, onArquear, onNovedades }: {
  ambiente: EstadoAmbiente | null
  /** `null` = este rol no ve plata. */
  caja: ResumenCaja | null
  /** `null` = este rol no ve el catálogo. */
  stock: { total: number; lotes: LoteEnStock[]; otrasUnidades: number } | null
  /**
   * El arqueo de hoy, si alguien ya contó.
   *
   * Es lo que hace que los pasos 2 y 3 puedan mostrar un tilde de verdad: hasta
   * que existió la tabla `arqueos`, «controlar la caja» no dejaba rastro y el
   * único estado honesto era el número en gris.
   */
  arqueoDeHoy: { caja: boolean; stock: boolean; hora: string } | null
  onArquear: () => void
  onNovedades: () => void
}) {
  // Sin ningún paso visible no se dibuja el bloque. Pasa con un rol que no ve
  // nada de esto, y un encabezado solo sobre una caja vacía es peor que nada.
  const hayAlgo = (ambiente && ambiente.falta !== null) || caja || stock
  if (!hayAlgo) return null

  let n = 0
  return (
    <section aria-labelledby="apertura-titulo"
      className="rounded-xl bg-[#101016] border border-[#1f1f2b] overflow-hidden">
      <div className="px-3 sm:px-4 pt-3 pb-2">
        <h2 id="apertura-titulo" className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">
          Al abrir la sede
        </h2>
      </div>

      {ambiente && ambiente.falta !== null && (
        <Paso n={++n} estado={ambiente.falta ? 'pendiente' : 'hecho'} icono={Thermometer} a="/ambiente"
          titulo={ambiente.falta
            ? `Tomar los valores de la sala — falta la lectura de la ${ambiente.turno}`
            : 'Valores de la sala'}
          valor={ambiente.detalle} />
      )}

      {caja && (
        // EL TILDE LO PONE EL ARQUEO, no el hecho de que la pantalla cargue.
        //
        // Hasta el 02/09 este paso no podía estar «hecho» de ninguna manera:
        // mirar la caja no deja rastro. Ahora sí, y por eso el paso dejó de ser
        // un link a Economía y pasó a abrir el control — «controlar» es contar,
        // no mirar. El detalle sigue estando en Economía, a un toque de ahí.
        <Paso n={++n} estado={arqueoDeHoy?.caja ? 'hecho' : 'sin_saber'} icono={Wallet}
          onIr={onArquear}
          titulo="Controlar la caja"
          valor={
            <>
              Efectivo <span className="text-[#ececf1] tabular-nums">{fmtPesos(caja.netoEfectivo)}</span>
              {' · '}Transferencia <span className="text-[#ececf1] tabular-nums">{fmtPesos(caja.netoTransferencia)}</span>
              {/* Lo que no cae en ninguno de los dos se dice, no se esconde: son
                  los asientos «Mixto» o sin medio, y sin esta línea los dos
                  números de arriba no suman el total y nada lo explica. */}
              {caja.netoOtros !== 0 && (
                <> · sin discriminar <span className="text-[#ececf1] tabular-nums">{fmtPesos(caja.netoOtros)}</span></>
              )}
              {arqueoDeHoy?.caja && (
                <span className="block text-[10.5px] text-[#bef264] mt-0.5">Contada hoy a las {arqueoDeHoy.hora}</span>
              )}
            </>
          } />
      )}

      {stock && (
        <Paso n={++n} estado={arqueoDeHoy?.stock ? 'hecho' : 'sin_saber'} icono={Package}
          onIr={onArquear}
          titulo="Controlar el stock"
          valor={
            stock.lotes.length === 0
              ? 'No queda nada disponible en el catálogo'
              : <>
                  <span className="text-[#ececf1] tabular-nums">{stock.total.toLocaleString('es-AR')} g</span>
                  {' en '}{stock.lotes.length} {stock.lotes.length === 1 ? 'lote' : 'lotes'}
                  {stock.otrasUnidades > 0 && ` · ${stock.otrasUnidades} en otra unidad`}
                  {/* Los lotes por nombre, no sólo el total: «cuánto queda de
                      cada producto» fue el pedido, y con un total no se sabe si
                      lo que queda es de lo que la persona vino a buscar. */}
                  {arqueoDeHoy?.stock && (
                    <span className="block text-[10.5px] text-[#bef264] mt-0.5">Contado hoy a las {arqueoDeHoy.hora}</span>
                  )}
                  <span className="block mt-1 text-[10.5px] text-[#8a8a9c] [text-wrap:pretty]">
                    {stock.lotes.map(l =>
                      `${l.codigo} ${l.producto} ${l.disponible.toLocaleString('es-AR')}${l.sufijo}`).join(' · ')}
                  </span>
                </>
          } />
      )}

      <Paso n={++n} estado="sin_saber" icono={ClipboardList} onIr={onNovedades}
        titulo="Asentar las novedades"
        valor="Lo que pasó desde la última vez: entregas, gastos, visitas." />
    </section>
  )
}
