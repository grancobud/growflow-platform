// LO QUE DEVUELVE EL MODELO NO ES UN DATO HASTA QUE ALGUIEN LO VERIFICA.
//
// `ocr.ts` manda la imagen de una credencial REPROCANN a un modelo de visión
// local y recibe JSON. Hasta el 12/09/2026 ese JSON entraba al formulario con
// un cast:
//
//   return (json.datos ?? json) as DatosCredencial
//
// Un cast no comprueba nada: le dice a TypeScript que confíe. Y del otro lado
// hay un modelo leyendo un PDF escaneado, que es la situación exacta en la que
// un 8 se lee 3 y un 1 se lee 7.
//
// EL MODO DE FALLA QUE IMPORTA NO ES QUE FALLE.
//
// Si el modelo devuelve basura evidente, se ve y se corrige. El problema es el
// dato PLAUSIBLE y equivocado: un DNI de ocho dígitos que no es el de la
// persona, una fecha de vencimiento bien formada pero del año que no es. Eso
// entra al formulario, alguien lo guarda, y queda un paciente con el documento
// de otro en un sistema de datos de salud.
//
// Por eso acá no se pregunta «¿vino algo?» sino «¿esto puede ser cierto?». Y
// cuando no puede, el campo se RECHAZA con el motivo escrito, en vez de pasar
// en silencio.
//
// POR QUÉ ES UN MÓDULO Y NO SEGUÍA SUELTO EN LA PANTALLA.
//
// Estaba en `PaginaPacientes.tsx`, mezclado con el `setForm`: tres regex de
// fecha y dos `includes`. Ahí no se puede medir. Un sistema con un modelo
// adentro necesita que su verificación sea ejecutable sin abrir el navegador,
// porque si no, la única forma de saber si el modelo empeoró es que se queje
// alguien. Con esto en un módulo, `credencialOcr.eval.test.ts` le pasa un
// conjunto de salidas conocidas y mide cuántos campos acierta.
//
// Y de paso: los campos que NO tenían validación ninguna eran dni, telefono,
// reprocann_nro, plantas_habilitadas y m2_habilitados. Justamente el DNI.

import type { DatosCredencial } from './ocr'
import { ESTADOS_REPROCANN, MODALIDADES } from './registro'

/** Un campo que el modelo devolvió y no se acepta, con el porqué. */
export interface Rechazo {
  campo: keyof DatosCredencial
  recibido: unknown
  motivo: string
}

export interface ResultadoCredencial {
  /** Sólo los campos que pasaron. Lo que no está, no se pudo verificar. */
  campos: DatosCredencial
  /** Lo que el modelo dijo y no se acepta. Se muestra, no se descarta callado. */
  rechazos: Rechazo[]
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())

/**
 * Una fecha ISO que además EXISTE.
 *
 * `/^\d{4}-\d{2}-\d{2}$/` —que era lo que había— acepta 2026-02-31 y
 * 2026-13-01. Un modelo que lee mal un dígito produce justamente eso, y la
 * forma sola no lo agarra.
 */
function fechaValida(v: unknown): string | null {
  const s = texto(v)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [a, m, d] = s.split('-').map(Number)
  const fecha = new Date(Date.UTC(a, m - 1, d))
  if (fecha.getUTCFullYear() !== a || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) return null
  // Una credencial de 1974 o de 2099 es un dígito mal leído, no un dato.
  if (a < 1900 || a > 2100) return null
  return s
}

/**
 * DNI argentino: 7 u 8 dígitos.
 *
 * Se limpian puntos y espacios porque la credencial los trae impresos
 * («32.422.000») y el modelo los copia tal cual. Guardar el mismo documento en
 * dos formatos distintos es cómo se terminan teniendo dos fichas de la misma
 * persona.
 */
function dniValido(v: unknown): string | null {
  const s = texto(v).replace(/[.\s]/g, '')
  return /^\d{7,8}$/.test(s) ? s : null
}

function enteroEnRango(v: unknown, min: number, max: number): number | null {
  const s = texto(v)
  if (s === '') return null
  const n = Number(s)
  if (!Number.isInteger(n) || n < min || n > max) return null
  return n
}

/**
 * Un nombre son al menos dos palabras de letras.
 *
 * El modelo a veces devuelve el encabezado del formulario —«APELLIDO Y
 * NOMBRE»— o una sola palabra cuando el renglón salió cortado.
 */
function nombreValido(v: unknown): string | null {
  const s = texto(v).replace(/\s+/g, ' ')
  if (s.length < 5 || s.length > 120) return null
  if (!/^[\p{L}\p{M}'’.\- ]+$/u.test(s)) return null
  if (s.split(' ').filter(Boolean).length < 2) return null
  if (/apellido|nombre y|titular|^n\/?a$/i.test(s)) return null
  return s
}

function telefonoValido(v: unknown): string | null {
  const s = texto(v).replace(/[^\d]/g, '')
  return s.length >= 8 && s.length <= 15 ? s : null
}

function emailValido(v: unknown): string | null {
  const s = texto(v).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(s) ? s : null
}

/**
 * Normaliza y verifica la salida cruda del OCR.
 *
 * Nunca lanza: una credencial ilegible tiene que poder abrirse igual con todos
 * los campos rechazados, para que la persona los cargue a mano. Reventar acá
 * sería cambiar un dato dudoso por una pantalla que no abre.
 */
export function normalizarCredencial(bruto: unknown): ResultadoCredencial {
  const campos: DatosCredencial = {}
  const rechazos: Rechazo[] = []

  if (bruto == null || typeof bruto !== 'object') {
    return { campos, rechazos: [{ campo: 'nombre_completo', recibido: bruto, motivo: 'la respuesta no es un objeto' }] }
  }
  const d = bruto as Record<string, unknown>

  const tomar = <K extends keyof DatosCredencial>(
    campo: K,
    validar: (v: unknown) => DatosCredencial[K] | null,
    motivo: string,
  ) => {
    const crudo = d[campo as string]
    // Ausente no es un error: la credencial puede no traer el campo.
    if (crudo == null || texto(crudo) === '') return
    const ok = validar(crudo)
    if (ok == null) rechazos.push({ campo, recibido: crudo, motivo })
    else campos[campo] = ok
  }

  tomar('nombre_completo', nombreValido, 'no parece un nombre y apellido')
  tomar('dni', dniValido, 'no son 7 u 8 dígitos')
  tomar('fecha_nacimiento', fechaValida, 'no es una fecha real en formato aaaa-mm-dd')
  tomar('telefono', telefonoValido, 'no son entre 8 y 15 dígitos')
  tomar('email', emailValido, 'no tiene forma de email')
  tomar('localidad', v => texto(v) || null, 'vacío')
  tomar('provincia', v => texto(v) || null, 'vacío')
  tomar('domicilio', v => texto(v) || null, 'vacío')
  tomar('reprocann_nro', v => (/^[A-Za-z0-9-]{6,20}$/.test(texto(v)) ? texto(v) : null), 'no tiene forma de número de REPROCANN')
  tomar('reprocann_estado', v => (ESTADOS_REPROCANN as readonly string[]).includes(texto(v)) ? texto(v) : null,
    `no es uno de: ${ESTADOS_REPROCANN.join(', ')}`)
  tomar('reprocann_emision', fechaValida, 'no es una fecha real en formato aaaa-mm-dd')
  tomar('reprocann_vencimiento', fechaValida, 'no es una fecha real en formato aaaa-mm-dd')
  tomar('modalidad', v => (MODALIDADES as readonly string[]).includes(texto(v)) ? texto(v) : null,
    `no es una de: ${MODALIDADES.join(', ')}`)
  // 9 plantas es el tope habitual de la Res. 1780/2025; se deja holgura hasta
  // 99 para no rechazar una excepción real, pero 500 es un dígito mal leído.
  tomar('plantas_habilitadas', v => enteroEnRango(v, 0, 99), 'no es un entero entre 0 y 99')
  tomar('m2_habilitados', v => enteroEnRango(v, 0, 10000), 'no es un entero entre 0 y 10000')
  tomar('patologia', v => texto(v) || null, 'vacío')
  tomar('medico_tratante', nombreValido, 'no parece un nombre y apellido')
  tomar('matricula_medico', v => (/^\d{1,8}$/.test(texto(v).replace(/\D/g, '')) ? texto(v).replace(/\D/g, '') : null),
    'no son dígitos')

  // COHERENCIA ENTRE CAMPOS, que es donde se esconde el error plausible.
  //
  // Cada fecha por separado puede estar perfecta y el par ser imposible. Eso no
  // lo agarra ninguna validación campo por campo.
  const { reprocann_emision: emi, reprocann_vencimiento: ven } = campos
  if (emi && ven && emi > ven) {
    rechazos.push({ campo: 'reprocann_vencimiento', recibido: ven, motivo: `vence (${ven}) antes de emitirse (${emi})` })
    delete campos.reprocann_vencimiento
  }
  if (campos.fecha_nacimiento && emi && campos.fecha_nacimiento > emi) {
    rechazos.push({ campo: 'fecha_nacimiento', recibido: campos.fecha_nacimiento, motivo: 'nació después de que se emitiera la credencial' })
    delete campos.fecha_nacimiento
  }

  return { campos, rechazos }
}

/**
 * Contradicción entre el estado que dice la credencial y su vencimiento.
 *
 * No es un rechazo: los dos datos pueden estar bien leídos y aun así no cerrar
 * —una credencial vencida que sigue diciendo «Vigente» impresa—. Se avisa para
 * que lo resuelva una persona, que es lo que corresponde.
 */
export function avisosDeCoherencia(c: DatosCredencial, hoy = new Date()): string[] {
  const avisos: string[] = []
  const iso = hoy.toISOString().slice(0, 10)
  if (c.reprocann_estado === 'Vigente' && c.reprocann_vencimiento && c.reprocann_vencimiento < iso) {
    avisos.push(`La credencial dice «Vigente» pero venció el ${c.reprocann_vencimiento}.`)
  }
  if (c.reprocann_estado === 'Vencido' && c.reprocann_vencimiento && c.reprocann_vencimiento >= iso) {
    avisos.push(`La credencial dice «Vencido» pero vence el ${c.reprocann_vencimiento}.`)
  }
  return avisos
}
