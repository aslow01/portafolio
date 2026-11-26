// El cajón de expedientes de /casos/ (src/v5/interiores/archivo.ts): el orden, el tono de
// cada banda, la carpeta, los caminos y la nota salen de los datos del caso, nunca se escriben a mano. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carpetaDe } from '../src/v5/interiores/caso.ts';
import {
	MAX_EXPEDIENTES,
	claseDeTono,
	colorDeCarpeta,
	expedientes,
	hayMuchos,
	puertaAlArchivo,
} from '../src/v5/interiores/archivo.ts';

const caso = (id, orden, caminos, extra = {}) => ({ id, data: { titulo: `Caso ${id}`, orden, caminos, estado: 'publicado', ...extra } });

// Los seis publicados de hoy, con sus caminos y su orden (ficticios solo en el título).
const seis = () => [
	caso('capacitacion', 7, ['tecnico']),
	caso('facturas', 2, ['tecnico', 'logistica'], { destacado: true, demo: 'lector' }),
	caso('gestion', 1, ['logistica', 'tecnico']),
	caso('bajas', 3, ['logistica']),
	caso('erp', 4, ['tecnico']),
	caso('tableros', 5, ['tecnico']),
];
const siete = () => [...seis(), caso('plataforma', 6, ['tecnico'])];

const tonos = (lista) => lista.map((e) => e.tono);

test('expedientes: ordenados por `orden`, numerados desde 01 con dos dígitos y con la ruta de cada caso', () => {
	const lista = expedientes(seis(), 'facturas', true);
	assert.deepEqual(lista.map((e) => e.href), ['gestion', 'facturas', 'bajas', 'erp', 'tableros', 'capacitacion'].map((s) => `/casos/${s}/`));
	assert.deepEqual(lista.map((e) => e.numero), ['01', '02', '03', '04', '05', '06']);
	assert.equal(lista[0].titulo, 'Caso gestion');
});

test('expedientes: no cambia la lista que recibe', () => {
	const entrada = seis();
	const antes = entrada.map((c) => c.id);
	expedientes(entrada, 'facturas', true);
	assert.deepEqual(entrada.map((c) => c.id), antes);
});

test('tonos de los seis de hoy: cobre, claro (el principal), cobre, azurita, honda, azurita', () => {
	assert.deepEqual(tonos(expedientes(seis(), 'facturas', true)), ['cobre', 'claro', 'cobre', 'azurita', 'honda', 'azurita']);
});

test('tonos con siete (entra la plataforma): dos azules seguidos nunca son del mismo tono', () => {
	const t = tonos(expedientes(siete(), 'facturas', true));
	assert.deepEqual(t, ['cobre', 'claro', 'cobre', 'azurita', 'honda', 'azurita', 'honda']);
	for (let i = 1; i < t.length; i++) {
		if (t[i] === 'azurita' || t[i] === 'honda') assert.notEqual(t[i], t[i - 1], `la banda ${i + 1} repite el tono de la anterior`);
	}
});

test('tonos: sin obra principal no hay banda clara; el que sigue a un azurita es honda', () => {
	assert.deepEqual(tonos(expedientes(seis(), undefined, false)), ['cobre', 'azurita', 'cobre', 'azurita', 'honda', 'azurita']);
});

test('carpeta y caminos: la carpeta es el primer camino declarado y va primero en el texto', () => {
	const lista = Object.fromEntries(expedientes(seis(), 'facturas', true).map((e) => [e.href.split('/')[2], e]));
	// un caso de los dos caminos abre en el que declara primero: la gestión operativa en Logística, las facturas en Técnico
	assert.equal(lista.gestion.carpeta, 'logistica');
	assert.equal(lista.gestion.caminos, 'Logística · Técnico');
	assert.equal(lista.facturas.carpeta, 'tecnico');
	assert.equal(lista.facturas.caminos, 'Técnico · Logística');
	assert.equal(lista.bajas.carpeta, 'logistica');
	assert.equal(lista.bajas.caminos, 'Logística');
	assert.equal(lista.erp.caminos, 'Técnico');
});

test('carpetaDe: manda el primer camino declarado; los casos reales de los dos caminos abren donde corresponde', () => {
	assert.equal(carpetaDe(['logistica', 'tecnico']), 'logistica');
	assert.equal(carpetaDe(['tecnico', 'logistica']), 'tecnico');
	assert.equal(carpetaDe(['tecnico']), 'tecnico');
	const caminosDe = (slug) =>
		readFileSync(new URL(`../src/content/casos/${slug}.md`, import.meta.url), 'utf8')
			.match(/^caminos: \[(.*)\]$/m)[1]
			.split(',')
			.map((c) => c.trim());
	// operación logística: se abre en Logística (cinta, cortina, «Cerrar» y CV de logística), pero se lista también en Técnico
	assert.equal(carpetaDe(caminosDe('sistema-gestion-operativa')), 'logistica');
	assert.deepEqual([...caminosDe('sistema-gestion-operativa')].sort(), ['logistica', 'tecnico']);
	assert.equal(carpetaDe(caminosDe('cargador-bajas')), 'logistica');
	// la obra principal del camino técnico sigue abriendo en Técnico
	assert.equal(carpetaDe(caminosDe('automatizacion-facturas')), 'tecnico');
});

test('nota: «Con demo en vivo» solo en el principal y solo con la demo en vivo', () => {
	const con = expedientes(seis(), 'facturas', true);
	assert.deepEqual(con.map((e) => e.nota), [undefined, 'Con demo en vivo', undefined, undefined, undefined, undefined]);
	// demo en desarrollo o sin demo: ninguna nota
	assert.ok(expedientes(seis(), 'facturas', false).every((e) => e.nota === undefined));
	assert.ok(expedientes(seis(), undefined, true).every((e) => e.nota === undefined));
});

test('nota: «Borrador» solo en `npm run dev` (en producción el borrador ni entra) y manda sobre la del demo', () => {
	const entrada = [caso('a', 1, ['tecnico']), caso('b', 2, ['tecnico'], { estado: 'borrador' }), caso('c', 3, ['logistica'])];
	assert.deepEqual(expedientes(entrada, undefined, false, false).map((e) => e.href), ['/casos/a/', '/casos/c/']);
	const dev = expedientes(entrada, undefined, false, true);
	assert.deepEqual(dev.map((e) => e.nota), [undefined, 'Borrador', undefined]);
	// el principal en borrador, con demo en vivo: no puede decir las dos cosas
	const principalEnBorrador = [caso('a', 1, ['tecnico'], { estado: 'borrador', destacado: true }), caso('b', 2, ['tecnico'])];
	assert.equal(expedientes(principalEnBorrador, 'a', true, true)[0].nota, 'Borrador');
	// `borrador: true` también cuenta
	assert.equal(expedientes([caso('a', 1, ['tecnico'], { estado: undefined, borrador: true }), caso('b', 2, ['tecnico'])], undefined, false, true)[0].nota, 'Borrador');
});

test('hasta ocho expedientes; con nueve falla con un mensaje claro; con cero, también', () => {
	const n = (cuantos) => Array.from({ length: cuantos }, (_, i) => caso(`c${i + 1}`, i + 1, ['tecnico']));
	assert.equal(MAX_EXPEDIENTES, 8);
	assert.equal(expedientes(n(8), undefined, false).length, 8);
	assert.throws(() => expedientes(n(9), undefined, false), { message: 'El cajón admite hasta ocho casos: hay 9; rediseñar /casos/' });
	assert.throws(() => expedientes([], undefined, false), /no existe un cajón vacío/);
	// los borradores no cuentan en producción: nueve con uno en borrador son ocho
	const nueve = [...n(8), caso('b', 9, ['tecnico'], { estado: 'borrador' })];
	assert.equal(expedientes(nueve, undefined, false, false).length, 8);
	assert.throws(() => expedientes(nueve, undefined, false, true), /hay 9/);
});

test('el borrador de otro caso no corre los números ni los tonos en producción', () => {
	const entrada = [caso('a', 1, ['tecnico']), caso('x', 2, ['tecnico'], { estado: 'borrador' }), caso('b', 3, ['tecnico'])];
	const lista = expedientes(entrada, undefined, false, false);
	assert.deepEqual(lista.map((e) => `${e.numero} ${e.tono}`), ['01 azurita', '02 honda']);
});

test('clases por tono, color de la cortina por carpeta y «muchos» desde siete', () => {
	assert.equal(claseDeTono('azurita'), 'c-azurita');
	assert.equal(claseDeTono('honda'), 'c-azurita honda');
	assert.equal(claseDeTono('claro'), 'c-azurita principal');
	assert.equal(claseDeTono('cobre'), 'c-cobre');
	// la cortina es del color de la página a la que se va (la carpeta), no de la banda
	assert.equal(colorDeCarpeta('tecnico'), 'var(--azurita)');
	assert.equal(colorDeCarpeta('logistica'), 'var(--cobre)');
	assert.deepEqual([6, 7, 8].map(hayMuchos), [false, true, true]);
});

test('la puerta al archivo («Casos de estudio») solo se dibuja con dos casos o más', () => {
	assert.deepEqual([0, 1, 2, 6].map(puertaAlArchivo), [false, false, true, true]);
});
