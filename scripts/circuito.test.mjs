// Tests de los datos del circuito de una factura (src/lib/circuito.ts) y de cómo los dibuja la página /tecnico/ de la v5
// (la tira de la tapa, la página «Circuito» y su acercamiento). Los de dist/ se saltean sin build. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { circuitoLector } from '../src/lib/circuito.ts';
import { datosPrivados } from './higiene.mjs';
import { cargarDist, conDist, hayDist } from './dist.mjs';
import { textoVisible } from './sitio-html.mjs';

const sinNbsp = (s) => s.replaceAll('\u00A0', ' ');

test('siete pasos; el 5 trae el acercamiento y el 7 es de una persona', () => {
	assert.equal(circuitoLector.length, 7);
	circuitoLector.forEach((p, i) => {
		assert.ok(p.titulo.length > 0 && p.texto.length > 0, `paso ${i + 1}`);
		assert.equal(p.acercamiento !== undefined, i === 4, `acercamiento en el paso ${i + 1}`);
		assert.equal(p.persona === true, i === 6, `persona en el paso ${i + 1}`);
	});
	assert.equal(circuitoLector[4].titulo, 'Compara el importe al centavo');
	assert.equal(circuitoLector[6].titulo, 'Decide una persona');
});

test('el acercamiento coincide con la prueba publicada de la demo', () => {
	const md = readFileSync(new URL('../src/content/demos/lector-facturas.md', import.meta.url), 'utf8');
	const queDice = md.match(/^ {2}queDice: "(.*)"$/m)?.[1];
	assert.ok(queDice, 'la demo no publica `queDice` en su prueba');
	const a = circuitoLector[4].acercamiento;
	const factura = sinNbsp(a.factura);
	const sistema = sinNbsp(a.sistema.join(''));
	assert.equal(factura, '$ 1.000,00');
	assert.equal(sistema, '$ 1.000,01');
	assert.ok(queDice.includes(factura), `la prueba no menciona ${factura}`);
	assert.ok(queDice.includes(sistema), `la prueba no menciona ${sistema}`);
});

test('el dígito distinto es solo el último, y el veredicto es el de la demo', () => {
	const a = circuitoLector[4].acercamiento;
	assert.equal(a.sistema[1], '1');
	assert.equal(a.factura.slice(0, -1), a.sistema[0]); // mismo importe salvo el último dígito
	assert.equal(a.veredicto, 'Mal cargada: otro importe');
	assert.equal(a.rotulo, 'Acercamiento: un caso de la prueba automática');
});

test('datos ficticios: nada de la empresa empleadora', () => {
	assert.deepEqual(datosPrivados(JSON.stringify(circuitoLector)), []);
});

// --- Cómo lo dibuja /tecnico/ (v5): lo que dice circuito.ts es lo que se ve, paso por paso -------------------------

const dist = hayDist ? cargarDist() : undefined;
const pasos = circuitoLector.map((_, i) => `paso-${i + 1}`);
const ver = (t) => sinNbsp(t);

test('dist: /tecnico/ dibuja un panel por paso (paso-1…paso-N), un botón que lleva a cada uno y siete solapas en la tira', conDist, () => {
	const p = dist.paginas.get('/tecnico/');
	const paneles = p.etiquetas.filter((e) => e.attrs.class?.split(/\s+/).includes('sub-vista')).map((e) => e.attrs.id);
	assert.deepEqual(paneles, pasos);
	const botones = p.etiquetas.filter((e) => e.nombre === 'button' && e.attrs['data-para'] !== undefined).map((e) => e.attrs['data-para']);
	assert.deepEqual(botones, pasos, 'cada botón del circuito debe llevar a su panel, en orden');
	const solapas = p.etiquetas.filter((e) => e.nombre === 'li' && e.attrs.class?.split(/\s+/).includes('num'));
	assert.equal(solapas.length, circuitoLector.length, 'la tira de la tapa tiene una solapa por paso');
	assert.equal(solapas.filter((e) => e.attrs.class.split(/\s+/).includes('persona')).length, 1, 'una sola solapa es de una persona');
});

test('dist: el texto de cada paso es el de circuito.ts, sin cambiar una palabra, y el acercamiento marca solo el último dígito', conDist, () => {
	const texto = ver(textoVisible(dist.paginas.get('/tecnico/').html));
	circuitoLector.forEach((p, i) => {
		assert.ok(texto.includes(ver(p.titulo)), `falta el título del paso ${i + 1}: ${p.titulo}`);
		assert.ok(texto.includes(ver(p.texto)), `falta el texto del paso ${i + 1}`);
	});
	const a = circuitoLector[4].acercamiento;
	assert.ok(texto.includes(ver(`${a.factura}`)), 'el acercamiento no muestra el importe de la factura');
	assert.ok(texto.includes(ver(a.sistema.join(''))), 'el acercamiento no muestra el importe del sistema');
	assert.ok(texto.includes(a.veredicto), 'el acercamiento no dice el veredicto');
	const marcas = dist.paginas.get('/tecnico/').html.match(/<mark>([^<]*)<\/mark>/g) ?? [];
	assert.deepEqual(marcas, [`<mark>${a.sistema[1]}</mark>`], 'solo el dígito distinto va marcado');
});

test('dist: la tira de la tapa y la página del circuito cuentan lo mismo (una leyenda con la cantidad de pasos)', conDist, () => {
	const texto = ver(textoVisible(dist.paginas.get('/tecnico/').html));
	assert.ok(texto.includes(`Paso ${circuitoLector.length} de ${circuitoLector.length}`), 'el último rótulo no dice «Paso N de N»');
	assert.ok(texto.includes('Paso 1 de ' + circuitoLector.length));
});
