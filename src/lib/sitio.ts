// Datos fijos del sitio que se repiten en varias páginas (correo, LinkedIn) y las afirmaciones
// que dos páginas dicen igual: se escriben acá una sola vez (scripts/sitio.test.mjs lo comprueba).

import { imagenesSociales } from './imagenes-sociales.ts';

export const correo = 'contacto@matiasormeno.com.ar';
export const linkedin = 'https://www.linkedin.com/in/mat%C3%ADas-orme%C3%B1o-98208a3b3';
export const ubicacion = 'San Juan, Argentina';

/** El nombre del autor, en partes y completo (scripts/datos-v5.test.mjs comprueba que coincidan). */
export const nombre = { primero: 'Matías', segundo: 'Ariel', apellido: 'Ormeño', completo: 'Matías Ariel Ormeño' } as const;

/** Titular y bajada de la portada v5 (la bajada repite la afirmación del camino técnico). */
export const titular = 'Desarrollo de software y automatización con IA';
export const bajadaPortada =
	'Diseño automatizaciones para el área administrativa, dirijo su desarrollo con IA y las verifico con pruebas automáticas.';

/** Las tres minas donde Matías hizo las inducciones. */
export const minas = ['Vicuña', 'Veladero', 'Pachón'] as const;

/** Descripción por defecto de una página (la que no trae la suya). */
export const descripcionSitio = `Portafolio de ${nombre.completo}: logística y minería, y técnico e IA.`;

/**
 * Imagen y texto alternativo de la vista previa al compartir (WhatsApp, LinkedIn, correo). Salen de
 * src/lib/imagenes-sociales.ts, que escribe scripts/og/generar.mjs. En `npm run dev` una clave sin generar (un caso en
 * borrador) usa la de la portada; en el build falla: un caso publicado sin su imagen no sale.
 */
export function imagenSocial(clave: string, dev: boolean): { archivo: string; alt: string } {
	const imagenes: Record<string, { archivo: string; alt: string } | undefined> = imagenesSociales;
	const imagen = imagenes[clave] ?? (dev ? imagenes.portada : undefined);
	if (!imagen) throw new Error(`Falta la imagen para compartir «${clave}»: correr node scripts/og/generar.mjs`);
	return imagen;
}

/** Enlace `mailto:` con asunto y cuerpo ya codificados. */
export function mailto(asunto?: string, cuerpo?: string): string {
	const partes: string[] = [];
	if (asunto) partes.push(`subject=${encodeURIComponent(asunto)}`);
	if (cuerpo) partes.push(`body=${encodeURIComponent(cuerpo)}`);
	return `mailto:${correo}${partes.length ? `?${partes.join('&')}` : ''}`;
}

/** La cifra de la facturación, escrita una sola vez (la usan la lista Experiencia y la página de logística; los casos
 *  la repiten en su texto y scripts/sitio.test.mjs comprueba que coincida). */
export const comprobantesPorMes = 'más de 2.000 comprobantes por mes';

/** Párrafo "Cómo trabajo" de la portada y del camino técnico. */
export const comoTrabajo =
	'Entiendo el problema, defino las reglas y compruebo que funcione, con pruebas automáticas. ' +
	'Diseño los sistemas y dirijo el desarrollo con IA, con pruebas y revisión de seguridad. ' +
	'Las ideas y los diseños son míos; la IA escribe el código bajo mi dirección y cada trabajo detalla mi parte.';

/** Las dos frases que /tecnico/ resalta en la primera oración de `comoTrabajo` (están dentro de ella: sitio.test.mjs lo comprueba). */
export const enfasisComoTrabajo = ['defino las reglas', 'compruebo que funcione'] as const;

/** Estudios en curso, para la ficha "Estudios" de logística y técnico (formación tiene el detalle con fechas). */
export const estudiosActuales = 'Tecnicatura Universitaria en Programación a Distancia (UTN), en curso';

/** Número de teléfono con espacios duros (U+00A0): no se parte en dos renglones. */
export function telefonoVisible(visible: string): string {
	return visible.replace(/ /g, '\u00A0');
}
