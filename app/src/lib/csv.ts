// Lector de CSV, lo justo para importar la planilla de un formulario.
//
// Se eligio CSV y no Excel porque Google Sheets lo exporta nativo (Archivo >
// Descargar > CSV) y porque el lector de Excel del proyecto arrastra exceljs,
// que son ~930 kB para leer una tabla de texto.
//
// No es un parser general: es el subset de RFC 4180 que producen Google Sheets
// y Excel. Pero cubre lo que rompe a las soluciones de `split(',')`:
//
//   - campos entre comillas con COMAS adentro  ->  "Perez, Juan"
//   - campos entre comillas con SALTOS DE LINEA adentro (una respuesta larga)
//   - comillas escapadas duplicandolas         ->  "el dijo ""hola"""
//   - archivos con BOM al principio, que deja el primer encabezado invisible
//   - finales de linea de Windows (\r\n)

export interface TablaCSV {
  columnas: string[]
  filas: Record<string, string>[]
}

export function parsearCSV(texto: string): TablaCSV {
  // El BOM de UTF-8 se cuela como caracter invisible en el primer encabezado y
  // hace que la columna "Marca temporal" nunca matchee con nada.
  const s = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto

  const filas: string[][] = []
  let campo = ''
  let fila: string[] = []
  let enComillas = false

  for (let i = 0; i < s.length; i++) {
    const c = s[i]

    if (enComillas) {
      if (c === '"') {
        // Dos comillas seguidas adentro de un campo entrecomillado son UNA
        // comilla literal, no el cierre.
        if (s[i + 1] === '"') { campo += '"'; i++ }
        else enComillas = false
      } else {
        campo += c
      }
      continue
    }

    if (c === '"') { enComillas = true; continue }
    if (c === ',') { fila.push(campo); campo = ''; continue }
    if (c === '\r') continue
    if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; continue }
    campo += c
  }
  // La ultima fila puede no terminar en salto de linea.
  if (campo !== '' || fila.length > 0) { fila.push(campo); filas.push(fila) }

  if (filas.length === 0) return { columnas: [], filas: [] }

  const columnas = filas[0].map(c => c.trim())
  const datos = filas.slice(1)
    // Una fila vacia al final es normal y no es un registro.
    .filter(f => f.some(c => c.trim() !== ''))
    .map(f => {
      const o: Record<string, string> = {}
      columnas.forEach((col, i) => { o[col] = (f[i] ?? '').trim() })
      return o
    })

  return { columnas, filas: datos }
}
