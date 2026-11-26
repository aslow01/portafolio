// Tests de lo que arma la ficha Técnico y la página /tecnico/ de la web v5 (src/v5/fichas/tecnico-datos.ts), con el
// contenido real de src/content. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { circuitoLector } from '../src/lib/circuito.ts';
import { comoTrabajo } from '../src/lib/sitio.ts';
import {
	casosCentavo,
	comprobarContraCodigo,
	flujoDeAutoria,
	frases,
	jornada,
	lecturasReloj,
	leyendaTira,
	marcasReloj,
	nombrePaso,
} from '../src/v5/fichas/tecnico-datos.ts';

const leer = (ruta) => readFileSync(new URL(`../src/content/${ruta}`, import.meta.url), 'utf8');
const campo = (md, nombre, sangria = 2) => md.match(new RegExp(`^ {${sangria}}${nombre}: "(.*)"$`, 'm'))?.[1];
const caso = leer('casos/automatizacion-facturas.md');
const lector = leer('demos/lector-facturas.md');
const flota = leer('demos/control-flota.md');

test('frases: parte en oraciones sin cortar cifras ni abreviaturas del texto real', () => {
	const f = frases(comoTrabajo);
	assert.equal(f.length, 3);
	assert.ok(f[0].startsWith('Entiendo el problema'));
	assert.ok(f[1].startsWith('Programo desde 2014'));
	assert.ok(f[2].startsWith('Las ideas y los diseños son míos'));
	assert.equal(f.join(' '), comoTrabajo);
});

test('jornada: «40 → 300+» con una marca por factura; sin medición no se muestra', () => {
	const cifra = campo(caso, 'cifra');
	const unidad = campo(caso, 'unidad');
	const medicion = campo(caso, 'medicion');
	assert.ok(cifra && unidad && medicion, 'el caso no trae la cifra, la unidad o la medición');
	const j = jornada({ cifra, unidad, medicion });
	assert.deepEqual(j?.antes, { cifra: '40', marcas: 40 });
	assert.deepEqual(j?.ahora, { cifra: '300+', marcas: 300 });
	assert.equal(j?.unidad, unidad);
	assert.match(j?.medicion ?? '', /octubre de 2026/);
	assert.equal(jornada({ cifra, unidad }), undefined);
	assert.equal(jornada({ cifra: '40', medicion: 'x' }), undefined);
	assert.equal(jornada(undefined), undefined);
});

test('flujoDeAutoria: el párrafo del caso se parte en tres sin cambiar palabras', () => {
	const yo = campo(caso, 'yo');
	assert.ok(yo, 'el caso no trae autoria.yo');
	const flujo = flujoDeAutoria(yo);
	assert.deepEqual(flujo?.pasos, ['Conciliación', 'Propuesta', 'Aprobación', 'Carga', 'Control']);
	assert.ok(flujo?.antes.endsWith('diseñé el flujo:'));
	assert.ok(flujo?.despues.startsWith('Definí las reglas de control'));
	// Las palabras son las mismas, en el mismo orden (salvo mayúscula inicial, puntuación del corte y la «y» que une).
	const palabras = (t) => t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((p) => p && p !== 'y');
	assert.deepEqual(
		palabras([flujo.antes, ...flujo.pasos, flujo.despues].join(' ')),
		palabras(yo.replace(/[()]/g, ' ')),
	);
	assert.equal(flujoDeAutoria('Un texto sin paréntesis.'), undefined);
	assert.equal(flujoDeAutoria(undefined), undefined);
});

test('verificación: el texto del caso da tres controles y una nota; la regla empieza con su primera oración', () => {
	const f = frases(campo(caso, 'verificacion') ?? '');
	assert.ok(f.length >= 4, 'la verificación del caso ya no tiene cuatro oraciones o más');
	assert.match(f[0], /al centavo/);
	assert.match(f[2], /aprobación humana/);
	assert.match(f.slice(3).join(' '), /a mano/);
	assert.equal(frases(campo(caso, 'regla', 0) ?? '')[0], 'Se detiene ante cualquier diferencia, por mínima que sea.');
});

test('leyendaTira: dice cuántos pasos hay y cuál compara, según el circuito', () => {
	assert.equal(
		leyendaTira(circuitoLector),
		'El circuito de una factura en la demo: siete pasos; en el quinto se compara el importe al centavo y el último lo decide una persona.',
	);
	assert.equal(nombrePaso(4, circuitoLector[4]), 'Paso 5: compara el importe al centavo');
});

test('las filas de las pruebas salen del código publicado de cada una', () => {
	const codigoDe = (md) => md.match(/^ {2}codigo: \|\r?\n([\s\S]*?)(?=\r?\n {2}\w+:)/m)?.[1] ?? '';
	const cl = codigoDe(lector);
	const cf = codigoDe(flota);
	assert.ok(cl.length > 0 && cf.length > 0);
	comprobarContraCodigo(cl, casosCentavo.map((c) => c.fuente), 'centavo');
	comprobarContraCodigo(cf, lecturasReloj.flatMap((l) => [...l.fuente]), 'día');
	assert.throws(() => comprobarContraCodigo('otro código', ['1000.01'], 'x'), /ya no contiene/);
});

test('marcasReloj: 23 marcas (la de las 03:00 la reemplaza el corte), cuatro mayores', () => {
	const m = marcasReloj();
	assert.equal(m.length, 23);
	assert.equal(m.filter((x) => x.mayor).length, 4);
	assert.deepEqual(m[0], { x1: 150, y1: 34, x2: 150, y2: 52, mayor: true });
	assert.deepEqual(m[1], { x1: 180.02, y1: 37.95, x2: 177.43, y2: 47.61, mayor: false });
});
