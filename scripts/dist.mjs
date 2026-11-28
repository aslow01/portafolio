// Carga de dist/ (el build) y de src/content para las pruebas de estructura. Solo lectura. Lo usan las pruebas que
// miran el sitio generado (estructura-v5, circuito, sitio, indexado, redirecciones-v5): se saltean si no hay dist/ y
// fallan si no existe cuando se exige (EXIGIR_DIST=1, como hace `npm run prepublicar`).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esBorrador, leerFrontmatter } from './frontmatter.mjs';
import { analizarPagina, rutaDeArchivo, urlsDeSitemap } from './sitio-html.mjs';

export const RAIZ = fileURLToPath(new URL('..', import.meta.url));
export const DIST = join(RAIZ, 'dist');
export const hayDist = existsSync(DIST);
export const exigirDist = process.env.EXIGIR_DIST === '1';

/**
 * Los casos que se publican, escritos A MANO a propósito: las pruebas los comparan con el contenido (`estado:`) y con
 * dist/. Si salieran de leer el contenido, un borrador pasado a `publicado` por error pasaría todas las pruebas en
 * verde. Publicar otro caso exige tocar esta lista, y eso se ve en el diff (decisión de Matías, no del código).
 */
export const CASOS_PUBLICADOS = [
	'automatizacion-facturas',
	'sistema-gestion-operativa',
	'tableros-gerencia',
	'cargador-bajas',
	'capacitacion-ia-administracion',
	'reemplazo-erp-facturacion',
	'plataforma-multiempresa',
];
/** Opciones de `test()` para lo que necesita dist/: se saltea sin build (salvo que se exija; ver `dist existe…`). */
export const conDist = { skip: !hayDist && 'no hay dist/ (corra `npm run build`)' };

function listar(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listar(join(dir, e.name)) : [join(dir, e.name)]));
}

/**
 * Lee dist/: `paginas` (Map de ruta a `{ html, ...analizarPagina }`), `archivos` (todas las rutas de archivo, p. ej.
 * `/cv/a.pdf`), `sitemap` (rutas listadas en los sitemap-N.xml) y `existe(ruta)`.
 */
export function cargarDist() {
	const paginas = new Map();
	const archivos = new Set();
	const sitemap = [];
	for (const archivo of listar(DIST)) {
		const rel = relative(DIST, archivo);
		const ruta = '/' + rel.replaceAll('\\', '/');
		archivos.add(ruta);
		if (rel.endsWith('.html')) {
			const html = readFileSync(archivo, 'utf8');
			paginas.set(rutaDeArchivo(rel), { html, ...analizarPagina(html) });
		} else if (/^sitemap-\d+\.xml$/.test(rel)) {
			sitemap.push(...urlsDeSitemap(readFileSync(archivo, 'utf8')));
		}
	}
	const existe = (ruta) => paginas.has(ruta) || (!ruta.endsWith('/') && archivos.has(ruta));
	return { paginas, archivos, sitemap, existe };
}

/** Las entradas de src/content: `{ coleccion, slug, datos, borrador }` (con el lector de encabezados de verificar-borradores). */
export function cargarContenido() {
	const base = join(RAIZ, 'src', 'content');
	const entradas = [];
	for (const archivo of listar(base).filter((f) => f.endsWith('.md'))) {
		const [coleccion] = relative(base, archivo).split(/[\\/]/);
		const slug = relative(base, archivo).split(/[\\/]/).pop().replace(/\.md$/, '');
		const { datos, problemas } = leerFrontmatter(readFileSync(archivo, 'utf8'));
		if (problemas.length > 0) throw new Error(`${coleccion}/${slug}: ${problemas.join('; ')}`);
		entradas.push({ coleccion, slug, datos, borrador: esBorrador(datos) });
	}
	return entradas;
}
