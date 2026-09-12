// El manual de operación, adentro de la app.
//
// El texto sale de app/src/contenido/manual.md y se renderiza acá: una sola
// fuente, así la pantalla no se desactualiza respecto del documento del repo.
//
// El índice se arma solo con los títulos de nivel 2, y marca en cuál estás
// mientras scrolleás. En un documento de diez capítulos, saber dónde estás
// parado importa tanto como poder saltar.

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { BookOpen, Search, X, Printer, ArrowUpRight, List, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { rutaDe } from '../lib/rutasManual'
import { PuestaEnMarcha } from '../components/manual/PuestaEnMarcha'
import { IndiceManual } from '../components/manual/IndiceManual'
import { seccionesDe, agruparCapitulos, partirTitulo } from '../lib/indiceManual'
import manualMd from '../contenido/manual.md?raw'
import { parsearMarkdown, parsearInline, type Bloque, type Trozo } from '../lib/markdown'
import { btnSutil, campoBase } from '../lib/ui'
import { useDialogo } from '../lib/useDialogo'

/** Alto del encabezado fijo, para que el titulo no quede debajo al saltar. */
const ALTO_HEADER = 76

export default function PaginaManual() {
  const bloques = useMemo(() => parsearMarkdown(manualMd), [])
  const [busca, setBusca] = useState('')
  const [activo, setActivo] = useState('')
  const [activoSub, setActivoSub] = useState('')
  const [progreso, setProgreso] = useState(0)
  const [indiceAbierto, setIndiceAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const secciones = useMemo(() => seccionesDe(bloques), [bloques])
  const grupos = useMemo(() => agruparCapitulos(secciones), [secciones])

  /** De qué capítulo es cada sección, para marcar los dos a la vez. */
  const capituloDeSub = useMemo(() => {
    const m = new Map<string, string>()
    for (const { capitulo, subs } of secciones) {
      for (const s of subs) m.set(s.id, capitulo.id)
    }
    return m
  }, [secciones])

  // Buscar corta por la sección más chica que tenga sentido sola: una receta (h3)
  // si la hay, el capítulo (h2) si no. Cortar sólo por capítulo devolvía las 28
  // recetas del paso a paso para cualquier palabra, que es no filtrar nada.
  //
  // Cuando lo que coincide es una receta se emite igual su capítulo padre, porque
  // "Cargar un costo" suelto no dice de qué parte del sistema estamos hablando.
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return bloques

    const salida: Bloque[] = []
    let grupo: Bloque[] = []
    let coincide = false
    let capitulo: Bloque | null = null
    let capituloEmitido: Bloque | null = null

    const volcar = () => {
      if (coincide) {
        if (capitulo && capituloEmitido !== capitulo) {
          salida.push(capitulo)
          capituloEmitido = capitulo
        }
        // El propio h2 ya se emitió arriba; no repetirlo al volcar su grupo.
        salida.push(...grupo.filter(b => b !== capitulo))
      }
      grupo = []
      coincide = false
    }

    for (const b of bloques) {
      if (b.tipo === 'titulo' && b.nivel <= 3) {
        volcar()
        if (b.nivel <= 2) capitulo = b
      }
      grupo.push(b)
      if (textoDe(b).toLowerCase().includes(q)) coincide = true
    }
    volcar()
    return salida
  }, [bloques, busca])

  // SE MIRAN LOS h2 Y LOS h3, y se marcan los dos a la vez.
  //
  // Antes sólo los h2. Ahora que el índice abre las secciones del capítulo
  // donde estás, hace falta saber en cuál de ellas: sin esto la lista se abre
  // y ninguna queda marcada, que se lee como que el índice no anda.
  useEffect(() => {
    const raiz = contenedor.current
    if (!raiz || busca) return
    const obs = new IntersectionObserver(
      entradas => {
        const visto = entradas.filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (!visto) return
        const id = visto.target.id
        const padre = capituloDeSub.get(id)
        if (padre) { setActivo(padre); setActivoSub(id) }
        else { setActivo(id); setActivoSub('') }
      },
      { root: scroller.current, rootMargin: `-${ALTO_HEADER + 8}px 0px -68% 0px`, threshold: 0 })
    raiz.querySelectorAll('h2[id], h3[id]').forEach(h => obs.observe(h))
    return () => obs.disconnect()
  }, [visibles, busca, capituloDeSub])

  // CUÁNTO FALTA. Son 2.300 líneas: sin esto no hay forma de saber si lo que
  // estás leyendo es el principio o el final. Se calcula en un `rAF` para no
  // hacer un render por cada píxel de scroll.
  useEffect(() => {
    const caja = scroller.current
    if (!caja) return
    let pedido = 0
    const medir = () => {
      pedido = 0
      const total = caja.scrollHeight - caja.clientHeight
      setProgreso(total > 0 ? Math.min(1, Math.max(0, caja.scrollTop / total)) : 0)
    }
    const alScrollear = () => { if (!pedido) pedido = requestAnimationFrame(medir) }
    caja.addEventListener('scroll', alScrollear, { passive: true })
    medir()
    return () => {
      caja.removeEventListener('scroll', alScrollear)
      if (pedido) cancelAnimationFrame(pedido)
    }
  }, [visibles])

  // Se scrollea el contenedor a mano en vez de usar scrollIntoView: la pagina
  // scrollea en un div propio, no en el documento, y ahi scrollIntoView no movia
  // nada. Ademas hace falta descontar el header sticky, o el titulo al que se
  // salta queda tapado justo por la barra de busqueda.
  const irA = useCallback((id: string) => {
    // El cajón se cierra ANTES de medir: mientras está abierto tapa la pantalla
    // y en el teléfono el salto no se vería.
    setIndiceAbierto(false)
    const caja = scroller.current
    const destino = document.getElementById(id)
    if (!caja || !destino) return
    const y = destino.getBoundingClientRect().top - caja.getBoundingClientRect().top
    const sinAnimacion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    caja.scrollTo({ top: caja.scrollTop + y - ALTO_HEADER, behavior: sinAnimacion ? 'auto' : 'smooth' })
  }, [])

  return (
    <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto bg-[#0a0a0f] text-[#d4d4dd] font-sans">
      <div className="sticky top-0 z-40 bg-[#0a0a0f] border-b border-[#1f1f2b]">
        <div className="flex items-center gap-3 flex-wrap px-3 sm:px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] text-[#ececf1] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#a3e635]" strokeWidth={1.8} /> Manual
            </h1>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-[#8a8a9c]">
              Cómo se usa el sistema, en el orden en que se usa
            </p>
          </div>

          <div className="relative flex-1 sm:flex-none sm:w-64 min-w-[150px]">
            <Search className="w-3.5 h-3.5 text-[#8a8a9c] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              className={`w-full pl-8 pr-8 py-2 sm:text-[12px] ${campoBase}`}
              placeholder="Buscar en el manual" aria-label="Buscar en el manual" />
            {busca && (
              <button onClick={() => setBusca('')} aria-label="Limpiar búsqueda"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-[#8a8a9c] hover:text-[#ececf1]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* En el teléfono el índice no existía: quince capítulos y sólo
              scroll. Este botón abre el mismo índice en un cajón. */}
          {/* SIN `aria-label`, y no es un olvido: el botón ya dice «Contenido»
              en pantalla. Un rótulo accesible que no contiene al texto visible
              rompe WCAG 2.5.3 —quien maneja por voz dice lo que LEE, y el botón
              respondería a otro nombre—. Lo tenía puesto y lo agarró la
              revisión al no encontrar el botón por su nombre. */}
          <button onClick={() => setIndiceAbierto(true)} className={`${btnSutil} lg:hidden`}>
            <List className="w-3.5 h-3.5" /> Contenido
          </button>

          <button onClick={() => window.print()} className={`${btnSutil} hidden sm:inline-flex`}>
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </button>
        </div>

        {/* CUÁNTO LLEVÁS LEÍDO. Un hilo de 2px, no una barra: informa sin
            competir con el texto, que es a lo que se vino. */}
        <div className="h-0.5 bg-[#15151d]" aria-hidden="true">
          <div className="h-full bg-[#a3e635] transition-[width] duration-150 ease-out"
            style={{ width: `${progreso * 100}%` }} />
        </div>
      </div>

      {indiceAbierto && (
        <CajonIndice grupos={grupos} activo={activo} activoSub={activoSub}
          onIr={irA} onCerrar={() => setIndiceAbierto(false)} />
      )}

      <div className="px-3 sm:px-6 py-5 pb-24 max-w-[1180px] mx-auto lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 lg:items-start">
        <div className="hidden lg:block sticky top-[78px] max-h-[calc(100vh-104px)] overflow-y-auto scrollbar-none pb-4">
          <IndiceManual grupos={grupos} activo={activo} activoSub={activoSub} onIr={irA} />
        </div>

        <div ref={contenedor} className="min-w-0 flex flex-col gap-3">
          {busca && (
            <p className="text-[11px] text-[#8a8a9c] pb-1">
              {visibles.length === 0
                ? `No hay nada sobre "${busca}" en el manual.`
                : `Mostrando los capítulos que mencionan "${busca}".`}
            </p>
          )}
          {visibles.map((b, i) => <RenderBloque key={i} b={b} />)}
        </div>
      </div>
    </div>
  )
}

/**
 * El índice en el teléfono.
 *
 * Entra desde abajo y no desde el costado: el pulgar llega al borde inferior y
 * no al superior izquierdo, que es donde estaría un menú lateral. Usa
 * `useDialogo`, así que cierra con Atrás, atrapa el foco y lo devuelve al
 * botón que lo abrió — el mismo contrato que los otros treinta y siete.
 */
function CajonIndice({ grupos, activo, activoSub, onIr, onCerrar }: {
  grupos: Parameters<typeof IndiceManual>[0]['grupos']
  activo: string; activoSub: string
  onIr: (id: string) => void; onCerrar: () => void
}) {
  const refDialogo = useDialogo(onCerrar)
  return (
    <div ref={refDialogo}
      className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center lg:hidden">
      <div className="w-full max-h-[82vh] overflow-y-auto bg-[#0d0d12] border-t border-[#1f1f2b] rounded-t-2xl">
        <div className="px-4 py-3 border-b border-[#1f1f2b] flex items-center gap-2 sticky top-0 bg-[#0d0d12] z-10">
          <h2 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1">
            Contenido del manual
          </h2>
          <button onClick={onCerrar} aria-label="Cerrar" className={btnSutil}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3">
          <IndiceManual grupos={grupos} activo={activo} activoSub={activoSub} onIr={onIr} />
        </div>
        {/* LAS DOS SALIDAS, como todos los demás. Tocar un capítulo también
            cierra el cajón, pero eso sirve para ir a algún lado: acá hace falta
            poder salir SIN ir a ningún lado, y con el pulgar, que llega al
            borde de abajo y no a la X de arriba. */}
        <div className="px-4 py-3 border-t border-[#1f1f2b] sticky bottom-0 bg-[#0d0d12]">
          <button onClick={onCerrar} className={`${btnSutil} w-full justify-center`}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

function textoDe(b: Bloque): string {
  switch (b.tipo) {
    case 'titulo': case 'parrafo': case 'cita': return b.texto
    case 'lista': return b.items.join(' ')
    case 'tabla': return [...b.encabezados, ...b.filas.flat()].join(' ')
    default: return ''
  }
}

function Inline({ texto }: { texto: string }) {
  return (
    <>
      {parsearInline(texto).map((t: Trozo, i) => {
        if (t.t === 'negrita') return <strong key={i} className="font-semibold text-[#ececf1]">{t.v}</strong>
        if (t.t === 'cursiva') return <em key={i} className="italic text-[#c4c4d0]">{t.v}</em>
        if (t.t === 'codigo') {
          // Los destinos de las recetas se vuelven links a la pantalla. El manual
          // vive adentro de la app: decir "andá a Cultivo › Sala" y no llevarte
          // hasta ahí es hacerte buscar algo que el sistema ya sabe dónde está.
          const ruta = rutaDe(t.v)
          if (ruta) return (
            <Link key={i} to={ruta}
              /* EL AREA TOCABLE CRECE CON UN PSEUDO-ELEMENTO, NO CON PADDING.
                 El chip mide 25px de alto y eso alcanza mientras esta en medio
                 de una oracion —WCAG 2.5.8 exceptua el target inline, cuyo
                 tamano lo impone el interlineado—, pero varios quedan SOLOS en
                 su parrafo, y ahi ya no hay ninguna oracion que lo justifique:
                 es un boton de 25px. Subirle el padding abriria un boquete entre
                 renglones justo en la pantalla que la persona vino a LEER, asi
                 que el area crece por afuera y el dibujo no se mueve un pixel.
                 Es el mismo idioma del «Gestionar» del panel. */
              className="relative after:absolute after:-inset-y-2.5 after:content-[''] sm:after:hidden inline-flex items-center gap-1 font-mono text-[0.88em] px-1.5 py-0.5 rounded bg-[#1e2a12] border border-[#404d20] text-[#bef264] hover:bg-[#26340f] hover:border-[#5a6d2c] transition-colors break-words">
              {t.v}
              <ArrowUpRight className="w-3 h-3 flex-shrink-0 opacity-70" />
            </Link>
          )
          return (
            <code key={i} className="font-mono text-[0.88em] px-1.5 py-0.5 rounded bg-[#15151d] border border-[#1f1f2b] text-[#bef264] break-words">
              {t.v}
            </code>
          )
        }
        if (t.t === 'link') return (
          <a key={i} href={t.href} target="_blank" rel="noreferrer"
            className="text-[#a3e635] underline underline-offset-2 hover:text-[#d9f99d] break-words">
            {t.v}
          </a>
        )
        return <span key={i}>{t.v}</span>
      })}
    </>
  )
}

function RenderBloque({ b }: { b: Bloque }) {
  switch (b.tipo) {
    case 'titulo': {
      if (b.nivel === 1) {
        return (
          <h1 className="font-display font-bold text-[22px] sm:text-[26px] text-[#ececf1] tracking-tight mt-1 mb-1">
            {b.texto}
          </h1>
        )
      }
      if (b.nivel === 2) {
        // EL NÚMERO SALE DEL TÍTULO Y SE VUELVE UNA MARCA. Adentro del texto
        // era una palabra más; arriba y en mono, es la referencia con la que se
        // habla del capítulo («andá al 00a»). El h2 conserva el texto entero
        // para que el buscador del navegador y los lectores de pantalla lean
        // lo mismo que está escrito en el markdown.
        const { numero, titulo } = partirTitulo(b.texto)
        return (
          <h2 id={b.id} className="mt-9 pt-5 border-t border-[#1f1f2b] scroll-mt-24">
            {numero && (
              <span className="block font-mono text-[11px] tracking-[0.12em] text-[#8a8a9c] mb-1">
                {numero}
              </span>
            )}
            <span className="block font-display font-semibold text-[19px] sm:text-[22px] text-[#d9f99d] tracking-tight leading-tight">
              {titulo}
            </span>
          </h2>
        )
      }
      return (
        <h3 id={b.id} className="font-display font-semibold text-[14px] sm:text-[15px] text-[#ececf1] mt-5 scroll-mt-24 flex items-baseline gap-2">
          <span aria-hidden="true" className="w-1 h-1 rounded-full bg-[#a3e635] flex-shrink-0 translate-y-[-3px]" />
          {b.texto}
        </h3>
      )
    }

    case 'parrafo':
      // Marcador: una linea con {{PUESTA_EN_MARCHA}} se reemplaza por el checklist
      // que lee el estado real. El manual sigue siendo markdown plano.
      if (b.texto.trim() === '{{PUESTA_EN_MARCHA}}') return <PuestaEnMarcha />
      return (
        <p className="text-[13px] sm:text-[14px] leading-relaxed text-[#b8b8c4] max-w-[68ch]">
          <Inline texto={b.texto} />
        </p>
      )

    case 'lista': {
      const clase = 'text-[13px] sm:text-[14px] leading-relaxed text-[#b8b8c4] max-w-[68ch] flex flex-col gap-2 pl-5 my-0'
      const items = b.items.map((it, i) => (
        <li key={i} className="marker:text-[#8a8a9c]"><Inline texto={it} /></li>
      ))
      return b.ordenada
        ? <ol className={`${clase} list-decimal`}>{items}</ol>
        : <ul className={`${clase} list-disc`}>{items}</ul>
    }

    case 'cita': {
      // ⚠️ UN AVISO NO SE PINTA IGUAL QUE UNA ACLARACIÓN. El manual usa las dos
      // cosas con la misma sintaxis de markdown, y hasta ahora salían idénticas:
      // «no corras marcarBaseline()» se veía como «en palabras fáciles». El
      // triángulo ya estaba escrito en el texto; acá sólo se lo escucha.
      const alerta = /^\s*⚠/.test(b.texto)
      const limpio = alerta ? b.texto.replace(/^\s*⚠️?\s*/, '') : b.texto
      return (
        <div className={`rounded-lg px-3.5 py-3 max-w-[68ch] border border-l-2 ${
          alerta
            ? 'bg-[#191207] border-[#3a2c10] border-l-[#f59e0b]'
            : 'bg-[#101016] border-[#1f1f2b] border-l-[#a3e635]'}`}>
          <p className={`text-[12px] sm:text-[13px] leading-relaxed flex gap-2 ${
            alerta ? 'text-[#e5cfa4]' : 'text-[#a6a6b5]'}`}>
            {alerta && (
              <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] flex-shrink-0 mt-0.5" strokeWidth={1.8} />
            )}
            <span className="min-w-0"><Inline texto={limpio} /></span>
          </p>
        </div>
      )
    }

    case 'tabla':
      return (
        <div className="overflow-x-auto rounded-xl border border-[#1f1f2b] bg-[#101016]">
          <table className="w-full border-collapse text-[12px] min-w-[520px]">
            <thead>
              <tr>
                {b.encabezados.map((h, i) => (
                  <th key={i} className="text-left px-3.5 py-2.5 bg-[#15151d] border-b border-[#1f1f2b] text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium whitespace-nowrap">
                    <Inline texto={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* LA PRIMERA COLUMNA ES LA QUE SE BUSCA. En casi todas las tablas
                  del manual es el nombre de la cosa —la pestaña, el rol, el
                  paso—, y el resto es su explicación: destacarla convierte la
                  tabla en algo que se recorre en diagonal. Y las filas se pintan
                  alternadas porque varias tienen cuatro columnas anchas, donde
                  el ojo se pasa de renglón. */}
              {b.filas.map((f, i) => (
                <tr key={i} className={`${i % 2 ? 'bg-[#0e0e14]' : ''} hover:bg-[#15151d] transition-colors`}>
                  {f.map((c, j) => (
                    <td key={j} className={`px-3.5 py-2.5 border-b border-[#1f1f2b] align-top leading-snug last:border-r-0 ${
                      j === 0 ? 'text-[#d4d4dd]' : 'text-[#b8b8c4]'}`}>
                      <Inline texto={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'separador':
      // El markdown separa capítulos con una línea; acá ese rol lo cumple el
      // borde superior del título, así que dibujarla otra vez sería ruido.
      return null
  }
}
