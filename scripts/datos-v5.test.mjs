// Datos de la web v5 (src/v5/datos.ts): los valores públicos no cambian y cada dato tiene su fuente en src/lib.
// Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as v5 from '../src/v5/datos.ts';
import * as sitio from '../src/lib/sitio.ts';

test('v5/datos: nombre, titular, bajada y minas conservan sus valores', () => {
	assert.deepEqual(v5.nombre, { primero: 'Matías', segundo: 'Ariel', apellido: 'Ormeño', completo: 'Matías Ariel Ormeño' });
	assert.equal(v5.titular, 'Desarrollo de software y automatización con IA');
	assert.equal(
		v5.bajadaPortada,
		'Diseño automatizaciones para el área administrativa, dirijo su desarrollo con IA y las verifico con pruebas automáticas.',
	);
	assert.deepEqual([...v5.minas], ['Vicuña', 'Veladero', 'Pachón']);
});

test('v5/datos: los datos vienen de src/lib/sitio.ts (fuente única)', () => {
	assert.equal(v5.nombre, sitio.nombre);
	assert.equal(v5.titular, sitio.titular);
	assert.equal(v5.bajadaPortada, sitio.bajadaPortada);
	assert.equal(v5.minas, sitio.minas);
});

test('el nombre completo es la unión de sus partes', () => {
	const n = sitio.nombre;
	assert.equal(n.completo, `${n.primero} ${n.segundo} ${n.apellido}`);
});
