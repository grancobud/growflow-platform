// Agronómico — todo lo que pasa con la planta, en un solo lugar.
//
// Se llamaba Cultivo y agrupaba cuatro vistas. El 02/09/2026 la asociación pidió que
// Cosecha y Ambiente entraran también: es lo mismo mirado en otro momento del
// ciclo —la planta, lo que da, y el aire donde lo da— y es de lo que responde
// el Director Técnico. Eran tres ítems de menú separados para un solo
// responsable, y pasar de la sala al rinde obligaba a volver al menú.
//
// EL PERMISO SIGUE SIENDO DE CADA SECCIÓN, no del módulo. Hoy los tres
// —`ver_cultivo`, `ver_ambiente`, `ver_cosecha`— van juntos en todos los roles,
// así que agrupar no cambia el acceso de nadie. Pero atarlos a uno solo dejaría
// la puerta abierta a que mañana alguien con `ver_cosecha` y sin `ver_cultivo`
// se quede sin su pantalla porque el módulo pide otra cosa. La pestaña que no
// te corresponde no se muestra: una que lleva a un cartel de prohibido se lee
// como rota.

import { Sprout, Dna, CalendarRange, Droplets, Scissors, Activity, ClipboardList } from 'lucide-react'
import { lazyWithRetry } from '../lib/lazyWithRetry'
import { PestanasSeccion, type Seccion } from '../components/layout/PestanasSeccion'
import { BotoneraCultivo } from '../components/BotoneraCultivo'
import { useAuth } from '../hooks/useAuth'

// Cada sección sigue siendo su propio chunk: entrar por Plantas no descarga las
// otras cinco. Con retry, igual que el resto del router.
const SECCIONES: readonly (Seccion & { permiso: string })[] = [
  // SALA PRIMERO, y no Plantas. Lo pidió Socio el 02/09: «lo primero que
  // debería aparecer en cultivo es las salas, luego la tarea a realizar».
  //
  // Es el orden en que se para alguien frente al cultivo: primero dónde estás,
  // después qué hacés ahí. Plantas es la lista completa de las sesenta, que
  // sirve para buscar una — no para empezar.
  { ruta: '/sala', label: 'Sala', icono: Droplets, permiso: 'ver_cultivo', Vista: lazyWithRetry(() => import('./PaginaSala'), 'PaginaSala') },
  // El plan va DESPUÉS de la sala y no antes: la sala es a lo que se entra todos
  // los días, y el plan se toca una vez por ciclo. Pero va en el módulo, no
  // escondido en O.N.G., porque es lo que declara este cultivo.
  { ruta: '/plan', label: 'Plan', icono: ClipboardList, permiso: 'ver_cultivo', Vista: lazyWithRetry(() => import('./PaginaPlanCultivo'), 'PaginaPlanCultivo') },
  { ruta: '/plantas', label: 'Plantas', icono: Sprout, permiso: 'ver_cultivo', Vista: lazyWithRetry(() => import('./PaginaPlantas'), 'PaginaPlantas') },
  { ruta: '/geneticas', label: 'Genéticas', icono: Dna, permiso: 'ver_cultivo', Vista: lazyWithRetry(() => import('./PaginaGeneticas'), 'PaginaGeneticas') },
  { ruta: '/linea-tiempo', label: 'Línea de tiempo', icono: CalendarRange, permiso: 'ver_cultivo', Vista: lazyWithRetry(() => import('./PaginaLineaTiempo'), 'PaginaLineaTiempo') },
  { ruta: '/cosecha', label: 'Cosecha', icono: Scissors, permiso: 'ver_cosecha', Vista: lazyWithRetry(() => import('./PaginaCosecha'), 'PaginaCosecha') },
  { ruta: '/ambiente', label: 'Ambiente', icono: Activity, permiso: 'ver_ambiente', Vista: lazyWithRetry(() => import('./PaginaAmbiente'), 'PaginaAmbiente') },
]

export default function PaginaAgronomico() {
  const { tienePermiso } = useAuth()
  const secciones = SECCIONES.filter(s => tienePermiso(s.permiso))
  // La botonera arriba de las pestañas y no adentro de una: las nueve acciones
  // son del cultivo entero, no de Plantas. Adentro de una pestaña habría que
  // repetirla en las cuatro o esconderla en tres.
  return (
    // `flex-1 min-h-0` o el cultivo no se puede scrollear.
    //
    // Este div es hijo directo de `PageTransition`, que es un flex column
    // acotado a la ventana. Sin `flex-1` no toma la altura disponible y sin
    // `min-h-0` no se puede encoger, así que crecía al alto de su contenido
    // —17.298 px medidos en Plantas— y el scroller de adentro nunca quedaba
    // acotado. Con el dedo no se bajaba; `scrollIntoView` sí, que es lo que
    // hizo que ninguna verificación lo viera.
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <BotoneraCultivo />
      <PestanasSeccion secciones={secciones} etiqueta="Secciones del módulo agronómico" />
    </div>
  )
}
