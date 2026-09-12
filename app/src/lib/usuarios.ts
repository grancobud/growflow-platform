// Quién puede entrar al sistema, y con qué rol.
//
// DE LAS CUATRO COSAS QUE SE HACEN ACA, UNA SOLA PASA POR UNA FUNCION
//
// Listar, cambiar el rol y activar/desactivar son `select` y `update` comunes:
// las autoriza el RLS que ya estaba —`perfiles_admin` deja hacer TODO a quien
// `es_admin()`, y `perfiles_ver` deja que cada uno vea su propia fila—. Meterlas
// en una función con service role sería agrandar esa superficie para resolver
// algo que la base ya resuelve.
//
// Invitar es la excepción: crear una cuenta necesita `auth.admin`, que no existe
// con la clave anónima. Eso, y sólo eso, va por `usuarios-invitar`.
//
// EL MAIL SE GUARDA EN EL PERFIL a propósito. Vive en `auth.users`, que no es
// legible desde el navegador; copiarlo al perfil cuando se invita deja el
// listado como un `select` normal. Ver la migración `el_email_en_el_perfil`.

import { supabase } from './supabase'
import type { PerfilUsuario, RolUsuario } from '../types'

export interface Usuario extends PerfilUsuario {
  email: string | null
}

/**
 * Los roles que se pueden asignar hoy, con lo que cada uno ve.
 *
 * `operador` y `supervisor` NO están: se conservan en `PERMISOS_ROL` para las
 * filas que ya los tienen, pero ofrecerlos sería repartir roles que quedaron
 * viejos. El texto de cada uno sale de sus permisos reales en `useAuth`, no de
 * lo que suene bien: si mañana cambian los permisos, esto miente.
 */
export const ROLES_ASIGNABLES: { id: RolUsuario; label: string; que: string }[] = [
  { id: 'administrador', label: 'Administrador',
    que: 'Todo, y además puede sumar y sacar usuarios.' },
  { id: 'administrador_sistema', label: 'Administrador de sistema',
    que: 'Ve y administra todo, igual que el administrador: cultivo, pacientes, caja, '
      + 'costos y usuarios. Es la llave completa.' },
  { id: 'administrativo', label: 'Administrativo',
    que: 'Cuotas, caja, documentos y costos, y el padrón completo. No ve el seguimiento clínico.' },
  { id: 'mostrador', label: 'Mostrador',
    que: 'Abre la sede: toma los valores de la sala, controla caja y stock, entrega, '
      + 'cobra y anota visitas. No ve el cultivo, ni el estatuto, ni las fichas clínicas.' },
  { id: 'cultivador', label: 'Cultivador',
    que: 'La sala: plantas, riegos, ambiente y cosecha. No ve fichas ni plata.' },
  { id: 'director_cultivo', label: 'Director de cultivo',
    que: 'Todo lo del cultivador, y además lo que hay que firmar por él: traslados, '
      + 'declaraciones juradas, predios y el cupo. No ve fichas ni plata.' },
  { id: 'director_medico', label: 'Director médico',
    que: 'Pacientes, seguimiento e informes. Mira el cultivo pero no lo toca, y no ve plata.' },
  { id: 'auditor', label: 'Auditor',
    que: 'Entra a mirar: todo lo que no es dato de salud, y no modifica nada.' },
  { id: 'demo', label: 'Demo',
    que: 'La cuenta de muestra: ve las pantallas reales vacías, sin un solo dato.' },
]

/**
 * Si a esta persona se la puede eliminar en vez de desactivar.
 *
 * A cualquiera menos a un `administrador`. Ése es el rol de la cuenta de la
 * asociación: borrarlo es la única forma de quedarse sin nadie que administre, y
 * desde adentro de la app no habría vuelta. `administrador_sistema` SÍ se puede
 * borrar —es una persona que administra—, y ésa es la única diferencia real
 * entre dos roles que en permisos son idénticos.
 *
 * HASTA EL 31/08/2026 LA REGLA ERA OTRA: sólo se borraba a quien nunca había
 * entrado, para no perder su firma en lo que cargó. Gastón decidió abrirlo. Lo
 * que sostiene ahora esa preocupación no es el botón sino dos cosas: el aviso
 * que dice cuántas filas quedan sin autor antes de confirmar, y que las FK de
 * `ong_lotes` y `ong_pedidos` dejaron de ser CASCADE —lo eran, y borrar una
 * cuenta le borraba los lotes—.
 *
 * Desactivar sigue siendo lo correcto para quien trabajó: no entra más y todo
 * lo suyo conserva su nombre.
 */
export const sePuedeEliminar = (u: { rol?: string | null }): boolean =>
  u.rol !== 'administrador'

/**
 * Las tablas donde una fila lleva el nombre de quien la cargo.
 *
 * Se cuentan para poder DECIR que se pierde antes de borrar, no para impedirlo.
 * Son las que un libro tiene que poder mostrar en una inspeccion; el resto
 * (nutrientes, instalacion, tableros) no cambia lo que alguien decide.
 */
export const TABLAS_CON_AUTOR = [
  { tabla: 'ong_lotes', que: 'lote' },
  { tabla: 'ong_dispensas', que: 'entrega' },
  { tabla: 'ong_documentos', que: 'comprobante' },
  { tabla: 'ong_caja', que: 'asiento de caja' },
  { tabla: 'ong_actas', que: 'acta' },
  { tabla: 'ong_traslados', que: 'traslado' },
] as const

/** Como se lee «3 lotes, 1 entrega» sin que quede «1 lotes». */
export const contarEnCastellano = (n: number, que: string): string =>
  `${n} ${n === 1 ? que : (que.endsWith('z') ? que.slice(0, -1) + 'ces' : que + 's')}`

export const etiquetaDeRol = (rol: string): string =>
  ROLES_ASIGNABLES.find(r => r.id === rol)?.label ?? rol

/**
 * Hace cuánto entró por última vez, o que nunca entró.
 *
 * Vive acá y no en el componente porque un archivo que exporta un componente Y
 * funciones rompe el fast refresh de Vite y sube el lint. Es la misma razón por
 * la que `confirmarBorrado` vive en `lib/confirmar.ts`.
 *
 * «Nunca entró» es la respuesta útil, no un guion: es el estado de alguien que
 * fue invitado y todavía no aceptó, que es lo que hay que mirar cuando alguien
 * dice que no le llegó el mail.
 */
export function cuandoEntro(iso: string | null): string {
  if (!iso) return 'nunca entró'
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  const meses = Math.floor(dias / 30)
  return meses === 1 ? 'hace un mes' : `hace ${meses} meses`
}

export const usuariosService = {
  async listar(): Promise<Usuario[]> {
    const { data, error } = await supabase
      .from('perfiles_usuario')
      .select('id, nombre_completo, rol, activo, ultimo_acceso, email')
      .order('nombre_completo')
    if (error) throw new Error(error.message)
    return (data ?? []) as Usuario[]
  },

  /**
   * Suma a alguien. Le llega un mail con un enlace donde define su contraseña.
   *
   * No devuelve ni fija ninguna clave: una clave que el administrador ve es una
   * clave que después nadie puede cambiar sin que se note.
   */
  async invitar(email: string, nombre: string, rol: RolUsuario): Promise<void> {
    const { data, error } = await supabase.functions.invoke('usuarios-invitar', {
      body: { email, nombre, rol },
    })
    // `functions.invoke` da un error genérico ante un 4xx y se come el motivo,
    // que es justo lo que hay que mostrar («ese mail ya tiene usuario»).
    if (error) {
      const detalle = await leerElMotivo(error)
      throw new Error(detalle ?? error.message)
    }
    if (data?.error) throw new Error(String(data.error))
  },

  async cambiarRol(id: string, rol: RolUsuario): Promise<void> {
    const { error } = await supabase.from('perfiles_usuario').update({ rol }).eq('id', id)
    if (error) throw new Error(error.message)
  },

  /**
   * Elimina a alguien que no sea `administrador`.
   *
   * Va por la función porque borrar la cuenta necesita `auth.admin`, igual que
   * invitar. Y la regla del rol se vuelve a verificar allá, contra el rol
   * GUARDADO: acá sólo se decide si se muestra el botón, y un botón que no se
   * muestra igual se puede llamar a mano.
   */
  async eliminar(id: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('usuarios-eliminar', {
      body: { id },
    })
    if (error) {
      const detalle = await leerElMotivo(error)
      throw new Error(detalle ?? error.message)
    }
    if (data?.error) throw new Error(String(data.error))
  },

  /**
   * Qué queda sin autor si se borra a esta persona, en una frase.
   *
   * Cuenta y no impide. Las filas NO se van: desde el 31/08/2026 las FK de
   * `ong_lotes` y `ong_pedidos` son SET NULL —antes eran CASCADE y borrar un
   * usuario le borraba los lotes—. Lo que se pierde es el nombre de quien las
   * cargó, que es lo que hay que poder mostrar en una inspección.
   *
   * Va con `head: true`, así que trae el número y ninguna fila.
   */
  async loQueQuedaSinAutor(id: string): Promise<string> {
    const cuentas = await Promise.all(TABLAS_CON_AUTOR.map(async ({ tabla, que }) => {
      const { count } = await supabase
        .from(tabla).select('id', { count: 'exact', head: true }).eq('user_id', id)
      return { n: count ?? 0, que }
    }))
    const hay = cuentas.filter(c => c.n > 0)
    if (hay.length === 0) return 'No tiene nada cargado a su nombre.'
    return `Quedan sin autor: ${hay.map(c => contarEnCastellano(c.n, c.que)).join(', ')}.`
  },

  async cambiarActivo(id: string, activo: boolean): Promise<void> {
    const { error } = await supabase.from('perfiles_usuario').update({ activo }).eq('id', id)
    if (error) throw new Error(error.message)
  },
}

/** El mensaje que mandó la función, que `invoke` deja escondido en la respuesta. */
async function leerElMotivo(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: { json?: () => Promise<unknown> } })?.context
  if (!ctx?.json) return null
  try {
    const cuerpo = await ctx.json() as { error?: unknown }
    return typeof cuerpo?.error === 'string' ? cuerpo.error : null
  } catch { return null }
}
