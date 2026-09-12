-- EL ROL `mostrador` EXISTÍA Y NO PODÍA TRABAJAR.
--
-- Se creó el 02/09/2026 y nunca se ejecutó: los tres usuarios de la instalación
-- son `administrador`. El 03/09 se lo probó por fin **corriendo como el rol** —en
-- una transacción que se revierte, prestándole el rol a un perfil existente, sin
-- crear ninguna cuenta— y contando filas tabla por tabla. El resultado:
--
--   tabla             total   lo que veía mostrador
--   ong_dispensas     1.253   0     ← no podía entregar ni ver lo entregado
--   ong_lotes           109   0     ← el paso 3 del panel salía VACÍO
--   ong_asociados       211   0
--   ong_visitas         947   0     ← una de sus tres tareas
--   ong_caja          1.746   1.746 ✔
--   pacientes           237   237   ✔
--   ong_feedback_clin.    2   0     ✔ correcto: no debe verlo
--
-- Socio habría abierto la sede, visto la caja, y el control de stock —el motivo
-- por el que se hizo todo esto— le habría mostrado que no hay nada que contar.
--
-- ⚠️ POR QUÉ PASÓ, Y ES LA MISMA RAZÓN DE SIEMPRE.
--
-- Las tablas cuyo `select` usa `puede_ver_plata()` funcionaron solas: la
-- migración del 02/09 tocó esa función y listo. Las que fallaron tienen la lista
-- de roles **escrita a mano** en la policy, y a esas hay que ir una por una.
-- Cuando un rol nuevo se suma a un predicado, hereda todo lo que ese predicado
-- gobierna; cuando la policy tiene un array literal, no hereda nada y no avisa.
--
-- LO QUE SE LE DA, Y NO ES MÁS QUE SU DEFINICIÓN. Socio la dictó así:
-- «que abra la sede, tome los valores de las salas, haga control de stock,
-- dinero y pueda hacer las tareas de los botones». Eso es exactamente esto.

-- ── Lo que necesita para el paso 3 y para entregar ─────────────────────────
-- Ver y escribir: entregar, devolver, retirar una reserva, cargar un lote.

drop policy if exists ong_dispensas_ver on public.ong_dispensas;
create policy ong_dispensas_ver on public.ong_dispensas for select using (
  public.mi_rol() = any (array['administrador','administrador_sistema',
    'director_medico','administrativo','auditor','mostrador']));

drop policy if exists ong_dispensas_escribir on public.ong_dispensas;
create policy ong_dispensas_escribir on public.ong_dispensas for all
  using (public.mi_rol() = any (array['administrador','administrador_sistema',
    'director_medico','administrativo','mostrador']))
  with check (public.mi_rol() = any (array['administrador','administrador_sistema',
    'director_medico','administrativo','mostrador']));

drop policy if exists ong_lotes_ver on public.ong_lotes;
create policy ong_lotes_ver on public.ong_lotes for select using (
  public.mi_rol() = any (array['administrador','administrador_sistema',
    'director_medico','administrativo','auditor','mostrador']));

drop policy if exists ong_lotes_escribir on public.ong_lotes;
create policy ong_lotes_escribir on public.ong_lotes for all
  using (public.mi_rol() = any (array['administrador','administrador_sistema',
    'director_medico','administrativo','mostrador']))
  with check (public.mi_rol() = any (array['administrador','administrador_sistema',
    'director_medico','administrativo','mostrador']));

drop policy if exists ong_pedidos_ver on public.ong_pedidos;
create policy ong_pedidos_ver on public.ong_pedidos for select using (
  public.mi_rol() = any (array['administrador','administrador_sistema',
    'director_medico','administrativo','auditor','mostrador']));

drop policy if exists ong_pedidos_escribir on public.ong_pedidos;
create policy ong_pedidos_escribir on public.ong_pedidos for all
  using (public.mi_rol() = any (array['administrador','administrador_sistema',
    'director_medico','administrativo','mostrador']))
  with check (public.mi_rol() = any (array['administrador','administrador_sistema',
    'director_medico','administrativo','mostrador']));

-- ── Anotar una visita ──────────────────────────────────────────────────────
drop policy if exists ong_visitas_ver on public.ong_visitas;
create policy ong_visitas_ver on public.ong_visitas for select using (
  public.mi_rol() = any (array['administrador','administrador_sistema',
    'director_medico','administrativo','auditor','mostrador']));

drop policy if exists ong_visitas_escribir on public.ong_visitas;
create policy ong_visitas_escribir on public.ong_visitas for all
  using (public.mi_rol() = any (array['administrador','administrador_sistema',
    'director_medico','administrativo','mostrador']))
  with check (public.mi_rol() = any (array['administrador','administrador_sistema',
    'director_medico','administrativo','mostrador']));

-- ── El padrón societario: LEER Y NADA MÁS ──────────────────────────────────
--
-- Lo necesita para encontrar a la persona y para que la botonera sepa si hay
-- socios activos. **No escribe**: el alta de un asociado se resuelve en
-- Comisión Directiva y se referencia contra un acta. Que la dé de alta quien
-- atiende el mostrador sería saltear el acto que la habilita.
drop policy if exists ong_asociados_ver on public.ong_asociados;
create policy ong_asociados_ver on public.ong_asociados for select using (
  public.mi_rol() = any (array['administrador','administrador_sistema',
    'director_medico','administrativo','auditor','mostrador']));

-- ── El paso 1: cargar la lectura de la sala ────────────────────────────────
--
-- Es la razón de ser del rol y era lo único que no podía hacer. Ojo: se suma a
-- `ambiente_lecturas` y **no** a `ambiente_salas` — cargar una lectura es operar
-- la sede; crear una sala es armar la instalación, y eso no es del mostrador.
drop policy if exists ambiente_lecturas_escribir on public.ambiente_lecturas;
create policy ambiente_lecturas_escribir on public.ambiente_lecturas for all
  using (public.mi_rol() = any (array['administrador','administrador_sistema',
    'cultivador','director_cultivo','mostrador']))
  with check (public.mi_rol() = any (array['administrador','administrador_sistema',
    'cultivador','director_cultivo','mostrador']));

-- ── «Dinero»: asentar en caja, y el comprobante que lo respalda ────────────
--
-- `ong_documentos` va junto con `ong_caja` a propósito: Socio le pidió a Socio
-- que registre los gastos, y un gasto sin su comprobante es medio registro. Es
-- la misma decisión que ya se había tomado al dejarle visible la pestaña.
drop policy if exists ong_caja_escribir on public.ong_caja;
create policy ong_caja_escribir on public.ong_caja for all
  using (public.mi_rol() = any (array['administrador','administrador_sistema',
    'administrativo','mostrador']))
  with check (public.mi_rol() = any (array['administrador','administrador_sistema',
    'administrativo','mostrador']));

drop policy if exists ong_documentos_escribir on public.ong_documentos;
create policy ong_documentos_escribir on public.ong_documentos for all
  using (public.mi_rol() = any (array['administrador','administrador_sistema',
    'administrativo','mostrador']))
  with check (public.mi_rol() = any (array['administrador','administrador_sistema',
    'administrativo','mostrador']));

-- Y el archivo del comprobante, que vive en el bucket y tiene su propia lista.
drop policy if exists documentos_escribir on storage.objects;
create policy documentos_escribir on storage.objects for insert with check (
  bucket_id = 'documentos'
  and public.mi_rol() = any (array['administrador','administrador_sistema',
    'director_medico','administrativo','mostrador']));
