/**
 * EL CARNET DE SOCIO.
 *
 * Es lo que la persona muestra en la sede para identificarse. Sale del padrón
 * que ya existe: no hay ningún dato nuevo que cargar.
 *
 * TRES DECISIONES QUE LO HACEN ÚTIL EN VEZ DE DECORATIVO:
 *
 * 1. El QR lleva el CÓDIGO DEL SOCIO, y lo lee el escáner que la app ya tiene
 *    para las reservas. Un QR que no apunta a nada es peor que no ponerlo —es
 *    la misma regla que se aplicó al comprobante de dispensación—, y acá apunta
 *    a algo real: el mostrador escanea y le aparece la persona.
 *
 * 2. El REPROCANN se muestra CON su estado. Un carnet que dice «REPROCANN
 *    148735» sin decir que venció el mes pasado se usa para retirar material
 *    que ya no está amparado por la 27.350, y el papel es justamente lo que
 *    hace que nadie lo mire dos veces.
 *
 * 3. Lo que falta se dice, no se disimula. Un carnet sin DNI es un carnet que
 *    no identifica a nadie: sale igual —la persona existe y es socia— pero con
 *    el hueco a la vista, para que alguien lo complete.
 */
import { nombreParaMostrar } from './buscarPersonas'
import type { Paciente } from './registro'
import type { Entidad } from './ong'

/** Días antes del vencimiento en que el carnet ya avisa. */
export const DIAS_AVISO_CARNET = 60

export type EstadoCredencial = 'vigente' | 'por_vencer' | 'vencida' | 'sin_registro'

export interface CarnetSocio {
  /** Apellido primero, como en toda la app. */
  nombre: string
  codigo: string | null
  dni: string | null
  entidad: string | null
  cuit: string | null
  reprocannNro: string | null
  vencimiento: string | null
  estado: EstadoCredencial
  /** Lo que el QR lleva adentro: el código, que el escáner sabe buscar. */
  qr: string | null
  /** Lo que falta para que el carnet identifique de verdad. */
  faltantes: string[]
}

const vacio = (v: unknown) => v == null || String(v).trim() === ''

/**
 * En qué estado está la credencial, MIRANDO LA FECHA y no el campo guardado.
 *
 * `reprocann_estado` dice «Vigente» hasta que alguien entra a la ficha a
 * cambiarlo, y nadie entra el día que se vence. Es la misma lección que dejó el
 * cruce `credenciales_vencidas`: lo que manda es la fecha.
 */
export function estadoDeCredencial(
  p: { reprocann_nro?: string | null; reprocann_vencimiento?: string | null },
  hoy: string,
): EstadoCredencial {
  if (vacio(p.reprocann_nro)) return 'sin_registro'
  const v = p.reprocann_vencimiento
  if (vacio(v)) return 'sin_registro'
  if ((v as string) < hoy) return 'vencida'
  const limite = new Date(hoy + 'T00:00:00')
  limite.setDate(limite.getDate() + DIAS_AVISO_CARNET)
  return (v as string) <= limite.toISOString().slice(0, 10) ? 'por_vencer' : 'vigente'
}

export const LABEL_CREDENCIAL: Record<EstadoCredencial, string> = {
  vigente: 'REPROCANN vigente',
  por_vencer: 'REPROCANN por vencer',
  vencida: 'REPROCANN VENCIDO',
  sin_registro: 'Sin REPROCANN registrado',
}

/**
 * El accesor con `??`, no el indexado directo. La base se migra por SQL y por
 * la Edge Function `ingesta`, y ninguna de las dos pasa por TypeScript.
 */
export const labelCredencial = (e: string | null | undefined): string =>
  LABEL_CREDENCIAL[e as EstadoCredencial] ?? LABEL_CREDENCIAL.sin_registro

export function armarCarnet(p: Paciente, e: Entidad | null, hoy: string): CarnetSocio {
  const faltantes: string[] = []
  if (vacio(p.dni)) faltantes.push('el DNI')
  if (vacio(p.codigo)) faltantes.push('el código de socio')
  if (vacio(e?.razon_social)) faltantes.push('la razón social de la entidad')
  if (vacio(p.reprocann_nro)) faltantes.push('el número de REPROCANN')

  const estado = estadoDeCredencial(p, hoy)

  return {
    nombre: nombreParaMostrar(p),
    codigo: vacio(p.codigo) ? null : (p.codigo as string),
    dni: vacio(p.dni) ? null : (p.dni as string),
    entidad: vacio(e?.razon_social) ? null : (e!.razon_social as string),
    cuit: vacio(e?.cuit) ? null : (e!.cuit as string),
    reprocannNro: vacio(p.reprocann_nro) ? null : (p.reprocann_nro as string),
    vencimiento: vacio(p.reprocann_vencimiento) ? null : (p.reprocann_vencimiento as string),
    estado,
    // Sin código no hay QR: uno que no lleve nada que el escáner pueda buscar
    // es exactamente el adorno que no queremos.
    qr: vacio(p.codigo) ? null : (p.codigo as string),
    faltantes,
  }
}

/**
 * Si el carnet sirve para retirar material HOY.
 *
 * Va aparte de `faltantes` porque son dos cosas distintas: a un carnet le puede
 * faltar el DNI y aun así la persona estar habilitada, y puede estar completo y
 * con la credencial vencida.
 */
export const habilitaRetiro = (c: CarnetSocio): boolean =>
  c.estado === 'vigente' || c.estado === 'por_vencer'
