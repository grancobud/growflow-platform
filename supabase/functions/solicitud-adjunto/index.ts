// solicitud-adjunto — la persona sube su constancia de REPROCANN desde su link.
//
// POR QUE ESTO EXISTE Y NO SE SUBE DERECHO DESDE EL NAVEGADOR
//
// Subir derecho pide darle INSERT a `anon` sobre el bucket `documentos`, que es
// escritura publica sobre un bucket que ya guarda credenciales de 223 personas.
// Cualquiera con la clave anonima —que esta en el bundle, o sea a la vista—
// podria llenarlo. Aca el unico que escribe es el service role, y solo despues
// de que el token dio.
//
// El token es lo unico que autoriza. Lo tiene la persona que creo la solicitud
// y nadie mas: no hay «busca mi solicitud por DNI», asi que no se llega a un
// token probando documentos. Ver 20260822210000_solicitudes_de_alta.sql.
//
// LO QUE ESTA FUNCION NO HACE, Y ES A PROPOSITO
//
//   · No LEE la solicitud ni la devuelve. Contesta si pudo o no pudo. Con el
//     token ya se puede leer el estado por solicitud_estado(); esta es para
//     escribir, y una funcion que hace las dos cosas es una superficie mas
//     grande sin necesidad.
//   · No decide el ESTADO del REPROCANN —vigente, vencido, en tramite—. Eso lo
//     pone quien revisa, mirando el archivo. El 25/08/2026 hubo que limpiar 12
//     fichas porque una respuesta de formulario termino decidiendo un estado
//     que habilitaba a dispensar.
//   · No pisa un adjunto ya subido sin dejar rastro: el path lleva timestamp,
//     asi que la version anterior queda en el bucket.
//
// DOS TIPOS DE ADJUNTO: `reprocann` y `dni`.
//
// El DNI se sumo el 26/08/2026. El Google Form que esto reemplaza tenia una
// declaracion jurada que decia «la documentacion adjunta (DNI y REPROCANN, de
// corresponder) es autentica y vigente» — pero NO tenia ninguna pregunta para
// subir el DNI. La persona juraba sobre un documento que nunca entrego.
//
// OJO AL DEPLOYAR: va con verify_jwt = FALSE, igual que `ingesta`. La llama
// gente sin cuenta, que no manda header Authorization. Con verify_jwt en true
// —que es el DEFAULT de la herramienta de deploy— el gateway responde 401 antes
// de llegar a este codigo. Se verifica sin token: un POST vacio tiene que
// contestar {"error":"Falta el token"} (mensaje de ESTE codigo) y no
// UNAUTHORIZED_NO_AUTH_HEADER.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
)

// Los mismos que acepta el bucket `documentos`. Se listan igual acá porque el
// bucket rechaza DESPUES de haber recibido el archivo entero: validar antes es
// no comerse la subida.
const TIPOS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}
const MAX = 20 * 1024 * 1024

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  })

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
}

/**
 * El numero de REPROCANN tiene que tener una tirada de 4+ digitos.
 *
 * Es la MISMA regla que app/src/lib/datosDelFormulario.ts, y esta duplicada a
 * proposito: el front y el borde no comparten codigo, y este es el que de
 * verdad decide lo que entra a la base. Si una cambia, la otra tambien.
 *
 * Se conservan los codigos con prefijo alfanumerico tipo «a1bCde1234567»: son
 * credenciales reales, diez fichas los tienen y varias ya retiraron.
 */
const numeroValido = (v: string) => /[0-9]{4,}/.test(v)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "Metodo no permitido" }, 405)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json({ error: "El pedido no trae un formulario" }, 400)
  }

  const token = String(form.get("token") ?? "").trim()
  // El mismo largo que valida solicitud_estado. Un token de otro largo no puede
  // pescar una fila: se corta antes de tocar la base.
  if (token.length !== 64) return json({ error: "Falta el token" }, 400)

  // Cual de los dos documentos es. Lo que no este en la lista no entra: sin
  // esto, un `tipo` inventado elegiria una columna que no existe.
  const tipo = String(form.get("tipo") ?? "reprocann").trim()
  if (tipo !== "reprocann" && tipo !== "dni") {
    return json({ error: "Tipo de documento desconocido" }, 400)
  }

  const archivo = form.get("archivo")
  if (!(archivo instanceof File)) return json({ error: "Falta el archivo" }, 400)
  if (archivo.size === 0) return json({ error: "El archivo esta vacio" }, 400)
  if (archivo.size > MAX) {
    return json({ error: "El archivo pesa mas de 20 MB. Sacale una foto mas chica." }, 400)
  }
  const ext = TIPOS[archivo.type]
  if (!ext) {
    return json({ error: "Tiene que ser un PDF o una imagen (JPG, PNG o WEBP)." }, 400)
  }

  // El numero es opcional: alguien puede tener la constancia y no el numero a
  // mano. Pero si lo manda, tiene que parecer un numero.
  const nro = String(form.get("reprocann_nro") ?? "").trim()
  if (nro && !numeroValido(nro)) {
    return json({
      error: "Ese numero de REPROCANN no parece un numero. Fijate de copiar el de la credencial.",
    }, 400)
  }

  // El token, contra la base. Se pide el id y nada mas: no hace falta leer el
  // resto de la solicitud para poder escribirle un adjunto.
  const { data: fila, error: eBusca } = await sb
    .from("ong_solicitudes").select("id, estado").eq("token", token).maybeSingle()
  if (eBusca) return json({ error: "No se pudo verificar el link" }, 500)
  // No dice «ese link no existe»: dice lo mismo que si existiera y no sirviera.
  // Un mensaje que distingue los dos casos es una forma de ir probando.
  if (!fila) return json({ error: "Este link no permite subir nada" }, 404)
  if (fila.estado === "rechazada") {
    return json({ error: "Esta solicitud ya fue cerrada. Escribile a la asociacion." }, 409)
  }

  const path = `solicitud/${fila.id}/${tipo}-${Date.now()}.${ext}`
  const { error: eSube } = await sb.storage.from("documentos")
    .upload(path, archivo, { contentType: archivo.type, upsert: false })
  if (eSube) return json({ error: `No se pudo guardar el archivo: ${eSube.message}` }, 500)

  const campos: Record<string, unknown> = { actualizada_en: new Date().toISOString() }
  if (tipo === "dni") {
    campos.dni_path = path
  } else {
    campos.reprocann_path = path
    campos.reprocann_subido_en = new Date().toISOString()
    // El numero solo viaja con la constancia de REPROCANN: mandarlo junto al
    // DNI seria guardarlo desde la pantalla equivocada.
    if (nro) campos.reprocann_nro = nro
  }

  const { error: eUp } = await sb.from("ong_solicitudes").update(campos).eq("id", fila.id)

  if (eUp) {
    // El archivo ya subio pero la fila no quedo apuntandolo: es un huerfano en
    // el bucket que nadie va a encontrar. Se borra antes de contestar el error,
    // en vez de dejar basura silenciosa.
    await sb.storage.from("documentos").remove([path])
    return json({ error: "No se pudo registrar el archivo" }, 500)
  }

  return json({ ok: true })
})
