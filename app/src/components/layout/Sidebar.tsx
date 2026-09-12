// Sidebar — version personal simplificada.
// Solo las secciones adaptadas al esquema del cultivo personal.

import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LayoutDashboard, LogOut, Sprout, Table2, BarChart3, KeyRound, Calculator, Building2, BookOpen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../hooks/useAuth'
import { etiquetaDeRol } from '../../lib/usuarios'
import { Marca, IsotipoSolo } from '../Marca'
import { tienePin, quitarPin } from '../../lib/pin'
import PinLock from '../PinLock'

// `alias`: otras rutas que pertenecen al mismo item. Agronomico agrupa seis
// vistas bajo URLs propias, y sin esto el menú se apaga al cambiar de pestaña.
type Item = {
  nombre: string; ruta: string; icono: LucideIcon; alias?: string[]; permiso?: string
  /**
   * Que este item cuelga del de arriba.
   *
   * la asociación pidio que Econometria fuera un submenu de O.N.G. Se dibuja indentado
   * y en un cuerpo mas chico, y NO se fusiona la pantalla: `PaginaONG` carga la
   * base entera al montar —41 consultas medidas el 29/08— y meterle adentro los
   * costos haria que entrar a Costos pagara todo eso. La pertenencia es de
   * navegacion, asi que se resuelve en la navegacion.
   */
  sub?: boolean
}

export default function Sidebar({ colapsado: colapsadoProp }: { colapsado?: boolean } = {}) {
  const { usuario, logout, tienePermiso } = useAuth()
  const location = useLocation()
  const [ancho, setAncho] = useState<number>(0)
  const [ref, setRef] = useState<HTMLElement | null>(null)
  const [configPin, setConfigPin] = useState(false)
  const [hayPin, setHayPin] = useState(tienePin())

  useEffect(() => {
    if (!ref) return
    const obs = new ResizeObserver(entries => { for (const e of entries) setAncho(e.contentRect.width) })
    obs.observe(ref)
    return () => obs.disconnect()
  }, [ref])

  const colapsado = colapsadoProp ?? (ancho > 0 && ancho < 140)

  const inicial = usuario?.nombre_completo?.charAt(0)?.toUpperCase() || '?'
  const nombre = usuario?.nombre_completo || 'Cargando...'

  // Cada seccion declara que permiso necesita. Sin permiso no se muestra: entrar
  // a una pantalla que devuelve vacio parece un error del sistema, no una
  // restriccion. Solo Manual va sin permiso: lo lee cualquiera que entre.
  const todos: Item[] = [
    { nombre: 'Panel', ruta: '/', icono: LayoutDashboard, permiso: 'ver_panel' },
    // AGRONOMICO: eran tres items para un solo responsable. Cultivo, Cosecha y
    // Ambiente son la misma planta en tres momentos, y de los tres responde el
    // Director Tecnico. Las seis vistas viven ahora bajo `PaginaAgronomico`, con
    // su barra de secciones; el menu deja de repetir lo que esa barra ya dice.
    // Entra por `/sala` y no por `/plantas`: es la primera seccion del modulo
    // desde el 02/09, y el menu tiene que llevar a lo mismo que abre la barra.
    { nombre: 'Agronómico', ruta: '/sala', icono: Sprout, permiso: 'ver_cultivo',
      alias: ['/plantas', '/geneticas', '/linea-tiempo', '/cultivo', '/agronomico', '/cosecha', '/ambiente'] },
    { nombre: 'O.N.G.', ruta: '/ong', icono: Building2, permiso: 'ver_ong', alias: ['/registro'] },
    { nombre: 'Econometría', ruta: '/econometria', icono: Calculator, permiso: 'ver_econometria', alias: ['/stock'], sub: true },
    { nombre: 'Estadísticas', ruta: '/stats', icono: BarChart3, permiso: 'ver_estadisticas' },
    { nombre: 'Tablas', ruta: '/tablas', icono: Table2, permiso: 'ver_tablas' },
    { nombre: 'Manual', ruta: '/manual', icono: BookOpen },
  ]

  const items: Item[] = todos.filter(i => !i.permiso || tienePermiso(i.permiso))

  const togglePin = () => {
    if (hayPin) {
      quitarPin(); setHayPin(false); toast.success('PIN desactivado')
    } else {
      setConfigPin(true)
    }
  }

  const renderItem = (item: Item) => {
    const rutas = [item.ruta, ...(item.alias ?? [])]
    const isActive = rutas.some(r => location.pathname === r || (r !== '/' && location.pathname.startsWith(r)))
    return (
      <NavLink
        key={item.ruta}
        to={item.ruta}
        title={colapsado ? item.nombre : undefined}
        /* `min-h-[44px] sm:min-h-0` en el estado expandido: medía 36px, y
           expandido es justamente como se ve en el teléfono —el sidebar es el
           cajón que se abre con el botón de menú—, o sea que estos son los
           renglones con los que se navega toda la app con el pulgar. Colapsado
           no hace falta: eso sólo existe de `sm` para arriba, con mouse. */
        /* Un submenu se corre a la derecha y baja medio punto de cuerpo: es lo
           que se lee como «esto cuelga de lo de arriba» sin dibujar una linea
           ni un arbol. Colapsado no se indenta —ahi solo entra el icono— ni se
           achica, que lo dejaria ilegible. */
        className={`relative flex items-center ${
          colapsado ? 'flex-col justify-center py-2.5 px-1'
            : `gap-2.5 py-2 min-h-[44px] sm:min-h-0 ${item.sub ? 'pl-7 pr-3 text-[11.5px]' : 'px-3 text-[12px]'}`
        } rounded-lg transition duration-200 ${
          isActive
            ? 'bg-[#a3e635]/12 border border-[#404d20] text-[#d9f99d] font-medium'
            : 'border border-transparent text-[#a6a6b5] hover:bg-[#15151d] hover:text-[#ececf1]'
        }`}
      >
        <item.icono className="w-4 h-4 flex-shrink-0" strokeWidth={isActive ? 2 : 1.7} />
        {colapsado ? (
          <span className="text-[10px] mt-1 leading-tight text-center truncate max-w-full">{item.nombre}</span>
        ) : (
          <span className="flex-1 truncate font-sans">{item.nombre}</span>
        )}
      </NavLink>
    )
  }

  return (
    <aside
      ref={setRef}
      className="h-full w-full bg-[#0a0a0f] text-[#d4d4dd] flex flex-col overflow-hidden font-sans"
    >
      {/* Logo */}
      {/* Sin borde inferior: los headers de página con pestañas caen ~33px más
          abajo que esta línea y el escalón quedaba a la vista. */}
      <div className="px-3 sm:px-4 pt-4 pb-3.5 flex-shrink-0">
        <div className="flex items-center justify-center w-full">
          {/* Colapsado solo entra el isotipo; expandido, la marca apilada.
              En fila no entra: con 240px de sidebar el nombre parte en dos
              lineas y el logo de la asociación queda pegado al borde derecho, sin
              aire. Apilada se lee como una pieza y queda centrada. */}
          {colapsado
            ? <IsotipoSolo />
            : <Marca tamano="sm" centrado />}
        </div>
      </div>

      {/* Nav */}
      <nav className="ct-sidebar-nav flex-1 px-2.5 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {items.map(renderItem)}
      </nav>

      {/* Footer usuario */}
      <div className={`px-3 py-3 border-t border-[#1f1f2b] flex-shrink-0 flex items-center ${colapsado ? 'justify-center' : 'gap-2.5'}`}>
        <div className="w-9 h-9 rounded-full bg-[#a3e635]/15 border border-[#404d20] flex items-center justify-center flex-shrink-0 text-[13px] font-display font-bold text-[#d9f99d]">
          {inicial}
        </div>
        {!colapsado && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#ececf1] truncate leading-tight">{nombre}</p>
              {/* El ROL de quien entro, no la palabra «Cultivador» escrita a mano.
                  Estuvo fija desde siempre: al administrador tambien le decia
                  «Cultivador». Se noto recien el 30/08/2026, probando el primer
                  usuario que no era el dueno de la instalacion — que es cuando
                  un cartel que miente empieza a importar. */}
              <p className="text-[10px] mt-0.5 font-medium text-[#a78bfa]">
                {usuario?.rol ? etiquetaDeRol(usuario.rol) : '—'}
              </p>
            </div>
            <button
              onClick={togglePin}
              className={`min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1.5 rounded-lg transition-colors flex-shrink-0 hover:bg-[#15151d] ${hayPin ? 'text-[#bef264]' : 'text-[#8a8a9c] hover:text-[#a6a6b5]'}`}
              title={hayPin ? 'PIN activo (tocá para desactivar)' : 'Configurar PIN de desbloqueo'}
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={logout}
              className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1.5 text-[#8a8a9c] hover:text-[#ff8a7a] hover:bg-[#15151d] rounded-lg transition-colors flex-shrink-0"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
      {configPin && (
        <PinLock modo="configurar"
          onListo={() => { setConfigPin(false); setHayPin(true); toast.success('PIN configurado') }}
          onCancelar={() => setConfigPin(false)} />
      )}
    </aside>
  )
}
