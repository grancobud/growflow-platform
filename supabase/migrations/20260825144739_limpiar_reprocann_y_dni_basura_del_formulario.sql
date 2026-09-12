-- El import del formulario guardó, en el campo del NÚMERO de REPROCANN, la
-- opción que la persona eligió en un desplegable. No es un número: es la
-- respuesta a otra pregunta metida en la columna equivocada.
--
-- Son dos textos distintos y NO significan lo mismo, así que no se tratan igual:
--
--   "NO TENGO, QUIERO RECIBIR INFO AL RESPECTO"
--        La persona dice que no tiene REPROCANN. Es una respuesta clara.
--        Estado real: Sin registro.
--
--   "Tengo REPROCANN VIGENTE / VENCIDO/ PENDIENTE"
--        Esto es la ETIQUETA de la pregunta, con las tres opciones juntas. No
--        dice cuál de las tres. No se puede deducir y no se va a inventar:
--        queda Sin registro —que es literalmente cierto, la ONG no tiene
--        registro de su REPROCANN— y la nota pide que se le pregunte.
--
-- En los dos casos el estado "En tramite" era falso: salió de que el campo no
-- estuviera vacío, no de que hubiera un trámite. Y "En tramite" no es inocuo:
-- es el estado que la app deja pasar en una dispensa sin marcarla como entrega
-- sin respaldo.
--
-- NO se tocan los REPROCANN con formato tipo «a1bCde1234567». Parecen raros
-- pero son códigos de credencial reales: son diez fichas, todas con plantas y
-- m² habilitados cargados y varias con entregas hechas.

update public.pacientes
set reprocann_nro = null,
    reprocann_estado = 'Sin registro',
    notas = coalesce(notas || E'\n\n', '')
      || 'REPROCANN limpiado el 25/08/2026. El campo del numero tenia «'
      || reprocann_nro
      || '», que es una opcion del formulario web guardada en la columna'
      || ' equivocada, no un numero. '
      || case
           when reprocann_nro ~* 'NO TENGO'
             then 'La persona declaro que NO tiene REPROCANN, asi que el estado correcto es Sin registro.'
           else 'El texto es la etiqueta de la pregunta con las tres opciones juntas: no dice cual. HAY QUE PREGUNTARLE si su REPROCANN esta vigente, vencido o pendiente, y cargar el numero.'
         end
      || ' Estaba como «En tramite», que es el estado que permite dispensar sin'
      || ' marcar la entrega como sin respaldo.'
where reprocann_nro is not null
  and reprocann_nro !~ '[0-9]{4,}';

-- Un DNI cargado como «0» o «00000000000» es peor que uno vacío: ocupa el lugar
-- de un dato y hace que la ficha parezca identificada cuando no lo está. El de
-- nueve dígitos ya tiene su nota del 24/08 y se deja como está: no se puede
-- deducir el número real y borrarlo perdería la única pista que hay.
update public.pacientes
set dni = null,
    notas = coalesce(notas || E'\n\n', '')
      || 'DNI vaciado el 25/08/2026: figuraba «' || dni || '», que son todos ceros.'
      || ' Un cero no identifica a nadie y hacia que la ficha figurara con documento.'
      || ' Hay que pedirle el DNI a la persona.'
where dni is not null
  and regexp_replace(dni, '\D', '', 'g') <> ''
  and regexp_replace(dni, '\D', '', 'g') ~ '^0+$';
