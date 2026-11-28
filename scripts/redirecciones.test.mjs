// Las direcciones de la v4 que ya no tienen página propia: cuatro redirigen a su ficha
// de la portada y dos no se generan. Acá: la tabla (src/lib/redirecciones.ts) y los archivos de src/. Lo que sale en
// dist/ (refresh, noindex, canónica, sitemap, bajas) está en scripts/redirecciones-v5.test.mjs. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esRedireccion, redirecciones } from '../src/lib/redirecciones.ts';
import { fichas } from '../src/v5/datos.ts';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const ruta = (...partes) => join(raiz, ...partes);
const leer = (...partes) => readFileSync(ruta(...partes), 'utf8');

test('son las cuatro de la especificación, cada una hacia una ficha que existe', () => {
	assert.deepEqual(
		redirecciones.map((r) => [r.desde, r.ficha]),
		[
			['/logistica/', 'logistica'],
			['/demos/', 'demos'],
			['/contacto/', 'contacto'],
			['/proyectos/', 'proyectos'],
		],
	);
	for (const r of redirecciones) assert.ok(fichas.some((f) => f.id === r.ficha), r.ficha);
});

test('esRedireccion: con o sin barra final, con la URL completa; la portada y las páginas que siguen no', () => {
	assert.equal(esRedireccion('/demos/'), true);
	assert.equal(esRedireccion('/demos'), true);
	assert.equal(esRedireccion('https://matiasormeno.com.ar/contacto/'), true);
	for (const r of ['/', '/tecnico/', '/casos/', '/casos/automatizacion-facturas/', '/proyectos/afterfall/', '/formacion/']) {
		assert.equal(esRedireccion(r), false, r);
	}
});

test('esRedireccion: las cuatro puertas también lo son en inglés (/en/demos/); la portada, /en/tecnico/ y los casos en inglés no', () => {
	for (const r of ['/en/logistica/', '/en/demos', '/en/contacto/', '/en/proyectos/', 'https://matiasormeno.com.ar/en/demos/']) assert.equal(esRedireccion(r), true, r);
	for (const r of ['/en/', '/en/tecnico/', '/en/casos/', '/en/casos/automatizacion-facturas/']) assert.equal(esRedireccion(r), false, r);
});

test('esRedireccion: la consulta y el hash no cambian la respuesta', () => {
	assert.equal(esRedireccion('/proyectos/?x=1'), true);
	assert.equal(esRedireccion('/proyectos/#algo'), true);
	assert.equal(esRedireccion('/tecnico/?x=1#el-caso'), false);
});

test('cada dirección tiene su página y usa Redireccion con su ficha', () => {
	for (const r of redirecciones) {
		const nombre = r.desde.replace(/^\/|\/$/g, '');
		const pagina = [ruta('src', 'pages', `${nombre}.astro`), ruta('src', 'pages', nombre, 'index.astro')].find(existsSync);
		assert.ok(existsSync(pagina), `falta la página de ${r.desde}`);
		const t = readFileSync(pagina, 'utf8');
		assert.match(t, /import Redireccion from '[./]+\/v5\/Redireccion\.astro'/, r.desde);
		assert.match(t, new RegExp(`<Redireccion ficha="${r.ficha}" />`), r.desde);
	}
});

test('proyectos/[slug] y formacion no se generan', () => {
	assert.equal(existsSync(ruta('src', 'pages', 'formacion.astro')), false);
	assert.equal(existsSync(ruta('src', 'pages', 'proyectos', '[slug].astro')), false);
});

test('la redirección no carga el script de las pestañas ni lleva estilos en línea', () => {
	const t = leer('src', 'v5', 'Redireccion.astro');
	assert.doesNotMatch(t, /<script/);
	assert.doesNotMatch(t, /style="/);
	assert.match(t, /http-equiv="refresh"/);
	assert.match(t, /name="robots" content="noindex"/);
	assert.match(t, /rel="canonical"/);
});
