// usuarios-eliminar — saca del sistema a alguien, salvo que sea administrador.
//
// CAMBIO DEL 31/08/2026. Antes solo se podia borrar a quien NUNCA entro. La
// regla protegia la autoria: borrar a alguien se llevaba su firma de todo lo
// que cargo, y eso es lo que un libro tiene que poder mostrar en una
// inspeccion. Gaston pidio poder borrar igual, y decidio que la barrera pase a
// ser el ROL.
//
// LO QUE HUBO QUE ARREGLAR ANTES, Y ERA UNA BOMBA
//
// `ong_lotes.user_id` y `ong_pedidos.user_id` apuntaban a `auth.users` con
// ON DELETE **CASCADE**. Borrar un usuario le borraba los lotes. Medido antes de
// tocar nada: la cuenta de la asociacion tenia los 105 lotes y las 1.248
// dispensas colgando, asi que borrarla habria borrado el inventario entero y
// dejado las entregas apuntando a un `lote_codigo` inexistente —que es
// justamente lo que detecta el cruce `lote_codigo_huerfano`—.
//
// Hoy las dos son ON DELETE SET NULL: la fila queda, pierde el nombre de quien
// la cargo. Abrir el borrado sin ese arreglo habria sido poner un boton de
// perder datos.
//
// LA REGLA SE VERIFICA ACA, NO EN LA PANTALLA. Un boton que no se muestra igual
// se puede llamar a mano.
//
// NO SE BORRA A UN `administrador`. Es el rol de la cuenta de la asociacion.
// `administrador_sistema` SI se puede borrar: es una persona que administra, y
// esa es la unica diferencia real entre los dos roles, que en permisos son
// identicos.
//
// TAMPOCO SE PUEDE BORRAR A UNO MISMO. Es la unica forma de quedarse sin ningun
// administrador, y desde adentro de la app no habria vuelta.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const URL_ = Deno.env.get("SUPABASE_URL")!
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })

// Los CUATRO que manda `supabase.functions.invoke`. Con dos, el navegador corta
// el pedido en el preflight y la pantalla dice «Failed to send a request», que
// no es un error de la funcion: es que la funcion nunca se entero.
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "Metodo no permitido" }, 405)

  const auth = req.headers.get("Authorization") ?? ""
  if (!auth.startsWith("Bearer ")) return json({ error: "Falta la sesion" }, 401)

  const comoLaPersona = createClient(URL_, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: auth } },
  })
  const { data: { user }, error: eUser } = await comoLaPersona.auth.getUser()
  if (eUser || !user) return json({ error: "Sesion invalida" }, 401)

  // El gateway prueba que el token sea valido, no de quien es.
  const { data: quien } = await admin
    .from("perfiles_usuario").select("rol, activo").eq("id", user.id).maybeSingle()
  const puedeAdministrar = quien?.activo &&
    (quien.rol === "administrador" || quien.rol === "administrador_sistema")
  if (!puedeAdministrar) {
    return json({ error: "Solo un administrador puede eliminar usuarios" }, 403)
  }

  let body: { id?: string }
  try { body = await req.json() } catch { return json({ error: "Cuerpo invalido" }, 400) }
  const id = String(body.id ?? "").trim()
  if (!id) return json({ error: "Falta el id" }, 400)

  if (id === user.id) {
    return json({ error: "No te podes eliminar a vos mismo" }, 400)
  }

  const { data: victima } = await admin
    .from("perfiles_usuario").select("nombre_completo, rol").eq("id", id).maybeSingle()
  if (!victima) return json({ error: "Ese usuario no existe" }, 404)

  // La barrera. Se mira el rol GUARDADO, no el que venga en el pedido.
  if (victima.rol === "administrador") {
    return json({
      error: `${victima.nombre_completo ?? "Esa cuenta"} es administrador, asi que no se elimina. `
        + "Es el rol de la cuenta de la asociacion. Si hay que sacarlo igual, "
        + "primero hay que cambiarle el rol.",
    }, 409)
  }

  // La FK de `perfiles_usuario` es ON DELETE CASCADE, asi que esto se lleva
  // tambien el perfil. Las de `ong_lotes` y `ong_pedidos` son SET NULL desde el
  // 31/08/2026: sus filas quedan, sin autor.
  const { error: eDel } = await admin.auth.admin.deleteUser(id)
  if (eDel) return json({ error: eDel.message }, 400)

  return json({ ok: true, id, nombre: victima.nombre_completo })
})
