import { useState, useEffect } from 'react'
import { urlDeFoto } from '../lib/archivos'

/**
 * <img> para una foto guardada en el bucket privado `fotos`.
 *
 * En la base se guarda el path, no una URL que se pueda abrir: hay que pedir
 * una URL firmada antes de poder mostrarla. Esto encapsula esa vuelta para que
 * cada pantalla no repita el useEffect. Mientras resuelve deja un hueco del
 * mismo tamaño, así la lista no salta cuando entra la imagen.
 */
export function FotoPrivada({ valor, className, alt = '', onClick }: {
  valor: string
  className?: string
  alt?: string
  onClick?: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [falló, setFalló] = useState(false)
  useEffect(() => {
    let vigente = true
    urlDeFoto(valor)
      .then(u => { if (vigente) setUrl(u || null) })
      .catch(() => { if (vigente) setFalló(true) })
    return () => { vigente = false }
  }, [valor])

  if (falló) return <div className={`${className ?? ''} bg-[#1a1a24]`} title="No se pudo cargar la foto" />
  if (!url) return <div className={`${className ?? ''} bg-[#15151d] animate-pulse`} />
  // EL BORDE DE LA FOTO. Sobre el #0a0a0f del fondo, una foto de una planta o de
  // un equipo —que casi siempre tiene las esquinas oscuras— no termina en ningún
  // lado: el borde se disuelve en la página y no se ve dónde arranca la imagen.
  //
  // Va como `outline` con offset negativo y NO como `border`: el border suma un
  // píxel a la caja y correría el layout de cada lista que use esto. El outline
  // se dibuja por dentro, sigue el `rounded-*` que ponga quien la usa, y no
  // ocupa lugar.
  //
  // Blanco al 10% y no un color de la marca: es el contorno de la foto, no un
  // estado. Un borde lima acá se leería como «seleccionada».
  return <img src={url} alt={alt} loading="lazy" onClick={onClick}
    className={`${className ?? ''} [outline:1px_solid_rgba(255,255,255,0.1)] [outline-offset:-1px]`} />
}
