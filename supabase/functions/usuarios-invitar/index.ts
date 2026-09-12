// usuarios-invitar — el administrador suma a alguien al sistema.
//
// POR QUE ESTO EXISTE Y NO SE HACE DERECHO DESDE EL NAVEGADOR
//
// Crear una cuenta es la unica parte de la gestion de usuarios que necesita el
// service role: `auth.admin` no existe con la clave anonima, y la clave anonima
// esta en el bundle, o sea a la vista. Todo lo demas —listar, cambiar el rol,
// activar y desactivar— sale por RLS con las policies que ya estaban
// (`perfiles_admin` / `perfiles_ver`), asi que NO pasa por aca.
//
// Esa es la razon de que la funcion haga una sola cosa. Una que ademas listara
// y editara seria una superficie con service role mucho mas grande, para
// resolver algo que la base ya resuelve sola.
//
// QUIEN PUEDE LLAMARLA
//
// Va con verify_jwt = TRUE, al reves que `ingesta` y `solicitud-adjunto`: a esas
// las llama gente sin cuenta, a esta solo alguien que ya entro. Pero el gateway
// solo prueba que el token es valido, NO que sea de un administrador — con esa
// sola barrera, cualquiera con cuenta (un cultivador, la cuenta demo) podria
// crear administradores. Por eso ademas se lee el perfil de quien llama y se le
// exige uno de los dos roles con `gestionar_usuarios` —`administrador` o
// `administrador_sistema`— y que este `activo`.
//
// La verificacion usa un cliente con el token de la persona, no el service role:
// asi el que dice quien es es el token firmado, y no un id que venga en el body.
//
// LO QUE NO HACE, Y ES A PROPOSITO
//
//   · No fija ni manda contrasenas. Manda una invitacion, y la persona define su
//     clave en /clave la primera vez que entra. Una clave que viaja por mail o
//     que ve el administrador es una clave que despues nadie puede cambiar sin
//     que se sepa.
//   · No borra usuarios. Se desactivan, que deja el rastro de lo que hicieron.
//     Un borrado se lleva puesta la autoria de todo lo que esa persona cargo.
//   · No repara desprolijidades: si el mail ya tiene cuenta, avisa y no toca
//     nada. Reinvitar a alguien que ya entro le resetearia el acceso.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const URL_ = Deno.env.get("SUPABASE_URL")!
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })

// Los CUATRO headers que manda `supabase.functions.invoke`, no los dos obvios.
//
// Con solo "content-type, authorization" el navegador cortaba el pedido ANTES de
// enviarlo —el preflight pedia permiso para `x-client-info` y `apikey`, que el
// cliente de Supabase agrega solo— y la pantalla mostraba «Failed to send a
// request to the Edge Function». Ese mensaje no es un error de la funcion: es
// que la funcion nunca se entero. Por eso probar con curl daba 401 y parecia
// que todo estaba bien.
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

// Los mismos de PERMISOS_ROL en app/src/hooks/useAuth.ts, menos los dos viejos
// —`operador` y `supervisor`— que se conservan para filas existentes pero ya no
// se asignan. Esta duplicado a proposito: el front y el borde no comparten
// codigo, y este es el que de verdad decide lo que entra a la base.
//
// ⚠️ UN ROL NUEVO VIVE EN CUATRO LUGARES, Y ESTE ES EL QUE MAS SE OLVIDA:
//
//   1. `PERMISOS_ROL` y `ROLES_ASIGNABLES` en el front — lo que se dibuja.
//   2. Las funciones `puede_ver_*()` y las policies RLS — lo que la base deja.
//   3. El CHECK `perfiles_usuario_rol_check` — lo que se puede guardar.
//   4. ESTA LISTA — lo que se puede invitar.
//
// Los cuatro se olvidaron alguna vez. `administrador_sistema` no estaba en el
// 3 (se vio el 31/08/2026) y `mostrador` no estaba ni en el 3 ni en el 4 (se
// vio el 03/09/2026, la primera vez que se probo el rol EJECUTANDOLO). El
// patron es siempre el mismo: se olvida en el lugar que no se ejercita, y el
// lugar que no se ejercita es el alta — porque el rol nuevo se prueba mirando
// pantallas con una cuenta de administrador, no creando la cuenta.
const ROLES = [
  "administrador", "administrador_sistema", "administrativo", "mostrador",
  "cultivador", "director_cultivo", "director_medico", "auditor", "demo",
]

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "Metodo no permitido" }, 405)

  // 1. Quien llama. El token manda: un id en el body lo escribe cualquiera.
  const auth = req.headers.get("Authorization") ?? ""
  if (!auth.startsWith("Bearer ")) return json({ error: "Falta la sesion" }, 401)

  const comoLaPersona = createClient(URL_, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: auth } },
  })
  const { data: { user }, error: eUser } = await comoLaPersona.auth.getUser()
  if (eUser || !user) return json({ error: "Sesion invalida" }, 401)

  // 2. Y si ademas es administrador. El gateway no mira esto.
  const { data: quien } = await admin
    .from("perfiles_usuario").select("rol, activo").eq("id", user.id).maybeSingle()
  // Los DOS roles que tienen `gestionar_usuarios` en `PERMISOS_ROL`, no uno.
  //
  // Estaba pidiendo `administrador` a secas, asi que `administrador_sistema`
  // veia la pestana Usuarios, tocaba Invitar y se comia un 403. Y la funcion
  // hermana —`usuarios-eliminar`— ya aceptaba a los dos: podia BORRAR usuarios
  // y no podia sumarlos. Se descubrio el 03/09/2026 revisando esta lista por el
  // rol `mostrador`, que faltaba en ROLES.
  const puedeGestionar = quien
    && ["administrador", "administrador_sistema"].includes(quien.rol)
    && quien.activo
  if (!puedeGestionar) {
    return json({ error: "Solo un administrador puede sumar usuarios" }, 403)
  }

  let body: { email?: string; nombre?: string; rol?: string }
  try { body = await req.json() } catch { return json({ error: "Cuerpo invalido" }, 400) }

  // `auth.users` guarda el mail en minusculas: normalizar aca evita que el
  // mismo mail entre dos veces con distinta capitalizacion.
  const email = String(body.email ?? "").trim().toLowerCase()
  const nombre = String(body.nombre ?? "").trim()
  const rol = String(body.rol ?? "").trim()

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Ese mail no parece un mail" }, 400)
  if (nombre.length < 2) return json({ error: "Falta el nombre" }, 400)
  if (!ROLES.includes(rol)) return json({ error: "Ese rol no existe" }, 400)

  // 3. Si ya tiene cuenta, no se la toca: reinvitar resetea el acceso de alguien
  //    que quiza ya esta trabajando.
  const { data: yaEsta } = await admin
    .from("perfiles_usuario").select("id").eq("email", email).maybeSingle()
  if (yaEsta) return json({ error: "Ese mail ya tiene un usuario en el sistema" }, 409)

  const { data: invitado, error: eInv } = await admin.auth.admin.inviteUserByEmail(email)
  if (eInv || !invitado?.user) {
    return json({ error: eInv?.message ?? "No se pudo enviar la invitacion" }, 400)
  }

  // 4. El perfil. UPSERT y no insert, y esto no es un detalle:
  //
  //    el trigger `al_crear_usuario` de `auth.users` YA creo la fila apenas se
  //    creo la cuenta, con rol `auditor` y `activo` en FALSE. Con un insert,
  //    esto chocaba por clave duplicada, caia en el rollback de abajo y BORRABA
  //    al usuario que se acababa de invitar: invitar no funcionaba nunca, y el
  //    unico rastro era un «duplicate key» en la pantalla.
  //
  //    Que el trigger ponga `auditor` + inactivo es lo correcto para una cuenta
  //    que aparece sola —la que se crea a mano desde el panel de Supabase no
  //    deberia entrar a nada hasta que alguien decida que rol tiene—. Acá el
  //    rol lo eligio un administrador, asi que se pisa con eso.
  const { error: ePerfil } = await admin.from("perfiles_usuario").upsert({
    id: invitado.user.id, nombre_completo: nombre, rol, activo: true, email,
  }, { onConflict: "id" })
  if (ePerfil) {
    // La FK de `perfiles_usuario` es ON DELETE CASCADE, asi que esto se lleva
    // tambien la fila que dejo el trigger. No queda nada a medias.
    await admin.auth.admin.deleteUser(invitado.user.id)
    return json({ error: `No se pudo crear el perfil: ${ePerfil.message}` }, 400)
  }

  return json({ ok: true, id: invitado.user.id, email, nombre, rol })
})
