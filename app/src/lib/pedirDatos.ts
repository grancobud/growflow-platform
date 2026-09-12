// Pedir datos por teclado desde fuera de React.
//
// POR QUE EXISTE. Es la otra mitad de `confirmar.ts`, y por el mismo motivo:
// quedaban cuatro `window.prompt()` vivos —dos en Sala, uno en Solicitudes, uno
// en Instalaciones— y ese dialogo es del navegador. En un telefono puede NO
// APARECER, y cuando no aparece devuelve `null`: el boton no hace nada y tampoco
// dice por que. Es el mismo bug que ya costo los 23 `window.confirm()`, con el
// agravante de que aca ademas se pierde lo que la persona iba a escribir.
//
// Y hay una segunda razon que el confirm no tenia: `prompt` no valida nada.
// «Crear grupo» pedia nombre y sustrato en DOS dialogos encadenados, asi que
// cancelar el segundo dejaba el primero escrito y tirado. Un formulario de dos
// campos se contesta o no se contesta: por eso `campos` es una lista y se
// resuelve en un solo dialogo.
//
// POR QUE EN `lib/` Y NO ADENTRO DE `useConfirm.tsx`. Ahi vive el provider, que
// es un componente, y un archivo que exporta un componente Y funciones rompe el
// fast refresh de Vite. Mismo motivo que `confirmar.ts`.

export interface CampoTexto {
  /** Clave con la que vuelve el valor. */
  nombre: string
  etiqueta: string
  placeholder?: string
  valorInicial?: string
  /** Por defecto true. En false se puede aceptar vacio y vuelve ''. */
  requerido?: boolean
  multilinea?: boolean
}

export interface PedirDatosOptions {
  titulo: string
  descripcion?: string
  campos: CampoTexto[]
  confirmLabel?: string
}

export type PedirDatosFn = (opts: PedirDatosOptions) => Promise<Record<string, string> | null>

/** Lo publica `ConfirmProvider` al montarse; queda en null si no hay provider. */
let pedirExterno: PedirDatosFn | null = null

/** Solo para `ConfirmProvider`. Devuelve la funcion que lo desregistra. */
export function registrarPedirDatos(fn: PedirDatosFn): () => void {
  pedirExterno = fn
  return () => { if (pedirExterno === fn) pedirExterno = null }
}

// El fallback al dialogo nativo NO es el bug de vuelta: sin provider montado no
// hay UI donde dibujar el modal, y perder la accion en silencio seria peor que
// pedirla mal. En la app el provider esta montado en `main`, asi que en la
// practica nunca cae aca; queda para los tests y para un render aislado.
function nativo(o: PedirDatosOptions): Promise<Record<string, string> | null> {
  const out: Record<string, string> = {}
  for (const c of o.campos) {
    const v = window.prompt(c.etiqueta, c.valorInicial ?? '')
    if (v === null) return Promise.resolve(null)
    const t = v.trim()
    if (!t && c.requerido !== false) return Promise.resolve(null)
    out[c.nombre] = t
  }
  return Promise.resolve(out)
}

/** Un formulario corto en un modal. `null` = la persona cancelo. */
export function pedirDatos(opts: PedirDatosOptions): Promise<Record<string, string> | null> {
  return pedirExterno ? pedirExterno(opts) : nativo(opts)
}

/** Azucar para el caso de un solo campo. Devuelve el texto ya trimeado, o null. */
export async function pedirTexto(
  titulo: string, campo: Omit<CampoTexto, 'nombre'> & { descripcion?: string },
): Promise<string | null> {
  const { descripcion, ...resto } = campo
  const r = await pedirDatos({ titulo, descripcion, campos: [{ nombre: 'valor', ...resto }] })
  return r ? r.valor : null
}
