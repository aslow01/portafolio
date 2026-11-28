// Piezas chicas del Worker: sesión firmada, huella del visitante, datos personales, registro, Turnstile y Anthropic. npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emitirSesion, verificarSesion } from '../worker/src/sesion.ts';
import { huellaVisitante, normalizarIp } from '../worker/src/visitante.ts';
import { omitirDatosPersonales } from '../worker/src/pii.ts';
import { registrar } from '../worker/src/registro.ts';
import { esSecretoDePrueba, verificarTurnstile } from '../worker/src/turnstile.ts';
import { armarMensajes, llamarAnthropic } from '../worker/src/anthropic.ts';

const SECRETO = 'secreto-de-prueba-bastante-largo-0123456789';

// --- Sesión firmada ------------------------------------------------------------------------------------------------

test('sesión: se emite, se verifica y trae sid y vencimiento a 30 minutos', async () => {
	const s = await emitirSesion(SECRETO, 1_000_000);
	assert.match(s.token, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
	assert.equal(s.expira, 1_000_000 + 1800);
	const v = await verificarSesion(SECRETO, s.token, 1_000_100);
	assert.deepEqual(v, { sid: s.sid, exp: s.expira });
	assert.match(s.sid, /^[0-9a-f]{16}$/);
});

test('sesión: vencida, alterada, de otro secreto o con forma rota no valen', async () => {
	const s = await emitirSesion(SECRETO, 1_000_000);
	assert.equal(await verificarSesion(SECRETO, s.token, s.expira), null); // venció
	assert.equal(await verificarSesion(SECRETO, s.token, s.expira + 1), null);
	assert.equal(await verificarSesion('otro-secreto-distinto-0123456789abcdef', s.token, 1_000_100), null);
	const [v, carga, firma] = s.token.split('.');
	const cargaAlterada = Buffer.from(JSON.stringify({ iat: 1, exp: 9_999_999_999, sid: s.sid })).toString('base64url');
	assert.equal(await verificarSesion(SECRETO, `${v}.${cargaAlterada}.${firma}`, 1_000_100), null);
	assert.equal(await verificarSesion(SECRETO, `${v}.${carga}.${firma.slice(0, -2)}AA`, 1_000_100), null);
	for (const malo of ['', 'v1', 'v1.a', 'v2.a.b', 'v1.a.b.c', `v1.${carga}.`, 'x'.repeat(5000)]) {
		assert.equal(await verificarSesion(SECRETO, malo, 1_000_100), null, malo);
	}
});

test('sesión: un secreto corto o ausente no firma nada', async () => {
	await assert.rejects(() => emitirSesion('corto', 1));
	await assert.rejects(() => emitirSesion(undefined, 1));
	assert.equal(await verificarSesion('corto', 'v1.a.b', 1), null);
});

// --- Huella del visitante ------------------------------------------------------------------------------------------

test('IP: IPv4 tal cual; IPv6 agrupada por /64; mapeada a IPv4 se trata como IPv4', () => {
	assert.equal(normalizarIp('203.0.113.7'), '203.0.113.7');
	assert.equal(normalizarIp('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2::/64');
	assert.equal(normalizarIp('2001:DB8:1:2::5'), '2001:db8:1:2::/64');
	assert.equal(normalizarIp('2001:db8::1'), '2001:db8:0:0::/64');
	assert.equal(normalizarIp('::ffff:203.0.113.7'), '203.0.113.7');
	assert.equal(normalizarIp('::1'), '0:0:0:0::/64');
	assert.equal(normalizarIp(''), 'sin-ip');
	assert.equal(normalizarIp(null), 'sin-ip');
});

test('huella: 16 hexadecimales, estable en el día, distinta entre días, entre visitantes y entre secretos', async () => {
	const a = await huellaVisitante(SECRETO, '2026-11-27', '203.0.113.7');
	assert.match(a, /^[0-9a-f]{16}$/);
	assert.equal(a, await huellaVisitante(SECRETO, '2026-11-27', '203.0.113.7'));
	assert.notEqual(a, await huellaVisitante(SECRETO, '2026-11-28', '203.0.113.7'));
	assert.notEqual(a, await huellaVisitante(SECRETO, '2026-11-27', '203.0.113.8'));
	assert.notEqual(a, await huellaVisitante('otro-secreto-distinto-0123456789abcdef', '2026-11-27', '203.0.113.7'));
	// Dos direcciones del mismo /64 son el mismo visitante.
	assert.equal(await huellaVisitante(SECRETO, '2026-11-27', '2001:db8:1:2::1'), await huellaVisitante(SECRETO, '2026-11-27', '2001:db8:1:2::ffff'));
	assert.ok(!a.includes('203'));
});

// --- Datos personales ----------------------------------------------------------------------------------------------

// Los números se arman en la prueba para que la higiene del repositorio no los lea como teléfonos reales.
const tel = (...partes) => partes.join(' ');

test('pii: correos, teléfonos y números largos se reemplazan', () => {
	const o = '[dato omitido]';
	assert.equal(omitirDatosPersonales('Escríbame a ana.perez+x@correo-ejemplo.org por favor'), `Escríbame a ${o} por favor`);
	assert.equal(omitirDatosPersonales(`Mi número es ${tel('+54', '9', '11', '5555', '0100')}.`), `Mi número es ${o}.`);
	assert.equal(omitirDatosPersonales(`llamar al ${['011', '5555', '0100'].join('-')}`), `llamar al ${o}`);
	assert.equal(omitirDatosPersonales(`mi CUIT es ${['20', '12345678', '9'].join('-')}`), `mi CUIT es ${o}`);
	assert.equal(omitirDatosPersonales('DNI 12345678'), `DNI ${o}`);
	assert.equal(omitirDatosPersonales('tarjeta 4111 1111 1111 1111'), `tarjeta ${o}`);
});

test('pii: lo que no es un dato personal queda igual', () => {
	for (const t of [
		'¿Procesa más de 2.000 comprobantes por mes?',
		'En 2026 hizo 275 de 275 comprobaciones',
		'Desde el 2026-11-27 hay demos',
		'Versión 1.2.3 y 40 → 300',
		'¿Qué hizo entre 2021 y 2024?',
	]) {
		assert.equal(omitirDatosPersonales(t), t);
	}
});

// --- Registro ------------------------------------------------------------------------------------------------------

test('registro: una línea JSON solo con campos de la lista; nunca texto del visitante', () => {
	const lineas = [];
	registrar(
		{ evento: 'mensaje_ok', ms: 1200, tokensEntrada: 15000, idioma: 'es', derivar: false, indice: 'abc123', mensaje: 'secreto@correo.org', ip: '1.2.3.4', authorization: 'Bearer x' },
		(l) => lineas.push(l),
		() => '2026-11-27T10:00:00.000Z',
	);
	assert.equal(lineas.length, 1);
	const o = JSON.parse(lineas[0]);
	assert.deepEqual(o, { t: '2026-11-27T10:00:00.000Z', evento: 'mensaje_ok', ms: 1200, tokensEntrada: 15000, idioma: 'es', derivar: false, indice: 'abc123' });
	assert.ok(!lineas[0].includes('secreto'));
	assert.ok(!lineas[0].includes('1.2.3.4'));
});

// --- Turnstile -----------------------------------------------------------------------------------------------------

const respuesta = (cuerpo, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } });
const turn = (fetchFn, token = 'tok') =>
	verificarTurnstile({ token, secreto: 'sec', hostnames: ['matiasormeno.com.ar', 'www.matiasormeno.com.ar'], ip: '203.0.113.7', fetchFn });

test('turnstile: éxito con host y acción correctos', async () => {
	let visto;
	const r = await turn(async (url, init) => {
		visto = { url: String(url), cuerpo: String(init.body) };
		return respuesta({ success: true, hostname: 'matiasormeno.com.ar', action: 'asistente' });
	});
	assert.equal(r, 'ok');
	assert.equal(visto.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
	const p = new URLSearchParams(visto.cuerpo);
	assert.equal(p.get('secret'), 'sec');
	assert.equal(p.get('response'), 'tok');
	assert.equal(p.get('remoteip'), '203.0.113.7');
});

test('turnstile: success falso, host o acción incorrectos se rechazan', async () => {
	assert.equal(await turn(async () => respuesta({ success: false, 'error-codes': ['invalid-input-response'] })), 'rechazado');
	assert.equal(await turn(async () => respuesta({ success: true, hostname: 'otro.example', action: 'asistente' })), 'rechazado');
	assert.equal(await turn(async () => respuesta({ success: true, hostname: 'matiasormeno.com.ar', action: 'otra' })), 'rechazado');
	assert.equal(await turn(async () => respuesta({ success: true, hostname: 'matiasormeno.com.ar' })), 'rechazado');
});

test('turnstile: si siteverify no responde bien, falla cerrado como «caído»', async () => {
	assert.equal(await turn(async () => { throw new Error('red'); }), 'caido');
	assert.equal(await turn(async () => respuesta({}, 500)), 'caido');
	assert.equal(await turn(async () => new Response('no es json', { status: 200 })), 'caido');
	assert.equal(await turn(async () => respuesta('texto')), 'caido');
});

// Claves de PRUEBA públicas de Cloudflare (documentadas): solo para desarrollo y tests, nunca en producción.
// Con la secreta que siempre pasa, siteverify devuelve (visto el 28/11/2026): success true, hostname "example.com", sin action.
const SECRETA_PRUEBA_PASA = '1x0000000000000000000000000000000AA';
const SECRETA_PRUEBA_FALLA = '2x0000000000000000000000000000000AA';
const SECRETA_PRUEBA_GASTADA = '3x0000000000000000000000000000000AA';
const RESPUESTA_DE_PRUEBA = { success: true, 'error-codes': [], hostname: 'example.com', challenge_ts: '2026-11-28T07:29:35.517Z', metadata: { result_with_testing_key: true } };

test('turnstile: reconoce las secretas de prueba de Cloudflare y solo esas', () => {
	for (const s of [SECRETA_PRUEBA_PASA, SECRETA_PRUEBA_FALLA, SECRETA_PRUEBA_GASTADA]) assert.equal(esSecretoDePrueba(s), true, s);
	for (const s of ['', 'sec', '0x4AAAAAAAexample_secret_key_0123456789', SECRETA_PRUEBA_PASA + 'x', undefined]) assert.equal(esSecretoDePrueba(s), false, String(s));
});

test('turnstile: con una clave de prueba el host y la acción de la respuesta de Cloudflare no se exigen; sin el modo, esa misma respuesta se rechaza', async () => {
	const pedido = (modoPrueba) => verificarTurnstile({ token: 'XXXX.DUMMY.TOKEN.XXXX', secreto: SECRETA_PRUEBA_PASA, hostnames: ['matiasormeno.com.ar'], fetchFn: async () => respuesta(RESPUESTA_DE_PRUEBA), modoPrueba });
	assert.equal(await pedido(true), 'ok');
	assert.equal(await pedido(false), 'rechazado');
	const sinExito = verificarTurnstile({ token: 'x', secreto: SECRETA_PRUEBA_FALLA, hostnames: [], fetchFn: async () => respuesta({ success: false, 'error-codes': ['invalid-input-response'] }), modoPrueba: true });
	assert.equal(await sinExito, 'rechazado');
});
// --- Anthropic -----------------------------------------------------------------------------------------------------

test('mensajes: historial y pregunta nueva, con los datos personales de lo escrito por el visitante omitidos', () => {
	const m = armarMensajes(
		[
			{ rol: 'user', texto: 'Mi correo es a@b.org' },
			{ rol: 'assistant', texto: 'Contacto: contacto@matiasormeno.com.ar' },
		],
		'¿Y las demos?',
	);
	assert.deepEqual(m, [
		{ role: 'user', content: 'Mi correo es [dato omitido]' },
		{ role: 'assistant', content: 'Contacto: contacto@matiasormeno.com.ar' },
		{ role: 'user', content: '¿Y las demos?' },
	]);
});

const llamada = (fetchFn, extra = {}) =>
	llamarAnthropic({
		clave: 'clave-de-prueba',
		modelo: 'modelo-x',
		maxTokens: 400,
		reglas: 'REGLAS',
		contexto: 'CONTEXTO',
		extra: 'PAGINA',
		mensajes: [{ role: 'user', content: 'hola' }],
		fetchFn,
		tiempoMs: 50,
		...extra,
	});

test('anthropic: arma el pedido (modelo, tope, sistema con caché) y lee texto, uso e id', async () => {
	let visto;
	const r = await llamada(async (url, init) => {
		visto = { url: String(url), init, cuerpo: JSON.parse(init.body) };
		return new Response(
			JSON.stringify({
				content: [{ type: 'text', text: 'Hola ' }, { type: 'text', text: 'mundo' }],
				usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 0 },
			}),
			{ status: 200, headers: { 'request-id': 'req_123' } },
		);
	});
	assert.deepEqual(r, { ok: true, texto: 'Hola mundo', truncado: false, tokensEntrada: 10, tokensSalida: 5, tokensCache: 100, requestId: 'req_123' });
	assert.equal(visto.url, 'https://api.anthropic.com/v1/messages');
	assert.equal(visto.init.method, 'POST');
	assert.equal(visto.init.headers['x-api-key'], 'clave-de-prueba');
	assert.equal(visto.init.headers['anthropic-version'], '2023-06-01');
	assert.equal(visto.cuerpo.model, 'modelo-x');
	assert.equal(visto.cuerpo.max_tokens, 400);
	assert.deepEqual(visto.cuerpo.messages, [{ role: 'user', content: 'hola' }]);
	assert.deepEqual(visto.cuerpo.system, [
		{ type: 'text', text: 'REGLAS' },
		{ type: 'text', text: 'CONTEXTO', cache_control: { type: 'ephemeral' } },
		{ type: 'text', text: 'PAGINA' },
	]);
	assert.deepEqual(Object.keys(visto.cuerpo).sort(), ['max_tokens', 'messages', 'model', 'system']);
});

test('anthropic: sin texto extra no manda un tercer bloque', async () => {
	let sistema;
	await llamada(
		async (_u, init) => {
			sistema = JSON.parse(init.body).system;
			return new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }], usage: {} }), { status: 200 });
		},
		{ extra: '' },
	);
	assert.equal(sistema.length, 2);
});

test('anthropic: error del proveedor, cuerpo raro o respuesta vacía son «proveedor» y no devuelven su texto', async () => {
	for (const f of [
		async () => new Response(JSON.stringify({ error: { message: 'credit balance is too low sk-ant-123' } }), { status: 400 }),
		async () => new Response('x', { status: 529 }),
		async () => new Response('{"content":[]}', { status: 200 }),
		async () => new Response('no json', { status: 200 }),
		async () => { throw new Error('boom sk-ant-123'); },
	]) {
		const r = await llamada(f);
		assert.deepEqual(r, { ok: false, tipo: 'proveedor', http: r.http });
		assert.ok(!JSON.stringify(r).includes('sk-ant'));
	}
});

test('anthropic: pasado el tiempo máximo, corta y avisa «tiempo»', async () => {
	const r = await llamada((_u, init) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('abortado', 'AbortError')))));
	assert.deepEqual(r, { ok: false, tipo: 'tiempo' });
});
