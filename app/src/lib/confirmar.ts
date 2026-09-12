// Confirmar una acción desde fuera de React.
//
// POR QUE EXISTE. Habia 23 `window.confirm()` repartidos en dieciseis archivos,
// casi todos para borrar algo. Ese dialogo es del navegador y en un telefono
// puede NO APARECER — y cuando no aparece devuelve `false`, asi que el boton no
// hacia nada y tampoco decia por que. Gaston se choco con eso queriendo borrar
// una entrega de prueba: tocaba la papelera y no pasaba nada.
//
// `useConfirm` es la forma correcta, pero es un hook: para usarlo en los 23
// sitios habria que tocar la estructura de dieciseis componentes, y un hook mal
// puesto —dentro de un handler, detras de un return temprano— rompe React de
// formas que no siempre fallan en el acto. Esto deja el reemplazo mecanico:
// cambia la llamada y nada mas.
//
// POR QUE EN `lib/` Y NO ADENTRO DE `useConfirm.tsx`. Ahi vive `ConfirmProvider`,
// que es un componente, y un archivo que exporta un componente Y funciones rompe
// el fast refresh de Vite: al editarlo se recarga la pagina entera en vez de
// actualizar el componente. El lint lo marca y tiene razon.

export type VarianteConfirm = 'default' | 'destructive' | 'warning'

export interface ConfirmOptions {
  titulo: string
  descripcion?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: VarianteConfirm
}

export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

/** Lo publica `ConfirmProvider` al montarse; queda en null si no hay provider. */
let confirmarExterno: ConfirmFn | null = null

/** Sólo para `ConfirmProvider`. Devuelve la función que lo desregistra. */
export function registrarConfirm(fn: ConfirmFn): () => void {
  confirmarExterno = fn
  return () => { if (confirmarExterno === fn) confirmarExterno = null }
}

// El fallback al dialogo nativo NO es el bug de vuelta: sin provider montado no
// hay UI donde dibujar el modal, y quedarse sin preguntar antes de borrar seria
// peor que preguntar mal. En la app el provider esta montado en `main`, asi que
// en la practica nunca cae aca; queda para los tests y para un render aislado.
const nativo = (o: ConfirmOptions) =>
  Promise.resolve(window.confirm(o.descripcion ? `${o.titulo}\n\n${o.descripcion}` : o.titulo))

/** Confirmación de borrado: botón rojo y la palabra «Borrar». */
export function confirmarBorrado(titulo: string, descripcion?: string): Promise<boolean> {
  const opts: ConfirmOptions = { titulo, descripcion, confirmLabel: 'Borrar', variant: 'destructive' }
  return confirmarExterno ? confirmarExterno(opts) : nativo(opts)
}

/** Confirmación de una acción que no borra nada, pero tampoco es gratis. */
export function confirmarAccion(opts: ConfirmOptions): Promise<boolean> {
  return confirmarExterno ? confirmarExterno(opts) : nativo(opts)
}
