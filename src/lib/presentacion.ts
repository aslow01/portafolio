// Reglas chicas de presentación (puras, sin Astro): se prueban con `npm test`.
import { esDeCamino, type Camino } from './contenido.ts';
import { esPublicable } from './estados.ts';

/** Rótulo de un caso: "Caso · Logística · Técnico e IA". */
export function rotuloCaso(caminos: Camino[]): string {
	const cortos: Record<Camino, string> = { logistica: 'Logística', tecnico: 'Técnico e IA' };
	return ['Caso', ...caminos.map((c) => cortos[c])].join(' · ');
}

/** Primera letra en mayúscula. */
export function capitalizar(t: string): string {
	return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Primera letra en minúscula. */
export function minuscula(t: string): string {
	return t.charAt(0).toLowerCase() + t.slice(1);
}

/** ["a", "b", "c"] -> "a, b y c". */
export function listaConY(items: string[]): string {
	if (items.length <= 1) return items.join('');
	return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

const numeros = ['', '', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];

/** 1 -> "un juego" (el singular ya trae su artículo); 2 -> "dos juegos"; 12 -> "12 juegos". */
export function cantidad(n: number, singular: string, plural: string): string {
	if (n === 1) return singular;
	return `${numeros[n] || n} ${plural}`;
}

type TipoProyecto = 'novela' | 'juego' | 'otro';

/** Lo que hay publicado en Proyectos, para el texto de la página: "una novela y un juego". */
export function descripcionProyectos(tipos: TipoProyecto[]): string {
	const nombres: Record<TipoProyecto, [string, string]> = {
		novela: ['una novela', 'novelas'],
		juego: ['un juego', 'juegos'],
		otro: ['un proyecto', 'proyectos'],
	};
	const partes = (['novela', 'juego', 'otro'] as const).flatMap((t) => {
		const n = tipos.filter((x) => x === t).length;
		return n > 0 ? [cantidad(n, nombres[t][0], nombres[t][1])] : [];
	});
	return listaConY(partes);
}

/** Bajada de /proyectos/. Que comparten mundo es cierto solo cuando están la novela y el juego. */
export function bajadaProyectos(tipos: TipoProyecto[]): string {
	const lista = descripcionProyectos(tipos);
	if (!lista) return 'Lo que hago fuera del trabajo.';
	const comparten = tipos.includes('novela') && tipos.includes('juego');
	return `Lo que hago fuera del trabajo: ${lista}${comparten ? ' que comparten mundo' : ''}.`;
}

/** "en-desarrollo" -> "en desarrollo". */
export function textoEstadoDemo(estado: string): string {
	return estado.replace(/-/g, ' ');
}

/**
 * Lo que tiene el camino técnico hoy ("un caso de estudio anonimizado y una demo en desarrollo, con datos
 * ficticios"). Con demos al lado el caso es "de estudio"; solo, "real".
 */
export function inventarioTecnico(casos: number, estadosDemos: string[]): string {
	const partes: string[] = [];
	const demosPorEstado = ['en-vivo', 'en-desarrollo'].map((estado) => ({
		estado,
		n: estadosDemos.filter((e) => e === estado).length,
	}));
	const demos = demosPorEstado.reduce((suma, d) => suma + d.n, 0);
	if (casos > 0) {
		partes.push(
			demos > 0
				? cantidad(casos, 'un caso de estudio anonimizado', 'casos de estudio anonimizados')
				: cantidad(casos, 'un caso real anonimizado', 'casos reales anonimizados'),
		);
	}
	for (const { estado, n } of demosPorEstado) {
		if (n > 0) partes.push(`${cantidad(n, 'una demo', 'demos')} ${textoEstadoDemo(estado)}`);
	}
	const texto = listaConY(partes);
	return demos > 0 ? `${texto}, con datos ficticios` : texto;
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
): string {
	return inventarioTecnico(
		casos.filter((c) => esPublicable(c.data, dev) && esDeCamino(c.data, 'tecnico')).length,
		demos.filter((d) => esPublicable(d.data, dev)).map((d) => d.data.estado),
	);
}
