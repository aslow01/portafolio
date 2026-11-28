// Datos de la web v5 (portada y molde de ficha). Todo sale de src/lib/* y se reexporta de ahí: acá no se escribe
// ningún dato suelto (solo la lista de fichas, que es propia de la v5).
import { experiencia, mesesEntre } from '../lib/experiencia.ts';
import { descripcionProyectos } from '../lib/presentacion.ts';
import { bajadaPortada, correo, linkedin, minas, nombre, titular, ubicacion } from '../lib/sitio.ts';
import { telefono } from '../lib/datos-pendientes.ts';
import type { Idioma } from '../i18n/idioma.ts';

export { bajadaPortada, correo, linkedin, minas, nombre, telefono, titular, ubicacion };

export type Color = 'cobre' | 'azurita' | 'malaquita' | 'azufre' | 'grafito';
export type IdFicha = 'logistica' | 'tecnico' | 'demos' | 'proyectos' | 'contacto';

export interface DatosFicha {
	id: IdFicha;
	/** «01» a «05»: el número de la solapa. */
	numero: string;
	/** Nombre largo (cabeza de la ficha y carrusel). */
	nombre: string;
	/** Rótulo corto del lomo y la pestaña. */
	corto: string;
	color: Color;
	/** 1 a 5: de eso depende la posición de la solapa (clase p1…p5). */
	posicion: 1 | 2 | 3 | 4 | 5;
}

/** Las cinco fichas, en orden. La portada, los lomos y el molde leen de acá: no se repiten a mano. */
export const fichas: readonly DatosFicha[] = [
	{ id: 'logistica', numero: '01', nombre: 'Logística y minería', corto: 'Logística', color: 'cobre', posicion: 1 },
	{ id: 'tecnico', numero: '02', nombre: 'Técnico e IA', corto: 'Técnico', color: 'azurita', posicion: 2 },
	{ id: 'demos', numero: '03', nombre: 'Demos', corto: 'Demos', color: 'malaquita', posicion: 3 },
	{ id: 'proyectos', numero: '04', nombre: 'Proyectos', corto: 'Proyectos', color: 'azufre', posicion: 4 },
	{ id: 'contacto', numero: '05', nombre: 'Contacto', corto: 'Contacto', color: 'grafito', posicion: 5 },
];

/** Los nombres de las fichas en inglés (mismo orden, mismo color y posición que en español). */
const nombresEn: Record<IdFicha, { nombre: string; corto: string }> = {
	logistica: { nombre: 'Logistics and mining', corto: 'Logistics' },
	tecnico: { nombre: 'Technical and AI', corto: 'Technical' },
	demos: { nombre: 'Demos', corto: 'Demos' },
	proyectos: { nombre: 'Projects', corto: 'Projects' },
	contacto: { nombre: 'Contact', corto: 'Contact' },
};

/** Las cinco fichas en un idioma. El `id` (y por lo tanto el hash `#tecnico`) es el mismo en los dos. */
export function fichasDe(idioma: Idioma): readonly DatosFicha[] {
	return idioma === 'en' ? fichas.map((f) => ({ ...f, ...nombresEn[f.id] })) : fichas;
}

/** Una ficha por su id (falla si no existe: es un error de quien lo escribe). */
export function ficha(id: IdFicha, idioma: Idioma = 'es'): DatosFicha {
	const f = fichasDe(idioma).find((x) => x.id === id);
	if (!f) throw new Error(`Ficha desconocida: ${id}`);
	return f;
}

/** Duración del puesto de logística en alta montaña, desde `experiencia`: «1 año» o «N meses» («1 year», «N months»). */
export function duracionAltaMontana(idioma: Idioma = 'es'): string {
	const p = experiencia.find((x) => x.altaMontana);
	if (!p) return '';
	const meses = mesesEntre(p.desde, p.finBarra ?? (p.hasta === 'hoy' ? p.desde : p.hasta));
	if (idioma === 'en') {
		if (meses % 12 === 0) return meses === 12 ? '1 year' : `${meses / 12} years`;
		return `${meses} months`;
	}
	if (meses % 12 === 0) return meses === 12 ? '1 año' : `${meses / 12} años`;
	return `${meses} meses`;
}

/** «2 en vivo · 1 en desarrollo» según el estado real de las demos visibles (nunca un número escrito a mano). */
export function cuentaDemos(estados: string[]): { vivas: number; desarrollo: number } {
	return { vivas: estados.filter((e) => e === 'en-vivo').length, desarrollo: estados.filter((e) => e === 'en-desarrollo').length };
}

/** El texto de las pestañas de Proyectos: «una novela y un juego» (solo lo publicado) y si comparten mundo. */
export function textoProyectos(tipos: ('novela' | 'juego' | 'otro')[], idioma: Idioma = 'es'): { lista: string; comparten: boolean } {
	return { lista: descripcionProyectos(tipos, idioma), comparten: tipos.includes('novela') && tipos.includes('juego') };
}
