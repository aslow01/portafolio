// Qué páginas se indexan: las redirecciones y la 404 llevan `noindex` y quedan fuera del sitemap; el resto se indexa.
// Node puro: npm test
// La lista de las redirecciones (src/lib/redirecciones.ts) se prueba en scripts/redirecciones.test.mjs. Lo que se comprueba
// sobre dist/ (sitemap y noindex coinciden, borradores) está en scripts/estructura-v5.test.mjs, y las redirecciones en
// dist/ en scripts/redirecciones-v5.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esRedireccion } from '../src/lib/redirecciones.ts';

test('las páginas que sí se indexan no son redirecciones: la portada, /tecnico/, el índice /casos/ y cada caso (con o sin barra final, y con la URL completa)', () => {
	for (const ruta of ['/', '/tecnico/', '/tecnico', '/casos/', '/casos', '/casos/automatizacion-facturas/', '/casos/automatizacion-facturas']) {
		assert.equal(esRedireccion(ruta), false, ruta);
		assert.equal(esRedireccion(`https://matiasormeno.com.ar${ruta}`), false, `URL completa: ${ruta}`);
	}
});

test('astro.config.mjs saca del sitemap las redirecciones: el filtro usa esRedireccion', () => {
	const config = readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8');
	assert.match(config, /import\s*\{[^}]*\besRedireccion\b[^}]*\}\s*from\s*['"]\.\/src\/lib\/redirecciones/);
	assert.match(config, /sitemap\(\s*\{[^}]*\bfilter\s*:[^}]*!\s*esRedireccion\(/, 'el sitemap no filtra con esRedireccion');
});

test('BaseV5 sabe poner noindex (lo usa la 404) y la 404 lo pide', () => {
	const base = readFileSync(new URL('../src/layouts/BaseV5.astro', import.meta.url), 'utf8');
	assert.match(base, /noindex/);
	assert.match(base, /<meta name="robots" content="noindex"/);
	assert.match(readFileSync(new URL('../src/pages/404.astro', import.meta.url), 'utf8'), /^\s*noindex\s*$/m);
});
