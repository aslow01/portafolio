// La presentación del asistente (la hoja de consulta): la bandera que la prende, los rótulos y lo que el build no puede llevar.
// Node puro: npm test. La interfaz en sí (foco, teclado, medidas) se mira en el navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configuracionConsulta, esModoPrueba } from '../src/v5/consulta/config.ts';
import { textosDe } from '../src/lib/asistente/textos.ts';
import { esDeCampo, esFalla, idiomaDe, quedanPocas, rotulosDe, textoContador } from '../src/v5/consulta/rotulos.ts';
import { DIST, conDist } from './dist.mjs';

const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
/** El código sin comentarios (los comentarios nombran lo que el código no hace). */
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
const CLAVES = ['red', 'tiempo', 'servicio', 'verificacion', 'limiteVisitante', 'limiteSesion', 'conversacionLarga', 'tope', 'largo', 'vacio'];
const SITEKEY = '0x4AAAAAAAbcdefghij';

test('bandera: en producción sin PUBLIC_ASISTENTE_URL el asistente NO se monta (el estado por defecto)', () => {
	assert.equal(configuracionConsulta({ dev: false }), null);
	assert.equal(configuracionConsulta({ dev: false, url: '', sitekey: SITEKEY }), null);
	assert.equal(configuracionConsulta({ dev: false, url: '   ' }), null);
});

test('bandera: en desarrollo sin URL se monta en modo simulado, sin red ni clave', () => {
	assert.deepEqual(configuracionConsulta({ dev: true }), { modo: 'simulado', api: '', sitekey: '' });
	assert.deepEqual(configuracionConsulta({ dev: true, url: '' }), { modo: 'simulado', api: '', sitekey: '' });
});

test('bandera: el modo simulado NUNCA sale de un build de producción, con o sin URL, válida o no', () => {
	for (const url of [undefined, '', 'http://localhost:8787', 'https://asistente.matiasormeno.com.ar', 'basura']) {
		const c = configuracionConsulta({ dev: false, url, sitekey: SITEKEY });
		assert.notEqual(c?.modo, 'simulado', String(url));
	}
});

test('bandera: con URL del Worker (https y sitekey) es real; un Worker local es prueba-local y solo en desarrollo', () => {
	assert.deepEqual(configuracionConsulta({ dev: false, url: 'https://asistente.matiasormeno.com.ar/', sitekey: SITEKEY }), {
		modo: 'real',
		api: 'https://asistente.matiasormeno.com.ar',
		sitekey: SITEKEY,
	});
	assert.equal(configuracionConsulta({ dev: true, url: 'http://localhost:8787' })?.modo, 'prueba-local');
	assert.equal(configuracionConsulta({ dev: false, url: 'http://localhost:8787' }), null);
});

test('bandera: una URL mal escrita o sin sitekey no prende el asistente (ni siquiera en desarrollo cae al simulado)', () => {
	assert.equal(configuracionConsulta({ dev: false, url: 'https://asistente.matiasormeno.com.ar' }), null);
	assert.equal(configuracionConsulta({ dev: true, url: 'basura' }), null);
	assert.equal(configuracionConsulta({ dev: false, url: 'http://asistente.matiasormeno.com.ar', sitekey: SITEKEY }), null);
});

test('el sello «modo de prueba» sale con las respuestas simuladas y con el Worker local; con el real, no', () => {
	assert.equal(esModoPrueba('simulado'), true);
	assert.equal(esModoPrueba('prueba-local'), true);
	assert.equal(esModoPrueba('real'), false);
	assert.equal(esModoPrueba(undefined), false);
});

test('rótulos: los dos idiomas tienen todo y ningún rótulo de error de respuesta está vacío', () => {
	for (const idioma of ['es', 'en']) {
		const r = rotulosDe(idioma);
		for (const [clave, valor] of Object.entries(r)) if (typeof valor === 'string') assert.ok(valor.trim() !== '', `${idioma}.${clave}`);
		for (const clave of CLAVES) {
			assert.ok(clave in r.rotuloError, `${idioma}: falta el rótulo de ${clave}`);
			if (!esDeCampo(clave)) assert.ok(r.rotuloError[clave].trim() !== '', `${idioma}.${clave}`);
		}
	}
	assert.equal(rotulosDe('es').palabra, 'Preguntar');
	assert.equal(rotulosDe('en').palabra, 'Ask');
});

test('errores: los límites y el tope son información (sin color de falla); lo demás, falla; largo y vacío van junto al campo', () => {
	for (const clave of ['limiteVisitante', 'limiteSesion', 'conversacionLarga', 'tope']) assert.equal(esFalla(clave), false, clave);
	for (const clave of ['red', 'tiempo', 'servicio', 'verificacion', 'largo', 'vacio']) assert.equal(esFalla(clave), true, clave);
	assert.deepEqual(CLAVES.filter(esDeCampo), ['largo', 'vacio']);
});

test('«quedan pocas» solo de 1 a 3 y con sesión; el contador del campo aparece desde los 400 caracteres', () => {
	assert.equal(quedanPocas(null), false);
	assert.equal(quedanPocas(0), false);
	assert.deepEqual([1, 2, 3, 4, 20].map(quedanPocas), [true, true, true, false, false]);
	assert.equal(textoContador(399, 500), null);
	assert.equal(textoContador(432, 500), '432 / 500');
	assert.equal(textoContador(50, 60), '50 / 60'); // máximo chico: desde el 80 %
	assert.equal(textoContador(10, 60), null);
});

test('idioma de la interfaz: el de <html lang>; lo desconocido, español', () => {
	assert.equal(idiomaDe('es-AR'), 'es');
	assert.equal(idiomaDe('en'), 'en');
	assert.equal(idiomaDe('EN-us'), 'en');
	assert.equal(idiomaDe('pt-BR'), 'es');
	assert.equal(idiomaDe(''), 'es');
});

test('la hoja arma todo con textContent: ningún HTML del asistente ni del visitante llega al DOM, y no guarda nada en el navegador', () => {
	for (const ruta of ['src/scripts/v5/consulta.ts', 'src/scripts/v5/consulta-motor.ts', 'src/scripts/v5/consulta-simulado.ts']) {
		const t = sinComentarios(leer(ruta));
		assert.doesNotMatch(t, /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/, ruta);
		assert.doesNotMatch(t, /\b(?:localStorage|sessionStorage)\b|document\.cookie/, ruta);
		assert.doesNotMatch(t, /target\s*=\s*["']?_blank|setAttribute\(\s*['"]style/i, ruta);
	}
});

test('el modo simulado solo se carga dentro de import.meta.env.DEV (Vite lo saca del build de producción)', () => {
	const motor = leer('src/scripts/v5/consulta-motor.ts');
	const importaciones = [...motor.matchAll(/import\(\s*['"][^'"]*consulta-simulado[^'"]*['"]\s*\)/g)];
	assert.equal(importaciones.length, 1, 'el módulo simulado se importa una sola vez y de forma dinámica');
	assert.doesNotMatch(motor, /^import\s[^;]*consulta-simulado/m, 'nunca con un import estático');
	const antes = motor.slice(0, importaciones[0].index);
	assert.match(antes.slice(antes.lastIndexOf("modo === 'simulado'")), /import\.meta\.env\.DEV/, 'la guarda de DEV va antes del import');
	assert.match(leer('src/layouts/BaseV5.astro'), /dev:\s*import\.meta\.env\.DEV/, 'la bandera recibe DEV del build, no un valor fijo');
});

test('la 404 apaga el asistente; /casos/ (la página a la que llega quien viene del CV) lo lleva, sin celda de paginador', () => {
	assert.match(leer('src/pages/404.astro'), /consulta=\{false\}/);
	assert.doesNotMatch(leer('src/pages/casos/index.astro'), /consulta=\{false\}/);
	const codigo = sinComentarios(leer('src/scripts/v5/consulta.ts'));
	assert.match(codigo, /querySelector\('\.archivo-cab'\)/, 'el lanzador se arma en la cabeza del índice de casos');
	assert.match(codigo, /const pieza = cabArchivo \? null/, 'sin paginador no hay celda');
});

function archivos(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? archivos(join(dir, e.name)) : [join(dir, e.name)]));
}

test('dist: ningún archivo publicado lleva el modo simulado (su dirección falsa ni sus escenarios)', conDist, () => {
	const malos = archivos(DIST)
		.filter((f) => /\.(?:js|html|css|map)$/.test(f))
		.filter((f) => /simulado\.invalid|escenarioDeLaDireccion|crearFetchSimulado/.test(readFileSync(f, 'utf8')));
	assert.deepEqual(malos, []);
});

test('dist: la 404 (en español y en inglés) nunca lleva el marcador del asistente, y ninguna página lo lleva si no hay `con-consulta`', conDist, () => {
	for (const ruta of ['404.html', 'en/404.html']) assert.doesNotMatch(readFileSync(join(DIST, ruta), 'utf8'), /consulta-raiz|con-consulta/, ruta);
	for (const ruta of ['index.html', 'tecnico/index.html', 'casos/index.html', 'en/casos/index.html']) {
		const html = readFileSync(join(DIST, ruta), 'utf8');
		assert.equal(/id="consulta-raiz"/.test(html), /<html[^>]*con-consulta/.test(html), `${ruta}: el marcador y la clase de <html> van juntos`);
	}
});

test('dist: con la bandera apagada no queda ni la hoja de estilos ni el script del asistente (ni huérfanos en _astro)', conDist, () => {
	const html = archivos(DIST).filter((f) => f.endsWith('.html'));
	if (html.some((f) => /<html[^>]*con-consulta/.test(readFileSync(f, 'utf8')))) return; // build con el asistente prendido: no aplica
	const rastros = archivos(DIST).filter((f) => /[\/]_astro[\/]consulta[^\/]*\.(?:css|js)$/i.test(f));
	assert.deepEqual(rastros, [], 'ningún archivo del asistente en dist/_astro');
	const enlazan = html.filter((f) => /_astro\/consulta/i.test(readFileSync(f, 'utf8')));
	assert.deepEqual(enlazan, [], 'ninguna página enlaza al asistente');
});

test('teclado: «Cerrar» es lo primero de la hoja en el DOM, como se ve (WCAG 2.4.3); el foco entra igual por el campo', () => {
	const codigo = sinComentarios(leer('src/scripts/v5/consulta.ts'));
	const montaje = codigo.match(/dlg\.append\(([^)]*)\)/);
	assert.ok(montaje, 'se encuentra dónde se arma la hoja');
	const orden = montaje[1].split(',').map((p) => p.trim());
	assert.equal(orden[0], 'cab', 'la cabeza (con «Cerrar») va primera en el DOM: coincide con el orden visual');
	assert.ok(orden.indexOf('cab') < orden.indexOf('form'), 'la cabeza va antes que el formulario');
	assert.doesNotMatch(leer('src/styles/v5/consulta.css'), /\.consulta-cabeza\s*\{[^}]*\border:/, 'ya no hace falta reordenar con CSS (el orden visual y el del DOM coinciden)');
	assert.match(codigo, /campo\.focus\(\{ preventScroll: true \}\);\s*ajustarCuerpoFocable\(\);/, 'al abrir, el foco va al campo');
});

test('invitación: va después de las acciones en el DOM, no hay saludo duplicado y el rótulo visible es «Pregunte, por ejemplo»', () => {
	const codigo = sinComentarios(leer('src/scripts/v5/consulta.ts'));
	assert.match(codigo, /querySelector\(':scope > \.acciones'\)/, 'la invitación se inserta tras las acciones (orden de lectura)');
	assert.doesNotMatch(codigo, /X\.saludo/, 'el saludo largo repetía el aviso de la bajada');
	assert.equal(rotulosDe('es').invita, 'Pregunte, por ejemplo:');
	assert.equal(rotulosDe('en').invita, 'Ask, for example:');
	assert.match(rotulosDe('es').bajada, /puede equivocarse/);
	assert.match(rotulosDe('en').bajada, /can make mistakes/);
});

test('css: los tokens que el asistente le cambia al sistema van con `html.con-consulta` (con `.con-consulta` solo, `:root` de tokens.css le gana por orden y el paginador no cede su columna)', () => {
	const css = sinComentarios(leer('src/styles/v5/consulta.css'));
	const sueltos = css.match(/(?:^|[\s,}])\.con-consulta\s*\{[^}]*--consulta-/g) ?? [];
	assert.deepEqual(sueltos, []);
	assert.match(css, /html\.con-consulta\s*\{[^}]*--consulta-ancho/);
	assert.doesNotMatch(css, /--consulta-alto-riel|--consulta-riel-alto/, 'el lanzador ya no vive en el riel: el riel vuelve a tener sus seis piezas');
});

// ---------- «La consulta a mano» (docs-asistente/destacado.md) ----------

test('lanzador: la frase entera y el nombre accesible contienen lo que se lee en pantalla (WCAG 2.5.3), en los dos idiomas', () => {
	const frases = { es: 'Pregúntele a mi asistente', en: 'Ask my assistant' };
	for (const idioma of ['es', 'en']) {
		const textos = textosDe(idioma, { correo: 'x@example.com', max: 500 });
		const r = rotulosDe(idioma);
		assert.equal(textos.lanzador, frases[idioma]);
		// El nombre de la frase entera (frase + complemento) y el de la forma corta (palabra + complemento)
		const nombreCompleto = textos.lanzador + r.complementoFrase;
		const nombreCorto = r.palabra + r.complementoLanzador;
		assert.ok(nombreCompleto.startsWith(textos.lanzador), idioma);
		assert.ok(nombreCorto.startsWith(r.palabra), idioma);
	}
	assert.equal(textosDe('es', { correo: 'x', max: 1 }).lanzador + rotulosDe('es').complementoFrase, 'Pregúntele a mi asistente de IA');
	assert.equal(textosDe('es', { correo: 'x', max: 1 }).lanzadorCorto + rotulosDe('es').complementoLanzador, 'Preguntar al asistente de IA');
	assert.equal(textosDe('en', { correo: 'x', max: 1 }).lanzador + rotulosDe('en').complementoFrase, 'Ask my assistant (AI)');
	assert.equal(textosDe('en', { correo: 'x', max: 1 }).lanzadorCorto + rotulosDe('en').complementoLanzador, 'Ask the AI assistant');
});

test('tokens: los del lanzador están en tokens.css (claro y oscuro) y ya no hay medidas del riel; consulta.css no suelta colores', () => {
	const tokens = leer('src/styles/v5/tokens.css');
	const [claro, oscuro] = tokens.split(":root[data-tema='oscuro']");
	for (const t of ['--consulta-lanzador', '--consulta-lanzador-texto', '--consulta-lanzador-hover', '--consulta-sello', '--consulta-sello-texto', '--consulta-filete']) {
		assert.match(claro, new RegExp(`${t}:`), `${t} en claro`);
		assert.match(oscuro, new RegExp(`${t}:`), `${t} en oscuro`);
	}
	for (const t of ['--consulta-lanzador-alto', '--consulta-barra', '--consulta-ficha-alto', '--consulta-asomo', '--consulta-asomo-espera']) assert.match(claro, new RegExp(`${t}:`), t);
	assert.doesNotMatch(tokens, /--consulta-riel-alto|--consulta-alto-riel/);
	assert.doesNotMatch(sinComentarios(leer('src/styles/v5/consulta.css')), /#[0-9a-f]{3,8}\b|rgba?\(/i, 'consulta.css usa tokens, no colores sueltos');
});

test('asomo: sin almacenamiento del navegador (la «sesión» se decide por la página de origen) y solo con movimiento permitido', () => {
	const codigo = sinComentarios(leer('src/scripts/v5/consulta.ts'));
	assert.match(codigo, /d\.referrer/);
	assert.match(codigo, /if \(llegadaNueva && conAnim\(\)\)/);
	assert.match(sinComentarios(leer('src/styles/v5/consulta.css')), /\.consulta-asomo\s*\{[^}]*animation:\s*consulta-asomo\s+var\(--consulta-asomo\)\s+var\(--rebote\)\s+var\(--consulta-asomo-espera\)/);
});

test('dist: el grupo de utilidades de la cabeza va en el orden visual (01–03: idioma y «Cerrar»; 04–05: «Cerrar» y idioma)', conDist, () => {
	const html = readFileSync(join(DIST, 'index.html'), 'utf8');
	const grupos = [...html.matchAll(/<section[^>]*class="([^"]*\bficha\b[^"]*)"[\s\S]*?<div class="(utiles[^"]*)">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="hojas">/g)];
	assert.equal(grupos.length, 5, 'las cinco fichas llevan su grupo');
	for (const [, clases, utiles, cuerpo] of grupos) {
		const alDerecho = /\bp[123]\b/.test(clases);
		assert.equal(utiles.includes('izq'), !alDerecho, clases);
		const iCerrar = cuerpo.indexOf('class="cerrar"');
		const iIdioma = cuerpo.indexOf('class="idioma"');
		assert.ok(iCerrar >= 0 && iIdioma >= 0, clases);
		assert.equal(iIdioma < iCerrar, alDerecho, `${clases}: el orden del DOM es el visual`);
	}
});

test('dist: la tapa de /tecnico/ lleva el marcador de la invitación y ninguna otra página lo lleva', conDist, () => {
	for (const ruta of ['tecnico/index.html', 'en/tecnico/index.html']) assert.match(readFileSync(join(DIST, ruta), 'utf8'), /data-consulta-invita/, ruta);
	for (const ruta of ['index.html', 'en/index.html']) assert.doesNotMatch(readFileSync(join(DIST, ruta), 'utf8'), /data-consulta-invita/, ruta);
});
