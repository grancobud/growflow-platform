# GrowFlow

**Del esqueje al recibo firmado.** Trazabilidad de cultivo de cannabis medicinal y gestión de la asociación civil que lo ampara, en un solo sistema: las plantas, lo que cuesta producirlas, a quién se le entrega y los papeles que eso exige.

Este repositorio es la **versión pública** del sistema. Contiene el código completo y el esquema de base de datos, **sin datos de ninguna organización real**: los códigos de paciente, DNI y números de registro que aparecían en comentarios de las migraciones fueron reemplazados por marcadores, y las migraciones que sólo corregían datos de una instalación concreta no están incluidas.

---

## Qué resuelve

Una asociación civil que cultiva cannabis medicinal en Argentina tiene que sostener tres cosas a la vez, y las tres se pisan:

1. **El cultivo.** Cada planta viene de un esqueje, pasa por vegetativo y floración, se cosecha y se convierte en gramos. Si no sabés de qué madre salió cada una, no tenés genética trazable.
2. **La entrega.** Cada gramo va a un paciente con REPROCANN vigente. Si no podés reconstruir qué lote recibió quién, no tenés trazabilidad inversa.
3. **El papelerío.** Res. 1780/2025 y Ley 27.350: nómina de usuarios, informes semestrales, informe del director médico, cromatografías por lote. El certificado vale un año.

GrowFlow sostiene las tres sobre el mismo dato, para que no haya tres planillas que se contradicen.

---

## Decisiones que vale la pena mirar

### El control de acceso vive en la base, no en la interfaz

Los permisos se implementan como políticas de **Row Level Security de Postgres**. Esconder un ítem del menú es UX; no es una barrera. Si alguien evita la interfaz y pega directo contra la API, lo que decide es el RLS.

Las migraciones documentan cada decisión de seguridad **con su medición**. Ejemplo real, del repositorio original:

```sql
-- resumen_plantas corría como SECURITY DEFINER: se salteaba las RLS de las
-- tablas base. Con GRANT SELECT al rol `anon` y la anon key horneada en el
-- bundle público, cualquiera leía las plantas SIN LOGUEARSE, incluida la
-- columna paciente_nombre. Medido: anon veía 45 filas; ahora ve 0.
alter view public.resumen_plantas set (security_invoker = on);
```

"Lo arreglé" no es verificable. "Anon veía 45 filas, ahora ve 0" sí.

### Estructura de validación GAMP5

El sistema incluye el set documental de validación: plan de validación, URS con más de 60 requerimientos, especificación funcional y de diseño, FMEA de riesgos, protocolos IQ/OQ/PQ y matriz de trazabilidad, más una auto-auditoría que corre desde la propia aplicación.

> **El sistema no está validado formalmente.** Está construido para poder validarse. La diferencia es que validar exige ejecutar los protocolos, cerrar desvíos y que Calidad apruebe el informe. Eso no ocurrió.

### Registro append-only

Las operaciones no se editan ni se borran: se corrigen con un asiento nuevo que referencia al anterior. Un registro que se puede reescribir no sirve ante una inspección.

---

## Cómo está construido

Este sistema está construido con **Claude Code** sobre el repositorio real. El trabajo
es definir el problema, decidir la arquitectura y verificar el resultado contra los
datos y la operación reales antes de que llegue a producción.

Por eso las migraciones están comentadas como están: cuando el criterio de aceptación
es un número medido —"anon veía 45 filas, ahora ve 0"— la decisión queda verificable
por cualquiera que lea el repositorio, y no depende de acordarse de por qué se hizo.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 · TypeScript · Vite |
| Base de datos | PostgreSQL vía Supabase, con RLS |
| Backend | Supabase Edge Functions (Deno) |
| Hosting | Cloudflare Pages |
| Integraciones | Cloudflare Workers para sensores de ambiente |

---

## Cómo levantarlo

```bash
git clone <este-repo> && cd growflow/app
npm install
cp .env.example .env
```

Completá `.env` con las credenciales de tu propio proyecto de Supabase. Después:

```bash
npm run dev
```

### Base de datos

```bash
supabase link --project-ref <tu-project-ref>
supabase db push
```

Las migraciones están en `supabase/migrations/`, en orden cronológico. Crean el esquema completo: plantas, lotes, pacientes, entregas, caja, stock, ambiente y las políticas de RLS.

### Modo demo

La aplicación trae un modo demo con datos sintéticos (`app/src/lib/demo/`), útil para recorrer el sistema sin conectar una base real. Los nombres, códigos y cantidades que aparecen ahí son inventados.

---

## Estructura

```
app/src/
  pages/          pantallas
  components/     componentes de UI
  lib/            lógica de dominio, cálculos, integraciones
  lib/demo/       datos sintéticos del modo demo
supabase/
  migrations/     esquema y políticas, en orden cronológico
  functions/      Edge Functions
```

---

## Sobre los datos

Este repositorio **no contiene información de pacientes, socios ni operaciones reales**. Si encontrás algo que parezca un dato real, es un error y te agradezco el aviso.

Las instalaciones en producción viven en repositorios privados, precisamente porque manejan datos de salud de personas identificables.

---

## Licencia

Ver `LICENSE`.
