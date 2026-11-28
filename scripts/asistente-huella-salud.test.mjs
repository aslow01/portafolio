// El paso de prepublicar que compara la huella del contexto local con la del Worker desplegado (/v1/salud). npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compararConDesplegado } from './asistente/huella-salud.mjs';

const respuesta = (cuerpo, estado = 200) => async () => new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), { status: estado });

test('sin PUBLIC_ASISTENTE_URL no consulta nada y lo dice', async () => {
	const r = await compararConDesplegado({ url: '', huellaLocal: 'aaaaaaaaaaaa', fetchFn: () => assert.fail('no debía consultar') });
	assert.equal(r.estado, 'omitido');
});

test('una dirección que no es https (o no es una dirección) no se consulta', async () => {
	for (const url of ['http://localhost:8787', 'http://asistente.example', 'no es una url', 'https://usuario:clave@asistente.example']) {
		const r = await compararConDesplegado({ url, huellaLocal: 'aaaaaaaaaaaa', fetchFn: () => assert.fail('no debía consultar') });
		assert.equal(r.estado, 'omitido', url);
	}
});

test('huellas iguales: coincide', async () => {
	const r = await compararConDesplegado({ url: 'https://asistente.example', huellaLocal: 'abc123abc123', fetchFn: respuesta({ abierto: true, indice: 'abc123abc123' }) });
	assert.equal(r.estado, 'coincide');
});

test('huellas distintas: avisa que falta redesplegar el Worker, con las dos huellas', async () => {
	const r = await compararConDesplegado({ url: 'https://asistente.example/', huellaLocal: 'abc123abc123', fetchFn: respuesta({ abierto: true, indice: 'ffffffffffff' }) });
	assert.equal(r.estado, 'difiere');
	assert.match(r.mensaje, /abc123abc123/);
	assert.match(r.mensaje, /ffffffffffff/);
	assert.match(r.mensaje, /redesplegar/i);
});

test('consulta GET a /v1/salud de ese origen, sin credenciales ni cabeceras de más', async () => {
	let visto;
	await compararConDesplegado({
		url: 'https://asistente.example/',
		huellaLocal: 'abc123abc123',
		fetchFn: async (u, init) => {
			visto = { u, init };
			return new Response('{"indice":"abc123abc123"}');
		},
	});
	assert.equal(visto.u, 'https://asistente.example/v1/salud');
	assert.ok(!visto.init?.method || visto.init.method === 'GET');
	assert.ok(visto.init?.signal, 'con tiempo máximo');
});

test('errores de red, HTTP o cuerpo ajeno: no bloquean, quedan como «sin respuesta»', async () => {
	const casos = [
		async () => {
			throw new Error('sin red');
		},
		respuesta('no es json'),
		respuesta({ abierto: true }),
		respuesta({ indice: 42 }),
		respuesta({ indice: 'x' }, 503),
	];
	for (const fetchFn of casos) {
		const r = await compararConDesplegado({ url: 'https://asistente.example', huellaLocal: 'abc123abc123', fetchFn });
		assert.equal(r.estado, 'sin-respuesta');
		assert.doesNotMatch(r.mensaje, /sin red/, 'no se repiten detalles internos del error');
	}
});
