// Idiomas del sitio y reglas de direcciones (puro, sin Astro: se prueba con `npm test`, scripts/i18n.test.mjs).
// El español es el idioma por defecto y vive en `/`; el inglés vive bajo `/en/`. La i18n nativa de Astro
// (astro.config.mjs) reparte las páginas; acá están el tipo, el traductor de a pares y las funciones de direcciones.

export type Idioma = 'es' | 'en';
export const idiomas: readonly Idioma[] = ['es', 'en'];
export const idiomaPorDefecto: Idioma = 'es';

/** Código para `lang`, `hreflang` y el sitemap. */
export const codigoLang: Record<Idioma, string> = { es: 'es-AR', en: 'en' };
/** Código de `og:locale`. */
export const codigoOg: Record<Idioma, string> = { es: 'es_AR', en: 'en_US' };

/** El idioma de `Astro.currentLocale` (o de un `lang`): `en` si empieza con «en»; cualquier otra cosa, español. */
export function idiomaDe(locale: string | undefined): Idioma {
	return typeof locale === 'string' && /^en(-|_|$)/i.test(locale) ? 'en' : 'es';
}

/**
 * Traductor de a pares: `const t = traductor(idioma); t('Cerrar', 'Close')`. El español queda al lado del inglés, así
 * quien cambia una frase ve la otra. Los dos textos son obligatorios: no hay respaldo silencioso.
 */
export function traductor(idioma: Idioma): <T extends string>(es: T, en: T) => T {
	return (es, en) => (idioma === 'en' ? en : es);
}

/** La dirección de una ruta del sitio en un idioma: `/tecnico/` → `/en/tecnico/`; `/` → `/en/`; el español no cambia. Conserva `#` y `?`. */
export function rutaDe(idioma: Idioma, ruta: string): string {
	if (!ruta.startsWith('/')) throw new Error(`La ruta tiene que empezar con «/»: ${ruta}`);
	const base = quitarPrefijo(ruta);
	return idioma === 'en' ? `/en${base === '/' ? '/' : base}` : base;
}

/** Una ruta sin el prefijo `/en` (si lo tiene): la ruta «neutra» que comparten los dos idiomas. */
export function quitarPrefijo(ruta: string): string {
	const m = /^\/en(?=\/|#|\?|$)(.*)$/.exec(ruta);
	if (!m) return ruta;
	return m[1] === '' || m[1].startsWith('#') || m[1].startsWith('?') ? `/${m[1]}` : m[1];
}

/** El idioma de una ruta (`/en/...` es inglés). */
export function idiomaDeRuta(ruta: string): Idioma {
	return quitarPrefijo(ruta) === ruta ? 'es' : 'en';
}

/** La misma página en el otro idioma (para el selector): `/en/casos/x/` → `/casos/x/`. */
export function rutaAlterna(ruta: string, destino: Idioma): string {
	return rutaDe(destino, quitarPrefijo(ruta));
}

/** Direcciones absolutas de una página en cada idioma (para `hreflang`): sin barra de más. */
export function alternas(ruta: string, sitio: string | URL): Record<Idioma, string> {
	const base = new URL(sitio);
	const url = (i: Idioma): string => new URL(rutaAlterna(ruta, i), base).href;
	return { es: url('es'), en: url('en') };
}
