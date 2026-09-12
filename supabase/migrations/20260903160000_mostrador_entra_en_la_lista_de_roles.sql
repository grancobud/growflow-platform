-- EL ROL `mostrador` NO SE PODIA ASIGNAR. La pantalla lo ofrecia y la base lo
-- rechazaba.
--
-- Apareció el 03/09/2026 al hacer por fin lo que el traspaso venía pidiendo:
-- **probar el rol EJECUTANDO como el rol**, y no leyendo definiciones. El
-- primer intento de crear un perfil `mostrador` —dentro de una transacción que
-- se revierte, sin crear ninguna cuenta— murió acá:
--
--   ERROR 23514: new row for relation "perfiles_usuario" violates check
--   constraint "perfiles_usuario_rol_check"
--
-- La migración del 02/09 que creó el rol tocó `puede_ver_plata()` y
-- `puede_ver_padron()`, y su propio encabezado avisa que «este mapa vive en DOS
-- lados». Vivía en cuatro. Faltaban los otros dos, y los dos son los que de
-- verdad dejan entrar a una persona:
--
--   1. este CHECK, que decide qué se puede guardar en la columna;
--   2. la lista `ROLES` de la Edge Function `usuarios-invitar`, que decide qué
--      se puede invitar y que se corrige en el mismo commit.
--
-- ⚠️ ES LA TERCERA VEZ QUE PASA LO MISMO. El 31/08, al sumar
-- `director_cultivo`, se descubrió que `administrador_sistema` —creado el
-- 30/08— nunca había entrado en este CHECK: el rol existía, la pantalla lo
-- ofrecía, y nadie lo había notado porque no se invitó a nadie con ese rol. La
-- lista de roles se olvida SIEMPRE en el lugar que no se ejercita, y el lugar
-- que no se ejercita es siempre el mismo: el alta.
--
-- Socio iba a ser la primera persona con este rol. Crear su cuenta habría
-- fallado dos veces —al invitar y al guardar—, después de elegir «Mostrador» en
-- un desplegable que lo ofrecía.

alter table public.perfiles_usuario drop constraint if exists perfiles_usuario_rol_check;
alter table public.perfiles_usuario add constraint perfiles_usuario_rol_check
  check (rol = any (array[
    'administrador', 'administrador_sistema', 'administrativo', 'mostrador',
    'cultivador', 'director_cultivo', 'director_medico', 'auditor', 'demo']));
