// EL ARQUEO: LO QUE ALGUIEN CONTÓ, CONTRA LO QUE EL SISTEMA DECÍA.
//
// Es la pieza que le faltaba al panel. El panel MUESTRA la caja y el stock;
// nadie sabe si alguien los miró — por eso sus pasos 2 y 3 llevan el número en
// gris y no un tilde.
//
// Socio lo pidió el 02/09/2026 con el problema puesto: «hay veces que hay una
// merma, le pregunto a Socio, no sacó, yo no saqué, no sabemos dónde va». Esa
// pregunta hoy no tiene respuesta posible, porque no hay ningún momento
// registrado en el que alguien haya dicho «había tanto». El arqueo es ese
// momento.
//
// LO QUE SE GUARDA ES LA DIFERENCIA, NO LA CULPA. `contado_por` dice quién
// contó, que no es lo mismo que quién se llevó algo. Hoy la merma la absorbe
// Socio como faltante de su plata; un sistema que convierta eso en automático
// deja de cargarse la primera vez que alguien discuta un número, y entonces no
// queda ni el registro. El dato queda; qué se hace con él lo decide una persona.

import { supabase } from './supabase'

export interface Arqueo {
  id: string
  momento: string
  /** Lo que el sistema decía en ese momento, CONGELADO. Ver `arquear`. */
  esperado_efectivo: number | null
  esperado_transferencia: number | null
  esperado_stock_g: number | null
  /** Lo que se contó. Null = no se contó eso esta vez. */
  contado_efectivo: number | null
  contado_transferencia: number | null
  contado_stock_g: number | null
  nota: string | null
  contado_por: string | null
  creado_en: string
}

/** Lo que hay que pasarle para dejar el arqueo asentado. */
export type ArqueoNuevo = Omit<Arqueo, 'id' | 'creado_en' | 'contado_por'> & {
  momento?: string
}

/**
 * La diferencia de una línea del arqueo.
 *
 * `null` cuando no se contó: no es lo mismo «no falta nada» que «no se contó».
 * Un cero en lugar de un null diría que cuadra algo que nadie miró, que es
 * exactamente la mentira que este módulo viene a impedir.
 */
export const diferencia = (esperado: number | null, contado: number | null): number | null =>
  contado == null || esperado == null ? null : Number((contado - esperado).toFixed(2))

/**
 * ¿Cuadra? Con la tolerancia puesta afuera, porque no es la misma para la plata
 * que para los gramos.
 *
 * En pesos se exige exacto: un peso de diferencia en una caja es un error de
 * carga, no una imprecisión. En gramos NO, y por eso el default es 1: una
 * balanza de mostrador tiene su propio error, y marcar en rojo medio gramo
 * entrena a la gente a ignorar el rojo — que es la forma de que el día que
 * falten cincuenta tampoco lo miren.
 */
export const cuadra = (dif: number | null, tolerancia = 0): boolean =>
  dif != null && Math.abs(dif) <= tolerancia

export const TOLERANCIA_GRAMOS = 1

export const arqueosService = {
  /** Los últimos arqueos, del más nuevo al más viejo. */
  async listar(limite = 30): Promise<Arqueo[]> {
    const { data, error } = await supabase
      .from('arqueos')
      .select('*')
      .order('momento', { ascending: false })
      .limit(limite)
    if (error) throw error
    return (data ?? []) as Arqueo[]
  },

  /**
   * Deja el arqueo asentado.
   *
   * `contado_por` lo pone la base con el usuario de la sesión y no lo manda el
   * cliente: un campo de «quién contó» que viaja en el payload es un campo que
   * se puede escribir con cualquier nombre.
   */
  async arquear(a: ArqueoNuevo): Promise<Arqueo> {
    const { data: sesion } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('arqueos')
      .insert({ ...a, contado_por: sesion.user?.id ?? null })
      .select()
      .single()
    if (error) throw error
    return data as Arqueo
  },
}
