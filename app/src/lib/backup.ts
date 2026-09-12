// Backup completo del cultivo: exporta/importa las 4 tablas en un JSON portable.
// Sirve para pasar todo entre instancias (local <-> online) o guardar respaldo.

import { supabase } from './supabase'

export interface ResultadoImport {
  geneticas: number
  plantas: number
  eventos: number
  cosechas: number
}

export async function exportarFull(): Promise<string> {
  const [gen, pla, eve, cos] = await Promise.all([
    supabase.from('geneticas').select('nombre,banco,tipo,thc_estimado,cbd_estimado,tiempo_flora_dias,notas'),
    supabase.from('plantas').select('apodo,fase,slot,ubicacion,sustrato,maceta,activa,fecha_germinacion,notas,genetica_id'),
    supabase.from('eventos').select('tipo,fecha,detalle,foto_url,planta_id'),
    supabase.from('cosechas').select('fecha,peso_seco_g,peso_humedo_g,valoracion,notas_curado,notas_sabor,planta_id'),
  ])
  // Resolver ids -> nombres legibles
  const { data: gids } = await supabase.from('geneticas').select('id,nombre')
  const idNombre = new Map((gids ?? []).map((g: any) => [g.id, g.nombre]))
  const { data: pids } = await supabase.from('plantas').select('id,apodo')
  const idApodo = new Map((pids ?? []).map((p: any) => [p.id, p.apodo]))

  const dump = {
    formato: 'growflow-full-v1',
    exportado: new Date().toISOString(),
    geneticas: gen.data ?? [],
    plantas: (pla.data ?? []).map((p: any) => {
      const { genetica_id, ...rest } = p
      return { ...rest, genetica: idNombre.get(genetica_id) ?? null }
    }),
    eventos: (eve.data ?? []).map((e: any) => {
      const { planta_id, ...rest } = e
      return { ...rest, planta: idApodo.get(planta_id) ?? null }
    }),
    cosechas: (cos.data ?? []).map((c: any) => {
      const { planta_id, ...rest } = c
      return { ...rest, planta: idApodo.get(planta_id) ?? null }
    }),
  }
  return JSON.stringify(dump)
}

export async function importarFull(texto: string): Promise<ResultadoImport> {
  const d = JSON.parse(texto)
  if (d.formato !== 'growflow-full-v1') throw new Error('Formato no reconocido (esperaba growflow-full-v1)')
  const res: ResultadoImport = { geneticas: 0, plantas: 0, eventos: 0, cosechas: 0 }

  // 1) Geneticas: upsert por nombre
  const genNombreId = new Map<string, string>()
  const { data: gexist } = await supabase.from('geneticas').select('id,nombre')
  for (const g of gexist ?? []) genNombreId.set((g as any).nombre.toLowerCase(), (g as any).id)
  for (const g of d.geneticas ?? []) {
    if (!g.nombre) continue
    let id = genNombreId.get(g.nombre.toLowerCase())
    if (id) {
      await supabase.from('geneticas').update({
        banco: g.banco ?? null, tipo: g.tipo ?? 'Desconocido',
        thc_estimado: g.thc_estimado ?? null, cbd_estimado: g.cbd_estimado ?? null,
        tiempo_flora_dias: g.tiempo_flora_dias ?? null, notas: g.notas ?? null,
      }).eq('id', id)
    } else {
      const { data } = await supabase.from('geneticas').insert({
        nombre: g.nombre, banco: g.banco ?? null, tipo: g.tipo ?? 'Desconocido',
        thc_estimado: g.thc_estimado ?? null, cbd_estimado: g.cbd_estimado ?? null,
        tiempo_flora_dias: g.tiempo_flora_dias ?? null, notas: g.notas ?? null,
      }).select('id').single()
      id = (data as any)?.id
      if (id) { genNombreId.set(g.nombre.toLowerCase(), id); res.geneticas++ }
    }
  }

  // 2) Plantas: upsert por apodo
  const plantaApodoId = new Map<string, string>()
  const { data: pexist } = await supabase.from('plantas').select('id,apodo')
  for (const p of pexist ?? []) plantaApodoId.set((p as any).apodo ?? '', (p as any).id)
  for (const p of d.plantas ?? []) {
    if (!p.apodo) continue
    const genId = p.genetica ? genNombreId.get(p.genetica.toLowerCase()) ?? null : null
    const campos = {
      fase: p.fase ?? 'Germinacion', slot: p.slot ?? null, ubicacion: p.ubicacion ?? null,
      sustrato: p.sustrato ?? null, maceta: p.maceta ?? null,
      activa: p.activa ?? true, fecha_germinacion: p.fecha_germinacion ?? null,
      notas: p.notas ?? null, genetica_id: genId,
    }
    let id = plantaApodoId.get(p.apodo)
    if (id) {
      await supabase.from('plantas').update(campos).eq('id', id)
    } else {
      const { data } = await supabase.from('plantas').insert({ apodo: p.apodo, ...campos }).select('id').single()
      id = (data as any)?.id
      if (id) { plantaApodoId.set(p.apodo, id); res.plantas++ }
    }
  }

  // 3) Eventos: insertar los que falten (dedupe por planta+tipo+fecha+detalle)
  const { data: eexist } = await supabase.from('eventos').select('planta_id,tipo,fecha,detalle')
  const claveEv = (pid: string | null, tipo: string, fecha: string, det: string | null) => `${pid}|${tipo}|${fecha}|${det ?? ''}`
  const yaEv = new Set((eexist ?? []).map((e: any) => claveEv(e.planta_id, e.tipo, e.fecha, e.detalle)))
  const nuevosEv: any[] = []
  for (const e of d.eventos ?? []) {
    const pid = e.planta ? plantaApodoId.get(e.planta) ?? null : null
    const k = claveEv(pid, e.tipo, e.fecha, e.detalle ?? null)
    if (yaEv.has(k)) continue
    yaEv.add(k)
    nuevosEv.push({ planta_id: pid, tipo: e.tipo, fecha: e.fecha, detalle: e.detalle ?? null, foto_url: e.foto_url ?? null })
  }
  if (nuevosEv.length) { await supabase.from('eventos').insert(nuevosEv); res.eventos = nuevosEv.length }

  // 4) Cosechas: insertar las que falten (dedupe por planta+fecha+peso_seco)
  const { data: cexist } = await supabase.from('cosechas').select('planta_id,fecha,peso_seco_g')
  const claveCo = (pid: string | null, fecha: string, ps: number | null) => `${pid}|${fecha}|${ps ?? ''}`
  const yaCo = new Set((cexist ?? []).map((c: any) => claveCo(c.planta_id, c.fecha, c.peso_seco_g)))
  const nuevosCo: any[] = []
  for (const c of d.cosechas ?? []) {
    const pid = c.planta ? plantaApodoId.get(c.planta) ?? null : null
    const k = claveCo(pid, c.fecha, c.peso_seco_g ?? null)
    if (yaCo.has(k)) continue
    yaCo.add(k)
    nuevosCo.push({ planta_id: pid, fecha: c.fecha, peso_seco_g: c.peso_seco_g ?? null,
      peso_humedo_g: c.peso_humedo_g ?? null, valoracion: c.valoracion ?? null,
      notas_curado: c.notas_curado ?? null, notas_sabor: c.notas_sabor ?? null })
  }
  if (nuevosCo.length) { await supabase.from('cosechas').insert(nuevosCo); res.cosechas = nuevosCo.length }

  return res
}
