// Tests de las reglas de contenido (src/lib/contenido.ts). Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cifraVisible, filasAutoria, obraPrincipal, esDeCamino } from '../src/lib/contenido.ts';

test('sin resultado.medicion no se muestra la cifra', () => {
	assert.equal(cifraVisible(undefined), undefined);
	assert.equal(cifraVisible({ cifra: '40 → 300', unidad: 'facturas por jornada' }), undefined);
	assert.equal(cifraVisible({ cifra: '40 → 300', unidad: 'facturas por jornada', medicion: '' }), undefined);
	assert.equal(cifraVisible({ cifra: '40 → 300', unidad: 'facturas por jornada', medicion: '   ' }), undefined);
});

test('con medicion y cifra se muestra', () => {
	const r = { cifra: '40 → 300', unidad: 'facturas por jornada', medicion: 'Puesta al día, 2026' };
	assert.deepEqual(cifraVisible(r), r);
});

test('con medicion pero sin cifra no se muestra', () => {
	assert.equal(cifraVisible({ cifra: '', unidad: 'x', medicion: 'algo' }), undefined);
});

test('autoría: solo salen las filas con texto, en orden yo / ia / verificacion', () => {
	assert.deepEqual(filasAutoria({ yo: 'Diseñé', ia: 'Escribió', verificacion: '' }), [
		{ clave: 'yo', rotulo: 'Mi parte', texto: 'Diseñé' },
		{ clave: 'ia', rotulo: 'Autoría', texto: 'Escribió' },
	]);
	assert.deepEqual(filasAutoria({ yo: ' ', ia: '', verificacion: 'Comparé' }), [
		{ clave: 'verif', rotulo: 'Cómo lo verifiqué', texto: 'Comparé' },
	]);
	assert.deepEqual(filasAutoria(undefined), []);
});

test('obra principal: el destacado de menor orden; sin destacados, ninguna', () => {
	const casos = [
		{ id: 'a', data: { orden: 3, destacado: true } },
		{ id: 'b', data: { orden: 1, destacado: false } },
		{ id: 'c', data: { orden: 2, destacado: true } },
	];
	assert.equal(obraPrincipal(casos)?.id, 'c');
	assert.equal(obraPrincipal([casos[1]]), undefined);
	assert.equal(obraPrincipal([]), undefined);
});

test('esDeCamino mira la lista de caminos', () => {
	assert.equal(esDeCamino({ caminos: ['logistica', 'tecnico'] }, 'tecnico'), true);
	assert.equal(esDeCamino({ caminos: ['logistica'] }, 'tecnico'), false);
});

