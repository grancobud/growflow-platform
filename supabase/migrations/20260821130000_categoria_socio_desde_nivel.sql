-- Categoria de socio: la que corresponde por tarifa, y solo a quien la puede tener.
-- SOLO PARA LA BASE DE ASOCIACION.
--
-- Los 211 asociados tenian `categoria` en NULL, asi que el Libro de Asociados
-- listaba a todo el mundo como "Sin categoria" y la pantalla no podia filtrar
-- por ninguna.
--
-- EL DATO YA ESTABA, EN OTRA TABLA. `ong_categorias_socio` define cada
-- categoria por su tarifa de reembolso, y lo dice en sus propias notas:
--
--   Nivel 1 - Estandar     $XX.XXX/g
--   Nivel 2 - Intermedio   $XX.XXX/g
--   Nivel 3 - Frecuente    $XX.XXX/g
--
-- y `pacientes.nivel_tarifa` guarda exactamente esos tres precios con otros
-- nombres (nuevo / antiguo / frecuente, ver `ong_tarifas`). Es el mismo dato
-- escrito dos veces: no hay nada que inventar, hay que ligarlo.
--
-- POR QUE SE PUEDE CONFIAR EN `nivel_tarifa`. No se asume: se verifico contra
-- lo que cada persona efectivamente pago. De los 102 pacientes con entregas,
-- 42 pagaron siempre un unico precio de la tabla de tarifas, y en los 42 el
-- precio pagado coincide con el nivel que tienen cargado. 42 de 42, sin una
-- sola discrepancia. Los otros 60 mezclan precios —el nivel les cambio en el
-- ano, o hubo ajustes— pero eso no invalida el nivel de hoy, que es el que se
-- usa aca.
--
-- SOLO SE CATEGORIZA A LOS 70 CON REPROCANN. Las tres categorias tienen
-- `requiere_reprocann = true`: son categorias que, por como estan definidas, no
-- se le pueden asignar a alguien sin REPROCANN vigente. Los 141 asociados "Sin
-- registro" quedan en NULL a proposito. Ese hueco NO es un dato que falta: es
-- el dato. Dice que dos de cada tres asociados no encuadran en ninguna
-- categoria estatutaria, que es exactamente lo que hay que poder ver y lo que
-- se taparia si se les pusiera "Nivel 1" para que la lista quede prolija.
--
-- El join va contra `ong_categorias_socio` por nombre en vez de escribir el
-- texto a mano: si manana se renombra una categoria, la fila no se actualiza y
-- queda el hueco visible, en lugar de quedar apuntando a una categoria que ya
-- no existe. Los tres nombres son unicos en la tabla (verificado).
--
-- RESULTADO: 0 -> 70 asociados con categoria (53 Nivel 1, 9 Nivel 2, 8 Nivel 3).
-- Los 141 restantes siguen sin categoria, y esa es la respuesta correcta.
update public.ong_asociados a
set categoria = c.nombre
from public.pacientes p, public.ong_categorias_socio c
where a.paciente_id = p.id
  and a.categoria is null
  and a.vinculado_reprocann is true
  and c.requiere_reprocann is true
  and c.nombre = case p.nivel_tarifa
        when 'nuevo'     then 'Nivel 1 - Estandar'
        when 'antiguo'   then 'Nivel 2 - Intermedio'
        when 'frecuente' then 'Nivel 3 - Frecuente'
      end;
