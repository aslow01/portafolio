// Las imágenes para compartir (public/og/*.png): las que están generadas son exactamente las que el contenido de hoy pide,
// con el nombre que lleva la huella de su contenido, de la medida y el peso correctos, sin datos privados, y la plantilla
// sigue diciendo lo que dice el sitio. No usa Playwright: solo lee archivos. Node puro: npm test
// Si falla por «desactualizadas»: node scripts/og/generar.mjs (ver el encabezado de ese archivo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imagenesSociales } from '../src/lib/imagenes-sociales.ts';
import { datosPrivados } from './higiene.mjs';
import { MAX_EN_CAJON, huella, laminas, recortarCajon } from './og/laminas.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');
const plantilla = leer('scripts', 'og', 'plantilla.html');
const css = leer('scripts', 'og', 'og.css');
const DESACTUALIZADAS = 'Imágenes para compartir desactualizadas: correr node scripts/og/generar.mjs';
const MAX_BYTES = 200 * 1024;

const lista = await laminas();

test('las imágenes generadas son exactamente las láminas de hoy: portada, tecnico, logistica, casos y una por caso publicado', () => {
	const pedidas = lista.map((l) => l.clave).sort();
	const generadas = Object.keys(imagenesSociales).sort();
	for (const base of ['portada', 'tecnico', 'logistica', 'casos']) assert.ok(pedidas.includes(base), `laminas() no trae «${base}»`);
	assert.ok(pedidas.filter((c) => c.startsWith('caso-')).length >= 1, 'laminas() no trae ningún caso');
	assert.deepEqual(generadas, pedidas, DESACTUALIZADAS);
});

test('cada archivo se llama como su lámina y la huella de hoy (un título cambiado sin regenerar se nota); el alt es el de hoy', () => {
	for (const l of lista) {
		const hoy = `/og/${l.clave}-${huella(l, plantilla, css)}.png`;
		assert.equal(imagenesSociales[l.clave]?.archivo, hoy, `${l.clave}: ${DESACTUALIZADAS}`);
		assert.equal(imagenesSociales[l.clave]?.alt, l.alt, `${l.clave}: el texto alternativo cambió. ${DESACTUALIZADAS}`);
	}
});

test('la huella son 10 caracteres hexadecimales y cambia con cualquier dato', () => {
	const l = { clave: 'x', alt: 'a' };
	assert.match(huella(l, 'p', 'c'), /^[0-9a-f]{10}$/);
	assert.equal(huella(l, 'p', 'c'), huella({ ...l }, 'p', 'c'));
	assert.notEqual(huella(l, 'p', 'c'), huella({ ...l, alt: 'b' }, 'p', 'c'));
	assert.notEqual(huella(l, 'p', 'c'), huella(l, 'p2', 'c'));
	assert.notEqual(huella(l, 'p', 'c'), huella(l, 'p', 'c2'));
});

test('cada PNG existe, empieza con la firma PNG, mide 1200 × 630 y pesa 200 KB como máximo; no hay otros archivos en public/og/', () => {
	const carpeta = join(RAIZ, 'public', 'og');
	assert.ok(existsSync(carpeta), `no existe public/og/. ${DESACTUALIZADAS}`);
	for (const [clave, { archivo }] of Object.entries(imagenesSociales)) {
		const ruta = join(RAIZ, 'public', archivo);
		assert.ok(existsSync(ruta), `${clave}: falta ${archivo}. ${DESACTUALIZADAS}`);
		const bytes = readFileSync(ruta);
		assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${archivo} no es un PNG`);
		assert.equal(bytes.readUInt32BE(16), 1200, `${archivo}: el ancho no es 1200`);
		assert.equal(bytes.readUInt32BE(20), 630, `${archivo}: el alto no es 630`);
		assert.ok(statSync(ruta).size <= MAX_BYTES, `${archivo} pesa ${Math.round(statSync(ruta).size / 1024)} KB (máximo 200)`);
	}
	const esperados = Object.values(imagenesSociales).map((i) => i.archivo.replace('/og/', '')).sort();
	assert.deepEqual(readdirSync(carpeta).sort(), esperados, 'hay archivos de más en public/og/');
});

test('el texto de las láminas (lo que se dibuja y los alt) no trae datos privados: un PNG no lo revisa ninguna búsqueda', () => {
	const rutaLocal = join(RAIZ, 'scripts', 'higiene.local.json');
	const extra = existsSync(rutaLocal) ? JSON.parse(readFileSync(rutaLocal, 'utf8')) : {};
	assert.deepEqual(datosPrivados(JSON.stringify(lista), { extra }), []);
});

test('los literales de la plantilla siguen escritos en su página de src/ (si el sitio cambia, la imagen no queda diciendo otra cosa)', () => {
	// [lo que dice la página, la página, lo que dibuja la lámina si no es la misma frase]
	const fuentes = [
		['de software y automatización', 'src/pages/tecnico.astro'],
		// «Con IA · remoto» resume la etiqueta de la pestaña («e IA · … · remoto»): si cambia cualquiera de las dos puntas, hay que mirar la lámina
		['>e IA<', 'src/v5/Portada.astro', 'Con IA'],
		['· remoto', 'src/v5/Portada.astro'],
		['y minería', 'src/v5/fichas/Logistica.astro'],
		['Archivo · casos anonimizados', 'src/pages/casos/index.astro'],
		['Caso de estudio · anonimizado', 'src/v5/interiores/Expediente.astro'],
	];
	for (const [frase, ruta] of fuentes) {
		assert.ok(leer(...ruta.split('/')).toLowerCase().includes(frase.toLowerCase()), `«${frase}» ya no está en ${ruta}`);
	}
	// Y la lámina los usa tal cual.
	const texto = JSON.stringify(lista).toLowerCase();
	for (const [frase, , enLamina = frase] of fuentes) assert.ok(texto.includes(enLamina.toLowerCase()), `ninguna lámina dice «${enLamina}»`);
});

// --- Los colores de og.css son los de tokens.css ----------------------------------------------------------------

/** Reglas simples (`:root` o `.c-algo`) de una hoja: Map de «selector → nombre → valor», sin comentarios ni espacios de más. */
function variables(hoja) {
	const reglas = new Map();
	const sinComentarios = hoja.replace(/\/\*[\s\S]*?\*\//g, '');
	for (const m of sinComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const selector = m[1].trim();
		if (selector !== ':root' && !/^\.c-[a-z]+$/.test(selector)) continue;
		const mapa = reglas.get(selector) ?? new Map();
		for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) mapa.set(d[1], d[2].replace(/\s+/g, ' ').trim());
		reglas.set(selector, mapa);
	}
	return reglas;
}

test('las variables de og.css con el mismo nombre que en tokens.css (:root y las clases .c-*) valen lo mismo', () => {
	const tokens = variables(leer('src', 'styles', 'v5', 'tokens.css'));
	const copia = variables(css);
	let comparadas = 0;
	const distintas = [];
	for (const [selector, mapa] of copia) {
		for (const [nombre, valor] of mapa) {
			const original = tokens.get(selector)?.get(nombre);
			if (original === undefined) continue;
			comparadas++;
			if (original !== valor) distintas.push(`${selector} ${nombre}: og.css dice «${valor}» y tokens.css «${original}»`);
		}
	}
	assert.ok(comparadas >= 20, `se compararon solo ${comparadas} variables: la prueba dejó de servir`);
	assert.deepEqual(distintas, []);
});

test('la plantilla y la hoja no cargan nada de afuera ni usan innerHTML', () => {
	assert.doesNotMatch(plantilla + css, /https?:\/\/|innerHTML|<script/i);
	assert.match(css, /url\('\.\.\/\.\.\/public\/fonts\/bricolage-grotesque-latin-v1\.woff2'\)/);
	assert.match(css, /url\('\.\.\/\.\.\/public\/fonts\/schibsted-grotesk-latin-v1\.woff2'\)/);
});

test('la lámina del cajón dibuja todos los casos publicados (si hay más que lugares, se agranda la lámina: no se recorta en silencio)', () => {
	const casos = lista.filter((l) => l.clave.startsWith('caso-')).length;
	const cajon = lista.find((l) => l.clave === 'casos');
	assert.equal(cajon.expedientes.length, casos, 'hay casos publicados que la lámina del cajón no dibuja');
	assert.ok(casos <= MAX_EN_CAJON);
});

test('recortarCajon: devuelve lo que entra y cuántos quedan afuera, sin cambiar la lista', () => {
	const siete = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
	assert.deepEqual(recortarCajon(siete, 6), { visibles: ['a', 'b', 'c', 'd', 'e', 'f'], omitidos: 1 });
	assert.deepEqual(recortarCajon(siete.slice(0, 3), 6), { visibles: ['a', 'b', 'c'], omitidos: 0 });
	assert.equal(siete.length, 7);
});

test('generar.mjs solo borra PNG viejos de public/og/ (nunca otro tipo de archivo)', () => {
	assert.match(leer('scripts', 'og', 'generar.mjs'), /readdirSync\(carpeta\)\.filter\(\(f\) => f\.endsWith\('\.png'\) && !vigentes\.has\(f\)\)/);
});
