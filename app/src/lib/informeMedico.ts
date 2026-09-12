// Panel del Director Médico e informe semestral (SRS v3.2, CU-07).
//
// Correlaciona lo que hasta ahora vivía en tres lugares separados: el
// diagnóstico del paciente, los lotes que se le entregaron, y lo que reportó
// que le pasó con ellos. Esa correlación es el informe semestral que la
// autoridad sanitaria le exige al director médico.
//
// Todo lo que se calcula acá sale de datos ya cargados. Lo que no alcanza para
// una conclusión se dice, no se rellena: un informe clínico con un promedio
// hecho sobre dos reportes no es un promedio, es una anécdota con decimales.

import type { Dispensa, FeedbackClinico } from './ong'
import type { Paciente } from './registro'
import { semestreDe } from './ong'

/** Cuántos reportes hacen falta para que un promedio signifique algo. */
export const MINIMO_PARA_TENDENCIA = 3

export interface SeguimientoPaciente {
  paciente: Paciente
  entregas: Dispensa[]
  reportes: FeedbackClinico[]
  gramosTotales: number
  /** Escala de alivio 1-5, en orden cronológico. Para ver la evolución. */
  curvaAlivio: number[]
  alivioPromedio: number | null
  /** Efectos distintos de "Ninguno", con cuántas veces apareció cada uno. */
  efectos: { efecto: string; veces: number }[]
  lotes: string[]
  /** Entregas sin su reporte: el hueco del seguimiento. */
  sinReporte: number
  /** True si hay suficientes reportes como para leer una tendencia. */
  tendenciaConfiable: boolean
}

export interface InformeSemestral {
  periodo: string
  pacientes: SeguimientoPaciente[]
  totalEntregas: number
  totalReportes: number
  totalGramos: number
  alivioPromedio: number | null
  /** Pacientes que reportaron al menos un efecto adverso. */
  conEfectosAdversos: number
  /** Cobertura del seguimiento: reportes sobre entregas. */
  cobertura: number | null
}

const enPeriodo = (fecha: string, periodo: string) => semestreDe(fecha) === periodo

/**
 * Arma el seguimiento de cada paciente para un semestre.
 *
 * Sólo entran los pacientes con al menos una entrega en el período: listar a
 * quien no recibió nada llenaría el informe de filas vacías.
 */
export function armarInforme(
  periodo: string, pacientes: Paciente[], dispensas: Dispensa[], feedbacks: FeedbackClinico[],
): InformeSemestral {
  const delPeriodo = dispensas.filter(d => d.fecha && enPeriodo(d.fecha, periodo))
  const ids = [...new Set(delPeriodo.map(d => d.paciente_id).filter(Boolean))] as string[]

  const seguimientos: SeguimientoPaciente[] = ids.flatMap(id => {
    const paciente = pacientes.find(p => p.id === id)
    if (!paciente) return []
    const entregas = delPeriodo
      .filter(d => d.paciente_id === id)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    const idsEntregas = new Set(entregas.map(e => e.id))
    // Los reportes se ordenan siguiendo el orden de las entregas, no por su
    // propia fecha de carga: la curva tiene que leerse contra el tratamiento.
    const reportes = entregas
      .map(e => feedbacks.find(f => f.dispensa_id === e.id))
      .filter((f): f is FeedbackClinico => !!f)

    const conteo = new Map<string, number>()
    for (const r of reportes) {
      for (const e of r.efectos_adversos) {
        if (e === 'Ninguno') continue
        conteo.set(e, (conteo.get(e) ?? 0) + 1)
      }
    }

    const curvaAlivio = reportes.map(r => r.escala_alivio)
    return [{
      paciente, entregas, reportes,
      gramosTotales: entregas.reduce((s, e) => s + (Number(e.gramos) || 0), 0),
      curvaAlivio,
      alivioPromedio: curvaAlivio.length
        ? curvaAlivio.reduce((a, b) => a + b, 0) / curvaAlivio.length : null,
      efectos: [...conteo.entries()]
        .map(([efecto, veces]) => ({ efecto, veces }))
        .sort((a, b) => b.veces - a.veces),
      lotes: [...new Set(entregas.map(e => e.lote_codigo).filter(Boolean))] as string[],
      sinReporte: entregas.filter(e => !feedbacks.some(f => f.dispensa_id === e.id && idsEntregas.has(e.id))).length,
      tendenciaConfiable: curvaAlivio.length >= MINIMO_PARA_TENDENCIA,
    }]
  }).sort((a, b) => b.entregas.length - a.entregas.length)

  const todosLosReportes = seguimientos.flatMap(s => s.reportes)
  const totalEntregas = seguimientos.reduce((s, x) => s + x.entregas.length, 0)

  return {
    periodo,
    pacientes: seguimientos,
    totalEntregas,
    totalReportes: todosLosReportes.length,
    totalGramos: seguimientos.reduce((s, x) => s + x.gramosTotales, 0),
    alivioPromedio: todosLosReportes.length
      ? todosLosReportes.reduce((s, r) => s + r.escala_alivio, 0) / todosLosReportes.length : null,
    conEfectosAdversos: seguimientos.filter(s => s.efectos.length > 0).length,
    cobertura: totalEntregas > 0 ? (todosLosReportes.length / totalEntregas) * 100 : null,
  }
}

/**
 * Tendencia de la curva de alivio: si el tratamiento viene mejorando, estable o
 * empeorando. Compara la primera mitad contra la segunda.
 *
 * Con menos de MINIMO_PARA_TENDENCIA reportes devuelve null en vez de una
 * palabra: dos puntos no son una tendencia, y decir "mejora" con dos datos es
 * afirmar algo que no se sabe.
 */
export function tendencia(curva: number[]): 'mejora' | 'estable' | 'empeora' | null {
  if (curva.length < MINIMO_PARA_TENDENCIA) return null
  const mitad = Math.floor(curva.length / 2)
  const prom = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const dif = prom(curva.slice(-mitad)) - prom(curva.slice(0, mitad))
  if (dif >= 0.5) return 'mejora'
  if (dif <= -0.5) return 'empeora'
  return 'estable'
}

const ETIQUETA_TENDENCIA: Record<string, string> = {
  mejora: 'en mejoría', estable: 'estable', empeora: 'en desmejora',
}

/**
 * El informe semestral redactado, para que el director médico lo revise, le
 * agregue su dictamen y lo firme. La app no dictamina: reúne y ordena la
 * evidencia, el juicio clínico lo pone el profesional.
 */
export function redactarInformeSemestral(
  inf: InformeSemestral, razonSocial: string | null, director: string | null,
): { texto: string; faltantes: string[] } {
  const f: string[] = []
  if (!razonSocial) f.push('la razón social de la entidad')
  if (!director) f.push('el nombre del director médico')
  if (inf.cobertura != null && inf.cobertura < 100) {
    f.push(`el reporte de ${inf.totalEntregas - inf.totalReportes} entrega(s) sin seguimiento`)
  }

  const L: string[] = [
    'INFORME SEMESTRAL DE SEGUIMIENTO TERAPÉUTICO',
    `Período ${inf.periodo}`,
    '',
    razonSocial ?? '[razón social]',
    `Director Médico: ${director ?? '[nombre y matrícula]'}`,
    '',
    'RESUMEN DEL PERÍODO',
    `  Pacientes con entregas: ${inf.pacientes.length}`,
    `  Entregas realizadas: ${inf.totalEntregas}  ·  Total dispensado: ${Math.round(inf.totalGramos)} g`,
    `  Reportes de seguimiento: ${inf.totalReportes}` +
      (inf.cobertura != null ? ` (${inf.cobertura.toFixed(0)}% de cobertura)` : ''),
    inf.alivioPromedio != null
      ? `  Alivio promedio referido: ${inf.alivioPromedio.toFixed(1)} sobre 5`
      : '  Alivio promedio: sin reportes suficientes',
    `  Pacientes que refirieron efectos adversos: ${inf.conEfectosAdversos}`,
    '',
    'SEGUIMIENTO POR PACIENTE',
    '',
  ]

  for (const s of inf.pacientes) {
    const t = tendencia(s.curvaAlivio)
    L.push(`${s.paciente.nombre_completo}` +
      (s.paciente.dni ? ` (DNI ${s.paciente.dni})` : '') +
      (s.paciente.reprocann_nro ? ` · REPROCANN ${s.paciente.reprocann_nro}` : ''))
    L.push(`  Diagnóstico: ${s.paciente.patologia || '[sin cargar]'}`)
    if (s.paciente.medico_tratante) {
      L.push(`  Médico tratante: ${s.paciente.medico_tratante}` +
        (s.paciente.matricula_medico ? ` (${s.paciente.matricula_medico})` : ''))
    }
    L.push(`  Entregas en el período: ${s.entregas.length} · ${Math.round(s.gramosTotales)} g` +
      (s.lotes.length ? ` · lotes ${s.lotes.join(', ')}` : ''))

    if (s.reportes.length) {
      L.push(`  Alivio referido: ${s.curvaAlivio.join(' → ')} (sobre 5)`)
      L.push('  Evolución: ' + (t
        ? ETIQUETA_TENDENCIA[t]
        : `no se informa tendencia, sólo hay ${s.reportes.length} reporte(s) y hacen falta ${MINIMO_PARA_TENDENCIA}`))
      const dosis = [...new Set(s.reportes.map(r => r.dosificacion_real))]
      L.push(`  Dosificación referida: ${dosis.join(' · ')}`)
      L.push('  Efectos adversos: ' + (s.efectos.length
        ? s.efectos.map(e => `${e.efecto} (${e.veces})`).join(', ')
        : 'no refirió'))
      const obs = s.reportes.map(r => r.observaciones).filter(Boolean)
      if (obs.length) L.push(`  Observaciones del paciente: ${obs.join(' · ')}`)
    } else {
      L.push('  Sin reportes de seguimiento en el período.')
    }
    if (s.sinReporte > 0) {
      L.push(`  ATENCIÓN: ${s.sinReporte} entrega(s) sin reporte de seguimiento.`)
    }
    L.push('')
  }

  L.push('DICTAMEN DEL DIRECTOR MÉDICO')
  L.push('')
  L.push('[Completar: valoración clínica del período, ajustes de tratamiento propuestos y')
  L.push('conclusiones sobre los beneficios razonables observados.]')
  L.push('')
  L.push('')
  L.push('_______________________________')
  L.push(`${director ?? '[nombre]'} — Director Médico`)
  L.push('Matrícula y registro REFEPS: [completar]')

  return { texto: L.join('\n'), faltantes: f }
}
