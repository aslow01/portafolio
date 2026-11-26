// Lector mínimo del encabezado (frontmatter) de los .md de src/content, para verificar-borradores.
// Solo necesita saber de `estado`, `borrador` y `titulo`; ante algo que no entiende, lo avisa en
// `problemas` en vez de suponer (una guardia de seguridad que falla en silencio no sirve).

const ESTADOS = ['borrador', 'publicado', 'en-preparacion', 'en-desarrollo', 'en-vivo', 'terminado'];

/** Saca un comentario final (` # …`) que no esté dentro de comillas. */
function sinComentario(valor) {
	let comilla = null;
	for (let i = 0; i < valor.length; i++) {
		const c = valor[i];
		if (comilla) {
			if (c === comilla) comilla = null;
		} else if (c === '"' || c === "'") {
			comilla = c;
		} else if (c === '#' && (i === 0 || /\s/.test(valor[i - 1]))) {
			return valor.slice(0, i);
		}
	}
	return valor;
}

/** @returns {{ datos: Record<string, string>, problemas: string[] }} */
export function leerFrontmatter(texto) {
	const datos = {};
	const problemas = [];
	const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!m) return { datos, problemas: ['no tiene encabezado (--- … ---)'] };
	for (const linea of m[1].split(/\r?\n/)) {
		if (linea.trim() === '' || /^\s*#/.test(linea)) continue;
		if (/^\s/.test(linea)) continue; // sangría: pertenece a un valor anidado
		const kv = linea.match(/^([\w-]+):(?:\s+(.*))?$/);
		if (!kv) {
			problemas.push(`línea que no se entiende: "${linea.trim()}"`);
			continue;
		}
		datos[kv[1]] = sinComentario(kv[2] ?? '').trim().replace(/^["']|["']$/g, '');
	}
	if ('estado' in datos && !ESTADOS.includes(datos.estado)) {
		problemas.push(`estado con un valor que no se entiende: "${datos.estado}"`);
	}
	if ('borrador' in datos && !['true', 'false'].includes(datos.borrador)) {
		problemas.push(`borrador con un valor que no se entiende: "${datos.borrador}" (debe ser true o false)`);
	}
	return { datos, problemas };
}

export function esBorrador(datos) {
	return datos.estado === 'borrador' || datos.borrador === 'true';
}

/**
 * Lee el bloque `prueba:` de una demo (extracto de una prueba, 6.10): `archivo`, `desde`, `hasta`,
 * `codigo` (bloque literal `|`), `autoria` y, opcional, `commit`. Solo entiende esa forma; si falta algo o viene de
 * otra manera, lo avisa en `problemas` en vez de suponer. Sin bloque `prueba:` no hay prueba.
 * @returns {{ prueba: undefined | { archivo: string, desde: number, hasta: number, codigo: string, autoria: string, commit?: string }, problemas: string[] }}
 */
export function leerPrueba(texto) {
	const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!m) return { prueba: undefined, problemas: ['no tiene encabezado (--- … ---)'] };
	const lineas = m[1].split(/\r?\n/);
	const inicio = lineas.findIndex((l) => /^prueba:\s*(#.*)?$/.test(l));
	if (inicio === -1) return { prueba: undefined, problemas: [] };

	// El bloque son las líneas siguientes con sangría (o vacías) hasta la próxima clave sin sangría.
	const bloque = [];
	for (const l of lineas.slice(inicio + 1)) {
		if (l.trim() !== '' && !/^\s/.test(l)) break;
		bloque.push(l);
	}

	const problemas = [];
	const campos = {};
	for (let i = 0; i < bloque.length; i++) {
		const kv = bloque[i].match(/^ {2}(\w+):(?:\s+(.*))?$/);
		if (!kv) continue;
		const [, clave, valor = ''] = kv;
		if (clave === 'codigo') {
			if (valor.trim() !== '|') {
				problemas.push('prueba.codigo tiene que ser un bloque literal ("codigo: |")');
				continue;
			}
			// Como YAML: la sangría de todo el bloque la fija su primera línea con texto (más que la de la clave).
			const resto = bloque.slice(i + 1);
			const primera = resto.find((l) => l.trim() !== '');
			const sangria = primera ? primera.length - primera.trimStart().length : 0;
			if (!primera || sangria <= 2 || primera.startsWith('	')) {
				problemas.push('prueba.codigo no tiene líneas de código con sangría');
				continue;
			}
			const filas = [];
			for (const l of resto) {
				if (l.trim() === '') filas.push('');
				else if (l.startsWith(' '.repeat(sangria))) filas.push(l.slice(sangria));
				else if (/^ {2}\w+:/.test(l)) break; // la próxima clave de `prueba`
				else {
					problemas.push(`prueba.codigo: la línea "${l.trim()}" tiene menos sangría (o una tabulación) que el resto del bloque; no se puede leer sin cortar el código`);
					break;
				}
			}
			while (filas.length && filas[filas.length - 1] === '') filas.pop();
			campos.codigo = filas.join('\n');
		} else {
			campos[clave] = sinComentario(valor).trim().replace(/^["']|["']$/g, '');
		}
	}

	for (const c of ['archivo', 'desde', 'hasta', 'codigo', 'autoria']) {
		if (!campos[c]) problemas.push(`prueba.${c} falta o está vacío`);
	}
	if (campos.commit !== undefined && !/^[0-9a-f]{7,40}$/.test(campos.commit)) {
		problemas.push(`prueba.commit no es un hash de git (7 a 40 caracteres hexadecimales): "${campos.commit}"`);
	}
	const desde = Number(campos.desde);
	const hasta = Number(campos.hasta);
	if (campos.desde && !Number.isInteger(desde)) problemas.push(`prueba.desde no es un número entero: "${campos.desde}"`);
	if (campos.hasta && !Number.isInteger(hasta)) problemas.push(`prueba.hasta no es un número entero: "${campos.hasta}"`);
	if (problemas.length) return { prueba: undefined, problemas };
	const prueba = { archivo: campos.archivo, desde, hasta, codigo: campos.codigo, autoria: campos.autoria };
	return { prueba: campos.commit ? { ...prueba, commit: campos.commit } : prueba, problemas };
}

/**
 * Lee un objeto de un nivel del encabezado (`resultado:` y sus líneas con sangría de dos espacios) como `{ clave: texto }`.
 * Sin el bloque, o sin encabezado, devuelve `{}`. Solo entiende valores simples (con o sin comillas): no es un lector de YAML.
 * @returns {Record<string, string>}
 */
export function leerBloque(texto, clave) {
	const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!m) return {};
	const lineas = m[1].split(/\r?\n/);
	const inicio = lineas.findIndex((l) => l.trimEnd() === `${clave}:`);
	if (inicio === -1) return {};
	const datos = {};
	for (const l of lineas.slice(inicio + 1)) {
		if (l.trim() !== '' && !/^\s/.test(l)) break;
		const kv = l.match(/^ {2}([\w-]+):(?:\s+(.*))?$/);
		if (kv) datos[kv[1]] = sinComentario(kv[2] ?? '').trim().replace(/^["']|["']$/g, '');
	}
	return datos;
}
