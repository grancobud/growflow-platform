// PaginaPanel — la RUTINA DE APERTURA de la sede, no un resumen de todo.
//
// Fue un dashboard de cultivo y dejo de serlo en dos pasos, los dos a pedido
// de la asociación: el 02/09/2026 se fue la lista de plantas activas («todo eso no me
// hace falta en panel») y el 03/09/2026 se fue «Ultima actividad».
//
// Lo que queda es lo que se mira al abrir la sede, en orden: la lectura de
// sala, la caja, el stock y las novedades. Lo demas esta a un toque en su
// pantalla, que es donde alguien lo va a buscar cuando lo necesite.

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight, Sprout, BellRing, Wrench, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  ongService, calcularVencimientos, credencialesDelPadron, diasHasta, resumenCaja, sufijoUnidad,
  DIAS_AVISO_CREDENCIAL, type Vencimiento, type CredencialesDelPadron, type ResumenCaja, type Dispensa,
} from '../lib/ong'
import { toast } from 'sonner'
import { registroService } from '../lib/registro'
import { portalService, disponibleDeLote, type Lote, type Pedido } from '../lib/portal'
import { AperturaDeSede, type LoteEnStock } from '../components/panel/AperturaDeSede'
import { ModalArqueo } from '../components/panel/ModalArqueo'
import { arqueosService, type Arqueo } from '../lib/arqueos'
import { BotoneraPanel } from '../components/BotoneraPanel'
import { accionesOng, type Accion } from '../lib/accionesOng'
import { stockService, proximoEfectivo, diasParaProximo, type Mantenimiento, type Insumo } from '../lib/stock'
import {
  ambienteService, vpd, faltaLecturaDelTurno, turnoDe, TURNO_LABEL, type Lectura,
} from '../lib/ambiente'
import { EASE } from '../lib/motion'
import { useAuth } from '../hooks/useAuth'
import { nombreParaMostrar } from '../lib/buscarPersonas'



export default function PaginaPanel() {
  const { tienePermiso } = useAuth()
  const [mantes, setMantes] = useState<Mantenimiento[]>([])
  // Vencimientos de la ONG: si el mandato o el REPROCANN se caen, no se puede
  // hacer ningun tramite. Tienen que verse apenas entras, no dentro de /ong.
  const [vencONG, setVencONG] = useState<Vencimiento[]>([])
  // Las credenciales REPROCANN del padron. Hasta ahora solo se veian entrando a
  // Coherencia, y una credencial vencida no la busca nadie: aparece el dia que
  // alguien viene a retirar y ya no se le puede entregar.
  const [credenciales, setCredenciales] = useState<CredencialesDelPadron | null>(null)
  const [ultimaAmb, setUltimaAmb] = useState<Lectura | null>(null)
  const [haySalas, setHaySalas] = useState(false)
  const [insumos, setInsumos] = useState<Insumo[]>([])
  // Las acciones del Panel salen de la MISMA fuente que las de la O.N.G.:
  // accionesOng ya sabe el estado de cada una y por que. Duplicar la lista aca
  // seria condenarlas a desincronizarse.
  const [acciones, setAcciones] = useState<Accion[]>([])

  // LO QUE EL ENCARGADO MIRA AL ABRIR: caja y stock.
  //
  // Van en su propio `Promise.all` y con `catch` por rama, como el resto de lo
  // que cuelga del panel: si la caja no carga, el stock igual se ve. Y se piden
  // SOLO si el rol los puede ver — no por prolijidad, sino porque el RLS le
  // devolveria cero filas a quien no corresponde y el panel mostraria una caja
  // en $0, que se lee como un dato y no como un permiso. Es exactamente el
  // sintoma que ya costo caro con las pestanas de la O.N.G.
  const [caja, setCaja] = useState<ResumenCaja | null>(null)
  const [lotes, setLotes] = useState<Lote[] | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [dispensas, setDispensas] = useState<Dispensa[]>([])
  const refNovedades = useRef<HTMLDivElement | null>(null)
  // El último arqueo. Sirve para dos cosas: saber si los pasos 2 y 3 ya se
  // hicieron HOY, y no tener que pedir la lista entera para eso.
  const [ultimoArqueo, setUltimoArqueo] = useState<Arqueo | null>(null)
  const [arqueando, setArqueando] = useState(false)

  async function cargar() {
    try {
      // TRES CONSULTAS MENOS EN LA PANTALLA DE ENTRADA. Se fueron con lo que
      // las pedia: las cosechas con el total de gramos secos de las tarjetas,
      // el resumen de plantas con la lista de plantas activas, y los ultimos
      // eventos con «Ultima actividad». El resumen de plantas quedaba servido
      // solo para poder poner el nombre de la planta al lado de cada evento.
      const [man, ins] = await Promise.all([
        stockService.getMantenimientos().catch(() => []),
        stockService.getInsumos().catch(() => []),
      ])
      setMantes(man)
      setInsumos(ins)
    } catch (err) {
      console.error('Error cargando panel:', err)
    }
  }
  // LA REGLA EMPEZO A CORRER RECIEN AL SACAR «Ultima actividad» (03/09/2026), y
  // no porque la carga haya cambiado: el compilador de React se plantaba antes
  // en este componente y con el bloque menos pudo analizarlo. El aviso es un
  // falso positivo del mismo tipo que el de `Layout` y `Solicitudes`: `cargar`
  // es `async` y su primera instruccion es un `await`, asi que ningun `setState`
  // corre sincronico dentro del efecto — corren todos despues del microtask.
  // Traer datos al montar ES lo que un efecto tiene que hacer.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar()
    // Las credenciales del padron. Si falla, el panel sigue andando igual: es un
    // aviso, no el contenido de la pantalla.
    registroService.getPacientes(true)
      .then(ps => setCredenciales(credencialesDelPadron(ps)))
      .catch(() => {})
    // Vencimientos de la ONG a 60 días: si falla, el panel sigue andando igual.
    ongService.getEntidad()
      .then(e => setVencONG(calcularVencimientos(e).filter(v => v.fecha && v.dias != null && v.dias <= 60)))
      .catch(() => {})
    // La botonera necesita saber si hay pacientes, lotes, socios y cuotas para
    // decidir que se puede hacer. Si algo falla queda vacio y la seccion no se
    // muestra: mejor sin botonera que con una que miente sobre lo que se puede.
    Promise.all([
      ongService.getEntidad().catch(() => null),
      registroService.getPacientes().catch(() => []),
      portalService.getLotes().catch(() => []),
      ongService.getAsociados().catch(() => []),
      ongService.getCuotas().catch(() => []),
    ])
      .then(([ent, pac, lot, aso, cuo]) =>
        setAcciones(accionesOng({ entidad: ent, pacientes: pac.length, lotes: lot, asociados: aso, cuotas: cuo })))
      .catch(() => {})
    // Ambiente: mismo criterio, si falla no arrastra al resto del panel.
    Promise.all([ambienteService.ultimaLectura(), ambienteService.getSalas()])
      .then(([u, s]) => { setUltimaAmb(u); setHaySalas(s.some(x => x.activa)) })
      .catch(() => {})
    // La caja del paso 2, solo para quien la puede ver.
    if (tienePermiso('ver_plata')) {
      ongService.getCaja().then(a => setCaja(resumenCaja(a))).catch(() => {})
      arqueosService.listar(1).then(a => setUltimoArqueo(a[0] ?? null)).catch(() => {})
    }
    // El stock del paso 3. Son tres tablas porque el disponible de un lote se
    // CALCULA: `disponibleDeLote` descuenta las reservas del portal y las
    // dispensas de mostrador. No hay una columna «queda tanto» que leer, y
    // guardarla seria el derivado que se desincroniza a la primera correccion
    // — el mismo criterio que el VPD y que la capacidad de un area.
    if (tienePermiso('ver_ong')) {
      Promise.all([
        portalService.getLotes().catch(() => []),
        portalService.getPedidos().catch(() => []),
        ongService.getDispensas().catch(() => []),
      ])
        .then(([l, p, d]) => { setLotes(l); setPedidos(p); setDispensas(d) })
        .catch(() => {})
    }
    // `tienePermiso` es estable por rol (useCallback sobre usuario.rol), asi que
    // esto corre una vez y no en cada render.
  }, [tienePermiso])

  // Alarmas de mantenimiento: vencidas, para hoy o mañana (diasParaProximo <= 1).
  const alarmas = mantes
    .map(m => ({ m, dias: diasParaProximo(m) }))
    .filter(x => x.dias !== null && (x.dias as number) <= 1)
    .sort((a, b) => (a.dias as number) - (b.dias as number))

  const hechoHoy = async (m: Mantenimiento) => {
    try {
      // UNA SOLA LECTURA DEL RELOJ para las dos fechas. Leerlo dos veces —una
      // para el proximo y otra para el realizado— deja que a las 23:59:59 el
      // mantenimiento quede hecho un dia y agendado desde el siguiente.
      const ahora = new Date()
      const proximo = m.frecuencia_dias
        ? new Date(ahora.getTime() + m.frecuencia_dias * 86400000).toISOString().slice(0, 10)
        : null
      await stockService.actualizarMantenimiento(m.id, { fecha_realizado: ahora.toISOString().slice(0, 10), proximo })
      toast.success('Registrado como hecho hoy'); cargar()
    } catch (err) { toast.error(`Error: ${(err as Error).message}`) }
  }


  // El paso 3: lo que queda de cada lote, ordenado de mayor a menor.
  //
  // Se muestran los cinco primeros y no los ciento uno: es un resumen para
  // mirar de parado, y la lista entera vive en el catalogo, a un toque. Se
  // filtran los vacios porque un lote en cero no es stock, es historia.
  const stock = useMemo(() => {
    if (!lotes) return null
    const ahora = new Date()
    const conSaldo: LoteEnStock[] = lotes
      .filter(l => l.activo !== false)
      .map(l => ({
        codigo: l.codigo,
        producto: l.producto,
        disponible: disponibleDeLote(l, pedidos, dispensas, ahora).disponible,
        sufijo: sufijoUnidad(l.unidad),
      }))
      .filter(l => l.disponible > 0)
      .sort((a, b) => b.disponible - a.disponible)
    return {
      // El total suma SOLO gramos. Sumar frascos de aceite con gramos de flor da
      // un numero que no significa nada; es el mismo criterio de `resumenCatalogo`.
      total: conSaldo.filter(l => l.sufijo === 'g').reduce((s, l) => s + l.disponible, 0),
      otrasUnidades: conSaldo.filter(l => l.sufijo !== 'g').length,
      lotes: conSaldo.slice(0, 5),
    }
  }, [lotes, pedidos, dispensas])

  /**
   * ¿Se controló HOY, y qué parte?
   *
   * Por día y no por turno: el arqueo es de apertura, y pedir uno por turno
   * convertiría el tilde en algo que se apaga a mitad de la tarde sin que nadie
   * haya hecho nada mal. Se mira cada parte por separado porque se puede contar
   * sólo la caja, sólo el stock, o las dos.
   */
  const arqueoDeHoy = useMemo(() => {
    if (!ultimoArqueo) return null
    const hoy = new Date().toDateString()
    if (new Date(ultimoArqueo.momento).toDateString() !== hoy) return null
    return {
      caja: ultimoArqueo.contado_efectivo != null || ultimoArqueo.contado_transferencia != null,
      stock: ultimoArqueo.contado_stock_g != null,
      hora: new Date(ultimoArqueo.momento).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    }
  }, [ultimoArqueo])

  // El paso 1. `faltaLecturaDelTurno` devuelve `null` cuando no hay salas: no
  // hay rutina que reclamar hasta que alguien cargue una.
  const ambiente = useMemo(() => {
    const falta = faltaLecturaDelTurno(ultimaAmb, haySalas)
    const turno = TURNO_LABEL[turnoDe(new Date().toISOString())]
    if (falta === null) return null
    if (falta) {
      return { falta, turno, detalle: ultimaAmb
        ? `Última: ${new Date(ultimaAmb.medido_en).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} — tocá para cargarla.`
        : 'Todavía no cargaste ninguna — tocá para cargarla.' }
    }
    const t = Number(ultimaAmb!.temp_c), h = Number(ultimaAmb!.humedad_pct)
    return { falta, turno, detalle: `${t} °C · ${h} % · VPD ${vpd(t, h)} — lectura de la ${TURNO_LABEL[turnoDe(ultimaAmb!.medido_en)]} cargada.` }
  }, [ultimaAmb, haySalas])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#0a0a0f] text-[#d4d4dd] font-sans">
      <div className="sticky top-0 z-40 bg-[#0a0a0f] border-b border-[#1f1f2b]">
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3">
          <div className="min-w-0">
            <h1 className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] text-[#ececf1]">
              GrowFlow <span className="text-[#8a8a9c] font-semibold">·</span> <span className="text-[#d9f99d]">la asociación</span>
            </h1>
            <div className="mt-0.5 text-[10px] sm:text-[11px] text-[#8a8a9c]">
              Lo de todos los días, en orden
            </div>
          </div>
          <div className="flex-1" />
          {/* min-h-[44px] en mobile: con py-1.5 el boton queda en 31px de alto. */}
          <Link to="/plantas"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded-md border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[11px] font-medium text-[#d9f99d]">
            <Sprout className="w-3.5 h-3.5" /> Plantas
          </Link>
        </div>
      </div>

      <div className="px-3 sm:px-6 py-4 sm:py-5 pb-20 space-y-4 sm:space-y-5">
        {/* LA RUTINA DE APERTURA VA PRIMERO, arriba de los vencimientos y de las
            alarmas. No es que importe mas: es que es lo que se hace TODOS los
            dias, y lo otro son excepciones. Una pantalla que abre con la
            excepcion obliga a saltearla para llegar a lo de siempre. */}
        <AperturaDeSede ambiente={ambiente} caja={caja} stock={stock}
          arqueoDeHoy={arqueoDeHoy}
          onArquear={() => setArqueando(true)}
          onNovedades={() => refNovedades.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />

        {arqueando && (
          <ModalArqueo
            esperado={{
              efectivo: caja?.netoEfectivo ?? null,
              transferencia: caja?.netoTransferencia ?? null,
              stockG: stock?.total ?? null,
            }}
            onCerrar={() => setArqueando(false)}
            onListo={() => arqueosService.listar(1).then(a => setUltimoArqueo(a[0] ?? null)).catch(() => {})} />
        )}

        {/* Vencimientos institucionales: con esto caido no se puede tramitar nada */}
        {vencONG.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}
            className="rounded-xl border border-[#7a2820] bg-[#7a2820]/10 overflow-hidden">
            <Link to="/ong" className="block px-4 py-3 hover:bg-[#7a2820]/10 transition-colors">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-[#ff8a7a] flex-shrink-0" />
                <h3 className="font-display font-bold text-[13px] text-[#ff8a7a]">
                  {vencONG.length} vencimiento{vencONG.length === 1 ? '' : 's'} de la ONG
                </h3>
              </div>
              <ul className="space-y-1">
                {vencONG.map(v => (
                  <li key={v.clave} className="text-[11px] text-[#c4c4d0] flex items-baseline gap-2">
                    <span className="text-[#ececf1]">{v.titulo}</span>
                    <span className="font-mono tabular-nums" style={{ color: (v.dias ?? 0) < 0 ? '#ff8a7a' : '#f59e0b' }}>
                      {(v.dias ?? 0) < 0 ? `vencido hace ${Math.abs(v.dias ?? 0)} d` : `en ${v.dias} d`}
                    </span>
                  </li>
                ))}
              </ul>
            </Link>
          </motion.div>
        )}

        {/* Alarmas de mantenimiento (se ven apenas entrás a la app) */}
        {alarmas.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}
            className="rounded-xl border border-[#5a4a20] bg-gradient-to-br from-[#f59e0b]/12 to-[#ff8a7a]/[0.08] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#5a4a20]/60 bg-[#f59e0b]/[0.08]">
              <span className="relative flex h-4 w-4 items-center justify-center flex-shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#fbbf24]/40" />
                <BellRing className="w-4 h-4 text-[#fbbf24] relative" />
              </span>
              <h3 className="font-display font-bold text-[13px] text-[#fbbf24]">
                {alarmas.length} alarma{alarmas.length === 1 ? '' : 's'} de mantenimiento
              </h3>
              <span className="hidden sm:inline text-[10px] text-[#a6a6b5]">— para hoy, mañana o vencidas</span>
              <Link to="/stock" className="ml-auto text-[11px] text-[#fbbf24] hover:text-[#fde68a] font-medium flex items-center gap-1 flex-shrink-0">
                Ver todo <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <ul className="divide-y divide-[#5a4a20]/30">
              {alarmas.map(({ m, dias }) => {
                const d = dias as number
                const vinc = m.insumo_id ? insumos.find(i => i.id === m.insumo_id) : null
                const titulo = vinc?.nombre || m.equipo || 'Equipo'
                const cuando = d < 0 ? { txt: `Vencido hace ${Math.abs(d)}d`, col: '#ff8a7a' } : d === 0 ? { txt: 'Hoy', col: '#fb923c' } : { txt: 'Mañana', col: '#fbbf24' }
                return (
                  <li key={m.id} className="flex items-center gap-2.5 px-4 py-2">
                    <Wrench className="w-3.5 h-3.5 text-[#a78bfa] flex-shrink-0" />
                    <span className="font-medium text-[12px] text-[#ececf1] truncate">{titulo}</span>
                    <span className="hidden sm:inline text-[10px] text-[#a6a6b5] truncate">· {m.tipo} · próx {proximoEfectivo(m) ? new Date(proximoEfectivo(m)! + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '—'}</span>
                    <span className="ml-auto text-[11px] font-semibold flex-shrink-0" style={{ color: cuando.col }}>{cuando.txt}</span>
                    <button onClick={() => hechoHoy(m)} className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#404d20] bg-[#a3e635]/10 hover:bg-[#a3e635]/20 text-[10px] font-medium text-[#d9f99d] transition-colors" title="Marcar como hecho hoy">
                      <CheckCircle2 className="w-3 h-3" /> Hecho
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        )}


        {/* SÓLO LO QUE ESTE ROL PUEDE HACER. Antes se mostraban las treinta y
            nueve a todo el mundo: un cultivador veía «Anotar un gasto o un pago»
            en su pantalla de entrada, la tocaba, y la base se lo rechazaba. Es
            el mismo problema que resolvió `PERMISO_DE_TAB` con las pestañas —una
            pantalla que no te corresponde se lee como rota, no como prohibida—,
            y acá pesa más porque es la primera pantalla que se ve. */}
        <div ref={refNovedades}>
          <BotoneraPanel acciones={acciones.filter(a => tienePermiso(a.permiso))} />
        </div>

        <TarjetaCredenciales cred={credenciales} />

      </div>
    </div>
  )
}

/**
 * Recordatorio de la lectura de ambiente.
 *
 * No es una tarjeta de numeros mas: la carga manual es una rutina de dos veces
 * por dia, y una rutina se sostiene solo si algo la recuerda. El Panel es la
 * pantalla que se abre primero, asi que es el lugar donde el recordatorio
 * llega a tiempo.
 *
 * Cambia de tono segun haga falta: cuando la lectura del turno esta cargada se
 * queda quieta mostrando el ultimo valor, y cuando falta se enciende. Una
 * alerta que esta siempre prendida deja de leerse a la semana.
 *
 * Si todavia no hay ninguna sala no muestra nada: retar a alguien por no
 * cargar algo que no puede cargar es peor que quedarse callado.
 */
/**
 * Las credenciales REPROCANN que se vencieron o estan por vencerse.
 *
 * POR QUE ESTA ACA Y NO SOLO EN COHERENCIA
 *
 * El cruce `credenciales_vencidas` existe desde el 27/08/2026, pero solo se ve
 * entrando a Coherencia — y a Coherencia se entra cuando uno sospecha que algo
 * anda mal. Un vencimiento no despierta ninguna sospecha: no mueve ningun
 * total, el padron sigue teniendo la misma gente y las mismas plantas
 * habilitadas. Se descubre el dia que la persona viene a retirar, que es
 * exactamente cuando ya no se puede hacer nada.
 *
 * Por eso sale al Panel, que es lo primero que se abre — el mismo criterio que
 * ya se habia tomado con los vencimientos de la ONG.
 *
 * No hay tarjeta de «todo en orden»: si no hay nada que avisar no se dibuja
 * nada. Un aviso que esta siempre encendido deja de leerse, y el Panel ya tiene
 * donde mirar el estado completo.
 */
function TarjetaCredenciales({ cred }: { cred: CredencialesDelPadron | null }) {
  if (!cred) return null
  const { vencidas, porVencer } = cred
  if (vencidas.length === 0 && porVencer.length === 0) return null

  // Lo vencido gana sobre lo por vencer: si hay una caida, el aviso es rojo
  // aunque ademas haya tres proximas.
  const hayVencidas = vencidas.length > 0
  const color = hayVencidas ? '#ff8a7a' : '#f59e0b'
  const borde = hayVencidas ? '#7a2820' : '#5a4a20'

  // Primero las vencidas y despues las que se caen antes: es el orden en que
  // hay que ocuparse.
  const filas = [...vencidas, ...porVencer]
    .sort((a, b) => String(a.reprocann_vencimiento).localeCompare(String(b.reprocann_vencimiento)))
    .slice(0, 4)
  const resto = vencidas.length + porVencer.length - filas.length

  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: borde, background: `${borde}1a` }}>
      <Link to="/ong/pacientes" className="block px-4 py-3 transition-colors hover:brightness-125">
        <div className="flex items-center gap-2 mb-1.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color }} />
          <h3 className="font-display font-bold text-[13px]" style={{ color }}>
            {hayVencidas
              ? `${vencidas.length} credencial${vencidas.length === 1 ? '' : 'es'} REPROCANN vencida${vencidas.length === 1 ? '' : 's'}`
              : `${porVencer.length} credencial${porVencer.length === 1 ? '' : 'es'} vence${porVencer.length === 1 ? '' : 'n'} en ${DIAS_AVISO_CREDENCIAL} días`}
          </h3>
        </div>
        <ul className="space-y-1">
          {filas.map(p => {
            const d = diasHasta(String(p.reprocann_vencimiento))
            return (
              <li key={p.id} className="text-[11px] text-[#c4c4d0] flex items-baseline gap-2">
                <span className="text-[#ececf1] truncate">{nombreParaMostrar(p) || 'Sin nombre'}</span>
                <span className="font-mono tabular-nums flex-shrink-0"
                  style={{ color: d < 0 ? '#ff8a7a' : '#f59e0b' }}>
                  {d < 0 ? `vencida hace ${Math.abs(d)} d` : d === 0 ? 'vence hoy' : `en ${d} d`}
                </span>
              </li>
            )
          })}
          {resto > 0 && (
            <li className="text-[11px] text-[#8a8a9c]">y {resto} más</li>
          )}
        </ul>
        <p className="text-[10px] text-[#8a8a9c] mt-2">
          {hayVencidas
            ? 'Lo que se le entregue a esa persona no está amparado por la 27.350. Tocá para ver la ficha.'
            : 'Todavía están vigentes: es el momento de avisarles, no cuando ya no se les pueda entregar.'}
        </p>
      </Link>
    </motion.div>
  )
}
