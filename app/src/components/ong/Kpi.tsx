// Un número con su etiqueta, centrado y en su propia celda.
//
// Vivía adentro de Seguimiento, que además del seguimiento clínico tenía el
// libro de caja. Al separar las dos cosas quedaron dos dueños para el mismo
// componente, así que pasa a vivir solo. Copiarlo en los dos lados sería la
// forma más rápida de que dentro de un mes muestren números con estilos
// distintos sin que nadie lo decida.
//
// POR QUÉ CENTRADO Y EN CELDA (29/08/2026)
//
// Estaba alineado a la izquierda y suelto sobre la tarjeta. En una grilla de
// dos columnas eso se lee corrido: «Pacientes 43» al lado de «Entregas
// 150 · 1357 g» arrancan en el mismo borde pero terminan en lugares muy
// distintos, y como cada etiqueta mide otra cosa, ninguna línea coincide con
// la de al lado. No era un problema de alineación de un elemento: era que no
// había nada que emparejara las celdas entre sí.
//
// La caja lo resuelve de raíz — cada dato ocupa el mismo rectángulo, y dentro
// de él el centrado es evidente. Es la única parte del sistema donde se usa un
// borde para agrupar en vez de aire; se acepta acá porque el aire ya se probó
// y con etiquetas de largo desparejo no alcanzaba.
//
// El número lidera: 20 px en la display, contra los 10 px de la etiqueta. Y la
// unidad se atenúa, porque «1357 g» y «/5» son la escala del dato, no el dato:
// lo que se mira de un vistazo es el número.

/**
 * Parte el valor en dato y unidad.
 *
 * Sólo corta en ` · ` y en `/`, que son los dos separadores que la app usa para
 * pegarle una escala a un número («150 · 1357 g», «3.0/5», «17/20»). Un importe
 * con puntos de miles no tiene ninguno de los dos y queda entero, que es lo que
 * corresponde: en `$X.XXX.XXX` no hay unidad que atenuar.
 */
function partir(v: string): [string, string | null] {
  const m = v.match(/^([^/·]+?)(\s*[·/].*)$/)
  return m ? [m[1], m[2]] : [v, null]
}

export function Kpi({ t, v, c, ancho }: {
  t: string; v: string; c?: string
  /** Clases de grilla, para que un dato pueda ocupar dos columnas. */
  ancho?: string
}) {
  const [dato, unidad] = partir(v)
  return (
    <div className={`min-w-0 h-full min-h-[72px] flex flex-col items-center justify-center text-center
      rounded-[10px] bg-[#15151d] border border-[#1f1f2b] px-2 py-3 ${ancho ?? ''}`}>
      {/* EL NUMERO NUNCA SE TRUNCA NI SE PARTE.
          Con `truncate` a 20 px, «$XX.XXX.XXX» salia «$73.8…»: un importe
          cortado en un libro contable es peor que no mostrarlo, porque igual se
          lee como una cifra. Se achica en vez de cortarse.

          Y `whitespace-nowrap` en vez de `break-words`, que era la red anterior:
          medido en el telefono el 01/09/2026, «$XX.XXX.XXX» salia «$XX.XXX.0» /
          «16» en dos renglones, partido a la mitad de un numero. Bajar de
          renglon es tan ilegible como truncar, y mas enganoso.

          LOS ESCALONES ESTAN CALIBRADOS SOBRE UNA MEDICION, no a ojo: la celda
          mas angosta del sistema —tres columnas a 375 px— deja 85 px utiles, y
          un digito de la display con `tabular-nums` mide ~0,6 em. De ahi sale
          cuantos caracteres entran en cada tamano. */}
      <div className={`w-full whitespace-nowrap font-display font-semibold leading-none tabular-nums ${
        // Una celda que ocupa dos columnas tiene el DOBLE de ancho, asi que el
        // mismo largo entra con una letra mas grande. Sin esto, el saldo -que es
        // el numero que se viene a mirar, y por eso se le dio el ancho entero-
        // quedaba mas chico que los dos de arriba: la escala miraba solo el
        // largo del texto y no el lugar que tenia para ponerlo.
        ancho?.includes('col-span-2')
          ? (dato.length > 17 ? 'text-[15px]' : dato.length > 13 ? 'text-[18px]' : 'text-[22px]')
          : dato.length > 11 ? 'text-[11px]'
          : dato.length > 9 ? 'text-[12px]'
          : dato.length > 7 ? 'text-[15px]'
          : 'text-[20px]'}`}
        style={{ color: c ?? '#ececf1' }}>
        {dato}
        {unidad && <span className="text-[13px] font-medium text-[#8a8a9c]">{unidad}</span>}
      </div>
      {/* La etiqueta admite dos renglones: «Reembolso por gramo» cortado a
          «Reembolso por g…» no dice cual es el dato. La celda tiene alto
          minimo fijo, asi que dos renglones no la desalinean de las demas. */}
      {/* `balance` y no `pretty`: esto es un rótulo corto de dos renglones, y
          ahí el criterio es repartir parejo. «Reembolso por gramo» salía
          «Reembolso por» / «gramo» —tres palabras arriba, una abajo— y en una
          grilla de tres celdas eso deja las tres etiquetas con distinto peso
          visual aunque midan lo mismo. `pretty` sólo evita la palabra huérfana;
          `balance` iguala los dos renglones, que es lo que hace que la fila de
          KPIs se lea como una fila. */}
      <div className="w-full text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium mt-1.5 leading-tight line-clamp-2 [text-wrap:balance]">{t}</div>
    </div>
  )
}
