// Tests de las reglas de visibilidad (src/lib/estados.ts). Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoVisible, esPublicable, proyectoVisible, soloPublicable } from '../src/lib/estados.ts';

test('en producción un caso en borrador no se publica; uno publicado sí', () => {
	assert.equal(esPublicable({ estado: 'borrador' }, false), false);
	assert.equal(esPublicable({ estado: 'publicado' }, false), true);
});

test('en producción borrador: true tampoco se publica', () => {
	assert.equal(esPublicable({ estado: 'en-desarrollo', borrador: true }, false), false);
	assert.equal(esPublicable({ estado: 'en-desarrollo', borrador: false }, false), true);
	assert.equal(esPublicable({}, false), true);
});

test('en desarrollo se ve todo', () => {
	assert.equal(esPublicable({ estado: 'borrador' }, true), true);
	assert.equal(esPublicable({ borrador: true }, true), true);
});

test('fuera de Astro (sin entorno) rige la regla de producción', () => {
	assert.equal(esPublicable({ estado: 'borrador' }), false);
});

test('un proyecto en preparación no es visible aunque no sea borrador', () => {
	assert.equal(proyectoVisible({ estado: 'en-preparacion' }, false), false);
	assert.equal(proyectoVisible({ estado: 'en-desarrollo', borrador: true }, false), false);
	assert.equal(proyectoVisible({ estado: 'en-desarrollo', borrador: false }, false), true);
	assert.equal(proyectoVisible({ estado: 'terminado' }, false), true);
});

test('en desarrollo un proyecto en preparación sigue sin ser visible', () => {
	assert.equal(proyectoVisible({ estado: 'en-preparacion' }, true), false);
	assert.equal(proyectoVisible({ estado: 'en-desarrollo', borrador: true }, true), true);
});

test('una referencia a un borrador se descarta; a un publicado se conserva', () => {
	const borrador = { id: 'a', data: { estado: 'borrador' } };
	const publicado = { id: 'b', data: { estado: 'publicado' } };
	assert.equal(soloPublicable(borrador, false), undefined);
	assert.equal(soloPublicable(publicado, false), publicado);
	assert.equal(soloPublicable(undefined, false), undefined);
	assert.equal(soloPublicable(borrador, true), borrador);
});

test('una demo es visible si es publicable y está en vivo o en desarrollo (no en preparación)', () => {
	assert.equal(demoVisible({ estado: 'en-vivo' }, false), true);
	assert.equal(demoVisible({ estado: 'en-desarrollo' }, false), true);
	assert.equal(demoVisible({ estado: 'en-preparacion' }, false), false);
	assert.equal(demoVisible({ estado: 'en-vivo', borrador: true }, false), false);
	assert.equal(demoVisible({ estado: 'en-preparacion' }, true), false);
	assert.equal(demoVisible({ estado: 'en-desarrollo', borrador: true }, true), true);
});
