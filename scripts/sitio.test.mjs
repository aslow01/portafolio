// Datos compartidos del sitio (src/lib/sitio.ts) y la regla de que cada afirmación se escribe una sola vez: en todo
// src/ (páginas, fichas de la v5, componentes, disposiciones), no solo en las páginas. Y que lo publicado en dist/
// salga de esas fuentes. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	comoTrabajo,
	comprobantesPorMes,
	descripcionSitio,
	enfasisComoTrabajo,
	estudiosActuales,
	imagenSocial,
	telefonoVisible,
} from '../src/lib/sitio.ts';
import { imagenesSociales } from '../src/lib/imagenes-sociales.ts';
import { telefono } from '../src/lib/datos-pendientes.ts';
import { cargarDist, conDist, hayDist } from './dist.mjs';
import { textoVisible } from './sitio-html.mjs';

const src = fileURLToPath(new URL('../src', import.meta.url));
const listar = (dir) =>
	readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listar(join(dir, e.name)) : [join(dir, e.name)]));
const texto = (ruta) => readFileSync(ruta, 'utf8');
const rel = (ruta) => relative(src, ruta).replaceAll('\\', '/');

// Todo lo que dibuja o arma texto: .astro y .ts (el contenido en Markdown tiene su propia versión del caso).
const codigo = listar(src).filter((r) => /\.(astro|ts)$/.test(r));
const fuentesDelTexto = codigo.filter((r) => rel(r) !== 'lib/sitio.ts');

test('telefonoVisible: espacios duros (U+00A0) para que el número no se parta, y nada más cambia', () => {
	assert.equal(telefonoVisible('uno dos tres-cuatro'), 'uno\u00A0dos\u00A0tres-cuatro');
	assert.ok(!telefonoVisible('uno dos tres-cuatro').includes(' '));
	assert.equal(telefonoVisible('uno\u00A0dos'), 'uno\u00A0dos');
});

test('"Cómo trabajo" y "Estudios" tienen una sola fuente (sitio.ts): ningún archivo de src/ los repite', () => {
	assert.match(comoTrabajo, /^Entiendo el problema, defino las reglas/);
	assert.match(comoTrabajo, /Programo desde 2014/);
	assert.match(estudiosActuales, /UTN\), en curso$/);
	assert.ok(fuentesDelTexto.some((r) => rel(r).startsWith('v5/')), 'la prueba no está mirando los archivos de la v5');
	for (const ruta of fuentesDelTexto) {
		const t = texto(ruta);
		assert.doesNotMatch(t, /Programo desde 2014/, rel(ruta));
		assert.doesNotMatch(t, /Tecnicatura Universitaria en Programación a Distancia/, rel(ruta));
		assert.doesNotMatch(t, /Entiendo el problema, defino las reglas/, rel(ruta));
	}
});

test('las frases resaltadas de "Cómo trabajo" están dentro de su primera oración (y no se copian en ningún archivo)', () => {
	const primera = comoTrabajo.split('. ')[0];
	assert.ok(enfasisComoTrabajo.length > 0);
	for (const f of enfasisComoTrabajo) assert.ok(primera.includes(f), f);
	for (const ruta of fuentesDelTexto) assert.doesNotMatch(texto(ruta), /compruebo que funcione/, rel(ruta));
});

test('descripción de la vista previa: valor público sin cambios; las imágenes salen del archivo generado, no de las páginas', () => {
	assert.equal(descripcionSitio, 'Portafolio de Matías Ariel Ormeño: logística y minería, y técnico e IA.');
	// Los archivos y los textos alternativos de las imágenes los comprueba scripts/og.test.mjs. La disposición de la v5 y
	// las redirecciones los leen de lib/sitio.ts: no escriben el nombre ni una ruta de imagen a mano.
	for (const ruta of ['layouts/BaseV5.astro', 'v5/Redireccion.astro']) {
		assert.ok(existsSync(join(src, ruta)), `falta ${ruta}`);
		const t = texto(join(src, ruta));
		assert.doesNotMatch(t, /Matías Ariel Ormeño/, ruta);
		assert.doesNotMatch(t, /(?<!scripts)\/og\//, ruta); // «scripts/og/generar.mjs» en un comentario no cuenta
	}
});

test('imagenSocial: la clave que existe devuelve su imagen; una que falta, la de la portada solo en desarrollo y un error claro en el build', () => {
	assert.deepEqual(imagenSocial('tecnico', false), imagenesSociales.tecnico);
	assert.deepEqual(imagenSocial('caso-que-no-existe', true), imagenesSociales.portada);
	assert.throws(() => imagenSocial('caso-que-no-existe', false), /Falta la imagen para compartir «caso-que-no-existe»: correr node scripts\/og\/generar\.mjs/);
});

test('la cifra de comprobantes por mes es la misma en todo lo que la repite (código y casos)', () => {
	const cifra = comprobantesPorMes.match(/(\d[\d.]*) comprobantes por mes/)?.[1];
	assert.ok(cifra, 'la constante dice una cifra');
	const repetidas = [];
	for (const ruta of listar(src).filter((r) => /\.(astro|md|ts)$/.test(r))) {
		for (const m of texto(ruta).matchAll(/(\d[\d.]*)\s+comprobantes por mes/g)) repetidas.push({ ruta, cifra: m[1] });
	}
	assert.ok(repetidas.some((r) => rel(r.ruta).endsWith('automatizacion-facturas.md')), 'el caso la menciona');
	assert.deepEqual(repetidas.filter((r) => r.cifra !== cifra), []);
});

test('ninguna página ni componente escribe a mano la cifra: la leen de sitio.ts', () => {
	const sueltas = codigo.filter((r) => /\.astro$/.test(r) || /experiencia\.ts$/.test(r)).filter((r) => /\d[\d.]*\s+comprobantes por mes/.test(texto(r)));
	assert.deepEqual(sueltas, []);
});

test('el teléfono no se arma con un replace de espacios duros escrito en cada archivo', () => {
	for (const ruta of codigo.filter((r) => rel(r) !== 'lib/sitio.ts')) assert.doesNotMatch(texto(ruta), /replace\(\/ \/g/, rel(ruta));
});

// --- Lo publicado en dist/ sale de esas fuentes ---------------------------------------------------------------------

const dist = hayDist ? cargarDist() : undefined;
const sinNbsp = (t) => t.replaceAll('\u00A0', ' ');

test('dist: la portada y /tecnico/ dicen los estudios; /tecnico/ dice "Cómo trabajo" completo, y ninguno cambia una palabra', conDist, () => {
	const portada = sinNbsp(textoVisible(dist.paginas.get('/').html));
	const tecnico = sinNbsp(textoVisible(dist.paginas.get('/tecnico/').html));
	assert.ok(portada.includes(sinNbsp(estudiosActuales)), 'la portada (Contacto, p. 2) no dice los estudios');
	assert.ok(tecnico.includes(sinNbsp(estudiosActuales)), '/tecnico/ (p. 3) no dice los estudios');
	for (const oracion of comoTrabajo.split(/(?<=\.) /)) {
		assert.ok(tecnico.includes(sinNbsp(oracion)), `/tecnico/ no tiene la oración: ${oracion.slice(0, 50)}…`);
	}
});

test('dist: la portada muestra el teléfono con la misma forma que devuelve telefonoVisible (con espacios duros)', conDist, () => {
	assert.ok(telefono, 'sin teléfono público no hay nada que comprobar: la prueba dejó de servir');
	const portada = textoVisible(dist.paginas.get('/').html);
	assert.ok(portada.includes(telefonoVisible(telefono.visible)), 'la portada no muestra el teléfono tal como lo devuelve telefonoVisible');
});

test('dist: cada imagen social es una de las generadas, con SU texto alternativo (el nombre del archivo y el alt van juntos)', conDist, () => {
	const parejas = new Map(Object.values(imagenesSociales).map((i) => [i.archivo, i.alt]));
	const problemas = [];
	for (const [ruta, p] of dist.paginas) {
		if (!p.meta.ogImagen) continue;
		const archivo = new URL(p.meta.ogImagen).pathname;
		if (!parejas.has(archivo)) problemas.push(`${ruta}: ${archivo} no es una imagen de imagenes-sociales.ts`);
		else if (p.meta.ogImagenAlt !== parejas.get(archivo)) problemas.push(`${ruta}: el alt de ${archivo} no es el de imagenes-sociales.ts`);
	}
	assert.deepEqual(problemas, []);
});
