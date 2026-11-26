// Piezas de esquema compartidas por las colecciones (src/content.config.ts).
import { z } from 'astro/zod';

/** Dirección externa: solo `https`. Rechaza http, javascript:, data:, mailto: y similares. */
export const urlHttps = z.url({ protocol: /^https$/ });

const textoLleno = z.string().trim().min(1);

/** Aviso corto de una demo (una línea, p. ej. "Interfaz en rediseño"); la ficha lo muestra tal cual. */
export const avisoDemo = textoLleno.max(120);

/**
 * Lámina de una demo. `imagen` es el `image()` de Astro en el
 * sitio; se recibe como parámetro para poder probar el esquema sin Astro. Sin `alt`, el build falla.
 */
export function crearLamina<T extends z.ZodType>(imagen: T) {
	return z.object({
		id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'minúsculas, números y guiones'),
		clara: imagen,
		/** Recorte para pantallas de menos de 640 px (para teléfonos): mismo contenido, proporción distinta. */
		movil: z.object({ clara: imagen }).optional(),
		alt: textoLleno,
		pie: textoLleno,
		procedencia: textoLleno,
	});
}

/** Lista de láminas de una demo: la primera es la principal; los `id` no se repiten. */
export function laminas<T extends z.ZodType>(imagen: T) {
	return z.array(crearLamina(imagen)).refine((l) => new Set(l.map((x) => x.id)).size === l.length, {
		message: 'dos láminas con el mismo id',
	});
}

/** Máximo de líneas de un extracto de prueba: es un ejemplo, no el archivo. */
export const MAX_LINEAS_EXTRACTO = 30;

/** Ruta relativa dentro del repositorio de la demo: sin `..`, sin raíz, sin unidad, sin barras invertidas. */
const rutaEnRepo = z
	.string()
	.min(1)
	.max(200)
	.refine(
		(r) =>
			!r.startsWith('/') && !r.includes('\\') && !r.includes(':') && !r.split('/').some((p) => p === '..' || p === ''),
		'ruta relativa al repositorio, sin .. ni raíz',
	);

/**
 * Extracto de una prueba de la demo. `codigo` es el texto
 * literal de las líneas `desde`–`hasta` de `archivo`, sin la sangría común; `npm test` lo compara
 * contra el repositorio de la demo cuando está disponible (scripts/extracto.test.mjs).
 */
export const prueba = z
	.object({
		archivo: rutaEnRepo,
		desde: z.number().int().min(1),
		hasta: z.number().int().min(1),
		codigo: z
			.string()
			.max(4000)
			.refine((c) => c.trim() !== '', 'el código no puede estar en blanco'),
		/** Quién hizo qué en esta prueba: se muestra tal cual, siempre. */
		autoria: textoLleno,
		/** La regla de negocio que comprueba, en castellano (se muestra junto al código). */
		regla: textoLleno,
		/** Qué dice la prueba, en una línea de castellano. */
		queDice: textoLleno,
		/** Una frase corta para la ficha de la demo ("El importe se compara sin tolerancia"). */
		titular: textoLleno,
		/** Commit del repositorio de la demo donde están esas líneas (hash de git). Si está, el control compara contra él. */
		commit: z.string().regex(/^[0-9a-f]{7,40}$/, 'hash de git en minúsculas (7 a 40 caracteres)').optional(),
	})
	.superRefine((p, ctx) => {
		if (p.hasta < p.desde) {
			ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'hasta no puede ser menor que desde' });
			return;
		}
		const esperadas = p.hasta - p.desde + 1;
		if (esperadas > MAX_LINEAS_EXTRACTO) {
			ctx.addIssue({ code: 'custom', path: ['hasta'], message: `más de ${MAX_LINEAS_EXTRACTO} líneas` });
		}
		// Una línea final vacía de más (típica del bloque `|` de YAML) no cuenta.
		const reales = p.codigo.replace(/\r?\n$/, '').split(/\r?\n/).length;
		if (reales !== esperadas) {
			ctx.addIssue({
				code: 'custom',
				path: ['codigo'],
				message: `el código tiene ${reales} líneas y el rango ${p.desde}–${p.hasta} son ${esperadas}`,
			});
		}
	});
