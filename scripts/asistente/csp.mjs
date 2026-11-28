// ¿La política de contenido de public/_headers deja funcionar al asistente? Pura (sin leer archivos): la usa
// scripts/asistente-csp.test.mjs. Sirve para que nadie active el asistente (`PUBLIC_ASISTENTE_URL`) con unas cabeceras
// que lo bloquean: el widget quedaría muerto en silencio y con violaciones de CSP en la consola.
//
// Qué necesita (docs-asistente/03, sección 8): el origen del Worker en `connect-src` y Turnstile (Cloudflare) en `script-src`,
// `frame-src` y `connect-src`. Una directiva que falta hereda de `default-src`.

export const ORIGEN_TURNSTILE = 'https://challenges.cloudflare.com';

/** `{ 'script-src': ["'self'", ...], ... }` a partir del valor de Content-Security-Policy. */
export function directivasDeCsp(csp) {
	const salida = {};
	for (const parte of csp.split(';')) {
		const [nombre, ...valores] = parte.trim().split(/\s+/);
		if (nombre) salida[nombre.toLowerCase()] = valores;
	}
	return salida;
}

/** ¿Alguna fuente de la lista admite el origen? Vale el origen exacto o `https://*.dominio` (un subdominio, no el dominio pelado). */
function admite(fuentes, origen) {
	const { protocol, hostname } = new URL(origen);
	return fuentes.some((f) => {
		if (f === origen) return true;
		const m = /^(https?:)\/\/\*\.(.+)$/.exec(f);
		return m !== null && m[1] === protocol && hostname.endsWith(`.${m[2]}`);
	});
}

/**
 * Lo que le falta a la política para que el asistente (Worker en `urlApi`, con Turnstile) funcione; vacía si no falta nada.
 * @param {string} csp valor de la cabecera Content-Security-Policy
 * @param {string} urlApi origen del Worker (`https://asistente.matiasormeno.com.ar`)
 */
export function faltantesParaAsistente(csp, urlApi) {
	const d = directivasDeCsp(csp);
	const de = (nombre) => d[nombre] ?? d['default-src'] ?? [];
	const origenApi = new URL(urlApi).origin;
	const faltan = [];
	if (!admite(de('connect-src'), origenApi)) faltan.push(`connect-src sin ${origenApi}`);
	for (const directiva of ['script-src', 'frame-src', 'connect-src']) {
		if (!admite(de(directiva), ORIGEN_TURNSTILE)) faltan.push(`${directiva} sin ${ORIGEN_TURNSTILE} (Turnstile)`);
	}
	return faltan;
}
