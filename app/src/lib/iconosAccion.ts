// Los iconos que puede pedir una accion, uno por uno.
//
// POR QUE UN MAPA EXPLICITO Y NO `import * as Iconos`.
//
// Las acciones declaran su icono por NOMBRE —`icono: 'Scissors'`— y hay que
// resolverlo en tiempo de ejecucion. La forma corta de hacerlo es traer el
// modulo entero y buscar la clave adentro, y eso era lo que habia. El costo no
// se veia por ningun lado: `lucide-react` trae unos mil quinientos iconos, asi
// que el bundle se llevaba 597 KB para usar 36, y se descargaban al ABRIR la
// app porque estos dos componentes estan en el Panel.
//
// Nombrandolos de a uno, el empaquetador deja solo estos.
//
// AGREGAR UN ICONO NUEVO A UNA ACCION OBLIGA A AGREGARLO ACA. No es un olvido
// del diseño: hay un test que compara este mapa contra los iconos que declaran
// las acciones y falla si falta alguno, justamente para que no se descubra en
// pantalla con un circulito gris.

import {
  BookMarked,
  Boxes,
  Calculator,
  CalendarCheck,
  ClipboardCheck,
  HeartPulse,
  ClipboardList,
  Coins,
  Database,
  Dna,
  Droplets,
  FileCheck,
  FilePlus,
  FileText,
  Gauge,
  LayoutGrid,
  ListChecks,
  MapPin,
  PackageOpen,
  PackagePlus,
  Receipt,
  ScanLine,
  Scissors,
  ScrollText,
  Settings,
  ShoppingCart,
  Sprout,
  Stethoscope,
  Thermometer,
  Ticket,
  Truck,
  UserCog,
  UserPlus,
  DoorOpen,
  ArrowLeftRight,
  Users,
  Wrench,
  Undo2,
  Flower2,
  Building2,
  Circle,
  type LucideIcon,
} from 'lucide-react'

export const ICONOS_ACCION: Record<string, LucideIcon> = {
  DoorOpen,
  ArrowLeftRight,
  BookMarked,
  Boxes,
  Calculator,
  CalendarCheck,
  ClipboardCheck,
  HeartPulse,
  ClipboardList,
  Coins,
  Database,
  Dna,
  Droplets,
  FileCheck,
  FilePlus,
  FileText,
  Gauge,
  LayoutGrid,
  ListChecks,
  MapPin,
  PackageOpen,
  PackagePlus,
  Receipt,
  ScanLine,
  Scissors,
  ScrollText,
  Settings,
  ShoppingCart,
  Sprout,
  Stethoscope,
  Thermometer,
  Ticket,
  Truck,
  UserCog,
  UserPlus,
  Users,
  Wrench,
  Undo2,
  Flower2,
  Building2,
}

/** El icono de una accion, o un circulo si el nombre no esta en el mapa. */
export const iconoDeAccion = (nombre?: string | null): LucideIcon =>
  (nombre && ICONOS_ACCION[nombre]) || Circle
