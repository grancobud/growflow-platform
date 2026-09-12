// La bandeja: quién pidió sumarse y qué falta decidir.
//
// Es la otra mitad del circuito público. Del lado de afuera la persona deja sus
// datos y sigue su trámite por un link propio; de este lado alguien las mira y
// resuelve. Antes eso pasaba por WhatsApp y la ficha se tipeaba a mano.
//
// EL ALTA AUTOMÁTICA, Y POR QUÉ ESTE COMENTARIO CAMBIÓ.
//
// Acá decía que un alta automática dejaría entrar datos que nadie miró, y que
// por eso «dar de alta» sólo abría el formulario con los datos puestos para que
// una persona lo revisara. Gastón pidió automatizarlo el 23/08/2026, así que la
// decisión cambió — pero el reparo original seguía siendo bueno, y lo que se
// hizo fue contestarlo en vez de ignorarlo:
//
//   · Lo que entra sin que nadie lo mire pasa por las guardas de
//     `decidirSolicitud`: nombre, un DNI que parezca un DNI, sin duplicado
//     por DNI, teléfono ni mail, y con lugar bajo el tope de la 1780.
//   · Lo que NO pasa una guarda no se rechaza: se le escribe el motivo y queda
//     en esta misma lista, que es exactamente lo que pasaba antes con todas.
//   · El alta como ASOCIADO sigue necesitando el acta de Comisión Directiva.
//     Eso no se automatizó ni se puede: la ficha queda en la cola de altas sin
//     acta para que una sola las ratifique a todas.
//
// SON TRES CAMINOS, NO DOS (26/08/2026).
//
// Cuando el link se le manda a los 211 socios que YA ESTÁN —para que firmen el
// mandato y carguen su REPROCANN— «dar de alta» y «frenar» son las dos malas.
// La primera duplica la ficha; la segunda deja 211 items para revisar a mano y
// la firma huérfana, sin llegar nunca al asociado. El tercer camino es
// ACTUALIZAR: engancharse a la ficha que la persona ya tiene.
//
// Quién va por cuál lo decide `decidirSolicitud`, aparte y con sus tests.
//
// Lo que el reparo original decía y sigue sin respuesta: no hay captcha, por
// decisión de Gastón. Un bot que invente documentos distintos pasa las guardas.
//
// «Dar de alta» a mano sigue existiendo para lo que las guardas frenaron: abre
// el formulario de paciente con los datos ya puestos.
//
// El orden es por lo que hay que hacer, no por fecha: primero lo sin revisar.
// Una lista cronológica obliga a leerla entera para encontrar lo pendiente.

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Inbox, Check, X, Search, Loader2, Copy, Clock } from 'lucide-react'
import {
  solicitudesService, etiquetaEstado, colorEstado, ESTADOS_SOLICITUD,
  type Solicitud, type EstadoSolicitud,
} from '../../lib/solicitudes'
import { btnPrimario, btnSutil, selectFiltro, campoBase, tarjeta } from '../../lib/ui'
import {
  decidirSolicitud, contarVinculados, esperandoAlta, type FichaDelPadron,
} from '../../lib/altaAutomatica'
import { pedirTexto } from '../../lib/pedirDatos'


/** Sin revisar primero; lo cerrado, al final. */
const PESO: Record<EstadoSolicitud, number> = {
  pendiente: 0, en_revision: 1, aceptada: 2, rechazada: 3,
}

export function Solicitudes({ onAlta, padron = [], padronListo = true, topeVinculados = 150, onCambio }: {
  /** Abre el alta de paciente con los datos de la solicitud ya cargados. */
  onAlta: (s: Solicitud) => void
  /**
   * El padrón ENTERO, archivados incluidos.
   *
   * Los archivados son justo los que hay que mirar: una ficha dada de baja
   * sigue siendo la misma persona, y al 26/08/2026 hay 71 asociados activos
   * cuya ficha de paciente está archivada. Si acá llegan sólo los activos,
   * esas 71 personas pasan el control y se les crea una ficha nueva.
   */
  padron?: FichaDelPadron[]
  /**
   * Si `padron` ya terminó de cargar.
   *
   * Sin esto hay una carrera silenciosa: esta bandeja carga SU lista por su
   * cuenta y dispara el alta automática apenas termina, sin esperar a la
   * pantalla de arriba. Si el padrón todavía venía en camino, el dedup
   * comparaba contra un array vacío y aprobaba TODO — incluida gente que ya
   * estaba. El default es `true` para no romper a quien lo use sin padrón.
   */
  padronListo?: boolean
  topeVinculados?: number
  /** Para refrescar el padrón de afuera cuando el alta automática crea fichas. */
  onCambio?: () => void
}) {
  const [filas, setFilas] = useState<Solicitud[]>([])
  const [cargando, setCargando] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<EstadoSolicitud | 'todas' | 'abiertas'>('abiertas')

  const cargar = () => {
    setCargando(true)
    solicitudesService.listar()
      .then(setFilas)
      .catch(e => toast.error((e as Error).message))
      .finally(() => setCargando(false))
  }
  // Cargar al montar. `cargar` arranca poniendo el estado en «cargando», que es
  // lo que la regla marca — pero no hay forma de pedir datos sin decir primero
  // que se están pidiendo, y sin ese aviso la pantalla aparece vacía y se lee
  // como que no hay solicitudes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(cargar, [])

  // ── El alta automática ────────────────────────────────────────────────────
  //
  // Corre cuando alguien abre la bandeja, que es lo más cerca de «automático»
  // que se puede llegar sin poner la lógica en la base. La decisión de fondo
  // vive en `puedeAprobarseSola`, aparte y con sus propios tests: acá sólo se
  // la aplica.
  //
  // LO QUE NO PASA UNA GUARDA NO SE RECHAZA: se le escribe el motivo y queda
  // pendiente, en esta misma lista, para que lo mire una persona.
  //
  // ⚠ SIN CAPTCHA, por decisión de Gastón: las guardas frenan lo más obvio
  // —sin un DNI que parezca un DNI no entra nadie, y un duplicado tampoco—
  // pero un bot que invente documentos distintos las pasa igual.
  const yaCorrio = useRef(false)
  const [autoAltas, setAutoAltas] = useState<
    { hechas: number; frenadas: number; actualizadas: number } | null>(null)

  useEffect(() => {
    // `padronListo` va ANTES que `yaCorrio`: si entrara con el padrón a medio
    // cargar, marcaría la corrida como hecha y no volvería a intentar.
    if (cargando || !padronListo || yaCorrio.current) return
    // Las que esperan ficha, estén «pendiente» o «verificando». Marcarlas como
    // verificando las dejaba muertas: ver `esperandoAlta`.
    const pendientes = esperandoAlta(filas)
    if (pendientes.length === 0) return
    yaCorrio.current = true

    void (async () => {
      // El padrón crece a medida que se dan altas: si dos solicitudes traen el
      // mismo DNI, la segunda tiene que ver a la primera y frenarse.
      const padronVivo = [...padron]
      // VINCULADOS, no activos. La 1780 pone el tope sobre las personas que la
      // asociación REPRESENTA —las que entregaron su código de REPROCANN— y no
      // sobre cuántos socios tiene. Contando activos, con 150 socios y el tope
      // en 150 se frenaban TODAS las altas, aunque los vinculados fueran cero.
      const vinculados = contarVinculados(padronVivo)
      let hechas = 0, frenadas = 0, actualizadas = 0

      for (const s of pendientes) {
        const decision = decidirSolicitud(
          { nombre: s.nombre, dni: s.dni, telefono: s.telefono, email: s.email },
          { padron: padronVivo, vinculados, topeVinculados,
            // Todavía no se puede calcular: falta el rinde por planta, que
            // declara el Director Técnico. La guarda no bloquea sin ese dato.
            sociosQueSostieneElCultivo: null },
        )

        if (decision.via === 'frenar') {
          frenadas++
          // Sólo se escribe si el motivo cambió: si no, cada visita a la
          // bandeja haría un update por solicitud sin que nada haya pasado.
          // Y se conserva el estado que tenía: si alguien la marcó como
          // «verificando», bajarla a «pendiente» le borra la marca a la persona
          // que la estaba mirando.
          if (s.motivo !== decision.motivo) {
            try { await solicitudesService.cambiarEstado(s.id, s.estado, decision.motivo) }
            catch { /* que una falle no puede frenar a las demás */ }
          }
          continue
        }

        // Quien YA ESTÁ no se da de alta: se le actualiza el legajo. Es el
        // camino que más se usa desde la campaña a los 211 socios existentes.
        // No suma un vinculado —esta persona ya ocupaba su lugar— y no toca el
        // padrón vivo, que ya la tenía.
        if (decision.via === 'actualizar') {
          try {
            if (!await solicitudesService.tomarParaAlta(s)) continue
            await solicitudesService.actualizarLegajo(
              { ...s, motivo: decision.motivo }, decision.ficha.id!)
            actualizadas++
          } catch (e) {
            frenadas++
            try {
              await solicitudesService.cambiarEstado(s.id, 'pendiente',
                `No se pudo enganchar a la ficha que ya existe: ${(e as Error).message}`)
            } catch { /* ya se informa abajo */ }
          }
          continue
        }

        try {
          // El candado: si otra pestaña ya la tomó, esta pasa de largo.
          if (!await solicitudesService.tomarParaAlta(s)) continue
          await solicitudesService.darDeAlta(s)
          // Entra al padrón SIN código de vinculación: recién se está creando la
          // ficha y la persona todavía no trajo su código de REPROCANN.
          padronVivo.push({
            dni: s.dni, telefono: s.telefono, email: s.email,
            activo: true, codigo_vinculacion: null,
          })
          // Y por eso NO suma un vinculado: dar de alta a alguien no lo vincula.
          // El contador se mueve cuando esa persona carga su código.
          hechas++
        } catch (e) {
          // Si el alta se cayó a mitad, la solicitud vuelve a la cola con el
          // motivo puesto, en vez de quedar trabada en «en revisión».
          frenadas++
          try {
            await solicitudesService.cambiarEstado(s.id, 'pendiente',
              `No se pudo dar de alta sola: ${(e as Error).message}`)
          } catch { /* ya se informa abajo */ }
        }
      }

      if (hechas > 0 || frenadas > 0 || actualizadas > 0) {
        setAutoAltas({ hechas, frenadas, actualizadas })
      }
      if (hechas > 0 || actualizadas > 0) { cargar(); onCambio?.() }
    })()
  }, [filas, cargando, padronListo, padron, topeVinculados, onCambio])

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return filas
      .filter(s => filtro === 'todas' ? true
        : filtro === 'abiertas' ? (s.estado === 'pendiente' || s.estado === 'en_revision')
        : s.estado === filtro)
      .filter(s => !q || s.nombre.toLowerCase().includes(q) || s.dni.includes(q))
      .sort((a, b) => PESO[a.estado] - PESO[b.estado] || b.creada_en.localeCompare(a.creada_en))
  }, [filas, filtro, busca])

  const sinRevisar = filas.filter(s => s.estado === 'pendiente').length

  /** Lo que hizo el alta automática al abrir la bandeja. */
  const avisoAuto = autoAltas
    && (autoAltas.hechas > 0 || autoAltas.frenadas > 0 || autoAltas.actualizadas > 0) ? (
    <p className="text-[11px] rounded-lg bg-[#15151d] border border-[#2a2a3a] px-3 py-2 leading-relaxed">
      {autoAltas.hechas > 0 && (
        <span className="text-[#d9f99d]">
          Se {autoAltas.hechas === 1 ? 'dio' : 'dieron'} de alta{' '}
          <strong className="font-mono tabular-nums">{autoAltas.hechas}</strong>{' '}
          {autoAltas.hechas === 1 ? 'solicitud' : 'solicitudes'} sola{autoAltas.hechas === 1 ? '' : 's'}.{' '}
        </span>
      )}
      {autoAltas.actualizadas > 0 && (
        <span className="text-[#38bdf8]">
          <strong className="font-mono tabular-nums">{autoAltas.actualizadas}</strong>{' '}
          {autoAltas.actualizadas === 1 ? 'era de alguien' : 'eran de gente'} que ya estaba:{' '}
          se {autoAltas.actualizadas === 1 ? 'actualizó su legajo' : 'actualizaron sus legajos'}{' '}
          en vez de crear {autoAltas.actualizadas === 1 ? 'una ficha nueva' : 'fichas nuevas'}.{' '}
        </span>
      )}
      {autoAltas.frenadas > 0 && (
        <span className="text-[#f59e0b]">
          <strong className="font-mono tabular-nums">{autoAltas.frenadas}</strong>{' '}
          {autoAltas.frenadas === 1 ? 'quedó' : 'quedaron'} para que{' '}
          {autoAltas.frenadas === 1 ? 'la mires' : 'las mires'}: el motivo está en cada una.
        </span>
      )}
      <span className="block text-[10px] text-[#8a8a9c] mt-1">
        El alta como asociado la ratifica el acta de Comisión Directiva: quedan en la cola
        de altas sin acta para que una sola las respalde a todas.
      </span>
    </p>
  ) : null

  const cambiar = async (s: Solicitud, estado: EstadoSolicitud) => {
    let motivo: string | null = null
    if (estado === 'rechazada') {
      // El motivo se le muestra a la persona en su propia pantalla, así que no
      // es una nota interna: es lo que va a leer.
      motivo = await pedirTexto('¿Por qué se rechaza?', {
        etiqueta: 'Motivo',
        descripcion: 'Esto lo va a leer la persona en su link, así que está escrito para ella.',
        multilinea: true,
        placeholder: 'Falta el DNI en la credencial que subiste…',
      })
      if (motivo === null) return
    }
    try {
      await solicitudesService.cambiarEstado(s.id, estado, motivo)
      toast.success(etiquetaEstado(estado))
      cargar()
    } catch (e) { toast.error((e as Error).message) }
  }

  const copiarLink = async (s: Solicitud) => {
    const url = `${window.location.origin}/sumate/${s.token}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado, listo para mandar')
    } catch { toast.error('No se pudo copiar') }
  }

  return (
    <div className="space-y-3">
      <div className={tarjeta}>
        <div className="flex items-center gap-2 flex-wrap">
          <Inbox className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Solicitudes de alta</h3>
          {sinRevisar > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#fbbf24]">
              {sinRevisar} sin revisar
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2 leading-snug">
          Entran por <a href="/sumate" target="_blank" rel="noopener noreferrer"
            className="text-[#d9f99d] hover:underline">/sumate</a>, la página pública.
          Cada persona sigue su trámite por un link propio; si lo perdió, copiáselo de acá.
          Las que cumplen todo se dan de alta solas; el resto queda acá con el motivo.
        </p>

        {/* Lo que hizo el alta automática recién, al abrir esta bandeja. */}
        {avisoAuto && <div className="mt-2">{avisoAuto}</div>}

        <div className="flex gap-2 mt-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-[#8a8a9c] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input className={`w-full pl-8 pr-3 py-2 sm:text-[12px] ${campoBase}`} value={busca}
              onChange={e => setBusca(e.target.value)} placeholder="Nombre o DNI" />
          </div>
          <select className={selectFiltro} value={filtro}
            onChange={e => setFiltro(e.target.value as typeof filtro)}>
            <option value="abiertas">Sin resolver</option>
            <option value="todas">Todas</option>
            {ESTADOS_SOLICITUD.map(e => <option key={e.valor} value={e.valor}>{e.label}</option>)}
          </select>
        </div>
      </div>

      {cargando ? (
        <p className={`${tarjeta} flex items-center justify-center gap-2 text-[12px] text-[#8a8a9c] py-8`}>
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </p>
      ) : visibles.length === 0 ? (
        <div className={`${tarjeta} text-center py-8`}>
          <Inbox className="w-7 h-7 text-[#2a2a3a] mx-auto" strokeWidth={1.5} />
          <p className="text-[12px] text-[#8a8a9c] mt-2">
            {filas.length === 0
              ? 'Todavía no entró ninguna solicitud.'
              : 'Ninguna coincide con el filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibles.map(s => (
            <Fila key={s.id} s={s} onCambiar={cambiar} onAlta={onAlta} onCopiarLink={copiarLink} />
          ))}
        </div>
      )}
    </div>
  )
}

function Fila({ s, onCambiar, onAlta, onCopiarLink }: {
  s: Solicitud
  onCambiar: (s: Solicitud, e: EstadoSolicitud) => void
  onAlta: (s: Solicitud) => void
  onCopiarLink: (s: Solicitud) => void
}) {
  const color = colorEstado(s.estado)
  const abierta = s.estado === 'pendiente' || s.estado === 'en_revision'

  return (
    <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] p-3">
      <div className="flex items-start gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[#ececf1] truncate">{s.nombre}</p>
          <p className="text-[11px] text-[#8a8a9c] tabular-nums truncate">
            DNI {s.dni}
            {s.email ? ` · ${s.email}` : ''}
            {s.telefono ? ` · ${s.telefono}` : ''}
          </p>
          <p className="text-[10px] text-[#8a8a9c] mt-0.5">
            {new Date(s.creada_en).toLocaleDateString('es-AR')}
          </p>
        </div>
        <span className="text-[11px] font-medium px-2 py-1 rounded-lg border flex-shrink-0"
          style={{ color, borderColor: `${color}55`, background: `${color}14` }}>
          {etiquetaEstado(s.estado)}
        </span>
      </div>

      {s.notas && (
        <p className="text-[11px] text-[#a6a6b5] mt-2 leading-snug rounded-lg bg-[#15151d] border border-[#1f1f2b] p-2">
          {s.notas}
        </p>
      )}
      {s.motivo && (
        <p className="text-[11px] text-[#ff8a7a] mt-2 leading-snug">
          Se le respondió: {s.motivo}
        </p>
      )}

      <div className="flex gap-2 mt-2.5 flex-wrap">
        {abierta && (
          <>
            <button onClick={() => onAlta(s)} className={btnPrimario}>
              <Check className="w-3.5 h-3.5" /> Dar de alta
            </button>
            {s.estado === 'pendiente' && (
              <button onClick={() => onCambiar(s, 'en_revision')} className={btnSutil}>
                <Clock className="w-3.5 h-3.5" /> Verificando
              </button>
            )}
            <button onClick={() => onCambiar(s, 'rechazada')} className={btnSutil}>
              <X className="w-3.5 h-3.5" /> Rechazar
            </button>
          </>
        )}
        <button onClick={() => onCopiarLink(s)} className={btnSutil}
          title="El link con el que la persona sigue su trámite">
          <Copy className="w-3.5 h-3.5" /> Su link
        </button>
      </div>
    </div>
  )
}
