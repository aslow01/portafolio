// Visibilidad del contenido (pura, sin Astro): se prueba con `npm test`.
//
// En `npm run dev` se ve todo; en `npm run build` solo sale lo que no está marcado como
// borrador (`estado: borrador` en casos, o `borrador: true` en cualquier colección). Toda página
// que lista, enlaza o referencia contenido pasa por estas funciones, nunca por su propio filtro.

interface Dato {
	estado?: string;
	borrador?: boolean;
}

/** Vite reemplaza `import.meta.env` al compilar; en Node puro (tests) no existe y rige producción. */
const enDesarrollo = import.meta.env?.DEV === true;

/**
 * Filtro de borradores, para getCollection:
 *   getCollection('casos', ({ data }) => esPublicable(data))
 * El segundo parámetro existe para probarlo; en el sitio no se pasa.
 */
export function esPublicable(data: Dato, dev: boolean = enDesarrollo): boolean {
	if (dev) return true;
	return data.estado !== 'borrador' && data.borrador !== true;
}

/** Un proyecto se muestra (lista, página y enlace del pie) si es publicable y no está "en preparación". */
export function proyectoVisible(data: Dato, dev: boolean = enDesarrollo): boolean {
	return esPublicable(data, dev) && data.estado !== 'en-preparacion';
}

/**
 * Para las referencias entre colecciones (`getEntry(caso.data.demo)`): `getEntry` no pasa por el
 * filtro de `getCollection`, así que un borrador referenciado se colaría. Devuelve `undefined`
 * si la entrada no es publicable.
 */
export function soloPublicable<T extends { data: Dato }>(entrada: T | undefined, dev: boolean = enDesarrollo): T | undefined {
	return entrada && esPublicable(entrada.data, dev) ? entrada : undefined;
}

/** Una demo se muestra (portada, técnico y /demos/) si es publicable y está en vivo o en desarrollo; en preparación no. */
export function demoVisible(data: Dato, dev: boolean = enDesarrollo): boolean {
	return esPublicable(data, dev) && (data.estado === 'en-vivo' || data.estado === 'en-desarrollo');
}
