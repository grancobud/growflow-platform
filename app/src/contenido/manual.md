# Manual de operación de GrowFlow

El recorrido completo del sistema en el orden en que se usa de verdad: primero lo
que se configura una sola vez, después el día a día del cultivo, y al final el
circuito de la ONG que termina en una entrega con su recibo.

Está escrito para la operación real, no como lista de funciones. Donde el sistema
bloquea, explica por qué bloquea.

> **¿Vas a abrir la sede?** El capítulo **00a** son los cuatro pasos del Panel: la
> lectura de sala, el control de caja, el control de stock y las novedades. Es la
> rutina de todos los días y no lleva más de un par de minutos.
>
> **¿Es la primera vez que lo abrís?** Andá al capítulo **00b**: es una entrega
> completa de principio a fin, con nombres y números, explicada en palabras
> simples. Con eso ya podés operar.
>
> **¿No encontrás una pantalla?** Puede que tu rol no la tenga. El capítulo
> **00c** dice qué ve cada uno.
>
> **¿Buscás cómo hacer algo puntual?** El capítulo 11 tiene el paso a paso de cada
> tarea con los campos tal como aparecen en pantalla: cargar plantas, cargar costos,
> hacer una reserva, redactar un acta. El buscador de arriba también sirve.

---

## 00 · Cómo está organizado

**Seis entradas en el menú, y dos de ellas agrupan casi todo.** La regla de dónde
vive cada cosa: **lo que pasa con las plantas está en Agronómico, y lo que rinde
cuentas ante alguien —un organismo, un socio, un peso— está en O.N.G.**

| Sección | Qué vive adentro | Para qué se entra |
|---|---|---|
| **Panel** | Una sola pantalla | **La rutina de abrir la sede**: la lectura de sala, la caja, el stock y las novedades del día. |
| **Agronómico** | Sala · Plan · Plantas · Genéticas · Línea de tiempo · Cosecha · Ambiente | Todo lo que le pasa a una planta desde que germina hasta que se corta y se pesa. |
| **O.N.G.** | 21 pestañas en cinco grupos, más Econometría | Pacientes, entregas, plata, libros, actas y todo lo que pide la Resolución 1780. |
| **Estadísticas** | Una sola pantalla | Rendimiento por genética, gramos por vatio, merma de secado. |
| **Tablas** | Una sola pantalla | Los datos crudos de cualquier tabla, editables celda por celda. |
| **Manual** | Una sola pantalla | Esto que estás leyendo. El buscador de arriba encuentra por palabra. |

**Los cinco grupos de O.N.G.**, que son los que ordenan sus veintiuna pestañas:

| Grupo | Pestañas |
|---|---|
| **Panel** | Estado · Coherencia · Usuarios |
| **Institucional** | La entidad · Autoridades · Predios · Libros · Actas |
| **Personas** | Solicitudes · Visitas · Pacientes · Asociados · Cupo REPROCANN · Seguimiento |
| **Operación** | Autodispensación · Dispensas · Proveedores · Movimientos · Economía |
| **Papeles** | Declaraciones · Documentos |

> **El menú cambió el 02/09/2026 y conviene saberlo si lo usabas antes.** Cultivo,
> Cosecha y Ambiente eran tres entradas sueltas y ahora son secciones de
> **Agronómico**; Econometría dejó de estar arriba de todo y pasó a colgar de
> **O.N.G.**, que es donde vive el resto de la plata. Nada se borró: todo está a
> un toque del mismo lugar de siempre, y los links viejos siguen funcionando.

**Tablas es la salida de emergencia.** Cualquier dato que no encuentres cómo
corregir desde su pantalla se edita ahí a mano, celda por celda, y también se
borra fila por fila. Sirve además para exportar e importar. Usala cuando la
pantalla normal no te deja hacer lo que necesitás, no como forma habitual de
cargar.

**Casi todo se corrige sin venir acá.** Los eventos, riegos y aplicaciones se
editan desde la ficha de la planta, con el lápiz de cada fila de la línea de
tiempo; las lecturas de ambiente, con el lápiz de *Últimas lecturas*. Tablas
queda para lo que esas pantallas no muestran: en una aplicación, por ejemplo, el
lápiz edita la fecha y las notas, y el producto o la dosis se cambian acá.

> **El reporte de seguimiento clínico no aparece en Tablas, y es a propósito.**
> Es el único dato del sistema que no se puede editar ni borrar por ningún
> camino (regla RN-07). Ver el capítulo 08.

### Si no sabés por dónde empezar, no busques la pantalla

`O.N.G. › Estado` arranca con **«¿Qué querés hacer?»**: cinco cosas dichas como
las diría una persona, no como se llaman las pantallas.

| Querés | Te lleva a |
|---|---|
| Entregarle a un paciente | Dispensas, con el formulario abierto |
| Sumar a alguien | Pacientes, con la ficha nueva abierta |
| Comprar material | Documentos, en comprobante de gasto |
| Anotar un gasto o un pago | Economía, en el asiento del Libro Diario de Caja |
| Mover material a otro lado | Declaraciones, en el traslado |

**No te deja en la lista: te abre el formulario.** Y cada formulario explica
arriba para qué sirve y qué vas a necesitar tener a mano, con una ayuda debajo de
cada campo que dice **de dónde sale ese dato**, no qué formato tiene.

Ésas son las cinco de todos los días. Debajo hay **«ver todo lo que se puede
hacer»** con las otras trece —cobrar las cuotas del mes, cargar una cosecha, crear
un lote, redactar un acta, presentar la DDJJ, emitir un documento— agrupadas con
los mismos cinco nombres de la barra de pestañas.

### Las tareas que son varios pasos

Ocho de esas acciones no se terminan en una sola pantalla, y **el paso que se
saltea casi siempre es el del medio** —el primero lo pide el sentido común y el
último cierra la tarea, pero el del medio no se nota que falta hasta que algo no
cuadra—:

| Tarea | Pasos | Si te salteás el del medio |
|---|---|---|
| **Entregarle a un paciente** | entrega → **recibo** → seguimiento | El aporte entró sin papel que lo respalde |
| **Anotar un gasto o un pago** | asiento → **comprobante** | El costo por gramo queda sin defensa |
| **Comprar material** | comprobante → **lote** → pago → que la compra haya cerrado | La plata figura y el material no existe para entregar |
| **Sumar a alguien** | ficha → **tope mensual** → alta en acta | El cupo de 30 días no valida nada para esa persona |
| **Mover material** | traslado → **carta de porte por TAD** | El traslado no está amparado |
| **Presentar la DDJJ** | padrón al día → armar → **revisar Coherencia** → marcarla presentada | Se declara con observaciones adentro |
| **Cerrar el mes** | cuotas → **registros del mes** → Coherencia | Es el cruce que más observaciones genera |
| **Poner la asociación en marcha** | entidad → autoridades → predios → libros → padrón | Nada de lo que sigue tiene dónde apoyarse |

**Cada paso ES su formulario, y se abre solo al llegar.** No te deja en la lista
para que busques el botón: la pantalla abre con el formulario del paso puesto
adelante. Al guardar, avanza sola al siguiente, y le lleva lo que el paso anterior
ya sabe —de qué entrega es el recibo, de qué asiento el comprobante— así que no
hay que volver a elegirlo.

> **Hay tres pasos que NO abren el formulario si no saben sobre qué registro.**
> El reporte de seguimiento, el tope mensual y el marcar una DDJJ como presentada
> te llevan a elegir de una lista en vez de abrir el primero que encuentran. No es
> una falla: un seguimiento clínico no se puede editar ni borrar, un tope cargado
> en la ficha equivocada no se ve y deja pasar entregas, y marcar presentado el
> semestre que no es declara algo falso. Ninguna de las tres se puede deshacer.

Al elegirlas aparece **una barra arriba que te acompaña** por las pantallas que
haga falta, marcando en qué paso estás. Cuando cerrás el formulario que acabás de
guardar, la barra está ahí con el paso siguiente como botón, y con el motivo de
por qué importa.

**Los pasos que se pueden verificar se marcan solos.** Si el tope de todos los
pacientes ya está cargado, ese paso aparece tildado sin que hagas nada. Y donde
no se puede saber —cuál comprobante corresponde a cuál compra, por ejemplo— la
barra no inventa un tilde: te dice cuántas cosas de ese tipo quedan sin hacer.

**Al cerrar el formulario, la barra te dice cómo viene la tarea entera.** Abajo
de todo están los pasos del flujo con lo que el sistema ve de cada uno, así no
hay que entrar a cada pantalla para saber si algo quedó colgado:

```
CÓMO VIENE LA TAREA
1  La ficha de la persona
2  El tope mensual        3 pacientes sin tope
✓  El alta en acta        todas las altas están respaldadas
```

```
✓ todos los traslados tienen su carta
⚠ 3 pacientes sin tope
⚠ faltan 250 g en el balance: puede ser un lote sin cargar
```

> **Podés salirte cuando quieras.** Hay un «después lo hago» y una cruz en cada
> paso. Es una guía para quien no sabe el orden, no un riel para quien sí.
>
> El paso vive en la dirección (`?flujo=comprar&paso=2`), así que podés cerrar la
> pestaña y volver, o pasarle el link a otra persona para que siga.

> **Si una acción no se puede hacer todavía, lo dice y te lleva a destrabarla.**
> Sin lotes cargados no se puede entregar, y aparece apagada con el motivo. Sin
> CUIT sí se puede entregar —el material sale igual y hay que registrarlo— pero
> avisa que el recibo va a salir incompleto. Son dos cosas distintas y se ven
> distinto.

---

### El orden completo, de cero a la primera presentación

Cada paso habilita el siguiente. No es una recomendación: si salteás uno, el
sistema no te deja avanzar, o peor, te deja y el número sale mal.

**Primero, lo institucional. Sin esto no se emite ni un papel.**

1. `La entidad` — CUIT, razón social, domicilio, matrícula, objeto cannábico.
   **Todo documento que el sistema genera lleva el CUIT en la cabecera.** Sin
   esta pantalla cargada, cada recibo, cada acta y cada declaración salen con
   `[CUIT]` entre corchetes. Es el primer paso y el que más destraba.

   En la misma pantalla, abajo, va el **legajo**: el estatuto y el acta
   constitutiva en PDF. Son los dos papeles que ninguna entidad puede no tener,
   y el sistema avisa mientras falten. Ver el capítulo 07.
2. `Autoridades` — quién ocupa cada cargo, desde cuándo, y su grupo familiar.
   El grupo familiar no es un adorno: es lo único que permite verificar que no
   haya parentesco cruzado entre Comisión Directiva y Revisora de Cuentas.
3. `Predios` — sede social y predios de cultivo, con su comodato.
4. `Libros` — los siete obligatorios, **con su rúbrica**. Un libro sin rúbrica no
   vale, así que el dato del registro es parte de la carga, no un extra.

**Después, el padrón. Es lo que habilita cuántas plantas podés tener.**

5. `Asociados` — el padrón societario, con la categoría que el estatuto define.
6. `Actas` — la reunión que aprobó esas altas. El orden importa: **el alta se
   aprueba primero en acta y recién después va al registro de asociados.**
7. `Pacientes` — DNI, REPROCANN, patología, médico tratante y **tope mensual**.
   El tope es el que hace funcionar la ventana de 30 días: sin él, esa persona
   no tiene límite y el sistema no avisa cuando se pasa.

**Recién ahí, el cultivo.**

8. `Agronómico › Genéticas` y `Agronómico › Sala` — el banco de variedades y el plano.
9. `Agronómico › Plantas` — las plantas, ubicadas en la sala.
10. `O.N.G. › Cupo REPROCANN` — antes de pasar a floración, mirá cuántas te
    habilita el padrón de vinculados. Las de vegetativo no cuentan contra el tope.

**El circuito de la plata, en paralelo.**

11. `Econometría › Costos` e `Inventario` — de acá sale el **costo por gramo**,
    que es lo que hace que un aporte sea un reembolso y no una venta. Sin este
    número, el control de *Reembolso vs. costo real* no puede correr.

**Y ahí sí, el circuito operativo, que se repite.**

12. `Cosecha` → cargar los gramos → crear el **lote**.
13. `Autodispensación` o `Dispensas` → la entrega, contra ese lote.
14. El **recibo** por reembolso de costos sale de la entrega.
15. El paciente carga su **reporte de seguimiento**, o no puede volver a retirar.
16. `Movimientos` y `Economía` → que la plata cierre.

**Antes de presentar, siempre lo mismo.**

17. `Coherencia` → que no queden **errores**. Las alertas se miran; los errores
    frenan.
18. `Declaraciones` → DDJJ del semestre, y las cartas de porte de cada traslado.
    Las dos se presentan **por TAD**, afuera de la app.

> **Por qué este orden y no otro.** Los tres primeros bloques son dependencias
> duras: la entidad habilita los documentos, el padrón habilita las plantas, y el
> costo por gramo habilita el control del aporte. Los pasos 12 a 16 son el
> circuito que se repite todos los días; los otros se hacen una vez y casi no se
> tocan.

---

## 00a · Abrir la sede: los cuatro pasos del Panel

**El Panel no es un resumen de la instalación: es el procedimiento de apertura.**
Fue un tablero con plantas activas, riegos del día y gramos cosechados, y dejó de
serlo a pedido de la asociación. La razón es simple: nadie abre la sede para enterarse de
cuántas plantas hay. Se abre para hacer cuatro cosas, siempre las mismas, y en
este orden.

| Paso | Qué se hace | Por qué va en ese lugar |
|---|---|---|
| **1** | Tomar la lectura de la sala: temperatura y humedad. | Es lo primero porque es lo único que se pierde si no se hace ahora. Un dato de ambiente no se puede reconstruir al mediodía. |
| **2** | Controlar la caja: contar el efectivo y mirar lo que entró por transferencia. | Se cuenta con la sede recién abierta, antes de que entre o salga nada. Contar a media mañana es contar otra cosa. |
| **3** | Controlar el stock: pesar lo que queda de cada lote. | Mismo motivo que la caja. Y además el material y la plata se mueven juntos: si uno no cuadra, el otro dice dónde mirar. |
| **4** | Asentar las novedades del día. | Al final, porque recién ahí sabés qué hay para anotar. |

Cada paso muestra si ya se hizo **hoy**, y los pasos 2 y 3 lo saben porque miran
el último control registrado. No es una lista que se tilda a mano: se tilda sola
cuando el trabajo quedó hecho.

### El control de caja y stock: qué es y qué no es

Los pasos 2 y 3 abren la misma pantalla, con los valores esperados ya puestos. Vos
escribís **lo que hay de verdad**, y la diferencia aparece **mientras escribís**,
no al guardar.

Eso último no es comodidad. Quien cuenta tiene la plata o la balanza en la mano:
si no cuadra, hay que volver a contar **ahí**. Un control que avisa recién al
guardar convierte un error de conteo en una merma registrada, y una merma
registrada ya no se distingue de una merma real.

> **En palabras fáciles:** antes el panel te mostraba cuánta plata y cuánto
> material debería haber. Ahora te pide que digas cuánto hay, y **deja constancia
> de que alguien lo controló**. Eso era lo que faltaba: no el número, el registro
> de que alguien lo miró.

**Cuatro cosas que conviene saber antes de usarlo:**

- **Se puede controlar sólo la caja, o sólo el stock.** No hace falta contar todo
  junto. Obligar a las dos cosas es la forma más segura de que no se cuente
  ninguna.
- **El esperado queda congelado.** El número contra el que se comparó se guarda
  tal como estaba ese día. Si mañana se corrige un asiento viejo, la diferencia
  histórica no cambia sola: quedó dicho lo que se sabía en ese momento.
- **No se edita ni se borra.** Un control es una foto. Si contaste mal, cargás
  otro; corregir el anterior borraría la evidencia de que hubo una diferencia.
- **La plata se controla al peso exacto; el material tolera 1 gramo.** Una balanza
  de mostrador tiene su error, y marcar en rojo medio gramo enseña a ignorar el
  rojo — que termina siendo peor que no marcar nada.

### Lo que el sistema NO hace con una diferencia

**Guarda la diferencia, no la culpa.** Queda registrado quién contó, que no es lo
mismo que quién se llevó algo. El sistema no le imputa el faltante a nadie.

Es una decisión, no un olvido: un sistema que reparte responsabilidades solo deja
de cargarse la primera vez que alguien discute un número, y ahí se pierde hasta el
registro, que era lo único que se ganaba. Qué se hace con una diferencia es una
conversación entre personas; lo que el sistema aporta es que esa conversación
tenga un número y una fecha.

---

## 00b · Una entrega de punta a punta, con un ejemplo

Antes de los capítulos por pantalla, esto: **una entrega completa, de principio a
fin, con nombres y números inventados pero realistas.** Si leés una sola cosa de
este manual, que sea ésta. Todo lo demás es el detalle de cada paso.

El ejemplo es **Marta Gómez**, socia de la asociación, que viene a retirar.

---

### Qué tiene que pasar para que una entrega sea legal

Son cinco condiciones. Si falta una, la entrega existe igual en el mundo real
pero **no se puede defender ante una inspección**, que es para lo que sirve este
sistema.

1. **Marta tiene que estar cargada como paciente**, con su REPROCANN vinculado a
   esta asociación. No alcanza con que tenga REPROCANN: tiene que estar vinculado
   *acá*.
2. **El material tiene que salir de un lote.** No de "la cosecha" en general: de
   un lote con código, que dice de dónde vino ese material.
3. **Lo que Marta paga es un reembolso de costos, no un precio.** Tiene que estar
   por debajo de lo que costó producir el gramo.
4. **Tiene que quedar el recibo**, con la leyenda que dice que es un reembolso.
5. **Después hay que registrar cómo le fue.** Eso es el reporte de seguimiento, y
   es obligación de la asociación, no de Marta.

---

### El paso a paso, con los números

#### Paso 1 — Ver que Marta esté en condiciones

Entrás a `O.N.G. › Personas › Pacientes` y la buscás. Tenés que ver:

- Su **REPROCANN** cargado y **vinculado a esta ONG**.
- Su **cupo**: cuántas plantas y cuántos m² tiene habilitados.

Si Marta no está, se carga primero. Si está pero sin REPROCANN, **no se le
entrega todavía**: eso es lo único que ampara la entrega.

> **En palabras fáciles:** el REPROCANN es el permiso de Marta. Sin ese permiso
> cargado, para el papel la entrega no tiene con qué justificarse.

#### Paso 2 — Ver qué lote tiene material

Entrás a `Econometría › Inventario` (o mirás el desplegable de lotes cuando
cargues la entrega). Cada lote tiene un código y un saldo.

Digamos que el lote **A-C27826** tiene **45 g** disponibles.

> **Por qué importa el lote:** si mañana viene una inspección y pregunta de dónde
> salieron los 20 g de Marta, la respuesta es "del lote A-C27826, que vino de la
> cosecha tal, de la genética tal". Sin lote, esa cadena se corta.

#### Paso 3 — Registrar la entrega

`O.N.G. › Operación › Dispensas › botón Registrar`

Llenás:

| Campo | Qué ponés en el ejemplo |
|---|---|
| **Paciente** | Marta Gómez |
| **Fecha** | la de hoy |
| **Gramos** | 20 |
| **Lote** | A-C27826 |
| **Aporte** | $10.000 |
| **Medio de pago** | Efectivo |

Cuando guardás, el sistema hace **tres cosas de una sola vez**:

1. Descuenta los 20 g del lote A-C27826, que queda en 25 g.
2. Asienta los $10.000 en el Libro de Caja como ingreso, atado a esta entrega.
3. Deja el recibo listo para emitir.

> **En palabras fáciles:** cargás una vez y el sistema acomoda el stock, la plata
> y el papel. No hay que cargar las tres cosas por separado.

#### Paso 4 — Que el aporte esté por debajo del costo

Esto es lo que hace que sea un **reembolso** y no una **venta**, y es la
diferencia entre estar amparado y no estarlo.

Supongamos que producir un gramo te cuesta **$700**. Entonces:

- 20 g × $700 = **$14.000** es lo que te costó a vos.
- Marta aportó **$10.000**.
- $10.000 es **menos** que $14.000 → es un reembolso. Correcto.

Si Marta hubiera aportado $20.000, estarías cobrando **más** de lo que te costó,
y eso ya no es un reembolso: se parece a una venta. **El sistema te lo avisa.**

> **En palabras fáciles:** la asociación no vende. Recupera parte de lo que gastó.
> Si cobrás más de lo que gastaste, dejaste de recuperar y empezaste a ganar — y
> ahí el amparo se cae.

#### Paso 5 — Emitir el recibo

Desde la misma fila de la entrega, el botón del recibo. Sale con el nombre de la
asociación, el CUIT, los datos de Marta, los gramos, el lote y **la leyenda legal**
que dice que es un reembolso de costos operativos.

> Si en la ficha de la entidad falta el CUIT o la razón social, el recibo sale con
> `[corchetes]` en ese lugar. **Es a propósito:** un papel que muestra lo que le
> falta es honesto; uno que lo rellena solo, no.

#### Paso 6 — Registrar cómo le fue

`O.N.G. › Personas › Seguimiento`

Cuando Marta te cuente cómo le fue —puede ser el mes siguiente— cargás:

- **Alivio del 1 al 5** (por ejemplo, 4).
- **Efectos adversos**, si tuvo alguno.
- **Dosis real**: cuánto usó y cada cuánto.
- **Observaciones**.

> **Este reporte no se puede editar ni borrar después.** Es lo que Marta declaró
> sobre su tratamiento y es la base del informe que firma el director médico. Si
> algo quedó mal, se corrige en el reporte de la entrega siguiente.

---

### Lo que pasa si algo sale mal

#### Cargué una entrega de prueba y quiero borrarla

`O.N.G. › Operación › Dispensas`, botón de la papelera en la fila.

Al borrarla:

- **Los gramos vuelven al lote.** Si eran 20 g del A-C27826, el lote vuelve a 45 g
  solo. No hay que corregir nada a mano.
- **La plata también sale de la caja.** El asiento del aporte se borra junto con la
  entrega, y la confirmación te dice cuánto es antes de hacerlo.

> Hasta el 29/08/2026 esto funcionaba a medias: los gramos volvían pero la plata
> quedaba en la caja, así que el saldo contaba un ingreso sin entrega detrás. Ya
> está arreglado.

#### El botón de borrar no hace nada

Si estás en el teléfono y tocás borrar y no pasa nada, avisá: quedan pantallas
que usan el cartel de confirmación del navegador, que en un celular a veces no
aparece —y cuando no aparece, el sistema entiende que dijiste que no—. En
Dispensas y en Sala ya está arreglado.

#### La app dice que falta el reporte de una entrega vieja

No hace falta. La asociación registra el reporte de seguimiento **desde el
24/08/2026**. Las entregas anteriores a esa fecha **no piden reporte y no están en
falta**: la pantalla lo dice y lleva la constancia con la fecha.

> **Por qué no se completan hacia atrás:** un reporte dice cuánto alivio dio y qué
> efectos adversos hubo. Eso lo sabe solamente la persona que recibió el material.
> Inventarlo sería fabricar la evolución clínica de alguien y hacer que un médico
> lo firme.

---

### El resumen de todo, en seis renglones

```
1. Marta está cargada, con REPROCANN vinculado
2. El material sale de un LOTE con código
3. Se registra la entrega: gramos + lote + aporte
4. El aporte es MENOR que el costo  → es reembolso
5. Sale el recibo con la leyenda legal
6. Después se carga cómo le fue     → seguimiento
```

Si esos seis pasos están, la entrega se puede defender. Si falta uno, el sistema
te lo va a decir en la pantalla de **Coherencia**.

---

---

## 00c · Quién ve qué: los ocho roles

**Una pantalla que no te corresponde no aparece.** No sale vacía ni tira un error:
directamente no está en el menú. Es a propósito, y costó aprenderlo — una pantalla
que se muestra y devuelve cero filas se lee como rota, no como prohibida, y
alguien pierde media hora buscando un problema que no existe.

| Rol | Dónde entra | Qué ve |
|---|---|---|
| **Administrador** | Panel | Todo. |
| **Administrador de sistema** | Panel | Todo, igual que el anterior. Se separan para poder sacarle el acceso a uno sin tocar al otro. |
| **Mostrador** | Panel | La rutina de apertura completa, la lectura de sala, la caja y las tareas del mostrador: entregar, cargar un lote, anotar una visita, registrar un gasto. **No ve el cultivo, ni el estatuto, ni las fichas clínicas.** |
| **Cultivador** | Sala | El módulo Agronómico entero, y puede escribir en él. Nada de la O.N.G. |
| **Director de cultivo** | Sala | Lo del cultivador, más el estado de cumplimiento de la O.N.G. |
| **Director médico** | O.N.G. | Lo institucional, lo clínico —es el único que escribe seguimiento— y el cultivo en modo lectura. **No ve la plata.** |
| **Administrativo** | Econometría | Casi todo salvo escribir en el cultivo: personas, plata, papeles e institucional. |
| **Auditor** | Panel | Mira todo lo que necesita para auditar y **no escribe nada**. Es el punto de que exista. |

> ⚠️ **«No ve» quiere decir «no está en su menú», que no siempre es lo mismo que
> «la base se lo niega».** Hay dos clases de cierre y conviene no confundirlas.

- **Lo clínico y la plata están cerrados de verdad**, con una regla en la base:
  por más que alguien llegue por otro camino, no le devuelve una fila. El
  seguimiento clínico y la caja son eso.
- **El cultivo y los papeles institucionales están cerrados en la pantalla.**
  Los lee cualquier persona con perfil, que es la convención de esta instalación
  desde el principio —también los leen el auditor y el administrativo—. No
  aparecen en el menú de quien no los necesita, pero no son secretos.

Dicho de otra forma: **el rol decide qué trabajo hacés**, y para los datos
sensibles además decide **qué podés leer**. Si en algún momento hace falta que el
cultivo también esté cerrado en la base, es una decisión aparte y hay que
tomarla — hoy no lo está.

**Dos cosas que se deducen de la tabla y conviene decir en voz alta:**

- **El director médico no ve la plata, y sí tiene que ver el estatuto.** Por eso
  los papeles institucionales viven en `O.N.G. › Institucional › La entidad` y no
  en `Documentos`, que es una pestaña de plata.
- **Mostrador ve la caja pero no el cultivo.** Es el rol de quien atiende: abre,
  cuenta, entrega y anota. Todo lo que necesita está en el Panel, que es por eso
  la pantalla donde entra.

> **Los usuarios se crean en `O.N.G. › Panel › Usuarios`, y siempre los crea una
> persona.** El sistema no maneja contraseñas: se invita por mail y cada uno pone
> la suya.

---

## 01 · Lo que se carga una vez

Esto se hace al principio y casi no se toca. Si falta, varias pantallas van a
mostrar guiones en vez de números: no están rotas, no tienen con qué calcular.

{{PUESTA_EN_MARCHA}}

1. **Los datos de la entidad** — `O.N.G. › La entidad`
   Razón social, CUIT, domicilio de la sede, fecha de constitución, cierre de
   ejercicio y las fechas del REPROCANN. De acá salen los encabezados de *todos*
   los documentos que el sistema genera. Sin CUIT cargado, cada recibo y cada acta
   sale con `[CUIT]` entre corchetes.

2. **Autoridades y predios** — `O.N.G. › Autoridades` · `Predios`
   Quién ocupa cada cargo y desde cuándo; qué predios se declararon, si están
   georreferenciados y si el municipio fue notificado. Las designaciones de
   Director Médico y Responsable Técnico se completan solas con esta lista.

3. **Las genéticas** — `Agronómico › Genéticas`
   El banco de variedades. Alcanza con el nombre para empezar.

4. **La sala** — `Agronómico › Sala`
   El plano de carpas y posiciones. Primero creás las áreas —cada carpa, cama o
   sector, con sus medidas y cuántas plantas entran— y después ubicás las
   plantas adentro. Es lo que permite regar un área entera de un toque, en vez
   de planta por planta.

5. **Las salas de ambiente** — `Agronómico › Ambiente › Salas`
   Dónde vas a medir temperatura y humedad, con la etapa de cada una. Es otra
   lista distinta de la del punto anterior: aquella es el plano de riego, ésta
   es dónde se toma la lectura. **Sin al menos una sala creada no se puede
   cargar ninguna lectura**, así que va antes que la primera medición.

6. **Costos e instalaciones** — `Econometría › Costos` · `Instalaciones`
   Luz, alquiler, sales, equipamiento con su vida útil. Es la base del costo por
   gramo, que define si un aporte es reembolso de costos o pasa a ser otra cosa.

> **El guion no es un cero.** Cuando una pantalla muestra `—` es porque falta un
> dato para calcular, no porque el resultado sea cero. Un costo por gramo de $0
> diría que producir no cuesta nada.

---

## 02 · El día a día del cultivo

Todo el ciclo vive en **Agronómico**, que son siete miradas sobre lo mismo, en el
orden en que se usan. **Sala va primero y no es casual**: quien entra al módulo
viene a hacer algo en una sala, no a leer una lista.

- **Sala** (`/sala`) — el plano de riego, y la primera pantalla del módulo. El
  color del borde dice hace cuánto se regó cada posición: hoy, 1-2 días, 3+, sin
  registro. La franja de abajo es la **variedad**. Adentro va sólo el número de la
  planta; el nombre completo, la variedad y los días sin riego salen al apoyar el
  dedo o el mouse. Se riega o fumiga de a varias.
- **Plan** (`/plan`) — lo que se declaró que se iba a cultivar, y cuánto se
  separó de eso la realidad. Ver más abajo.
- **Plantas** (`/plantas`) — la lista completa, una ficha por planta: genética,
  fase, día de vida, posición e historial. Se dan de alta y se pasan a floración.
- **Genéticas** (`/geneticas`) — el banco de variedades. Alimenta etiquetas,
  informe de variedades y comparación de rendimientos.
- **Línea de tiempo** (`/linea-tiempo`) — cada variedad como una barra desde que
  germinó hasta la cosecha estimada.
- **Cosecha** (`/cosecha`) — los gramos que dio cada variedad (capítulo 04).
- **Ambiente** (`/ambiente`) — temperatura, humedad y VPD (capítulo 03).

### El plan de cultivo: lo que se declara contra lo que hay

`Agronómico › Plan` guarda **el plan que se declara en el REPROCANN**: cuántas
plantas, qué genéticas, en qué espacios, con qué riego, qué fertilización y qué
luces. Los campos están en ese orden porque es el orden en que se piensa.

Arriba de todo, la pantalla muestra **el desvío**: el plan dice 60 plantas, la
sala tiene 63, y ahí está dicho. Ese número hoy es imposible de tener de otra
forma — sin plan cargado no hay contra qué comparar, sólo plantas sueltas.

> **El plan NO crea las plantas, las contrasta.** Que el plan las genere y listo
> suena cómodo, y a los dos meses el plan es ficción: murieron tres, se
> repusieron dos, y nadie vuelve a mirarlo. El plan es la declaración, las plantas
> son la realidad, y el cruce es lo que avisa cuando se separaron. **Un plan que
> se edita para que cierre deja de ser una declaración.**

Sólo se cruzan los números —plantas y pacientes previstos—. El resto es texto
libre a propósito: es lo que va redactado en el documento, y cada organismo lo
pide escrito distinto. Encasillarlo en listas obligaría a mantener una taxonomía
que cambia con cada resolución.

Puede haber más de un plan cargado: en el cambio de ciclo conviven el que termina
y el que arranca, y el sistema elige por fecha el que rige hoy. Entre dos que se
solapan gana **el que arrancó más tarde**.

### El banco de genéticas abre filtrado

`Agronómico › Genéticas` arranca mostrando **sólo las que están en las salas**,
con un botón **Ver todas** al lado. Cada variedad dice si tiene material: **con
stock en verde, sin stock en rojo.**

Las que no se están cultivando **no se borran ni desaparecen**: quedan detrás del
filtro. Es deliberado, porque el banco es el historial de todo lo que la
asociación consiguió alguna vez, y es exactamente lo que se mira cuando hay que
volver a pedir una variedad. Si escribís un nombre en el buscador, el filtro se
apaga solo — buscar algo y que no aparezca porque estaba filtrado es la peor
forma de perder un dato.

### Regar y fumigar sin cargar planta por planta

En **Sala** se arma la receta del día una vez y se aplica a todo lo que toques.
Es la diferencia entre cargar sesenta riegos y cargar uno.

- Elegí **Regar** o **Fumigar** y cargá la receta arriba.
- Tocá las plantas o la carpa entera. El contador lleva la cuenta del día.
- **Mover** cambia plantas de posición sin perderles el historial.

> **La fase importa más de lo que parece.** El tope de plantas de la Resolución
> 1780 se cuenta sobre las que están *en floración*. Las de vegetativo o
> enraizando no suman contra el límite, así que tener la fase al día es lo que
> hace que el cupo dé bien.

### «Sala» son dos cosas distintas, y conviene saberlo

Una **sala de Ambiente** (capítulo 03) es donde se cargan temperatura y humedad.
Un **área de cultivo** es donde se ponen las plantas, y es la que se crea en
`Agronómico › Sala`. **No son la misma cosa**: una sala física puede tener varias
camas, y de hecho así están cargadas.

Crear la sala en Ambiente **no** crea el área de cultivo. Si pasa, `Agronómico ›
Sala` lo avisa y trae el botón que crea el área con el nombre ya puesto.

---

## 03 · Ambiente

Esta instalación **no tiene sensores conectados**: las lecturas las toma una
persona con el termohigrómetro y las carga a mano. La recomendación es **dos
veces por día**, una a la mañana y otra a la tarde, siempre más o menos a la
misma hora.

> **Mirá siempre en qué sala estás cargando.** El formulario lo dice arriba y
> deja elegir entre las salas activas. Antes se escondía cuando había una sola, y
> el día que se abrió la segunda nadie tenía por qué darse cuenta de que ahora
> había que elegir: una lectura cargada en la sala equivocada no se nota hasta
> que el análisis de las dos salas dice cualquier cosa.
>
> **Y la fecha viene puesta en «ahora».** Si estás cargando una lectura de hace
> un rato —o la de la mañana, ya de tarde—, cambiala antes de guardar.

`Agronómico › Ambiente` tiene tres pestañas, en el orden en que se usan:

| Pestaña | Para qué |
|---|---|
| **Cargar** | El formulario. Es lo que se abre todos los días. |
| **Análisis** | Qué dicen esos datos: promedios, picos y cuándo te fuiste de rango. |
| **Salas** | La lista de salas o carpas. Se toca una vez cada varios meses. |

**Las pestañas están ordenadas por lo que más se usa, no por el orden en que se
configura.** La primera vez el recorrido es al revés —hay que crear la sala
antes de poder cargar nada— y por eso, mientras no exista ninguna, la pantalla
te lleva directo a *Salas*. Después de ese primer día el orden real es cargar y
mirar; a *Salas* se vuelve sólo cuando una sala cambia de etapa.

> **El Panel te avisa.** En `menú › Panel`, arriba de todo, hay una tarjeta de
> ambiente: se queda quieta mostrando la última lectura cuando la del turno ya
> está cargada, y se enciende cuando falta. Tocándola vas directo al formulario.
> Es lo que sostiene la rutina: dos veces por día no se sostiene de memoria.

### Por qué dos veces por día

Una sola lectura diaria esconde justo lo que interesa. La temperatura de la
mañana y la de la tarde son dos números distintos, y la diferencia entre ellos
es la que dice si el equipo de frío da abasto en las horas de más luz. Con un
solo registro por día se ve un promedio que puede estar perfecto mientras la
sala se va a 32 °C todas las tardes.

El sistema deduce el turno de la hora que cargaste — antes de las 14 es mañana,
después es tarde — así que no hay que elegirlo: es un campo menos que completar
con una mano mientras se sostiene el termohigrómetro con la otra.

### El VPD, que es el número que importa

**VPD** es cuánta "sed" tiene el aire. Se calcula solo, a partir de la
temperatura y la humedad que cargás, así que no hay que medirlo ni cargarlo.

Es el número al que conviene mirar porque temperatura y humedad **no se leen por
separado**: las dos pueden verse normales y aun así dar un VPD malo. 24 °C con
70 % y 24 °C con 45 % son la misma temperatura y dos ambientes completamente
distintos para la planta.

- **VPD alto** — el aire pide más agua de la que la planta puede dar. La planta
  cierra los estomas para no deshidratarse y deja de crecer. Se corrige subiendo
  la humedad o bajando la temperatura.
- **VPD bajo** — la planta casi no transpira, y como el movimiento de nutrientes
  va con esa transpiración, deja de alimentarse bien. Además el aire quedado es
  donde aparece el hongo. Se corrige bajando la humedad o subiendo la temperatura.

Mientras cargás los dos números, la pantalla ya te muestra el VPD que dan y si
queda en rango. No hace falta guardar para saberlo.

### Los rangos dependen de la etapa

Cada sala tiene su etapa, y el rango ideal cambia con ella:

| Etapa | Temperatura | Humedad | VPD |
|---|---|---|---|
| **Vegetativo** | 22–28 °C | 55–70 % | 0,8–1,2 kPa |
| **Floración** | 20–26 °C | 40–55 % | 1,2–1,6 kPa |

> **Mantené la etapa al día.** Es lo único que hay que acordarse de cambiar en
> esta pantalla. Una sala que pasó a floración pero quedó marcada como
> vegetativo se compara contra el rango equivocado, y el semáforo va a decir que
> está todo bien justo cuando la humedad está alta para la etapa. Se cambia en la
> pestaña *Salas*, con el selector de cada fila.

### Cómo leer los gráficos

Cada gráfico tiene una **banda verde de fondo**: ese es el rango ideal de la
etapa. No hace falta leer ningún número para responder la única pregunta que
importa, que es cuándo te fuiste de rango — la línea entra y sale de la banda.

Los puntos que quedaron fuera se marcan **en rojo y más grandes**. Tocando
cualquier punto aparece su fecha y su valor.

Arriba de los gráficos hay un bloque, **"Qué dicen estos datos"**, que lo
resume en castellano: *"En 7 días, el VPD quedó fuera de rango 6 veces (sobre
todo por encima de 1,2 kPa), siempre de tarde"*. Los gráficos muestran **qué**
pasó; ese bloque dice **qué significa**.

Y **Mañana vs. tarde** es cuánto sube la temperatura en promedio entre las dos
lecturas del día. Si da 6 °C o más, el sistema lo marca: un salto así casi
siempre quiere decir que el equipo de frío no llega en las horas de más luz.

> **Sin señal se carga igual.** Adentro de una sala de cultivo el wifi
> generalmente no llega. Si no hay conexión al guardar, la lectura queda
> guardada en el teléfono y se sube sola cuando vuelve la señal — la pantalla
> te lo avisa. El dato ya lo tomaste: perderlo por un corte no tiene sentido.

---

## 04 · Cosecha y lotes

Dos cosas que se parecen y no son lo mismo. **La cosecha** es lo que dio una
planta. **El lote** es material ya seco, curado y fraccionado, listo para
entregar. Una cosecha puede dar varios lotes, y un lote puede juntar varias
plantas.

1. **Cargá la cosecha** — `Agronómico › Cosecha`, o el botón **Registrar una cosecha**
   del Panel de la O.N.G.
   Elegís la variedad que cosechaste de las que están listas, y cargás el peso:
   húmedo, seco, notas de curado y sabor, valoración. Calcula merma de secado,
   rendimiento por planta y el ranking por genética.

   > **La cosecha se registra sobre la PLANTA.** Por eso en esa pantalla sólo
   > aparecen las variedades que tienen plantas cargadas: si cosechaste algo que
   > no figura, no es que la app no lo muestre, es que faltan sus plantas. La
   > pantalla te dice cuáles del banco están sin ninguna y te lleva a cargarlas.

2. **Mirá si el número cierra** — `menú › Estadísticas`
   Gramos por vatio, costo por gramo, merma y qué genética rindió mejor.

### Las cuatro métricas y qué te dicen

| Métrica | Qué mide | Cómo leerla |
|---|---|---|
| **g/planta** | Lo que rindió cada planta. | Es la unidad para comparar una corrida contra otra. |
| **g/W** | Gramos por vatio de luz. | La métrica de eficiencia del indoor: **1,0 g/W es un cultivo bien llevado, 0,5 es flojo.** |
| **Merma de secado** | Cuánta agua perdió el cogollo. | Lo normal es **75–80 %**. |
| **$/g** | Lo que cuesta producir un gramo. | Viene de Econometría (capítulo 06). |

**El g/W depende del inventario.** La potencia sale de lo que tengas cargado
como iluminación: si las luces no están en el inventario con su potencia, la
métrica no se puede calcular y muestra `—`.

**La merma fuera de rango dice cosas distintas según para qué lado.** Bastante
por debajo de 75 % puede ser que se pesó mal o que quedó húmedo, y eso último es
riesgo de hongo. Bastante por arriba de 80 % es sobresecado, que se lleva
terpenos. En los dos casos vale más revisar el secado que el número.

> **Si la merma sale `—` teniendo los dos pesos cargados**, es porque el peso
> seco quedó mayor o igual que el húmedo. El sistema no muestra un porcentaje
> ahí: un cogollo no puede pesar más seco que húmedo, así que el dato está mal
> cargado y devolver un número sería inventarlo. Revisá que no hayan quedado
> invertidos.

### Qué plantas cuentan para el rinde del ciclo

No todas. Sólo cuentan las que están en **floración, secado, curado o
cosechada**. Las que están en germinación, plántula o vegetativo son del ciclo
siguiente, y sumarlas infla la proyección: es el caso típico de tener
feminizadas vegetando mientras se cosechan las automáticas.

Las ocho fases, en orden: germinación → plántula → vegetativo → floración →
secado → curado → cosechada. *Muerta* está aparte y saca a la planta de todos
los conteos.

3. **Creá el lote** — `O.N.G. › Autodispensación › Catálogo`
   Código, producto, gramos totales, aporte por gramo e informe cromatográfico.
   Recién cuando existe el lote se puede reservar y entregar material.

   > **Cargar la cosecha NO alcanza para entregar.** Una entrega se anota contra
   > un **código de lote**, así que mientras el material no sea un lote existe en
   > Cultivo y no existe para dispensar: no aparece en el desplegable al anotar
   > la entrega. El Catálogo avisa cuando hay material cosechado sin lote y trae
   > el botón que lo crea con los gramos puestos.

### El origen del lote decide si el material entra dos veces

Al crear un lote hay que decir de dónde vino, y no es un dato de adorno: define
si esos gramos suman al ingreso o no.

| Origen | Cuándo | ¿Suma al ingreso? |
|---|---|---|
| **Cultivo propio** | Tiene una cosecha cargada detrás | **No** — el ingreso ya lo aportaron las cosechas |
| **Propio sin cosecha** | Material propio del que no se registró la cosecha | Sí |
| **Comprado** | Vino de un tercero | Sí |

Poner «comprado» o «propio sin cosecha» en un lote que sí tiene su cosecha
cargada cuenta el mismo material **dos veces** y el balance de materia deja de
cerrar. Al revés —marcar «propio» algo que se compró— lo hace desaparecer del
ingreso.

### Al anotar la entrega, sólo aparecen los lotes con material

El desplegable de lote muestra únicamente los que tienen stock, con cuánto queda
de cada uno:

    LOT-2601 — quedan 45 g de 120

Los agotados no se ofrecen, y los que se retiraron del catálogo tampoco. Si el
desplegable sale vacío teniendo lotes cargados, es que están todos entregados: la
pantalla lo dice, para que no se cargue la entrega «sin especificar» —que es
justamente la que después no descuenta de ningún lado.

> **El análisis por lote lo pide la 1780.** Los valores de THC/CBD de la ficha de
> la genética son estimados de la variedad y no reemplazan el análisis del lote.
> El sistema deja crear el lote sin análisis pero lo marca, porque presentar un
> estimado como resultado sería declarar algo que no se midió.

---

## 05 · De paciente a entrega

El corazón del sistema. Seis pasos, cada uno habilita el siguiente. Si un paso
falta, el sistema no deja avanzar y dice cuál es y cómo destrabarlo.

### Antes del paso 1: de dónde sale un socio

Todo empieza en **`/sumate`**, la página pública de la asociación. Es el único
link que hay que dar: se pone en la bio de Instagram y se manda por WhatsApp.

> **Ya no es un Google Form.** Hasta el 27/08/2026 el primer paso mandaba a un
> formulario de Google que **no escribía en el sistema**: alguien tenía que
> importar las respuestas a mano, y de ahí salieron las doce fichas que hubo que
> limpiar el 25/08. Ahora la persona carga sus datos y entran derecho.

**Qué completa la persona, en una sola pantalla:**

| Bloque | Qué se pide |
|---|---|
| **Quién sos** | Nombre, DNI, fecha de nacimiento, domicilio, teléfono y mail. |
| **Tu REPROCANN** | Si tiene el carnet aprobado, y **si designó a la asociación como su cultivador**. |
| **Tu tratamiento** | Diagnóstico de una lista cerrada, formato, cantidad estimada y médico tratante. |
| **Declaraciones** | Los cuatro consentimientos y el Mandato de Gestión Operativa. |

**La pregunta que decide todo es la de la vinculación.** Tener el carnet y haber
designado a esta asociación son dos cosas distintas: alguien puede tener
REPROCANN vigente y estar vinculado a sí mismo como autocultivo, y en ese caso
la asociación **todavía no le puede entregar**. Por eso hay tres respuestas y
cada una contesta distinto:

- **«Sí, ya la designé»** — sigue de largo.
- **«No, todavía no»** — le explica cómo se hace y le da el link al trámite.
- **«No sé de qué se trata»** — le explica qué es la vinculación, las tres
  modalidades del REPROCANN y cuál de las tres habilita a la asociación.

Lo mismo si contesta que **no tiene el carnet**: aparece *«¿Cómo lo saco?»*, que
arranca por el dato que de verdad traba el trámite —**un médico tiene que cargar
la indicación**— y ofrece el camino oficial y gratuito, y el servicio particular
y pago para quien no tiene a quién pedírselo.

> **Nada de esto frena el envío.** Quien todavía no se vinculó también es alguien
> a quien la asociación quiere conocer. Lo declarado queda guardado para que lo
> revise quien corresponde.

**Al enviar, la persona recibe un link con su token.** Se muestra **una sola
vez**, grande y con botón de copiar. Con ese link entra a ver cómo va su
solicitud y **sube su DNI y su credencial** — los adjuntos van después de enviar
porque hacen falta el token, y el token no existe hasta que la solicitud está
creada.

> **Si pierde el link, lo perdió.** No hay «recuperá tu link con tu DNI»: sería
> un buscador público que confirma quién es paciente de cannabis de la
> asociación. Y **no se manda ningún mail**: hoy el sistema no envía correos, así
> que el link hay que guardarlo o pedirlo de nuevo a la asociación.

### El alta puede resolverse sola

**Dónde:** `O.N.G. › Personas › Solicitudes`

Las solicitudes caen ahí y el sistema intenta resolverlas solo. **No inventa un
circuito nuevo: reemplaza el clic** que antes hacía una persona mirando la
bandeja. Hay tres finales posibles:

| Resultado | Cuándo | Qué pasa |
|---|---|---|
| **Se actualiza** | El DNI ya está en el padrón | No crea ficha nueva: completa la que ya existía, **sin pisar nada**. Funciona aunque la ficha esté archivada. |
| **Alta automática** | Es nuevo y pasa las guardas | Se crea la ficha de paciente, sin que nadie toque nada. |
| **Queda pendiente** | Algo no cierra | Espera en la bandeja **con el motivo escrito**. |

**Lo que no pasa la guarda no se rechaza.** Rechazar solo a alguien que quiere
sumarse no es una decisión que le corresponda a un sistema: queda pendiente y lo
mira una persona. Frenan el alta automática:

- Falta el nombre o el DNI, o el DNI no tiene forma de documento.
- El **DNI, el teléfono o el mail ya figuran** en otra ficha — puede ser la misma
  persona, o un familiar que comparte número.
- El padrón llegó al **tope de vinculados**.
- El cultivo no da para sostener un socio más.

> **El enganche por DNI va primero**, antes que cualquier tope. El tope mide si
> entra *uno más*, y quien ya está no es uno más: frenar la actualización de un
> legajo por un cupo que esa persona ya ocupa sería absurdo.

> **No hay captcha.** Las guardas frenan lo obvio, pero un bot que invente
> documentos distintos las pasa igual. Si aparecen solicitudes basura en el
> padrón, es acá donde hay que mirar primero.

### Y el trámite oficial, que es el que habilita

El formulario deja los datos; **lo que habilita la entrega es el REPROCANN
vinculado a la asociación**. Los links viven en un solo lugar
—`O.N.G. › Personas › Pacientes`, en *«Cómo se suma alguien nuevo»*— con botón
para copiar y mandar por WhatsApp:

| | Qué es | Dónde |
|---|---|---|
| **Trámite oficial** | Gratuito, en el sitio del Estado. Es el que habilita. | Mi Argentina |
| **Gestión online** | Servicio particular y **pago**, más rápido. Opcional: no reemplaza al oficial. | repronline |

> **Sin el REPROCANN vigente y vinculado no se dispensa** (regla RN-01).

### Importar respuestas viejas de un formulario

**Dónde:** `O.N.G. › Personas › Pacientes › Importar respuestas del formulario`

Sigue existiendo para las respuestas que ya están en una planilla vieja. Para el
alta nueva **no hace falta**: con `/sumate` los datos entran solos.

En la planilla: **Archivo → Descargar → CSV**, y subir ese archivo. Después se
elige qué columna alimenta cada campo — el sistema propone un mapeo y vos lo
corregís, porque las preguntas de un formulario cambian con el tiempo.

Antes de importar te dice cuántas filas entran, cuántas se saltean **por DNI
repetido** y cuántas no tienen nombre.

> **Entran como pacientes, no como asociados.** El alta de socio la ratifica la
> Comisión Directiva, no un archivo. Después de importar, completá el **tope
> mensual en gramos** de cada ficha, que es lo que habilita el control de cupo.

---

1. **Cargá al paciente** — `O.N.G. › Pacientes`
   Datos personales, patología, médico tratante, y el REPROCANN con número, estado
   y vencimiento. Cargá también el **tope mensual en gramos**: sin ese dato el
   cupo no se puede controlar.

   Al guardar, el formulario revisa la ficha contra el padrón y **avisa** si el DNI
   o el teléfono ya están en otra ficha, o si el documento no tiene forma de
   documento —un CUIL de once dígitos, por ejemplo—. **Avisa, no bloquea**: puede
   pasar que dos socios compartan teléfono y no sean la misma persona. Si aun así
   corresponde cargarla, el botón pasa a decir *"Guardar igual"*.

> **Por qué importa no duplicar una ficha.** La misma persona con dos códigos rompe
> todo lo que se cuenta por paciente: el cupo de 30 días se calcula sobre una sola
> de las dos, el consumo aparece partido a la mitad y el total de vinculados que se
> declara queda inflado.

2. **Dalo de alta como asociado** — `O.N.G. › Asociados`
   Paciente y asociado son distintos: una persona puede estar en el registro de
   pacientes sin ser socia. Para recibir material tiene que ser las dos cosas.

3. **Que firme el mandato** — `O.N.G. › Autodispensación › Reservar`
   La Declaración Jurada de Vinculación Exclusiva y Mandato de Gestión Operativa.
   Se firma desde la misma pantalla de reserva y queda registrada con fecha, hora
   e IP. Es el documento que sostiene que la entrega no es una compraventa.

4. **Reservá del catálogo** — `O.N.G. › Autodispensación › Reservar`
   El sistema muestra primero si la persona está habilitada: cupo usado, reservado
   y libre. Después elegís lote, gramos y forma de pago. Sale un código
   `RSV-0000-2026` con su QR y **72 horas** para retirar.

5. **Entregá en la sede** — `O.N.G. › Autodispensación › Reservas`
   Escaneá el QR con **Escanear** —o buscá el código a mano— y se abre la entrega.
   Si pagó por transferencia, administración tuvo que marcarla abonada antes. Si
   paga en efectivo, tildás que lo cobraste. Al confirmar nacen las tres cosas
   juntas: **la dispensa, el asiento en el Libro de Caja y el recibo oficial** con
   su leyenda legal.

6. **Registrá cómo le fue** — `O.N.G. › Seguimiento`
   Alivio del 1 al 5, efectos adversos, dosis real y observaciones. Es obligación
   de la ONG, no del paciente: sin reportes no hay informe semestral que
   presentar.

   **Ojo con esto, porque se malentiende seguido:** una entrega sin reporte
   **no** te impide entregar en el mostrador. Ahí el sistema te avisa y te deja
   seguir, porque la persona ya vino hasta el local. Donde sí frena de verdad es
   en el **portal**, cuando la persona quiere reservar sola desde el teléfono:
   ahí no hay nadie que decida, así que primero completa la encuesta.

   Se puede cargar de dos lados, y es el mismo formulario: acá, cuando la persona
   te cuenta, o **la persona sola desde el portal** — si su última entrega no
   tiene reporte, al entrar a reservar le aparece la encuesta antes del catálogo.

> **El reporte no se puede editar ni borrar.** Una vez guardado queda cerrado, y
> la base lo rechaza aunque se intente. Es la evidencia que va al informe del
> Director Médico: un dato clínico reescrito no sirve como evidencia.

> **El reporte se exige desde el 24/08/2026.** Las entregas anteriores no lo
> necesitan y no bloquean nada: llevan una constancia con su fecha. No es un
> permiso, es que un reporte no se puede reconstruir después — lo que dice sólo lo
> sabe quien recibió el material, y rellenarlo sería inventar la evolución clínica
> de una persona en un papel que firma el Director Médico.

### Las cinco modalidades de una salida

No todo lo que sale del stock es una entrega a un paciente, y la modalidad es lo
que lo distingue. Elegir la que corresponde importa: de eso depende si al material
se le pide aporte, si cuenta para el cupo y si se le exige receta.

| Modalidad | Va a una persona | Lleva aporte | Qué es |
|---|---|---|---|
| **Paciente** | sí | **sí** | La entrega normal. Es la única que debería tener aporte cargado. |
| **Retribución en especie** | sí | no | Material que un socio percibe **por operar el cultivo**, en lugar de dinero. No es una entrega impaga: es parte de lo que cobra. |
| **Muestra** | sí | no | Una porción chica para que el socio pruebe una genética. |
| **Consumo interno** | **no** | no | Material afectado a la operación: elaboración, pruebas, material de trabajo. |
| **Merma** | **no** | no | Pérdida de proceso. No hay a quién cobrarle. |
| **Saldo inicial** | **no** | no | Existencia al arranque. No es una entrega. |

Las tres de abajo **no llevan paciente** y el sistema no se los pide: descuentan
stock igual que una entrega pero no van a nadie. Las tres de arriba **sí llevan
paciente**, y por eso el cupo de 30 días les corre a las tres, cobren o no.

> **Por qué la retribución y la muestra no son "consumo interno".** Van a una
> persona concreta y esa trazabilidad se pierde si se las carga como salida sin
> paciente. Y al revés: pedirle *receta médica* a quien retira su retribución es un
> requisito mal dirigido —no lo consume como paciente, lo cobra como trabajo—, así
> que cuando pasa de 40 g el sistema le pide la documentación del traslado y no una
> receta.

### Las tres pantallas de la autodispensación

- **Catálogo** — los lotes con tres números separados: *disponible* es lo único
  que se puede comprometer hoy, *reservado* está apartado esperando un retiro, y
  *entregado* ya salió.
- **Reservas** — ordenadas por lo que hay que hacer, no por fecha: primero lo
  listo para retirar, después lo reservado, al final lo cerrado.
- **Seguimiento** — los reportes y el **panel del Director Médico**, que cruza
  diagnóstico, lotes entregados y curva de alivio, y genera el informe semestral.

> **Las reservas vencidas se limpian solas.** Al abrir la pantalla, todo lo que
> pasó las 72 horas se marca expirado y su material vuelve al inventario. Si un
> lote muestra menos disponible del esperado, fijate cuánto tiene apartado.

---

## 06 · La plata

Todo desemboca en un número: **cuánto cuesta producir un gramo**. De ahí depende
que el aporte de un paciente sea un reembolso de costos y no otra cosa. Este
capítulo explica de dónde sale ese número, porque cuando no cierra hay que saber
en cuál de las cuatro partes mirar.

**Econometría** (`/econometria`):

- **Resumen** — el costo por gramo, de dónde sale y cuánto habría que producir
  para bajarlo.
- **Costos** — gastos fijos y variables del ciclo.
- **Inventario** — el stock de insumos, que también es plata inmovilizada.
- **Mantenimiento** — qué hacerle a los equipos y cuándo.
- **Instalaciones** — el equipamiento con su vida útil, para que amortice.

### Cuánto aporta cada socio: los niveles de tarifa

El aporte por gramo no es uno solo. Sale de `O.N.G. › Asociados`, en la tabla de
tarifas, y depende de dos cosas: **hace cuánto que la persona está** y **si tiene
REPROCANN**.

| Nivel | Quién es | Con REPROCANN vigente o en trámite | Sin REPROCANN |
|---|---|---|---|
| **antiguo** | Socio desde el inicio | $12.000/g | $15.000/g |
| **frecuente** | Por volumen y frecuencia de retiro | $10.000/g | $15.000/g |
| **nuevo** | Reciente u ocasional | $12.000/g | $15.000/g |

**El REPROCANN baja la tarifa a propósito: ése es el incentivo** para que la
persona haga el trámite. Quien lo inició cuenta igual que quien ya lo tiene.

Hay un cuarto nivel, **acuerdo**, para los aportes pactados individualmente por
fuera de la lista. No lleva precio propio porque el monto se conviene caso por
caso y queda asentado en las notas del socio.

> **Un acuerdo por debajo del costo hay que poder explicarlo.** Si alguien aporta
> menos de lo que cuesta el material, la diferencia la absorbe la asociación y eso
> es plata que sale de algún lado. No alcanza con registrar el acuerdo: hay que
> poder decir por qué se pactó y con qué se financia.

### Cómo se arma el costo por gramo

El sistema no suma todo y divide. Arma un **costo mensual** con cuatro partes,
lo multiplica por los meses que dura el ciclo, y recién ahí lo divide por los
gramos que cosechaste:

1. **Costo del mes** = amortización + costos fijos + costos variables + consumibles.
2. **Costo del ciclo** = costo del mes × meses que dura el ciclo.
3. **Costo por gramo** = costo del ciclo ÷ gramos cosechados.

Las cuatro partes del primer renglón salen de dos lugares distintos, y esto es
lo que más confunde:

| Parte | De dónde sale | Cómo se prorratea |
|---|---|---|
| **Amortización** | *Inventario*, lo clasificado como equipo | El precio repartido en los meses de vida útil de su categoría. |
| **Costos fijos** | *Costos*, tipo fijo | Según su periodicidad (ver abajo). |
| **Costos variables** | *Costos*, tipo variable | Según su periodicidad. |
| **Consumibles** | *Inventario*, lo clasificado como consumible | El precio dividido por los meses del ciclo. |

**El equipamiento no se carga entero al ciclo.** Un deshumidificador de
$1.400.000 con 72 meses de vida útil pesa $19.444 por mes, no $1.400.000 sobre
el ciclo en que lo compraste. Si se cargara entero, el costo por gramo de ese
ciclo se dispararía y el de los siguientes quedaría artificialmente barato —
y el aporte que le cobrás a un paciente se movería según cuándo compraste un
equipo, que no tiene nada que ver con lo que cuesta producir.

### La periodicidad decide cuánto entra por mes

Cuando cargás un costo elegís cada cuánto se paga. Eso define cuánto de ese
monto entra en el costo mensual:

| Periodicidad | Cuánto entra por mes |
|---|---|
| Mensual | El total, tal cual. |
| Bimestral | La mitad. |
| Anual | La doceava parte. |
| Por ciclo | El total dividido por los meses del ciclo. |
| **Único** | **Nada. No entra.** |

> **"Único" no es un costo del ciclo.** Un pago que se hace una sola vez —una
> instalación, un trámite inicial— es inversión, no gasto recurrente, y sumarlo
> al mes inflaría el costo por gramo de todos los ciclos siguientes. Si cargaste
> algo como único y esperabas verlo en el total, ese es el motivo.

El total de cada fila es **monto × cantidad**. Tres bolsas de sustrato de
$18.000 se cargan como monto 18.000 y cantidad 3, no como una fila de $54.000:
así después se entiende de dónde salió.

### Equipo o consumible: cómo lo decide el sistema

Cada insumo del inventario cae en una de las dos clases. Si no se la asignaste
a mano, el sistema la deduce:

- Categoría **Fertilizante**, **Sustrato** o **Sanidad** → consumible.
- El nombre contiene "recarga" → consumible.
- **Todo lo demás → equipo**, y por lo tanto amortiza.

Esa última regla es la que suele sorprender: un insumo mal categorizado se toma
como equipo y en vez de pesar entero sobre el ciclo se reparte en cinco años,
con lo cual el costo por gramo da más bajo de lo real. Si el número te parece
demasiado bueno, revisá las clases del inventario antes que ninguna otra cosa.

Los meses de vida útil por categoría, que es lo que define cuánto pesa por mes:

| Categoría | Meses de vida útil |
|---|---|
| Climatización | 72 |
| Riego · CO₂ · Otro | 60 |
| Iluminación | 48 |
| Medición · Herramienta | 36 |
| Sustrato · Fertilizante · Sanidad | 12 |

Una categoría que no esté en esa lista amortiza en 60 meses.

### Por qué el aporte tiene un techo

La regla **RN-04** compara el aporte por gramo del lote contra el costo por
gramo real. No es una comparación exacta: el sistema avisa cuando el aporte
supera el costo en **más de un 5 %**. Ese margen existe porque el costo se mueve
un poco entre ciclos y una diferencia de centavos no debería trabar una entrega.

Por encima de eso aparece la alerta, y el motivo es de fondo: si el aporte
supera lo que costó producir, deja de ser un reembolso de costos y pasa a
parecerse a una venta. Por eso conviene que los costos estén cargados en serio —
un costo subdeclarado no te "ahorra" nada, te baja el techo del aporte.

> **El costo por gramo es lo ya gastado.** No incluye la lista de compras
> pendiente: se compara el aporte contra lo que *efectivamente* costó producir.

> **Sin gramos cosechados no hay costo por gramo.** La pantalla muestra `—`, no
> cero. Dividir por cero daría infinito y mostrar $0 diría que producir no cuesta
> nada: las dos cosas son mentira, así que no muestra ninguna.

**Libro de Caja** (`O.N.G. › Seguimiento`) — cada reembolso que entra y cada gasto
que sale. Las entregas se asientan solas; el resto se carga a mano. Es de donde el
contador saca el balance.

---

## 07 · Libros y papeles

El sistema no sólo lleva la cuenta de qué papeles tenés: los **genera**. Lo que
falta cargar sale entre corchetes.

**Las 21 pestañas, en cinco grupos.** La barra tiene dos filas: arriba el grupo,
abajo sólo las pestañas de ese grupo. Nunca ves más de seis a la vez.

Los grupos están en el orden en que las cosas se habilitan entre sí, no en orden
alfabético: sin la entidad no hay documentos, sin el padrón no hay plantas
habilitadas, y sin nada de eso no hay qué presentar. **Si arrancás de cero, andá
de izquierda a derecha.**

| Grupo | Qué tiene adentro |
|---|---|
| **Panel** | Estado · Coherencia · Usuarios |
| **Institucional** | La entidad · Autoridades · Predios · Libros · Actas |
| **Personas** | Solicitudes · Visitas · Pacientes · Asociados · Cupo REPROCANN · Seguimiento |
| **Operación** | Autodispensación · Dispensas · Proveedores · Movimientos · Economía |
| **Papeles** | Declaraciones · Documentos |

**Y no todo el mundo ve las veintiuna.** Cada pestaña pide un permiso, así que lo
que aparece depende del rol: quien atiende el mostrador ve tres del grupo
Personas y ninguna del Institucional. El capítulo 00c tiene la tabla completa.

> **El número rojo al lado de un grupo es cuántas cosas tiene sin resolver.**
> Sale de los mismos cruces de Coherencia, así que te dice dónde está el trabajo
> sin entrar a mirar las cinco solapas. Un grupo sin número está en regla.

**Cada pestaña tiene su propia dirección.** `/ong/entidad`, `/ong/coherencia`. Eso
quiere decir que el link se puede pasar por mensaje, que el botón «atrás» del
navegador funciona entre pestañas, y que recargar te deja donde estabas.

| Pestaña | Qué hace | Cuándo se entra |
|---|---|---|
| **Estado** | Qué vence y cuándo. Es la pantalla de entrada. | Todos los días, de un vistazo. |
| **Coherencia** | Cruza los datos de todas las demás y marca lo que no cierra entre sí. | Antes de cualquier presentación. |
| **Usuarios** | Quién entra al sistema y con qué rol. Se invita por mail; las contraseñas las pone cada uno. | Al sumar o dar de baja a alguien del equipo. |
| **Solicitudes** | Lo que llega por `/sumate`: cada persona que se anotó, con su estado y sus adjuntos. | Todos los días, para no dejar a nadie esperando. |
| **Visitas** | Quién entró a la sede y por qué. | En cada visita, sea de un socio, un proveedor o una inspección. |
| **Pacientes** | La ficha de cada persona vinculada: DNI, REPROCANN, patología, médico y tope mensual. | Al dar de alta y al actualizar un REPROCANN. |
| **Cupo REPROCANN** | Cuántas plantas en floración habilita cada persona vinculada y cuántas tenés. | Antes de pasar plantas a floración. |
| **Autodispensación** | El portal del paciente visto desde adentro: reservas, estados y vencimientos. | Para ver qué reservó la gente y qué falta retirar. |
| **Dispensas** | El historial de entregas, incluidas las que no salieron del portal. | Cada vez que se entrega en mostrador. |
| **Seguimiento** | Los reportes clínicos (PROMs) que cada paciente dejó después de su entrega. | Al preparar el informe del Director Médico. |
| **Declaraciones** | DDJJ semestrales y traslados de material, con sus topes por tipo. | Dos veces al año, y en cada traslado. |
| **Documentos** | Comprobantes emitidos y recibidos, y las **plantillas institucionales**: designaciones, comodatos, informe de genéticas y mandato. | Al emitir cualquier papel institucional. |
| **Movimientos** | Caja y dispensas en una sola línea de tiempo, para seguir la plata. | Cuando un número no cierra y hay que ver de dónde salió. |
| **Economía** | El tablero: qué entró, qué salió, cuánto se debe a proveedores. | Al cerrar el mes. |
| **Proveedores** | Órdenes de servicio, pagos y saldo por proveedor. | Al comprar material y al pagar. |
| **Libros** | Los libros obligatorios, su rubricación y en qué folio va cada uno. | Una vez, al rubricarlos, y cuando se llenan. |
| **Actas** | Redacta el acta lista para transcribir al libro, con control de quórum y firmantes. | Después de cada reunión. |
| **Asociados** | El padrón societario, con su categoría y su alta. | Al dar de alta o de baja un socio. |
| **La entidad** | CUIT, razón social, domicilio legal, matrícula y objeto social, y abajo el **legajo**: estatuto, acta constitutiva y demás papeles en PDF. | **Primero de todo.** Sin esto no se emite ningún documento. |
| **Autoridades** | Comisión Directiva y Revisora de Cuentas, con cargo, mandato y grupo familiar. | Al asumir cada comisión. |
| **Predios** | Sede social y predios de cultivo, con su comodato. | Una vez, y al mudarse. |

> **Pacientes y Asociados no son lo mismo, y se cargan por separado.** Un
> asociado es miembro de la asociación civil y paga cuota; un paciente es alguien
> vinculado en REPROCANN que recibe material. La misma persona suele ser las dos
> cosas, pero no siempre: hay socios que no reciben nada y hay pacientes
> vinculados que no son socios. Por eso son dos padrones distintos y por eso
> Coherencia los cruza.

> **Los corchetes son intencionales.** Cuando un documento sale con `[CUIT]` o
> `[nombre]`, ese dato no está cargado. Preferimos que se vea el hueco antes que
> rellenarlo con algo inventado en un papel que se firma.

### Los papeles que constituyen a la entidad

Abajo de la ficha de la entidad, en `O.N.G. › Institucional › La entidad`, está
**Papeles de la entidad**: el archivo del estatuto, el acta constitutiva, el
reglamento interno, la matrícula o resolución y los poderes.

**No van en `Documentos`, y el motivo importa.** Esa pestaña tiene dos puntas —lo
que la asociación *emite* a nombre de alguien, y los *comprobantes de gasto*— y el
estatuto no es ninguna de las dos: no lo emite la asociación y no respalda que
salió plata. Además `Documentos` es una pestaña de plata, y el estatuto lo tiene
que poder leer el **director médico**, que no ve la plata.

**Vigente es del papel, no de la entidad.** Un estatuto deja de estar vigente
cuando **se lo reforma**, no cuando la entidad para de operar. Una asociación o
una cooperativa pueden estar sin actividad y su estatuto seguir rigiendo; por eso
hay un tipo *Reforma de estatuto*, que es lo que sí lo reemplaza.

**Y hay un campo «de qué persona jurídica».** Se completa sólo cuando el papel es
de otra entidad —por ejemplo el estatuto de una cooperativa distinta de la
asociación que opera en esta instalación—. Si está cargado y no coincide con la
razón social de arriba, la pantalla lo aclara: es justo la confusión que un
legajo existe para evitar.

> **Lo que el sistema mira:** que estén el **Estatuto** y el **Acta
> constitutiva**. El reglamento y los poderes son opcionales de verdad, y
> marcarlos en rojo enseñaría a ignorar el rojo. Y una ficha cargada **sin el
> PDF adjunto** no cuenta como faltante pero se marca aparte: la ficha existe, lo
> que falta es el papel.

Los archivos van a un depósito privado: se ven con sesión iniciada y el enlace
que se genera para abrirlos caduca.

### Qué revisa Coherencia

`O.N.G. › Coherencia` no mira una pantalla: cruza datos de varias y marca lo que
no cierra entre sí. Es la diferencia entre tener todo cargado y tener todo
**consistente**, que es lo que se revisa en una inspección.

Cada control queda en uno de cuatro estados: **ok**, **alerta** (conviene
mirarlo), **error** (no cierra) o **sin datos** (todavía no hay con qué
compararlo — no es una falta).

> **Cada control abierto te lleva a donde se arregla.** Debajo del detalle hay un
> link «Ir a…» que abre el formulario que lo apaga. Los que están en regla no
> linkean: no hay nada que ir a hacer.
>
> Y el orden no es sólo por gravedad: dentro de cada nivel, primero aparece lo
> que habilita al resto. No tiene sentido mandarte a redactar un acta si todavía
> no cargaste el CUIT, porque el acta saldría con `[CUIT]` entre corchetes y
> habría que rehacerla.

Son más de treinta cruces. Van agrupados por lo que hay que hacer para
apagarlos, que es la pregunta real cuando uno mira el panel.

**Vida institucional.** Se apagan cargando lo que ya existe en papel, o
reuniéndose.

| Control | Qué compara | Cómo se apaga |
|---|---|---|
| **Objeto social cannábico** | Que el estatuto declare el objeto; sin eso la actividad no está amparada. | `La entidad`, tildando el objeto. Si el estatuto no lo declara, se reforma. |
| **Altas respaldadas en acta** | Que cada asociado activo tenga el acta que aprobó su alta. | Una reunión de CD puede ratificar todas las altas juntas, con el detalle en un anexo. No hacen falta tantas actas como socios. |
| **Actas correlativas** | Que la numeración no salte ni repita, y que las fechas acompañen al número. | Cargando las actas que faltan en el medio. |
| **Cuota aprobada en acta** | Que el monto vigente salga de una decisión asentada, no de un cambio suelto. | Asentando en acta la reunión que aprobó la cuota. |
| **Categorías del estatuto** | Que no haya categorías de socio inventadas fuera de las que el estatuto define. | Corrigiendo la categoría del socio, o agregándola al estatuto. |
| **Libros obligatorios** | Que estén los siete que la ley pide. | `Libros`, uno por uno. |
| **Libros rubricados** | Que todo libro cargado tenga su rúbrica, que es la autorización del registro para usarlo. | Con el organismo, la fecha y el número de la rúbrica. **No se puede cargar un libro sin ese dato**: la rúbrica es un acto del registro público. |
| **Libros por reponer** | Avisa cuando un libro pasa el 75 % de ocupación, antes de que se llene. | Rubricando el libro siguiente antes de quedarse sin folios. |
| **Revisión de libros** | Que la Comisión Revisora haya revisado en el plazo. | Asentando la revisión. |
| **Mandato de autoridades** | Que el mandato de la CD no esté vencido. | Asamblea y acta de designación. |
| **Parentesco entre órganos** | Que no haya parentesco cruzado entre CD y Revisora de Cuentas. | Cargando el grupo familiar de cada autoridad en `Autoridades`. Sin ese dato el control no puede correr. |
| **Antecedentes penales** | Que estén los certificados RNR de CD y Revisora. | Cargándolos en `Autoridades`. |
| **Cierre de ejercicio** y **Presentación de balance** | Que el ejercicio cierre y el balance se presente en fecha. | Asamblea ordinaria. |

**Padrón y fichas.** Se apagan cargando datos de cada persona.

| Control | Qué compara | Cómo se apaga |
|---|---|---|
| **Padrón sin duplicados** | Que no haya dos fichas de la misma persona: mismo DNI o mismo teléfono. | Fusionando las fichas. La misma persona con dos fichas **parte su historial de consumo**, que es justo lo que mira la ventana de 30 días. Ver la receta *Fusionar fichas duplicadas*. |
| **Ficha del paciente completa** | Que cada paciente activo tenga DNI, patología y médico tratante. | `Pacientes`, ficha por ficha. El REPROCANN no pide sólo el número: pide el documento, la patología que justifica el uso y quién la indicó. |
| **Tope mensual por paciente** | Que cada paciente tenga cargado su tope. | `Pacientes`, campo *Tope mensual*. **Sin tope, la ventana de 30 días no valida NADA para esa persona**: se puede entregar de más sin que el sistema avise. El número sale del REPROCANN de cada uno; no lo puede inventar el sistema. |
| **REPROCANN de fundadores** | Que los fundadores tengan su registro. | Cargándolo en su ficha. |
| **Reinscripción REPROCANN** | Que los registros no estén vencidos. | Renovando el trámite y actualizando la fecha. |
| **Credenciales al día** | La **fecha** de vencimiento de cada credencial, no el estado guardado. | Renovando el trámite y cargando la fecha nueva. Avisa 60 días antes, cuando todavía se puede hacer algo. **Mira la fecha a propósito**: `estado` dice «Vigente» hasta que alguien entra a la ficha, y nadie entra el día que se vence. |
| **Credenciales con fecha** | Que toda ficha que dice «Vigente» tenga su vencimiento cargado. | `Pacientes`, con el filtro **⚠ Vigente sin fecha**, que las muestra juntas con su teléfono y su mail. **Una credencial sin fecha no se puede vencer nunca**: no es que esté vigente, es que no hay forma de saberlo, y el aviso de arriba no la ve. |
| **Beneficiarios sin repetir** | Que el mismo proveedor no esté escrito de dos formas. | Unificando la grafía. Si no, los totales por beneficiario muestran a la misma persona partida en dos. |

**Entregas y material.** Cruzan el cultivo contra lo que salió.

| Control | Qué compara | Cómo se apaga |
|---|---|---|
| **Balance de materia** | Que los gramos cosechados, los de los lotes y los entregados cierren entre sí. | Cargando el lote que falta, o corrigiendo la entrega. |
| **Lotes sin sobregiro** | Que no se haya entregado de un lote más de lo que ese lote tenía. | Corrigiendo la entrega mal imputada. |
| **Plantas en floración vs. tope** | Las plantas contra lo que habilita el REPROCANN de los vinculados. | Bajando plantas, o sumando personas vinculadas. |
| **Cada entrega encuentra su lote** | Que el código de lote de cada entrega exista. | Corrigiendo el código. **Da cero y esa es la gracia**: es el detector de que la traza se cortó, y la traza es lo único que conecta lo entregado con de dónde salió. |
| **Origen del material propio** | Producción propia que entró sin una cosecha que la respalde. | Cargando la cosecha y después cambiando el origen del lote a *Cultivo propio*. El material está contado y las entregas cuadran: lo que falta es la cadena hacia atrás, de qué plantas salió. |
| **Dispensas sin paciente** | Entregas que no apuntan a nadie del registro. | Asignando el paciente. **Consumo interno, merma y saldo inicial no cuentan acá**: descuentan stock igual que una entrega pero no van a nadie, y el control las saltea. Retribución en especie y muestra **sí** cuentan, porque van a alguien. |
| **Dispensas sobre los 40 g** | Entregas por encima del tope de traslado individual. | Cargando la receta que respalda la necesidad medicinal, o entregando en más de una vez. Sólo cuenta lo medido **en gramos**: una entrega en unidades no toca este tope. |
| **Entregas con respaldo REPROCANN** | Que quien recibió tenga número de registro. | Pidiéndole el número a quien ya inició el trámite. Si la persona no tiene REPROCANN, el problema no es de datos. |
| **Entregas con cantidad cargada** | Entregas con aporte cobrado y cantidad en cero. | Cargando los gramos que salieron. **Es la falla más cara**: rompe cuatro cruces a la vez sin disparar ninguno, porque sumar cero no cambia ningún total. |

**La plata.** Cruzan caja, dispensas y comprobantes.

| Control | Qué compara | Cómo se apaga |
|---|---|---|
| **Reembolso vs. costo real** | El aporte por gramo contra el costo de producción (RN-04). | Bajando el aporte, o revisando el costo. Por encima del costo real deja de ser reembolso y se parece a una venta. |
| **Aportes sin negativos** | Que ningún aporte esté cargado en negativo. | Si fue una devolución, registrándola como tal (ver la receta). Si fue un signo mal tipeado, corrigiendo el importe con *Editar*. Las dos lecturas dan números distintos y sólo la asociación sabe cuál pasó. |
| **Órdenes con número único** | Que ningún número de orden se use dos veces. | Renumerando una. Los pagos se ligan a la orden **por el número**: si está repetido, no se puede saber a cuál se le pagó. |
| **Producción propia separada** | Que lo cargado a nombre de la propia asociación no cuente como deuda. | `La entidad`, campo *Nombre propio como proveedor*. **Plata que uno se debe a sí mismo no es deuda**: sin ese dato, la producción propia anotada como orden de servicio infla el saldo con proveedores. |
| **Cuotas del período** | Que estén emitidas las que corresponden al período. | `Asociados`, botón de emitir cuotas. |

**Documentos y trámites.** Dependen de un trámite afuera de la app.

| Control | Qué compara | Cómo se apaga |
|---|---|---|
| **Declaración jurada del semestre** | Que la DDJJ del semestre en curso esté armada y presentada. | Armándola en `Declaraciones` y presentándola **por TAD**. El tilde de presentada dice que el trámite se hizo, no que el documento existe. |
| **Cartas de porte** | Que cada traslado registrado tenga su carta presentada. | Presentándola por TAD. Antes hay que tener los cuatro datos obligatorios: origen, destino, transportista y destinatario final. |
| **Fechas posibles** | Que nada esté fechado después de hoy. | Corrigiendo el año mal tipeado. El **registro mensual del mes en curso** no cuenta acá: se fecha al cierre del período a propósito, para que el documento diga qué mes cubre. |

**El balance de materia es el que más suele sorprender.** Cruza tres números que
se cargan en pantallas distintas: lo que dijiste que cosechaste, lo que pusiste
en los lotes y lo que entregaste. Si no cierran, en algún lado hay material sin
declarar o declarado dos veces. Suele ser una cosecha cargada sin su lote, o un
lote creado a mano con gramos que no salieron de ninguna cosecha.

> **"Sin datos" no es una falta.** Aparece cuando todavía no cargaste lo que ese
> control necesita comparar. Se convierte en ok o en error recién cuando hay con
> qué. Lo que hay que dejar limpio antes de una presentación son los **errores**.

---

## 07b · El circuito completo, de la compra a la entrega

El material entra por un lado y sale por el otro. La plata hace el camino
inverso. Los dos lados son espejo y cada uno tiene su comprobante.

```
   COMPRA                              ENTREGA
   entra material, sale plata          sale material, entra plata

   1. Comprobante del proveedor        1. La entrega (dispensa)
      factura · ticket · remito           descuenta del lote
   2. El lote                          2. Recibo del aporte
      recién acá se puede entregar        «Comprobante de dispensa»
   3. El pago                          3. El reporte de seguimiento
      egreso de caja                      sin él no puede volver a retirar
```

**El paso 2 es el que se saltea de los dos lados**, y es el que sostiene todo:
sin lote el material no existe para entregar, y sin recibo el aporte no se puede
probar como reembolso.

### Cuál comprobante va en cada caso

Son catorce clases y elegir mal no da error: el documento sale igual, con el
título equivocado, y se descubre cuando alguien lo presenta. **Al elegir la clase
en el formulario, la pantalla te dice qué es y cuándo se usa.**

**Lo que la asociación emite:**

| Clase | Qué prueba |
|---|---|
| **Comprobante de dispensa** | El aporte por reembolso de costos. Es lo que prueba que la entrega no fue una venta. |
| **Recibo de cuota** | La cuota social que pagó un asociado. |
| **Constancia de socio** | Que alguien es miembro de la asociación y está al día. |
| **Certificado de vinculación** | Que la persona está vinculada en REPROCANN. **No es lo mismo que ser socio.** |
| **Nota / carta** | Cualquier comunicación formal a un tercero. |

**Lo que la asociación recibe:**

| Clase | Qué prueba |
|---|---|
| **Factura A** | Proveedor inscripto. Es el respaldo más fuerte. |
| **Factura B** | Cuando la asociación es consumidor final. La más habitual. |
| **Factura C** | Proveedor monotributista. |
| **Ticket** | Gasto chico. Vale menos que una factura, pero es mejor que nada. |
| **Remito** | Que la mercadería llegó. **No respalda el pago.** |
| **Recibo** | Que se pagó, pero no detalla qué. Honorarios, retribuciones. |
| **Comprobante de transferencia** | Que la plata salió del banco. **Va junto con la factura, no en su lugar.** |

> **Sin comprobante, el costo por gramo es un número que no se puede defender.**
> Y el costo por gramo es lo que hace que un aporte sea un reembolso y no otra
> cosa. Por eso el respaldo del gasto no es burocracia: sostiene el argumento
> completo.

---

## 08 · Las reglas que bloquean

Cuando el sistema no deja avanzar, siempre dice qué regla es y cómo destrabarla.
Los bloqueos aparecen juntos, no de a uno.

| Regla | Qué exige | Cómo se destraba |
|---|---|---|
| **RN-01** | REPROCANN vigente y vinculado. | Cargar o renovar el REPROCANN en la ficha del paciente. |
| **RN-02** | No pasar el tope de gramos en 30 días. | Esperar a que las entregas viejas salgan de la ventana, o revisar el tope. |
| **RN-03** | Mandato de Gestión Operativa firmado. | Firmarlo desde la pantalla de reserva. |
| **RN-04** | El aporte no puede superar el costo de producción. | Cargar costos reales y ajustar el aporte por gramo del lote. |
| **RN-05** | La entrega anterior tiene que tener su reporte. | Completar la encuesta desde la misma pantalla que bloquea. |
| **RN-06** | La reserva vence a las 72 h y el material vuelve. | Generar una reserva nueva. |
| **RN-07** | El reporte clínico es inmutable. | No se destraba: es a propósito. |

### Cómo se cuenta el cupo de 30 días

Son tres cosas que conviene tener claras por separado, porque cada una explica
un caso distinto de "el cupo no me da".

**No se mide por entrega, se mide por acumulado.** El tope no es "cuánto puede
llevarse hoy" sino "cuánto se llevó en los últimos 30 días". Validar sólo la
entrega individual dejaría pasar el caso real: cinco entregas de 35 g en tres
semanas pasan una por una y en conjunto son 175 g.

**Los 30 días son corridos y se cuentan hacia atrás desde la fecha de la
entrega**, no desde hoy. Esto importa cuando cargás una dispensa con fecha
pasada: se valida contra su propio período, no contra el mes en curso. Si fuera
al revés, corregir una entrega vieja podría trabarse por material entregado
*después*, que es al revés de como pasaron las cosas.

**Suma lo entregado más lo reservado sin retirar.** Si contara sólo las
entregas, cinco reservas del mismo día pasarían el tope las cinco y el exceso se
descubriría en el mostrador, con el material ya comprometido. Por eso podés ver
el cupo agotado aunque todavía no se haya retirado nada: hay gramos apartados.
Se liberan si las reservas expiran a las 72 h o se cancelan.

> **Sin tope cargado no hay control.** Si la ficha del paciente no tiene el tope
> mensual en gramos, el sistema no puede decir si se pasa: muestra el acumulado
> pero no bloquea. El tope es un dato del REPROCANN de esa persona, no un default
> del sistema, así que no puede inventarlo.

---

## 09 · Cada cuánto hacer qué

| Cuándo | Qué | Dónde |
|---|---|---|
| **Al abrir la sede** | Los cuatro pasos: lectura de sala, control de caja, control de stock, novedades. | Panel (capítulo 00a) |
| **2 veces por día** | Cargar la lectura de ambiente: temperatura y humedad. | Panel, paso 1 · o Agronómico › Ambiente › Cargar |
| Diario | Registrar riegos y aplicaciones. | Agronómico › Sala |
| Semanal | Mirar el análisis del ambiente y corregir lo que se fue de rango. | Agronómico › Ambiente › Análisis |
| Diario | Verificar pagos por transferencia y entregar lo reservado. | O.N.G. › Autodispensación |
| Semanal | Actualizar fases de las plantas y revisar qué se viene. | Agronómico › Plantas · Línea de tiempo |
| Semanal | Asentar gastos en el Libro de Caja. | O.N.G. › Seguimiento |
| Mensual | Cargar costos del mes y revisar el costo por gramo. | Econometría |
| Mensual | Revisar vencimientos de REPROCANN. | O.N.G. › Estado |
| Trimestral | Revisión de libros. | O.N.G. › Libros |
| Semestral | DDJJ e informe del Director Médico. | O.N.G. › Declaraciones · Seguimiento |
| Por cosecha | Cargar pesos, crear el lote y pedir el análisis. | Cosecha › O.N.G. › Catálogo |

> **Empezá el día por el Panel, no por Estado.** El Panel es la rutina de
> apertura y te dice qué falta hacer **hoy**: si los cuatro pasos están tildados,
> la sede quedó abierta como corresponde. `O.N.G. › Estado` es la otra mirada —lo
> que vence y lo que falta del lado de los papeles— y se revisa cuando el día ya
> arrancó, no antes de contar la caja.

---

## 10 · Problemas frecuentes

| Lo que ves | Qué pasa |
|---|---|
| Una pantalla muestra `—` | Falta un dato para calcular. No es cero: el sistema evita mostrar un número que sería mentira. |
| El lote tiene menos disponible del esperado | Hay gramos apartados por reservas sin retirar. Mirá la columna *reservado*. |
| El cupo está en cero y no entregaste nada | Hay reservas vivas que ya comprometen ese cupo. Se libera si expiran o se cancelan. |
| No deja entregar una reserva paga por transferencia | Falta que administración la marque como abonada. |
| Un documento sale con corchetes | Ese dato no está cargado. Cargalo y volvé a generarlo. |
| El cupo de plantas no da | Se cuentan sólo las plantas en floración. Revisá las fases. |
| **En Cosecha no figura la variedad que cosechaste** | Ahí sólo aparecen las variedades que tienen **plantas cargadas**, porque la cosecha se registra sobre la planta. La pantalla te dice cuáles del banco están sin ninguna y te lleva a cargarlas. |
| **Al anotar la entrega no aparece el lote** | Si el material salió de una cosecha, todavía no es un lote: cargalo en *Autodispensación › Catálogo*, que avisa cuánto hay cosechado sin lotear. Si el lote existe, puede estar agotado o retirado del catálogo — el desplegable sólo ofrece los que tienen material. |
| El desplegable de lote sale vacío teniendo lotes | Están todos entregados. No cargues la entrega «sin especificar»: así no descuenta de ningún lado y el balance deja de cerrar. |
| El balance de materia da el doble de lo cosechado | Un lote de cultivo propio quedó marcado *comprado* o *propio sin cosecha*, así que el material entró dos veces. Corregí el origen del lote. |
| **Creaste la sala en Ambiente y no aparece en Plantas** | Son dos cosas distintas: Ambiente es para temperatura y humedad, y las plantas van en un *área de cultivo*. `Agronómico › Sala` lo avisa y trae el botón para crearla. |
| La Línea de tiempo proyecta mal la cosecha | Revisá el **tipo** de la genética: una feminizada cuenta desde que pasa a floración y una automática desde la germinación. Con el tipo mal, la fecha estimada sale corrida. |
| La merma de secado sale `—` con los dos pesos cargados | El peso seco quedó mayor o igual que el húmedo. Revisá si se invirtieron. Lo normal ronda 75–80 %. |
| El g/W sale `—` | Las luces no están en el inventario con su potencia. Sin vatios no hay gramos por vatio. |
| El costo por gramo da sospechosamente bajo | Puede haber insumos clasificados como equipo: en vez de pesar sobre el ciclo se reparten en años. Revisá las clases en *Inventario*. |
| Cargaste un costo y el total no se movió | Si lo cargaste con periodicidad **Único**, no entra al costo mensual: es inversión, no gasto del ciclo. |
| Un dato no se puede corregir desde su pantalla | Editalo en *Tablas*, celda por celda. |
| **El control de caja marca una diferencia y no sabés de dónde salió** | Mirá el control del stock del mismo día: la plata y el material se mueven juntos, y una entrega sin asentar aparece como material de menos con la caja cuadrada, o al revés. |
| **Contaste mal y guardaste el control** | No se edita: cargá otro. Corregir el anterior borraría la evidencia de que hubo una diferencia, que es justo lo que el control existe para dejar. |
| **El stock marca en rojo por medio gramo** | No debería: el material tolera 1 gramo. Si marca menos que eso, revisá que estés comparando el mismo lote. |
| **No aparece una genética que sabés que existe** | La pantalla abre filtrada por las que están en las salas. Tocá *Ver todas*, o escribí el nombre —buscar apaga el filtro solo. |
| **El plan dice 60 plantas y la sala tiene 63** | Está bien que lo diga: para eso está el cruce. **No edites el plan para que cierre** — el plan es lo que se declaró; si la realidad cambió, lo que corresponde es explicar por qué, no reescribir la declaración. |
| **Cargaste una lectura de ambiente en la sala equivocada** | Corregila en *Tablas*. Y de acá en más mirá el selector de sala del formulario: aparece siempre, aunque haya una sola. |
| **Coherencia marca en rojo «Códigos de vinculación»** | Falta el código de esas personas. Lo saca cada una en Mi Argentina, gratis; se le pide y se carga en su ficha de paciente. |
| **`La entidad` avisa que falta el estatuto** | Cargalo en *Papeles de la entidad*, abajo de la ficha. Si la ficha ya está pero sin el PDF, lo que falta es adjuntar el archivo. |

---

## 11 · Paso a paso de cada cosa

Las recetas concretas, con los campos tal como aparecen en pantalla. Los marcados como
obligatorios no dejan guardar sin completar; el resto puede esperar.

### Controlar la caja y el stock

**Dónde:** `Panel › paso 2 «Controlar la caja»` (el paso 3 abre la misma pantalla)

1. Se abre con **los valores esperados ya puestos**: lo que el sistema calcula que
   debería haber en efectivo, en transferencias y en cada lote.
2. Contá y escribí **lo que hay de verdad**. La diferencia aparece mientras
   escribís: si no cuadra, volvé a contar **antes** de guardar.
3. Podés dejar en blanco lo que no contaste. Un campo vacío es «no lo conté», que
   no es lo mismo que «conté cero» — y el sistema los distingue.
4. Guardá. Queda registrado con la fecha, la hora y **quién contó**.

> **No se edita ni se borra.** Si contaste mal, cargá otro control. Y el esperado
> queda congelado: si mañana se corrige un asiento viejo, la diferencia de hoy no
> cambia sola.

### Cargar el plan de cultivo

**Dónde:** `Agronómico › Plan › botón Cargar plan`

1. **Nombre** del plan y **Desde / Hasta** del ciclo que cubre.
2. **Plantas previstas** y **Pacientes previstos** — los dos números que el
   sistema cruza contra la realidad. Si no los declarás, no hay desvío que
   mostrar: el cruce queda en blanco, que es lo correcto, y no en cero.
3. **Genéticas**, **Espacios**, **Riego**, **Fertilización** y **Luces**, en texto
   libre. Es lo que va redactado en el documento que se declara.
4. **Notas**. Guardá.

Arriba de la pantalla vas a ver el desvío: cuántas plantas declaró el plan y
cuántas hay en las salas. **No edites el plan para que cierre.**

### Cargar el estatuto o el acta constitutiva

**Dónde:** `O.N.G. › Institucional › La entidad › Papeles de la entidad › Cargar`

1. **Qué papel es** — Estatuto, Acta constitutiva, Reglamento interno, Matrícula /
   Resolución, Poder / Autorización, Reforma de estatuto, u Otro.
2. **Título**. Si subís el archivo primero, se completa solo con el nombre del PDF.
3. **Número** — tal como lo emitió el organismo, con letras y todo. El acta
   constitutiva de la asociación, por ejemplo, es `ACTA-2023-143072795-APN-DTD#JGM`.
4. **Fecha** — la del acto, no la de hoy.
5. **De qué persona jurídica** — dejalo vacío si es de la entidad de esta
   instalación. Completalo si el papel es de otra, por ejemplo el estatuto de una
   cooperativa distinta de la asociación que opera acá.
6. **Vigente** — viene tildado. Destildalo **sólo si otro papel lo reemplazó**;
   que la entidad no esté operando no apaga su estatuto.
7. **Notas** y **Archivo** (PDF o foto). Guardá.

> **Un mismo PDF puede ser dos papeles.** Un acta constitutiva suele traer el
> estatuto insertado adentro: en ese caso se carga dos veces, una como acta y otra
> como estatuto, subiendo el archivo en cada una. Así borrar una ficha no deja a la
> otra sin su papel.

### Crear una genética

**Dónde:** `Agronómico › Genéticas › botón Genética`

1. **Nombre** (obligatorio) — es lo único que no podés dejar vacío. Podés crear la genética sólo con esto y completar el resto cuando la conozcas.
2. **Banco** y **Tipo** — feminizada, automática o regular. El tipo cambia cómo se calcula la línea de tiempo.
3. **Genotipo**, **Indica/Sativa %** y **Linaje / Cruza** — para tu referencia.
4. **THC %** y **CBD %** — valores estimados de la variedad.
5. **Vege (días)** y **Flora (días)** — con esto la Línea de tiempo puede estimar la fecha de cosecha.
6. **Altura**, **Dificultad**, **Ambiente**, **Rendimiento**, **Stretch (flora)** y **Resistencia**.
7. **Terpenos / Aroma**, **Efectos** y **Usos medicinales**.
8. Guardá.

> Los valores de THC y CBD de la ficha son estimados de la genética. No reemplazan
> el análisis del lote: en el informe cromatográfico van los medidos, no estos.

### Cargar plantas

**Dónde:** `Agronómico › Plantas › botón Planta`

1. **Genética** — elegila de la lista. Si no está, el botón **+** al lado abre el alta de genética sin perder lo que ya cargaste.
2. **Apodo** — cómo la llamás vos ("La gorda"). Si cargás varias de una, se numeran solas.
3. **Cantidad** — hasta 50 de un saque. Es la forma de dar de alta un lote de clones sin repetir el formulario.
4. **Fecha germinación** — de acá sale el día de vida que ves en cada ficha.
5. **Fase** — en qué etapa entra.
6. **Sustrato** y **Maceta** — por ejemplo "20L tela".
7. **Ubicación** — "Indoor carpa 120x120".
8. **Paciente asignado** — con qué REPROCANN se ampara esta planta. Es lo que después cuadra el cupo por persona.
9. Tocá **Crear planta**. Si pusiste cantidad mayor a uno, el botón dice cuántas va a crear.

> Cada planta recibe un código QR propio para su historia clínica. Se imprime desde
> la ficha y sirve para llegar a la planta escaneando en vez de buscarla en la lista.

### Crear una sala de ambiente

**Dónde:** `Agronómico › Ambiente › Salas`

Se hace una vez, antes de la primera lectura.

1. **Nombre** (obligatorio) — "Sala 1", "Carpa vegetativo", como la llamen entre ustedes.
2. **Etapa** — vegetativo o floración. Define contra qué rango se compara cada lectura.
3. **Agregar**.

Después, cuando esa sala cambie de etapa, se cambia con el selector de su fila.
Es lo único que hay que mantener en esta pantalla.

> Borrar una sala **borra también todas sus lecturas**. Si dejaron de usarla pero
> querés conservar el historial, no la borres.

### Cargar una lectura de ambiente

**Dónde:** `Agronómico › Ambiente › Cargar`

Dos veces por día, mañana y tarde.

1. **Sala** — sólo aparece si hay más de una. Queda elegida la última que usaste.
2. **Cuándo** — viene con la fecha y hora de ahora. Cambialo sólo si estás
   cargando una lectura que tomaste antes.
3. **Temperatura (°C)** (obligatorio).
4. **Humedad (%)** (obligatorio).
5. **Nota** — opcional, pero es lo que después explica un pico raro en el
   gráfico: "se cortó la luz", "quedó la puerta abierta".
6. Mirá el bloque que aparece con el **VPD** y los tres semáforos antes de
   guardar. Si algo está fuera de rango, la pantalla te dice para qué lado y qué
   corregir.
7. **Guardar lectura**.

> **Si te equivocaste de dígito, no guarda.** Una temperatura de 250 °C o una
> humedad de 150 % se rechazan al cargar. Es a propósito: un número así arruina
> el promedio y el máximo de toda la serie, y se descubre semanas después cuando
> ya nadie se acuerda de qué día fue.

**Si el error lo ves después**, abajo del formulario está *Últimas lecturas* con
las ocho más recientes. El **lápiz** de cada fila corrige temperatura, humedad y
nota; la **papelera** la borra. Al corregir, el VPD se vuelve a calcular solo, y
valen las mismas guardas: un 250 tampoco entra por acá.

### Crear un área de cultivo

**Dónde:** `Agronómico › Sala`

Un área es cada lugar donde ponés plantas: una carpa, una cama, un sector, una
mesa. Mientras no haya ninguna, la pantalla lo dice y ofrece crear la primera:
no dibuja un plano que no existe.

> **Si ya cargaste la sala en Ambiente, no alcanza.** Son dos cosas distintas:
> las salas de Ambiente sirven para temperatura y humedad, y las plantas van en
> un área de cultivo. Cuando hay una sala de Ambiente sin su área, esta pantalla
> lo avisa arriba y trae el botón que la crea con el nombre ya puesto.

1. Tocá **Crear la primera área** (o **Nueva área**, si ya tenés alguna).
2. Elegí **qué es** —carpa, cama, sector, sala, mesa o invernadero— y ponele
   **nombre**. El nombre es el que vas a ver en el plano y en el historial de
   cada planta.
3. Cargá las **medidas** del espacio, en metros. Son opcionales: van en el
   cartel del área para que sepas cuál es cuál.
4. Poné **cuántas plantas entran**. Con eso se propone la grilla: 12 plantas dan
   4 columnas por 3 filas.
5. Si la grilla propuesta no se parece al espacio real, corregí **columnas** y
   **filas** a mano. La vista previa de abajo muestra lo que se va a dibujar, y
   el número de **lugares** se actualiza solo.
6. **Crear área**.

Para cambiarle algo después, el **lápiz** en el encabezado del área; la
**papelera** la borra.

> **Borrar un área no borra las plantas que tenía adentro.** Vuelven a *Sin
> ubicar*, abajo de todo, y desde ahí las reubicás donde quieras. El aviso te
> dice cuántas son antes de confirmar.

> Achicar la grilla de un área que ya tiene plantas puede dejar afuera a las que
> estén en los últimos lugares. Tampoco se borran: quedan sin ubicar hasta que
> las vuelvas a poner.

### Regar o fumigar toda la sala

**Dónde:** `Agronómico › Sala`

1. Elegí **Regar** o **Fumigar** arriba.
2. Cargá la **receta de hoy**: lo que pongas se guarda en cada planta que toques.
3. Tocá las plantas una por una, o el nombre de la carpa para marcarlas todas.
4. El contador de arriba lleva la cuenta: "0 / 12 regadas hoy", según cuántas
   plantas tengas ubicadas.

Los colores dicen hace cuánto se regó cada posición: regada hoy, 1-2 días, 3+ días,
sin registro. El puntito de color es la genética.

> **Mover** cambia una planta de posición sin perderle el historial. Sirve cuando
> rotás la carpa.

### Registrar algo puntual en una planta

**Dónde:** `Agronómico › Plantas`, en la tarjeta de cada planta

Cada planta tiene sus botones a mano: **Riego**, **Ferti**, **Poda**, **Nota** y
**Cosecha**. **Historial** abre todo lo registrado, con el contador de cuántos
eventos lleva.

Es para lo puntual —una poda, una observación—. Para lo que hacés en tanda,
Sala es más rápido.

### Corregir o borrar algo de la línea de tiempo

**Dónde:** `Agronómico › Plantas` → abrí la planta

Cada fila de la línea de tiempo tiene dos botones. En la computadora aparecen al
pasar el mouse por encima; en el celular están siempre a la vista.

1. **Lápiz** — corrige la **fecha** y el **texto** de un evento. Guardá y listo.
2. **Cruz** — borra la fila.

Dos detalles que conviene saber antes de buscarlos:

- En una **aplicación**, el lápiz edita la fecha y las **notas**. El producto, la
  dosis y la categoría se corrigen desde *Tablas*, porque el renglón que ves en
  la línea de tiempo junta esas columnas en un solo texto.
- La **cosecha** no tiene lápiz. Lo que se muestra es un resumen de cinco datos
  (pesos, valoración, notas), así que se corrige donde se cargó: `Agronómico › Cosecha`,
  o en *Tablas*.

### Pasar plantas a floración

**Dónde:** `Agronómico › Plantas`, editando la ficha

Cambiá la **Fase** a Floración. Hacelo el día que cambiás el fotoperiodo, no después.

> Esto no es prolijidad: el tope de la Resolución 1780 se cuenta sobre las plantas
> **en floración**. Si las fases están atrasadas, el cupo de `O.N.G. › Cupo REPROCANN`
> te va a dar mal, y es el número que mirás para saber si estás dentro de lo habilitado.

### Cargar una cosecha

**Dónde:** `Agronómico › Cosecha`, o el botón **Registrar una cosecha** del Panel de la
O.N.G. — ese botón abre directamente el paso 1.

1. **Elegí la variedad.** Entrando por el botón del Panel se abre solo un
   selector con las que están **listas para cosechar** (las que tienen plantas
   en floración) y las **empezadas a medias**. Entrando por el menú, buscala en
   la lista y tocá **Cargar** o **Ver / editar**.

   > Si la que cosechaste no está, es que todavía no tiene plantas cargadas: la
   > cosecha se registra sobre la planta. El aviso de arriba de la pantalla dice
   > cuáles del banco están sin ninguna y te lleva a cargarlas.

2. **Fecha de cosecha**.
3. **Peso seco (g)** (obligatorio) — si además cargás el húmedo, el sistema calcula la merma.
4. **Valoración** — del 1 al 10, para el ranking.
5. **Notas de sabor / cata** y **Notas de curado**.
6. Guardá.

Podés cargar el total de la variedad o abrir el modo por planta y cargar el peso de
cada una. Por planta es más trabajo pero te deja comparar rendimientos entre
individuos de la misma genética.

> Si la merma sale `—` teniendo los dos pesos cargados, quedaron invertidos: el
> seco no puede ser mayor que el húmedo. Si sale un número pero muy lejos de
> 75–80 %, los pesos están en el orden correcto y lo que hay que revisar es el
> secado (o un dígito de más al tipear).

> **Con la cosecha cargada todavía no podés entregar.** Falta el lote: es lo que
> la entrega referencia. Andá a `O.N.G. › Autodispensación › Catálogo`, que te
> avisa cuántos gramos hay cosechados sin lotear y trae el botón para crearlo
> —ya marcado como *cultivo propio*, que es lo que evita contar el material dos
> veces—. Ver el capítulo 04.

### Cargar un costo

**Dónde:** `Econometría › Costos`

1. **Nombre** (obligatorio) — "Alquiler galpón", "Bolsa de coco".
2. **Categoría** — sugeridas para fijos: Alquiler, Luz (abono), Internet, Amortización equipos, Seguro. Para variables: Nutrientes, Sustrato, Luz (consumo), Agua, Semillas/Clones, Sanidad, Mano de obra. Igual podés escribir la tuya.
3. **Periodicidad** — Único, Mensual, Bimestral, Por ciclo o Anual. Esto es lo que decide cómo se prorratea al costo del ciclo.
4. **Monto ($)** y **Cantidad**.
5. **Notas**.
6. Guardá.

> La periodicidad importa más que el monto. Un gasto anual cargado como mensual
> multiplica por doce el costo por gramo y te hace cobrar de más.

### Cargar un insumo al inventario

**Dónde:** `Econometría › Inventario`

1. **Nombre** (obligatorio).
2. **Categoría**.
3. **Potencia (W)** — sólo para equipos que consumen. Es de donde sale el cálculo de gramos por vatio en Estadísticas.
4. **Marca** y **Modelo**.
5. **Cantidad** y **Unidad**.
6. **Stock mínimo** — el umbral por debajo del cual conviene reponer; el inventario lo marca.
7. **Dosis / uso (fertilizantes)** y **Para qué se usa**.
8. **Proveedor** y **Precio ($)**.
9. **Specs / detalle** y **Notas**.
10. Guardá.

El inventario es plata inmovilizada: lo que cargues acá entra en el costo del ciclo.

### Cargar un equipo y su amortización

**Dónde:** `Econometría › Instalaciones`

1. **Nombre** (obligatorio) y **Sistema** — a qué parte de la instalación pertenece.
2. **Proveedor**, **Marca**, **Modelo**.
3. **Precio unit. ($)**, **Cantidad** y **Unidad**.
4. Guardá.

Si estás comparando presupuestos, cada ítem admite varias **ofertas** con
**Proveedor**, **Precio ($)**, **Presentación**, **Foto de la cotización** (sirve la
captura de Mercado Libre) y **Nota**. Elegís una y el precio del ítem se actualiza solo.

> La vida útil del equipo es lo que hace que se amortice en vez de golpear todo el
> costo en un solo ciclo.

### Programar un mantenimiento

**Dónde:** `Econometría › Mantenimiento`

1. **Equipo / insumo del inventario** — o **Equipo (texto libre)** si no está cargado.
2. **Tipo** — qué hay que hacerle.
3. **Frecuencia (días)** — cada cuánto se repite.
4. Guardá. Queda listado en `Econometría › Mantenimiento` con su próxima fecha.

### Borrar una entrega que se cargó mal

**Dónde:** `O.N.G. › Dispensas`, botón de la papelera en la fila de la entrega.

Se usa cuando la entrega **no existió** — una prueba, un cargue duplicado, un
error de tipeo que ya se guardó. No se usa cuando la entrega existió y la persona
devolvió el material: para eso está **Devolver**, que deja las dos cosas
registradas.

1. Buscá la entrega en la lista.
2. Tocá la papelera.
3. Leé la confirmación **antes de aceptar**. Te dice tres cosas: a quién era, que
   los gramos vuelven al lote, y —si esa entrega generó un aporte— cuánta plata
   sale de la caja.
4. Confirmá.

Qué pasa al borrarla:

| | |
|---|---|
| **Los gramos** | Vuelven al saldo del lote, solos. No hay que corregir nada. |
| **La plata** | El asiento del aporte se borra junto con la entrega. |
| **El reporte de seguimiento** | Si tenía uno cargado, se borra con ella. |
| **El recibo emitido** | Queda en Documentos, sin la entrega. Si ya se le dio el papel a alguien, mejor no borrar: usá **Devolver**. |

> **Cuándo NO borrar:** si el papel ya salió de la asociación. Un recibo entregado
> con un número que después no tiene entrega detrás es peor que el error original.

### Configurar la entidad

**Dónde:** `O.N.G. › La entidad`

Se hace una vez. De acá salen los encabezados de todos los documentos que el sistema
genera, así que lo que falte va a aparecer entre corchetes en cada papel.

1. **Razón social** y **CUIT**.
2. **Jurisdicción** y **Organismo de control** — IGJ, Dirección de Personas Jurídicas provincial, el que corresponda.
3. **Fecha de constitución**.
4. **Domicilio**, **Localidad** y **Provincia** de la sede.
5. **Cierre · día** y **Cierre · mes** — el cierre de ejercicio. Define cuándo vence la asamblea ordinaria.
6. **Duración del mandato (años)** y **Mandato vigente desde** — con esto el sistema avisa cuándo hay que renovar autoridades.
7. REPROCANN institucional: **Inscripción** y **Vencimiento**.
8. **Última revisión de libros** — para el aviso trimestral.
9. Topes: **Pacientes**, **Plantas por paciente** y **Predios**. Son los límites contra los que se controla la capacidad.
10. Guardá.

### Cargar una autoridad

**Dónde:** `O.N.G. › Autoridades`

1. **Nombre** y **Cargo**.
2. **Órgano** — Comisión Directiva o Comisión Revisora de Cuentas.
3. **Grupo familiar** — sirve para detectar parentesco cruzado entre autoridades, que es una de las cosas que revisa Coherencia.
4. Guardá.

La lista de autoridades activas es la que después completa sola las designaciones y
los firmantes de las actas.

### Cargar un predio

**Dónde:** `O.N.G. › Predios`

1. **Nombre** y **Dirección**.
2. **Localidad**, **Provincia** y **Municipio**.
3. Marcá si está **georreferenciado** y si el **municipio fue notificado**. Las dos cosas las pide la 1780 y son las que Estado te va a reclamar si faltan.
4. Guardá.

### Marcar los requisitos de la 1780

**Dónde:** `O.N.G. › Estado`

La lista de requisitos de la Resolución 1780 viene cargada. De cada uno marcás si está
cumplido, con qué se acredita y su vencimiento si tiene. Es la lista que después
resume la pantalla de Estado.

> Un tilde dice "lo tengo". El documento en sí se genera desde `Documentos ›
> Plantillas institucionales`.

### Dar de alta un libro rubricado

**Dónde:** `O.N.G. › Libros`

1. **Tipo de libro** — Actas de Comisión Directiva, Actas de Asamblea, Asistencia a reuniones, Actas de Comisión Revisora de Cuentas, Registro de Asociados, Libro Diario, Inventario y Balances.
2. **Número de libro** y **Organismo** que lo rubricó.
3. **Fecha de rúbrica**.
4. **Folios totales** y **Folios usados** — para saber cuánto queda antes de tener que rubricar otro.
5. Guardá.

Cuando cargues un acta vas a elegir en qué libro se asentó y en qué folio.

### Generar una plantilla institucional

**Dónde:** `O.N.G. › Documentos › Plantillas institucionales`

1. Elegí cuál: designación de Director Médico, designación de Responsable Técnico, comodato de sede, comodato de predio, informe de genéticas o mandato.
2. Completá lo que pida: quién ocupa el cargo, la matrícula, quién cede el inmueble o su dirección.
3. **Generar**. Sale el documento redactado, listo para imprimir y firmar.

Se completan solas con lo que ya está cargado. Las designaciones remiten al acta de
Comisión Directiva más reciente; el informe de genéticas declara las variedades del
banco.

> Lo que falte sale entre corchetes. Cargalo y volvé a generar el documento en vez de
> completarlo a mano, así queda igual la próxima vez.

### Generar el informe del Director Médico

**Dónde:** `O.N.G. › Seguimiento`

1. Elegí el **semestre** en el panel del Director Médico. Sólo aparecen los períodos con movimiento.
2. Revisá lo que muestra por paciente: diagnóstico, lotes entregados, curva de alivio, efectos adversos y entregas sin reporte.
3. **Informe semestral** genera el documento con todo eso ordenado.
4. El profesional agrega su dictamen y lo firma.

> Con menos de tres reportes de un paciente el informe no declara tendencia: dice
> cuántos faltan. Dos puntos no son una tendencia.

### Cargar un paciente

**Dónde:** `O.N.G. › Pacientes › botón Paciente`

1. **Nombre completo** (obligatorio).
2. **DNI**, **Nacimiento**, **Teléfono**, **Email**.
3. **Localidad**, **Provincia**, **Domicilio**.
4. REPROCANN: **N° de registro**, **Código de vinculación**, **Estado** (Vigente,
   En trámite, Vencido, Rechazado, Sin registro), **Emisión** y **Vencimiento**.
   Si el estado no es *Vigente*, la ficha muestra ahí mismo el link al trámite oficial
   en Mi Argentina —el texto cambia si es la primera vez o si hay que renovar—. El
   trámite lo hace la persona con su médico: el sistema no puede iniciarlo ni inventar
   el número.

   > **El código de vinculación lo trae la persona, no lo da la asociación.** Cada
   > uno saca el suyo en Mi Argentina, es gratis, y **sin ese código no se lo puede
   > designar como vinculado** — y sin esa designación su entrega no queda amparada
   > por la 27.350. Por eso vive en la ficha de cada paciente y no en la
   > configuración de la entidad: es un dato de la persona.
   >
   > Hasta el 02/09/2026 el sistema lo tenía **al revés** y se contradecía solo: el
   > primer paso de `/sumate` ya decía «el primer paso es obtener el código, lo hacés
   > vos», y dos días después la pantalla del token le decía a esa misma persona que
   > se lo pidiera a la asociación. Ya está corregido, y **Coherencia cuenta cuántas
   > fichas del padrón todavía no lo trajeron.**
5. **Modalidad** — Cultivo propio, Cultivo solidario o Tercero/ONG.
6. **Plantas habilitadas**, **m² habilitados** y **Tope mensual (g)**.
7. **Patología / Indicación**, **Médico tratante** y **Matrícula**.
8. **Credencial (PDF)** y **Foto**.
9. **Notas**. Guardá.

> **El tope mensual no lo saltees.** Es contra ese número que se controla el cupo de
> 30 días. Sin él cargado, las reservas del portal salen sin límite y el sistema sólo
> puede avisarte que no puede controlarlo.

Si cargás la credencial en PDF, el sistema puede leerla y completar los campos del
REPROCANN solo. Revisá igual lo que completó antes de guardar.

### Dar de alta un asociado

**Dónde:** `O.N.G. › Asociados`

1. **Nombre** y **DNI**.
2. **Categoría** — de las que tengas definidas.
3. **Paciente vinculado (opcional)** — vinculalo si esta persona además recibe material. Sin esto, el portal no encuentra su ficha de paciente.
4. **Acta que aprobó el alta** — el alta de un socio se resuelve en Comisión Directiva; acá se referencia dónde.
5. **Fecha de alta**.
6. **Vinculación REPROCANN**.
7. Guardá.

> Paciente y asociado son dos fichas distintas. Para reservar hace falta ser las dos
> cosas y tenerlas vinculadas.

### Emitir las cuotas del período

**Dónde:** `O.N.G. › Asociados`

1. Definí el valor de la cuota: **Nombre (como figura en el estatuto)**, **Tipo**, **Valor**, **Categoría (vacío = todas)**, **Acta que la aprobó** y **Vigente desde**.
2. Emití el período. Se genera una cuota por asociado alcanzado.
3. A medida que cobrás, marcá cada una con **Fecha de pago** y **Medio de pago**.

### Bajar la planilla de control

**Dónde:** `O.N.G. › botón Planilla`, arriba a la derecha.

Baja tres archivos CSV —**Lotes**, **Dispensas** y **Caja**— que se abren en Excel.
Son tres y no uno porque cada CSV es una tabla sola: mezclarlas dejaría columnas
vacías en dos tercios de las filas.

> **La planilla es una salida, no una entrada.** Se baja para controlar, para una
> inspección o para revisar números con alguien que no tiene usuario. Lo que se
> corrige, se corrige **en la app**: un archivo modificado no se vuelve a subir.
> Es lo que evita que el mismo lote termine con dos códigos distintos.

### Crear un lote para dispensar

**Dónde:** `O.N.G. › Autodispensación › Catálogo › botón Lote`

1. **Código** — **ya viene puesto** ("LOTE-001", "LOTE-002"…). Lo asigna el sistema
   siguiendo la serie, y es el que va a figurar en el comprobante. Se puede
   corregir mientras el lote sea nuevo; **una vez que el lote tuvo una reserva o
   una entrega, el código queda fijo**, porque es por el código que las entregas
   encuentran su material y cambiarlo las dejaría apuntando a la nada. Dos lotes
   no pueden compartir código.
2. **Producto** — flor, aceite, extracto, tópico u otro.
3. **Gramos totales** y **Aporte por gramo ($)**.
4. **Genética** y **Fecha de elaboración**. Si la genética no está en la lista,
   elegí **"➕ Crear una genética nueva"**: se te pide sólo el nombre, queda
   seleccionada y seguís cargando el lote sin perder nada. La ficha completa
   —banco, linaje, THC, días de flora— se termina después en `Agronómico › Genéticas`.
5. Informe cromatográfico: **THC %**, **CBD %**, **Laboratorio** y **Fecha del análisis**.
6. Dejá tildado **Activo** para que aparezca al reservar.
7. Guardá.

> El aporte por gramo tiene que estar por debajo del costo de producción que ves en
> Econometría. Por encima deja de ser reembolso de costos.

### Hacer una reserva

**Dónde:** `O.N.G. › Autodispensación › botón Reservar`

1. **Quién retira** — elegí el paciente. Abajo aparece si está habilitado, con el cupo usado, el reservado y el libre.
2. Si hay bloqueos, resolvelos ahí mismo: **Firmar mandato** si falta la declaración jurada, o la **Encuesta de Seguimiento** si la entrega anterior no tiene reporte.
3. **De qué lote** — la lista muestra los gramos disponibles de cada uno.
4. **Gramos** — el reembolso se calcula solo.
5. **Cómo paga** — transferencia o billetera (adjuntás comprobante) o efectivo en la sede.
6. **Reservar 72 h**. Sale el código y su QR.

### Entregar en la sede

**Dónde:** `O.N.G. › Autodispensación › Reservas`

1. Tocá **Escanear** y leé el QR del paciente. Si no anda la cámara, escribí el código en el buscador.
2. Se abre la entrega con los datos y el chequeo. Si pagó por transferencia y administración todavía no lo verificó, no deja avanzar: el botón **Pago verificado** está en la tarjeta de esa reserva.
3. Si paga en efectivo, tildá que lo cobraste.
4. **Quién entrega** — el nombre de quien atiende.
5. **Confirmar entrega**. Se registra la dispensa, se asienta el reembolso en caja y sale el recibo oficial para imprimir.

### Cargar el reporte de seguimiento

**Dónde:** `O.N.G. › Seguimiento`

1. Buscá la entrega sin reporte.
2. **Alivio de los síntomas** — del 1 (nulo) al 5 (excelente).
3. **Efectos adversos** — "Ninguno" es excluyente: no podés marcar ninguno y a la vez cefalea.
4. **Dosis que usó realmente** — "3 gotas cada 8 hs", "0,3 g vaporizado a la noche".
5. **Observaciones sobre su calidad de vida**.
6. Guardá.

> Una vez guardado no se edita ni se borra, y la base lo rechaza aunque se intente.
> Revisalo antes: es la evidencia que va al informe del Director Médico.

### Asentar un movimiento de caja

**Dónde:** `O.N.G. › Seguimiento › Libro de Caja`

1. **Fecha** y **Tipo** — ingreso o egreso.
2. **Concepto** — ingresos: reembolso de costos operativos, cuota social, donación. Egresos: compra de insumos, servicios, honorarios, impuestos y tasas.
3. **Monto** y **Medio**.
4. **Detalle** y **Notas**. Guardá.

Las entregas se asientan solas al confirmarlas. Acá cargás todo lo demás.

### Cargar un documento

**Dónde:** `O.N.G. › Documentos`

1. **Tipo** — emitido o recibido.
2. **Clase** — qué documento es.
3. **Fecha**, **Número**, **Descripción**.
4. **Monto** y **Rubro**; **Proveedor** si es un gasto.
5. Vinculalo con lo que corresponda: **Asociado**, **Paciente** o **Dispensa que respalda**.
6. **Archivo** — subí el PDF o la foto.
7. Guardá.

### Redactar un acta

**Dónde:** `O.N.G. › Actas`

1. **Tipo** — Comisión Directiva, Asamblea Ordinaria, Asamblea Extraordinaria o Comisión Revisora de Cuentas.
2. **Número** y **Fecha**; **Hora inicio** y **Hora fin**.
3. **Lugar**.
4. Marcá los **asistentes** de la lista. El contador te dice si llegás al **quórum requerido**.
5. **Orden del día** — cada punto tratado.
6. **Firmantes**.
7. **Libro donde se asentó** y **Estado** — borrador, firmada, en libro o inscripta.
8. Generá el acta: sale redactada para transcribir al libro. Lo que falte queda entre corchetes.

### Presentar la DDJJ semestral

**Dónde:** `O.N.G. › Declaraciones`

1. **Período** y **Fecha de presentación**.
2. **Plantas en total** y **En floración**.
3. **Pacientes vinculados**.
4. **Variedades usadas**.
5. **Notas**. Marcá como presentada cuando la entregues.

### Registrar un traslado

**Dónde:** `O.N.G. › Declaraciones › Traslados`

1. **Fecha**, **Hora de salida** y **Hora de llegada**.
2. **Paciente** — por quién se traslada el material.
3. **Qué se traslada** y **Cantidad**. El tope cambia según el tipo: 40 g de flores, 6 frascos, y las plantas no tienen tope fijo.
4. **Origen**, **Destino** y **Ruta**.
5. **Transportista** y **DNI del transportista**.
6. **Destinatario final**.
7. Guardá y generá la guía de tránsito para llevar impresa.
8. **Presentá la carta de porte por TAD** y recién ahí tildá *carta de porte presentada*.

> **El tilde no dice que el traslado ocurrió: dice que el trámite se hizo.** La
> carta de porte se presenta por TAD, afuera de la app, y sin ella el traslado no
> está amparado. Por eso los traslados que se derivaron de órdenes de servicio
> aparecen todos sin tildar: el movimiento consta, la presentación no.
>
> Los pasos 4, 5 y 6 son **obligatorios para que la carta se pueda emitir**. Un
> traslado sin transportista o sin destinatario no se puede presentar, aunque el
> material se haya movido de verdad.

### Registrar una devolución

**Dónde:** `O.N.G. › Dispensas`, en la fila de la entrega.

Cuando se le devuelve plata a un paciente, el importe suele terminar cargado
**restando en la misma fila de la entrega**, porque el formulario tiene una sola
columna de importe. Eso deja un aporte en negativo, y rompe dos cosas: el total
de reembolsos que declarás queda corto por ese monto, y la plata devuelta no
figura en ningún libro, porque a caja sólo van los aportes positivos.

1. Buscá la entrega. Las que tienen el aporte en negativo muestran un **botón con
   una flecha curva**, en amarillo, al lado de *Editar*.
2. Hacé click y confirmá.
3. Listo: se asienta un **egreso de caja** por el valor absoluto, atado a esa
   entrega, y la entrega queda con aporte cero.

> **Si en realidad fue un signo mal tipeado, no uses esto.** Corregí el importe
> con *Editar*. Las dos lecturas dan números distintos y el sistema no puede
> saber cuál pasó: si entró plata, va como aporte positivo; si salió, va como
> devolución.

La entrega y la devolución son dos hechos distintos y por eso van separados. Así
el dinero se puede seguir hasta su origen: el egreso queda ligado a la dispensa
que lo motivó.

### Fusionar fichas duplicadas

**Dónde:** `O.N.G. › Pacientes`.

La misma persona cargada dos veces **parte su historial de consumo**, que es
justo lo que mira la ventana de 30 días: con dos fichas, cada una cuenta la mitad
y el tope no frena nada. Además infla el padrón y el total de vinculados que se
declara.

1. En `Coherencia`, el control *Padrón sin duplicados* dice cuántos DNI y
   teléfonos se repiten.
2. Abrí las dos fichas y quedate con **la que tiene las entregas**.
3. Pasale a mano los datos que sólo tenga la otra: DNI, REPROCANN, teléfono,
   domicilio.
4. En la ficha vacía, **desmarcá *Activo***. No la borres.

> **Desactivar alcanza, y es reversible.** El padrón, el cupo y los cruces
> ignoran las fichas inactivas, pero la ficha conserva todos sus datos. Si la
> fusión estuvo mal, se vuelve a marcar como activa y no se perdió nada.

Ojo con el orden: **completar los DNI destapa duplicados nuevos**. Dos fichas con
el mismo DNI no se pueden comparar mientras una lo tiene vacío, y hay duplicados
que por nombre no coinciden porque una ficha tiene el segundo nombre y la otra
no. Después de completar DNI, volvé a mirar el control.

### Editar o borrar cualquier cosa

Todo lo que se carga se puede corregir y borrar desde donde se ve: el lápiz edita,
el tacho borra. Lo que el sistema no deja borrar tiene una razón y te la dice:

- Un **reporte de seguimiento** no se edita ni se borra nunca.
- Un **lote con reservas** no se borra: se desactiva, así el historial no pierde de dónde salió el material.
- Una **reserva entregada** no se borra: es el respaldo de una dispensa registrada.

Si algo no se puede corregir desde su pantalla, `Tablas` lo edita celda por celda.

### Exportar e importar

**Dónde:** `Tablas`, o los botones **Export** / **Import** de cada pantalla

Export baja lo que estés viendo. Import lo vuelve a subir, y sirve para cargar en
tanda desde una planilla en vez de uno por uno.
