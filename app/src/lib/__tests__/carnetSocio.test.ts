import { describe, it, expect } from 'vitest'
import {
  armarCarnet, estadoDeCredencial, habilitaRetiro, labelCredencial, DIAS_AVISO_CARNET,
} from '../carnetSocio'
import { buscarPorCodigo } from '../buscarPersonas'
import type { Paciente } from '../registro'
import type { Entidad } from '../ong'

const HOY = '2026-09-09'
const ENTIDAD = { razon_social: 'Asoc. Civil Ñandú', cuit: '30-11111111-1' } as Entidad

const pac = (p: Partial<Paciente>): Paciente => ({
  id: 'x', nombre_completo: 'Juan Pablo Dorrego', apellido: 'Dorrego', nombres: 'Juan Pablo',
  activo: true, dni: '30123456', codigo: 'PAC-010',
  reprocann_nro: '148735', reprocann_vencimiento: '2027-01-01',
  ...p,
} as Paciente)

describe('estadoDeCredencial', () => {
  it('mira la FECHA, no el estado guardado', () => {
    // `reprocann_estado` dice «Vigente» hasta que alguien entra a la ficha a
    // cambiarlo, y nadie entra el día que se vence.
    expect(estadoDeCredencial({ reprocann_nro: '1', reprocann_vencimiento: '2026-09-08' }, HOY)).toBe('vencida')
    expect(estadoDeCredencial({ reprocann_nro: '1', reprocann_vencimiento: '2027-01-01' }, HOY)).toBe('vigente')
  })

  it('avisa con 60 días de anticipación', () => {
    expect(DIAS_AVISO_CARNET).toBe(60)
    // 30 días adelante: por vencer.
    expect(estadoDeCredencial({ reprocann_nro: '1', reprocann_vencimiento: '2026-10-09' }, HOY)).toBe('por_vencer')
    // 90 días adelante: todavía vigente.
    expect(estadoDeCredencial({ reprocann_nro: '1', reprocann_vencimiento: '2026-12-09' }, HOY)).toBe('vigente')
  })

  it('el día del vencimiento todavía vale', () => {
    expect(estadoDeCredencial({ reprocann_nro: '1', reprocann_vencimiento: HOY }, HOY)).toBe('por_vencer')
  })

  it('sin número o sin fecha es «sin registro», no «vigente»', () => {
    expect(estadoDeCredencial({ reprocann_vencimiento: '2027-01-01' }, HOY)).toBe('sin_registro')
    expect(estadoDeCredencial({ reprocann_nro: '148735' }, HOY)).toBe('sin_registro')
  })
})

describe('armarCarnet', () => {
  it('el nombre va con el APELLIDO primero', () => {
    expect(armarCarnet(pac({}), ENTIDAD, HOY).nombre).toBe('Dorrego, Juan Pablo')
  })

  it('el QR lleva el código del socio, que es lo que el escáner sabe buscar', () => {
    expect(armarCarnet(pac({}), ENTIDAD, HOY).qr).toBe('PAC-010')
  })

  it('SIN código no hay QR: uno que no lleve nada buscable es un adorno', () => {
    // Es la misma regla que se aplicó al comprobante de dispensación: un QR que
    // no apunta a un sistema real es peor que no ponerlo.
    expect(armarCarnet(pac({ codigo: null }), ENTIDAD, HOY).qr).toBeNull()
  })

  it('dice lo que falta en vez de disimularlo', () => {
    const c = armarCarnet(pac({ dni: null, reprocann_nro: null }), ENTIDAD, HOY)
    expect(c.faltantes).toContain('el DNI')
    expect(c.faltantes).toContain('el número de REPROCANN')
    // Y sale igual: la persona existe y es socia.
    expect(c.nombre).toBe('Dorrego, Juan Pablo')
  })

  it('sin entidad cargada lo reclama, no inventa la razón social', () => {
    const c = armarCarnet(pac({}), null, HOY)
    expect(c.entidad).toBeNull()
    expect(c.faltantes).toContain('la razón social de la entidad')
  })
})

describe('habilitaRetiro', () => {
  it('una credencial vencida NO habilita, aunque el carnet esté completo', () => {
    const c = armarCarnet(pac({ reprocann_vencimiento: '2026-08-01' }), ENTIDAD, HOY)
    expect(c.faltantes).toEqual([])
    expect(habilitaRetiro(c)).toBe(false)
  })

  it('una por vencer todavía habilita: está vigente hasta que no lo esté', () => {
    expect(habilitaRetiro(armarCarnet(pac({ reprocann_vencimiento: '2026-10-09' }), ENTIDAD, HOY))).toBe(true)
  })

  it('faltar el DNI no impide retirar: son dos cosas distintas', () => {
    const c = armarCarnet(pac({ dni: null }), ENTIDAD, HOY)
    expect(c.faltantes.length).toBeGreaterThan(0)
    expect(habilitaRetiro(c)).toBe(true)
  })
})

describe('labelCredencial', () => {
  it('un estado que el front no conoce NO devuelve undefined', () => {
    // La base se migra por SQL y por la Edge Function `ingesta`, y ninguna de
    // las dos pasa por TypeScript.
    expect(labelCredencial('inventado')).toBe(labelCredencial('sin_registro'))
    expect(labelCredencial(null)).toBeTruthy()
  })

  it('el vencido se nombra fuerte, porque es el que importa', () => {
    expect(labelCredencial('vencida')).toContain('VENCIDO')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EL VIAJE ENTERO: carnet emitido → QR → ficha encontrada.
//
// Es la única forma de verificar el escáner sin una cámara. Las dos puntas se
// escribieron por separado —`armarCarnet` pone el código en el QR, el buscador
// lo lee— y si dejan de hablar el mismo idioma el QR del carnet pasa a ser un
// adorno, que es justo lo que no queríamos.
// ─────────────────────────────────────────────────────────────────────────────
describe('del carnet al mostrador', () => {
  const padron = [
    { id: 'a', codigo: 'PAC-010', nombre_completo: 'Juan Pablo Dorrego' },
    { id: 'b', codigo: 'PAC-011', nombre_completo: 'Otra Persona' },
  ]

  it('lo que el carnet imprime en el QR es lo que el escáner encuentra', () => {
    const qr = armarCarnet(pac({}), ENTIDAD, HOY).qr!
    expect(buscarPorCodigo(padron, qr)?.id).toBe('a')
  })

  it('un lector devuelve lo que ve: con espacios y en minúsculas', () => {
    expect(buscarPorCodigo(padron, '  pac-010 ')?.id).toBe('a')
  })

  it('y a veces la URL entera de la que el código es el final', () => {
    expect(buscarPorCodigo(padron, 'https://growflow-demo.pages.dev/s/PAC-010')?.id).toBe('a')
  })

  it('NO devuelve el que más se parece: eso sería entregarle a otra persona', () => {
    expect(buscarPorCodigo(padron, 'PAC-01')).toBeNull()
    expect(buscarPorCodigo(padron, 'PAC-0100')).toBeNull()
  })

  it('un carnet sin código no manda a ninguna ficha', () => {
    expect(armarCarnet(pac({ codigo: null }), ENTIDAD, HOY).qr).toBeNull()
    expect(buscarPorCodigo(padron, '')).toBeNull()
    expect(buscarPorCodigo(padron, '   ')).toBeNull()
  })

  it('y una ficha sin código no la encuentra un QR vacío', () => {
    expect(buscarPorCodigo([{ id: 'c', codigo: null, nombre_completo: 'Sin código' }], '')).toBeNull()
  })
})
