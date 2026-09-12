// De quién es el REPROCANN que ampara cada planta.
//
// El cupo del cultivo es la suma de los permisos que aportó cada persona, así
// que la pregunta que hay que poder contestar en una inspección es planta por
// planta: "¿esta de quién es?". Acá se ve el reparto y, sobre todo, las que
// están en floración sin nadie detrás.

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { IdCard, Sprout, AlertTriangle, ChevronDown, UserPlus, Check } from 'lucide-react'
import { cupoReprocann, type CupoPersona } from '../../lib/ong'
import { cultivoService, faseFueDerivada, DIA_FLORA_AUTOMATICA, type ResumenPlanta } from '../../lib/cultivo'
import type { Paciente } from '../../lib/registro'
import { btnSutil, tarjeta } from '../../lib/ui'
import { Kpi } from './Kpi'
import { nombreParaMostrar } from '../../lib/buscarPersonas'

const SIN = '__sin__'

export function CupoReprocann({ pacientes, plantas, onCambio }: {
  pacientes: Paciente[]; plantas: ResumenPlanta[]; onCambio: () => void
}) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const [asignando, setAsignando] = useState<string | null>(null)
  const [verTodas, setVerTodas] = useState(false)
  const r = useMemo(() => cupoReprocann(pacientes, plantas), [pacientes, plantas])
  const activas = plantas.filter(p => p.activa !== false)

  const asignar = async (plantaId: string, pacienteId: string | null) => {
    setAsignando(plantaId)
    try {
      await cultivoService.actualizarPlanta(plantaId, { paciente_id: pacienteId })
      toast.success(pacienteId ? 'Planta imputada' : 'Planta sin imputar')
      onCambio()
    } catch (e) { toast.error((e as Error).message) } finally { setAsignando(null) }
  }

  // Cuantas de las que cuentan en floracion las derivo el sistema por edad.
  //
  // Este KPI es el numero que se declara ante un control, asi que tiene que
  // poder decir de donde sale cada planta. Sin esta linea, alguien que abre la
  // ficha ve «Vegetativo» y el panel «en floracion», y no hay forma de saber
  // cual de los dos miente.
  const derivadas = activas.filter(p => p.fase === 'Floracion' && faseFueDerivada(p)).length

  const huerfanas = activas.filter(p => !p.paciente_id)
  const huerfanasFlor = huerfanas.filter(p => p.fase === 'Floracion')
  const huerfanasResto = huerfanas.filter(p => p.fase !== 'Floracion')

  return (
    <div className="space-y-4">
      <div className={tarjeta}>
        <div className="flex items-center gap-2">
          <IdCard className="w-4 h-4 text-[#38bdf8]" strokeWidth={1.8} />
          <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Cupo por REPROCANN</h3>
        </div>
        <p className="text-[11px] text-[#8a8a9c] mt-2">
          El cultivo no tiene un cupo propio: tiene la suma de los permisos que aportó cada persona.
          Por eso cada planta se imputa al REPROCANN de alguien, y en floración es donde se cuenta.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#1f1f2b] auto-rows-fr">
          <Kpi t="Aportaron REPROCANN" v={String(r.aportantes)} c="#38bdf8" />
          <Kpi t="Cupo en floración" v={String(r.cupoTotal)} c="#a6a6b5" />
          <Kpi t="En floración" v={`${r.enFloracion}`} c={r.cupoTotal > 0 && r.enFloracion > r.cupoTotal ? '#ff8a7a' : '#bef264'} />
          <Kpi t="Sin imputar" v={String(r.sinAsignar)} c={r.sinAsignarEnFloracion > 0 ? '#ff8a7a' : r.sinAsignar > 0 ? '#f59e0b' : '#bef264'} />
        </div>

        {derivadas > 0 && (
          <p className="text-[11px] text-[#8a8a9c] mt-2">
            {derivadas === r.enFloracion ? 'Las ' : ''}{derivadas} de las {r.enFloracion} en floración
            {' '}se cuentan por <span className="text-[#a6a6b5]">edad</span>: son automáticas de más de
            {' '}{DIA_FLORA_AUTOMATICA} días y en su ficha todavía figura la fase anterior.
            {' '}Una automática florece por edad, no por fotoperíodo, así que nadie marca el cambio.
          </p>
        )}
        {r.sinAsignarEnFloracion > 0 && (
          <p className="text-[11px] text-[#ff8a7a] mt-2 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.8} />
            <span>
              {r.sinAsignarEnFloracion} planta{r.sinAsignarEnFloracion === 1 ? '' : 's'} en floración sin REPROCANN
              que la{r.sinAsignarEnFloracion === 1 ? '' : 's'} ampare. Asignalas abajo o pasalas a vegetativo.
            </span>
          </p>
        )}
        {r.aportantes === 0 && (
          <p className="text-[11px] text-[#f59e0b] mt-2">
            Todavía no hay ningún REPROCANN vigente cargado: sin eso el cupo del cultivo es cero.
            Cargalos en Registro de pacientes.
          </p>
        )}
      </div>

      {/* Persona por persona, con sus plantas colgando */}
      {r.personas.map(p => (
        <Persona key={p.pacienteId} p={p} abierto={abierto === p.pacienteId}
          onToggle={() => setAbierto(a => a === p.pacienteId ? null : p.pacienteId)}
          plantas={activas.filter(x => x.paciente_id === p.pacienteId)}
          pacientes={pacientes} asignando={asignando} onAsignar={asignar} />
      ))}

      {huerfanas.length > 0 && (
        <div className={tarjeta}>
          <div className="flex items-center gap-2 flex-wrap">
            <UserPlus className="w-4 h-4 text-[#f59e0b]" strokeWidth={1.8} />
            <h3 className="font-display font-semibold text-[14px] text-[#ececf1]">Sin imputar</h3>
            <span className="text-[12px] font-mono tabular-nums text-[#a6a6b5]">{huerfanas.length}</span>
          </div>
          <p className="text-[11px] text-[#8a8a9c] mt-2">
            Estas plantas no cuelgan del permiso de nadie. En vegetativo no es un problema; en floración sí.
          </p>
          <div className="mt-3 space-y-1.5">
            {/* Las de floración primero: son las únicas que hay que resolver ya. */}
            {huerfanasFlor.map(pl => (
              <FilaPlanta key={pl.id} pl={pl} pacientes={pacientes} asignando={asignando} onAsignar={asignar} />
            ))}
            {huerfanasResto.length > 0 && (verTodas
              ? huerfanasResto.map(pl => (
                <FilaPlanta key={pl.id} pl={pl} pacientes={pacientes} asignando={asignando} onAsignar={asignar} />
              ))
              : (
                <button onClick={() => setVerTodas(true)} className={`${btnSutil} w-full justify-center`}>
                  Ver las {huerfanasResto.length} que no están en floración
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Persona({ p, plantas, pacientes, abierto, onToggle, asignando, onAsignar }: {
  p: CupoPersona; plantas: ResumenPlanta[]; pacientes: Paciente[]
  abierto: boolean; onToggle: () => void
  asignando: string | null; onAsignar: (plantaId: string, pacienteId: string | null) => void
}) {
  const sinPermiso = !p.reprocann || p.vencido
  return (
    <div className={tarjeta}>
      <button onClick={onToggle} className="w-full flex items-center gap-2 text-left min-h-[44px] sm:min-h-0">
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-[13px] text-[#ececf1] truncate">{p.nombre}</p>
          <p className="text-[10px] mt-0.5" style={{ color: sinPermiso ? '#ff8a7a' : '#8a8a9c' }}>
            {p.reprocann
              ? `${p.reprocann}${p.vencido ? ` · vencido el ${p.vencimiento}` : p.vencimiento ? ` · vence ${p.vencimiento}` : ''}`
              : 'Sin REPROCANN cargado: no aporta cupo'}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[14px] font-mono tabular-nums font-bold"
            style={{ color: p.excedida ? '#ff8a7a' : p.enFloracion > 0 ? '#bef264' : '#8a8a9c' }}>
            {p.enFloracion}<span className="text-[11px] text-[#8a8a9c]">/{p.cupo}</span>
          </p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c]">en floración</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#8a8a9c] flex-shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      <div className="mt-2 h-1 rounded-full bg-[#15151d] overflow-hidden">
        <div className="h-full rounded-full transition"
          style={{ width: `${Math.min(100, p.cupo > 0 ? (p.enFloracion / p.cupo) * 100 : 0)}%`,
            background: p.excedida ? '#ff8a7a' : '#a3e635' }} />
      </div>
      {p.excedida && (
        <p className="text-[11px] text-[#ff8a7a] mt-2">
          Tiene {p.enFloracion} en floración contra un cupo de {p.cupo}. Son {p.enFloracion - p.cupo} de más.
        </p>
      )}

      {abierto && (
        <div className="mt-3 pt-3 border-t border-[#1f1f2b] space-y-1.5">
          {plantas.length === 0
            ? <p className="text-[11px] text-[#8a8a9c]">Sin plantas imputadas. Tiene {p.libres} lugares libres.</p>
            : plantas.map(pl => (
              <FilaPlanta key={pl.id} pl={pl} pacientes={pacientes} asignando={asignando} onAsignar={onAsignar} />
            ))}
        </div>
      )}
    </div>
  )
}

function FilaPlanta({ pl, pacientes, asignando, onAsignar }: {
  pl: ResumenPlanta; pacientes: Paciente[]
  asignando: string | null; onAsignar: (plantaId: string, pacienteId: string | null) => void
}) {
  const flor = pl.fase === 'Floracion'
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[#15151d] border border-[#1f1f2b] px-2 sm:px-3 py-2 min-h-[44px]">
      <Sprout className="w-3.5 h-3.5 flex-shrink-0" style={{ color: flor ? '#bef264' : '#8a8a9c' }} strokeWidth={1.8} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-[#ececf1] truncate">{pl.nombre}</p>
        <p className="text-[10px] text-[#8a8a9c] truncate">{[pl.genetica, pl.fase].filter(Boolean).join(' · ')}</p>
      </div>
      {asignando === pl.id
        ? <Check className="w-3.5 h-3.5 text-[#8a8a9c] animate-pulse flex-shrink-0" />
        : (
          <select value={pl.paciente_id ?? SIN}
            onChange={e => onAsignar(pl.id, e.target.value === SIN ? null : e.target.value)}
            aria-label={`REPROCANN que ampara a ${pl.nombre}`}
            className="flex-shrink-0 max-w-[45%] px-2 py-1.5 rounded-lg bg-[#101016] border text-[16px] sm:text-[11px] text-[#d4d4dd] min-h-[44px] sm:min-h-0"
            style={{ borderColor: !pl.paciente_id && flor ? '#ff8a7a' : '#2a2a3a' }}>
            <option value={SIN}>Sin imputar</option>
            {pacientes.filter(p => p.activo !== false).map(p => (
              <option key={p.id} value={p.id}>{nombreParaMostrar(p)}</option>
            ))}
          </select>
        )}
    </div>
  )
}

