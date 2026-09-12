// El circuito de alta de un socio, antes de que exista en el sistema.
//
// El manual arranca en "Cargá al paciente", pero antes de eso hay tres pasos
// que hoy viven en la bio de Instagram: el formulario, el tramite oficial del
// REPROCANN y un atajo pago de terceros. Estan aca, en un solo lugar, para que
// la pantalla de Pacientes y la pagina publica muestren lo mismo y no haya que
// acordarse de cambiar los links en dos lados.
//
// Sobre los links, tres cosas que no son obvias:
//
// 1. El paso 1 apunta a `/sumate`, la pagina publica de ESTA instalacion, y ya
//    no al Google Form. El formulario de Google no escribia en la base: alguien
//    importaba a mano, y de ahi salieron las doce fichas que hubo que limpiar
//    el 25/08/2026. Ahora escribe en `ong_solicitudes` por `solicitud_crear()`,
//    con el legajo entero —consentimientos, DNI y credencial adjuntos— y la
//    persona se lleva un link para seguir su tramite.
//
//    El Form sigue existiendo y sus respuestas viejas siguen ahi; lo que deja
//    de pasar es que la bio de Instagram mande gente nueva a cargar datos
//    donde el sistema no los ve.
//
// 2. El de argentina.gob.ar venia con `fbclid=...`, el rastreador de clicks de
//    Facebook. No hace falta para nada —el destino es el mismo sin el— y deja
//    dicho que la persona llego desde Facebook. Va limpio.
//
// 3. repronline.cannis.org es un servicio DE TERCEROS y PAGO, con el codigo de
//    referido de la asociación. Se marca como opcional y aparte del tramite oficial:
//    mezclarlos haria pensar que hay que pagar para sacar el REPROCANN, y no.

export interface PasoAlta {
  n: number
  titulo: string
  /** Que hace la persona en este paso, en una linea. */
  detalle: string
  url: string
  /** Texto corto del boton/link. */
  accion: string
  /** true = no es obligatorio ni oficial. */
  opcional?: boolean
}

export const PASOS_ALTA: PasoAlta[] = [
  {
    n: 1,
    titulo: 'Completar el formulario',
    detalle:
      'Los datos de la persona: nombre, DNI, contacto, patología y médico tratante, ' +
      'los consentimientos y los documentos. Entra derecho al sistema, sin que ' +
      'nadie lo transcriba.',
    url: '/sumate',
    accion: 'Abrir el formulario',
  },
  {
    n: 2,
    titulo: 'Sacar el código de vinculación del REPROCANN',
    detalle:
      'El trámite oficial, en el sitio del Estado. Sin el REPROCANN vigente y vinculado ' +
      'a la asociación no se puede dispensar: es la regla RN-01.',
    url: 'https://id.argentina.gob.ar/ingresar/?next=%2Fauthorize%2F%3Fclient_id%3D635393%26redirect_uri%3Dhttps%3A%2F%2Freprocann.msal.gob.ar%2Fauth%26scope%3Dopenid%2520email%2520profile%2520optional%26response_type%3Dcode',
    accion: 'Ir a Mi Argentina',
  },
  {
    n: 3,
    titulo: 'Tramitarlo online (opcional)',
    detalle:
      'Un servicio particular, pago, que gestiona el REPROCANN más rápido. No reemplaza ' +
      'al paso 2 ni es requisito: es un atajo para quien lo quiera.',
    url: 'https://ejemplo.org/referidos/organizacion',
    accion: 'Ver el servicio',
    opcional: true,
  },
]

/** Los campos de `pacientes` que salen del formulario, en orden de carga. */
export const CAMPOS_DESDE_FORMULARIO = [
  'nombre_completo', 'dni', 'fecha_nacimiento', 'telefono', 'email',
  'domicilio', 'localidad', 'provincia', 'patologia', 'medico_tratante',
  'matricula_medico', 'reprocann_nro', 'reprocann_estado',
  'reprocann_emision', 'reprocann_vencimiento', 'tope_mensual_g', 'notas',
] as const


/**
 * El WhatsApp de la asociación, y el mensaje con el que arranca la conversación.
 *
 * ES EL CIERRE DEL FORMULARIO desde el 31/08/2026. Antes `/sumate` terminaba
 * explicando el REPROCANN y no decía qué hacer después: la persona completaba,
 * enviaba, y quedaba esperando que alguien la contactara.
 *
 * la asociación lo corrigió y el flujo real es otro: escriben por WhatsApp o Instagram,
 * se les pasa el enlace, completan, y vuelven a escribir para coordinar la
 * visita. La primera dispensa —y toda la explicación del trámite— pasa en la
 * sede, presencial.
 *
 * EL MENSAJE VA PREDISEÑADO por dos razones. La persona no tiene que redactar
 * nada, que es donde se abandona; y del otro lado se sabe de entrada que ya
 * completó el legajo, sin tener que preguntarlo.
 *
 * El número va en formato internacional SIN el `+`, que es lo que `wa.me`
 * espera: 54 (país) + 9 (celular) + 379 (área) + el abonado.
 */
export const WHATSAPP = {
  numero: '5493795077933',
  /** Cómo se muestra, para quien prefiera guardarlo o llamar. */
  visible: '3795077933',
  mensaje: 'Hola! Ya completé el formulario de admisión y quiero agendar mi visita a la sede.',
  atencion: 'Lunes a sábado, de 15 a 20 hs',
}

/** El link listo, con el mensaje ya codificado. */
export const linkWhatsapp = () =>
  `https://wa.me/${WHATSAPP.numero}?text=${encodeURIComponent(WHATSAPP.mensaje)}`
