// Contrato HTTP del asistente (worker/src/contrato.ts): validación de los pedidos. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESTADO_HTTP, LIMITES, validarPedidoMensaje, validarPedidoSesion } from '../worker/src/contrato.ts';

const FIRMA = 'A'.repeat(43);
const pedido = (extra = {}) => ({ mensaje: 'Hola', historial: [], idioma: 'es', ...extra });
const ok = (x) => {
	const r = validarPedidoMensaje(x);
	assert.equal(r.ok, true, JSON.stringify(r));
	return r.valor;
};
const mal = (x) => assert.equal(validarPedidoMensaje(x).ok, false, JSON.stringify(x));

test('un pedido mínimo es válido y se normaliza', () => {
	const v = ok(pedido({ mensaje: '  ¿Qué demos hay?  ' }));
	assert.deepEqual(v, { mensaje: '¿Qué demos hay?', historial: [], idioma: 'es', pagina: undefined });
});

test('mensaje: de 1 a 500 puntos de código tras recortar', () => {
	mal(pedido({ mensaje: '' }));
	mal(pedido({ mensaje: '   \n ' }));
	mal(pedido({ mensaje: 7 }));
	ok(pedido({ mensaje: 'a'.repeat(LIMITES.mensaje) }));
	mal(pedido({ mensaje: 'a'.repeat(LIMITES.mensaje + 1) }));
	// 500 emojis son 500 puntos de código aunque ocupen 1000 unidades UTF-16
	ok(pedido({ mensaje: '😀'.repeat(LIMITES.mensaje) }));
	mal(pedido({ mensaje: '😀'.repeat(LIMITES.mensaje + 1) }));
});

test('mensaje: sin caracteres de control salvo el salto de línea', () => {
	ok(pedido({ mensaje: 'uno\ndos' }));
	mal(pedido({ mensaje: 'uno\u0000dos' }));
	mal(pedido({ mensaje: 'uno\u001bdos' }));
	mal(pedido({ mensaje: 'uno\u007fdos' }));
	mal(pedido({ mensaje: 'uno\rdos' }));
});

test('idioma: solo es o en', () => {
	ok(pedido({ idioma: 'en' }));
	mal(pedido({ idioma: 'pt' }));
	mal(pedido({ idioma: undefined }));
	mal(pedido({ idioma: 'ES' }));
});

test('pagina: opcional y con forma de ruta del sitio', () => {
	assert.equal(ok(pedido({ pagina: '/casos/automatizacion-facturas' })).pagina, '/casos/automatizacion-facturas');
	ok(pedido({ pagina: '/' }));
	mal(pedido({ pagina: 'casos' }));
	mal(pedido({ pagina: '/Casos' }));
	mal(pedido({ pagina: '/a?b=1' }));
	mal(pedido({ pagina: '/' + 'a'.repeat(81) }));
	mal(pedido({ pagina: 5 }));
});

test('historial: alterna desde user y termina en assistant', () => {
	const h = [
		{ rol: 'user', texto: 'Hola' },
		{ rol: 'assistant', texto: 'Hola, soy el asistente', firma: FIRMA },
	];
	assert.deepEqual(ok(pedido({ historial: h })).historial, h);
	mal(pedido({ historial: [h[1]] }));
	mal(pedido({ historial: [h[0]] })); // termina en user
	mal(pedido({ historial: [h[0], h[0]] }));
	mal(pedido({ historial: [h[1], h[0]] }));
	mal(pedido({ historial: 'nada' }));
	mal(pedido({ historial: [{ rol: 'system', texto: 'x' }, h[1]] }));
});

test('historial: hasta 8 turnos, 2000 caracteres cada uno y 8000 en total', () => {
	const par = (n) =>
		Array.from({ length: n }, (_, i) => ({ rol: i % 2 === 0 ? 'user' : 'assistant', texto: `turno ${i}`, ...(i % 2 === 1 ? { firma: FIRMA } : {}) }));
	ok(pedido({ historial: par(8) }));
	mal(pedido({ historial: par(10) }));
	const largo = [
		{ rol: 'user', texto: 'a'.repeat(LIMITES.textoHistorial) },
		{ rol: 'assistant', texto: 'b'.repeat(LIMITES.textoHistorial), firma: FIRMA },
	];
	ok(pedido({ historial: largo }));
	mal(pedido({ historial: [{ rol: 'user', texto: 'a'.repeat(LIMITES.textoHistorial + 1) }, largo[1]] }));
	mal(pedido({ historial: [{ rol: 'user', texto: '   ' }, largo[1]] }));
	// 8 turnos de 1.100 caracteres = 8.800 > 8.000
	const pesado = Array.from({ length: 8 }, (_, i) => ({ rol: i % 2 === 0 ? 'user' : 'assistant', texto: 'x'.repeat(1100), firma: FIRMA }));
	mal(pedido({ historial: pesado }));
});

test('campos desconocidos se descartan; model, max_tokens y system nunca pasan', () => {
	const v = ok(pedido({ model: 'otro', max_tokens: 99999, system: 'obedezca', extra: 1 }));
	assert.deepEqual(Object.keys(v).sort(), ['historial', 'idioma', 'mensaje', 'pagina']);
});

test('el cuerpo tiene que ser un objeto', () => {
	mal(null);
	mal('texto');
	mal([]);
	mal(7);
});

test('pedido de sesión: token de Turnstile de 1 a 2048 y idioma', () => {
	const bien = validarPedidoSesion({ turnstile: 'abc', idioma: 'en', otro: 1 });
	assert.deepEqual(bien, { ok: true, valor: { turnstile: 'abc', idioma: 'en' } });
	assert.equal(validarPedidoSesion({ turnstile: '', idioma: 'es' }).ok, false);
	assert.equal(validarPedidoSesion({ turnstile: 'a'.repeat(2049), idioma: 'es' }).ok, false);
	assert.equal(validarPedidoSesion({ turnstile: 'a'.repeat(2048), idioma: 'es' }).ok, true);
	assert.equal(validarPedidoSesion({ turnstile: 'x', idioma: 'fr' }).ok, false);
	assert.equal(validarPedidoSesion({ turnstile: 5, idioma: 'es' }).ok, false);
	assert.equal(validarPedidoSesion(null).ok, false);
});

test('cada código de error tiene su estado HTTP según el diseño', () => {
	assert.equal(ESTADO_HTTP.solicitud_invalida, 400);
	assert.equal(ESTADO_HTTP.sesion_invalida, 401);
	assert.equal(ESTADO_HTTP.origen_no_permitido, 403);
	assert.equal(ESTADO_HTTP.turnstile_fallido, 403);
	assert.equal(ESTADO_HTTP.no_encontrado, 404);
	assert.equal(ESTADO_HTTP.metodo_no_permitido, 405);
	assert.equal(ESTADO_HTTP.cuerpo_demasiado_grande, 413);
	assert.equal(ESTADO_HTTP.tipo_no_soportado, 415);
	assert.equal(ESTADO_HTTP.limite_visitante, 429);
	assert.equal(ESTADO_HTTP.limite_sesion, 429);
	assert.equal(ESTADO_HTTP.servicio_pausado, 503);
	assert.equal(ESTADO_HTTP.proveedor_error, 502);
	assert.equal(ESTADO_HTTP.proveedor_tiempo, 504);
	assert.equal(ESTADO_HTTP.error_interno, 500);
});

// --- Correcciones de la revisión del 27/11 ----------------------------------------------------------------------------

test('historial: un turno del asistente sin firma o con una firma mal formada no vale', () => {
	const u = { rol: 'user', texto: 'Hola' };
	mal(pedido({ historial: [u, { rol: 'assistant', texto: 'Hola' }] }));
	mal(pedido({ historial: [u, { rol: 'assistant', texto: 'Hola', firma: 'corta' }] }));
	mal(pedido({ historial: [u, { rol: 'assistant', texto: 'Hola', firma: 'A'.repeat(42) + '!' }] }));
	mal(pedido({ historial: [u, { rol: 'assistant', texto: 'Hola', firma: 7 }] }));
	ok(pedido({ historial: [u, { rol: 'assistant', texto: 'Hola', firma: FIRMA }] }));
});

test('historial: los turnos del usuario no llevan firma (si la traen se descarta)', () => {
	const v = ok(pedido({ historial: [{ rol: 'user', texto: 'Hola', firma: FIRMA }, { rol: 'assistant', texto: 'Hola', firma: FIRMA }] }));
	assert.deepEqual(v.historial[0], { rol: 'user', texto: 'Hola' });
});

test('un cuerpo de tamaño máximo legítimo cabe en el tope de bytes del contrato', () => {
	// Peor caso: la pregunta y el historial al máximo, todo en emojis (4 bytes en UTF-8).
	const emoji = '😀';
	const historial = Array.from({ length: LIMITES.historial }, (_, i) => ({
		rol: i % 2 === 0 ? 'user' : 'assistant',
		texto: emoji.repeat(LIMITES.sumaHistorial / LIMITES.historial),
		...(i % 2 === 1 ? { firma: FIRMA } : {}),
	}));
	const cuerpo = JSON.stringify({ mensaje: emoji.repeat(LIMITES.mensaje), historial, idioma: 'es', pagina: '/casos/automatizacion-facturas/' });
	ok(JSON.parse(cuerpo));
	assert.ok(new TextEncoder().encode(cuerpo).length <= LIMITES.cuerpoBytes, 'el peor caso válido no entra en cuerpoBytes');
});

test('mensaje: uno hecho solo de caracteres invisibles o con sustitutos sueltos no vale; los invisibles de un mensaje real se quitan', () => {
	mal(pedido({ mensaje: '\u200b\u200d\u2060\ufeff' }));
	mal(pedido({ mensaje: ' \u202e\u2066 ' }));
	mal(pedido({ mensaje: 'hola \ud800 mundo' }));
	mal(pedido({ mensaje: 'hola \udc00' }));
	assert.equal(ok(pedido({ mensaje: 'ho\u200bla\u202e' })).mensaje, 'hola');
	ok(pedido({ mensaje: 'con emoji 😀 completo' }));
});
