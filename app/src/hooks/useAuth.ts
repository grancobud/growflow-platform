import { useCallback, useSyncExternalStore } from 'react'
import { authService } from '../lib/servicios'
import type { PerfilUsuario, RolUsuario } from '../types'

// Permisos por rol.
//
// Esto decide QUE SE VE en la app. Quien puede leer cada dato lo decide el RLS
// de Postgres, que es la barrera de verdad: aca se ocultan las secciones para
// que nadie entre a una pantalla que le va a devolver vacio y parezca rota.
//
// Los permisos son por area, no por pantalla: una pantalla nueva del area de
// cultivo no obliga a tocar este mapa.
//
// Se EXPORTA para poder testear la relación entre roles. `administrador_sistema`
// tiene que ser exactamente `administrador` menos los permisos de plata, y eso
// sólo se puede afirmar comparando las dos listas: escritas aparte, la de abajo
// se queda vieja el día que la de arriba gane un permiso.
export const PERMISOS_ROL: Record<RolUsuario, string[]> = {
  administrador: [
    'ver_panel', 'ver_cultivo', 'editar_cultivo', 'ver_ambiente',
    'ver_cosecha', 'ver_estadisticas',
    'ver_ong', 'ver_institucional', 'ver_mostrador', 'ver_cumplimiento',
    'ver_clinico', 'editar_clinico',
    'ver_plata', 'ver_econometria', 'editar_plata', 'editar_cuotas',
    'ver_tablas', 'gestionar_usuarios',
  ],
  // Administra TODO. El nombre lo dice: es el administrador del sistema.
  //
  // NACIO DISTINTO Y SE CAMBIO A PROPOSITO. El 30/08/2026 se creo como
  // «administra todo MENOS la caja», y esa misma tarde Gaston lo cambio: ve
  // todo, plata incluida.
  //
  // CONSECUENCIA, PARA QUE NADIE BUSQUE DESPUES UNA DIFERENCIA QUE NO EXISTE:
  // hoy este rol es funcionalmente IDENTICO a `administrador`. Misma lista acá,
  // mismas tablas en el RLS. La diferencia es de etiqueta —cual es la cuenta de
  // la asociacion y cual una persona que administra—, no de acceso.
  //
  // Si alguna vez tienen que separarse de verdad, el lugar es este mapa Y
  // `puede_ver_plata()` / `puede_ver_clinico()` en Postgres. Tocar solo uno de
  // los dos deja una pantalla que se muestra y una base que devuelve cero, que
  // es como se ve un permiso mal hecho: rota, no prohibida.
  administrador_sistema: [
    'ver_panel', 'ver_cultivo', 'editar_cultivo', 'ver_ambiente',
    'ver_cosecha', 'ver_estadisticas',
    'ver_ong', 'ver_institucional', 'ver_mostrador', 'ver_cumplimiento',
    'ver_clinico', 'editar_clinico',
    'ver_plata', 'ver_econometria', 'editar_plata', 'editar_cuotas',
    'ver_tablas', 'gestionar_usuarios',
  ],
  // QUIEN ABRE LA SEDE. Lo definio Socio el 02/09/2026 mirando el panel:
  // «para que abra la sede, tome los valores de las salas, haga control de
  // stock, dinero y pueda hacer las tareas de los botones».
  //
  // Es una lista corta a proposito y cada permiso esta por una razon:
  //
  //   ver_panel        la rutina de apertura, que es su pantalla
  //   ver_ambiente     tomar los valores de la sala (paso 1)
  //   ver_plata        ver la caja y arquearla (paso 2)
  //   editar_plata     anotar lo que cobra y lo que gasta
  //   ver_ong          para llegar al mostrador
  //   ver_mostrador    entregar, el catalogo y las visitas — y NADA del estatuto
  //
  // NO tiene `ver_institucional`: eso abriria entidad, libros, actas, socios y
  // solicitudes, que no son su trabajo. Es la misma separacion que ya se hizo
  // con `ver_cumplimiento` para el director de cultivo, y por el mismo motivo:
  // un rol necesitaba TRES pestanas y darselas costaba abrirle dieciseis.
  //
  // Tampoco ve el cultivo: el paso 1 es cargar una lectura de ambiente, no
  // mirar las sesenta plantas.
  mostrador: [
    'ver_panel', 'ver_ambiente',
    'ver_ong', 'ver_mostrador',
    'ver_plata', 'editar_plata',
  ],
  // Trabaja la sala. No ve fichas clinicas ni cuanto cuesta producir.
  cultivador: [
    'ver_panel', 'ver_cultivo', 'editar_cultivo', 'ver_ambiente',
    'ver_cosecha', 'ver_estadisticas',
  ],
  // El responsable tecnico del cultivo (Res. 1780). Es el `cultivador` MAS lo
  // que hay que firmar por el cultivo: traslados, declaraciones juradas y
  // predios. Responde por el material que SALE del predio, asi que la carta de
  // porte es suya.
  //
  // TIENE `ver_ong` PERO NO `ver_institucional`. Esa es toda la gracia del
  // rol: la seccion de la O.N.G. existe para el, pero adentro ve TRES pestanas
  // —Cupo, Declaraciones y Predios— y no las dieciseis. Sin esa separacion,
  // darle acceso a Declaraciones le habria abierto tambien Pacientes,
  // Solicitudes, Asociados, Portal y Dispensas, casi todas devolviendole cero
  // filas: pantallas vacias, que se leen como rotas.
  //
  // NO ve plata ni fichas clinicas. Un responsable tecnico responde por las
  // plantas, no por la caja ni por el diagnostico de nadie.
  director_cultivo: [
    'ver_panel', 'ver_cultivo', 'editar_cultivo', 'ver_ambiente',
    'ver_cosecha', 'ver_estadisticas',
    'ver_ong', 'ver_cumplimiento',
  ],
  // Pacientes, seguimiento e informes. Mira el cultivo pero no lo toca.
  //
  // NO VE PLATA, y eso incluye `ong_documentos`. Hasta el 31/08/2026 esa tabla
  // lo tenia agregado a mano en la policy de lectura: 1.551 comprobantes,
  // $152,8M, con las retribuciones de los socios adentro. Se cerro.
  //
  // Se miro si habia una mitad clinica que preservar ahi y no la hay: las 1.551
  // filas tienen monto. Las credenciales de REPROCANN y los informes viven en
  // columnas de `pacientes` y en el bucket `documentos`, no en esa tabla.
  director_medico: [
    'ver_panel', 'ver_cultivo', 'ver_ambiente', 'ver_cosecha', 'ver_estadisticas',
    'ver_ong', 'ver_institucional', 'ver_mostrador', 'ver_cumplimiento',
    'ver_clinico', 'editar_clinico',
  ],
  // Cuotas, caja, documentos y costos, y el PADRON COMPLETO.
  //
  // Hasta el 31/08/2026 el comentario aca decia «ve a los pacientes por nombre,
  // sin ficha» y era falso: `pacientes` estaba en `puede_ver_clinico()` y le
  // devolvia CERO filas. Como la pestana Pacientes no esta filtrada por permiso
  // —solo lo estan Usuarios y las de plata— la pantalla se le mostraba vacia,
  // que es como se ve una rota, no una prohibida. Llevaba las cuotas sin poder
  // decir de quien era ninguna de las 1.248 entregas.
  //
  // Gaston decidio darle el padron entero. En la base es `puede_ver_padron()`,
  // que es `puede_ver_clinico()` MAS este rol. La funcion es nueva y separada a
  // proposito: `puede_ver_clinico()` tambien gobierna `ong_feedback_clinico`
  // —el seguimiento medico— y ahi este rol NO entra.
  administrativo: [
    'ver_panel', 'ver_cultivo', 'ver_ambiente', 'ver_cosecha', 'ver_estadisticas',
    'ver_ong', 'ver_institucional', 'ver_mostrador', 'ver_cumplimiento',
    'ver_clinico', 'editar_clinico',
    'ver_plata', 'ver_econometria', 'editar_plata', 'editar_cuotas',
  ],
  // Entra a mirar: ve todo lo que no es dato de salud, y no modifica nada.
  auditor: [
    'ver_panel', 'ver_cultivo', 'ver_ambiente', 'ver_cosecha', 'ver_estadisticas',
    'ver_ong', 'ver_institucional', 'ver_mostrador', 'ver_cumplimiento',
    'ver_plata', 'ver_econometria',
  ],

  // La cuenta publica de muestra.
  //
  // Muestra COMO se usa el sistema, no que datos tiene: entra y ve las pantallas
  // reales, vacias. Ni una planta, ni un costo, ni el nombre de un paciente. Que
  // se vean vacias no lo decide este mapa sino el RLS, que le devuelve cero filas.
  //
  // Econometria entra por 'ver_econometria' y no por 'ver_plata': asi ve la
  // pantalla de costos sin que se le abran ademas Instalacion y los presupuestos.
  //
  // 'ver_cultivo' le abre tambien Calendario, la Calculadora y la ficha por QR.
  // Las tres estan bien en una demo: las dos primeras se ven vacias, y la ficha
  // no llega a ninguna planta porque el RLS no le devuelve ninguna.
  demo: [
    'ver_panel', 'ver_cultivo', 'ver_ambiente',
    'ver_cosecha', 'ver_estadisticas', 'ver_econometria',
    'ver_ong', 'ver_institucional', 'ver_mostrador', 'ver_cumplimiento',
  ],
}

// A donde cae cada uno despues de entrar: a lo que vino a hacer.
export const RUTA_DEFAULT_ROL: Record<RolUsuario, string> = {
  administrador: '/',
  administrador_sistema: '/',
  // El panel ES su pantalla: la rutina de apertura. Es el unico rol para el que
  // el panel no es un resumen sino el trabajo.
  mostrador: '/',
  cultivador: '/sala',
  // Entra por las plantas, igual que el cultivador: lo institucional es lo que
  // firma de vez en cuando, no a lo que viene todos los dias.
  director_cultivo: '/sala',
  director_medico: '/ong',
  administrativo: '/econometria',
  auditor: '/',
  demo: '/',
}

// ---------------------------------------------------------------------------
// UNA SOLA SESION PARA TODA LA APP
//
// ⚠️ EL ESTADO VIVE EN EL MODULO, NO EN CADA COMPONENTE, Y ESO ES EL ARREGLO.
//
// `useAuth()` se llama en DIEZ lugares —App dos veces, Sidebar,
// RutaConPermiso, QueQuieroHacer y cinco pantallas—. Con el estado en un
// `useState` local, cada uno de esos diez tenía su propia copia del perfil, su
// propia consulta y SU PROPIA SUSCRIPCION a `onAuthChange`. Un solo evento de
// sesión disparaba diez recargas.
//
// El 29/08/2026 esto se tapó desde abajo, en `authService.getPerfil`: una
// caché de 5 segundos más un deduplicador de llamadas simultáneas. Bajó de 21
// consultas a unas pocas, y el comentario que quedó ahí dice exactamente esto:
// «mover el hook a un contexto es el arreglo de fondo, pero toca la estructura
// de los componentes y hoy no es el día». Este es el día.
//
// Medido en producción el 04/09/2026, ya con aquel parche puesto:
// `perfiles_usuario` seguía saliendo a los 1.585 ms, 2.989, 5.590 y 7.567 —una
// cada dos segundos, para siempre, sin que nadie tocara nada—.
//
// NO ES UN CONTEXTO, y es a propósito: un provider obliga a envolver el árbol y
// a tocar los diez llamadores. Un store de módulo con `useSyncExternalStore`
// —que es de React y está hecho justo para esto— deja la firma del hook
// intacta: los diez lugares siguen escritos igual.
//
// LO SEGUNDO QUE ARREGLA, y pesa tanto como lo primero: el evento de sesión ya
// no recarga el perfil si el usuario es EL MISMO. Supabase reemite la sesión al
// refrescar el token y al volver a la pestaña; eso no cambia quién sos.
// ---------------------------------------------------------------------------

interface EstadoAuth {
  usuario: PerfilUsuario | null
  cargando: boolean
  autenticado: boolean
}

let estado: EstadoAuth = { usuario: null, cargando: true, autenticado: false }
const oyentes = new Set<() => void>()
/** El id de sesión con el que se cargó el perfil que hay en `estado`. */
let idDeLaSesion: string | null = null
let cargaEnVuelo: Promise<void> | null = null
let suscripcion: { unsubscribe: () => void } | null = null

/**
 * Publica un estado NUEVO. El objeto se reemplaza entero a propósito:
 * `useSyncExternalStore` compara por referencia para decidir si vuelve a
 * pintar, así que mutar el que ya está no repintaría nada.
 */
function publicar(cambio: Partial<EstadoAuth>) {
  estado = { ...estado, ...cambio }
  for (const avisar of oyentes) avisar()
}

/**
 * Trae el perfil. Las llamadas simultáneas comparten una sola: diez
 * componentes montando a la vez hacen UNA consulta.
 */
function cargarPerfil(): Promise<void> {
  if (cargaEnVuelo) return cargaEnVuelo
  cargaEnVuelo = (async () => {
    try {
      const session = await authService.getSession()
      if (session) {
        idDeLaSesion = session.user.id
        publicar({ usuario: await authService.getPerfil(), autenticado: true, cargando: false })
      } else {
        idDeLaSesion = null
        publicar({ usuario: null, autenticado: false, cargando: false })
      }
    } catch {
      idDeLaSesion = null
      publicar({ usuario: null, autenticado: false, cargando: false })
    } finally {
      cargaEnVuelo = null
    }
  })()
  return cargaEnVuelo
}

/**
 * Arranca la escucha de sesión. Se llama en cada suscripción y sale sola si ya
 * está andando: UNA suscripción para toda la app.
 *
 * No se da de baja nunca, y es correcto: la sesión dura lo que dura la pestaña,
 * y bajarla cuando se desmonta el último componente dejaría a la app sorda a un
 * logout hecho en otra pestaña.
 */
/**
 * Si un evento de sesión obliga a traer el perfil de nuevo.
 *
 * ⚠️ EL MISMO USUARIO NO SE VUELVE A PEDIR. Supabase reemite la sesión al
 * refrescar el token —cada pocos minutos— y al volver a la pestaña. Nada de eso
 * cambia quién sos ni qué podés ver: pedir el perfil otra vez es una consulta
 * que no aporta y, peor, tira la caché de `getPerfil`, así que el siguiente que
 * lo pida vuelve a la red. Medido en producción el 04/09/2026:
 * `perfiles_usuario` salía a los 1.585 ms, 2.989, 5.590 y 7.567, en loop.
 *
 * Si el id CAMBIO es otra persona, y ahí sí hay que traer todo.
 *
 * Está afuera del hook para poder probarla: es la regla que decide cuántas
 * consultas hace la app, y una regla así no se verifica leyéndola.
 *
 * @param sesion   La sesión que trajo el evento, o null si se cerró.
 * @param cargadoId El id con el que se cargó el perfil que ya está en memoria.
 * @param hayPerfil Si ese perfil llegó a cargarse. Un id sin perfil es una
 *                  carga que falló, y hay que reintentarla.
 */
export function hayQueRecargarPerfil(
  sesion: { user: { id: string } } | null,
  cargadoId: string | null,
  hayPerfil: boolean,
): boolean {
  if (!sesion) return false
  return sesion.user.id !== cargadoId || !hayPerfil
}

function arrancar() {
  if (suscripcion) return
  suscripcion = authService.onAuthChange((_evento, session) => {
    if (!session) {
      idDeLaSesion = null
      publicar({ usuario: null, autenticado: false, cargando: false })
      return
    }
    if (hayQueRecargarPerfil(session, idDeLaSesion, estado.usuario != null)) cargarPerfil()
  }).data.subscription
  cargarPerfil()
}

const suscribir = (avisar: () => void) => {
  oyentes.add(avisar)
  arrancar()
  return () => { oyentes.delete(avisar) }
}
const leer = () => estado

export function useAuth() {
  const { usuario, cargando, autenticado } = useSyncExternalStore(suscribir, leer, leer)

  const login = async (email: string, password: string) => {
    await authService.login(email, password)
    // Fuerza la recarga: `login` cambia de usuario, así que el atajo del «mismo
    // id» no tiene que aplicar. `idDeLaSesion` todavía tiene el anterior (o
    // null), así que el evento igual recargaría; esto sólo hace que el `await`
    // del llamador espere a tener el perfil, que es lo que la pantalla de login
    // necesita para saber a dónde mandarlo.
    idDeLaSesion = null
    await cargarPerfil()
  }

  const logout = async () => {
    await authService.logout()
    idDeLaSesion = null
    publicar({ usuario: null, autenticado: false, cargando: false })
  }

  // El rol sale a su propia constante y las dos funciones dependen de ELLA.
  //
  // Dependian de `usuario?.rol` escrito adentro del array, y con el estado
  // viniendo de `useSyncExternalStore` el compilador de React deja de poder
  // demostrar que eso es equivalente: infiere que dependen de `usuario` entero
  // y avisa que no puede conservar la memoizacion. Un rol es un string; con el
  // string a la vista la dependencia es exacta y las funciones se rehacen solo
  // cuando el rol cambia de verdad, que es lo que siempre se quiso.
  const rol = usuario?.rol ?? null

  const tienePermiso = useCallback((accion: string): boolean => {
    if (!rol) return false
    return PERMISOS_ROL[rol]?.includes(accion) ?? false
  }, [rol])

  const esRol = useCallback((...roles: RolUsuario[]): boolean => {
    if (!rol) return false
    return roles.includes(rol)
  }, [rol])

  return { usuario, cargando, autenticado, login, logout, tienePermiso, esRol }
}
