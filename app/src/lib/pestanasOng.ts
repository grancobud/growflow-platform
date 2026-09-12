// Las pestañas de O.N.G. y cómo se agrupan.
//
// Vive en un módulo aparte y no adentro de la página por dos razones. El `id` de
// cada pestaña ES el segmento de la URL (`/ong/entidad`), así que hay que poder
// validar la ruta antes de renderizar. Y la relación pestaña ↔ grupo tiene un
// invariante que conviene tener bajo test: una pestaña que se agrega y no se
// mete en ningún grupo queda INALCANZABLE, porque la segunda fila sólo muestra
// las del grupo elegido. Eso no da error, no rompe nada, y no se ve: la pantalla
// simplemente deja de existir para quien la busca.

export type Tab =
  | 'estado' | 'coherencia'
  | 'entidad' | 'autoridades' | 'predios' | 'libros' | 'actas'
  | 'solicitudes' | 'visitas' | 'pacientes' | 'asociados' | 'cupo' | 'seguimiento'
  | 'portal' | 'dispensas' | 'proveedores' | 'movimientos' | 'economia'
  | 'declaraciones' | 'nomina' | 'documentos' | 'usuarios'

export const TABS: { id: Tab; label: string }[] = [
  { id: 'estado', label: 'Estado' },
  { id: 'coherencia', label: 'Coherencia' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'solicitudes', label: 'Solicitudes' },
  { id: 'visitas', label: 'Visitas' },
  { id: 'pacientes', label: 'Pacientes' },
  { id: 'cupo', label: 'Cupo REPROCANN' },
  { id: 'portal', label: 'Autodispensación' },
  { id: 'dispensas', label: 'Dispensas' },
  { id: 'seguimiento', label: 'Seguimiento' },
  { id: 'declaraciones', label: 'Declaraciones' },
  { id: 'nomina', label: 'Nómina Min. Salud' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'economia', label: 'Economía' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'libros', label: 'Libros' },
  { id: 'actas', label: 'Actas' },
  { id: 'asociados', label: 'Asociados' },
  { id: 'entidad', label: 'La entidad' },
  { id: 'autoridades', label: 'Autoridades' },
  { id: 'predios', label: 'Predios' },
]

/**
 * Los cinco grupos, en el orden en que las cosas se habilitan entre sí.
 *
 * Una fila de dieciocho es una lista plana: para encontrar algo hay que saber de
 * antemano cómo se llama y más o menos dónde está. En el celular se ven tres a
 * la vez, así que las otras quince son invisibles hasta que alguien arrastra la
 * barra sin saber que hay algo del otro lado.
 *
 * Agrupadas, la primera fila tiene cinco nombres cortos que sí entran, y la
 * segunda muestra sólo lo del grupo elegido: nunca más de cinco.
 *
 * El orden no es alfabético ni por frecuencia de uso: sin la entidad no hay
 * documentos, sin el padrón no hay plantas habilitadas, y sin nada de eso no hay
 * qué presentar. Quien arranca de cero puede ir de izquierda a derecha.
 */
export const GRUPOS: { id: string; label: string; tabs: Tab[] }[] = [
  // «Usuarios» va acá y no en Institucional, que ya tiene cinco. Institucional
  // es la vida de la asociación —entidad, autoridades, predios, libros, actas—;
  // esto es quién entra a la app, que es del sistema y no del estatuto.
  { id: 'panel', label: 'Panel', tabs: ['estado', 'coherencia', 'usuarios'] },
  { id: 'institucional', label: 'Institucional',
    tabs: ['entidad', 'autoridades', 'predios', 'libros', 'actas'] },
  // Las solicitudes van PRIMERO: es por donde entra la gente, y lo que hay
  // ahi es lo unico de este grupo que espera una decision.
  // «Visitas» va en Personas y JUNTO A SOLICITUDES, que es el orden real del
  // circuito: escriben por Instagram, completan el formulario, avisan, y la
  // visita a la sede es el paso siguiente. Quedan seis: es el unico grupo con
  // seis y se acepta porque separar la puerta de entrada en dos grupos seria
  // peor que una fila un poco mas larga.
  { id: 'personas', label: 'Personas',
    tabs: ['solicitudes', 'visitas', 'pacientes', 'asociados', 'cupo', 'seguimiento'] },
  { id: 'operacion', label: 'Operación',
    tabs: ['portal', 'dispensas', 'proveedores', 'movimientos', 'economia'] },
  { id: 'papeles', label: 'Papeles', tabs: ['declaraciones', 'nomina', 'documentos'] },
]

/**
 * Las pestañas que muestran plata.
 *
 * A quien no tenga `ver_plata` no se le muestran, porque el RLS le devuelve
 * CERO filas: vería una caja en $0 y un libro «sin asientos cargados», que se
 * lee como un error de carga y no como un permiso.
 *
 * `documentos` está acá aunque suene a papeles: son 1.551 comprobantes por
 * $152,8 millones —aprovisionamiento, gastos y las retribuciones de los
 * socios—, o sea el libro de plata en otra forma.
 *
 * `proveedores` idem: lo que muestra son los pagos.
 */
export const TABS_DE_PLATA: Tab[] = ['movimientos', 'economia', 'proveedores', 'documentos']

/**
 * Qué permiso pide cada pestaña.
 *
 * NACIÓ EL 31/08/2026 CON EL ROL «Director de cultivo», pero el problema que
 * resuelve ya existía. Hasta hoy se filtraban sólo `usuarios` y las cuatro de
 * plata; todas las demás se le mostraban a cualquiera con `ver_ong`, aunque el
 * RLS le devolviera cero filas.
 *
 * El síntoma medido: el **auditor** veía la pestaña Pacientes, entraba, y la
 * base le devolvía 0 de 223. Una pantalla vacía por permiso se lee como una
 * rota, no como una prohibida — es la misma lección que dejó el administrativo
 * esta misma mañana.
 *
 * Es un `Record` COMPLETO y no un `Partial` a propósito: una pestaña nueva no
 * compila hasta que alguien decida qué permiso pide. Un default silencioso es
 * exactamente cómo se cuela una pantalla que no le corresponde a nadie.
 *
 * Los cuatro permisos y qué separan:
 *
 * | permiso | qué abre |
 * |---|---|
 * | `ver_institucional` | la vida de la asociación: personas, papeles, portada |
 * | `ver_cumplimiento` | lo que se declara del cultivo: cupo, DDJJ, traslados, predios |
 * | `ver_clinico` | las fichas y el seguimiento |
 * | `ver_plata` | el libro de plata en sus cuatro formas |
 *
 * `ver_cumplimiento` existe separado de `ver_institucional` por UN caso: el
 * director de cultivo tiene que llegar a Declaraciones sin que se le abran
 * Pacientes, Solicitudes, Asociados, Portal y Dispensas. Sin esa separación, el
 * rol entero no se puede hacer bien.
 */
export const PERMISO_DE_TAB: Record<Tab, string> = {
  estado: 'ver_institucional',
  coherencia: 'ver_institucional',
  usuarios: 'gestionar_usuarios',

  entidad: 'ver_institucional',
  autoridades: 'ver_institucional',
  libros: 'ver_institucional',
  actas: 'ver_institucional',
  // Predios NO es institucional: es dónde está físicamente el cultivo, y el
  // panel de Cupo cuenta los predios activos contra el tope de la 1780.
  // Separarlo de `cupo` dejaría un tope que se muestra y un dato que no.
  predios: 'ver_cumplimiento',

  solicitudes: 'ver_institucional',
  // Una visita es «quien vino y que se hizo»: administrativo, no clinico.
  // Con `ver_clinico` el ADMINISTRATIVO -que es justamente quien atiende el
  // mostrador- no la veria. El motivo puede rozar lo clinico, y por eso la
  // lista de motivos no nombra ninguna patologia: eso vive en la ficha.
  visitas: 'ver_mostrador',
  asociados: 'ver_institucional',
  pacientes: 'ver_clinico',
  seguimiento: 'ver_clinico',
  cupo: 'ver_cumplimiento',

  // EL MOSTRADOR ES SU PROPIO PERMISO, y no `ver_institucional`.
  //
  // Entregar, mirar el catalogo y anotar una visita es lo que hace quien atiende
  // — y darselo via `ver_institucional` le abriria de paso el estatuto, los
  // libros, las actas, los socios y las solicitudes. Es la misma separacion que
  // ya se hizo con `ver_cumplimiento` para el director de cultivo, y por el
  // mismo motivo: un rol necesitaba TRES pestanas y darselas costaba dieciseis.
  //
  // Nadie pierde nada: los seis roles que tenian `ver_institucional` suman
  // `ver_mostrador` en `PERMISOS_ROL`.
  portal: 'ver_mostrador',
  dispensas: 'ver_mostrador',
  declaraciones: 'ver_cumplimiento',
  // LA NOMINA ES EL PADRON, asi que va con el permiso del padron.
  //
  // Se habia puesto en `ver_cumplimiento`, como Declaraciones, razonando que es
  // cumplimiento. Lo agarro el test de «el director de cultivo ve TRES»: ese rol
  // NO ve Pacientes, y la nomina lista nombre, DNI y domicilio de las 151
  // personas. Le habriamos dado el padron entero, en PDF, por la ventana.
  //
  // El cumplimiento no es una categoria de permiso: lo que manda es QUE DATO se
  // muestra.
  nomina: 'ver_clinico',

  movimientos: 'ver_plata',
  economia: 'ver_plata',
  proveedores: 'ver_plata',
  documentos: 'ver_plata',
}

/** Si este conjunto de permisos alcanza para ver la pestaña. */
export const puedeVerTab = (tab: Tab, tienePermiso: (p: string) => boolean): boolean =>
  tienePermiso(PERMISO_DE_TAB[tab])

/** En qué grupo cae cada pestaña. */
export const GRUPO_DE = new Map<Tab, string>(
  GRUPOS.flatMap(g => g.tabs.map(t => [t, g.id] as [Tab, string])))

/** Si `v` nombra una pestaña que existe. La URL la escribe cualquiera. */
export const esTab = (v: string | undefined): v is Tab =>
  !!v && TABS.some(t => t.id === v)
