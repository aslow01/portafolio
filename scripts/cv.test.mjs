// Los dos CV públicos en PDF (public/cv/): cargados en src/lib/datos-pendientes.ts, con el detalle real (páginas y peso),
// enlazados desde la web y sin ningún CV privado en la carpeta. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cv, cvDe, cvEn, cvEnEspanol } from '../src/lib/datos-pendientes.ts';
import { RAIZ, cargarDist, conDist } from './dist.mjs';

const CARPETA = join(RAIZ, 'public', 'cv');
const ARCHIVOS = { logistica: '/cv/matias-ormeno-cv-logistica.pdf', tecnico: '/cv/matias-ormeno-cv-tecnico.pdf' };
// El CV técnico en inglés (el de /en/): existe solo para ese camino; el de logística en inglés todavía no.
const ARCHIVO_EN = '/cv/matias-ormeno-cv-technical-en.pdf';
const leerPdf = (archivo) => readFileSync(join(RAIZ, 'public', ...archivo.split('/').filter(Boolean)));

test('cada camino tiene su CV cargado, con la ruta pública de public/cv/', () => {
	for (const [camino, archivo] of Object.entries(ARCHIVOS)) {
		assert.ok(cv[camino], `cv.${camino} está en null`);
		assert.equal(cv[camino].archivo, archivo, camino);
	}
});

test('los PDF existen, son PDF de verdad y el detalle que se muestra dice sus páginas y su peso reales', () => {
	for (const [camino, datos] of Object.entries(cv)) {
		const bytes = leerPdf(datos.archivo);
		assert.equal(bytes.subarray(0, 5).toString('latin1'), '%PDF-', `${camino}: no empieza con %PDF-`);
		const paginas = [...bytes.toString('latin1').matchAll(/\/Type\s*\/Page(?![s\w])/g)].length;
		const kb = Math.round(bytes.length / 1024);
		const esperado = `PDF · ${paginas} ${paginas === 1 ? 'página' : 'páginas'} · ${kb} KB`;
		assert.equal(datos.detalle, esperado, `${camino}: el detalle no coincide con el archivo`);
	}
});

test('en public/cv/ solo están los CV públicos (los dos en español y el técnico en inglés): ningún CV privado viaja a la web', () => {
	assert.deepEqual(
		readdirSync(CARPETA).sort(),
		[...Object.values(ARCHIVOS), ARCHIVO_EN].map((a) => a.replace('/cv/', '')).sort(),
	);
});

test('la versión en inglés: el CV técnico es el PDF en inglés (con su detalle real) y el de logística, el de español avisado como «Spanish»', () => {
	assert.equal(cvEn.tecnico?.archivo, ARCHIVO_EN);
	assert.equal(cvEn.logistica?.archivo, cv.logistica?.archivo, 'el CV de logística en inglés todavía no existe: apunta al de español');
	for (const [camino, datos] of Object.entries(cvEn)) {
		const bytes = leerPdf(datos.archivo);
		assert.equal(bytes.subarray(0, 5).toString('latin1'), '%PDF-', `${camino}: no empieza con %PDF-`);
		const paginas = [...bytes.toString('latin1').matchAll(/\/Type\s*\/Page(?![s\w])/g)].length;
		const kb = Math.round(bytes.length / 1024);
		assert.equal(datos.detalle, `PDF · ${paginas} ${paginas === 1 ? 'page' : 'pages'} · ${kb} KB`, `${camino}: el detalle en inglés no coincide con el archivo`);
	}
	assert.equal(cvDe('en'), cvEn);
	assert.equal(cvDe('es'), cv);
	// «(Spanish)» solo donde el PDF está en español y la página es la inglesa.
	assert.equal(cvEnEspanol('logistica', 'en'), true);
	assert.equal(cvEnEspanol('tecnico', 'en'), false);
	assert.equal(cvEnEspanol('logistica', 'es'), false);
	assert.equal(cvEnEspanol('tecnico', 'es'), false);
});

test('dist: cada CV está en dist/ y cada enlace de descarga (con download) apunta a un archivo que existe', conDist, () => {
	const dist = cargarDist();
	for (const datos of [...Object.values(cv), cvEn.tecnico]) assert.ok(dist.archivos.has(datos.archivo), `${datos.archivo} no está en dist/`);
	const enlazados = new Set();
	for (const [ruta, p] of dist.paginas) {
		for (const e of p.enlaces.filter((x) => /\.pdf(?:$|[?#])/i.test(x.href))) {
			assert.ok(e.descarga, `${ruta}: ${e.href} sin download`);
			assert.ok(dist.archivos.has(e.href), `${ruta}: ${e.href} no existe en dist/`);
			enlazados.add(e.href);
		}
	}
	assert.deepEqual([...enlazados].sort(), [...Object.values(ARCHIVOS), ARCHIVO_EN].sort(), 'cada CV debe estar enlazado desde alguna página');
});
