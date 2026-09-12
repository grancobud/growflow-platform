// PaginaTablas — grilla editable estilo NocoDB sobre las tablas de Supabase.
// Una solapa por tabla; editar celda con click, agregar y borrar filas.
// La IA (chat) escribe en las mismas tablas, asi que todo queda sincronizado.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { btnSutil } from '../lib/ui'
import { toast } from 'sonner'
import { Plus, Trash2, RefreshCw, Table2, Download, Upload, X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { FASES, TIPOS_EVENTO, TIPOS_GENETICA, SUSTRATOS, CATEGORIAS_APLIC } from '../lib/cultivo'
import { CATEGORIAS_INSUMO, TIPOS_MANTENIMIENTO, UNIDADES } from '../lib/stock'
import { SISTEMAS, UNIDADES_INST } from '../lib/instalaciones'
import { exportarFull, importarFull } from '../lib/backup'
import { useDesbordeHorizontal } from '../lib/useDesbordeHorizontal'
import { useDialogo } from '../lib/useDialogo'
import { confirmarBorrado } from '../lib/confirmar'
import { useAuth } from '../hooks/useAuth'

const TIPOS_COSTO = ['fijo', 'variable'] as const
const PERIODICIDADES_COSTO = ['unico', 'mensual', 'bimestral', 'por_ciclo', 'anual'] as const

type TipoCol = 'text' | 'number' | 'date' | 'bool' | { select: readonly string[] }
interface Col { campo: string; titulo: string; tipo: TipoCol; ancho?: string }
interface DefTabla {
  id: string; nombre: string; orden: string; cols: Col[]
  /**
   * Si la tabla muestra plata.
   *
   * A quien no tenga `ver_plata` no se le ofrece: el RLS le devuelve CERO filas,
   * así que vería una pestaña vacía y la leería como un error de carga, no como
   * un permiso. Es la misma razón que `TABS_DE_PLATA` en la O.N.G.
   *
   * `ong_lotes` está marcada aunque suene a inventario: tiene `costo_por_gramo`
   * en 97 de 105 filas. El stock sin la plata se ve en Cosecha › Stock, que lee
   * de la vista `lotes_stock`.
   */
  plata?: true
}

const TIPOS_AREA_TABLA = ['carpa', 'cama', 'sector', 'sala', 'mesa', 'invernadero'] as const

const TABLAS: DefTabla[] = [
  {
    id: 'ong_documentos_institucionales', nombre: 'Papeles institucionales', orden: 'fecha',
    cols: [
      { campo: 'tipo', titulo: 'Papel', tipo: 'text' },
      { campo: 'titulo', titulo: 'Titulo', tipo: 'text' },
      { campo: 'numero', titulo: 'Numero', tipo: 'text' },
      { campo: 'fecha', titulo: 'Fecha', tipo: 'date' },
      { campo: 'vigente', titulo: 'Vigente', tipo: 'bool' },
      { campo: 'persona_juridica', titulo: 'Persona juridica', tipo: 'text' },
      { campo: 'archivo_nombre', titulo: 'Archivo', tipo: 'text' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text' },
    ],
  },
  {
    id: 'ong_pagos_proveedor', nombre: 'Pagos a proveedor', orden: 'fecha', plata: true,
    cols: [
      { campo: 'fecha', titulo: 'Fecha', tipo: 'date' },
      { campo: 'orden_servicio', titulo: 'Orden de servicio', tipo: 'text' },
      { campo: 'proveedor', titulo: 'Proveedor', tipo: 'text' },
      { campo: 'monto', titulo: 'Monto', tipo: 'number' },
      { campo: 'medio', titulo: 'Medio', tipo: 'text' },
      { campo: 'referencia', titulo: 'Referencia', tipo: 'text' },
    ],
  },
  {
    id: 'cultivo_lotes', nombre: 'Lotes de cultivo', orden: 'fecha_germinacion',
    cols: [
      { campo: 'nombre', titulo: 'Nombre', tipo: 'text' },
      { campo: 'fecha_germinacion', titulo: 'Germinación', tipo: 'date' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text' },
      { campo: 'activo', titulo: 'Activo', tipo: 'bool' },
    ],
  },
  {
    id: 'cultivo_grupos', nombre: 'Grupos de cultivo', orden: 'orden',
    cols: [
      { campo: 'nombre', titulo: 'Grupo', tipo: 'text' },
      { campo: 'sustrato', titulo: 'Sustrato', tipo: 'text' },
      { campo: 'maceta', titulo: 'Maceta', tipo: 'text' },
      { campo: 'variable', titulo: 'Qué cambia', tipo: 'text' },
      { campo: 'orden', titulo: 'Orden', tipo: 'number' },
    ],
  },
  {
    id: 'cultivo_areas', nombre: 'Áreas de cultivo', orden: 'orden',
    cols: [
      { campo: 'nombre', titulo: 'Nombre', tipo: 'text' },
      { campo: 'tipo', titulo: 'Tipo', tipo: { select: TIPOS_AREA_TABLA } },
      { campo: 'ancho_m', titulo: 'Ancho (m)', tipo: 'number' },
      { campo: 'largo_m', titulo: 'Largo (m)', tipo: 'number' },
      { campo: 'cols', titulo: 'Columnas', tipo: 'number' },
      { campo: 'rows', titulo: 'Filas', tipo: 'number' },
      { campo: 'orden', titulo: 'Orden', tipo: 'number' },
      { campo: 'activa', titulo: 'Activa', tipo: 'bool' },
    ],
  },
  {
    id: 'plantas', nombre: 'Plantas', orden: 'apodo',
    cols: [
      { campo: 'apodo', titulo: 'Apodo', tipo: 'text' },
      { campo: 'fase', titulo: 'Fase', tipo: { select: FASES } },
      // C4: texto libre y no un select, porque las opciones dependen de la fase
      // (ver SUBFASES en lib/cultivo.ts) y esta tabla no sabe de dependencias.
      { campo: 'subfase', titulo: 'Sub-fase', tipo: 'text' },
      { campo: 'fecha_germinacion', titulo: 'Germinación', tipo: 'date' },
      { campo: 'sustrato', titulo: 'Sustrato', tipo: { select: SUSTRATOS } },
      { campo: 'maceta', titulo: 'Maceta', tipo: 'text' },
      { campo: 'ubicacion', titulo: 'Ubicación', tipo: 'text' },
      { campo: 'activa', titulo: 'Activa', tipo: 'bool' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[180px]' },
    ],
  },
  {
    id: 'geneticas', nombre: 'Genéticas', orden: 'nombre',
    cols: [
      { campo: 'nombre', titulo: 'Nombre', tipo: 'text' },
      { campo: 'banco', titulo: 'Banco', tipo: 'text' },
      { campo: 'tipo', titulo: 'Tipo', tipo: { select: TIPOS_GENETICA } },
      { campo: 'genotipo', titulo: 'Genotipo', tipo: 'text' },
      { campo: 'indica_pct', titulo: 'Indica %', tipo: 'number' },
      { campo: 'sativa_pct', titulo: 'Sativa %', tipo: 'number' },
      { campo: 'linaje', titulo: 'Linaje', tipo: 'text', ancho: 'min-w-[200px]' },
      { campo: 'thc_estimado', titulo: 'THC %', tipo: 'number' },
      { campo: 'cbd_estimado', titulo: 'CBD %', tipo: 'number' },
      { campo: 'tiempo_flora_dias', titulo: 'Días flora/totales', tipo: 'number' },
      { campo: 'rendimiento_g', titulo: 'Rendimiento (g)', tipo: 'text' },
      { campo: 'terpenos', titulo: 'Terpenos', tipo: 'text', ancho: 'min-w-[200px]' },
      { campo: 'efectos', titulo: 'Efectos', tipo: 'text', ancho: 'min-w-[200px]' },
      { campo: 'usos_medicinales', titulo: 'Usos medicinales', tipo: 'text', ancho: 'min-w-[220px]' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[180px]' },
    ],
  },
  {
    id: 'eventos', nombre: 'Eventos', orden: 'fecha',
    cols: [
      { campo: 'fecha', titulo: 'Fecha', tipo: 'date' },
      { campo: 'tipo', titulo: 'Tipo', tipo: { select: TIPOS_EVENTO } },
      { campo: 'detalle', titulo: 'Detalle', tipo: 'text', ancho: 'min-w-[220px]' },
    ],
  },
  {
    id: 'riegos', nombre: 'Riegos', orden: 'fecha',
    cols: [
      { campo: 'fecha', titulo: 'Fecha', tipo: 'date' },
      { campo: 'volumen_ml', titulo: 'Volumen (ml)', tipo: 'number' },
      { campo: 'ppm', titulo: 'PPM', tipo: 'number' },
      { campo: 'ph', titulo: 'pH', tipo: 'number' },
      { campo: 'escurrio', titulo: 'Escurrió', tipo: 'bool' },
      { campo: 'escurrido_ml', titulo: 'Escurrido (ml)', tipo: 'number' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'aplicaciones', nombre: 'Aplicaciones', orden: 'fecha',
    cols: [
      { campo: 'fecha', titulo: 'Fecha', tipo: 'date' },
      { campo: 'categoria', titulo: 'Categoría', tipo: { select: CATEGORIAS_APLIC } },
      { campo: 'producto', titulo: 'Producto', tipo: 'text' },
      { campo: 'dosis', titulo: 'Dosis', tipo: 'text' },
      { campo: 'metodo', titulo: 'Método', tipo: 'text' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'cosechas', nombre: 'Cosechas', orden: 'fecha',
    cols: [
      { campo: 'fecha', titulo: 'Fecha', tipo: 'date' },
      { campo: 'peso_humedo_g', titulo: 'Húmedo (g)', tipo: 'number' },
      { campo: 'peso_seco_g', titulo: 'Seco (g)', tipo: 'number' },
      { campo: 'valoracion', titulo: 'Nota 1-10', tipo: 'number' },
      { campo: 'notas_sabor', titulo: 'Sabor', tipo: 'text' },
      { campo: 'notas_curado', titulo: 'Curado', tipo: 'text' },
    ],
  },
  {
    id: 'insumos', nombre: 'Insumos', orden: 'nombre', plata: true,
    cols: [
      { campo: 'nombre', titulo: 'Nombre', tipo: 'text', ancho: 'min-w-[180px]' },
      { campo: 'categoria', titulo: 'Categoría', tipo: { select: CATEGORIAS_INSUMO } },
      { campo: 'marca', titulo: 'Marca', tipo: 'text' },
      { campo: 'modelo', titulo: 'Modelo', tipo: 'text' },
      { campo: 'cantidad', titulo: 'Cantidad', tipo: 'number' },
      { campo: 'unidad', titulo: 'Unidad', tipo: { select: UNIDADES } },
      { campo: 'precio', titulo: 'Costo ($)', tipo: 'number' },
      { campo: 'stock_minimo', titulo: 'Stock mín.', tipo: 'number' },
      { campo: 'potencia_w', titulo: 'Potencia (W)', tipo: 'number' },
      { campo: 'proveedor', titulo: 'Proveedor', tipo: 'text' },
      { campo: 'dosis', titulo: 'Dosis', tipo: 'text' },
      { campo: 'uso', titulo: 'Uso', tipo: 'text', ancho: 'min-w-[180px]' },
      { campo: 'specs', titulo: 'Specs', tipo: 'text', ancho: 'min-w-[180px]' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'costos', nombre: 'Costos', orden: 'nombre', plata: true,
    cols: [
      { campo: 'nombre', titulo: 'Nombre', tipo: 'text', ancho: 'min-w-[180px]' },
      { campo: 'tipo', titulo: 'Tipo', tipo: { select: TIPOS_COSTO } },
      { campo: 'categoria', titulo: 'Categoría', tipo: 'text' },
      { campo: 'monto', titulo: 'Monto ($)', tipo: 'number' },
      { campo: 'cantidad', titulo: 'Cantidad', tipo: 'number' },
      { campo: 'periodicidad', titulo: 'Periodicidad', tipo: { select: PERIODICIDADES_COSTO } },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'mantenimientos', nombre: 'Mantenimiento', orden: 'fecha_realizado',
    cols: [
      { campo: 'equipo', titulo: 'Equipo', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'tipo', titulo: 'Tipo', tipo: { select: TIPOS_MANTENIMIENTO } },
      { campo: 'fecha_realizado', titulo: 'Realizado', tipo: 'date' },
      { campo: 'frecuencia_dias', titulo: 'Cada (días)', tipo: 'number' },
      { campo: 'proximo', titulo: 'Próximo', tipo: 'date' },
      { campo: 'responsable', titulo: 'Responsable', tipo: 'text' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'ong_entidad', nombre: 'ONG · entidad', orden: 'razon_social',
    cols: [
      { campo: 'razon_social', titulo: 'Razon social', tipo: 'text', ancho: 'min-w-[180px]' },
      { campo: 'cuit', titulo: 'CUIT', tipo: 'text' },
      { campo: 'jurisdiccion', titulo: 'Jurisdiccion', tipo: 'text' },
      { campo: 'organismo_control', titulo: 'Organismo', tipo: 'text' },
      { campo: 'fecha_constitucion', titulo: 'Constitucion', tipo: 'date' },
      { campo: 'cierre_ejercicio_dia', titulo: 'Cierre dia', tipo: 'number' },
      { campo: 'cierre_ejercicio_mes', titulo: 'Cierre mes', tipo: 'number' },
      { campo: 'mandato_anios', titulo: 'Mandato (anios)', tipo: 'number' },
      { campo: 'mandato_desde', titulo: 'Mandato desde', tipo: 'date' },
      { campo: 'reprocann_vencimiento', titulo: 'REPROCANN vence', tipo: 'date' },
      { campo: 'tope_pacientes', titulo: 'Tope pacientes', tipo: 'number' },
      { campo: 'plantas_por_paciente', titulo: 'Plantas x paciente', tipo: 'number' },
      { campo: 'tope_predios', titulo: 'Tope predios', tipo: 'number' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'ong_autoridades', nombre: 'ONG · autoridades', orden: 'cargo',
    cols: [
      { campo: 'nombre', titulo: 'Nombre', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'cargo', titulo: 'Cargo', tipo: 'text', ancho: 'min-w-[140px]' },
      { campo: 'organo', titulo: 'Organo', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'desde', titulo: 'Desde', tipo: 'date' },
      { campo: 'hasta', titulo: 'Hasta', tipo: 'date' },
      { campo: 'activo', titulo: 'Activo', tipo: 'bool' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'ong_requisitos', nombre: 'ONG · requisitos 1780', orden: 'orden',
    cols: [
      { campo: 'titulo', titulo: 'Requisito', tipo: 'text', ancho: 'min-w-[180px]' },
      { campo: 'cumplido', titulo: 'Cumplido', tipo: 'bool' },
      { campo: 'vence', titulo: 'Vence', tipo: 'date' },
      { campo: 'responsable', titulo: 'Responsable', tipo: 'text', ancho: 'min-w-[140px]' },
      { campo: 'detalle', titulo: 'Detalle', tipo: 'text', ancho: 'min-w-[200px]' },
      { campo: 'nota', titulo: 'Nota', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'orden', titulo: 'Orden', tipo: 'number' },
    ],
  },
  {
    id: 'ong_predios', nombre: 'ONG · predios', orden: 'nombre',
    cols: [
      { campo: 'nombre', titulo: 'Nombre', tipo: 'text', ancho: 'min-w-[150px]' },
      { campo: 'direccion', titulo: 'Direccion', tipo: 'text', ancho: 'min-w-[180px]' },
      { campo: 'localidad', titulo: 'Localidad', tipo: 'text' },
      { campo: 'provincia', titulo: 'Provincia', tipo: 'text' },
      { campo: 'municipio', titulo: 'Municipio', tipo: 'text' },
      { campo: 'georreferenciado', titulo: 'Georref.', tipo: 'bool' },
      { campo: 'municipio_notificado', titulo: 'Muni avisado', tipo: 'bool' },
      { campo: 'activo', titulo: 'Activo', tipo: 'bool' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'ong_caja', nombre: 'ONG · libro de caja', orden: 'fecha', plata: true,
    cols: [
      { campo: 'fecha', titulo: 'Fecha', tipo: 'date' },
      { campo: 'tipo', titulo: 'Tipo', tipo: { select: ['ingreso', 'egreso'] } },
      { campo: 'concepto', titulo: 'Concepto', tipo: 'text', ancho: 'min-w-[180px]' },
      { campo: 'monto', titulo: 'Monto', tipo: 'number' },
      { campo: 'medio', titulo: 'Medio', tipo: 'text' },
      { campo: 'detalle', titulo: 'Detalle', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[140px]' },
    ],
  },
  {
    id: 'ong_lotes', nombre: 'ONG · catálogo (lotes)', orden: 'codigo', plata: true,
    cols: [
      { campo: 'codigo', titulo: 'Código', tipo: 'text' },
      { campo: 'producto', titulo: 'Producto', tipo: { select: ['flor', 'aceite', 'extracto', 'tópico', 'otro'] } },
      { campo: 'gramos_totales', titulo: 'Gramos', tipo: 'number' },
      { campo: 'aporte_por_gramo', titulo: '$/g', tipo: 'number' },
      { campo: 'thc_pct', titulo: 'THC %', tipo: 'number' },
      { campo: 'cbd_pct', titulo: 'CBD %', tipo: 'number' },
      { campo: 'laboratorio', titulo: 'Laboratorio', tipo: 'text' },
      { campo: 'fecha_analisis', titulo: 'Análisis', tipo: 'date' },
      { campo: 'fecha_elaboracion', titulo: 'Elaborado', tipo: 'date' },
      { campo: 'activo', titulo: 'Activo', tipo: 'bool' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    // El arqueo NO se edita desde acá: la tabla no tiene update ni delete, a
    // propósito. Un arqueo es la foto de un momento; si se contó mal se carga
    // otro, porque corregir el anterior borraría la única evidencia de que la
    // diferencia existió. Se lista para poder leer el histórico.
    id: 'arqueos', nombre: 'Arqueos de caja y stock', orden: 'momento',
    cols: [
      { campo: 'momento', titulo: 'Cuándo', tipo: 'text' },
      { campo: 'esperado_efectivo', titulo: 'Efectivo esperado', tipo: 'number' },
      { campo: 'contado_efectivo', titulo: 'Efectivo contado', tipo: 'number' },
      { campo: 'esperado_transferencia', titulo: 'Transf. esperada', tipo: 'number' },
      { campo: 'contado_transferencia', titulo: 'Transf. contada', tipo: 'number' },
      { campo: 'esperado_stock_g', titulo: 'Stock esperado (g)', tipo: 'number' },
      { campo: 'contado_stock_g', titulo: 'Stock contado (g)', tipo: 'number' },
      { campo: 'nota', titulo: 'Nota', tipo: 'text', ancho: 'min-w-[200px]' },
    ],
  },
  {
    id: 'ong_visitas', nombre: 'ONG · visitas', orden: 'fecha',
    cols: [
      { campo: 'fecha', titulo: 'Fecha', tipo: 'date' },
      { campo: 'nombre_libre', titulo: 'Nombre (sin ficha)', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'motivo', titulo: 'Motivo', tipo: 'text', ancho: 'min-w-[140px]' },
      { campo: 'resultado', titulo: 'Resultado', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'atendio', titulo: 'Atendió', tipo: 'text' },
      { campo: 'contacto', titulo: 'Contacto', tipo: 'text' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[180px]' },
    ],
  },
  {
    // El token NO se lista. Es la credencial con la que la persona abre su
    // propia pantalla: mostrarlo en una tabla exportable lo convierte en algo
    // que viaja en un Excel.
    id: 'ong_solicitudes', nombre: 'ONG · solicitudes de alta', orden: 'creada_en',
    cols: [
      { campo: 'nombre', titulo: 'Nombre', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'dni', titulo: 'DNI', tipo: 'text' },
      { campo: 'estado', titulo: 'Estado', tipo: { select: ['pendiente', 'en_revision', 'aceptada', 'rechazada'] } },
      { campo: 'email', titulo: 'Mail', tipo: 'text' },
      { campo: 'telefono', titulo: 'Teléfono', tipo: 'text' },
      { campo: 'creada_en', titulo: 'Entró', tipo: 'text' },
      { campo: 'motivo', titulo: 'Motivo', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'ong_pedidos', nombre: 'ONG · reservas del portal', orden: 'codigo_reserva',
    cols: [
      { campo: 'codigo_reserva', titulo: 'Reserva', tipo: 'text' },
      { campo: 'gramos', titulo: 'Gramos', tipo: 'number' },
      { campo: 'monto_reembolso', titulo: 'Reembolso', tipo: 'number' },
      { campo: 'metodo_pago', titulo: 'Medio', tipo: { select: ['Transferencia_Billetera', 'Efectivo_Sede'] } },
      { campo: 'estado_pago', titulo: 'Pago', tipo: { select: ['Pendiente_Verificacion', 'Pendiente_Efectivo', 'Abonado', 'Rechazado'] } },
      { campo: 'estado_pedido', titulo: 'Estado', tipo: { select: ['Reservado', 'Listo_Para_Retiro', 'Entregado', 'Expirado', 'Cancelado'] } },
      { campo: 'fecha_expiracion', titulo: 'Vence', tipo: 'text' },
      { campo: 'entregado_en', titulo: 'Entregado', tipo: 'text' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'ong_ddjj', nombre: 'ONG · declaraciones juradas', orden: 'periodo',
    cols: [
      { campo: 'periodo', titulo: 'Periodo', tipo: 'text' },
      { campo: 'fecha_presentacion', titulo: 'Presentada', tipo: 'date' },
      { campo: 'plantas_total', titulo: 'Plantas', tipo: 'number' },
      { campo: 'plantas_floracion', titulo: 'En flor', tipo: 'number' },
      { campo: 'pacientes_vinculados', titulo: 'Pacientes', tipo: 'number' },
      { campo: 'variedades', titulo: 'Variedades', tipo: 'text', ancho: 'min-w-[180px]' },
      { campo: 'presentada', titulo: 'OK', tipo: 'bool' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'ong_traslados', nombre: 'ONG · traslados', orden: 'fecha',
    cols: [
      { campo: 'fecha', titulo: 'Fecha', tipo: 'date' },
      { campo: 'tipo_material', titulo: 'Material', tipo: { select: ['flores', 'frascos', 'plantas'] } },
      { campo: 'cantidad', titulo: 'Cantidad', tipo: 'number' },
      { campo: 'origen', titulo: 'Origen', tipo: 'text' },
      { campo: 'destino', titulo: 'Destino', tipo: 'text' },
      { campo: 'transportista', titulo: 'Transportista', tipo: 'text' },
      { campo: 'destinatario', titulo: 'Destinatario', tipo: 'text' },
      { campo: 'carta_porte_presentada', titulo: 'Carta porte', tipo: 'bool' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'ong_documentos', nombre: 'ONG · documentos', orden: 'fecha', plata: true,
    cols: [
      { campo: 'tipo', titulo: 'Tipo', tipo: { select: ['emitido', 'gasto'] } },
      { campo: 'subtipo', titulo: 'Clase', tipo: 'text' },
      { campo: 'fecha', titulo: 'Fecha', tipo: 'date' },
      { campo: 'numero', titulo: 'Numero', tipo: 'text' },
      { campo: 'descripcion', titulo: 'Descripcion', tipo: 'text', ancho: 'min-w-[180px]' },
      { campo: 'monto', titulo: 'Monto', tipo: 'number' },
      { campo: 'proveedor', titulo: 'Proveedor', tipo: 'text' },
      { campo: 'categoria', titulo: 'Rubro', tipo: 'text' },
      { campo: 'archivo_nombre', titulo: 'Archivo', tipo: 'text' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'ong_cuotas_emitidas', nombre: 'ONG · cuotas emitidas', orden: 'periodo', plata: true,
    cols: [
      { campo: 'periodo', titulo: 'Periodo', tipo: 'text' },
      { campo: 'tipo', titulo: 'Tipo', tipo: { select: ['social', 'cultivo'] } },
      { campo: 'monto', titulo: 'Monto', tipo: 'number' },
      { campo: 'pagada', titulo: 'Pagada', tipo: 'bool' },
      { campo: 'fecha_pago', titulo: 'Fecha pago', tipo: 'date' },
      { campo: 'medio', titulo: 'Medio', tipo: 'text' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'ong_dispensas', nombre: 'ONG · dispensas', orden: 'fecha',
    cols: [
      { campo: 'fecha', titulo: 'Fecha', tipo: 'date' },
      { campo: 'gramos', titulo: 'Gramos', tipo: 'number' },
      { campo: 'producto', titulo: 'Producto', tipo: { select: ['flor', 'extracto', 'aceite', 'otro'] } },
      { campo: 'aporte', titulo: 'Aporte ($)', tipo: 'number' },
      { campo: 'modalidad', titulo: 'Modalidad', tipo: { select: ['retiro', 'envio'] } },
      { campo: 'con_receta', titulo: 'Con receta', tipo: 'bool' },
      { campo: 'entregado_por', titulo: 'Entregado por', tipo: 'text', ancho: 'min-w-[140px]' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'ong_libros', nombre: 'ONG · libros', orden: 'tipo',
    cols: [
      { campo: 'tipo', titulo: 'Tipo', tipo: 'text', ancho: 'min-w-[170px]' },
      { campo: 'numero', titulo: 'Nro', tipo: 'number' },
      { campo: 'rubricado', titulo: 'Rubricado', tipo: 'bool' },
      { campo: 'fecha_rubrica', titulo: 'Fecha rubrica', tipo: 'date' },
      { campo: 'organismo', titulo: 'Organismo', tipo: 'text' },
      { campo: 'digital', titulo: 'Digital', tipo: 'bool' },
      { campo: 'folios_totales', titulo: 'Folios', tipo: 'number' },
      { campo: 'folios_usados', titulo: 'Usados', tipo: 'number' },
      { campo: 'estado', titulo: 'Estado', tipo: 'text' },
    ],
  },
  {
    id: 'ong_actas', nombre: 'ONG · actas', orden: 'fecha',
    cols: [
      { campo: 'tipo', titulo: 'Organo', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'numero', titulo: 'Nro', tipo: 'number' },
      { campo: 'fecha', titulo: 'Fecha', tipo: 'date' },
      { campo: 'asistentes', titulo: 'Asistentes', tipo: 'number' },
      { campo: 'quorum_ok', titulo: 'Quorum', tipo: 'bool' },
      { campo: 'segunda_convocatoria', titulo: '2da conv.', tipo: 'bool' },
      { campo: 'estado', titulo: 'Estado', tipo: 'text' },
      { campo: 'folio', titulo: 'Folio', tipo: 'number' },
      { campo: 'firmantes', titulo: 'Firmantes', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'ong_asociados', nombre: 'ONG · asociados', orden: 'nombre',
    cols: [
      { campo: 'nombre', titulo: 'Nombre', tipo: 'text', ancho: 'min-w-[170px]' },
      { campo: 'dni', titulo: 'DNI', tipo: 'text' },
      { campo: 'categoria', titulo: 'Categoria', tipo: 'text', ancho: 'min-w-[130px]' },
      { campo: 'fecha_alta', titulo: 'Alta', tipo: 'date' },
      { campo: 'activo', titulo: 'Activo', tipo: 'bool' },
      { campo: 'fundador', titulo: 'Fundador', tipo: 'bool' },
      { campo: 'vinculado_reprocann', titulo: 'Vinculado', tipo: 'bool' },
      { campo: 'fecha_vinculacion', titulo: 'Fecha vinc.', tipo: 'date' },
    ],
  },
  {
    id: 'ong_categorias_socio', nombre: 'ONG · categorias de socio', orden: 'nombre', plata: true,
    cols: [
      { campo: 'nombre', titulo: 'Nombre', tipo: 'text', ancho: 'min-w-[150px]' },
      { campo: 'requiere_reprocann', titulo: 'Requiere REPROCANN', tipo: 'bool' },
      { campo: 'con_voto', titulo: 'Con voto', tipo: 'bool' },
      { campo: 'cuota', titulo: 'Cuota', tipo: 'number' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'ong_cuotas', nombre: 'ONG · cuotas', orden: 'vigente_desde', plata: true,
    cols: [
      { campo: 'tipo', titulo: 'Tipo', tipo: { select: ['social', 'cultivo'] } },
      { campo: 'categoria', titulo: 'Categoria', tipo: 'text', ancho: 'min-w-[130px]' },
      { campo: 'valor', titulo: 'Valor', tipo: 'number' },
      { campo: 'vigente_desde', titulo: 'Vigente desde', tipo: 'date' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  // Las solapas de los modulos que esta instalacion no tiene (Calculadora de
  // Fertilizantes, Instalacion y Tablero electrico) se sacaron de aca: sus tablas
  // estan vacias y no hay pantalla que las llene, asi que eran doce pestanas que
  // no llevaban a ningun lado. `instalaciones_items` SE QUEDA: lo usa
  // Econometria > Instalaciones, que si forma parte de esta instalacion.
  {
    // Ojo con el nombre: NO es el modulo Instalacion, que esta instalacion no
    // tiene. Es el equipamiento que amortiza, el de Econometria > Instalaciones.
    id: 'instalaciones_items', nombre: 'Econometría · equipamiento', orden: 'nombre', plata: true,
    cols: [
      { campo: 'nombre', titulo: 'Nombre', tipo: 'text', ancho: 'min-w-[180px]' },
      { campo: 'sistema', titulo: 'Sistema', tipo: { select: SISTEMAS } },
      { campo: 'marca', titulo: 'Marca', tipo: 'text' },
      { campo: 'modelo', titulo: 'Modelo', tipo: 'text' },
      { campo: 'precio', titulo: 'Precio', tipo: 'number' },
      { campo: 'unidad', titulo: 'Unidad', tipo: { select: UNIDADES_INST } },
      { campo: 'specs', titulo: 'Specs', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'url', titulo: 'URL', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'notas', titulo: 'Notas', tipo: 'text', ancho: 'min-w-[160px]' },
    ],
  },
  {
    id: 'ambiente_salas', nombre: 'Ambiente · salas', orden: 'orden',
    cols: [
      { campo: 'nombre', titulo: 'Nombre', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'etapa', titulo: 'Etapa', tipo: { select: ['vegetativo', 'floracion'] } },
      { campo: 'activa', titulo: 'Activa', tipo: 'bool' },
      { campo: 'orden', titulo: 'Orden', tipo: 'number' },
    ],
  },
  {
    id: 'ambiente_lecturas', nombre: 'Ambiente · lecturas', orden: 'medido_en',
    cols: [
      { campo: 'sala_id', titulo: 'Sala (id)', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'medido_en', titulo: 'Medido', tipo: 'text', ancho: 'min-w-[160px]' },
      { campo: 'temp_c', titulo: 'Temp (°C)', tipo: 'number' },
      { campo: 'humedad_pct', titulo: 'Humedad (%)', tipo: 'number' },
      { campo: 'nota', titulo: 'Nota', tipo: 'text', ancho: 'min-w-[180px]' },
    ],
  },
]

// Tablas que referencian una planta: mostramos la columna con nombre legible
const CON_PLANTA = new Set(['eventos', 'cosechas', 'riegos', 'aplicaciones'])

const celdaCls = 'px-2.5 py-1.5 text-[12px] text-[#d4d4dd] border-b border-r border-[#1f1f2b] whitespace-nowrap'
const inputCls = 'w-full bg-[#1c1c27] border border-[#a3e635]/50 rounded px-1.5 py-0.5 text-[16px] sm:text-[12px] text-[#ececf1] focus:outline-none focus:border-[#a3e635]/60'

export default function PaginaTablas() {
  // Las solapas scrollean sin barra: la franja gris del navegador quedaba
  // cruzando la pantalla aun cuando entraban todas. Dos degradados la reemplazan.
  // Las de plata sólo para quien la puede ver. Sin esto, un administrador de
  // sistema abría «Pagos a proveedor» y veía una tabla vacía: el RLS le devuelve
  // cero filas, y una pantalla vacía por permiso se lee como una rota.
  const { tienePermiso } = useAuth()
  const tablas = useMemo(
    () => TABLAS.filter(t => !t.plata || tienePermiso('ver_plata')), [tienePermiso])
  const { refWrapper, refScroller } = useDesbordeHorizontal<HTMLDivElement, HTMLDivElement>(tablas.length)
  const [tabla, setTabla] = useState<DefTabla>(tablas[0])
  const [filas, setFilas] = useState<any[]>([])
  const [plantas, setPlantas] = useState<Record<string, string>>({})
  const [geneticasMap, setGeneticasMap] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<{ fila: string; campo: string } | null>(null)
  const [valor, setValor] = useState('')
  const [modalImport, setModalImport] = useState(false)
  const refDialogo = useDialogo(() => setModalImport(false), modalImport)
  const [textoImport, setTextoImport] = useState('')
  const [procesando, setProcesando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const ascendente = tabla.orden === 'nombre' || tabla.orden === 'apodo'
      const { data, error } = await supabase.from(tabla.id).select('*')
        .order(tabla.orden, { ascending: ascendente })
      if (error) throw new Error(error.message)
      let filasOrdenadas = data ?? []
      // Orden natural (#2 antes que #10) para la tabla Plantas
      if (tabla.id === 'plantas') {
        filasOrdenadas = [...filasOrdenadas].sort((a, b) =>
          String(a.apodo ?? '').localeCompare(String(b.apodo ?? ''), 'es', { numeric: true }))
      }
      setFilas(filasOrdenadas)
      if (CON_PLANTA.has(tabla.id)) {
        const { data: pl } = await supabase.from('resumen_plantas').select('id,nombre,genetica')
        setPlantas(Object.fromEntries((pl ?? []).map((p: any) => [p.id, p.genetica ? `${p.nombre} · ${p.genetica}` : p.nombre])))
      }
      if (tabla.id === 'plantas') {
        const { data: gs } = await supabase.from('geneticas').select('id,nombre')
        setGeneticasMap(Object.fromEntries((gs ?? []).map((g: any) => [g.id, g.nombre])))
      }
    } catch (err) {
      toast.error(`Error cargando ${tabla.nombre}: ${(err as Error).message}`)
    } finally {
      setCargando(false)
    }
  }, [tabla])

  useEffect(() => { cargar() }, [cargar])

  const guardarCelda = async (fila: any, col: Col, nuevo: string) => {
    setEditando(null)
    let v: any = nuevo.trim() === '' ? null : nuevo.trim()
    if (col.tipo === 'number' && v !== null) v = Number(v)
    if (v === fila[col.campo]) return
    try {
      const { error } = await supabase.from(tabla.id).update({ [col.campo]: v }).eq('id', fila.id)
      if (error) throw new Error(error.message)
      setFilas(fs => fs.map(f => f.id === fila.id ? { ...f, [col.campo]: v } : f))
    } catch (err) {
      toast.error(`No se pudo guardar: ${(err as Error).message}`)
    }
  }

  const toggleBool = async (fila: any, col: Col) => {
    const v = !fila[col.campo]
    try {
      const { error } = await supabase.from(tabla.id).update({ [col.campo]: v }).eq('id', fila.id)
      if (error) throw new Error(error.message)
      setFilas(fs => fs.map(f => f.id === fila.id ? { ...f, [col.campo]: v } : f))
    } catch (err) {
      toast.error(`No se pudo guardar: ${(err as Error).message}`)
    }
  }

  const agregarFila = async () => {
    try {
      const base: any = {}
      if (tabla.id === 'geneticas') base.nombre = 'Nueva genética'
      if (tabla.id === 'insumos') base.nombre = 'Nuevo insumo'
      if (tabla.id === 'costos') base.nombre = 'Nuevo costo'
      const { data, error } = await supabase.from(tabla.id).insert(base).select().single()
      if (error) throw new Error(error.message)
      setFilas(fs => [data, ...fs])
      toast.success('Fila agregada')
    } catch (err) {
      toast.error(`No se pudo agregar: ${(err as Error).message}`)
    }
  }

  const borrarFila = async (fila: any) => {
    if (!(await confirmarBorrado('¿Borrar esta fila? No se puede deshacer.'))) return
    try {
      const { error } = await supabase.from(tabla.id).delete().eq('id', fila.id)
      if (error) throw new Error(error.message)
      setFilas(fs => fs.filter(f => f.id !== fila.id))
      toast.success('Fila borrada')
    } catch (err) {
      toast.error(`No se pudo borrar: ${(err as Error).message}`)
    }
  }

  const exportar = async () => {
    try {
      const json = await exportarFull()
      await navigator.clipboard.writeText(json)
      toast.success('Backup completo copiado al portapapeles')
    } catch (err) {
      toast.error(`No se pudo exportar: ${(err as Error).message}`)
    }
  }

  const importar = async () => {
    setProcesando(true)
    try {
      const r = await importarFull(textoImport)
      toast.success(`Importado: ${r.geneticas} genéticas, ${r.plantas} plantas, ${r.eventos} eventos, ${r.cosechas} cosechas`)
      setModalImport(false); setTextoImport(''); cargar()
    } catch (err) {
      toast.error(`Error importando: ${(err as Error).message}`)
    } finally {
      setProcesando(false)
    }
  }

  const renderCelda = (fila: any, col: Col) => {
    const enEdicion = editando?.fila === fila.id && editando?.campo === col.campo
    const v = fila[col.campo]

    if (col.tipo === 'bool') {
      return (
        <td key={col.campo} className={`${celdaCls} text-center cursor-pointer`} onClick={() => toggleBool(fila, col)}>
          <span className={v ? 'text-[#bef264]' : 'text-[#8a8a9c]'}>{v ? '✓' : '✗'}</span>
        </td>
      )
    }

    if (enEdicion) {
      if (typeof col.tipo === 'object') {
        return (
          <td key={col.campo} className={celdaCls}>
            <select autoFocus className={inputCls} value={valor}
              onChange={e => { setValor(e.target.value); guardarCelda(fila, col, e.target.value) }}
              onBlur={() => guardarCelda(fila, col, valor)}>
              <option value="">—</option>
              {col.tipo.select.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </td>
        )
      }
      return (
        <td key={col.campo} className={celdaCls}>
          <input autoFocus
            type={col.tipo === 'number' ? 'number' : col.tipo === 'date' ? 'date' : 'text'}
            className={inputCls} value={valor}
            onChange={e => setValor(e.target.value)}
            onBlur={() => guardarCelda(fila, col, valor)}
            onKeyDown={e => {
              if (e.key === 'Enter') guardarCelda(fila, col, valor)
              if (e.key === 'Escape') setEditando(null)
            }} />
        </td>
      )
    }

    return (
      <td key={col.campo}
        className={`${celdaCls} ${col.ancho ?? ''} cursor-text hover:bg-[#15151d] transition-colors`}
        onClick={() => { setEditando({ fila: fila.id, campo: col.campo }); setValor(v ?? '') }}>
        {v === null || v === undefined || v === '' ? <span className="text-[#8a8a9c]">—</span> : String(v)}
      </td>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0f] text-[#d4d4dd] font-sans overflow-hidden">
      <div className="bg-[#0a0a0f] border-b border-[#1f1f2b] flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3">
          <div className="min-w-0">
            <h1 className="font-display font-bold tracking-tight text-[15px] sm:text-[17px] text-[#ececf1]">Tablas</h1>
            <div className="mt-0.5 text-[10px] sm:text-[11px] text-[#8a8a9c]">
              {filas.length} filas · click en una celda para editar
            </div>
          </div>
          <div className="flex-1" />
          <button onClick={exportar}
            className={btnSutil}
            title="Copiar backup completo del cultivo (todas las tablas) al portapapeles">
            <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Export</span>
          </button>
          <button onClick={() => setModalImport(true)}
            className={btnSutil}
            title="Pegar un backup para restaurar/mezclar">
            <Upload className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Import</span>
          </button>
          <button onClick={cargar}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 rounded-lg border border-[#2a2a3a] bg-[#15151d] hover:bg-[#1c1c27] transition-colors text-[#a6a6b5]"
            title="Refrescar">
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={agregarFila}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[11px] font-medium text-[#d9f99d]">
            <Plus className="w-3.5 h-3.5" /> Fila
          </button>
        </div>
        {/* Solapas */}
        <div ref={refWrapper} className="ct-tabs-fade">
          <div ref={refScroller} className="scrollbar-none flex gap-1 px-3 sm:px-6 pb-0 overflow-x-auto">
            {tablas.map(t => (
              <button key={t.id} onClick={() => setTabla(t)}
                className={`px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-t-lg text-[12px] font-medium border border-b-0 transition-colors whitespace-nowrap ${
                  tabla.id === t.id
                    ? 'bg-[#101016] border-[#1f1f2b] text-[#d9f99d]'
                    : 'bg-transparent border-transparent text-[#8a8a9c] hover:text-[#a6a6b5]'
                }`}>
                {t.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#101016]">
        {cargando ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 bg-[#15151d] rounded animate-pulse" />
            ))}
          </div>
        ) : filas.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto w-11 h-11 rounded-full bg-[#1c1c27] border border-[#20202c] flex items-center justify-center mb-3">
              <Table2 className="w-5 h-5 text-[#8a8a9c]" />
            </div>
            <div className="font-display font-semibold text-[#d4d4dd] text-[14px]">Tabla vacía</div>
            <div className="mt-1 text-[11px] text-[#8a8a9c]">Agregá una fila o pedíselo al chat.</div>
          </div>
        ) : (
          /* La tabla scrollea en SU caja, no arrastrando la pantalla.
             Sin este envoltorio la tabla mide 698 px contra un viewport de 390 y,
             como ningun ancestro acota el eje horizontal, la que se corria era la
             PAGINA: 308 px de desplazamiento lateral, con la cabecera y todo lo
             demas moviendose junto con las columnas. Medido el 29/08 a 390 px.
             `min-w-full` la deja ocupar todo cuando entra, y crecer cuando no. */
          <div className="overflow-x-auto">
          <table className="border-collapse text-left min-w-full">
            <thead className="sticky top-0 bg-[#0e0e15] z-10">
              <tr>
                {CON_PLANTA.has(tabla.id) && (
                  <th className="px-2.5 py-2 text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium border-b border-r border-[#1f1f2b] whitespace-nowrap">Planta</th>
                )}
                {tabla.id === 'plantas' && (
                  <th className="px-2.5 py-2 text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium border-b border-r border-[#1f1f2b] whitespace-nowrap">Variedad</th>
                )}
                {tabla.cols.map(c => (
                  <th key={c.campo} className="px-2.5 py-2 text-[10px] uppercase tracking-[0.14em] text-[#8a8a9c] font-medium border-b border-r border-[#1f1f2b] whitespace-nowrap">{c.titulo}</th>
                ))}
                <th className="px-2 py-2 border-b border-[#1f1f2b] w-9" />
              </tr>
            </thead>
            <tbody>
              {filas.map(fila => (
                <tr key={fila.id} className="group hover:bg-[#13131a]">
                  {CON_PLANTA.has(tabla.id) && (
                    <td className={`${celdaCls} text-[#a6a6b5]`}>{plantas[fila.planta_id] ?? '—'}</td>
                  )}
                  {tabla.id === 'plantas' && (
                    <td className={`${celdaCls} text-[#a6a6b5]`}>{geneticasMap[fila.genetica_id] ?? '—'}</td>
                  )}
                  {tabla.cols.map(c => renderCelda(fila, c))}
                  <td className="px-2 py-1.5 border-b border-[#1f1f2b]">
                    <button onClick={() => borrarFila(fila)}
                      className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 text-[#8a8a9c] opacity-0 group-hover:opacity-100 hover:text-[#ff8a7a] rounded transition"
                      title="Borrar fila">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {modalImport && (
        <div ref={refDialogo} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModalImport(false)} />
          <div className="relative w-full max-w-lg rounded-xl bg-[#101016] border border-[#2a2a3a] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1f1f2b]">
              <h2 className="font-display font-semibold text-[14px] text-[#ececf1]">Importar backup</h2>
              <button onClick={() => setModalImport(false)} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 text-[#8a8a9c] hover:text-[#ececf1]" aria-label="Cerrar">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[11px] text-[#8f8f9f] leading-relaxed">
                Pegá un backup exportado desde otra instancia (formato <code className="font-mono text-[10px] text-[#c4b5fd] bg-[#15151d] px-1 py-0.5 rounded">growflow-full-v1</code>).
                Las genéticas y plantas se actualizan por nombre/apodo; los eventos y cosechas se suman sin duplicar.
              </p>
              <textarea autoFocus rows={8} value={textoImport}
                onChange={e => setTextoImport(e.target.value)}
                placeholder='{"formato":"growflow-full-v1","geneticas":[...],"plantas":[...]}'
                className="w-full px-3 py-2 rounded-lg bg-[#15151d] border border-[#2a2a3a] text-[11px] font-mono text-[#ececf1] placeholder-[#8a8a9c] focus:outline-none focus:border-[#a3e635]/60 transition-colors resize-y" />
              <button onClick={importar} disabled={procesando || !textoImport.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#a3e635]/40 bg-[#a3e635]/10 hover:bg-[#a3e635]/20 transition-colors text-[12px] font-medium text-[#d9f99d] disabled:opacity-50">
                {procesando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Importar
              </button>
              <button onClick={() => setModalImport(false)} className="w-full min-h-[44px] flex items-center justify-center rounded-lg border border-[#2a2a3a] text-[12px] text-[#a6a6b5] hover:text-[#ececf1] hover:bg-[#1f1f2b] transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
