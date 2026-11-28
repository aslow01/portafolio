// Textos de la interfaz del asistente, en español neutro (de usted) y en inglés: docs-asistente/02-textos.md, sección 1.
// `{correo}` y `{max}` se reemplazan al pedir los textos (el correo sale de lib/sitio.ts, no se escribe acá).
// Los textos marcados «nuevo» no estaban en el documento 02: salen de la especificación de interfaz (01) o los escribió quien
// implementó la lógica, y esperan la revisión de redacción.
import type { Idioma, Textos } from './tipos.ts';

const ES = {
	lanzador: 'Pregúntele a mi asistente',
	lanzadorCorto: 'Preguntar',
	tituloPanel: 'Asistente del portafolio',
	etiquetaIa: 'Con IA',
	saludo:
		'Hola. Soy un asistente con IA y respondo sobre este portafolio: casos, demos, CV y cómo contactar a Matías. Puedo equivocarme; si algo es importante, confírmelo en la página indicada o por correo.',
	campoPlaceholder: 'Escriba su pregunta',
	enviar: 'Enviar pregunta',
	cerrar: 'Cerrar el asistente',
	nueva: 'Nueva conversación (borra la anterior)',
	escribiendo: 'Escribiendo…',
	escribiendoLector: 'El asistente está escribiendo la respuesta.',
	sugerencias: ['¿Qué tipo de trabajo busca Matías?', '¿Qué parte hace él y qué parte hace la IA?', '¿Qué demos puedo probar?', '¿Cómo lo contacto?'],
	privacidad:
		'Su pregunta se envía a un servicio de IA para generar la respuesta. No se guarda la conversación. No escriba datos personales ni sensibles.',
	contactoTitulo: '¿Prefiere hablar con Matías?',
	contactoTexto: 'Para una propuesta, una consulta sobre un caso o condiciones de trabajo, escríbale directamente.',
	escribir: 'Escribir a Matías',
	verContacto: 'Ver todos los canales',
	asuntoCorreo: 'Consulta desde el portafolio',
	reintentar: 'Reintentar',
	avisoPrueba: 'Modo de prueba: las respuestas son simuladas y no usan IA.',
	errores: {
		red: 'No se pudo conectar con el asistente. Puede ser su conexión o una falla momentánea. Intente de nuevo en unos minutos o escriba a {correo}.',
		// nuevo: la redacción sigue el patrón de 02 (qué pasó, por qué, qué hacer).
		tiempo: 'El asistente tardó demasiado en responder. Puede ser una demora momentánea del servicio. Intente de nuevo o escriba a {correo}.',
		servicio: 'El asistente no está disponible en este momento. Falló el servicio que genera las respuestas. Intente más tarde o escriba a {correo}.',
		verificacion:
			'No se pudo verificar que usted es una persona. La verificación anti robots falló o venció. Recargue la página e intente de nuevo; si sigue igual, escriba a {correo}.',
		limiteVisitante: 'Llegó al límite de preguntas por ahora. Hay un tope por visitante para cuidar el servicio. Vuelva a intentar más tarde o escriba a {correo}.',
		// nuevo
		limiteSesion: 'Esta conversación llegó a su límite de preguntas. Puede empezar una nueva para seguir, o escribir a {correo}.',
		conversacionLarga: 'Esta conversación se hizo demasiado larga para seguir. Empiece una nueva conversación (botón «Nueva conversación») o escriba a {correo}.',
		tope: 'El asistente alcanzó su límite de uso de hoy. Se renueva cada día. Mientras tanto, el sitio tiene los casos, las demos y el CV, y puede escribir a {correo}.',
		largo: 'Su pregunta es demasiado larga (máximo {max} caracteres). Acórtela e intente de nuevo.',
		vacio: 'Escriba una pregunta para poder enviarla.',
	},
} satisfies Omit<Textos, keyof TextosExtra>;

const EN = {
	lanzador: 'Ask my assistant',
	lanzadorCorto: 'Ask',
	tituloPanel: 'Portfolio assistant',
	etiquetaIa: 'AI-powered',
	saludo:
		'Hi. I am an AI assistant and I answer questions about this portfolio: case studies, demos, CV and how to contact Matías. I can make mistakes; if something is important, please check it on the page I point to or by email.',
	campoPlaceholder: 'Type your question',
	enviar: 'Send question',
	cerrar: 'Close the assistant',
	nueva: 'New conversation (clears the previous one)',
	escribiendo: 'Typing…',
	escribiendoLector: 'The assistant is writing the answer.',
	sugerencias: ['What kind of job is Matías looking for?', 'What does he do himself and what does the AI do?', 'Which demos can I try?', 'How do I contact him?'],
	privacidad:
		'Your question is sent to an AI service to generate the answer. The conversation is not saved. Please do not type personal or sensitive data.',
	contactoTitulo: 'Would you rather talk to Matías?',
	contactoTexto: 'For a job proposal, a question about a case study or working conditions, write to him directly.',
	escribir: 'Email Matías',
	verContacto: 'See all contact options',
	asuntoCorreo: 'Inquiry from the portfolio',
	reintentar: 'Try again',
	avisoPrueba: 'Test mode: answers are simulated and do not use AI.',
	errores: {
		red: 'Could not reach the assistant. It may be your connection or a temporary fault. Try again in a few minutes or write to {correo}.',
		tiempo: 'The assistant took too long to answer. It may be a temporary delay of the service. Try again or write to {correo}.',
		servicio: 'The assistant is not available right now. The service that generates the answers failed. Try again later or write to {correo}.',
		verificacion:
			'We could not verify that you are a person. The anti-bot check failed or expired. Reload the page and try again; if it keeps failing, write to {correo}.',
		limiteVisitante: 'You have reached the question limit for now. There is a cap per visitor to protect the service. Try again later or write to {correo}.',
		limiteSesion: 'This conversation reached its question limit. You can start a new one to continue, or write to {correo}.',
		conversacionLarga: 'This conversation has become too long to continue. Start a new conversation (the "New conversation" button) or write to {correo}.',
		tope: 'The assistant has reached its usage limit for today. It resets every day. Meanwhile, the site has the case studies, demos and CV, and you can write to {correo}.',
		largo: 'Your question is too long (maximum {max} characters). Shorten it and try again.',
		vacio: 'Type a question so it can be sent.',
	},
} satisfies Omit<Textos, keyof TextosExtra>;

const TEXTOS = { es: ES, en: EN };

function poner(valor: string, datos: { correo: string; max: number }): string {
	return valor.replaceAll('{correo}', datos.correo).replaceAll('{max}', String(datos.max));
}

/** Los textos de un idioma con `{correo}` y `{max}` ya reemplazados. */
export function textosDe(idioma: Idioma, datos: { correo: string; max: number }): Textos {
	const base = TEXTOS[idioma];
	const p = (v: string) => poner(v, datos);
	return {
		lanzador: base.lanzador,
		lanzadorCorto: base.lanzadorCorto,
		tituloPanel: base.tituloPanel,
		etiquetaIa: base.etiquetaIa,
		saludo: base.saludo,
		campoPlaceholder: base.campoPlaceholder,
		enviar: base.enviar,
		cerrar: base.cerrar,
		nueva: base.nueva,
		escribiendo: base.escribiendo,
		escribiendoLector: base.escribiendoLector,
		sugerencias: base.sugerencias,
		privacidad: base.privacidad,
		contactoTitulo: base.contactoTitulo,
		contactoTexto: base.contactoTexto,
		escribir: base.escribir,
		verContacto: base.verContacto,
		asuntoCorreo: base.asuntoCorreo,
		reintentar: base.reintentar,
		avisoPrueba: base.avisoPrueba,
		...textosExtraDe(idioma),
		errores: {
			red: p(base.errores.red),
			tiempo: p(base.errores.tiempo),
			servicio: p(base.errores.servicio),
			verificacion: p(base.errores.verificacion),
			limiteVisitante: p(base.errores.limiteVisitante),
			limiteSesion: p(base.errores.limiteSesion),
			conversacionLarga: p(base.errores.conversacionLarga),
			tope: p(base.errores.tope),
			largo: p(base.errores.largo),
			vacio: p(base.errores.vacio),
		},
	};
}

/** Los textos que la lógica no usa pero la presentación necesita (01-diseno.md, 3.4 a 3.9); van dentro de `Textos`. */
type TextosExtra = Pick<Textos, 'sinConexion' | 'buscando' | 'introVacio' | 'rotulos' | 'quedan'>;
const EXTRA_ES: TextosExtra = {
	sinConexion: 'Sin conexión a internet. Podrá enviar la pregunta cuando vuelva.',
	buscando: 'Buscando en el portafolio…',
	introVacio: 'Puede preguntar por los casos, las demos, el CV o cómo contactar a Matías. Por ejemplo:',
	rotulos: { usted: 'Usted', asistente: 'Asistente', fuente: 'Fuente', pregunta: 'Su pregunta' },
	quedan: (n) => (n === 1 ? 'Queda 1 pregunta en esta conversación.' : `Quedan ${n} preguntas en esta conversación.`),
};

const EXTRA_EN: TextosExtra = {
	sinConexion: 'No internet connection. You can send the question when it comes back.',
	buscando: 'Searching the portfolio…',
	introVacio: 'You can ask about the case studies, the demos, the CV or how to contact Matías. For example:',
	rotulos: { usted: 'You', asistente: 'Assistant', fuente: 'Source', pregunta: 'Your question' },
	quedan: (n) => (n === 1 ? '1 question left in this conversation.' : `${n} questions left in this conversation.`),
};

export function textosExtraDe(idioma: Idioma): TextosExtra {
	return idioma === 'es' ? EXTRA_ES : EXTRA_EN;
}
