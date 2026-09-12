import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Trash2, Info, X, PencilLine } from 'lucide-react'
import { useDialogo } from '../lib/useDialogo'
import { registrarConfirm, type ConfirmFn, type ConfirmOptions, type VarianteConfirm } from '../lib/confirmar'
import { registrarPedirDatos, type PedirDatosFn, type PedirDatosOptions } from '../lib/pedirDatos'


const ConfirmCtx = createContext<ConfirmFn | null>(null)

// El archivo exporta el hook Y el provider, y el fast refresh de Vite pide que
// un archivo exporte sólo componentes. Es deliberado: el hook y su provider son
// dos mitades de la misma pieza y separarlos deja un archivo de una línea que
// hay que ir a buscar. Las FUNCIONES sueltas sí se sacaron, y viven en
// `lib/confirmar.ts` y `lib/pedirDatos.ts` — ver el porqué escrito ahí.
// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmCtx)
  if (!fn) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>')
  return fn
}

/**
 * El armazon del dialogo, compartido por el de confirmar y el de pedir datos.
 *
 * Se extrajo al sumar el segundo: eran cuarenta lineas de JSX -el velo, el click
 * afuera, el foco, la cabecera con icono, el pie- y copiarlas dejaba dos modales
 * que se iban a separar al primer retoque de estilo.
 */
function MarcoDialogo({ titulo, descripcion, Icon, iconBg, onCerrar, onEnter, children, pie, refDialogo }: {
  titulo: string; descripcion?: string
  Icon: typeof Info; iconBg: string
  onCerrar: () => void
  /** Enter acepta. En el de texto no cierra si el formulario no esta completo. */
  onEnter: () => void
  children?: ReactNode
  pie: ReactNode
  /**
   * El ref de `useDialogo`, que lo crea el que abre.
   *
   * Acá el hook no puede vivir adentro del marco: son DOS diálogos —confirmar y
   * pedir datos— con estados distintos, cada uno con su `activo`, y los dos
   * dibujan este mismo marco. Es el único de los 37 donde el hook y el elemento
   * viven en componentes distintos a propósito.
   */
  refDialogo: React.Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={refDialogo}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-titulo"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && onCerrar()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCerrar()
        if (e.key === 'Enter' && !e.shiftKey) onEnter()
      }}
    >
      <div className="bg-white dark:bg-surface-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-5 flex gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-titulo" className="text-base font-semibold text-surface-900 dark:text-surface-100">
              {titulo}
            </h3>
            {descripcion && (
              <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">{descripcion}</p>
            )}
            {children}
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mt-1 -mr-1 self-start min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-200/60 dark:hover:bg-surface-700/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-3 bg-surface-50 dark:bg-surface-800/50 flex justify-end gap-2">{pie}</div>
      </div>
    </div>
  )
}

const btnCancelar = 'px-3 py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium rounded-lg text-surface-700 dark:text-surface-300 hover:bg-surface-200/60 dark:hover:bg-surface-700/60 transition-colors'

/**
 * El formulario corto de `pedirDatos`.
 *
 * Va en un componente aparte y no inline en el provider para que el estado de
 * los campos NAZCA Y MUERA con el dialogo: montado con `key` distinta por
 * pedido, no hay forma de que lo escrito en un modal aparezca en el siguiente.
 */
function FormularioPedido({ opts, onResolver, refDialogo }: {
  opts: PedirDatosOptions
  onResolver: (v: Record<string, string> | null) => void
  refDialogo: React.Ref<HTMLDivElement>
}) {
  const [vals, setVals] = useState<Record<string, string>>(
    () => Object.fromEntries(opts.campos.map(c => [c.nombre, c.valorInicial ?? ''])))

  // Un campo requerido vacio no habilita el boton, en vez de aceptar y fallar
  // despues contra la base con un mensaje que no dice cual falto.
  const completo = opts.campos.every(c => c.requerido === false || vals[c.nombre]?.trim())
  const aceptar = () => {
    if (!completo) return
    onResolver(Object.fromEntries(opts.campos.map(c => [c.nombre, (vals[c.nombre] ?? '').trim()])))
  }

  const campoCls = 'w-full mt-1 px-3 py-2 min-h-[44px] rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-[16px] sm:text-sm text-surface-900 dark:text-surface-100 focus:outline-none focus:border-primary-500'

  return (
    <MarcoDialogo
      refDialogo={refDialogo}
      titulo={opts.titulo} descripcion={opts.descripcion}
      Icon={PencilLine}
      iconBg="bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
      onCerrar={() => onResolver(null)}
      onEnter={aceptar}
      pie={
        <>
          <button onClick={() => onResolver(null)} className={btnCancelar}>Cancelar</button>
          <button
            onClick={aceptar}
            disabled={!completo}
            className="px-3 py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium rounded-lg transition-colors bg-primary-700 hover:bg-primary-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {opts.confirmLabel ?? 'Guardar'}
          </button>
        </>
      }
    >
      <div className="mt-3 space-y-3">
        {opts.campos.map((c, i) => (
          <label key={c.nombre} className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-surface-500 dark:text-surface-400 font-medium">
              {c.etiqueta}{c.requerido === false ? ' (opcional)' : ''}
            </span>
            {c.multilinea ? (
              <textarea
                autoFocus={i === 0} rows={3} className={campoCls} placeholder={c.placeholder}
                value={vals[c.nombre] ?? ''}
                onChange={e => setVals(v => ({ ...v, [c.nombre]: e.target.value }))}
              />
            ) : (
              <input
                autoFocus={i === 0} className={campoCls} placeholder={c.placeholder}
                value={vals[c.nombre] ?? ''}
                onChange={e => setVals(v => ({ ...v, [c.nombre]: e.target.value }))}
              />
            )}
          </label>
        ))}
      </div>
    </MarcoDialogo>
  )
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((v: boolean) => void) | null>(null)

  // El de pedir datos lleva su propio estado y su propio resolver: los dos
  // pueden convivir (una confirmacion que abre un formulario) y compartir el
  // resolver haria que cerrar uno contestara por el otro.
  const [pedido, setPedido] = useState<PedirDatosOptions | null>(null)
  const [nPedido, setNPedido] = useState(0)
  const resolverPedido = useRef<((v: Record<string, string> | null) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const pedir = useCallback<PedirDatosFn>((options) => {
    setPedido(options)
    setNPedido(n => n + 1)
    return new Promise<Record<string, string> | null>((resolve) => {
      resolverPedido.current = resolve
    })
  }, [])

  // Se publican para `confirmarBorrado` / `confirmarAccion` / `pedirDatos`, que
  // corren fuera de React. Se limpian al desmontar para no dejar apuntando a un
  // provider muerto.
  useEffect(() => registrarConfirm(confirm), [confirm])
  useEffect(() => registrarPedirDatos(pedir), [pedir])

  const cerrar = (valor: boolean) => {
    setOpen(false)
    resolverRef.current?.(valor)
    resolverRef.current = null
    setTimeout(() => setOpts(null), 200)
  }

  const cerrarPedido = (valor: Record<string, string> | null) => {
    resolverPedido.current?.(valor)
    resolverPedido.current = null
    setPedido(null)
  }

  // El atras del telefono es "no": cancelar es siempre la salida segura.
  // Va DESPUES de `cerrar`: llamarlo antes lo deja capturando una funcion que
  // todavia no existe, y el lint de React lo marca.
  const refConfirmar = useDialogo(() => cerrar(false), open)
  const refPedido = useDialogo(() => cerrarPedido(null), pedido != null)

  const variant: VarianteConfirm = opts?.variant ?? 'default'
  const Icon = variant === 'destructive' ? Trash2 : variant === 'warning' ? AlertTriangle : Info
  const iconBg =
    variant === 'destructive'
      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
      : variant === 'warning'
      ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
      : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
  const confirmBtn =
    variant === 'destructive'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : 'bg-primary-700 hover:bg-primary-800 text-white'

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {open && opts && (
        <MarcoDialogo
          refDialogo={refConfirmar}
          titulo={opts.titulo} descripcion={opts.descripcion}
          Icon={Icon} iconBg={iconBg}
          onCerrar={() => cerrar(false)}
          onEnter={() => cerrar(true)}
          pie={
            <>
              <button onClick={() => cerrar(false)} className={btnCancelar}>
                {opts.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                onClick={() => cerrar(true)}
                autoFocus
                className={`px-3 py-1.5 min-h-[44px] sm:min-h-0 text-sm font-medium rounded-lg transition-colors ${confirmBtn}`}
              >
                {opts.confirmLabel ?? 'Confirmar'}
              </button>
            </>
          }
        />
      )}
      {/* `key` por pedido: remonta el formulario y con el se va lo escrito.
          Sin eso, cancelar "Crear grupo" y volver a abrirlo lo mostraria con el
          nombre del intento anterior ya cargado. */}
      {pedido && (
        <FormularioPedido key={nPedido} opts={pedido} onResolver={cerrarPedido} refDialogo={refPedido} />
      )}
    </ConfirmCtx.Provider>
  )
}
