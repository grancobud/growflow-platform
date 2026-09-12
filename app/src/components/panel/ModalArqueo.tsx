// CONTAR LA CAJA Y EL STOCK, Y QUE QUEDE.
//
// Es el paso que convierte al panel en un control. Hasta ahora mostraba cuánto
// debería haber y ahí terminaba: si alguien lo miró, si cuadró, si faltaba
// algo, no quedaba en ningún lado.
//
// Socio lo pidió el 02/09/2026 con el problema puesto: «hay veces que hay una
// merma, le pregunto a Socio, no sacó, yo no saqué, no sabemos dónde va». Ese
// «no sabemos» es literal — no hay ningún momento registrado en el que alguien
// haya dicho «había tanto».
//
// LA DIFERENCIA SE MUESTRA MIENTRAS SE ESCRIBE, no al guardar. Quien cuenta
// tiene la plata en la mano: si el número no cuadra, lo que hay que hacer es
// volver a contar AHÍ, no enterarse después. Un arqueo que sólo avisa al final
// convierte un error de conteo en una merma registrada.
//
// Y NO SE ACUSA A NADIE. El formulario pide qué se contó y por qué no cuadra;
// no pregunta quién se lo llevó. Hoy esa merma la absorbe Socio como faltante de
// su plata, y un sistema que automatice esa imputación deja de cargarse la
// primera vez que alguien discuta un número — y entonces no queda ni el
// registro, que era lo único que se estaba ganando.

import { useState } from 'react'
import { toast } from 'sonner'
import { Wallet, Package, Check, X } from 'lucide-react'
import { useDialogo } from '../../lib/useDialogo'
import { btnPrimario, btnSutil, etiquetaCampo, inputFormulario, rotuloSeccion, sinAutocorreccion } from '../../lib/ui'
import { arqueosService, diferencia, cuadra, TOLERANCIA_GRAMOS } from '../../lib/arqueos'

const fmtPesos = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

/** Texto vacío = no se contó. Es distinto de haber contado cero. */
const aNumero = (s: string): number | null => {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/**
 * Una línea: lo que decía el sistema, lo que se contó, y la diferencia.
 *
 * La diferencia aparece sólo cuando hay algo contado. Antes de eso no se dibuja
 * un cero verde, porque «cuadra» y «todavía no contaste» no son lo mismo y el
 * verde es justamente lo que se busca al llegar al final.
 */
function Linea({ rotulo, esperado, valor, onCambio, sufijo, tolerancia, formato }: {
  rotulo: string
  esperado: number | null
  valor: string
  onCambio: (v: string) => void
  sufijo: string
  tolerancia: number
  formato: (n: number) => string
}) {
  const contado = aNumero(valor)
  const dif = diferencia(esperado, contado)
  const ok = cuadra(dif, tolerancia)
  const id = `arqueo-${rotulo.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <div className="py-3 border-t border-[#1f1f2b] first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-2">
        <label className={etiquetaCampo} htmlFor={id}>{rotulo}</label>
        <span className="text-[11px] text-[#8a8a9c] tabular-nums">
          el sistema dice {esperado == null ? '—' : formato(esperado)}
        </span>
      </div>
      <input id={id} type="text" inputMode="decimal" {...sinAutocorreccion}
        className={inputFormulario} placeholder={`Lo que contaste, en ${sufijo}`}
        value={valor} onChange={e => onCambio(e.target.value)} />
      {dif != null && (
        <p className={`mt-1.5 text-[11px] font-medium tabular-nums ${ok ? 'text-[#bef264]' : 'text-[#ff8a7a]'}`}>
          {ok
            ? <><Check aria-hidden className="w-3 h-3 inline mr-1" strokeWidth={2.4} />Cuadra</>
            : `${dif > 0 ? 'Sobran' : 'Faltan'} ${formato(Math.abs(dif))}`}
        </p>
      )}
    </div>
  )
}

export function ModalArqueo({ esperado, onCerrar, onListo }: {
  esperado: { efectivo: number | null; transferencia: number | null; stockG: number | null }
  onCerrar: () => void
  onListo: () => void
}) {
  const refDialogo = useDialogo(onCerrar)
  const [efectivo, setEfectivo] = useState('')
  const [transferencia, setTransferencia] = useState('')
  const [stock, setStock] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  const contadoAlgo = [efectivo, transferencia, stock].some(v => aNumero(v) != null)

  const guardar = async () => {
    if (!contadoAlgo) { toast.error('Cargá al menos un valor contado'); return }
    setGuardando(true)
    try {
      await arqueosService.arquear({
        momento: new Date().toISOString(),
        esperado_efectivo: esperado.efectivo,
        esperado_transferencia: esperado.transferencia,
        esperado_stock_g: esperado.stockG,
        contado_efectivo: aNumero(efectivo),
        contado_transferencia: aNumero(transferencia),
        contado_stock_g: aNumero(stock),
        nota: nota.trim() || null,
      })
      toast.success('Control registrado')
      onListo()
      onCerrar()
    } catch (e) {
      toast.error(`No se pudo registrar: ${(e as Error).message}`)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div ref={refDialogo}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onCerrar}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#1f1f2b] sticky top-0 bg-[#0d0d12] flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Controlar caja y stock</h3>
            <p className="text-[11px] text-[#8a8a9c] mt-0.5 [text-wrap:pretty]">
              Contá lo que hay y anotalo. Queda registrado con la fecha y con tu nombre.
            </p>
          </div>
          {/* La X arriba, además del «Cancelar» del pie. En el teléfono el modal
              ocupa casi todo el alto y el pie puede quedar debajo del teclado:
              la salida tiene que estar donde el pulgar llega sin scrollear. */}
          <button onClick={onCerrar} aria-label="Cerrar"
            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <span className={rotuloSeccion}>
            <Wallet aria-hidden className="w-3 h-3 inline mr-1" /> La caja
          </span>
          <div className="mt-1.5">
            <Linea rotulo="Efectivo" esperado={esperado.efectivo} valor={efectivo}
              onCambio={setEfectivo} sufijo="pesos" tolerancia={0} formato={fmtPesos} />
            <Linea rotulo="Transferencia" esperado={esperado.transferencia} valor={transferencia}
              onCambio={setTransferencia} sufijo="pesos" tolerancia={0} formato={fmtPesos} />
          </div>

          <span className={`${rotuloSeccion} block mt-4`}>
            <Package aria-hidden className="w-3 h-3 inline mr-1" /> El stock
          </span>
          <div className="mt-1.5">
            {/* Sólo el total en gramos: contar lote por lote en el mostrador es
                una tarea de media hora, y el arqueo tiene que caber en el rato
                que hay al abrir. Si el total no cuadra, la nota dice dónde
                mirar y el catálogo tiene el detalle. */}
            <Linea rotulo="Total en gramos" esperado={esperado.stockG} valor={stock}
              onCambio={setStock} sufijo="gramos" tolerancia={TOLERANCIA_GRAMOS}
              formato={n => `${n.toLocaleString('es-AR')} g`} />
          </div>

          <div className="mt-4">
            <label className={etiquetaCampo} htmlFor="arqueo-nota">Nota (opcional)</label>
            <input id="arqueo-nota" className={inputFormulario} value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Si algo no cuadra, qué pasó" />
            <p className="mt-1 text-[10.5px] text-[#8a8a9c] [text-wrap:pretty]">
              Lo que no cuadre queda anotado como diferencia. Sirve para saber dónde
              mirar, no para cargárselo a nadie.
            </p>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[#1f1f2b] flex gap-2 sticky bottom-0 bg-[#0d0d12]">
          <button onClick={onCerrar} className={btnSutil}>Cancelar</button>
          <button onClick={guardar} disabled={guardando || !contadoAlgo}
            className={`${btnPrimario} flex-1`}>
            {guardando ? 'Registrando…' : 'Registrar el control'}
          </button>
        </div>
      </div>
    </div>
  )
}
