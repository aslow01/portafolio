// Ajustes de la segunda revisión (W6: código, accesibilidad y QA) que se pueden comprobar sin navegador. Lo que depende de
// verlo en pantalla lo mide `npm run verificar:paginas` y `npm run verificar:interacciones`. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { conDist, cargarDist, hayDist } from './dist.mjs';

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
const dist = hayDist ? cargarDist() : undefined;

/** Todos los archivos de texto de `src/` (el contenido y el código que puede nombrar una imagen). */
function textosDeSrc(ruta = 'src') {
	return readdirSync(new URL(`../${ruta}/`, import.meta.url), { withFileTypes: true }).flatMap((e) => {
		const r = `${ruta}/${e.name}`;
		if (e.isDirectory()) return e.name === 'assets' ? [] : textosDeSrc(r);
		return /\.(astro|ts|md|mjs|css)$/.test(e.name) ? [r] : [];
	});
}

test('A1 (accesibilidad): lo que recibe el foco no queda bajo el riel de lomos fijo (scroll-padding-bottom)', () => {
	assert.match(leer('src/styles/v5/sistema.css'), /html\s*\{\s*scroll-padding-bottom:\s*calc\(var\(--lomos\)\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\);\s*\}/);
});

test('LICENSE es la MIT sin agregados; NOTICE.md aclara que cubre el código y que textos e imágenes quedan con todos los derechos reservados', () => {
	const licencia = leer('LICENSE');
	assert.match(licencia, /^MIT License/);
	assert.doesNotMatch(licencia, /derechos reservados/);
	const aviso = leer('NOTICE.md');
	assert.match(aviso, /cubre solo el código/);
	assert.match(aviso, /todos los derechos reservados/);
});

test('sitio.ts no exporta tipos que nadie usa (ClaveImagen)', () => {
	assert.doesNotMatch(leer('src/lib/sitio.ts'), /ClaveImagen/);
});

test('A7 (accesibilidad): el texto alternativo de cada lámina de una demo es una o dos frases (hasta 200 caracteres)', () => {
	const carpeta = new URL('../src/content/demos/', import.meta.url);
	let vistos = 0;
	for (const archivo of readdirSync(carpeta).filter((n) => n.endsWith('.md'))) {
		for (const m of readFileSync(new URL(archivo, carpeta), 'utf8').matchAll(/^\s+alt:\s*"(.*)"\s*$/gm)) {
			vistos++;
			assert.ok(m[1].length <= 200, `${archivo}: el alt tiene ${m[1].length} caracteres`);
		}
	}
	assert.ok(vistos >= 3, 'no se leyó ningún alt: la prueba dejó de servir');
});

test('A6 (accesibilidad): el lomo de la carpeta de un caso no lleva aria-current (no es esta página); la marca es data-actual y se anuncia', () => {
	const lomos = leer('src/v5/Lomos.astro');
	assert.doesNotMatch(lomos, /'page' \| 'true'/);
	assert.match(lomos, /data-actual=/);
	assert.match(lomos, /carpeta de este caso/);
	assert.match(leer('src/styles/v5/sistema.css'), /\.lomos a:is\(\[aria-current\], \[data-actual\]\)/);
});

test('QA B4: toda captura de src/assets/capturas está nombrada en el contenido o en el código (ninguna queda huérfana)', () => {
	const textos = textosDeSrc().map(leer).join('\n');
	const huerfanas = readdirSync(new URL('../src/assets/capturas/', import.meta.url)).filter((nombre) => !textos.includes(nombre));
	assert.deepEqual(huerfanas, []);
});

test('QA B4 (dist): ningún PNG de captura queda suelto en dist/_astro (solo salen las versiones optimizadas)', conDist, () => {
	const sueltas = [...dist.archivos].filter((a) => /^\/_astro\/(flota|lector)-.*\.png$/.test(a));
	assert.deepEqual(sueltas, []);
});
