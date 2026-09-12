-- `sustancias_nutrientes.costo_kg` es lo que sale el kilo de cada sal.
--
-- Ya aplicado a mano sobre qivhrbsnvuaylqofpjti el 30/08/2026. NO en Chaco.
--
-- Era la ultima tabla con un importe que leia cualquiera con cuenta. Queda como
-- sus tres hermanas —`inventario_nutrientes`, `proveedores_nutrientes` y
-- `fichas_comerciales`—, que ya se leian con `puede_ver_plata()`. Era la unica
-- de la familia que habia quedado afuera.
--
-- Cerrarla hoy no le saca nada a nadie: cero filas, y la Calculadora de
-- Fertilizantes no forma parte de esta instalacion (ver el comentario en
-- app/src/App.tsx: `lib/nutrientes.ts` ya no entra al bundle). Se cierra ahora
-- por eso mismo: cuando alguien cargue precios, la puerta ya va a estar tapada.
--
-- LO QUE NO SE CIERRA, Y ES UNA CORRECCION MIA
--
-- `cosechas.valoracion` NO es plata: es una NOTA DE CALIDAD. La pantalla la
-- muestra como «★ 4.5» con un decimal (RendimientoDeCultivo.tsx). La habia
-- marcado como importe un detector que mira NOMBRES de columna, y `valor…`
-- matcheaba. Cerrar `cosechas` le sacaria las cosechas al cultivador —que es
-- justo lo que tiene que ver— a cambio de nada.
--
-- El nombre de una columna sugiere; no decide. Hay que mirar como se usa.

alter policy sustancias_nutrientes_ver on public.sustancias_nutrientes
  using (public.puede_ver_plata());
