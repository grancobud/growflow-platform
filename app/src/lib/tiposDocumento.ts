// Qué es cada comprobante y cuándo se usa.
//
// La pantalla de Documentos ofrece catorce clases distintas en un desplegable
// que sólo dice el nombre. «Certificado de vinculación» y «Constancia de socio»
// suenan parecido y no son lo mismo: uno prueba que la persona está vinculada en
// REPROCANN y el otro que es miembro de la asociación civil. Elegir mal no da
// error — el documento sale igual, con el título equivocado, y se descubre
// cuando alguien lo presenta.
//
// La app maneja los dos lados del circuito y conviene tenerlos separados en la
// cabeza:
//
//   COMPRA   entra material y sale plata. La asociación recibe del proveedor y
//            guarda el comprobante que respalda el gasto.
//   ENTREGA  sale material y entra plata. La asociación emite a nombre del
//            paciente el recibo por el reembolso de costos.
//
// Un comprobante mal clasificado rompe el cruce de su lado: en la compra, el
// gasto queda sin respaldo y el costo por gramo es un número que no se puede
// defender; en la entrega, el aporte queda sin recibo y no se puede probar que
// fue un reembolso y no una venta.

export interface TipoDocumento {
  /** El valor exacto del desplegable. */
  clase: string
  /** `emitido` lo hace la asociación; `gasto` lo recibe de un tercero. */
  tipo: 'emitido' | 'gasto'
  /** En una línea, qué prueba este papel. */
  paraQue: string
  /** El momento en que se emite o se carga. */
  cuando: string
}

export const TIPOS_DOCUMENTO: TipoDocumento[] = [
  // ---------- Lo que la asociación EMITE ----------
  {
    clase: 'Comprobante de dispensa',
    tipo: 'emitido',
    paraQue: 'Es el recibo del aporte por reembolso de costos. Prueba que la entrega no fue una venta.',
    cuando: 'En cada entrega a un paciente, junto con el material.',
  },
  {
    clase: 'Recibo de cuota',
    tipo: 'emitido',
    paraQue: 'Respalda la cuota social que pagó un asociado.',
    cuando: 'Al cobrar la cuota del período.',
  },
  {
    clase: 'Constancia de socio',
    tipo: 'emitido',
    paraQue: 'Acredita que alguien es miembro de la asociación civil y está al día.',
    cuando: 'Cuando un socio la pide, o para un trámite ante un tercero.',
  },
  {
    clase: 'Certificado de vinculación',
    tipo: 'emitido',
    paraQue: 'Acredita que la persona está vinculada a la entidad en REPROCANN. No es lo mismo que ser socio.',
    cuando: 'Para el trámite de REPROCANN de esa persona.',
  },
  {
    clase: 'Nota / carta',
    tipo: 'emitido',
    paraQue: 'Cualquier comunicación formal de la asociación a un tercero.',
    cuando: 'Cuando hace falta dejar por escrito algo que no entra en las otras clases.',
  },

  // ---------- Lo que la asociación RECIBE ----------
  {
    clase: 'Factura A',
    tipo: 'gasto',
    paraQue: 'Comprobante fiscal de un proveedor inscripto. Es el respaldo más fuerte de un gasto.',
    cuando: 'Al comprar material o insumos a un responsable inscripto.',
  },
  {
    clase: 'Factura B',
    tipo: 'gasto',
    paraQue: 'Comprobante fiscal cuando la asociación es consumidor final.',
    cuando: 'Es la más habitual en compras a comercios.',
  },
  {
    clase: 'Factura C',
    tipo: 'gasto',
    paraQue: 'Comprobante de un proveedor monotributista.',
    cuando: 'Al comprarle a un monotributista.',
  },
  {
    clase: 'Ticket',
    tipo: 'gasto',
    paraQue: 'Respalda un gasto chico. Vale menos que una factura pero es mejor que nada.',
    cuando: 'Compras menores donde no dieron factura.',
  },
  {
    clase: 'Remito',
    tipo: 'gasto',
    paraQue: 'Acredita que la mercadería se entregó, pero NO respalda el pago.',
    cuando: 'Cuando llega el material y la factura viene después.',
  },
  {
    clase: 'Recibo',
    tipo: 'gasto',
    paraQue: 'Acredita que se pagó, pero no detalla qué se compró.',
    cuando: 'Pagos a personas físicas, honorarios, retribuciones.',
  },
  {
    clase: 'Comprobante de transferencia',
    tipo: 'gasto',
    paraQue: 'El respaldo bancario de que la plata salió. Va junto con la factura, no en lugar de ella.',
    cuando: 'Cada vez que se paga por transferencia.',
  },
]

/** La ficha de una clase, o null si no hay nada escrito para ella. */
export const tipoDocumentoDe = (clase: string | null | undefined): TipoDocumento | null =>
  TIPOS_DOCUMENTO.find(t => t.clase === clase) ?? null

/** Las clases de un lado del circuito, para listarlas juntas. */
export const tiposDe = (tipo: 'emitido' | 'gasto'): TipoDocumento[] =>
  TIPOS_DOCUMENTO.filter(t => t.tipo === tipo)
