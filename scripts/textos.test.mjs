// Guardas de redacción sobre lo que se publica (src/). Node puro: npm test
//
// La demo es una obra propia, escrita desde cero, sobre el mismo tipo de problema que el caso de estudio.
// Decir que "reproduce" el sistema de la empresa sugiere una obra derivada (cláusula OCTAVA del contrato),
// así que esa palabra no puede volver al sitio. Formulación correcta, p. ej.: "una demo propia, escrita
// desde cero, sobre el mismo tipo de problema".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src', import.meta.url));

function listar(dir) {
	return readdirSync(dir).flatMap((n) => {
		const ruta = join(dir, n);
		return statSync(ruta).isDirectory() ? listar(ruta) : [ruta];
	});
}

test('ningún texto de src/ dice que la demo "reproduce" (ni "reproducen" ni "reproducir") el sistema de la empresa', () => {
	const hallazgos = [];
	for (const archivo of listar(src).filter((f) => /\.(astro|md|ts|mjs|json)$/.test(f))) {
		const lineas = readFileSync(archivo, 'utf8').split(/\r?\n/);
		lineas.forEach((l, i) => {
			if (/\breproduc(e|en|ir)\b/i.test(l)) hallazgos.push(`${archivo.slice(src.length + 1)}:${i + 1}: ${l.trim()}`);
		});
	}
	assert.deepEqual(hallazgos, []);
});
