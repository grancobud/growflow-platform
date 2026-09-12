// PaginaONG — la capa institucional de la asociación civil.
//
// El resto de la app cubre el cultivo. Esto cubre lo que hace que la ONG pueda
// operar: los plazos que si se vencen te frenan todo trámite, los topes de la
// Resolución 1780 y los requisitos para pedir el botón de REPROCANN.
//
// Los topes NO son un número suelto: se cruzan contra los datos reales de la
// app (pacientes y plantas cargados), que es justo lo que un libro de papel no
// puede hacer.

import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PuestaEnMarcha } from '../components/manual/PuestaEnMarcha'
import { useAbrirAlLlegar } from '../lib/useAbrirAlLlegar'
import { GuiaDelFormulario, AyudaCampo } from '../components/ong/GuiaDelFormulario'
import { useIrASeccion } from '../lib/useIrASeccion'
import { TABS, GRUPOS, GRUPO_DE, puedeVerTab, esTab, type Tab } from '../lib/pestanasOng'
import { SelectorGrupo } from '../components/layout/SelectorGrupo'
import { QueQuieroHacer } from '../components/ong/QueQuieroHacer'
import { BarraFlujo } from '../components/ong/BarraFlujo'
import { toast } from 'sonner'
import {
  Building2, Loader2, Plus, X, Pencil, Trash2, CalendarClock, ShieldCheck,
  Gauge, MapPin, Users, AlertTriangle, CheckCircle2, Circle, Save, ChevronRight,
  Download,
} from 'lucide-react'
import {
  planillaLotes, planillaDispensas, planillaCaja, bajarCsv, nombreDeArchivo,
} from '../lib/planillaCsv'
import {
  ongService, calcularVencimientos, calcularCapacidad, estadoDelPadron, finDeMandato,
  topeTransporteG, TOPE_TRASLADO_INDIVIDUAL_G, CARGOS, ORGANOS,
  type Entidad, type Autoridad, type Requisito, type Predio, type Urgencia, type DocumentoONG,
  type DDJJ, type Traslado, type FeedbackClinico, type AsientoCaja,
  type Libro, type Acta, type Asociado, type CategoriaSocio, type Cuota, type Dispensa,
  type CuotaEmitida, periodoActual, semestreActual, sinAcentos, saldosService, chequeosCoherencia, DONDE_SE_ARREGLA, balanceMateria,
  type SaldoProveedor, type PagoProveedor,
} from '../lib/ong'
import { registroService, type Paciente } from '../lib/registro'
import { legajoService, type PapelInstitucional } from '../lib/legajoInstitucional'
import { useAuth } from '../hooks/useAuth'
import { visitasService, type Visita } from '../lib/visitas'
import { portalService, type Lote } from '../lib/portal'
import { cultivoService, type ResumenPlanta } from '../lib/cultivo'
import { PadronEnElTope } from '../components/ong/PadronEnElTope'
import { PasosAlta } from '../components/ong/PasosAlta'
import { ImportarFormulario } from '../components/ong/ImportarFormulario'
import { type Solicitud } from '../lib/solicitudes'
import { BarraPestanas } from '../components/layout/BarraPestanas'
// El registro de pacientes vive acá: el cupo, las dispensas y los documentos
// cuelgan de el, y tenerlo en otro item del menu obligaba a saltar de pantalla.
import { econometriaService, configService, resumenEconomico, VIDA_UTIL_DEFECTO, materialDelCiclo, type VidaUtil } from '../lib/econometria'
import { stockService } from '../lib/stock'
import { btnPrimario, btnSutil, tarjeta, etiquetaCampo, inputFormulario, sinAutocorreccion } from '../lib/ui'
import { useDialogo } from '../lib/useDialogo'
import { confirmarBorrado } from '../lib/confirmar'

// ===================== LAS PESTAÑAS, A PEDIDO =====================
//
// El chunk de esta página pesaba 875 kB —el más grande de la app por lejos, casi
// el doble que el segundo— porque importaba las diecinueve pestañas de una, y
// se ve UNA a la vez. Abrir «Movimientos» descargaba las declaraciones juradas,
// el modelo de estatuto, el portal de autodispensación y el padrón entero.
//
// Cada una en su propio `lazy` y no un par de bultos por grupo: el corte
// natural es la pestaña, que es exactamente la unidad que se muestra sola.
//
// Quedan afuera —y siguen estáticas— las que NO son pestaña: la barra de flujo,
// la puesta en marcha, el estado y los formularios de entidad/autoridades/
// predios, que son parte de este archivo. Cargarlas a pedido no ahorraría nada
// porque el estado es la pestaña con la que abre la página.
//
// `then(m => ({ default: … }))` porque casi todas son exportaciones nombradas y
// `lazy` espera una por defecto.
const Libros = lazy(() => import('../components/ong/LibrosYActas').then(m => ({ default: m.Libros })))
const Actas = lazy(() => import('../components/ong/LibrosYActas').then(m => ({ default: m.Actas })))
const Asociados = lazy(() => import('../components/ong/AsociadosYCoherencia').then(m => ({ default: m.Asociados })))
const Coherencia = lazy(() => import('../components/ong/AsociadosYCoherencia').then(m => ({ default: m.Coherencia })))
const Dispensas = lazy(() => import('../components/ong/Dispensas').then(m => ({ default: m.Dispensas })))
const Visitas = lazy(() => import('../components/ong/Visitas').then(m => ({ default: m.Visitas })))
const CupoReprocann = lazy(() => import('../components/ong/CupoReprocann').then(m => ({ default: m.CupoReprocann })))
const Documentos = lazy(() => import('../components/ong/Documentos').then(m => ({ default: m.Documentos })))
const Proveedores = lazy(() => import('../components/ong/Proveedores').then(m => ({ default: m.Proveedores })))
const Movimientos = lazy(() => import('../components/ong/Movimientos').then(m => ({ default: m.Movimientos })))
const Economia = lazy(() => import('../components/ong/Economia').then(m => ({ default: m.Economia })))
const Declaraciones = lazy(() => import('../components/ong/Declaraciones').then(m => ({ default: m.Declaraciones })))
const Seguimiento = lazy(() => import('../components/ong/Seguimiento').then(m => ({ default: m.Seguimiento })))
const NominaMinisterio = lazy(() => import('../components/ong/NominaMinisterio').then(m => ({ default: m.NominaMinisterio })))
const LibroDeCaja = lazy(() => import('../components/ong/LibroDeCaja').then(m => ({ default: m.LibroDeCaja })))
const Solicitudes = lazy(() => import('../components/ong/Solicitudes').then(m => ({ default: m.Solicitudes })))
const Usuarios = lazy(() => import('../components/ong/Usuarios').then(m => ({ default: m.Usuarios })))
const Portal = lazy(() => import('../components/ong/Portal').then(m => ({ default: m.Portal })))
const LegajoInstitucional = lazy(() => import('../components/ong/LegajoInstitucional').then(m => ({ default: m.LegajoInstitucional })))
const PaginaPacientes = lazy(() => import('./PaginaPacientes'))

/** Lo mismo que muestra la página mientras carga sus datos: una sola espera. */
const Cargando = (
  <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#a3e635]" /></div>
)

// text-[16px] en mobile: evita el zoom automático de iOS Safari al enfocar.

const COLOR_URGENCIA: Record<Urgencia, { txt: string; bg: string; borde: string; label: string }> = {
  vencido: { txt: '#ff8a7a', bg: 'rgba(122,40,32,0.18)', borde: '#7a2820', label: 'Vencido' },
  critico: { txt: '#f59e0b', bg: 'rgba(245,158,11,0.12)', borde: '#5a4a20', label: 'Urgente' },
  proximo: { txt: '#38bdf8', bg: 'rgba(56,189,248,0.10)', borde: '#1e3a4a', label: 'Próximo' },
  ok:      { txt: '#bef264', bg: 'rgba(163,230,53,0.12)', borde: '#404d20', label: 'En regla' },
}

const fmtFecha = (f?: string | null) =>
  f ? new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

/** Gramos hasta el kilo, después kg: "120 g" se lee mejor que "0,12 kg". */
const fmtPeso = (g: number) => g < 1000
  ? `${g.toLocaleString('es-AR')} g`
  : `${(g / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`

const textoDias = (d: number | null) =>
  d == null ? 'sin fecha cargada' : d < 0 ? `hace ${Math.abs(d)} días` : d === 0 ? 'hoy' : `en ${d} días`

// El tipo Tab, TABS, GRUPOS y GRUPO_DE viven en lib/pestanasOng.ts.

/**
 * Baja la planilla de control: Lotes, Dispensas y Caja.
 *
 * La asociación deja atrás la planilla que venía usando y pasa a cargar todo
 * acá. Este botón es lo que hace que eso no signifique perder el papel: para
 * una inspección, o para revisar números con alguien que no tiene usuario, hay
 * que poder bajarlo.
 *
 * ⚠ La mano es una sola: la app es la fuente y esto es una SALIDA. Nada de lo
 * que se baje vuelve a subirse. Es lo que evita que existan dos autoridades
 * sobre el código de lote, que es de donde salían los duplicados.
 *
 * Son tres archivos y no uno: un CSV es una tabla sola, y meter lotes, entregas
 * y caja en la misma haría columnas que no significan nada en dos tercios de
 * las filas.
 */
function BotonPlanilla({ lotes, dispensas, caja }: {
  lotes: Lote[]
  dispensas: Dispensa[]
  caja: AsientoCaja[]
}) {
  const bajar = () => {
    // `new Date()` una sola vez: con tres llamadas, bajar a las 23:59:59 puede
    // dejar dos archivos con la fecha de hoy y uno con la de mañana.
    const hoy = new Date()
    bajarCsv(nombreDeArchivo('lotes', hoy), planillaLotes(lotes))
    bajarCsv(nombreDeArchivo('dispensas', hoy), planillaDispensas(dispensas))
    bajarCsv(nombreDeArchivo('caja', hoy), planillaCaja(caja))
    toast.success('Bajaste tres planillas: lotes, dispensas y caja.')
  }
  return (
    <button onClick={bajar} className={btnSutil}
      title="Baja Lotes, Dispensas y Caja como CSV, para abrir en Excel">
      <Download className="w-3.5 h-3.5" /> Planilla
    </button>
  )
}

export default function PaginaONG() {
  const { usuario, tienePermiso } = useAuth()
  // /registro es un alias que entra directo por Pacientes: es la URL vieja del
  // registro y hay links de otras pantallas que apuntan ahí.
  const { pathname, search } = useLocation()
  const navegar = useNavigate()
  // Del pathname y no de `useParams`: la ruta es `ong/*`, asi que no hay un
  // parametro `:tab` — hay un splat. Ver el comentario en App.tsx.
  const tabDeLaUrl = pathname.startsWith('/ong/')
    ? pathname.slice('/ong/'.length).split('/')[0]
    : undefined

  // La pestaña vive en la URL, no en el componente.
  //
  // Cuando era `useState` no se podia mandar a nadie a una pestaña puntual: para
  // que alguien llegara a «La entidad» habia que decirle que entrara a O.N.G. y
  // la buscara entre dieciocho, y en el celular se ven tres a la vez. Tampoco
  // andaba el boton atras entre pestañas ni se sobrevivia a un F5.
  //
  // En la URL, en cambio, cada pestaña es un lugar: Coherencia puede llevarte al
  // formulario que apaga cada cruce, el checklist de puesta en marcha puede
  // linkear a cada paso, y el link se puede pasar por mensaje.
  //
  // Una pestaña que no existe cae en Estado en vez de romper: la URL la escribe
  // cualquiera y no vale la pena una pantalla de error por una letra de mas.
  const tab: Tab = esTab(tabDeLaUrl) ? tabDeLaUrl
    : pathname.startsWith('/registro') ? 'pacientes'
    : 'estado'

  // Estado va a `/ong` pelado para no dejar `/ong/estado` dando vueltas como
  // segunda direccion de la misma pantalla.
  const setTab = useCallback(
    (t: Tab) => navegar(t === 'estado' ? '/ong' : `/ong/${t}`),
    [navegar])
  const [cargando, setCargando] = useState(true)
  const [entidad, setEntidad] = useState<Entidad | null>(null)
  const [autoridades, setAutoridades] = useState<Autoridad[]>([])
  /**
   * La solicitud que se esta dando de alta.
   *
   * Viaja por estado y no por la URL: el DNI es un dato personal, y una URL
   * queda en el historial del navegador y en el registro del servidor.
   */
  const [altaDesdeSolicitud, setAltaDesdeSolicitud] = useState<Solicitud | null>(null)
  const [requisitos, setRequisitos] = useState<Requisito[]>([])
  // `?ir=requisitos` baja hasta la lista de la 1780 al llegar desde la accion.
  useIrASeccion()
  const [predios, setPredios] = useState<Predio[]>([])
  // Datos reales del cultivo, para cruzarlos contra los topes.
  const [nPacientes, setNPacientes] = useState(0)
  const [nPlantas, setNPlantas] = useState(0)
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  // El padron ENTERO, archivados incluidos, y sólo para el dedup de solicitudes.
  //
  // `pacientes` trae sólo los activos, que es lo que el resto de la pantalla
  // necesita. Pero para decidir si quien pide el alta YA ESTÁ, los archivados
  // son justamente los que hay que mirar: al 26/08/2026 hay 71 asociados
  // activos cuya ficha de paciente está archivada. Con el padrón filtrado, esas
  // 71 personas pasaban el control de duplicados y se les creaba una ficha
  // nueva — que es exactamente lo que hubo que deshacer a mano el 25/08 con
  // PAC-XXX, PAC-XXX y PAC-XXX.
  //
  // `Solicitudes` ya estaba escrito para recibirlo completo: su tipo pide
  // `activo?: boolean` y cuenta los vinculados con `activo !== false`. Pasarle
  // sólo los activos rompía el dedup y encima no arreglaba el conteo.
  const [padronCompleto, setPadronCompleto] = useState<Paciente[]>([])
  const [plantas, setPlantas] = useState<ResumenPlanta[]>([])
  const [libros, setLibros] = useState<Libro[]>([])
  const [actas, setActas] = useState<Acta[]>([])
  const [asociados, setAsociados] = useState<Asociado[]>([])
  const [categorias, setCategorias] = useState<CategoriaSocio[]>([])
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [dispensas, setDispensas] = useState<Dispensa[]>([])
  const [geneticas, setGeneticas] = useState<Awaited<ReturnType<typeof cultivoService.getGeneticas>>>([])
  // El costo real por gramo sale de Econometria: es contra ese numero que se
  // valida que el aporte del paciente siga siendo un aporte y no una venta.
  const [costoPorGramo, setCostoPorGramo] = useState<number | null>(null)
  /** Lo que Econometría SUPONE que se gasta por mes, para contrastarlo con lo
      que los comprobantes dicen que se gastó. */
  const [fijosCargadosMes, setFijosCargadosMes] = useState<number | null>(null)
  // Gramos secos cosechados: el otro extremo del balance de materia.
  const [gramosCosechados, setGramosCosechados] = useState(0)
  const [cuotasEmitidas, setCuotasEmitidas] = useState<CuotaEmitida[]>([])
  const [documentos, setDocumentos] = useState<DocumentoONG[]>([])
  // El legajo institucional (estatuto, acta, matricula). Tabla aparte de
  // `ong_documentos` y con el RLS de lo institucional, asi que se carga
  // aparte: ver `lib/documentosInstitucionales.ts`.
  const [docsInstitucionales, setDocsInstitucionales] = useState<PapelInstitucional[]>([])
  const [ddjj, setDDJJ] = useState<DDJJ[]>([])
  const [traslados, setTraslados] = useState<Traslado[]>([])
  const [feedbacks, setFeedbacks] = useState<FeedbackClinico[]>([])
  const [caja, setCaja] = useState<AsientoCaja[]>([])
  /** Solo para el cruce de grafias: los pagos tienen su propia columna de
      beneficiario y ahi ya aparecio el mismo proveedor escrito de dos formas. */
  const [nombresPagos, setNombresPagos] = useState<string[]>([])
  /** Para el tablero de Economía: la deuda con proveedores es parte del cuadro. */
  const [saldos, setSaldos] = useState<SaldoProveedor[]>([])
  // Los lotes son la otra mitad del balance de materia: por aca entra el
  // material comprado a terceros, que no pasa por ninguna cosecha.
  const [lotes, setLotes] = useState<Lote[]>([])
  // Las visitas se cargan aparte y con su propio catch: es un registro
  // nuevo y una pestana mas, y esta pantalla ya se cayo entera una vez por
  // un dato suelto. Que no cargue Visitas es preferible a que no cargue la ONG.
  //
  // Y desde el 09/09/2026 se cargan AL ABRIR SU PESTAÑA, no al montar.
  // Medido contra produccion: son 394 kB y 949 filas que no usa ningun otro
  // lugar de la pantalla —ni un cruce de Coherencia— asi que quien entra a mirar
  // la caja las estaba bajando para nada.
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [visitasPedidas, setVisitasPedidas] = useState(false)
  // Para el cruce `pagos_sin_asiento`: un pago que bajó la deuda y no salió
  // de la caja deja el saldo mostrando plata que ya no está.
  const [pagosProveedor, setPagosProveedor] = useState<PagoProveedor[]>([])
  const [fechaCorte, setFechaCorte] = useState<string>('')
  // Los costos cargados, SOLO para el checklist de puesta en marcha, que
  // muestra cuantos hay. El calculo del costo por gramo los usa aparte, adentro
  // del bloque de econometria: aca se guardan para no volver a pedirlos.
  const [costosEco, setCostosEco] = useState<{ id: string }[]>([])

  const cargar = useCallback(async () => {
    try {
      // ⚠️ UNA SOLA OLA DE CONSULTAS, Y ESO ES EL ARREGLO (04/09/2026).
      //
      // Esta función traía TODO en seis olas encadenadas: cada `Promise.all`
      // esperaba a que la anterior terminara entera antes de pedir nada. Medido
      // en producción el 04/09/2026 con la sesión abierta: 49 consultas, 5,5
      // segundos, y NINGUNA consulta lenta —la peor es `dispensas_segun_rol`
      // con 792 ms y el resto está entre 70 y 300—. Los pedidos salían en once
      // tandas: 0,5s · 0,75s · 1,25s · 1,5s · 2,25s · 3,0s · 3,75s · 4,0s ·
      // 4,5s · 4,75s · 5,25s. La última tanda eran siete consultas baratas
      // —entidad, autoridades, predios, libros— que podrían haber salido
      // primero. Gastón preguntó «¿por qué tarda tanto en cargar ONG?» y ésta
      // es la respuesta entera: no es el peso de los datos, es el orden.
      //
      // De todas esas dependencias había UNA sola de verdad: `materialDelCiclo`
      // necesita los lotes. Pero es una función PURA sobre datos ya traídos, no
      // otra consulta: alcanza con pedir los lotes en la misma ola y hacer la
      // cuenta cuando llegan. Las otras cinco olas no dependían de nada; eran
      // el orden en que se fue escribiendo el archivo.
      //
      // LO QUE HACE QUE ESTO FUNCIONE es que una promesa arranca cuando se la
      // CREA, no cuando se la espera. `opcionales` y `economia` se arman antes
      // del `await`, así que sus pedidos salen en el mismo tick que los otros
      // veintitrés. No hace falta meterlos en el mismo `Promise.all`, y no
      // conviene: cada grupo conserva su propio manejo de errores.
      const opcional = async (que: string, fn: () => Promise<void>) => {
        try { await fn() } catch (e) {
          console.warn(`[ONG] no se pudo cargar «${que}»:`, (e as Error).message)
        }
      }
      // UN CATCH VACIO ES LA FORMA MAS CARA DE FALLAR, y este archivo tenía
      // cinco. La pantalla no se cae —que es para lo que estaban— pero el dato
      // desaparece sin que nadie se entere: el 01/09/2026 el cruce
      // `pagos_sin_asiento` no aparecía en Coherencia y llevó media hora
      // descubrir por qué, porque el error se estaba comiendo en silencio.
      // Ahora cada uno avisa por consola con el nombre de lo que falló.
      const opcionales = Promise.all([
        // Las visitas NO están acá: se cargan al abrir su pestaña. Ver
        // `useEffect` de más abajo.
        opcional('papeles institucionales', async () =>
          setDocsInstitucionales(await legajoService.listar())),
        opcional('pagos a proveedor', async () => setPagosProveedor(await saldosService.getPagos())),
        opcional('nombres de pagos', async () => setNombresPagos(await saldosService.getNombresPagos())),
        opcional('saldos por proveedor', async () => setSaldos(await saldosService.getPorProveedor())),
      ])
      // Econometría entera o nada: si falla, las dispensas igual funcionan y
      // sólo se pierde el costo por gramo. Es el mismo `try/catch` que tenía,
      // escrito como `.catch` para poder arrancarlo sin esperarlo.
      const economia = Promise.all([
        stockService.getInsumos(), econometriaService.getCostos(),
        configService.get<VidaUtil>('vida_util_meses', VIDA_UTIL_DEFECTO),
        configService.get<{ meses_ciclo: number }>('parametros', { meses_ciclo: 4 }),
        cultivoService.getCosechas(),
      ]).catch((e: Error) => {
        console.warn('[ONG] no se pudo cargar «econometría»:', e.message)
        return null
      })

      // ⚠️ SI UNA DE ESTAS FALLA NO SE PINTA NADA, y es a propósito. Antes el
      // padrón se traía al final, después de haber pintado media pantalla, con
      // este comentario: «un padrón que no cargó es un padrón vacío, y un
      // padrón vacío no frena ningún duplicado: aprobaría todo». Con una sola
      // ola esa garantía se cumple mejor que antes: o está todo o se ve el
      // error, nunca una pantalla a medias que parece completa.
      //
      // `fecha_corte` se pide UNA vez. Se pedía dos —una para mostrarla y otra
      // para el cálculo del material del ciclo— sobre la misma fila de la misma
      // tabla. Lleva su propio `.catch` porque mostrarla es opcional: que no
      // esté no puede tumbar la pantalla.
      const [
        e, a, r, p, pac, pl, li, ac, aso, cat, cuo,
        disp, gen, cem, lts,
        doc, dj, tr, fb, cj,
        corte, cupo, padron,
      ] = await Promise.all([
        ongService.getEntidad(), ongService.getAutoridades(), ongService.getRequisitos(),
        ongService.getPredios(), registroService.getPacientes(true),
        cultivoService.getResumenPlantas(true),
        ongService.getLibros(), ongService.getActas(), ongService.getAsociados(),
        ongService.getCategorias(), ongService.getCuotas(),
        ongService.getDispensas(), cultivoService.getGeneticas(),
        ongService.getCuotasEmitidas(), portalService.getLotes(),
        ongService.getDocumentos(), ongService.getDDJJ(), ongService.getTraslados(),
        ongService.getFeedbacks(), ongService.getCaja(),
        configService.get<string>('fecha_corte', '').catch(() => ''),
        // EL CONTEO DEL CUPO SALE DE LA VISTA, NO DE `pac.length`.
        //
        // El tope de plantas se calcula multiplicando la cantidad de pacientes,
        // así que un rol que no ve el padrón —el director de cultivo— tendría
        // `pac.length === 0` y vería «N plantas en floración de 0». Un cero ahí
        // no se lee como «no sé»: se lee como un tope real y más chico que el
        // verdadero, que es la peor forma de equivocar un límite normativo.
        //
        // (Medido el 31/08/2026: hay 60 plantas activas y NINGUNA en floración,
        // así que hoy el numerador es 0 y el error no se vería. Se vería el día
        // que florezcan, que es justo cuando el tope importa.)
        //
        // `cupo_conteos` devuelve sólo agregados, sin una sola ficha. La usan
        // TODOS los roles y no sólo el que la necesita: si el número saliera
        // del padrón para unos y de la vista para otros, dos pantallas podrían
        // mostrar cupos distintos sobre los mismos datos.
        ongService.contarParaCupo(),
        registroService.getPacientes(),
      ])

      setEntidad(e); setAutoridades(a); setRequisitos(r); setPredios(p)
      setLibros(li); setActas(ac); setAsociados(aso); setCategorias(cat); setCuotas(cuo)
      setPacientes(pac); setPlantas(pl)
      setDispensas(disp); setGeneticas(gen); setCuotasEmitidas(cem); setLotes(lts)
      setDocumentos(doc); setDDJJ(dj); setTraslados(tr); setFeedbacks(fb); setCaja(cj)
      setFechaCorte(corte); setNPacientes(cupo); setPadronCompleto(padron)
      // El tope de la 1780 es sobre plantas EN FLORACION: las de vegetativo o
      // enraizando no cuentan contra el limite.
      setNPlantas(pl.filter(x => x.fase === 'Floracion').length)

      const eco = await economia
      if (eco) {
        const [ins, cos, vida, par, cose] = eco
        setCostosEco(cos)
        // EL MISMO DENOMINADOR QUE ECONOMETRIA, y por el mismo motivo: de acá
        // sale el `costoPorGramo` con el que se calcula el margen de CADA
        // entrega. Si las dos pantallas dividieran por cosas distintas, el
        // margen de una entrega diría una cosa en la O.N.G. y otra en
        // Econometría sobre los mismos datos.
        const gramos = materialDelCiclo(cose, lts, corte).gramos
        setGramosCosechados(gramos)
        // A proposito SIN los insumos faltantes: el aporte del paciente se
        // compara contra lo que YA gastaste, no contra lo que pensas gastar.
        const resumen = resumenEconomico({
          insumos: ins, costos: cos, vida, mesesCiclo: par.meses_ciclo, gramosCosechados: gramos,
        })
        setCostoPorGramo(resumen.costoPorGramo)
        setFijosCargadosMes(resumen.fijosMes ?? null)
      }
      await opcionales
    } catch (err) {
      toast.error(`Error cargando la ONG: ${(err as Error).message}`)
    } finally { setCargando(false) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  /**
   * Las visitas, cuando se abre su pestaña y no antes.
   *
   * `visitasPedidas` y no `visitas.length`: una asociación que todavía no
   * registró ninguna visita volvería a consultar en cada render, que es peor
   * que la consulta que se está evitando.
   *
   * ⚠️ Y como `cargar()` ya NO las trae, la pestaña recarga con
   * `recargarVisitas` además de `cargar`: sin eso, la visita recién anotada no
   * aparecía en la lista.
   */
  const recargarVisitas = useCallback(() => {
    visitasService.getVisitas()
      .then(setVisitas)
      .catch(e => console.warn('[ONG] no se pudo cargar «visitas»:', (e as Error).message))
  }, [])

  useEffect(() => {
    if (tab !== 'visitas' || visitasPedidas) return
    setVisitasPedidas(true)
    recargarVisitas()
  }, [tab, visitasPedidas, recargarVisitas])

  // Se recarga sola al volver a la pestaña.
  //
  // Los datos de esta pantalla se arreglan muchas veces DESDE AFUERA: los
  // scripts de la planilla escriben directo en la base, y alguien puede estar
  // cargando actas en otra pestaña. Sin esto, el panel seguia mostrando los
  // numeros del momento en que se abrio y daba la impresion de que el arreglo
  // no habia funcionado.
  //
  // Se recarga al volver, no cada N segundos: el disparador real es la persona
  // volviendo a mirar, y un intervalo fijo consulta catorce tablas de gusto
  // mientras la pestaña esta en segundo plano.
  //
  // El piso de 15 segundos evita que un alt-tab de ida y vuelta dispare dos
  // recargas encimadas.
  // Los seis datos que mira el checklist de puesta en marcha, ya cargados.
  // Memoizado para no rearmar el objeto en cada pintada: es la dependencia del
  // efecto de `PuestaEnMarcha`, y un objeto nuevo lo volveria a disparar.
  const puestaEnMarcha = useMemo(() => ({
    entidad, autoridades, predios, geneticas, costos: costosEco, libros,
  }), [entidad, autoridades, predios, geneticas, costosEco, libros])

  const ultimaCarga = useRef(Date.now())
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - ultimaCarga.current < 15_000) return
      ultimaCarga.current = Date.now()
      cargar()
    }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [cargar])

  // Se corren los cruces acá arriba, no sólo dentro de la pestaña, para poder
  // avisar desde cualquier lado. Es la misma función: no hay dos verdades.
  const chequeos = useMemo(() => chequeosCoherencia({
    entidad, actas, libros, asociados, categorias, cuotas,
    pacientes: nPacientes, plantasFloracion: nPlantas, dispensas, costoPorGramo,
    gramosCosechados, lotes, padron: pacientes, cuotasEmitidas, periodo: periodoActual(),
    autoridades, ddjj, traslados,
    beneficiarios: [
      ...documentos.map(d => d.proveedor ?? ''),
      ...lotes.map(l => l.proveedor ?? ''),
      ...nombresPagos,
    ],
    documentos, caja, pagosProveedor, fechaCorte,
  }), [entidad, actas, libros, asociados, categorias, cuotas, nPacientes, nPlantas,
       dispensas, costoPorGramo, gramosCosechados, lotes, pacientes, cuotasEmitidas,
       pagosProveedor, fechaCorte,
       autoridades, ddjj, traslados, documentos, nombresPagos, caja])
  const nErrores = useMemo(() => chequeos.filter(c => c.estado === 'error').length, [chequeos])
  const nAlertas = useMemo(() => chequeos.filter(c => c.estado === 'alerta').length, [chequeos])

  // Cuántos cruces abiertos cuelgan de cada grupo.
  //
  // El número al lado del grupo evita entrar a las cinco solapas a ver dónde
  // está el trabajo. Sale del mismo mapa que usan los links de Coherencia, así
  // que no hay dos criterios de "esto se arregla acá" que puedan discrepar.
  const pendientesPorGrupo = useMemo(() => {
    const cuenta = new Map<string, number>()
    for (const c of chequeos) {
      if (c.estado === 'ok' || c.estado === 'sin_datos') continue
      const destino = DONDE_SE_ARREGLA[c.clave]
      if (!destino?.ruta.startsWith('/ong/')) continue
      const grupo = GRUPO_DE.get(destino.ruta.slice('/ong/'.length) as Tab)
      if (grupo) cuenta.set(grupo, (cuenta.get(grupo) ?? 0) + 1)
    }
    return cuenta
  }, [chequeos])

  // La tarea en curso, si hay una. Vive en la URL para que se pueda cerrar la
  // pestaña y volver, y para que el boton atras retroceda de paso.
  const params = new URLSearchParams(search)
  const flujoId = params.get('flujo')
  const pasoCrudo = params.get('paso')

  // Lo que la barra de pasos mira para marcar sola lo que ya está hecho.
  //
  // Se arma acá porque es la única pantalla que tiene todo junto. Va en un memo
  // porque recorre listas de más de mil filas y la barra se redibuja en cada
  // cambio de pestaña.
  const datosDeFlujo = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7)
    const b = balanceMateria(gramosCosechados, dispensas, lotes)
    return {
      pacientesActivos: pacientes.filter(x => x.activo !== false),
      asociadosSinActa: asociados
        .filter(a => a.activo !== false)
        .filter(a => !a.acta_alta_id && !a.fundador).length,
      traslados,
      dispensas,
      documentos,
      cuotasEmitidas,
      periodo: periodoActual(),
      mes,
      erroresDeCoherencia: nErrores,
      faltanteDeMateria: Math.max(0, b.dispensado - b.ingresado),
      hayEntidadConCuit: !!entidad?.cuit?.trim(),
      autoridades: autoridades.filter(a => a.activo !== false).length,
      predios: predios.filter(p => p.activo !== false).length,
      librosRubricados: libros.filter(l => l.rubricado).length,
      ddjj,
      semestre: semestreActual(),
    }
  }, [pacientes, asociados, traslados, dispensas, documentos, cuotasEmitidas,
      nErrores, gramosCosechados, lotes, entidad, autoridades, predios, libros,
      ddjj])

  const grupoActivo = GRUPO_DE.get(tab) ?? 'panel'
  // Cada pestaña pide su permiso. El mapa está en `PERMISO_DE_TAB`.
  //
  // No es cosmética: el RLS le devuelve CERO filas a quien no corresponde, así
  // que Movimientos mostraba «$0 / $0 / 0 asientos» y Pacientes una lista vacía
  // de 223 — que se lee como un error de carga, no como un permiso. Y peor,
  // Movimientos ofrecía un «+ Asiento» que la base iba a rechazar.
  //
  // Hasta el 31/08/2026 se filtraban sólo `usuarios` y las de plata; el auditor
  // veía Pacientes vacía por eso.
  const tabsDelGrupo = (GRUPOS.find(g => g.id === grupoActivo)?.tabs ?? [])
    .filter(t => puedeVerTab(t, tienePermiso))

  const vencimientos = useMemo(() => calcularVencimientos(entidad, ddjj), [entidad, ddjj])
  const capacidad = useMemo(
    () => calcularCapacidad(entidad, nPacientes, nPlantas, predios.filter(p => p.activo !== false).length),
    [entidad, nPacientes, nPlantas, predios])

  // Quien sobra si el padron paso el tope. Se calcula con las entregas a la
  // vista porque el criterio es «nunca retiro nada», que es el unico que se
  // explica solo ante un control.
  const padron = useMemo(
    () => estadoDelPadron(pacientes, dispensas, entidad?.tope_pacientes ?? 150),
    [pacientes, dispensas, entidad])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#0a0a0f] text-[#d4d4dd] font-sans">
      <div className="sticky top-0 z-40 bg-[#0a0a0f] border-b border-[#1f1f2b]">
        {/* `flex-1` en el bloque del título, y el botón SIN `ml-auto`.
            Con `ml-auto` el botón se pegaba a la derecha cuando entraba en la
            fila, y seguía pegado cuando NO entraba: ahí caía a un renglón propio
            con 286 px de aire a la izquierda. Sacándolo se arreglaba ese caso y
            se rompía el otro: quedaba flotando en el medio, a 64 px del borde,
            ni pegado al título ni al margen. Medido en las siete pestañas.

            Que el título ocupe el sobrante resuelve los dos a la vez: empuja el
            botón contra el margen derecho sin `ml-auto`, y como el título tiene
            `min-w-0` se encoge antes de que el botón tenga que bajar. */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-x-4 px-3 sm:px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] text-[#ececf1] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} /> O.N.G.
            </h1>
            <div className="mt-0.5 text-[10px] sm:text-[11px] text-[#8a8a9c]">
              {entidad?.razon_social || 'Asociación civil'} · vida institucional y habilitaciones
            </div>
          </div>
          <BotonPlanilla lotes={lotes} dispensas={dispensas} caja={caja} />
        </div>
        {/* Dos filas: el grupo arriba, sus pestañas abajo.
            Elegir un grupo lleva a su PRIMERA pestaña, no a una pantalla de
            grupo: un grupo no es un lugar, es una forma de encontrar el lugar. */}
        <SelectorGrupo
          grupos={GRUPOS.map(g => ({
            id: g.id, label: g.label, badge: pendientesPorGrupo.get(g.id) }))}
          activo={grupoActivo}
          onCambio={id => {
            const g = GRUPOS.find(x => x.id === id)
            if (g) setTab(g.tabs[0])
          }} />
        {/* En el orden del GRUPO, no en el de TABS.
            El grupo las lista en el orden en que conviene cargarlas, y al
            elegirlo se cae en la primera. Si la fila las mostrara en el orden
            viejo, se caeria en «La entidad» pero se la veria tercera. */}
        <BarraPestanas
          pestanas={tabsDelGrupo.map(id => TABS.find(t => t.id === id)!)}
          activa={tab} onCambio={setTab} />

        {/* Aviso de Coherencia, visible en TODAS las pestañas.
            Los cruces vivían sólo adentro de su propia solapa: nueve chequeos
            —uno de ellos por $15,5M— que había que ir a buscar. Un chequeo que
            nadie abre es lo mismo que no tenerlo. */}
        {tab !== 'coherencia' && (nErrores > 0 || nAlertas > 0) && (
          <button
            onClick={() => setTab('coherencia')}
            className="w-full flex items-center gap-2 px-3 sm:px-6 py-2 min-h-[44px] sm:min-h-0 text-left border-t border-[#1f1f2b] bg-[#ff8a7a]/5 hover:bg-[#ff8a7a]/10 transition-colors">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0"
              style={{ color: nErrores > 0 ? '#ff8a7a' : '#fbbf24' }} strokeWidth={1.8} />
            <span className="text-[11px] text-[#d4d4dd] min-w-0">
              {nErrores > 0 && (
                <span className="text-[#ff8a7a] font-medium">
                  {nErrores} observable{nErrores === 1 ? '' : 's'}
                </span>
              )}
              {nErrores > 0 && nAlertas > 0 && <span className="text-[#8a8a9c]"> · </span>}
              {nAlertas > 0 && (
                <span className="text-[#fbbf24]">{nAlertas} para revisar</span>
              )}
              <span className="text-[#8a8a9c]"> en Coherencia</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#8a8a9c] ml-auto flex-shrink-0" />
          </button>
        )}
      </div>

      <div className="px-3 sm:px-6 py-4 pb-20 space-y-4">
        {/* La tarea en curso, arriba de todo y en TODAS las pestañas.
            Va afuera del switch a proposito: un flujo cruza pantallas, asi que
            la barra tiene que seguir ahi cuando el paso siguiente esta en otra
            solapa. Si viviera adentro de una, desapareceria justo al avanzar. */}
        <BarraFlujo flujoId={flujoId} pasoCrudo={pasoCrudo} datos={datosDeFlujo} />
        <Suspense fallback={Cargando}>
        {cargando ? (
          Cargando
        ) : tab === 'estado' ? (
          <div className="space-y-4">
            {/* Primero lo que se hace, despues lo que falta cargar y por ultimo
                lo que vence. De arriba abajo: accion, puesta en marcha, estado. */}
            <QueQuieroHacer {...{ entidad, pacientes: nPacientes, lotes, asociados, cuotas }} />
            {/* El checklist arriba de todo y solo mientras falte algo.
                Vivia unicamente en el manual, o sea en el unico lugar al que no
                entra quien recien empieza. Cuando esta completo se va solo: es
                una guia de arranque, no un panel permanente. */}
            {/* `datos` LE EVITA SEIS CONSULTAS. Este checklist mira entidad,
                autoridades, predios, genéticas, costos y libros: las seis ya
                están arriba, traídas por la ola de `cargar()`. Sin pasárselas
                se las pedía de nuevo —medido el 04/09/2026: volvían a salir a
                los 2.900 ms, casi un segundo después de haber llegado—. En el
                manual, donde nadie tiene nada cargado, sigue trayéndoselas. */}
            <PuestaEnMarcha ocultarSiCompleto
              titulo="Para empezar a usar el sistema"
              bajada="Esto se carga una vez. Cada renglón te lleva a dónde se hace."
              datos={puestaEnMarcha} />
            <Estado {...{ entidad, vencimientos, capacidad, requisitos, nPacientes, padron, recargar: cargar }} />
          </div>
        ) : tab === 'coherencia' ? (
          <Coherencia {...{ entidad, actas, libros, asociados, categorias, cuotas,
            pacientes: nPacientes, plantasFloracion: nPlantas, dispensas, costoPorGramo,
            gramosCosechados, lotes, padron: pacientes, cuotasEmitidas, periodo: periodoActual(), caja, saldos,
            pagosProveedor, fechaCorte,
            plantas, geneticas,
            autoridades, ddjj, traslados,
            // Los nombres de beneficiario van todos juntos: el cruce busca el
            // mismo escrito de dos formas, y eso solo se ve mirando la lista
            // entera, no tabla por tabla.
            beneficiarios: [
              ...documentos.map(d => d.proveedor ?? ''),
              ...lotes.map(l => l.proveedor ?? ''),
              ...nombresPagos,
            ],
            documentos }} />
        ) : tab === 'usuarios' ? (
          tienePermiso('gestionar_usuarios')
            ? <Usuarios miId={usuario?.id ?? null} />
            : <p className="text-[12px] text-[#8a8a9c]">Esta pantalla es de los administradores.</p>
        ) : tab === 'visitas' ? (
          <Visitas visitas={visitas} padron={padronCompleto}
            nombreUsuario={usuario?.nombre_completo ?? null}
            // Recarga las visitas ADEMÁS del resto: desde que se cargan al
            // abrir la pestaña, `cargar()` ya no las trae, y sin esto la visita
            // recién anotada no aparecía en la lista.
            onCambio={() => { recargarVisitas(); cargar() }} />
        ) : tab === 'solicitudes' ? (
          <Solicitudes onAlta={s => { setAltaDesdeSolicitud(s); setTab('pacientes') }}
            padron={padronCompleto} padronListo={!cargando}
            topeVinculados={entidad?.tope_pacientes ?? 150}
            onCambio={cargar} />
        ) : tab === 'pacientes' ? (
          <div className="space-y-4">
            {/* Los tres links del circuito de alta, arriba de la lista: quien
                atiende los necesita para mandarlos por WhatsApp, y hasta ahora
                los tenia que ir a buscar a la bio de Instagram. */}
            <details className="rounded-xl border border-[#1f1f2b] bg-[#0d0d12] overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer select-none text-[12px] text-[#a6a6b5] hover:text-[#ececf1] transition-colors">
                Cómo se suma alguien nuevo · los tres links para mandar
              </summary>
              <div className="px-4 pb-4">
                <p className="text-[11px] text-[#8a8a9c] leading-snug mb-3">
                  Esto pasa <b className="text-[#a6a6b5]">antes</b> de cargar a la persona acá.
                  La página pública con estos mismos pasos es{' '}
                  <a href="/sumate" target="_blank" rel="noopener noreferrer"
                    className="text-[#d9f99d] hover:underline">/sumate</a>, que es la
                  que conviene poner en Instagram.
                </p>
                <PasosAlta compacto />
              </div>
            </details>

            <details className="rounded-xl border border-[#1f1f2b] bg-[#0d0d12] overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer select-none text-[12px] text-[#a6a6b5] hover:text-[#ececf1] transition-colors">
                Importar respuestas del formulario
              </summary>
              <div className="px-4 pb-4">
                <ImportarFormulario onImportado={cargar} />
              </div>
            </details>
            <PaginaPacientes embebida
              prefill={altaDesdeSolicitud && {
                nombre_completo: altaDesdeSolicitud.nombre,
                dni: altaDesdeSolicitud.dni,
                email: altaDesdeSolicitud.email,
                telefono: altaDesdeSolicitud.telefono,
              }}
              onPrefillUsado={() => setAltaDesdeSolicitud(null)} />
          </div>
        ) : tab === 'cupo' ? (
          <CupoReprocann pacientes={pacientes} plantas={plantas} onCambio={cargar} />
        ) : tab === 'dispensas' ? (
          <Dispensas {...{ dispensas, pacientes, asociados, geneticas, costoPorGramo, gramosCosechados, lotes, entidad, feedbacks, caja, documentos }} onCambio={cargar} />
        ) : tab === 'portal' ? (
          <Portal {...{ pacientes, asociados, dispensas, feedbacks, caja, entidad, geneticas, gramosCosechados, documentos }} onCambio={cargar} />
        ) : tab === 'seguimiento' ? (
          <Seguimiento {...{ dispensas, feedbacks, pacientes, entidad }}
            directorMedico={requisitos.find(r => r.clave === 'director_medico')?.responsable ?? null}
            onCambio={cargar} />
        ) : tab === 'declaraciones' ? (
          <Declaraciones {...{ ddjj, traslados, pacientes, asociados, entidad }} onCambio={cargar}
            responsableTecnico={autoridades.find(a =>
              // Sin acentos: el cargo se escribe «Responsable Tecnico» o
              // «Responsable Técnico» segun quien lo cargue, y /tecnic/i no
              // matchea la forma acentuada. Con el cargo bien escrito, la
              // declaracion jurada salia firmada por
              // «[nombre del responsable tecnico]» sin ninguna pista del por que.
              sinAcentos(a.cargo ?? '').toLowerCase().includes('tecnic')
              && a.activo !== false)?.nombre}
            cultivo={{
              plantasTotal: plantas.filter(x => x.activa !== false).length,
              plantasFloracion: nPlantas,
              pacientesVinculados: pacientes.filter(x => x.reprocann_estado === 'Vigente').length,
              variedades: [...new Set(plantas.filter(x => x.activa !== false && x.genetica).map(x => x.genetica!))],
            }} />
        ) : tab === 'documentos' ? (
          <Documentos {...{ documentos, asociados, pacientes, dispensas, caja, entidad, autoridades, actas, lotes }}
            variedades={geneticas} onCambio={cargar} />
        ) : tab === 'nomina' ? (
          <NominaMinisterio
            datos={{
              entidad, padron: pacientes, lotes,
              plantasActivas: plantas.filter(x => x.activa !== false).length,
              plantasEnFloracion: nPlantas,
              // Null y no cero: la superficie vive en las áreas de cultivo, que
              // esta pantalla no carga. Un cero se leería como «no cultivan».
              m2Cultivados: null,
              domicilios: predios.filter(p => p.activo !== false).length,
            }}
            geneticas={[...new Set(plantas
              .filter(x => x.activa !== false)
              .map(x => x.genetica)
              .filter((g): g is string => !!g))]}
            onCambio={cargar} />
        ) : tab === 'movimientos' ? (
          <Movimientos caja={caja} dispensas={dispensas} documentos={documentos} />
        ) : tab === 'economia' ? (
          <>
            {/* El libro va ARRIBA del análisis: se entra acá a anotar un gasto
                mucho más seguido que a mirar el gráfico del mes. */}
            <LibroDeCaja caja={caja} onCambio={cargar} />
            <Economia caja={caja} documentos={documentos} saldos={saldos}
              fijosCargadosMes={fijosCargadosMes} />
          </>
        ) : tab === 'proveedores' ? (
          <Proveedores lotes={lotes} entidad={entidad} />
        ) : tab === 'libros' ? (
          <Libros libros={libros} onCambio={cargar} />
        ) : tab === 'actas' ? (
          <Actas {...{ actas, libros, asociados, autoridades, entidad }} onCambio={cargar} />
        ) : tab === 'asociados' ? (
          <Asociados {...{ asociados, categorias, cuotas, actas, pacientes, cuotasEmitidas }} onCambio={cargar} />
        ) : tab === 'entidad' ? (
          <div className="space-y-3">
            <FormEntidad entidad={entidad} onGuardado={cargar} />
            {/* El legajo institucional va DEBAJO de la ficha de la entidad y no
                en la pestana Documentos: esa pide `ver_plata`, y el estatuto lo
                tiene que poder leer el director medico. */}
            <LegajoInstitucional docs={docsInstitucionales} entidad={entidad} onCambio={cargar} />
          </div>
        ) : tab === 'autoridades' ? (
          <Autoridades autoridades={autoridades} entidad={entidad} onCambio={cargar} />
        ) : (
          <Predios predios={predios} entidad={entidad} onCambio={cargar} />
        )}
        </Suspense>
      </div>
    </div>
  )
}

// ===================== ESTADO =====================

function Estado({ entidad, vencimientos, capacidad, requisitos, nPacientes, padron, recargar }: {
  entidad: Entidad | null
  vencimientos: ReturnType<typeof calcularVencimientos>
  capacidad: ReturnType<typeof calcularCapacidad>
  requisitos: Requisito[]
  nPacientes: number
  padron: ReturnType<typeof estadoDelPadron>
  recargar: () => void
}) {
  if (!entidad) {
    // Sin entidad no hay vencimientos que calcular, pero los requisitos se
    // tildan igual: son lo primero que se toca al empezar.
    return (
      <div className="space-y-4">
      <div className={`${tarjeta} text-center py-12`}>
        <div className="mx-auto w-11 h-11 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-3">
          <Building2 className="w-5 h-5 text-[#8a8a9c]" />
        </div>
        <div className="font-display font-semibold text-[#d4d4dd] text-[14px]">Todavía no cargaste la entidad</div>
        <p className="mt-1 text-[11px] text-[#8a8a9c] max-w-md mx-auto">
          Cargá los datos del estatuto en la pestaña <b className="text-[#a6a6b5]">La entidad</b> —
          sobre todo el cierre de ejercicio y la duración del mandato— y acá aparecen los vencimientos.
        </p>
      </div>
      <Requisitos1780 {...{ requisitos, recargar }} />
      </div>
    )
  }

  const alarmas = vencimientos.filter(v => v.urgencia === 'vencido' || v.urgencia === 'critico')

  return (
    <div className="space-y-4">
      {alarmas.length > 0 && (
        <div className="rounded-xl border p-3 sm:p-4" style={{ background: 'rgba(122,40,32,0.10)', borderColor: '#7a2820' }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-[#ff8a7a]" />
            <h3 className="font-display font-semibold text-[14px] text-[#ff8a7a]">
              {alarmas.length} {alarmas.length === 1 ? 'plazo que necesita atención' : 'plazos que necesitan atención'}
            </h3>
          </div>
          <p className="text-[11px] text-[#c4c4d0]">
            Con esto sin resolver, los trámites de la asociación quedan frenados aunque el cultivo esté impecable.
          </p>
        </div>
      )}

      {/* Vencimientos */}
      <div className={tarjeta}>
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock className="w-4 h-4 text-[#f59e0b]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Vencimientos institucionales</h3>
        </div>
        <div className="space-y-2">
          {vencimientos.map(v => {
            const c = COLOR_URGENCIA[v.urgencia]
            return (
              <div key={v.clave} className="rounded-lg bg-[#15151d] border border-[#1f1f2b] px-3 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-[#ececf1]">{v.titulo}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium border"
                    style={{ color: c.txt, background: c.bg, borderColor: c.borde }}>
                    {v.fecha ? c.label : 'sin cargar'}
                  </span>
                  {/* EL VALOR, EN SU PROPIO RENGLON EN EL TELEFONO.
                      Con `ml-auto` a secas: cuando el titulo y la chapita no
                      entran junto al valor —«Entregas con respaldo REPROCANN» +
                      «Observable» ya se comen los 375px— el valor cae al
                      renglon de abajo Y SIGUE pegado a la derecha. Queda un
                      numero solo, alineado al borde derecho, arriba de un
                      parrafo alineado a la izquierda: no hay ninguna columna,
                      es un elemento suelto. Eso es lo que se ve desbalanceado.

                      `w-full` en el telefono lo baja a proposito, alineado al
                      MISMO borde izquierdo que el titulo y que la explicacion,
                      y lo agranda: en su renglon deja de ser un apendice del
                      encabezado y pasa a ser el dato de la fila. De `sm:` para
                      arriba vuelve a la derecha, donde si hay ancho para una
                      columna y las filas se leen como una tabla. */}
                  <span className="w-full sm:w-auto sm:ml-auto mt-1 sm:mt-0 text-[15px] sm:text-[12px] font-mono tabular-nums" style={{ color: c.txt }}>
                    {fmtFecha(v.fecha)} <span className="text-[#8a8a9c] text-[12px] sm:text-[12px]">· {textoDias(v.dias)}</span>
                  </span>
                </div>
                <p className="text-[11px] text-[#a6a6b5] mt-1.5">{v.queSignifica}</p>
                <p className="text-[11px] text-[#8a8a9c] mt-0.5">Se resuelve así: {v.comoSeResuelve}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Capacidad */}
      <div className={tarjeta}>
        <div className="flex items-center gap-2 mb-1">
          <Gauge className="w-4 h-4 text-[#a78bfa]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Capacidad habilitada</h3>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mb-3">
          Los topes de la Resolución 1780, cruzados contra lo que tenés cargado de verdad en la app.
        </p>
        <div className="space-y-3">
          {capacidad.map(l => {
            const pct = l.tope > 0 ? Math.min(100, (l.usado / l.tope) * 100) : 0
            const excedido = l.tope > 0 && l.usado > l.tope
            const color = excedido ? '#ff8a7a' : pct > 85 ? '#f59e0b' : '#bef264'
            return (
              <div key={l.titulo}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-[#d4d4dd]">{l.titulo}</span>
                  <span className="text-[13px] font-mono tabular-nums font-bold" style={{ color }}>
                    {l.usado} <span className="text-[#8a8a9c]">/ {l.tope}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-[#1f1f2b] overflow-hidden">
                  <div className="h-full w-full rounded-full origin-left transition-transform" style={{ transform: `scaleX(${pct / 100})`, background: color }} />
                </div>
                <p className="text-[10px] text-[#8a8a9c] mt-1">{l.detalle}</p>
                {excedido && (
                  <p className="text-[11px] text-[#ff8a7a] mt-0.5">
                    Estás por encima del tope. Revisalo antes de que lo vea un control.
                  </p>
                )}
              </div>
            )
          })}
        </div>
        <PadronEnElTope padron={padron} onCambio={recargar} />
        <p className="text-[11px] text-[#8a8a9c] mt-3 pt-3 border-t border-[#1f1f2b]">
          Transporte: con {nPacientes} paciente{nPacientes === 1 ? '' : 's'} vinculado{nPacientes === 1 ? '' : 's'} podés
          mover hasta <b className="text-[#a6a6b5] font-mono">{fmtPeso(topeTransporteG(nPacientes))}</b> entre
          tus predios, tomando 40 g por paciente. Aparte de eso, un traslado individual no puede superar
          los <b className="text-[#a6a6b5] font-mono">{TOPE_TRASLADO_INDIVIDUAL_G} g</b> por vez: si la necesidad
          medicinal es mayor, se hace en más de un viaje.
        </p>
      </div>

      <Requisitos1780 {...{ requisitos, recargar }} />
    </div>
  )
}


/**
 * Los requisitos de la Resolución 1780.
 *
 * Vive aparte de `Estado` a propósito: no depende de la entidad. Estaba adentro,
 * y `Estado` devuelve temprano cuando todavía no se cargó el estatuto —para
 * mostrar «Todavía no cargaste la entidad»—, así que ese return se llevaba
 * puesta la lista entera. La acción «Marcar los requisitos de la 1780» llevaba
 * a una pantalla donde la palabra «requisito» no aparecía, y justo en el estado
 * en que más se la necesita: el de una instalación recién empezada.
 *
 * Tildar «director médico» no requiere tener el estatuto cargado, así que la
 * lista se muestra siempre.
 */
function Requisitos1780({ requisitos, recargar }: {
  requisitos: Requisito[]
  recargar: () => void
}) {
  const cumplidos = requisitos.filter(r => r.cumplido).length
  return (
    <div id="requisitos" className={tarjeta}>
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} />
        <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Requisitos de la Resolución 1780</h3>
        <span className="ml-auto text-[12px] font-mono tabular-nums"
          style={{ color: cumplidos === requisitos.length ? '#bef264' : '#f59e0b' }}>
          {cumplidos}/{requisitos.length}
        </span>
      </div>
      <p className="text-[11px] text-[#8a8a9c] mb-3">Lo que hay que tener para pedir el botón de REPROCANN.</p>
      <div className="space-y-1.5">
        {requisitos.map(r => (
          <button key={r.clave}
            onClick={async () => {
              try {
                await ongService.actualizarRequisito(r.clave, { cumplido: !r.cumplido })
                recargar()
              } catch (e) { toast.error((e as Error).message) }
            }}
            className="w-full text-left rounded-lg bg-[#15151d] border border-[#1f1f2b] px-3 py-2.5 min-h-[44px] hover:border-[#404d20] transition-colors">
            <div className="flex items-start gap-2">
              {r.cumplido
                ? <CheckCircle2 className="w-4 h-4 text-[#bef264] flex-shrink-0 mt-0.5" />
                : <Circle className="w-4 h-4 text-[#8a8a9c] flex-shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <span className={`text-[13px] ${r.cumplido ? 'text-[#d9f99d]' : 'text-[#d4d4dd]'}`}>{r.titulo}</span>
                {r.detalle && <p className="text-[11px] text-[#8a8a9c] mt-0.5 leading-snug">{r.detalle}</p>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ===================== LA ENTIDAD =====================

function FormEntidad({ entidad, onGuardado }: { entidad: Entidad | null; onGuardado: () => void }) {
  const [f, setF] = useState<Partial<Entidad>>(entidad ?? {})
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { setF(entidad ?? {}) }, [entidad])

  const set = (k: keyof Entidad) => (v: string) =>
    setF(p => ({ ...p, [k]: v === '' ? null : v }))
  const setNum = (k: keyof Entidad) => (v: string) =>
    setF(p => ({ ...p, [k]: v === '' ? null : Number(v) }))

  const guardar = async () => {
    setGuardando(true)
    try {
      await ongService.guardarEntidad(f)
      toast.success('Datos de la entidad guardados')
      onGuardado()
    } catch (e) { toast.error((e as Error).message) } finally { setGuardando(false) }
  }

  const fin = finDeMandato(f.mandato_desde, f.mandato_anios)

  return (
    <div className="space-y-4">
      <GuiaDelFormulario id="entidad" />
      <div className={tarjeta}>
        <h3 className="font-display font-semibold text-[14px] text-[#ececf1] mb-3">Identificación</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label><span className={etiquetaCampo}>Razón social</span>
            <input className={inputFormulario} value={f.razon_social ?? ''} onChange={e => set('razon_social')(e.target.value)} placeholder="Asociación Civil ..." />
            <AyudaCampo id="entidad" campo="Razón social" /></label>
          <label><span className={etiquetaCampo}>CUIT</span>
            <input className={inputFormulario} {...sinAutocorreccion} value={f.cuit ?? ''} onChange={e => set('cuit')(e.target.value)} placeholder="30-00000000-0" />
            <AyudaCampo id="entidad" campo="CUIT" /></label>
          <label><span className={etiquetaCampo}>Jurisdicción</span>
            <input className={inputFormulario} value={f.jurisdiccion ?? ''} onChange={e => set('jurisdiccion')(e.target.value)} placeholder="CABA / Buenos Aires / ..." /></label>
          <label><span className={etiquetaCampo}>Nombre propio como proveedor</span>
            <input className={inputFormulario} value={f.proveedor_propio ?? ''}
              onChange={e => set('proveedor_propio')(e.target.value)} placeholder="Ej: Coop. la asociación" />
            <span className="block text-[10px] text-[#8a8a9c] mt-1 leading-snug">
              Si la propia asociación aparece como proveedor de su producción, poné acá
              ese nombre. Lo que esté así se muestra como producción propia y deja de
              contar como deuda.
            </span></label>
          <label className="sm:col-span-2 flex items-start gap-2.5 rounded-lg border border-[#5a4a20] bg-[#5a4a20]/10 p-3 cursor-pointer">
            <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#fbbf24]"
              checked={!!f.modo_beta}
              onChange={e => set('modo_beta')(e.target.checked as unknown as string)} />
            <span>
              <span className="block text-[12px] font-medium text-[#fbbf24]">Modo beta</span>
              <span className="block text-[11px] text-[#a6a6b5] mt-0.5 leading-relaxed">
                Los bloqueos se siguen mostrando pero no frenan. Sirve para operar mientras
                faltan estos datos. <b>Apagalo cuando estén cargados</b>: mientras esté prendido,
                una entrega sin respaldo se puede registrar igual. Coherencia te lo va a recordar.
              </span>
            </span>
          </label>
          <label><span className={etiquetaCampo}>Organismo de control</span>
            <input className={inputFormulario} value={f.organismo_control ?? ''} onChange={e => set('organismo_control')(e.target.value)} placeholder="IGJ / DPPJ" /></label>
          <label className="sm:col-span-2">
            <Check label="El estatuto declara el objeto cannábico" v={!!f.objeto_cannabis}
              on={v => setF(p => ({ ...p, objeto_cannabis: v }))} />
            <AyudaCampo id="entidad" campo="Objeto cannábico" /></label>
          <label><span className={etiquetaCampo}>Fecha de constitución</span>
            <input type="date" className={inputFormulario} value={f.fecha_constitucion ?? ''} onChange={e => set('fecha_constitucion')(e.target.value)} /></label>
        </div>
      </div>

      <div className={tarjeta}>
        <h3 className="font-display font-semibold text-[14px] text-[#ececf1] mb-1">Sede social</h3>
        <p className="text-[11px] text-[#8a8a9c] mb-3">
          Es declarativa, sirve para notificaciones. Puede estar en una jurisdicción distinta a la del cultivo.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label><span className={etiquetaCampo}>Domicilio</span>
            <input className={inputFormulario} value={f.sede_domicilio ?? ''} onChange={e => set('sede_domicilio')(e.target.value)} /></label>
          <label><span className={etiquetaCampo}>Localidad</span>
            <input className={inputFormulario} value={f.sede_localidad ?? ''} onChange={e => set('sede_localidad')(e.target.value)} /></label>
          <label><span className={etiquetaCampo}>Provincia</span>
            <input className={inputFormulario} value={f.sede_provincia ?? ''} onChange={e => set('sede_provincia')(e.target.value)} /></label>
        </div>
      </div>

      <div className={tarjeta}>
        <h3 className="font-display font-semibold text-[14px] text-[#ececf1] mb-1">Fechas que fija el estatuto</h3>
        <p className="text-[11px] text-[#8a8a9c] mb-3">
          De acá salen los vencimientos. El cierre de ejercicio y la duración del mandato están en tu estatuto: no se eligen.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="grid grid-cols-2 gap-2">
            <label><span className={etiquetaCampo}>Cierre · día</span>
              <input type="number" min={1} max={31} className={inputFormulario} value={f.cierre_ejercicio_dia ?? ''} onChange={e => setNum('cierre_ejercicio_dia')(e.target.value)} placeholder="30" /></label>
            <label><span className={etiquetaCampo}>Cierre · mes</span>
              <input type="number" min={1} max={12} className={inputFormulario} value={f.cierre_ejercicio_mes ?? ''} onChange={e => setNum('cierre_ejercicio_mes')(e.target.value)} placeholder="6" /></label>
            <div className="sm:col-span-2"><AyudaCampo id="entidad" campo="Cierre de ejercicio" /></div>
          </div>
          <label><span className={etiquetaCampo}>Duración del mandato (años)</span>
            <input type="number" min={1} max={10} className={inputFormulario} value={f.mandato_anios ?? ''} onChange={e => setNum('mandato_anios')(e.target.value)} placeholder="3" /></label>
          <label><span className={etiquetaCampo}>Mandato vigente desde</span>
            <input type="date" className={inputFormulario} value={f.mandato_desde ?? ''} onChange={e => set('mandato_desde')(e.target.value)} /></label>
          <div className="self-end pb-2 text-[12px] text-[#a6a6b5]">
            {fin ? <>Vence el <b className="text-[#d9f99d] font-mono">{fmtFecha(fin)}</b></> : 'Cargá inicio y duración para ver el vencimiento'}
          </div>
        </div>
      </div>

      <div className={tarjeta}>
        <h3 className="font-display font-semibold text-[14px] text-[#ececf1] mb-1">REPROCANN de la entidad</h3>
        <p className="text-[11px] text-[#8a8a9c] mb-3">
          Dura 1 año. Si no se reinscribe a tiempo no se vence: <b className="text-[#ff8a7a]">se cae</b> y hay que rehacer el trámite.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label><span className={etiquetaCampo}>Inscripción</span>
            <input type="date" className={inputFormulario} value={f.reprocann_inscripcion ?? ''} onChange={e => set('reprocann_inscripcion')(e.target.value)} /></label>
          <label><span className={etiquetaCampo}>Vencimiento</span>
            <input type="date" className={inputFormulario} value={f.reprocann_vencimiento ?? ''} onChange={e => set('reprocann_vencimiento')(e.target.value)} />
            <span className="block text-[10px] text-[#8a8a9c] mt-1">
              Para la ONG el permiso dura 1 año. Los 3 años son sólo para autocultivadores.
            </span></label>
          <label className="sm:col-span-2"><span className={etiquetaCampo}>Última revisión de libros</span>
            <input type="date" className={inputFormulario} value={f.ultima_revision_libros ?? ''} onChange={e => set('ultima_revision_libros')(e.target.value)} />
            <span className="block text-[10px] text-[#8a8a9c] mt-1">
              La Comisión Revisora debe examinar libros y documentación al menos cada tres meses. Desde acá se
              calcula cuándo toca la próxima.
            </span></label>
        </div>
      </div>

      <div className={tarjeta}>
        <h3 className="font-display font-semibold text-[14px] text-[#ececf1] mb-1">Topes</h3>
        <p className="text-[11px] text-[#8a8a9c] mb-3">
          Los de la 1780 vienen por defecto. El de pacientes es ampliable por solicitud, por eso se puede editar.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label><span className={etiquetaCampo}>Pacientes</span>
            <input type="number" className={inputFormulario} value={f.tope_pacientes ?? 150} onChange={e => setNum('tope_pacientes')(e.target.value)} /></label>
          <label><span className={etiquetaCampo}>Plantas por paciente</span>
            <input type="number" className={inputFormulario} value={f.plantas_por_paciente ?? 9} onChange={e => setNum('plantas_por_paciente')(e.target.value)} /></label>
          <label><span className={etiquetaCampo}>Predios</span>
            <input type="number" className={inputFormulario} value={f.tope_predios ?? 3} onChange={e => setNum('tope_predios')(e.target.value)} /></label>
        </div>
      </div>

      <div className={tarjeta}>
        <h3 className="font-display font-semibold text-[14px] text-[#ececf1] mb-1">Dirección técnica del cultivo</h3>
        <p className="text-[11px] text-[#8a8a9c] mb-3">
          Es otra figura que el Director Médico: el médico firma los informes clínicos de los
          pacientes, el técnico responde por el cultivo. De acá sale el rinde con el que
          <b className="text-[#a6a6b5]"> Coherencia</b> decide si la biomasa cierra contra las
          plantas que los socios justifican.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label><span className={etiquetaCampo}>Director Técnico</span>
            <input className={inputFormulario} value={f.director_tecnico ?? ''}
              onChange={e => set('director_tecnico')(e.target.value)} /></label>
          <label><span className={etiquetaCampo}>Matrícula</span>
            <input className={inputFormulario} value={f.director_tecnico_matricula ?? ''}
              onChange={e => set('director_tecnico_matricula')(e.target.value)} /></label>
          <label><span className={etiquetaCampo}>Rinde esperado por planta (g)</span>
            <input type="number" className={inputFormulario} value={f.rinde_esperado_planta_g ?? ''}
              onChange={e => setNum('rinde_esperado_planta_g')(e.target.value)} />
            <span className="block text-[10px] text-[#8a8a9c] mt-1">
              Vacío mientras no lo declare el DT. El sistema NO lo estima: el número que va
              acá es el que después sostiene, ante un control, que la biomasa salió del
              cultivo propio.
            </span></label>
        </div>
      </div>

      <button onClick={guardar} disabled={guardando} className={`${btnPrimario} w-full justify-center`}>
        {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Guardar datos de la entidad
      </button>
    </div>
  )
}

// ===================== AUTORIDADES =====================

function Autoridades({ autoridades, entidad, onCambio }: {
  autoridades: Autoridad[]; entidad: Entidad | null; onCambio: () => void
}) {
  const [form, setForm] = useState<Partial<Autoridad> | null>(null)

  // Para que la accion «Cargar una autoridad» abra
  // este formulario en vez de dejar en la lista.
  const nuevoRegistro = useCallback(() => setForm({}), [setForm])
  useAbrirAlLlegar(nuevoRegistro, '1', form != null)
  const fin = finDeMandato(entidad?.mandato_desde, entidad?.mandato_anios)

  const guardar = async () => {
    if (!form?.nombre || !form?.cargo) { toast.error('Nombre y cargo son obligatorios'); return }
    try { await ongService.guardarAutoridad(form); toast.success('Autoridad guardada'); setForm(null); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }
  const borrar = async (a: Autoridad) => {
    if (!(await confirmarBorrado(`¿Borrar a ${a.nombre} (${a.cargo})?`))) return
    try { await ongService.borrarAutoridad(a.id); toast.success('Borrada'); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="space-y-4">
      <div className={tarjeta}>
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">Autoridades</h3>
          <button onClick={() => setForm({ organo: 'Comisión Directiva' })} className={`${btnPrimario} flex-shrink-0`}>
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </div>
        {fin && (
          <p className="text-[11px] text-[#8a8a9c] mt-2">
            El mandato vigente vence el <b className="text-[#a6a6b5] font-mono">{fmtFecha(fin)}</b>.
            Con las autoridades vencidas no se puede hacer ningún trámite.
          </p>
        )}
      </div>

      {autoridades.length === 0 ? (
        <p className="text-[13px] text-[#8a8a9c] text-center py-8">Sin autoridades cargadas.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {autoridades.map(a => (
            <div key={a.id} className={tarjeta}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-[14px] text-[#ececf1] truncate">{a.nombre}</p>
                  <p className="text-[11px] text-[#d9f99d] mt-0.5">{a.cargo}</p>
                  <p className="text-[10px] text-[#8a8a9c] mt-0.5">{a.organo}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setForm(a)} className={btnSutil} aria-label="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => borrar(a)} className={btnSutil} aria-label="Borrar"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal titulo={form.id ? 'Editar autoridad' : 'Nueva autoridad'} onCerrar={() => setForm(null)}>
          {!form.id && <GuiaDelFormulario id="autoridad" />}
          <div className="space-y-3">
            <label><span className={etiquetaCampo}>Nombre</span>
              <input className={inputFormulario} value={form.nombre ?? ''} onChange={e => setForm({ ...form, nombre: e.target.value })} /></label>
            <label><span className={etiquetaCampo}>Cargo</span>
              <select className={inputFormulario} value={form.cargo ?? ''} onChange={e => setForm({ ...form, cargo: e.target.value })}>
                <option value="">Elegir…</option>
                {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <AyudaCampo id="autoridad" campo="Cargo" /></label>
            <label><span className={etiquetaCampo}>Órgano</span>
              <select className={inputFormulario} value={form.organo ?? ORGANOS[0]} onChange={e => setForm({ ...form, organo: e.target.value })}>
                {ORGANOS.map(o => <option key={o} value={o}>{o}</option>)}
              </select></label>
            <label><span className={etiquetaCampo}>Grupo familiar</span>
              <input className={inputFormulario} value={form.grupo_familiar ?? ''} placeholder="Ej: familia Pérez"
                onChange={e => setForm({ ...form, grupo_familiar: e.target.value || null })} />
              <AyudaCampo id="autoridad" campo="Grupo familiar" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className={etiquetaCampo}>Mandato desde</span>
                <input type="date" className={inputFormulario} value={form.desde ?? ''}
                  onChange={e => setForm({ ...form, desde: e.target.value || null })} /></label>
              <label><span className={etiquetaCampo}>Mandato hasta</span>
                <input type="date" className={inputFormulario} value={form.hasta ?? ''}
                  onChange={e => setForm({ ...form, hasta: e.target.value || null })} />
                <AyudaCampo id="autoridad" campo="Mandato hasta" /></label>
            </div>
            <div className="space-y-0.5 pt-1 border-t border-[#1f1f2b]">
              <span className={etiquetaCampo}>Requisitos de la Resolución 1780</span>
              <Check label="Antecedentes penales sin observaciones" v={!!form.antecedentes_penales_ok}
                on={v => setForm({ ...form, antecedentes_penales_ok: v })} />
              <Check label="CUIT activa, sin quiebra ni Base APOC" v={!!form.cuit_activa}
                on={v => setForm({ ...form, cuit_activa: v })} />
              <Check label="REPROCANN activo" v={!!form.reprocann_activo}
                on={v => setForm({ ...form, reprocann_activo: v })} />
              <Check label="Es miembro fundador" v={!!form.fundador}
                on={v => setForm({ ...form, fundador: v })} />
            </div>
            <button onClick={guardar} className={`${btnPrimario} w-full justify-center`}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ===================== PREDIOS =====================

function Predios({ predios, entidad, onCambio }: {
  predios: Predio[]; entidad: Entidad | null; onCambio: () => void
}) {
  const [form, setForm] = useState<Partial<Predio> | null>(null)

  // Para que la accion «Cargar un predio» abra
  // este formulario en vez de dejar en la lista.
  const nuevoRegistro = useCallback(() => setForm({}), [setForm])
  useAbrirAlLlegar(nuevoRegistro, '1', form != null)
  const tope = entidad?.tope_predios ?? 3

  const guardar = async () => {
    if (!form?.nombre) { toast.error('El nombre es obligatorio'); return }
    try { await ongService.guardarPredio(form); toast.success('Predio guardado'); setForm(null); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }
  const borrar = async (p: Predio) => {
    if (!(await confirmarBorrado(`¿Borrar el predio "${p.nombre}"?`))) return
    try { await ongService.borrarPredio(p.id); toast.success('Borrado'); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="space-y-4">
      <div className={tarjeta}>
        <div className="flex items-center gap-2 flex-wrap">
          <MapPin className="w-4 h-4 text-[#fb923c]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1 min-w-0">Predios de cultivo</h3>
          <span className="text-[12px] font-mono tabular-nums text-[#a6a6b5]">{predios.length} / {tope}</span>
          <button onClick={() => setForm({})} className={`${btnPrimario} flex-shrink-0`} disabled={predios.length >= tope}>
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2">
          La georreferenciación y la notificación al municipio son <b className="text-[#a6a6b5]">por predio</b>, no por entidad.
        </p>
      </div>

      {predios.length === 0 ? (
        <p className="text-[13px] text-[#8a8a9c] text-center py-8">Sin predios cargados.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {predios.map(p => (
            <div key={p.id} className={tarjeta}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-[14px] text-[#ececf1] truncate">{p.nombre}</p>
                  <p className="text-[11px] text-[#8a8a9c] mt-0.5 truncate">
                    {[p.direccion, p.localidad, p.provincia].filter(Boolean).join(', ') || 'Sin dirección'}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Chip ok={!!p.georreferenciado} txt="Georreferenciado" />
                    <Chip ok={!!p.municipio_notificado} txt="Municipio notificado" />
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setForm(p)} className={btnSutil} aria-label="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => borrar(p)} className={btnSutil} aria-label="Borrar"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal titulo={form.id ? 'Editar predio' : 'Nuevo predio'} onCerrar={() => setForm(null)}>
          {!form.id && <GuiaDelFormulario id="predio" />}
          <div className="space-y-3">
            <label><span className={etiquetaCampo}>Nombre</span>
              <input className={inputFormulario} value={form.nombre ?? ''} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Sala principal" /></label>
            <label><span className={etiquetaCampo}>Dirección</span>
              <input className={inputFormulario} value={form.direccion ?? ''} onChange={e => setForm({ ...form, direccion: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className={etiquetaCampo}>Localidad</span>
                <input className={inputFormulario} value={form.localidad ?? ''} onChange={e => setForm({ ...form, localidad: e.target.value })} /></label>
              <label><span className={etiquetaCampo}>Provincia</span>
                <input className={inputFormulario} value={form.provincia ?? ''} onChange={e => setForm({ ...form, provincia: e.target.value })} /></label>
            </div>
            <label><span className={etiquetaCampo}>Municipio</span>
              <input className={inputFormulario} value={form.municipio ?? ''} onChange={e => setForm({ ...form, municipio: e.target.value })} /></label>
            <div className="flex flex-wrap gap-3 pt-1">
              <div>
                <Check label="Georreferenciado" v={!!form.georreferenciado} on={v => setForm({ ...form, georreferenciado: v })} />
                <AyudaCampo id="predio" campo="Georreferenciado" />
              </div>
              <Check label="Municipio notificado" v={!!form.municipio_notificado} on={v => setForm({ ...form, municipio_notificado: v })} />
            </div>
            <button onClick={guardar} className={`${btnPrimario} w-full justify-center`}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ===================== auxiliares =====================

function Chip({ ok, txt }: { ok: boolean; txt: string }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1"
      style={ok
        ? { color: '#bef264', background: 'rgba(163,230,53,0.12)', borderColor: '#404d20' }
        : { color: '#8f8f9f', background: 'rgba(180,180,200,0.06)', borderColor: '#2a2a3a' }}>
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}{txt}
    </span>
  )
}

function Check({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => on(!v)}
      className="inline-flex items-center gap-2 text-[12px] text-[#d4d4dd] min-h-[44px] sm:min-h-0">
      {v ? <CheckCircle2 className="w-4 h-4 text-[#bef264]" /> : <Circle className="w-4 h-4 text-[#8a8a9c]" />}
      {label}
    </button>
  )
}

function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  const refDialogo = useDialogo(onCerrar)
  return (
    <div ref={refDialogo} className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3" onClick={onCerrar}>
      <div className="bg-[#101016] border border-[#2a2a3a] rounded-xl w-full max-w-lg max-h-[85dvh] overflow-y-auto overscroll-contain"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f2b] sticky top-0 bg-[#101016]">
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">{titulo}</h3>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center text-[#8f8f9f] hover:text-[#ececf1]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
        <div className="px-4 py-3 border-t border-[#1f1f2b] sticky bottom-0 bg-[#101016]">
          <button onClick={onCerrar} className="w-full min-h-[44px] flex items-center justify-center rounded-lg border border-[#2a2a3a] text-[12px] text-[#a6a6b5] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
