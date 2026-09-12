// EL PLAN DE CULTIVO, QUE ES LO QUE SE DECLARA.
//
// Socio lo pidió el 02/09/2026 y describió hasta cómo quería cargarlo: «que
// ahí en la aplicación me vaya preguntando cantidad de plantas 60, genéticas
// tac tac, sistema de riego manual, plan de fertilización tal fertilizante,
// luces tac». Eso es este formulario, en ese orden.
//
// LO QUE ESTA PANTALLA NO HACE, Y ES A PROPÓSITO: no crea las plantas. Generar
// sesenta desde el plan es cómodo el primer día y a los dos meses el plan es
// ficción — murieron tres, se repusieron dos, y nadie vuelve a mirarlo. El plan
// es la declaración, las plantas son la realidad, y arriba se muestra el desvío
// entre las dos. Un plan que se edita para que cierre deja de ser una
// declaración.

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { ClipboardList, Plus, AlertTriangle, Check } from 'lucide-react'
import { planService, planVigente, desvioDePlantas, type PlanCultivo } from '../lib/planCultivo'
import { cultivoService } from '../lib/cultivo'
import { useAuth } from '../hooks/useAuth'
import {
  btnPrimario, btnSutil, etiquetaCampo, inputFormulario, rotuloSeccion,
  tarjeta, tituloSeccion, sinAutocorreccion,
} from '../lib/ui'
import { useDialogo } from '../lib/useDialogo'

type Form = {
  nombre: string; desde: string; hasta: string
  plantas_previstas: string; pacientes_previstos: string
  geneticas: string; espacios: string; riego: string
  fertilizacion: string; luces: string; notas: string
}

const vacio: Form = {
  nombre: '', desde: '', hasta: '', plantas_previstas: '', pacientes_previstos: '',
  geneticas: '', espacios: '', riego: '', fertilizacion: '', luces: '', notas: '',
}

const desdePlan = (p: PlanCultivo): Form => ({
  nombre: p.nombre, desde: p.desde ?? '', hasta: p.hasta ?? '',
  plantas_previstas: p.plantas_previstas?.toString() ?? '',
  pacientes_previstos: p.pacientes_previstos?.toString() ?? '',
  geneticas: p.geneticas ?? '', espacios: p.espacios ?? '', riego: p.riego ?? '',
  fertilizacion: p.fertilizacion ?? '', luces: p.luces ?? '', notas: p.notas ?? '',
})

const entero = (s: string): number | null => {
  const t = s.trim()
  if (!t) return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

export default function PaginaPlanCultivo() {
  const { tienePermiso } = useAuth()
  const [planes, setPlanes] = useState<PlanCultivo[]>([])
  const [plantasVivas, setPlantasVivas] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<PlanCultivo | null | 'nuevo'>(null)

  const puedeEditar = tienePermiso('editar_cultivo')

  const cargar = useCallback(async () => {
    try {
      const [ps, plantas] = await Promise.all([
        planService.listar(),
        cultivoService.getResumenPlantas(true).catch(() => []),
      ])
      setPlanes(ps)
      setPlantasVivas(plantas.length)
    } catch (e) {
      toast.error(`No se pudo cargar el plan: ${(e as Error).message}`)
    } finally { setCargando(false) }
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const vigente = planVigente(planes)
  const desvio = desvioDePlantas(vigente, plantasVivas)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#0a0a0f] text-[#d4d4dd] font-sans">
      <div className="sticky top-0 z-40 bg-[#0a0a0f] border-b border-[#1f1f2b]">
        <div className="flex items-center gap-2 px-3 sm:px-6 py-3">
          <div className="min-w-0">
            <h1 className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] text-[#ececf1]">Plan de cultivo</h1>
            <div className="mt-0.5 text-[11px] text-[#8a8a9c]">Lo que se declara en REPROCANN</div>
          </div>
          <div className="flex-1" />
          {puedeEditar && (
            <button onClick={() => setEditando('nuevo')} className={btnPrimario}>
              <Plus className="w-3.5 h-3.5" /> <span>Plan</span>
            </button>
          )}
        </div>
      </div>

      <div className="px-3 sm:px-6 py-4 pb-20 max-w-3xl mx-auto space-y-4">
        {cargando ? (
          <div className="h-40 rounded-xl bg-[#101016] border border-[#1f1f2b] animate-pulse" />
        ) : !vigente ? (
          <div className="py-16 text-center">
            <div className="mx-auto w-11 h-11 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-3">
              <ClipboardList className="w-5 h-5 text-[#8a8a9c]" />
            </div>
            <div className="font-display font-semibold text-[#d4d4dd] text-[14px]">Todavía no hay un plan cargado</div>
            <p className="mt-1 text-[11.5px] text-[#8a8a9c] max-w-sm mx-auto [text-wrap:pretty]">
              Es el que se declara en REPROCANN: cuántas plantas, qué genéticas, en qué espacios.
              Con él cargado, el sistema puede avisar cuando lo que hay en la sala se separa de lo declarado.
            </p>
          </div>
        ) : (
          <>
            {/* EL DESVÍO ARRIBA DE TODO. Es lo único que el plan aporta y que no
                aporta el documento en un PDF: saber, hoy, si lo declarado y lo
                que hay siguen siendo lo mismo. */}
            <div className={`${tarjeta} p-4`}>
              <span className={rotuloSeccion}>Declarado contra lo que hay</span>
              <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                <span className="font-display font-bold text-[26px] text-[#ececf1] tabular-nums leading-none">
                  {desvio.reales}
                </span>
                <span className="text-[12px] text-[#a6a6b5]">
                  plantas en la sala
                  {desvio.previstas != null && <> · {desvio.previstas} declaradas</>}
                </span>
              </div>
              {desvio.diferencia == null ? (
                <p className="mt-2 text-[11.5px] text-[#8a8a9c] [text-wrap:pretty]">
                  El plan no declara cuántas plantas, así que no hay contra qué comparar.
                </p>
              ) : desvio.diferencia === 0 ? (
                <p className="mt-2 text-[11.5px] text-[#bef264] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" strokeWidth={2.2} /> Coincide con lo declarado.
                </p>
              ) : (
                <p className="mt-2 text-[11.5px] text-[#f59e0b] flex items-start gap-1.5 [text-wrap:pretty]">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                  {desvio.diferencia > 0
                    ? `Hay ${desvio.diferencia} más de las declaradas. Si es a propósito, el plan hay que actualizarlo y volver a declararlo.`
                    : `Hay ${Math.abs(desvio.diferencia)} menos de las declaradas. No es un problema en sí: puede ser bajas del ciclo.`}
                </p>
              )}
            </div>

            <div className={`${tarjeta} p-4`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className={tituloSeccion}>{vigente.nombre}</h2>
                  <p className="text-[11px] text-[#8a8a9c] mt-0.5">
                    {vigente.desde ? `Desde ${vigente.desde}` : 'Sin fecha de inicio'}
                    {vigente.hasta ? ` · hasta ${vigente.hasta}` : ''}
                  </p>
                </div>
                {puedeEditar && (
                  <button onClick={() => setEditando(vigente)} className={btnSutil}>Editar</button>
                )}
              </div>
              <dl className="mt-3 space-y-2.5">
                {([
                  ['Pacientes previstos', vigente.pacientes_previstos?.toString()],
                  ['Genéticas', vigente.geneticas],
                  ['Espacios', vigente.espacios],
                  ['Riego', vigente.riego],
                  ['Fertilización', vigente.fertilizacion],
                  ['Luces', vigente.luces],
                  ['Notas', vigente.notas],
                ] as [string, string | null | undefined][])
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className={rotuloSeccion}>{k}</dt>
                      <dd className="text-[12px] text-[#d4d4dd] mt-0.5 [text-wrap:pretty]">{v}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </>
        )}
      </div>

      {editando && (
        <ModalPlan plan={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); cargar() }} />
      )}
    </div>
  )
}

function ModalPlan({ plan, onCerrar, onGuardado }: {
  plan: PlanCultivo | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const refDialogo = useDialogo(onCerrar)
  const [f, setF] = useState<Form>(plan ? desdePlan(plan) : vacio)
  const [guardando, setGuardando] = useState(false)
  const set = (k: keyof Form) => (v: string) => setF(x => ({ ...x, [k]: v }))

  const guardar = async () => {
    if (!f.nombre.trim()) { toast.error('Poné un nombre al plan'); return }
    setGuardando(true)
    try {
      await planService.guardar({
        id: plan?.id,
        nombre: f.nombre.trim(),
        desde: f.desde || null,
        hasta: f.hasta || null,
        plantas_previstas: entero(f.plantas_previstas),
        pacientes_previstos: entero(f.pacientes_previstos),
        geneticas: f.geneticas.trim() || null,
        espacios: f.espacios.trim() || null,
        riego: f.riego.trim() || null,
        fertilizacion: f.fertilizacion.trim() || null,
        luces: f.luces.trim() || null,
        notas: f.notas.trim() || null,
      })
      toast.success(plan ? 'Plan actualizado' : 'Plan cargado')
      onGuardado()
    } catch (e) {
      toast.error(`No se pudo guardar: ${(e as Error).message}`)
    } finally { setGuardando(false) }
  }

  /* EL ORDEN ES EL QUE DICTÓ CRISTIAN: «cantidad de plantas 60, genéticas tac
     tac, sistema de riego manual, plan de fertilización tal fertilizante,
     luces». Se carga en el orden en que se piensa un cultivo, no en el orden en
     que quedan lindas las columnas. */
  const campos: [keyof Form, string, string][] = [
    ['plantas_previstas', 'Cuántas plantas', 'Ej: 60'],
    ['pacientes_previstos', 'Para cuántos pacientes', 'Ej: 150'],
    ['geneticas', 'Qué genéticas', 'Ej: 60 Avocado Punch Auto, 15 Ultra'],
    ['espacios', 'En qué espacios', 'Ej: cama de 3 × 1 m y carpa de 1 × 1 m'],
    ['riego', 'Sistema de riego', 'Ej: manual'],
    ['fertilizacion', 'Plan de fertilización', 'Qué se usa y cada cuánto'],
    ['luces', 'Iluminación', 'Ej: 12 LED de 400 W'],
  ]

  return (
    <div ref={refDialogo}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onCerrar}>
      <div className="bg-[#0d0d12] border border-[#1f1f2b] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[#1f1f2b] sticky top-0 bg-[#0d0d12] flex items-center gap-2">
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">
            {plan ? 'Editar el plan' : 'Nuevo plan de cultivo'}
          </h3>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="ml-auto min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-[#8a8a9c] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className={etiquetaCampo} htmlFor="plan-nombre">Nombre del plan</label>
            <input id="plan-nombre" className={inputFormulario} value={f.nombre}
              onChange={e => set('nombre')(e.target.value)} placeholder="Ej: Ciclo primavera 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={etiquetaCampo} htmlFor="plan-desde">Desde</label>
              <input id="plan-desde" type="date" className={inputFormulario} value={f.desde}
                onChange={e => set('desde')(e.target.value)} />
            </div>
            <div>
              <label className={etiquetaCampo} htmlFor="plan-hasta">Hasta</label>
              <input id="plan-hasta" type="date" className={inputFormulario} value={f.hasta}
                onChange={e => set('hasta')(e.target.value)} />
            </div>
          </div>

          {campos.map(([k, rotulo, ph]) => (
            <div key={k}>
              <label className={etiquetaCampo} htmlFor={`plan-${k}`}>{rotulo}</label>
              <input id={`plan-${k}`} className={inputFormulario} {...sinAutocorreccion}
                inputMode={k.includes('previst') ? 'numeric' : undefined}
                value={f[k]} onChange={e => set(k)(e.target.value)} placeholder={ph} />
            </div>
          ))}

          <div>
            <label className={etiquetaCampo} htmlFor="plan-notas">Notas</label>
            <input id="plan-notas" className={inputFormulario} value={f.notas}
              onChange={e => set('notas')(e.target.value)} placeholder="Lo que no entre en los campos de arriba" />
          </div>

          <p className="text-[10.5px] text-[#8a8a9c] [text-wrap:pretty]">
            Cargar el plan no crea las plantas. El plan es lo que se declara; las plantas se
            cargan como siempre, y arriba se ve si las dos cosas siguen coincidiendo.
          </p>
        </div>

        <div className="px-4 py-3 border-t border-[#1f1f2b] flex gap-2 sticky bottom-0 bg-[#0d0d12]">
          <button onClick={onCerrar} className={btnSutil}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className={`${btnPrimario} flex-1`}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
