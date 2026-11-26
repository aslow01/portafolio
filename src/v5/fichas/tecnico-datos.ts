// Funciones puras que arman los textos y las cifras de la ficha Técnico y de la página /tecnico/ (web v5) a partir
// de lo que ya está escrito en src/content y src/lib. Acá no hay ningún texto nuevo: solo se parte, se ordena y se
// comprueba. Sin Astro, para poder probarlas con `npm test` (scripts/tecnico-v5.test.mjs).
import { cifraVisible, type Resultado } from '../../lib/contenido.ts';
import type { Paso } from '../../lib/circuito.ts';
import { minuscula } from '../../lib/presentacion.ts';

/** Parte un párrafo en oraciones (corta en «. », «? » o «! » seguido de mayúscula o comilla). */
export function frases(texto: string): string[] {
	return texto
		.trim()
		.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡“«"])/u)
		.map((f) => f.trim())
		.filter((f) => f !== '');
}

const mayuscula = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

export interface Jornada {
	antes: { cifra: string; marcas: number };
	ahora: { cifra: string; marcas: number };
	unidad: string;
	/** Qué se midió y cuándo (la cifra no se muestra sin esto: lib/contenido.ts). */
	medicion: string;
}

/** Rótulo visible de cada grupo de marcas: qué cuenta cada cifra («40» a mano, «300+» con el cargador). */
export const rotulosJornada = { antes: 'A mano', ahora: 'Con el cargador' } as const;

/**
 * «40 → 300+» partido en sus dos cifras, con la cantidad de marcas de cada una (una por factura). Devuelve
 * `undefined` si la cifra no se puede mostrar (sin `medicion`) o no tiene la forma «A → B».
 */
export function jornada(resultado: Resultado | undefined): Jornada | undefined {
	const r = cifraVisible(resultado);
	if (!r || !r.cifra) return undefined;
	const partes = r.cifra.split('→').map((p) => p.trim());
	if (partes.length !== 2 || partes.some((p) => p === '')) return undefined;
	const marcas = (c: string): number => Math.min(400, Math.max(0, parseInt(c, 10) || 0));
	return {
		antes: { cifra: partes[0], marcas: marcas(partes[0]) },
		ahora: { cifra: partes[1], marcas: marcas(partes[1]) },
		unidad: (r.unidad ?? '').trim(),
		medicion: (r.medicion ?? '').trim(),
	};
}

export interface FlujoDeAutoria {
	antes: string;
	pasos: string[];
	despues: string;
}

/**
 * El párrafo «Yo» de la autoría, partido donde nombra el flujo entre paréntesis: «…diseñé el flujo (a, b y c) y definí…»
 * pasa a «…diseñé el flujo:», la escalera a / b / c y «Definí…». No cambia palabras: solo la puntuación del corte
 * y la mayúscula inicial. Si el texto no tiene esa forma, devuelve `undefined` y la página muestra el párrafo entero.
 */
export function flujoDeAutoria(yo: string | undefined): FlujoDeAutoria | undefined {
	if (!yo) return undefined;
	const m = /^(.+?)\s*\(([^)]+)\)\s*(.*)$/s.exec(yo.trim());
	if (!m) return undefined;
	const pasos = m[2]
		.split(/\s*,\s*|\s+y\s+/)
		.map((p) => mayuscula(p.trim()))
		.filter((p) => p !== '');
	const despues = mayuscula(m[3].replace(/^y\s+/, '').trim());
	if (pasos.length < 2 || despues === '') return undefined;
	return { antes: `${m[1].replace(/[,;:]\s*$/, '')}:`, pasos, despues };
}

/** «Paso 5: compara el importe al centavo»: el nombre accesible de cada número del circuito. */
export function nombrePaso(i: number, paso: Paso): string {
	return `Paso ${i + 1}: ${minuscula(paso.titulo)}`;
}

const cardinales = ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
const ordinales = ['', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];

/** La leyenda de la tira de la tapa: los pasos salen de `circuitoLector`, nunca de un número escrito a mano. */
export function leyendaTira(pasos: Paso[]): string {
	const n = pasos.length;
	const base = `El circuito de una factura en la demo: ${cardinales[n] ?? n} pasos`;
	const compara = pasos.findIndex((p) => p.acercamiento);
	const decide = pasos[n - 1]?.persona === true;
	if (compara < 0 || !decide || !ordinales[compara + 1]) return `${base}.`;
	return `${base}; en el ${ordinales[compara + 1]} se compara el importe al centavo y el último lo decide una persona.`;
}

/** Las marcas del reloj de 24 horas (cada 15 grados), menos la de las 03:00 UTC, que la reemplaza la línea de corte. */
export function marcasReloj(): { x1: number; y1: number; x2: number; y2: number; mayor: boolean }[] {
	const r = (n: number): number => Math.round(n * 100) / 100;
	const out: { x1: number; y1: number; x2: number; y2: number; mayor: boolean }[] = [];
	for (let h = 0; h < 24; h++) {
		if (h === 3) continue;
		const a = (h * Math.PI) / 12;
		const mayor = h % 6 === 0;
		const dentro = mayor ? 98 : 106;
		out.push({
			x1: r(150 + 116 * Math.sin(a)),
			y1: r(150 - 116 * Math.cos(a)),
			x2: r(150 + dentro * Math.sin(a)),
			y2: r(150 - dentro * Math.cos(a)),
			mayor,
		});
	}
	return out;
}

/** Los cuatro casos de la prueba del importe. `fuente` es la parte del código de la que sale cada fila. */
export const casosCentavo = [
	{ planilla: '1.000,00', igual: false, sistema: '1.000,01', resultado: 'Otro importe', fuente: '1000.01' },
	{ planilla: '1.000,00', igual: false, sistema: '999,99', resultado: 'Otro importe', fuente: '999.99' },
	{ planilla: '0,1 + 0,2', igual: true, sistema: '0,3', resultado: 'Ya cargada: se compara en centavos enteros', fuente: '0.1 + 0.2' },
	{ planilla: '118.470,50', igual: true, sistema: '118.470,50', resultado: 'Ya cargada', fuente: '118470.5' },
] as const;

/** Las dos lecturas del reloj: la hora literal de la prueba y lo que dice. */
export const lecturasReloj = [
	{ hora: '02:59:59.999Z', texto: 'todavía es el 17/11.', fuente: ['02:59:59.999Z', '2026-11-17'] },
	{ hora: '03:00:00.000Z', texto: 'ya es el 18/11.', fuente: ['03:00:00.000Z', '2026-11-18'] },
] as const;

/** Falla el build si las filas escritas arriba ya no salen del código publicado de la prueba (la web no puede mostrar lo que la prueba no comprueba). */
export function comprobarContraCodigo(codigo: string, fuentes: readonly string[], donde: string): void {
	for (const f of fuentes) {
		if (!codigo.includes(f)) throw new Error(`${donde}: el código de la prueba ya no contiene «${f}»; hay que revisar la pieza.`);
	}
}
