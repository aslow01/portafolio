// Las direcciones de la v4 que siguen existiendo solo como puerta hacia la portada: el
// CV, LinkedIn y los buscadores todavía pueden apuntar a ellas. Cada una es una página de `src/pages/` que usa
// `v5/Redireccion.astro`, con `noindex`, y queda fuera del sitemap (astro.config.mjs filtra con `esRedireccion`).
// Pura, sin Astro: se prueba con `npm test` (scripts/redirecciones.test.mjs).
import type { IdFicha } from '../v5/datos.ts';

export interface Redireccion {
	/** Ruta vieja, con barra inicial y final. */
	desde: string;
	/** Ficha de la portada a la que lleva: la dirección nueva es `/#<ficha>`. */
	ficha: IdFicha;
}

export const redirecciones: readonly Redireccion[] = [
	{ desde: '/logistica/', ficha: 'logistica' },
	{ desde: '/demos/', ficha: 'demos' },
	{ desde: '/contacto/', ficha: 'contacto' },
	{ desde: '/proyectos/', ficha: 'proyectos' },
];

/** `ruta` puede ser la ruta (`/demos/`, con o sin barra final) o la URL completa. */
export function esRedireccion(ruta: string): boolean {
	const { pathname } = new URL(ruta, 'https://sitio.invalido');
	const normal = pathname.endsWith('/') ? pathname : `${pathname}/`;
	return redirecciones.some((r) => r.desde === normal);
}
