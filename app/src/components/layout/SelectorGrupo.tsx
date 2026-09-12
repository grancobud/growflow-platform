// La primera fila de la barra de O.N.G.: los grupos.
//
// No usa `BarraPestanas` a propósito, y la diferencia no es estética.
//
// Las pestañas scrollean porque son dieciocho y no hay forma de que entren. Los
// grupos son cinco, fijos, y cada uno lleva un contador de pendientes: si el
// grupo queda fuera de cuadro, su contador no se ve, y un contador que no se ve
// no sirve para nada. Justamente lo que este selector tiene que resolver es
// dónde está el trabajo sin entrar a mirar.
//
// Por eso envuelve en vez de scrollear. Con cinco elementos cortos son dos
// líneas en el celular y una en el escritorio, y siempre están todos a la vista.
//
// También se ve distinto de la fila de abajo a propósito: un grupo no es una
// pestaña más. Si los dos niveles usaran el mismo estilo, la barra parecería una
// sola lista de veintitrés cosas.

export interface Grupo {
  id: string
  label: string
  /** Cuántos cruces abiertos cuelgan de este grupo. Cero no dibuja nada. */
  badge?: number
}

export function SelectorGrupo({ grupos, activo, onCambio }: {
  grupos: Grupo[]
  activo: string
  onCambio: (id: string) => void
}) {
  return (
    /* Un riel, no cinco botones sueltos.
       Antes cada grupo era una pastilla con su propio borde: cinco bordes
       compitiendo, y como la altura era `min-h` y no una altura, los que
       llevaban contador quedaban mas altos que los que no. Se veian despares
       sin que hubiera nada mal.
       Ahora el borde es UNO —el del riel— y adentro los cinco comparten una
       altura fija. El activo se pinta solido en vez de tenue: es el unico lugar
       de la barra donde hace falta que no quede ninguna duda de donde estas
       parado. Se redondea a 20px y no a `full` porque en el telefono envuelve
       en dos filas, y un `rounded-full` de dos filas se ve como un error. */
    <div role="tablist" aria-label="Áreas de la O.N.G."
      /* `mx-3 sm:mx-6` y no `mx-2 sm:mx-4`: el riel es una caja con borde, y una
         caja con borde se alinea por su borde. Medido a 375px, el titulo y las
         pestañas arrancan en x=12 y el riel arrancaba en x=8 — cuatro pixeles de
         desfasaje que se leen como un escalon en el medio del header. */
      className="mx-3 sm:mx-6 mt-2 mb-1 inline-flex flex-wrap gap-1 rounded-[24px] sm:rounded-[20px] bg-[#101016] border border-[#1f1f2b] p-1">
      {grupos.map(g => {
        const seleccionado = activo === g.id
        return (
          <button key={g.id} role="tab" aria-selected={seleccionado}
            onClick={() => onCambio(g.id)}
            /* `h-11` en el teléfono y `h-9` de ahí para arriba. Eran 36px fijos
               en los dos, y 36 está por debajo del mínimo táctil: son los cinco
               botones que llevan a todo O.N.G., o sea la navegación principal de
               la pantalla más densa de la app, tocada con el pulgar parado en el
               mostrador. Sigue siendo una altura FIJA en cada ancho, que es lo
               que hace que los que tienen contador no queden más altos que los
               que no. */
            className={`inline-flex items-center gap-1.5 h-11 sm:h-9 px-3 rounded-full text-[12px] whitespace-nowrap transition-colors duration-100 ${
              seleccionado
                ? 'bg-[#a3e635] text-[#1a2e05] font-semibold'
                : 'text-[#8f8f9f] font-medium hover:text-[#d4d4dd] hover:bg-[#15151d]'}`}>
            {g.label}
            {!!g.badge && (
              /* El contador dejo de ser una capsula roja.
                 Rojo es error en el sistema, y esto son cruces sin resolver:
                 con cinco capsulas rojas el rojo dejaba de querer decir algo.
                 Sobre el activo va en el mismo verde oscuro del texto, para no
                 meter un tercer color adentro de una pastilla. */
              <span aria-label={`${g.badge} sin resolver`}
                className={`min-w-[18px] text-center px-1 rounded-full text-[10px] font-mono tabular-nums ${
                  seleccionado ? 'bg-[#1a2e05]/20 text-[#1a2e05]' : 'bg-[#2a2a3a] text-[#d4d4dd]'}`}>
                {g.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
