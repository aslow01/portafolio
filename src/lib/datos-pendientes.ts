// Datos de contacto y de publicación que se completan a mano: los CV en PDF y el teléfono público.
// Con `null`, la página no muestra nada inventado ni marcadores. Para activar o cambiar un dato, se completa
// acá y se vuelve a construir. El teléfono de este archivo es el único que deja pasar scripts/higiene.test.mjs:
// cualquier otro número en el código o en dist/ hace fallar las pruebas.

import type { Idioma } from '../i18n/idioma.ts';

export interface CvPdf {
	/** Ruta pública del PDF, p. ej. `/cv/matias-ormeno-cv-logistica.pdf` (archivo en `public/cv/`). */
	archivo: string;
	/** Formato, páginas y peso REALES, escritos al subir el PDF: "PDF · 2 páginas · 180 KB". */
	detalle: string;
}

export interface Telefono {
	/** Como se muestra, con el código de país y de área. */
	visible: string;
	/** Para `tel:`, solo dígitos con el signo + delante. */
	tel: string;
	/** `https://wa.me/…`, solo si el titular usa WhatsApp. */
	whatsapp?: string;
}

/** PDF público de cada camino (sin el nombre de la empresa, sus sitios ni datos de clientes). Solo las versiones
 *  `_publica` de cv/pdf/ van a public/cv/; las privadas nunca. Con `null` la página no muestra el botón de descarga.
 *  Si se cambia un PDF, el detalle se actualiza con sus páginas y su peso (scripts/cv.test.mjs lo comprueba). */
export const cv: Record<'logistica' | 'tecnico', CvPdf | null> = {
	logistica: { archivo: '/cv/matias-ormeno-cv-logistica.pdf', detalle: 'PDF · 2 páginas · 88 KB' },
	tecnico: { archivo: '/cv/matias-ormeno-cv-tecnico.pdf', detalle: 'PDF · 1 página · 70 KB' },
};

/**
 * Los CV que enlaza la versión en inglés (/en/). El técnico tiene su PDF en inglés; el de logística solo existe en español,
 * así que apunta al mismo archivo y la página lo avisa («Spanish»). Si se publica un PDF en inglés de logística, se cambia acá
 * y se saca el aviso (`cvEnEspanol`).
 */
export const cvEn: Record<'logistica' | 'tecnico', CvPdf | null> = {
	logistica: cv.logistica && { archivo: cv.logistica.archivo, detalle: 'PDF · 2 pages · 88 KB' },
	tecnico: { archivo: '/cv/matias-ormeno-cv-technical-en.pdf', detalle: 'PDF · 1 page · 72 KB' },
};

/** Los CV de un idioma. */
export const cvDe = (idioma: Idioma): Record<'logistica' | 'tecnico', CvPdf | null> => (idioma === 'en' ? cvEn : cv);

/** ¿El PDF de ese camino está en español aunque la página sea la inglesa? (Entonces el botón lo dice: «Spanish».) */
export const cvEnEspanol = (camino: 'logistica' | 'tecnico', idioma: Idioma): boolean =>
	idioma === 'en' && cvEn[camino]?.archivo === cv[camino]?.archivo;

/** Teléfono. Con `null` no se muestra la fila de contacto ni los botones "Llamar" y "WhatsApp". */
export const telefono: Telefono | null = {
	visible: '+54 9 264 562-4917',
	tel: '+5492645624917',
	whatsapp: 'https://wa.me/5492645624917',
};
