// Dos decisiones chicas del script de las fichas (src/scripts/v5/pestanas.ts) que se pueden probar sin navegador.
// Puras, sin Astro: se prueban con `npm test` (scripts/paginas.test.mjs).

/**
 * La posición (0 a n-1) de la página de una ficha cuyo `id` coincide con el hash de la dirección (`#el-caso`), o -1 si
 * el hash está vacío, no se puede leer o no es de ninguna página. Una página sin `id` ('') nunca coincide.
 */
export function paginaDelHash(hash: string, ids: readonly string[]): number {
	let id = hash.replace(/^#/, '');
	if (id === '') return -1;
	try {
		id = decodeURIComponent(id);
	} catch {
		return -1;
	}
	return ids.indexOf(id);
}

/** Una imagen que ya terminó de cargar y quedó sin nada que mostrar: la foto no está o no se pudo leer. */
export function imagenRota(img: { complete: boolean; naturalWidth: number }): boolean {
	return img.complete && img.naturalWidth === 0;
}

/**
 * El título del documento de una página: «<título> | <nombre del sitio>». Si el título ya empieza con el nombre (la portada)
 * queda tal cual. Lo usa BaseV5 para todas las páginas y el script de las fichas al abrir una (el título sigue a la ficha).
 */
export function tituloConNombre(titulo: string, nombreSitio: string): string {
	return titulo.startsWith(nombreSitio) ? titulo : `${titulo} | ${nombreSitio}`;
}

/** Primer instante tras abrir una hoja en el que un clic sobre el fondo no la cierra (ms): cubre el segundo clic de un doble clic. */
export const GRACIA_FONDO_MS = 500;

/**
 * ¿Un clic sobre una hoja (<dialog>) la cierra? Solo si cayó sobre el fondo (nFondo), el toque también empezó ahí
 * (mpezoEnFondo: arrastrar desde adentro y soltar afuera no cierra) y ya pasó el primer instante desde que se abrió.
 * Sin lo último, un doble clic en el botón que la abre la abría y la cerraba: el segundo clic cae sobre el fondo.
 */
export function cierraPorFondo(clic: { enFondo: boolean; empezoEnFondo: boolean; msDesdeApertura: number }): boolean {
	return clic.enFondo && clic.empezoEnFondo && clic.msDesdeApertura >= GRACIA_FONDO_MS;
}

/**
 * La página (0 a total-1) de la ficha `ficha` que guardó la entrada del historial (history.state) cuando se salió de ella, o 0 si
 * no hay nada guardado, es de otra ficha o no es una posición válida. Así «Atrás» desde un caso vuelve a la página desde la que se salió.
 */
export function paginaGuardada(estado: unknown, ficha: string, total: number): number {
	if (typeof estado !== 'object' || estado === null) return 0;
	const { ficha: de, pagina } = estado as { ficha?: unknown; pagina?: unknown };
	if (de !== ficha || typeof pagina !== 'number' || !Number.isInteger(pagina)) return 0;
	return pagina >= 0 && pagina < total ? pagina : 0;
}

/** ¿La entrada del historial (history.state) la sumó una ficha al abrirse, y por eso «Atrás» la cierra? Sobrevive a recargar la página. */
export function fueEmpujada(estado: unknown): boolean {
	return typeof estado === 'object' && estado !== null && (estado as { empujada?: unknown }).empujada === true;
}
