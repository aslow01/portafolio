// Worker del asistente en tu máquina, en modo de prueba y SIN claves ni Cloudflare: `npm run asistente:local`.
// Usa el mismo `manejar` que el Worker real (worker/src/handler.ts) con SIMULADO=1, un limitador en memoria (node:sqlite)
// y el contexto generado al vuelo. Sirve para mirar el widget completo con `npm run dev` (PUBLIC_ASISTENTE_URL=http://localhost:8787).
// Mensajes mágicos para ver los estados: /ok /lento /colgado /largo /contacto /fuera-de-tema /error /tiempo /limite /tope
//
// Solo escucha en 127.0.0.1. No es un servidor de producción.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { construirIndice } from './generar-indice.mjs';
import { manejar } from '../../worker/src/handler.ts';
import { LIMITES } from '../../worker/src/contrato.ts';
import { LIMITES_INICIALES, NucleoLimitador, clienteDeNucleo } from '../../worker/src/limitador.ts';

/**
 * El cuerpo del pedido como flujo web, con tres cuidados:
 *  - contrapresión: si el consumidor no lee, el socket se pausa en vez de acumular todo en memoria;
 *  - tope: pasado `max` bytes entrega ese último trozo (así el Worker responde 413), cierra el flujo y descarta el resto;
 *  - cierre limpio: si el cliente corta a mitad, el flujo falla en vez de quedar esperando un cuerpo que no llega.
 * Si el Worker abandona la lectura, lo que falta se descarta SIN destruir el socket: con `Readable.toWeb` la cancelación
 * destruía la conexión y la petición siguiente recibía ECONNRESET.
 */
export function cuerpoDe(req, max = LIMITES.cuerpoBytes) {
	let abierto = true;
	let terminado = false;
	let total = 0;
	return new ReadableStream({
		start(c) {
			req.on('data', (trozo) => {
				if (!abierto) return;
				total += trozo.length;
				c.enqueue(new Uint8Array(trozo));
				if (total > max) {
					abierto = false;
					c.close();
					req.resume();
				} else if (c.desiredSize !== null && c.desiredSize <= 0) {
					req.pause();
				}
			});
			req.on('end', () => {
				terminado = true;
				if (abierto) c.close();
			});
			req.on('error', (e) => abierto && c.error(e));
			req.on('close', () => {
				if (abierto && !terminado) c.error(new Error('el cliente cortó la conexión'));
			});
		},
		pull() {
			req.resume();
		},
		cancel() {
			abierto = false;
			req.resume();
		},
	});
}

const PUERTO = Number(process.env.PUERTO ?? 8787);

export function crearServidorLocal({ puerto = PUERTO, manejador = manejar } = {}) {
	const db = new DatabaseSync(':memory:');
	const nucleo = new NucleoLimitador(
		{
			ejecutar: (q, ...p) => void db.prepare(q).run(...p),
			filas: (q, ...p) => db.prepare(q).all(...p),
			transaccion: (fn) => {
				db.exec('BEGIN');
				try {
					const r = fn();
					db.exec('COMMIT');
					return r;
				} catch (e) {
					db.exec('ROLLBACK');
					throw e;
				}
			},
		},
		// Holgado para poder probar la interfaz; los límites reales se ven con /limite y /tope.
		{ ...LIMITES_INICIALES, rafagaMin: 1000, visitanteDia: 10_000, sesionesHora: 1000 },
	);
	const indice = construirIndice();
	const deps = {
		fetch: async () => {
			throw new Error('el modo de prueba no sale a la red');
		},
		limitador: clienteDeNucleo(nucleo),
		contexto: { texto: indice.texto, indice: indice.huella },
		ahoraMs: () => Date.now(),
		esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
		registrar: (d) => console.log(JSON.stringify({ local: true, ...d })),
	};
	const env = { SIMULADO: '1' };

	const servidor = createServer(async (req, res) => {
		try {
			const headers = new Headers();
			for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string' && k !== 'cf-connecting-ip') headers.set(k, v);
			headers.set('cf-connecting-ip', req.socket.remoteAddress ?? '127.0.0.1');
			const sinCuerpo = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
			const pedido = new Request(`http://${req.headers.host ?? `localhost:${puerto}`}${req.url}`, {
				method: req.method,
				headers,
				body: sinCuerpo ? undefined : cuerpoDe(req),
				duplex: 'half',
			});
			const r = await manejador(pedido, env, deps);
			res.writeHead(r.status, Object.fromEntries(r.headers));
			res.end(Buffer.from(await r.arrayBuffer()));
		} catch {
			// Nada de trazas hacia afuera (igual que el Worker): 500 genérico; si la respuesta ya empezó, se corta la conexión.
			if (res.headersSent || res.destroyed) return void res.destroy();
			res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
			res.end(JSON.stringify({ error: { codigo: 'error_interno' } }));
		}
	});
	return { servidor, escuchar: () => new Promise((ok) => servidor.listen(puerto, '127.0.0.1', () => ok(servidor.address()))) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const { escuchar } = crearServidorLocal();
	const dir = await escuchar();
	console.log(`Asistente en modo de prueba: http://localhost:${dir.port}  (sin claves; respuestas simuladas)`);
	console.log(`Para mirar el widget: PUBLIC_ASISTENTE_URL=http://localhost:${dir.port} npm run dev`);
}
