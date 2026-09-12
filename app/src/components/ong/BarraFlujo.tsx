// La barra que acompaña una tarea de varios pasos.
//
// Aparece sólo cuando la URL trae `?flujo=`, se pega arriba del contenido, y se
// queda ahí mientras dure la tarea. Cuando cerrás el formulario que acabás de
// guardar, la barra está esperando con el paso siguiente: es el eslabón que
// faltaba, porque antes la guía terminaba en «Guardar».
//
// Tres decisiones que importan:
//
// El botón de salir está siempre. Una guía que no deja salirse es una jaula, y
// la mitad de las veces uno entra a un flujo para hacer sólo el primer paso.
//
// Cada paso dice POR QUÉ importa, no sólo cómo se llama. «El lote con ese
// material» no convence a nadie de no saltearlo; «sin lote figura la plata y no
// figura la mercadería» sí.
//
// El último paso no dice «Siguiente» sino «Terminé». Un flujo que no se cierra
// nunca deja la barra colgada arriba de todo para siempre.

import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, X } from 'lucide-react'
import { flujoDe, pasoSaneado, rutaDePaso, resumenDeFlujo, type DatosFlujo } from '../../lib/flujosOng'

export function BarraFlujo({ flujoId, pasoCrudo, datos }: {
  flujoId: string | null
  pasoCrudo: string | null
  /**
   * Para que los pasos que se pueden verificar se marquen solos.
   *
   * OPCIONAL porque la barra tambien se dibuja fuera de la O.N.G., donde esos
   * datos no estan cargados. Un flujo cuyos pasos viven en Cultivo —como
   * `cosechar`— no tiene ningun `estado` que calcular, asi que no los necesita.
   * Sin `datos` la barra funciona igual: lo unico que pierde son las marcas de
   * «este paso ya esta hecho».
   */
  datos?: DatosFlujo
}) {
  const navegar = useNavigate()
  const flujo = flujoDe(flujoId)
  if (!flujo) return null

  /**
   * Lo que este flujo ya descubrió y el paso siguiente necesita.
   *
   * `rutaDePaso` acepta extras y este link no se los pasaba, así que avanzar con
   * el botón de la barra —en vez de guardando el formulario— perdía el
   * `?entrega=`. Y sin ese id el tercer paso de «Entregarle a un paciente» no
   * abre NADA: el reporte de seguimiento no se puede editar ni borrar una vez
   * guardado, así que abrirlo sobre una entrega adivinada dejaría evidencia
   * clínica colgada de la entrega equivocada. La pantalla quedaba con el «tené a
   * mano» y ningún formulario, sin decir por qué.
   *
   * Se conserva todo lo que no sea la propia posición en el flujo.
   */
  const extras: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(window.location.search)) {
    if (k !== 'flujo' && k !== 'paso' && k !== 'nueva' && k !== 'ir') extras[k] = v
  }

  const paso = pasoSaneado(flujo, pasoCrudo)
  const actual = flujo.pasos[paso - 1]
  const esUltimo = paso === flujo.pasos.length

  // El estado real de cada paso, para los que se pueden mirar.
  //
  // Un paso ya hecho se marca aunque todavía no hayas llegado: si el tope de
  // todos los pacientes ya está cargado, no tiene sentido pedirte que vayas.
  const estados = flujo.pasos.map(p => (datos ? p.estado?.(datos) : null) ?? null)
  const resumen = datos ? resumenDeFlujo(flujo, datos, paso) : null
  const estadoActual = estados[paso - 1]

  return (
    <section aria-label={`Tarea en curso: ${flujo.label}`}
      className="rounded-xl bg-[#101016] border border-[#a3e635]/30 overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-[#1f1f2b] flex items-center gap-2 flex-wrap">
        <span className="font-display font-semibold text-[13px] text-[#ececf1]">{flujo.label}</span>

        <ol className="flex items-center gap-1 list-none m-0 p-0" aria-label="Pasos">
          {flujo.pasos.map((p, i) => {
            const n = i + 1
            // Hecho porque ya pasaste, o porque el sistema lo verificó.
            // Lo que el sistema ve le gana a por donde anduviste: se avanza con
            // «despues lo hago», asi que haber pasado no es haber hecho.
            const hecho = estados[i] ? !!estados[i]?.hecho : n < paso
            const aca = n === paso
            return (
              <li key={p.titulo} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden className="w-3 h-px bg-[#2a2a3a]" />}
                <span aria-current={aca ? 'step' : undefined}
                  title={p.titulo}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono tabular-nums ${
                    hecho ? 'bg-[#a3e635]/20 text-[#a3e635]'
                      : aca ? 'bg-[#a3e635]/15 text-[#d9f99d] border border-[#a3e635]/50'
                        : 'border border-[#2a2a3a] text-[#8a8a9c]'}`}>
                  {hecho || estados[i]?.hecho
                  ? <Check aria-hidden className="w-3 h-3" strokeWidth={2.6} />
                  : n}
                </span>
              </li>
            )
          })}
        </ol>

        <span className="text-[11px] text-[#8a8a9c] ml-auto">
          paso {paso} de {flujo.pasos.length}
        </span>
        <button onClick={() => navegar('/ong')}
          aria-label="Salir de la tarea"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-1 rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#15151d] transition-colors">
          <X aria-hidden className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3.5 py-3">
        <p className="font-display font-semibold text-[13px] text-[#ececf1]">
          {paso}. {actual.titulo}
        </p>
        <p className="text-[11px] text-[#a6a6b5] mt-1 leading-relaxed">{actual.porQue}</p>

        {/* Lo que el sistema ve ahora mismo.
            No dice si ESTA compra tiene su lote —eso no se puede saber— pero sí
            cuántas cosas de ese tipo quedan sin hacer, que muchas veces es más
            util que un tilde. */}
        {estadoActual?.nota && (
          <p className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg text-[11px]"
            style={(estadoActual.tono ?? (estadoActual.hecho ? 'bueno' : 'aviso')) === 'bueno'
              ? { background: 'rgba(163,230,53,0.10)', color: '#d9f99d' }
              : { background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}>
            {estadoActual.hecho && <Check aria-hidden className="w-3 h-3" strokeWidth={2.6} />}
            {estadoActual.nota}
          </p>
        )}

        {/* Lo que hay que juntar, ANTES de mandar a la pantalla.
            Llegar al formulario y recien ahi darse cuenta de que falta el papel
            obliga a salir, buscarlo y volver a empezar. */}
        {actual.teneAMano && actual.teneAMano.length > 0 && (
          <div className="mt-3 rounded-lg bg-[#15151d] border border-[#2a2a3a] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-1.5">
              Tené a mano
            </p>
            <ul className="space-y-1 list-none m-0 p-0">
              {actual.teneAMano.map(x => (
                <li key={x} className="flex items-start gap-2 text-[11px] text-[#d4d4dd]">
                  <span aria-hidden
                    className="mt-[3px] w-3 h-3 flex-shrink-0 rounded-[3px] border border-[#404d20]" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          {esUltimo ? (
            <button onClick={() => navegar('/ong')}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[12px] font-medium text-[#d9f99d]">
              Terminé
            </button>
          ) : (
            <Link to={rutaDePaso(flujo, paso + 1, extras)}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[12px] font-medium text-[#d9f99d]">
              {flujo.pasos[paso].titulo}
              <ArrowRight aria-hidden className="w-3.5 h-3.5" />
            </Link>
          )}
          {!esUltimo && (
            <button onClick={() => navegar('/ong')}
              className="inline-flex items-center px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:bg-[#1c1c27] transition-colors text-[12px] text-[#a6a6b5]">
              Después lo hago
            </button>
          )}
        </div>

        {/* Cómo viene la tarea entera.
            Acá arriba se ve el paso en el que estás; esto contesta la otra
            pregunta, la que uno se hace justo al cerrar el formulario: «bueno,
            ¿y cómo viene esto?». Antes había que recorrer los pasos de a uno
            para saber si algo había quedado colgado. */}
        {/* El resumen necesita `datos`, que fuera de la O.N.G. no estan. Sin el
            la barra sigue sirviendo: dice que paso es, por que, y como seguir.
            Lo unico que falta es el «ya esta hecho» de cada paso. */}
        {resumen && (
        <div className="mt-3 pt-3 border-t border-[#1f1f2b]">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mb-1.5">
            Cómo viene la tarea
          </p>
          <ol className="space-y-1 list-none m-0 p-0">
            {resumen.map((l, i) => (
              <li key={l.titulo} className="flex items-start gap-2">
                <span aria-hidden
                  className={`mt-[2px] w-4 h-4 flex-shrink-0 rounded-full flex items-center
                    justify-center text-[10px] font-mono tabular-nums ${
                    l.hecho ? 'bg-[#a3e635]/20 text-[#a3e635]'
                      : l.aca ? 'bg-[#a3e635]/15 text-[#d9f99d] border border-[#a3e635]/50'
                        : 'border border-[#2a2a3a] text-[#8a8a9c]'}`}>
                  {l.hecho ? <Check aria-hidden className="w-2.5 h-2.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={`text-[11px] ${l.aca ? 'text-[#ececf1]' : 'text-[#a6a6b5]'}`}>
                    {l.titulo}
                  </span>
                  {/* Donde el sistema no puede saber no hay nota, y no se
                      inventa un tilde: es preferible no decir nada. */}
                  {l.nota && (
                    <span className="block text-[10px] mt-0.5"
                      style={{ color: l.tono === 'bueno' ? '#d9f99d' : '#f59e0b' }}>
                      {l.nota}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
        )}
      </div>
    </section>
  )
}
