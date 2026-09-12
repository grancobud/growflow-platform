-- Las tres decisiones que quedaron abiertas al cerrar el 30/08/2026.
--
-- Decididas por Gaston el 31/08/2026. Cada una responde una pregunta distinta y
-- van juntas porque las tres mueven la misma superficie: quien lee que.
--
-- Verificado antes de escribir esto, ejecutando contra la base:
--   · `pacientes` leia `puede_ver_clinico()`  -> administrativo recibia 0 filas
--   · `ong_documentos` leia `puede_ver_plata() or director_medico`
--   · `ong_entidad` leia `mi_rol() <> 'sin_perfil'`  -> demo entraba
--
-- ---------------------------------------------------------------------------
-- 1. EL ADMINISTRATIVO VE EL PADRON COMPLETO
--
-- Es el rol que lleva cuotas y caja, o sea el que tiene que saber quien pago.
-- Veia 1.248 entregas y no podia decir de quien era ninguna, porque
-- `pacientes` estaba en `puede_ver_clinico()`. Y la pestana Pacientes NO esta
-- filtrada por permiso —solo lo estan Usuarios y las de plata—, asi que la
-- pantalla se le mostraba VACIA, que es como se ve una pantalla rota, no una
-- prohibida.
--
-- POR QUE UNA FUNCION NUEVA Y NO SUMARLO A `puede_ver_clinico()`.
-- Esa funcion tambien gobierna `ong_feedback_clinico`, que es el seguimiento
-- medico: sumarlo ahi le abriria los reportes de salud de paso, sin que nadie
-- lo haya pedido. `puede_ver_padron()` separa las dos cosas: el padron —quien
-- es, como se contacta, cuanto puede retirar— del dato clinico.
--
-- Son ahora CINCO funciones las que deciden todo, no cuatro:
--   mi_rol() · es_admin() · puede_ver_plata() · puede_ver_clinico()
--   · puede_ver_padron()
create or replace function public.puede_ver_padron()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select public.puede_ver_clinico() or public.mi_rol() = 'administrativo';
$$;

revoke all on function public.puede_ver_padron() from public;
grant execute on function public.puede_ver_padron() to authenticated;

-- Las tres de `pacientes` pasan a la funcion nueva. Va tambien en escritura:
-- la pestana no esconde el boton de editar —ningun permiso de la UI lo hace,
-- el clinico es RLS y nada mas—, asi que dejarlo solo en lectura le pinta un
-- boton que falla al guardar. Un boton que existe y no funciona es peor que uno
-- que no esta.
alter policy pacientes_ver_ficha on public.pacientes
  using (public.puede_ver_padron());

alter policy pacientes_escribir on public.pacientes
  with check (public.puede_ver_padron());

alter policy pacientes_actualizar on public.pacientes
  using (public.puede_ver_padron())
  with check (public.puede_ver_padron());

-- `ong_feedback_clinico` NO se toca: sigue en `puede_ver_clinico()`. Es la
-- linea que separa esta decision de «el administrativo ve datos de salud».

-- ---------------------------------------------------------------------------
-- 2. EL DIRECTOR MEDICO NO VE PLATA, Y ESO INCLUYE LOS RECIBOS
--
-- El `or mi_rol() = 'director_medico'` del 30/08 no agregaba un acceso: le
-- conservaba uno que ya tenia. La tabla tiene $152,8M en 1.551 comprobantes.
--
-- SE MIRO SI HABIA UNA MITAD CLINICA QUE PRESERVAR Y NO LA HAY. Las 1.551
-- filas tienen monto, las 1.551:
--   · `emitido`  847 filas · $58,9M · recibos de reembolso, uno por paciente
--   · `gasto`    704 filas · $93,9M · Aprovisionamiento $57,6M, Gasto Operativo
--                                     $19,4M, Retribucion $16,8M (los retiros
--                                     de los socios)
-- Las credenciales de REPROCANN y los informes NO viven aca: estan en columnas
-- de `pacientes` y en el bucket `documentos`. Cerrar esta tabla no le saca ni
-- un dato clinico.
--
-- Gaston lo definio asi: que vea todo de los pacientes y nada de plata. Los
-- recibos de reembolso son plata, aunque tengan un paciente al lado, asi que
-- tambien salen. Queda en 0 de 1.551.
--
-- NO ROMPE NINGUNA PANTALLA: `documentos` ya esta en `TABS_DE_PLATA`, o sea que
-- la pestana no se le mostraba desde antes. Esto alinea la base con la UI, que
-- es al reves del error tipico —la pantalla abierta y la base cerrada—.
alter policy ong_documentos_ver on public.ong_documentos
  using (public.puede_ver_plata());

-- Y la escritura tambien: si no puede leerlos, cargarlos no significa nada.
alter policy ong_documentos_escribir on public.ong_documentos
  using (public.mi_rol() = any (array['administrador','administrador_sistema','administrativo']))
  with check (public.mi_rol() = any (array['administrador','administrador_sistema','administrativo']));

-- ---------------------------------------------------------------------------
-- 3. LA CUENTA DEMO NO VE LA ENTIDAD
--
-- `ong_entidad` tiene razon social, CUIT, domicilio, el CODIGO DE VINCULACION
-- de REPROCANN y el director tecnico con su matricula. La demo existe para
-- mostrar pantallas reales VACIAS, no para publicar los datos de la asociacion.
--
-- Hoy esos campos estan en NULL, asi que el cambio no se nota. Es justamente el
-- momento de hacerlo: el dia que se carguen —y hay que cargarlos, es lo que
-- traba el REPROCANN— quedan filtrados solos, sin que nadie se acuerde.
--
-- NO DEJA LA DEMO ROTA: `getEntidad()` devuelve null cuando no hay fila, y la
-- portada cae en «Asociacion civil» (PaginaONG.tsx:461).
--
-- El filtro es contra la lista completa, nunca `<> 'demo'` a secas: `mi_rol()`
-- devuelve 'sin_perfil' para toda cuenta sin perfil o con perfil inactivo.
alter policy ong_entidad_ver on public.ong_entidad
  using (public.mi_rol() <> all (array['sin_perfil','demo']));
