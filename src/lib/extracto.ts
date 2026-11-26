// Comparación del extracto de prueba de una demo contra el archivo real de su repositorio (pura, sin
// Astro ni sistema de archivos): se prueba con `npm test`. El extracto de la web tiene que ser literal.

const aLineas = (texto: string): string[] => texto.replace(/\r\n?/g, '\n').split('\n');

/** Líneas `desde`–`hasta` (1 a n, ambas incluidas). Un rango que no existe en el archivo es un error. */
export function extraerLineas(texto: string, desde: number, hasta: number): string[] {
	// Un fin de línea final no abre una línea más.
	const lineas = aLineas(texto.endsWith('\n') ? texto.slice(0, -1) : texto);
	if (!Number.isInteger(desde) || !Number.isInteger(hasta) || desde < 1 || hasta < desde || hasta > lineas.length) {
		throw new RangeError(`el rango ${desde}–${hasta} no existe: el archivo tiene ${lineas.length} líneas`);
	}
	return lineas.slice(desde - 1, hasta);
}

const sangria = (l: string): number => l.length - l.trimStart().length;

/** Quita la sangría que comparten todas las líneas con texto (las vacías no cuentan). */
export function sinSangriaComun(lineas: string[]): string[] {
	const conTexto = lineas.filter((l) => l.trim() !== '');
	const comun = conTexto.length ? Math.min(...conTexto.map(sangria)) : 0;
	return lineas.map((l) => l.slice(Math.min(comun, sangria(l))));
}

/** Sin fin de línea de Windows, sin espacios al final de cada línea y sin renglones vacíos al final. */
function normalizar(lineas: string[]): string[] {
	const l = lineas.map((x) => x.trimEnd());
	while (l.length && l[l.length - 1] === '') l.pop();
	return l;
}

export type Comparacion = { coincide: true } | { coincide: false; detalle: string };

/**
 * ¿El `codigo` del contenido es el texto de las líneas `desde`–`hasta` del archivo? Se ignoran
 * solo el fin de línea, los espacios finales y la sangría común; cualquier otra diferencia falla
 * y se dice cuál es la primera.
 */
export function compararExtracto(
	archivo: string,
	extracto: { desde: number; hasta: number; codigo: string },
): Comparacion {
	// Un extracto en blanco no es un extracto: coincidiría con cualquier rango de líneas vacías.
	const escritas = normalizar(sinSangriaComun(aLineas(extracto.codigo)));
	if (escritas.length === 0) return { coincide: false, detalle: 'el extracto está vacío (solo espacios o tabulaciones)' };
	let reales: string[];
	try {
		reales = normalizar(sinSangriaComun(extraerLineas(archivo, extracto.desde, extracto.hasta)));
	} catch (e) {
		return { coincide: false, detalle: e instanceof Error ? e.message : String(e) };
	}
	const n = Math.max(reales.length, escritas.length);
	for (let i = 0; i < n; i++) {
		if (reales[i] !== escritas[i]) {
			return {
				coincide: false,
				detalle: `la línea ${extracto.desde + i} del archivo dice ${JSON.stringify(reales[i] ?? '(no hay línea)')} y el contenido dice ${JSON.stringify(escritas[i] ?? '(no hay línea)')}`,
			};
		}
	}
	return { coincide: true };
}
