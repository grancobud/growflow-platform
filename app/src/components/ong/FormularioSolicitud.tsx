// El Legajo de Admisión: dejar los datos y llevarse el link para seguir el trámite.
//
// DE DÓNDE SALE ESTE FORMULARIO
//
// Reemplaza al Google Form «Legajo de Admisión» de la asociación. Ese formulario
// preguntaba bien —cuatro consentimientos, diagnóstico como lista cerrada, una
// rama distinta según tuviera o no el carnet— pero no escribía en la base:
// alguien importaba a mano. De ahí salieron los dos padrones de Chaco con los
// mismos códigos apuntando a personas distintas, y las doce fichas que hubo que
// limpiar en la asociación. Un solo circuito de alta, no dos.
//
// LAS TRES PREGUNTAS QUE SE AGREGARON
//
//   · ¿Designaste a la asociación en REPROCANN? Es LA pregunta y no estaba. Ver
//     lib/legajo.ts, VINCULACION.
//   · El número y el vencimiento de la credencial, para no tener que abrir cada
//     PDF y tipearlos a mano.
//   · El DNI adjunto — la declaración jurada del formulario viejo hablaba de «la
//     documentación adjunta (DNI y REPROCANN)» y no había dónde subir el DNI.
//
// LOS ADJUNTOS VAN DESPUÉS DE ENVIAR, y no es una comodidad: para subir hace
// falta el token, y el token no existe hasta que la solicitud está creada.
//
// EL LINK SE MUESTRA UNA SOLA VEZ, Y SE DICE
//
// No hay «recuperá tu link con tu DNI»: sería un buscador público que confirma
// quién es paciente de cannabis de la asociación. Así que el token aparece acá,
// grande, con botón de copiar y con el aviso de guardarlo.

import { useState } from 'react'
import { etiquetaCampo } from '../../lib/ui'
import { Link } from 'react-router-dom'
import { Check, Copy, Loader2, ArrowRight, AlertTriangle, ShieldCheck } from 'lucide-react'
import { solicitudesService } from '../../lib/solicitudes'
import {
  DIAGNOSTICOS, FORMATOS, UNIDADES, CONSENTIMIENTOS,
  COMPROMISO_REGULARIZAR, VERSION_CONSENTIMIENTOS,
  type Unidad,
} from '../../lib/legajo'
import { AdjuntarDocumento } from './AdjuntarDocumento'
import { PASOS_ALTA } from '../../lib/altaSocios'

// El estilo del campo SIN ancho. Existe separado porque la fila de
// «cantidad + unidad» necesita repartir el ancho entre los dos, y para eso hay
// que poder NO poner `w-full`.
const campoCls = 'px-3 py-2.5 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[16px] sm:text-[13px] text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#a3e635]/60 transition-colors'
const inputCls = `w-full ${campoCls}`
const seccionCls = 'rounded-xl border border-[#1f1f2b] bg-[#101016] p-4'
const tituloCls = 'font-display font-semibold text-[14px] text-[#ececf1]'

/** Un bloque de texto que se acepta con una casilla. */
/**
 * La explicación que aparece al contestar «no» o «no sé».
 *
 * Va en tono de acompañamiento y no de error: el color es informativo, no de
 * alerta. Quien contesta que no sabe está siendo honesto, y esa honestidad es
 * mejor dato que un «sí» a medias — el texto tiene que premiarla, no retarla.
 */
/**
 * Como se saca el REPROCANN, para quien no lo tiene.
 *
 * EL TEXTO Y EL ORDEN LOS ESCRIBIO CRISTIAN (31/08/2026) y describen el circuito
 * como lo cuenta la asociacion cuando atiende. Cambio respecto de lo anterior:
 * el PRIMER paso es sacar el codigo de vinculacion en Mi Argentina, que es
 * gratuito y lo hace la persona sola; recien despues se busca al medico. Antes
 * la pantalla abria diciendo «sin medico el tramite no avanza», que es cierto
 * pero deja parado a quien todavia no dio el paso que si puede dar hoy.
 *
 * Las URL NO se escriben aca: salen de `PASOS_ALTA` por numero de paso, que es
 * la fuente unica de los links del circuito de alta. Si la asociacion cambia el
 * servicio o el tramite cambia de direccion, se toca en un solo lado.
 *
 * Cierra invitando a mandar el formulario igual. Sin esa linea, alguien que
 * acaba de leer «necesitas un medico» abandona la pantalla — y la asociacion
 * pierde justo al que mas necesita que lo acompañen.
 */

function ComoSacarlo() {
  const oficial = PASOS_ALTA.find(p => p.n === 2)
  const atajo = PASOS_ALTA.find(p => p.n === 3)
  const boton = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border text-[12px] font-medium transition-colors'

  return (
    <div className="mt-3 rounded-lg border border-[#1d3a5a] bg-[#38bdf8]/[0.06] p-3">
      <p className="text-[12px] font-medium text-[#7dd3fc] mb-1.5">¿Cómo saco el REPROCANN?</p>
      <p className="text-[11px] text-[#a6a6b5] leading-relaxed">
        El trámite lo aprueba el Ministerio de Salud, pero antes <b className="font-medium text-[#c9cabf]">un
        médico tiene que indicártelo</b>.
      </p>

      <div className="mt-2.5 space-y-2.5">
        {oficial && (
          <div>
            <p className="text-[11px] text-[#c9cabf]">
              <b className="font-medium">El primer paso es obtener el código de vinculación</b> — es
              gratuito y lo hacés vos.
            </p>
            <a href={oficial.url} target="_blank" rel="noopener noreferrer"
              className={`${boton} mt-1.5 border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 text-[#d9f99d]`}>
              {oficial.accion}
            </a>
          </div>
        )}
        {/* «opcional · pago» se mantiene aunque el texto nuevo no lo diga.
            Es un servicio de terceros con el referido de la asociacion, y sin la
            aclaracion la pantalla se lee como que hay que pagar para sacar el
            REPROCANN, que es gratis. La aclaracion va corta y al costado del
            boton para no pelearse con la redaccion de Socio. */}
        {atajo && (
          <div>
            <p className="text-[11px] text-[#c9cabf]">
              Una vez que tenés el código de vinculación, contactá a un médico. Si no tenés,
              acá podés hacer la consulta 100% online:
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-1.5">
              <a href={atajo.url} target="_blank" rel="noopener noreferrer"
                className={`${boton} border-[#2a2a3a] bg-[#15151d] hover:bg-[#1c1c27] text-[#a6a6b5]`}>
                {atajo.accion}
              </a>
              <span className="text-[10px] text-[#8a8a9c]">servicio particular, pago · no es requisito</span>
            </div>
          </div>
        )}
      </div>

      <p className="mt-2.5 text-[11px] text-[#a6a6b5] leading-relaxed">
        Mandanos el formulario y te acompañamos en el proceso.
      </p>
    </div>
  )
}


function Casilla({ marcada, onCambio, titulo, texto }: {
  marcada: boolean; onCambio: (v: boolean) => void; titulo?: string; texto: string
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-[#2a2a3a] bg-[#15151d] p-3">
      <input type="checkbox" checked={marcada} onChange={e => onCambio(e.target.checked)}
        className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[#a3e635]" />
      <span className="min-w-0">
        {titulo && (
          <span className="block text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-1">
            {titulo}
          </span>
        )}
        <span className="block text-[11px] text-[#a6a6b5] leading-relaxed">{texto}</span>
      </span>
    </label>
  )
}

export function FormularioSolicitud() {
  const [f, setF] = useState({
    nombre: '', dni: '', email: '', telefono: '', notas: '',
    fecha_nacimiento: '', domicilio: '', localidad: '', provincia: '',
    patologia: '', cantidad: '', medico: '',
    reprocann_nro: '', reprocann_vencimiento: '',
  })
  const [unidad, setUnidad] = useState<Unidad>('g')
  const [formatos, setFormatos] = useState<string[]>([])
  // null = todavía no contestó. Es la que abre una rama o la otra.
  const [tieneRepro, setTieneRepro] = useState<boolean | null>(null)
  const [compromiso, setCompromiso] = useState(false)
  // Arranca en false y hay que tocarlo: un consentimiento tildado de fábrica no
  // es una firma, es una casilla que nadie leyó.
  const [aceptaTodo, setAceptaTodo] = useState(false)

  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const set = (k: keyof typeof f) => (v: string) => setF(p => ({ ...p, [k]: v }))
  const toggleFormato = (x: string) =>
    setFormatos(p => p.includes(x) ? p.filter(y => y !== x) : [...p, x])

  // La rama de REPROCANN tiene que estar contestada. Con carnet alcanza con
  // decir que lo tenés; sin carnet, firmar el compromiso de regularización.
  //
  // HASTA EL 31/08/2026 CON CARNET SE EXIGÍA ADEMÁS decir si habías designado a
  // la asociación como tu cultivador, y sin contestar eso el botón de enviar no
  // se habilitaba. Lo pidió la asociación y tienen razón: es un cuello de botella.
  //
  // El razonamiento de ellos, que es el correcto: promueven inscribirse como
  // AUTOCULTIVADOR primero, para no perder ese derecho ante la 27.350, y la
  // designación se hace después, al firmar el mandato de gestión. Preguntarlo en
  // el alta frena a alguien por un paso que todavía no le toca dar.
  //
  // `reprocann_vinculado` sigue existiendo en la base y se manda en null: el
  // dato no se pierde, cambia QUIÉN lo carga y CUÁNDO. Lo completa quien revisa
  // el legajo, contra el REPROCANN de verdad y no contra lo que la persona
  // recuerda — que además era más confiable así.
  const ramaLista = tieneRepro === true ? true
                  : tieneRepro === false ? compromiso
                  : false
  const puedeEnviar = f.nombre.trim().length >= 3 && f.dni.trim() !== ''
    && f.patologia !== '' && ramaLista && aceptaTodo

  const enviar = async () => {
    setEnviando(true)
    setError(null)
    try {
      setToken(await solicitudesService.crear({
        nombre: f.nombre, dni: f.dni, email: f.email,
        telefono: f.telefono, notas: f.notas,
        // EL MANDATO SALIÓ DEL FORMULARIO (31/08/2026, pedido de Socio):
        // «es en la charla presencial al momento de la primera dispensa donde se
        // le da esa info». Va siempre en false y lo firma la persona en la sede.
        //
        // Y es mejor así: un mandato aceptado con un checkbox en un formulario
        // público tiene poco valor probatorio. Firmado presencialmente, con la
        // explicación de por medio, vale mucho más. La columna existe igual y el
        // trigger `solicitud_pasar_mandato` sigue copiando la firma cuando la
        // haya — al 31/08 hay 0 mandatos firmados sobre 211 asociados, así que
        // no se pierde nada que estuviera funcionando.
        mandatoAceptado: false,
        legajo: {
          fecha_nacimiento: f.fecha_nacimiento || null,
          domicilio: f.domicilio || null,
          localidad: f.localidad || null,
          provincia: f.provincia || null,
          patologia: f.patologia || null,
          formatos,
          cantidad_mensual: f.cantidad || null,
          cantidad_unidad: unidad,
          medico_tratante: f.medico || null,
          // La completa quien revisa, no la persona. Ver el formulario.
          matricula_medico: null,
          reprocann_tiene: tieneRepro,
          reprocann_nro: tieneRepro ? (f.reprocann_nro || null) : null,
          // Lo carga quien revisa el legajo, contra el REPROCANN real.
          reprocann_vinculado: null,
          reprocann_vencimiento: tieneRepro ? (f.reprocann_vencimiento || null) : null,
          compromiso_regularizar: tieneRepro === false ? compromiso : false,
          consentimientos_version: VERSION_CONSENTIMIENTOS,
          // LOS CUATRO SE SIGUEN GUARDANDO POR SEPARADO, aunque la persona
          // haya dado UN solo clic. La aceptación es una; lo aceptado son cuatro
          // declaraciones distintas, y el día que haga falta invocar la de uso
          // personal —la de la 23.737— tiene que poder mostrarse sola, con su
          // versión y su fecha. Colapsarlas en un `acepto: true` perdería
          // exactamente eso.
          //
          // Se derivan del mismo booleano a propósito: no hay forma de aceptar
          // tres de cuatro, así que un mapa parcial sería un estado imposible
          // que alguien tendría que mantener.
          consent_veracidad: aceptaTodo,
          consent_uso_personal: aceptaTodo,
          consent_responsabilidad: aceptaTodo,
          consent_jurisdiccion: aceptaTodo,
        },
      }))
    } catch (e) {
      setError((e as Error).message)
    } finally { setEnviando(false) }
  }

  // ── Ya se envió: el link, y recién ahora los adjuntos ────────────────────
  if (token) {
    const url = `${window.location.origin}/sumate/${token}`
    const copiar = async () => {
      try {
        await navigator.clipboard.writeText(url)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
      } catch { /* el link sigue a la vista para copiarlo a mano */ }
    }
    return (
      <section className="rounded-xl border border-[#404d20] bg-[#a3e635]/5 p-4">
        <div className="flex items-center gap-2">
          <Check aria-hidden className="w-4 h-4 text-[#bef264]" />
          <h2 className={tituloCls}>Listo, tus datos llegaron</h2>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#5a4a20] bg-[#5a4a20]/15 p-3">
          <AlertTriangle aria-hidden className="w-4 h-4 text-[#fbbf24] flex-shrink-0 mt-px" />
          <p className="text-[12px] text-[#d4d4dd] leading-relaxed">
            <b className="text-[#fbbf24]">Guardá este link.</b> Es el único que te muestra cómo va
            tu trámite, y no lo podemos volver a mandar: por privacidad no tenemos forma de
            buscar tu solicitud con tu documento. Mandátelo por WhatsApp a vos mismo.
          </p>
        </div>

        <div className="mt-3 rounded-lg border border-[#2a2a3a] bg-[#0d0d12] p-3">
          <p className={etiquetaCampo}>Tu link</p>
          <code className="block text-[11px] font-mono text-[#d9f99d] break-all leading-relaxed">{url}</code>
          <button onClick={copiar}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-[#07070b] bg-[#a3e635] hover:bg-[#bef264] rounded-lg px-3 py-2.5 min-h-[44px] font-medium transition-colors">
            {copiado ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar el link</>}
          </button>
        </div>

        {/* Los adjuntos van acá y no arriba: para subir hace falta el token, y
            el token recién existe ahora. */}
        <p className="mt-4 text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">
          Ya que estás, adjuntá tus documentos
        </p>
        <div className="mt-2 space-y-2">
          <AdjuntarDocumento token={token} tipo="dni" yaCargado={false} compacto />
          {tieneRepro && (
            <AdjuntarDocumento token={token} tipo="reprocann" yaCargado={false}
              nroCargado={f.reprocann_nro || null} compacto />
          )}
        </div>

        <Link to={`/sumate/${token}`}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[#d9f99d] hover:underline">
          Ver cómo va <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </section>
    )
  }

  // ── El formulario ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* 1. Quién sos */}
      <section className={seccionCls}>
        <h2 className={tituloCls}>Quién sos</h2>
        <div className="mt-3 space-y-3">
          <label><span className={etiquetaCampo}>Nombre y apellido *</span>
            <input className={inputCls} value={f.nombre} autoComplete="name"
              onChange={e => set('nombre')(e.target.value)} placeholder="Como figura en tu DNI" /></label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label><span className={etiquetaCampo}>DNI *</span>
              <input className={inputCls} value={f.dni} inputMode="numeric"
                onChange={e => set('dni')(e.target.value)} placeholder="Sólo números" />
              <span className="block text-[10px] text-[#8a8a9c] mt-1 leading-snug">
                Sirve para no cargarte dos veces si ya estabas.
              </span></label>
            <label><span className={etiquetaCampo}>Fecha de nacimiento</span>
              <input className={inputCls} value={f.fecha_nacimiento} type="date"
                onChange={e => set('fecha_nacimiento')(e.target.value)} /></label>
          </div>

          <label><span className={etiquetaCampo}>Domicilio</span>
            <input className={inputCls} value={f.domicilio} autoComplete="street-address"
              onChange={e => set('domicilio')(e.target.value)} placeholder="Calle y número" />
            {/* Dos personas cargaron acá la dirección del cultivo. */}
            <span className="block text-[10px] text-[#8a8a9c] mt-1 leading-snug">
              Dónde vivís vos, no la dirección del cultivo.
            </span></label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label><span className={etiquetaCampo}>Localidad</span>
              <input className={inputCls} value={f.localidad}
                onChange={e => set('localidad')(e.target.value)} /></label>
            <label><span className={etiquetaCampo}>Provincia</span>
              <input className={inputCls} value={f.provincia}
                onChange={e => set('provincia')(e.target.value)} /></label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label><span className={etiquetaCampo}>Teléfono</span>
              <input className={inputCls} value={f.telefono} inputMode="tel" autoComplete="tel"
                onChange={e => set('telefono')(e.target.value)} /></label>
            <label><span className={etiquetaCampo}>Mail</span>
              <input className={inputCls} value={f.email} type="email" autoComplete="email"
                onChange={e => set('email')(e.target.value)} /></label>
          </div>
        </div>
      </section>

      {/* 2. REPROCANN — la rama */}
      <section className={seccionCls}>
        <h2 className={tituloCls}>Tu REPROCANN</h2>
        <p className="text-[11px] text-[#8a8a9c] mt-1 leading-relaxed">
          Es el registro del Ministerio de Salud que ampara el acceso. Es gratuito.
        </p>

        <p className={`${etiquetaCampo} mt-3`}>¿Tenés el carnet aprobado? *</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[{ v: true, t: 'Sí, lo tengo aprobado' },
            { v: false, t: 'No, todavía no lo tengo' }].map(o => (
            <button key={String(o.v)} type="button" onClick={() => setTieneRepro(o.v)}
              className={`text-[12px] rounded-lg px-3 py-3 min-h-[44px] border transition-colors text-left ${
                tieneRepro === o.v
                  ? 'border-[#a3e635] bg-[#a3e635]/10 text-[#ececf1]'
                  : 'border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5] hover:border-[#3a3a4a]'}`}>
              {o.t}
            </button>
          ))}
        </div>

        {/* Rama SÍ */}
        {tieneRepro === true && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label><span className={etiquetaCampo}>Número de la credencial</span>
                <input className={inputCls} value={f.reprocann_nro}
                  onChange={e => set('reprocann_nro')(e.target.value)}
                  placeholder="El id de trámite del carnet" /></label>
              <label><span className={etiquetaCampo}>Vence el</span>
                <input className={inputCls} value={f.reprocann_vencimiento} type="date"
                  onChange={e => set('reprocann_vencimiento')(e.target.value)} /></label>
            </div>

            <p className="text-[11px] text-[#8a8a9c] leading-relaxed">
              La constancia la vas a poder subir apenas termines de enviar esto.
            </p>
          </div>
        )}

        {/* Rama NO */}
        {tieneRepro === false && (
          <div className="mt-3">
            <Casilla marcada={compromiso} onCambio={setCompromiso}
              titulo="Compromiso de regularización *" texto={COMPROMISO_REGULARIZAR} />
            {/* ACÁ IBA EL AVISO DE QUE LA ENTREGA NO ESTÁ AMPARADA.
                Lo sacó la asociación el 31/08/2026, junto con la explicación del
                REPROCANN: esa conversación la dan presencialmente en la primera
                visita, que es donde alguien puede contestar las preguntas que el
                aviso abre. En un formulario público, decirlo y seguir de largo
                asusta sin resolver nada.

                NO SE PERDIÓ EL CONTROL, que es lo que importa: RN-01 sigue
                avisando en CADA dispensa que una entrega sin REPROCANN no está
                amparada, y ahí lo lee quien entrega, que sí puede hacer algo. */}

            {/* Y ACA SE DICE COMO SACARLO.
                Antes esta rama era una casilla y una advertencia: se le pedia a
                la persona que se comprometiera a regularizar y no se le decia
                por donde se empieza. Los links estaban al pie de la pagina, en
                una lista generica que no contesta lo que la persona acaba de
                decir.
                El dato que falta es el que traba todo: el REPROCANN no se saca
                solo. Un medico tiene que cargar la indicacion, asi que «anda a
                sacartelo» no lleva a ningun lado si no tenes a quien pedirselo. */}
            <ComoSacarlo />
          </div>
        )}
      </section>

      {/* 3. Tu tratamiento */}
      <section className={seccionCls}>
        <h2 className={tituloCls}>Tu tratamiento</h2>
        <div className="mt-3 space-y-3">
          <label><span className={etiquetaCampo}>Condición de salud / diagnóstico *</span>
            <select className={inputCls} value={f.patologia}
              onChange={e => set('patologia')(e.target.value)}>
              <option value="">Elegí el que mejor describa tu necesidad…</option>
              {DIAGNOSTICOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select></label>

          <div>
            <span className={etiquetaCampo}>Formato que necesitás</span>
            <div className="flex flex-wrap gap-2">
              {FORMATOS.map(x => (
                <button key={x} type="button" onClick={() => toggleFormato(x)}
                  className={`text-[12px] rounded-lg px-3 py-2.5 min-h-[44px] border transition-colors ${
                    formatos.includes(x)
                      ? 'border-[#a3e635] bg-[#a3e635]/10 text-[#ececf1]'
                      : 'border-[#2a2a3a] bg-[#15151d] text-[#a6a6b5] hover:border-[#3a3a4a]'}`}>
                  {x}
                </button>
              ))}
            </div>
          </div>

          {/* Número y unidad SEPARADOS: en el formulario viejo era un solo campo
              de texto y produjo «10», «40gramos» y «200 gramos flores frescas». */}
          <div>
            <span className={etiquetaCampo}>Cantidad mensual estimada</span>
            <div className="flex gap-2">
              {/* El ancho va al SELECT y no al numero: «unidades (potes, goteros)»
                  no entra en un campo angosto, y una cantidad son dos o tres
                  digitos. Ninguno de los dos lleva `w-full`: apilarlo con
                  `w-auto` dejaba dos utilidades de ancho peleandose, y cual
                  ganaba lo decidia el orden del CSS generado, no el del codigo.
                  Ganaba `w-full`, el select se comia la fila y el campo del
                  numero quedaba en unos pocos pixeles: no se podia escribir. */}
              <input className={`${campoCls} w-24 shrink-0`} value={f.cantidad} inputMode="decimal"
                onChange={e => set('cantidad')(e.target.value)} placeholder="15" />
              <select className={`${campoCls} flex-1 min-w-0`} value={unidad}
                onChange={e => setUnidad(e.target.value as Unidad)}>
                {UNIDADES.map(u => <option key={u.valor} value={u.valor}>{u.label}</option>)}
              </select>
            </div>
            <span className="block text-[10px] text-[#8a8a9c] mt-1 leading-snug">
              Es una estimación para que la asociación se organice, no un cupo asignado.
            </span>
          </div>

          {/* NO se pide la matricula.
              El campo existia y era una pregunta que la persona no puede
              contestar: casi nadie sabe de memoria el numero de matricula de su
              medico. Un campo que no se puede completar se deja vacio, o peor,
              se completa con cualquier cosa — y un dato inventado es peor que
              ninguno, porque parece verificado.
              La columna `matricula_medico` sigue existiendo: la completa quien
              revisa, que si tiene de donde sacarla. */}
          <label className="block"><span className={etiquetaCampo}>Médico tratante</span>
            <input className={inputCls} value={f.medico}
              onChange={e => set('medico')(e.target.value)}
              placeholder="Nombre y apellido" /></label>

          <label><span className={etiquetaCampo}>Algo que quieras contarnos</span>
            <textarea className={`${inputCls} resize-none`} rows={2} value={f.notas}
              onChange={e => set('notas')(e.target.value)} /></label>
        </div>
      </section>

      {/* 4. Términos y condiciones — UN SOLO ACEPTAR.
          Lo pidió Socio (la asociación) el 31/08/2026: que sea «como términos y
          condiciones, que se lea todo de corrido y con un solo clic acepten los
          cuatro puntos». Antes eran cuatro casillas, una por declaración.

          SE HIZO ASÍ Y NO ESCONDIDO DETRÁS DE UN LINK, que es la parte que
          importa. Estas cuatro son declaraciones juradas, y una —la de uso
          personal, con la 23.737— es la que protege a la asociación si alguien
          revende. Lo que sostiene el valor de una declaración no es que la
          persona la haya leído, que nadie puede probar: es que haya tenido la
          OPORTUNIDAD REAL de leerla. Un bloque visible y scrolleable la da; un
          «ver términos» plegado, no.

          Y por debajo se siguen guardando los cuatro `consent_*` por separado
          más la versión, así que el registro granular no cambia: el día que haga
          falta se puede mostrar qué texto aceptó cada persona y cuándo. La
          aceptación es una sola; lo aceptado sigue siendo cuatro cosas. */}
      <section className={seccionCls}>
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} />
          <h2 className={tituloCls}>Términos y condiciones</h2>
          <span className="ml-auto text-[10px] text-[#8a8a9c]">versión {VERSION_CONSENTIMIENTOS}</span>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-1 leading-relaxed">
          Tienen carácter de declaración jurada. Son tu respaldo y el de la comunidad.
        </p>

        {/* Alto acotado y scroll propio: el texto entero son ~1.200 caracteres y
            suelto empuja el botón de enviar fuera de la primera pantalla en un
            teléfono. Acotado se ve que hay más y se puede recorrer. */}
        <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-[#2a2a3a] bg-[#0d0d12] p-3 space-y-3">
          {CONSENTIMIENTOS.map(c => (
            <div key={c.campo}>
              <p className="text-[11px] font-medium text-[#ececf1] leading-snug">{c.titulo}</p>
              <p className="text-[11px] text-[#a6a6b5] leading-relaxed mt-0.5">{c.texto}</p>
            </div>
          ))}
        </div>

        <label className="flex items-start gap-2.5 mt-3 cursor-pointer min-h-[44px]">
          <input type="checkbox" checked={aceptaTodo}
            onChange={e => setAceptaTodo(e.target.checked)}
            className="w-4 h-4 flex-shrink-0 mt-0.5 accent-[#a3e635]" />
          <span className="text-[12px] text-[#ececf1] leading-snug">
            Leí y acepto los términos y condiciones. *
          </span>
        </label>
      </section>

      {error && (
        <p className="flex items-start gap-1.5 text-[12px] text-[#ff8a7a] rounded-lg bg-[#7a2820]/15 border border-[#7a2820] p-2.5 leading-relaxed">
          <AlertTriangle aria-hidden className="w-3.5 h-3.5 flex-shrink-0 mt-px" />{error}
        </p>
      )}

      <button onClick={enviar} disabled={!puedeEnviar || enviando}
        className="w-full inline-flex items-center justify-center gap-2 text-[13px] text-[#07070b] bg-[#a3e635] hover:bg-[#bef264] disabled:opacity-50 rounded-lg px-3 py-3 min-h-[44px] font-medium transition-colors">
        {enviando ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : 'Enviar mi legajo'}
      </button>

      {/* Decir QUÉ falta, no sólo que falta algo: un botón gris sin explicación
          deja a la persona buscando por la pantalla. */}
      {!puedeEnviar && (
        <p className="text-[11px] text-[#8a8a9c] text-center leading-relaxed -mt-1">
          Falta: {[
            f.nombre.trim().length < 3 && 'tu nombre',
            !f.dni.trim() && 'tu DNI',
            !f.patologia && 'el diagnóstico',
            tieneRepro === null && 'decirnos si tenés REPROCANN',
            tieneRepro === false && !compromiso && 'el compromiso de regularización',
            !aceptaTodo && 'aceptar los términos y condiciones',
          ].filter(Boolean).join(', ')}.
        </p>
      )}
    </div>
  )
}
