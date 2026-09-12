// EL LEGAJO INSTITUCIONAL: estatuto, acta, reglamento, matrícula, poderes.
//
// Vive en la pestaña «La entidad» y no en «Documentos» a propósito.
// «Documentos» pide `ver_plata`, y el estatuto lo tiene que poder leer el
// director médico, que no ve la plata. Ver el encabezado de
// `lib/documentosInstitucionales.ts` para el resto del motivo.
//
// Los archivos van al bucket PRIVADO `documentos`, bajo `institucional/`: en
// la base se guarda el path y se pide una URL firmada para abrirlos.

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Landmark, Plus, Pencil, Trash2, Upload, Paperclip, ExternalLink, X,
  Loader2, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import {
  legajoService, TIPOS_LEGAJO, faltantes, vigenteDe,
  type PapelInstitucional, type TipoLegajo,
} from '../../lib/legajoInstitucional'
import { urlFirmada } from '../../lib/archivos'
import type { Entidad } from '../../lib/ong'
import {
  btnPrimario, btnSutil, tarjeta, etiquetaCampo, inputFormulario,
  sinAutocorreccion,
} from '../../lib/ui'
import { useDialogo } from '../../lib/useDialogo'
import { confirmarBorrado } from '../../lib/confirmar'

export function LegajoInstitucional({ docs, entidad = null, onCambio }: {
  docs: PapelInstitucional[]
  /** Sólo para mostrar de quién es el papel cuando no se aclaró otra cosa. */
  entidad?: Entidad | null
  onCambio: () => void
}) {
  const [form, setForm] = useState<Partial<PapelInstitucional> | null>(null)
  const falta = useMemo(() => faltantes(docs), [docs])
  const estatuto = useMemo(() => vigenteDe(docs, 'Estatuto'), [docs])

  const borrar = async (d: PapelInstitucional) => {
    if (!await confirmarBorrado(`${d.tipo}: ${d.titulo}`)) return
    try { await legajoService.borrar(d); toast.success('Borrado'); onCambio() }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="space-y-3">
      <div className={tarjeta}>
        <div className="flex items-start gap-2">
          <Landmark className="w-4 h-4 text-[#a3e635] flex-shrink-0 mt-0.5" strokeWidth={1.8} />
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold text-[13px] text-[#ececf1]">
              Papeles de la entidad
            </h3>
            <p className="text-[11px] text-[#8a8a9c] mt-1">
              El estatuto, el acta constitutiva y todo lo que constituye a la persona
              jurídica. No son comprobantes de gasto ni documentos emitidos: van acá y
              los ve cualquiera con perfil, incluido quien no ve la plata.
            </p>
          </div>
          <button onClick={() => setForm({ fecha: null })}
            className={`${btnPrimario} flex-shrink-0`}>
            <Plus className="w-3.5 h-3.5" /> Cargar
          </button>
        </div>

        {falta.length > 0 ? (
          <p className="flex items-start gap-1.5 text-[11px] text-[#f59e0b] mt-3 pt-3 border-t border-[#1f1f2b]">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" strokeWidth={1.8} />
            <span>Falta cargar: <b>{falta.join(' y ')}</b>. Es lo primero que pide
              cualquier organismo, y sin el estatuto los documentos que emite la app
              no tienen de dónde citar los artículos.</span>
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] text-[#bef264] mt-3 pt-3 border-t border-[#1f1f2b]">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
            Estatuto y acta constitutiva cargados.
          </p>
        )}

        {/* Cuando el papel es de OTRA persona jurídica hay que decirlo acá y no
            en la ficha: es la confusión que el legajo existe para evitar. */}
        {estatuto?.persona_juridica
          && estatuto.persona_juridica !== (entidad?.razon_social ?? '') && (
          <p className="text-[11px] text-[#a6a6b5] mt-2">
            El estatuto vigente es de <b className="text-[#ececf1]">{estatuto.persona_juridica}</b>,
            que no es la entidad cargada en esta instalación. Los documentos que la app
            emite siguen citando a la entidad de arriba.
          </p>
        )}
      </div>

      {docs.length === 0 ? (
        <p className="text-[13px] text-[#8a8a9c] text-center py-8">
          Todavía no cargaste ningún papel institucional.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {docs.map(d => (
            <FichaDelLegajo key={d.id} d={d}
              onEditar={() => setForm(d)} onBorrar={() => borrar(d)} />
          ))}
        </div>
      )}

      {form && <FormDelLegajo form={form} setForm={setForm} onCambio={onCambio} />}
    </div>
  )
}

function FichaDelLegajo({ d, onEditar, onBorrar }: {
  d: PapelInstitucional; onEditar: () => void; onBorrar: () => void
}) {
  const [abriendo, setAbriendo] = useState(false)

  const abrir = async () => {
    if (!d.archivo_path) return
    setAbriendo(true)
    try { window.open(await urlFirmada('documentos', d.archivo_path), '_blank', 'noopener') }
    catch (e) { toast.error(`No se pudo abrir: ${(e as Error).message}`) }
    finally { setAbriendo(false) }
  }

  return (
    <div className={tarjeta}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-[13px] text-[#ececf1] truncate">{d.titulo}</p>
          <p className="text-[10px] text-[#8a8a9c] mt-0.5 truncate">
            {[d.tipo, d.numero, d.fecha].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEditar} className={btnSutil} aria-label="Editar"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onBorrar} className={btnSutil} aria-label="Borrar"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${d.vigente
          ? 'bg-[#a3e635]/15 text-[#bef264]' : 'bg-[#1f1f2b] text-[#8a8a9c]'}`}>
          {d.vigente ? 'Vigente' : 'Reemplazado'}
        </span>
        {d.persona_juridica && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f2b] text-[#a6a6b5] truncate max-w-full">
            {d.persona_juridica}
          </span>
        )}
      </div>

      {d.notas && <p className="text-[11px] text-[#8a8a9c] mt-2">{d.notas}</p>}

      <div className="mt-2 pt-2 border-t border-[#1f1f2b]">
        {d.archivo_path ? (
          <button onClick={abrir} disabled={abriendo}
            className="flex items-center gap-1.5 text-[11px] text-[#38bdf8] hover:underline py-2 min-h-[44px] sm:min-h-0">
            {abriendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
            <span className="truncate max-w-[220px]">{d.archivo_nombre || 'Ver archivo'}</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </button>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] text-[#f59e0b] py-1">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
            Sin archivo adjunto: es una anotación, no el papel.
          </p>
        )}
      </div>
    </div>
  )
}

function FormDelLegajo({ form, setForm, onCambio }: {
  form: Partial<PapelInstitucional>
  setForm: (f: Partial<PapelInstitucional> | null) => void
  onCambio: () => void
}) {
  const refDialogo = useDialogo(() => setForm(null))
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const subir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    try {
      const { path, nombre } = await legajoService.subirArchivo(file)
      // El título se rellena con el nombre del archivo sólo si está vacío: es
      // mejor que un campo obligatorio en blanco, y no pisa lo que ya escribió.
      setForm({
        ...form, archivo_path: path, archivo_nombre: nombre,
        titulo: form.titulo || nombre.replace(/\.[^.]+$/, ''),
      })
    } catch (err) { toast.error((err as Error).message) }
    finally { setSubiendo(false); e.target.value = '' }
  }

  const guardar = async () => {
    if (!form.tipo) { toast.error('Elegí qué papel es'); return }
    if (!form.titulo?.trim()) { toast.error('Falta el título'); return }
    setGuardando(true)
    try {
      await legajoService.guardar({
        ...form, tipo: form.tipo, titulo: form.titulo.trim(),
      })
      toast.success('Guardado')
      setForm(null); onCambio()
    } catch (e) { toast.error((e as Error).message) }
    finally { setGuardando(false) }
  }

  return (
    <div ref={refDialogo} className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[#0d0d12] border border-[#1f1f2b] rounded-t-2xl sm:rounded-2xl">
        <div className="px-4 py-3 border-t-0 border-b border-[#1f1f2b] flex items-center gap-2 sticky top-0 bg-[#0d0d12] z-10">
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1] flex-1">
            {form.id ? 'Editar papel' : 'Cargar papel institucional'}
          </h3>
          <button onClick={() => setForm(null)} aria-label="Cerrar" className={btnSutil}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <label><span className={etiquetaCampo}>Qué papel es</span>
            <select className={inputFormulario} value={form.tipo ?? ''}
              onChange={e => setForm({ ...form, tipo: (e.target.value || undefined) as TipoLegajo })}>
              <option value="">Elegí…</option>
              {TIPOS_LEGAJO.map(t => <option key={t} value={t}>{t}</option>)}
            </select></label>

          <label><span className={etiquetaCampo}>Título</span>
            <input className={inputFormulario} value={form.titulo ?? ''} {...sinAutocorreccion}
              onChange={e => setForm({ ...form, titulo: e.target.value })} /></label>

          <div className="grid grid-cols-2 gap-3">
            <label><span className={etiquetaCampo}>Número</span>
              <input className={inputFormulario} value={form.numero ?? ''} {...sinAutocorreccion}
                onChange={e => setForm({ ...form, numero: e.target.value || null })} /></label>
            <label><span className={etiquetaCampo}>Fecha</span>
              <input type="date" className={inputFormulario} value={form.fecha ?? ''}
                onChange={e => setForm({ ...form, fecha: e.target.value || null })} /></label>
          </div>
          <p className="text-[10px] text-[#8a8a9c] -mt-1">
            El número va tal como lo emitió el organismo, con letras y todo.
            La fecha es la del acto, no la de hoy.
          </p>

          <label><span className={etiquetaCampo}>De qué persona jurídica</span>
            <input className={inputFormulario} value={form.persona_juridica ?? ''} {...sinAutocorreccion}
              placeholder="Vacío = la entidad de esta instalación"
              onChange={e => setForm({ ...form, persona_juridica: e.target.value || null })} /></label>
          <p className="text-[10px] text-[#8a8a9c] -mt-1">
            Completalo sólo si el papel es de otra entidad — por ejemplo el estatuto de
            una cooperativa distinta de la asociación que opera acá.
          </p>

          {/* `vigente` es del PAPEL, no de la entidad: una entidad parada puede
              tener su estatuto vigente. Ver el test que lo fija. */}
          <label className="flex items-center gap-2 min-h-[44px]">
            <input type="checkbox" className="w-4 h-4 accent-[#a3e635]"
              checked={form.vigente ?? true}
              onChange={e => setForm({ ...form, vigente: e.target.checked })} />
            <span className="text-[12px] text-[#d4d4dd]">Vigente</span>
          </label>
          <p className="text-[10px] text-[#8a8a9c] -mt-2">
            Destildalo sólo si otro papel lo reemplazó. Que la entidad no esté operando
            no apaga su estatuto.
          </p>

          <label><span className={etiquetaCampo}>Notas</span>
            <input className={inputFormulario} value={form.notas ?? ''}
              onChange={e => setForm({ ...form, notas: e.target.value || null })} /></label>

          <div className="rounded-lg bg-[#101016] border border-[#1f1f2b] p-3">
            <span className={etiquetaCampo}>Archivo</span>
            {form.archivo_path ? (
              <div className="flex items-center gap-2">
                <Paperclip className="w-3.5 h-3.5 text-[#38bdf8] flex-shrink-0" />
                <span className="text-[12px] text-[#d4d4dd] truncate flex-1">{form.archivo_nombre}</span>
                <button onClick={() => setForm({ ...form, archivo_path: null, archivo_nombre: null })}
                  className={btnSutil} aria-label="Quitar archivo"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#2a2a3a] py-3 min-h-[44px] cursor-pointer text-[12px] text-[#7dd3fc] hover:border-[#404d20]">
                {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {subiendo ? 'Subiendo…' : 'Subir PDF o foto'}
                <input type="file" className="hidden" accept="image/*,application/pdf"
                  onChange={subir} disabled={subiendo} />
              </label>
            )}
            <p className="text-[10px] text-[#8a8a9c] mt-2">
              Va a un bucket privado: sólo se ve con sesión iniciada y el enlace caduca.
            </p>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[#1f1f2b] flex gap-2 sticky bottom-0 bg-[#0d0d12]">
          <button onClick={() => setForm(null)} className={btnSutil}>Cancelar</button>
          <button onClick={guardar} disabled={guardando || subiendo} className={`${btnPrimario} flex-1`}>
            {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
