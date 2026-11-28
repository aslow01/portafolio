// El servidor local del modo de prueba (scripts/asistente/servidor-local.mjs): el mismo Worker, por HTTP de verdad, sin claves. npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { PassThrough } from 'node:stream';
import { crearServidorLocal, cuerpoDe } from './asistente/servidor-local.mjs';

test('por HTTP real: salud, preflight, sesión, mensaje simulado, error forzado y origen ajeno', async (t) => {
	const { servidor, escuchar } = crearServidorLocal({ puerto: 0 });
	const dir = await escuchar();
	t.after(() => servidor.close());
	const base = `http://localhost:${dir.port}`;
	const origen = 'http://localhost:4321';
	const h = { 'content-type': 'application/json', origin: origen };

	const salud = await fetch(`${base}/v1/salud`, { headers: { origin: origen } });
	assert.equal(salud.status, 200);
	assert.equal((await salud.json()).abierto, true);
	assert.equal(salud.headers.get('access-control-allow-origin'), origen);

	const pre = await fetch(`${base}/v1/mensaje`, { method: 'OPTIONS', headers: { origin: origen, 'access-control-request-method': 'POST' } });
	assert.equal(pre.status, 204);

	const s = await (await fetch(`${base}/v1/sesion`, { method: 'POST', headers: h, body: JSON.stringify({ turnstile: 'sin-turnstile', idioma: 'es' }) })).json();
	assert.match(s.sesion, /^v1\./);

	const preguntar = (mensaje) => fetch(`${base}/v1/mensaje`, { method: 'POST', headers: { ...h, authorization: `Bearer ${s.sesion}` }, body: JSON.stringify({ mensaje, historial: [], idioma: 'es' }) });
	const ok = await preguntar('¿Qué demos puedo probar?');
	assert.equal(ok.status, 200);
	assert.match((await ok.json()).respuesta, /facturas\.matiasormeno\.com\.ar/);

	const limite = await preguntar('/limite');
	assert.equal(limite.status, 429);
	assert.equal(limite.headers.get('retry-after'), '600');

	const ajeno = await fetch(`${base}/v1/sesion`, { method: 'POST', headers: { ...h, origin: 'https://malo.example' }, body: '{}' });
	assert.equal(ajeno.status, 403);
	assert.equal(ajeno.headers.get('access-control-allow-origin'), null);
});

test('por HTTP real: tras un 413 con cuerpo de 1 MB, la siguiente petición por la misma conexión no se corta', async (t) => {
	const { servidor, escuchar } = crearServidorLocal({ puerto: 0 });
	const dir = await escuchar();
	const agente = new http.Agent({ keepAlive: true, maxSockets: 1 });
	t.after(() => {
		agente.destroy();
		servidor.close();
	});
	const pedir = (metodo, ruta, cuerpo) =>
		new Promise((ok, mal) => {
			const req = http.request(
				{ host: '127.0.0.1', port: dir.port, path: ruta, method: metodo, agent: agente, headers: { origin: 'http://localhost:4321', 'content-type': 'application/json' } },
				(res) => {
					res.resume();
					res.on('end', () => ok(res.statusCode));
				},
			);
			req.on('error', mal);
			req.end(cuerpo);
		});
	const sesionGrande = await pedir('POST', '/v1/sesion', JSON.stringify({ relleno: 'x'.repeat(1_000_000) }));
	assert.equal(sesionGrande, 413);
	assert.equal(await pedir('GET', '/v1/salud'), 200);
});

// --- cuerpoDe: contrapresión, tope y cierre limpio -----------------------------------------------------------------------

/** Lee un flujo hasta el final o hasta que falle; si no termina en `ms`, devuelve 'colgado'. */
async function leerFlujo(flujo, ms = 500) {
	const lector = flujo.getReader();
	const tiempo = new Promise((ok) => setTimeout(() => ok({ estado: 'colgado' }), ms));
	const lectura = (async () => {
		let bytes = 0;
		try {
			for (;;) {
				const { done, value } = await lector.read();
				if (done) return { estado: 'cerrado', bytes };
				bytes += value.byteLength;
			}
		} catch (e) {
			return { estado: 'error', bytes, mensaje: e.message };
		}
	})();
	const r = await Promise.race([lectura, tiempo]);
	if (r.estado === 'colgado') lector.cancel().catch(() => undefined);
	return r;
}

test('cuerpoDe: un cuerpo completo se entrega entero y se cierra', async () => {
	const req = new PassThrough();
	const flujo = cuerpoDe(req, 1000);
	req.write(Buffer.alloc(300));
	req.end(Buffer.alloc(200));
	assert.deepEqual(await leerFlujo(flujo), { estado: 'cerrado', bytes: 500 });
});

test('cuerpoDe: si el cliente corta a mitad, el flujo falla en vez de quedar colgado', async () => {
	const req = new PassThrough();
	const flujo = cuerpoDe(req, 1000);
	req.write(Buffer.alloc(100));
	setImmediate(() => req.destroy());
	const r = await leerFlujo(flujo);
	assert.equal(r.estado, 'error', 'el flujo no debe quedar esperando un cuerpo que ya no llega');
});

test('cuerpoDe: contrapresión, si nadie lee no se acumula todo el cuerpo en memoria', async () => {
	const req = new PassThrough({ highWaterMark: 16 });
	cuerpoDe(req, 10_000_000);
	for (let i = 0; i < 50; i++) req.write(Buffer.alloc(1024));
	await new Promise((r) => setTimeout(r, 50));
	assert.ok(req.isPaused(), 'la lectura del socket debe quedar en pausa mientras el consumidor no pida más');
	assert.ok(req.readableLength > 0, 'lo que no se consumió se queda en el socket, no en un flujo sin límite');
});

test('cuerpoDe: pasado el tope entrega un trozo de más (el Worker responde 413) y descarta el resto sin colgarse', async () => {
	const req = new PassThrough();
	const flujo = cuerpoDe(req, 1000);
	const escribir = (async () => {
		for (let i = 0; i < 20; i++) {
			req.write(Buffer.alloc(400));
			await new Promise((r) => setImmediate(r));
		}
		req.end();
	})();
	const r = await leerFlujo(flujo);
	await escribir;
	assert.equal(r.estado, 'cerrado');
	assert.ok(r.bytes > 1000, 'tiene que pasar del tope para que el Worker lo detecte');
	assert.ok(r.bytes <= 1000 + 400, `entregó ${r.bytes} bytes: no debe seguir pasando datos después del tope`);
});

// --- el servidor no se cuelga ni filtra detalles ----------------------------------------------------------------------------

test('si el manejador revienta, el servidor responde 500 genérico, sin detalles, y sigue atendiendo', async (t) => {
	const { servidor, escuchar } = crearServidorLocal({
		puerto: 0,
		manejador: async (req) => {
			if (new URL(req.url).pathname === '/v1/salud') throw new Error('secreto-interno /ruta/privada');
			return new Response('{}', { status: 200 });
		},
	});
	const dir = await escuchar();
	t.after(() => servidor.close());
	const r = await fetch(`http://localhost:${dir.port}/v1/salud`);
	const texto = await r.text();
	assert.equal(r.status, 500);
	assert.deepEqual(JSON.parse(texto), { error: { codigo: 'error_interno' } });
	assert.doesNotMatch(texto, /secreto-interno|privada/);
	assert.equal((await fetch(`http://localhost:${dir.port}/otra`)).status, 200);
});

test('por HTTP real: si el cliente corta a mitad del cuerpo, el servidor no se cuelga y sigue atendiendo', async (t) => {
	const { servidor, escuchar } = crearServidorLocal({ puerto: 0 });
	const dir = await escuchar();
	t.after(() => servidor.close());
	await new Promise((ok) => {
		const s = net.connect(dir.port, '127.0.0.1', () => {
			s.write('POST /v1/sesion HTTP/1.1\r\nHost: localhost\r\nOrigin: http://localhost:4321\r\nContent-Type: application/json\r\nContent-Length: 5000\r\n\r\n{"turn');
			setTimeout(() => {
				s.destroy();
				ok();
			}, 50);
		});
	});
	await new Promise((r) => setTimeout(r, 100));
	assert.equal((await fetch(`http://localhost:${dir.port}/v1/salud`)).status, 200);
});
