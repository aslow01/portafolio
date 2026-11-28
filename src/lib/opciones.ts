// Opciones de contenido que decide Matías, cada una con su valor actual y una sola fuente (pura, sin Astro).
// Cambiar una opción es cambiar un valor acá: la portada y la ficha Proyectos la leen de este archivo.
import type { Autoria } from './contenido.ts';
import type { Idioma } from '../i18n/idioma.ts';

/**
 * La novela. El sitio la muestra SIN TÍTULO («Novela en desarrollo») hasta que tenga fecha (decisión de Matías del
 * 25/11/2026). Son textos fijos, escritos acá: NADA sale de ninguna entrada de
 * `src/content/proyectos` (si el repositorio privado tiene una, se ignora), así que el título y la sinopsis no viajan
 * con el código. Los textos de autoría y avance son respuestas de Matías del 25/11/2026; si se cambian acá, es una
 * decisión de contenido.
 */
export const novela: {
	tipo: 'novela';
	estado: 'en-desarrollo';
	orden: number;
	/** Cómo se llama en la ficha en lugar del título. */
	titulo: string;
	/** Lo que dice la solapa del paginador y el nombre de la página. */
	pagina: string;
	/** La primera oración, arriba. */
	texto: string;
	/** Lo que sigue, en tono atenuado (sin la autoría: esa va en la carta de atrás). */
	aparte: string;
	/** Las tres filas de «Quién hizo qué» de la carta de atrás. */
	autoria: Autoria;
} = {
	tipo: 'novela',
	estado: 'en-desarrollo',
	orden: 1,
	titulo: 'Novela en desarrollo',
	pagina: 'Novela',
	texto: 'Novela de terror por contagio, en dos libros.',
	aparte: 'Trabajo en esta historia desde alrededor de 2018; en 2026 tomó impulso.',
	autoria: {
		yo: 'Escribo parte de los capítulos; la historia la decido yo.',
		ia: 'La IA escribe el resto de los capítulos.',
		verificacion: 'Una sala de críticos de IA revisa cada capítulo.',
	},
};

/** La novela en inglés: los mismos textos fijos (misma decisión de contenido), traducidos. */
export const novelaEn: typeof novela = {
	tipo: 'novela',
	estado: 'en-desarrollo',
	orden: 1,
	titulo: 'Novel in development',
	pagina: 'Novel',
	texto: 'A horror novel about contagion, in two books.',
	aparte: 'I have been working on this story since around 2018; it gained momentum in 2026.',
	autoria: {
		yo: 'I write some of the chapters; I decide the story.',
		ia: 'AI writes the rest of the chapters.',
		verificacion: 'A panel of AI critics reviews each chapter.',
	},
};

export const novelaDe = (idioma: Idioma): typeof novela => (idioma === 'en' ? novelaEn : novela);
