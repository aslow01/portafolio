// Modelo de la página de caso «Expediente»: arma la lista de páginas a partir de los
// campos del caso y de su Markdown. Las plantillas solo dibujan lo que sale de acá. Nada de esto depende del texto de un
// caso en particular: las secciones son las que traiga el Markdown, y toda fila sin dato no se dibuja.
// Sin Astro: se prueba con `npm test` (scripts/caso-cuerpo.test.mjs).
import { cifraVisible, filasAutoria, puertaAlArchivo, type Autoria, type Camino, type Resultado } from '../../lib/contenido.ts';
import { largoBloque, leerCuerpo, paginasDeSeccion, type Bloque } from './cuerpo.ts';

export interface Cifra {
	/** Los valores anteriores («40» en «40 → 300+»), en orden. Puede estar vacío. */
	antes: string[];
	ahora: string;
	unidad?: string;
	medicion: string;
}

export interface DatosCaso {
	titulo: string;
	resumen: string;
	/** Cuántas palabras del título van en el cartel pesado (por defecto, 1). Campo opcional `corte` del caso. */
	corte?: number;
	contexto?: string;
	rol?: string;
	uso?: string;
	resultado?: Resultado;
	autoria?: Autoria;
}

export interface Solapa {
	numero?: number;
	texto: string;
	nivel: 'h2' | 'h3' | 'p';
	/** La solapa de la segunda página de una sección: «<título>, continuación». */
	continuacion: boolean;
}

export type PaginaCaso =
	| { tipo: 'hoja'; id: string; titulo: string; solapa: Solapa; bloques: Bloque[] }
	| { tipo: 'cifra'; id: string; titulo: string; encabezado: string; cifra: Cifra; parrafos: Bloque[]; uso?: string }
	| { tipo: 'autoria'; id: string; titulo: string; filas: { clave: 'yo' | 'ia'; rotulo: string; texto: string }[] }
	| { tipo: 'cierre'; id: string; titulo: string; solapa: Solapa; verificacion?: string }
	| {
			tipo: 'mas';
			id: string;
			titulo: string;
			solapa: Solapa;
			casos: { rotulo: string; titulo: string; href: string; borrador: boolean }[];
			/** La fila final que lleva al índice `/casos/`; solo si hay un índice al que ir. */
			todos?: { texto: string; total: number };
	  };

export interface FilaCaratula {
	clave: 'donde' | 'rol' | 'resultado';
	rotulo: string;
	texto?: string;
	cifra?: Cifra;
}

export interface ModeloCaso {
	titulo: { primera: string; resto: string };
	resumen: string;
	caratula: FilaCaratula[];
	paginas: PaginaCaso[];
}

/** «40 → 300+» en sus partes. */
export function partirCifra(cifra: string, unidad: string | undefined, medicion: string): Cifra {
	const partes = cifra
		.split('→')
		.map((p) => p.trim())
		.filter((p) => p !== '');
	return { antes: partes.slice(0, -1), ahora: partes[partes.length - 1] ?? cifra.trim(), unidad: unidad?.trim() || undefined, medicion: medicion.trim() };
}

/** El título en dos partes: las primeras `corte` palabras (cartel pesado) y el resto (liviano). */
export function partirTitulo(titulo: string, corte = 1): { primera: string; resto: string } {
	const palabras = titulo.trim().split(/\s+/);
	const n = Math.max(1, Math.min(palabras.length, Math.floor(corte) || 1));
	return { primera: palabras.slice(0, n).join(' '), resto: palabras.slice(n).join(' ') };
}

const sinTildes = (t: string): string => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Un identificador de ancla a partir de un título. */
export function ancla(titulo: string): string {
	return sinTildes(titulo).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'seccion';
}

// Hasta cuánto texto entra en la página azul de la cifra junto a la cifra grande (más que eso va en una hoja).
const MAX_TEXTO_CIFRA = 600;

export interface OpcionesCaso {
	/** Otros casos publicables del mismo camino (ya filtrados y ordenados; se muestran hasta tres). */
	mas?: { rotulo: string; titulo: string; href: string; borrador: boolean }[];
	/** Cuántos casos publicables hay en total (todos los caminos): con dos o más, «Más casos» cierra con la fila hacia `/casos/`. */
	totalCasos?: number;
}

const TEXTO_TODOS = 'Todos los casos de estudio';

/** Arma el modelo del caso. `cuerpo` es el Markdown sin el encabezado. */
export function armarCaso(datos: DatosCaso, cuerpo: string, opciones: OpcionesCaso = {}): ModeloCaso {
	const cifra = cifraVisible(datos.resultado);
	// Una «cifra» sin ningún dígito («Partes cargados en la app») no es una cifra: ni la carátula ni la página azul la dibujan
	// (la carátula de la tapa quedaba más alta que su pantalla; el texto ya está en el cuerpo del caso).
	const cifraModelo = cifra?.cifra && cifra.medicion && /\d/.test(cifra.cifra) ? partirCifra(cifra.cifra, cifra.unidad, cifra.medicion) : undefined;

	const caratula: FilaCaratula[] = [];
	if (datos.contexto) caratula.push({ clave: 'donde', rotulo: 'Dónde', texto: datos.contexto });
	if (datos.rol) caratula.push({ clave: 'rol', rotulo: 'Mi rol', texto: datos.rol });
	if (cifraModelo) caratula.push({ clave: 'resultado', rotulo: 'Resultado', cifra: cifraModelo });

	const usados = new Set<string>(['caso', 'tapa', 'autoria', 'verificacion', 'mas-casos', 't-h1']);
	const idUnico = (base: string): string => {
		let id = base;
		for (let k = 2; usados.has(id); k++) id = `${base}-${k}`;
		usados.add(id);
		return id;
	};

	const paginas: PaginaCaso[] = [];
	let numero = 0;
	for (const s of leerCuerpo(cuerpo)) {
		const base = ancla(s.titulo);
		const partes = paginasDeSeccion(s);
		const esResultado = sinTildes(s.titulo) === 'resultado';
		const soloParrafos = partes.length === 1 && partes[0].every((b) => b.t === 'p');
		if (esResultado && cifraModelo && soloParrafos && partes[0].reduce((n, b) => n + largoBloque(b), 0) <= MAX_TEXTO_CIFRA) {
			paginas.push({ tipo: 'cifra', id: idUnico(base), titulo: s.titulo, encabezado: s.titulo, cifra: cifraModelo, parrafos: partes[0], uso: datos.uso });
			continue;
		}
		numero += 1;
		const id = idUnico(base);
		partes.forEach((bloques, i) => {
			paginas.push({
				tipo: 'hoja',
				id: i === 0 ? id : idUnico(`${id}-${i + 1}`),
				titulo: i === 0 ? s.titulo : `${s.titulo} · ${i + 1}`,
				solapa: { numero, texto: s.titulo, nivel: i === 0 ? 'h2' : 'p', continuacion: i > 0 },
				bloques,
			});
		});
	}

	const filas = filasAutoria(datos.autoria);
	const quien = filas.filter((f): f is { clave: 'yo' | 'ia'; rotulo: string; texto: string } => f.clave === 'yo' || f.clave === 'ia');
	if (quien.length > 0) paginas.push({ tipo: 'autoria', id: 'autoria', titulo: 'Mi parte', filas: quien });

	const verificacion = filas.find((f) => f.clave === 'verif')?.texto;
	paginas.push({
		tipo: 'cierre',
		id: 'verificacion',
		titulo: verificacion ? 'Cómo lo verifiqué' : 'Para seguir',
		solapa: { texto: verificacion ? 'Cómo lo verifiqué' : 'Para seguir', nivel: 'h3', continuacion: false },
		verificacion,
	});

	const mas = (opciones.mas ?? []).slice(0, 3);
	const total = opciones.totalCasos ?? 0;
	const todos = puertaAlArchivo(total) ? { texto: TEXTO_TODOS, total } : undefined;
	if (mas.length > 0 || todos) {
		paginas.push({ tipo: 'mas', id: 'mas-casos', titulo: 'Más casos', solapa: { texto: 'Más casos', nivel: 'h2', continuacion: false }, casos: mas, ...(todos ? { todos } : {}) });
	}

	return { titulo: partirTitulo(datos.titulo, datos.corte), resumen: datos.resumen, caratula, paginas };
}

/**
 * La carpeta del caso (cinta, cortina, «Cerrar: volver a…» y CV): el primer camino que declara. Un caso de los dos
 * caminos se ordena en su frontmatter con el camino que manda primero (`caminos: [logistica, tecnico]` abre en Logística).
 */
export function carpetaDe(caminos: Camino[]): 'tecnico' | 'logistica' {
	return caminos[0];
}
