import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { avisoDemo, laminas, prueba, urlHttps } from './lib/esquemas';

// Cada colección tiene su versión en inglés (`casos-en`, `demos-en`, `proyectos-en`, en src/content-en/): mismo esquema,
// mismos ids de archivo, y las referencias entre colecciones apuntan a la del mismo idioma.
type Sufijo = '' | '-en';
const carpeta = (nombre: string, sufijo: Sufijo): string => (sufijo === '' ? `./src/content/${nombre}` : `./src/content-en/${nombre}`);

// Recuadro "Mi parte y autoría" (tres filas). Una fila vacía no se muestra.
const autoria = z.object({
	yo: z.string().optional(),
	ia: z.string().optional(),
	verificacion: z.string().optional(),
});

const casos = (sufijo: Sufijo) =>
	defineCollection({
		loader: glob({ pattern: '**/*.md', base: carpeta('casos', sufijo) }),
		schema: z.object({
			titulo: z.string(),
			// Página de caso (v5): cuántas palabras del título van en el cartel pesado de la tapa; el resto, en liviano.
			// Sin dato, una (v5/interiores/caso.ts).
			corte: z.number().int().min(1).optional(),
			resumen: z.string(),
			caminos: z.array(z.enum(['logistica', 'tecnico'])).min(1),
			orden: z.number(),
			estado: z.enum(['borrador', 'publicado']),
			// Obra principal: dos oraciones, protagonista de la portada y fila de la ficha.
			regla: z.string().optional(),
			// Una línea de resultado para el índice /casos/: una frase corta tomada del propio caso, sin cifras que el caso no diga.
			resultadoCorto: z.string().optional(),
			// Filas de la ficha.
			uso: z.string().optional(),
			contexto: z.string().optional(),
			// Línea de contexto de la obra principal (portada y camino técnico), p. ej. "En uso diario: …".
			lineaObra: z.string().optional(),
			rol: z.string().optional(),
			// La cifra solo se muestra si tiene `medicion` (qué se midió y cuándo). Ver lib/contenido.ts.
			resultado: z
				.object({
					cifra: z.string().optional(),
					unidad: z.string().optional(),
					medicion: z.string().optional(),
				})
				.optional(),
			demo: reference(`demos${sufijo}`).optional(),
			// Marca la obra principal (si hay varios, el de menor `orden`).
			destacado: z.boolean().default(false),
			autoria: autoria.optional(),
		}),
	});

const demos = (sufijo: Sufijo) =>
	defineCollection({
		loader: glob({ pattern: '**/*.md', base: carpeta('demos', sufijo) }),
		schema: ({ image }) =>
			z.object({
				titulo: z.string(),
				resumen: z.string(),
				estado: z.enum(['en-preparacion', 'en-desarrollo', 'en-vivo']),
				orden: z.number(),
				subdominio: z.string().optional(),
				repo: urlHttps.optional(),
				demo: urlHttps.optional(),
				// Aviso visible en la ficha (una línea). Sin dato, no se muestra.
				aviso: avisoDemo.optional(),
				// Sin dato, la fila no va: lista vacía (nunca "[completar]").
				stack: z.array(z.string()).default([]),
				// Láminas (capturas claro/oscuro con texto alternativo): la primera es la principal.
				laminas: laminas(image()).default([]),
				// Extracto de una prueba de la demo, literal y comprobado contra su repositorio (npm test).
				prueba: prueba.optional(),
				caso: reference(`casos${sufijo}`).optional(),
				pruebaUrl: urlHttps.optional(),
				autoria: autoria.optional(),
			}),
	});

const proyectos = (sufijo: Sufijo) =>
	defineCollection({
		loader: glob({ pattern: '**/*.md', base: carpeta('proyectos', sufijo) }),
		schema: z.object({
			titulo: z.string(),
			tipo: z.enum(['novela', 'juego', 'otro']),
			resumen: z.string(),
			estado: z.enum(['en-preparacion', 'en-desarrollo', 'terminado']),
			orden: z.number(),
			// Dónde se muestra: las cartas de Proyectos o las piezas propias de /tecnico/.
			camino: z.enum(['proyectos', 'tecnico']).default('proyectos'),
			// Nombre corto (solapa del paginador, rótulo de la carta de atrás). Sin dato, el título.
			pagina: z.string().optional(),
			enlaces: z.array(z.object({ texto: z.string(), url: urlHttps })).optional(),
			borrador: z.boolean().default(false),
			autoria: autoria.optional(),
		}),
	});

export const collections = {
	casos: casos(''),
	demos: demos(''),
	proyectos: proyectos(''),
	'casos-en': casos('-en'),
	'demos-en': demos('-en'),
	'proyectos-en': proyectos('-en'),
};
