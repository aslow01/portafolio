// El cajón de expedientes de /casos/: de los casos publicables saca, en orden, lo
// que cada banda necesita (número, título, caminos, carpeta, tono y nota). El número, el tono y la posición de una banda
// nunca se escriben a mano: salen de acá. Sin Astro: se prueba con `npm test` (scripts/archivo.test.mjs).
import type { Camino } from '../../lib/contenido.ts';
import { esPublicable } from '../../lib/estados.ts';
import { ficha } from '../datos.ts';
import { carpetaDe } from './caso.ts';

export type Carpeta = 'tecnico' | 'logistica';
export type Tono = 'azurita' | 'honda' | 'cobre' | 'claro';

export interface Expediente {
	/** `/casos/${id}/` */
	href: string;
	/** '01', '02'…: la posición en la lista, de 1 en adelante, con dos dígitos. */
	numero: string;
	/** El título del caso, sin cambios. */
	titulo: string;
	/** «Técnico · Logística»: la carpeta primero, después el otro camino. */
	caminos: string;
	carpeta: Carpeta;
	tono: Tono;
	nota?: 'Con demo en vivo' | 'Borrador';
	/** Una línea de resultado, tomada del propio caso (`resultadoCorto`). Sin dato, el expediente no la lleva. */
	resultado?: string;
}

/** Lo que `expedientes` lee de un caso (una entrada de la colección `casos` lo cumple tal cual). */
export interface CasoDelCajon {
	id: string;
	data: { titulo: string; orden: number; caminos: Camino[]; estado?: string; borrador?: boolean; resultadoCorto?: string };
}

/** El escalonado y las medidas del cajón están probados hasta ocho expedientes. */
export const MAX_EXPEDIENTES = 8;
/** Desde cuántos expedientes la pila se achica (clase `muchos`). */
const DESDE_MUCHOS = 7;

/** `true` si la lista es larga y el CSS usa las medidas de `.cajon.muchos`. */
export const hayMuchos = (cantidad: number): boolean => cantidad >= DESDE_MUCHOS;

// La regla de la puerta («Casos de estudio», 11.5: solo con dos casos o más) vive en lib/contenido.ts, que caso.ts también lee.
export { puertaAlArchivo } from '../../lib/contenido.ts';

/** Las clases de la banda según su tono. El color de la banda lo ponen estas clases, no un estilo en línea. */
export function claseDeTono(tono: Tono): string {
	switch (tono) {
		case 'honda':
			return 'c-azurita honda';
		case 'claro':
			return 'c-azurita principal';
		case 'cobre':
			return 'c-cobre';
		default:
			return 'c-azurita';
	}
}

/** El color de la cortina al salir: el de la carpeta a la que se va, no el de la banda tocada. */
export const colorDeCarpeta = (carpeta: Carpeta): string => (carpeta === 'tecnico' ? 'var(--azurita)' : 'var(--cobre)');

/** «Técnico · Logística»: la carpeta primero (la misma regla que la página del caso), después el otro camino. */
function textoDeCaminos(caminos: Camino[]): string {
	const carpeta = carpetaDe(caminos);
	return [carpeta, ...caminos.filter((c) => c !== carpeta)]
		.filter((c, i, todos) => todos.indexOf(c) === i)
		.map((c) => ficha(c).corto)
		.join(' · ');
}

/**
 * Los expedientes del cajón: los casos publicables de todos los caminos, por `orden`.
 * - `principalId`: la obra principal de Técnico (`obraPrincipal`); su banda es la clara.
 * - `demoEnVivo`: si la demo de ese caso es publicable y está en vivo (solo así lleva la nota «Con demo en vivo»).
 * - `dev`: solo existe para probar; en el sitio se deja `esPublicable` decidir (los borradores salen solo en `npm run dev`).
 */
export function expedientes(casos: CasoDelCajon[], principalId: string | undefined, demoEnVivo: boolean, dev?: boolean): Expediente[] {
	const lista = casos.filter((c) => esPublicable(c.data, dev)).sort((a, b) => a.data.orden - b.data.orden);
	if (lista.length === 0) throw new Error('No hay casos publicables: no existe un cajón vacío');
	if (lista.length > MAX_EXPEDIENTES) throw new Error(`El cajón admite hasta ocho casos: hay ${lista.length}; rediseñar /casos/`);

	let anterior: Tono | undefined;
	return lista.map((c, i) => {
		const carpeta = carpetaDe(c.data.caminos);
		// El principal, claro; Logística, cobre; los demás alternan azurita y honda para que dos azules seguidos se distingan.
		const tono: Tono = c.id === principalId ? 'claro' : carpeta === 'logistica' ? 'cobre' : anterior === 'azurita' ? 'honda' : 'azurita';
		anterior = tono;
		const enBorrador = !esPublicable(c.data, false);
		const nota = enBorrador ? 'Borrador' : c.id === principalId && demoEnVivo ? 'Con demo en vivo' : undefined;
		return {
			href: `/casos/${c.id}/`,
			numero: String(i + 1).padStart(2, '0'),
			titulo: c.data.titulo,
			caminos: textoDeCaminos(c.data.caminos),
			carpeta,
			tono,
			...(nota ? { nota } : {}),
			...(c.data.resultadoCorto ? { resultado: c.data.resultadoCorto } : {}),
		};
	});
}
