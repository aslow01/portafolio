// La lámina `atencion` de la demo del lector (especificación de diseño de la versión 4, privada): assets y frontmatter. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const md = readFileSync(new URL('../src/content/demos/lector-facturas.md', import.meta.url), 'utf8');
const encabezado = md.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1];

test('el PNG de la lámina existe y no está vacío', () => {
	const ruta = new URL('../src/assets/capturas/lector-atencion-clara.png', import.meta.url);
	assert.ok(existsSync(ruta), 'falta lector-atencion-clara.png');
	assert.ok(statSync(ruta).size > 1000);
	assert.equal(readFileSync(ruta).subarray(1, 4).toString(), 'PNG');
});

test('la lámina atencion está al final de las láminas; la primera es `celular` y ya no hay una lámina sin uso (resultado-planilla)', () => {
	const ids = [...encabezado.matchAll(/^ {2}- id: ([\w-]+)$/gm)].map((m) => m[1]);
	assert.equal(ids[0], 'celular');
	assert.ok(!ids.includes('resultado-planilla'), 'la lámina resultado-planilla no la usa ninguna página');
	assert.equal(ids.at(-1), 'atencion');
	assert.equal(ids.filter((i) => i === 'atencion').length, 1);
});

test('la lámina atencion tiene sus imágenes, alt, pie y procedencia', () => {
	const bloque = encabezado.split(/^ {2}- id: atencion$/m)[1].split(/^\S/m)[0];
	assert.match(bloque, /clara: \.\.\/\.\.\/assets\/capturas\/lector-atencion-clara\.png/);
	assert.doesNotMatch(bloque, /oscura:/);
	assert.match(bloque, /alt: "Captura de la demo, lista Requieren atención: 3 para revisar, 2 mal cargadas, 1 duplicada en la planilla, 1 cargada dos veces en el sistema y 2 cargadas en el sistema y no recibidas\."/);
	assert.match(bloque, /pie: "Lo que la demo pide revisar\."/);
	assert.match(bloque, /procedencia: "Captura de la demo, escrita desde cero con datos inventados\."/);
});
