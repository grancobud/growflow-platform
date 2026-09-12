// ============================================================================
// Registro de pacientes REPROCANN - capa de datos
// Fichero de pacientes vinculados a la asociacion civil + PDF de credencial.
// ============================================================================

import { supabase } from './supabase'
import { ordenarPorApellido } from './buscarPersonas'

/**
 * `Sin registro` se agrego el 20/08/2026 junto con la tarifa por REPROCANN.
 * Antes todos los pacientes caian en 'En tramite' —el formulario ofrecia una
 * sola opcion que decia "VIGENTE / VENCIDO / PENDIENTE"— y con todos en el mismo
 * estado la tarifa no distinguia a nadie. NO habilita: es tan no-habilitado como
 * 'En tramite', solo que ahora se distinguen.
 */
export type EstadoReprocann = 'Vigente' | 'En tramite' | 'Vencido' | 'Rechazado' | 'Sin registro'
export type Modalidad = 'Cultivo propio' | 'Cultivo solidario' | 'Tercero/ONG'

export const ESTADOS_REPROCANN: EstadoReprocann[] = ['Vigente', 'En tramite', 'Vencido', 'Rechazado', 'Sin registro']
export const MODALIDADES: Modalidad[] = ['Cultivo propio', 'Cultivo solidario', 'Tercero/ONG']

export interface Paciente {
  /**
   * C3: el PAC-XXX. Hasta el 20/08/2026 vivia como prefijo de `notas`, lo que
   * obligaba a partir un texto para leerlo y lo dejaba expuesto a que alguien
   * editara las notas y lo borrara. Lo asigna un trigger de la base.
   */
  codigo?: string | null
  id: string
  nombre_completo: string
  dni: string | null
  fecha_nacimiento: string | null
  telefono: string | null
  email: string | null
  localidad: string | null
  provincia: string | null
  domicilio: string | null
  foto_url: string | null
  reprocann_nro: string | null
  /**
   * El codigo que ESTA PERSONA saca en REPROCANN y le da a la asociacion.
   *
   * Es de la persona, no de la entidad. Estuvo al reves hasta el 02/09/2026:
   * habia una sola columna en `ong_entidad` y la pantalla decia que la ONG le
   * pasaba ese numero a la gente. El circuito publico ya lo contaba bien —el
   * primer paso de `/sumate` es que la persona lo saque en Mi Argentina, gratis
   * y sola—, asi que el lado de adentro se contradecia con el de afuera.
   *
   * Sin esto la asociacion no la puede vincular, y sin vinculo no se le puede
   * entregar. Por eso Coherencia lo cuenta.
   */
  codigo_vinculacion?: string | null
  reprocann_estado: EstadoReprocann
  reprocann_emision: string | null
  reprocann_vencimiento: string | null
  modalidad: Modalidad | null
  credencial_url: string | null
  patologia: string | null
  medico_tratante: string | null
  matricula_medico: string | null
  /**
   * El aporte pactado por gramo cuando `nivel_tarifa` es 'acuerdo'.
   *
   * Nullable a proposito: null es «no hay acuerdo», no cero. Un cero acá diria
   * que la persona no aporta nada, que es otra cosa.
   *
   * Llega en NULL a quien no ve plata: la vista `pacientes_segun_rol` la anula
   * detras de `puede_ver_plata()`, y el trigger de la base impide que ese NULL
   * pise el valor real al guardar.
   */
  aporte_acordado_g?: number | null
  /**
   * El analisis del acuerdo: contra que costo se compara, cuanto absorbe la
   * asociacion, si esta ratificado.
   *
   * Va aparte de `notas` porque `notas` la ve TODO el que ve el padron —el
   * director medico incluido, que tiene la plata cerrada— y esto es plata.
   * Hasta el 31/08/2026 vivia adentro de `notas` y por eso se filtraba.
   */
  notas_economicas?: string | null
  /**
   * Quien trabaja en la asociación y se lleva material como parte de su pago.
   *
   * Sus retiros sin aporte son `retribucion_en_especie`, no una deuda. Sin esto,
   * Socio y Socio acumulaban 566 g de los 1.534 sin cobrar —el 37%— y
   * cualquier cuenta corriente les hubiera inventado una deuda millonaria a las
   * dos personas que sostienen la sede.
   *
   * Va en la FICHA y no en una lista de códigos en el código: el día que entre
   * alguien más al equipo, sus retiros no tienen que nacer como deuda.
   */
  retira_como_retribucion?: boolean | null
  plantas_habilitadas: number | null
  m2_habilitados: number | null
  /**
   * Tope de gramos en la ventana móvil de 30 días. No se deriva de
   * plantas_habilitadas —una es el cupo de cultivo y la otra el de entrega— y
   * queda en null si no está asignado: sin él, la validación no corre en vez de
   * inventar un límite.
   */
  tope_mensual_g?: number | null
  socio: boolean
  fecha_alta: string | null
  activo: boolean
  notas: string | null
  creado_en: string
}

function lanzar(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

// Sube y devuelve el PATH dentro del bucket, no una URL publica. La credencial
// es un dato personal del paciente: si se guarda la URL publica, el PDF queda
// accesible para cualquiera que la tenga, sin login y para siempre. Se lee con
// createSignedUrl (ver urlDeCredencial), igual que las fichas tecnicas.
async function subirA(bucket: string, file: File, prefijo: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const nombre = `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(nombre, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || 'application/octet-stream',
  })
  if (error) throw new Error(error.message)
  return nombre
}

export { urlDeCredencial } from './archivos'

// Dias hasta el vencimiento de la credencial (negativo = vencida, null = sin fecha).
export function diasParaVencer(p: Pick<Paciente, 'reprocann_vencimiento'>): number | null {
  if (!p.reprocann_vencimiento) return null
  const venc = new Date(p.reprocann_vencimiento + 'T00:00:00')
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((venc.getTime() - hoy.getTime()) / 86400000)
}

export const registroService = {
  // Lee de la VISTA, no de la tabla, y escribe contra la tabla.
  //
  // `pacientes_segun_rol` devuelve las mismas filas con las cuatro columnas
  // sensibles —patologia, medico tratante, matricula, credencial— en NULL para
  // quien no atiende pacientes. Es minimizacion (Ley 25.326 art. 4): para
  // cobrar una cuota no hace falta el diagnostico.
  //
  // El RLS de Postgres decide FILAS, no columnas, por eso hace falta una vista.
  // Es el mismo mecanismo que `lotes_stock` para el stock sin el precio.
  //
  // Y que el administrativo reciba NULL no alcanza: al guardar, el formulario
  // mandaria ese NULL sobre la patologia real. Eso lo frena el trigger
  // `preservar_lo_clinico` en la base, no este archivo.
  async getPacientes(soloActivos = false): Promise<Paciente[]> {
    let q = supabase.from('pacientes_segun_rol').select('*')
    if (soloActivos) q = q.eq('activo', true)
    const { data, error } = await q.order('nombre_completo')
    lanzar(error)
    // POR APELLIDO, que es como se muestra en toda la app.
    //
    // Ordenar por `nombre_completo` y mostrar «Apellido, Nombres» dejaba la
    // lista peor que antes: se veía «Ariel, Aguirre Walter» arriba de
    // «Maidana, Agustín», o sea ordenada por un texto que no es el que está a
    // la vista. El orden se hace una sola vez acá para que ninguna pantalla
    // pueda quedar con un criterio distinto.
    return ordenarPorApellido((data ?? []) as Paciente[])
  },

  async getPaciente(id: string): Promise<Paciente> {
    const { data, error } = await supabase.from('pacientes_segun_rol').select('*').eq('id', id).single()
    lanzar(error)
    return data as Paciente
  },

  async crearPaciente(p: Partial<Paciente> & { nombre_completo: string }): Promise<Paciente> {
    const { data, error } = await supabase.from('pacientes').insert(p).select().single()
    lanzar(error)
    return data as Paciente
  },

  async actualizarPaciente(id: string, p: Partial<Paciente>): Promise<void> {
    const { error } = await supabase.from('pacientes').update(p).eq('id', id)
    lanzar(error)
  },

  async eliminarPaciente(id: string): Promise<void> {
    const { error } = await supabase.from('pacientes').delete().eq('id', id)
    lanzar(error)
  },

  /** Guarda el PATH: la credencial se ve con URL firmada (ver urlDeCredencial). */
  subirCredencial(file: File): Promise<string> {
    return subirA('documentos', file, 'credencial')
  },

  /** Guarda el PATH: se muestra con <FotoPrivada>, que pide la URL firmada. */
  subirFotoPaciente(file: File): Promise<string> {
    return subirA('fotos', file, 'paciente')
  },
}
