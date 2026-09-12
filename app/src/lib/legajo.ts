// El Legajo de Admisión: lo que se le pregunta a alguien que quiere sumarse.
//
// DE DÓNDE SALE
//
// La asociación tenía un Google Form («Legajo de Admisión») que preguntaba cosas
// que /sumate no preguntaba: cuatro consentimientos, el diagnóstico como lista
// cerrada, y una rama distinta según tuviera o no el carnet. Pero no escribía en
// la base: alguien importaba a mano, y de ahí salieron los dos padrones de Chaco
// con los mismos códigos apuntando a personas distintas.
//
// Esto trae ese contenido para adentro. Un solo circuito de alta, no dos.
//
// LOS TEXTOS SON LOS DEL FORMULARIO, CASI LITERALES. No se reescribieron por
// gusto: son los que la asociación ya venía usando y los que la gente ya aceptó.
// Cambiarlos por prolijidad rompería la comparación con lo firmado antes.
//
// ⚠ AL TOCAR CUALQUIER TEXTO DE CONSENTIMIENTO, SUBIR `VERSION_CONSENTIMIENTOS`.
// Es la misma regla que el mandato: si el texto cambia y la versión no, dos
// textos distintos quedan guardados con el mismo nombre y ya no se sabe qué
// aceptó cada persona.

/**
 * Qué versión de los consentimientos se está firmando.
 *
 * Se guarda con cada legajo. Ver el aviso de arriba.
 */
export const VERSION_CONSENTIMIENTOS = '2026-08'

/**
 * Los diagnósticos, como lista CERRADA.
 *
 * Cerrada a propósito: en texto libre no se puede agrupar ni reportar, y el
 * informe semestral que la ONG tiene que presentar se arma de acá. «Otro» existe
 * para no obligar a nadie a mentir, y quien lo elige explica en el campo libre.
 *
 * Son los ocho del formulario, con el mismo texto.
 */
export const DIAGNOSTICOS = [
  'Dolor Crónico y Muscular (Lumbalgia, artrosis, dolores post-quirúrgicos)',
  'Trastornos del Sueño (Insomnio, dificultad para conciliar o despertares nocturnos)',
  'Ansiedad, Estrés y Salud Mental (ansiedad generalizada, ataques de pánico, estrés post-traumático)',
  'Patologías Neurológicas (Epilepsia, Parkinson, Esclerosis Múltiple, Migrañas crónicas)',
  'Afecciones Autoinmunes e Inflamatorias (Artritis reumatoidea, Fibromialgia, Enfermedad de Crohn)',
  'Cuidado Paliativo y Oncología (efectos secundarios de quimioterapia, falta de apetito, náuseas)',
  'Trastornos del Espectro Autista (TEA)',
  'Otro diagnóstico',
] as const

/** Se puede pedir más de uno: hay gente que usa flor y aceite. */
export const FORMATOS = ['Flores', 'Aceites', 'Cremas'] as const

/**
 * La unidad va SEPARADA del número.
 *
 * En el Google Form la cantidad era un solo campo de texto y produjo «10»,
 * «40gramos», «15 gramos» y «200 gramos flores frescas». Cuatro formas de
 * escribir lo mismo, y una —«10»— que no dice de qué. Sin unidad no se puede
 * sumar ni comparar contra un tope.
 */
export const UNIDADES = [
  { valor: 'g' as const, label: 'gramos' },
  { valor: 'ml' as const, label: 'mililitros' },
  { valor: 'u' as const, label: 'unidades (potes, goteros)' },
]
export type Unidad = typeof UNIDADES[number]['valor']

/**
 * La respuesta a «¿designaste a la asociación en REPROCANN?».
 *
 * ES LA PREGUNTA QUE EL FORMULARIO NO HACÍA, y es la que importa. Tener el
 * carnet vigente y haber designado a ESTA asociación como cultivador son dos
 * cosas distintas: el 26/08/2026 las cuatro credenciales cargadas en Chaco
 * dicen «Paciente con autocultivo» y ninguna nombra a la asociación. Las cuatro
 * habrían contestado «sí» a «¿tenés REPROCANN?» y ninguna habilita a nadie.
 *
 * `no_se` existe porque es la respuesta honesta de mucha gente, y es mejor dato
 * que un «no» inventado: dispara una explicación en vez de un rechazo.
 */
export const VINCULACION = [
  { valor: 'si' as const, label: 'Sí, ya la designé como mi cultivador' },
  { valor: 'no' as const, label: 'No, todavía no' },
  { valor: 'no_se' as const, label: 'No sé / no entiendo de qué se trata' },
]
export type Vinculacion = typeof VINCULACION[number]['valor']

/**
 * ⚠ HOY NO SE MUESTRA EN NINGUNA PANTALLA, Y ES A PROPÓSITO.
 *
 * la asociación la sacó de `/sumate` el 31/08/2026: esa explicación la dan
 * PRESENCIALMENTE, en la primera visita a la sede. El formulario público quedó
 * reducido a lo que es —un pre-registro para coordinar esa visita— y todo lo
 * que alargue esa pantalla juega en contra de que la persona llegue al final.
 *
 * SE CONSERVA PORQUE EL CONTENIDO SIGUE SIENDO CIERTO Y CUESTA ESCRIBIRLO. Es
 * la explicación de por qué tener el carnet no alcanza, que es la confusión más
 * cara del circuito. Si algún día hace falta —en el panel de la O.N.G., en el
 * manual, o en una pantalla para el operador que atiende— está acá y no hay que
 * volver a redactarla.
 *
 * No borrarla creyendo que es código muerto, y no volver a ponerla en `/sumate`
 * sin preguntar: salió de ahí por una decisión, no por un descuido.
 *
 * ---
 *
 * Lo que hay que saber sobre la vinculación, se pregunte o no.
 *
 * HASTA EL 31/08/2026 ESTO ERA LA RESPUESTA A UNA PREGUNTA. El formulario
 * preguntaba «¿designaste a la asociación como tu cultivador?» y, según la
 * respuesta, mostraba una de dos explicaciones. La pregunta se sacó a pedido de
 * la asociación —frenaba el alta por un paso que a esa altura todavía no toca dar— y
 * la explicación se quedó, que es lo que había que conservar.
 *
 * Al dejar de depender de una respuesta pasa a ser MEJOR, no peor: antes quien
 * contestaba «sí» no leía nada, y buena parte de esos «sí» eran gente que tenía
 * el carnet y estaba vinculada a otro lado sin saberlo. Ahora lo lee todo el
 * que tiene REPROCANN, que es exactamente a quien le sirve.
 *
 * Por eso también se fusionaron las dos versiones. Eran «no sé qué es» y «sé
 * qué es y no lo hice»; sin pregunta no hay forma de distinguirlas, y tampoco
 * hace falta: el concepto es corto y a quien ya lo sabe no le molesta, mientras
 * que a quien no lo sabe le falta todo si se lo salteás.
 *
 * NO FRENA NADA. Es informativa: el formulario se envía igual. Quien todavía no
 * se vinculó también es alguien a quien la asociación quiere conocer, y el dato
 * real no sale de lo que la persona recuerda sino del REPROCANN, contra el que
 * revisa el legajo.
 */
export interface AyudaVinculacion {
  titulo: string
  /** Cada parrafo por separado: la pantalla decide como espaciarlos. */
  parrafos: string[]
  /** Las tres modalidades del tramite. */
  modalidades: { nombre: string; que: string; habilita: boolean }[]
  cierre: string
  /** El aviso final, que es el unico que puede costar plata a alguien. */
  remate: string
}

export const AYUDA_VINCULACION: AyudaVinculacion = {
  titulo: 'Tener el carnet y estar vinculado no es lo mismo',
  parrafos: [
    'El REPROCANN anota dos cosas distintas: que vos podés usar cannabis medicinal, ' +
    'y QUIÉN te lo cultiva. La primera es tu carnet. La segunda es la que decide si ' +
    'esta asociación te puede entregar.',
    'Cuando hiciste el trámite elegiste una de estas tres, aunque quizá no lo recuerdes:',
  ],
  modalidades: [
    { nombre: 'Autocultivo', que: 'cultivás vos, en tu casa', habilita: false },
    { nombre: 'Cultivo solidario', que: 'te cultiva otra persona', habilita: false },
    { nombre: 'A través de una ONG', que: 'te cultiva una asociación como esta', habilita: true },
  ],
  cierre:
    'Si elegiste una de las dos primeras tu carnet está perfecto y no perdiste ningún ' +
    'derecho — de hecho es lo que conviene tener mientras tanto—. Lo que pasa es que tu ' +
    'cultivador registrado es otro, así que la entrega todavía no queda amparada. Se ' +
    'cambia: se edita el trámite en Mi Argentina y se designa a la asociación.',
  remate:
    'No lo tenés que resolver ahora ni solo. Se hace al firmar el mandato de gestión: ' +
    'de esa modificación sale tu código de vinculación, y con ése te vinculamos. ' +
    'Mandá el legajo igual.',
}

/** Un consentimiento: el texto que se acepta y el campo donde se guarda. */
export interface Consentimiento {
  campo: 'consent_veracidad' | 'consent_uso_personal'
       | 'consent_responsabilidad' | 'consent_jurisdiccion'
  titulo: string
  texto: string
}

/**
 * Los cuatro del formulario, con su texto casi literal.
 *
 * Van los cuatro juntos y los cuatro obligatorios, como en el original. El
 * tercero es el que más pesa: es el que dice que el aporte sostiene la
 * estructura de cultivo y no es una compraventa — lo mismo que sostiene el
 * Mandato de Gestión Operativa, y lo que hace que la entrega se pueda defender.
 */
export const CONSENTIMIENTOS: Consentimiento[] = [
  {
    campo: 'consent_veracidad',
    titulo: 'Declaración jurada de veracidad',
    texto:
      'Declaro bajo juramento que todos los datos consignados en este formulario son veraces '
      + 'y que la documentación adjunta (DNI y REPROCANN, de corresponder) es auténtica y '
      + 'vigente. Me comprometo a informar de inmediato cualquier cambio en mi situación '
      + 'regulatoria o médica.',
  },
  {
    campo: 'consent_uso_personal',
    titulo: 'Uso terapéutico y personal',
    texto:
      'Entiendo que el cannabis y sus derivados provistos por la organización tienen un fin '
      + 'estrictamente terapéutico y personal. Queda terminantemente prohibida la venta, cesión, '
      + 'donación o distribución a terceros. Soy consciente de que el incumplimiento de este '
      + 'punto constituye un delito federal (Ley 23.737).',
  },
  {
    campo: 'consent_responsabilidad',
    titulo: 'Responsabilidad y naturaleza del aporte',
    texto:
      'Libero a la organización y a sus cultivadores de toda responsabilidad por el uso que yo '
      + 'haga de la medicina fuera de los protocolos sugeridos, o por cualquier inconveniente '
      + 'legal derivado de la falta de vigencia de mi registro personal en REPROCANN. Acepto que '
      + 'los aportes realizados son para el sostenimiento de la estructura de cultivo y no '
      + 'constituyen una transacción comercial.',
  },
  {
    campo: 'consent_jurisdiccion',
    titulo: 'Jurisdicción',
    texto:
      'Para cualquier controversia legal, acepto someterme a la jurisdicción de los tribunales '
      + 'ordinarios de la ciudad de Resistencia, Chaco. Al enviar este formulario, ratifico mi '
      + 'voluntad de formar parte de este programa de salud.',
  },
]

/**
 * El compromiso que firma quien TODAVÍA NO tiene el carnet.
 *
 * Es la otra rama del formulario. No reemplaza al REPROCANN ni lo habilita: deja
 * escrito que la persona sabe que le falta y que va a tramitarlo. La entrega,
 * mientras tanto, sigue sin estar amparada — y eso lo avisa RN-01 en cada
 * dispensa, no este texto.
 */
export const COMPROMISO_REGULARIZAR =
  'Entiendo que mi acceso a la fitomedicina se encuadra en mi Derecho Fundamental a la Salud '
  + '(Art. 42 CN). Me comprometo formalmente a iniciar mi trámite de registro oficial en un '
  + 'plazo de 30 días. Acepto que esta es una medida de transición para evitar los riesgos del '
  + 'mercado ilegal.'

/** Lo que el formulario manda a `solicitud_crear`, dentro del jsonb `p_legajo`. */
export interface Legajo {
  fecha_nacimiento?: string | null
  domicilio?: string | null
  localidad?: string | null
  provincia?: string | null
  patologia?: string | null
  formatos?: string[]
  cantidad_mensual?: string | null
  cantidad_unidad?: Unidad | null
  medico_tratante?: string | null
  matricula_medico?: string | null
  reprocann_tiene?: boolean | null
  reprocann_nro?: string | null
  reprocann_vinculado?: Vinculacion | null
  reprocann_vencimiento?: string | null
  compromiso_regularizar?: boolean
  consentimientos_version?: string
  consent_veracidad?: boolean
  consent_uso_personal?: boolean
  consent_responsabilidad?: boolean
  consent_jurisdiccion?: boolean
}
