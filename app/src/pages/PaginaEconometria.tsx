// PaginaEconometria — costos del grow.
// Tres vistas:
//  - Resumen: KPIs (valor inventario, costos fijos/variables, costo mensual y por
//    ciclo, costo por planta) calculados a partir de insumos + costos.
//  - Costos: alta/edicion de costos fijos y variables, con periodicidad y total.
//  - Insumos: calculadora del valor del inventario (cantidad x precio), editable.

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Calculator, Plus, X, Loader2, Trash2, Pencil, Boxes, Landmark,
  Sprout, TrendingUp, Wrench, Hammer, Zap } from 'lucide-react'
import Instalaciones from '../components/econometria/Instalaciones'
import { CostoPorGramo, ComposicionCosto, DesgloseCostos, Indicadores } from '../components/econometria/ResumenEconomico'
import { areasService, consumoDeAreas, type Area } from '../lib/areas'
import {
  econometriaService, PERIODICIDADES, CATEGORIAS_COSTO_FIJO, CATEGORIAS_COSTO_VARIABLE,
  totalCosto, mensualEquivalente, labelPeriodicidad,
  resumenEconomico, configService, VIDA_UTIL_DEFECTO, materialDelCiclo,
  type Costo, type TipoCosto, type Periodicidad, type VidaUtil, type MaterialDelCiclo,
} from '../lib/econometria'
import { stockService, type Insumo } from '../lib/stock'
import { portalService } from '../lib/portal'
import { ongService, retribucionEnEspecie, type RetribucionEnEspecie } from '../lib/ong'
import { fmtPesos } from '../lib/formatoGrafico'
import { tarjeta } from '../lib/ui'
import { instalacionesService } from '../lib/instalaciones'
import { cultivoService, FASES_COSECHABLES } from '../lib/cultivo'
// El inventario vive acá: su valor ES parte del costo, y antes esta pantalla
// lo listaba en modo lectura mandándote a otra para editarlo.
import PaginaStockInsumos from './PaginaStockInsumos'
import { btnPrimario, btnSutil, etiquetaCampo, inputFormulario } from '../lib/ui'
import { AyudaCampo } from '../components/ong/GuiaDelFormulario'
import { useDialogo } from '../lib/useDialogo'
import { confirmarBorrado } from '../lib/confirmar'
import { useDesbordeHorizontal } from '../lib/useDesbordeHorizontal'
import { useAbrirAlLlegar } from '../lib/useAbrirAlLlegar'

// text-[16px] en mobile: evita el zoom automático de iOS Safari al enfocar.

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

export default function PaginaEconometria() {
  // La pestaña sale de la URL: /stock es la ruta vieja del inventario y hay
  // links y bookmarks apuntando ahí.
  const { pathname, search } = useLocation()
  // LA RUTA DICE LA SOLAPA. Sin esto, «Cargar un costo» y «Cargar un equipo»
  // dejaban en Resumen: la pantalla correcta y la solapa equivocada, que es
  // exactamente como fallo «Crear un lote» el 27/08. Se lee UNA vez, al montar:
  // despues manda el boton, o cambiar de solapa a mano se desharia solo.
  const vistaPedida = new URLSearchParams(search).get('vista')
  const [tab, setTab] = useState<'resumen' | 'costos' | 'inventario' | 'mantenimiento' | 'instalaciones'>(
    () => {
      const validas = ['resumen', 'costos', 'inventario', 'mantenimiento', 'instalaciones'] as const
      const pedida = validas.find(v => v === vistaPedida)
      if (pedida) return pedida
      return pathname.startsWith('/stock') ? 'inventario' : 'resumen'
    })
  // Alarmas de mantenimiento vencido: el badge tiene que verse desde cualquier
  // pestaña, no sólo entrando a mirarlo.
  const [alarmasMant, setAlarmasMant] = useState(0)
  const [costos, setCostos] = useState<Costo[]>([])
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [plantasActivas, setPlantasActivas] = useState(0)
  const [plantasEnFlora, setPlantasEnFlora] = useState(0)
  const [gramosSeco, setGramosSeco] = useState(0)
  const [nCosechas, setNCosechas] = useState(0)
  // Los rindes planta por planta: con ellos se arman los escenarios del ciclo
  // (peor cuarto, promedio, mejor cuarto, mejor planta) en vez de inventar
  // precios redondos.
  const [rindes, setRindes] = useState<number[]>([])
  const [material, setMaterial] = useState<MaterialDelCiclo | null>(null)
  /**
   * Lo que se llevó el equipo como parte de su pago, valuado al costo.
   *
   * Va acá y no en la caja porque NO mueve caja: no salió plata. Es material
   * que la asociación resignó, y hasta que se muestre no aparece en ningún lado
   * — se la estaba regalando sin que ningún número lo dijera.
   */
  const [retribucion, setRetribucion] = useState<RetribucionEnEspecie | null>(null)
  const [cargando, setCargando] = useState(true)
  const [mesesCiclo, setMesesCiclo] = useState(4)
  const [vida, setVida] = useState<VidaUtil>(VIDA_UTIL_DEFECTO)
  const [capexInstalaciones, setCapexInstalaciones] = useState(0)

  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState<Costo | null>(null)
  const [tipoNuevo, setTipoNuevo] = useState<TipoCosto>('fijo')

  // «Cargar un costo» abre el alta al llegar, en la solapa Costos. Antes dejaba
  // en Resumen con el boton todavia por encontrar.
  const nuevoCosto = useCallback(() => {
    setTab('costos'); setTipoNuevo('fijo'); setEdit(null); setModal(true)
  }, [])
  useAbrirAlLlegar(nuevoCosto, '1', modal)

  const cargar = useCallback(async () => {
    try {
      const [cs, ins, plantas, cosechas, itemsInst, vida, params, lotes, corte, dispensas] = await Promise.all([
        econometriaService.getCostos(),
        stockService.getInsumos(),
        cultivoService.getResumenPlantas(true),
        cultivoService.getCosechas(),
        instalacionesService.getItems(),
        configService.get<VidaUtil>('vida_util_meses', VIDA_UTIL_DEFECTO),
        configService.get<{ meses_ciclo: number }>('parametros', { meses_ciclo: 4 }),
        // Los lotes, porque el material propio casi nunca pasa por una cosecha.
        portalService.getLotes(),
        // El corte: desde cuándo cuenta este ciclo. Vacío = se cuenta todo.
        configService.get<string>('fecha_corte', ''),
        // Las entregas, para poder valuar lo que se llevó el equipo.
        ongService.getDispensas(),
      ])
      // Para proyectar el ciclo sólo cuentan las que van a dar cosecha AHORA:
      // las que llegaron a floración. Las que están en vegetativo son del ciclo
      // siguiente y contarlas infla el rinde. En el cultivo de Gastón se nota
      // fuerte: las autos florecen y se cosechan mientras 20 feminizadas siguen
      // vegetando, y esas 20 no van a dar nada en este ciclo.
      const enFlora = plantas.filter(p => FASES_COSECHABLES.has(p.fase))
      setCostos(cs); setInsumos(ins)
      setPlantasActivas(plantas.length)
      setPlantasEnFlora(enFlora.length)
      setVida(vida); setMesesCiclo(params.meses_ciclo ?? 4)
      // Ojo: esto es el CATÁLOGO de instalaciones (un presupuesto de cosas que
      // no están compradas). Se muestra aparte, NO entra en el costo real.
      setCapexInstalaciones(itemsInst.reduce((s, i) => s + (i.precio != null ? Number(i.precio) : 0), 0))
      // EL DENOMINADOR DEL COSTO POR GRAMO. Ver `materialDelCiclo`: son las
      // cosechas MÁS los lotes propios sin cosecha, y sólo desde el corte.
      // Antes eran sólo las cosechas, y con 100 g contra un año de costos la
      // pantalla mostraba $XX.XXX por gramo.
      const mat = materialDelCiclo(cosechas, lotes, corte)
      setMaterial(mat)
      setRetribucion(retribucionEnEspecie(dispensas, lotes))
      setGramosSeco(mat.gramos)
      // Las cosechas DEL CICLO, no las del año. Sin esto la pantalla decía
      // «795 g cosechados en 15 cosechas» —los 795 no salieron de ninguna
      // cosecha— y proyectaba 53 g por planta, que es 795 dividido 15.
      const delCiclo = cosechas.filter(c => !corte || (c.fecha ?? '') >= corte)
      setNCosechas(delCiclo.filter(c => c.peso_seco_g != null && Number(c.peso_seco_g) > 0).length)
      setRindes(delCiclo.map(c => Number(c.peso_seco_g)).filter(n => n > 0).sort((a, b) => a - b))
    } catch (err) { toast.error(`Error cargando econometría: ${(err as Error).message}`) }
    finally { setCargando(false) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  // Valor del inventario: el campo precio se carga como costo TOTAL de la linea
  // (lo que se gasto en ese item), no como precio unitario, asi que se suma tal cual.
  const valorInsumos = useMemo(
    () => insumos.reduce((s, i) => s + (i.precio != null ? Number(i.precio) : 0), 0),
    [insumos],
  )
  const insumosConPrecio = useMemo(() => insumos.filter(i => i.precio != null), [insumos])

  const fijos = useMemo(() => costos.filter(c => c.tipo === 'fijo'), [costos])
  const variables = useMemo(() => costos.filter(c => c.tipo === 'variable'), [costos])

  const mensualFijos = useMemo(() => fijos.reduce((s, c) => s + mensualEquivalente(c, mesesCiclo), 0), [fijos, mesesCiclo])
  const mensualVariables = useMemo(() => variables.reduce((s, c) => s + mensualEquivalente(c, mesesCiclo), 0), [variables, mesesCiclo])
  // Modelo real: el equipo del Stock amortizado por su vida útil + los gastos
  // recurrentes + los consumibles del ciclo. El catálogo de Instalaciones NO
  // entra: es un presupuesto de cosas que todavía no están compradas.
  // Sin `faltantes`: la lista de compras vivía en el módulo Instalación, que esta
  // instalación no tiene. Sin pantalla donde cargarla, el escenario "si compro lo
  // que falta" mandaba a una pantalla inexistente.
  const eco = useMemo(() => resumenEconomico({
    insumos, costos, vida, mesesCiclo, gramosCosechados: gramosSeco,
  }), [insumos, costos, vida, mesesCiclo, gramosSeco])

  const mensualTotal = eco.totalMes
  const costoPorCiclo = eco.totalCiclo

  const borrar = async (c: Costo) => {
    if (!(await confirmarBorrado(`¿Borrar el costo "${c.nombre}"?`))) return
    try { await econometriaService.eliminarCosto(c.id); toast.success('Costo borrado'); cargar() }
    catch (err) { toast.error(`No se pudo borrar: ${(err as Error).message}`) }
  }

  const abrirNuevo = (tipo: TipoCosto) => { setTipoNuevo(tipo); setEdit(null); setModal(true) }

  const { refWrapper: refTabs, refScroller: refScrollTabs } = useDesbordeHorizontal<HTMLDivElement, HTMLDivElement>()

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden ct-page-scroll bg-[#0a0a0f] text-[#d4d4dd] font-sans">
      <div className="sticky top-0 z-40 bg-[#0a0a0f] border-b border-[#1f1f2b]">
        <div className="flex items-center flex-wrap gap-2 sm:gap-x-4 px-3 sm:px-6 pt-3">
          <div className="min-w-0">
            <h1 className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] text-[#ececf1] flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#bef264]" /> Econometría
            </h1>
            <div className="mt-0.5 text-[10px] sm:text-[11px] text-[#8a8a9c] tabular-nums">
              {fmt(mensualTotal)}/mes · {fmt(costoPorCiclo)}/ciclo · inventario {fmt(valorInsumos)}{eco.costoPorGramo != null ? ` · ${fmt(eco.costoPorGramo)}/g` : ''}
            </div>
          </div>
          {/* El espaciador SOLO de `sm:` para arriba (§7.12). Suelto dentro de
              un `flex-wrap` se lleva todo el ancho sobrante, tira los dos
              botones al renglon de abajo y ahi quedan pegados a la izquierda
              con 267px de aire al lado. Medido: dos cuadrados de 44px en x=12 y
              x=64.

              Y las etiquetas dejan de esconderse en el telefono. Con
              `hidden sm:inline` los dos botones quedaban en «+» y «+»: dos
              cuadrados identicos que hacen cosas distintas —uno abre un costo
              fijo y el otro uno variable— sin nada que los distinga. Un icono
              puede reemplazar a una etiqueta cuando el icono es distinto; aca
              era el mismo. */}
          <div className="hidden sm:block flex-1" />
          {tab === 'costos' && (
            <div className="w-full sm:w-auto flex gap-2">
              <button onClick={() => abrirNuevo('fijo')} className={`${btnPrimario} flex-1 sm:flex-none justify-center`}>
                <Plus className="w-3.5 h-3.5" /> <span>Fijo</span>
              </button>
              <button onClick={() => abrirNuevo('variable')} className={`${btnPrimario} flex-1 sm:flex-none justify-center`}>
                <Plus className="w-3.5 h-3.5" /> <span>Variable</span>
              </button>
            </div>
          )}
        </div>
        {/* En celular las pestañas scrollean en vez de apretarse.
            Con el degradado de los costados, como el resto de la app: son cinco
            y a 375px quedan 175 fuera de cuadro —«Manteni…» partido al ras del
            borde se lee como un error de layout, no como «hay mas»—. Y sin la
            barra de scroll del navegador, que se dibujaba como una raya gris
            debajo de las pestañas. `ct-tabs-fade` + `useDesbordeHorizontal` ya
            existian para esto (BarraPestanas, PestanasSeccion): esta barra era
            la unica que no los usaba. */}
        <div ref={refTabs} className="ct-tabs-fade">
        <div ref={refScrollTabs} className="scrollbar-none flex gap-1 px-3 sm:px-6 pt-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
          {([['resumen', 'Resumen', TrendingUp], ['costos', 'Costos', Landmark], ['inventario', 'Inventario', Boxes], ['mantenimiento', 'Mantenimiento', Wrench], ['instalaciones', 'Instalaciones', Hammer]] as const).map(([t, lbl, Ico]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 flex-shrink-0 text-[12px] font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${tab === t ? 'border-[#a3e635] text-[#d9f99d]' : 'border-transparent text-[#8a8a9c] hover:text-[#a6a6b5]'}`}>
              <Ico className="w-3.5 h-3.5" /> {lbl}
              {t === 'mantenimiento' && alarmasMant > 0 && (
                <span className="ml-0.5 px-1.5 rounded-full bg-[#f59e0b]/20 border border-[#5a4a20] text-[10px] font-semibold text-[#fbbf24] tabular-nums">
                  {alarmasMant}
                </span>
              )}
            </button>
          ))}
        </div>
        </div>
      </div>

      {cargando ? (
        <div className="px-3 sm:px-6 py-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded-xl bg-[#101016] border border-[#1f1f2b] h-[92px] animate-pulse" />)}
        </div>
      ) : tab === 'resumen' ? (
        <div className="px-3 sm:px-6 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] space-y-4">
          {/* El número que importa */}
          <CostoPorGramo eco={eco} material={material} nCosechas={nCosechas} plantasActivas={plantasActivas} plantasEnFlora={plantasEnFlora} rindes={rindes} mesesCiclo={mesesCiclo} />

          {/* DE DÓNDE SALE EL DENOMINADOR, dicho donde se lee el número.
              Sin esto el costo por gramo es una cifra sin origen, y ya se vio a
              dónde lleva: mostraba $XX.XXX/g dividiendo por 100 g de cosechas
              cuando el material propio del ciclo son 795. */}
          {material && material.gramos > 0 && (
            <div className={`${tarjeta} border-[#1d3a5a] bg-[#38bdf8]/[0.05]`}>
              <p className="text-[11px] text-[#a6a6b5] leading-relaxed">
                Ese costo se reparte entre{' '}
                <b className="text-[#ececf1]">{Math.round(material.gramos).toLocaleString('es-AR')} g</b>{' '}
                de producción propia
                {material.deLotesPropios > 0 && material.deCosechas > 0 && <>
                  {' '}({Math.round(material.deCosechas).toLocaleString('es-AR')} g de cosechas
                  registradas y {Math.round(material.deLotesPropios).toLocaleString('es-AR')} g de lotes
                  propios sin cosecha)
                </>}
                {material.deLotesPropios > 0 && material.deCosechas === 0 &&
                  <> — todo de lotes propios, porque este ciclo todavía no tiene cosechas cargadas</>}
                .{' '}
                <b className="text-[#a6a6b5]">Lo comprado no entra</b>: trae su propio costo por gramo,
                y meterlo abarataría el cultivo propio con material que se pagó aparte.
                {material.antesDelCorte > 0 && <>
                  {' '}Quedan afuera{' '}
                  <span className="text-[#c9cabf]">{Math.round(material.antesDelCorte).toLocaleString('es-AR')} g</span>{' '}
                  anteriores al corte del 29/08/2026, que son de la etapa vieja.
                </>}
              </p>
            </div>
          )}

          {/* LO QUE SE LLEVA EL EQUIPO, VALUADO AL COSTO (08/09/2026)
              No mueve caja —no salió plata— pero es material que la asociación
              resignó. Hasta hoy no aparecía en ningún número: se estaba
              regalando sin que nada lo dijera. */}
          {retribucion && retribucion.gramos > 0 && (
            <div className={`${tarjeta} border-[#3a3a1d] bg-[#facc15]/[0.04]`}>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Retribución en especie</h3>
                <span className="font-mono text-[15px] text-[#facc15]">{fmtPesos(retribucion.costo)}</span>
              </div>
              <p className="text-[11px] text-[#a6a6b5] leading-relaxed">
                <b className="text-[#ececf1]">{retribucion.gramos.toLocaleString('es-AR')} g</b>{' '}
                en {retribucion.movimientos} retiros de quienes trabajan en la asociación, como parte de su pago.
                Va <b className="text-[#a6a6b5]">al costo del lote</b> y no a la tarifa: es lo que la
                asociación resignó, no lo que le hubiera cobrado a un socio.
                {' '}<b className="text-[#a6a6b5]">No mueve caja</b>: no salió plata, así que no se asienta.
                {retribucion.gramosSinCosto > 0 && <>
                  {' '}Quedan sin valuar{' '}
                  <span className="text-[#c9cabf]">{retribucion.gramosSinCosto.toLocaleString('es-AR')} g</span>,
                  de lotes que no declaran costo: cuentan en los gramos y no en los pesos.
                </>}
              </p>
            </div>
          )}

          {/* A dónde va cada peso */}
          <ComposicionCosto eco={eco} />

          {/* Trazabilidad: cada peso hasta el ítem que lo genera */}
          <DesgloseCostos eco={eco} vida={vida} />

          {/* Indicadores de gestión */}
          <Indicadores eco={eco} plantasActivas={plantasActivas} />

          {capexInstalaciones > 0 && (
            <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] px-4 py-3 flex items-start gap-2.5">
              <Wrench className="w-4 h-4 text-[#f472b6] flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-[#8a8a9a] leading-relaxed">
                <b className="text-[#d4d4dd]">Catálogo de Instalaciones: {fmt(capexInstalaciones)}</b> — es un presupuesto de
                lo que <i>podrías</i> comprar, así que <b>no</b> entra en el costo por gramo. El costo se calcula con
                lo que ya tenés instalado en Stock ({fmt(eco.capexInvertido)}).
              </div>
            </div>
          )}

          <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 sm:p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <Sprout className="w-4 h-4 text-[#bef264]" />
              <span className="text-[12px] text-[#a6a6b5]">Duración de un ciclo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input type="number" min={1} max={12} value={mesesCiclo}
                onChange={e => { const v = Math.max(1, Math.min(12, Number(e.target.value) || 1)); setMesesCiclo(v); configService.set('parametros', { meses_ciclo: v }).catch(() => {}) }}
                className="w-16 px-2 py-2 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[12px] text-[#ececf1] text-center focus:outline-none focus:border-[#a3e635]/60" />
              <span className="text-[12px] text-[#8a8a9c]">meses</span>
            </div>
            <span className="text-[10px] text-[#8a8a9c]">Reparte los consumibles y los costos "por ciclo" en su equivalente mensual.</span>
          </div>

          {costos.length === 0 && (
            <div className="py-10 text-center">
              <div className="mx-auto w-11 h-11 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-3"><Calculator className="w-5 h-5 text-[#8a8a9c]" /></div>
              <div className="font-display font-semibold text-[#d4d4dd] text-[14px]">Todavía no cargaste costos</div>
              <div className="mt-1 text-[11px] text-[#8a8a9c]">Andá a la pestaña Costos y agregá tus costos fijos (alquiler, luz) y variables (nutrientes, sustrato).</div>
              <button onClick={() => setTab('costos')} className={`${btnPrimario} mt-3`}><Plus className="w-3.5 h-3.5" /> Cargar costos</button>
            </div>
          )}
        </div>
      ) : tab === 'costos' ? (
        <div className="px-3 sm:px-6 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] space-y-5">
          {/* B5: el consumo sale de los watts y las horas de luz de cada area.
              NO crea el costo solo — el modelo es de carga manual y un renglon
              que aparece sin que nadie lo ponga es peor que uno que falta. Da
              el numero para cargarlo con confianza en vez de a ojo. */}
          <ConsumoDeLuz />
          <ListaCostos titulo="Costos fijos" subtitulo="Se pagan igual produzcas o no (alquiler, luz de abono, internet)" icono={Landmark} color="#fbbf24" items={fijos} totalMensual={mensualFijos} mesesCiclo={mesesCiclo} onEdit={c => { setEdit(c); setModal(true) }} onBorrar={borrar} onNuevo={() => abrirNuevo('fijo')} />
          <ListaCostos titulo="Costos variables" subtitulo="Cambian según el cultivo (nutrientes, sustrato, agua, consumo de luz)" icono={TrendingUp} color="#ff8a7a" items={variables} totalMensual={mensualVariables} mesesCiclo={mesesCiclo} onEdit={c => { setEdit(c); setModal(true) }} onBorrar={borrar} onNuevo={() => abrirNuevo('variable')} />
        </div>
      ) : tab === 'instalaciones' ? (
        <div className="px-3 sm:px-6 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
          <Instalaciones />
        </div>
      ) : (
        <div className="px-3 sm:px-6 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
          {/* El inventario completo, no una copia de sólo lectura: acá se carga,
              se edita y se borra, y el total alimenta el costo del ciclo. */}
          {tab === 'inventario' && <div className="rounded-xl bg-gradient-to-br from-[#12160f] to-[#101016] border border-[#2c3a1a] px-4 py-3 mb-4 flex items-baseline justify-between gap-3 flex-wrap tabular-nums">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#7c8b5c] font-medium">Valor del inventario</div>
              <div className="text-[11px] text-[#8a8a9c] mt-0.5">
                {insumosConPrecio.length} de {insumos.length} insumos tienen precio cargado
              </div>
            </div>
            <div className="font-display font-bold text-[22px] text-[#bef264] leading-none">{fmt(valorInsumos)}</div>
          </div>}
          <PaginaStockInsumos embebida tabExterna={tab === 'mantenimiento' ? 'mantenimiento' : 'inventario'}
            onAlarmas={setAlarmasMant} onCambio={cargar} />
        </div>
      )}

      {modal && <ModalCosto costo={edit} tipoInicial={tipoNuevo} onCerrar={() => setModal(false)} onGuardado={() => { setModal(false); cargar() }} />}
    </div>
  )
}


function ListaCostos({ titulo, subtitulo, icono: Ico, color, items, totalMensual, mesesCiclo, onEdit, onBorrar, onNuevo }: {
  titulo: string; subtitulo: string; icono: LucideIcon; color: string; items: Costo[]; totalMensual: number; mesesCiclo: number
  onEdit: (c: Costo) => void; onBorrar: (c: Costo) => void; onNuevo: () => void
}) {
  return (
    <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1f1f2b]">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}1f`, border: `1px solid ${color}40` }}>
          <Ico className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold text-[13px] text-[#ececf1]">{titulo}</h3>
          <div className="text-[10px] text-[#8a8a9c] truncate">{subtitulo}</div>
        </div>
        <div className="text-right">
          <div className="font-display font-bold text-[14px] tabular-nums" style={{ color }}>{fmt(totalMensual)}</div>
          <div className="text-[10px] text-[#8a8a9c] uppercase tracking-[0.14em]">por mes</div>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-7 text-center">
          <div className="text-[12px] text-[#a6a6b5]">Sin {titulo.toLowerCase()} cargados.</div>
          <button onClick={onNuevo} className={`${btnSutil} mt-2.5`}><Plus className="w-3.5 h-3.5" /> Agregar</button>
        </div>
      ) : (
        <ul className="divide-y divide-[#1f1f2b]/60">
          {items.map(c => {
            const total = totalCosto(c)
            const mens = mensualEquivalente(c, mesesCiclo)
            // ARRIBA Y NO AL CENTRO, Y LOS DOS BOTONES A LA PAR.
            //
            // Los botones se apilaban en columna, y como en el telefono cada uno
            // mide 44px de alto por el minimo tactil, la columna medía 92px: era
            // ELLA la que fijaba el alto del renglon. El nombre y el importe,
            // centrados contra esos 92, quedaban flotando en el medio y lejos
            // uno del otro — un libro de costos donde el importe no esta a la
            // altura de su concepto.
            //
            // A la par miden 44 y el alto del renglon lo vuelve a decidir el
            // contenido. Alineados arriba, el nombre y su importe arrancan en la
            // misma linea, que es como se lee una lista de importes.
            return (
              <li key={c.id} className="flex items-start gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] text-[#ececf1] truncate">{c.nombre}</span>
                    {c.categoria && <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-[#15151d] border border-[#2a2a3a] text-[#a6a6b5]">{c.categoria}</span>}
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-[#15151d] border border-[#2a2a3a] text-[#8a8a9c]">{labelPeriodicidad(c.periodicidad)}</span>
                  </div>
                  {c.notas && <div className="mt-0.5 text-[10px] text-[#8a8a9c] truncate">{c.notas}</div>}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[12px] font-medium text-[#ececf1] tabular-nums">{fmt(total)}</div>
                  {c.periodicidad !== 'mensual' && c.periodicidad !== 'unico' && (
                    <div className="text-[10px] text-[#8a8a9c]">≈ {fmt(mens)}/mes</div>
                  )}
                  {(c.cantidad ?? 1) !== 1 && <div className="text-[10px] text-[#8a8a9c]">{c.cantidad} × {fmt(Number(c.monto))}</div>}
                </div>
                <div className="flex gap-1 flex-shrink-0 -mt-1 sm:mt-0">
                  <button onClick={() => onEdit(c)} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#8a8a9c] hover:text-[#d9f99d] hover:bg-[#15151d] rounded-lg transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onBorrar(c)} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 text-[#8a8a9c] hover:text-[#ff8a7a] hover:bg-[#15151d] rounded-lg transition-colors" title="Borrar"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ModalCosto({ costo, tipoInicial, onCerrar, onGuardado }: { costo: Costo | null; tipoInicial: TipoCosto; onCerrar: () => void; onGuardado: () => void }) {
  const refDialogo = useDialogo(onCerrar)
  const [f, setF] = useState<Partial<Costo>>(costo ?? { tipo: tipoInicial, periodicidad: 'mensual', monto: 0, cantidad: 1 })
  const [guardando, setGuardando] = useState(false)
  // Ver la nota del mismo patrón en PaginaPacientes: el campo decide el tipo.
  const set = <K extends keyof Costo>(k: K, v: Costo[K]) => setF(prev => ({ ...prev, [k]: v }))
  const cats = (f.tipo === 'variable' ? CATEGORIAS_COSTO_VARIABLE : CATEGORIAS_COSTO_FIJO)

  const guardar = async () => {
    if (!f.nombre?.trim()) { toast.error('Poné un nombre'); return }
    setGuardando(true)
    try {
      const payload: Partial<Costo> = {
        nombre: f.nombre!.trim(), tipo: f.tipo || 'fijo', categoria: f.categoria || null,
        monto: Number(f.monto ?? 0), periodicidad: (f.periodicidad as Periodicidad) || 'mensual',
        cantidad: f.cantidad != null && String(f.cantidad) !== '' ? Number(f.cantidad) : 1,
        notas: f.notas || null,
      }
      if (costo) await econometriaService.actualizarCosto(costo.id, payload)
      else await econometriaService.crearCosto(payload)
      toast.success(costo ? 'Costo actualizado' : 'Costo agregado'); onGuardado()
    } catch (err) { toast.error(`Error: ${(err as Error).message}`) }
    finally { setGuardando(false) }
  }

  return (
    <div ref={refDialogo} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onCerrar}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#0d0d12] border-b border-[#1f1f2b] px-4 py-3 flex items-center justify-between">
          <h2 className="font-display font-bold text-[15px] text-[#ececf1]">{costo ? 'Editar costo' : 'Nuevo costo'}</h2>
          <button onClick={onCerrar} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 text-[#8a8a9c] hover:text-[#ececf1]" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['fijo', 'variable'] as const).map(t => (
              <button key={t} onClick={() => set('tipo', t)}
                className={`px-3 py-2 rounded-lg text-[12px] font-medium border transition-colors ${f.tipo === t ? 'border-[#a3e635]/50 bg-[#a3e635]/10 text-[#d9f99d]' : 'border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5] hover:text-[#ececf1]'}`}>
                {t === 'fijo' ? 'Costo fijo' : 'Costo variable'}
              </button>
            ))}
          </div>
          <div>
            <label className={etiquetaCampo}>Nombre *</label>
            <input className={inputFormulario} value={f.nombre ?? ''} onChange={e => set('nombre', e.target.value)} placeholder={f.tipo === 'variable' ? 'Ej: Nutrientes Ryanodine' : 'Ej: Alquiler del local'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={etiquetaCampo}>Categoría</label>
              <input className={inputFormulario} list="cats-costo" value={f.categoria ?? ''} onChange={e => set('categoria', e.target.value)} placeholder="Opcional" />
              <datalist id="cats-costo">{cats.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className={etiquetaCampo}>Periodicidad</label>
              <select className={inputFormulario} value={f.periodicidad} onChange={e => set('periodicidad', e.target.value as Periodicidad)}>
                {PERIODICIDADES.map(p => <option key={p.valor} value={p.valor}>{p.label}</option>)}
              </select>
              <AyudaCampo id="costo" campo="Periodicidad" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={etiquetaCampo}>Monto ($)</label><input type="number" className={inputFormulario} value={f.monto ?? ''} onChange={e => set('monto', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="0" /></div>
            <div><label className={etiquetaCampo}>Cantidad</label><input type="number" className={inputFormulario} value={f.cantidad ?? 1} onChange={e => set('cantidad', e.target.value === '' ? null : Number(e.target.value))} placeholder="1" /></div>
          </div>
          <div><label className={etiquetaCampo}>Notas</label><textarea rows={2} className={inputFormulario + ' resize-none'} value={f.notas ?? ''} onChange={e => set('notas', e.target.value)} placeholder="Ej: incluye expensas / por bolsa de 50L" /></div>
          <p className="text-[10px] text-[#8a8a9c]">El total de la fila es monto × cantidad. Los costos "por ciclo" se reparten en su equivalente mensual según la duración del ciclo que pongas en Resumen.</p>
        </div>
        <div className="sticky bottom-0 bg-[#0d0d12] border-t border-[#1f1f2b] px-4 py-3 flex justify-end gap-2">
          <button onClick={onCerrar} className={btnSutil}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className={btnPrimario}>{guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}{costo ? 'Guardar' : 'Agregar'}</button>
        </div>
      </div>
    </div>
  )
}

/**
 * B5: cuanto consume la iluminacion, sacado de los watts y las horas de luz que
 * tiene cargadas cada area.
 *
 * Deliberadamente NO crea ni edita el costo: lo calcula y lo muestra para que la
 * persona lo cargue. El modelo de costos es de carga manual, y un renglon que
 * aparece sin que nadie lo ponga es peor que uno que falta — nadie sabe de donde
 * salio ni si hay que corregirlo.
 */
function ConsumoDeLuz() {
  const [areas, setAreas] = useState<Area[]>([])
  const [precio, setPrecio] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    areasService.getAreas()
      .then(setAreas)
      .catch(() => { /* sin areas la tarjeta simplemente no aparece */ })
      .finally(() => setCargando(false))
  }, [])

  const c = useMemo(() => consumoDeAreas(areas), [areas])
  if (cargando || c.areas === 0) return null

  const p = Number(precio)
  const costoMes = precio.trim() !== '' && Number.isFinite(p) && p > 0
    ? Math.round(c.mes * p) : null

  return (
    <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-4 h-4 text-[#fbbf24]" strokeWidth={1.8} />
        <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
          Consumo de iluminación
        </h3>
      </div>
      <p className="text-[11px] text-[#8a8a9c] mb-3">
        Sale de los watts y las horas de luz de cada área. Es para que cargues el
        costo con un número, no a ojo: no se agrega solo.
      </p>

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">Por día</div>
          <div className="text-[15px] font-semibold text-[#fbbf24] tabular-nums">{c.dia} kWh</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">Al mes (30 días)</div>
          <div className="text-[15px] font-semibold text-[#fbbf24] tabular-nums">{c.mes} kWh</div>
        </div>
        <label className="ml-auto">
          <span className="block text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-1">$ por kWh</span>
          <input type="number" inputMode="decimal" value={precio}
            onChange={e => setPrecio(e.target.value)} placeholder="ej 85"
            className="w-[110px] px-2 py-1 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[12px] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#fbbf24]/60 min-h-[44px] sm:min-h-0" />
        </label>
      </div>

      {costoMes != null && (
        <p className="text-[12px] text-[#d9f99d] mt-3">
          Serían <b>${costoMes.toLocaleString('es-AR')}</b> por mes.
          Cargalo como costo variable, categoría <b>Luz (consumo)</b>.
        </p>
      )}

      {/* Un total chico se leeria como "consumimos poco" cuando en realidad es
          "no cargamos la mitad de las areas". */}
      {c.sinDatos > 0 && (
        <p className="text-[11px] text-[#fbbf24] mt-2">
          {c.sinDatos} de {c.areas} área{c.areas === 1 ? '' : 's'} sin watts u horas
          de luz cargados: este total les falta. Se completan en Cultivo · Sala.
        </p>
      )}
    </div>
  )
}
