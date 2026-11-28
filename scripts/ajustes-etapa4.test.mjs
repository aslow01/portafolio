// Ajustes de la revisión de la etapa 4 (accesibilidad y código) que se pueden comprobar sin navegador: el nombre accesible
// de las capturas de Demos, el regreso de /tecnico/ sin JavaScript, el riel de lomos con zoom, el foco del salto, el tamaño
// del rótulo del reloj, el valor de `aria-current` de los lomos y los comentarios que no deben viajar al visitante.
// Lo que depende de verlo en pantalla lo mide `npm run verificar:paginas`. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { conDist, cargarDist, hayDist } from './dist.mjs';

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
const dist = hayDist ? cargarDist() : undefined;

test('A8: la captura que enlaza una demo se llama como su destino («Probar la demo: <título>»), sin la descripción de la lámina', () => {
	const demos = leer('src/v5/fichas/Demos.astro');
	// El «Probar la demo» sale del traductor (a pares con «Try the demo» en la versión en inglés).
	assert.match(demos, /alt=\{`\$\{t\('Probar la demo', 'Try the demo'\)\}: \$\{d\.data\.titulo\}`\}/);
	assert.doesNotMatch(demos, /Probar la demo'\)\}: \$\{d\.data\.titulo\}\./);
});

test('A8 (dist): ninguna captura de la portada que enlaza una demo tiene un nombre de más de 60 caracteres', conDist, () => {
	const portada = dist.paginas.get('/');
	const imagenes = portada.etiquetas.filter((e) => e.nombre === 'img' && /^Probar la demo/.test(e.attrs.alt ?? ''));
	assert.ok(imagenes.length > 0, 'no hay capturas que enlacen una demo: la prueba dejó de servir');
	for (const i of imagenes) assert.ok(i.attrs.alt.length <= 60, `el alt «${i.attrs.alt.slice(0, 40)}…» es demasiado largo`);
});

test('A9: sin JavaScript, «Cerrar» se oculta solo si no es un enlace de salida (/tecnico/ recupera su regreso)', () => {
	const css = leer('src/styles/v5/sistema.css');
	assert.match(css, /\.sin-js \.cerrar:not\(\[data-salir\]\)\s*\{\s*display:\s*none;?\s*\}/);
	assert.doesNotMatch(css, /\.sin-js \.cerrar\s*\{\s*display:\s*none/);
});

test('C17 (dist): «Cerrar» de /tecnico/ dice a dónde vuelve', conDist, () => {
	const html = dist.paginas.get('/tecnico/').html;
	assert.match(html, /<a class="cerrar"[^>]*href="\/#tecnico"[^>]*>\s*<span>Cerrar<\/span>\s*<span class="solo-lector">: volver a Técnico e IA en la portada<\/span>/);
});

test('A10: con poca altura (400 % de zoom) el riel de lomos se desplaza en vez de cortarse', () => {
	assert.match(leer('src/styles/v5/sistema.css'), /@media \(max-height: 300px\)\s*\{\s*\.lomos ol\s*\{\s*overflow-y:\s*auto;\s*\}\s*\}/);
});

test('A12: el destino del salto «Ir a las secciones» no dibuja un anillo alrededor de toda la pila', () => {
	assert.match(leer('src/styles/v5/portada.css'), /\.pila:focus-visible\s*\{\s*outline:\s*none;/);
});

test('A14: el rótulo «EN ARGENTINA» del reloj no baja de 13 px', () => {
	const linea = leer('src/pages/tecnico.astro').split('\n').find((l) => l.includes('.f-tecnico .reloj .rot'));
	assert.ok(linea, 'no está la regla del rótulo del reloj');
	assert.match(linea, /font-size:\s*13px/);
});

test('A17: el lomo de la ficha abierta es la página actual (aria-current="page"), como el paginador', () => {
	const js = leer('src/scripts/v5/pestanas.ts');
	assert.match(js, /a\.dataset\.lomo === id\) a\.setAttribute\('aria-current', 'page'\)/);
	assert.doesNotMatch(js, /setAttribute\('aria-current', 'true'\)/);
});

test('A15: al abrir una ficha el título del documento es el de la ficha y al cerrarla se restaura el original', () => {
	const js = leer('src/scripts/v5/pestanas.ts');
	assert.match(js, /const tituloOriginal = d\.title;/);
	assert.match(js, /d\.title = tituloConNombre\(o\.nombre, autor\.completo\);/);
	assert.match(js, /d\.title = tituloOriginal;/);
});

test('C13: lo que BaseV5 explica del código no viaja en el HTML de las páginas', conDist, () => {
	for (const [ruta, p] of dist.paginas) assert.doesNotMatch(p.html, /Precarga solo|crossorigin` hace falta/, `${ruta}: un comentario de código llegó al HTML`);
});

test('C12: el año del pie sale de la fecha de compilación, no se escribe a mano', () => {
	const contacto = leer('src/v5/fichas/Contacto.astro');
	assert.doesNotMatch(contacto, /© 2026/);
	assert.match(contacto, /© \{new Date\(\)\.getFullYear\(\)\}/);
});

test('C15: package.json es privado y declara su licencia; prepublicar dice qué no corre', () => {
	const paquete = JSON.parse(leer('package.json'));
	assert.equal(paquete.private, true);
	assert.equal(paquete.license, 'MIT');
	assert.match(leer('LICENSE'), /MIT License/);
	assert.match(leer('scripts/prepublicar.mjs'), /No corre `npm audit` ni `verificar:paginas`/);
});

/**
 * Referencias a documentos que no están en este repositorio (la carpeta `docs/` de la base de trabajo, la especificación
 * de diseño y el prototipo, privados): `docs/…`, secciones `§…` o `(11.5)`, códigos de hallazgos `(A11y D1-2)`,
 * `QA D1-M1`, y «prototipo aprobado» o «(privado)». Un lector externo no las puede seguir.
 */
export function referenciasPrivadas(texto) {
	const patrones = [/docs\/[\w.\-/]+/g, /§\s?\d/g, /\(1[01]\.\d+\)/g, /\bA11y [A-Z]\d?\b/g, /\bA11y D\d-\d\b/g, /\bQA D\d-[A-Z]\d\b/g, /prototipo aprobado/gi, /\(privado\)/gi];
	return patrones.flatMap((p) => [...texto.matchAll(p)].map((m) => m[0]));
}

test('C14: el detector de referencias privadas reconoce cada forma que se usó', () => {
	for (const texto of ['(§11.4)', 'sección §8.6', 'el enlace (11.5)', '(A11y D1-2)', '(A11y A5)', '(QA D1-M1)', 'prototipo aprobado (privado)', 'Prototipo aprobado, privado', 'ver docs/diseno.md']) {
		assert.notDeepEqual(referenciasPrivadas(texto), [], texto);
	}
	for (const texto of ['el 1 de 6 de la lista', 'se mide a 11.5 px', 'sin referencias', 'versión 1.5 del paquete']) {
		assert.deepEqual(referenciasPrivadas(texto), [], texto);
	}
});

test('C14: los comentarios del código no citan documentos privados (docs/…, §…, (11.x), A11y, prototipo aprobado, (privado))', () => {
	const carpetas = ['src', 'scripts', 'public', 'astro.config.mjs'];
	const hallados = [];
	const listar = (ruta) => {
		const absoluta = new URL(`../${ruta}`, import.meta.url);
		let entradas;
		try {
			entradas = readdirSync(absoluta, { withFileTypes: true });
		} catch {
			return [ruta]; // un archivo suelto
		}
		return entradas.flatMap((e) => (e.name === 'node_modules' ? [] : listar(`${ruta}/${e.name}`)));
	};
	for (const ruta of carpetas.flatMap(listar).filter((r) => /\.(astro|ts|mjs|css|md|html)$/.test(r) && !r.endsWith('ajustes-etapa4.test.mjs'))) {
		const texto = readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
		for (const hallazgo of referenciasPrivadas(texto)) hallados.push(`${ruta}: ${hallazgo}`);
	}
	assert.deepEqual(hallados, []);
});
