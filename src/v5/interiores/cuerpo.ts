// Lector mínimo del Markdown de un caso y partición en páginas (molde «Expediente»).
//
// Por qué no se usa el HTML que genera Astro: el molde reparte el texto en páginas (una por `##`, y secciones largas en
// dos), y eso no se puede hacer sobre un único bloque ya renderizado. Acá se lee el Markdown del caso en un árbol chico
// (párrafos, listas, negrita, cursiva, código y enlaces) y la plantilla lo dibuja con las etiquetas de siempre
// (`p`, `ul > li`, `strong`), de modo que todo el texto sale escapado por Astro y no hay HTML inyectado.
//
// Lo que este lector no entiende (títulos de otro nivel, listas numeradas, citas, tablas, HTML, listas anidadas) falla
// con un mensaje que dice la línea: es preferible romper el build a publicar una página mal armada.
// Sin dependencias ni Astro: se prueba con `npm test` (scripts/caso-cuerpo.test.mjs).

export type Inline =
	| { t: 'txt'; s: string }
	| { t: 'code'; s: string }
	| { t: 'strong'; hijos: Inline[] }
	| { t: 'em'; hijos: Inline[] }
	| { t: 'a'; href: string; hijos: Inline[] };

export type Bloque = { t: 'p'; hijos: Inline[] } | { t: 'ul'; items: Inline[][] };

export interface Seccion {
	titulo: string;
	/** Una tanda por cada `<!-- página -->` (cortes puestos a mano). Sin cortes, una sola tanda. */
	tandas: Bloque[][];
}

const MARCA_PAGINA = /^<!--\s*p[aá]gina\s*-->$/i;

/** Comillas, apóstrofos y puntos suspensivos tipográficos (lo mismo que hace Astro con el Markdown). */
function tipografia(t: string): string {
	return t
		.replace(/"/g, (_m, i: number) => {
			const previo = i > 0 ? t[i - 1] : '';
			return previo === '' || /[\s([{*¿¡—–-]/.test(previo) ? '“' : '”';
		})
		.replace(/(\p{L})'(\p{L})/gu, '$1’$2')
		.replace(/\.\.\./g, '…');
}

/** Texto en línea: `**negrita**`, `*cursiva*`, `` `código` `` y `[texto](destino)`. */
export function leerInline(origen: string, dondeFalla = 'el texto'): Inline[] {
	const salida: Inline[] = [];
	let tramo = '';
	const vaciar = (): void => {
		if (tramo !== '') salida.push({ t: 'txt', s: tramo });
		tramo = '';
	};
	let i = 0;
	while (i < origen.length) {
		const c = origen[i];
		if (c === '\\' && i + 1 < origen.length) {
			tramo += origen[i + 1];
			i += 2;
			continue;
		}
		if (origen.startsWith('**', i)) {
			const fin = origen.indexOf('**', i + 2);
			if (fin > i + 2) {
				vaciar();
				salida.push({ t: 'strong', hijos: leerInline(origen.slice(i + 2, fin), dondeFalla) });
				i = fin + 2;
				continue;
			}
			throw new Error(`${dondeFalla}: negrita sin cerrar («**»).`);
		}
		if (c === '`') {
			const fin = origen.indexOf('`', i + 1);
			if (fin > i + 1) {
				vaciar();
				salida.push({ t: 'code', s: origen.slice(i + 1, fin) });
				i = fin + 1;
				continue;
			}
		}
		if (c === '*' && origen[i + 1] !== undefined && !/\s/.test(origen[i + 1])) {
			const fin = origen.indexOf('*', i + 1);
			if (fin > i + 1 && !/\s/.test(origen[fin - 1])) {
				vaciar();
				salida.push({ t: 'em', hijos: leerInline(origen.slice(i + 1, fin), dondeFalla) });
				i = fin + 1;
				continue;
			}
		}
		if (c === '[') {
			const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(origen.slice(i));
			if (m) {
				const destino = m[2];
				if (!/^(\/|#|https:\/\/|mailto:)/.test(destino)) {
					throw new Error(`${dondeFalla}: el enlace «${destino}» no es absoluto (empiece con /, #, https:// o mailto:).`);
				}
				vaciar();
				salida.push({ t: 'a', href: destino, hijos: leerInline(m[1], dondeFalla) });
				i += m[0].length;
				continue;
			}
		}
		tramo += c;
		i += 1;
	}
	vaciar();
	return salida;
}

const inline = (texto: string, linea: number): Inline[] => leerInline(tipografia(texto), `Línea ${linea}`);

const NO_ENTENDIDO: [RegExp, string][] = [
	[/^#{1}\s|^#{3,}\s/, 'solo se usan títulos de nivel 2 (##)'],
	[/^>/, 'las citas no están soportadas'],
	[/^\d+[.)]\s/, 'las listas numeradas no están soportadas'],
	[/^```|^~~~/, 'los bloques de código no están soportados'],
	[/^\|/, 'las tablas no están soportadas'],
	[/^!\[/, 'las imágenes no están soportadas'],
	[/^<(?!!--)/, 'el HTML no está soportado'],
];

/** Lee el Markdown de un caso: una `Seccion` por cada `## Título`. */
export function leerCuerpo(markdown: string): Seccion[] {
	const lineas = markdown.replace(/\r\n?/g, '\n').split('\n');
	const secciones: Seccion[] = [];
	let actual: Seccion | null = null;
	let tanda: Bloque[] = [];
	let parrafo: { texto: string; linea: number } | null = null;
	let lista: { items: { texto: string; linea: number }[] } | null = null;

	const cerrarParrafo = (): void => {
		if (parrafo) tanda.push({ t: 'p', hijos: inline(parrafo.texto, parrafo.linea) });
		parrafo = null;
	};
	const cerrarLista = (): void => {
		if (lista) tanda.push({ t: 'ul', items: lista.items.map((it) => inline(it.texto, it.linea)) });
		lista = null;
	};
	const cerrarBloque = (): void => {
		cerrarParrafo();
		cerrarLista();
	};
	const cerrarTanda = (): void => {
		cerrarBloque();
		if (actual) actual.tandas.push(tanda);
		tanda = [];
	};

	lineas.forEach((cruda, n) => {
		const nro = n + 1;
		const t = cruda.trim();
		if (t === '') {
			cerrarBloque();
			return;
		}
		const titulo = /^##\s+(.+)$/.exec(t);
		if (titulo) {
			cerrarTanda();
			actual = { titulo: tipografia(titulo[1].trim()), tandas: [] };
			secciones.push(actual);
			return;
		}
		if (MARCA_PAGINA.test(t)) {
			if (!actual) throw new Error(`Línea ${nro}: «<!-- página -->» antes del primer «##».`);
			cerrarBloque();
			if (tanda.length > 0) {
				actual.tandas.push(tanda);
				tanda = [];
			}
			return;
		}
		for (const [re, motivo] of NO_ENTENDIDO) {
			if (re.test(t)) throw new Error(`Línea ${nro}: ${motivo} («${t.slice(0, 40)}»).`);
		}
		if (!actual) throw new Error(`Línea ${nro}: hay texto antes del primer «##» («${t.slice(0, 40)}»).`);
		const item = /^[-*]\s+(.*)$/.exec(t);
		if (item && !/^\s/.test(cruda)) {
			cerrarParrafo();
			lista ??= { items: [] };
			lista.items.push({ texto: item[1], linea: nro });
			return;
		}
		if (/^\s+[-*]\s/.test(cruda) && lista) throw new Error(`Línea ${nro}: las listas anidadas no están soportadas.`);
		if (lista && /^\s/.test(cruda)) {
			// Renglón de continuación de un ítem
			lista.items[lista.items.length - 1].texto += ` ${t}`;
			return;
		}
		cerrarLista();
		parrafo = parrafo ? { texto: `${parrafo.texto} ${t}`, linea: parrafo.linea } : { texto: t, linea: nro };
	});
	cerrarTanda();
	return secciones;
}

// ---------- Partición en páginas ----------

/** Peso máximo de una página de lectura (caracteres más lo que ocupa cada título e ítem). Calibrado midiendo en
 *  390 × 844 y 360 × 740. */
export const PRESUPUESTO = 900;
const PESO_PARRAFO = 40;
const PESO_ITEM = 70;

const largo = (hijos: Inline[]): number => hijos.reduce((suma, x) => suma + ('s' in x ? x.s.length : largo(x.hijos)), 0);

/** Cantidad de caracteres de un bloque. */
export const largoBloque = (b: Bloque): number => (b.t === 'p' ? largo(b.hijos) : b.items.reduce((suma, it) => suma + largo(it), 0));

interface Unidad {
	bloque: number;
	item: number;
	peso: number;
	/** Un párrafo que termina en «:» presenta lo que sigue: no se lo deja solo al pie de una página. */
	presenta: boolean;
}

function unidades(bloques: Bloque[]): Unidad[] {
	const u: Unidad[] = [];
	bloques.forEach((b, bloque) => {
		if (b.t === 'p') u.push({ bloque, item: -1, peso: largo(b.hijos) + PESO_PARRAFO, presenta: /:\s*$/.test(textoPlano(b.hijos)) });
		else b.items.forEach((it, item) => u.push({ bloque, item, peso: largo(it) + PESO_ITEM, presenta: false }));
	});
	return u;
}

function textoPlano(hijos: Inline[]): string {
	return hijos.map((x) => ('s' in x ? x.s : textoPlano(x.hijos))).join('');
}

/** Reparte `pesos` en `n` grupos contiguos minimizando el grupo más pesado; `puedeCortar[k]` dice si se puede cortar
 *  después de la unidad k. Devuelve los índices (exclusivos) donde termina cada grupo, o null si no hay forma. */
function repartir(pesos: number[], puedeCortar: boolean[], n: number): { fines: number[]; maximo: number } | null {
	const u = pesos.length;
	const suma = [0];
	for (const p of pesos) suma.push(suma[suma.length - 1] + p);
	const INF = Number.POSITIVE_INFINITY;
	// mejor[g][k]: menor máximo repartiendo las primeras k unidades en g grupos
	const mejor: number[][] = Array.from({ length: n + 1 }, () => Array<number>(u + 1).fill(INF));
	const desde: number[][] = Array.from({ length: n + 1 }, () => Array<number>(u + 1).fill(-1));
	mejor[0][0] = 0;
	for (let g = 1; g <= n; g++) {
		for (let k = g; k <= u; k++) {
			for (let j = g - 1; j < k; j++) {
				if (j > 0 && !puedeCortar[j - 1]) continue;
				const m = Math.max(mejor[g - 1][j], suma[k] - suma[j]);
				if (m < mejor[g][k]) {
					mejor[g][k] = m;
					desde[g][k] = j;
				}
			}
		}
	}
	if (!Number.isFinite(mejor[n][u])) return null;
	const fines: number[] = [];
	let k = u;
	for (let g = n; g >= 1; g--) {
		fines.unshift(k);
		k = desde[g][k];
	}
	return { fines, maximo: mejor[n][u] };
}

/**
 * Parte los bloques de una sección en las páginas que hagan falta para que cada una entre en la pantalla, sin cortar
 * un ítem ni un párrafo. Una sección que entra en una página queda como está. Reparte parejo (no llena una página y
 * deja la otra casi vacía). Un cortado puesto a mano (`<!-- página -->`) manda sobre este reparto.
 */
export function paginar(bloques: Bloque[], presupuesto: number = PRESUPUESTO): Bloque[][] {
	const u = unidades(bloques);
	const total = u.reduce((s, x) => s + x.peso, 0);
	if (u.length <= 1 || total <= presupuesto) return [bloques];
	const puedeCortar = u.map((x) => !x.presenta);
	const pesos = u.map((x) => x.peso);
	const masPesada = Math.max(...pesos);
	let reparto: { fines: number[]; maximo: number } | null = null;
	for (let n = Math.max(2, Math.ceil(total / presupuesto)); n <= u.length; n++) {
		const r = repartir(pesos, puedeCortar, n);
		if (!r) continue;
		reparto = r;
		// Listo si entra en el presupuesto, o si ya no se puede bajar más (una unidad sola pesa más que el presupuesto)
		if (r.maximo <= presupuesto || r.maximo <= masPesada) break;
	}
	if (!reparto) return [bloques];
	const paginas: Bloque[][] = [];
	let inicio = 0;
	for (const fin of reparto.fines) {
		const pagina: Bloque[] = [];
		for (const x of u.slice(inicio, fin)) {
			const origen = bloques[x.bloque];
			if (origen.t === 'p') pagina.push(origen);
			else {
				const ultimo = pagina[pagina.length - 1];
				if (ultimo && ultimo.t === 'ul') ultimo.items.push(origen.items[x.item]);
				else pagina.push({ t: 'ul', items: [origen.items[x.item]] });
			}
		}
		paginas.push(pagina);
		inicio = fin;
	}
	return paginas;
}

/** Las páginas de una sección: los cortes puestos a mano, o el reparto automático si no hay ninguno. */
export function paginasDeSeccion(s: Seccion, presupuesto: number = PRESUPUESTO): Bloque[][] {
	const tandas = s.tandas.filter((t) => t.length > 0);
	if (tandas.length === 0) return [[]];
	if (tandas.length > 1) return tandas;
	return paginar(tandas[0], presupuesto);
}
