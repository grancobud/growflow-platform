// OCR de credenciales REPROCANN: renderiza el PDF a imagen en el navegador (pdf.js)
// y la manda a un webhook local (n8n -> Ollama qwen3-vl) que devuelve los campos.
// 100% local: la lectura la hace tu GPU, nada va a la nube.

/**
 * PDF.JS ENTRA TARDE, NO AL ARRANCAR.
 *
 * Estaba importado arriba, y ademas el worker se creaba en el momento en que se
 * cargaba este modulo. Con eso el chunk `pdf-libs` —811 KB, el mas grande de
 * todos— quedaba enganchado al arranque: se descargaba al abrir la app aunque
 * nadie fuera a leer una credencial. En un telefono con datos moviles eso es
 * casi un tercio de la carga inicial para una pantalla que la mayoria no abre.
 *
 * SE MEMORIZA LA PROMESA, no el modulo. Si se guardara el modulo, dos llamadas
 * al mismo tiempo —que es lo normal al subir varios archivos— arrancarian dos
 * importaciones y crearian DOS workers.
 */
let pdfjsCargando: Promise<typeof import('pdfjs-dist')> | null = null

function cargarPdfjs() {
  if (!pdfjsCargando) {
    pdfjsCargando = (async () => {
      const [lib, { default: PdfWorker }] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?worker'),
      ])
      lib.GlobalWorkerOptions.workerPort = new PdfWorker()
      return lib
    })()
  }
  return pdfjsCargando
}

const OCR_URL = import.meta.env.VITE_OCR_WEBHOOK_URL || ''

export interface DatosCredencial {
  nombre_completo?: string
  dni?: string
  fecha_nacimiento?: string
  telefono?: string
  email?: string
  localidad?: string
  provincia?: string
  domicilio?: string
  reprocann_nro?: string
  reprocann_estado?: string
  reprocann_emision?: string
  reprocann_vencimiento?: string
  modalidad?: string
  plantas_habilitadas?: number | string
  m2_habilitados?: number | string
  patologia?: string
  medico_tratante?: string
  matricula_medico?: string
}

export const OCR_DISPONIBLE = !!OCR_URL

// Renderiza la primera pagina del PDF a un PNG base64 (sin el prefijo data:).
async function pdfAImagen(file: File, escala = 2.5): Promise<string> {
  const buf = await file.arrayBuffer()
  const pdfjsLib = await cargarPdfjs()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: escala })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
}

export async function leerCredencial(file: File): Promise<DatosCredencial> {
  if (!OCR_URL) throw new Error('OCR no configurado (VITE_OCR_WEBHOOK_URL)')
  const image = await pdfAImagen(file)
  const res = await fetch(OCR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  })
  if (!res.ok) throw new Error(`OCR HTTP ${res.status}`)
  const json = await res.json()
  return (json.datos ?? json) as DatosCredencial
}
