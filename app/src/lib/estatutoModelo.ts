// El estatuto modelo pre-visado de la Provincia del Chaco.
//
// Es el Anexo II de la Disposición General N° 010-24: el texto que la Inspección
// General de Personas Jurídicas ya tiene aprobado de antemano para asociaciones
// civiles cannábicas. Presentarlo tal cual acorta el trámite; apartarse de él
// obliga a que un abogado del organismo lo revise artículo por artículo.
//
// Llega como un PDF con dos huecos de puntos suspensivos —la denominación y el
// domicilio— y todo lo demás cerrado. Acá el texto es el mismo, palabra por
// palabra, y los dos huecos se completan con lo que la entidad tenga cargado.
//
// Se transcribe entero y no se resume: es un instrumento legal, y un estatuto
// resumido no sirve para presentar. Los 39 artículos definen además cosas que la
// app usa en otras pantallas —el cierre de ejercicio el 30 de junio, el mandato
// de dos años, los cinco cargos de la Comisión Directiva— así que este archivo es
// la fuente de esos números.

import type { Entidad } from './ong'
import type { DocumentoGenerado } from './documentosLegales'

const FALTA = (q: string) => `[${q}]`

/**
 * Lo que el modelo fija y no depende de quién lo use.
 *
 * Se exporta para que la carga de la entidad pueda ofrecerlo como valor por
 * defecto en vez de hacer que alguien lo busque adentro del PDF.
 */
export const MODELO_CHACO = {
  jurisdiccion: 'Chaco',
  organismoControl: 'Inspección General de Personas Jurídicas y Registro Público de Comercio',
  /** El ejercicio económico se clausura el 30 de junio (artículo 30). */
  cierreEjercicioDia: 30,
  cierreEjercicioMes: 6,
  /** Dos años, reelegibles por dos períodos (artículo 16). */
  mandatoAnios: 2,
  /** Los cargos de la Comisión Directiva, en orden (artículo 16). */
  cargos: ['Presidente', 'Secretario', 'Tesorero', 'Vocal titular', 'Vocal suplente'],
  /** La Revisora de Cuentas: un titular y un suplente (artículo 16). */
  cargosRevisora: ['Revisor de Cuentas titular', 'Revisor de Cuentas suplente'],
  /** Las cuatro categorías de asociado del Título Segundo. */
  categoriasSocio: ['Honorarios', 'Vitalicios', 'Activos', 'Cadetes'],
} as const

const CUERPO = `ESTATUTO.

TITULO PRIMERO. DENOMINACIÓN. DOMICILIO Y FINALIDADES.

ARTÍCULO 1: {{DOMICILIO}} queda constituida la Asociación Civil sin fines de lucro, denominada {{DENOMINACION}}, que se propone los siguientes fines: 1) Promover el bienestar integral de la salud humana, mediante el acceso seguro, informado y acompañado al uso medicinal, terapéutico y paliativo de la planta de Cannabis Sativa L. y sus derivados, actuando en estricto cumplimiento del marco legal vigente (Ley Nacional 27.350, Decreto Reglamentario 883/20 y normativas complementarias, presentes o futuras). 2) SALUD Y CULTIVO ASOCIATIVO: Garantizar a sus asociados el acceso al cannabis con fines medicinales mediante la modalidad de Cultivo Asociativo y Solidario. La Asociación actuará como cultivadora designada de sus miembros amparados por el Registro del Programa de Cannabis (REPROCANN) o el organismo competente, asegurando la trazabilidad y calidad del producto. Se excluye expresamente cualquier fin de lucro o comercialización. 3) INVESTIGACIÓN Y EVIDENCIA: Fomentar proyectos de investigación científica y botánica sobre el cannabis y sus aplicaciones terapéuticas, pudiendo celebrar convenios con organismos públicos o privados de salud y ciencia. 4)EDUCACIÓN: Brindar asesoramiento y capacitación a socios y comunidad sobre uso responsable, reducción de daños y marco legal. 5) Diseñar, gestionar, producir y difundir proyectos culturales, artísticos, educativos y científicos que promuevan la identidad regional y la conciencia social, pudiendo para ello organizar eventos, festivales, exposiciones y espectáculos públicos, entendiendo a estas actividades como herramientas para el fomento del bienestar integral, la salud mental y la calidad de vida de la comunidad, guardando siempre relación con el objeto principal de la entidad. CAPACIDAD.

ARTÍCULO 2: La Asociación se encuentra capacitada para adquirir bienes muebles, inmuebles y semovientes; enajenarlos, hipotecarlos, prendarlos, como así también realizar cuanto acto jurídico sea necesario y conveniente para el cumplimiento de sus propósitos. Específicamente, por medio de sus representantes y previa decisión adoptada en asamblea extraordinaria convocada al efecto, podrá constituir entidades de segundo grado cuyos objetivos sean coincidentes con los enumerados precedentes. PATRIMONIO.

ARTÍCULO 3: Constituyen el patrimonio de la Asociación: a) Las cuotas que abonen sus asociados; b) Los bienes que posea en la actualidad y los que adquiera por cualquier título en lo sucesivo, así como las rentas que los mismos produzcan; c) Las donaciones, legados o subvenciones que reciba; d) El producido de beneficios, rifas, festivales y cualquier otra entrada que pueda tener concepto lícito y estén debidamente autorizadas por los Organismos Oficiales competentes.

TITULO SEGUNDO. DE LOS ASOCIADOS.

ARTÍCULO 4: Habrá cuatro categorías de asociados sin distinción de sexo: Honorarios, Vitalicios, Activos y Cadetes.

ARTÍCULO 5: Serán Socios Honorarios aquellos que, por determinados méritos personales o servicios prestados a la Asociación, o por donaciones que efectuarán, se hagan merecedores de tal distinción y serán designados por la Asamblea General a propuesta de la Comisión Directiva o de un grupo de treinta socios como mínimo. Carecen de voto y no pueden ser miembros de la Comisión Directiva o de la Comisión Revisora de Cuentas.

ARTÍCULO 6: Serán Socios Vitalicios aquellos que cuenten con una antigüedad mínima ininterrumpida de treinta años en el carácter de socio activo de la Institución quienes de hecho pasarán a formar parte de esta categoría quedando eximidos de la cuota mensual. Gozarán de iguales derechos y deberes que los socios activos.

ARTÍCULO 7: Serán Socios Activos aquellos que abonen una cuota mensual adelantada y la cuota de ingreso cuyos montos fijará la Asamblea, teniendo que: a) Solicitar su admisión por escrito a la Comisión Directiva y ser presentados por dos socios activos y/o vitalicios cuya permanencia en el primer carácter sea mayor de seis meses continuados, acompañando la documentación que se exija; b) Contar con no menos de dieciocho años de edad, ocupación honorable y buenos antecedentes morales. En caso de que la Comisión Directiva rechace su solicitud, el aspirante sólo podrá insistir una vez, transcurridos como mínimo seis meses, y en estos casos las resoluciones de aquella serán inapelables.

ARTÍCULO 8: Serán Socios Cadetes aquellos que abonen una cuota mensual adelantada y la cuota de ingreso cuyos montos fijará la Asamblea, debiendo, asimismo: a) solicitar su admisión por escrito a la Comisión Directiva, con venia de su representante legal y ser presentados por Socios Activos o Vitalicios, con una permanencia en el primer carácter de seis meses continuados acompañando la documentación que se le exija. b) Ser menor de dieciocho años de edad, tener ocupación honorable y buenos antecedentes morales. En caso de rechazo de una solicitud por la Comisión Directiva, se regirá por las mismas disposiciones que al respecto existen para los Socios Activos. Una vez cumplidos los dieciocho años de edad pasarán automáticamente a la categoría de activos, quedando eximidos de la cuota de ingreso.

ARTÍCULO 9: Los Socios Honorarios que deseen ingresar a cualquiera de las otras categorías, deberán solicitarlo por escrito a la Comisión Directiva, ajustándose a las condiciones establecidas por este Estatuto para cada una de ellas y en este caso gozarán de iguales derechos y obligaciones que los Socios de la categoría a que pasan a pertenecer.

ARTÍCULO 10: Los Asociados cesarán en su carácter de tales por las siguientes causas: renuncia, cesantía o expulsión. Podrán ser causas de cesantía o expulsión: a) Faltar al cumplimiento de las Disposiciones del Estatuto o Reglamento; b) Observar una conducta inmoral o entablar o sostener dentro del local social o formando parte de las delegaciones de la Entidad, discusiones que impliquen intolerancia religiosa, racial o política, o participar en la realización de juegos prohibidos o de los denominados “bancados”; c) Haber cometido actos graves de deshonestidad o engañado o tratado de engañar a la Institución para obtener un beneficio económico a costa de ella; d) Hacer voluntariamente daño a la Asociación, provocar desórdenes en su seno y observar una conducta que sea notoriamente perjudicial a los intereses sociales; e) Haber perdido las condiciones requeridas por este Estatuto para ser asociado; f) Asumir o invocar la representación de la Asociación en reuniones, actos, asambleas y eventos similares de otras instituciones oficiales o particulares, si no mediare autorización o mandato expreso de la Comisión Directiva.

ARTÍCULO 11: En el caso de incurrir en alguna falta no prevista en el artículo anterior, los asociados podrán ser suspendidos en el goce de sus derechos sociales por un término prudencial que no podrá exceder de seis meses. En una Asamblea convocada al efecto, constituida con la presencia del 51% de los asociados con derecho a voto y con el voto favorable de los dos tercios de los socios presentes, se decidirá sobre la suspensión de los mismos.

ARTÍCULO 12: De las resoluciones adoptadas en su contra por la Comisión Directiva, los asociados podrán apelar ante la primera asamblea que se celebre, presentando el respectivo recurso en forma escrita ante la Comisión Directiva dentro de los quince días de notificados de su sanción. El recurso presentado tendrá efecto suspensivo. Asimismo, todo disenso o controversia que surja de la aplicación del presente estatuto entre los asociados o entre éstos y los órganos directivos o de fiscalización deberá ser considerado y resuelto en forma previa por una asamblea convocada en un plazo relacionado con la urgencia y la importancia de los temas en discusión. OBLIGACIONES Y DERECHOS.

ARTÍCULO 13: Son obligaciones de los asociados: a) Conocer, respetar y cumplir las disposiciones de este Estatuto, Reglamentos y Resoluciones de Asambleas y de la Comisión Directiva; b) Abonar mensualmente y por adelantado las cuotas sociales; c) Aceptar los cargos para los cuales fueron designados; d) Comunicar dentro de los diez días todo cambio de domicilio a la Comisión Directiva. El asociado que no diera cumplimiento al inciso b) y se atrase en el pago de tres mensualidades, será apercibido por carta certificada. Transcurrido un mes de la intimación sin que normalice la situación de morosidad, será separado de la institución, debiéndose dejar constancia en actas.

ARTÍCULO 14: Todo socio declarado moroso por la Comisión Directiva a raíz de la falta de pago de tres cuotas consecutivas y por lo tanto excluido de la Asociación por ese motivo, podrá reingresar automáticamente a la institución cuando hubiere transcurrido menos de un año desde la fecha de su exclusión, abonando previamente la deuda pendiente a los valores vigentes en el momento de la reincorporación más cuota de ingreso que correspondiere en ese momento a su categoría, no perdiendo así su antigüedad. Vencido el año, se perderá todo derecho y sólo podrá ingresar como socio nuevo.

ARTÍCULO 15: Son derechos de los socios: a) Gozar de todos los beneficios sociales que acuerdan éste Estatuto y reglamentos, siempre que se hallen al día con tesorería y no se encuentren cumpliendo penas disciplinarias; b) Proponer por escrito a la Comisión Directiva todas aquellas medidas o proyectos que consideren convenientes para la buena marcha de la institución: c) Solicitar por escrito a la Comisión Directiva una licencia con eximición del pago de las cuotas, hasta un plazo máximo de seis meses y siempre que la causa invocada se justifique plenamente. Durante la licencia el socio no podrá concurrir al local social sin razón atendible, pues su presencia en el mismo significará la reanudación de sus obligaciones para con la Asociación; d) Presentar su renuncia en calidad de asociado a la Comisión Directiva, la que resolverá sobre su aceptación o rechazo si proviniera de un asociado que tenga deudas con la institución o sea pasible de sanción disciplinaria. e) Participar con voz y voto en las asambleas de la asociación, como así también, para integrar los órganos de dirección y fiscalización, requiriendo cumplir con una antigüedad mínima y habilitante para ejercer los derechos mencionados de (12) meses calendario contado en forma retroactiva desde la fecha prevista en la convocatoria para la realización de la asamblea.

TITULO TERCERO. DE LA COMISIÓN DIRECTIVA Y DE LA COMISIÓN REVISORA DE CUENTAS. SU ELECCIÓN. ATRIBUCIONES Y DEBERES.

ARTÍCULO 16: La institución será dirigida y administrada por una Comisión Directiva compuesta de: un (1) Presidente, un (1) Secretario, un (1) Tesorero, un (1) Vocal titular y un (1) Vocal Suplente. Habrá también una Comisión Revisora de Cuentas Compuesta por un (1) miembro titular y un (1) miembro suplente. El mandato de los miembros de la Comisión Directiva y de la Comisión Revisora de Cuentas durará dos años a partir de la Asamblea Ordinaria realizada en los plazos estatutarios, pudiendo ser reelectos por dos períodos y será revocable en cualquier momento por decisión de una Asamblea de asociados constituida como mínimo con el 51% de los socios con derecho a voto y la sanción de los dos tercios de los asistentes. En segunda convocatoria se hará con el 30% de los socios con derecho a voto y las decisiones se adoptarán con el voto favorable de los dos tercios de los votos presentes, sin que sea admisible imponer restricciones a este derecho de la masa societaria. Los socios designados para ocupar cargos no podrán percibir por este concepto sueldo o ventaja alguna.

ARTÍCULO 17: Los miembros de la Comisión Directiva y el Revisor de Cuentas serán elegidos directamente en Asamblea General Ordinaria, por lista completa, con designación de cargos. La elección será secreta y por simple mayoría de los socios presentes. Las listas de candidatos deberán ser presentadas al Revisor de Cuentas Titular hasta con cinco (5) días hábiles de anticipación al acto, quien se expedirá dentro de las veinticuatro horas hábiles de su presentación, a los efectos de su aceptación o rechazo. En caso de rechazo, el Revisor deberá correr traslado al apoderado de la lista observada por el término de cuarenta y ocho horas hábiles a fin de subsanar las irregularidades .

ARTÍCULO 18: Los miembros de la Comisión Directiva y el Revisor de Cuentas serán solidariamente responsables del manejo e inversión de los fondos de la asociación, del mantenimiento e integridad de sus bienes patrimoniales y de la gestión administrativa durante el término de su mandato y ejercicio de sus funciones, salvo que existiera constancia fehacientemente de su oposición al acto que perjudique los intereses de la asociación. Serán personalmente responsables de las multas que la Inspección General de Personas Jurídicas y Registro Público de Comercio aplique a la Asociación por cualquier infracción a normas legales o estatutarias imputables a dichas comisiones.

ARTÍCULO 19: Para ser miembro titular de la Comisión Directiva o de la Comisión Revisora de Cuentas se requiere: a) Ser socio activo o vitalicio con una antigüedad mínima de doce (12) meses de conformidad a lo establecido por el inciso e) del artículo 15; b) Ser mayor de edad; c) Encontrarse al día en el pago de las cuotas sociales sin necesidad de intimación previa; d) No encontrarse cumpliendo sanciones disciplinarias. Los miembros de la Comisión Directiva no podrán tener relación de parentesco por consanguinidad o afinidad hasta segundo grado inclusive con el Revisor de Cuentas y viceversa.

ARTÍCULO 20: La Comisión Directiva se reunirá ordinariamente por lo menos una vez por mes, por citaciones de su Presidente, y extraordinariamente cuando lo soliciten tres de sus miembros, debiendo en estos casos realizarse la reunión dentro de los cinco días hábiles de efectuada la solicitud. La citación, en los dos casos, deberá hacerse en forma fehaciente al último domicilio conocido de cada uno de los miembros titulares de la Comisión Directiva. Los miembros de la Comisión Directiva que faltaren a tres reuniones consecutivas o a cinco alternadas, sin causa justificada, serán separados, previa notificación de sus cargos, los que serán cubiertos por los integrantes restantes de la Comisión Directiva o, en su defecto, por decisión de una Asamblea convocada al efecto.

ARTÍCULO 21: Las reuniones de la Comisión Directiva se celebrarán válidamente con la presencia de la mitad más uno de sus miembros titulares respectivamente, como mínimo. Para las resoluciones de la Comisión Directiva se requerirá el voto de la mayoría simple de los presentes, salvo para las reconsideraciones que requerirán el voto favorable de los dos tercios de los asistentes en otra reunión constituida con igual o mayor número de asistentes que aquella que adoptó la resolución a reconsiderar. Las decisiones de la Comisión Revisora de Cuentas se adoptarán con el voto de su miembro titular, no admitiendo reconsideración alguna ante el mismo cuerpo.

ARTÍCULO 22: Son Deberes y Atribuciones de la Comisión Directiva: a) Ejecutar las resoluciones de las Asambleas, cumplir y hacer cumplir este estatuto y los reglamentos; b) Ejercer en general todas aquellas funciones inherentes a la dirección, administración y representación de la asociación, quedando facultada a este respecto, para resolver por sí los casos no previstos en el presente estatuto, interpretándolo, si fuera necesario, con cargo de dar cuenta a la Asamblea más próxima que se celebre, la que deberá pronunciarse ratificando o no el criterio adoptado y sentando el precedente definitivo siempre y cuando no se contraponga a normas legales de mayor jerarquía; c) Convocar a Asambleas; d) Resolver sobre la admisión, amonestación, suspensión, cesantías o expulsión de asociados; e) Crear o suprimir empleos, fijar su remuneración, aplicar las sanciones que correspondan a quienes los ocupen, contratar todos los servicios que sean necesarios para el mejor logro de los fines sociales; f) Presentar a la Asamblea General Ordinaria la Memoria, Inventario y Estados Contables e Informe de la Comisión Revisora de Cuentas correspondiente al Ejercicio fenecido, como asimismo poner a disposición de todos los asociados con la misma anticipación requerida en el Artículo 31 para la remisión de las convocatorias a Asambleas; g) Realizar los actos para la administración del patrimonio social, con cargo de dar cuenta a la primera Asamblea que se celebre, salvo los casos de adquisición, enajenación, hipoteca o permuta de bienes inmuebles, en que será necesaria la previa aprobación de una asamblea de asociados; h) Elevar a la Asamblea, para su aprobación las reglamentaciones internas que considere a los efectos del mejor desenvolvimiento de sus finalidades; i) Disminuir o suspender la cuota de ingreso de cada categoría de asociados por un plazo no mayor de 30 días y siempre que no fuera dentro de los tres meses anteriores a la fecha de la Asamblea General Ordinaria; j) Llamar a elecciones para renovación de autoridades, cumplido con el acto electoral, fijar fecha cierta para realizar el traspaso de la administración a las autoridades entrantes, no pudiendo exceder en ningún caso el término de dos años que dura sus mandatos.

ARTÍCULO 23: : Son Deberes y Atribuciones de la Comisión Revisora de Cuentas: a) Examinar los libros y documentos de la Asociación por lo menos cada tres meses; b) Asistir con voz a las sesiones del órgano directivo cuando lo considere conveniente; c) Fiscalizar la administración comprobando frecuentemente el estado de la caja y la existencia de los títulos, acciones y valores de toda especie; d) Verificar el cumplimiento de las leyes, estatutos y reglamentos, especialmente en lo referente a los derechos de los Asociados y las condiciones en que se otorgan los beneficios sociales; e) Dictaminar sobre la Memoria, Inventario y los Estados Contables presentados por la Comisión Directiva; f) Convocar a Asamblea General Ordinaria cuando omitiera hacerlo la Comisión Directiva; g) Solicitar la convocatoria a Asamblea General Extraordinaria cuando lo juzgue necesario, poniendo los antecedentes que fundamentan su pedido en conocimiento de la Inspección General de Personas Jurídicas y Registro Público de Comercio cuando se negare la Comisión Directiva en forma expresa o tácita a realizar dicha convocatoria; h) En su caso, vigilar las operaciones de liquidación de la Asociación y el destino de los bienes sociales, i) Dirigir y supervisar el proceso de elección de autoridades de acuerdo a lo establecido en el Artículo 17 de este Estatuto. La Comisión Revisora de Cuentas cuidará de ejercer sus funciones de modo que no entorpezcan la regularidad de la administración social siendo responsables por los actos de la Comisión Directiva violatorios de la Ley o del mandato social si no dan cuenta del mismo a la Asamblea correspondiente o en su actuación posterior a esta, siguieren silenciando u ocultando dichos actos. Para sesionar necesitará la presencia de uno de su miembro titular, número que será mayoría para adoptar resoluciones. Si por cualquier causa quedara sin miembro titular, una vez incorporado el suplente, la Comisión Directiva deberá convocar dentro de los quince días a Asamblea para su integración designando a propuesta de los Asambleístas y a simple pluralidad de votos a cada uno de los que asumirán en los cargos vacantes hasta completar los mandatos que estaban previstos para los que dejaron dichos cargos.

ARTÍCULO 24: El Presidente, y en caso de renuncia, ausencia, enfermedad o fallecimiento, el Vocal Titular, tiene los siguientes deberes y atribuciones: a) Convocar a las Asambleas y Sesiones de la Comisión Directiva y presidirlas; b) Decidir con su voto en caso de empate en las votaciones de las Asambleas y sesiones de la Comisión Directiva; c) Firmar con el Secretario las Actas de las Asambleas y de las sesiones de la Comisión Directiva, la correspondencia y todo otro documento de la Entidad; d) Autorizar con el Tesorero las cuentas de gastos, firmando los recibos y demás documentos de la Tesorería de acuerdo con lo resuelto por la Comisión Directiva, no permitiéndose que los fondos sociales sean invertidos en objetos distintos a los prescriptos por este Estatuto; e) Dirigir y mantener el orden y respeto debidos; f) Velar por la buena marcha y administración de la Asociación, observando y haciendo observar el Estatuto, Reglamento, y Resoluciones de las Asambleas y de la Comisión Directiva; g) Suspender a cualquier empleado que no cumpla con sus obligaciones, dando cuenta inmediatamente a la Comisión Directiva, como así de las resoluciones que adopte por sí en los casos urgentes ordinarios, pues no podrá tomar medidas extraordinarias sin la previa aprobación de aquella; h) Representar a la Institución en sus relaciones con terceros.

TITULO QUINTO. DEL SECRETARIO.

ARTÍCULO 25: El Secretario y en caso de renuncia, ausencia, enfermedad o fallecimiento, el Vocal Titular tiene los siguientes derechos y obligaciones: a) Asistir a las Asambleas y Sesiones de la Comisión Directiva redactando las Actas respectivas las que asentará en los Libros correspondientes y las firmará con el Presidente; b) Firmar con el Presidente la correspondencia y todo documento de la Institución; c) Convocar a las sesiones de la Comisión Directiva de acuerdo con el Artículo 20; d) Llevar de acuerdo con el Tesorero el Registro de Asociados, así como los Libros de Actas de las Asambleas y de Sesiones de la Comisión Directiva y los respectivos registros de Asistencias.

TITULO SEXTO. DEL TESORERO.

ARTÍCULO 26: El Tesorero y, en caso de renuncia, ausencia, enfermedad o fallecimiento el Vocal Titular, tiene los siguientes deberes y atribuciones: a) Llevar de acuerdo con el Secretario el Registro de Asociados, ocupándose de todo lo relacionado con el cobro de las cuotas sociales; b) Llevar los libros de contabilidad; c) Presentar a la Comisión Directiva en forma mensual un balance de comprobación de sumas y saldos y preparar anualmente los Estados Contables que deberán ser sometidos a la aprobación de la Comisión Directiva para su presentación ante la Asamblea General Ordinaria, previo dictamen de la Comisión Revisora de Cuentas. Dichos Estados Contables los firmará conjuntamente con el Presidente; d) Firmar con el Presidente los recibos y demás documentos de Tesorería, efectuando los pagos resueltos por la Comisión Directiva; e) Efectuar en los Bancos oficiales o particulares que designe la Comisión Directiva a nombre de la Institución y a la orden conjunta de Presidente y Tesorero, los depósitos del dinero ingresado a la Caja Social, pudiendo retener en la misma hasta la suma que anualmente determine la Asamblea, a los efectos de los pagos ordinarios y de urgencia; f) Dar cuenta del estado económico- financiero de la entidad a la Comisión Directiva y a la Comisión Revisora de Cuentas toda vez que aquellas los exijan; g) Firmar con el Presidente los giros, cheques u otros documentos para la extracción de fondos.

TÍTULO SÉPTIMO. DEL VOCAL TITULAR.

ARTÍCULO 27: Corresponde al Vocal Titular : a) Asistir con voz y voto a las Asambleas y a las sesiones de la Comisión Directiva; b) Desempeñar las funciones y tareas que la Comisión Directiva le confíe; c) Cubrir por orden de prelación los cargos ejecutivos previstos en los Artículos 24, 25 y 26 precedentes, cuando se den los supuestos allí mencionados.

ARTÍCULO 28: El Vocal Suplente se incorporará por orden de lista a la Comisión Directiva para reemplazar, en principio, al Vocal Titular en caso de renuncia, ausencia, enfermedad o fallecimiento de éstos o cuando por aplicación de la última parte del artículo anterior, los mismos deban ocupar otro cargo vacante. Todos los reemplazos por renuncia, fallecimiento, ausencia o enfermedad se efectuarán hasta completar el mandato previsto para el reemplazado o, en los dos últimos casos hasta que cesen dichas causales. Principio este que será de aplicación en los artículos inmediatamente precedentes. Si el número de miembros de la Comisión Directiva quedare reducido a menos de la mitad más uno de su totalidad a pesar de haber incorporado al suplente, la Comisión Directiva en minoría deberá convocar dentro de los quince días a Asamblea para su integración a simple mayoría de votos a cada uno de los postulantes propuestos en la misma Asamblea para ocupar los cargos vacantes hasta que se complete el mandato previsto para los que hubieren cesado por cualquiera de las causas señaladas.

TÍTULO OCTAVODE LAS ASAMBLEAS.

ARTÍCULO 29: Habrá dos clases de Asambleas Generales: Ordinarias y Extraordinarias. Las Asambleas Ordinarias tendrán lugar una vez al año, dentro de los cuatro meses posteriores al cierre del Ejercicio económico que se clausurará el 30 de junio de cada año a los efectos de considerar los siguientes puntos: a) Consideración de la Memoria, Estados Contables e Informe de la Comisión Revisora de Cuentas; b) Elección de todos los miembros de la Comisión Directiva y del Revisor de Cuentas, cuando corresponda, previa designación de una Comisión Escrutadora compuesta al efecto por tres Miembros designados por la Asamblea de entre los asociados presentes; c) Tratar cualquier otro asunto incluido en convocatoria.

ARTÍCULO 30: Las Asambleas Extraordinarias serán convocadas siempre que la Comisión Directiva lo estime necesario, o cuando lo solicite el Revisor de Cuentas o el diez por ciento de los socios con derecho a voto. Estos pedidos deberán ser resueltos dentro de un término no mayor de treinta días corridos y si no se tomase en cuenta la petición o se la negare infundadamente, podrán los interesados elevar dichos antecedentes a la Inspección General de Personas Jurídicas y Registro Público de Comercio a los efectos de que dicho organismo la convoque de oficio. En este último caso los miembros de la Comisión Directiva y, si corresponde, del Revisor de Cuentas, serán personal y solidariamente responsables de las consecuencias de la omisión de sus deberes.

ARTÍCULO 31: Las Asambleas se convocarán mediante avisos en la Sede Social y publicación en el Boletín Oficial cuando el número de socios en condiciones de votar fuere inferior a cincuenta. Si fuere superior a ese número la convocatoria se hará mediante avisos en la sede social y publicaciones por un día en el Boletín Oficial de la Provincia y en uno de los diarios locales de mayor circulación. En ambos casos se convocará con una anticipación de quince días al Acto Asambleario. En el momento de ponerse el aviso en un lugar bien visible de la sede, se tendrá en Secretaría, en el horario de atención al público y siempre que deban ser considerados en la Asamblea un ejemplar de la Memoria, Estados Contables e Informes de la Comisión Revisora de Cuentas. En el caso de considerarse reformas al Estatuto o aprobación o reformas de reglamentos, también se tendrá un proyecto de los mismos a disposición de los asociados. En las Asambleas no podrán tratarse asuntos no incluidos en el Orden del Día correspondiente.

ARTÍCULO 32: En la primera convocatoria las Asambleas se celebrarán con la presencia del 51% de los socios con derecho a voto. Una hora después, si no se hubiese conseguido ese número, se reunirá legalmente constituida con el número de socios con derecho a voto presente.

ARTÍCULO 33: E n las Asambleas Ordinarias las resoluciones se adoptarán por simple mayoría de los socios presentes, salvo los casos previstos por este estatuto que exigen proporción mayor. Ningún asociado podrá tener más de un voto a excepción del Presidente en caso de empate, y los miembros de la Comisión Directiva y el Revisor de Cuentas se abstendrán de votar en los asuntos relacionados con su gestión. Los socios no podrán hacerse representar en las Asambleas de ninguna manera.

ARTÍCULO 34: Con quince días, como mínimo, de anterioridad a cada Asamblea, la Comisión Directiva confeccionará un listado de Asociados en condiciones de votar, el que será puesto a disposición de los asociados en secretaría y exhibido en lugar bien visible del local social, los asociados podrán oponer reclamaciones dentro de los cinco días hábiles posteriores. De lo que resuelva dicha Comisión, los Asociados podrán manifestar oposición dentro de los cinco días hábiles ante el Revisor de Cuentas. Una vez que se hayan expedido las autoridades mencionadas y no se haya hecho ninguna otra reclamación, las listas de Asociados quedarán firmes.

ARTÍCULO 35: Las asambleas podrán celebrarse en forma presencial o híbrida; en este último caso, la convocatoria deberá cumplir con todo lo establecido por la Disposición General Nº 006/24 IGPJ y RPC. Asimismo, podrán celebrarse en un domicilio distinto al de la sede social de conformidad a lo prescripto por la Disposición General Nº 005/2024 IGPJ y RPC.

ARTÍCULO 36: Las Asambleas podrán pasar a cuarto intermedio por única vez, en un término no mayor de treinta días corridos. La Asamblea determinará el lugar, fecha y hora de la reanudación de la misma debiendo comunicar dentro de las cuarenta y ocho (48) horas hábiles a la Inspección General de Personas Jurídicas y Registro Público de Comercio.

TITULO NOVENO. REFORMA DE ESTATUTO. DISOLUCIÓN. FUSIÓN.

ARTÍCULO 37: Estos Estatutos no podrán reformarse sin el voto favorable de los dos tercios de los Socios presentes en una Asamblea General convocada al efecto y constituida como mínimo con la asistencia del 51% de los Asociados con derecho a voto. En segunda convocatoria se hará con el 30% de los Socios con derecho a voto y con la mayoría de los dos tercios de los presentes:

ARTÍCULO 38: La institución solo podrá ser disuelta por la voluntad de sus Asociados en una Asamblea convocada al efecto y constituida de acuerdo a las condiciones preceptuadas en el artículo anterior. De hacerse efectiva la disolución, se designarán los liquidadores que podrán ser, la misma Comisión Directiva u otros Asociados que la Asamblea resuelva. El Revisor de Cuentas deberá vigilar las operaciones de liquidación. Una vez pagadas las deudas sociales, el remanente de los bienes se transferirá al Fondo Especial de la Inspección General de Personas Jurídicas y Registro Público de Comercio, creado por el artículo 36º de la Ley Nº 1903-C.

ARTÍCULO 39: Esta Institución no podrá fusionarse con otra u otras similares sin el voto favorable de los dos tercios de los Socios presentes en una Asamblea convocada al efecto y constituida como mínimo con la presencia del 51% de los asociados con derecho a voto. En segunda convocatoria se hará con el 30% de los Socios con derecho a voto, rigiéndose con la mayoría de los dos tercios de los votos presentes. Esta resolución y de los Artículos 37 y 38 deberán ser sometidos a consideración de la Inspección General de Personas Jurídicas y Registro Público de Comercio para su respectiva aprobación por el Poder Ejecutivo y hasta tanto ello no ocurra no tendrán validez legal.`

/**
 * El estatuto con la denominación y el domicilio de la entidad.
 *
 * Lo que falte sale entre corchetes, igual que en las demás plantillas: es
 * preferible que el hueco se vea a que alguien firme un estatuto con un dato
 * inventado.
 */
export function estatutoModelo(e: Entidad | null): DocumentoGenerado {
  const faltantes: string[] = []

  const razon = e?.razon_social?.trim()
  if (!razon) faltantes.push('la razón social de la entidad')

  // El domicilio del modelo es Resistencia. Si la entidad declara otra
  // localidad se usa la suya: el estatuto dice dónde queda constituida, y ese
  // dato no puede salir de una plantilla.
  const localidad = e?.sede_localidad?.trim()
  if (!localidad) faltantes.push('la localidad de la sede social')

  // El articulado entero remite a la Inspección General de Personas Jurídicas
  // del Chaco: es el organismo que pre-visó ESTE texto. Si la entidad está
  // radicada en otra provincia, el modelo no le sirve, y conviene decirlo acá y
  // no que lo descubra en la mesa de entradas. No se bloquea: el texto se emite
  // igual, con el aviso.
  const provincia = e?.sede_provincia?.trim()
  if (provincia && provincia.toLowerCase() !== MODELO_CHACO.jurisdiccion.toLowerCase()) {
    faltantes.push(
      `este modelo es el pre-visado del ${MODELO_CHACO.jurisdiccion} y la entidad ` +
      `declara sede en ${provincia}: hay que usar el modelo de esa jurisdicción`)
  }

  const denominacion = razon ? `«${razon}»` : FALTA('razón social')
  const domicilio = localidad
    ? `En la Ciudad de ${localidad}, de la Provincia del ${MODELO_CHACO.jurisdiccion}, ` +
      'donde tendrá su domicilio,'
    : `En la Ciudad de ${FALTA('localidad de la sede')}, de la Provincia del ` +
      `${MODELO_CHACO.jurisdiccion}, donde tendrá su domicilio,`

  const texto = CUERPO
    .replace('{{DENOMINACION}}', denominacion)
    .replace('{{DOMICILIO}}', domicilio)

  return {
    titulo: 'Estatuto (modelo pre-visado — Disp. Gral. 010-24, Anexo II)',
    texto,
    faltantes,
  }
}
