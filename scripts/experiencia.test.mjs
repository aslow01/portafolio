// Tests de los datos de experiencia (src/lib/experiencia.ts). Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { experiencia, textoPeriodo, mesesEntre, indiceDeMes, aMes, mesDe, mesActual } from '../src/lib/experiencia.ts';
import { datosPrivados } from './higiene.mjs';

test('el más reciente primero, y el actual es el cargo formal', () => {
	assert.ok(experiencia.length > 0);
	const desdes = experiencia.map((p) => p.desde);
	assert.deepEqual(desdes, [...desdes].sort().reverse());
	assert.equal(experiencia[0].titulo, 'Administración y desarrollo de software');
	assert.equal(experiencia[0].hasta, 'hoy');
});

test('texto del período: meses abreviados con punto y "hoy" para el puesto actual', () => {
	assert.equal(textoPeriodo(experiencia[0]), 'ago. 2026 – hoy');
	assert.equal(textoPeriodo(experiencia[1]), 'ago. 2025 – ago. 2026');
	assert.equal(textoPeriodo(experiencia.at(-1)), 'sep. 2021 – nov. 2022');
	assert.equal(textoPeriodo({ ...experiencia[0], desde: '2024-03', hasta: '2024-12' }), 'mar. 2024 – dic. 2024');
});

test('meses entre dos fechas, inclusivos', () => {
	assert.equal(mesesEntre('2023-04', '2023-04'), 1);
	assert.equal(mesesEntre('2025-08', '2026-07'), 12);
	assert.equal(mesesEntre('2021-09', '2026-11'), 63);
});

test('solo el puesto de logística en alta montaña lleva la barra llena, y termina un mes antes del cambio', () => {
	const llenos = experiencia.filter((p) => p.altaMontana);
	assert.equal(llenos.length, 1);
	assert.equal(llenos[0].titulo, 'Logística');
	assert.equal(llenos[0].desde, '2025-08');
	assert.equal(llenos[0].hasta, '2026-08');
	assert.equal(llenos[0].finBarra, '2026-07');
});

test('cada puesto tiene área, título y fechas con forma AAAA-MM', () => {
	for (const p of experiencia) {
		assert.match(p.desde, /^\d{4}-(0[1-9]|1[0-2])$/);
		assert.ok(p.hasta === 'hoy' || /^\d{4}-(0[1-9]|1[0-2])$/.test(p.hasta));
		assert.ok(['logistica', 'administracion', 'mantenimiento', 'formacion'].includes(p.area), p.titulo);
		assert.ok(p.titulo.length > 0);
	}
});

test('nada de la empresa empleadora por nombre: solo la descripción anonimizada', () => {
	const todo = JSON.stringify(experiencia).toLowerCase();
	assert.deepEqual(datosPrivados(todo), []);
	assert.match(todo, /empresa de seguridad privada de san juan/);
});

test('el puesto actual no lleva `detalle`: tiene puntos y el detalle nunca se dibujaría (M4)', () => {
	assert.equal(experiencia[0].detalle, undefined);
});

test('ningún puesto con puntos lleva `detalle` (la lista solo usa uno de los dos)', () => {
	for (const p of experiencia) assert.ok(!(p.puntos && p.detalle), p.titulo);
});

test('un mes con forma válida se acepta y uno imposible, no', () => {
	assert.equal(aMes('2026-11'), '2026-11');
	for (const malo of ['2026-13', '2026-00', '2026-1', '26-11', '2026-11-01', '', 'hoy']) {
		assert.throws(() => aMes(malo), /Mes inválido/, malo);
	}
});

test('indiceDeMes rechaza un mes imposible en vez de calcular con él', () => {
	assert.throws(() => indiceDeMes('2026-13'), /Mes inválido/);
	assert.equal(indiceDeMes('2026-01') - indiceDeMes('2025-12'), 1);
});

test('mesDe usa el huso de San Juan (UTC-3): a la 1 de la madrugada UTC del 1 de diciembre todavía es noviembre', () => {
	assert.equal(mesDe(new Date('2026-12-01T01:00:00Z')), '2026-11');
	assert.equal(mesDe(new Date('2026-12-01T03:00:00Z')), '2026-12');
	assert.equal(mesDe(new Date('2027-01-01T02:59:00Z')), '2026-12');
});

test('mesActual devuelve un mes con forma válida', () => {
	assert.equal(aMes(mesActual()), mesActual());
});
