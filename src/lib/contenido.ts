// Reglas de contenido (puras, sin Astro): se prueban con `npm test`.
import type { Idioma } from '../i18n/idioma.ts';

export type Camino = 'logistica' | 'tecnico';

export interface Resultado {
	cifra?: string;
	unidad?: string;
	/** Qué se midió y cuándo. Sin este campo la cifra no se muestra. */
	medicion?: string;
}

export interface Autoria {
	yo?: string;
	ia?: string;
	verificacion?: string;
}

const lleno = (t: string | undefined): t is string => typeof t === 'string' && t.trim() !== '';

/** La cifra solo se muestra si dice qué se midió y cuándo (`medicion`). */
export function cifraVisible(resultado: Resultado | undefined): Resultado | undefined {
	if (!resultado) return undefined;
	return lleno(resultado.cifra) && lleno(resultado.medicion) ? resultado : undefined;
}

/** Título de la sección de autoría y texto del botón que la abre (fichas Demos y hoja de autoría). */
export const tituloAutoria = 'Mi parte y autoría';
export const botonAutoria = 'Ver mi parte y la autoría';
/** Lo mismo, en el idioma pedido. */
export const tituloAutoriaDe = (idioma: Idioma): string => (idioma === 'en' ? 'My part and authorship' : tituloAutoria);
export const botonAutoriaDe = (idioma: Idioma): string => (idioma === 'en' ? 'See my part and authorship' : botonAutoria);

/** Filas del recuadro de autoría; una fila sin texto no va (nunca se muestra vacía). */
export function filasAutoria(
	autoria: Autoria | undefined,
	idioma: Idioma = 'es',
): { clave: 'yo' | 'ia' | 'verif'; rotulo: string; texto: string }[] {
	if (!autoria) return [];
	const en = idioma === 'en';
	const filas = [
		{ clave: 'yo', rotulo: en ? 'My part' : 'Mi parte', texto: autoria.yo },
		{ clave: 'ia', rotulo: en ? 'Authorship' : 'Autoría', texto: autoria.ia },
		{ clave: 'verif', rotulo: en ? 'How I verified it' : 'Cómo lo verifiqué', texto: autoria.verificacion },
	] as const;
	return filas.flatMap((f) => (lleno(f.texto) ? [{ clave: f.clave, rotulo: f.rotulo, texto: f.texto }] : []));
}

/** Obra principal: el caso `destacado` de menor `orden`; sin destacados, ninguno. */
export function obraPrincipal<T extends { data: { orden: number; destacado?: boolean } }>(
	casos: T[],
): T | undefined {
	return casos.filter((c) => c.data.destacado === true).sort((a, b) => a.data.orden - b.data.orden)[0];
}

/** Un índice de un solo caso no sirve: la entrada «Casos de estudio» a `/casos/` se dibuja solo con dos casos o más. */
export const puertaAlArchivo = (total: number): boolean => total >= 2;

export function esDeCamino(data: { caminos: Camino[] }, camino: Camino): boolean {
	return data.caminos.includes(camino);
}
