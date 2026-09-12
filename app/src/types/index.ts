// ============================================================================
// GrowFlow - Tipos TypeScript (espejo del schema PostgreSQL)
// ============================================================================

// Los roles del circuito real.
//
// SE FUERON 'operador' Y 'supervisor' (01/09/2026). Estaban «por compatibilidad
// con filas viejas» y se midio: hay CERO filas con esos roles. El motivo que los
// sostenia ya no existia, y mientras existieran eran una trampa latente —
// ninguna policy del RLS los nombra, asi que asignarle uno a alguien creaba un
// usuario que entra y no ve absolutamente nada, sin ningun error que lo explique.
//
// La lista de roles vive en CINCO lugares (este, `PERMISOS_ROL`,
// `ROLES_ASIGNABLES`, la Edge Function `usuarios-invitar` y el check de la base
// mas las policies que los nombran). Se saco de los tres donde estaban.
export type RolUsuario =
  | 'administrador'
  /** Administra TODO, plata incluida: nacio como «todo menos la caja» y Gaston
      lo cambio el 30/08/2026. Hoy es identico a `administrador` en permisos; la
      diferencia es cual es la cuenta de la entidad y cual una persona. */
  | 'administrador_sistema'
  /**
   * Quien abre la sede: toma los valores de la sala, controla caja y stock, y
   * atiende el mostrador. Nada mas. Lo definio Socio el 02/09/2026 mirando
   * el panel de apertura — es el rol de Socio.
   */
  | 'mostrador'
  | 'cultivador'
  /** El responsable tecnico del cultivo (Res. 1780): el `cultivador` MAS los
      traslados, las declaraciones juradas y los predios. Responde por lo que
      sale del predio, asi que firma la carta de porte y lo que se declara. */
  | 'director_cultivo'
  | 'director_medico'
  | 'administrativo'
  | 'auditor'
  | 'demo'

export type TipoOperacion =
  | 'ingreso_insumos'
  | 'planta_madre'
  | 'fertilizacion'
  | 'utilizacion_insumos'
  | 'baja_stock'
  | 'esquejado'
  | 'vegetativa'
  | 'poda'
  | 'floracion'
  | 'control_plagas'
  | 'cosecha'
  | 'secado'
  | 'trimming'
  | 'cuarentena'
  | 'fraccionamiento'
  | 'almacenamiento'

export type TipoProducto =
  | 'insumo'
  | 'planta_madre'
  | 'esqueje'
  | 'planta'
  | 'flor'
  | 'flor_trimmeada'
  | 'flor_fraccionada'
  | 'producto_final'

export type EstadoItem = 'activo' | 'baja' | 'consumido' | 'procesado' | 'cuarentena'
export type EstadoOperacion = 'borrador' | 'confirmada' | 'anulada'

// Etiquetas legibles para la UI
export const ETIQUETAS_OPERACION: Record<TipoOperacion, string> = {
  ingreso_insumos: 'Ingreso de Insumos',
  planta_madre: 'Trazabilidad Planta Madres',
  fertilizacion: 'Fertilizacion',
  utilizacion_insumos: 'Utilizacion de Insumos',
  baja_stock: 'Baja de Stock',
  esquejado: 'Esquejado',
  vegetativa: 'Vegetativa',
  poda: 'Poda',
  floracion: 'Floracion',
  control_plagas: 'Control de Plagas',
  cosecha: 'Cosecha',
  secado: 'Secado',
  trimming: 'Trimming',
  cuarentena: 'Cuarentena',
  fraccionamiento: 'Fraccionamiento',
  almacenamiento: 'Almacenamiento',
}

export const ICONOS_OPERACION: Record<TipoOperacion, string> = {
  ingreso_insumos: '📦',
  planta_madre: '🌱',
  fertilizacion: '💧',
  utilizacion_insumos: '🪴',
  baja_stock: '❌',
  esquejado: '✂️',
  vegetativa: '🌿',
  poda: '🪓',
  floracion: '🌸',
  control_plagas: '🐛',
  cosecha: '🌾',
  secado: '☀️',
  trimming: '✂️',
  cuarentena: '🔬',
  fraccionamiento: '📐',
  almacenamiento: '🏪',
}

export interface PerfilUsuario {
  id: string
  nombre_completo: string
  rol: RolUsuario
  activo: boolean
  ultimo_acceso: string | null
}

export interface Operacion {
  id: string
  tipo_operacion: TipoOperacion
  estado: EstadoOperacion
  instalacion_origen_id: string | null
  lote_origen_id: string | null
  instalacion_destino_id: string | null
  lote_destino_id: string | null
  cantidad_entrada: number | null
  cantidad_salida: number | null
  responsable: string | null
  observaciones: string | null
  notas_sanitarias: string | null
  peso_fresco_kg: number | null
  peso_seco_kg: number | null
  peso_neto_g: number | null
  rendimiento_porcentaje: number | null
  temperatura_c: number | null
  humedad_porcentaje: number | null
  texto_original: string | null
  json_estructurado: Record<string, unknown> | null
  fecha_operacion: string
  creado_por: string
  confirmado_por: string | null
  confirmado_en: string | null
}

export interface MensajeChat {
  id: string
  tipo: 'usuario' | 'sistema' | 'confirmacion' | 'error'
  texto: string
  timestamp: Date
  datos_estructurados?: Partial<Operacion>
}

export interface Lote {
  id: string
  codigo_lote: string
  producto_id: string
  instalacion_id: string
  cantidad: number
  estado: EstadoItem
}

export interface Individuo {
  id: string
  codigo_serie: string
  lote_id: string
  producto_id: string
  estado: EstadoItem
}
