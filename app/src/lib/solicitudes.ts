// Las solicitudes de alta: quien quiere sumarse, y cómo va su trámite.
//
// Es el único lugar de la app donde escribe alguien sin cuenta. Todo lo demás
// exige login. Por eso el acceso público NO pasa por la tabla sino por dos
// funciones de la base, `solicitud_crear` y `solicitud_estado`, que son la
// superficie completa que ve el mundo: `anon` no tiene ni un permiso sobre
// `ong_solicitudes`. Ver supabase/migrations/20260822210000_solicitudes_de_alta.sql.
//
// LO QUE ESTE ARCHIVO NO HACE, Y ES A PROPOSITO
//
// No hay «buscá mi solicitud por DNI». Sería un buscador público que confirma
// quién es paciente de cannabis de la asociación: probando documentos se arma
// el padrón. El token se entrega UNA vez, a quien crea la solicitud, y es lo
// único que abre su pantalla.
//
// Mientras no haya por dónde mandarle un mensaje a la persona —mail o
// WhatsApp—, quien pierde su link tiene que volver a pedirlo por el mismo canal
// por el que llegó. Es peor UX y es la opción segura.

import { supabase } from './supabase'
import { registroService } from './registro'
import { ongService } from './ong'
import type { Legajo } from './legajo'

export type EstadoSolicitud = 'pendiente' | 'en_revision' | 'aceptada' | 'rechazada'

/** Lo que ve la persona en su propia pantalla. Sin el DNI, a propósito. */
export interface EstadoPublico {
  estado: EstadoSolicitud
  nombre: string
  creada_en: string
  actualizada_en: string
  motivo: string | null
  entidad: string | null
  codigo_vinculacion: string | null
  /** Si ya adjuntó la constancia. Un booleano, NO el path: con el token no se
   *  llega a ningún archivo, sólo se sabe que ya subió uno. */
  reprocann_cargado: boolean
  reprocann_nro: string | null
}

/** La ficha entera. Sólo del lado de adentro, con sesión. */
export interface Solicitud {
  id: string
  token: string
  nombre: string
  dni: string
  email: string | null
  telefono: string | null
  notas: string | null
  /** Lo que la persona adjuntó desde su propio link. Ver PaginaMiSolicitud. */
  reprocann_nro: string | null
  /** El legajo de admisión. Ver lib/legajo.ts. */
  fecha_nacimiento: string | null
  domicilio: string | null
  localidad: string | null
  provincia: string | null
  patologia: string | null
  formatos: string[] | null
  cantidad_mensual: number | null
  cantidad_unidad: string | null
  medico_tratante: string | null
  matricula_medico: string | null
  reprocann_tiene: boolean | null
  /** Si DECLARA haber designado a esta asociación. Declarado, no verificado. */
  reprocann_vinculado: 'si' | 'no' | 'no_se' | null
  reprocann_vencimiento: string | null
  compromiso_regularizar: boolean
  dni_path: string | null
  consentimientos_version: string | null
  /** PATH en el bucket `documentos`, nunca una URL. */
  reprocann_path: string | null
  reprocann_subido_en: string | null
  estado: EstadoSolicitud
  motivo: string | null
  paciente_id: string | null
  asociado_id: string | null
  creada_en: string
  actualizada_en: string
}

export const ESTADOS_SOLICITUD: { valor: EstadoSolicitud; label: string; color: string }[] = [
  { valor: 'pendiente', label: 'Sin revisar', color: '#f59e0b' },
  { valor: 'en_revision', label: 'Verificando', color: '#38bdf8' },
  { valor: 'aceptada', label: 'Aceptada', color: '#a3e635' },
  { valor: 'rechazada', label: 'Rechazada', color: '#ff8a7a' },
]

export const etiquetaEstado = (e: string) =>
  ESTADOS_SOLICITUD.find(x => x.valor === e)?.label ?? e
export const colorEstado = (e: string) =>
  ESTADOS_SOLICITUD.find(x => x.valor === e)?.color ?? '#8a8a9c'

/**
 * Qué le toca hacer AHORA a la persona, en su idioma.
 *
 * Es el corazón de la pantalla pública. Sin esto el estado es una palabra
 * —«pendiente»— que no dice si hay que esperar o hacer algo. La diferencia
 * entre las dos es todo el problema que veníamos a resolver.
 */
export function queSigue(e: EstadoPublico): {
  titulo: string; detalle: string; tuTurno: boolean
} {
  switch (e.estado) {
    case 'pendiente':
    case 'en_revision':
      return {
        titulo: 'Vinculá tu REPROCANN',
        tuTurno: true,
        // EL CODIGO LO SACA LA PERSONA, no se lo pide a la asociación.
        //
        // Hasta el 02/09/2026 esta pantalla decía «pedile el código de
        // vinculación a la asociación», y era al revés: sale de Mi Argentina,
        // es gratis y lo hace cada uno solo. Peor todavía, contradecía al paso 1
        // de `/sumate`, que ya lo contaba bien — la misma persona leía las dos
        // cosas con horas de diferencia.
        detalle: `Entrá a REPROCANN desde Mi Argentina y designá a ${e.entidad ?? 'la asociación'} como tu cultivador. `
          + 'De ahí sale TU código de vinculación: pasáselo a la asociación para que te vincule. '
          + 'Es el paso que más se traba, y sin eso no se te puede entregar. Mientras tanto revisamos tus datos.',
      }
    case 'aceptada':
      return {
        titulo: 'Ya estás',
        tuTurno: false,
        detalle: 'Tus datos quedaron cargados. Coordiná con la asociación cuándo pasás a retirar.',
      }
    case 'rechazada':
      return {
        titulo: 'No pudimos darte de alta',
        tuTurno: false,
        detalle: e.motivo ?? 'Escribinos para saber cómo seguir.',
      }
  }
}

/**
 * Que version del Mandato de Gestion Operativa se esta firmando.
 *
 * SE GUARDA CON CADA FIRMA, y no es un detalle: si el texto se reescribe, quien
 * firmo la version vieja firmo OTRA cosa. Sin este numero no hay forma de saber
 * despues que acepto cada persona.
 *
 * ⚠ Al cambiar el texto del mandato hay que subir esta version. Si no, dos
 * textos distintos quedan guardados con el mismo nombre y la trazabilidad de la
 * firma se pierde sin que nada avise.
 */
export const VERSION_MANDATO = '2026-08'

/**
 * Los campos del legajo que van a la ficha de `pacientes`.
 *
 * Lo que la persona contesta en /sumate tiene que llegar a su ficha: si no,
 * contesta doce preguntas y del otro lado alguien las vuelve a tipear mirando
 * la solicitud, que es exactamente el trabajo manual que esto vino a sacar.
 *
 * ⚠ NO VIAJA `cantidad_mensual` A `tope_mensual_g`. Es lo que la persona estima
 * necesitar, no lo que la asociación autoriza; el tope lo fija la ONG y se carga
 * aparte. Convertir un pedido en una habilitación es la misma clase de error que
 * dejó a doce fichas de la asociación en «En trámite» habilitadas a retirar.
 *
 * ⚠ TAMPOCO VIAJA la vinculación a `ong_asociados.vinculado_reprocann`. Lo que
 * la persona declara no es lo que se verificó: eso lo confirma quien revisa,
 * mirando la credencial. Al 26/08/2026 las cuatro credenciales cargadas en Chaco
 * dicen «autocultivo» y ninguna nombra a la asociación — las cuatro habrían
 * declarado que sí.
 */
function camposDelLegajo(s: Solicitud): Record<string, unknown> {
  const campos: Record<string, unknown> = {}
  const si = (k: string, v: unknown) => {
    if (v !== null && v !== undefined && v !== '') campos[k] = v
  }
  si('fecha_nacimiento', s.fecha_nacimiento)
  si('domicilio', s.domicilio)
  si('localidad', s.localidad)
  si('provincia', s.provincia)
  si('patologia', s.patologia)
  si('medico_tratante', s.medico_tratante)
  si('matricula_medico', s.matricula_medico)
  si('reprocann_nro', s.reprocann_nro)
  si('reprocann_vencimiento', s.reprocann_vencimiento)
  // El estado sale de lo que la persona DECLARA tener, no de la vinculación.
  // «Vigente» describe su credencial; que pueda retirar acá lo decide
  // `vinculado_reprocann`, que se toca a mano después de ver el papel.
  if (s.reprocann_tiene === true)  campos.reprocann_estado = 'Vigente'
  if (s.reprocann_tiene === false) campos.reprocann_estado = 'Sin registro'
  return campos
}

export const solicitudesService = {
  /**
   * Crea la solicitud y devuelve el token. Es la única vez que se puede
   * conocer: no hay forma de volver a pedirlo.
   */
  async crear(datos: {
    nombre: string; dni: string; email?: string; telefono?: string; notas?: string
    /** Si acepto el Mandato de Gestion Operativa al pedir el alta. */
    mandatoAceptado?: boolean
    /**
     * El resto del legajo de admision. Va como UN jsonb y no como veinte
     * parametros: agregar una pregunta no obliga a dropear y recrear la funcion
     * —y a perder los grants, que ya costo caro el 26/08/2026—.
     *
     * La base valida lo que entra: una cantidad que no sea numero, una unidad
     * que no este en la lista o un «numero» de REPROCANN que no tenga digitos
     * quedan en null en vez de romper el alta. Ver la migracion
     * 20260826220000_legajo_de_admision.sql.
     */
    legajo?: Legajo
  }): Promise<string> {
    const { data, error } = await supabase.rpc('solicitud_crear', {
      p_nombre: datos.nombre,
      p_dni: datos.dni,
      p_email: datos.email ?? null,
      p_telefono: datos.telefono ?? null,
      p_notas: datos.notas ?? null,
      // La FECHA de la firma no se manda: la pone la base. Una fecha de firma
      // que manda quien firma no prueba nada.
      p_mandato_aceptado: datos.mandatoAceptado ?? false,
      p_mandato_version: datos.mandatoAceptado ? VERSION_MANDATO : null,
      p_legajo: datos.legajo ?? {},
    })
    if (error) throw new Error(error.message)
    if (!data) throw new Error('No se pudo registrar la solicitud')
    return String(data)
  },

  /**
   * Adjunta un documento —la constancia de REPROCANN o el DNI— desde el link
   * de la persona.
   *
   * NO va contra la tabla ni contra Storage: va contra la Edge Function
   * `solicitud-adjunto`, que valida el token y escribe con service role. Darle
   * a `anon` permiso de subida sobre `documentos` sería abrir escritura pública
   * en un bucket que ya guarda las credenciales de 223 personas, y la clave
   * anónima está en el bundle, a la vista de cualquiera.
   */
  async adjuntarDocumento(
    token: string, tipo: 'reprocann' | 'dni', archivo: File, reprocannNro?: string,
  ): Promise<void> {
    const url = import.meta.env.VITE_SUPABASE_URL
    if (!url) throw new Error('No hay conexión con el servidor')

    const form = new FormData()
    form.append('token', token)
    form.append('tipo', tipo)
    form.append('archivo', archivo)
    if (reprocannNro?.trim()) form.append('reprocann_nro', reprocannNro.trim())

    const r = await fetch(`${url}/functions/v1/solicitud-adjunto`, {
      method: 'POST', body: form,
    })
    // El cuerpo puede no ser JSON si el gateway cortó antes de llegar a la
    // función —es lo que pasa si se deploya con verify_jwt en true—, así que el
    // parseo va protegido: si no, el error real queda tapado por un
    // «Unexpected token» que no le dice nada a nadie.
    let cuerpo: { ok?: boolean; error?: string } = {}
    try { cuerpo = await r.json() } catch { /* se resuelve abajo */ }
    if (!r.ok || !cuerpo.ok) {
      throw new Error(cuerpo.error ?? `No se pudo subir el archivo (error ${r.status})`)
    }
  },

  /** Cómo va la solicitud de este token. `null` si el token no abre nada. */
  async estado(token: string): Promise<EstadoPublico | null> {
    const { data, error } = await supabase.rpc('solicitud_estado', { p_token: token })
    if (error) throw new Error(error.message)
    const fila = Array.isArray(data) ? data[0] : data
    return (fila as EstadoPublico) ?? null
  },

  // ---------- De acá para abajo, con sesión ----------

  async listar(): Promise<Solicitud[]> {
    const { data, error } = await supabase.from('ong_solicitudes').select('*')
      .order('creada_en', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as Solicitud[]
  },

  async cambiarEstado(id: string, estado: EstadoSolicitud, motivo?: string | null): Promise<void> {
    const { error } = await supabase.from('ong_solicitudes')
      .update({ estado, motivo: motivo ?? null, actualizada_en: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  /**
   * Se queda con la solicitud para darla de alta, o devuelve false si otro ya
   * la tomó.
   *
   * ES UN CANDADO, y hace falta: el alta automática corre cuando alguien abre
   * la bandeja, así que dos personas con la pantalla abierta —o la misma con
   * dos pestañas— la procesarían las dos y crearían DOS fichas de la misma
   * persona. El update tiene que afectar una fila o ninguna: el que la
   * consigue, la trabaja.
   *
   * ⚠️ EL CANDADO NO PUEDE SER `estado = 'pendiente'`. Lo era, y funcionaba
   * mientras el alta automática mirara sólo las pendientes. Desde que también
   * mira las que están en «verificando» —porque marcarlas ahí las dejaba
   * muertas, ver `esperandoAlta`— ese candado no cierra nada: el primero que
   * llega la pasa a `en_revision`, que es justo el estado que el segundo
   * también acepta, y las dos pestañas crean la ficha.
   *
   * El candado es ahora `actualizada_en`: se manda de vuelta el timestamp
   * exacto que se leyó, así el update matchea sólo si nadie tocó la fila desde
   * entonces. El primero que escribe lo cambia y el segundo matchea cero filas.
   */
  async tomarParaAlta(s: { id: string; actualizada_en?: string | null }): Promise<boolean> {
    const q = supabase.from('ong_solicitudes')
      .update({ estado: 'en_revision', actualizada_en: new Date().toISOString() })
      // Sin ficha enganchada: una que ya la tiene está resuelta, se mire por
      // donde se mire.
      .eq('id', s.id).is('paciente_id', null)
    const { data, error } = await (s.actualizada_en
      ? q.eq('actualizada_en', s.actualizada_en)
      // Sin timestamp no hay CAS posible; queda el candado viejo, que al menos
      // sirve para el caso de la solicitud recién entrada.
      : q.eq('estado', 'pendiente')).select('id')
    if (error) throw new Error(error.message)
    return (data?.length ?? 0) > 0
  },

  /**
   * Crea la ficha de paciente y la de asociado, y deja la solicitud resuelta.
   *
   * El asociado se crea SIN acta: el alta la ratifica la Comisión Directiva y
   * eso no lo puede hacer un sistema. Queda en la cola de «altas sin acta» que
   * Coherencia ya lista, para que una sola acta ratifique todas juntas.
   *
   * La firma del mandato NO se copia acá: la copia el trigger de la base al
   * quedar enganchado el `asociado_id`, para que llegue por el mismo camino se
   * apruebe desde donde se apruebe.
   */
  async darDeAlta(s: Solicitud): Promise<{ pacienteId: string; asociadoId: string }> {
    const paciente = await registroService.crearPaciente({
      nombre_completo: s.nombre,
      dni: s.dni,
      email: s.email ?? null,
      telefono: s.telefono ?? null,
      socio: true,
      activo: true,
      fecha_alta: new Date().toISOString().slice(0, 10),
      // El legajo viaja a la ficha. Sin esto, la persona contesta doce preguntas
      // y del otro lado alguien las vuelve a tipear mirando la solicitud.
      ...camposDelLegajo(s),
    })
    const asociado = await ongService.guardarAsociado({
      nombre: s.nombre,
      dni: s.dni,
      paciente_id: paciente.id,
      activo: true,
      fecha_alta: new Date().toISOString().slice(0, 10),
    })
    await this.marcarResuelta(s.id, { paciente_id: paciente.id, asociado_id: asociado.id })
    return { pacienteId: paciente.id, asociadoId: asociado.id }
  },

  /**
   * La solicitud es de alguien que YA ESTÁ: se engancha a su ficha en vez de
   * crear una nueva.
   *
   * Es el camino que más se usa desde la campaña del 26/08/2026, donde el link
   * se le manda a los 211 socios existentes para que firmen el mandato y
   * carguen su REPROCANN. Para ellos «dar de alta» sería duplicar la ficha.
   *
   * SÓLO COMPLETA LO QUE FALTA, NUNCA PISA. La ficha del padrón es la buena: la
   * cargó la asociación y tiene el historial de entregas colgando. Lo que trae
   * el formulario es lo que la persona recuerda, escrito en un teléfono. Ante
   * la duda gana la ficha.
   *
   * La firma del mandato NO se copia acá: la copia el trigger de la base al
   * quedar enganchado el `asociado_id`, igual que en un alta. Un solo camino
   * para la firma, se apruebe desde donde se apruebe.
   */
  async actualizarLegajo(s: Solicitud, pacienteId: string): Promise<void> {
    const paciente = await registroService.getPaciente(pacienteId)

    // Sólo los campos vacíos, y sólo si la solicitud trae algo.
    const completar: Record<string, string> = {}
    const siFalta = (campo: 'email' | 'telefono', valor: string | null) => {
      if (valor && !String(paciente[campo] ?? '').trim()) completar[campo] = valor
    }
    siFalta('email', s.email)
    siFalta('telefono', s.telefono)
    // El número de REPROCANN entra sólo si la ficha no tiene ninguno. Pisarlo
    // con lo que alguien tipeó de memoria es cambiar un dato verificado por uno
    // declarado, y ese campo ya dio un disgusto el 25/08/2026.
    if (s.reprocann_nro && !String(paciente.reprocann_nro ?? '').trim()) {
      completar.reprocann_nro = s.reprocann_nro
    }
    // Y el resto del legajo, con el mismo criterio: sólo lo que la ficha no
    // tiene. Un socio que vuelve a completar el formulario trae datos nuevos
    // (patología, médico, fecha de nacimiento) que la ficha vieja no tenía.
    for (const [k, v] of Object.entries(camposDelLegajo(s))) {
      const actual = (paciente as unknown as Record<string, unknown>)[k]
      if (v !== null && v !== undefined && !String(actual ?? '').trim()) {
        completar[k] = v as string
      }
    }

    if (Object.keys(completar).length > 0) {
      await registroService.actualizarPaciente(pacienteId, completar)
    }

    // El asociado, para que el trigger tenga dónde dejar la firma del mandato.
    // Puede no haber: hay pacientes que no son socios.
    const { data: aso } = await supabase.from('ong_asociados')
      .select('id').eq('paciente_id', pacienteId).limit(1)
    const asociadoId = aso?.[0]?.id as string | undefined

    const { error } = await supabase.from('ong_solicitudes')
      .update({
        estado: 'aceptada',
        paciente_id: pacienteId,
        asociado_id: asociadoId ?? null,
        motivo: s.motivo,
        actualizada_en: new Date().toISOString(),
      })
      .eq('id', s.id)
    if (error) throw new Error(error.message)
  },

  /** Deja anotado con qué fichas quedó resuelta, para poder rastrearlo después. */
  async marcarResuelta(id: string, ids: { paciente_id?: string; asociado_id?: string }): Promise<void> {
    const { error } = await supabase.from('ong_solicitudes')
      .update({ ...ids, estado: 'aceptada', actualizada_en: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
}
