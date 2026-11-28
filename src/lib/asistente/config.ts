// Si el asistente se monta o no, según las variables del build. Sin `PUBLIC_ASISTENTE_URL` el widget no existe: el sitio
// queda idéntico a hoy y la CSP no cambia (docs-asistente/01, sección 6; 03, sección 0). Puro, sin DOM.

export type ConfigDeEntorno =
	| { activo: false; motivo: string }
	| {
			activo: true;
			/** Origen del Worker, sin barra final. */
			urlApi: string;
			/** Sitekey pública de Turnstile; `null` solo en modo de prueba local. */
			sitekey: string | null;
			/** Worker local con respuestas simuladas (`http://localhost…`). Nunca en un build de producción. */
			modoPrueba: boolean;
	  };

const SITEKEY = /^[0-9A-Za-z_-]{10,64}$/;
/** Sitekeys de PRUEBA públicas de Cloudflare (1x pasa siempre, 2x bloquea siempre, 3x pide interacción): `1x` o `2x` o `3x`, 20 ceros y dos letras. */
export const esSitekeyDePrueba = (clave: string): boolean => /^[123]x0{20}[A-Z]{2}$/.test(clave);

const HOST_LOCAL = /^(?:localhost|127\.0\.0\.1)$/;

/**
 * @param env `PUBLIC_ASISTENTE_URL` y `PUBLIC_TURNSTILE_SITEKEY` (en Astro, `import.meta.env`).
 * @param produccion `import.meta.env.PROD`: en producción la dirección tiene que ser https y no puede ser local.
 */
export function leerConfigDeEntorno(env: { PUBLIC_ASISTENTE_URL?: string | undefined; PUBLIC_TURNSTILE_SITEKEY?: string | undefined }, produccion: boolean): ConfigDeEntorno {
	const bruta = (env.PUBLIC_ASISTENTE_URL ?? '').trim();
	if (bruta === '') return { activo: false, motivo: 'sin PUBLIC_ASISTENTE_URL' };

	let u: URL;
	try {
		u = new URL(bruta);
	} catch {
		return { activo: false, motivo: 'PUBLIC_ASISTENTE_URL no es una dirección válida' };
	}
	if (u.username !== '' || u.password !== '' || u.search !== '' || u.hash !== '' || (u.pathname !== '/' && u.pathname !== '')) {
		return { activo: false, motivo: 'PUBLIC_ASISTENTE_URL tiene que ser solo el origen del Worker (sin ruta, parámetros ni credenciales)' };
	}
	const local = HOST_LOCAL.test(u.hostname);
	if (u.protocol === 'https:') {
		if (local) return { activo: false, motivo: 'PUBLIC_ASISTENTE_URL local tiene que ser http://localhost' };
	} else if (u.protocol === 'http:') {
		if (!local) return { activo: false, motivo: 'PUBLIC_ASISTENTE_URL tiene que ser https (http solo para localhost)' };
	} else {
		return { activo: false, motivo: 'PUBLIC_ASISTENTE_URL tiene que ser https' };
	}
	if (local && produccion) return { activo: false, motivo: 'un build de producción no puede apuntar a un Worker local (modo de prueba)' };

	const clave = (env.PUBLIC_TURNSTILE_SITEKEY ?? '').trim();
	if (clave !== '' && !SITEKEY.test(clave)) return { activo: false, motivo: 'PUBLIC_TURNSTILE_SITEKEY no tiene la forma de una sitekey' };
	if (produccion && esSitekeyDePrueba(clave)) return { activo: false, motivo: 'PUBLIC_TURNSTILE_SITEKEY es una clave de prueba de Cloudflare: no vale en producción' };
	if (!local && clave === '') return { activo: false, motivo: 'falta PUBLIC_TURNSTILE_SITEKEY' };

	return { activo: true, urlApi: u.origin, sitekey: clave === '' ? null : clave, modoPrueba: local };
}
