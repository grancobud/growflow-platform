// Qué hay en el estante: lo que entró, lo que salió y lo que queda.
//
// POR QUE VIVE EN COSECHA Y NO EN LA O.N.G.
//
// Los lotes se miraban sólo desde O.N.G. › Autodispensación › Catálogo, y a esa
// pantalla el cultivador no entra: no tiene `ver_ong`, y dárselo le abriría
// además pacientes y solicitudes. O sea que quien produce el material no podía
// ver cuánto quedaba de lo que produjo.
//
// Cosecha es el lugar natural: se cosecha, sale un lote, y esto dice qué pasó
// con él.
//
// LO QUE NO MUESTRA, Y ES EL PUNTO
//
// Ni un peso. Lee de la vista `lotes_stock`, que no tiene `costo_por_gramo` ni
// `aporte_por_gramo` — y no porque acá se omitan, sino porque la base no se los
// entrega. Lo entregado viene sumado por lote, así que tampoco hay una sola fila
// que diga a qué paciente se le dio.

import { useState, useEffect } from 'react'
import { Package, AlertTriangle, FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import {
  stockService, totalesDeStock, ordenarPorLoQueQueda, type LoteEnStock,
} from '../../lib/stockDeLotes'
import { rotuloSeccion } from '../../lib/ui'

const g = (n: number) => `${Math.round(n).toLocaleString('es-AR')} g`

function Tarjeta({ rotulo, valor, tono }: { rotulo: string; valor: string; tono?: string }) {
  return (
    <div className="rounded-lg border border-[#2a2a3a] bg-[#15151d] p-3">
      <p className={rotuloSeccion}>{rotulo}</p>
      <p className={`mt-1 text-[17px] font-display font-bold ${tono ?? 'text-[#ececf1]'}`}>{valor}</p>
    </div>
  )
}

export function StockDeLotes() {
  const [lotes, setLotes] = useState<LoteEnStock[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    stockService.listar()
      .then(setLotes)
      .catch(e => toast.error(e instanceof Error ? e.message : 'No se pudo traer el stock'))
      .finally(() => setCargando(false))
  }, [])

  if (cargando) return <p className="text-[12px] text-[#8a8a9c]">Cargando…</p>

  const t = totalesDeStock(lotes)
  const orden = ordenarPorLoQueQueda(lotes)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[15px] font-medium text-[#ececf1]">Stock por lote</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-[#a6a6b5]">
          Lo que entró a cada lote, lo que salió y lo que queda. Los gramos entregados
          vienen sumados por lote: acá no se ve a quién se le dio ni cuánto aportó.
        </p>
      </div>

      {/* Sólo lo que se mide en gramos. El aceite va en frascos y los accesorios
          en unidades: sumarlos daría un número que no significa nada. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Tarjeta rotulo="Lotes" valor={String(t.lotes)} />
        <Tarjeta rotulo="Entró" valor={g(t.entrado)} />
        <Tarjeta rotulo="Salió" valor={g(t.entregado)} />
        <Tarjeta rotulo="Queda" valor={g(t.restante)}
          tono={t.restante > 0 ? 'text-[#a3e635]' : 'text-[#8a8a9c]'} />
      </div>

      {t.sobregirados > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-[#5a4a20] bg-[#f59e0b]/10 p-3">
          <AlertTriangle className="w-4 h-4 text-[#f59e0b] flex-shrink-0 mt-0.5" />
          <p className="text-[12px] leading-relaxed text-[#f59e0b]">
            {t.sobregirados === 1
              ? 'Un lote entregó más de lo que declara haber tenido.'
              : `${t.sobregirados} lotes entregaron más de lo que declaran haber tenido.`}
            {' '}No es un error de esta pantalla: o el ingreso quedó corto, o se entregó
            material que no se cargó.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {orden.map(l => {
          const queda = Number(l.restante) || 0
          const unidad = (l.unidad ?? 'g') === 'g'
          const fmt = (n: number) => unidad ? g(n) : `${Math.round(n)} u`
          return (
            <div key={l.id}
              className={`rounded-lg border p-3 ${queda > 0
                ? 'border-[#2a2a3a] bg-[#15151d]' : 'border-[#2a2a3a]/60 bg-[#101017] opacity-60'}`}>
              <div className="flex flex-wrap items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#ececf1] break-words">
                    {l.producto || 'Sin producto'}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#8a8a9c] break-all">
                    <Package className="w-3 h-3 flex-shrink-0" /> {l.codigo}
                    {l.origen === 'propio' && <span className="text-[#a3e635]">· propio</span>}
                    {l.origen === 'propio_sin_cosecha' && <span className="text-[#f59e0b]">· propio sin cosecha</span>}
                  </p>
                  {(l.thc_pct != null || l.cbd_pct != null) && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#8a8a9c]">
                      <FlaskConical className="w-3 h-3 flex-shrink-0" />
                      {l.thc_pct != null && `THC ${l.thc_pct}%`}
                      {l.thc_pct != null && l.cbd_pct != null && ' · '}
                      {l.cbd_pct != null && `CBD ${l.cbd_pct}%`}
                    </p>
                  )}
                </div>
                {/* `w-full sm:w-auto sm:ml-auto`: con `ml-auto` solo, cuando no
                    entra en la fila cae a un renglón propio pegado a la derecha,
                    con aire muerto al lado. Ver §7.12-bis del traspaso. */}
                <div className="w-full sm:w-auto sm:ml-auto text-left sm:text-right">
                  <p className={`text-[15px] font-display font-bold ${
                    queda > 0 ? 'text-[#ececf1]' : queda < 0 ? 'text-[#ff8a7a]' : 'text-[#8a8a9c]'}`}>
                    {fmt(queda)}
                  </p>
                  <p className="text-[11px] text-[#8a8a9c]">
                    de {fmt(Number(l.gramos_totales) || 0)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
