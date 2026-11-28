// Reglas chicas de presentación (puras, sin Astro): se prueban con `npm test`.
// Cada una trae el idioma como último parámetro (por defecto, español): el inglés arma las mismas frases con sus reglas
// de concordancia (sin género, plural con «s», lista con «and» y sin coma antes).
import { esDeCamino, type Camino } from './contenido.ts';
import { esPublicable } from './estados.ts';
import type { Idioma } from '../i18n/idioma.ts';

/** Rótulo de un caso: "Caso · Logística · Técnico e IA" ("Case · Logistics · Software and AI"). */
export function rotuloCaso(caminos: Camino[], idioma: Idioma = 'es'): string {
	const cortos: Record<Camino, string> =
		idioma === 'en' ? { logistica: 'Logistics', tecnico: 'Software and AI' } : { logistica: 'Logística', tecnico: 'Técnico e IA' };
	return [idioma === 'en' ? 'Case' : 'Caso', ...caminos.map((c) => cortos[c])].join(' · ');
}

/** Primera letra en mayúscula. */
export function capitalizar(t: string): string {
	return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Primera letra en minúscula. */
export function minuscula(t: string): string {
	return t.charAt(0).toLowerCase() + t.slice(1);
}

/** ["a", "b", "c"] -> "a, b y c" (en inglés, "a, b and c"). */
export function listaConY(items: string[], idioma: Idioma = 'es'): string {
	if (items.length <= 1) return items.join('');
	return `${items.slice(0, -1).join(', ')} ${idioma === 'en' ? 'and' : 'y'} ${items[items.length - 1]}`;
}

const numeros = {
	es: ['', '', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'],
	en: ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
};

/** 1 -> "un juego" (el singular ya trae su artículo); 2 -> "dos juegos"; 12 -> "12 juegos" ("a game", "two games", "12 games"). */
export function cantidad(n: number, singular: string, plural: string, idioma: Idioma = 'es'): string {
	if (n === 1) return singular;
	return `${numeros[idioma][n] || n} ${plural}`;
}

type TipoProyecto = 'novela' | 'juego' | 'otro';

/** Lo que hay publicado en Proyectos, para el texto de la página: "una novela y un juego" ("a novel and a game"). */
export function descripcionProyectos(tipos: TipoProyecto[], idioma: Idioma = 'es'): string {
	const nombres: Record<TipoProyecto, [string, string]> =
		idioma === 'en'
			? { novela: ['a novel', 'novels'], juego: ['a game', 'games'], otro: ['a project', 'projects'] }
			: { novela: ['una novela', 'novelas'], juego: ['un juego', 'juegos'], otro: ['un proyecto', 'proyectos'] };
	const partes = (['novela', 'juego', 'otro'] as const).flatMap((t) => {
		const n = tipos.filter((x) => x === t).length;
		return n > 0 ? [cantidad(n, nombres[t][0], nombres[t][1], idioma)] : [];
	});
	return listaConY(partes, idioma);
}

/** Bajada de /proyectos/. Que comparten mundo es cierto solo cuando están la novela y el juego. */
export function bajadaProyectos(tipos: TipoProyecto[], idioma: Idioma = 'es'): string {
	const lista = descripcionProyectos(tipos, idioma);
	const comparten = tipos.includes('novela') && tipos.includes('juego');
	if (idioma === 'en') {
		if (!lista) return 'What I do outside work.';
		return `What I do outside work: ${lista}${comparten ? ' that share a world' : ''}.`;
	}
	if (!lista) return 'Lo que hago fuera del trabajo.';
	return `Lo que hago fuera del trabajo: ${lista}${comparten ? ' que comparten mundo' : ''}.`;
}

const estadosEn: Record<string, string> = {
	'en-vivo': 'live',
	'en-desarrollo': 'in development',
	'en-preparacion': 'in preparation',
	terminado: 'finished',
};

/** "en-desarrollo" -> "en desarrollo" ("in development"). */
export function textoEstadoDemo(estado: string, idioma: Idioma = 'es'): string {
	if (idioma === 'en') return estadosEn[estado] ?? estado.replace(/-/g, ' ');
	return estado.replace(/-/g, ' ');
}

/**
 * Lo que tiene el camino técnico hoy ("un caso de estudio anonimizado y una demo en desarrollo, con datos
 * ficticios"). Con demos al lado el caso es "de estudio"; solo, "real".
 * En inglés: "five anonymized case studies and three live demos, with fictitious data".
 */
export function inventarioTecnico(casos: number, estadosDemos: string[], idioma: Idioma = 'es'): string {
	const en = idioma === 'en';
	const partes: string[] = [];
	const demosPorEstado = ['en-vivo', 'en-desarrollo'].map((estado) => ({
		estado,
		n: estadosDemos.filter((e) => e === estado).length,
	}));
	const demos = demosPorEstado.reduce((suma, d) => suma + d.n, 0);
	if (casos > 0) {
		if (en) {
			partes.push(
				demos > 0
					? cantidad(casos, 'one anonymized case study', 'anonymized case studies', idioma)
					: cantidad(casos, 'one anonymized real case', 'anonymized real cases', idioma),
			);
		} else {
			partes.push(
				demos > 0
					? cantidad(casos, 'un caso de estudio anonimizado', 'casos de estudio anonimizados')
					: cantidad(casos, 'un caso real anonimizado', 'casos reales anonimizados'),
			);
		}
	}
	for (const { estado, n } of demosPorEstado) {
		if (n === 0) continue;
		if (en) {
			// «live» va antes del sustantivo («three live demos»); «in development», después («two demos in development»).
			partes.push(
				estado === 'en-vivo'
					? cantidad(n, 'one live demo', 'live demos', idioma)
					: `${cantidad(n, 'one demo', 'demos', idioma)} ${textoEstadoDemo(estado, idioma)}`,
			);
		} else {
			partes.push(`${cantidad(n, 'una demo', 'demos')} ${textoEstadoDemo(estado)}`);
		}
	}
	const texto = listaConY(partes, idioma);
	return demos > 0 ? `${texto}${en ? ', with fictitious data' : ', con datos ficticios'}` : texto;
}

/**
 * Lo que hay publicado en el camino técnico, a partir de las colecciones completas: solo cuenta lo
 * que `esPublicable` deja ver (un borrador no suma) y, de las demos, las que están en vivo o en
 * desarrollo. Ninguna cantidad se escribe a mano en una página. `dev` solo existe para probarlo.
 */
export function inventarioPublicado(
	casos: { data: { estado?: string; borrador?: boolean; caminos: Camino[] } }[],
	demos: { data: { estado: string; borrador?: boolean } }[],
	dev?: boolean,
	idioma: Idioma = 'es',
	/** El camino cuyos casos se cuentan; 
ull cuenta todos los publicados (la portada, que muestra los de los dos caminos). */
	camino: Camino | null = 'tecnico',
): string {
	return inventarioTecnico(
		casos.filter((c) => esPublicable(c.data, dev) && (camino === null || esDeCamino(c.data, camino))).length,
		demos.filter((d) => esPublicable(d.data, dev)).map((d) => d.data.estado),
		idioma,
	);
}
