// Rótulos de la hoja de consulta que NO son de la lógica del asistente: la sigla y la palabra del lanzador, la bajada de la tapa,
// los rótulos cortos de los errores y los estados del campo. Los textos de la conversación (saludo, errores, sugerencias,
// privacidad, contacto, «Usted / Asistente / Fuente», «Buscando…») salen de `asistente.textos` (src/lib/asistente/textos.ts):
// una sola fuente. Datos puros, sin DOM: scripts/consulta.test.mjs.
// Español neutro, de usted; inglés simple para la futura /en/.
import type { ClaveError, Idioma } from '../../lib/asistente/tipos.ts';

export interface Rotulos {
	/** El lanzador: la sigla (el sello) y la palabra de su forma corta (la celda y el celular apaisado). La frase entera es `textos.lanzador`. */
	siglaIa: string;
	palabra: string;
	/** Lo que se suma, solo para lectores de pantalla, al nombre del lanzador: a la frase entera («Pregúntele a mi asistente» + «de IA») … */
	complementoFrase: string;
	/** … y a la forma corta («Preguntar» + «al asistente de IA»). El sello es decorativo y no entra en el nombre. */
	complementoLanzador: string;
	noDisponible: string;
	/** Solapa de la hoja («IA · Asistente»). */
	solapa: string;
	/** Bajada de la tapa: el único aviso («responde con lo publicado y puede equivocarse»); lo demás va al pie, en la nota de privacidad. */
	bajada: string;
	/** Rótulo de las preguntas que se ven en la tapa del camino técnico (cuando hay lugar para dos). */
	invita: string;
	/** Texto visible de «Cerrar», «Enviar» y «Nueva conversación» (el nombre accesible completo sale de `asistente.textos`). */
	cerrar: string;
	enviar: string;
	enviarEsperando: string;
	nuevaCorto: string;
	/** Aviso sobre Turnstile, cuando Cloudflare pide una interacción. */
	verificacion: string;
	/** Rótulos cortos de los errores, por clave. Vacío: se dibuja como nota junto al campo, sin rótulo. */
	rotuloError: Readonly<Record<ClaveError, string>>;
	/** Placeholder del campo cuando el formulario está apagado (límite o tope). */
	campoApagado: string;
}

const es: Rotulos = {
	siglaIa: 'IA',
	palabra: 'Preguntar',
	complementoFrase: ' de IA',
	complementoLanzador: ' al asistente de IA',
	noDisponible: ' (no disponible ahora)',
	solapa: 'IA · Asistente',
	bajada: 'Responde con lo publicado en este sitio y puede equivocarse. Para una propuesta de trabajo, escriba por correo.',
	invita: 'Pregunte, por ejemplo:',
	cerrar: 'Cerrar',
	enviar: 'Enviar',
	enviarEsperando: 'Enviar pregunta (esperando respuesta)',
	nuevaCorto: 'Nueva conversación',
	verificacion: 'Antes de la primera pregunta, Cloudflare comprueba que la consulta no venga de un programa automático.',
	rotuloError: {
		red: 'Sin respuesta',
		tiempo: 'Sin respuesta',
		servicio: 'Sin respuesta',
		verificacion: 'Sin verificar',
		limiteVisitante: 'Límite de hoy',
		limiteSesion: 'Límite alcanzado',
		conversacionLarga: 'Conversación larga',
		tope: 'Fuera de servicio por hoy',
		largo: '',
		vacio: '',
	},
	campoApagado: 'Vuelva más tarde',
};

const en: Rotulos = {
	siglaIa: 'AI',
	palabra: 'Ask',
	complementoFrase: ' (AI)',
	complementoLanzador: ' the AI assistant',
	noDisponible: ' (not available right now)',
	solapa: 'AI · Assistant',
	bajada: 'It answers from what is published on this site and can make mistakes. For a job proposal, please write by email.',
	invita: 'Ask, for example:',
	cerrar: 'Close',
	enviar: 'Send',
	enviarEsperando: 'Send question (waiting for the answer)',
	nuevaCorto: 'New conversation',
	verificacion: 'Before the first question, Cloudflare checks that the request does not come from an automated program.',
	rotuloError: {
		red: 'No answer',
		tiempo: 'No answer',
		servicio: 'No answer',
		verificacion: 'Not verified',
		limiteVisitante: 'Limit for today',
		limiteSesion: 'Limit reached',
		conversacionLarga: 'Long conversation',
		tope: 'Out of service for today',
		largo: '',
		vacio: '',
	},
	campoApagado: 'Come back later',
};

export const rotulosDe = (idioma: Idioma): Rotulos => (idioma === 'en' ? en : es);

/**
 * Un error es una falla (rótulo y filete en el color de error) o información (un límite: no es culpa de nadie y se dibuja
 * en tinta). Los de validación del campo (`largo`, `vacio`) son fallas, pero se dibujan junto al campo.
 */
export const esFalla = (clave: ClaveError): boolean => !(clave === 'limiteVisitante' || clave === 'limiteSesion' || clave === 'conversacionLarga' || clave === 'tope');

/** `largo` y `vacio` no son una respuesta que no llegó: se dibujan junto al campo, no en el registro. */
export const esDeCampo = (clave: ClaveError): boolean => clave === 'largo' || clave === 'vacio';

/** ¿Se avisa «Quedan N preguntas»? Solo cuando quedan pocas (de 1 a 3) y hay sesión. */
export const quedanPocas = (restantes: number | null): restantes is number => restantes !== null && restantes >= 1 && restantes <= 3;

/** El contador del campo, «432 / 500», desde los 400 caracteres (o el 80 % del máximo, si es menor); antes, `null`. */
export function textoContador(largo: number, max: number): string | null {
	return largo >= Math.min(400, Math.floor(max * 0.8)) ? `${largo} / ${max}` : null;
}

/** Código de idioma de la interfaz: el de `<html lang>` (`es-AR` → `es`, `en-US` → `en`); lo demás, español. */
export const idiomaDe = (lang: string): Idioma => (lang.toLowerCase().startsWith('en') ? 'en' : 'es');
