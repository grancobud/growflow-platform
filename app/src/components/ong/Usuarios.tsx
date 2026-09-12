// Quién entra al sistema, con qué rol, y cómo se suma a alguien más.
//
// POR QUE ESTA PANTALLA IMPORTA MAS DE LO QUE PARECE
//
// El permiso `gestionar_usuarios` estaba declarado en `PERMISOS_ROL` desde el
// principio y no lo usaba nadie: había 114 policies en Postgres repartiendo el
// acceso entre seis roles, y UNA sola fila en `perfiles_usuario`. O sea que todo
// el sistema de permisos existía y no se podía usar, porque no había forma de
// crear al segundo usuario.
//
// Mientras eso siguiera así, cargar el CUIT, los 143 vencimientos de REPROCANN,
// las autoridades, los libros y las actas era trabajo de una sola persona.
//
// LO QUE NO SE PUEDE HACER DESDE ACA, A PROPOSITO
//
//   · Borrar a alguien. Se desactiva, y con eso no entra más. Borrarlo se lleva
//     puesta la autoría de todo lo que cargó, que es justamente lo que un libro
//     tiene que poder mostrar.
//   · Verle ni fijarle la contraseña. Se lo invita y él la elige en la pantalla
//     de clave. Una que el administrador conoce es una que después no prueba nada.
//   · Sacarse a uno mismo el rol o desactivarse. Es la única forma de quedarse
//     sin ningún administrador, y desde adentro de la app no habría vuelta.

import { useState, useEffect, useCallback } from 'react'
import { UserPlus, Mail, ShieldCheck, Clock, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  usuariosService, ROLES_ASIGNABLES, etiquetaDeRol, cuandoEntro, sePuedeEliminar,
  type Usuario,
} from '../../lib/usuarios'
import type { RolUsuario } from '../../types'
import { btnPrimario, btnSutil, btnIcono, rotuloSeccion, etiquetaCampo } from '../../lib/ui'
import { confirmarAccion, confirmarBorrado } from '../../lib/confirmar'

const campo = 'w-full min-h-[44px] px-3 rounded-lg bg-[#15151d] border border-[#2a2a3a] ' +
  'text-[13px] text-[#ececf1] placeholder:text-[#8a8a9c] focus:border-[#404d20] focus:outline-none'

export function Usuarios({ miId }: { miId: string | null }) {
  const [lista, setLista] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState(false)
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState<RolUsuario>('administrativo')
  const [invitando, setInvitando] = useState(false)

  const cargar = useCallback(async () => {
    try { setLista(await usuariosService.listar()) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo traer la lista') }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const invitar = async (e: React.FormEvent) => {
    e.preventDefault()
    setInvitando(true)
    try {
      await usuariosService.invitar(email.trim(), nombre.trim(), rol)
      toast.success(`Invitación enviada a ${email.trim()}`)
      setEmail(''); setNombre(''); setAbierto(false)
      await cargar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo invitar')
    } finally { setInvitando(false) }
  }

  const cambiarRol = async (u: Usuario, nuevo: RolUsuario) => {
    if (nuevo === u.rol) return
    try {
      await usuariosService.cambiarRol(u.id, nuevo)
      setLista(l => l.map(x => x.id === u.id ? { ...x, rol: nuevo } : x))
      toast.success(`${u.nombre_completo} ahora es ${etiquetaDeRol(nuevo).toLowerCase()}`)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'No se pudo cambiar') }
  }

  const alternar = async (u: Usuario) => {
    // `confirmarAccion` y NO `confirmarBorrado`: desactivar no borra nada. Es
    // el mismo caso que «Devolver» en Movimientos — el botón rojo y la palabra
    // «Borrar» dirían algo que no pasa. Ver §7.13 del traspaso.
    if (u.activo && !await confirmarAccion({
      titulo: `¿Desactivar a ${u.nombre_completo}?`,
      descripcion: 'No va a poder entrar más. Todo lo que cargó queda como está, con su nombre. '
        + 'Se puede reactivar cuando quieras.',
      confirmLabel: 'Desactivar',
    })) return
    try {
      await usuariosService.cambiarActivo(u.id, !u.activo)
      setLista(l => l.map(x => x.id === u.id ? { ...x, activo: !u.activo } : x))
    } catch (err) { toast.error(err instanceof Error ? err.message : 'No se pudo cambiar') }
  }

  // Eliminar SÍ es un borrado, así que va con `confirmarBorrado` —botón rojo y
  // la palabra «Borrar»— al revés que desactivar, que no borra nada.
  // Borrar dice ANTES qué queda sin autor.
  //
  // No para impedirlo —Gastón decidió que se pueda— sino para que la
  // consecuencia se vea del lado de acá de la confirmación. Lo que se pierde no
  // son las filas: desde el 31/08/2026 las FK de `ong_lotes` y `ong_pedidos`
  // son SET NULL, así que quedan. Lo que se pierde es el nombre de quien las
  // cargó, que es lo que un libro tiene que poder mostrar.
  //
  // El conteo se pide en el momento y no al listar: son seis consultas por
  // usuario y la pantalla se abre para mirar quién entra, no para borrar.
  const eliminar = async (u: Usuario) => {
    let arrastra: string
    try {
      arrastra = await usuariosService.loQueQuedaSinAutor(u.id)
    } catch {
      // Si el conteo falla, se sigue: no poder CONTAR lo que se pierde no es
      // razón para no poder borrar, pero sí para no afirmar que no se pierde nada.
      arrastra = 'No se pudo averiguar qué tiene cargado a su nombre.'
    }
    if (!await confirmarBorrado(
      `¿Eliminar a ${u.nombre_completo}?`,
      `${arrastra} Las filas quedan; lo que se pierde es su firma en ellas. `
      + 'Si sólo querés que no entre más, «Desactivar» hace eso y conserva la autoría. '
      + 'Para volver a sumarlo hay que invitarlo de nuevo.',
    )) return
    try {
      await usuariosService.eliminar(u.id)
      setLista(l => l.filter(x => x.id !== u.id))
      toast.success(`${u.nombre_completo} ya no está`)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'No se pudo eliminar') }
  }

  if (cargando) return <p className="text-[12px] text-[#8a8a9c]">Cargando…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-medium text-[#ececf1]">Usuarios</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[#a6a6b5]">
            Quién puede entrar y qué ve cada uno. El rol decide las pantallas que se le
            muestran; lo que puede leer de verdad lo decide la base, con las mismas reglas.
          </p>
        </div>
        <button onClick={() => setAbierto(v => !v)} className={`${btnPrimario} w-full sm:w-auto`}>
          <UserPlus className="w-3.5 h-3.5" /> Sumar a alguien
        </button>
      </div>

      {abierto && (
        <form onSubmit={invitar} className="rounded-lg border border-[#2a2a3a] bg-[#15151d] p-3 space-y-3">
          <div>
            <label className={etiquetaCampo} htmlFor="u-nombre">Nombre y apellido</label>
            <input id="u-nombre" value={nombre} onChange={e => setNombre(e.target.value)}
              className={campo} placeholder="Como firma en las actas" required minLength={2} />
          </div>
          <div>
            <label className={etiquetaCampo} htmlFor="u-email">Mail</label>
            <input id="u-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              className={campo} placeholder="donde le llega la invitación" required />
          </div>
          <div>
            <label className={etiquetaCampo} htmlFor="u-rol">Rol</label>
            <select id="u-rol" value={rol} onChange={e => setRol(e.target.value as RolUsuario)}
              className={campo}>
              {ROLES_ASIGNABLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#8a8a9c]">
              {ROLES_ASIGNABLES.find(r => r.id === rol)?.que}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={invitando} className={`${btnPrimario} w-full sm:w-auto`}>
              {invitando ? 'Enviando…' : 'Enviar invitación'}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className={`${btnSutil} w-full sm:w-auto`}>
              Cancelar
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-[#8a8a9c]">
            Le llega un mail con un enlace donde elige su contraseña. Vos no la ves ni la fijás.
          </p>
        </form>
      )}

      <div className="space-y-2">
        {lista.map(u => (
          <div key={u.id}
            className={`rounded-lg border p-3 ${u.activo
              ? 'border-[#2a2a3a] bg-[#15151d]' : 'border-[#2a2a3a]/60 bg-[#101017] opacity-60'}`}>
            <div className="flex flex-wrap items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#ececf1] break-words">
                  {u.nombre_completo}
                  {u.id === miId && <span className="ml-1.5 text-[11px] text-[#a3e635]">· vos</span>}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#8a8a9c] break-all">
                  <Mail className="w-3 h-3 flex-shrink-0" /> {u.email ?? '—'}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#8a8a9c]">
                  <Clock className="w-3 h-3 flex-shrink-0" /> {cuandoEntro(u.ultimo_acceso)}
                  {!u.activo && <span className="text-[#f0a5a5]">· desactivado</span>}
                </p>
              </div>
              {/* EL MISMO BLOQUE PARA LAS DOS FILAS, no dos diseños distintos.
                  Antes, en la fila propia el rol era una etiqueta de 19 px de
                  alto y en las demás un select de 44: las dos tarjetas se leían
                  distinto y ninguna quedaba a la altura de la otra.
                  Ahora las dos ocupan el mismo lugar y el mismo alto; lo único
                  que cambia es que una se puede tocar y la otra no.

                  `flex` y NO `flex-wrap`: en el teléfono el bloque es `w-full` y
                  los hijos median lo que medía su texto, así que terminaban en
                  283 sobre una tarjeta que llega a 351 — 68 px de aire muerto a
                  la derecha. Con `flex-1` en el select y `shrink-0` en los
                  botones, la fila llega al margen sola. */}
              {u.id === miId ? (
                // Sobre uno mismo no se puede: es la única forma de quedarse sin
                // ningún administrador, y desde adentro no habría vuelta.
                <span className={`${rotuloSeccion} w-full sm:w-auto sm:ml-auto flex items-center gap-1.5 min-h-[44px] sm:min-h-0 sm:pt-1`}>
                  <ShieldCheck className="w-3 h-3 flex-shrink-0" /> {etiquetaDeRol(u.rol)}
                </span>
              ) : (
                <div className="w-full sm:w-auto sm:ml-auto flex gap-2">
                  <select value={u.rol} onChange={e => cambiarRol(u, e.target.value as RolUsuario)}
                    aria-label={`Rol de ${u.nombre_completo}`}
                    className="flex-1 min-w-0 sm:flex-none min-h-[44px] px-2 rounded-lg bg-[#0f0f16] border border-[#2a2a3a] text-[12px] text-[#ececf1]">
                    {ROLES_ASIGNABLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    {!ROLES_ASIGNABLES.some(r => r.id === u.rol) &&
                      <option value={u.rol}>{u.rol}</option>}
                  </select>
                  <button onClick={() => alternar(u)} className={`${btnSutil} flex-shrink-0`}>
                    {u.activo ? 'Desactivar' : 'Reactivar'}
                  </button>
                  {/* A un `administrador` no. Es el rol de la cuenta de la
                      asociación, y es la única cuenta cuyo borrado no tiene
                      vuelta desde adentro de la app. `administrador_sistema` sí
                      se puede: es una persona que administra, y esa es la única
                      diferencia real entre los dos roles.

                      La regla se vuelve a mirar en la Edge Function: un botón
                      que no se muestra igual se puede llamar a mano. */}
                  {sePuedeEliminar(u) && (
                    <button onClick={() => eliminar(u)} aria-label={`Eliminar a ${u.nombre_completo}`}
                      title="Eliminar: las filas quedan, sin su firma"
                      className={`${btnIcono} flex-shrink-0 hover:text-[#ff8a7a]`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
