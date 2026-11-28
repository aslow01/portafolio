// El sitio generado (dist/) frente a lo decidido para las direcciones viejas: `logistica`, `demos`,
// `contacto` y `proyectos` son redirecciones (meta refresh, noindex, canónica a «/», un enlace, sin script, fuera del
// sitemap); `proyectos/[slug]` y `formacion` no se generan; y el conjunto de páginas es exactamente el decidido.
// Se saltea sin dist/ (`npm run build`); `npm run prepublicar` lo exige.
// La tabla de redirecciones, `esRedireccion` y las páginas de src/pages están en scripts/redirecciones.test.mjs; el filtro
// del sitemap de astro.config.mjs, en scripts/indexado.test.mjs. Acá no se repiten.
// Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fichas } from '../src/v5/datos.ts';
import { CASOS_PUBLICADOS, cargarContenido, cargarDist, conDist, hayDist } from './dist.mjs';
import { fichasDe, problemasDeRedireccion, textoVisible } from './sitio-html.mjs';

const REDIRECCIONES = { '/logistica/': '/#logistica', '/demos/': '/#demos', '/contacto/': '/#contacto', '/proyectos/': '/#proyectos' };
// Rutas de la v4 que ya no existen como página: nadie del sitio debería enlazarlas.
const RUTAS_DE_LA_V4 = [...Object.keys(REDIRECCIONES), '/formacion/'];
// Los casos que se publican: la lista fija de scripts/dist.mjs, NO lo que diga el contenido (si no, un borrador publicado
// por error pasaría en verde).
const casosPublicados = CASOS_PUBLICADOS.map((slug) => `/casos/${slug}/`);
// La versión en inglés (/en/) repite las páginas que se indexan, con el mismo orden y los mismos ids de caso (scripts/en.test.mjs mira su contenido).
const enIngles = (rutas) => rutas.map((r) => `/en${r}`);
// Las cuatro puertas también existen en inglés (/en/demos/ → /en/#demos), con las mismas reglas.
const REDIRECCIONES_EN = Object.fromEntries(Object.entries(REDIRECCIONES).map(([r, d]) => [`/en${r}`, `/en/${d.slice(1)}`]));
const indexadas = ['/', '/tecnico/', '/casos/', ...casosPublicados];

const dist = hayDist ? cargarDist() : undefined;
const contenido = hayDist ? cargarContenido() : [];

test('cada ruta de la v4 absorbida es una redirección completa a su ficha (refresh, noindex, canónica a /, un enlace, sin scripts)', conDist, () => {
	const problemas = [];
	for (const [ruta, destino] of Object.entries(REDIRECCIONES)) {
		const p = dist.paginas.get(ruta);
		if (!p) {
			problemas.push(`${ruta}: no existe (debería ser una redirección)`);
			continue;
		}
		for (const m of problemasDeRedireccion(p, destino)) problemas.push(`${ruta}: ${m}`);
		if (!/\bIr a\b/.test(textoVisible(p.html))) problemas.push(`${ruta}: el único enlace no dice «Ir a <sección>»`);
	}
	assert.deepEqual(problemas, []);
});

test('en inglés, cada puerta es la misma redirección completa, hacia su ficha de /en/ (canónica a /en/, en inglés, con la imagen inglesa)', conDist, () => {
	const problemas = [];
	for (const [ruta, destino] of Object.entries(REDIRECCIONES_EN)) {
		const p = dist.paginas.get(ruta);
		if (!p) {
			problemas.push(`${ruta}: no existe (debería ser una redirección en inglés)`);
			continue;
		}
		for (const m of problemasDeRedireccion(p, destino, '/en/')) problemas.push(`${ruta}: ${m}`);
		if (!/<html lang="en"[ >]/.test(p.html)) problemas.push(`${ruta}: no dice lang="en"`);
		if (!/<meta property="og:locale" content="en_US"/.test(p.html)) problemas.push(`${ruta}: og:locale no es en_US`);
		if (!/^\/og\/en-/.test(new URL(p.meta.ogImagen).pathname)) problemas.push(`${ruta}: la imagen social no es la inglesa`);
		if (!/\bGo to\b/.test(textoVisible(p.html)) || /\bIr a\b|cambió de lugar/.test(textoVisible(p.html))) problemas.push(`${ruta}: el texto visible no está en inglés («Go to <sección>»)`);
		if (dist.sitemap.includes(ruta)) problemas.push(`${ruta}: está en el sitemap`);
	}
	assert.deepEqual(problemas, []);
});

test('cada redirección lleva a una ficha que existe en la portada', conDist, () => {
	const fichasDeLaPortada = fichasDe(dist.paginas.get('/').html).map((f) => `/#${f.id}`);
	assert.deepEqual(Object.values(REDIRECCIONES).filter((d) => !fichasDeLaPortada.includes(d)), []);
	assert.deepEqual(Object.values(REDIRECCIONES).sort(), fichas.map((f) => `/#${f.id}`).filter((d) => d !== '/#tecnico').sort());
});

test('las redirecciones no están en el sitemap', conDist, () => {
	assert.deepEqual(Object.keys(REDIRECCIONES).filter((r) => dist.sitemap.includes(r)), [], 'una redirección está en el sitemap');
});

test('el sitemap lista exactamente la portada, /tecnico/, el índice /casos/ y los casos publicados, en español y en inglés (/en/…)', conDist, () => {
	assert.deepEqual([...dist.sitemap].sort(), [...indexadas, ...enIngles(indexadas)].sort());
});

test('las bajas: no se genera formacion, ni proyectos/<slug>, ni ninguna página de proyecto', conDist, () => {
	assert.ok(!dist.paginas.has('/formacion/'), '/formacion/ sigue existiendo');
	const deProyectos = [...dist.paginas.keys()].filter((r) => r.startsWith('/proyectos/') && r !== '/proyectos/');
	assert.deepEqual(deProyectos, [], 'hay páginas /proyectos/<slug>/');
	for (const e of contenido.filter((x) => x.coleccion === 'proyectos')) {
		assert.ok(!dist.paginas.has(`/proyectos/${e.slug}/`), `/proyectos/${e.slug}/ sigue existiendo`);
	}
});

test('el conjunto de páginas del sitio es exactamente el de la especificación: portada, /tecnico/, el índice /casos/, casos publicados (en español y en inglés), las cuatro redirecciones (en los dos idiomas) y la 404', conDist, () => {
	const esperadas = [...indexadas, ...enIngles(indexadas), '/404.html', '/en/404.html', ...Object.keys(REDIRECCIONES), ...Object.keys(REDIRECCIONES_EN)];
	assert.deepEqual([...dist.paginas.keys()].sort(), esperadas.sort());
});

test('ninguna página que no sea una redirección enlaza a una ruta de la v4 (los enlaces internos van a /#ficha)', conDist, () => {
	const problemas = [];
	for (const [ruta, p] of dist.paginas) {
		if (ruta in REDIRECCIONES) continue;
		for (const e of p.enlaces) {
			const sinHash = e.href.split('#')[0];
			if (RUTAS_DE_LA_V4.includes(sinHash)) problemas.push(`${ruta}: enlaza a ${e.href}`);
		}
	}
	assert.deepEqual(problemas, []);
});
