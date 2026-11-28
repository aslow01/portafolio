// Las colecciones de contenido en el idioma de la página. El español vive en src/content/ y el inglés en src/content-en/
// (`casos-en`, `demos-en`, `proyectos-en`): mismo esquema y mismos ids de archivo, así que el resto del código no distingue.
// Los tipos son los de la colección en español; la versión en inglés los cumple tal cual (src/content.config.ts).
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { Idioma } from './idioma.ts';

export type Caso = CollectionEntry<'casos'>;
export type Demo = CollectionEntry<'demos'>;
export type Proyecto = CollectionEntry<'proyectos'>;

const en = (idioma: Idioma): boolean => idioma === 'en';

/** Los casos de un idioma; `filtro` recibe la entrada (como el de `getCollection`). */
export async function casosDe(idioma: Idioma, filtro?: (caso: Caso) => boolean): Promise<Caso[]> {
	return (await getCollection(en(idioma) ? 'casos-en' : 'casos', filtro as never)) as unknown as Caso[];
}

export async function demosDe(idioma: Idioma, filtro?: (demo: Demo) => boolean): Promise<Demo[]> {
	return (await getCollection(en(idioma) ? 'demos-en' : 'demos', filtro as never)) as unknown as Demo[];
}

export async function proyectosDe(idioma: Idioma): Promise<Proyecto[]> {
	return (await getCollection(en(idioma) ? 'proyectos-en' : 'proyectos')) as unknown as Proyecto[];
}

/** Una demo por su id, en el idioma pedido. */
export async function demoDe(idioma: Idioma, id: string): Promise<Demo | undefined> {
	return (await getEntry(en(idioma) ? 'demos-en' : 'demos', id)) as unknown as Demo | undefined;
}

/** La entrada a la que apunta una referencia de otra colección (`caso.data.demo`): ya es del mismo idioma. */
export async function entradaReferida<T extends { collection: string; id: string }>(referencia: T | undefined): Promise<Demo | undefined> {
	return referencia ? ((await getEntry(referencia as never)) as unknown as Demo | undefined) : undefined;
}
