// ============================================================================
// GrowFlow - Servicios Supabase (capa de datos)
// Toda interaccion con la DB pasa por aca
// ============================================================================

import { supabase } from './supabase'
import type { Session } from '@supabase/supabase-js'
import type {
  PerfilUsuario,
  TipoOperacion, EstadoOperacion
} from '../types'

// ============================================================================
// AUTH
// ============================================================================

/**
 * Estado del deduplicador de `getPerfil`. Ver el comentario de ese metodo.
 * Vive en el modulo y no en un componente: el punto es que sea UNO solo para
 * toda la app, sin importar cuantos componentes pidan el perfil.
 */
let perfilEnVuelo: Promise<PerfilUsuario | null> | null = null
let perfilCache: { perfil: PerfilUsuario | null; t: number } | null = null
const PERFIL_TTL_MS = 5000

/** Tira la cache del perfil. Se llama en cada cambio de sesion. */
function olvidarPerfil() {
  perfilCache = null
  perfilEnVuelo = null
}

export const authService = {
  async login(email: string, password: string) {
    olvidarPerfil()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    // Deja la marca de que entro, que es lo que mira la pantalla de Usuarios
    // cuando alguien dice «invite a fulano y no se si le llego».
    //
    // Va DESPUES del login y sin await sobre el resultado: si la marca falla, la
    // persona ya entro y no tiene por que enterarse. Es una funcion y no un
    // update porque una policy de UPDATE sobre la fila propia dejaria cambiar
    // tambien el `rol`. Ver la migracion `marcar_el_ultimo_acceso`.
    supabase.rpc('marcar_acceso').then(() => {}, () => {})
    return data
  },

  async logout() {
    olvidarPerfil()
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  /**
   * El perfil de quien esta usando la app, sin pedirlo veinte veces.
   *
   * MEDIDO EN PRODUCCION EL 29/08/2026: al abrir la app salian 140 llamadas a
   * la base para 34 consultas distintas. Las dos peores eran estas —
   * `auth/v1/user` 23 veces y `perfiles_usuario` 21— porque `useAuth` guarda su
   * estado en un `useState` LOCAL: cada componente que lo usa hace su propia
   * consulta, y ademas cada uno se suscribe a `onAuthChange`, asi que un solo
   * evento de sesion dispara una recarga POR SUSCRIPCION.
   *
   * Se arregla aca y no en `useAuth` a proposito: mover el hook a un contexto
   * es el arreglo de fondo, pero toca la estructura de los componentes y hoy
   * no es el dia. Esto no cambia ninguna firma.
   *
   * DOS MECANISMOS, y el primero es el que mas saca:
   *
   * 1. Las llamadas simultaneas comparten UNA promesa. Si cuatro componentes
   *    montan a la vez y los cuatro piden el perfil, sale una sola consulta y
   *    los cuatro esperan la misma.
   * 2. Una cache de cinco segundos, que cubre la rafaga del arranque sin
   *    quedarse con un perfil viejo. Es corta a proposito: los permisos salen
   *    de aca, y un permiso desactualizado es peor que una consulta de mas.
   *
   * SE INVALIDA SIEMPRE que la sesion cambia —login, logout y cualquier evento
   * de `onAuthChange`—, para que no quede el perfil de quien acaba de salir.
   */
  async getPerfil(): Promise<PerfilUsuario | null> {
    if (perfilEnVuelo) return perfilEnVuelo
    if (perfilCache && Date.now() - perfilCache.t < PERFIL_TTL_MS) return perfilCache.perfil

    perfilEnVuelo = (async () => {
      // ⚠️ `getSession`, NO `getUser`. Los dos devuelven el usuario, pero
      // `getUser` PEGA A LA RED —`/auth/v1/user`— y `getSession` lee el token
      // que ya está en el navegador.
      //
      // No es sólo una consulta de menos. Un `getUser` puede hacer que
      // `onAuthStateChange` emita, y ese evento tira la caché del perfil, que
      // hace pedir el perfil de nuevo, que llama a `getUser` otra vez. Medido
      // en producción el 04/09/2026: `perfiles_usuario` salía a los 1.585 ms,
      // 2.989, 5.590 y 7.567, sin que nadie tocara nada. Era eso.
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return null

      const { data, error } = await supabase
        .from('perfiles_usuario')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) return null
      return data as PerfilUsuario
    })()

    try {
      const perfil = await perfilEnVuelo
      perfilCache = { perfil, t: Date.now() }
      return perfil
    } finally {
      perfilEnVuelo = null
    }
  },

  onAuthChange(callback: (event: string, session: Session | null) => void) {
    // Cualquier cambio de sesion tira la cache antes de avisarle a nadie.
    return supabase.auth.onAuthStateChange((event, session) => {
      olvidarPerfil()
      callback(event, session)
    })
  }
}

// ============================================================================
// STOCK / LOTES
// ============================================================================

export const stockService = {
  async getStockActual() {
    const { data, error } = await supabase
      .from('vista_stock_actual')
      .select('*')
      .order('creado_en', { ascending: false })

    if (error) throw new Error(error.message)
    return data
  },

  async getLotes(estado?: string) {
    let query = supabase
      .from('lotes')
      .select(`
        *,
        productos:producto_id (nombre, tipo_producto, unidad_medida),
        instalaciones:instalacion_id (nombre, tipo)
      `)
      .eq('eliminado', false)
      .order('creado_en', { ascending: false })

    if (estado) query = query.eq('estado', estado)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data
  },

  async getIndividuos(loteId?: string) {
    let query = supabase
      .from('individuos')
      .select(`
        *,
        productos:producto_id (nombre),
        lotes:lote_id (codigo_lote),
        instalaciones:instalacion_id (nombre)
      `)
      .eq('eliminado', false)
      .eq('estado', 'activo')

    if (loteId) query = query.eq('lote_id', loteId)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data
  },

  async getMovimientosLote(loteId: string) {
    const { data, error } = await supabase
      .from('operaciones')
      .select(`
        *,
        instalacion_origen:instalacion_origen_id (nombre),
        instalacion_destino:instalacion_destino_id (nombre)
      `)
      .or(`lote_origen_id.eq.${loteId},lote_destino_id.eq.${loteId}`)
      .order('fecha_operacion', { ascending: false })
      .limit(50)

    if (error) throw new Error(error.message)
    return data
  }
}

// ============================================================================
// OPERACIONES
// ============================================================================

export const operacionesService = {
  async getOperaciones(limit = 50) {
    const { data, error } = await supabase
      .from('operaciones')
      .select(`
        *,
        instalacion_origen:instalacion_origen_id (nombre),
        instalacion_destino:instalacion_destino_id (nombre),
        lote_origen:lote_origen_id (codigo_lote),
        lote_destino:lote_destino_id (codigo_lote)
      `)
      .order('fecha_operacion', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return data
  },

  async crearOperacion(datos: {
    tipo_operacion: TipoOperacion
    instalacion_origen_id?: string
    lote_origen_id?: string
    instalacion_destino_id?: string
    lote_destino_id?: string
    cantidad_entrada?: number
    cantidad_salida?: number
    responsable?: string
    observaciones?: string
    notas_sanitarias?: string
    peso_fresco_kg?: number
    peso_seco_kg?: number
    peso_neto_g?: number
    rendimiento_porcentaje?: number
    temperatura_c?: number
    humedad_porcentaje?: number
    texto_original?: string
    json_estructurado?: Record<string, unknown>
  }) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { data, error } = await supabase
      .from('operaciones')
      .insert({
        ...datos,
        estado: 'borrador' as EstadoOperacion,
        creado_por: user.id,
      })
      .select()

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) throw new Error('No se pudo crear la operacion')
    return data[0]
  },

  async confirmarOperacion(operacionId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { data, error } = await supabase
      .from('operaciones')
      .update({
        estado: 'confirmada' as EstadoOperacion,
        confirmado_por: user.id,
        confirmado_en: new Date().toISOString(),
      })
      .eq('id', operacionId)
      .select()

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) throw new Error('No se pudo confirmar la operacion')
    return data[0]
  },

  async getEstadisticas() {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const [lotesRes, individuosRes, opsHoyRes] = await Promise.all([
      supabase.from('lotes').select('id', { count: 'exact', head: true }).eq('estado', 'activo').eq('eliminado', false),
      supabase.from('individuos').select('id', { count: 'exact', head: true }).eq('estado', 'activo').eq('eliminado', false),
      supabase.from('operaciones').select('id', { count: 'exact', head: true }).gte('fecha_operacion', hoy.toISOString()),
    ])

    return {
      lotesActivos: lotesRes.count || 0,
      individuosActivos: individuosRes.count || 0,
      operacionesHoy: opsHoyRes.count || 0,
    }
  }
}

// ============================================================================
// CATALOGO (productos, instalaciones, almacenes)
// ============================================================================

export const catalogoService = {
  async getProductos() {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('activo', true)
      .eq('eliminado', false)
      .order('nombre')
    if (error) throw new Error(error.message)
    return data
  },

  async getInstalaciones() {
    const { data, error } = await supabase
      .from('instalaciones')
      .select('*, almacenes:almacen_id (nombre)')
      .eq('activo', true)
      .eq('eliminado', false)
      .order('nombre')
    if (error) throw new Error(error.message)
    return data
  },

  async getVariedades() {
    const { data, error } = await supabase
      .from('variedades')
      .select('*')
      .eq('activo', true)
      .eq('eliminado', false)
      .order('nombre')
    if (error) throw new Error(error.message)
    return data
  },

  async getConfiguracion() {
    const { data, error } = await supabase
      .from('configuracion_sistema')
      .select('*')
      .order('categoria', { ascending: true })
    if (error) throw new Error(error.message)
    return data
  }
}

// ============================================================================
// TRAZABILIDAD
// ============================================================================

export const trazabilidadService = {
  async getCadenaInversa(loteId: string) {
    // Usa la vista recursiva para obtener toda la cadena
    const { data, error } = await supabase
      .from('vista_trazabilidad_inversa')
      .select('*')
      .eq('id', loteId)

    if (error) throw new Error(error.message)

    // Si no hay resultado directo, buscar por codigo_lote
    if (!data || data.length === 0) {
      const { data: dataByCode, error: errCode } = await supabase
        .from('vista_trazabilidad_inversa')
        .select('*')

      if (errCode) throw new Error(errCode.message)
      return dataByCode
    }

    return data
  },

  async buscarPorCodigo(codigo: string) {
    // Buscar en lotes
    const { data: lotes } = await supabase
      .from('lotes')
      .select('*, productos:producto_id (nombre, tipo_producto), instalaciones:instalacion_id (nombre)')
      .ilike('codigo_lote', `%${codigo}%`)
      .limit(10)

    // Buscar en individuos
    const { data: individuos } = await supabase
      .from('individuos')
      .select('*, productos:producto_id (nombre), lotes:lote_id (codigo_lote), instalaciones:instalacion_id (nombre)')
      .ilike('codigo_serie', `%${codigo}%`)
      .limit(10)

    return { lotes: lotes || [], individuos: individuos || [] }
  }
}

// ============================================================================
// AUDITORIA
// ============================================================================

export const auditoriaService = {
  async getRegistros(limit = 100) {
    const { data, error } = await supabase
      .from('registro_auditoria')
      .select('*')
      .order('marca_tiempo', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return data
  },

  async verificarIntegridad() {
    const { data, error } = await supabase.rpc('verificar_integridad_cadena')
    if (error) throw new Error(error.message)
    return data
  }
}
