import { supabase } from './supabase'

/**
 * Archivos guardados en Supabase Storage.
 *
 * Regla: en la base se guarda el PATH dentro del bucket, nunca una URL publica.
 * Una URL publica no caduca y no pide login, asi que cualquiera que la tenga (o
 * que adivine el nombre) se lleva el archivo. Para mostrarlo se pide una URL
 * firmada, que vence.
 */

/**
 * Saca el path dentro del bucket a partir de lo que haya guardado la columna.
 * Las filas viejas tienen la URL publica entera
 * (https://<proj>.supabase.co/storage/v1/object/public/<bucket>/archivo.pdf);
 * las nuevas guardan solo "archivo.pdf". Aceptar las dos formas permite
 * deployar y cerrar el bucket en cualquier orden sin romper nada.
 */
export function pathDeArchivo(valor: string, bucket: string): string {
  if (!/^https?:\/\//i.test(valor)) return valor
  const marca = `/${bucket}/`
  const i = valor.indexOf(marca)
  const crudo = i === -1 ? valor.split('/').pop() ?? valor : valor.slice(i + marca.length)
  return decodeURIComponent(crudo.split('?')[0])
}

// Una lista de plantas puede pedir la misma foto varias veces mientras se
// scrollea; sin cache eso es una llamada a storage por cada <img> que se monta.
const VIGENCIA_S = 3600
const cache = new Map<string, { url: string; vence: number }>()

/** URL temporal para ver un archivo privado. Cachea hasta poco antes de vencer. */
export async function urlFirmada(bucket: string, valor: string, segundos = VIGENCIA_S): Promise<string> {
  const path = pathDeArchivo(valor, bucket)
  const clave = `${bucket}/${path}`
  const guardada = cache.get(clave)
  if (guardada && guardada.vence > Date.now()) return guardada.url

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, segundos)
  if (error) throw new Error(error.message)
  // Se descarta un minuto antes de que venza de verdad, para no entregar una
  // URL que caduca mientras la imagen esta cargando.
  cache.set(clave, { url: data.signedUrl, vence: Date.now() + (segundos - 60) * 1000 })
  return data.signedUrl
}

/** URL para ver la credencial REPROCANN de un paciente (bucket `documentos`). */
export function urlDeCredencial(valor: string, segundos = VIGENCIA_S): Promise<string> {
  return urlFirmada('documentos', valor, segundos)
}

/**
 * URL para ver una foto (bucket `fotos`). Las fotos viejas guardadas como data
 * URL (base64 dentro de la propia columna) se devuelven tal cual: no estan en
 * storage y no hay nada que firmar.
 */
export function urlDeFoto(valor: string, segundos = VIGENCIA_S): Promise<string> {
  if (valor.startsWith('data:')) return Promise.resolve(valor)
  return urlFirmada('fotos', valor, segundos)
}
