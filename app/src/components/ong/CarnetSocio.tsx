/**
 * EL CARNET DE SOCIO, en pantalla y en papel.
 *
 * Tamaño tarjeta (85,6 × 54 mm, el de una credencial), para que se imprima y
 * entre en una billetera. En el teléfono se muestra igual y alcanza con
 * mostrarlo.
 *
 * ⚠️ EL ESTADO DEL REPROCANN VA EN EL CARNET, y con color. Una credencial que
 * dice «REPROCANN XXXXX» sin decir que venció el mes pasado se usa para
 * retirar material que ya no está amparado por la 27.350, y el papel es
 * justamente lo que hace que nadie lo mire dos veces.
 */
import { useState } from 'react'
import { IdCard, Printer, AlertTriangle, X } from 'lucide-react'
import QR from '../QR'
import {
  armarCarnet, labelCredencial, habilitaRetiro, type CarnetSocio as Datos,
} from '../../lib/carnetSocio'
import type { Paciente } from '../../lib/registro'
import type { Entidad } from '../../lib/ong'
import { btnPrimario, btnSutil } from '../../lib/ui'
import { useDialogo } from '../../lib/useDialogo'

const COLOR: Record<string, string> = {
  vigente: '#a3e635', por_vencer: '#facc15', vencida: '#ff8a7a', sin_registro: '#8a8a9c',
}
/** Con `??`: un estado nuevo en la base tiene que salir con color, no undefined. */
const colorDe = (e: string) => COLOR[e] ?? COLOR.sin_registro

const fmt = (f?: string | null) =>
  f ? new Date(f + 'T00:00:00').toLocaleDateString('es-AR') : null

/** La tarjeta. Se usa en pantalla y se vuelve a dibujar para imprimir. */
function Tarjeta({ c }: { c: Datos }) {
  return (
    <div className="rounded-xl border border-[#2a2a3a] bg-gradient-to-br from-[#15151d] to-[#101016] p-4"
      style={{ aspectRatio: '85.6 / 54' }}>
      <div className="flex h-full gap-3">
        <div className="flex-1 min-w-0 flex flex-col">
          <p className="text-[9px] uppercase tracking-[0.14em] text-[#8a8a9c] truncate">
            {c.entidad ?? '— falta la razón social —'}
          </p>
          <p className="mt-2 text-[15px] leading-tight text-[#ececf1] font-display font-semibold break-words">
            {c.nombre}
          </p>
          <p className="mt-1 text-[11px] text-[#a6a6b5]">
            {c.dni ? `DNI ${c.dni}` : <span className="text-[#ff8a7a]">— falta el DNI —</span>}
          </p>
          <div className="mt-auto">
            <p className="text-[11px] font-mono" style={{ color: colorDe(c.estado) }}>
              {labelCredencial(c.estado)}
              {c.reprocannNro && <span className="text-[#a6a6b5]"> · {c.reprocannNro}</span>}
            </p>
            {c.vencimiento && (
              <p className="text-[9px] text-[#8a8a9c]">
                {c.estado === 'vencida' ? 'Venció el' : 'Vence el'} {fmt(c.vencimiento)}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-center justify-between">
          {c.qr
            ? <div className="bg-white p-1 rounded"><QR value={c.qr} size={72} /></div>
            : <div className="w-[80px] h-[80px] rounded border border-dashed border-[#3a3a4a] grid place-items-center text-[8px] text-[#8a8a9c] text-center px-1">
                sin código
              </div>}
          <p className="mt-1 font-mono text-[11px] text-[#d9f99d]">{c.codigo ?? '—'}</p>
        </div>
      </div>
    </div>
  )
}

export function CarnetSocio({ paciente, entidad, onCerrar }: {
  paciente: Paciente
  entidad: Entidad | null
  onCerrar: () => void
}) {
  const refDialogo = useDialogo(onCerrar)
  const [hoy] = useState(() => new Date().toISOString().slice(0, 10))
  const c = armarCarnet(paciente, entidad, hoy)

  /**
   * Imprimir. Se redibuja en HTML plano en vez de usar `window.print()` sobre
   * la pantalla: acá se necesita el tamaño exacto de la tarjeta y sin el resto
   * de la app alrededor.
   */
  const imprimir = () => {
    const w = window.open('', '_blank', 'width=820,height=620')
    if (!w) return
    const esc = (s: string) => s.replace(/[&<>"]/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] as string))
    // El QR ya está dibujado en pantalla: se copia ese mismo SVG en vez de
    // volver a generarlo, así el papel y la pantalla no pueden diferir.
    const svg = document.getElementById('carnet-qr')?.innerHTML ?? ''
    w.document.write([
      '<!doctype html><html lang="es"><head><meta charset="utf-8">',
      `<title>Carnet ${esc(c.codigo ?? '')}</title><style>`,
      '@page{size:auto;margin:12mm}',
      'body{font-family:system-ui,sans-serif;margin:0;color:#1c1917}',
      '.c{width:85.6mm;height:54mm;border:1px solid #d6d3d1;border-radius:3mm;',
      'padding:5mm;box-sizing:border-box;display:flex;gap:4mm}',
      '.e{font-size:6.5pt;text-transform:uppercase;letter-spacing:.9px;color:#78716c}',
      '.n{font-size:11pt;font-weight:600;margin-top:2mm;line-height:1.2}',
      '.d{font-size:8pt;color:#57534e;margin-top:1mm}',
      '.r{font-size:8pt;font-family:ui-monospace,monospace;margin-top:auto}',
      '.v{font-size:6.5pt;color:#78716c}',
      '.q{margin-left:auto;text-align:center}',
      '.cod{font-family:ui-monospace,monospace;font-size:8pt;margin-top:1mm}',
      '.falta{color:#b91c1c}',
      '</style></head><body><div class="c">',
      '<div style="display:flex;flex-direction:column;flex:1;min-width:0">',
      `<div class="e">${esc(c.entidad ?? '— falta la razón social —')}</div>`,
      `<div class="n">${esc(c.nombre)}</div>`,
      c.dni ? `<div class="d">DNI ${esc(c.dni)}</div>`
        : '<div class="d falta">— falta el DNI —</div>',
      `<div class="r">${esc(labelCredencial(c.estado))}`,
      c.reprocannNro ? ` · ${esc(c.reprocannNro)}` : '',
      '</div>',
      c.vencimiento
        ? `<div class="v">${c.estado === 'vencida' ? 'Venció el' : 'Vence el'} ${esc(fmt(c.vencimiento) ?? '')}</div>`
        : '',
      '</div>',
      `<div class="q">${svg}<div class="cod">${esc(c.codigo ?? '—')}</div></div>`,
      '</div></body></html>',
    ].join(''))
    w.document.close(); w.focus()
    setTimeout(() => w.print(), 250)
  }

  return (
    <div ref={refDialogo} className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-[#0f0f16] border border-[#2a2a3a] rounded-t-2xl sm:rounded-2xl p-4 max-h-[90vh] overflow-y-auto">
        {/* Las DOS salidas: la X acá arriba y el botón al pie. En un teléfono la
            X queda lejos del pulgar, y el botón de abajo a veces no se ve sin
            scrollear. */}
        <div className="flex items-center gap-2 mb-3">
          <IdCard className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Carnet de socio</h3>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="ml-auto w-11 h-11 -mr-2 grid place-items-center text-[#8a8a9c] hover:text-[#ececf1]">
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>

        {/* El QR con un id, para poder copiar el mismo SVG al imprimir. */}
        <div id="carnet-qr" className="hidden">{c.qr && <QR value={c.qr} size={150} />}</div>

        <Tarjeta c={c} />

        {!habilitaRetiro(c) && (
          <p className="mt-3 flex gap-2 text-[12px] text-[#ff8a7a]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.8} />
            <span>
              {c.estado === 'vencida'
                ? 'La credencial está vencida: lo que se le entregue no está amparado por la 27.350.'
                : 'Sin REPROCANN registrado. El carnet identifica a la persona, pero no acredita habilitación.'}
            </span>
          </p>
        )}

        {c.faltantes.length > 0 && (
          <p className="mt-2 text-[12px] text-[#8a8a9c]">
            Sale incompleto: falta {c.faltantes.join(', ')}. Se imprime igual —la persona es socia— y
            el hueco queda a la vista para que alguien lo complete.
          </p>
        )}

        <p className="mt-3 text-[11px] text-[#8a8a9c]">
          El QR lleva el código del socio: se lee con el escáner de la app y trae su ficha.
        </p>

        <div className="mt-4 flex gap-2">
          <button className={btnPrimario} onClick={imprimir}>
            <Printer className="w-4 h-4 inline mr-1.5" strokeWidth={1.8} />Imprimir
          </button>
          <button className={btnSutil} onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
