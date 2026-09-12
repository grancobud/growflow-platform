// ============================================================================
// Modo DEMO - cliente que imita la interfaz de @supabase/supabase-js
// respaldado por localStorage (ver demoStore.ts). Cubre el query-builder
// encadenable (from/select/eq/order/...), auth, storage y realtime (no-op).
// No pretende ser completo: soporta lo que usan las paginas activas y degrada
// con gracia (tabla desconocida -> [], rpc -> null) en el resto.
// ============================================================================

import {
  leerTabla, escribirTabla, uuid, asegurarSeed,
  TABLAS_CONOCIDAS, USUARIO_DEMO, type Fila,
} from './demoStore'

type Resultado = { data: any; error: null; count: number | null }

// Defaults al insertar, por tabla, segun el esquema SQL.
function aplicarDefaults(tabla: string, fila: Fila): Fila {
  const ahora = new Date().toISOString()
  const hoy = ahora.slice(0, 10)
  const base: Fila = { ...fila }
  if (base.id == null) base.id = uuid()
  if (base.creado_en == null) base.creado_en = ahora
  switch (tabla) {
    case 'geneticas':
      if (base.tipo == null) base.tipo = 'Desconocido'
      break
    case 'plantas':
      if (base.fase == null) base.fase = 'Germinacion'
      if (base.activa == null) base.activa = true
      base.actualizado_en = ahora
      break
    case 'eventos':
      if (base.tipo == null) base.tipo = 'Nota'
      if (base.fecha == null) base.fecha = hoy
      break
    case 'cosechas':
    case 'riegos':
      if (base.fecha == null) base.fecha = hoy
      break
    case 'aplicaciones':
      if (base.fecha == null) base.fecha = hoy
      if (base.categoria == null) base.categoria = 'Fumigacion'
      break
  }
  return base
}

// Replica del trigger SQL aplicar_cambio_fase: un evento CambioFase actualiza
// la fase de la planta.
const FASES_VALIDAS = ['Germinacion', 'Plantula', 'Vegetativo', 'Floracion', 'Secado', 'Curado', 'Cosechada', 'Muerta']
function aplicarTriggerEventos(filas: Fila[]): void {
  for (const e of filas) {
    if (e.tipo === 'CambioFase' && e.planta_id && FASES_VALIDAS.includes(e.detalle)) {
      const plantas = leerTabla('plantas')
      const p = plantas.find((x) => x.id === e.planta_id)
      if (p) {
        p.fase = e.detalle
        p.actualizado_en = new Date().toISOString()
        escribirTabla('plantas', plantas)
      }
    }
  }
}

// Cascada manual al borrar (FK on delete cascade en el esquema).
function cascadaBorrado(tabla: string, borradas: Fila[]): void {
  if (tabla !== 'plantas') return
  const ids = new Set(borradas.map((p) => p.id))
  for (const hija of ['eventos', 'cosechas', 'riegos', 'aplicaciones']) {
    const filas = leerTabla(hija)
    const quedan = filas.filter((f) => !ids.has(f.planta_id))
    if (quedan.length !== filas.length) escribirTabla(hija, quedan)
  }
}

// --- vista resumen_plantas (computada) ---
function computarResumenPlantas(): Fila[] {
  const plantas = leerTabla('plantas')
  const geneticas = leerTabla('geneticas')
  const eventos = leerTabla('eventos')
  const pacientes = leerTabla('pacientes')
  const hoy = new Date()
  return plantas.map((p) => {
    const g = geneticas.find((x) => x.id === p.genetica_id) || null
    const pac = p.paciente_id ? pacientes.find((x) => x.id === p.paciente_id) || null : null
    const evsP = eventos.filter((e) => e.planta_id === p.id)
    const riegos = evsP.filter((e) => e.tipo === 'Riego').map((e) => e.fecha).sort()
    let dias_de_vida: number | null = null
    if (p.fecha_germinacion) {
      const g0 = new Date(p.fecha_germinacion)
      dias_de_vida = Math.floor((hoy.getTime() - g0.getTime()) / 86400000)
    }
    return {
      id: p.id,
      codigo: p.codigo ?? null,
      nombre: p.apodo ?? g?.nombre ?? 'Sin nombre',
      genetica: g?.nombre ?? null,
      banco: g?.banco ?? null,
      tipo: g?.tipo ?? null,
      // Sin esto el demo deriva la fase de las automaticas con el default y la
      // produccion con el vege de la variedad: dos apps dando numeros distintos.
      tiempo_vege_dias: g?.tiempo_vege_dias ?? null,
      fase: p.fase,
      fecha_germinacion: p.fecha_germinacion,
      dias_de_vida,
      sustrato: p.sustrato,
      maceta: p.maceta,
      ubicacion: p.ubicacion,
      slot: p.slot ?? null,
      activa: p.activa,
      paciente_id: p.paciente_id ?? null,
      paciente_nombre: pac?.nombre_completo ?? null,
      ultimo_riego: riegos.length ? riegos[riegos.length - 1] : null,
      total_eventos: evsP.length,
    }
  })
}

// Las vistas que sirven la MISMA fila con menos columnas segun el rol.
//
// En produccion `pacientes_segun_rol` anula patologia y medico tratante para
// quien no atiende pacientes, y `dispensas_segun_rol` anula los importes para
// quien no ve plata. Aca no hay roles —el demo auto-loguea— asi que devuelven
// la tabla entera, que es lo correcto: el demo muestra COMO se usa la pantalla.
//
// TIENEN QUE ESTAR EN ESTE MAPA. `cargarFuente` devuelve `[]` para lo que no
// conoce, sin error y sin aviso: una vista sin registrar deja la pantalla de
// Pacientes VACIA en el dev local, con el toast de exito igual. Es el gotcha
// mas caro de este repo y se paga en silencio.
const VISTAS_SOBRE_TABLA: Record<string, string> = {
  pacientes_segun_rol: 'pacientes',
  dispensas_segun_rol: 'ong_dispensas',
}

// `cupo_conteos` no es una vista sobre UNA tabla: son agregados de dos. Va
// computada, igual que `resumen_plantas`.
function computarCupoConteos(): Fila[] {
  return [{
    pacientes_activos: leerTabla('pacientes').filter((p) => p.activo !== false).length,
    predios_activos: leerTabla('ong_predios').filter((p) => p.activo !== false).length,
  }]
}

function cargarFuente(tabla: string): Fila[] {
  if (tabla === 'resumen_plantas') return computarResumenPlantas()
  if (tabla === 'cupo_conteos') return computarCupoConteos()
  const base = VISTAS_SOBRE_TABLA[tabla]
  if (base) return leerTabla(base)
  if (TABLAS_CONOCIDAS.includes(tabla)) return leerTabla(tabla)
  return [] // tabla desconocida -> degradacion con gracia
}

// --- resolucion de embeds del select: "alias:fk (campos...)" ---
type Embed = { prop: string; fk: string; sub: string }
function parsearSelect(sel: string): { cols: string[]; embeds: Embed[] } {
  const cols: string[] = []
  const embeds: Embed[] = []
  let i = 0
  const n = sel.length
  while (i < n) {
    // saltar separadores
    while (i < n && (sel[i] === ',' || sel[i] === ' ' || sel[i] === '\n')) i++
    if (i >= n) break
    // leer token hasta , o (
    let tok = ''
    while (i < n && sel[i] !== ',' && sel[i] !== '(') { tok += sel[i]; i++ }
    if (i < n && sel[i] === '(') {
      // es un embed: capturar parentesis balanceados
      let prof = 0, sub = ''
      do {
        const c = sel[i]
        if (c === '(') prof++
        else if (c === ')') prof--
        if (prof > 0 && !(c === '(' && prof === 1)) sub += c
        i++
      } while (i < n && prof > 0)
      const t = tok.trim()
      const [prop, fk] = t.includes(':') ? t.split(':') : [t, fkPorTabla(t)]
      embeds.push({ prop: prop.trim(), fk: (fk || '').trim(), sub: sub.trim() })
    } else {
      const t = tok.trim()
      if (t) cols.push(t)
    }
  }
  return { cols, embeds }
}

// Heuristica FK -> tabla destino (no tenemos metadata real).
function fkPorTabla(propOTabla: string): string {
  if (propOTabla === 'geneticas') return 'genetica_id'
  if (propOTabla === 'plantas') return 'planta_id'
  return propOTabla + '_id'
}
function tablaDeFk(fk: string, prop: string): string {
  if (fk === 'genetica_id') return 'geneticas'
  if (fk === 'planta_id' || fk === 'madre_id') return 'plantas'
  if (fk === 'paciente_id') return 'pacientes'
  if (fk === 'cultivador_id') return 'cultivadores'
  if (fk === 'jornada_id') return 'jornadas'
  if (TABLAS_CONOCIDAS.includes(prop)) return prop
  return prop
}

function proyectar(fila: Fila, cols: string[], embeds: Embed[]): Fila {
  let out: Fila
  if (cols.length === 0 || cols.includes('*')) {
    out = { ...fila }
  } else {
    out = {}
    for (const c of cols) {
      const nombre = c.includes(':') ? c.split(':')[0].trim() : c.trim()
      out[nombre] = fila[nombre]
    }
  }
  for (const emb of embeds) {
    const tablaDest = tablaDeFk(emb.fk, emb.prop)
    const filasDest = cargarFuente(tablaDest)
    const valFk = fila[emb.fk]
    const match = filasDest.find((x) => x.id === valFk) || null
    if (match) {
      const subParsed = parsearSelect(emb.sub)
      out[emb.prop] = proyectar(match, subParsed.cols, subParsed.embeds)
    } else {
      out[emb.prop] = null
    }
  }
  return out
}

// --- predicados de filtro ---
type Filtro = (f: Fila) => boolean
function patronLike(pat: string): RegExp {
  const esc = pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')
  return new RegExp('^' + esc + '$', 'i')
}

class QueryBuilder implements PromiseLike<Resultado> {
  private filtros: Filtro[] = []
  private _order: { col: string; asc: boolean }[] = []
  private _limit: number | null = null
  private _range: [number, number] | null = null
  private _single = false
  private _maybe = false
  private modo: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private payload: any = null
  private selectStr = '*'
  private _count: 'exact' | null = null
  private _head = false
  private tabla: string

  constructor(tabla: string) { this.tabla = tabla }

  select(sel = '*', opts?: { count?: 'exact'; head?: boolean }) {
    this.selectStr = sel
    if (opts?.count) this._count = opts.count
    if (opts?.head) this._head = true
    return this
  }
  insert(p: any) { this.modo = 'insert'; this.payload = p; return this }
  update(p: any) { this.modo = 'update'; this.payload = p; return this }
  upsert(p: any) { this.modo = 'upsert'; this.payload = p; return this }
  delete() { this.modo = 'delete'; return this }

  eq(col: string, val: any) { this.filtros.push((f) => f[col] === val); return this }
  neq(col: string, val: any) { this.filtros.push((f) => f[col] !== val); return this }
  gt(col: string, val: any) { this.filtros.push((f) => f[col] > val); return this }
  gte(col: string, val: any) { this.filtros.push((f) => f[col] >= val); return this }
  lt(col: string, val: any) { this.filtros.push((f) => f[col] < val); return this }
  lte(col: string, val: any) { this.filtros.push((f) => f[col] <= val); return this }
  is(col: string, val: any) { this.filtros.push((f) => (val === null ? f[col] == null : f[col] === val)); return this }
  in(col: string, arr: any[]) { this.filtros.push((f) => arr.includes(f[col])); return this }
  contains(col: string, val: any) {
    this.filtros.push((f) => {
      const v = f[col]
      if (Array.isArray(v) && Array.isArray(val)) return val.every((x) => v.includes(x))
      if (typeof v === 'string') return v.includes(String(val))
      return false
    })
    return this
  }
  ilike(col: string, pat: string) { const re = patronLike(pat); this.filtros.push((f) => re.test(String(f[col] ?? ''))); return this }
  like(col: string, pat: string) { const re = patronLike(pat); this.filtros.push((f) => re.test(String(f[col] ?? ''))); return this }
  match(obj: Record<string, any>) { for (const [k, v] of Object.entries(obj)) this.eq(k, v); return this }
  filter(col: string, op: string, val: any) {
    const ops: Record<string, Filtro> = {
      eq: (f) => f[col] === val, neq: (f) => f[col] !== val,
      gt: (f) => f[col] > val, gte: (f) => f[col] >= val,
      lt: (f) => f[col] < val, lte: (f) => f[col] <= val,
      is: (f) => (val === 'null' || val === null ? f[col] == null : f[col] === val),
    }
    if (ops[op]) this.filtros.push(ops[op])
    return this
  }
  // or('col.op.val,col.op.val')
  or(expr: string) {
    const partes = expr.split(',').map((p) => p.trim()).filter(Boolean)
    const preds: Filtro[] = partes.map((p) => {
      const [col, op, ...rest] = p.split('.')
      const val = rest.join('.')
      const num = Number(val)
      const v: any = val === 'null' ? null : isNaN(num) || val === '' ? val : num
      switch (op) {
        case 'eq': return (f: Fila) => f[col] === v
        case 'neq': return (f: Fila) => f[col] !== v
        case 'gt': return (f: Fila) => f[col] > v
        case 'gte': return (f: Fila) => f[col] >= v
        case 'lt': return (f: Fila) => f[col] < v
        case 'lte': return (f: Fila) => f[col] <= v
        case 'ilike':
        case 'like': { const re = patronLike(val); return (f: Fila) => re.test(String(f[col] ?? '')) }
        case 'is': return (f: Fila) => (val === 'null' ? f[col] == null : f[col] === v)
        default: return () => false
      }
    })
    this.filtros.push((f) => preds.some((p) => p(f)))
    return this
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this._order.push({ col, asc: opts?.ascending !== false })
    return this
  }
  limit(n: number) { this._limit = n; return this }
  range(from: number, to: number) { this._range = [from, to]; return this }
  single() { this._single = true; return this }
  maybeSingle() { this._maybe = true; return this }

  // --- ejecucion ---
  private ejecutar(): Resultado {
    if (this.modo === 'insert') return this.hacerInsert()
    if (this.modo === 'update') return this.hacerUpdate()
    if (this.modo === 'upsert') return this.hacerUpsert()
    if (this.modo === 'delete') return this.hacerDelete()
    return this.hacerSelect()
  }

  private filtrar(filas: Fila[]): Fila[] {
    return filas.filter((f) => this.filtros.every((p) => p(f)))
  }

  private ordenar(filas: Fila[]): Fila[] {
    if (!this._order.length) return filas
    const arr = [...filas]
    arr.sort((a, b) => {
      for (const { col, asc } of this._order) {
        const va = a[col], vb = b[col]
        if (va == null && vb == null) continue
        if (va == null) return asc ? -1 : 1
        if (vb == null) return asc ? 1 : -1
        if (va < vb) return asc ? -1 : 1
        if (va > vb) return asc ? 1 : -1
      }
      return 0
    })
    return arr
  }

  private hacerSelect(): Resultado {
    const fuente = cargarFuente(this.tabla)
    let filas = this.filtrar(fuente)
    const total = filas.length
    filas = this.ordenar(filas)
    if (this._range) filas = filas.slice(this._range[0], this._range[1] + 1)
    if (this._limit != null) filas = filas.slice(0, this._limit)

    if (this._head) return { data: [], error: null, count: total }

    const { cols, embeds } = parsearSelect(this.selectStr)
    const proyectadas = filas.map((f) => proyectar(f, cols, embeds))

    if (this._single || this._maybe) {
      return { data: proyectadas[0] ?? null, error: null, count: this._count ? total : null }
    }
    return { data: proyectadas, error: null, count: this._count ? total : null }
  }

  private normalizarEntrada(): Fila[] {
    return Array.isArray(this.payload) ? this.payload : [this.payload]
  }

  private hacerInsert(): Resultado {
    const entradas = this.normalizarEntrada().map((p) => aplicarDefaults(this.tabla, p))
    if (TABLAS_CONOCIDAS.includes(this.tabla)) {
      const filas = leerTabla(this.tabla)
      filas.push(...entradas)
      escribirTabla(this.tabla, filas)
      if (this.tabla === 'eventos') aplicarTriggerEventos(entradas)
    }
    return this.salidaMutacion(entradas)
  }

  private hacerUpsert(): Resultado {
    const entradas = this.normalizarEntrada()
    const filas = TABLAS_CONOCIDAS.includes(this.tabla) ? leerTabla(this.tabla) : []
    const resultantes: Fila[] = []
    for (const e of entradas) {
      const idx = e.id != null ? filas.findIndex((f) => f.id === e.id) : -1
      if (idx >= 0) { filas[idx] = { ...filas[idx], ...e }; resultantes.push(filas[idx]) }
      else { const nueva = aplicarDefaults(this.tabla, e); filas.push(nueva); resultantes.push(nueva) }
    }
    if (TABLAS_CONOCIDAS.includes(this.tabla)) escribirTabla(this.tabla, filas)
    return this.salidaMutacion(resultantes)
  }

  private hacerUpdate(): Resultado {
    const filas = TABLAS_CONOCIDAS.includes(this.tabla) ? leerTabla(this.tabla) : []
    const tocadas: Fila[] = []
    for (const f of filas) {
      if (this.filtros.every((p) => p(f))) {
        Object.assign(f, this.payload)
        if (this.tabla === 'plantas') f.actualizado_en = new Date().toISOString()
        tocadas.push(f)
      }
    }
    if (TABLAS_CONOCIDAS.includes(this.tabla)) escribirTabla(this.tabla, filas)
    return this.salidaMutacion(tocadas)
  }

  private hacerDelete(): Resultado {
    const filas = TABLAS_CONOCIDAS.includes(this.tabla) ? leerTabla(this.tabla) : []
    const borradas = filas.filter((f) => this.filtros.every((p) => p(f)))
    const quedan = filas.filter((f) => !this.filtros.every((p) => p(f)))
    if (TABLAS_CONOCIDAS.includes(this.tabla)) {
      escribirTabla(this.tabla, quedan)
      cascadaBorrado(this.tabla, borradas)
    }
    return this.salidaMutacion(borradas)
  }

  private salidaMutacion(filas: Fila[]): Resultado {
    const { cols, embeds } = parsearSelect(this.selectStr)
    const proy = filas.map((f) => proyectar(f, cols, embeds))
    if (this._single || this._maybe) return { data: proy[0] ?? null, error: null, count: null }
    return { data: proy, error: null, count: null }
  }

  then<R1 = Resultado, R2 = never>(
    onfulfilled?: ((value: Resultado) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    try {
      return Promise.resolve(this.ejecutar()).then(onfulfilled, onrejected)
    } catch (e) {
      return Promise.resolve({ data: null, error: { message: String(e) }, count: null } as any).then(onfulfilled, onrejected)
    }
  }
}

// --- realtime (no-op encadenable) ---
function canalDemo() {
  const canal: any = {
    on: () => canal,
    subscribe: (cb?: (estado: string) => void) => { if (cb) setTimeout(() => cb('SUBSCRIBED'), 0); return canal },
    track: async () => ({}),
    untrack: async () => ({}),
    presenceState: () => ({}),
    send: async () => ({}),
    unsubscribe: async () => ({}),
  }
  return canal
}

// --- storage (guarda data URLs en localStorage) ---
function leerFoto(nombre: string): string | null {
  try { return localStorage.getItem('growflow_demo:foto:' + nombre) } catch { return null }
}
function bucketDemo() {
  return {
    async upload(nombre: string, file: File) {
      const dataUrl = await new Promise<string>((res) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result))
        r.onerror = () => res('')
        r.readAsDataURL(file)
      })
      try { localStorage.setItem('growflow_demo:foto:' + nombre, dataUrl) } catch { /* cuota */ }
      return { data: { path: nombre }, error: null }
    },
    getPublicUrl(nombre: string) {
      return { data: { publicUrl: leerFoto(nombre) ?? '' } }
    },
    async createSignedUrl(nombre: string) {
      return { data: { signedUrl: leerFoto(nombre) ?? '' }, error: null }
    },
    async remove(nombres: string[]) {
      for (const n of nombres) { try { localStorage.removeItem('growflow_demo:foto:' + n) } catch { /* */ } }
      return { data: [], error: null }
    },
    async download() { return { data: null, error: null } },
  }
}

// --- auth (siempre autenticado como usuario demo) ---
const sesionDemo = {
  access_token: 'demo-token',
  token_type: 'bearer',
  user: { id: USUARIO_DEMO.id, email: USUARIO_DEMO.email, app_metadata: {}, user_metadata: {}, aud: 'authenticated' },
}
const authDemo = {
  async getSession() { return { data: { session: sesionDemo }, error: null } },
  async getUser() { return { data: { user: sesionDemo.user }, error: null } },
  async signInWithPassword() { return { data: { session: sesionDemo, user: sesionDemo.user }, error: null } },
  async signUp() { return { data: { session: sesionDemo, user: sesionDemo.user }, error: null } },
  async signOut() { return { error: null } },
  async updateUser() { return { data: { user: sesionDemo.user }, error: null } },
  async resetPasswordForEmail() { return { data: {}, error: null } },
  onAuthStateChange(cb: (evento: string, sesion: any) => void) {
    setTimeout(() => cb('SIGNED_IN', sesionDemo), 0)
    return { data: { subscription: { unsubscribe() {} } } }
  },
}

/**
 * Las funciones de la base que la demo sí sabe imitar.
 *
 * Sólo las del circuito público de alta, y a propósito: son las únicas que la
 * demo NECESITA para que /sumate funcione sin backend. Imitar el resto sería
 * escribir dos veces la lógica que ya vive en SQL, y la copia se atrasa.
 *
 * OJO: esto NO reproduce la seguridad. En la base real `anon` no puede tocar
 * `ong_solicitudes` y sólo entra por estas dos funciones; acá todo es
 * localStorage del propio navegador y no hay nada que proteger. Lo que se imita
 * son las REGLAS —los frenos, la validación, qué campos vuelven— para que la
 * pantalla se comporte igual.
 */
function rpcDemo(fn: string, args: Record<string, unknown>): { data: unknown; error: unknown } | null {
  const err = (message: string) => ({ data: null, error: { message } })

  if (fn === 'solicitud_crear') {
    const nombre = String(args.p_nombre ?? '').trim()
    const dni = String(args.p_dni ?? '').replace(/\D/g, '')
    if (nombre.length < 3) return err('Falta el nombre y apellido')
    if (dni.length < 7 || dni.length > 9) return err('El documento no parece valido')

    const filas = leerTabla('ong_solicitudes')
    const hace24h = Date.now() - 24 * 60 * 60 * 1000
    const enCurso = filas.find(f =>
      f.dni === dni && ['pendiente', 'en_revision'].includes(String(f.estado)) &&
      Date.parse(String(f.creada_en)) > hace24h)
    if (enCurso) {
      return err('Ya hay una solicitud en curso con ese documento. Usá el link que te dimos para ver cómo va.')
    }

    const token = (uuid() + uuid()).replace(/-/g, '')
    const ahora = new Date().toISOString()
    filas.push({
      id: uuid(), token, nombre, dni,
      email: String(args.p_email ?? '').trim() || null,
      telefono: String(args.p_telefono ?? '').trim() || null,
      notas: String(args.p_notas ?? '').trim() || null,
      estado: 'pendiente', motivo: null, paciente_id: null, asociado_id: null,
      creada_en: ahora, actualizada_en: ahora, revisada_por: null,
      // La firma del mandato, igual que la funcion de la base: si el demo no la
      // guardara, la demo mostraria un alta sin mandato y la instalacion real
      // una con mandato. Una demo que se comporta distinto que produccion es
      // peor que no tenerla: es donde se prueban las cosas antes de creerlas.
      //
      // La FECHA la pone el demo, no quien llama, por lo mismo que en la base.
      mandato_aceptado: args.p_mandato_aceptado === true,
      mandato_version: args.p_mandato_aceptado === true
        ? (String(args.p_mandato_version ?? '').trim() || null) : null,
      mandato_fecha: args.p_mandato_aceptado === true ? ahora : null,
    })
    escribirTabla('ong_solicitudes', filas)
    return { data: token, error: null }
  }

  if (fn === 'solicitud_estado') {
    const token = String(args.p_token ?? '')
    if (token.length !== 64) return { data: [], error: null }
    const s = leerTabla('ong_solicitudes').find(f => f.token === token)
    if (!s) return { data: [], error: null }
    const e = leerTabla('ong_entidad')[0] ?? {}
    // Los mismos campos que devuelve la función real: sin el DNI.
    return {
      data: [{
        estado: s.estado, nombre: s.nombre,
        creada_en: s.creada_en, actualizada_en: s.actualizada_en, motivo: s.motivo,
        entidad: e.razon_social ?? null, codigo_vinculacion: e.codigo_vinculacion ?? null,
      }],
      error: null,
    }
  }

  return null
}

export function crearClienteDemo() {
  asegurarSeed()
  return {
    from(tabla: string) { return new QueryBuilder(tabla) },
    rpc(fn: string, args?: any) {
      const r = rpcDemo(fn, args ?? {})
      // El resto sigue devolviendo vacio con gracia: una funcion que la demo no
      // conoce no tiene por que tumbar la pantalla.
      return Promise.resolve(r ?? { data: null, error: null }) as any
    },
    channel(_nombre: string, _opts?: any) { return canalDemo() },
    removeChannel(_canal: any) { return Promise.resolve('ok') },
    getChannels() { return [] },
    storage: { from(_bucket: string) { return bucketDemo() } },
    auth: authDemo,
  }
}
