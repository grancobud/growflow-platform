// EL ÍNDICE DEL MANUAL.
//
// Vive aparte de la página porque se dibuja DOS veces: la columna fija del
// escritorio y el cajón del teléfono. Antes existía sólo la primera
// (`hidden lg:block`), así que en un celular el manual eran quince capítulos
// sin ninguna forma de saltar entre ellos más que scrollear.
//
// TRES COSAS QUE LO HACEN NAVEGABLE Y NO UNA LISTA:
//
//   1. Los capítulos van AGRUPADOS por para qué se entra. Quince renglones
//      seguidos no se leen; cuatro grupos de tres o cuatro, sí.
//   2. El número se separa del título. «00a · Abrir la sede: los cuatro pasos
//      del Panel» en una columna de 220px se partía en tres renglones y el
//      número quedaba perdido adentro del texto.
//   3. El capítulo donde estás parado ABRE sus secciones. El manual tiene 28
//      recetas en el capítulo 11 sola: mostrarlas todas siempre es volver al
//      problema de la lista larga, y no mostrarlas nunca deja el índice ciego
//      justo donde más subsecciones hay.

import type { Titulo } from '../../lib/indiceManual'

export interface Seccion {
  capitulo: Titulo
  subs: Titulo[]
}

export interface Grupo {
  nombre: string
  pista: string
  secciones: Seccion[]
}

export function IndiceManual({ grupos, activo, activoSub, onIr }: {
  grupos: Grupo[]
  /** Id del h2 en el que está parada la lectura. */
  activo: string
  /** Id del h3, cuando hay uno más adentro. */
  activoSub: string
  onIr: (id: string) => void
}) {
  return (
    <nav aria-label="Índice del manual" className="flex flex-col gap-4">
      {grupos.map(g => (
        <div key={g.nombre}>
          <div className="px-2 mb-1.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium">
              {g.nombre}
            </p>
            {/* Para qué se entra a este grupo. Es lo que convierte cuatro
                títulos en una respuesta: quien abre el manual no busca «el
                capítulo 07», busca qué mira un organismo. */}
            {/* ⚠️ `#8a8a9c` y no un gris más apagado: es el más oscuro que
                llega a 4.5:1 sobre este fondo. La diferencia con el nombre del
                grupo la hacen la caja y el espaciado, no el color. */}
            <p className="text-[10px] text-[#8a8a9c] leading-snug mt-0.5">{g.pista}</p>
          </div>
          <ol className="flex flex-col gap-0.5 list-none p-0 m-0">
            {g.secciones.map(({ capitulo, subs }) => {
              const acá = activo === capitulo.id
              return (
                <li key={capitulo.id}>
                  <button onClick={() => onIr(capitulo.id)}
                    aria-current={acá ? 'true' : undefined}
                    className={`w-full text-left flex items-start gap-2 pl-2 pr-2 py-2 min-h-[44px] lg:min-h-0 lg:py-1.5 rounded-md
                      border-l-2 transition-colors ${
                      acá
                        ? 'border-l-[#a3e635] bg-[#15151d] text-[#d9f99d]'
                        : 'border-l-transparent text-[#8f8f9f] hover:text-[#d4d4dd] hover:bg-[#101016]'}`}>
                    <span className={`font-mono text-[11px] leading-5 flex-shrink-0 tabular-nums ${
                      acá ? 'text-[#a3e635]' : 'text-[#8a8a9c]'}`}>
                      {capitulo.numero}
                    </span>
                    <span className="text-[12px] leading-5 min-w-0">{capitulo.titulo}</span>
                  </button>

                  {/* Las secciones del capítulo donde estás. */}
                  {acá && subs.length > 0 && (
                    <ol className="flex flex-col gap-0.5 list-none p-0 m-0 mt-0.5 mb-1 ml-[13px] border-l border-[#1f1f2b]">
                      {subs.map(s => (
                        <li key={s.id}>
                          <button onClick={() => onIr(s.id)}
                            aria-current={activoSub === s.id ? 'true' : undefined}
                            className={`w-full text-left pl-3 pr-2 py-1.5 min-h-[40px] lg:min-h-0 lg:py-1 text-[11.5px] leading-snug rounded-r-md transition-colors ${
                              activoSub === s.id
                                ? 'text-[#bef264] bg-[#101016]'
                                : 'text-[#8f8f9f] hover:text-[#c4c4d0] hover:bg-[#101016]'}`}>
                            {s.titulo}
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </nav>
  )
}
