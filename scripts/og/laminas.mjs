// Las láminas de las imágenes para compartir (1200 × 630): la lista de lo que hay que dibujar, con todos los textos que
// la plantilla necesita. Puro: sin Playwright ni DOM, para que lo use el generador (generar.mjs) y la prueba (og.test.mjs).
// Los textos salen del sitio (src/lib/sitio.ts, src/v5/datos.ts y los casos de src/content/casos): nada de eso se escribe
// acá. Los únicos literales son los de las constantes de abajo, y og.test.mjs comprueba que cada uno siga en su página.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cifraVisible, esDeCamino, obraPrincipal } from '../../src/lib/contenido.ts';
import { esPublicable } from '../../src/lib/estados.ts';
import { minas, nombre, titular } from '../../src/lib/sitio.ts';
import { fichas } from '../../src/v5/datos.ts';
import { claseDeTono, expedientes } from '../../src/v5/interiores/archivo.ts';
import { carpetaDe, partirCifra, partirTitulo } from '../../src/v5/interiores/caso.ts';
import { leerBloque, leerFrontmatter } from '../frontmatter.mjs';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

// Los literales: cada uno copia lo que dice una página del sitio.
const TECNICO = { palabra: 'Desarrollo', resto: 'de software y automatización', linea: 'El importe, al centavo.' }; // tecnico.astro, Portada.astro
const LOGISTICA = { palabra: 'Logística', resto: 'y minería' }; // fichas/Logistica.astro
const CASOS = { rotulo: 'Archivo · casos anonimizados', palabra: 'Casos', resto: 'de estudio' }; // casos/index.astro
const ROTULO_CASO = 'Caso de estudio · anonimizado'; // interiores/Expediente.astro

/** Cuántos expedientes caben en la lámina del cajón. */
export const MAX_EN_CAJON = 6;

/**
 * Los expedientes que entran en la lámina del cajón y cuántos quedan afuera. Si hay más casos que lugares, no se recorta
 * en silencio: `laminas()` avisa por consola y `og.test.mjs` falla hasta que se agrande la lámina.
 */
export function recortarCajon(lista, max = MAX_EN_CAJON) {
	return { visibles: lista.slice(0, max), omitidos: Math.max(0, lista.length - max) };
}
/** Tamaño de arranque del título de la ficha de Técnico y de Logística (px). */
const TAMANO = { tecnico: 150, logistica: 170 };

/** «Vicuña, Veladero y Pachón» */
const enLista = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : (items[0] ?? ''));
const fichaDe = (id) => {
	const f = fichas.find((x) => x.id === id);
	if (!f) throw new Error(`Ficha desconocida: ${id}`);
	return f;
};
const datosDeFicha = (f) => ({ numero: f.numero, nombre: f.nombre, color: `c-${f.color}` });

/** Los casos de src/content/casos que se publican (`esPublicable` con `dev` en falso), con lo que las láminas necesitan. */
export function casosPublicados(carpeta = join(RAIZ, 'src', 'content', 'casos')) {
	const casos = [];
	for (const archivo of readdirSync(carpeta).filter((f) => f.endsWith('.md'))) {
		const texto = readFileSync(join(carpeta, archivo), 'utf8');
		const { datos, problemas } = leerFrontmatter(texto);
		const id = archivo.replace(/\.md$/, '');
		if (problemas.length > 0) throw new Error(`casos/${id}: ${problemas.join('; ')}`);
		const data = {
			titulo: datos.titulo,
			corte: datos.corte ? Number(datos.corte) : undefined,
			orden: Number(datos.orden),
			caminos: (datos.caminos ?? '').replace(/[[\]\s]/g, '').split(',').filter(Boolean),
			estado: datos.estado,
			borrador: datos.borrador === 'true',
			destacado: datos.destacado === 'true',
			contexto: datos.contexto,
			resultado: leerBloque(texto, 'resultado'),
		};
		if (esPublicable(data, false)) casos.push({ id, data });
	}
	return casos.sort((a, b) => a.data.orden - b.data.orden);
}

/** La lámina de la tapa de un caso (composición D). */
function laminaDeCaso({ id, data }) {
	const f = datosDeFicha(fichaDe(carpetaDe(data.caminos)));
	const { primera, resto } = partirTitulo(data.titulo, data.corte);
	const visible = cifraVisible(data.resultado);
	// La cifra va solo si tiene un dígito («Partes cargados en la app» no es una cifra) y siempre con su medición entera.
	const cifra = visible?.cifra && /\d/.test(visible.cifra) ? partirCifra(visible.cifra, visible.unidad, visible.medicion ?? '') : undefined;
	const alt = `${nombre.completo}. Caso de estudio anonimizado: ${data.titulo}.${cifra ? ` ${visible.cifra}${cifra.unidad ? ` ${cifra.unidad}` : ''}.` : ''}`;
	return {
		clave: `caso-${id}`,
		composicion: 'D',
		ficha: f,
		firma: nombre.completo,
		rotulo: ROTULO_CASO,
		palabra: primera,
		resto,
		contexto: data.contexto ?? '',
		...(cifra ? { cifra } : {}),
		alt,
	};
}

/**
 * Todas las láminas, en orden: portada, tecnico, logistica, casos y una `caso-<id>` por caso publicado.
 * Cada una es un objeto serializable (la huella sale de su JSON).
 */
export async function laminas() {
	const publicados = casosPublicados();
	const principal = obraPrincipal(publicados.filter((c) => esDeCamino(c.data, 'tecnico')));
	const { visibles: cajon, omitidos } = recortarCajon(expedientes(publicados, principal?.id, false, false));
	if (omitidos > 0) console.warn(`AVISO: la lámina del cajón tiene lugar para ${MAX_EN_CAJON} casos y hay ${omitidos} más sin dibujar: agrandar la lámina (scripts/og).`);
	const tecnico = fichaDe('tecnico');
	const logistica = fichaDe('logistica');

	return [
		{
			clave: 'portada',
			composicion: 'A',
			nombre: [nombre.primero, nombre.segundo, nombre.apellido],
			titular,
			bandas: fichas.map((f) => ({ numero: f.numero, corto: f.corto, color: `c-${f.color}`, asoma: f.id === 'tecnico' })),
			alt: `${nombre.completo}. ${titular}. Cinco pestañas de colores: ${enLista(fichas.map((f) => f.corto))}.`,
		},
		{
			clave: 'tecnico',
			composicion: 'B',
			variante: 'tecnico',
			ficha: datosDeFicha(tecnico),
			firma: nombre.completo,
			palabra: TECNICO.palabra,
			resto: TECNICO.resto,
			linea: TECNICO.linea,
			tamano: TAMANO.tecnico,
			alt: `${nombre.completo}. ${tecnico.nombre}: ${TECNICO.palabra.toLowerCase()} ${TECNICO.resto}. ${TECNICO.linea.replace(/\.$/, '')}: una diferencia de 0,01 resaltada.`,
		},
		{
			clave: 'logistica',
			composicion: 'B',
			variante: 'logistica',
			ficha: datosDeFicha(logistica),
			firma: nombre.completo,
			palabra: LOGISTICA.palabra,
			resto: LOGISTICA.resto,
			linea: minas.join(' · '),
			tamano: TAMANO.logistica,
			alt: `${nombre.completo}. ${logistica.nombre}: ${enLista(minas)}, sobre el dibujo de una cordillera.`,
		},
		{
			clave: 'casos',
			composicion: 'C',
			rotulo: CASOS.rotulo,
			palabra: CASOS.palabra,
			resto: CASOS.resto,
			firma: nombre.completo,
			expedientes: cajon.map((e) => ({ id: e.href.split('/')[2], numero: e.numero, titulo: e.titulo, clases: claseDeTono(e.tono) })),
			alt: `${nombre.completo}. Casos de estudio anonimizados, apilados como expedientes de colores.`,
		},
		...publicados.map(laminaDeCaso),
	];
}

/**
 * Los primeros 10 caracteres hexadecimales del SHA-256 de la lámina, la plantilla y la hoja: el nombre del archivo cambia
 * solo si cambia algo de lo que se ve (los rastreadores guardan la imagen por su dirección). 10 caracteres alcanzan para cambiar el nombre del archivo.
 */
export function huella(lamina, plantilla, css) {
	return createHash('sha256').update(JSON.stringify(lamina) + plantilla + css).digest('hex').slice(0, 10);
}
