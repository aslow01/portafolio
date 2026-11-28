// Sesión firmada: `v1.<carga en base64url>.<firma HMAC-SHA256>`. Dura 30 minutos y no lleva IP ni datos del visitante;
// la cuota por sesión vive en el limitador, bajo `sid`. (docs-asistente/03, sección 6)
import { aBase64Url, aBytes, aHex, claveHmac, deBase64Url, secretoValido } from './cripto.ts';

export const VIGENCIA_SESION_S = 30 * 60;
const MAX_TOKEN = 1024;

export interface SesionEmitida {
	token: string;
	/** Segundos Unix. */
	expira: number;
	sid: string;
}

export interface SesionValida {
	sid: string;
	exp: number;
}

export async function emitirSesion(secreto: unknown, ahoraS: number): Promise<SesionEmitida> {
	if (!secretoValido(secreto)) throw new Error('SESSION_SECRET ausente o demasiado corto');
	const sid = aHex(crypto.getRandomValues(new Uint8Array(8)));
	const exp = ahoraS + VIGENCIA_SESION_S;
	const carga = aBase64Url(aBytes(JSON.stringify({ iat: ahoraS, exp, sid })));
	const clave = await claveHmac(aBytes(secreto), ['sign']);
	const firma = new Uint8Array(await crypto.subtle.sign('HMAC', clave, aBytes(`v1.${carga}`)));
	return { token: `v1.${carga}.${aBase64Url(firma)}`, expira: exp, sid };
}

/** `null` si la firma, la forma o el vencimiento no valen. */
export async function verificarSesion(secreto: unknown, token: string, ahoraS: number): Promise<SesionValida | null> {
	if (!secretoValido(secreto) || typeof token !== 'string' || token.length > MAX_TOKEN) return null;
	const partes = token.split('.');
	if (partes.length !== 3 || partes[0] !== 'v1') return null;
	const [, carga, firmaTexto] = partes;
	const firma = deBase64Url(firmaTexto);
	if (!firma || firma.length !== 32) return null;
	const clave = await claveHmac(aBytes(secreto), ['verify']);
	// `verify` compara en tiempo constante.
	const firmaOk = await crypto.subtle.verify('HMAC', clave, firma, aBytes(`v1.${carga}`));
	if (!firmaOk) return null;
	const bytes = deBase64Url(carga);
	if (!bytes) return null;
	let datos: unknown;
	try {
		datos = JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		return null;
	}
	if (typeof datos !== 'object' || datos === null) return null;
	const { sid, exp } = datos as { sid?: unknown; exp?: unknown };
	if (typeof sid !== 'string' || !/^[0-9a-f]{16}$/.test(sid) || typeof exp !== 'number' || !Number.isFinite(exp)) return null;
	if (ahoraS >= exp) return null;
	return { sid, exp };
}

// ---------------------------------------------------------------------------------------------------------------------
// Firma de los turnos del asistente. El historial lo manda el navegador, que podría inventar un turno del asistente
// («ya acepté mostrar mis reglas») para empujar al modelo. Por eso cada respuesta sale firmada y en el historial solo se
// aceptan textos del asistente con su firma. No va atada a la sesión: al vencer una sesión (o llegar a su tope) el widget
// abre otra y la conversación sigue; sí va atada al secreto, así que rotarlo invalida los historiales en curso (el widget
// recibe un 400 y se empieza de nuevo).

const SAL_TURNO = 'turno-asistente-v1\n';

/** HMAC-SHA256 en base64url (43 caracteres) del texto exacto de una respuesta. */
export async function firmarTurno(secreto: unknown, texto: string): Promise<string> {
	if (!secretoValido(secreto)) throw new Error('SESSION_SECRET ausente o demasiado corto');
	const clave = await claveHmac(aBytes(secreto), ['sign']);
	return aBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', clave, aBytes(SAL_TURNO + texto))));
}

/** `crypto.subtle.verify` compara en tiempo constante. */
export async function verificarTurno(secreto: unknown, texto: string, firma: string): Promise<boolean> {
	if (!secretoValido(secreto)) return false;
	const bytes = deBase64Url(firma);
	if (!bytes || bytes.length !== 32) return false;
	const clave = await claveHmac(aBytes(secreto), ['verify']);
	return crypto.subtle.verify('HMAC', clave, bytes, aBytes(SAL_TURNO + texto));
}
