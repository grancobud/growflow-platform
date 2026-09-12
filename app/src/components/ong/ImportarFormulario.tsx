// Importar las respuestas del formulario de alta a la tabla de pacientes.
//
// Sin esto, cada alta se retipea a mano desde la planilla del formulario. Los
// campos son casi los mismos, asi que el trabajo es puro copiado.
//
// La pieza importante es el MAPEO. Un formulario de Google tiene por columnas
// las preguntas ("¿Cual es tu nombre completo?"), no los nombres de la base, y
// esas preguntas cambian con el tiempo. Por eso no se asume ningun encabezado:
// se leen las columnas del archivo y se elige cual alimenta cada campo. El
// sistema propone un mapeo por parecido y la persona lo corrige.
//
// Se importa como PACIENTE, no como asociado (`socio: false`): son dos cosas
// distintas y el alta de socio la aprueba una asamblea, no un archivo.

import { useState, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { Upload, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'
import { parsearCSV } from '../../lib/csv'
import { supabase } from '../../lib/supabase'
import { numeroDeReprocann, documento } from '../../lib/datosDelFormulario'

/** Campos de `pacientes` que puede traer el formulario. */
const CAMPOS: { campo: string; label: string; pistas: string[]; obligatorio?: boolean }[] = [
  { campo: 'nombre_completo', label: 'Nombre completo', pistas: ['nombre', 'apellido'], obligatorio: true },
  { campo: 'dni', label: 'DNI', pistas: ['dni', 'documento'] },
  { campo: 'fecha_nacimiento', label: 'Fecha de nacimiento', pistas: ['nacimiento', 'nacio', 'edad'] },
  { campo: 'telefono', label: 'Teléfono', pistas: ['telefono', 'tel', 'celular', 'whatsapp'] },
  { campo: 'email', label: 'Email', pistas: ['mail', 'correo'] },
  { campo: 'domicilio', label: 'Domicilio', pistas: ['domicilio', 'direccion', 'calle'] },
  { campo: 'localidad', label: 'Localidad', pistas: ['localidad', 'ciudad', 'partido'] },
  { campo: 'provincia', label: 'Provincia', pistas: ['provincia'] },
  { campo: 'patologia', label: 'Patología', pistas: ['patologia', 'diagnostico', 'condicion'] },
  { campo: 'medico_tratante', label: 'Médico tratante', pistas: ['medico', 'doctor', 'profesional'] },
  { campo: 'matricula_medico', label: 'Matrícula del médico', pistas: ['matricula'] },
  { campo: 'reprocann_nro', label: 'N° de REPROCANN', pistas: ['reprocann', 'repro'] },
  { campo: 'reprocann_vencimiento', label: 'Vencimiento del REPROCANN', pistas: ['vencimiento', 'vence'] },
  { campo: 'notas', label: 'Notas', pistas: ['observacion', 'comentario', 'nota'] },
]

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Propone que columna alimenta cada campo, por parecido con las pistas. */
function adivinar(columnas: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  const usadas = new Set<string>()
  for (const c of CAMPOS) {
    const hit = columnas.find(col => {
      if (usadas.has(col)) return false
      const n = norm(col)
      return c.pistas.some(p => n.includes(p))
    })
    if (hit) { out[c.campo] = hit; usadas.add(hit) }
  }
  return out
}

/** Fecha en formato argentino o ISO -> ISO, o null si no se entiende. */
function aFecha(v: string): string | null {
  const s = (v || '').trim()
  if (!s) return null
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const ar = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (ar) return `${ar[3]}-${ar[2].padStart(2, '0')}-${ar[1].padStart(2, '0')}`
  return null
}

const inputCls = 'w-full bg-[#15151d] border border-[#2a2a3a] rounded-lg px-2.5 py-2 ' +
  'min-h-[44px] sm:min-h-0 text-[16px] sm:text-[12px] text-[#ececf1] focus:outline-none focus:border-[#a3e635]/50'

export function ImportarFormulario({ onImportado }: { onImportado: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [tabla, setTabla] = useState<{ columnas: string[]; filas: Record<string, string>[] } | null>(null)
  const [mapa, setMapa] = useState<Record<string, string>>({})
  const [importando, setImportando] = useState(false)
  const [dnisExistentes, setDnis] = useState<Set<string>>(new Set())

  const leer = async (f: File) => {
    try {
      const t = await f.text()
      const p = parsearCSV(t)
      if (p.filas.length === 0) { toast.error('El archivo no tiene filas de datos.'); return }
      setTabla(p)
      setMapa(adivinar(p.columnas))
      // Los DNI que ya estan, para no duplicar a nadie.
      const { data } = await supabase.from('pacientes').select('dni')
      setDnis(new Set(((data ?? []) as { dni: string | null }[])
        .map(x => (x.dni || '').trim()).filter(Boolean)))
      toast.success(`${p.filas.length} respuestas leídas`)
    } catch (e) {
      toast.error(`No se pudo leer: ${(e as Error).message}`)
    }
  }

  const colDni = mapa['dni']
  const preparadas = useMemo(() => {
    if (!tabla) return []
    return tabla.filas.map(f => {
      const row: Record<string, unknown> = { socio: false, activo: true }
      const descartados: string[] = []
      for (const c of CAMPOS) {
        const col = mapa[c.campo]
        if (!col) continue
        const v = (f[col] ?? '').trim()
        if (!v) continue
        if (c.campo === 'reprocann_nro') {
          const nro = numeroDeReprocann(v)
          if (nro) row[c.campo] = nro
          else descartados.push(`${c.label}: «${v}»`)
          continue
        }
        if (c.campo === 'dni') {
          const doc = documento(v)
          if (doc) row[c.campo] = doc
          else descartados.push(`${c.label}: «${v}»`)
          continue
        }
        row[c.campo] = c.campo.startsWith('fecha_') || c.campo.endsWith('_vencimiento')
          ? aFecha(v)
          : v
      }
      const dni = colDni ? (f[colDni] ?? '').trim() : ''
      // Lo descartado se anota en la ficha en vez de perderse: si la persona
      // escribio algo, alguien tiene que poder ver que escribio y preguntarle.
      if (descartados.length) {
        row.notas = [row.notas, 'Del formulario, sin cargar por no ser un dato valido: '
          + descartados.join('; ') + '. Hay que pedirselo a la persona.']
          .filter(Boolean).join('\n\n')
      }
      return {
        row,
        dni,
        duplicado: !!dni && dnisExistentes.has(dni),
        sinNombre: !row.nombre_completo,
        descartados: descartados.length,
      }
    })
  }, [tabla, mapa, dnisExistentes, colDni])

  const aImportar = preparadas.filter(p => !p.duplicado && !p.sinNombre)
  const duplicados = preparadas.filter(p => p.duplicado).length
  const sinNombre = preparadas.filter(p => p.sinNombre).length
  const conDescartes = preparadas.filter(p => !p.duplicado && !p.sinNombre && p.descartados > 0).length

  const importar = async () => {
    if (aImportar.length === 0) { toast.error('No hay filas para importar.'); return }
    setImportando(true)
    try {
      const { error } = await supabase.from('pacientes').insert(aImportar.map(p => p.row))
      if (error) throw new Error(error.message)
      toast.success(`${aImportar.length} paciente${aImportar.length === 1 ? '' : 's'} importado${aImportar.length === 1 ? '' : 's'}`)
      setTabla(null); setMapa({})
      if (fileRef.current) fileRef.current.value = ''
      onImportado()
    } catch (e) {
      toast.error(`No se pudo importar: ${(e as Error).message}`)
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[#8a8a9c] leading-snug">
        En la planilla de respuestas del formulario: <b className="text-[#a6a6b5]">Archivo →
        Descargar → CSV</b>, y subí ese archivo acá. Después elegís qué columna
        alimenta cada campo; el sistema propone un mapeo y vos lo corregís.
      </p>

      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) leer(f) }} />
      <button onClick={() => fileRef.current?.click()}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:bg-[#1c1c27] transition-colors text-[12px] text-[#a6a6b5]">
        <Upload className="w-4 h-4" /> Elegir el CSV
      </button>

      {tabla && (
        <>
          <div className="rounded-xl border border-[#1f1f2b] bg-[#0d0d12] p-3">
            <div className="text-[11px] font-medium text-[#a6a6b5] mb-2">
              Qué columna alimenta cada campo
            </div>
            <div className="space-y-1.5">
              {CAMPOS.map(c => (
                <div key={c.campo} className="grid grid-cols-[1fr_auto_1.4fr] items-center gap-2">
                  <span className="text-[11px] text-[#d4d4dd] truncate">
                    {c.label}{c.obligatorio && <span className="text-[#f87171]"> *</span>}
                  </span>
                  <ArrowRight className="w-3 h-3 text-[#4a4a5a]" />
                  <select className={inputCls} value={mapa[c.campo] ?? ''}
                    onChange={e => setMapa(m => ({ ...m, [c.campo]: e.target.value }))}>
                    <option value="">— sin usar —</option>
                    {tabla.columnas.map(col => (
                      <option key={col} value={col}>{col.slice(0, 60)}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#1f1f2b] bg-[#0d0d12] p-3 text-[11px] space-y-1">
            <div className="flex items-center gap-1.5 text-[#a3e635]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {aImportar.length} para importar
            </div>
            {duplicados > 0 && (
              <div className="flex items-center gap-1.5 text-[#facc15]">
                <AlertTriangle className="w-3.5 h-3.5" />
                {duplicados} ya {duplicados === 1 ? 'está' : 'están'} cargado{duplicados === 1 ? '' : 's'} con ese DNI · se saltean
              </div>
            )}
            {sinNombre > 0 && (
              <div className="flex items-center gap-1.5 text-[#f87171]">
                <AlertTriangle className="w-3.5 h-3.5" />
                {sinNombre} sin nombre · se saltean. Revisá el mapeo del campo Nombre.
              </div>
            )}
            {/* La fila SI entra: lo que se descarta es un campo suelto que no
                era un dato. Decirlo acá evita la sorpresa de importar y después
                encontrar fichas sin número que en el CSV parecían tenerlo. */}
            {conDescartes > 0 && (
              <div className="flex items-start gap-1.5 text-[#facc15]">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                <span>
                  {conDescartes} fila{conDescartes === 1 ? '' : 's'} trae{conDescartes === 1 ? '' : 'n'} un
                  N° de REPROCANN o un DNI que no es un dato (por ejemplo la opción del
                  desplegable, o ceros). Se importan igual, sin ese campo, y queda anotado
                  en las notas de la ficha para poder pedírselo a la persona.
                </span>
              </div>
            )}
            {aImportar[0] && (
              <div className="mt-2 pt-2 border-t border-[#1f1f2b] text-[10px] text-[#8a8a9c]">
                Primera fila: <span className="text-[#a6a6b5]">
                  {[aImportar[0].row.nombre_completo, aImportar[0].row.dni, aImportar[0].row.email]
                    .filter(Boolean).join(' · ')}
                </span>
              </div>
            )}
          </div>

          <button onClick={importar} disabled={importando || aImportar.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 disabled:opacity-40 transition-colors text-[13px] font-medium text-[#d9f99d]">
            {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Importar {aImportar.length > 0 ? aImportar.length : ''}
          </button>

          <p className="text-[10px] text-[#8a8a9c] leading-snug">
            Entran como <b>pacientes</b>, no como asociados: son dos cosas distintas y el
            alta de socio la aprueba una asamblea. Después de importar, revisá cada ficha
            y completá el tope mensual en gramos, que es lo que habilita el control de cupo.
          </p>
        </>
      )}
    </div>
  )
}
