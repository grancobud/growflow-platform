// Componente QR compartido. react-qr-code 2.0.18 es CJS y Vite lo doble-wrappea,
// asi que resolvemos el componente de forma robusta (mismo criterio que PaginaEtiquetasQR).
import * as ReactQRCode from 'react-qr-code'

type Quizas = { $$typeof?: unknown; render?: unknown; prototype?: { render?: unknown }
  default?: Quizas & { QRCode?: Quizas }; QRCode?: Quizas }
const isComponent = (x: unknown): boolean => {
  if (!x) return false
  if (typeof x === 'function') return true
  const o = x as Quizas
  return typeof x === 'object' && Boolean(o.$$typeof || o.render || o.prototype?.render)
}
const _m = ReactQRCode as unknown as Quizas
// El cast final va UNA vez y con el motivo escrito: `isComponent` ya verifico
// en tiempo de ejecucion que lo que salga de la cadena sea un componente, y
// eso el compilador no lo puede saber solo.
const QRCodeBase = (
  (isComponent(_m) && _m) ||
  (isComponent(_m.default) && _m.default) ||
  (isComponent(_m.default?.default) && _m.default?.default) ||
  (isComponent(_m.default?.QRCode) && _m.default?.QRCode) ||
  (isComponent(_m.QRCode) && _m.QRCode) ||
  (() => null)
) as React.ComponentType<Record<string, unknown>>

export default function QR({ value, size = 128 }: { value: string; size?: number }) {
  return (
    <div className="inline-block bg-white p-2 rounded-lg">
      <QRCodeBase value={value} size={size} level="M" />
    </div>
  )
}
