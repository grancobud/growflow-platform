// ============================================================================
// Modo DEMO - almacen local (localStorage) que reemplaza a Supabase
// Se activa cuando no hay VITE_SUPABASE_URL configurada (ver supabase.ts).
// Mantiene las mismas tablas del esquema real: geneticas, plantas, eventos,
// cosechas, riegos, aplicaciones, perfiles_usuario.
// ============================================================================

const PREFIJO = 'growflow_demo:'
// Subir esto al cambiar `sembrar()`: quien ya tiene la demo en su localStorage
// no vuelve a sembrar hasta que la version cambia, y sin esto no veria nunca
// los datos nuevos. v19 suma los asientos de caja (pestana Movimientos).
const VERSION_SEED = 'v22'

export type Fila = Record<string, any>

export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function hoyMenos(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}
function isoMenos(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString()
}

// --- acceso crudo a localStorage por tabla ---
export function leerTabla(tabla: string): Fila[] {
  try {
    const raw = localStorage.getItem(PREFIJO + tabla)
    return raw ? (JSON.parse(raw) as Fila[]) : []
  } catch {
    return []
  }
}

export function escribirTabla(tabla: string, filas: Fila[]): void {
  try {
    localStorage.setItem(PREFIJO + tabla, JSON.stringify(filas))
  } catch {
    /* cuota llena: ignorar en demo */
  }
}

// Tablas conocidas del esquema. Una tabla desconocida devuelve [] (degradacion
// con gracia para paginas del CannTrace original que no estan en el router).
export const TABLAS_CONOCIDAS = [
  'geneticas', 'plantas', 'eventos', 'cosechas',
  'riegos', 'aplicaciones', 'perfiles_usuario', 'pacientes',
  'cultivadores', 'jornadas', 'asistencias', 'actividades',
  // Se fueron las cuatro de nutrientes y `insumos_faltantes` el 01/09/2026: sus
  // tablas se borraron de la base junto con los modulos que las leian, que
  // la asociación no tiene. `fichas_comerciales` SI sigue viva y se queda.
  'fichas_comerciales',
  'proveedores_instalacion', 'instalaciones_items', 'presupuestos_instalacion', 'presupuesto_instalacion_items',
  'ofertas_instalacion',
  'ong_visitas',
  // El arqueo de caja y stock (02/09/2026). Sin registrarla acá, el modo demo
  // la ignora: se guarda con toast de éxito y la lista queda vacía.
  'arqueos',
  // El plan de cultivo, lo que se declara en REPROCANN (02/09/2026).
  'planes_cultivo',
  'insumos', 'costos', 'econometria_config', 'mantenimientos', 'recordatorios',
  'ong_entidad', 'ong_autoridades', 'ong_requisitos', 'ong_predios',
  'ong_libros', 'ong_actas', 'ong_asociados', 'ong_categorias_socio', 'ong_cuotas', 'ong_dispensas', 'ong_cuotas_emitidas', 'ong_documentos', 'ong_ddjj', 'ong_traslados', 'ong_feedback_clinico', 'ong_caja',
  'ong_lotes', 'ong_pedidos', 'ong_pagos_proveedor',
  // El legajo institucional: estatuto, acta constitutiva, matricula (03/09/2026).
  // Sin registrarla aca el modo demo la ignora: alta con toast de exito y lista
  // vacia. Ya paso con `arqueos` y con `planes_cultivo`.
  'ong_documentos_institucionales',
  'ong_solicitudes',
  // Vistas: en la base son calculadas; en demo se siembran como una tabla mas,
  // que es como el shim lee todo. Solo se leen, asi que no se desincronizan.
  'v_saldo_proveedores', 'v_saldo_ordenes',
  'ambiente_salas', 'ambiente_lecturas',
  'cultivo_areas', 'cultivo_lotes', 'cultivo_grupos',
]

export const USUARIO_DEMO = {
  id: 'demo-user-0000-0000-0000-000000000000',
  email: 'demo@growflow.local',
}

// --- datos de ejemplo ---
function sembrar(): void {
  // ids de pacientes (se usan tambien en la tabla pacientes mas abajo)
  const pacJuan = uuid(), pacMaria = uuid(), pacCarlos = uuid()

  // === Cultivo de ejemplo ===
  // Las geneticas entran solo con el nombre; los demas campos quedan vacios para
  // completarlos desde "Editar ficha".
  // Variedades de ejemplo: nombres comerciales conocidos, a proposito. El seed
  // es una demo publica, no el cultivo de nadie.
  const GENETICAS_REALES = ['Northern Lights', 'White Widow', 'Amnesia Haze', 'Blue Dream', 'Critical Kush', 'Sour Diesel', 'Gelato', 'Purple Punch']
  type PR = { apodo: string; slot: string | null; genetica: string; riegos: string[] }
  // Plantas de ejemplo para el modo demo. Los datos reales de cada instalacion
  // viven en su propia base, no en el repo.
  const PLANTAS_REALES: PR[] = [
    { apodo: '#1', slot: 'c1-0', genetica: 'Northern Lights', riegos: [] },
    { apodo: '#2', slot: 'c1-1', genetica: 'White Widow', riegos: [] },
    { apodo: '#3', slot: 'c1-2', genetica: 'Amnesia Haze', riegos: ['2026-06-12'] },
    { apodo: '#4', slot: 'c2-0', genetica: 'Blue Dream', riegos: [] },
    { apodo: '#5', slot: 'c2-1', genetica: 'Critical Kush', riegos: [] },
    { apodo: '#6', slot: 'c2-2', genetica: 'Sour Diesel', riegos: ['2026-06-12'] },
    { apodo: '#7', slot: 'c3-0', genetica: 'Gelato', riegos: [] },
    { apodo: '#8', slot: 'c3-1', genetica: 'Purple Punch', riegos: [] },
    { apodo: '#9', slot: 'c3-2', genetica: 'Northern Lights', riegos: ['2026-06-12'] },
    { apodo: '#10', slot: 'c4-0', genetica: 'White Widow', riegos: [] },
    { apodo: '#11', slot: 'c4-1', genetica: 'Amnesia Haze', riegos: [] },
    { apodo: '#12', slot: 'c4-2', genetica: 'Blue Dream', riegos: ['2026-06-12'] },
  ]

  // geneticas: una fila por nombre, con ficha enriquecida si la tenemos
  const genId = new Map<string, string>()
  // 5 genéticas automáticas en la demo; el resto feminizadas (para mostrar el chip Auto/Fem).
  const AUTOS = new Set(['Critical Kush', 'Gelato', 'Purple Punch'])
  const geneticas: Fila[] = GENETICAS_REALES.map((nombre, i) => {
    const id = uuid(); genId.set(nombre, id)
    return {
      id, nombre, banco: null, tipo: AUTOS.has(nombre) ? 'Automatica' : 'Feminizada',
      thc_estimado: null, cbd_estimado: null, tiempo_flora_dias: null, notas: null,
      creado_en: isoMenos(120 - i),
    }
  })

  // abreviatura para el codigo de trazabilidad
  const abbr = (n: string) => (n.normalize('NFD').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'GF')
  // Asignacion de algunas plantas a pacientes (para la demo del Registro)
  const asignar: Record<string, string> = { '#1': pacJuan, '#2': pacMaria, '#10': pacCarlos, '#3': pacJuan }
  // Las plantas con riego van al final: ganan el slot en caso de superposicion (se ven regadas en la Sala)
  const ordenadas = [...PLANTAS_REALES].sort((a, b) => a.riegos.length - b.riegos.length)
  const plantaId = new Map<string, string>()
  const plantas: Fila[] = ordenadas.map((p, i) => {
    const id = uuid(); plantaId.set(p.apodo, id)
    return {
      id, codigo: `${abbr(p.genetica)}-${String(i + 1).padStart(3, '0')}`,
      genetica_id: genId.get(p.genetica) ?? null, madre_id: null,
      paciente_id: asignar[p.apodo] ?? null, apodo: p.apodo,
      fecha_germinacion: hoyMenos(40), fase: 'Vegetativo',
      sustrato: 'Coco Mix', maceta: '7L', ubicacion: null, slot: p.slot,
      activa: true, notas: null, creado_en: isoMenos(40 - (i % 10)), actualizado_en: isoMenos(2),
    }
  })

  // eventos + riegos detallados a partir de los riegos reales
  const eventos: Fila[] = []
  const riegos: Fila[] = []
  for (const p of PLANTAS_REALES) {
    const pid = plantaId.get(p.apodo)
    if (!pid) continue
    for (const f of p.riegos) {
      eventos.push({ id: uuid(), planta_id: pid, tipo: 'Riego', fecha: f, detalle: 'Riego', foto_url: null, mensaje_original: 'import', creado_en: `${f}T12:00:00.000Z` })
      riegos.push({ id: uuid(), planta_id: pid, fecha: f, volumen_ml: 1500, ec: 1.6, ppm: 800, ppm_factor: 500, ph: 6.0, escurrio: false, escurrido_ml: null, notas: null, creado_en: `${f}T12:00:00.000Z` })
    }
  }
  // algunos eventos extra de ejemplo en las plantas con historial
  const evExtra = (apodo: string, tipo: string, dias: number, detalle: string | null) => {
    const pid = plantaId.get(apodo)
    if (pid) eventos.push({ id: uuid(), planta_id: pid, tipo, fecha: hoyMenos(dias), detalle, foto_url: null, mensaje_original: null, creado_en: isoMenos(dias) })
  }
  evExtra('#1', 'Fertilizacion', 5, 'Base A+B + PK.'); evExtra('#1', 'Poda', 12, 'Defoliacion ligera.')
  evExtra('#2', 'Entrenamiento', 10, 'LST con tutores.')
  evExtra('#10', 'Nota', 8, 'Hojas levemente caidas, ajusto riego.')

  // planta cosechada (inactiva, no aparece en la Sala) para estadisticas
  const pCosechada = uuid()
  plantas.push({ id: pCosechada, codigo: 'NL-000', genetica_id: genId.get('Northern Lights') ?? null, madre_id: null, paciente_id: pacMaria, apodo: 'NL #0 (cosechada)', fecha_germinacion: hoyMenos(140), fecha_cosecha: hoyMenos(25), fecha_envasado: hoyMenos(5), fase: 'Cosechada', sustrato: 'Coco Mix', maceta: '11L', ubicacion: null, slot: null, activa: false, notas: 'Cultivo anterior.', creado_en: isoMenos(140), actualizado_en: isoMenos(20) })
  const cosechas: Fila[] = [
    { id: uuid(), planta_id: pCosechada, fecha: hoyMenos(20), peso_humedo_g: 320, peso_seco_g: 78, notas_curado: 'Curado 3 semanas en frascos.', notas_sabor: 'Terroso, dulce.', valoracion: 8, creado_en: isoMenos(20) },
  ]

  // aplicaciones de ejemplo
  const aplicaciones: Fila[] = []
  const apExtra = (apodo: string, dias: number, categoria: string, producto: string, dosis: string) => {
    const pid = plantaId.get(apodo)
    if (pid) aplicaciones.push({ id: uuid(), planta_id: pid, fecha: hoyMenos(dias), categoria, producto, dosis, metodo: 'Aspersion', notas: null, creado_en: isoMenos(dias) })
  }
  apExtra('#2', 7, 'Foliar', 'Aminoacidos', '2 ml/L')
  apExtra('#10', 9, 'Fungicida', 'Aceite de neem', '5 ml/L')

  const perfiles_usuario: Fila[] = [
    { id: USUARIO_DEMO.id, nombre_completo: 'Cultivador Demo', rol: 'administrador', activo: true, ultimo_acceso: new Date().toISOString() },
  ]

  // pacientes REPROCANN de ejemplo (uno vigente, uno por vencer, uno en tramite)
  const pacientes: Fila[] = [
    { id: pacJuan, codigo: 'PAC-XXX', nombre_completo: 'Juan Pérez', dni: '30.123.456', fecha_nacimiento: '1988-04-12', telefono: '11 5555-1234', email: 'juan.perez@mail.com', localidad: 'La Plata', provincia: 'Buenos Aires', domicilio: 'Calle 50 N° 1234', foto_url: null, reprocann_nro: 'RPC-100245', codigo_vinculacion: 'VIN-100245', reprocann_estado: 'Vigente', reprocann_emision: hoyMenos(120), reprocann_vencimiento: hoyMenos(-240), modalidad: 'Cultivo solidario', credencial_url: null, patologia: 'Dolor crónico', medico_tratante: 'Dra. Gómez', matricula_medico: 'MP 45678', plantas_habilitadas: 9, m2_habilitados: 4, socio: true, fecha_alta: hoyMenos(110), activo: true, notas: null, creado_en: isoMenos(110) },
    { id: pacMaria, codigo: 'PAC-XXX', nombre_completo: 'María López', dni: '27.987.654', fecha_nacimiento: '1979-09-30', telefono: '11 4444-9876', email: 'maria.lopez@mail.com', localidad: 'CABA', provincia: 'CABA', domicilio: 'Av. Rivadavia 5000', foto_url: null, reprocann_nro: 'RPC-098123', codigo_vinculacion: 'VIN-098123', reprocann_estado: 'Vigente', reprocann_emision: hoyMenos(340), reprocann_vencimiento: hoyMenos(-20), modalidad: 'Cultivo solidario', credencial_url: null, patologia: 'Insomnio · Ansiedad', medico_tratante: 'Dr. Fernández', matricula_medico: 'MN 12345', plantas_habilitadas: 9, m2_habilitados: 6, socio: true, fecha_alta: hoyMenos(330), activo: true, notas: 'Credencial próxima a vencer.', creado_en: isoMenos(330) },
    { id: pacCarlos, codigo: 'PAC-XXX', nombre_completo: 'Carlos Ruiz', dni: '35.222.111', fecha_nacimiento: '1992-01-15', telefono: '221 333-2211', email: null, localidad: 'Berisso', provincia: 'Buenos Aires', domicilio: null, foto_url: null, reprocann_nro: null, reprocann_estado: 'En tramite', reprocann_emision: null, reprocann_vencimiento: null, modalidad: 'Cultivo propio', credencial_url: null, patologia: 'Epilepsia', medico_tratante: null, matricula_medico: null, plantas_habilitadas: null, m2_habilitados: null, socio: true, fecha_alta: hoyMenos(15), activo: true, notas: 'Esperando aprobación de REPROCANN.', creado_en: isoMenos(15) },
  ]

  // growers (roster del equipo de cultivo)
  const cAna = uuid(), cBeto = uuid(), cClara = uuid()
  const cultivadores: Fila[] = [
    { id: cAna, nombre: 'Ana Torres', rol: 'Responsable', telefono: '11 6000-1111', activo: true, creado_en: isoMenos(200) },
    { id: cBeto, nombre: 'Beto Sosa', rol: 'Cultivador', telefono: '11 6000-2222', activo: true, creado_en: isoMenos(180) },
    { id: cClara, nombre: 'Clara Díaz', rol: 'Voluntario', telefono: null, activo: true, creado_en: isoMenos(60) },
  ]

  // jornadas con asistencia y bitacora
  const j1 = uuid(), j2 = uuid()
  const jornadas: Fila[] = [
    { id: j1, fecha: hoyMenos(1), responsable: 'Ana Torres', clima: 'Soleado 26°C', resumen: 'Riego general y poda de las plantas en flora.', notas: null, creado_en: isoMenos(1) },
    { id: j2, fecha: hoyMenos(4), responsable: 'Beto Sosa', clima: 'Nublado 19°C', resumen: 'Trasplante de esquejes y limpieza de carpa 2.', notas: null, creado_en: isoMenos(4) },
  ]
  const asistencias: Fila[] = [
    { id: uuid(), jornada_id: j1, cultivador_id: cAna, presente: true, hora_entrada: '09:00', hora_salida: '13:00', notas: null, creado_en: isoMenos(1) },
    { id: uuid(), jornada_id: j1, cultivador_id: cBeto, presente: true, hora_entrada: '09:30', hora_salida: '12:30', notas: null, creado_en: isoMenos(1) },
    { id: uuid(), jornada_id: j1, cultivador_id: cClara, presente: false, hora_entrada: null, hora_salida: null, notas: null, creado_en: isoMenos(1) },
    { id: uuid(), jornada_id: j2, cultivador_id: cAna, presente: false, hora_entrada: null, hora_salida: null, notas: null, creado_en: isoMenos(4) },
    { id: uuid(), jornada_id: j2, cultivador_id: cBeto, presente: true, hora_entrada: '10:00', hora_salida: '14:00', notas: null, creado_en: isoMenos(4) },
  ]
  const actividades: Fila[] = [
    { id: uuid(), jornada_id: j1, hora: '09:15', tipo: 'Riego', descripcion: 'Riego con nutrientes de flora a las 4 plantas.', cultivador_id: cAna, creado_en: isoMenos(1) },
    { id: uuid(), jornada_id: j1, hora: '10:30', tipo: 'Poda', descripcion: 'Defoliación de NL #1.', cultivador_id: cBeto, creado_en: isoMenos(1) },
    { id: uuid(), jornada_id: j2, hora: '10:30', tipo: 'Trasplante', descripcion: 'Esquejes pasados a macetas de 1L.', cultivador_id: cBeto, creado_en: isoMenos(4) },
    { id: uuid(), jornada_id: j2, hora: '12:00', tipo: 'Limpieza', descripcion: 'Limpieza general de carpa 2.', cultivador_id: cBeto, creado_en: isoMenos(4) },
  ]

  // --- Cultivo: un lote con dos grupos (B1) y un evento de grupo (B2) ---
  // Reproduce el caso real de la asociación: una corrida partida en dos para comparar
  // sustratos. Sin esto el grupo vivia en el prefijo del apodo y un evento que
  // aplicaba a varias plantas no tenia donde ir.
  const loteCultivo = uuid(), grupoA = uuid(), grupoB = uuid()
  escribirTabla('cultivo_lotes', [
    { id: loteCultivo, nombre: 'Corrida de ejemplo', fecha_germinacion: hoyMenos(40),
      genetica_id: genId.get('Northern Lights') ?? null, area_id: null,
      notas: 'Dos sustratos en paralelo, misma genetica y misma fecha.',
      activo: true, creado_en: isoMenos(40) },
  ])
  escribirTabla('cultivo_grupos', [
    { id: grupoA, lote_id: loteCultivo, nombre: 'Grupo A', sustrato: 'Coco + perlita',
      maceta: '5 L', variable: 'Sustrato inerte con fertirriego', notas: null, orden: 0,
      creado_en: isoMenos(40) },
    { id: grupoB, lote_id: loteCultivo, nombre: 'Grupo B', sustrato: 'Organico',
      maceta: '7 L', variable: 'Sustrato vivo, sin fertirriego', notas: null, orden: 1,
      creado_en: isoMenos(40) },
  ])
  // Las primeras seis al A, las otras al B.
  plantas.forEach((p, i) => { p.grupo_id = i < 6 ? grupoA : grupoB })
  // B2: un evento de LOTE y uno de GRUPO. Una fila cada uno, y se ven en la
  // linea de tiempo de todas las plantas que alcanzan.
  eventos.push(
    { id: uuid(), planta_id: null, grupo_id: null, lote_id: loteCultivo, tipo: 'Nota',
      fecha: hoyMenos(40), detalle: 'Siembra de la corrida: 12 plantas, misma genetica.',
      foto_url: null, mensaje_original: null, creado_en: isoMenos(40) },
    { id: uuid(), planta_id: null, grupo_id: grupoA, lote_id: null, tipo: 'Riego',
      fecha: hoyMenos(3), detalle: 'Fertirriego al grupo entero · 2000ml · EC 1.4 · pH 6.1',
      foto_url: null, mensaje_original: null, creado_en: isoMenos(3) },
  )

  escribirTabla('geneticas', geneticas)
  escribirTabla('plantas', plantas)
  escribirTabla('eventos', eventos)
  escribirTabla('cosechas', cosechas)
  escribirTabla('riegos', riegos)
  escribirTabla('aplicaciones', aplicaciones)
  escribirTabla('perfiles_usuario', perfiles_usuario)
  escribirTabla('pacientes', pacientes)
  escribirTabla('cultivadores', cultivadores)
  escribirTabla('jornadas', jornadas)
  escribirTabla('asistencias', asistencias)
  escribirTabla('actividades', actividades)

  // --- ONG: lotes y dispensas ---
  // La pantalla de Dispensas y el catalogo del Portal quedaban vacios en demo,
  // y son justo las dos que rompian cuando el material no sale del cultivo
  // propio. El seed reproduce ese caso a proposito: 78 g cosechados (la unica
  // cosecha de arriba) contra 190 g comprados, y 152 g dispensados. Contando
  // solo lo cosechado el balance daba "faltan 74 g"; contando el ingreso real
  // da 116 g en stock, que es lo correcto.
  const loteCompradoA = uuid(), loteCompradoB = uuid(), lotePropio = uuid(), loteAceite = uuid()
  escribirTabla('ong_lotes', [
    { id: loteCompradoA, codigo: 'LOT-2601', producto: 'flor', genetica_id: genId.get('Northern Lights') ?? null,
      cosecha_id: null, gramos_totales: 120, fecha_elaboracion: hoyMenos(60),
      thc_pct: 18.4, cbd_pct: 0.6, laboratorio: 'Lab. ejemplo', fecha_analisis: hoyMenos(55),
      analisis_path: null, aporte_por_gramo: 3200, origen: 'comprado', costo_por_gramo: 2100,
      proveedor: 'Proveedor de ejemplo S.A.', activo: true, notas: null, creado_en: isoMenos(60) },
    { id: loteCompradoB, codigo: 'LOT-2602', producto: 'flor', genetica_id: null,
      cosecha_id: null, gramos_totales: 70, fecha_elaboracion: hoyMenos(30),
      thc_pct: null, cbd_pct: null, laboratorio: null, fecha_analisis: null,
      analisis_path: null, aporte_por_gramo: 3400, origen: 'comprado', costo_por_gramo: null,
      proveedor: 'Proveedor de ejemplo S.A.', activo: true, notas: null, creado_en: isoMenos(30) },
    { id: lotePropio, codigo: 'LOT-2603', producto: 'flor', genetica_id: genId.get('Northern Lights') ?? null,
      cosecha_id: cosechas[0]?.id ?? null, gramos_totales: 78, fecha_elaboracion: hoyMenos(18),
      thc_pct: 16.2, cbd_pct: 0.4, laboratorio: 'Lab. ejemplo', fecha_analisis: hoyMenos(15),
      analisis_path: null, aporte_por_gramo: 2600, origen: 'propio', costo_por_gramo: 1450,
      proveedor: null, activo: true, notas: 'Sale de la cosecha de NL #0.', creado_en: isoMenos(18) },
    // Un lote que NO se mide en gramos: es lo que hace visible el arreglo de A3.
    // Sin `unidad`, estos 6 frascos entraban al balance como si fueran 6 gramos.
    { id: loteAceite, codigo: 'LOT-2604', producto: 'Aceite de Cannabis', genetica_id: null,
      cosecha_id: null, gramos_totales: 6, fecha_elaboracion: hoyMenos(25),
      thc_pct: null, cbd_pct: null, laboratorio: null, fecha_analisis: null,
      analisis_path: null, aporte_por_gramo: 42000, origen: 'comprado', costo_por_gramo: 27000,
      proveedor: 'Proveedor de ejemplo S.A.', unidad: 'u', activo: true,
      notas: 'Frascos de 10 ml.', creado_en: isoMenos(25) },
  ])

  const dispensasDemo: Fila[] = []
  const dispensa = (dias: number, pac: string, lote: string, g: number, aporte: number, medio: string) =>
    dispensasDemo.push({ id: uuid(), paciente_id: pac, fecha: hoyMenos(dias), producto: 'flor',
      genetica_id: null, gramos: g, aporte, modalidad: 'Paciente', entregado_por: 'Ana',
      con_receta: true, recibo_numero: dispensasDemo.length + 1, medio_pago: medio,
      pago_referencia: null, lote_codigo: lote, notas: null, creado_en: isoMenos(dias) })
  dispensa(50, pacJuan,   'LOT-2601', 30, 96000,  'Efectivo')
  dispensa(44, pacMaria,  'LOT-2601', 25, 80000,  'Transferencia')
  dispensa(37, pacCarlos, 'LOT-2601', 20, 64000,  'Efectivo')
  dispensa(26, pacJuan,   'LOT-2602', 25, 85000,  'Transferencia')
  dispensa(19, pacMaria,  'LOT-2602', 15, 51000,  'Efectivo')
  dispensa(12, pacCarlos, 'LOT-2603', 22, 57200,  'Transferencia')
  dispensa(5,  pacJuan,   'LOT-2603', 15, 39000,  'Efectivo')
  // Dos frascos: entran a la lista pero NO al balance de materia vegetal.
  dispensasDemo.push({ id: uuid(), paciente_id: pacMaria, fecha: hoyMenos(8), producto: 'Aceite de Cannabis',
    genetica_id: null, gramos: 2, aporte: 84000, modalidad: 'Paciente', entregado_por: 'Ana',
    con_receta: true, recibo_numero: dispensasDemo.length + 1, medio_pago: 'Transferencia',
    pago_referencia: null, lote_codigo: 'LOT-2604', unidad: 'u', notas: null, creado_en: isoMenos(8) })
  escribirTabla('ong_dispensas', dispensasDemo)

  // --- Caja: un asiento por cada entrega, mas gastos ---
  // La tabla tenia 1.690 filas en la base real y NINGUNA pantalla que las
  // mostrara. En demo estaba directamente vacia, asi que la pestana Movimientos
  // no se podia ver. Los ingresos salen de las mismas dispensas de arriba: es lo
  // que hace el portal al entregar.
  const cajaDemo: Fila[] = dispensasDemo.map(d => ({
    id: uuid(), fecha: d.fecha, tipo: 'ingreso',
    concepto: 'Reembolso de costos',
    detalle: `Entrega ${d.lote_codigo}`,
    monto: d.aporte, medio: d.medio_pago,
    dispensa_id: d.id, cuota_id: null, documento_id: null, notas: null,
    creado_en: d.creado_en,
  }))
  const egreso = (dias: number, concepto: string, monto: number, medio: string, detalle: string) =>
    cajaDemo.push({ id: uuid(), fecha: hoyMenos(dias), tipo: 'egreso', concepto,
      detalle, monto, medio, dispensa_id: null, cuota_id: null, documento_id: null,
      notas: null, creado_en: isoMenos(dias) })
  egreso(0, 'Pago a proveedor', 120000, 'Transferencia', 'A cuenta de OS-101')
  egreso(0, 'Gasto operativo', 18500, 'Efectivo', 'Insumos de limpieza')
  egreso(6, 'Retribucion', 90000, 'Transferencia', 'Retiro del mes')
  egreso(21, 'Gasto operativo', 47000, 'Efectivo', 'Sustrato')
  // Un ingreso de hoy, para que el atajo "Hoy" tenga algo que mostrar.
  cajaDemo.push({ id: uuid(), fecha: hoyMenos(0), tipo: 'ingreso', concepto: 'Reembolso de costos',
    detalle: 'Entrega de mostrador', monto: 45000, medio: 'Efectivo',
    dispensa_id: null, cuota_id: null, documento_id: null, notas: null, creado_en: isoMenos(0) })
  escribirTabla('ong_caja', cajaDemo)


  // --- ONG: la capa institucional, para que los papeles salgan completos ---
  //
  // Estaba todo esto vacio, y por eso la demo no servia para mostrar el
  // circuito: sin entidad no hay CUIT, y sin CUIT cada recibo, cada acta y la
  // declaracion jurada salen con [CUIT] entre corchetes. Se veian las entregas
  // pero no el papel que las respalda, que es justo lo que hay que mostrar.
  //
  // Son datos INVENTADOS a proposito y se nota: la razon social dice «Demo» y
  // el CUIT es 30-00000000-0, que no existe. Esto no es el registro de ninguna
  // asociacion real: el seed es una demo publica.
  const entidadDemo = uuid()
  escribirTabla('ong_entidad', [{
    id: entidadDemo,
    razon_social: 'Asociación Civil Demo Cannábica',
    cuit: '30-00000000-0',
    jurisdiccion: 'Chaco',
    organismo_control: 'Inspección General de Personas Jurídicas y Registro Público de Comercio',
    sede_domicilio: 'Calle Falsa 123',
    sede_localidad: 'Resistencia',
    sede_provincia: 'Chaco',
    fecha_constitucion: hoyMenos(900),
    cierre_ejercicio_dia: 30, cierre_ejercicio_mes: 6,
    mandato_anios: 2, mandato_desde: hoyMenos(400),
    reprocann_inscripcion: 'ONG-DEMO-0001', reprocann_vencimiento: hoyMenos(-300),
    tope_pacientes: 150, plantas_por_paciente: 9, tope_predios: 3,
    objeto_cannabis: true,
    objeto_social: 'Cultivo solidario de cannabis con fines medicinales, en el marco de la Ley 27.350 y la Resolución 1780/2025.',
    perfil_reprocann: 'ONG cultivadora',
    ultima_revision_libros: hoyMenos(45), notas: 'Datos de demostración.',
  }])

  escribirTabla('ong_autoridades', [
    { id: uuid(), nombre: 'Ana Torres', cargo: 'Presidente', organo: 'Comisión Directiva',
      desde: hoyMenos(400), hasta: null, activo: true, antecedentes_penales_ok: true,
      cuit_activa: true, reprocann_activo: true,
      grupo_familiar: 'Sin parentesco con la Revisora de Cuentas.',
      fundador: true, notas: null },
    { id: uuid(), nombre: 'Beto Sosa', cargo: 'Secretario', organo: 'Comisión Directiva',
      desde: hoyMenos(400), hasta: null, activo: true, antecedentes_penales_ok: true,
      cuit_activa: true, reprocann_activo: false, grupo_familiar: null, fundador: true, notas: null },
    { id: uuid(), nombre: 'Clara Díaz', cargo: 'Tesorera', organo: 'Comisión Directiva',
      desde: hoyMenos(400), hasta: null, activo: true, antecedentes_penales_ok: true,
      cuit_activa: true, reprocann_activo: false, grupo_familiar: null, fundador: true, notas: null },
    { id: uuid(), nombre: 'Dra. Laura Gómez', cargo: 'Directora Médica', organo: 'Dirección Médica',
      desde: hoyMenos(380), hasta: null, activo: true, antecedentes_penales_ok: true,
      cuit_activa: true, reprocann_activo: true, grupo_familiar: null, fundador: false,
      notas: 'MP 45678. Firma el informe semestral de seguimiento.' },
    { id: uuid(), nombre: 'Ing. Marcos Ledesma', cargo: 'Responsable Técnico', organo: 'Cultivo',
      desde: hoyMenos(380), hasta: null, activo: true, antecedentes_penales_ok: true,
      cuit_activa: true, reprocann_activo: true, grupo_familiar: null, fundador: false,
      notas: 'Curso de cultivo de cannabis acreditado. Firma el plan de cultivo.' },
  ])

  escribirTabla('ong_predios', [
    { id: uuid(), nombre: 'Sede social', direccion: 'Calle Falsa 123', localidad: 'La Plata',
      provincia: 'Buenos Aires', municipio: 'La Plata', georreferenciado: true,
      municipio_notificado: true, activo: true, notas: 'Comodato vigente.' },
    { id: uuid(), nombre: 'Predio de cultivo N° 1', direccion: 'Ruta 36 km 40', localidad: 'Berisso',
      provincia: 'Buenos Aires', municipio: 'Berisso', georreferenciado: true,
      municipio_notificado: true, activo: true, notas: 'Coordenadas declaradas ante el municipio.' },
  ])

  // Los siete libros rubricados. Sin esto Coherencia marca «ningun libro
  // rubricado» y las actas no tienen donde asentarse.
  const librosDemo = ([
    'actas_cd', 'actas_asamblea', 'asistencia', 'actas_revisora',
    'registro_asociados', 'diario', 'inventario_balances',
  ] as const).map((tipo, i) => ({
    id: uuid(), tipo, numero: 1, rubricado: true, fecha_rubrica: hoyMenos(850),
    organismo: 'Inspección General de Personas Jurídicas', digital: false,
    folios_totales: 200, folios_usados: 20 + i * 5, estado: 'en_uso', notas: null,
  }))
  escribirTabla('ong_libros', librosDemo)

  escribirTabla('ong_actas', [
    { id: uuid(), tipo: 'cd', numero: 1, fecha: hoyMenos(70), lugar: 'Sede social',
      hora_inicio: '19:00', hora_fin: '20:30', asistentes: 3,
      asistentes_nombres: ['Ana Torres', 'Beto Sosa', 'Clara Díaz'],
      quorum_requerido: 2, quorum_ok: true, segunda_convocatoria: false,
      orden_del_dia: [
        { punto: 'Valor de la cuota social del período',
          resolucion: 'Se aprueba por unanimidad fijar la cuota en $XX.XXX.' },
        { punto: 'Altas de asociados',
          resolucion: 'Se aprueban las altas presentadas por Secretaría.' },
      ],
      firmantes: 'Ana Torres, Beto Sosa', estado: 'en_libro',
      libro_id: librosDemo[0].id, folio: 2, notas: null },
    { id: uuid(), tipo: 'cd', numero: 2, fecha: hoyMenos(20), lugar: 'Sede social',
      hora_inicio: '19:00', hora_fin: '20:00', asistentes: 3,
      asistentes_nombres: ['Ana Torres', 'Beto Sosa', 'Clara Díaz'],
      quorum_requerido: 2, quorum_ok: true, segunda_convocatoria: false,
      orden_del_dia: [
        { punto: 'Informe de la Dirección Médica',
          resolucion: 'Se toma conocimiento del informe semestral.' },
      ],
      firmantes: 'Ana Torres, Beto Sosa', estado: 'en_libro',
      libro_id: librosDemo[0].id, folio: 4, notas: null },
  ])

  // Los requisitos de la 1780. La lista vive en el codigo (REQUISITOS_1780);
  // esta tabla guarda solo el estado contra la clave.
  escribirTabla('ong_requisitos', ([
    ['director_medico', 'Dra. Laura Gómez'],
    ['responsable_tecnico', 'Ing. Marcos Ledesma'],
    ['georreferenciacion', 'Ing. Marcos Ledesma'],
    ['notificacion_municipio', 'Beto Sosa'],
    ['pacientes_minimos', 'Beto Sosa'],
    ['cromatografia', 'Ing. Marcos Ledesma'],
    ['antecedentes_penales', 'Beto Sosa'],
    ['plan_cultivo', 'Ing. Marcos Ledesma'],
  ] as [string, string][]).map(([clave, responsable]) => ({
    id: uuid(), clave, cumplido: true, responsable, vence: null, nota: null,
  })))

  // La declaracion del semestre pasado presentada, y la del semestre en curso
  // armada y sin presentar: las dos mitades del flujo, para poder mostrarlo.
  const semestreDe = (d: Date) => `${d.getFullYear()}-S${d.getMonth() < 6 ? 1 : 2}`
  const haceSeisMeses = new Date()
  haceSeisMeses.setMonth(haceSeisMeses.getMonth() - 6)
  escribirTabla('ong_ddjj', [
    { id: uuid(), periodo: semestreDe(haceSeisMeses), fecha_presentacion: hoyMenos(95),
      plantas_total: 24, plantas_floracion: 12, pacientes_vinculados: 3,
      variedades: 'Northern Lights, Critical', presentada: true, notas: null },
    { id: uuid(), periodo: semestreDe(new Date()), fecha_presentacion: null,
      plantas_total: 26, plantas_floracion: 14, pacientes_vinculados: 3,
      variedades: 'Northern Lights, Critical', presentada: false,
      notas: 'Armada y pendiente de presentar.' },
  ])

  // El reporte de seguimiento de una entrega. Sin al menos uno, el informe de
  // la Direccion Medica sale vacio: la curva de alivio se arma con esto.
  const dispensaConReporte = dispensasDemo[dispensasDemo.length - 2]
  if (dispensaConReporte) {
    escribirTabla('ong_feedback_clinico', [{
      id: uuid(), dispensa_id: dispensaConReporte.id,
      paciente_id: dispensaConReporte.paciente_id,
      // 4 = «Bueno». Estaba en 7 y la demo mostraba «Alivio 7/5» y un promedio
      // de «7.0/5»: la escala va de 1 a 5 (ver ESCALA_ALIVIO). Ademas de ser
      // imposible, no coincidia con la observacion de abajo.
      escala_alivio: 4, efectos_adversos: ['Sequedad bucal'],
      efectos_detalle: 'Leve, cede sola.',
      dosificacion_real: '3 inhalaciones antes de dormir',
      observaciones: 'Mejora del descanso desde la segunda semana.',
      creado_en: isoMenos(3),
    }])
  }

  // --- Saldo con proveedores (vistas calculadas en la base real) ---
  // Reproduce la forma del caso real: un proveedor que concentra casi toda la
  // deuda —que suele ser la propia entidad anotada como compra— y otros sanos.
  escribirTabla('v_saldo_proveedores', [
    { proveedor: 'Coop. de ejemplo', ordenes: 12, comprado: 4800000, pagado: 200000, saldo: 4600000, ordenes_con_saldo: 11 },
    { proveedor: 'Proveedor Norte',  ordenes: 4,  comprado: 1200000, pagado: 900000, saldo: 300000,  ordenes_con_saldo: 1 },
    { proveedor: 'Cultivo Sur',      ordenes: 6,  comprado: 2100000, pagado: 2100000, saldo: 0,      ordenes_con_saldo: 0 },
  ])
  escribirTabla('v_saldo_ordenes', [
    { orden_servicio: 'OS-101', proveedor: 'Coop. de ejemplo', fecha: hoyMenos(60), total: 800000, pagado: 200000, saldo: 600000, pagos: 1 },
    { orden_servicio: 'OS-104', proveedor: 'Coop. de ejemplo', fecha: hoyMenos(35), total: 500000, pagado: 0,      saldo: 500000, pagos: 0 },
    { orden_servicio: 'OS-108', proveedor: 'Proveedor Norte',  fecha: hoyMenos(20), total: 400000, pagado: 100000, saldo: 300000, pagos: 2 },
  ])

  // --- Ambiente: dos salas y 14 dias de lecturas, manana y tarde ---
  // La demo tiene que mostrar los graficos con datos, no una pantalla vacia:
  // lo que se entiende de esta pantalla es la forma de la serie, y sin serie
  // no hay nada que entender. Los numeros se generan con una oscilacion
  // dia/noche y algun exceso de humedad de tarde, para que el analisis en
  // castellano tenga algo real que senalar en vez de decir "todo en rango".
  const salaVege = uuid(), salaFlora = uuid()
  escribirTabla('ambiente_salas', [
    { id: salaVege, nombre: 'Sala 1', etapa: 'vegetativo', activa: true, orden: 0, creado_en: isoMenos(30) },
    // Sala 2 con limites propios: es lo que muestra que el semaforo puede ser
    // mas exigente que el rango generico de la etapa (B4).
    { id: salaFlora, nombre: 'Sala 2', etapa: 'floracion', activa: true, orden: 1,
      temp_min: 20, temp_max: 25, hum_min: null, hum_max: null, vpd_min: null, vpd_max: null,
      creado_en: isoMenos(30) },
  ])

  const lecturas: Fila[] = []
  const parejas: [string, number, number][] = [
    // sala, temp base de manana, humedad base de manana
    [salaVege, 23.5, 62],
    [salaFlora, 21.5, 48],
  ]
  for (const [sala, tBase, hBase] of parejas) {
    for (let d = 13; d >= 0; d--) {
      for (const turno of [9, 16]) {
        const f = new Date()
        f.setDate(f.getDate() - d)
        f.setHours(turno, 15, 0, 0)
        // De tarde sube ~3 °C y baja la humedad; el +- da variacion sin azar
        // (Math.random haria que la demo cambie en cada carga).
        const swing = turno === 16 ? 1 : 0
        const jitter = ((d % 3) - 1) * 0.6
        lecturas.push({
          id: uuid(),
          sala_id: sala,
          medido_en: f.toISOString(),
          temp_c: +(tBase + swing * 3.2 + jitter).toFixed(1),
          humedad_pct: +(hBase - swing * 6 + jitter * 2 + (d === 4 && swing ? 14 : 0)).toFixed(1),
          nota: d === 4 && swing ? 'quedó la puerta abierta' : null,
          creado_en: f.toISOString(),
        })
      }
    }
  }
  escribirTabla('ambiente_lecturas', lecturas)
}

// Siembra una sola vez (marca de version). El usuario puede resetear borrando
// las claves growflow_demo: del localStorage.
export function asegurarSeed(): void {
  try {
    if (localStorage.getItem(PREFIJO + 'seed') === VERSION_SEED) return
    sembrar()
    localStorage.setItem(PREFIJO + 'seed', VERSION_SEED)
  } catch {
    /* sin localStorage: nada que hacer */
  }
}
