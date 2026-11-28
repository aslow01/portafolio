// De la respuesta del asistente (texto con formato mínimo) a bloques que la presentación pinta COMO TEXTO.
// La respuesta es dato hostil: acá no existe HTML. Una etiqueta, un script o un manejador de eventos son caracteres comunes
// dentro de un fragmento de texto; un enlace solo sale si `enlacePermitido` lo acepta. Puro, sin DOM.
//
// Formato aceptado (el que el Worker documenta): párrafos separados por línea en blanco, listas con «- », «* » o «1. »,
// `**negrita**`, `[texto](destino)` y destinos sueltos (https://…, /casos/…/, /#demos; en inglés, las mismas rutas bajo /en/).
import { enlacePermitido, sinPrefijoEn } from './enlaces.ts';
import type { ReglasEnlaces } from './enlaces.ts';
import type { Bloque, Fragmento, Fuente, Idioma } from './tipos.ts';

const MAX_ENTRADA = 6000;
const MAX_FUENTES = 3;
const MAX_ROTULO_FUENTE = 60;

// Controles (salvo el salto de línea, que separa párrafos) y marcas que invierten o esconden texto.
const CONTROLES = /[\u0000-\u0008\u000b-\u001f\u007f]/g;
export const OCULTOS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

const ROTULOS: Record<Idioma, Record<string, string>> = {
	es: {
		'/#tecnico': 'Técnico e IA',
		'/tecnico/': 'Técnico e IA',
		'/#logistica': 'Logística y minería',
		'/logistica/': 'Logística y minería',
		'/#demos': 'Demos',
		'/demos/': 'Demos',
		'/#proyectos': 'Proyectos',
		'/proyectos/': 'Proyectos',
		'/#contacto': 'Contacto',
		'/contacto/': 'Contacto',
		'/casos/': 'Casos de estudio',
	},
	en: {
		'/#tecnico': 'Software & AI',
		'/tecnico/': 'Software & AI',
		'/#logistica': 'Logistics & mining',
		'/logistica/': 'Logistics & mining',
		'/#demos': 'Demos',
		'/demos/': 'Demos',
		'/#proyectos': 'Projects',
		'/proyectos/': 'Projects',
		'/#contacto': 'Contact',
		'/contacto/': 'Contact',
		'/casos/': 'Case studies',
	},
};
const PREFIJO_CASO: Record<Idioma, string> = { es: 'Caso', en: 'Case' };

// Un fragmento especial por vez, de izquierda a derecha.
const MARCAS = new RegExp(
	[
		String.raw`\[([^\]\n]{1,200})\]\(([^)\s]{1,300})\)`, // 1 texto, 2 destino
		String.raw`\*\*([^*\n]{1,300})\*\*`, // 3 negrita
		String.raw`(https?:\/\/[^\s<>()\[\]"']+)`, // 4 dirección suelta
		String.raw`((?<![\w/.:#])\/(?:en\/)?(?:#[a-z]+|casos\/[a-z0-9-]*\/?|cv\/[A-Za-z0-9._-]+|(?:demos|proyectos|tecnico|logistica|contacto)\/))`, // 5 ruta suelta
	].join('|'),
	'g',
);

function agregar(partes: Fragmento[], f: Fragmento): void {
	const ultimo = partes[partes.length - 1];
	if (f.tipo === 'texto') {
		if (f.texto === '') return;
		if (ultimo && ultimo.tipo === 'texto' && ultimo.negrita === f.negrita) {
			partes[partes.length - 1] = { tipo: 'texto', texto: ultimo.texto + f.texto, negrita: f.negrita };
			return;
		}
	}
	partes.push(f);
}

/** Una línea de texto → fragmentos. */
function enLinea(linea: string, reglas: ReglasEnlaces): Fragmento[] {
	const partes: Fragmento[] = [];
	let desde = 0;
	for (const m of linea.matchAll(MARCAS)) {
		const inicio = m.index ?? 0;
		agregar(partes, { tipo: 'texto', texto: linea.slice(desde, inicio), negrita: false });
		desde = inicio + m[0].length;

		if (m[3] !== undefined) {
			agregar(partes, { tipo: 'texto', texto: m[3], negrita: true });
		} else if (m[1] !== undefined && m[2] !== undefined) {
			const v = enlacePermitido(m[2], reglas);
			// Un enlace que no pasa queda como su texto: sin destino, sin la dirección.
			if (v) agregar(partes, { tipo: 'enlace', texto: m[1], href: v.href, externo: v.externo });
			else agregar(partes, { tipo: 'texto', texto: m[1], negrita: false });
		} else {
			// Dirección o ruta suelta: sin la puntuación final, que es de la oración.
			const suelto = m[4] ?? m[5] ?? '';
			const puntuacion = /[.,;:!?]+$/.exec(suelto)?.[0] ?? '';
			const destino = suelto.slice(0, suelto.length - puntuacion.length);
			const v = enlacePermitido(destino, reglas);
			if (v) agregar(partes, { tipo: 'enlace', texto: destino, href: v.href, externo: v.externo });
			else agregar(partes, { tipo: 'texto', texto: destino, negrita: false });
			agregar(partes, { tipo: 'texto', texto: puntuacion, negrita: false });
		}
	}
	agregar(partes, { tipo: 'texto', texto: linea.slice(desde), negrita: false });
	return partes;
}

const ITEM = /^\s*(?:[-*•]|\d{1,2}[.)])\s+(.*)$/;

function rotuloDeFuente(href: string, textoEnlace: string, idioma: Idioma): string {
	// Bajo `/en/` están las mismas páginas: el rótulo sale de la ruta sin el prefijo.
	const neutra = sinPrefijoEn(href);
	const fijo = ROTULOS[idioma][neutra];
	if (fijo) return fijo;
	const limpio = textoEnlace.trim();
	const slug = /^\/casos\/([a-z0-9-]+)\/$/.exec(neutra)?.[1] ?? '';
	// Si el texto del enlace es la propia dirección (enlace suelto), se usa el identificador del caso.
	const base = limpio === '' || limpio.startsWith('/') || limpio.startsWith('http') ? slug.replace(/-/g, ' ') : limpio;
	const cortado = base.length > MAX_ROTULO_FUENTE ? `${base.slice(0, MAX_ROTULO_FUENTE - 1).trimEnd()}…` : base;
	return `${PREFIJO_CASO[idioma]}: ${cortado}`;
}

/** Fuentes: páginas internas del sitio (no los CV ni el correo ni otros sitios), sin repetir, hasta tres. */
function sacarFuentes(bloques: Bloque[], idioma: Idioma): Fuente[] {
	const vistas = new Map<string, Fuente>();
	const recorrer = (partes: readonly Fragmento[]) => {
		for (const p of partes) {
			if (p.tipo !== 'enlace' || p.externo || !p.href.startsWith('/') || p.href.startsWith('/cv/') || vistas.has(p.href)) continue;
			vistas.set(p.href, { href: p.href, texto: rotuloDeFuente(p.href, p.texto, idioma) });
		}
	};
	for (const b of bloques) {
		if (b.tipo === 'parrafo') recorrer(b.partes);
		else for (const item of b.items) recorrer(item);
	}
	return [...vistas.values()].slice(0, MAX_FUENTES);
}

export function formatearRespuesta(entrada: string, reglas: ReglasEnlaces, idioma: Idioma): { bloques: Bloque[]; fuentes: Fuente[] } {
	const texto = String(entrada).slice(0, MAX_ENTRADA).replace(/\r\n?/g, '\n').replace(/\t/g, ' ').replace(CONTROLES, '').replace(OCULTOS, '');

	const bloques: Bloque[] = [];
	let parrafo: string[] = [];
	let items: Fragmento[][] = [];
	const cerrarParrafo = () => {
		if (parrafo.length) bloques.push({ tipo: 'parrafo', partes: enLinea(parrafo.join(' '), reglas) });
		parrafo = [];
	};
	const cerrarLista = () => {
		if (items.length) bloques.push({ tipo: 'lista', items });
		items = [];
	};

	for (const cruda of texto.split('\n')) {
		const l = cruda.trim();
		if (l === '') {
			cerrarParrafo();
			cerrarLista();
			continue;
		}
		const item = ITEM.exec(l);
		if (item) {
			cerrarParrafo();
			items.push(enLinea(item[1], reglas));
			continue;
		}
		cerrarLista();
		parrafo.push(l.replace(/^#{1,6}\s+/, ''));
	}
	cerrarParrafo();
	cerrarLista();

	return { bloques, fuentes: sacarFuentes(bloques, idioma) };
}
