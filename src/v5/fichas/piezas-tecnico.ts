// Cómo se dibujan las piezas propias del camino técnico (Método, Laboratorio) en la p. 3 de la ficha Técnico y en las páginas
// 9 y 10 de /tecnico/. Es presentación: qué piezas hay y su texto lo decide
// `piezasTecnico` (lib/proyectos.ts). Las dos páginas usan lo mismo, así que el `id` de la página y el color de cada carta salen
// de acá y no se pueden desparejar. Sin Astro: lo importan los .astro.
import type { ProyectoVista } from '../../lib/proyectos.ts';

/** El `id` de la página de una pieza en /tecnico/ (`#metodo`, `#laboratorio`): su nombre corto, sin tildes ni mayúsculas. */
export const idDePieza = (p: Pick<ProyectoVista, 'pagina'>): string =>
	p.pagina
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

export interface EstiloDePieza {
	/** Clases de color de la carta chica de la p. 3 (`carta-p`). */
	chica: string;
	/** Clases de la carta grande de /tecnico/: la primera pieza lleva la solapa a la izquierda; la segunda, a la derecha (`h`). */
	grande: string;
	/** La carta de atrás es la inversa del frente y su solapa va del lado contrario a la solapa propia de la carta. */
	atras: { color: 'hueso' | 'grafito'; lado: 'izq' | 'der' };
}

/** Método → grafito (atrás, hueso a la derecha); Laboratorio → hueso (atrás, grafito a la izquierda); y así alternando. */
export const estiloDePieza = (indice: number): EstiloDePieza =>
	indice % 2 === 0
		? { chica: 'a c-grafito', grande: 'c-grafito', atras: { color: 'hueso', lado: 'der' } }
		: { chica: 'b c-hueso', grande: 'h c-hueso', atras: { color: 'grafito', lado: 'izq' } };
