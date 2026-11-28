// Los proyectos de la web v5 (portada, ficha Proyectos y piezas propias de /tecnico/): cuáles se muestran y con qué texto
// (puro, sin Astro; se prueba con `npm test`, scripts/proyectos.test.mjs).
//
// Regla de la novela: figura siempre, con los textos fijos de lib/opciones.ts, y su entrada de `src/content/proyectos` (si
// el repositorio la tiene) no se lee: ni el título, ni el resumen, ni la sinopsis, ni la autoría. Así la copia pública
// puede no llevarla.
import { filasAutoria, type Autoria } from './contenido.ts';
import { proyectoVisible } from './estados.ts';
import { novelaDe } from './opciones.ts';
import type { Idioma } from '../i18n/idioma.ts';

export type TipoProyecto = 'novela' | 'juego' | 'otro';
/** Dónde se muestra: las cartas de Proyectos o las piezas propias del camino técnico. */
export type CaminoProyecto = 'proyectos' | 'tecnico';
/** Tamaño del título en la carta grande (`''` normal, `largo`, `mas-largo`). */
export type TamanoTitulo = '' | 'largo' | 'mas-largo';

export interface EnlaceProyecto {
	texto: string;
	url: string;
}

/** Lo que de una entrada de la colección `proyectos` necesita este módulo (el resto no se lee). */
export interface EntradaProyecto {
	id: string;
	data: {
		tipo: TipoProyecto;
		estado: string;
		titulo: string;
		resumen: string;
		orden: number;
		borrador?: boolean;
		/** Sin dato, `proyectos`. */
		camino?: CaminoProyecto;
		/** Nombre corto (solapa del paginador, rótulo de la carta de atrás). Sin dato, el título. */
		pagina?: string;
		autoria?: Autoria;
		enlaces?: EnlaceProyecto[];
	};
	body?: string;
}

/** Un proyecto listo para dibujar. */
export interface ProyectoVista {
	id: string;
	tipo: TipoProyecto;
	estado: string;
	/** El título tal como se muestra («Novela en desarrollo» si la novela va sin título). */
	titulo: string;
	/** Lo que dice la solapa del paginador y el nombre de la página. */
	pagina: string;
	/** Primera oración. */
	texto: string;
	/** Lo que sigue, en tono atenuado (puede ser ''). */
	aparte: string;
	/** `true` si el texto es el fijo de lib/opciones.ts y no el de una entrada. */
	sinTitulo: boolean;
	orden: number;
	/** Las filas de «Quién hizo qué» con texto, en orden yo / ia / verif. Sin ninguna, no se dibuja la carta de atrás. */
	filas: ReturnType<typeof filasAutoria>;
	/** Enlaces externos de la pieza (vacío hasta que exista el repositorio). */
	enlaces: EnlaceProyecto[];
	tamanoTitulo: TamanoTitulo;
}

/**
 * Tamaño del título en la carta grande: `mas-largo` si alguna palabra tiene 11 letras o más; si no, `largo` si el título
 * pasa de 12 caracteres o tiene una palabra de 10 letras; si no, `''`.
 */
export function tamanoTitulo(titulo: string): TamanoTitulo {
	const palabraMasLarga = Math.max(0, ...(titulo.match(/\p{L}+/gu) ?? []).map((p) => p.length));
	if (palabraMasLarga >= 11) return 'mas-largo';
	if (titulo.length > 12 || palabraMasLarga === 10) return 'largo';
	return '';
}

const caminoDe = (e: EntradaProyecto): CaminoProyecto => e.data.camino ?? 'proyectos';

/** ¿Entra una entrada en Proyectos? Lo publicable, no «en preparación» y de ese camino; la novela nunca (sale de lib/opciones.ts). */
export function entraEnV5(e: EntradaProyecto, dev?: boolean): boolean {
	return e.data.tipo !== 'novela' && caminoDe(e) === 'proyectos' && proyectoVisible(e.data, dev);
}

/** ¿Es una pieza propia del camino técnico (método, laboratorio) publicable? */
function entraEnTecnico(e: EntradaProyecto, dev?: boolean): boolean {
	return e.data.tipo !== 'novela' && caminoDe(e) === 'tecnico' && proyectoVisible(e.data, dev);
}

/** La novela, con los textos fijos. */
function vistaDeNovela(idioma: Idioma): ProyectoVista {
	const { tipo, estado, titulo, pagina, texto, aparte, orden, autoria } = novelaDe(idioma);
	return {
		id: 'novela',
		tipo,
		estado,
		titulo,
		pagina,
		texto,
		aparte,
		sinTitulo: true,
		orden,
		filas: filasAutoria(autoria, idioma),
		enlaces: [],
		tamanoTitulo: tamanoTitulo(titulo),
	};
}

/** Un proyecto de una entrada (no la novela). */
export function vistaDeProyecto(e: EntradaProyecto, idioma: Idioma = 'es'): ProyectoVista {
	const { tipo, estado, titulo, resumen, borrador, orden, pagina, autoria, enlaces } = e.data;
	// Primera oración arriba; el resto (o, sin resto, el cuerpo publicable) en tono atenuado.
	const [primera, ...resto] = resumen.split(/(?<=\.)\s+/);
	const aparte = resto.join(' ') || (!borrador ? (e.body ?? '').trim() : '');
	return {
		id: e.id,
		tipo,
		estado,
		titulo,
		pagina: pagina ?? titulo,
		texto: primera,
		aparte,
		sinTitulo: false,
		orden,
		filas: filasAutoria(autoria, idioma),
		enlaces: enlaces ?? [],
		tamanoTitulo: tamanoTitulo(titulo),
	};
}

const rango: Record<TipoProyecto, number> = { juego: 0, novela: 1, otro: 2 };

/** Los proyectos que se muestran en Proyectos, ya ordenados (el juego primero, después la novela) y listos para dibujar. */
export function proyectosV5(entradas: EntradaProyecto[], dev?: boolean, idioma: Idioma = 'es'): ProyectoVista[] {
	return [...entradas.filter((e) => entraEnV5(e, dev)).map((e) => vistaDeProyecto(e, idioma)), vistaDeNovela(idioma)].sort(
		(a, b) => rango[a.tipo] - rango[b.tipo] || a.orden - b.orden,
	);
}

/** Las piezas propias del camino técnico (método, laboratorio), por `orden`. Sin ninguna publicable, lista vacía. */
export function piezasTecnico(entradas: EntradaProyecto[], dev?: boolean, idioma: Idioma = 'es'): ProyectoVista[] {
	return entradas
		.filter((e) => entraEnTecnico(e, dev))
		.map((e) => vistaDeProyecto(e, idioma))
		.sort((a, b) => a.orden - b.orden);
}
