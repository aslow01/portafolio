// archivo.css se carga en /casos/ y también en cualquier página que muestre el «enlace al archivo» (/tecnico/, Logística y
// los casos). Una clase suelta de esa hoja (`.archivo { min-height: 100svh }`) que otra página use con otro fin le cambia el
// aspecto sin avisar: así quedó vacía la hoja «Ver la prueba completa» de /tecnico/. Esta prueba exige que las clases raíz
// de archivo.css solo aparezcan en las dos páginas que son dueñas de ese estilo. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const raiz = new URL('../', import.meta.url);
const leer = (ruta) => readFileSync(new URL(ruta, raiz), 'utf8');

const DUENAS = new Set(['src/pages/casos/index.astro', 'src/v5/EnlaceArchivo.astro']);

/** Clases que una hoja escribe sin ningún ancestro que las acote: la primera clase de cada selector. */
export function clasesRaiz(css) {
	const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
	const raices = new Set();
	for (const m of limpio.matchAll(/([^{}]+)\{/g)) {
		const preludio = m[1].trim();
		if (preludio.startsWith('@')) continue;
		for (const selector of preludio.split(',')) {
			const primera = selector.trim().match(/^\.([\w-]+)/);
			if (primera) raices.add(primera[1]);
		}
	}
	return raices;
}

/** Clases que un archivo .astro escribe en `class="…"` o en `class:list={[…]}`. */
export function clasesUsadas(astro) {
	const usadas = new Set();
	for (const m of astro.matchAll(/\bclass(?::list)?=("[^"]*"|\{[^}]*\})/g)) {
		for (const palabra of m[1].matchAll(/[A-Za-z_][\w-]*/g)) usadas.add(palabra[0]);
	}
	return usadas;
}

function astros(ruta) {
	return readdirSync(new URL(ruta, raiz), { withFileTypes: true }).flatMap((e) =>
		e.isDirectory() ? astros(`${ruta}${e.name}/`) : e.name.endsWith('.astro') ? [`${ruta}${e.name}`] : [],
	);
}

test('clasesRaiz: toma la primera clase de cada selector, también dentro de @media, y no las de los descendientes', () => {
	const css = '/* .nada { } */ .a, .b .c { x: 1 } @media (min-width: 1px) { .d > .e { y: 2 } } h1 .f { z: 3 }';
	assert.deepEqual([...clasesRaiz(css)].sort(), ['a', 'b', 'd']);
});

test('clasesUsadas: lee class y class:list', () => {
	const html = '<p class="uno dos"></p><li class:list={[\'tres\', { cuatro: x }]}></li>';
	const usadas = clasesUsadas(html);
	for (const c of ['uno', 'dos', 'tres', 'cuatro']) assert.ok(usadas.has(c), c);
});

test('las clases raíz de archivo.css solo las usan las páginas dueñas (casos/index y EnlaceArchivo)', () => {
	const raices = clasesRaiz(leer('src/styles/v5/archivo.css'));
	assert.ok(raices.size > 3, 'no se leyó ninguna clase de archivo.css: la prueba dejó de servir');
	assert.ok(!raices.has('archivo'), '`.archivo` es el nombre de la barra de archivo de las hojas de código: no puede ser una clase raíz');
	const choques = [];
	for (const ruta of astros('src/').filter((r) => !DUENAS.has(r))) {
		const usadas = clasesUsadas(leer(ruta));
		for (const c of raices) if (usadas.has(c)) choques.push(`${ruta}: .${c}`);
	}
	assert.deepEqual(choques, []);
});
