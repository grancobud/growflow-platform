// ingesta — puerta de entrada de datos a GrowFlow la asociación.
//
// La usan dos cosas:
//   1. La carga historica de la planilla de la cooperativa (backfill).
//   2. Los formularios de Google, via Apps Script, cada vez que alguien los
//      completa. Ese disparador vive en Google: no depende de que nadie tenga
//      una computadora prendida, que es justo lo que se rompio antes.
//
// Es angosta a proposito: sabe insertar en SEIS tablas con columnas fijas y no
// hace nada mas. No ejecuta SQL, no borra, no actualiza. Si el token se filtra,
// lo peor que puede pasar es que alguien inserte filas de mas: no que se lleve
// ni destruya lo que hay.
//
// OJO AL DEPLOYAR: esta funcion va con verify_jwt = FALSE. La llama el Apps
// Script de Google, que manda SOLO `x-asociacion-token` y ningun header
// Authorization. Si se deploya con verify_jwt true —que es el DEFAULT de la
// herramienta de deploy— el gateway responde 401 antes de llegar a este codigo
// y la ingesta se corta sin que nada del codigo haya cambiado. Ya paso una vez.
//
// Como verificarlo despues de cada deploy, sin usar el token: un POST sin
// header tiene que responder {"error":"Token invalido"} (mensaje de ESTE
// codigo). Si responde UNAUTHORIZED_NO_AUTH_HEADER, el gateway lo corto antes y
// verify_jwt quedo mal.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// El token vive SOLO en Edge Functions > Secrets. Antes habia un valor por
// defecto hardcodeado aca y era una trampa: al borrar el secret la funcion no
// fallaba, volvia sola al token viejo —el que ya habia circulado— sin avisar.
// Ahora falla cerrado. Rotarlo es cambiar el secret y no tocar el codigo.
//
// Se le hace trim porque el campo Value del panel acepta multilinea: un salto
// de linea pegado sin querer daba 401 con el token correcto, y eso es una hora
// de buscar en el lugar equivocado.
const TOKEN = Deno.env.get("INGESTA_TOKEN")?.trim()
const UID = "6795f7f0-7e91-4450-845a-a9e6f6597e80"

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
)

const txt = (v: unknown) => {
  const s = v == null ? "" : String(v).trim()
  return s === "" ? null : s
}
const num = (v: unknown) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}
const MEDIO: Record<string, string> = { E: "Efectivo", T: "Transferencia", M: "Mixto" }
const ESPECIALES: Record<string, string> = {
  CI: "Consumo interno", Merma: "Merma", SAI: "Saldo inicial",
}

/**
 * Codigo de paciente (PAC-XXX) -> uuid. Se arma una sola vez por request.
 *
 * Lee `codigo` y cae a `notas` si esta vacio. El codigo vivio como prefijo de
 * `notas` hasta el 20/08/2026 (C3 de la orden de trabajo): obligaba a que todo
 * el que lo quisiera partiera un texto, y lo dejaba expuesto a que alguien
 * editara las notas y lo borrara sin darse cuenta.
 *
 * El fallback se queda: esta funcion tiene que seguir andando entre el deploy y
 * la migracion, y contra cualquier fila que todavia no se haya migrado.
 */
async function mapaPacientes(): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  let desde = 0
  for (;;) {
    const { data, error } = await sb.from("pacientes")
      .select("id,codigo,notas").range(desde, desde + 999)
    if (error) throw new Error(`pacientes: ${error.message}`)
    for (const p of data ?? []) {
      const cod = String((p as { codigo?: string | null }).codigo ?? "").trim()
        || String(p.notas ?? "").split("|")[0].trim()
      if (cod) m.set(cod, p.id)
    }
    if (!data || data.length < 1000) break
    desde += 1000
  }
  return m
}

const TABLAS: Record<string, (f: any[], ctx: any) => Record<string, unknown>> = {
  // [codigo, fecha, producto, gramos, aporte, E|T|M, lote, notas]
  ong_dispensas: (f, ctx) => ({
    user_id: UID,
    paciente_id: ESPECIALES[f[0]] ? null : (ctx.pacientes.get(txt(f[0]) ?? "") ?? null),
    fecha: f[1],
    producto: txt(f[2]),
    gramos: num(f[3]) ?? 0,
    aporte: num(f[4]),
    modalidad: ESPECIALES[f[0]] ?? "Paciente",
    medio_pago: MEDIO[f[5]] ?? null,
    lote_codigo: txt(f[6]),
    notas: txt(f[7]),
  }),
  // [fecha, ingreso|egreso, concepto, monto, medio, categoria]
  ong_caja: (f) => ({
    user_id: UID,
    fecha: f[0],
    tipo: f[1],
    concepto: txt(f[2]) ?? "Sin concepto",
    monto: num(f[3]) ?? 0,
    medio: txt(f[4]),
    detalle: txt(f[5]),
  }),
  // [numero, fecha, descripcion, monto, proveedor, categoria, medio, subtipo,
  //  lote_codigo]
  //
  // `lote_codigo` va al FINAL por lo mismo que `dni` en pacientes: el array es
  // posicional. Un llamador viejo manda 8, f[8] queda undefined y entra null.
  //
  // La hoja INGRESOS tiene el lote en su propia columna y el mapper del Apps
  // Script lo metia dentro de la descripcion. Se recupero por texto en el
  // backfill (115 de 115 matchearon), pero depender de un regex para lo que
  // viene de aca en adelante es fragil: alcanza con que alguien cambie el
  // separador.
  ong_documentos: (f) => ({
    user_id: UID,
    tipo: "gasto",
    numero: txt(f[0]),
    fecha: f[1],
    descripcion: txt(f[2]),
    monto: num(f[3]),
    proveedor: txt(f[4]),
    categoria: txt(f[5]),
    notas: txt(f[6]),
    subtipo: txt(f[7]),
    lote_codigo: txt(f[8]),
  }),
  // [nombre, telefono, email, reprocann_nro, reprocann_estado, notas, dni, domicilio]
  //
  // `dni` y `domicilio` van al FINAL a proposito. El array es posicional, asi
  // que meterlos en el medio romperia a todo el que ya llama con seis
  // elementos: los scripts del backfill y cualquier version vieja del Apps
  // Script. Agregados al final, un llamador viejo manda 6, f[6] queda undefined
  // y el campo entra null.
  //
  // El formulario de alta pide el DNI desde el primer dia y el mapeo no lo
  // tomaba: los 211 pacientes del backfill quedaron con `dni` vacio. Para una
  // operacion REPROCANN, no tener el documento de nadie es un agujero — y sin
  // DNI tampoco hay forma de deduplicar el padron, que ya tiene a la misma
  // persona con varios codigos.
  pacientes: (f) => ({
    nombre_completo: txt(f[0]) ?? "Sin nombre",
    telefono: txt(f[1]),
    email: txt(f[2]),
    reprocann_nro: txt(f[3]),
    reprocann_estado: txt(f[4]) ?? "En tramite",
    modalidad: "Tercero/ONG",
    socio: false,
    activo: true,
    notas: txt(f[5]),
    // Solo digitos: el formulario recibe "12.345.678", "12345678 " y variantes,
    // y un DNI con puntos no matchea contra uno sin puntos al deduplicar.
    dni: txt(f[6])?.replace(/\D/g, "") || null,
    domicilio: txt(f[7]),
  }),
  // [orden_servicio, fecha, proveedor, monto, medio, referencia]
  //
  // Los pagos a proveedor. Se ligan por el NUMERO de la orden (OS112) y no por
  // id: es lo que la planilla tiene y lo que la gente dice. Una orden se paga en
  // varias veces, asi que el saldo se CALCULA sumando estas filas (ver la vista
  // v_saldo_ordenes) en vez de guardarse en una columna que hay que mantener.
  ong_pagos_proveedor: (f) => ({
    user_id: UID,
    orden_servicio: txt(f[0]),
    fecha: f[1],
    proveedor: txt(f[2]),
    monto: num(f[3]) ?? 0,
    medio: txt(f[4]),
    referencia: txt(f[5]),
  }),
  // [codigo, producto, gramos_totales, activo, notas]
  ong_lotes: (f) => ({
    user_id: UID,
    codigo: txt(f[0]),
    producto: txt(f[1]),
    gramos_totales: num(f[2]) ?? 0.01,
    activo: f[3] === true || f[3] === "true",
    notas: txt(f[4]),
  }),
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Solo POST" }, 405)
  }
  // Sin secret no se atiende a nadie. Es la diferencia con el fallback viejo:
  // antes esto seguia andando con un token que ya no era secreto.
  if (!TOKEN) {
    return json({ error: "INGESTA_TOKEN no esta configurado" }, 503)
  }
  if ((req.headers.get("x-asociacion-token") ?? "").trim() !== TOKEN) {
    return json({ error: "Token invalido" }, 401)
  }

  const tabla = new URL(req.url).searchParams.get("tabla") ?? ""
  const mapear = TABLAS[tabla]
  if (!mapear) {
    return json({ error: `Tabla no permitida: ${tabla}`, permitidas: Object.keys(TABLAS) }, 400)
  }

  let filas: any[]
  try {
    const body = await req.json()
    filas = Array.isArray(body) ? body : body.filas
    if (!Array.isArray(filas)) throw new Error("se esperaba un array")
  } catch (e) {
    return json({ error: `Cuerpo invalido: ${(e as Error).message}` }, 400)
  }

  try {
    const ctx = { pacientes: tabla === "ong_dispensas" ? await mapaPacientes() : new Map() }
    const listas = filas.map((f) => mapear(f, ctx))

    // Sin vincular = una dispensa de paciente cuyo codigo no existe en el padron.
    // Se avisa en la respuesta en vez de dejarla pasar en silencio.
    const sinVincular = tabla === "ong_dispensas"
      ? listas.filter((r: any) => r.modalidad === "Paciente" && !r.paciente_id).length
      : 0

    let insertadas = 0
    // Para `pacientes` se devuelve el codigo PAC-XXX que asigno el trigger de la
    // base. Es lo que cierra el circuito del alta: quien llama (Apps Script) lo
    // escribe de vuelta en la planilla y se termina la asignacion a mano, que es
    // el paso que quedo huerfano cuando se rompio la notebook.
    const codigos: string[] = []
    for (let i = 0; i < listas.length; i += 500) {
      const tanda = listas.slice(i, i + 500)
      const q = sb.from(tabla).insert(tanda)
      const { data, error } = tabla === "pacientes" ? await q.select("codigo,notas") : await q
      if (error) return json({ error: error.message, insertadas, desde_fila: i }, 500)
      for (const r of (data ?? []) as { codigo?: string | null; notas: string | null }[]) {
        codigos.push(String(r.codigo ?? "").trim() || String(r.notas ?? "").split("|")[0].trim())
      }
      insertadas += tanda.length
    }
    // `codigos` viene en el mismo orden que las filas enviadas. Para el alta por
    // formulario eso es una fila y una sola, asi que el orden no es discutible;
    // en una carga masiva conviene chequearlo contra el nombre antes de confiar.
    return tabla === "pacientes"
      ? json({ ok: true, tabla, insertadas, sin_vincular: sinVincular, codigos })
      : json({ ok: true, tabla, insertadas, sin_vincular: sinVincular })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  })
}
