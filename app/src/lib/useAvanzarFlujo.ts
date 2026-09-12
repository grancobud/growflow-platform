// Pasar al paso siguiente cuando el formulario de este paso ya se guardó.
//
// Antes la barra de pasos esperaba, pero había que apretarla. Se guardaba la
// entrega, el modal se cerraba, y la persona quedaba parada en la lista de
// dispensas mirando la barra: la tarea seguía, pero el sistema no la movía.
// El que acaba de guardar es el que sabe que el paso terminó, así que es el que
// avanza.
//
// Avanza SOLO si hay un flujo en curso. El mismo formulario se abre veinte
// veces por día fuera de un flujo, y ahí guardar tiene que dejar donde estaba:
// por eso devuelve si avanzó o no, y el que llama decide qué hacer con el modal.
//
// `extras` es lo que este paso descubrió y el siguiente necesita: el id de la
// entrega recién creada, para que el recibo se ligue a ESA y no a la que la
// persona tenga que buscar en una lista de 1.241.

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { flujoDe, pasoSaneado, rutaDePaso } from './flujosOng'

export function useAvanzarFlujo() {
  const navegar = useNavigate()

  // Lee la URL viva y no el `search` del render: entre que se apretó Guardar y
  // que la base contestó pasan cientos de milisegundos, y en el medio otro hook
  // ya limpió `nueva`. El `search` capturado en el render sería el de antes.
  return useCallback((extras?: Record<string, string>): boolean => {
    const params = new URLSearchParams(window.location.search)
    const flujo = flujoDe(params.get('flujo'))
    if (!flujo) return false

    const paso = pasoSaneado(flujo, params.get('paso'))
    // El último paso no tiene siguiente: la tarea terminó y se vuelve al panel,
    // igual que con el botón «Terminé» de la barra.
    if (paso >= flujo.pasos.length) { navegar('/ong'); return true }

    navegar(rutaDePaso(flujo, paso + 1, extras))
    return true
  }, [navegar])
}
