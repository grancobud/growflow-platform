// Checklist de puesta en marcha, leído del estado real del sistema.
//
// El capítulo 01 del manual enumera lo que hay que cargar una sola vez. Como
// texto fijo obliga a ir pantalla por pantalla a ver qué falta; el sistema ya
// sabe la respuesta, así que la muestra.
//
// Se usa en dos lados. En el manual, escribiendo {{PUESTA_EN_MARCHA}} en una
// línea. Y en O.N.G. › Estado, que es la pantalla de entrada: acá vivía sólo en
// el manual, o sea en el único lugar al que no entra quien recién empieza.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Circle, Loader2, ArrowUpRight } from 'lucide-react'
import { ongService } from '../../lib/ong'
import type { Entidad, Autoridad, Predio } from '../../lib/ong'
import { cultivoService } from '../../lib/cultivo'
import { econometriaService } from '../../lib/econometria'

interface Paso {
  que: string
  ruta: string
  listo: boolean
  detalle: string
}

export function PuestaEnMarcha({
  titulo = 'Cómo vas con esto',
  bajada = 'Leído de lo que hay cargado ahora mismo.',
  ocultarSiCompleto = false,
  datos,
}: {
  titulo?: string
  bajada?: string
  /**
   * Los seis datos que este checklist mira, si quien lo monta YA LOS TIENE.
   *
   * ⚠️ SIN ESTO, SEIS CONSULTAS REPETIDAS. Este componente vive en dos lados:
   * en el manual, donde nadie tiene nada cargado y tiene que traérselo solo, y
   * adentro de O.N.G. › Estado, donde `PaginaONG` ya trajo LAS SEIS COSAS en su
   * ola de carga. Medido en producción el 04/09/2026: `ong_entidad`,
   * `ong_autoridades`, `ong_predios`, `geneticas`, `costos` y `ong_libros`
   * volvían a salir a los 2.900 ms, casi un segundo después de que las mismas
   * filas ya hubieran llegado.
   *
   * Se pasan por prop y no por un contexto ni una caché: son datos que el padre
   * tiene en la mano, y pedírselos es una línea. Cuando no vienen —el manual—
   * el componente se los trae, que es como funcionaba siempre.
   */
  datos?: {
    entidad: Entidad | null
    autoridades: Autoridad[]
    predios: Predio[]
    geneticas: { id: string }[]
    costos: { id: string }[]
    libros: { rubricado?: boolean | null }[]
  }
  /**
   * Desaparecer cuando ya no falta nada.
   *
   * En el manual conviene que quede siempre: es documentación, y ver los seis
   * pasos en verde confirma que se leyó bien. En Estado no: ahí es una guía de
   * arranque, y una guía que sigue ocupando la mitad de la pantalla de entrada
   * meses después de terminada es ruido permanente.
   */
  ocultarSiCompleto?: boolean
} = {}) {
  const [pasos, setPasos] = useState<Paso[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        // Con `datos` puestos NO SE CONSULTA NADA: la ola del padre ya trajo
        // estas seis cosas. `Promise.all` sólo se arma cuando hace falta.
        const [entidad, autoridades, predios, geneticas, costos, libros] = datos
          ? [datos.entidad, datos.autoridades, datos.predios,
             datos.geneticas, datos.costos, datos.libros]
          : await Promise.all([
            ongService.getEntidad(),
            ongService.getAutoridades(),
            ongService.getPredios(),
            cultivoService.getGeneticas(),
            econometriaService.getCostos(),
            ongService.getLibros(),
          ])
        if (!vivo) return

        const activas = autoridades.filter(a => a.activo !== false)
        const rubricados = libros.filter(l => l.rubricado)

        setPasos([
          {
            que: 'Datos de la entidad',
            ruta: '/ong/entidad',
            // El CUIT se pide aparte: sin él, cada documento generado sale con
            // [CUIT] entre corchetes aunque la razón social esté cargada.
            listo: !!entidad?.razon_social && !!entidad?.cuit,
            detalle: !entidad?.razon_social ? 'falta la razón social'
              : !entidad?.cuit ? 'falta el CUIT'
              : entidad.razon_social,
          },
          {
            que: 'Autoridades',
            ruta: '/ong/autoridades',
            listo: activas.length > 0,
            detalle: activas.length ? `${activas.length} en funciones` : 'ninguna cargada',
          },
          {
            que: 'Predios',
            ruta: '/ong/predios',
            listo: predios.length > 0,
            detalle: predios.length ? `${predios.length} declarado${predios.length === 1 ? '' : 's'}` : 'ninguno declarado',
          },
          {
            que: 'Libros rubricados',
            ruta: '/ong/libros',
            listo: rubricados.length > 0,
            detalle: rubricados.length ? `${rubricados.length} rubricado${rubricados.length === 1 ? '' : 's'}` : 'ninguno rubricado',
          },
          {
            que: 'Genéticas',
            ruta: '/geneticas',
            listo: geneticas.length > 0,
            detalle: geneticas.length ? `${geneticas.length} en el banco` : 'el banco está vacío',
          },
          {
            que: 'Costos',
            ruta: '/econometria',
            listo: costos.length > 0,
            detalle: costos.length ? `${costos.length} cargado${costos.length === 1 ? '' : 's'}` : 'sin costos no hay costo por gramo',
          },
        ])
      } catch (e) {
        if (vivo) setError((e as Error).message)
      }
    })()
    return () => { vivo = false }
  }, [datos])

  if (error) {
    return (
      <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 sm:p-4">
        <p className="text-[12px] text-[#8a8a9c]">
          No se pudo leer el estado de la puesta en marcha: {error}
        </p>
      </div>
    )
  }

  if (!pasos) {
    return (
      <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] p-3 sm:p-4 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8a8a9c]" />
        <span className="text-[12px] text-[#8a8a9c]">Viendo qué tenés cargado…</span>
      </div>
    )
  }

  const hechos = pasos.filter(p => p.listo).length
  if (ocultarSiCompleto && hechos === pasos.length) return null

  return (
    <div className="rounded-xl bg-[#101016] border border-[#1f1f2b] overflow-hidden">
      <div className="px-3.5 py-3 border-b border-[#1f1f2b] flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[12px] text-[#ececf1] font-medium">{titulo}</p>
          <p className="text-[11px] text-[#8a8a9c] mt-0.5">{bajada}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 rounded-full bg-[#15151d] overflow-hidden">
            <div className="h-full w-full bg-[#a3e635] origin-left transition-transform"
              style={{ transform: `scaleX(${hechos / pasos.length})` }} />
          </div>
          <span className="font-display font-semibold text-[13px] text-[#d9f99d] tabular-nums">
            {hechos}/{pasos.length}
          </span>
        </div>
      </div>

      <ul className="divide-y divide-[#1f1f2b] list-none m-0 p-0">
        {pasos.map(p => (
          <li key={p.que}>
            <Link to={p.ruta}
              className="flex items-center gap-2.5 px-3.5 py-2.5 min-h-[44px] hover:bg-[#15151d] transition-colors group">
              {p.listo
                ? <Check className="w-4 h-4 text-[#a3e635] flex-shrink-0" strokeWidth={2.4} />
                : <Circle className="w-4 h-4 text-[#6e6e80] flex-shrink-0" strokeWidth={1.8} />}
              <span className="text-[12px] flex-shrink-0"
                style={{ color: p.listo ? '#a6a6b5' : '#ececf1' }}>
                {p.que}
              </span>
              <span className="text-[11px] text-[#8a8a9c] truncate ml-auto text-right">
                {p.detalle}
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#6e6e80] group-hover:text-[#a3e635] flex-shrink-0 transition-colors" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
