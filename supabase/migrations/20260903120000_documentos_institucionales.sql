-- LOS PAPELES QUE CONSTITUYEN A LA ENTIDAD: estatuto, acta, matrícula, poder.
--
-- Lo pidió Gastón el 03/09/2026 con el acta en la mano: «¿Dónde podría cargar
-- el estatuto? Descargué el de la coop, aunque no esté operativa el estatuto
-- está vigente».
--
-- Y la respuesta era: en ningún lado. `ong_documentos` tiene
-- `check (tipo in ('emitido','gasto'))`, y el estatuto no es ninguno de los
-- dos: no lo emite la asociación a nombre de alguien, y no respalda que salió
-- plata. La base lo rechazaba.
--
-- ⚠️ POR QUÉ TABLA APARTE Y NO UN TERCER `tipo` EN `ong_documentos`.
--
-- Tres razones, y la primera es la que decide:
--
-- 1. La vista `v_saldo_ordenes` agrupa por `ong_documentos.numero` cualquier
--    fila con `numero` y `monto` no nulos, y la trata como una orden de
--    servicio con saldo. Una matrícula cargada como «Nº 1234» aparecería en el
--    saldo de proveedores. El estatuto contaminaría la plata.
-- 2. El permiso es el contrario. `ong_documentos` se ve con
--    `puede_ver_plata()`; el estatuto es institucional y lo tiene que poder
--    leer el director médico, que NO ve la plata. Mismo criterio que
--    `ong_entidad`, `ong_actas` y `ong_autoridades`, y por eso copia su RLS.
-- 3. No comparte ni un campo con un comprobante: no tiene monto, ni rubro, ni
--    proveedor, ni asociado, ni dispensa que respalde.

create table if not exists public.ong_documentos_institucionales (
  id            uuid primary key default gen_random_uuid(),
  -- Qué papel es. Cerrado a propósito: son los que existen, y un texto libre
  -- acá deja «Estatuto», «estatuto» y «ESTATUTO» como tres papeles distintos.
  tipo          text not null check (tipo in (
                  'Estatuto', 'Acta constitutiva', 'Reglamento interno',
                  'Matrícula / Resolución', 'Poder / Autorización',
                  'Reforma de estatuto', 'Otro')),
  titulo        text not null,
  -- El número del organismo, tal como viene. Para el acta de la asociación es
  -- «ACTA-2023-143072795-APN-DTD#JGM»: no es un número, es un identificador
  -- con letras y almohadilla, así que va como texto.
  numero        text,
  -- Nullable porque el sistema NUNCA frena al operador: quien tiene el PDF a
  -- mano puede no saber la fecha del acto, y trabarlo ahí garantiza que el
  -- papel no se suba nunca.
  fecha         date,
  /*
   * ⚠️ `vigente` NO ES `activo`.
   *
   * Es la distinción exacta que trajo Gastón: la cooperativa no está
   * operativa y el estatuto SÍ está vigente. Un estatuto deja de estar
   * vigente cuando se lo reforma, no cuando la entidad para de operar — y por
   * eso hay un tipo «Reforma de estatuto» que apunta al mismo lugar.
   */
  vigente       boolean not null default true,
  /*
   * De qué persona jurídica es este papel.
   *
   * Nace nullable y con motivo: el acta que se carga hoy es de la
   * COOPERATIVA DE TRABAJO «la asociación» LIMITADA, que no es la misma persona
   * jurídica que la entidad que opera en la app. Sin este campo, el estatuto
   * de la coop quedaría archivado como si fuera el de la asociación, que es
   * justo la confusión que un registro institucional tiene que evitar.
   * Vacío se lee como «la entidad de esta instalación».
   */
  persona_juridica text,
  -- Path en el bucket privado `documentos`, bajo el prefijo `institucional/`.
  -- Nunca una URL pública: se pide firmada (ver lib/archivos.ts).
  archivo_path  text,
  archivo_nombre text,
  notas         text,
  user_id       uuid references auth.users (id) on delete set null,
  creado_en     timestamptz not null default now()
);

create index if not exists ong_docs_inst_tipo_idx
  on public.ong_documentos_institucionales (tipo);
create index if not exists ong_docs_inst_fecha_idx
  on public.ong_documentos_institucionales (fecha desc nulls last);

alter table public.ong_documentos_institucionales enable row level security;

-- Copia literal del RLS de `ong_entidad` / `ong_actas` / `ong_autoridades`: lo
-- ve cualquiera con un perfil de verdad, lo escribe la administración. El
-- auditor lee y no toca, que es el punto de que exista un auditor.
drop policy if exists ong_docs_inst_ver on public.ong_documentos_institucionales;
create policy ong_docs_inst_ver on public.ong_documentos_institucionales
  for select using (public.mi_rol() not in ('sin_perfil', 'demo'));

drop policy if exists ong_docs_inst_escribir on public.ong_documentos_institucionales;
create policy ong_docs_inst_escribir on public.ong_documentos_institucionales
  for all using (public.mi_rol() in ('administrador', 'administrador_sistema', 'administrativo'))
  with check (public.mi_rol() in ('administrador', 'administrador_sistema', 'administrativo'));

-- ⚠️ `anon` HEREDA LOS GRANTS DEL ESQUEMA. Sin este revoke la tabla queda
-- legible desde la clave pública del navegador aunque el RLS diga otra cosa
-- para los logueados. Ya pasó con `arqueos` y con `planes_cultivo` el 02/09.
revoke all on public.ong_documentos_institucionales from anon;
grant select, insert, update, delete
  on public.ong_documentos_institucionales to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- El archivo: mismo bucket `documentos`, prefijo `institucional/`.
--
-- Reusa el bucket en vez de crear otro porque la máquina de URLs firmadas ya
-- está escrita para él. Pero las políticas del bucket están atadas a los
-- roles de plata, así que el prefijo institucional necesita las suyas: si no,
-- el director médico ve la FICHA del estatuto y no puede abrir el PDF, que es
-- peor que no verlo — una pantalla que promete un archivo y falla al tocarlo.

drop policy if exists documentos_institucional_ver on storage.objects;
create policy documentos_institucional_ver on storage.objects
  for select using (
    bucket_id = 'documentos'
    and name like 'institucional/%'
    and public.mi_rol() not in ('sin_perfil', 'demo'));

drop policy if exists documentos_institucional_escribir on storage.objects;
create policy documentos_institucional_escribir on storage.objects
  for insert with check (
    bucket_id = 'documentos'
    and name like 'institucional/%'
    and public.mi_rol() in ('administrador', 'administrador_sistema', 'administrativo'));

drop policy if exists documentos_institucional_borrar on storage.objects;
create policy documentos_institucional_borrar on storage.objects
  for delete using (
    bucket_id = 'documentos'
    and name like 'institucional/%'
    and public.mi_rol() in ('administrador', 'administrador_sistema'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Y de paso, un agujero que estaba al lado: `administrador_sistema` podía
-- escribir la FILA de `ong_documentos` (su RLS lo incluye) pero no subir el
-- archivo al bucket (`documentos_escribir` no lo nombraba). Cargar un
-- comprobante le fallaba recién en el upload, después de llenar el formulario.
drop policy if exists documentos_escribir on storage.objects;
create policy documentos_escribir on storage.objects
  for insert with check (
    bucket_id = 'documentos'
    and public.mi_rol() in (
      'administrador', 'administrador_sistema', 'director_medico', 'administrativo'));

drop policy if exists documentos_ver on storage.objects;
create policy documentos_ver on storage.objects
  for select using (
    bucket_id = 'documentos'
    and public.mi_rol() in (
      'administrador', 'administrador_sistema', 'director_medico',
      'administrativo', 'auditor'));
