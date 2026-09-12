import { describe, it, expect } from 'vitest'
import { ROLES_ASIGNABLES, etiquetaDeRol, cuandoEntro, sePuedeEliminar,
  TABLAS_CON_AUTOR, contarEnCastellano } from '../usuarios'
import { PERMISOS_ROL } from '../../hooks/useAuth'
import { loQueFaltaEnLaClave, LARGO_MINIMO_CLAVE } from '../clave'

// Los roles que la pantalla ofrece.
//
// El invariante que importa: los que se ofrecen tienen que existir de verdad en
// `PERMISOS_ROL`. Ofrecer un rol que ese mapa no conoce deja a la persona sin un
// solo permiso —`tienePermiso` devuelve false— o sea con una cuenta que entra y
// no ve nada, sin ningun error que lo explique.
describe('ROLES_ASIGNABLES', () => {
  it('no ofrece los dos roles viejos', () => {
    // `operador` y `supervisor` se conservan en PERMISOS_ROL para las filas que
    // ya los tienen, pero repartirlos de nuevo seria seguir creciendo sobre algo
    // que quedo viejo.
    const ids = ROLES_ASIGNABLES.map(r => r.id)
    expect(ids).not.toContain('operador')
    expect(ids).not.toContain('supervisor')
  })

  it('ofrece administrador, que es el unico que puede sumar a otro', () => {
    expect(ROLES_ASIGNABLES.map(r => r.id)).toContain('administrador')
  })

  it('cada rol dice que ve, y no con una linea vacia', () => {
    for (const r of ROLES_ASIGNABLES) {
      expect(r.label.length).toBeGreaterThan(2)
      expect(r.que.length).toBeGreaterThan(20)
    }
  })

  // «Administrador de sistema» ve TODO. Nacio como «todo menos la caja» y se
  // cambio el mismo dia: el nombre dice lo que hace.
  it('«administrador de sistema» esta en la lista y administra', () => {
    const r = ROLES_ASIGNABLES.find(x => x.id === 'administrador_sistema')!
    expect(r).toBeDefined()
    expect(PERMISOS_ROL.administrador_sistema).toContain('gestionar_usuarios')
    expect(PERMISOS_ROL.administrador_sistema).toContain('ver_plata')
    expect(PERMISOS_ROL.administrador_sistema).toContain('ver_clinico')
  })

  // Hoy es IDENTICO a `administrador`, y esto lo deja fijado: el dia que alguien
  // le agregue un permiso a uno solo, este test avisa que hay que decidir si es
  // a proposito. Sin esto, los dos roles se separan sin que nadie se entere.
  it('es exactamente igual a administrador', () => {
    expect([...PERMISOS_ROL.administrador_sistema].sort())
      .toEqual([...PERMISOS_ROL.administrador].sort())
  })

  // LAS TRES DECISIONES DEL 31/08/2026.
  //
  // Estan fijadas acá porque las tres viven en DOS lados —este mapa y el RLS de
  // Postgres— y tocar uno solo deja una pantalla que se muestra contra una base
  // que devuelve cero, que es como se ve un permiso mal hecho: rota, no
  // prohibida. Si alguno de estos tres cae, el que lo rompio tiene que ir a
  // mirar tambien `puede_ver_padron()` y `puede_ver_plata()`.
  it('el administrativo ve el padron: es el que lleva las cuotas', () => {
    // Veia 1.248 entregas y no podia decir de quien era ninguna.
    expect(PERMISOS_ROL.administrativo).toContain('ver_clinico')
    // En la base esto es `puede_ver_padron()`, NO `puede_ver_clinico()`: el
    // seguimiento clinico (`ong_feedback_clinico`) sigue sin abrirsele.
    expect(PERMISOS_ROL.administrativo).toContain('ver_plata')
  })

  it('el director medico no ve plata, ni la caja ni los comprobantes', () => {
    // `ong_documentos` lo tenia agregado a mano: 1.551 filas, $X,X M, con las
    // retribuciones de los socios. Se cerro. No hay mitad clinica ahi.
    expect(PERMISOS_ROL.director_medico).not.toContain('ver_plata')
    expect(PERMISOS_ROL.director_medico).not.toContain('editar_plata')
    expect(PERMISOS_ROL.director_medico).not.toContain('ver_econometria')
    // Lo que si tiene que seguir viendo.
    expect(PERMISOS_ROL.director_medico).toContain('ver_clinico')
  })

  it('la demo no ve plata ni administra: solo mira pantallas vacias', () => {
    // Y en la base ya no ve `ong_entidad`, que tenia el CUIT, el domicilio y el
    // codigo de vinculacion de REPROCANN.
    expect(PERMISOS_ROL.demo).not.toContain('ver_plata')
    expect(PERMISOS_ROL.demo).not.toContain('gestionar_usuarios')
    expect(PERMISOS_ROL.demo).not.toContain('ver_clinico')
  })

  // El texto que se lee al elegir el rol en la pantalla de Usuarios es lo unico
  // que mira quien reparte accesos. Que quede viejo es como se reparte un
  // permiso que no es el que se cree estar dando: hasta el 31/08 decia que el
  // administrativo veia «a los pacientes por nombre, sin ficha» y no veia
  // ninguno.
  it('lo que dice cada rol coincide con lo que hace', () => {
    const de = (id: string) => ROLES_ASIGNABLES.find(r => r.id === id)!.que
    expect(de('administrativo')).toContain('padrón completo')
    expect(de('administrativo')).not.toContain('sin ficha')
    expect(de('director_medico')).toContain('no ve plata')
  })

  // EL ROL «DIRECTOR DE CULTIVO» (31/08/2026).
  //
  // Es el responsable tecnico de la Res. 1780: el cultivador MAS lo que hay que
  // firmar por el cultivo. Lo que lo hace posible es `ver_cumplimiento`: sin
  // ese permiso separado, darle Declaraciones le habria abierto tambien
  // Pacientes, Solicitudes, Asociados, Portal y Dispensas.
  it('el director de cultivo trabaja la sala Y firma por ella', () => {
    const p = PERMISOS_ROL.director_cultivo
    // Todo lo del cultivador.
    for (const x of PERMISOS_ROL.cultivador) expect(p).toContain(x)
    // Y lo suyo.
    expect(p).toContain('ver_ong')
    expect(p).toContain('ver_cumplimiento')
  })

  it('el director de cultivo NO ve la O.N.G. entera, ni plata, ni fichas', () => {
    const p = PERMISOS_ROL.director_cultivo
    // Esta es LA linea del rol. Con `ver_institucional` seria otro auditor.
    expect(p).not.toContain('ver_institucional')
    expect(p).not.toContain('ver_clinico')
    expect(p).not.toContain('ver_plata')
    expect(p).not.toContain('editar_plata')
    expect(p).not.toContain('gestionar_usuarios')
  })

  it('se puede asignar y se puede borrar', () => {
    expect(ROLES_ASIGNABLES.map(r => r.id)).toContain('director_cultivo')
    // No es administrador, asi que no esta protegido del borrado.
    expect(sePuedeEliminar({ rol: 'director_cultivo' })).toBe(true)
  })

  it('no repite ids', () => {
    const ids = ROLES_ASIGNABLES.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // Un rol viejo que quedo en una fila tiene que poder mostrarse igual: la
  // pantalla lo agrega como opcion suelta, pero la etiqueta sale de aca.
  it('un rol que no esta en la lista se muestra tal cual', () => {
    expect(etiquetaDeRol('supervisor')).toBe('supervisor')
    expect(etiquetaDeRol('administrador')).toBe('Administrador')
  })
})

// «Nunca entro» es la respuesta util: es el estado de alguien invitado que
// todavia no acepto, que es lo que hay que mirar cuando dice que no le llego.
describe('cuandoEntro', () => {
  const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString()

  it('sin fecha dice que nunca entro, y no un guion', () => {
    expect(cuandoEntro(null)).toBe('nunca entró')
  })

  it('cuenta los dias', () => {
    expect(cuandoEntro(hace(0))).toBe('hoy')
    expect(cuandoEntro(hace(1))).toBe('ayer')
    expect(cuandoEntro(hace(5))).toBe('hace 5 días')
  })

  it('pasa a meses cuando los dias dejan de decir algo', () => {
    expect(cuandoEntro(hace(30))).toBe('hace un mes')
    expect(cuandoEntro(hace(95))).toBe('hace 3 meses')
  })
})

// La clave que se pide al entrar por invitacion.
describe('loQueFaltaEnLaClave', () => {
  it('pide mas que el minimo de GoTrue', () => {
    // GoTrue acepta 6. Estas cuentas ven el padron entero y la caja.
    expect(LARGO_MINIMO_CLAVE).toBeGreaterThan(6)
    expect(loQueFaltaEnLaClave('1234567', '1234567')).toContain('8')
  })

  it('exige que las dos coincidan', () => {
    expect(loQueFaltaEnLaClave('unaclavelarga', 'otraclavelarga')).toBe('Las dos no coinciden.')
  })

  it('con una clave valida no falta nada', () => {
    expect(loQueFaltaEnLaClave('unaclavelarga', 'unaclavelarga')).toBeNull()
  })

  // El motivo se muestra en pantalla: un booleano deja a la persona probando
  // tres veces sin entender que quiere el formulario.
  it('devuelve el motivo y no un booleano', () => {
    expect(typeof loQueFaltaEnLaClave('a', 'a')).toBe('string')
  })
})

// Eliminar vs desactivar: la linea que separa las dos cosas.
//
// La barrera del borrado es el ROL desde el 31/08/2026. Antes era «nunca entro»,
// para no perder la firma de quien cargo algo; Gaston decidio abrirlo.
//
// Lo que sostiene esa preocupacion ahora no es este booleano sino el aviso que
// cuenta cuantas filas quedan sin autor, y que las FK de `ong_lotes` y
// `ong_pedidos` dejaron de ser CASCADE: lo eran, y borrar la cuenta de la
// asociacion habria borrado los 105 lotes.
describe('sePuedeEliminar', () => {
  it('a un administrador, NO: es la cuenta de la asociacion', () => {
    expect(sePuedeEliminar({ rol: 'administrador' })).toBe(false)
  })

  // Los dos roles son identicos en permisos. La diferencia es cual es la cuenta
  // de la entidad y cual una persona que administra, y se juega justo aca.
  it('a un administrador de sistema, SI: es una persona', () => {
    expect(sePuedeEliminar({ rol: 'administrador_sistema' })).toBe(true)
  })

  it('al resto, si', () => {
    for (const rol of ['administrativo', 'cultivador', 'director_medico', 'auditor', 'demo'])
      expect(sePuedeEliminar({ rol })).toBe(true)
  })

  // Un rol que este mapa no conoce NO se vuelve imborrable. La barrera dice
  // quien esta protegido, no quien esta permitido: al reves, un rol viejo como
  // `supervisor` quedaria trabado sin que nadie entienda por que.
  it('un rol viejo o desconocido no queda trabado', () => {
    expect(sePuedeEliminar({ rol: 'supervisor' })).toBe(true)
    expect(sePuedeEliminar({})).toBe(true)
  })
})

// Que se pierde al borrar, dicho antes de confirmar.
describe('contarEnCastellano', () => {
  it('no escribe «1 lotes»', () => {
    expect(contarEnCastellano(1, 'lote')).toBe('1 lote')
    expect(contarEnCastellano(3, 'lote')).toBe('3 lotes')
    expect(contarEnCastellano(0, 'entrega')).toBe('0 entregas')
  })

  it('las tablas que se cuentan son las que un libro tiene que mostrar', () => {
    const tablas = TABLAS_CON_AUTOR.map(t => t.tabla)
    expect(tablas).toContain('ong_lotes')
    expect(tablas).toContain('ong_dispensas')
    expect(tablas).toContain('ong_caja')
    // Cada una dice COMO se llama lo que cuenta, o el aviso saldria en jerga.
    for (const t of TABLAS_CON_AUTOR) expect(t.que.length).toBeGreaterThan(3)
  })
})
