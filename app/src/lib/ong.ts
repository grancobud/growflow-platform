import { supabase } from './supabase'
import { normalizarProveedor } from './proveedores'
import { estadoDelSeguimiento } from './estadoDelSeguimiento'
import { estadoDelOrigen, ORIGEN_EXIGIBLE_DESDE } from './estadoDelOrigen'
import { estadoDelLoteEntregado, LOTE_EXIGIBLE_DESDE } from './estadoDelLoteEntregado'

/**
 * Capa institucional de la asociación civil.
 *
 * El resto de la app cubre la operación (plantas, cosecha, costos). Esto cubre
 * lo otro: los plazos que, si se vencen, te frenan todos los trámites aunque el
 * cultivo ande perfecto. Las dos cosas que más cuelgan a una ONG son el mandato
 * de autoridades vencido y la reinscripción anual del REPROCANN.
 */

export interface Entidad {
  id: string
  razon_social?: string | null
  cuit?: string | null
  jurisdiccion?: string | null
  organismo_control?: string | null
  sede_domicilio?: string | null
  sede_localidad?: string | null
  sede_provincia?: string | null
  fecha_constitucion?: string | null
  cierre_ejercicio_dia?: number | null
  cierre_ejercicio_mes?: number | null
  mandato_anios?: number | null
  mandato_desde?: string | null
  reprocann_inscripcion?: string | null
  reprocann_vencimiento?: string | null
  tope_pacientes?: number | null
  plantas_por_paciente?: number | null
  tope_predios?: number | null
  /**
   * Gramos que se espera de cada planta en floracion. Lo declara el DIRECTOR
   * TECNICO DE CULTIVO, que es otra figura que el Director Medico —ese firma
   * los informes clinicos—. Null mientras no lo declaren: la cadena de
   * justificacion dice «no se puede saber» en vez de estimarlo, porque el
   * numero que sale de aca decide si la biomasa cierra.
   */
  rinde_esperado_planta_g?: number | null
  director_tecnico?: string | null
  director_tecnico_matricula?: string | null
  /** El estatuto tiene que declarar explícitamente el objeto cannábico. */
  objeto_cannabis?: boolean
  objeto_social?: string | null
  /** Código que la ONG le pasa al paciente para vincularse desde Mi Argentina. */
  codigo_vinculacion?: string | null
  /**
   * Con que nombre figura la PROPIA entidad en `proveedor`.
   *
   * Lo que este a ese nombre es produccion propia y no deuda con un tercero.
   * NULL = la entidad no carga su produccion como orden de servicio.
   */
  proveedor_propio?: string | null
  /**
   * Beta: los bloqueos duros del portal se muestran pero no frenan.
   *
   * Existe para poder operar mientras faltan los datos de la entidad. El freno
   * sigue escrito, sigue calculandose y sigue mostrandose: lo unico que cambia
   * es que no impide seguir.
   */
  modo_beta?: boolean | null
  perfil_reprocann?: string | null
  /** Última vez que la Comisión Revisora examinó los libros (mínimo trimestral). */
  ultima_revision_libros?: string | null
  notas?: string | null
}

export interface Autoridad {
  id: string
  nombre: string
  cargo: string
  organo?: string | null
  desde?: string | null
  hasta?: string | null
  activo?: boolean
  /** La 1780 los pide de TODOS los miembros, no sólo de los directivos. */
  antecedentes_penales_ok?: boolean
  cuit_activa?: boolean
  reprocann_activo?: boolean
  /**
   * Grupo familiar declarado. Dos autoridades con el mismo valor se consideran
   * parientes: sirve para detectar el cruce prohibido entre Comisión Directiva
   * y Comisión Revisora sin guardar datos personales de más.
   */
  grupo_familiar?: string | null
  fundador?: boolean
  notas?: string | null
}

export interface Requisito {
  id?: string
  clave: string
  titulo: string
  detalle?: string | null
  cumplido?: boolean
  vence?: string | null
  responsable?: string | null
  nota?: string | null
  orden?: number | null
  /** Título que acredita al responsable (postgrado, diplomatura). */
  acreditacion?: string | null
  acreditado?: boolean
}

/**
 * Los cinco requisitos de la Resolución 1780 viven en el código, no en la base.
 * Los fija la norma, no el usuario: si dependieran de filas precargadas, una
 * instalación nueva mostraría la lista vacía. La tabla guarda sólo el ESTADO
 * (cumplido, vencimiento, responsable) contra la clave.
 */
export const REQUISITOS_1780: Omit<Requisito, 'id' | 'cumplido'>[] = [
  { clave: 'director_medico', orden: 1, titulo: 'Director médico',
    detalle: 'Médico que hace el seguimiento de los pacientes de la ONG.' },
  { clave: 'responsable_tecnico', orden: 2, titulo: 'Responsable técnico',
    detalle: 'Quien responde por el cultivo. Puede ser un integrante con curso de cannabis acreditado.' },
  { clave: 'georreferenciacion', orden: 3, titulo: 'Georreferenciación',
    detalle: 'Coordenadas declaradas de cada predio de cultivo.' },
  { clave: 'notificacion_municipio', orden: 4, titulo: 'Notificación al municipio',
    detalle: 'Aviso formal al municipio de cada predio. Antes de clausurar intiman: recién a la tercera sin respuesta pueden clausurar y sacar plantas.' },
  { clave: 'pacientes_minimos', orden: 5, titulo: 'Mínimo 5 pacientes',
    detalle: 'Listado de al menos cinco pacientes vinculados a la ONG.' },
  { clave: 'cromatografia', orden: 6, titulo: 'Informe cromatográfico por lote',
    detalle: 'Un análisis por lote producido. Lo pide la 1780 tanto a las ONG como a los terceros cultivadores.' },
  { clave: 'antecedentes_penales', orden: 7, titulo: 'Antecedentes penales de todos los miembros',
    detalle: 'De la Comisión Directiva Y de la Revisora de Cuentas, sin antecedentes por la ley de estupefacientes. La 3132 sólo pedía los de los directivos.' },
  { clave: 'plan_cultivo', orden: 8, titulo: 'Plan de cultivo del responsable técnico',
    detalle: 'Se presenta como declaración jurada. El responsable técnico además registra producción, guarda y movimientos internos.' },
]

/**
 * Declaración jurada semestral de la Resolución 1780/2025.
 *
 * Se guarda lo declarado y no se recalcula al vuelo: una DDJJ presentada es una
 * foto del cultivo en ese momento y tiene que poder mostrarse igual dentro de
 * dos años, aunque las plantas de hoy sean otras.
 */
export interface DDJJ {
  id: string
  /** 2026-S1 / 2026-S2 */
  periodo: string
  fecha_presentacion?: string | null
  plantas_total?: number | null
  plantas_floracion?: number | null
  pacientes_vinculados?: number | null
  variedades?: string | null
  presentada?: boolean
  notas?: string | null
}

/**
 * Carta de porte: la DDJJ por TAD que la 1780 exige para cada traslado.
 * La norma admite tres formas de mover material y cada una tiene su tope, así
 * que el tipo determina contra qué se valida la cantidad.
 */
export interface Traslado {
  id: string
  fecha: string
  hora_salida?: string | null
  hora_llegada?: string | null
  origen?: string | null
  destino?: string | null
  ruta?: string | null
  transportista?: string | null
  transportista_dni?: string | null
  destinatario?: string | null
  tipo_material?: 'flores' | 'frascos' | 'plantas'
  cantidad?: number | null
  /**
   * Qué lote viajó. Plural y separado por coma, porque cuando un proveedor
   * mandó dos órdenes el mismo día viajaron juntas: hay traslados con hasta
   * cuatro lotes. Sin esto la guía de tránsito dice "40 g de flores" y no se
   * puede seguir hasta el origen, que es lo único para lo que existe.
   */
  lotes?: string | null
  paciente_id?: string | null
  carta_porte_presentada?: boolean
  notas?: string | null
}

export interface Predio {
  id: string
  nombre: string
  direccion?: string | null
  localidad?: string | null
  provincia?: string | null
  municipio?: string | null
  georreferenciado?: boolean
  municipio_notificado?: boolean
  activo?: boolean
  notas?: string | null
}

export const CARGOS = [
  'Presidente', 'Vicepresidente', 'Secretario', 'Tesorero',
  'Vocal titular', 'Vocal suplente',
  'Revisor de cuentas titular', 'Revisor de cuentas suplente',
] as const

export const ORGANOS = ['Comisión Directiva', 'Comisión Revisora de Cuentas'] as const

const lanzar = (e: { message: string } | null) => { if (e) throw new Error(e.message) }

/**
 * Trae una tabla entera, por páginas.
 *
 * PostgREST corta en 1000 filas y NO avisa: `.select('*')` sobre una tabla más
 * grande devuelve las primeras 1000 sin error, sin warning y sin nada que
 * distinga ese resultado de uno completo. En el panel de coherencia eso no se
 * ve como una falla: se ve como números creíbles y equivocados. Con 1241
 * dispensas cargadas, todos los chequeos corrían sobre 1000 y las 241 más
 * viejas no existían para ninguno — y `ong_caja`, con 1690, perdía 690.
 *
 * El orden lleva `id` de desempate a propósito: ordenar sólo por `fecha`, que
 * se repite muchísimo, no define un orden total, y entre página y página las
 * filas empatadas pueden reacomodarse. Ahí se duplican unas y se pierden otras
 * sin que nada falle.
 */
export const PAGINA = 1000

/**
 * Desde qué fila arranca cada página que falta, después de la primera.
 *
 * Se exporta sólo para poder fijarlo con tests: es aritmética de bordes y es
 * exactamente donde esto se rompe. Con 1.000 justas no falta ninguna —la
 * primera ya las trajo todas— y el recorrido viejo igual pedía una página de
 * más para descubrirlo.
 */
export function arranquesQueFaltan(total: number, pagina = PAGINA): number[] {
  if (total <= pagina) return []
  return Array.from({ length: Math.ceil(total / pagina) - 1 }, (_, i) => (i + 1) * pagina)
}

/**
 * LAS PÁGINAS SE PIDEN EN PARALELO, no una atrás de la otra.
 *
 * Antes era un `for` que pedía, esperaba, y recién ahí pedía la siguiente,
 * porque sin saber el total la única forma de saber si terminó es que una
 * página venga corta. El costo de eso se ve en las tres tablas grandes: caja
 * (1.746 filas), documentos (1.554) y dispensas (1.253) necesitan DOS páginas,
 * y cada una sumaba su viaje entero al tiempo de carga de la O.N.G. Medido en
 * producción, dispensas promedia 970 ms por viaje y llegó a 2.814: eran casi
 * dos segundos de esperar lo que se podía pedir junto.
 *
 * Ahora la primera página viene con el total (`count: 'exact'`) y el resto se
 * pide de una. El conteo cuesta poco a esta escala —la tabla más grande son
 * 1.746 filas— y ahorra un viaje por cada página que falte.
 *
 * ⚠️ EL DESEMPATE POR `id` SIGUE SIENDO OBLIGATORIO, y ahora más: ordenar sólo
 * por `fecha` —que se repite muchísimo— no define un orden total, y con las
 * páginas pedidas a la vez el motor puede devolver las filas empatadas en
 * distinto orden en cada una. Ahí se duplican unas y se pierden otras sin que
 * nada falle.
 */
/**
 * @param columnas  Qué traer. Por defecto todo.
 *
 *   NO ES UNA MICRO-OPTIMIZACIÓN. `ong_documentos` guarda el texto completo de
 *   cada recibo emitido en `notas`, y son 950 kB de los 1.230 que pesa la
 *   tabla: el 40% de todo lo que baja la pantalla de O.N.G. es papel que el
 *   listado no muestra. Poder pedir columnas es lo que permite dejarlo afuera.
 */
async function traerTodo<T>(tabla: string, orden: string, asc = false, columnas = '*'): Promise<T[]> {
  const pagina = (desde: number, conContador = false) => supabase
    .from(tabla)
    .select(columnas, conContador ? { count: 'exact' } : undefined)
    .order(orden, { ascending: asc }).order('id', { ascending: true })
    .range(desde, desde + PAGINA - 1)

  const { data, error, count } = await pagina(0, true)
  lanzar(error)
  const primera = (data ?? []) as T[]

  // Sin contador no se puede paralelizar nada: se cae al recorrido de antes,
  // que es lento pero correcto. Pasa si la tabla no lo devuelve.
  if (count == null) {
    const todo = [...primera]
    for (let desde = PAGINA; primera.length === PAGINA; desde += PAGINA) {
      const { data: d, error: e } = await pagina(desde)
      lanzar(e)
      const lote = (d ?? []) as T[]
      todo.push(...lote)
      if (lote.length < PAGINA) break
    }
    return todo
  }

  const resto = await Promise.all(
    arranquesQueFaltan(count).map(desde => pagina(desde)))
  for (const { data: d, error: e } of resto) {
    lanzar(e)
    primera.push(...((d ?? []) as T[]))
  }
  return primera
}

export const ongService = {
  /** La entidad es una sola fila. Si todavía no existe, devuelve null. */
  async getEntidad(): Promise<Entidad | null> {
    const { data, error } = await supabase.from('ong_entidad').select('*').limit(1)
    lanzar(error)
    return (data?.[0] as Entidad) ?? null
  },
  /**
   * Cuántos pacientes activos hay, para el tope del cupo REPROCANN.
   *
   * Sale de la vista `cupo_conteos`, que devuelve AGREGADOS y ninguna ficha:
   * el cupo necesita un número, no el padrón. Así el director de cultivo —que
   * no ve pacientes— puede ver contra qué techo está trabajando sin que se le
   * abra una sola ficha.
   *
   * Devuelve 0 si la vista no contesta. Es el mismo cero que había antes de
   * esto, así que no empeora nada: lo que cambia es que ahora hay un cero
   * MENOS, porque el rol que lo tenía por permiso ya no lo tiene.
   */
  async contarParaCupo(): Promise<number> {
    const { data } = await supabase.from('cupo_conteos').select('pacientes_activos').maybeSingle()
    return (data as { pacientes_activos?: number } | null)?.pacientes_activos ?? 0
  },

  async guardarEntidad(e: Partial<Entidad>): Promise<Entidad> {
    const { data: u } = await supabase.auth.getUser()
    const payload = { ...e, user_id: u?.user?.id ?? null, actualizado_en: new Date().toISOString() }
    const q = e.id
      ? supabase.from('ong_entidad').update(payload).eq('id', e.id).select().single()
      : supabase.from('ong_entidad').insert(payload).select().single()
    const { data, error } = await q
    lanzar(error)
    return data as Entidad
  },

  async getAutoridades(): Promise<Autoridad[]> {
    const { data, error } = await supabase.from('ong_autoridades').select('*').order('cargo')
    lanzar(error)
    return (data ?? []) as Autoridad[]
  },
  async guardarAutoridad(a: Partial<Autoridad>): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    const payload = { ...a, user_id: u?.user?.id ?? null }
    const { error } = a.id
      ? await supabase.from('ong_autoridades').update(payload).eq('id', a.id)
      : await supabase.from('ong_autoridades').insert(payload)
    lanzar(error)
  },
  async borrarAutoridad(id: string): Promise<void> {
    lanzar((await supabase.from('ong_autoridades').delete().eq('id', id)).error)
  },

  /**
   * La lista siempre sale completa: se parte de REQUISITOS_1780 y se le pega
   * encima el estado guardado. Nunca devuelve vacío, ni en una instalación
   * nueva ni en modo demo.
   */
  async getRequisitos(): Promise<Requisito[]> {
    const { data, error } = await supabase.from('ong_requisitos').select('*')
    lanzar(error)
    const guardados = new Map((data ?? []).map(r => [(r as Requisito).clave, r as Requisito]))
    return REQUISITOS_1780.map(base => ({ ...base, cumplido: false, ...(guardados.get(base.clave) ?? {}) }))
  },
  /** Upsert por clave: la fila puede no existir todavía. */
  async actualizarRequisito(clave: string, campos: Partial<Requisito>): Promise<void> {
    const base = REQUISITOS_1780.find(r => r.clave === clave)
    const { data: u } = await supabase.auth.getUser()
    const { data: hay } = await supabase.from('ong_requisitos').select('id').eq('clave', clave).limit(1)
    if (hay?.[0]) {
      lanzar((await supabase.from('ong_requisitos').update(campos).eq('id', (hay[0] as { id: string }).id)).error)
    } else {
      lanzar((await supabase.from('ong_requisitos').insert({
        clave, titulo: base?.titulo ?? clave, detalle: base?.detalle ?? null,
        orden: base?.orden ?? 0, user_id: u?.user?.id ?? null, ...campos,
      })).error)
    }
  },

  async getPredios(): Promise<Predio[]> {
    const { data, error } = await supabase.from('ong_predios').select('*').order('nombre')
    lanzar(error)
    return (data ?? []) as Predio[]
  },
  async guardarPredio(p: Partial<Predio>): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    const payload = { ...p, user_id: u?.user?.id ?? null }
    const { error } = p.id
      ? await supabase.from('ong_predios').update(payload).eq('id', p.id)
      : await supabase.from('ong_predios').insert(payload)
    lanzar(error)
  },
  async borrarPredio(id: string): Promise<void> {
    lanzar((await supabase.from('ong_predios').delete().eq('id', id)).error)
  },

  // --- libros, actas, asociados ---
  async getLibros(): Promise<Libro[]> {
    const { data, error } = await supabase.from('ong_libros').select('*').order('tipo')
    lanzar(error); return (data ?? []) as Libro[]
  },
  async guardarLibro(l: Partial<Libro>): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    const p = { ...l, user_id: u?.user?.id ?? null }
    lanzar((l.id
      ? await supabase.from('ong_libros').update(p).eq('id', l.id)
      : await supabase.from('ong_libros').insert(p)).error)
  },
  async borrarLibro(id: string): Promise<void> {
    lanzar((await supabase.from('ong_libros').delete().eq('id', id)).error)
  },

  async getActas(): Promise<Acta[]> {
    const { data, error } = await supabase.from('ong_actas').select('*').order('fecha', { ascending: false })
    lanzar(error); return (data ?? []) as Acta[]
  },
  async guardarActa(a: Partial<Acta>): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    const p = { ...a, user_id: u?.user?.id ?? null }
    lanzar((a.id
      ? await supabase.from('ong_actas').update(p).eq('id', a.id)
      : await supabase.from('ong_actas').insert(p)).error)
  },
  async borrarActa(id: string): Promise<void> {
    lanzar((await supabase.from('ong_actas').delete().eq('id', id)).error)
  },
  /** Siguiente número libre de la serie de ese tipo de acta. */
  async proximoNumeroActa(tipo: string): Promise<number> {
    const { data } = await supabase.from('ong_actas').select('numero').eq('tipo', tipo)
    const nums = (data ?? []).map(r => (r as { numero: number }).numero)
    return nums.length ? Math.max(...nums) + 1 : 1
  },

  async getAsociados(): Promise<Asociado[]> {
    return traerTodo<Asociado>('ong_asociados', 'nombre', true)
  },
  /**
   * Guarda el asociado y DEVUELVE la fila, igual que guardarAsiento y
   * guardarDispensa: el alta automatica necesita el id recien creado para
   * dejarlo anotado en la solicitud, y para que el trigger del mandato sepa a
   * que asociado copiarle la firma.
   */
  async guardarAsociado(a: Partial<Asociado>): Promise<Asociado> {
    const { data: u } = await supabase.auth.getUser()
    const p = { ...a, user_id: u?.user?.id ?? null }
    const { data, error } = await (a.id
      ? supabase.from('ong_asociados').update(p).eq('id', a.id)
      : supabase.from('ong_asociados').insert(p)
    ).select().single()
    lanzar(error)
    return data as Asociado
  },
  async borrarAsociado(id: string): Promise<void> {
    lanzar((await supabase.from('ong_asociados').delete().eq('id', id)).error)
  },

  async getCategorias(): Promise<CategoriaSocio[]> {
    const { data, error } = await supabase.from('ong_categorias_socio').select('*').order('nombre')
    lanzar(error); return (data ?? []) as CategoriaSocio[]
  },
  async guardarCategoria(c: Partial<CategoriaSocio>): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    const p = { ...c, user_id: u?.user?.id ?? null }
    lanzar((c.id
      ? await supabase.from('ong_categorias_socio').update(p).eq('id', c.id)
      : await supabase.from('ong_categorias_socio').insert(p)).error)
  },
  async borrarCategoria(id: string): Promise<void> {
    lanzar((await supabase.from('ong_categorias_socio').delete().eq('id', id)).error)
  },

  async getCuotas(): Promise<Cuota[]> {
    const { data, error } = await supabase.from('ong_cuotas').select('*').order('vigente_desde', { ascending: false })
    lanzar(error); return (data ?? []) as Cuota[]
  },
  async guardarCuota(c: Partial<Cuota>): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    const p = { ...c, user_id: u?.user?.id ?? null }
    lanzar((c.id
      ? await supabase.from('ong_cuotas').update(p).eq('id', c.id)
      : await supabase.from('ong_cuotas').insert(p)).error)
  },
  async borrarCuota(id: string): Promise<void> {
    lanzar((await supabase.from('ong_cuotas').delete().eq('id', id)).error)
  },

  // Lee de la VISTA y escribe contra la tabla, igual que `getPacientes`.
  //
  // `dispensas_segun_rol` devuelve la entrega con los cuatro importes —aporte,
  // medio de pago, referencia y desglose— en NULL para quien no ve plata. El
  // director medico se queda con fecha, gramos, producto, genetica y lote, que
  // es la trazabilidad de su indicacion, sin cuanto se cobro.
  //
  // Puede seguir CARGANDO el aporte al registrar una entrega en el mostrador
  // —el trigger es solo de UPDATE— y despues no lo ve ni lo corrige. Es lo que
  // significa cobrar sin auditar la caja.
  async getDispensas(): Promise<Dispensa[]> {
    return traerTodo<Dispensa>('dispensas_segun_rol', 'fecha')
  },
  /**
   * Guarda una entrega y devuelve la fila como quedó.
   *
   * Devuelve y no es `void` porque el id de una entrega recién creada es lo que
   * necesita el paso siguiente de «Entregarle a un paciente»: sin él, el recibo
   * hay que ligarlo a mano buscando la entrega en una lista de mil doscientas,
   * que es exactamente el trabajo que el flujo viene a sacar del medio.
   */
  /**
   * Guarda una entrega Y deja su asiento de caja al dia, en la misma operacion.
   *
   * POR QUE ACA Y NO EN LA PANTALLA (30/08/2026)
   *
   * Antes guardar una entrega no escribia NADA en la caja. La plata entraba
   * despues, apretando «Asentar reembolsos» en el Libro de Caja: un boton de
   * repesca que recorria las entregas buscando cuales no tenian asiento. O sea
   * que entre registrar la entrega y que la plata existiera habia un paso que
   * dependia de que alguien se acordara.
   *
   * Se nota en los datos: de 907 entregas con aporte, solo 98 tienen el asiento
   * que escribe la app. Los otros 809 dicen «Dispensa a PAC-xxx» y no los
   * escribio ninguna pantalla — vienen de la planilla vieja.
   *
   * Va en el servicio y no en la pantalla porque hay DOS lugares que guardan
   * entregas: la pantalla de Dispensas y el portal (Reservas). Puesto en una,
   * el portal seguiria sin asentar.
   *
   * Devuelve tambien QUE paso con la caja: mover plata en automatico esta bien,
   * hacerlo en silencio no. La pantalla lo dice en el aviso.
   *
   * Puede escribir MAS DE UN asiento: si la entrega trae el desglose del pago
   * —efectivo tanto, transferencia tanto— cada medio es su propia fila, que es
   * lo unico que permite que el arqueo separe la caja del banco.
   */
  async guardarDispensa(d: Partial<Dispensa>): Promise<{ dispensa: Dispensa; caja: AccionAsiento[] }> {
    const { data: u } = await supabase.auth.getUser()
    // Solo se pregunta por la ficha cuando el tipo depende de ella: una entrega
    // sin aporte es retribucion si la hace alguien del equipo y deuda si no.
    // En el resto de los casos los numeros alcanzan y no hay consulta de mas.
    let quienRetira: { retira_como_retribucion?: boolean | null } | null = null
    if (!d.tipo_movimiento && d.paciente_id && (d.gramos ?? 0) > 0 && (d.aporte ?? 0) === 0) {
      const { data: pac } = await supabase.from('pacientes')
        .select('retira_como_retribucion').eq('id', d.paciente_id).maybeSingle()
      quienRetira = pac as typeof quienRetira
    }
    const p = {
      ...d,
      user_id: u?.user?.id ?? null,
      tipo_movimiento: d.tipo_movimiento ?? tipoDeMovimiento(d, quienRetira),
    }
    const { data, error } = await (d.id
      ? supabase.from('ong_dispensas').update(p).eq('id', d.id)
      : supabase.from('ong_dispensas').insert(p)
    ).select().single()
    lanzar(error)
    const dispensa = data as Dispensa

    // Los asientos se leen DESPUES de guardar y filtrados por esta entrega: es
    // una consulta chica y evita que la pantalla tenga que pasar la caja entera
    // —que en la asociación son 1.690 filas— solo para poder guardar una entrega.
    const { data: previos, error: eCaja } = await supabase
      .from('ong_caja').select('*').eq('dispensa_id', dispensa.id)
    lanzar(eCaja)
    const acciones = asientoDeEntrega(dispensa, (previos ?? []) as AsientoCaja[])
    for (const a of acciones) {
      if (a.hacer === 'crear') await this.guardarAsiento(a.asiento)
      else if (a.hacer === 'actualizar') await this.guardarAsiento({ id: a.id, ...a.asiento })
      else await this.borrarAsiento(a.id)
    }

    // LA VISITA DE ESA ENTREGA (01/09/2026).
    //
    // Si no, el registro de visitas se despareja solo: el historial se dedujo de
    // las 1.059 entregas viejas, y desde manana cada entrega nueva quedaria
    // afuera salvo que alguien se acuerde de cargar tambien la visita. Un
    // registro que hay que mantener a mano en paralelo es un registro que en dos
    // semanas dice menos de lo que pasa.
    //
    // REUSA LA DEL DIA si ya hay una. Una persona que viene una vez y se lleva
    // dos lotes son DOS entregas y UNA visita — es el mismo criterio con el que
    // se dedujeron las 945 del historial, y sin esto el contador de gente
    // atendida se infla justo con quien vino una sola vez.
    //
    // Va con su propio try/catch: que falle el enganche de la visita no puede
    // tumbar el registro de una entrega, que es lo que mueve material y plata.
    if (dispensa.paciente_id && !dispensa.visita_id) {
      try { await this.visitaDeEntrega(dispensa) } catch { /* la entrega ya quedo guardada */ }
    }

    return { dispensa, caja: acciones }
  },

  /**
   * Engancha la entrega a la visita de ese dia, creandola si no existe.
   *
   * `origen: 'derivada_de_dispensa'` y no `'registrada'`: el encuentro es real
   * -alguien vino y se llevo algo- pero el motivo y el resultado los pone el
   * sistema, no un testigo. Es la misma marca que llevan las 945 del historial,
   * y es lo que hace que «atendimos N» se pueda defender.
   */
  async visitaDeEntrega(d: Dispensa): Promise<void> {
    if (!d.paciente_id) return
    const { data: ya } = await supabase
      .from('ong_visitas').select('id')
      .eq('paciente_id', d.paciente_id).eq('fecha', d.fecha).limit(1)
    let visitaId = ya?.[0]?.id as string | undefined
    if (!visitaId) {
      const { data: nueva, error } = await supabase.from('ong_visitas').insert({
        fecha: d.fecha, paciente_id: d.paciente_id,
        motivo: 'Retiro', resultado: 'Se le entrego',
        origen: 'derivada_de_dispensa',
        notas: 'Se creo sola al registrar la entrega. Si vino por algo mas, se puede corregir aca.',
      }).select('id').single()
      if (error) throw new Error(error.message)
      visitaId = (nueva as { id: string }).id
    }
    await supabase.from('ong_dispensas').update({ visita_id: visitaId }).eq('id', d.id)
  },

  async borrarDispensa(id: string): Promise<void> {
    lanzar((await supabase.from('ong_dispensas').delete().eq('id', id)).error)
  },

  /**
   * Un socio paga lo que adeudaba: entra plata y NO sale material.
   *
   * ESCRIBE UN ASIENTO DE CAJA Y NADA MAS. Hasta hoy, para registrar esto había
   * que inventar una fila de `ong_dispensas` de 0 gramos: la plata ya vivía en
   * la caja y la dispensa existía sólo para colgarle el asiento. Esa fila
   * fantasma es lo que hacía que el balance de materia leyera una entrega de 0
   * gramos como un dato sucio.
   *
   * `paciente_id` en el asiento es lo que reemplaza a esa fila: el movimiento
   * tiene a quién atribuirse sin fingir que salió material.
   */
  async registrarCobroDeDeuda(p: {
    paciente_id: string
    codigo?: string | null
    monto: number
    medio: string
    fecha: string
    notas?: string | null
  }): Promise<void> {
    if (!(p.monto > 0)) throw new Error('El monto tiene que ser mayor a cero')
    const { data: u } = await supabase.auth.getUser()
    lanzar((await supabase.from('ong_caja').insert({
      user_id: u?.user?.id ?? null,
      fecha: p.fecha,
      tipo: 'ingreso',
      concepto: `Cobro de deuda de ${p.codigo ?? 'un socio'}`,
      detalle: 'Cobro de entregas anteriores',
      monto: p.monto,
      medio: p.medio,
      paciente_id: p.paciente_id,
      notas: p.notas ?? null,
    })).error)
  },

  /**
   * Le da número al recibo de una entrega, en el momento de emitirlo.
   *
   * Los 1.241 recibos están sin numerar y NO se numeran hacia atrás: un número
   * de recibo no es un dato que se descubre, es un identificador que la entidad
   * asigna cuando emite el papel. Numerarlos todos de una sería declarar 1.241
   * recibos correlativos que nunca existieron.
   *
   * El número lo da una secuencia de Postgres, no un `max + 1` del lado del
   * cliente: dos personas emitiendo al mismo tiempo con max+1 se llevan el
   * mismo número, y dos recibos con el mismo número rompen justamente la
   * garantía por la que un recibo se numera.
   *
   * Es idempotente: si la entrega ya tiene número devuelve el que tiene sin
   * consumir uno nuevo, así reabrir un recibo emitido no puede renumerarlo.
   */
  async asignarNumeroRecibo(dispensaId: string): Promise<number> {
    const { data, error } = await supabase.rpc('asignar_numero_recibo', { p_dispensa: dispensaId })
    lanzar(error)
    return data as number
  },

  async getCuotasEmitidas(): Promise<CuotaEmitida[]> {
    const { data, error } = await supabase.from('ong_cuotas_emitidas').select('*').order('periodo', { ascending: false })
    lanzar(error); return (data ?? []) as CuotaEmitida[]
  },
  async guardarCuotaEmitida(c: Partial<CuotaEmitida>): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    const p = { ...c, user_id: u?.user?.id ?? null }
    lanzar((c.id
      ? await supabase.from('ong_cuotas_emitidas').update(p).eq('id', c.id)
      : await supabase.from('ong_cuotas_emitidas').insert(p)).error)
  },
  async borrarCuotaEmitida(id: string): Promise<void> {
    lanzar((await supabase.from('ong_cuotas_emitidas').delete().eq('id', id)).error)
  },

  async getFeedbacks(): Promise<FeedbackClinico[]> {
    const { data, error } = await supabase.from('ong_feedback_clinico').select('*').order('creado_en', { ascending: false })
    lanzar(error); return (data ?? []) as FeedbackClinico[]
  },
  /**
   * Sólo insert: no hay `actualizar` ni `borrar` a propósito. La tabla tampoco
   * tiene policies para eso, así que un intento sería rechazado por la base.
   */
  async guardarFeedback(f: Omit<FeedbackClinico, 'id'>): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    lanzar((await supabase.from('ong_feedback_clinico').insert({ ...f, user_id: u?.user?.id ?? null })).error)
  },

  async getCaja(): Promise<AsientoCaja[]> {
    return traerTodo<AsientoCaja>('ong_caja', 'fecha')
  },
  /**
   * Guarda un asiento y devuelve la fila como quedó.
   *
   * Devuelve por lo mismo que `guardarDispensa`: el paso siguiente de «Anotar un
   * gasto» es el comprobante que respalda ESTE asiento, y sin la fila hay que
   * volver a tipear el monto y la fecha que se acaban de cargar.
   */
  /**
   * Guarda los DOS asientos de un movimiento interno.
   *
   * Van en un solo insert y no en dos llamadas: si la segunda fallara, quedaria
   * la mitad del par —plata que sale y no entra en ningun lado— y eso SI
   * cambiaria el total, que es lo unico que un movimiento interno no puede hacer.
   */
  async guardarMovimientoInterno(m: MovimientoInterno): Promise<void> {
    const filas = asientosDeMovimientoInterno(m)
    const { error } = await supabase.from('ong_caja').insert(filas)
    if (error) throw new Error(error.message)
  },

  async guardarAsiento(a: Partial<AsientoCaja>): Promise<AsientoCaja> {
    const { data: u } = await supabase.auth.getUser()
    const p = { ...a, user_id: u?.user?.id ?? null }
    const { data, error } = await (a.id
      ? supabase.from('ong_caja').update(p).eq('id', a.id)
      : supabase.from('ong_caja').insert(p)
    ).select().single()
    lanzar(error)
    return data as AsientoCaja
  },
  async borrarAsiento(id: string): Promise<void> {
    lanzar((await supabase.from('ong_caja').delete().eq('id', id)).error)
  },
  /* `asentarReembolsosPendientes` se fue el 30/08/2026: ver `guardarDispensa`.
     Era la repesca de un eslabon que ahora no se puede saltear, y un boton que
     hay que acordarse de apretar es peor que no tenerlo — deja creer que la
     plata esta asentada cuando no lo esta. Si igual apareciera una entrega sin
     asiento (una carga por fuera de la app), lo dice el cruce de Coherencia. */

  /**
   * Registra la devolución de un aporte cargado en negativo.
   *
   * Dos escrituras que van juntas: el egreso de caja y el aporte de la entrega
   * en cero. Si se hiciera sólo la primera, el negativo seguiría restando del
   * total declarado y la plata quedaría contada dos veces.
   *
   * Idempotente: si la dispensa ya tiene su egreso asentado no hace nada, así
   * que reintentar después de un error a mitad de camino es seguro.
   */
  async registrarDevolucion(d: Dispensa, caja: AsientoCaja[]): Promise<boolean> {
    const conv = devolucionDeAporteNegativo(d)
    if (!conv) return false
    const yaEsta = caja.some(
      a => a.dispensa_id === d.id && a.concepto === 'Devolución de aporte')
    if (!yaEsta) await this.guardarAsiento(conv.asiento)
    // Deja el aporte en cero. Si esa entrega tenia un ingreso asentado,
    // `guardarDispensa` lo borra sola: sin aporte no hay ingreso que sostener.
    // El egreso de la devolucion no se toca — `asientoDeEntrega` solo mira los
    // ingresos.
    await this.guardarDispensa({ id: d.id, aporte: conv.aporteCorregido })
    return true
  },

  async getDDJJ(): Promise<DDJJ[]> {
    const { data, error } = await supabase.from('ong_ddjj').select('*').order('periodo', { ascending: false })
    lanzar(error); return (data ?? []) as DDJJ[]
  },
  async guardarDDJJ(d: Partial<DDJJ>): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    const payload = { ...d, user_id: u?.user?.id ?? null }
    lanzar((d.id
      ? await supabase.from('ong_ddjj').update(payload).eq('id', d.id)
      : await supabase.from('ong_ddjj').insert(payload)).error)
  },
  async borrarDDJJ(id: string): Promise<void> {
    lanzar((await supabase.from('ong_ddjj').delete().eq('id', id)).error)
  },

  async getTraslados(): Promise<Traslado[]> {
    return traerTodo<Traslado>('ong_traslados', 'fecha')
  },
  async guardarTraslado(t: Partial<Traslado>): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    const payload = { ...t, user_id: u?.user?.id ?? null }
    lanzar((t.id
      ? await supabase.from('ong_traslados').update(payload).eq('id', t.id)
      : await supabase.from('ong_traslados').insert(payload)).error)
  },
  async borrarTraslado(id: string): Promise<void> {
    lanzar((await supabase.from('ong_traslados').delete().eq('id', id)).error)
  },

  /**
   * El listado, SIN el texto de los papeles.
   *
   * Trae `notas_preview` —una columna generada con los primeros 120
   * caracteres— en lugar de `notas`. El texto completo se pide al abrir un
   * documento, con `getNotasDocumento`.
   *
   * Medido el 09/09/2026: la tabla pesaba 1.230 kB y se bajaba entera en cada
   * carga de O.N.G. Sin `notas` son 390 kB.
   */
  async getDocumentos(): Promise<DocumentoONG[]> {
    return traerTodo<DocumentoONG>('ong_documentos', 'fecha', false, COLUMNAS_DOCUMENTO)
  },

  /** El texto completo de UN documento, para cuando se lo abre. */
  async getNotasDocumento(id: string): Promise<string> {
    const { data, error } = await supabase
      .from('ong_documentos').select('notas').eq('id', id).maybeSingle()
    lanzar(error)
    return (data as { notas?: string | null } | null)?.notas ?? ''
  },
  async guardarDocumento(d: Partial<DocumentoONG>): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    const p = { ...d, user_id: u?.user?.id ?? null }
    lanzar((d.id
      ? await supabase.from('ong_documentos').update(p).eq('id', d.id)
      : await supabase.from('ong_documentos').insert(p)).error)
  },
  async borrarDocumento(d: DocumentoONG): Promise<void> {
    // El archivo se va con la ficha: si no, queda basura en el bucket que nadie
    // puede ver ni borrar desde la app.
    if (d.archivo_path) {
      const { error } = await supabase.storage.from(BUCKET_DOCS).remove([d.archivo_path])
      // Un archivo que ya no está no debería impedir borrar la ficha.
      if (error && !/not found/i.test(error.message)) throw new Error(error.message)
    }
    lanzar((await supabase.from('ong_documentos').delete().eq('id', d.id)).error)
  },
  /** Sube el archivo al bucket privado y devuelve el path (nunca una URL pública). */
  async subirArchivoDocumento(file: File): Promise<{ path: string; nombre: string }> {
    const limpio = file.name.replace(/[^\w.-]+/g, '_')
    const path = `ong/${Date.now()}_${limpio}`
    const { error } = await supabase.storage.from(BUCKET_DOCS).upload(path, file, {
      contentType: file.type || 'application/octet-stream', upsert: false,
    })
    if (error) throw new Error(error.message)
    return { path, nombre: file.name }
  },
  /**
   * Emite la cuota del período a todos los asociados activos que todavía no la
   * tengan. Es el paso que faltaba para poder cruzar asociados contra ingresos.
   */
  async emitirCuotasDelPeriodo(
    periodo: string, asociados: Asociado[], cuotas: Cuota[], yaEmitidas: CuotaEmitida[],
  ): Promise<number> {
    const { data: u } = await supabase.auth.getUser()
    const valorDe = (a: Asociado, tipo: string) =>
      cuotas.find(c => c.tipo === tipo && c.categoria === a.categoria)?.valor
      ?? cuotas.find(c => c.tipo === tipo && !c.categoria)?.valor ?? null
    const nuevas = asociados
      .filter(a => a.activo !== false)
      .flatMap(a => (['social'] as const).map(tipo => ({ a, tipo, valor: valorDe(a, tipo) })))
      .filter(x => x.valor != null)
      .filter(x => !yaEmitidas.some(e => e.asociado_id === x.a.id && e.periodo === periodo && e.tipo === x.tipo))
      .map(x => ({
        asociado_id: x.a.id, periodo, tipo: x.tipo, monto: x.valor as number,
        pagada: false, user_id: u?.user?.id ?? null,
      }))
    if (!nuevas.length) return 0
    lanzar((await supabase.from('ong_cuotas_emitidas').insert(nuevas)).error)
    return nuevas.length
  },
}

export interface CuotaEmitida {
  id: string
  asociado_id?: string | null
  periodo: string
  tipo?: string | null
  monto: number
  pagada?: boolean
  fecha_pago?: string | null
  medio?: string | null
  notas?: string | null
}

/**
 * Papeles de la asociación, de las dos puntas:
 * - `emitido`: lo que la ONG entrega (constancia de socio, recibo de cuota,
 *   comprobante de dispensa). Va a nombre de alguien.
 * - `gasto`: lo que la ONG recibe al comprar. Es el respaldo de que la plata
 *   salió, y sin eso el costo por gramo es una afirmación sin prueba.
 */
export interface DocumentoONG {
  id: string
  tipo: 'emitido' | 'gasto'
  subtipo?: string | null
  numero?: string | null
  fecha: string
  descripcion?: string | null
  monto?: number | null
  proveedor?: string | null
  categoria?: string | null
  asociado_id?: string | null
  paciente_id?: string | null
  dispensa_id?: string | null
  archivo_path?: string | null
  archivo_nombre?: string | null
  /**
   * El texto completo. En el LISTADO viene `undefined`: no se trae.
   *
   * Para un documento emitido acá adentro está el papel entero —el recibo, la
   * constancia— y son 950 kB sobre los 1.230 que pesa la tabla. Se pide al
   * abrirlo, con `ongService.getNotasDocumento(id)`.
   */
  notas?: string | null
  /** Los primeros 120 caracteres de `notas`. Columna generada, para el listado. */
  notas_preview?: string | null
}

/**
 * Lo que el listado necesita: todo menos `notas`.
 *
 * Explícito y no un `*` menos algo, porque PostgREST no sabe excluir. Si se
 * agrega una columna a la tabla y hace falta en el listado, va acá.
 */
const COLUMNAS_DOCUMENTO = 'id, tipo, subtipo, numero, fecha, descripcion, monto, '
  + 'proveedor, categoria, asociado_id, paciente_id, dispensa_id, archivo_path, '
  + 'archivo_nombre, notas_preview, creado_en, user_id, lote_codigo'

/** Bucket privado donde viven los archivos. Ver lib/archivos.ts. */
export const BUCKET_DOCS = 'documentos'

export const SUBTIPOS_EMITIDO = [
  'Constancia de socio', 'Recibo de cuota', 'Comprobante de dispensa',
  'Certificado de vinculación', 'Nota / carta', 'Otro',
] as const

export const SUBTIPOS_GASTO = [
  'Factura A', 'Factura B', 'Factura C', 'Ticket', 'Remito',
  'Recibo', 'Comprobante de transferencia', 'Otro',
] as const

/** Rubros de gasto, alineados con las categorías de Econometría. */
export const CATEGORIAS_GASTO = [
  'Nutrientes', 'Sustrato', 'Energía', 'Equipamiento', 'Alquiler',
  'Sanidad', 'Análisis de laboratorio', 'Honorarios', 'Impuestos y tasas',
  'Insumos varios', 'Otro',
] as const

export interface ResumenDocumentos {
  emitidos: number
  gastos: number
  /** Gastos que tienen el archivo subido: los otros son una anotación sin respaldo. */
  gastosConArchivo: number
  emitidosConArchivo: number
  totalGastos: number
  porCategoria: { categoria: string; monto: number; n: number }[]
}

export function resumenDocumentos(docs: DocumentoONG[]): ResumenDocumentos {
  const emitidos = docs.filter(d => d.tipo === 'emitido')
  const gastos = docs.filter(d => d.tipo === 'gasto')
  const porCat = new Map<string, { monto: number; n: number }>()
  for (const g of gastos) {
    const k = g.categoria || 'Sin categoría'
    const a = porCat.get(k) ?? { monto: 0, n: 0 }
    porCat.set(k, { monto: a.monto + (Number(g.monto) || 0), n: a.n + 1 })
  }
  return {
    emitidos: emitidos.length,
    gastos: gastos.length,
    gastosConArchivo: gastos.filter(d => d.archivo_path).length,
    emitidosConArchivo: emitidos.filter(d => d.archivo_path).length,
    totalGastos: gastos.reduce((s, d) => s + (Number(d.monto) || 0), 0),
    porCategoria: [...porCat.entries()]
      .map(([categoria, v]) => ({ categoria, ...v }))
      .sort((a, b) => b.monto - a.monto),
  }
}

/**
 * Los gastos de un rubro, agrupados por concepto.
 *
 * Sale de la hoja RETRIBUCIONES Y GASTOS. El rubro mas grande —Gasto Operativo,
 * $19,4M en 331 comprobantes— no tiene subcategoria: el concepto vive en el
 * texto libre de `descripcion`, y ese texto viene escrito de varias formas.
 *
 * Los dos gastos mas grandes estaban partidos:
 *   alquiler / Alquiler                    18 comprobantes  $X.XXX.XXX
 *   viaticos / Viaticos / Viáticos         40 comprobantes    $XXX.XXX
 *
 * Se agrupa ignorando acentos, mayusculas y espacios repetidos. NO se corrige
 * el dato: `descripcion` es texto libre y siempre van a aparecer variantes
 * nuevas, asi que arreglar las de hoy no sirve de nada. Agrupando al mostrar,
 * se arregla solo.
 *
 * La etiqueta que se muestra es la grafia MAS USADA, no la clave normalizada:
 * "Viáticos" se lee mejor que "viaticos", y es la que la gente escribio.
 */
export interface GastoConcepto {
  concepto: string
  comprobantes: number
  monto: number
  /** Cuantas formas distintas de escribirlo se juntaron acá. */
  grafias: number
}

/**
 * Sin acentos, para comparar texto escrito por personas.
 *
 * Se exporta porque el cargo de una autoridad se busca por substring: «Tecnico»
 * y «Técnico» son la misma palabra para quien la escribe, y no para un regex.
 */
export const sinAcentos = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '')

export function gastosPorConcepto(
  docs: DocumentoONG[], categoria: string,
): GastoConcepto[] {
  const m = new Map<string, { formas: Map<string, number>; monto: number; n: number }>()
  for (const d of docs) {
    if (d.categoria !== categoria) continue
    const texto = (d.descripcion ?? '').trim()
    if (!texto) continue
    const clave = sinAcentos(texto).toLocaleLowerCase('es-AR').replace(/\s+/g, ' ')
    const e = m.get(clave) ?? { formas: new Map<string, number>(), monto: 0, n: 0 }
    e.formas.set(texto, (e.formas.get(texto) ?? 0) + 1)
    e.monto += Number(d.monto) || 0
    e.n += 1
    m.set(clave, e)
  }
  return [...m.values()]
    .map(e => ({
      // Empates: gana la que aparece primero al ordenar, para que el resultado
      // no cambie entre renders con los mismos datos.
      concepto: [...e.formas.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es-AR'))[0][0],
      comprobantes: e.n,
      monto: e.monto,
      grafias: e.formas.size,
    }))
    .sort((a, b) => b.monto - a.monto)
}

/**
 * La plata mes a mes, desde el primer movimiento hasta hoy.
 *
 * Sin esto la unica lectura posible era el total historico o el filtro por
 * fechas de Movimientos, que responde "cuanto entro en agosto" pero no "como
 * venimos". Con 13 meses cargados la diferencia importa: el neto acumulado es
 * de $XXX.XXX sobre $62,9M movidos —un 0,9%— y varios meses dan NEGATIVO. Un
 * total historico esconde eso; la serie no.
 *
 * Los meses sin movimiento se rellenan en cero en vez de saltearse: un hueco en
 * la serie se lee como "no paso nada" cuando en realidad puede ser que nadie
 * cargo, y son dos cosas distintas.
 */
export interface MesEconomico {
  mes: string
  entro: number
  salio: number
  neto: number
  acumulado: number
  asientos: number
}

export function serieMensual(caja: AsientoCaja[]): MesEconomico[] {
  if (caja.length === 0) return []
  const m = new Map<string, { entro: number; salio: number; asientos: number }>()
  let min = '9999-99', max = '0000-00'
  for (const a of caja) {
    const mes = (a.fecha ?? '').slice(0, 7)
    if (mes.length !== 7) continue
    if (mes < min) min = mes
    if (mes > max) max = mes
    const e = m.get(mes) ?? { entro: 0, salio: 0, asientos: 0 }
    const monto = Number(a.monto) || 0
    if (a.tipo === 'ingreso') e.entro += monto
    else e.salio += monto
    e.asientos += 1
    m.set(mes, e)
  }
  if (min > max) return []

  const out: MesEconomico[] = []
  let acumulado = 0
  // Se camina el calendario, no las claves del mapa: asi los meses vacios
  // aparecen con cero en vez de desaparecer de la serie.
  for (let a = Number(min.slice(0, 4)), s = Number(min.slice(5)); ; ) {
    const mes = `${a}-${String(s).padStart(2, '0')}`
    const e = m.get(mes) ?? { entro: 0, salio: 0, asientos: 0 }
    const neto = e.entro - e.salio
    acumulado += neto
    out.push({ mes, entro: e.entro, salio: e.salio, neto, acumulado, asientos: e.asientos })
    if (mes === max) break
    s += 1
    if (s > 12) { s = 1; a += 1 }
  }
  return out
}

/**
 * Los gastos que se repiten mes a mes: el alquiler, internet, los viaticos.
 *
 * Son los que definen el piso: lo que hay que juntar todos los meses antes de
 * cualquier otra cosa. La planilla no los distingue de una compra de una vez,
 * porque el rubro es el mismo —Gasto Operativo— y el concepto vive en texto
 * libre.
 *
 * Recurrente = aparece en `minMeses` MESES DISTINTOS, no en N comprobantes. Un
 * gasto grande pagado en cinco cuotas el mismo mes no es un gasto fijo; uno
 * chico que aparece todos los meses, si.
 *
 * Agrupa ignorando acentos y mayusculas por la misma razon que
 * `gastosPorConcepto`: "viaticos" y "Viáticos" son el mismo gasto fijo y
 * separados no llegan al minimo de meses.
 */
export interface GastoRecurrente {
  concepto: string
  meses: number
  comprobantes: number
  total: number
  /** Sobre los meses en que aparecio, no sobre los del periodo. */
  promedioMensual: number
}

export function gastosRecurrentes(
  docs: DocumentoONG[], categoria = 'Gasto Operativo', minMeses = 3,
): GastoRecurrente[] {
  const m = new Map<string, { formas: Map<string, number>; meses: Set<string>; total: number; n: number }>()
  for (const d of docs) {
    if (d.categoria !== categoria) continue
    const texto = (d.descripcion ?? '').trim()
    const mes = (d.fecha ?? '').slice(0, 7)
    if (!texto || mes.length !== 7) continue
    const clave = sinAcentos(texto).toLocaleLowerCase('es-AR').replace(/\s+/g, ' ')
    const e = m.get(clave) ?? { formas: new Map<string, number>(), meses: new Set<string>(), total: 0, n: 0 }
    e.formas.set(texto, (e.formas.get(texto) ?? 0) + 1)
    e.meses.add(mes)
    e.total += Number(d.monto) || 0
    e.n += 1
    m.set(clave, e)
  }
  return [...m.values()]
    .filter(e => e.meses.size >= minMeses)
    .map(e => ({
      concepto: [...e.formas.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es-AR'))[0][0],
      meses: e.meses.size,
      comprobantes: e.n,
      total: e.total,
      promedioMensual: e.total / e.meses.size,
    }))
    .sort((a, b) => b.total - a.total)
}

/**
 * Emite el respaldo de todo lo entregado, de la mas vieja a la mas nueva.
 *
 * POR QUE HACE FALTA
 * La app ya sabia generar el recibo y el comprobante de CADA entrega —el icono
 * de la fila los abre— pero no quedaba nada guardado: se veian en pantalla, se
 * imprimian, y ahi moria. Sobre 1.241 entregas eso son 1.241 papeles que
 * existen sólo si alguien los abrio uno por uno.
 *
 * QUE EMITE
 * Un documento por MES, no uno por entrega. Con 1.241 entregas, un documento
 * por cada una vuelve la lista de Documentos inusable: 1.241 filas donde hay
 * que buscar. El registro mensual es la forma en que esto se lleva en papel —se
 * cierra el mes, se firma, se archiva— y cada uno tiene el detalle entrega por
 * entrega adentro. El comprobante individual sigue disponible en la fila.
 *
 * ES IDEMPOTENTE. Se saltea los meses que ya tienen su registro emitido, asi
 * correrlo dos veces no duplica nada. Sin eso, apretar el boton de nuevo
 * llenaria la lista de copias.
 */
export interface RespaldoEmitido {
  emitidos: number
  salteados: number
  meses: string[]
}

export async function emitirRespaldoHistorico(
  dispensas: Dispensa[],
  documentos: DocumentoONG[],
  armar: (dispensasDelMes: Dispensa[], desde: string, hasta: string) => { titulo: string; texto: string },
): Promise<RespaldoEmitido> {
  const porMes = new Map<string, Dispensa[]>()
  for (const d of dispensas) {
    const mes = (d.fecha ?? '').slice(0, 7)
    if (mes.length !== 7) continue
    const a = porMes.get(mes) ?? []
    a.push(d)
    porMes.set(mes, a)
  }
  // Lo ya emitido se reconoce por el titulo: es lo unico estable entre
  // corridas, porque el id lo asigna la base.
  const yaEmitidos = new Set(
    documentos.filter(d => d.tipo === 'emitido')
      .map(d => (d.descripcion ?? '').trim()))

  const meses = [...porMes.keys()].sort()
  let emitidos = 0, salteados = 0
  const hechos: string[] = []
  for (const mes of meses) {
    const delMes = porMes.get(mes)!
    const desde = `${mes}-01`
    // Ultimo dia del mes sin tocar el calendario: dia 0 del siguiente.
    const [a, m] = mes.split('-').map(Number)
    const hasta = new Date(a, m, 0).toLocaleDateString('en-CA')
    const doc = armar(delMes, desde, hasta)
    if (yaEmitidos.has(doc.titulo.trim())) { salteados += 1; continue }
    await ongService.guardarDocumento({
      tipo: 'emitido',
      subtipo: 'Registro mensual',
      fecha: hasta,
      descripcion: doc.titulo,
      notas: doc.texto,
    })
    emitidos += 1
    hechos.push(mes)
  }
  return { emitidos, salteados, meses: hechos }
}

/**
 * Lo que Econometria supone contra lo que realmente se gasto.
 *
 * Son dos mundos que hasta ahora no se hablaban. Econometria calcula el costo
 * por gramo con la tabla `costos`, cargada a mano; los comprobantes de lo que
 * de verdad se pago viven en `ong_documentos`. Nadie los comparaba.
 *
 * Con los datos de la asociación la diferencia no es un detalle: el alquiler figura
 * cargado en $XXX.XXX —el valor de HOY— y en 13 meses fue de $XXX.XXX a
 * $XXX.XXX, casi cinco veces. Aplicar el valor de hoy a todo el historico infla
 * el costo por gramo de cada mes anterior.
 *
 * NO se decide cual vale. Un costo cargado a mano puede ser una proyeccion a
 * proposito —lo que va a costar el mes que viene— y el gasto real es historia.
 * Lo que no puede pasar es que difieran y nadie lo sepa.
 *
 * `mesesReales` acota el promedio a los ultimos N meses: comparar el valor de
 * hoy contra el promedio de un anio con inflacion no dice nada.
 */
export interface ContrasteCosto {
  cargadoMes: number
  realMes: number
  /** Positivo = se carga de MAS de lo que se gasta. */
  brecha: number
  brechaPct: number | null
  meses: number
}

export function contrasteCostos(
  fijosCargadosMes: number, documentos: DocumentoONG[],
  categoria = 'Gasto Operativo', mesesReales = 6,
): ContrasteCosto {
  const porMes = new Map<string, number>()
  for (const d of documentos) {
    if (d.categoria !== categoria) continue
    const mes = (d.fecha ?? '').slice(0, 7)
    if (mes.length !== 7) continue
    porMes.set(mes, (porMes.get(mes) ?? 0) + (Number(d.monto) || 0))
  }
  // Los ultimos N meses CON gasto, no los ultimos N del calendario: un mes sin
  // comprobantes cargados bajaria el promedio como si no se hubiera gastado.
  const ultimos = [...porMes.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, mesesReales)
  const realMes = ultimos.length > 0
    ? ultimos.reduce((s, [, v]) => s + v, 0) / ultimos.length
    : 0
  const brecha = fijosCargadosMes - realMes
  return {
    cargadoMes: fijosCargadosMes,
    realMes,
    brecha,
    brechaPct: realMes > 0 ? (brecha / realMes) * 100 : null,
    meses: ultimos.length,
  }
}

export interface ResumenCobranza {
  periodo: string
  emitidas: number
  pagadas: number
  montoEmitido: number
  montoCobrado: number
  asociadosActivos: number
  /** Activos que no tienen cuota emitida en el período. */
  sinEmitir: number
}

export function resumenCobranza(
  periodo: string, emitidas: CuotaEmitida[], asociados: Asociado[],
): ResumenCobranza {
  const delPeriodo = emitidas.filter(e => e.periodo === periodo)
  const activos = asociados.filter(a => a.activo !== false)
  const conCuota = new Set(delPeriodo.map(e => e.asociado_id))
  return {
    periodo,
    emitidas: delPeriodo.length,
    pagadas: delPeriodo.filter(e => e.pagada).length,
    montoEmitido: delPeriodo.reduce((s, e) => s + (Number(e.monto) || 0), 0),
    montoCobrado: delPeriodo.filter(e => e.pagada).reduce((s, e) => s + (Number(e.monto) || 0), 0),
    asociadosActivos: activos.length,
    sinEmitir: activos.filter(a => !conCuota.has(a.id)).length,
  }
}

/** Período actual en formato YYYY-MM. */
export function periodoActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Dispensas.
// ---------------------------------------------------------------------------

/**
 * En que se mide una entrega. La columna se llama `gramos` por historia y no se
 * renombro —la referencian la app, la Edge Function y los scripts del backfill—
 * asi que la unidad va al lado y el codigo filtra por ella.
 */
export type Unidad = 'g' | 'u' | 'ml'

export const UNIDADES: { valor: Unidad; label: string; sufijo: string }[] = [
  { valor: 'g',  label: 'Gramos',      sufijo: 'g' },
  { valor: 'u',  label: 'Unidades',    sufijo: 'u' },
  { valor: 'ml', label: 'Mililitros',  sufijo: 'ml' },
]

/** Null o vacio se lee como gramos: es lo que habia antes de que existiera la columna. */
export const unidadDe = (u?: string | null): Unidad =>
  u === 'u' || u === 'ml' ? u : 'g'

export const sufijoUnidad = (u?: string | null) =>
  UNIDADES.find(x => x.valor === unidadDe(u))?.sufijo ?? 'g'

export interface Dispensa {
  id: string
  paciente_id?: string | null
  fecha: string
  producto?: string | null
  genetica_id?: string | null
  gramos: number
  aporte?: number | null
  modalidad?: string | null
  entregado_por?: string | null
  con_receta?: boolean
  /**
   * La visita en la que se hizo esta entrega.
   *
   * `ON DELETE SET NULL`, nunca CASCADE: borrar una visita no puede llevarse
   * puesta una entrega, que es plata, material y un recibo emitido.
   */
  visita_id?: string | null
  /** Numeración correlativa del recibo por reembolso de costos. */
  recibo_numero?: number | null
  medio_pago?: string | null
  /**
   * El desglose del reembolso por medio de pago: `{Efectivo: 75000, Transferencia: 15000}`.
   *
   * Null es lo normal: el pago fue con UN medio, el de `medio_pago`. Cuando
   * está cargado, `aporte` es la suma de sus valores y `medio_pago` queda en
   * «Mixto».
   *
   * Existe porque «Mixto» no alcanza. Decía que el pago fue con dos medios sin
   * decir cuánto de cada uno, así que el arqueo no podía separarlos: hoy hay
   * $X.XXX.XXX «sin discriminar» sobre 1.827 asientos, y el efectivo da
   * −$X.XXX.XXX, que es un número imposible.
   */
  aporte_desglose?: Record<string, number> | null
  pago_referencia?: string | null
  /** Lote del que salió el material, para la trazabilidad del comprobante. */
  lote_codigo?: string | null
  /** En qué se mide `gramos`. Ver UNIDADES. Null se lee como gramos. */
  unidad?: Unidad | null
  /**
   * Qué fue este movimiento. Ver TIPOS_MOVIMIENTO.
   *
   * Null es «todavía no se clasificó», no un tipo más: mismo criterio que
   * `costo_por_gramo` en los lotes, donde null es «no lo sé» y no cero.
   */
  tipo_movimiento?: TipoMovimiento | null
  /**
   * Lo que se acordó cobrar por esta entrega. La deuda es `aporte_esperado`
   * menos `aporte`.
   *
   * Null es «no sé cuánto se acordó», y esta vez la distinción importa más que
   * nunca: un cero diría «se acordó no cobrar nada», que es una condonación y
   * no un dato faltante.
   */
  aporte_esperado?: number | null
  notas?: string | null
}

/**
 * LOS SEIS HECHOS QUE UNA FILA DE `ong_dispensas` PUEDE SER (08/09/2026)
 *
 * Hasta hoy eran todos «una dispensa», y sólo se distinguían mirando si algún
 * número daba cero. Por eso el balance de materia marcaba como error una
 * operación normal: una entrega de 0 gramos que cobró $XXX.XXX no es un dato
 * sucio, es un socio cancelando lo que adeudaba.
 *
 * Lo confirmó la asociación: la plata que entra sin salir gramos es el pago de una
 * deuda; los gramos que salen sin entrar plata son un retiro a cuenta.
 */
export const TIPOS_MOVIMIENTO = [
  'entrega', 'entrega_a_cuenta', 'cobro_de_deuda', 'retribucion_en_especie',
  'consumo_interno', 'merma', 'ajuste',
] as const
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number]

const LABEL_MOVIMIENTO: Record<TipoMovimiento, string> = {
  entrega: 'Entrega',
  entrega_a_cuenta: 'Entrega a cuenta',
  cobro_de_deuda: 'Cobro de deuda',
  retribucion_en_especie: 'Retribución en especie',
  consumo_interno: 'Consumo interno',
  merma: 'Merma',
  ajuste: 'Ajuste de stock',
}

/**
 * El accesor con `??`, no el `[...]` directo.
 *
 * Es el bug más caro que tuvo esta app: se agregó un valor nuevo a una columna
 * de texto de la base y no al front, y leerle `.text` a un `undefined` dejó la
 * pestaña Pacientes caída en producción. La base se migra por SQL y por la Edge
 * Function `ingesta`, y ninguna de las dos pasa por TypeScript.
 */
export const labelMovimiento = (t: string | null | undefined): string =>
  LABEL_MOVIMIENTO[t as TipoMovimiento] ?? 'Sin clasificar'

/**
 * Deduce el tipo cuando quien guarda no lo dijo.
 *
 * NO reemplaza a que la persona lo declare —eso viene con el formulario— pero
 * evita que una entrega nazca sin clasificar mientras tanto. Sólo deduce lo que
 * los números dicen sin ambigüedad; consumo interno, merma y ajuste no se
 * adivinan, porque los tres se parecen a una entrega a cuenta.
 */
export function tipoDeMovimiento(
  d: Partial<Dispensa>,
  quienRetira?: { retira_como_retribucion?: boolean | null } | null,
): TipoMovimiento | null {
  const gramos = d.gramos ?? 0
  const aporte = d.aporte ?? 0
  if (gramos === 0 && aporte > 0) return 'cobro_de_deuda'
  if (gramos > 0 && aporte > 0) return 'entrega'
  if (gramos > 0 && aporte === 0 && d.paciente_id) {
    // La regla vive en la ficha y no en una lista de códigos: el día que entre
    // alguien más al equipo, sus retiros no tienen que nacer como deuda.
    return quienRetira?.retira_como_retribucion ? 'retribucion_en_especie' : 'entrega_a_cuenta'
  }
  return null
}

/** Los que mueven material y por lo tanto descuentan del lote. */
export const MOVIMIENTOS_CON_MATERIAL = new Set<string>([
  'entrega', 'entrega_a_cuenta', 'retribucion_en_especie',
  'consumo_interno', 'merma', 'ajuste',
])

/**
 * Los que dejan al socio debiendo. `retribucion_en_especie` NO está acá y esa
 * es toda la diferencia: lo que retira quien trabaja es parte de su pago, no
 * una deuda. Eran 566 g sobre 1.534 —el 37%— atribuidos a las dos personas que
 * sostienen la sede.
 */
export const MOVIMIENTOS_QUE_GENERAN_DEUDA = new Set<string>(['entrega_a_cuenta'])

/** Los que mueven plata del socio hacia la asociación. */
export const MOVIMIENTOS_CON_APORTE = new Set<string>(['entrega', 'cobro_de_deuda'])

/**
 * Los medios de pago, escritos de una sola manera.
 *
 * Existía desde antes —lo usan los pagos a proveedores y las dispensas— pero el
 * formulario del libro de caja NO lo usaba: tenía un input de texto libre con
 * «Efectivo / transferencia» de placeholder, y un placeholder no obliga a nada.
 * De ahí salió el «Tranferencia» sin la ese que hay en la base. Ese asiento no
 * cae ni en efectivo ni en transferencia, así que desaparecía del arqueo, que
 * es exactamente la cuenta para la que el campo existe.
 *
 * «Mixto» se agrega porque ya hay 59 asientos así y no se los puede repartir sin
 * saber cuánto fue de cada uno. Se los nombra en vez de forzarlos a un medio que
 * no es, y `resumenCaja` los cuenta aparte. Vale igual para un pago a proveedor:
 * media plata en mano y media por transferencia es una forma de pagar, no un
 * error de carga.
 */
export const MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Mixto', 'Billetera virtual', 'Otro'] as const

export const PRODUCTOS_DISPENSA = ['flor', 'extracto', 'aceite', 'otro'] as const

/**
 * PROMs: lo que el paciente reporta después de una entrega (SRS v3.2).
 *
 * Es INMUTABLE por diseño (RN-07): la tabla no tiene policy de update ni delete,
 * así que la base lo rechaza aunque la UI se equivoque. Un dato clínico
 * reescrito no sirve como evidencia para el informe del director médico.
 */
export interface FeedbackClinico {
  id: string
  dispensa_id: string
  paciente_id?: string | null
  /** 1 nulo · 3 moderado · 5 excelente. */
  escala_alivio: number
  efectos_adversos: string[]
  efectos_detalle?: string | null
  dosificacion_real: string
  observaciones?: string | null
  creado_en?: string
}

export const EFECTOS_ADVERSOS = [
  'Ninguno', 'Somnolencia', 'Cefalea', 'Taquicardia', 'Gastrointestinal', 'Otro',
] as const

export const ESCALA_ALIVIO: { valor: number; label: string }[] = [
  { valor: 1, label: 'Nulo' },
  { valor: 2, label: 'Leve' },
  { valor: 3, label: 'Moderado' },
  { valor: 4, label: 'Bueno' },
  { valor: 5, label: 'Excelente' },
]

/**
 * Libro Diario de Caja y Bancos: uno de los cinco libros obligatorios.
 * Cada reembolso que entra y cada gasto que sale se asienta acá, que es de donde
 * el contador saca el balance.
 */
export interface AsientoCaja {
  id: string
  fecha: string
  tipo: 'ingreso' | 'egreso'
  concepto: string
  detalle?: string | null
  monto: number
  medio?: string | null
  dispensa_id?: string | null
  cuota_id?: string | null
  documento_id?: string | null
  /**
   * El pago a proveedor que generó este asiento.
   *
   * `ON DELETE CASCADE`: si el pago se borra, su espejo en la caja se va con él.
   * Es §7.16 al revés — la dispensa quedó en `SET NULL` y borrar una entrega
   * dejaba su asiento vivo, contando un ingreso sin entrega detrás.
   */
  pago_id?: string | null
  notas?: string | null
}

export const CONCEPTOS_CAJA = {
  ingreso: ['Reembolso de costos operativos', 'Cuota social', 'Donación', 'Otro ingreso'],
  egreso: ['Compra de insumos', 'Servicios', 'Honorarios', 'Impuestos y tasas',
           'Devolución de aporte', 'Otro egreso'],
} as const


/**
 * Convierte un aporte negativo en la devolución que en realidad es.
 *
 * Un aporte es plata que ENTRA: no puede ser negativo. Cuando aparece uno, casi
 * siempre es una devolución que se cargó restando en la misma fila de la
 * entrega, porque el formulario tiene una sola columna de importe.
 *
 * Cargarlo así rompe dos cosas a la vez. El total de reembolsos que se declara
 * queda corto por ese monto, y la plata devuelta no figura en caja: el egreso
 * nunca se asienta, porque `asentarReembolsosPendientes` sólo mira los aportes
 * positivos. O sea que la devolución no existe en ningún libro.
 *
 * La entrega y la devolución son dos hechos distintos y van separados: la
 * entrega queda con el aporte que efectivamente entró por ella —cero, si no
 * entró nada— y la devolución se asienta como egreso de caja atado a esa misma
 * dispensa, para que el dinero se pueda seguir hasta su origen.
 *
 * Devuelve null si el aporte no es negativo: no hay nada que convertir.
 */
/**
 * Que hay que hacer en la caja para que UNA entrega quede bien asentada.
 *
 * POR QUE ESTO ES UNA FUNCION APARTE Y PURA
 *
 * Decide sobre plata. Una funcion que ademas escribe en la base solo se puede
 * probar contra la base, y las reglas de abajo —cuando crear, cuando corregir,
 * cuando borrar y cuando no tocar nada— son justo las que hay que poder probar
 * sin miedo. Escribir lo que esto decide es trabajo de `guardarDispensa`.
 *
 * LAS REGLAS
 *
 * - El aporte es lo que la persona reembolso por esa entrega. Si es mayor que
 *   cero tiene que existir UN ingreso en caja atado a la entrega; si no, no.
 * - Al corregir el importe de una entrega ya asentada se ACTUALIZA su asiento,
 *   no se agrega otro: dos asientos por una entrega es plata contada dos veces.
 * - Se conserva el `concepto` del asiento que ya existe. Los 809 asientos que
 *   dicen «Dispensa a PAC-XXX» vienen de la planilla vieja y ese texto es el
 *   rastro de donde salio el dato; pisarlo con el concepto nuevo borraria esa
 *   diferencia justo en las filas donde importa.
 * - Si el aporte queda en cero o se vacia, el ingreso se BORRA. Un ingreso sin
 *   una entrega que lo declare es plata que la caja cuenta y nadie respalda.
 * - Los egresos no se tocan NUNCA. Una devolucion es un movimiento propio, con
 *   su fecha y su motivo, y no un espejo del aporte.
 * - Con dos o mas ingresos atados a la misma entrega no hace nada. Es un lio
 *   que esta funcion no creo y no puede resolver sin adivinar cual es el bueno;
 *   lo marca Coherencia y lo arregla una persona.
 */
export type AccionAsiento =
  | { hacer: 'crear'; asiento: Omit<AsientoCaja, 'id'> }
  | { hacer: 'actualizar'; id: string; asiento: Omit<AsientoCaja, 'id'> }
  | { hacer: 'borrar'; id: string; monto: number }

/**
 * Lo que la entrega dice que entró, por medio de pago.
 *
 * Un solo lugar decide esto para que la caja y el arqueo no puedan discrepar:
 * si hay desglose manda el desglose, y si no, el `aporte` entero con el medio
 * único. Los importes en cero o negativos se descartan — un medio que no aportó
 * nada no es una línea del libro.
 */
export function cobrosDeEntrega(d: Dispensa): { medio: string | null; monto: number }[] {
  const des = d.aporte_desglose
  if (des && typeof des === 'object') {
    const lineas = Object.entries(des)
      .map(([medio, monto]) => ({ medio, monto: Number(monto) || 0 }))
      .filter(l => l.monto > 0)
    if (lineas.length > 0) return lineas
  }
  const aporte = Number(d.aporte) || 0
  return aporte > 0 ? [{ medio: d.medio_pago ?? null, monto: aporte }] : []
}

/**
 * El asiento de caja de un pago a proveedor.
 *
 * POR QUE EXISTE (01/09/2026). `registrarPago` guardaba el pago y no escribia
 * nada en la caja: pagarle a un proveedor desde la app bajaba la deuda y la
 * plata nunca salia del libro. Los $25,2M de «Pago a ...» que si estan en la
 * caja entraron por la importacion de la planilla, no por la app — asi que
 * cuanto mas se usara la app, mas se separaban la deuda y el saldo.
 *
 * El `concepto` sigue la convencion que ya usan los 157 asientos importados
 * («Pago a Georgina»), para que el pago nuevo caiga en el mismo rubro que los
 * viejos en Estadisticas y no invente una categoria propia.
 *
 * Es una funcion aparte y pura para poder probar la forma del asiento sin base,
 * igual que `asientoDeEntrega`.
 */
export function asientoDePago(p: {
  id: string; proveedor: string; fecha: string; monto: number
  medio?: string | null; orden_servicio?: string | null; referencia?: string | null
}): Omit<AsientoCaja, 'id'> {
  return {
    fecha: p.fecha,
    tipo: 'egreso',
    concepto: `Pago a ${p.proveedor}`,
    detalle: [
      p.orden_servicio ? `OS ${p.orden_servicio}` : null,
      p.referencia ? `ref. ${p.referencia}` : null,
    ].filter(Boolean).join(' · ') || null,
    // El importe siempre positivo: el signo lo da `tipo`, no el numero. Un
    // monto negativo en un egreso sumaria plata al saldo.
    monto: Math.abs(Number(p.monto) || 0),
    medio: p.medio || null,
    pago_id: p.id,
  }
}

export function asientoDeEntrega(d: Dispensa, asientos: AsientoCaja[]): AccionAsiento[] {
  // Los egresos NUNCA se tocan: una devolución es un movimiento propio, con su
  // fecha y su motivo, y no un espejo del aporte.
  const mios = asientos.filter(a => a.dispensa_id === d.id && a.tipo === 'ingreso')
  const quiero = cobrosDeEntrega(d)

  const detalle = `${d.gramos} g${d.lote_codigo ? ` · lote ${d.lote_codigo}` : ''}`
  const acciones: AccionAsiento[] = []
  // Se empareja POR MEDIO DE PAGO, que es lo que distingue una línea de la otra
  // cuando el pago fue partido. Emparejar por posición daría vuelta los importes
  // en cuanto alguien reordene el desglose.
  const libres = [...mios]
  const tomar = (medio: string | null) => {
    const i = libres.findIndex(a => (a.medio ?? null) === medio)
    return i >= 0 ? libres.splice(i, 1)[0] : null
  }

  for (const linea of quiero) {
    const asiento: Omit<AsientoCaja, 'id'> = {
      fecha: d.fecha, tipo: 'ingreso', concepto: CONCEPTO_REEMBOLSO,
      detalle, monto: linea.monto, medio: linea.medio, dispensa_id: d.id,
    }
    // Primero busca uno del mismo medio; si no hay, recicla cualquiera que
    // sobre, para que cambiar «Efectivo» por «Transferencia» corrija la fila en
    // vez de borrarla y crear otra —lo que le haría perder el concepto viejo—.
    const y = tomar(linea.medio) ?? libres.shift() ?? null
    if (!y) { acciones.push({ hacer: 'crear', asiento }); continue }
    // Se conserva el `concepto` del asiento que ya existe: los 809 que dicen
    // «Dispensa a PAC-XXX» vienen de la planilla vieja, y ese texto es el rastro
    // de dónde salió el dato.
    const conConcepto = { ...asiento, concepto: y.concepto }
    const igual = y.fecha === conConcepto.fecha
      && Number(y.monto) === conConcepto.monto
      && (y.medio ?? null) === (conConcepto.medio ?? null)
      && (y.detalle ?? null) === (conConcepto.detalle ?? null)
    if (!igual) acciones.push({ hacer: 'actualizar', id: y.id, asiento: conConcepto })
  }

  // Lo que sobró ya no lo declara ninguna línea de la entrega. Un ingreso sin
  // entrega que lo declare es plata que la caja cuenta y nadie respalda.
  for (const y of libres) acciones.push({ hacer: 'borrar', id: y.id, monto: Number(y.monto) || 0 })

  return acciones
}

/** El resumen de lo que un guardado le hizo a la caja, para poder decirlo. */
export function resumirAcciones(acciones: AccionAsiento[]): { verbo: 'creo' | 'corrigio' | 'borro' | 'nada'; monto: number } {
  if (acciones.length === 0) return { verbo: 'nada', monto: 0 }
  const suma = (h: AccionAsiento['hacer']) => acciones
    .filter(a => a.hacer === h)
    .reduce((t, a) => t + (a.hacer === 'borrar' ? a.monto : a.asiento.monto), 0)
  if (acciones.some(a => a.hacer === 'crear')) return { verbo: 'creo', monto: suma('crear') }
  if (acciones.some(a => a.hacer === 'actualizar')) return { verbo: 'corrigio', monto: suma('actualizar') }
  return { verbo: 'borro', monto: suma('borrar') }
}

/** El concepto con el que la app asienta un reembolso nuevo. */
export const CONCEPTO_REEMBOLSO = 'Reembolso de costos operativos'

export function devolucionDeAporteNegativo(d: Dispensa): {
  asiento: Omit<AsientoCaja, 'id'>; aporteCorregido: number
} | null {
  const aporte = Number(d.aporte) || 0
  if (aporte >= 0) return null
  return {
    aporteCorregido: 0,
    asiento: {
      fecha: d.fecha,
      tipo: 'egreso',
      concepto: 'Devolución de aporte',
      detalle: `${d.gramos} g${d.lote_codigo ? ` · lote ${d.lote_codigo}` : ''}`,
      monto: Math.abs(aporte),
      medio: d.medio_pago ?? null,
      dispensa_id: d.id,
      notas: `Devolución registrada a partir de un aporte cargado en ${aporte}.`,
    },
  }
}

/**
 * Bloqueo por feedback pendiente (RN-05).
 *
 * Si la persona ya recibió al menos una entrega y no reportó cómo le fue, no se
 * habilita la siguiente. La regla existe porque el seguimiento terapéutico es
 * obligación de la ONG, no del paciente: sin reportes no hay informe semestral
 * que presentar.
 */
export function feedbackPendiente(
  dispensas: Dispensa[], feedbacks: FeedbackClinico[], pacienteId: string,
): Dispensa | null {
  const suyas = dispensas
    .filter(d => d.paciente_id === pacienteId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
  const ultima = suyas[0]
  if (!ultima) return null
  // Las anteriores al requisito no bloquean. Al 24/08/2026 había 911 entregas y
  // cero reportes: sin esto, la primera persona que entrara al portal se chocaba
  // con un error que no podía resolver, porque el reporte que le faltaba era de
  // una entrega de hace meses que nadie le preguntó. Y el reporte no se puede
  // reconstruir después: lo que dice sólo lo sabe quien recibió el material.
  if (estadoDelSeguimiento(ultima, feedbacks) === 'anterior_al_requisito') return null
  return feedbacks.some(f => f.dispensa_id === ultima.id) ? null : ultima
}

/**
 * Revisa una dispensa contra las reglas que más exponen:
 * - entregar a alguien sin REPROCANN vinculado
 * - pasar los 40 g de un traslado sin receta que lo respalde
 * - cobrar por encima del costo, que deja de ser aporte y pasa a ser venta
 */
export interface AvisoDispensa { nivel: 'error' | 'alerta'; texto: string }

export function revisarDispensa(
  d: Dispensa,
  opts: {
    pacienteVinculado?: boolean
    costoPorGramo?: number | null
    /** Para la ventana móvil de 30 días: todas las dispensas y el tope de la persona. */
    todas?: Dispensa[]
    topeMensualG?: number | null
    /** Mandato de Gestión Operativa firmado por el asociado (RN-03). */
    mandatoAceptado?: boolean
    /**
     * Por qué esta ficha no tiene firma, cuando la persona se asoció ANTES de
     * que el mandato se pidiera.
     *
     * Con esto puesto, la falta de mandato baja de error a aviso: no se le puede
     * reprochar a alguien que no firmó un papel que en su momento no existía. Sin
     * esto, es un paso salteado y sigue siendo error.
     */
    mandatoLeyenda?: string | null
    /** REPROCANN vencido o inactivo: avisa, ya no bloquea (RN-01, 20/08/2026). */
    reprocannVencido?: boolean
    /**
     * Entrega anterior sin reporte de seguimiento (RN-05).
     *
     * AVISA, no bloquea. `guardar` en Dispensas sólo exige gramos y fecha, así
     * que la entrega se registra igual — y durante un tiempo el texto decía
     * «cargalo antes de una nueva entrega» y la pantalla de Seguimiento hablaba
     * de entregas «bloqueadas». Una app que afirma un bloqueo que no hace
     * enseña a no creerle a ninguno de sus avisos.
     *
     * En el PORTAL sí bloquea de verdad —ahí el paciente se autogestiona y el
     * catálogo no se destraba—, y eso queda como está: son dos situaciones
     * distintas. En el mostrador entrega alguien de la asociación, que puede
     * ver el caso; en el portal no hay nadie mirando.
     */
    dispensaSinFeedback?: Dispensa | null
  },
): AvisoDispensa[] {
  const av: AvisoDispensa[] = []
  // RN-01: no vinculado. Pasa de bloqueo a AVISO por decisión de la asociación del
  // 20/08/2026 — 141 de sus 211 pacientes no tienen registro, y bloquearlos
  // dejaría sin acceso a gente que ya venía siendo atendida. En su lugar entra
  // la tarifa de transición. El aviso se mantiene bien visible: sin vinculación
  // la entrega no está amparada por la 27.350, y quien la autoriza tiene que
  // verlo escrito en el momento de autorizarla.
  if (opts.pacienteVinculado === false) {
    av.push({ nivel: 'alerta', texto: 'No figura como vinculado en REPROCANN: la entrega no está amparada y va con tarifa de transición.' })
  }
  if (!d.paciente_id) {
    av.push({ nivel: 'error', texto: 'Sin paciente asignado: una dispensa siempre va a una persona identificada.' })
  }
  // El tope es de traslado: mide lo que UNA PERSONA lleva encima. La merma y el
  // consumo interno no van a nadie, así que pedirles receta no tiene sentido.
  //
  // Y a la retribución en especie tampoco: quien retira ese material lo recibe
  // como pago por operar el cultivo, no lo consume como paciente, así que
  // pedirle una receta que respalde su necesidad medicinal es un requisito mal
  // dirigido. El tope se le sigue aplicando —es cannabis moviéndose por la vía
  // pública igual— pero lo que corresponde respaldar es el traslado, no un
  // diagnóstico. Al 24/08/2026 eran 7 de las 26 que la alerta marcaba.
  if (unidadDe(d.unidad) === 'g' && d.gramos > TOPE_TRASLADO_INDIVIDUAL_G
      && !d.con_receta && !esSalidaSinPaciente(d)) {
    av.push({ nivel: 'alerta', texto: d.modalidad === MODALIDAD_RETRIBUCION
      ? `${d.gramos} g en un solo traslado supera los ${TOPE_TRASLADO_INDIVIDUAL_G} g. Como es retribución en especie y no una entrega medicinal, no hace falta receta: lo que hay que poder mostrar es la documentación del traslado, o entregarlo en más de una vez.`
      : `${d.gramos} g en un solo traslado supera los ${TOPE_TRASLADO_INDIVIDUAL_G} g. Si la necesidad medicinal lo justifica, respaldalo con receta o entregalo en más de una vez.` })
  }
  // RN-01: con el permiso vencido no se dispensa. Es distinto de "no vinculado":
  // acá la persona está bien registrada pero su certificado caducó.
  if (opts.reprocannVencido) {
    av.push({ nivel: 'alerta', texto:
      'El REPROCANN está vencido o inactivo. La entrega no está amparada hasta que se reinscriba.' })
  }

  // RN-05: el seguimiento terapéutico es obligación de la ONG. Sin el reporte de
  // la entrega anterior no hay con qué armar el informe semestral.
  if (opts.dispensaSinFeedback && opts.dispensaSinFeedback.id !== d.id) {
    av.push({ nivel: 'alerta', texto:
      `La entrega del ${opts.dispensaSinFeedback.fecha} no tiene reporte de seguimiento. ` +
      'Sin los reportes no hay informe semestral que presentar, y sin el reporte esta persona ' +
      'tampoco puede reservar sola por el portal.' })
  }

  // Ventana móvil de 30 días: el tope se mide sobre el acumulado, no sobre la
  // entrega. Cinco entregas de 35 g en tres semanas pasan una por una y juntas
  // se van al doble del tope.
  if (opts.todas && d.paciente_id && opts.topeMensualG) {
    const c = cupoMovil30Dias(opts.todas, d.paciente_id, d.fecha, opts.topeMensualG, d.id)
    if (c.excede) {
      av.push({ nivel: 'error', texto:
        `Con esta entrega el acumulado de 30 días llega a ${Math.round(c.conNueva)} g y el tope de la persona es ${c.tope} g. ` +
        `Entre el ${c.desde} y el ${c.hasta} ya se le entregaron ${Math.round(c.acumulado)} g.` })
    } else if (c.remanente != null && c.remanente < (c.tope ?? 0) * 0.15) {
      av.push({ nivel: 'alerta', texto:
        `Le quedan ${Math.round(c.remanente)} g disponibles en la ventana de 30 días.` })
    }
  }

  // Sin mandato firmado, la entrega no tiene con qué sostener que no es una venta.
  //
  // PERO NO ES LO MISMO NO FIRMAR QUE HABERSE ASOCIADO ANTES DE QUE SE PIDIERA.
  // Al 23/08/2026 la asociación tenía 209 asociados sin mandato, y no por descuido:
  // hasta ese día no había dónde firmarlo. Marcar error en las 1.241 entregas de
  // esa gente ahoga el libro con un reproche que no les corresponde, y el error
  // deja de significar algo. Con la constancia puesta baja a aviso, y sigue
  // pidiendo que se regularice.
  if (opts.mandatoAceptado === false) {
    av.push(opts.mandatoLeyenda
      ? { nivel: 'alerta', texto: `Sin Mandato de Gestión Operativa. ${opts.mandatoLeyenda}` }
      : { nivel: 'error', texto:
        'El asociado no tiene firmado el Mandato de Gestión Operativa. Sin él, la entrega no tiene respaldo para sostener que es un reembolso de costos y no una compraventa.' })
  }

  if (opts.costoPorGramo != null && opts.costoPorGramo > 0 && d.aporte != null && d.gramos > 0) {
    const porGramo = d.aporte / d.gramos
    if (porGramo > opts.costoPorGramo * 1.05) {
      av.push({ nivel: 'alerta', texto: `El reembolso da $${Math.round(porGramo).toLocaleString('es-AR')}/g y tu costo real es $${Math.round(opts.costoPorGramo).toLocaleString('es-AR')}/g. Por encima del costo real deja de ser un reembolso.` })
    }
  }
  return av
}

export interface ResumenDispensas {
  total: number
  gramos: number
  aporte: number
  pacientes: number
  aportePorGramo: number | null
}

/**
 * Balance de materia: lo primero que se pregunta en cualquier control de
 * trazabilidad. Cosechaste tanto, entregaste tanto: la diferencia es lo que
 * tenés que poder mostrar.
 */
export interface BalanceMateria {
  cosechado: number
  /** Gramos que entraron comprados a un tercero. */
  comprado: number
  /** Todo lo que entró: cosechado + comprado. Es contra esto que se compara. */
  ingresado: number
  dispensado: number
  stock: number
  /** Porcentaje de lo INGRESADO que ya se entregó. */
  pctDispensado: number | null
  /** Dispensar más de lo que entró es imposible: hay un error de carga. */
  inconsistente: boolean
  /**
   * Entregas que NO se miden en gramos y por eso quedan fuera de este balance:
   * aceite en frascos, papeles, filtros. Se informan para que el número no
   * parezca incompleto sin explicación.
   */
  fueraDeBalance: number
}

/**
 * Lote visto desde acá: sólo lo que hace falta para saber cuánto entró y si ya
 * estaba contado en `cosechas`. Se declara estructural en vez de importar el
 * tipo de `portal.ts` porque ese módulo ya importa de éste y el ciclo rompe.
 */
export interface LoteIngreso {
  gramos_totales: number
  origen?: string | null
  cosecha_id?: string | null
  /** Necesario para cruzar contra `ong_dispensas.lote_codigo`, que es texto. */
  codigo?: string | null
  /** Sólo los lotes en gramos entran al balance de materia. */
  unidad?: string | null
  /**
   * Un lote desactivado no se ofrece para entregar.
   *
   * Es el estado que usa el Catálogo para retirar un lote sin borrarlo —«el
   * historial no pierde el origen del material»—, y hasta ahora el desplegable
   * de la dispensa no lo miraba: un lote retirado del catálogo seguía
   * apareciendo como si estuviera en el estante.
   *
   * NO se filtra dentro de `saldoDeLotes`: un lote desactivado que quedó
   * sobregirado sigue siendo un error que hay que ver, y ese cruce lee la misma
   * cuenta. Es una decisión de qué se ofrece, no de cuánto queda.
   */
  activo?: boolean | null
  /** Quién lo entregó. La planilla lo llama "productor"; es el mismo campo. */
  proveedor?: string | null
  /**
   * Lo que costó el gramo de ESTE lote.
   *
   * Es lo que permite decir si el aporte cubre el costo o lo supera, sin
   * depender de cómo se imputó cada gasto en la caja: el 24/08/2026 los 93
   * lotes que lo tenían cargado daban $X.XXX por gramo contra $X.XXX de aporte,
   * y esos $X.XXX de diferencia no llegaban a cubrir los gastos operativos.
   */
  costo_por_gramo?: number | null
  /**
   * El análisis de laboratorio del lote, si se archivó.
   *
   * Es lo que respalda el material que NO salió del cultivo propio: cuando la
   * cosecha no alcanza y se le pide a un proveedor, lo que sostiene ese material
   * es de quién vino y qué análisis tiene, porque las plantas de los socios no
   * lo justifican.
   */
  analisis_path?: string | null
}

/**
 * El padrón visto desde Coherencia: sólo lo que hace falta para los cruces.
 * Estructural en vez de importar `Paciente` de `registro.ts`, por el mismo
 * motivo que `LoteIngreso`.
 */
export interface PacienteCoherencia {
  id: string
  nombre_completo?: string | null
  dni?: string | null
  telefono?: string | null
  tope_mensual_g?: number | null
  activo?: boolean
  /** Para cruzar contra lo entregado: a quien se le dio y con que respaldo. */
  reprocann_nro?: string | null
  reprocann_estado?: string | null
  reprocann_vencimiento?: string | null
  /** Cuando se emitio SU credencial. Se cruza contra la inscripcion de la ONG. */
  reprocann_emision?: string | null
  /**
   * El codigo que ESTA PERSONA saca en REPROCANN y le da a la asociacion.
   * Sin el no se la puede vincular, y sin vinculo no se le puede entregar.
   */
  codigo_vinculacion?: string | null
  /** Lo que el REPROCANN pide en la ficha y hoy no esta cargado. */
  patologia?: string | null
  medico_tratante?: string | null
  /** Para nombrar la ficha en un cruce sin exponer el nombre de la persona. */
  codigo?: string | null
  /**
   * Texto libre de la ficha. Entra para el cruce `nota_con_importe`: `notas` la
   * ve todo el que ve el padron, asi que un importe escrito ahi se saltea el
   * limite de quien tiene la plata cerrada.
   */
  notas?: string | null
}

/**
 * Si un texto tiene un importe en pesos adentro.
 *
 * Pide el signo `$` pegado a un digito a proposito. Sin el, cualquier fecha o
 * cantidad de gramos daria positivo y el cruce se volveria ruido —y un cruce
 * que grita siempre es un cruce que se aprende a ignorar—. Deja pasar «tres
 * millones» escrito en letras, que es el precio de no tener falsos positivos.
 */
export const tieneImporte = (texto?: string | null): boolean =>
  !!texto && /\$\s*[0-9]/.test(texto)

/**
 * Si el lote se le COMPRÓ a alguien.
 *
 * Con `origen` cargado manda `origen`, y nada más. El fallback por `cosecha_id`
 * es sólo para las filas anteriores a la migración, que no lo tienen.
 *
 * Antes decía `l.origen !== 'propio' && !l.cosecha_id`, y con eso los lotes
 * `propio_sin_cosecha` —cultivo de la asociación cuya cosecha no se registró—
 * caían en el fallback y daban COMPRADO, contradiciendo el comentario de
 * `loteSumaAlIngreso`, tres líneas más abajo, que dice exactamente que esa
 * mezcla es lo que hizo que la producción propia terminara contada como compra
 * a terceros.
 *
 * En la asociación eran 30 lotes por X.XXX g, y la consecuencia visible es que la
 * cadena de justificación les exigía proveedor identificado y análisis de
 * laboratorio: papeles con los que se respalda lo que se compra afuera, y que
 * el cultivo propio respalda con sus plantas. Cuánto de eso falta trazar lo
 * dice `origen_sin_trazar`, que es donde esa pregunta sí se contesta.
 *
 * El balance de materia NO se mueve: usa `loteSumaAlIngreso`, que incluye
 * `propio_sin_cosecha` por su cuenta y a propósito.
 */
export const loteEsComprado = (l: LoteIngreso) =>
  l.origen ? l.origen === 'comprado' : !l.cosecha_id

/**
 * Lo que suma al ingreso POR SI MISMO, sin depender de una cosecha.
 *
 * Es lo comprado, lo regularizado y la produccion propia sin cosecha
 * registrada. Los tres tienen en comun lo unico que le importa al balance: el
 * material entro y no esta contado en `gramosCosechados`.
 *
 * Queda aparte de `loteEsComprado` —que sigue significando «se lo compramos a
 * alguien»— porque son dos preguntas distintas y mezclarlas fue lo que hizo
 * que la produccion propia terminara contada como compra a terceros.
 */
export const loteSumaAlIngreso = (l: LoteIngreso) =>
  l.origen === 'propio_sin_cosecha' || loteEsComprado(l)

/** Lo que queda de un lote: lo que entró, lo que salió y la diferencia. */
export interface SaldoLote {
  /** El código tal cual está cargado en el lote (no normalizado). */
  codigo: string
  ingreso: number
  entregado: number
  /** `ingreso - entregado`. Negativo significa sobregirado. */
  restante: number
  unidad: string
}

/**
 * Cuánto queda en cada lote.
 *
 * DE DÓNDE SALE: al anotar una entrega, el desplegable de lote listaba TODOS
 * los lotes cargados, con lo que ingresó cada uno. Como no decía cuánto
 * quedaba, la única forma de saber de cuál descontar era ir a la planilla a
 * buscar el número — y un lote agotado se ofrecía igual que uno lleno.
 *
 * EL CRUCE DE `lote_codigo` VA NORMALIZADO. `ong_dispensas` no guarda
 * `lote_id`: engancha por texto contra texto. El cruce de sobregiro comparaba
 * el código crudo, así que un lote cargado con un espacio de más o en otra caja
 * no encontraba sus entregas y figuraba lleno. Acá se compara con el mismo
 * `trim().toUpperCase()` que usa el cruce de códigos huérfanos: una sola forma
 * de aparear, no dos.
 *
 * Sólo cuenta las entregas que DECLARAN lote. Las que no lo declaran no se
 * pueden imputar a ninguno, y de ese agujero se ocupa el balance de materia.
 */
export function saldoDeLotes(
  lotes: LoteIngreso[] = [], dispensas: Dispensa[] = [],
): SaldoLote[] {
  const norm = (x: unknown) => String(x ?? '').trim().toUpperCase()
  const salido = new Map<string, number>()
  for (const d of dispensas) {
    const k = norm(d.lote_codigo)
    if (!k) continue
    salido.set(k, (salido.get(k) ?? 0) + (Number(d.gramos) || 0))
  }
  return lotes
    .filter(l => norm(l.codigo) !== '')
    .map(l => {
      const ingreso = Number(l.gramos_totales) || 0
      const entregado = salido.get(norm(l.codigo)) ?? 0
      return {
        codigo: l.codigo as string,
        ingreso, entregado,
        restante: ingreso - entregado,
        unidad: l.unidad ?? 'g',
      }
    })
}

/**
 * Antes esto comparaba lo dispensado sólo contra lo cosechado, porque el modelo
 * daba por hecho que el material sale del cultivo propio. Una entidad que
 * compra a terceros quedaba marcada `inconsistente` para siempre: X.XXX g
 * dispensados contra 0 g cosechados. El material comprado entra por `ong_lotes`
 * y ahora se suma.
 */
export function balanceMateria(
  gramosCosechados: number, dispensas: Dispensa[], lotes: LoteIngreso[] = [],
): BalanceMateria {
  // Sólo entra lo que se mide en GRAMOS. El aceite se cuenta en frascos y los
  // accesorios en unidades: sumarlos acá daba un balance que mezclaba 21 frascos
  // con X.XXX g de flor y no significaba nada. Son 37 dispensas y 6 lotes.
  const enGramos = dispensas.filter(d => unidadDe(d.unidad) === 'g')
  const otras = dispensas.filter(d => unidadDe(d.unidad) !== 'g')
  const dispensado = enGramos.reduce((s, d) => s + (Number(d.gramos) || 0), 0)
  const enGramosLotes = lotes.filter(l => unidadDe(l.unidad) === 'g')
  // `comprado` sigue diciendo lo que dice: lo que entro sin venir de una
  // cosecha propia registrada. Incluye la produccion propia sin trazar, porque
  // para el balance lo unico que cuenta es que el material entro y no esta en
  // `gramosCosechados`. Cuanto de eso falta trazar lo dice el cruce
  // `origen_sin_trazar`, que es donde esa pregunta se contesta.
  const comprado = enGramosLotes
    .filter(loteSumaAlIngreso)
    .reduce((s, l) => s + (Number(l.gramos_totales) || 0), 0)
  const ingresado = gramosCosechados + comprado
  return {
    cosechado: gramosCosechados,
    comprado,
    ingresado,
    dispensado,
    stock: ingresado - dispensado,
    pctDispensado: ingresado > 0 ? (dispensado / ingresado) * 100 : null,
    inconsistente: dispensado > ingresado,
    fueraDeBalance: otras.length,
  }
}

export interface RetribucionEnEspecie {
  /** Cuántos movimientos y cuántos gramos se llevó el equipo. */
  movimientos: number
  gramos: number
  /** Lo que le costó a la asociación ese material. El número que importa. */
  costo: number
  /** Gramos que no se pudieron valuar porque su lote no declara costo. */
  gramosSinCosto: number
  /** Por persona, para que el número tenga a quién atribuirse. */
  porPersona: { paciente_id: string; gramos: number; costo: number }[]
}

/**
 * VALUADA AL COSTO, Y NO A LA TARIFA (08/09/2026)
 *
 * Lo que retira quien trabaja es parte de su pago, y para que cuente como
 * retribución hay que ponerle un número. Hay dos candidatos y dan totales
 * distintos: el costo —lo que le salió a la asociación conseguir ese material—
 * y la tarifa —lo que se le hubiera cobrado a un socio—.
 *
 * Va al COSTO porque es lo que la asociación efectivamente resignó. La tarifa
 * incluye el margen con el que la entidad se sostiene, y contarlo como gasto
 * sería registrar como egreso una plata que nunca tuvo.
 *
 * NO ESCRIBE NADA EN LA CAJA, y esa es la otra mitad de la decisión: la
 * retribución en especie no mueve caja, porque no salió plata de la caja.
 * Asentarla inflaría los egresos y rompería la coincidencia con la planilla.
 * Es una línea informativa de econometría, no un asiento.
 *
 * `gramosSinCosto` se informa aparte por el mismo motivo que `fueraDeBalance`:
 * un total que esconde lo que no pudo medir se lee como si estuviera completo.
 * Un lote sin `costo_por_gramo` vale null, que es «no lo sé», no cero.
 */
export function retribucionEnEspecie(
  dispensas: Dispensa[],
  lotes: { codigo?: string | null; costo_por_gramo?: number | null; unidad?: string | null }[] = [],
): RetribucionEnEspecie {
  const norm = (x: unknown) => String(x ?? '').trim().toUpperCase()
  const costoDe = new Map<string, number>()
  for (const l of lotes) {
    if (l.costo_por_gramo == null) continue
    costoDe.set(norm(l.codigo), Number(l.costo_por_gramo) || 0)
  }

  const propias = dispensas.filter(d => d.tipo_movimiento === 'retribucion_en_especie')
  const porPersona = new Map<string, { gramos: number; costo: number }>()
  let gramos = 0, costo = 0, gramosSinCosto = 0

  for (const d of propias) {
    const g = Number(d.gramos) || 0
    gramos += g
    const c = costoDe.get(norm(d.lote_codigo))
    if (c == null) gramosSinCosto += g
    const monto = c == null ? 0 : g * c
    costo += monto
    const k = d.paciente_id ?? ''
    const acc = porPersona.get(k) ?? { gramos: 0, costo: 0 }
    porPersona.set(k, { gramos: acc.gramos + g, costo: acc.costo + monto })
  }

  return {
    movimientos: propias.length,
    gramos, costo, gramosSinCosto,
    porPersona: [...porPersona].map(([paciente_id, v]) => ({ paciente_id, ...v }))
      .sort((a, b) => b.costo - a.costo),
  }
}

export interface DeudaDeSocio {
  paciente_id: string
  /** Cuántos retiros se llevó sin pagar y cuántos gramos suman. */
  retiros: number
  gramos: number
  /** Lo que se acordó cobrarle, sumando sólo las entregas que lo declaran. */
  esperado: number
  /** Lo que ya pagó a cuenta, en pesos. */
  pagado: number
  /** `esperado - pagado`. Null cuando ninguna entrega declara lo acordado. */
  saldo: number | null
  /** Gramos que no se pueden expresar en pesos porque nadie declaró cuánto. */
  gramosSinDeclarar: number
  ultimo: string
}

/**
 * QUIÉN QUEDÓ DEBIENDO, MEDIDO EN GRAMOS Y NO EN PESOS (08/09/2026)
 *
 * Los gramos se saben con certeza: están en la entrega. Los pesos NO, y por eso
 * no se devuelven: la tarifa sugiere pero no impone —703 de 704 aportes son
 * múltiplos de $X.XXX, o sea que cobran redondo y la tarifa por gramo es el
 * resultado, no la entrada—, así que multiplicar gramos por tarifa daría un
 * número que nadie reconoce y que el primer socio que lo discuta va a tumbar.
 *
 * El saldo en pesos llega cuando exista `aporte_esperado`: lo que se acordó
 * cobrar por cada entrega, declarado y no deducido. Hasta entonces esto dice
 * quién debe y cuánto material se llevó, que ya es más de lo que se sabía.
 *
 * `retribucion_en_especie` no entra: lo que retira quien trabaja es parte de su
 * pago. Es el 37% de los gramos sin cobrar y contarlo acá le inventaría una
 * deuda a las dos personas que sostienen la sede.
 */
export function deudaPorSocio(dispensas: Dispensa[]): DeudaDeSocio[] {
  const acc = new Map<string, DeudaDeSocio>()
  const de = (id: string): DeudaDeSocio => acc.get(id) ?? {
    paciente_id: id, retiros: 0, gramos: 0,
    esperado: 0, pagado: 0, saldo: null, gramosSinDeclarar: 0, ultimo: '',
  }

  for (const d of dispensas) {
    const id = d.paciente_id
    if (!id) continue
    if (MOVIMIENTOS_QUE_GENERAN_DEUDA.has(d.tipo_movimiento ?? '')) {
      const v = de(id)
      const g = Number(d.gramos) || 0
      // Lo acordado menos lo que igual se pagó en el momento. Si nadie declaró
      // cuánto, los gramos se cuentan pero los pesos NO se inventan.
      const declarado = d.aporte_esperado != null
      const pendiente = declarado
        ? Math.max(0, (Number(d.aporte_esperado) || 0) - (Number(d.aporte) || 0))
        : 0
      acc.set(id, {
        ...v,
        retiros: v.retiros + 1,
        gramos: v.gramos + g,
        esperado: v.esperado + pendiente,
        gramosSinDeclarar: v.gramosSinDeclarar + (declarado ? 0 : g),
        ultimo: (d.fecha ?? '') > v.ultimo ? (d.fecha ?? '') : v.ultimo,
      })
    }
    else if (d.tipo_movimiento === 'cobro_de_deuda') {
      const v = de(id)
      acc.set(id, { ...v, pagado: v.pagado + (Number(d.aporte) || 0) })
    }
  }
  return [...acc.values()]
    .filter(v => v.retiros > 0)
    .map(v => ({
      ...v,
      // NULL Y NO CERO cuando ninguna entrega declara lo acordado. Un cero se
      // leería como «no debe nada», que es la conclusión opuesta a la verdadera:
      // debe, y todavía no sabemos cuánto.
      saldo: v.esperado > 0 || v.pagado > 0 ? v.esperado - v.pagado : null,
    }))
    .sort((a, b) => (b.saldo ?? 0) - (a.saldo ?? 0) || b.gramos - a.gramos)
}

export function resumirDispensas(ds: Dispensa[]): ResumenDispensas {
  const gramos = ds.reduce((s, d) => s + (Number(d.gramos) || 0), 0)
  const aporte = ds.reduce((s, d) => s + (Number(d.aporte) || 0), 0)
  return {
    total: ds.length, gramos, aporte,
    pacientes: new Set(ds.map(d => d.paciente_id).filter(Boolean)).size,
    // Un aporte total en 0 es "todavía no lo cargaste", no "se entregó gratis":
    // devolver 0 haría que el tablero diera por comparado algo que no lo está.
    aportePorGramo: gramos > 0 && aporte > 0 ? aporte / gramos : null,
  }
}

// ---------------------------------------------------------------------------
// Vencimientos: lo que hace que la ONG pueda o no operar.
// ---------------------------------------------------------------------------

export type Urgencia = 'vencido' | 'critico' | 'proximo' | 'ok'

export interface Vencimiento {
  clave: string
  titulo: string
  fecha: string | null
  dias: number | null          // negativo = ya venció
  urgencia: Urgencia
  queSignifica: string
  comoSeResuelve: string
}

const HOY = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const dias = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  return Math.round((new Date(iso + 'T00:00:00').getTime() - HOY().getTime()) / 86400000)
}
const urgenciaDe = (d: number | null): Urgencia =>
  d == null ? 'ok' : d < 0 ? 'vencido' : d <= 30 ? 'critico' : d <= 90 ? 'proximo' : 'ok'

/** Próxima ocurrencia de un día/mes del calendario, a partir de hoy. */
export function proximoAniversario(dia?: number | null, mes?: number | null): string | null {
  if (!dia || !mes) return null
  const hoy = HOY()
  let a = hoy.getFullYear()
  const arma = (anio: number) => new Date(anio, mes - 1, dia)
  if (arma(a) < hoy) a += 1
  const d = arma(a)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Fin del mandato = inicio + duración en años, ambos del estatuto. */
export function finDeMandato(desde?: string | null, anios?: number | null): string | null {
  if (!desde || !anios) return null
  const d = new Date(desde + 'T00:00:00')
  d.setFullYear(d.getFullYear() + anios)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Semestre calendario al que corresponde una fecha, en formato 2026-S1.
 * La 1780 pide la declaración jurada cada seis meses, así que el período es la
 * unidad con la que se lleva la cuenta.
 */
export function semestreDe(iso: string): string {
  const [a, m] = iso.split('-').map(Number)
  return `${a}-S${m <= 6 ? 1 : 2}`
}

export function semestreActual(hoy = new Date()): string {
  return semestreDe(hoy.toISOString().slice(0, 10))
}

/** Último día del semestre: es la fecha contra la que corre el vencimiento. */
export function finDeSemestre(periodo: string): string {
  const [a, s] = periodo.split('-S')
  return s === '1' ? `${a}-06-30` : `${a}-12-31`
}

export function calcularVencimientos(e: Entidad | null, ddjj: DDJJ[] = []): Vencimiento[] {
  if (!e) return []
  const v: Vencimiento[] = []

  const mandato = finDeMandato(e.mandato_desde, e.mandato_anios)
  v.push({
    clave: 'mandato', titulo: 'Mandato de autoridades', fecha: mandato, dias: dias(mandato),
    urgencia: urgenciaDe(dias(mandato)),
    queSignifica: 'Con las autoridades vencidas no podés hacer ningún trámite: ni banco, ni registro, ni REPROCANN.',
    comoSeResuelve: 'Asamblea que renueve el mandato y después inscribir las nuevas autoridades en el registro.',
  })

  v.push({
    clave: 'reprocann', titulo: 'Reinscripción REPROCANN', fecha: e.reprocann_vencimiento ?? null,
    dias: dias(e.reprocann_vencimiento), urgencia: urgenciaDe(dias(e.reprocann_vencimiento)),
    queSignifica: 'Para la ONG dura 1 año. Si no se reinscribe a tiempo NO se vence: se cae, y hay que rehacer el trámite.',
    comoSeResuelve: 'Volver a presentar la documentación con los informes del director médico y del responsable técnico.',
  })

  const cierre = proximoAniversario(e.cierre_ejercicio_dia, e.cierre_ejercicio_mes)
  v.push({
    clave: 'cierre', titulo: 'Cierre de ejercicio', fecha: cierre, dias: dias(cierre),
    urgencia: urgenciaDe(dias(cierre)),
    queSignifica: 'La fecha la fija el estatuto, no se elige cada año. Desde acá se arman los estados contables.',
    comoSeResuelve: 'Pasarle al contador los movimientos del ejercicio para que confeccione el balance.',
  })

  // El balance se trata después del cierre; se toma como referencia práctica un
  // trimestre, que es el plazo con el que suelen trabajar los organismos.
  if (cierre) {
    const b = new Date(cierre + 'T00:00:00'); b.setMonth(b.getMonth() + 3)
    const iso = `${b.getFullYear()}-${String(b.getMonth() + 1).padStart(2, '0')}-${String(b.getDate()).padStart(2, '0')}`
    v.push({
      clave: 'balance', titulo: 'Presentación de balance', fecha: iso, dias: dias(iso),
      urgencia: urgenciaDe(dias(iso)),
      queSignifica: 'Es obligatorio todos los años, incluso en cero si no diste de alta los impuestos.',
      comoSeResuelve: 'Contador arma → lo trata la Comisión Directiva → lo aprueba la Asamblea → se presenta en el organismo de control.',
    })
  }

  // Declaración jurada semestral (Res. 1780/2025). Es la obligación periódica
  // que más se pasa por alto porque no la avisa nadie: no hay notificación, el
  // plazo simplemente corre.
  const periodo = semestreActual()
  const yaPresentada = ddjj.some(d => d.periodo === periodo && d.presentada)
  if (!yaPresentada) {
    const fin = finDeSemestre(periodo)
    v.push({
      clave: 'ddjj', titulo: `Declaración jurada ${periodo}`, fecha: fin, dias: dias(fin),
      urgencia: urgenciaDe(dias(fin)),
      queSignifica: 'Cada seis meses hay que declarar cantidad de plantas en total y en floración, pacientes vinculados y las variedades usadas.',
      comoSeResuelve: 'Se arma en la pestaña Declaraciones con los datos del cultivo y se presenta por TAD.',
    })
  }

  // La Comisión Revisora tiene que examinar libros y documentación al menos
  // cada tres meses. Si nunca se registró una revisión, la fecha queda en null
  // y el tablero lo muestra como pendiente en vez de inventar un plazo.
  if (e.ultima_revision_libros) {
    const d = new Date(e.ultima_revision_libros + 'T00:00:00'); d.setMonth(d.getMonth() + 3)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    v.push({
      clave: 'revision_libros', titulo: 'Revisión de libros', fecha: iso, dias: dias(iso),
      urgencia: urgenciaDe(dias(iso)),
      queSignifica: 'La Comisión Revisora de Cuentas debe examinar los libros y la documentación al menos cada tres meses.',
      comoSeResuelve: 'Reunión de la Comisión Revisora, se deja asentada en su libro de actas y se registra la fecha acá.',
    })
  }

  const orden: Record<Urgencia, number> = { vencido: 0, critico: 1, proximo: 2, ok: 3 }
  return v.sort((a, b) =>
    orden[a.urgencia] - orden[b.urgencia] || (a.dias ?? 9e9) - (b.dias ?? 9e9))
}

// ---------------------------------------------------------------------------
// Capacidad: los tres topes de la Resolución 1780.
// ---------------------------------------------------------------------------

export interface LineaCapacidad {
  titulo: string
  usado: number
  tope: number
  detalle: string
}

export function calcularCapacidad(
  e: Entidad | null, pacientes: number, plantasEnFloracion: number, predios: number,
): LineaCapacidad[] {
  const topePac = e?.tope_pacientes ?? 150
  const porPac = e?.plantas_por_paciente ?? 9
  const topePre = e?.tope_predios ?? 3
  // El tope de plantas no es fijo: sale de cuántos pacientes hay vinculados.
  const topePlantas = pacientes * porPac
  return [
    { titulo: 'Pacientes vinculados', usado: pacientes, tope: topePac,
      detalle: 'Tope de la 1780. Es ampliable por solicitud si la asociación lo supera.' },
    // El límite es sobre plantas EN FLORACIÓN, no sobre el total del cultivo:
    // las que están en vegetativo o enraizando no cuentan contra el tope.
    { titulo: 'Plantas en floración', usado: plantasEnFloracion, tope: topePlantas,
      detalle: `${porPac} plantas en floración por paciente vinculado. Con ${pacientes} paciente${pacientes === 1 ? '' : 's'} el techo es ${topePlantas}. Las que están en vegetativo no cuentan.` },
    { titulo: 'Predios', usado: predios, tope: topePre,
      detalle: 'La sede social es declarativa y puede estar en otra jurisdicción que el cultivo.' },
  ]
}

// ---------------------------------------------------------------------------
// El padron contra el tope, y a quien conviene desvincular.
//
// El 23/08/2026 el padron estaba en 198 vinculados contra un tope de 150, y de
// esos 198 habia 89 que NUNCA habian retirado nada.
//
// La salida no es borrar fichas. Una entrega que apunta a una ficha borrada es
// exactamente el agujero que marca un control, y hay 1.241 entregas cargadas.
// Desvincular deja la ficha y su historial enteros, saca a la persona del
// conteo del tope, y se deshace con un flag.
//
// Y no lo decide el sistema: esto SUGIERE, con el motivo a la vista, y el gesto
// queda en la persona. Un baja automatica al dar de alta a alguien nuevo seria
// una decision irreversible tomada por un puntaje sobre la ficha de alguien
// real, que es la combinacion que no se puede deshacer cuando el criterio erra.
// ---------------------------------------------------------------------------

export interface CandidatoBaja {
  id: string
  nombre: string
  entregas: number
  ultimaEntrega: string | null
  /** Por que se lo sugiere, dicho para que se pueda defender ante un control. */
  motivo: string
}

export interface EstadoPadron {
  vinculados: number
  tope: number
  /** Cuantos hay que desvincular para entrar en el tope. 0 si ya entra. */
  excedente: number
  /** Cuantas altas nuevas entran antes de tocar el tope. */
  margen: number
  candidatos: CandidatoBaja[]
}

/** Recien llegado: todavia no tuvo tiempo de venir. */
const MESES_DE_GRACIA = 3
/** Hasta cuando se considera que alguien sigue viniendo. */
const MESES_SIN_VENIR = 6

function restarMeses(d: Date, meses: number): string {
  const x = new Date(d)
  x.setMonth(x.getMonth() - meses)
  return x.toISOString().slice(0, 10)
}

/**
 * Como esta el padron contra el tope y, si lo paso, a quien conviene desvincular.
 *
 * El criterio es «nunca retiro nada», y no un puntaje de cuan completa esta la
 * ficha: es objetivo, se explica solo ante un control, y no castiga al que tiene
 * la ficha a medio llenar pero si viene a buscar su material.
 *
 * Nunca se sugiere a tres clases de persona, y las tres exclusiones importan:
 * el que se dio de alta hace poco —todavia no llego a venir—, el que tiene
 * REPROCANN vigente —su permiso es parte del cupo del cultivo— y el que retiro
 * hace poco, por mas que haya venido una sola vez.
 *
 * Mientras haya lugar no devuelve candidatos: si el padron entra en el tope no
 * hay nada que resolver, y proponer sacar gente seria ruido.
 */
export function estadoDelPadron(
  pacientes: { id: string; nombre_completo: string; activo: boolean;
               fecha_alta: string | null; creado_en?: string;
               reprocann_vencimiento: string | null }[],
  dispensas: { paciente_id?: string | null; fecha: string }[],
  tope: number,
  hoy: Date = new Date(),
): EstadoPadron {
  const vinculados = pacientes.filter(p => p.activo !== false)
  const excedente = Math.max(0, vinculados.length - tope)
  const margen = Math.max(0, tope - vinculados.length)
  const base = { vinculados: vinculados.length, tope, excedente, margen }
  if (excedente === 0) return { ...base, candidatos: [] }

  const porPaciente = new Map<string, { n: number; ultima: string | null }>()
  for (const d of dispensas) {
    if (!d.paciente_id) continue
    const a = porPaciente.get(d.paciente_id) ?? { n: 0, ultima: null }
    a.n++
    if (!a.ultima || d.fecha > a.ultima) a.ultima = d.fecha
    porPaciente.set(d.paciente_id, a)
  }

  const hoyIso = hoy.toISOString().slice(0, 10)
  const reciente = restarMeses(hoy, MESES_DE_GRACIA)
  const vinoHacePoco = restarMeses(hoy, MESES_SIN_VENIR)

  const conAlta = vinculados.flatMap(p => {
    const e = porPaciente.get(p.id) ?? { n: 0, ultima: null }
    // Su permiso sostiene parte del cupo de plantas del cultivo.
    if (p.reprocann_vencimiento && p.reprocann_vencimiento >= hoyIso) return []
    const alta = p.fecha_alta ?? p.creado_en?.slice(0, 10) ?? null
    if (alta && alta >= reciente) return []
    if (e.ultima && e.ultima >= vinoHacePoco) return []
    const motivo = e.n === 0
      ? 'nunca retiró nada'
      : `${e.n} ${e.n === 1 ? 'entrega' : 'entregas'}, la última el ${e.ultima}`
    return [{ id: p.id, nombre: p.nombre_completo, entregas: e.n,
              ultimaEntrega: e.ultima, motivo, alta }]
  })

  // Primero el que nunca vino, y entre esos el que hace mas que esta anotado sin
  // venir. Despues los que vinieron alguna vez, del que hace mas que no aparece.
  conAlta.sort((a, b) => {
    if ((a.entregas === 0) !== (b.entregas === 0)) return a.entregas === 0 ? -1 : 1
    if (a.entregas === 0) return (a.alta ?? '').localeCompare(b.alta ?? '')
    return (a.ultimaEntrega ?? '').localeCompare(b.ultimaEntrega ?? '')
  })

  // Se arma la salida campo por campo en vez de descartar `alta` con un rest:
  // la variable descartada quedaba sin usar y sumaba un error de lint.
  return {
    ...base,
    candidatos: conAlta.map(c => ({
      id: c.id, nombre: c.nombre, entregas: c.entregas,
      ultimaEntrega: c.ultimaEntrega, motivo: c.motivo,
    })),
  }
}

// ---------------------------------------------------------------------------
// Cupo REPROCANN: qué planta se ampara en el permiso de qué persona.
//
// El cupo del cultivo no es un número propio de la ONG: es la suma de los
// permisos que aportó cada paciente. Por eso la pregunta que hay que poder
// contestar planta por planta es "¿de quién es el REPROCANN que la habilita?".
// Una planta en floración sin persona asignada no está amparada por nadie.
// ---------------------------------------------------------------------------

export interface CupoPersona {
  pacienteId: string
  nombre: string
  reprocann: string | null
  estado: string | null
  vencimiento: string | null
  vencido: boolean
  cupo: number
  asignadas: number
  enFloracion: number
  libres: number
  excedida: boolean
}

export interface CupoReprocann {
  personas: CupoPersona[]
  /** Personas que efectivamente aportaron su REPROCANN vigente. */
  aportantes: number
  cupoTotal: number
  asignadas: number
  enFloracion: number
  /** Plantas activas que no se imputan al permiso de nadie. */
  sinAsignar: number
  /** Las críticas: en floración y sin respaldo. */
  sinAsignarEnFloracion: number
}

interface PlantaCupo { paciente_id: string | null; fase: string; activa?: boolean }
interface PacienteCupo {
  id: string; nombre_completo: string; reprocann_nro: string | null
  reprocann_estado: string | null; reprocann_vencimiento: string | null
  plantas_habilitadas: number | null; activo?: boolean
}

export function cupoReprocann(
  pacientes: PacienteCupo[], plantas: PlantaCupo[], porPacienteDefault = 9,
): CupoReprocann {
  const activas = plantas.filter(p => p.activa !== false)
  const hoy = new Date().toISOString().slice(0, 10)

  const personas: CupoPersona[] = pacientes
    .filter(p => p.activo !== false)
    .map(p => {
      const suyas = activas.filter(x => x.paciente_id === p.id)
      const enFloracion = suyas.filter(x => x.fase === 'Floracion').length
      const cupo = p.plantas_habilitadas ?? porPacienteDefault
      return {
        pacienteId: p.id, nombre: p.nombre_completo,
        reprocann: p.reprocann_nro, estado: p.reprocann_estado,
        vencimiento: p.reprocann_vencimiento,
        vencido: !!p.reprocann_vencimiento && p.reprocann_vencimiento < hoy,
        cupo, asignadas: suyas.length, enFloracion,
        libres: Math.max(0, cupo - enFloracion),
        // El tope se mide contra las de floración, igual que en la 1780.
        excedida: enFloracion > cupo,
      }
    })
    .sort((a, b) => b.enFloracion - a.enFloracion || a.nombre.localeCompare(b.nombre))

  const sinAsignarPlantas = activas.filter(p => !p.paciente_id)
  // Sólo suma al cupo quien tiene REPROCANN cargado y no vencido.
  const aportan = personas.filter(p => p.reprocann && !p.vencido)

  return {
    personas,
    aportantes: aportan.length,
    cupoTotal: aportan.reduce((s, p) => s + p.cupo, 0),
    asignadas: activas.filter(p => p.paciente_id).length,
    enFloracion: activas.filter(p => p.fase === 'Floracion').length,
    sinAsignar: sinAsignarPlantas.length,
    sinAsignarEnFloracion: sinAsignarPlantas.filter(p => p.fase === 'Floracion').length,
  }
}

/** Gramos que la ONG puede mover entre sus propios predios. */
export function topeTransporteG(pacientes: number, gramosPorPaciente = 40): number {
  return pacientes * gramosPorPaciente
}

/**
 * Ventana móvil de 30 días (SRS v3.2, RN-02).
 *
 * El tope no se mide por entrega sino por lo acumulado en los últimos 30 días
 * CORRIDOS. Validar sólo la entrega individual deja pasar el caso real: cinco
 * entregas de 35 g en tres semanas pasan una por una y en conjunto son 175 g.
 *
 * Los 30 días se cuentan hacia atrás desde la fecha de la entrega que se está
 * evaluando, no desde hoy: así una dispensa vieja se sigue validando contra su
 * propio período y no contra el mes en curso.
 */
export interface CupoMovil {
  /** Gramos ya entregados en la ventana, sin contar la que se evalúa. */
  acumulado: number
  /** Con la entrega que se evalúa incluida. */
  conNueva: number
  tope: number | null
  excede: boolean
  /** Cuánto queda disponible en la ventana. Null si no hay tope cargado. */
  remanente: number | null
  desde: string
  hasta: string
}

export function cupoMovil30Dias(
  dispensas: Dispensa[], pacienteId: string, hasta: string,
  topeMensualG: number | null, excluirId?: string,
): CupoMovil {
  const fin = new Date(hasta + 'T00:00:00')
  const ini = new Date(fin); ini.setDate(ini.getDate() - 30)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const enVentana = dispensas.filter(d =>
    d.paciente_id === pacienteId && d.id !== excluirId &&
    d.fecha >= iso(ini) && d.fecha <= hasta)
  const acumulado = enVentana.reduce((sum, d) => sum + (Number(d.gramos) || 0), 0)
  const nueva = dispensas.find(d => d.id === excluirId)
  const conNueva = acumulado + (Number(nueva?.gramos) || 0)
  return {
    acumulado, conNueva, tope: topeMensualG,
    excede: topeMensualG != null && conNueva > topeMensualG,
    remanente: topeMensualG != null ? Math.max(0, topeMensualG - conNueva) : null,
    desde: iso(ini), hasta,
  }
}

/** Tope de un traslado individual, independiente de la necesidad total. */
/**
 * Salidas de material que NO van a una persona y por eso no llevan paciente.
 *
 * Consumo interno, merma y saldo inicial se cargan como dispensa porque
 * descuentan del stock igual que una entrega, pero no son entregas: exigirles
 * un paciente marcaba 184 filas como error cuando estaban bien cargadas. En la
 * planilla venían con "CI", "Merma" y "SAI" en la columna de código.
 */
export const MODALIDADES_SIN_PACIENTE = [
  'Consumo interno', 'Merma', 'Saldo inicial', 'Ajuste al Sistema de Gestión',
]

/**
 * LA CUARTA NACIÓ EL 04/09/2026, y no es una salida: es una conciliación.
 *
 * El Sistema de Gestión —la planilla con la que la asociación operó todo el primer
 * año— declaraba 560 g de stock y la app calculaba 770. Los 210 g de
 * diferencia estaban en cuatro lotes, y el detalle lo explicaba entero: la
 * planilla daba por dispensados 246 g que la app no tenía descontados, y la
 * app tenía 10 g de ingreso que a la planilla le faltaban.
 *
 * ⚠️ SE LLAMA «AJUSTE» Y NO «MERMA» A PROPÓSITO. No sabemos qué pasó con esos
 * gramos: la planilla los da por salidos y no tiene UNA sola entrega que lo
 * respalde —se buscaron los cuatro códigos de lote en sus 22 hojas—. Cargarlos
 * como merma afirmaría que se perdieron, y como consumo interno, que se usaron.
 * Las dos serían una afirmación sin prueba sobre 220 gramos.
 *
 * la asociación decidió que la planilla es la fuente correcta, así que el sistema se
 * alinea con ella. Lo que queda escrito es exactamente eso: se ajustó, contra
 * qué, y que el origen de la diferencia no está documentado.
 *
 * Va SIN paciente y SIN aporte: no hay a quién imputarle la salida ni plata que
 * la acompañe —la caja ya cuadra contra el corte del 01/09—.
 */
export const MODALIDAD_AJUSTE = 'Ajuste al Sistema de Gestión'

/**
 * El material que un socio retira como PARTE DE SU RETRIBUCION.
 *
 * Lleva paciente —va a una persona concreta— pero no lleva aporte: no es una
 * entrega con reembolso, es parte de lo que esa persona cobra por operar el
 * cultivo. Al 24/08/2026 eran 108 retiros de los dos socios que cobran
 * retribucion, 524 g, y estaban cargados como entregas a paciente con el aporte
 * en cero: se leian como cobros que faltaban asentar.
 *
 * NO entra en MODALIDADES_SIN_PACIENTE: el cupo de 30 dias le sigue corriendo,
 * porque ese limite es sanitario y no depende de si se cobro.
 */
export const MODALIDAD_RETRIBUCION = 'Retribución en especie'

/**
 * La porcion chica que se entrega para que el socio pruebe una genetica.
 *
 * Igual que la retribucion: lleva paciente y no lleva aporte. Al 24/08/2026
 * eran 28 entregas de 2 g o menos repartidas entre 11 socios, 49 g en total,
 * cargadas como entregas a paciente con el aporte en cero, de modo que se
 * leian como cobros faltantes.
 *
 * NO entra en MODALIDADES_SIN_PACIENTE, y esa es la diferencia con "Consumo
 * interno": la muestra va a alguien concreto y esa trazabilidad se pierde si se
 * la carga como salida sin paciente. El cupo de 30 dias le sigue corriendo.
 */
export const MODALIDAD_MUESTRA = 'Muestra'

export const esSalidaSinPaciente = (d: { modalidad?: string | null }) =>
  MODALIDADES_SIN_PACIENTE.includes(String(d.modalidad ?? ''))

export const TOPE_TRASLADO_INDIVIDUAL_G = 40

/**
 * La 1780 admite tres formas de mover material por persona representada, y cada
 * una tiene su propio tope. Antes acá sólo estaban los 40 g de flores, así que
 * un traslado de aceite o de plantas se marcaba mal.
 */
export const TOPES_TRASLADO = {
  flores: { tope: 40, unidad: 'g', label: 'Flores secas' },
  frascos: { tope: 6, unidad: 'frascos de 30 ml', label: 'Aceite' },
  // Las plantas se topean contra el cupo REPROCANN de la persona, no contra un
  // número fijo: "hasta la cantidad de plantas autorizadas por persona".
  plantas: { tope: null as number | null, unidad: 'plantas', label: 'Plantas' },
} as const

export interface RevisionTraslado {
  ok: boolean
  motivos: string[]
}

/**
 * Revisa una carta de porte contra lo que exige la 1780: el tope según el tipo
 * de material, los datos obligatorios de la declaración y la presentación.
 */
export function revisarTraslado(t: Traslado, plantasAutorizadas?: number | null): RevisionTraslado {
  const motivos: string[] = []
  const tipo = t.tipo_material ?? 'flores'
  const cant = Number(t.cantidad) || 0

  if (tipo === 'plantas') {
    if (plantasAutorizadas != null && cant > plantasAutorizadas) {
      motivos.push(`${cant} plantas supera las ${plantasAutorizadas} autorizadas para esa persona.`)
    }
  } else {
    const { tope, unidad } = TOPES_TRASLADO[tipo]
    if (tope != null && cant > tope) motivos.push(`${cant} supera el tope de ${tope} ${unidad} por persona representada.`)
  }

  // La carta de porte es una declaración jurada: sin estos datos no se puede
  // presentar, y sin presentarla el traslado no está amparado.
  const faltan = ([
    ['origen', 'el origen'], ['destino', 'el destino'],
    ['transportista', 'el transportista'], ['destinatario', 'el destinatario final'],
  ] as const).filter(([k]) => !t[k]).map(([, l]) => l)
  if (faltan.length) motivos.push(`Falta ${faltan.join(', ')} en la carta de porte.`)
  if (!t.carta_porte_presentada) motivos.push('La carta de porte todavía no se presentó por TAD.')

  return { ok: motivos.length === 0, motivos }
}

/**
 * Parentesco cruzado entre órganos: la Comisión Directiva y la Revisora de
 * Cuentas no pueden compartir parientes (ni por sangre, ni por matrimonio, ni
 * domicilio). Dentro de cada comisión sí está permitido, así que sólo se mira
 * el cruce.
 */
export function parentescoCruzado(autoridades: Autoridad[]): { grupo: string; directiva: string[]; revisora: string[] }[] {
  const activas = autoridades.filter(a => a.activo !== false && a.grupo_familiar?.trim())
  const grupos = new Map<string, { directiva: string[]; revisora: string[] }>()
  for (const a of activas) {
    const k = a.grupo_familiar!.trim().toLowerCase()
    const g = grupos.get(k) ?? { directiva: [], revisora: [] }
    if ((a.organo ?? '').toLowerCase().includes('revisora')) g.revisora.push(a.nombre)
    else g.directiva.push(a.nombre)
    grupos.set(k, g)
  }
  return [...grupos.entries()]
    .filter(([, g]) => g.directiva.length > 0 && g.revisora.length > 0)
    .map(([grupo, g]) => ({ grupo, ...g }))
}

/**
 * Cuántos fundadores necesitan REPROCANN activo según dónde se inscribió la
 * asociación: en CABA más de la mitad, en Provincia de Buenos Aires todos.
 */
export function exigenciaReprocannFundadores(jurisdiccion?: string | null): { minimo: (n: number) => number; texto: string } {
  const j = (jurisdiccion ?? '').toLowerCase()
  if (j.includes('buenos aires') && !j.includes('ciudad') && !j.includes('caba')) {
    return { minimo: n => n, texto: 'En Provincia de Buenos Aires se exige que TODOS los fundadores tengan REPROCANN activo.' }
  }
  return {
    minimo: n => Math.floor(n / 2) + 1,
    texto: 'En CABA se exige que más de la mitad de los fundadores tengan REPROCANN activo, y el resto en trámite o con un curso de cannabis medicinal.',
  }
}

// ---------------------------------------------------------------------------
// Libros, actas y coherencia.
// ---------------------------------------------------------------------------

export const TIPOS_LIBRO = [
  { id: 'actas_cd', nombre: 'Actas de Comisión Directiva', grupo: 'social' },
  { id: 'actas_asamblea', nombre: 'Actas de Asamblea', grupo: 'social' },
  { id: 'asistencia', nombre: 'Asistencia a reuniones', grupo: 'social' },
  { id: 'actas_revisora', nombre: 'Actas de Comisión Revisora de Cuentas', grupo: 'social' },
  { id: 'registro_asociados', nombre: 'Registro de Asociados', grupo: 'social' },
  { id: 'diario', nombre: 'Libro Diario', grupo: 'contable' },
  { id: 'inventario_balances', nombre: 'Inventario y Balances', grupo: 'contable' },
] as const

export const TIPOS_ACTA = [
  { id: 'cd', nombre: 'Comisión Directiva', libro: 'actas_cd' },
  { id: 'asamblea_ordinaria', nombre: 'Asamblea Ordinaria', libro: 'actas_asamblea' },
  { id: 'asamblea_extraordinaria', nombre: 'Asamblea Extraordinaria', libro: 'actas_asamblea' },
  { id: 'revisora', nombre: 'Comisión Revisora de Cuentas', libro: 'actas_revisora' },
] as const

export const ESTADOS_ACTA = ['borrador', 'firmada', 'en_libro', 'inscripta'] as const

export interface PuntoOrdenDia {
  punto: string
  resultado?: 'aprobado' | 'rechazado' | 'pendiente'
  favor?: number
  contra?: number
  abstenciones?: number
}

export interface Libro {
  id: string
  tipo: string
  numero?: number | null
  rubricado?: boolean
  fecha_rubrica?: string | null
  organismo?: string | null
  digital?: boolean
  folios_totales?: number | null
  folios_usados?: number | null
  estado?: string | null
  notas?: string | null
}

export interface Acta {
  id: string
  tipo: string
  numero: number
  fecha: string
  lugar?: string | null
  hora_inicio?: string | null
  hora_fin?: string | null
  asistentes?: number | null
  /**
   * Quiénes asistieron. El libro de Asistencia a reuniones necesita los nombres,
   * no el total: sin ellos el quórum no se puede demostrar. Va como lista de
   * texto y no como referencia a asociados porque a una reunión pueden entrar
   * personas que no lo son (contador, escribano, invitados), y porque el acta es
   * un documento cerrado: lo asentado queda aunque después alguien se dé de baja.
   */
  asistentes_nombres?: string[]
  /** Mínimo que pide el estatuto para sesionar, para poder contrastarlo. */
  quorum_requerido?: number | null
  quorum_ok?: boolean
  segunda_convocatoria?: boolean
  orden_del_dia?: PuntoOrdenDia[]
  firmantes?: string | null
  estado?: string | null
  libro_id?: string | null
  folio?: number | null
  notas?: string | null
}

export interface Asociado {
  id: string
  nombre: string
  /** Mandato de Gestión Operativa Especial firmado (SRS v3.2, RN-03). */
  mandato_aceptado?: boolean
  mandato_fecha?: string | null
  /** Legajo interno, que las plantillas de documentos referencian. */
  legajo?: string | null
  dni?: string | null
  categoria?: string | null
  paciente_id?: string | null
  fecha_alta?: string | null
  acta_alta_id?: string | null
  fecha_baja?: string | null
  activo?: boolean
  fundador?: boolean
  vinculado_reprocann?: boolean
  fecha_vinculacion?: string | null
  notas?: string | null
}

export interface CategoriaSocio {
  id: string
  nombre: string
  requiere_reprocann?: boolean
  con_voto?: boolean
  cuota?: number | null
  notas?: string | null
}

export interface Cuota {
  id: string
  tipo?: string | null
  categoria?: string | null
  valor: number
  vigente_desde?: string | null
  acta_id?: string | null
  notas?: string | null
}

/** Al 75% de ocupación ya hay que rubricar el libro siguiente. */
export const UMBRAL_RUBRICA_NUEVA = 0.75

export function ocupacionLibro(l: Libro): number | null {
  if (!l.folios_totales || l.folios_totales <= 0) return null
  return (l.folios_usados ?? 0) / l.folios_totales
}

/**
 * La numeración de actas es correlativa POR TIPO: cada órgano lleva su serie.
 * Devuelve los huecos y los repetidos, que es lo que genera observaciones.
 */
export interface ProblemaCorrelatividad {
  tipo: string
  faltantes: number[]
  repetidos: number[]
  fueraDeOrden: { numero: number; fecha: string }[]
}

export function revisarCorrelatividad(actas: Acta[]): ProblemaCorrelatividad[] {
  const porTipo = new Map<string, Acta[]>()
  for (const a of actas) {
    if (!porTipo.has(a.tipo)) porTipo.set(a.tipo, [])
    porTipo.get(a.tipo)!.push(a)
  }
  const out: ProblemaCorrelatividad[] = []
  for (const [tipo, lista] of porTipo) {
    const ordenadas = [...lista].sort((a, b) => a.numero - b.numero)
    const nums = ordenadas.map(a => a.numero)
    const faltantes: number[] = []
    for (let n = 1; n <= Math.max(...nums); n++) if (!nums.includes(n)) faltantes.push(n)
    const repetidos = [...new Set(nums.filter((n, i) => nums.indexOf(n) !== i))]
    // Si el número sube, la fecha no puede bajar.
    const fueraDeOrden: { numero: number; fecha: string }[] = []
    for (let i = 1; i < ordenadas.length; i++) {
      if (ordenadas[i].fecha < ordenadas[i - 1].fecha) {
        fueraDeOrden.push({ numero: ordenadas[i].numero, fecha: ordenadas[i].fecha })
      }
    }
    if (faltantes.length || repetidos.length || fueraDeOrden.length) {
      out.push({ tipo, faltantes, repetidos, fueraDeOrden })
    }
  }
  return out
}

/** Mayorías. Las abstenciones no suman a ningún lado pero bajan el total emitido. */
export type Mayoria = 'simple' | 'absoluta' | 'agravada' | 'unanimidad'

export function resultadoVotacion(
  p: PuntoOrdenDia, totalMiembros: number, mayoria: Mayoria = 'simple', fraccion = 2 / 3,
): { aprobado: boolean; explicacion: string } {
  const favor = p.favor ?? 0, contra = p.contra ?? 0, abst = p.abstenciones ?? 0
  const emitidos = favor + contra
  switch (mayoria) {
    case 'unanimidad':
      return { aprobado: favor > 0 && contra === 0 && abst === 0,
        explicacion: 'Unanimidad: todos a favor, sin votos en contra ni abstenciones.' }
    case 'absoluta':
      return { aprobado: favor > totalMiembros / 2,
        explicacion: `Mayoría absoluta: más de la mitad del total de miembros (${Math.floor(totalMiembros / 2) + 1} de ${totalMiembros}).` }
    case 'agravada':
      return { aprobado: favor >= Math.ceil(totalMiembros * fraccion),
        explicacion: `Mayoría agravada: ${Math.round(fraccion * 100)}% del total (${Math.ceil(totalMiembros * fraccion)} de ${totalMiembros}).` }
    default:
      return { aprobado: favor > contra,
        explicacion: `Mayoría simple sobre ${emitidos} votos emitidos. Las ${abst} abstenciones no cuentan pero reducen el total.` }
  }
}

// ---------------------------------------------------------------------------
// Movimientos de caja
//
// La base tenía 1.690 asientos y NINGUNA pantalla que los mostrara: `ong_caja`
// sólo se escribía (el portal asienta al entregar) y no se leía en ningún lado.
// Es lo que la planilla resuelve en su hoja FINANZAS, que fue de donde salió
// este cálculo: entradas y salidas por medio, el neto del período, y el saldo
// acumulado.
// ---------------------------------------------------------------------------

export interface ResumenCaja {
  entradas: { efectivo: number; transferencia: number; otros: number; total: number }
  salidas:  { efectivo: number; transferencia: number; otros: number; total: number }
  /** Entradas menos salidas del período mirado. */
  neto: number
  /** Neto por medio: es el saldo que queda en la caja y en el banco. */
  netoEfectivo: number
  netoTransferencia: number
  /**
   * Lo que no se puede atribuir a la caja ni al banco: asientos sin medio, o
   * con uno que no es ninguno de los dos («Mixto», «Nota de Credito»).
   *
   * Existe porque el arqueo lo NECESITA. En la asociación son 92 asientos por
   * $17,7M —59 «Mixto», 32 sin medio y un «Tranferencia» mal escrito— y
   * mostrar solo efectivo y transferencia daba dos numeros que no suman el
   * total, sin decir que faltaba nada.
   */
  netoOtros: number
  asientos: number
}

const MEDIO_EF = 'efectivo'
const MEDIO_TR = 'transferencia'

/**
 * Suma un conjunto de asientos. Se le pasan los ya filtrados por fecha: el
 * filtrado vive en la pantalla porque el rango lo elige la persona, y la lista
 * completa ya está cargada.
 *
 * Un medio que no sea efectivo ni transferencia cae en `otros` en vez de
 * perderse: la planilla sólo contempla los dos, pero en los pagos ya apareció
 * una "Nota de Crédito", y un total que no suma sus partes es peor que uno con
 * una categoría de más.
 */
export function resumenCaja(asientos: AsientoCaja[]): ResumenCaja {
  const z = () => ({ efectivo: 0, transferencia: 0, otros: 0, total: 0 })
  const entradas = z(); const salidas = z()
  for (const a of asientos) {
    const m = (a.medio ?? '').trim().toLowerCase()
    const monto = Number(a.monto) || 0
    const b = a.tipo === 'ingreso' ? entradas : salidas
    if (m === MEDIO_EF) b.efectivo += monto
    else if (m === MEDIO_TR) b.transferencia += monto
    else b.otros += monto
    b.total += monto
  }
  return {
    entradas, salidas,
    neto: entradas.total - salidas.total,
    netoEfectivo: entradas.efectivo - salidas.efectivo,
    netoTransferencia: entradas.transferencia - salidas.transferencia,
    netoOtros: entradas.otros - salidas.otros,
    asientos: asientos.length,
  }
}

// ---------------------------------------------------------------------------
// MOVIMIENTO INTERNO: la plata que pasa del banco a la mano
//
// POR QUE EXISTE (31/08/2026). La caja de efectivo de la asociación daba -$10,2M, que
// es fisicamente imposible: no se pueden sacar mas billetes de los que entraron.
// Medido: hay CINCO asientos de traspaso interno en trece meses, por $XXX.XXX.
// Y las trece facturas de luz -$9,1M- se pagan en efectivo. Ese efectivo salio
// del banco, y esa extraccion no la anoto nadie.
//
// No es que la gente sea desprolija: anotarlo eran DOS asientos a mano, uno
// egreso y otro ingreso, con el mismo importe y medios distintos. Nadie hace eso
// trece veces al año. Con un gesto, se hace.
//
// LO QUE HACE SEGURA A ESTA FUNCION es que un movimiento interno SUMA CERO al
// total: la misma plata sale de un medio y entra en el otro. No puede inventar
// ingresos ni tapar un deficit por construccion, que es justo lo que no hay que
// poder hacer desde una pantalla. Mueve el REPARTO, nunca el resultado.
// ---------------------------------------------------------------------------

/** Los dos medios entre los que tiene sentido mover plata. */
export type MedioInterno = 'Efectivo' | 'Transferencia'

export interface MovimientoInterno {
  fecha: string
  desde: MedioInterno
  hacia: MedioInterno
  monto: number
  detalle?: string | null
}

/**
 * Los DOS asientos de un movimiento interno: uno que sale y otro que entra.
 *
 * Devuelve las filas y no las guarda, para poder probar el invariante sin base.
 */
export function asientosDeMovimientoInterno(m: MovimientoInterno): Partial<AsientoCaja>[] {
  const monto = Math.abs(Number(m.monto) || 0)
  // El concepto es el mismo en los dos y dice a donde fue: asi el par se
  // reconoce despues en el libro, que es una lista de mil setecientas filas.
  const concepto = `Movimiento interno · ${m.desde} → ${m.hacia}`
  const detalle = m.detalle?.trim() || null
  return [
    { fecha: m.fecha, tipo: 'egreso',  medio: m.desde, monto, concepto, detalle },
    { fecha: m.fecha, tipo: 'ingreso', medio: m.hacia, monto, concepto, detalle },
  ]
}

/** Si un movimiento interno se puede guardar, y por que no. */
export function revisarMovimientoInterno(m: MovimientoInterno): string | null {
  if (!(Number(m.monto) > 0)) return 'Poné cuánto se movió'
  // Mover de un medio al MISMO medio son dos asientos que se anulan y ensucian
  // el libro sin decir nada.
  if (m.desde === m.hacia) return 'Elegí dos medios distintos: de dónde sale y a dónde entra'
  if (!m.fecha) return 'Poné la fecha'
  return null
}

/** Filtra por rango inclusivo. Un extremo vacío no acota de ese lado. */
export const enRango = <T extends { fecha: string }>(xs: T[], desde: string, hasta: string): T[] =>
  xs.filter(x => (!desde || x.fecha >= desde) && (!hasta || x.fecha <= hasta))

// ---------------------------------------------------------------------------
// Saldo con proveedores
//
// La pregunta "¿cuánto le debemos a Lisa Culti A?" no se podía hacer: las
// órdenes de servicio tenían el saldo escrito ADENTRO de la descripción y los
// pagos no estaban en ningún lado. Ahora sale de dos vistas que lo CALCULAN
// sumando los pagos, así que no puede desincronizarse de la realidad.
// ---------------------------------------------------------------------------

export interface SaldoProveedor {
  proveedor: string
  ordenes: number
  comprado: number
  pagado: number
  saldo: number
  ordenes_con_saldo: number
}

export interface SaldoOrden {
  orden_servicio: string
  proveedor: string | null
  fecha: string | null
  /** Lote que trajo la orden. Se recupero del texto de la descripcion. */
  lote_codigo: string | null
  total: number
  pagado: number
  saldo: number
  pagos: number
}

/** Un pago a proveedor, como lo necesita el cruce contra la caja. */
export interface PagoProveedor {
  id: string
  proveedor: string
  fecha: string
  monto: number
  orden_servicio?: string | null
  medio?: string | null
}

export const saldosService = {
  /** Los pagos en crudo, para cruzarlos contra sus asientos de caja. */
  async getPagos(): Promise<PagoProveedor[]> {
    const { data, error } = await supabase
      .from('ong_pagos_proveedor')
      .select('id, proveedor, fecha, monto, orden_servicio, medio')
      .order('fecha', { ascending: false })
    lanzar(error)
    return (data ?? []) as PagoProveedor[]
  },

  async getPorProveedor(): Promise<SaldoProveedor[]> {
    const { data, error } = await supabase
      .from('v_saldo_proveedores').select('*').order('saldo', { ascending: false })
    lanzar(error)
    return (data ?? []) as SaldoProveedor[]
  },

  /**
   * Solo los nombres de beneficiario de los pagos, para el cruce de grafias.
   *
   * Va aparte de las dos vistas de arriba porque esas agregan por orden de
   * servicio: si el mismo proveedor esta cargado con dos grafias, la vista ya
   * lo muestra como dos, que es justamente lo que hay que detectar. Los
   * nombres hay que verlos en crudo.
   */
  /**
   * Anota un pago a un proveedor.
   *
   * EL SALDO NO SE MARCA, SE CALCULA. No hay columna `pagado` que mantener:
   * `v_saldo_proveedores` resta los pagos de lo comprado. Una orden se paga en
   * varias veces, y un saldo guardado se desincroniza al primer pago que
   * alguien corrija.
   *
   * ⚠ EL PAGO VA CONTRA UNA ORDEN, no contra el proveedor suelto. Sin orden el
   * saldo del proveedor igual baja, pero no se sabe QUE orden quedo saldada — y
   * esa es justamente la pregunta que hay que poder contestar cuando alguien
   * reclama una factura vieja. `orden_servicio` es texto y engancha por el
   * `numero` del documento, igual que `lote_codigo` en las dispensas.
   *
   * NO escribe en el libro de caja. Son dos registros distintos a proposito:
   * este dice cuanto se le debe a quien, y la caja dice que entro y salio. Un
   * pago que se anota en los dos lados sin que nadie lo cruce termina contado
   * dos veces, y no hay forma de saber cual de los dos es el bueno.
   */
  async registrarPago(p: {
    orden_servicio: string
    proveedor: string
    fecha: string
    monto: number
    medio?: string | null
    referencia?: string | null
    notas?: string | null
  }): Promise<{ asentado: boolean; aviso: string | null }> {
    // Se pide la fila de vuelta porque el asiento la necesita: sin el `id` del
    // pago no hay con que enlazarlos, y un asiento suelto es justo el huerfano
    // que este arreglo viene a evitar.
    const { data, error } = await supabase.from('ong_pagos_proveedor').insert({
      orden_servicio: p.orden_servicio,
      proveedor: normalizarProveedor(p.proveedor),
      fecha: p.fecha,
      monto: p.monto,
      medio: p.medio || null,
      referencia: p.referencia?.trim() || null,
      notas: p.notas?.trim() || null,
    }).select().single()
    if (error) throw error

    // Y LA PLATA SALE DE LA CAJA. Sin esto la deuda bajaba y el libro no se
    // enteraba. Va DESPUES del insert del pago y no antes: si fallara la caja,
    // preferible un pago sin asiento -que se ve en el cruce- que un asiento sin
    // pago, que resta plata por algo que no ocurrio.
    const pago = data as { id: string }
    const { error: eCaja } = await supabase.from('ong_caja').insert(
      asientoDePago({ ...p, id: pago.id, proveedor: normalizarProveedor(p.proveedor) }))

    // NO SE TIRA ERROR, y es a proposito: el pago YA se guardo. Tirar aca
    // frenaria al operador por algo que ya salio bien, y encima lo empujaria a
    // reintentar —duplicando el pago— porque la pantalla le dice que fallo.
    //
    // Tampoco se lo come en silencio: se devuelve el aviso para que la pantalla
    // lo diga y la persona sepa que hay que mirar Movimientos. Un pago sin
    // asiento se ve; un pago cargado dos veces, no.
    return { asentado: !eCaja, aviso: eCaja?.message ?? null }
  },

  /**
   * Borra el pago. Su asiento de caja se va solo, por el `ON DELETE CASCADE` de
   * `ong_caja.pago_id`: se resuelve en la base y no aca a proposito, para que un
   * borrado por SQL a mano tampoco pueda dejar el asiento huerfano.
   */
  async borrarPago(id: string): Promise<void> {
    const { error } = await supabase.from('ong_pagos_proveedor').delete().eq('id', id)
    if (error) throw error
  },

  async getNombresPagos(): Promise<string[]> {
    const { data, error } = await supabase.from('ong_pagos_proveedor').select('proveedor')
    lanzar(error)
    return (data ?? []).map((r: { proveedor: string | null }) => r.proveedor ?? '')
  },

  async getOrdenes(soloConSaldo = true): Promise<SaldoOrden[]> {
    let q = supabase.from('v_saldo_ordenes').select('*')
    if (soloConSaldo) q = q.gt('saldo', 0)
    const { data, error } = await q.order('saldo', { ascending: false })
    lanzar(error)
    return (data ?? []) as SaldoOrden[]
  },
}

/**
 * De donde entro la plata y en que se fue.
 *
 * Sale de la hoja LIBRO DIARIO, cuya columna "Origen / Categoria" cae en
 * `ong_caja.detalle` (la tabla no tiene columna `categoria`; el mapper de la
 * Edge Function la guarda ahi). Movimientos mostraba solo el MEDIO —efectivo o
 * transferencia— y nunca el concepto, que es la pregunta que se hace cualquiera
 * mirando la caja.
 *
 * Ojo con que ese campo guarda DOS cosas segun el signo, y esta bien que asi
 * sea porque es como lo lleva la asociación:
 *   - en los egresos es la categoria del gasto (Gasto Operativo, Retribucion)
 *   - en los ingresos es la variedad que se entrego (Cookies, Shuga, Legendary)
 * Por eso se devuelven separados y no en una sola lista: mezclarlos daria un
 * ranking donde "Cookies" compite con "PAGO A PROVEEDOR", que no significa nada.
 */
export interface CategoriaCaja {
  categoria: string
  asientos: number
  monto: number
}

export function movimientosPorCategoria(asientos: AsientoCaja[]) {
  const juntar = (filas: AsientoCaja[]): CategoriaCaja[] => {
    const m = new Map<string, CategoriaCaja>()
    for (const a of filas) {
      // Las reversas vienen marcadas dentro del mismo texto ("Shuga | REVERSA
      // de un ingreso"). Se agrupan por su categoria real: si no, cada reversa
      // abre una fila propia y el ranking se llena de ruido.
      const categoria = (a.detalle ?? '').split('|')[0].trim() || 'Sin categoría'
      const e = m.get(categoria) ?? { categoria, asientos: 0, monto: 0 }
      e.asientos += 1
      e.monto += Number(a.monto) || 0
      m.set(categoria, e)
    }
    return [...m.values()].sort((a, b) => b.monto - a.monto)
  }
  return {
    entradas: juntar(asientos.filter(a => a.tipo === 'ingreso')),
    salidas: juntar(asientos.filter(a => a.tipo === 'egreso')),
  }
}

/**
 * Cuanto aporto cada productor, en gramos.
 *
 * Sale del bloque "Productor / Produccion Total (gr)" de la hoja Dashboard.
 * Productor y proveedor son LO MISMO: la planilla usa dos columnas para la
 * misma persona, y los totales dan identicos contra `ong_lotes.proveedor`.
 *
 * Diferencia deliberada con la planilla: los gramos suman SOLO lo que se mide
 * en gramos. Ellos cuentan los frascos de aceite como si fueran gramos, y por
 * eso su total da de mas justo en los productores que entregaron aceite. Es el
 * mismo criterio que `balanceMateria`: lo que no son gramos se cuenta aparte,
 * no se disfraza de gramo.
 */
export interface ProduccionProductor {
  productor: string
  lotes: number
  gramos: number
  /** Frascos, unidades: entregas reales que NO van al total en gramos. */
  otrasUnidades: number
}

export function produccionPorProductor(lotes: LoteIngreso[]): ProduccionProductor[] {
  const m = new Map<string, ProduccionProductor>()
  for (const l of lotes) {
    // Sin proveedor es lo que la planilla llama "Inventario Inicial": no es un
    // error, es lo que ya estaba cuando arrancaron a registrar.
    const productor = (l.proveedor ?? '').trim() || 'Inventario inicial'
    const e = m.get(productor) ?? { productor, lotes: 0, gramos: 0, otrasUnidades: 0 }
    e.lotes += 1
    if (unidadDe(l.unidad) === 'g') e.gramos += Number(l.gramos_totales) || 0
    else e.otrasUnidades += 1
    m.set(productor, e)
  }
  return [...m.values()].sort((a, b) => b.gramos - a.gramos)
}

/**
 * Cuanto retiro cada socio.
 *
 * Sale del bloque "Socio / Total Retirado" de la hoja Dashboard, y es el unico
 * concepto de esa hoja que no estaba en ninguna pantalla.
 *
 * Ignora 'N/A', que no es un socio: es el marcador de "no aplica" de los gastos
 * operativos, que no tienen beneficiario. Meterlo lo mostraria como si fuera
 * la persona que mas cobro.
 */
export interface RetiroSocio {
  socio: string
  pagos: number
  total: number
  desde: string | null
  hasta: string | null
}

export function retirosPorSocio(documentos: DocumentoONG[]): RetiroSocio[] {
  const m = new Map<string, RetiroSocio>()
  for (const d of documentos) {
    if (d.categoria !== 'Retribucion') continue
    const socio = (d.proveedor ?? '').trim()
    if (!socio || socio === 'N/A') continue
    const e = m.get(socio) ?? { socio, pagos: 0, total: 0, desde: null, hasta: null }
    e.pagos += 1
    e.total += Number(d.monto) || 0
    if (d.fecha && (e.desde == null || d.fecha < e.desde)) e.desde = d.fecha
    if (d.fecha && (e.hasta == null || d.fecha > e.hasta)) e.hasta = d.fecha
    m.set(socio, e)
  }
  return [...m.values()].sort((a, b) => b.total - a.total)
}

/**
 * Aporte promedio por entrega.
 *
 * El indicador de la planilla divide por TODAS las entregas, incluyendo consumo
 * interno, merma y saldo inicial, que por definicion no tienen aporte. Con los
 * datos de hoy eso da $XX.XXX contra los $XX.XXX reales: subestima el aporte un
 * 29%. Aca se divide solo por las que efectivamente aportaron, y se dice cuantas
 * quedaron afuera para que el numero se pueda auditar.
 */
export function aportePromedio(dispensas: Dispensa[]) {
  const conAporte = dispensas.filter(d => (Number(d.aporte) || 0) > 0)
  const total = conAporte.reduce((s, d) => s + (Number(d.aporte) || 0), 0)
  const gramos = conAporte
    .filter(d => unidadDe(d.unidad) === 'g')
    .reduce((s, d) => s + (Number(d.gramos) || 0), 0)
  return {
    entregas: dispensas.length,
    conAporte: conAporte.length,
    sinAporte: dispensas.length - conAporte.length,
    total,
    porEntrega: conAporte.length > 0 ? total / conAporte.length : null,
    porGramo: gramos > 0 ? total / gramos : null,
  }
}

/** Totales. Se suman acá para no pedir otra consulta por siete filas. */
/**
 * Separa la produccion propia del saldo con terceros.
 *
 * PLATA QUE UNO SE DEBE A SI MISMO NO ES DEUDA.
 *
 * La planilla de la que salieron los datos de la asociación no tenia el concepto de
 * cultivo propio, asi que un año de produccion propia entro como ordenes de
 * compra a si mismos: 46 ordenes y $XX.XXX.XXX, el 81% de todo el saldo. La
 * pantalla decia $XX.XXX.XXX de deuda cuando con terceros eran unos $6,2M.
 *
 * No se BORRA ni se esconde: las ordenes siguen siendo el registro de lo que se
 * produjo y cuanto costo, y el costo por gramo se calcula con eso. Lo que
 * cambia es donde se suma — el saldo con proveedores responde «cuanto debo», y
 * eso no se le debe a nadie.
 *
 * ⚠ Compara con `normalizarProveedor` —el mismo criterio que agrupa
 * `v_saldo_proveedores`— y no por parecido. «Contiene la asociación» agarraria tambien
 * a un tercero que se llame parecido, y sacarlo del saldo escondería una deuda
 * real: el error caro es al reves del que parece.
 */
export function separarProduccionPropia<T extends { proveedor?: string | null }>(
  filas: T[], proveedorPropio: string | null | undefined,
): { terceros: T[]; propia: T[] } {
  const clave = normalizarProveedor(proveedorPropio).toLowerCase()
  if (!clave) return { terceros: filas, propia: [] }
  const esPropia = (f: T) => normalizarProveedor(f.proveedor).toLowerCase() === clave
  return { terceros: filas.filter(f => !esPropia(f)), propia: filas.filter(esPropia) }
}

export function totalesProveedores(f: SaldoProveedor[]) {
  const comprado = f.reduce((s, x) => s + (Number(x.comprado) || 0), 0)
  const pagado = f.reduce((s, x) => s + (Number(x.pagado) || 0), 0)
  return {
    comprado, pagado,
    saldo: comprado - pagado,
    pctPagado: comprado > 0 ? (pagado / comprado) * 100 : null,
    proveedores: f.length,
    conSaldo: f.filter(x => Number(x.saldo) > 0).length,
    ordenes: f.reduce((s, x) => s + (Number(x.ordenes) || 0), 0),
  }
}

// ---------------------------------------------------------------------------
// Coherencia: los cruces que hace una inspección.
// ---------------------------------------------------------------------------

export interface Chequeo {
  clave: string
  titulo: string
  estado: 'ok' | 'alerta' | 'error' | 'sin_datos'
  valor: string
  detalle: string
}

/**
 * Dónde se arregla cada cruce.
 *
 * El panel decía qué no cierra y te dejaba ahí parado: «211 sin acta» está bien
 * como diagnóstico, pero para hacer algo con eso había que saber que las actas
 * viven en una pestaña llamada Actas, quince a la derecha, que en el celular no
 * se ve. Con esto cada renglón es un link al formulario que lo apaga.
 *
 * Vive al lado de los chequeos a propósito: un cruce nuevo sin destino acá
 * queda mudo, y verlo en el mismo archivo hace que no se olvide.
 *
 * `donde` es el texto del link. Se escribe entero en vez de derivarlo de la
 * ruta porque tres cruces mandan fuera de la O.N.G. y el nombre de la pantalla
 * no siempre coincide con el segmento.
 *
 * `paso` es el orden en que conviene atacarlos, y no es un capricho: es en qué
 * orden se habilitan entre sí. No tiene sentido mandar a alguien a redactar un
 * acta si todavía no cargó la entidad, porque el acta va a salir con [CUIT]
 * entre corchetes y va a haber que rehacerla. Ordenar sólo por gravedad
 * mezclaba las dos cosas y el panel mandaba a trabajar en desorden.
 */
export const DONDE_SE_ARREGLA: Record<string,
  { ruta: string; donde: string; paso: number }> = {
  // La caja negativa se arregla mirando el arqueo, que es donde se ve qué parte
  // del saldo no tiene medio de pago asignado.
  caja_negativa: { ruta: '/ong/movimientos', donde: 'Movimientos', paso: 4 },
  // Una entrega sin su asiento se arregla abriéndola y volviéndola a guardar:
  // desde el 30/08/2026 guardar una entrega escribe su asiento.
  entregas_sin_asiento: { ruta: '/ong/dispensas', donde: 'Dispensas', paso: 4 },
  // Los asientos sueltos se miran en el libro, que es donde están.
  asientos_sin_entrega: { ruta: '/ong/movimientos', donde: 'Movimientos', paso: 4 },
  // Un pago sin asiento se arregla en Movimientos, que es donde falta la fila.
  pagos_sin_asiento: { ruta: '/ong/movimientos', donde: 'Movimientos', paso: 4 },
  // Vida institucional.
  objeto: { ruta: '/ong/entidad', donde: 'La entidad', paso: 1 },
  cierre: { ruta: '/ong/entidad', donde: 'La entidad', paso: 1 },
  altas_en_acta: { ruta: '/ong/actas', donde: 'Actas', paso: 3 },
  correlatividad: { ruta: '/ong/actas', donde: 'Actas', paso: 3 },
  cuota_en_acta: { ruta: '/ong/actas', donde: 'Actas', paso: 3 },
  revision_libros: { ruta: '/ong/actas', donde: 'Actas', paso: 3 },
  libros_faltantes: { ruta: '/ong/libros', donde: 'Libros', paso: 2 },
  rubrica: { ruta: '/ong/libros', donde: 'Libros', paso: 2 },
  ocupacion: { ruta: '/ong/libros', donde: 'Libros', paso: 2 },
  mandato: { ruta: '/ong/autoridades', donde: 'Autoridades', paso: 2 },
  parentesco: { ruta: '/ong/autoridades', donde: 'Autoridades', paso: 2 },
  antecedentes: { ruta: '/ong/autoridades', donde: 'Autoridades', paso: 2 },
  categorias: { ruta: '/ong/asociados', donde: 'Asociados', paso: 3 },
  cuotas_periodo: { ruta: '/ong/asociados', donde: 'Asociados', paso: 3 },

  // Padrón y fichas.
  padron_duplicados: { ruta: '/ong/pacientes', donde: 'Pacientes', paso: 4 },
  ficha_paciente: { ruta: '/ong/pacientes', donde: 'Pacientes', paso: 4 },
  tope_mensual: { ruta: '/ong/pacientes', donde: 'Pacientes', paso: 4 },
  reprocann: { ruta: '/ong/pacientes', donde: 'Pacientes', paso: 4 },
  reprocann_fundadores: { ruta: '/ong/pacientes', donde: 'Pacientes', paso: 4 },
  reprocann_previo_a_la_ong: { ruta: '/ong/pacientes', donde: 'Pacientes', paso: 4 },
  codigo_vinculacion: { ruta: '/ong/pacientes', donde: 'Personas › Pacientes', paso: 1 },

  // Entregas y material.
  dispensa_sin_paciente: { ruta: '/ong/dispensas', donde: 'Dispensas', paso: 5 },
  dispensa_tope: { ruta: '/ong/dispensas', donde: 'Dispensas', paso: 5 },
  entregas_sin_reprocann: { ruta: '/ong/dispensas', donde: 'Dispensas', paso: 5 },
  entregas_sin_cantidad: { ruta: '/ong/dispensas', donde: 'Dispensas', paso: 5 },
  // Se arregla abriendo cada movimiento y declarando QUÉ FUE. No se arregla
  // deduciéndolo: los que quedan son justamente los que los números no alcanzan
  // a decidir, y adivinarlos escribiría una clasificación que nadie declaró.
  movimiento_sin_clasificar: { ruta: '/ong/dispensas', donde: 'Dispensas', paso: 5 },
  aporte: { ruta: '/ong/dispensas', donde: 'Dispensas', paso: 6 },
  aporte_negativo: { ruta: '/ong/dispensas', donde: 'Dispensas', paso: 6 },
  // Se arregla del lado del LOTE, no de la entrega: lo que falta es el material,
  // y corregir la entrega para que apunte a otro lado seria tapar el agujero.
  lote_codigo_huerfano: { ruta: '/ong/portal?vista=catalogo', donde: 'Autodispensación › Catálogo', paso: 5 },
  // Se arregla cargando la cosecha que respalda cada lote, y despues cambiando
  // su origen a `propio`. No se arregla tocando el origen solo.
  origen_sin_trazar: { ruta: '/ong/portal?vista=catalogo', donde: 'Autodispensación › Catálogo', paso: 5 },
  // Ésta SÍ se arregla del lado de la entrega: el material existe y el lote
  // está cargado, lo que falta es decir cuál. Es lo contrario de
  // `lote_codigo_huerfano`, que se arregla del lado del lote.
  entrega_sin_lote: { ruta: '/ong/dispensas', donde: 'Dispensas', paso: 6 },
  // Se arregla en la ficha, cargando la credencial nueva. Pero el arreglo de
  // verdad lo hace la persona renovando el tramite: aca solo se registra.
  credenciales_vencidas: { ruta: '/ong/pacientes', donde: 'Pacientes', paso: 1 },
  // Se arregla abriendo la ficha y cargando la fecha que dice la credencial.
  credencial_sin_fecha: { ruta: '/ong/pacientes', donde: 'Pacientes', paso: 1 },
  // Se arregla moviendo el importe a `aporte_acordado_g` y el analisis a
  // `notas_economicas`, que son plata. No se arregla borrando la nota.
  nota_con_importe: { ruta: '/ong/pacientes', donde: 'Pacientes', paso: 1 },
  modo_beta: { ruta: '/ong/entidad', donde: 'Entidad', paso: 1 },
  lotes_sobregirados: { ruta: '/ong/dispensas', donde: 'Dispensas', paso: 5 },
  // El balance se destraba cargando el lote que falta, no tocando la entrega.
  balance: { ruta: '/ong/cupo', donde: 'Cupo REPROCANN', paso: 5 },
  // Este manda FUERA de la O.N.G.: las plantas se bajan o se pasan de fase en
  // Cultivo, no hay nada que hacer acá.
  plantas: { ruta: '/plantas', donde: 'Cultivo › Plantas', paso: 5 },

  // La plata.
  ordenes_repetidas: { ruta: '/ong/proveedores', donde: 'Proveedores', paso: 6 },
  beneficiarios_grafia: { ruta: '/ong/proveedores', donde: 'Proveedores', paso: 6 },

  // Documentos y trámites.
  ddjj: { ruta: '/ong/declaraciones', donde: 'Declaraciones', paso: 7 },
  cartas_porte: { ruta: '/ong/declaraciones', donde: 'Declaraciones', paso: 7 },
  fechas_futuras: { ruta: '/ong/documentos', donde: 'Documentos', paso: 7 },
}

/**
 * Cuántos días antes se avisa que una credencial se vence.
 *
 * 60 alcanza para renovar sin correr, y no es tan lejos como para que el aviso
 * viva encendido todo el año y deje de leerse.
 */
export const DIAS_AVISO_CREDENCIAL = 60

export interface CredencialesDelPadron {
  /** Fichas activas que tienen fecha de vencimiento cargada. */
  conVencimiento: PacienteCoherencia[]
  vencidas: PacienteCoherencia[]
  /** Vigentes hoy, pero que se caen dentro de `DIAS_AVISO_CREDENCIAL`. */
  porVencer: PacienteCoherencia[]
}

/**
 * El estado de las credenciales REPROCANN del padrón.
 *
 * ⚠ MIRA LA FECHA, NO EL ESTADO GUARDADO. `reprocann_estado` dice «Vigente»
 * hasta que alguien lo cambia a mano, y nadie entra a la ficha el día que se
 * vence. Lo único que sabe la verdad es la fecha.
 *
 * Vive acá y no adentro del cruce porque lo leen DOS lugares: Coherencia y el
 * Panel. Con la cuenta hecha en los dos lados, el día que cambie el criterio
 * —los 60 días, o qué ficha entra— la pantalla de entrada y la de control
 * empiezan a decir cosas distintas sobre la misma persona.
 *
 * `hoy` entra por parámetro para poder probarlo: un test que dependa del reloj
 * pasa hoy y falla en noviembre.
 */
export function credencialesDelPadron(
  padron: PacienteCoherencia[] | undefined,
  hoy: string = new Date().toISOString().slice(0, 10),
): CredencialesDelPadron {
  const conVencimiento = (padron ?? [])
    .filter(p => p.activo !== false && p.reprocann_vencimiento)

  const f = new Date(hoy + 'T00:00:00')
  f.setDate(f.getDate() + DIAS_AVISO_CREDENCIAL)
  const limite = f.toISOString().slice(0, 10)

  return {
    conVencimiento,
    vencidas: conVencimiento.filter(p => String(p.reprocann_vencimiento) < hoy),
    porVencer: conVencimiento.filter(p =>
      String(p.reprocann_vencimiento) >= hoy && String(p.reprocann_vencimiento) <= limite),
  }
}

/**
 * Cuántos días faltan para esa fecha. Negativo si ya pasó.
 *
 * Se compara sobre las fechas en texto convertidas a medianoche local, igual
 * que el resto del módulo: usar `Date.now()` metería la hora del día y un
 * vencimiento de hoy contaría como «hace 0 días» o «en 1», según la hora.
 */
export function diasHasta(fecha: string, hoy: string = new Date().toISOString().slice(0, 10)): number {
  const a = new Date(hoy + 'T00:00:00').getTime()
  const b = new Date(String(fecha).slice(0, 10) + 'T00:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

export function chequeosCoherencia(datos: {
  entidad: Entidad | null
  actas: Acta[]
  libros: Libro[]
  asociados: Asociado[]
  categorias: CategoriaSocio[]
  cuotas: Cuota[]
  pacientes: number
  plantasFloracion: number
  dispensas?: Dispensa[]
  costoPorGramo?: number | null
  gramosCosechados?: number
  /** Lotes cargados: por acá entra el material comprado a terceros. */
  lotes?: LoteIngreso[]
  /** El padrón completo. `pacientes` es sólo el conteo y no alcanza para cruzar. */
  padron?: PacienteCoherencia[]
  /** Los pagos a proveedor, para cruzarlos contra sus asientos de caja. */
  pagosProveedor?: { id: string; proveedor: string; fecha: string; monto: number }[]
  cuotasEmitidas?: CuotaEmitida[]
  /** Desde cuándo cuenta el ciclo. Lo anterior es historia y no se cruza. */
  fechaCorte?: string | null
  periodo?: string
  autoridades?: Autoridad[]
  ddjj?: DDJJ[]
  traslados?: Traslado[]
  /**
   * Todos los nombres de beneficiario que hay cargados, de donde sea que
   * vengan: documentos, lotes, pagos. Van juntos y en crudo a proposito — lo
   * que se busca es el MISMO nombre escrito de dos formas, y eso solo se ve
   * mirando la lista entera.
   */
  beneficiarios?: string[]
  /** Para cruzar ordenes de servicio: numero repetido y fechas imposibles. */
  documentos?: DocumentoONG[]
  /** El libro de caja, para el arqueo por medio de pago. */
  caja?: AsientoCaja[]
}): Chequeo[] {
  const { entidad, actas, libros, asociados, categorias, cuotas, pacientes, plantasFloracion } = datos
  const c: Chequeo[] = []
  const activos = asociados.filter(a => a.activo !== false)

  // 1. Correlatividad de actas.
  const problemas = revisarCorrelatividad(actas)
  c.push(problemas.length === 0
    ? { clave: 'correlatividad', titulo: 'Actas correlativas', estado: actas.length ? 'ok' : 'sin_datos',
        valor: actas.length ? `${actas.length} actas` : 'sin actas',
        detalle: 'Numeración sin huecos ni repetidos, y las fechas acompañan al número.' }
    : { clave: 'correlatividad', titulo: 'Actas correlativas', estado: 'error',
        valor: `${problemas.length} serie${problemas.length === 1 ? '' : 's'} con problemas`,
        detalle: problemas.map(p => {
          const t = TIPOS_ACTA.find(x => x.id === p.tipo)?.nombre ?? p.tipo
          const partes: string[] = []
          if (p.faltantes.length) partes.push(`faltan ${p.faltantes.join(', ')}`)
          if (p.repetidos.length) partes.push(`repetidos ${p.repetidos.join(', ')}`)
          if (p.fueraDeOrden.length) partes.push(`${p.fueraDeOrden.length} fuera de orden cronológico`)
          return `${t}: ${partes.join(' · ')}`
        }).join(' | ') })

  // 2. Cada asociado activo tiene que estar aprobado en un acta.
  const sinActa = activos.filter(a => !a.acta_alta_id && !a.fundador)
  c.push(activos.length === 0
    ? { clave: 'altas_en_acta', titulo: 'Altas respaldadas en acta', estado: 'sin_datos', valor: 'sin asociados', detalle: 'Todavía no cargaste asociados.' }
    : sinActa.length === 0
      ? { clave: 'altas_en_acta', titulo: 'Altas respaldadas en acta', estado: 'ok', valor: `${activos.length}/${activos.length}`,
          detalle: 'Todos los asociados activos tienen su alta aprobada en un acta de Comisión Directiva.' }
      : { clave: 'altas_en_acta', titulo: 'Altas respaldadas en acta', estado: 'error',
          valor: `${sinActa.length} sin acta`,
          detalle: `El alta se aprueba primero en acta de CD y recién después va al Registro de Asociados. Sin acta: ${sinActa.slice(0, 5).map(a => a.nombre).join(', ')}${sinActa.length > 5 ? '…' : ''}.` })

  // 3. Categorías inventadas: las que usa un asociado tienen que existir en el estatuto.
  const nombresCat = new Set(categorias.map(x => x.nombre))
  const inventadas = [...new Set(activos.map(a => a.categoria).filter(x => x && !nombresCat.has(x)) as string[])]
  c.push(categorias.length === 0
    ? { clave: 'categorias', titulo: 'Categorías del estatuto', estado: 'sin_datos', valor: 'sin cargar',
        detalle: 'Cargá las categorías tal como figuran en el estatuto para poder validar contra ellas.' }
    : inventadas.length === 0
      ? { clave: 'categorias', titulo: 'Categorías del estatuto', estado: 'ok', valor: `${categorias.length} categorías`,
          detalle: 'Ningún asociado usa una categoría que no exista en el estatuto.' }
      : { clave: 'categorias', titulo: 'Categorías del estatuto', estado: 'error', valor: `${inventadas.length} inventada${inventadas.length === 1 ? '' : 's'}`,
          detalle: `Estas categorías no están en el estatuto: ${inventadas.join(', ')}. Es uno de los errores que más observan.` })

  // 4. El valor de la cuota tiene que estar aprobado en un acta.
  const cuotaSinActa = cuotas.filter(x => !x.acta_id)
  c.push(cuotas.length === 0
    ? { clave: 'cuota_en_acta', titulo: 'Cuota aprobada en acta', estado: 'sin_datos', valor: 'sin cuota cargada',
        detalle: 'Sin una cuota aprobada en acta no hay forma de probar cuál es la cuota social de la entidad.' }
    : cuotaSinActa.length === 0
      ? { clave: 'cuota_en_acta', titulo: 'Cuota aprobada en acta', estado: 'ok', valor: `${cuotas.length} vigente${cuotas.length === 1 ? '' : 's'}`,
          detalle: 'Cada valor de cuota tiene el acta que lo aprobó.' }
      : { clave: 'cuota_en_acta', titulo: 'Cuota aprobada en acta', estado: 'error', valor: `${cuotaSinActa.length} sin acta`,
          detalle: 'Una reunión informal no alcanza: el valor tiene que estar aprobado por el órgano y pasado al libro.' })

  // 5. Libros rubricados. Sin rúbrica el libro no vale.
  const sinRubrica = libros.filter(l => !l.rubricado)
  c.push(libros.length === 0
    ? { clave: 'rubrica', titulo: 'Libros rubricados', estado: 'sin_datos', valor: 'sin libros cargados', detalle: 'La rúbrica es la autorización del registro para usar el libro.' }
    : sinRubrica.length === 0
      ? { clave: 'rubrica', titulo: 'Libros rubricados', estado: 'ok', valor: `${libros.length}/${libros.length}`, detalle: 'Todos los libros cargados están rubricados.' }
      : { clave: 'rubrica', titulo: 'Libros rubricados', estado: 'error', valor: `${sinRubrica.length} sin rúbrica`,
          detalle: `Un acta pasada a un libro sin rubricar no se inscribe en ningún lado. Falta: ${sinRubrica.map(l => TIPOS_LIBRO.find(t => t.id === l.tipo)?.nombre ?? l.tipo).join(', ')}.` })

  // 6. Libros por encima del 75%: hay que rubricar el siguiente.
  const llenos = libros.filter(l => { const o = ocupacionLibro(l); return o != null && o >= UMBRAL_RUBRICA_NUEVA })
  if (llenos.length) {
    c.push({ clave: 'ocupacion', titulo: 'Libros por reponer', estado: 'alerta', valor: `${llenos.length} sobre el 75%`,
      detalle: `Conviene rubricar el libro siguiente antes de quedarte sin folios: ${llenos.map(l => TIPOS_LIBRO.find(t => t.id === l.tipo)?.nombre ?? l.tipo).join(', ')}.` })
  }

  // 7. Los siete libros obligatorios.
  const faltanLibros = TIPOS_LIBRO.filter(t => !libros.some(l => l.tipo === t.id))
  if (faltanLibros.length) {
    c.push({ clave: 'libros_faltantes', titulo: 'Libros obligatorios', estado: 'alerta',
      valor: `faltan ${faltanLibros.length} de ${TIPOS_LIBRO.length}`,
      detalle: `Sin cargar: ${faltanLibros.map(t => t.nombre).join(', ')}.` })
  }

  // 8. Plantas en floración contra el tope de la 1780.
  const topePlantas = pacientes * (entidad?.plantas_por_paciente ?? 9)
  c.push({
    clave: 'plantas', titulo: 'Plantas en floración vs. tope',
    estado: pacientes === 0 ? 'sin_datos' : plantasFloracion > topePlantas ? 'error' : 'ok',
    valor: `${plantasFloracion} / ${topePlantas}`,
    detalle: pacientes === 0
      ? 'Sin pacientes vinculados no hay plantas habilitadas.'
      : `${entidad?.plantas_por_paciente ?? 9} en floración por paciente vinculado. Las de vegetativo no cuentan.`,
  })

  // 9. Objeto social: el estatuto tiene que declarar el objeto cannábico.
  c.push(entidad?.objeto_cannabis
    ? { clave: 'objeto', titulo: 'Objeto social cannábico', estado: 'ok', valor: 'declarado',
        detalle: 'El estatuto declara el objeto de estudio, investigación y/o uso medicinal del cannabis.' }
    : { clave: 'objeto', titulo: 'Objeto social cannábico', estado: 'error', valor: 'sin declarar',
        detalle: 'Sin objeto cannábico en el estatuto no se puede inscribir la ONG en REPROCANN. Una asociación preexistente se adecúa reformando el estatuto.' })

  // 10. Dispensas: a quién se entregó y si el aporte se pasó del costo.
  const ds = datos.dispensas ?? []
  if (ds.length) {
    const r = resumirDispensas(ds)
    const sinPaciente = ds.filter(d => !d.paciente_id && !esSalidaSinPaciente(d)).length
    const sobreElTope = ds.filter(
      d => unidadDe(d.unidad) === 'g' && d.gramos > TOPE_TRASLADO_INDIVIDUAL_G
        && !d.con_receta && !esSalidaSinPaciente(d))
    const excedidas = sobreElTope.length
    // Las dos mitades piden respaldos distintos, y decir "receta" para todas
    // manda a buscar un papel que a la retribución no le corresponde: quien
    // retira ese material lo cobra por operar el cultivo, no lo consume como
    // paciente.
    const deRetribucion = sobreElTope.filter(d => d.modalidad === MODALIDAD_RETRIBUCION).length
    if (sinPaciente > 0) {
      c.push({ clave: 'dispensa_sin_paciente', titulo: 'Dispensas sin paciente', estado: 'error',
        valor: `${sinPaciente}`, detalle: 'Una dispensa siempre va a una persona identificada y vinculada en REPROCANN.' })
    }
    if (excedidas > 0) {
      c.push({ clave: 'dispensa_tope', titulo: 'Dispensas sobre los 40 g', estado: 'alerta', valor: `${excedidas}`,
        detalle: deRetribucion > 0
          ? `Un traslado individual no puede superar los ${TOPE_TRASLADO_INDIVIDUAL_G} g. `
            + `${excedidas - deRetribucion} ${excedidas - deRetribucion === 1 ? 'es entrega a paciente y necesita' : 'son entregas a pacientes y necesitan'} `
            + `receta que respalde la necesidad medicinal. `
            + `${deRetribucion === 1 ? 'La otra es retribución' : `Las otras ${deRetribucion} son retribución`} `
            + 'en especie: ahí no hace falta receta, sino poder mostrar la documentación del traslado.'
          : `Un traslado individual no puede superar los ${TOPE_TRASLADO_INDIVIDUAL_G} g sin receta que respalde la necesidad medicinal.` })
    }
    // El aporte tiene que cubrir el costo, no superarlo: ahí deja de ser aporte.
    const costo = datos.costoPorGramo ?? null
    if (costo && r.aportePorGramo != null) {
      c.push(r.aportePorGramo > costo * 1.05
        ? { clave: 'aporte', titulo: 'Reembolso vs. costo real', estado: 'error',
            valor: `$${Math.round(r.aportePorGramo).toLocaleString('es-AR')}/g`,
            detalle: `Tu costo real es $${Math.round(costo).toLocaleString('es-AR')}/g. El reembolso cubre costos: por encima del costo real deja de ser reembolso y se parece a una venta.` }
        : { clave: 'aporte', titulo: 'Reembolso vs. costo real', estado: 'ok',
            valor: `$${Math.round(r.aportePorGramo).toLocaleString('es-AR')}/g`,
            detalle: `Por debajo del costo real de $${Math.round(costo).toLocaleString('es-AR')}/g: el reembolso está cubriendo costos, como corresponde.` })
    }
  }

  // 11. Balance de materia: lo que ENTRO tiene que dar cuenta de lo entregado.
  // Entra por dos vias: lo que se cosecho y lo que se compro a terceros. Contar
  // solo lo cosechado marcaba en rojo permanente a cualquier entidad que compre
  // el material, que es exactamente el caso que mas se controla.
  const gCos = datos.gramosCosechados ?? 0
  const lts = datos.lotes ?? []
  if (gCos > 0 || ds.length || lts.length) {
    const b = balanceMateria(gCos, ds, lts)
    const deDonde = b.comprado > 0 && b.cosechado > 0
      ? `${Math.round(b.cosechado)} g cosechados y ${Math.round(b.comprado)} g comprados`
      : b.comprado > 0
        ? `${Math.round(b.comprado)} g comprados a terceros`
        : `${Math.round(b.cosechado)} g cosechados`
    c.push(b.inconsistente
      ? { clave: 'balance', titulo: 'Balance de materia', estado: 'error',
          valor: `faltan ${Math.round(b.dispensado - b.ingresado)} g`,
          detalle: `Dispensaste ${Math.round(b.dispensado)} g pero sólo entraron ${Math.round(b.ingresado)} g (${deDonde}). No se puede entregar material que no ingresó: falta cargar lotes, o hay un error en dispensas.` }
      : { clave: 'balance', titulo: 'Balance de materia', estado: 'ok',
          valor: `${Math.round(b.stock)} g en stock`,
          detalle: `${deDonde}, menos ${Math.round(b.dispensado)} g entregados. Es lo que tenés que poder mostrar si te lo piden.` })
  }

  // 12. El cruce que mas observan: asociados registrados vs ingresos por cuotas.
  const em = datos.cuotasEmitidas ?? []
  if (activos.length > 0) {
    const per = datos.periodo ?? periodoActual()
    const r = resumenCobranza(per, em, asociados)
    c.push(r.emitidas === 0
      ? { clave: 'cuotas_periodo', titulo: 'Cuotas del período', estado: 'alerta',
          valor: `0 de ${r.asociadosActivos}`,
          detalle: `No emitiste las cuotas de ${per}. El cruce entre asociados registrados e ingresos por cuotas es la comparación que más observaciones genera.` }
      : r.sinEmitir > 0
        ? { clave: 'cuotas_periodo', titulo: 'Cuotas del período', estado: 'error',
            valor: `${r.emitidas} de ${r.asociadosActivos}`,
            detalle: `${r.sinEmitir} asociado${r.sinEmitir === 1 ? '' : 's'} activo${r.sinEmitir === 1 ? '' : 's'} sin cuota emitida en ${per}. Si figura como asociado, tiene que tener su cuota.` }
        : { clave: 'cuotas_periodo', titulo: 'Cuotas del período', estado: 'ok',
            valor: `${r.pagadas}/${r.emitidas} cobradas`,
            detalle: `Todos los activos tienen cuota emitida en ${per}. Cobrado ${Math.round(r.montoCobrado).toLocaleString('es-AR')} de ${Math.round(r.montoEmitido).toLocaleString('es-AR')}.` })
  }

  // --- Resolución 1780: incompatibilidades y obligaciones periódicas ---

  const autoridades = datos.autoridades ?? []
  const activas = autoridades.filter(a => a.activo !== false)

  // Parentesco cruzado entre Comisión Directiva y Revisora: está prohibido y es
  // motivo de rechazo de la inscripción.
  const cruces = parentescoCruzado(autoridades)
  c.push(activas.length === 0
    ? { clave: 'parentesco', titulo: 'Parentesco entre órganos', estado: 'sin_datos', valor: 'sin autoridades',
        detalle: 'Cargá las autoridades con su grupo familiar para poder verificarlo.' }
    : cruces.length === 0
      ? { clave: 'parentesco', titulo: 'Parentesco entre órganos', estado: 'ok', valor: 'sin cruces',
          detalle: 'Ningún pariente ocupa cargos en las dos comisiones a la vez. Dentro de una misma comisión sí está permitido.' }
      : { clave: 'parentesco', titulo: 'Parentesco entre órganos', estado: 'error',
          valor: `${cruces.length} cruce${cruces.length === 1 ? '' : 's'}`,
          detalle: cruces.map(x => `${x.directiva.join(', ')} (Directiva) y ${x.revisora.join(', ')} (Revisora)`).join('; ')
            + '. Ningún miembro de la Comisión Directiva puede tener parentesco con uno de la Revisora.' })

  // Antecedentes penales: la 1780 los pide de TODOS los miembros.
  const sinAntecedentes = activas.filter(a => a.antecedentes_penales_ok !== true)
  c.push(activas.length === 0
    ? { clave: 'antecedentes', titulo: 'Antecedentes penales', estado: 'sin_datos', valor: 'sin autoridades',
        detalle: 'Se piden de la Comisión Directiva y de la Revisora de Cuentas.' }
    : sinAntecedentes.length === 0
      ? { clave: 'antecedentes', titulo: 'Antecedentes penales', estado: 'ok', valor: `${activas.length}/${activas.length}`,
          detalle: 'Todos los miembros tienen el certificado sin antecedentes por la ley de estupefacientes.' }
      : { clave: 'antecedentes', titulo: 'Antecedentes penales', estado: 'error', valor: `faltan ${sinAntecedentes.length}`,
          detalle: `Sin certificado: ${sinAntecedentes.map(a => a.nombre).join(', ')}. La 1780 los pide de todos los miembros, no sólo de los directivos.` })

  // REPROCANN de los fundadores, con la exigencia de la jurisdicción.
  const fundadores = activas.filter(a => a.fundador)
  if (fundadores.length > 0) {
    const ex = exigenciaReprocannFundadores(datos.entidad?.jurisdiccion)
    const conRep = fundadores.filter(a => a.reprocann_activo).length
    const min = ex.minimo(fundadores.length)
    c.push(conRep >= min
      ? { clave: 'reprocann_fundadores', titulo: 'REPROCANN de fundadores', estado: 'ok', valor: `${conRep}/${fundadores.length}`,
          detalle: ex.texto }
      : { clave: 'reprocann_fundadores', titulo: 'REPROCANN de fundadores', estado: 'error',
          valor: `${conRep} de ${min} necesarios`, detalle: ex.texto })
  }

  // Declaración jurada del semestre en curso.
  const per = semestreActual()
  const dd = (datos.ddjj ?? []).find(d => d.periodo === per)
  c.push(dd?.presentada
    ? { clave: 'ddjj', titulo: `Declaración jurada ${per}`, estado: 'ok', valor: 'presentada',
        detalle: `Presentada${dd.fecha_presentacion ? ` el ${dd.fecha_presentacion}` : ''}.` }
    : { clave: 'ddjj', titulo: `Declaración jurada ${per}`, estado: dd ? 'alerta' : 'error',
        valor: dd ? 'armada, sin presentar' : 'pendiente',
        detalle: 'Cada seis meses hay que declarar plantas totales y en floración, pacientes vinculados y variedades usadas.' })

  // Cartas de porte de los traslados registrados.
  const tras = datos.traslados ?? []
  if (tras.length > 0) {
    const sinCarta = tras.filter(t => !t.carta_porte_presentada)
    c.push(sinCarta.length === 0
      ? { clave: 'cartas_porte', titulo: 'Cartas de porte', estado: 'ok', valor: `${tras.length}/${tras.length}`,
          detalle: 'Todos los traslados tienen su carta de porte presentada por TAD.' }
      : { clave: 'cartas_porte', titulo: 'Cartas de porte', estado: 'error', valor: `faltan ${sinCarta.length}`,
          detalle: `${sinCarta.length} traslado${sinCarta.length === 1 ? '' : 's'} sin carta de porte. Sin ella el traslado no está amparado.` })
  }

  // 14. Tope mensual por paciente. Sin el, la ventana de 30 dias no valida NADA:
  // `revisarDispensa` saltea el control cuando el tope viene en null, asi que la
  // pantalla no avisa y parece que esta todo bien.
  const pad = datos.padron ?? []
  if (pad.length > 0) {
    const activosPad = pad.filter(p => p.activo !== false)
    const sinTope = activosPad.filter(p => p.tope_mensual_g == null || !(p.tope_mensual_g > 0))
    c.push(sinTope.length === 0
      ? { clave: 'tope_mensual', titulo: 'Tope mensual por paciente', estado: 'ok',
          valor: `${activosPad.length} con tope`,
          detalle: 'Todos los pacientes activos tienen su tope mensual cargado, así que el control de la ventana de 30 días corre en cada entrega.' }
      : { clave: 'tope_mensual', titulo: 'Tope mensual por paciente', estado: 'alerta',
          valor: `${sinTope.length} de ${activosPad.length} sin tope`,
          detalle: `Sin tope cargado, la validación de la ventana de 30 días NO corre para esa persona: se puede entregar de más sin que el sistema avise. No es un valor que el sistema pueda inventar — sale del REPROCANN de cada paciente.` })

    // 15. Padron duplicado. La misma persona con varios codigos rompe todo lo
    // que se cuenta por paciente: el cupo de 30 dias, el consumo y el total de
    // vinculados que se declara.
    const porDni = new Map<string, number>()
    const porTel = new Map<string, number>()
    for (const p of activosPad) {
      const d = (p.dni ?? '').replace(/\D/g, '')
      if (d.length >= 7) porDni.set(d, (porDni.get(d) ?? 0) + 1)
      const t = (p.telefono ?? '').replace(/\D/g, '')
      if (t.length >= 8) porTel.set(t, (porTel.get(t) ?? 0) + 1)
    }
    const dniRep = [...porDni.values()].filter(n2 => n2 > 1).length
    const telRep = [...porTel.values()].filter(n2 => n2 > 1).length
    const sinDni = activosPad.filter(p => !(p.dni ?? '').replace(/\D/g, '')).length

    c.push(sinDni === activosPad.length
      ? { clave: 'padron_duplicados', titulo: 'Padrón sin duplicados', estado: 'sin_datos',
          valor: 'sin DNI cargado',
          detalle: `Ninguno de los ${activosPad.length} pacientes activos tiene DNI. El DNI es lo único que identifica a una persona de forma estable: sin él no se puede saber si el padrón tiene a alguien repetido.` }
      : dniRep === 0 && telRep === 0
        ? { clave: 'padron_duplicados', titulo: 'Padrón sin duplicados', estado: 'ok',
            valor: `${activosPad.length} personas`,
            detalle: 'No hay DNI ni teléfonos repetidos entre los pacientes activos.' }
        : { clave: 'padron_duplicados', titulo: 'Padrón sin duplicados', estado: 'error',
            valor: dniRep > 0 ? `${dniRep} DNI repetido${dniRep === 1 ? '' : 's'}` : `${telRep} teléfono${telRep === 1 ? '' : 's'} repetido${telRep === 1 ? '' : 's'}`,
            detalle: `${dniRep > 0 ? `${dniRep} documento(s) figuran en más de una ficha. ` : ''}` +
              `${telRep > 0 ? `${telRep} teléfono(s) se repiten entre pacientes distintos. ` : ''}` +
              `${sinDni > 0 ? `Además ${sinDni} paciente(s) no tienen DNI, así que puede haber más. ` : ''}` +
              'La misma persona con varias fichas rompe el cupo de 30 días, el consumo por paciente y el total de vinculados que se declara.' })
  }

  // 16. Lotes sobregirados: se entrego mas de lo que entro en ese lote.
  const lts16 = (datos.lotes ?? []).filter(l => l.codigo)
  const ds16 = datos.dispensas ?? []
  if (lts16.length > 0 && ds16.length > 0) {
    // Sale de `saldoDeLotes`, que es la misma cuenta que ve el desplegable de
    // lote al anotar una entrega. Estaba duplicada acá y comparaba el codigo
    // CRUDO, asi que un lote con un espacio de mas no encontraba sus entregas
    // y no podia dar sobregirado nunca.
    const pasados = saldoDeLotes(lts16, ds16)
      .map(x => ({ codigo: x.codigo, de: -x.restante }))
      .filter(x => x.de > 0)
      .sort((a, b) => b.de - a.de)
    const totalDe = pasados.reduce((s2, x) => s2 + x.de, 0)
    c.push(pasados.length === 0
      ? { clave: 'lotes_sobregirados', titulo: 'Lotes sin sobregiro', estado: 'ok',
          valor: `${lts16.length} lotes`,
          detalle: 'Ningún lote entregó más de lo que ingresó.' }
      : { clave: 'lotes_sobregirados', titulo: 'Lotes sin sobregiro', estado: 'error',
          valor: `${pasados.length} lote${pasados.length === 1 ? '' : 's'} · ${Math.round(totalDe)} g de más`,
          detalle: `${pasados.slice(0, 5).map(x => `${x.codigo} (+${Math.round(x.de)} g)`).join(', ')}` +
            `${pasados.length > 5 ? ` y ${pasados.length - 5} más` : ''}. ` +
            'De ese lote salió más de lo que entró: falta cargar un ingreso, o la cantidad de alguna dispensa está mal.' })
  }

  // 17. El mismo beneficiario escrito de dos formas.
  //
  // Aparecio contrastando la hoja Dashboard: su bloque de retiros por socio
  // daba mas que la base, y la diferencia estaba en filas con el nombre en
  // MAYUSCULAS cargadas en la migracion inicial. La planilla los une porque
  // compara ignorando mayusculas; la base los ve como dos personas.
  //
  // Es el mismo problema que los duplicados del padron, en otra columna: un
  // total por beneficiario que se parte en dos no da error en ningun lado,
  // simplemente muestra la mitad.
  const nombres = (datos.beneficiarios ?? [])
    .map(n => (n ?? '').trim())
    .filter(n => n.length > 0 && n !== 'N/A')
  if (nombres.length > 0) {
    const porClave = new Map<string, Set<string>>()
    for (const n of nombres) {
      // Normalizar de mas juntaria gente distinta. Solo se comparan mayusculas
      // y espacios repetidos, que es lo unico que con certeza no distingue a
      // dos personas.
      const clave = n.toLocaleLowerCase('es-AR').replace(/\s+/g, ' ')
      const g = porClave.get(clave)
      if (g) g.add(n)
      else porClave.set(clave, new Set([n]))
    }
    const repetidos = [...porClave.values()]
      .filter(g => g.size > 1)
      .map(g => [...g].sort())
      .sort((a, b) => a[0].localeCompare(b[0], 'es-AR'))

    // Nombres ABREVIADOS: uno es el principio del otro, cortado en una palabra.
    //
    // `validarContraConfiguracion()` del Apps Script encontró "Damian" contra
    // "Socio" en los pagos, y este cruce no los veía: comparaba
    // mayúsculas y acentos, y ahí la diferencia es otra. Se confirmó por la
    // orden de servicio, que nombra al proveedor, así que era la misma persona.
    //
    // Se exige el corte EN UNA PALABRA (`Damian ` y no `Dami`): sin eso
    // "Ana" saldría como abreviatura de "Anabela", que es otra persona.
    //
    // Lo que esto NO alcanza a ver son los errores de tipeo — "Emiio" por
    // "Emiilio", "Socio" por "Facundo Ayala". Para eso hace falta la lista
    // maestra de `Configuracion`, que vive en la planilla y la app no lee.
    const claves = [...porClave.keys()].sort()
    const abreviados: string[][] = []
    for (const corta of claves) {
      for (const larga of claves) {
        if (corta === larga || !larga.startsWith(corta + ' ')) continue
        const a = [...porClave.get(corta)!][0]
        const b = [...porClave.get(larga)!][0]
        abreviados.push([a, b])
      }
    }
    const total = repetidos.length + abreviados.length
    c.push(total === 0
      ? { clave: 'beneficiarios_grafia', titulo: 'Beneficiarios sin repetir', estado: 'ok',
          valor: `${porClave.size} nombre${porClave.size === 1 ? '' : 's'}`,
          detalle: 'Ningún beneficiario está cargado con dos grafías distintas.' }
      : { clave: 'beneficiarios_grafia', titulo: 'Beneficiarios sin repetir', estado: 'alerta',
          valor: `${total} nombre${total === 1 ? '' : 's'} duplicado${total === 1 ? '' : 's'}`,
          detalle: [...repetidos, ...abreviados].slice(0, 4).map(g => g.join(' / ')).join(' · ') +
            `${total > 4 ? ` y ${total - 4} más` : ''}. ` +
            (abreviados.length > 0
              ? 'Hay nombres abreviados (uno es el principio del otro) y grafías distintas. '
              : 'Es la misma persona escrita de dos formas. ') +
            'Cualquier total por beneficiario la va a mostrar partida en dos. Unificar.' })
  }

  // 18. Aportes negativos.
  //
  // Un aporte no puede ser negativo: es plata que ENTRA. Aparecieron dos
  // mirando la hoja FINANZAS, las dos sin medio de pago, y pueden ser una
  // devolucion cargada con signo o un signo mal tipeado. No se corrigen solas
  // porque las dos lecturas dan numeros distintos y solo la asociación sabe cual paso.
  //
  // Va aparte del cruce de reembolso vs costo, que compara el promedio contra
  // el costo real: un negativo ahi se DILUYE en el promedio en vez de saltar.
  const dsNeg = (datos.dispensas ?? []).filter(d => (Number(d.aporte) || 0) < 0)
  if ((datos.dispensas ?? []).length > 0) {
    const totalNeg = dsNeg.reduce((s2, d) => s2 + (Number(d.aporte) || 0), 0)
    c.push(dsNeg.length === 0
      ? { clave: 'aporte_negativo', titulo: 'Aportes sin negativos', estado: 'ok',
          valor: `${(datos.dispensas ?? []).length} entregas`,
          detalle: 'Ninguna entrega tiene un aporte negativo.' }
      : { clave: 'aporte_negativo', titulo: 'Aportes sin negativos', estado: 'error',
          valor: `${dsNeg.length} entrega${dsNeg.length === 1 ? '' : 's'} · $${Math.round(Math.abs(totalNeg)).toLocaleString('es-AR')}`,
          detalle: `${dsNeg.map(d => d.fecha).filter(Boolean).slice(0, 3).join(', ')}` +
            `${dsNeg.length > 3 ? ` y ${dsNeg.length - 3} más` : ''}. ` +
            'Un aporte es plata que entra: no puede ser negativo. O es una ' +
            'devolución que va cargada como tal, o el signo está al revés. ' +
            'Mientras siga así, el total de reembolsos que declarás está mal por ese monto.' })
  }

  // 18 bis-2. Plata escrita en la nota de un paciente.
  //
  // Es un cruce que CUENTA, no que suma, y por eso da cero casi siempre: esa es
  // la gracia. Una nota con un importe adentro no mueve ningún total —la caja
  // no la ve, los reembolsos tampoco— así que ningún otro cruce la puede
  // encontrar. Es la misma familia que `lote_codigo_huerfano`.
  //
  // Salió de un caso real. `notas` la ve todo el que ve el padrón, y dos fichas
  // tenían el historial económico completo de los dos socios de mayor volumen:
  // «$X.XXX.XXX aportados», «$X.XXX.XXX que la asociación absorbió». Al director
  // médico se le había cerrado la caja, los comprobantes y el aporte de las
  // entregas, y esto le entraba igual por un campo de texto. Una restricción que
  // se saltea por el costado no es una restricción.
  //
  // Ahora hay dónde ponerlo —`aporte_acordado_g` y `notas_economicas`, las dos
  // detrás de `puede_ver_plata()`— así que esto avisa cuando alguien vuelve a
  // escribirlo en el lugar equivocado. Sin ese lugar, el cruce sería un reproche.
  const conImporte = (datos.padron ?? []).filter(p => tieneImporte(p.notas))
  if ((datos.padron ?? []).length > 0) {
    c.push(conImporte.length === 0
      ? { clave: 'nota_con_importe', titulo: 'Notas sin plata adentro', estado: 'ok',
          valor: `${(datos.padron ?? []).length} fichas`,
          detalle: 'Ninguna nota de paciente tiene importes escritos en el texto.' }
      : { clave: 'nota_con_importe', titulo: 'Notas sin plata adentro', estado: 'alerta',
          valor: `${conImporte.length} ficha${conImporte.length === 1 ? '' : 's'}`,
          detalle: `${conImporte.map(p => p.codigo || p.nombre_completo).slice(0, 3).join(', ')}` +
            `${conImporte.length > 3 ? ` y ${conImporte.length - 3} más` : ''}. ` +
            'La nota de la ficha la ve todo el que ve el padrón, incluido quien ' +
            'tiene la plata cerrada. Un importe ahí se saltea ese límite sin que ' +
            'nadie se entere. Va en «aporte acordado» y en las notas económicas, ' +
            'que sí son plata.' })
  }

  // 18 ter. Las credenciales que se vencieron, y las que estan por vencerse.
  //
  // Faltaba, y hasta el 27/08/2026 no se notaba: habia 4 credenciales cargadas y
  // ninguna cerca de vencer. Ese dia pasaron a 10, con UNA YA VENCIDA —la del
  // presidente, desde el 05/07— y DOS que vencen el mismo dia.
  //
  // Es la misma leccion que dejaron las entregas en cero: un error que no mueve
  // ningun agregado no lo detecta ningun cruce que SUME. Una credencial que se
  // vence no cambia ningun total —el padron sigue teniendo la misma gente, las
  // mismas plantas habilitadas— asi que hace falta un cruce que las CUENTE.
  //
  // Va aparte de `entregas_sin_reprocann`, que mira lo que ya se entrego. Este
  // mira el padron ANTES de que alguien retire: el vencimiento se puede ver
  // venir, y ese es todo el punto.
  //
  // ⚠ El estado guardado no alcanza: dice «Vigente» hasta que alguien lo
  // cambia a mano, y nadie entra a la ficha el dia que se vence. Lo que manda es
  // la FECHA.
  // La cuenta la hace `credencialesDelPadron`, que tambien usa el Panel: el
  // aviso de la pantalla de entrada y el de la de control tienen que salir del
  // mismo criterio.
  const { conVencimiento: conVenc, vencidas, porVencer } = credencialesDelPadron(datos.padron)
  if (conVenc.length > 0) {
    const nombra = (ps: typeof conVenc) => ps
      .map(p => `${p.nombre_completo ?? 'sin nombre'} (${p.reprocann_vencimiento})`)
      .slice(0, 3).join(', ') + (ps.length > 3 ? ` y ${ps.length - 3} más` : '')

    if (vencidas.length > 0) {
      c.push({ clave: 'credenciales_vencidas', titulo: 'Credenciales al día', estado: 'error',
        valor: `${vencidas.length} vencida${vencidas.length === 1 ? '' : 's'}`,
        detalle: `${nombra(vencidas)}. Mientras esté vencida, lo que se le entregue a esa persona ` +
          'no está amparado por la 27.350, y sus plantas habilitadas no deberían contar para el cupo. ' +
          'La renovación se hace en el mismo lugar que el trámite original.' })
    } else if (porVencer.length > 0) {
      c.push({ clave: 'credenciales_vencidas', titulo: 'Credenciales al día', estado: 'alerta',
        valor: `${porVencer.length} vence${porVencer.length === 1 ? '' : 'n'} en ${DIAS_AVISO_CREDENCIAL} días`,
        detalle: `${nombra(porVencer)}. Todavía están vigentes: es el momento de avisarles, ` +
          'no cuando ya no se les pueda entregar.' })
    } else {
      c.push({ clave: 'credenciales_vencidas', titulo: 'Credenciales al día', estado: 'ok',
        valor: `${conVenc.length} credencial${conVenc.length === 1 ? '' : 'es'}`,
        detalle: `Ninguna vencida ni por vencer en los próximos ${DIAS_AVISO_CREDENCIAL} días.` })
    }
  }

  // 18 ter. Produccion propia que nunca se trazo hasta una cosecha.
  //
  // No es un error de carga: es una DEUDA DE TRAZABILIDAD, y es la que una
  // inspeccion pregunta primero. «Este material es de ustedes, de que planta
  // salio» tiene que tener respuesta, y hoy para estos lotes no la tiene.
  //
  // Se cuenta y no se suma a ningun total: los gramos ya estan contados como
  // ingreso —el material entro y se dispenso— asi que ningun cruce que sume lo
  // ve. Es la misma leccion de las entregas en cero, otra vez.
  //
  // Alerta y no error a proposito. El dato esta declarado con honestidad; lo
  // que falta es completar la cadena hacia atras, y eso lleva tiempo. Un error
  // rojo permanente sobre algo que no se arregla en el dia deja de leerse.
  //
  // Con FECHA DE CORTE desde el 30/08/2026. Antes, los 30 lotes por X.XXX g de
  // la asociación daban una alerta que no se podía apagar nunca: la cosecha de un
  // material que ya se entregó y se consumió no se registra después sin
  // inventar de qué plantas salió. Un aviso que no se puede apagar deja de
  // leerse, y tapa al que sí importa.
  //
  // Ahora se separan los dos: lo anterior al requisito lleva su constancia con
  // la fecha de ESE lote, y lo posterior es una deuda de verdad. Ver
  // `estadoDelOrigen`.
  {
    const sinTrazar = (datos.lotes ?? []).filter(l => l.origen === 'propio_sin_cosecha')
    if (sinTrazar.length > 0) {
      const gramos = (ls: LoteIngreso[]) => ls
        .filter(l => unidadDe(l.unidad) === 'g')
        .reduce((t, l) => t + (Number(l.gramos_totales) || 0), 0)
      const enFalta = sinTrazar.filter(l => estadoDelOrigen(l) === 'falta')
      const previos = sinTrazar.filter(l => estadoDelOrigen(l) === 'anterior_al_requisito')
      const gF = gramos(enFalta)
      const gP = gramos(previos)
      const lote = (n: number) => `${n} lote${n === 1 ? '' : 's'}`
      c.push(enFalta.length > 0
        ? {
          clave: 'origen_sin_trazar', titulo: 'Origen del material propio', estado: 'alerta',
          valor: `${lote(enFalta.length)} sin cosecha`,
          detalle: `${gF.toLocaleString('es-AR')} g de producción propia entraron después del `
            + `${ORIGEN_EXIGIBLE_DESDE} sin una cosecha que los respalde. El material está contado `
            + 'y las entregas cuadran; lo que falta es la cadena hacia atrás: de qué plantas salió. '
            + 'Se completa cargando la cosecha y después cambiando el origen del lote a «Cultivo '
            + `propio».${previos.length > 0 ? ` Otros ${lote(previos.length)} por `
              + `${gP.toLocaleString('es-AR')} g son anteriores al requisito y llevan su constancia.` : ''}`,
        }
        : {
          clave: 'origen_sin_trazar', titulo: 'Origen del material propio', estado: 'ok',
          valor: `${lote(previos.length)} con constancia`,
          detalle: `${gP.toLocaleString('es-AR')} g de producción propia entraron antes del `
            + `${ORIGEN_EXIGIBLE_DESDE}, cuando todavía no se le pedía a cada lote la cosecha que `
            + 'lo respalda, y llevan su constancia con la fecha de cada uno. Desde esa fecha, '
            + 'todo lote propio entró con su cosecha registrada. Quedan pendientes de '
            + 'regularizar: la cosecha de un material que ya se entregó no se puede reconstruir '
            + 'sin inventar de qué plantas salió.',
        })
    }
  }

  // 18 quater. Dice «Vigente» y no hay fecha que lo respalde.
  //
  // ES EL PUNTO CIEGO DEL CRUCE DE ARRIBA. `credenciales_vencidas` mira la
  // FECHA —que es lo correcto, el estado guardado miente— pero por eso mismo no
  // ve nada de lo que no tiene fecha. En la asociación, al 27/08/2026, las 65 fichas
  // que declaran «Vigente» tienen numero de REPROCANN y NINGUNA tiene
  // vencimiento: el cruce de vencidas ni siquiera aparece, y la pantalla se
  // lee como si no hubiera nada que mirar.
  //
  // Una credencial sin fecha no se puede vencer nunca. No es que este vigente:
  // es que no hay forma de saberlo, y a nadie le va a saltar el aviso el dia
  // que caduque.
  //
  // Va como ERROR y no como alerta, al reves que `origen_sin_trazar`. La
  // diferencia es que aca el dato que falta no es historico: es el que decide
  // si lo que se entrega hoy esta amparado por la 27.350. Y se completa
  // mirando la credencial, que la persona tiene.
  {
    const declaranVigente = (datos.padron ?? [])
      .filter(p => p.activo !== false && p.reprocann_estado === 'Vigente')
    const sinFecha = declaranVigente.filter(p => !p.reprocann_vencimiento)
    if (declaranVigente.length > 0) {
      c.push(sinFecha.length === 0
        ? { clave: 'credencial_sin_fecha', titulo: 'Credenciales con fecha', estado: 'ok',
            valor: `${declaranVigente.length} vigente${declaranVigente.length === 1 ? '' : 's'}`,
            detalle: 'Todas las que declaran estar vigentes tienen su fecha de vencimiento cargada, ' +
              'así que el aviso de vencimiento las ve a todas.' }
        : { clave: 'credencial_sin_fecha', titulo: 'Credenciales con fecha', estado: 'error',
            valor: `${sinFecha.length} sin vencimiento`,
            detalle: `${sinFecha.length} de ${declaranVigente.length} fichas dicen «Vigente» y no ` +
              'tienen fecha de vencimiento. Una credencial sin fecha no se puede vencer nunca: no es ' +
              'que esté vigente, es que no hay forma de saberlo, y el aviso de vencimiento no las ve. ' +
              'La fecha está en la credencial de cada persona.' })
    }
  }

  // 18 quinquies. El modo beta esta prendido.
  //
  // Un interruptor que apaga los frenos y no se ve es peor que no tenerlo: se
  // prende un dia para poder cargar datos y queda asi para siempre, y el dia
  // que de verdad hacia falta que algo frenara, no freno.
  //
  // Por eso aparece en Coherencia mientras este prendido, y por eso es alerta y
  // no error: no esta mal usarlo, esta mal olvidarlo.
  if (entidad?.modo_beta) {
    c.push({
      clave: 'modo_beta', titulo: 'Modo beta', estado: 'alerta',
      valor: 'Los bloqueos no frenan',
      detalle: 'El modo beta está prendido: las reglas se siguen calculando y se muestran, ' +
        'pero no impiden avanzar. Sirve para operar mientras faltan los datos de la entidad. ' +
        'Apagalo en «La entidad» cuando estén cargados — mientras esté así, una entrega sin ' +
        'respaldo se puede registrar igual.',
    })
  }

  // 18 bis. La entrega que apunta a un lote que no existe.
  //
  // `ong_dispensas` no guarda `lote_id`: engancha por `lote_codigo`, texto
  // contra texto. Eso hace que el vinculo se pueda romper sin que nada falle —
  // basta con que alguien renombre un lote, o que se borre uno que ya habia
  // entregado. La entrega queda apuntando a un codigo que no existe, el
  // descuento de stock deja de encontrarlo, y el lote figura mas lleno de lo que
  // esta.
  //
  // Hoy da CERO, y esa es exactamente la gracia: es el detector de que la traza
  // se rompio. Sin el, romperla no se nota. El codigo inmutable evita que pase
  // de ahora en adelante; este cruce cubre lo que ya estaba cargado y lo que
  // entre por fuera de la app.
  //
  // Solo mira las entregas que DECLARAN un lote: que no tenga ninguno es otra
  // cosa, y de eso ya se ocupa el balance de materia.
  const conLote = (datos.dispensas ?? []).filter(d => String(d.lote_codigo ?? '').trim() !== '')
  if (conLote.length > 0 && (datos.lotes ?? []).length > 0) {
    const norm = (s: unknown) => String(s ?? '').trim().toUpperCase()
    const existentes = new Set((datos.lotes ?? []).map(l => norm(l.codigo)))
    const huerfanas = conLote.filter(d => !existentes.has(norm(d.lote_codigo)))
    const codigos = [...new Set(huerfanas.map(d => String(d.lote_codigo).trim()))]
    c.push(huerfanas.length === 0
      ? { clave: 'lote_codigo_huerfano', titulo: 'Cada entrega encuentra su lote', estado: 'ok',
          valor: `${conLote.length} entrega${conLote.length === 1 ? '' : 's'}`,
          detalle: 'Todas las entregas apuntan a un lote que existe.' }
      : { clave: 'lote_codigo_huerfano', titulo: 'Cada entrega encuentra su lote', estado: 'error',
          valor: `${huerfanas.length} entrega${huerfanas.length === 1 ? '' : 's'} · ${codigos.length} código${codigos.length === 1 ? '' : 's'}`,
          detalle: `${codigos.slice(0, 3).join(', ')}${codigos.length > 3 ? ` y ${codigos.length - 3} más` : ''}. ` +
            'Esas entregas dicen haber salido de un lote que no está cargado. ' +
            'La entrega se hizo igual, pero el material que salió no se le descuenta a nada: ' +
            'ese lote figura más lleno de lo que está, y el recibo nombra un lote que el sistema no puede mostrar. ' +
            'Suele venir de un lote renombrado o borrado después de haber entregado.' })
  }

  // 18 ter bis. La entrega que no dice de qué lote salió.
  //
  // Es lo que el cruce de arriba deja afuera a propósito: aquél mira las que
  // DECLARAN un lote y no lo encuentran; ésta mira las que no declaran ninguno.
  // El lote es lo que une la entrega con el cultivo, así que sin él la traza se
  // corta justo en el último paso — el único que una inspección puede
  // verificar contra el estante, y el único que sirve si mañana hay que avisarle
  // a alguien.
  //
  // Con FECHA DE CORTE: elegir hoy, entre los lotes que había ese día, uno
  // cualquiera para una entrega de hace un año no es trazarla, es fabricarle un
  // origen. Lo anterior lleva su constancia; lo posterior es deuda. Ver
  // `estadoDelLoteEntregado`.
  {
    const todas = datos.dispensas ?? []
    if (todas.length > 0) {
      const estados = todas.map(d => estadoDelLoteEntregado(d))
      const enFalta = estados.filter(e => e === 'falta').length
      const previas = estados.filter(e => e === 'anterior_al_requisito').length
      const ent = (n: number) => `${n} entrega${n === 1 ? '' : 's'}`
      c.push(enFalta > 0
        ? { clave: 'entrega_sin_lote', titulo: 'Cada entrega dice su lote', estado: 'error',
            valor: `${ent(enFalta)} sin lote`,
            detalle: `${ent(enFalta)} posterior${enFalta === 1 ? '' : 'es'} al `
              + `${LOTE_EXIGIBLE_DESDE} no ${enFalta === 1 ? 'dice' : 'dicen'} de qué lote salió `
              + 'el material. Sin el lote la '
              + 'trazabilidad se corta en el último paso: el material que salió no se le descuenta '
              + 'a nada, y si mañana un lote sale mal no hay a quién avisarle. Se arregla abriendo '
              + `la entrega y eligiendo el lote.${previas > 0 ? ` Otras ${ent(previas)} son `
                + 'anteriores al requisito y llevan su constancia.' : ''}` }
        : previas > 0
          ? { clave: 'entrega_sin_lote', titulo: 'Cada entrega dice su lote', estado: 'ok',
              valor: `${ent(previas)} con constancia`,
              detalle: `${ent(previas)} anterior${previas === 1 ? '' : 'es'} al `
                + `${LOTE_EXIGIBLE_DESDE} no tienen lote, y llevan su constancia con la fecha de `
                + 'cada una. Desde esa fecha, toda entrega salió con su lote declarado. No se les '
                + 'completa hacia atrás: elegir uno de los lotes que había ese día no sería '
                + 'trazarlas, sería fabricarles un origen.' }
          : { clave: 'entrega_sin_lote', titulo: 'Cada entrega dice su lote', estado: 'ok',
              valor: `${ent(todas.length)}`,
              detalle: 'Todas las entregas dicen de qué lote salió el material.' })
    }
  }

  // 19. A quien se le entrego y con que respaldo.
  //
  // Salio de contrastar la hoja REPORTE PACIENTES. Ningun cruce miraba el estado
  // REPROCANN del paciente contra lo que efectivamente se le dio: habia cupo de
  // plantas, tope por persona y dispensas sin paciente, pero nada que dijera
  // cuanto material salio hacia gente sin registro.
  //
  // "En tramite" NO cuenta como problema: es la decision de la asociación —quien tiene
  // numero de registro ya inicio el tramite, y la dispensa no se bloquea
  // mientras tanto. Lo que se marca es "Sin registro", que es otra cosa.
  const padron19 = datos.padron ?? []
  const ds19 = (datos.dispensas ?? []).filter(d => d.paciente_id)
  if (padron19.length > 0 && ds19.length > 0) {
    const estadoDe = new Map(padron19.map(p => [p.id, p]))
    const conRespaldo = (id: string | null | undefined) => {
      const p = id ? estadoDe.get(id) : null
      if (!p) return false
      // El numero es lo que prueba que el tramite existe. El estado solo no
      // alcanza: "En tramite" sin numero no se puede mostrar en una inspeccion.
      return !!(p.reprocann_nro && String(p.reprocann_nro).trim())
    }
    const gramosDe = (d: Dispensa) => unidadDe(d.unidad) === 'g' ? (Number(d.gramos) || 0) : 0
    const sin = ds19.filter(d => !conRespaldo(d.paciente_id))
    const gSin = sin.reduce((s2, d) => s2 + gramosDe(d), 0)
    const gTot = ds19.reduce((s2, d) => s2 + gramosDe(d), 0)
    const personasSin = new Set(sin.map(d => d.paciente_id)).size
    const pct = gTot > 0 ? (gSin / gTot) * 100 : 0
    c.push(sin.length === 0
      ? { clave: 'entregas_sin_reprocann', titulo: 'Entregas con respaldo REPROCANN', estado: 'ok',
          valor: `${ds19.length} entregas`,
          detalle: 'Todas las entregas fueron a personas con número de REPROCANN.' }
      : { clave: 'entregas_sin_reprocann', titulo: 'Entregas con respaldo REPROCANN', estado: 'error',
          valor: `${Math.round(pct)}% · ${Math.round(gSin).toLocaleString('es-AR')} g`,
          detalle: `${sin.length} de ${ds19.length} entregas, a ${personasSin} persona${personasSin === 1 ? '' : 's'} sin número de REPROCANN. ` +
            'Es el número lo que prueba que el trámite existe: sin él, en una ' +
            'inspección esas entregas no se pueden justificar. Quien ya lo inició ' +
            'cuenta, aunque figure en trámite — lo que falta acá es el número.' })
  }

  // ── Los códigos de vinculación que faltan ────────────────────────────────
  //
  // EL CODIGO ES DE CADA PERSONA, NO DE LA ENTIDAD. Lo saca ella en REPROCANN
  // —gratis, en Mi Argentina, y sin depender de nadie— y se lo da a la
  // asociación, que con eso la vincula.
  //
  // Hasta el 02/09/2026 este cruce miraba UN solo código, el de `ong_entidad`, y
  // pedía cargarlo diciendo que era «el que la persona pone en REPROCANN para
  // designarlos». Estaba al revés, y lo corrigió la asociación. El circuito público ya
  // lo contaba bien —el primer paso de `/sumate` es que la persona saque el
  // suyo—, así que el sistema se contradecía consigo mismo: adentro pedía un
  // dato que afuera no existe.
  //
  // Se cuenta sobre los ACTIVOS: una ficha archivada no espera vincularse.
  {
    const padron = (datos.padron ?? []).filter(p => p.activo !== false)
    const sin = padron.filter(p => !(p.codigo_vinculacion ?? '').trim())
    // Sin padrón cargado el cruce no dice nada, en vez de decir «cero» — que se
    // leería como que están todos.
    if (padron.length > 0) {
      c.push(sin.length === 0
        ? { clave: 'codigo_vinculacion', titulo: 'Códigos de vinculación', estado: 'ok',
            valor: `${padron.length} de ${padron.length}`,
            detalle: 'Todas las personas del padrón trajeron su código, así que a todas se las puede vincular.' }
        : { clave: 'codigo_vinculacion', titulo: 'Códigos de vinculación', estado: 'error',
            valor: `faltan ${sin.length} de ${padron.length}`,
            detalle: 'Sin el código de cada persona no se la puede designar como vinculada, y sin esa ' +
              'designación su entrega no queda amparada por la 27.350. Lo saca cada una en ' +
              'Mi Argentina, gratis: se le pide y se carga en su ficha. ' +
              sin.slice(0, 6).map(p => p.nombre_completo ?? 'sin nombre').join(', ') +
              (sin.length > 6 ? ` y ${sin.length - 6} más.` : '.') })
    }
  }

  // ── Quién sacó su REPROCANN antes de que la ONG existiera ──────────────────
  //
  // Salió de un caso real: al 26/08/2026 las cuatro credenciales cargadas en
  // Chaco dicen «Paciente con autocultivo» y ninguna nombra a la asociación. No
  // fue un error de esas personas — las cuatro se emitieron ANTES del 23/07/2026,
  // que es cuando la ONG se inscribió en REPROCANN. Cuando hicieron el trámite,
  // la asociación no estaba para poder elegirla.
  //
  // Esa gente NO tiene que rehacer nada: tiene que MODIFICAR su REPROCANN para
  // designar a la entidad. Es una diferencia que cambia el mensaje que se le
  // manda, y por eso el cruce existe en vez de dejarlo a la vista de nadie.
  if (entidad?.reprocann_inscripcion && (datos.padron?.length ?? 0) > 0) {
    const desde = entidad.reprocann_inscripcion
    const previos = (datos.padron ?? []).filter(p =>
      p.activo !== false && p.reprocann_emision && p.reprocann_emision < desde)
    const fecha = new Date(desde + 'T00:00:00').toLocaleDateString('es-AR')
    c.push(previos.length === 0
      ? { clave: 'reprocann_previo_a_la_ong', titulo: 'REPROCANN posterior a la inscripción',
          estado: 'ok', valor: 'sin casos',
          detalle: `Nadie sacó su credencial antes del ${fecha}, así que todos pudieron elegir a la entidad al tramitarla.` }
      : { clave: 'reprocann_previo_a_la_ong', titulo: 'REPROCANN previo a la inscripción',
          estado: 'error',
          valor: `${previos.length} persona${previos.length === 1 ? '' : 's'}`,
          detalle: `Sacaron su credencial antes del ${fecha}, que es cuando la entidad se inscribió ` +
            'en REPROCANN: al tramitarla no existía la opción de designarla, así que figuran como ' +
            'autocultivo. No tienen que rehacer el trámite, sino MODIFICARLO para designar a la ' +
            'entidad, y traer el código que sale de esa modificación. ' +
            previos.slice(0, 6).map(p => p.nombre_completo ?? 'sin nombre').join(', ') +
            (previos.length > 6 ? ` y ${previos.length - 6} más.` : '.') })
  }

  // 20. La ficha que pide el REPROCANN.
  //
  // El registro no pide solo el numero: pide DNI, la patologia que justifica el
  // uso y el medico que la indico. Sin eso la ficha no se puede presentar,
  // aunque el numero este.
  //
  // Sobre los ACTIVOS, igual que el cruce del tope mensual. Una ficha dada de
  // baja —la duplicada de alguien, por ejemplo— no se presenta a ningun lado, y
  // contarla como incompleta infla el numero con trabajo que no existe. Ojo que
  // `padron19` sin filtrar se sigue usando arriba para resolver el estado de
  // entregas viejas: ahi hacen falta todos, tambien los de baja.
  const activos20 = padron19.filter(p => p.activo !== false)
  if (activos20.length > 0) {
    const falta = (v: unknown) => !(v != null && String(v).trim() !== '')
    const sinDni = activos20.filter(p => falta(p.dni)).length
    const sinPat = activos20.filter(p => falta(p.patologia)).length
    const sinMed = activos20.filter(p => falta(p.medico_tratante)).length
    const completas = activos20.filter(
      p => !falta(p.dni) && !falta(p.patologia) && !falta(p.medico_tratante)).length
    const partes = [
      sinDni > 0 ? `${sinDni} sin DNI` : null,
      sinPat > 0 ? `${sinPat} sin patología` : null,
      sinMed > 0 ? `${sinMed} sin médico tratante` : null,
    ].filter(Boolean)
    c.push(partes.length === 0
      ? { clave: 'ficha_paciente', titulo: 'Ficha del paciente completa', estado: 'ok',
          valor: `${activos20.length} fichas`,
          detalle: 'Todas tienen DNI, patología y médico tratante.' }
      : { clave: 'ficha_paciente', titulo: 'Ficha del paciente completa', estado: 'alerta',
          valor: `${completas} de ${activos20.length}`,
          detalle: `${partes.join(', ')}. ` +
            'El REPROCANN no pide sólo el número: pide el documento, la patología ' +
            'que justifica el uso y el médico que la indicó. Sin eso la ficha no ' +
            'se puede presentar aunque el trámite esté hecho.' })
  }

  // 21. Numero de orden de servicio repetido.
  //
  // Salio de la hoja INGRESOS: hay 124 ordenes y 123 numeros. OS38 figura dos
  // veces, con fechas y montos distintos.
  //
  // Importa porque los pagos se ligan a la orden POR EL NUMERO, que es texto: si
  // el numero esta repetido no se puede saber a cual de las dos se le pago. Hoy
  // no rompe nada porque esa orden tiene cero pagos, pero el saldo que muestra
  // la pantalla de proveedores va a salir mal el dia que le paguen.
  const docs21 = (datos.documentos ?? []).filter(
    d => d.numero != null && String(d.numero).trim() !== '')
  if (docs21.length > 0) {
    const porNumero = new Map<string, number>()
    for (const d of docs21) {
      const n = String(d.numero).trim()
      porNumero.set(n, (porNumero.get(n) ?? 0) + 1)
    }
    const repes = [...porNumero.entries()].filter(([, n]) => n > 1).map(([n]) => n).sort()
    c.push(repes.length === 0
      ? { clave: 'ordenes_repetidas', titulo: 'Órdenes con número único', estado: 'ok',
          valor: `${porNumero.size} órdenes`,
          detalle: 'Ningún número de orden de servicio está usado dos veces.' }
      : { clave: 'ordenes_repetidas', titulo: 'Órdenes con número único', estado: 'alerta',
          valor: repes.slice(0, 3).join(', ') + (repes.length > 3 ? ` y ${repes.length - 3} más` : ''),
          detalle: `${repes.length} número${repes.length === 1 ? '' : 's'} de orden usado${repes.length === 1 ? '' : 's'} más de una vez. ` +
            'Los pagos se ligan a la orden por el número: si está repetido, no se ' +
            'puede saber a cuál se le pagó, y el saldo del proveedor sale mal en ' +
            'cuanto alguna reciba un pago.' })
  }

  // 22. Fechas que todavia no llegaron.
  //
  // OS59 estaba fechada 31/12/2026, cuatro meses adelante. La orden es real —el
  // lote y el importe cierran— pero la fecha no, y una fecha futura ensucia
  // cualquier reporte por periodo sin dar error en ningun lado.
  const hoy22 = new Date().toLocaleDateString('en-CA')
  const futuras: { que: string; n: number }[] = []
  const contarFuturas = (que: string, filas: { fecha?: string | null }[]) => {
    const n = filas.filter(x => x.fecha && x.fecha > hoy22).length
    if (n > 0) futuras.push({ que, n })
  }
  // El registro mensual se fecha al CIERRE del período, no al día que se emite:
  // `emitirRegistrosMensuales` le pone el último día del mes a propósito, para
  // que el documento diga qué período cubre. Emitir el del mes en curso deja
  // entonces una fecha futura que está bien, y marcarla mandaba a buscar un año
  // mal tipeado que no existe.
  contarFuturas('documento(s)',
    (datos.documentos ?? []).filter(d => d.subtipo !== 'Registro mensual'))
  contarFuturas('entrega(s)', datos.dispensas ?? [])
  if ((datos.documentos ?? []).length > 0 || (datos.dispensas ?? []).length > 0) {
    const total22 = futuras.reduce((s2, x) => s2 + x.n, 0)
    c.push(total22 === 0
      ? { clave: 'fechas_futuras', titulo: 'Fechas posibles', estado: 'ok', valor: 'sin fechas futuras',
          detalle: 'Ningún registro está fechado después de hoy.' }
      : { clave: 'fechas_futuras', titulo: 'Fechas posibles', estado: 'alerta',
          valor: `${total22} registro${total22 === 1 ? '' : 's'}`,
          detalle: `${futuras.map(x => `${x.n} ${x.que}`).join(', ')} con fecha posterior a hoy. ` +
            'Algo que todavía no pasó no puede estar cargado: revisá si es un año ' +
            'mal tipeado. Mientras siga así, cualquier total por período lo cuenta ' +
            'donde no va.' })
  }

  // 23. Entregas cobradas sin cantidad.
  //
  // Aparecio conciliando FORM_DISPENSAS contra DISPENSAS: el formulario decia 20
  // y la hoja destino 0. En la base son 133 entregas con aporte > 0 y cantidad
  // 0, por $XX.XXX.XXX, a 25 pacientes y sobre 34 lotes. Una tiene $X.XXX.XXX de
  // aporte y cero gramos.
  //
  // Al aporte por gramo normal eso son ~X.XXX g que salieron y no figuran: un
  // 20% mas de material que el total dispensado registrado.
  //
  // Es la falla mas cara de todas porque rompe CUATRO cruces a la vez sin
  // disparar ninguno: el stock queda alto en el balance de materia, el lote no
  // se descuenta y por eso no aparece sobregirado, el cupo de 30 dias del
  // paciente cuenta de menos, y el consumo declarado por persona es falso.
  //
  // Va aparte de `aporte_negativo`: un aporte negativo es un signo mal puesto y
  // se ve en el total; una cantidad en cero con plata cobrada NO se ve en
  // ningun total, porque sumar cero no cambia nada.
  const ds23 = datos.dispensas ?? []
  if (ds23.length > 0) {
    // SOLO LAS QUE VAN A UNA PERSONA. El consumo interno, la merma y el saldo
    // inicial tambien pueden llevar plata sin gramos, y no son entregas: el
    // saldo inicial son los dos asientos con que arranco la caja del sistema
    // —«MIGRA-CAJA-EF» y «MIGRA-CAJA-TRANSF»— y ahi el cero es correcto.
    //
    // Contandolas, el cruce marcaba seis filas que no entran en su propia
    // definicion: habla del cupo de 30 dias «de esas personas», y ninguna de
    // las seis va a una persona. Un observable que marca lo que esta bien
    // ensena a ignorarlo.
    const sinCant = ds23.filter(d =>
      (Number(d.aporte) || 0) > 0 && !((Number(d.gramos) || 0) > 0)
      && !esSalidaSinPaciente(d))
    const plata = sinCant.reduce((s2, d) => s2 + (Number(d.aporte) || 0), 0)
    // Regla de tres contra las entregas sanas, para dimensionar el faltante.
    const sanas = ds23.filter(
      d => (Number(d.gramos) || 0) > 0 && (Number(d.aporte) || 0) > 0 && unidadDe(d.unidad) === 'g')
    const gSanas = sanas.reduce((s2, d) => s2 + (Number(d.gramos) || 0), 0)
    const aSanas = sanas.reduce((s2, d) => s2 + (Number(d.aporte) || 0), 0)
    const porGramo = gSanas > 0 ? aSanas / gSanas : 0
    const estimado = porGramo > 0 ? Math.round(plata / porGramo) : null
    c.push(sinCant.length === 0
      ? { clave: 'entregas_sin_cantidad', titulo: 'Entregas con cantidad cargada', estado: 'ok',
          valor: `${ds23.length} entregas`,
          detalle: 'Todas las entregas con aporte tienen una cantidad cargada.' }
      : { clave: 'entregas_sin_cantidad', titulo: 'Entregas con cantidad cargada', estado: 'error',
          valor: `${sinCant.length} · $${Math.round(plata).toLocaleString('es-AR')}`,
          detalle: `${sinCant.length} entrega${sinCant.length === 1 ? '' : 's'} con aporte cobrado y cantidad en cero` +
            `${estimado ? `, que al aporte por gramo habitual son unos ${estimado.toLocaleString('es-AR')} g` : ''}. ` +
            'Ese material salió y no figura: el stock queda alto, el lote no se ' +
            'descuenta, y el cupo de esas personas cuenta de menos. Sumar cero no ' +
            'cambia ningún total, así que no lo detecta ningún otro cruce.' })
  }

  // 23 bis. Un movimiento que no dice QUÉ FUE.
  //
  // Es de la misma familia que `entregas_sin_cantidad` y que
  // `lote_codigo_huerfano`: un cruce que CUENTA, porque ningún cruce que suma
  // lo puede encontrar. Estas filas están enteras —tienen fecha, gramos, plata
  // y su asiento de caja— así que la caja cierra, el balance de materia las
  // suma y `resumirDispensas` las cuenta. Lo único que falta es saber qué
  // fueron, y eso no mueve ningún total.
  //
  // Por eso llevaban un año ahí sin que nada avisara: 55 filas al 09/09/2026,
  // la más vieja de agosto de 2025.
  //
  // NO SE DEDUCEN. `tipoDeMovimiento()` ya clasifica lo que los números dicen
  // sin ambigüedad, y las que quedan son justo las que no: 31 tienen gramos y
  // plata pero su `modalidad` dice «Consumo interno», y entre ellas hay cosas
  // que no son entregas de material —dos asientos con que arrancó la caja, un
  // cobro del trámite de REPROCANN, tres ventas de parafernalia—. Marcarlas
  // `entrega` porque los números se parecen a una entrega escribiría una
  // clasificación que nadie declaró, sobre la tabla que sostiene la trazabilidad.
  //
  // `modalidad` tampoco alcanza como autoridad: el valor `retiro` está repartido
  // en seis `tipo_movimiento` distintos y `Retribución en especie` tiene diez
  // filas marcadas `entrega_a_cuenta`. Ya se le pasó por encima a mano.
  const ds23b = datos.dispensas ?? []
  if (ds23b.length > 0) {
    const sinTipo = ds23b.filter(d => !d.tipo_movimiento)
    const gramos = sinTipo.reduce((s2, d) => s2 + (Number(d.gramos) || 0), 0)
    const plata = sinTipo.reduce((s2, d) => s2 + (Number(d.aporte) || 0), 0)
    // El desglose es lo que vuelve accionable la lista: sin él son «42 filas
    // raras» y con él son tres preguntas distintas, cada una para alguien
    // distinto. El grupo más grande —con material y con plata— es el que
    // decide la asociación; los vacíos ya se revisaron y se dejaron así a propósito.
    const conAmbos = sinTipo.filter(d => (Number(d.gramos) || 0) > 0 && (Number(d.aporte) || 0) > 0).length
    const soloPlata = sinTipo.filter(d => !((Number(d.gramos) || 0) > 0) && (Number(d.aporte) || 0) > 0).length
    const vacios = sinTipo.filter(d => !((Number(d.gramos) || 0) > 0) && (Number(d.aporte) || 0) === 0).length
    // EL DESGLOSE TIENE QUE SUMAR EL TOTAL, SIEMPRE. Los tres grupos de arriba
    // no cubren todo: una fila con material y aporte NEGATIVO no cae en ninguno
    // —hay una, del 20/08/2026— y la tarjeta decía «42 sin clasificar» sobre un
    // desglose de 41. Un número que no cierra contra sí mismo en la misma
    // tarjeta enseña a desconfiar del cruce entero, que es lo contrario de para
    // lo que existe. El resto se calcula por diferencia para que no vuelva a
    // pasar al agregar un caso que nadie previó.
    const otros = sinTipo.length - conAmbos - soloPlata - vacios
    const partes = [
      conAmbos > 0 ? `${conAmbos} con material y plata` : '',
      soloPlata > 0 ? `${soloPlata} con plata y sin material` : '',
      vacios > 0 ? `${vacios} sin una cosa ni la otra` : '',
      otros > 0 ? `${otros} con el aporte en negativo` : '',
    ].filter(Boolean).join(', ')
    c.push(sinTipo.length === 0
      ? { clave: 'movimiento_sin_clasificar', titulo: 'Movimientos clasificados', estado: 'ok',
          valor: `${ds23b.length} movimientos`,
          detalle: 'Cada movimiento declara qué fue: entrega, retiro a cuenta, cobro de deuda, consumo interno, merma o ajuste.' }
      : { clave: 'movimiento_sin_clasificar', titulo: 'Movimientos clasificados', estado: 'alerta',
          valor: `${sinTipo.length} sin clasificar`,
          detalle: `${sinTipo.length} movimiento${sinTipo.length === 1 ? '' : 's'} no dice${sinTipo.length === 1 ? '' : 'n'} qué fue` +
            `${partes ? ` (${partes})` : ''}: son ${Math.round(gramos).toLocaleString('es-AR')} g y ` +
            `$${Math.round(plata).toLocaleString('es-AR')}. La plata está en la caja y el material en el ` +
            'balance, así que ningún total lo acusa — lo que falta es saber si cada uno fue una entrega, ' +
            'un consumo interno, una merma o algo que ni siquiera es una salida de material.' })
  }

  // 24. Una caja de efectivo NO puede dar negativo.
  //
  // No es una regla contable: es física. En la caja hay billetes, y no se
  // pueden sacar más de los que entraron. Si el saldo da negativo, lo que falta
  // no es plata: son ASIENTOS DE INGRESO que nadie cargó, o cargó sin decir por
  // qué medio entraron.
  //
  // En la asociación esto apareció el 28/08/2026 y es el caso que le da nombre al
  // cruce. Las trece facturas de luz —$XXX.XXX por mes durante un año— estaban
  // cargadas sin medio de pago. Puestas en efectivo, que es como se pagan, la
  // caja pasó a −$X.XXX.XXX: no porque el dato nuevo estuviera mal, sino porque
  // los cobros que las financiaron están entre los 59 reembolsos cargados como
  // «Mixto», sin decir cuánto entró en mano.
  //
  // El saldo estaba ahí, a la vista, y nadie sabía que era una alarma. Un
  // número imposible que la pantalla muestra como si fuera un dato enseña a no
  // mirarlo.
  //
  // Sólo el EFECTIVO. Una cuenta bancaria puede quedar en descubierto de
  // verdad, así que un negativo ahí puede ser correcto y marcarlo sería un
  // falso positivo de los que enseñan a ignorar el panel.
  const cajaCoh = datos.caja ?? []
  if (cajaCoh.length > 0) {
    const arq = resumenCaja(cajaCoh)
    const pesosCoh = (n: number) => '$' + Math.abs(Math.round(n)).toLocaleString('es-AR')
    c.push(arq.netoEfectivo >= 0
      ? { clave: 'caja_negativa', titulo: 'Caja en efectivo', estado: 'ok',
          valor: pesosCoh(arq.netoEfectivo),
          detalle: 'Entradas menos salidas en efectivo da positivo, que es lo único que puede dar.' }
      : { clave: 'caja_negativa', titulo: 'Caja en efectivo', estado: 'error',
          valor: '−' + pesosCoh(arq.netoEfectivo),
          // EL CRUCE AFIRMABA ALGO FALSO, y eso es peor que no tenerlo.
          //
          // Decía «faltan ingresos en efectivo por cargar». Medido contra la
          // base el 31/08/2026: los aportes de las entregas suman $XX.XXX.XXX y
          // la caja tiene EXACTAMENTE $XX.XXX.XXX en asientos ligados a una
          // entrega, con CERO entregas cobradas sin su asiento. No falta ni un
          // ingreso de dispensa. Quien fuera a buscarlos no iba a encontrar
          // nada, y un control que manda a una búsqueda imposible es un control
          // que se aprende a ignorar.
          //
          // Las dos causas reales son distintas entre sí y se distinguen por el
          // saldo TOTAL, que es el dato que ya estaba a mano:
          //
          //  · Total positivo y efectivo negativo → es un problema de REPARTO.
          //    La plata está, pero pasó del banco a la mano sin que nadie
          //    anotara la extracción. En esta base hay 5 asientos de movimiento
          //    interno por $XXX.XXX contra $10,2 millones de efectivo negativo.
          //
          //  · Total también negativo → no es el reparto: se gastó más de lo que
          //    entró, y ningún asiento de medio de pago va a arreglar eso.
          detalle: arq.neto < 0
            ? `La caja de efectivo da −${pesosCoh(arq.netoEfectivo)} y el saldo TOTAL también está ` +
              `en rojo, en −${pesosCoh(arq.neto)}. O sea que no es cómo se repartió la plata entre ` +
              'efectivo y banco: salió más de lo que entró. Antes de buscar asientos, revisá si falta ' +
              'registrar una fuente de ingreso entera —las cuotas societarias, un aporte, una ' +
              'donación—, porque los aportes de las entregas ya están todos cargados.'
            : `La caja de efectivo da −${pesosCoh(arq.netoEfectivo)} pero el saldo total es ` +
              `${pesosCoh(arq.neto)}: la plata está, lo que falta es el movimiento que la pasó del ` +
              'banco a la mano. Cada vez que se saca efectivo para pagar algo, esa extracción es un ' +
              `asiento${arq.netoOtros !== 0
                ? `. Además hay ${pesosCoh(arq.netoOtros)} sin discriminar`
                : ''}. Mirá el arqueo en Movimientos.` })
  }

  // ENTREGAS CON APORTE QUE NO ESTÁN EN LA CAJA.
  //
  // Hasta el 30/08/2026 el asiento no nacía con la entrega: lo creaba un botón
  // —«Asentar reembolsos»— que había que acordarse de apretar. El botón se fue
  // y el asiento ahora se escribe al guardar, así que esto debería dar cero
  // siempre.
  //
  // El cruce queda igual, y por eso: el botón se podía olvidar en silencio y la
  // pantalla mostraba un saldo incompleto que se leía como completo. Un dato
  // que puede faltar sin avisar necesita algo que avise. Si alguna vez entra
  // una entrega por fuera de la app —una carga directa a la base, una
  // importación— esto lo dice en vez de dejarlo escondido en el saldo.
  const dispCoh = datos.dispensas ?? []
  if (dispCoh.length > 0 && (datos.caja ?? []).length > 0) {
    const asentadas = new Set((datos.caja ?? [])
      .filter(a => a.tipo === 'ingreso' && a.dispensa_id)
      .map(a => a.dispensa_id as string))
    const faltan = dispCoh.filter(d => (Number(d.aporte) || 0) > 0 && !asentadas.has(d.id))
    const plata = faltan.reduce((t, d) => t + (Number(d.aporte) || 0), 0)
    const pesosF = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
    c.push(faltan.length === 0
      ? { clave: 'entregas_sin_asiento', titulo: 'Entregas asentadas en caja', estado: 'ok',
          valor: `${dispCoh.filter(d => (Number(d.aporte) || 0) > 0).length} de ${dispCoh.filter(d => (Number(d.aporte) || 0) > 0).length}`,
          detalle: 'Cada entrega con aporte tiene su ingreso en el libro de caja. El asiento se '
            + 'escribe al registrar la entrega, así que no hay nada que asentar a mano.' }
      : { clave: 'entregas_sin_asiento', titulo: 'Entregas sin asentar en caja', estado: 'error',
          valor: `${faltan.length} · ${pesosF(plata)}`,
          detalle: `Hay ${faltan.length} entrega${faltan.length === 1 ? '' : 's'} con aporte cargado `
            + `que no figura${faltan.length === 1 ? '' : 'n'} en el libro de caja, por ${pesosF(plata)}. `
            + 'El balance sale de ese libro, así que hoy declara menos ingresos de los que hubo. '
            + 'Se arregla abriendo cada entrega y guardándola: al guardar se escribe el asiento.' })
  }

  // ASIENTOS QUE DICEN SER DE UNA ENTREGA Y NO ESTÁN ATADOS A NINGUNA.
  //
  // Medido en la asociación el 30/08/2026: 158 ingresos por $X.XXX.XXX con el concepto
  // «Dispensa a PAC-xxx» y `dispensa_id` en null. Casi siempre de a dos, y ese
  // «de a dos» es la explicación: son el desglose por medio de pago —efectivo
  // tanto, transferencia tanto— de una entrega que ADEMÁS quedó cargada como un
  // total «Mixto». O sea que buena parte de esa plata está contada dos veces.
  //
  // Ejemplo verificado: PAC-XXX del 03/08 tiene una entrega de $XX.XXX con su
  // asiento de $XX.XXX «Mixto», y encima dos sueltos de $XX.XXX y $XX.XXX. La
  // caja cuenta $XXX.XXX por una entrega de $XX.XXX.
  //
  // El cruce NO los arregla y no debe: con dos entregas del mismo paciente el
  // mismo día no hay forma de saber cuál es la dueña de cada pago sin adivinar,
  // y adivinar sobre plata es peor que dejarlo marcado. Lo que hace es sacarlo
  // del saldo —donde estaba invisible, sumando— y ponerlo donde se ve.
  //
  // El desglose que la app carga desde hoy no genera esto: cada medio nace como
  // su propia fila ATADA a la entrega (ver `asientoDeEntrega`).
  //
  // Contaba TRES cosas distintas como si fueran el mismo error, y dos no lo son.
  // El 30/08/2026 marcaba 33 asientos por $X.XXX.XXX cuando lo que de verdad
  // quedaba suelto eran 12 por $XXX.XXX.
  //
  // 1. Los EGRESOS no son huérfanos. Filtraba por concepto y no por tipo, así
  //    que se llevaba puestas las diez reversas. `asientoDeEntrega` no toca un
  //    egreso nunca: una devolución es un movimiento propio.
  //
  // 2. Un ingreso con su REVERSA ESPEJO —mismo día, mismo concepto, mismo
  //    importe, y el egreso dice «REVERSA»— tampoco. Son el par con el que la
  //    planilla reclasifica el medio de pago: un negativo en una columna y el
  //    positivo en la otra, o sea «no fue efectivo, fue transferencia». Suman
  //    cero y mueven la plata de un medio al otro, que es lo que se quería.
  //
  // 3. Lo que SÍ queda es un ingreso que dice ser de una entrega y no tiene
  //    entrega detrás. Hoy son los códigos `CI`, `SAI` y `Merma`, que no son
  //    personas del padrón y por eso no pudieron entrar como dispensa. La plata
  //    es real y entró una sola vez: lo que falta es el papel que diga qué
  //    salió a cambio.
  //
  // El desglose por medio de pago YA NO cae acá: desde el 30/08/2026 cada medio
  // nace como su propia fila ATADA a la entrega (ver `asientoDeEntrega`), y los
  // 158 que venían del importador se corrigieron.
  const caja30 = datos.caja ?? []
  const claveEspejo = (a: AsientoCaja) => `${a.fecha}|${a.concepto}|${Number(a.monto) || 0}`
  const reversas = new Set(caja30
    .filter(a => a.tipo === 'egreso' && typeof a.detalle === 'string' && a.detalle.includes('REVERSA'))
    .map(claveEspejo))
  const cajaHuer = caja30.filter(a =>
    a.tipo === 'ingreso'
    && !a.dispensa_id
    && typeof a.concepto === 'string' && a.concepto.startsWith('Dispensa a')
    && !reversas.has(claveEspejo(a)))
  if (caja30.length > 0) {
    const plataH = cajaHuer.reduce((t, a) => t + (Number(a.monto) || 0), 0)
    const pesosH = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
    const codigos = [...new Set(cajaHuer
      .map(a => (a.concepto ?? '').replace('Dispensa a ', '').trim())
      .filter(Boolean))]
    c.push(cajaHuer.length === 0
      ? { clave: 'asientos_sin_entrega', titulo: 'Asientos con su entrega', estado: 'ok',
          valor: 'todos',
          detalle: 'Cada ingreso que dice ser de una entrega está atado a esa entrega. '
            + 'Borrar la entrega se lleva su plata, y el saldo no cuenta nada suelto.' }
      : { clave: 'asientos_sin_entrega', titulo: 'Ingresos sin su entrega', estado: 'error',
          valor: `${cajaHuer.length} · ${pesosH(plataH)}`,
          detalle: `Hay ${cajaHuer.length} ingreso${cajaHuer.length === 1 ? '' : 's'} por ${pesosH(plataH)} `
            + `a nombre de ${codigos.slice(0, 4).join(', ')}${codigos.length > 4 ? '…' : ''}, `
            + 'que dicen ser de una entrega y no tienen entrega detrás. La plata entró una sola vez '
            + '—no está duplicada—, pero no hay dispensa que diga qué salió a cambio. Si el código no '
            + 'es una persona del padrón, la entrega no se pudo cargar: hay que darle un concepto propio '
            + 'o registrar a quién se le entregó.' })
  }

  // UN PAGO A PROVEEDOR SIN SU ASIENTO DE CAJA.
  //
  // Da cero cuando todo está bien, y ésa es la gracia: es la red del arreglo del
  // 01/09/2026, cuando `registrarPago` guardaba el pago y no escribía nada en la
  // caja. Si el asiento vuelve a fallar —o alguien carga un pago por SQL— la
  // deuda baja y el saldo no se entera, que es exactamente el error que este
  // cruce existe para que no vuelva a pasar en silencio.
  //
  // Sólo mira los pagos ESTRICTAMENTE POSTERIORES al corte, y el `>` en vez del
  // `>=` no es un detalle: es la diferencia entre un control y un falso positivo.
  //
  // Todo lo anterior AL CORTE INCLUIDO ya está absorbido en el saldo de
  // apertura. El 01/09/2026 este cruce marcó un pago de $XX.XXX del 29/08 —el
  // día del corte— y agregarle su asiento, que es lo que el cruce pedía, habría
  // dejado la caja en $XXX.XXX contra los $XXX.XXX que declara el Consolidado.
  // O sea: el control mandaba a romper el número que él mismo debería cuidar.
  //
  // Los 161 pagos anteriores, además, vienen de la planilla y su plata entró por
  // la importación con un match que no es uno a uno. Marcarlos sería un falso
  // positivo permanente, y los falsos positivos son lo que enseña a ignorar el
  // panel entero.
  const pagosCoh = datos.pagosProveedor ?? []
  const cajaCoh2 = datos.caja ?? []
  if (pagosCoh.length > 0 && cajaCoh2.length > 0) {
    const conAsiento = new Set(cajaCoh2.map(a => a.pago_id).filter(Boolean))
    const desde = datos.fechaCorte || ''
    const sueltos = pagosCoh.filter(p => (!desde || p.fecha > desde) && !conAsiento.has(p.id))
    const plataS = sueltos.reduce((t, p) => t + (Number(p.monto) || 0), 0)
    const pesosS = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
    c.push(sueltos.length === 0
      ? { clave: 'pagos_sin_asiento', titulo: 'Pagos con su asiento', estado: 'ok',
          valor: 'todos',
          detalle: 'Cada pago a proveedor descontó de la caja. La deuda y el saldo cuentan lo mismo.' }
      : { clave: 'pagos_sin_asiento', titulo: 'Pagos sin salir de la caja', estado: 'error',
          valor: `${sueltos.length} · ${pesosS(plataS)}`,
          detalle: sueltos.length === 1
            ? `Hay un pago a proveedor por ${pesosS(plataS)} que bajó la deuda y no salió de la caja. `
              + 'El saldo está mostrando plata que ya no está. Cargá el egreso en Movimientos, o borrá '
              + 'el pago y volvé a anotarlo para que se asiente solo.'
            : `Hay ${sueltos.length} pagos a proveedor por ${pesosS(plataS)} que bajaron la deuda y `
              + 'no salieron de la caja. El saldo está mostrando plata que ya no está. Cargá los '
              + 'egresos en Movimientos, o borrá los pagos y volvé a anotarlos para que se asienten solos.' })
  }

  // Primero por gravedad, y dentro de cada gravedad por el orden en que las
  // cosas se habilitan entre sí. Antes ordenaba sólo por gravedad y el panel
  // podía mandarte a redactar un acta antes de cargar el CUIT, con lo cual el
  // acta salía con [CUIT] entre corchetes y había que rehacerla.
  const orden: Record<Chequeo['estado'], number> = { error: 0, alerta: 1, sin_datos: 2, ok: 3 }
  const paso = (x: Chequeo) => DONDE_SE_ARREGLA[x.clave]?.paso ?? 99
  return c.sort((a, b) => orden[a.estado] - orden[b.estado] || paso(a) - paso(b))
}
