// EL PLAN DE CULTIVO: LO QUE SE DECLARA, CONTRA LO QUE HAY.
//
// Lo pidió Socio el 02/09/2026: «debería alimentarse de un plan de cultivo,
// el que se declara en el REPROCANN, diciendo cuánta gente, qué genética,
// cuántas plantas», y «no le hace falta que esté cargando planta por planta».
//
// LA PARTE QUE HACE QUE VALGA UNA TABLA no es la comodidad de carga: es que el
// plan es el DOCUMENTO QUE SE DECLARA. Con él cargado, el sistema puede decir
// «declaraste 60 y hay 63 en la sala». Hoy eso es imposible — no hay contra qué
// comparar, sólo plantas sueltas.
//
// ⚠️ EL PLAN NO GENERA LAS PLANTAS, LAS CONTRASTA. Generarlas y listo suena
// cómodo, y a los dos meses el plan es ficción: murieron tres, se repusieron
// dos, y nadie vuelve a mirarlo. El plan es la declaración, las plantas son la
// realidad, y el cruce es lo que avisa cuando se separaron. Un plan que se
// edita para que cierre deja de ser una declaración.

import { supabase } from './supabase'

export interface PlanCultivo {
  id: string
  nombre: string
  desde: string | null
  hasta: string | null
  /** Los dos números que se cruzan contra la realidad. */
  plantas_previstas: number | null
  pacientes_previstos: number | null
  /**
   * Texto libre a propósito.
   *
   * Es lo que va en el documento, y cada organismo lo pide redactado distinto.
   * Encasillarlo en catálogos obligaría a mantener una taxonomía que cambia con
   * cada resolución — y lo que el sistema necesita cruzar son los números, no
   * la redacción.
   */
  geneticas: string | null
  espacios: string | null
  riego: string | null
  fertilizacion: string | null
  luces: string | null
  notas: string | null
  activo: boolean
  creado_por: string | null
  creado_en: string
  actualizado_en: string
}

export type PlanNuevo = Partial<Omit<PlanCultivo, 'id' | 'creado_en' | 'actualizado_en' | 'creado_por'>>
  & { nombre: string }

/**
 * Lo que el plan dice contra lo que hay.
 *
 * `null` en `previstas` cuando el plan no declaró el número: no es lo mismo
 * «declaró cero» que «no lo declaró», y un cero acá diría que hay 63 plantas de
 * más sobre un plan que nunca puso un tope.
 */
export interface Desvio {
  previstas: number | null
  reales: number
  /** Positivo = hay más de las declaradas. `null` si no hay con qué comparar. */
  diferencia: number | null
}

export const desvioDePlantas = (plan: PlanCultivo | null, reales: number): Desvio => ({
  previstas: plan?.plantas_previstas ?? null,
  reales,
  diferencia: plan?.plantas_previstas == null ? null : reales - plan.plantas_previstas,
})

/**
 * El plan vigente hoy.
 *
 * Puede haber más de uno activo en el cambio de ciclo —conviven el que termina
 * y el que arranca—, así que se elige por fecha y no se asume que hay uno solo.
 * Sin `desde` cargado se lo considera vigente: un plan a medio llenar sigue
 * siendo el plan.
 */
export function planVigente(planes: PlanCultivo[], hoy = new Date()): PlanCultivo | null {
  const dia = hoy.toISOString().slice(0, 10)
  const candidatos = planes.filter(p =>
    p.activo
    && (!p.desde || p.desde <= dia)
    && (!p.hasta || p.hasta >= dia))
  if (candidatos.length === 0) return null
  // El que arrancó más tarde: en el solapamiento del cambio de ciclo, el nuevo.
  return candidatos.sort((a, b) => (b.desde ?? '').localeCompare(a.desde ?? ''))[0]
}

export const planService = {
  async listar(): Promise<PlanCultivo[]> {
    const { data, error } = await supabase
      .from('planes_cultivo')
      .select('*')
      .order('desde', { ascending: false, nullsFirst: false })
    if (error) throw error
    return (data ?? []) as PlanCultivo[]
  },

  /**
   * ⚠️ `activo` VA EXPLÍCITO, no se deja al default de la columna.
   *
   * El default lo pone Postgres, y el modo demo corre contra `localStorage`: en
   * demo la fila se guarda sin `activo`, `planVigente` la descarta por falsy, y
   * queda un alta con toast de éxito y una pantalla que dice «todavía no hay un
   * plan cargado». Pasó exactamente así al probar esto, y es el mismo pozo que
   * ya había dejado escrito el alta de áreas con su `activa`.
   */
  async guardar(plan: PlanNuevo & { id?: string }): Promise<PlanCultivo> {
    const { id, ...resto } = plan
    const campos = { activo: true, ...resto }
    const q = id
      ? supabase.from('planes_cultivo')
        .update({ ...campos, actualizado_en: new Date().toISOString() }).eq('id', id)
      : supabase.from('planes_cultivo').insert(campos)
    const { data, error } = await q.select().single()
    if (error) throw error
    return data as PlanCultivo
  },
}
