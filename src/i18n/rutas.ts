// Las direcciones que se generan de cada idioma. Vive en un módulo aparte porque `getStaticPaths` de una página se ejecuta
// antes que su código y solo puede usar lo que importa: las dos páginas de caso (`/casos/<id>/` y `/en/casos/<id>/`)
// comparten esta lista.
import { esPublicable } from '../lib/estados.ts';
import { casosDe } from './colecciones.ts';
import type { Idioma } from './idioma.ts';

/** Una entrada por caso publicable del idioma: `params.slug` es el id del archivo; `props.caso`, la entrada. */
export async function rutasDeCasos(idioma: Idioma) {
	const casos = await casosDe(idioma, ({ data }) => esPublicable(data));
	return casos.map((caso) => ({ params: { slug: caso.id }, props: { caso } }));
}
