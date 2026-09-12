// Una acción de la portada, en fila.
//
// POR QUÉ VIVE ACÁ Y NO EN UNA PANTALLA
//
// La misma botonera está en dos lugares —el Panel principal y el Panel de la
// O.N.G.— y cada uno la dibujaba a su manera. Medido el 28/08/2026: la misma
// acción medía 76 px en una pantalla y 56 en la otra, con detalle e ícono en
// cajita en una y sin nada de eso en la otra. Dos diseños para lo mismo, que se
// notan apenas se pasa de una pantalla a la otra.
//
// Ahora hay uno solo. Cambiarlo cambia las dos.
//
// EL DETALLE LARGO ES OPCIONAL, y por defecto no va. En la portada ayuda la
// primera semana y después es texto que hay que saltear todos los días. Pero
// detrás de «ver todo» están justamente las acciones que NO se conocen de
// memoria —se entra ahí a buscar algo que no se sabe cómo se llama— y ahí el
// detalle es lo que hace elegir. Por eso es una prop y no una decisión fija.
//
// Lo que sí va siempre es el `motivo`: es lo único de esta zona que cambia según
// el estado de los datos —«ojo: el recibo va a salir sin CUIT»— y por eso vale
// su renglón aunque se lea todos los días.

import { createElement } from 'react'
import { Lock, AlertTriangle, ArrowUpRight } from 'lucide-react'
import { iconoDeAccion } from '../../lib/iconosAccion'
import { FilaTocable } from '../ui/FilaTocable'
import { saleDeLaOng, type Accion } from '../../lib/accionesOng'

export function FilaAccion({ a, detalle = false, sale }: {
  a: Accion
  detalle?: boolean
  /**
   * Si la acción deja la sección donde está la botonera.
   *
   * Por defecto es «deja la O.N.G.», que es de donde salió este componente.
   * La botonera de Cultivo pasa `saleDeCultivo`: sin eso, las nueve acciones
   * llevarían la flecha de «te vas» y la flecha dejaría de significar algo.
   */
  sale?: boolean
}) {
  const bloqueada = a.estado === 'bloqueada'
  // La bloqueada no lleva a su propia pantalla —no habría nada que hacer ahí—
  // sino a donde se carga lo que falta.
  const destino = bloqueada ? (a.rutaMotivo ?? a.ruta) : a.ruta

  return (
    <FilaTocable to={destino} apagada={bloqueada}
      etiqueta={a.motivo
        ? `${a.label}. ${bloqueada ? 'No se puede todavía' : 'Ojo'}: ${a.motivo}.`
        : a.label}>
      {/* EL ICONO EN SU CAJA, Y LA CAJA MIDE SIEMPRE LO MISMO.
          Suelto era un trazo lima de 18px flotando al lado del texto: se leía
          como adorno y no como «esto se toca». En una caja de 26px con su
          superficie propia, las seis filas arrancan con la misma pieza y la
          columna de títulos se apoya en un borde firme en vez de en el ancho
          casual de cada glifo.

          La caja tiene ALTO FIJO y es lo que fija el renglón del título: 26px
          es la altura de la línea del título más su aire, así que el icono y la
          primera línea de texto quedan centrados entre sí en la fila de un
          renglón Y en la de dos. Sin eso, alinear arriba dejaba el icono
          pegado al borde superior. */}
      <span aria-hidden className={`flex-shrink-0 w-[26px] h-[26px] rounded-md flex items-center justify-center border ${
        bloqueada ? 'bg-[#15151d] border-[#1f1f2b]' : 'bg-[#a3e635]/[0.08] border-[#2c3a1a]'}`}>
        {bloqueada
          ? <Lock className="w-[15px] h-[15px] text-[#6e6e80]" />
          : createElement(iconoDeAccion(a.icono), { className: 'w-[15px] h-[15px] text-[#a3e635]', strokeWidth: 1.8 })}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center min-h-[26px] font-display font-semibold text-[12px] leading-tight [text-wrap:pretty]"
          style={{ color: bloqueada ? '#8f8f9f' : '#ececf1' }}>
          {a.label}
        </span>
        {/* El motivo se muestra SIEMPRE: un candado sin explicación es peor que
            la acción ausente, porque deja adivinando. */}
        {/* `[text-wrap:pretty]` en las dos: son las líneas que ENVUELVEN. A
            375px, «Falta: cargá el CUIT de la entidad» entra en dos renglones y
            el segundo suele quedar con una palabra sola. Esa palabra huérfana no
            es fea nomás: en la grilla de dos columnas estira la tarjeta un
            renglón entero, y `auto-rows-fr` estira con ella la de al lado, que
            no tenía por qué crecer. Un renglón de más por tarjeta, a seis
            tarjetas, es la diferencia entre ver la portada entera o tener que
            scrollear. */}
        {detalle && a.detalle && (
          <span className="block text-[10px] text-[#8a8a9c] leading-snug mt-0.5 [text-wrap:pretty]">{a.detalle}</span>
        )}
        {a.motivo && (
          <span className="block text-[10px] leading-snug mt-0.5 [text-wrap:pretty]"
            style={{ color: bloqueada ? '#8f8f9f' : '#f59e0b' }}>
            {bloqueada ? 'Falta: ' : 'Ojo: '}{a.motivo}
          </span>
        )}
      </span>

      {/* `mt-[5px]` centra estos iconos contra la PRIMERA linea del titulo, que
          es a lo que se refieren. Sin eso quedaban arriba de todo, y en una fila
          de dos renglones la flecha apuntaba a un renglon mas alto que el texto
          que la explica. */}
      {a.estado === 'aviso' && !a.motivo && (
        <AlertTriangle aria-hidden className="w-3.5 h-3.5 text-[#f59e0b] flex-shrink-0 mt-[5px]" />
      )}
      {/* Avisa ANTES de tocar que la acción te saca de la O.N.G. Enterarse
          después, ya en otra pantalla, se siente como haberse perdido. */}
      {(sale ?? saleDeLaOng(a)) && (
        <ArrowUpRight aria-hidden className="w-3.5 h-3.5 text-[#6e6e80] flex-shrink-0 mt-[5px]" />
      )}
    </FilaTocable>
  )
}
