// Si la persona llegó por un enlace de invitación o de recuperación.
//
// POR QUE SE LEE ACA Y NO EN UN COMPONENTE
//
// Supabase pone el token en el HASH de la URL (`#access_token=…&type=invite`),
// lo canjea por una sesión y después LIMPIA el hash. Para cuando un componente
// se monta, el `type` ya no está: la persona queda adentro de la app con sesión
// y sin contraseña, sin que nada le avise. Entra una vez y no puede volver a
// entrar nunca, porque no hay clave con la cual.
//
// Esto se lee al importar el módulo, o sea antes de que el cliente de Supabase
// procese el hash. `main.tsx` lo importa primero por eso.
//
// `invite` es el usuario nuevo; `recovery` es «olvidé mi contraseña». Los dos
// terminan en el mismo lugar —definir una clave— así que se tratan igual.

const hash = typeof window !== 'undefined' ? window.location.hash : ''
const params = new URLSearchParams(hash.replace(/^#/, ''))
const tipo = params.get('type')

/** Qué clase de enlace lo trajo, o null si entró normalmente. */
export const TIPO_DE_ENLACE: 'invite' | 'recovery' | null =
  tipo === 'invite' || tipo === 'recovery' ? tipo : null

/** Si hay que pedirle que defina su contraseña antes de dejarlo pasar. */
export const LLEGO_POR_ENLACE = TIPO_DE_ENLACE !== null

// EL ENLACE VENCIDO TAMBIEN LLEGA POR ACA, Y ANTES NO SE MIRABA (10/09/2026)
//
// Cuando el enlace expiró, Supabase NO manda `type`: manda
// `#error=access_denied&error_code=otp_expired&error_description=…`.
// Como acá sólo se leía `type`, `LLEGO_POR_ENLACE` daba false y la persona
// caía en el login normal — donde escribe una contraseña que su cuenta
// todavía no tiene y no pasa absolutamente nada. Sin error en consola y sin
// nada roto: la forma más cara de fallar, porque parece que el problema es suyo.
//
// Pasó de verdad: dos invitaciones sin usar, y `mailer_otp_exp` está en 3600,
// o sea que el enlace vive UNA HORA. Un mail que se abre a la tarde ya no sirve.
//
// El código importa: `otp_expired` se arregla pidiendo otra invitación, y eso
// es lo único que la persona puede hacer. Cualquier otro error es distinto y no
// se le promete el mismo remedio.
const codigoError = params.get('error_code')
const hayError = params.get('error') !== null

/** El enlace llegó vencido o ya usado. Se arregla pidiendo uno nuevo. */
export const ENLACE_VENCIDO = codigoError === 'otp_expired'

/** Llegó por un enlace que falló por cualquier otro motivo. */
export const ENLACE_FALLIDO = hayError && !ENLACE_VENCIDO

/**
 * Lo que Supabase dijo, para no inventarle un motivo cuando no es el vencimiento.
 * Viene URL-encodeado con `+` en vez de espacios.
 */
export const MOTIVO_DEL_ERROR = (params.get('error_description') ?? '').replace(/\+/g, ' ')
