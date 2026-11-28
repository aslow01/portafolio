// Enlaces que el widget acepta dibujar. El texto que devuelve el modelo es dato hostil: un destino vale solo si cumple
// UNA de estas reglas exactas (docs-asistente/03, sección 9.3). Lo demás se muestra como texto, sin enlace.
// Puro, sin DOM.

export interface ReglasEnlaces {
	/** `lib/sitio.ts`: el único correo al que se puede enlazar. */
	correo: string;
	/** `lib/sitio.ts`: el único LinkedIn. */
	linkedin: string;
	/** Rutas de los CV en PDF publicados (`lib/datos-pendientes.ts`). */
	cvs: readonly string[];
	/**
	 * Los `slug` de los casos publicados (los que genera el build). Con la lista, un `/casos/<slug>/` que no figura se muestra como
	 * texto: el modelo no puede mandar al visitante a un 404 con un nombre inventado. Sin ella (solo pruebas), vale cualquier forma válida.
	 */
	casos?: readonly string[] | undefined;
}

export interface EnlaceValido {
	href: string;
	/** Otro origen: se abre con `rel="noopener noreferrer"`. */
	externo: boolean;
}

const RUTAS_FIJAS = new Set([
	'/casos/',
	'/#contacto',
	'/#demos',
	'/#proyectos',
	'/#tecnico',
	'/#logistica',
	'/demos/',
	'/proyectos/',
	'/tecnico/',
	'/logistica/',
	'/contacto/',
]);
/** La ruta sin el prefijo del idioma: `/en/casos/` → `/casos/`. */
export const sinPrefijoEn = (href: string): string => (href.startsWith('/en/') ? href.slice(3) : href);
const CASO = /^\/casos\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/;

const HOSTS_DEMO = new Set(['facturas.matiasormeno.com.ar', 'flota.matiasormeno.com.ar', 'tablero.matiasormeno.com.ar']);
const REPOS = new Set(['demo-lector-facturas', 'demo-control-flota', 'demo-tablero-gestion', 'portafolio']);

/** Nada de espacios, controles ni barras invertidas: eso nunca es un destino que el sitio escribiría. */
const SOSPECHOSO = /[\s\u0000-\u001f\u007f\\]/;
const MAX_LARGO = 300;

function comoUrl(texto: string): URL | null {
	try {
		return new URL(texto);
	} catch {
		return null;
	}
}

/** `null` si el destino no está permitido. El `href` devuelto es el canónico (sin barra final en los hosts de las demos). */
export function enlacePermitido(destino: string, reglas: ReglasEnlaces): EnlaceValido | null {
	if (typeof destino !== 'string' || destino === '' || destino.length > MAX_LARGO || SOSPECHOSO.test(destino)) return null;

	// Rutas internas del sitio.
	if (destino.startsWith('/')) {
		if (destino.startsWith('//')) return null;
		if (reglas.cvs.includes(destino)) return { href: destino, externo: false };
		// La versión en inglés vive bajo `/en/` con las mismas páginas: se valida la ruta sin el prefijo (una sola vez) y se devuelve tal cual.
		const neutra = destino.startsWith('/en/') ? destino.slice(3) : destino;
		if (RUTAS_FIJAS.has(neutra)) return { href: destino, externo: false };
		const caso = CASO.exec(neutra);
		if (caso && (reglas.casos === undefined || reglas.casos.includes(caso[1]))) return { href: destino, externo: false };
		return null;
	}

	// Correo: solo el publicado y sin parámetros (el `mailto:` con asunto lo arma el widget, no el modelo).
	if (destino === `mailto:${reglas.correo}`) return { href: destino, externo: false };

	// Direcciones https: solo las propias.
	if (!destino.toLowerCase().startsWith('https://')) return null;
	const u = comoUrl(destino);
	if (!u || u.protocol !== 'https:' || u.username !== '' || u.password !== '' || u.port !== '') return null;

	if (HOSTS_DEMO.has(u.hostname)) {
		if (u.pathname !== '/' || u.search !== '' || u.hash !== '') return null;
		return { href: `https://${u.hostname}`, externo: true };
	}
	if (u.hostname === 'github.com') {
		const m = /^\/aslow01\/([a-z0-9-]+)\/?$/.exec(u.pathname);
		if (!m || !REPOS.has(m[1]) || u.search !== '' || u.hash !== '') return null;
		return { href: `https://github.com/aslow01/${m[1]}`, externo: true };
	}
	const propio = comoUrl(reglas.linkedin);
	if (propio && u.href === propio.href) return { href: reglas.linkedin, externo: true };
	return null;
}
