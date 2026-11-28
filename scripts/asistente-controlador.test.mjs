// Lógica del widget (src/lib/asistente): cliente HTTP, controlador de la conversación, config y Turnstile del navegador.
// Algunas pruebas hablan con el Worker real (modo simulado) sin red; otras con un `fetch` guionado. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { crearAsistente, armarHistorial, ajustarAlCuerpo, limpiarEntrada } from '../src/lib/asistente/controlador.ts';
import { esSitekeyDePrueba, leerConfigDeEntorno } from '../src/lib/asistente/config.ts';
import { TOKEN_DE_PRUEBA, URL_SCRIPT_TURNSTILE, turnstileDePrueba, turnstileNavegador } from '../src/lib/asistente/turnstile-navegador.ts';
import { manejar } from '../worker/src/handler.ts';
import { LIMITES_INICIALES, NucleoLimitador, clienteDeNucleo } from '../worker/src/limitador.ts';
import { correo, linkedin } from '../src/lib/sitio.ts';
import { cv } from '../src/lib/datos-pendientes.ts';

const SITIO = 'http://localhost:4321';
const API = 'http://localhost:8787';
const contacto = { correo, linkedin, cvs: [cv.logistica.archivo, cv.tecnico.archivo] };
const json = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
const falla = (codigo, status, extra = {}) => json({ error: { codigo, ...extra } }, status);
const ok = (extra = {}) => json({ respuesta: 'Respuesta de prueba.', firma: FIRMA, idioma: 'es', restantes: 19, derivar: false, ...extra });
const FIRMA = 'F'.repeat(43);
const sesionOk = (extra = {}) => json({ sesion: 'v1.carga.firma', expira: Math.floor(Date.now() / 1000) + 1800, limites: { mensaje: 500, mensajes: 20, historial: 8 }, ...extra });

/** Turnstile de mentira que cuenta lo que le piden. */
function turnstileFalso(guion = []) {
	const t = { obtenidos: 0, reinicios: 0, cola: [...guion] };
	t.obtenerToken = async () => {
		t.obtenidos++;
		const siguiente = t.cola.shift();
		if (siguiente === 'falla') throw new Error('turnstile falló');
		return siguiente ?? `token-${t.obtenidos}`;
	};
	t.reiniciar = () => void t.reinicios++;
	return t;
}

/** `fetch` guionado: cada ruta tiene una cola de respuestas (o una función); la última se repite. Anota las llamadas. */
function apiGuionada({ salud, sesion, mensaje } = {}) {
	const colas = { '/v1/salud': salud ?? [() => json({ abierto: true, indice: 'abc' })], '/v1/sesion': sesion ?? [() => sesionOk()], '/v1/mensaje': mensaje ?? [() => ok()] };
	const llamadas = [];
	const f = async (url, init) => {
		const ruta = new URL(url).pathname;
		llamadas.push({ ruta, url, init, cuerpo: init.body ? JSON.parse(init.body) : undefined });
		const cola = colas[ruta];
		const paso = cola.length > 1 ? cola.shift() : cola[0];
		return typeof paso === 'function' ? paso(init) : paso;
	};
	f.llamadas = llamadas;
	f.de = (ruta) => llamadas.filter((l) => l.ruta === ruta);
	return f;
}

function nuevo({ fetch, turnstile = turnstileFalso(), extra = {} } = {}) {
	const a = crearAsistente({ urlApi: API, idioma: 'es', contacto, turnstile, fetch, ...extra });
	const vistos = [];
	a.suscribir((e) => vistos.push(e));
	return { a, turnstile, vistos, fetch, ultimo: () => a.estado() };
}

// --- Con el Worker real ------------------------------------------------------------------------------------------------

function fetchHaciaElWorker(limites = {}) {
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
		{ ...LIMITES_INICIALES, rafagaMin: 1000, ...limites },
	);
	const deps = {
		fetch: async () => {
			throw new Error('el modo de prueba no sale a la red');
		},
		limitador: clienteDeNucleo(nucleo),
		contexto: { texto: 'x', indice: 'abc123abc123' },
		ahoraMs: () => Date.now(),
		esperar: async () => {},
		registrar: () => {},
	};
	const llamadas = [];
	const f = async (url, init) => {
		const cabeceras = { ...init.headers, origin: SITIO };
		llamadas.push({ url: String(url), init });
		return manejar(new Request(url, { ...init, headers: cabeceras }), { SIMULADO: '1' }, deps);
	};
	f.llamadas = llamadas;
	return f;
}

test('de punta a punta con el Worker simulado: pregunta, respuesta con enlaces validados y fuentes', async () => {
	const { a, turnstile, vistos } = nuevo({ fetch: fetchHaciaElWorker() });
	await a.abrir();
	assert.equal(a.estado().abierto, true);
	assert.equal(a.estado().disponible, true);
	await a.enviar('¿Qué demos puedo probar?');
	const e = a.estado();
	assert.equal(e.error, null);
	assert.equal(e.fase, 'libre');
	assert.equal(e.turnos.length, 2);
	assert.deepEqual([e.turnos[0].rol, e.turnos[0].estado], ['usuario', 'enviada']);
	const r = e.turnos[1];
	assert.equal(r.rol, 'asistente');
	assert.ok(r.bloques.length > 0);
	const partes = r.bloques.flatMap((b) => (b.tipo === 'lista' ? b.items.flat() : b.partes));
	const enlaces = partes.filter((p) => p.tipo === 'enlace');
	assert.ok(enlaces.some((p) => p.href === 'https://facturas.matiasormeno.com.ar' && p.externo));
	assert.deepEqual(r.fuentes, [{ href: '/#demos', texto: 'Demos' }]);
	assert.equal(r.derivar, false);
	assert.equal(e.restantes, 9);
	assert.equal(e.mostrarSugerencias, false);
	// Las fases pasaron por verificando y respondiendo antes de quedar libres.
	assert.deepEqual([...new Set(vistos.map((v) => v.fase))], ['libre', 'verificando', 'respondiendo']);
	assert.equal(turnstile.obtenidos, 1);
});

test('con el Worker simulado: una pregunta de contacto deriva y trae el correo', async () => {
	const { a } = nuevo({ fetch: fetchHaciaElWorker() });
	await a.enviar('¿Cómo lo contacto?');
	const r = a.estado().turnos[1];
	assert.equal(r.derivar, true);
	assert.ok(!r.texto.includes('[[CONTACTO]]'));
	assert.ok(r.texto.includes(correo));
});

test('con el Worker simulado: los escenarios de error llegan como el diseño pide', async () => {
	const casos = [
		['/error', { clave: 'servicio', reintentable: true, bloqueaFormulario: false }],
		['/tiempo', { clave: 'tiempo', reintentable: true, bloqueaFormulario: false }],
		['/limite', { clave: 'limiteVisitante', reintentable: false, bloqueaFormulario: true, reintentarEnSeg: 600 }],
		['/tope', { clave: 'tope', reintentable: false, bloqueaFormulario: true, reintentarEnSeg: 3600 }],
	];
	for (const [mensaje, esperado] of casos) {
		const { a } = nuevo({ fetch: fetchHaciaElWorker() });
		await a.enviar(mensaje);
		const e = a.estado();
		assert.deepEqual({ ...e.error, ofrecerContacto: undefined }, { ...esperado, ofrecerContacto: undefined }, mensaje);
		assert.equal(e.error.ofrecerContacto, true);
		assert.equal(e.turnos.at(-1).estado, 'fallida');
		assert.equal(e.formularioHabilitado, !esperado.bloqueaFormulario);
	}
});

test('con el Worker simulado: Turnstile de prueba que falla da «verificacion» tras dos intentos', async () => {
	const t = turnstileFalso(['turnstile-falla', 'turnstile-falla']);
	const { a } = nuevo({ fetch: fetchHaciaElWorker(), turnstile: t });
	await a.enviar('hola');
	assert.equal(a.estado().error.clave, 'verificacion');
	assert.equal(t.obtenidos, 2);
	assert.equal(t.reinicios, 2);
});

// --- Estado inicial, salud, suscripción -----------------------------------------------------------------------------------

test('estado inicial y suscripción: se avisa al suscribirse y en cada cambio; se puede cancelar', async () => {
	const f = apiGuionada();
	const { a, vistos } = nuevo({ fetch: f });
	assert.equal(vistos.length, 1);
	const e = vistos[0];
	assert.deepEqual([e.abierto, e.turnos.length, e.fase, e.esperando, e.error, e.disponible, e.sinConexion, e.formularioHabilitado, e.restantes, e.maxCaracteres, e.mostrarSugerencias, e.idioma], [false, 0, 'libre', false, null, true, false, true, null, 500, true, 'es']);
	let cuenta = 0;
	const cancelar = a.suscribir(() => cuenta++);
	assert.equal(cuenta, 1);
	await a.abrir();
	assert.ok(cuenta >= 2);
	const antes = cuenta;
	cancelar();
	a.cerrar();
	assert.equal(cuenta, antes);
	// El estado devuelto es una copia: tocarlo no cambia el del asistente.
	const copia = a.estado();
	copia.turnos.push({ id: 99 });
	assert.equal(a.estado().turnos.length, 0);
});

test('abrir consulta la salud una sola vez, aunque se abra y cierre varias veces', async () => {
	const f = apiGuionada();
	const { a } = nuevo({ fetch: f });
	await a.abrir();
	a.cerrar();
	await a.abrir();
	assert.equal(f.de('/v1/salud').length, 1);
	assert.equal(f.de('/v1/sesion').length, 0, 'abrir no pide Turnstile ni sesión');
	assert.equal(f.llamadas[0].init.method, 'GET');
});

test('salud cerrada: lámpara apagada, error «tope» y formulario deshabilitado', async () => {
	const { a } = nuevo({ fetch: apiGuionada({ salud: [() => json({ abierto: false, indice: 'abc' })] }) });
	await a.abrir();
	const e = a.estado();
	assert.equal(e.disponible, false);
	assert.equal(e.error.clave, 'tope');
	assert.equal(e.formularioHabilitado, false);
});

test('salud caída: lámpara apagada pero sin error ni formulario apagado (se intenta igual)', async () => {
	const { a } = nuevo({ fetch: apiGuionada({ salud: [() => { throw new TypeError('red'); }] }) });
	await a.abrir();
	const e = a.estado();
	assert.equal(e.disponible, false);
	assert.equal(e.error, null);
	assert.equal(e.formularioHabilitado, true);
});

// --- Envío, sesión, historial -------------------------------------------------------------------------------------------

test('el pedido respeta el contrato: solo mensaje, historial, idioma y página; sin cookies; con la sesión en Authorization', async () => {
	const f = apiGuionada();
	const { a } = nuevo({ fetch: f, extra: { pagina: () => '/tecnico/' } });
	await a.enviar('  Hola\r\nmundo  ');
	const s = f.de('/v1/sesion')[0];
	assert.deepEqual(s.cuerpo, { turnstile: 'token-1', idioma: 'es' });
	assert.equal(s.init.credentials, 'omit');
	assert.equal(s.init.headers['Content-Type'], 'application/json');
	const m = f.de('/v1/mensaje')[0];
	assert.deepEqual(m.cuerpo, { mensaje: 'Hola\nmundo', historial: [], idioma: 'es', pagina: '/tecnico/' });
	assert.equal(m.init.headers.Authorization, 'Bearer v1.carga.firma');
	assert.equal(m.init.credentials, 'omit');
	assert.equal(m.init.referrerPolicy, 'no-referrer');
	assert.ok(!('cookie' in m.init.headers));
});

test('la página solo se envía si tiene la forma que acepta el Worker', async () => {
	for (const [pagina, esperada] of [['/casos/cargador-bajas/', '/casos/cargador-bajas/'], ['/Casos/X', undefined], ['/a?b=1', undefined], [undefined, undefined]]) {
		const f = apiGuionada();
		const { a } = nuevo({ fetch: f, extra: { pagina: () => pagina } });
		await a.enviar('hola');
		assert.equal(f.de('/v1/mensaje')[0].cuerpo.pagina, esperada, String(pagina));
	}
});

test('la sesión se reutiliza: Turnstile y sesión una sola vez; la segunda pregunta lleva el historial', async () => {
	const f = apiGuionada({ mensaje: [() => ok({ respuesta: 'Uno.' }), () => ok({ respuesta: 'Dos.' })] });
	const { a, turnstile } = nuevo({ fetch: f });
	await a.enviar('Primera');
	await a.enviar('Segunda');
	assert.equal(turnstile.obtenidos, 1);
	assert.equal(f.de('/v1/sesion').length, 1);
	assert.deepEqual(f.de('/v1/mensaje')[1].cuerpo.historial, [
		{ rol: 'user', texto: 'Primera' },
		{ rol: 'assistant', texto: 'Uno.', firma: FIRMA },
	]);
	assert.equal(a.estado().turnos.length, 4);
});

test('una sesión por vencer se renueva antes de preguntar', async () => {
	let ms = Date.now();
	const f = apiGuionada({ sesion: [() => sesionOk({ expira: Math.floor(ms / 1000) + 1800 })] });
	const { a, turnstile } = nuevo({ fetch: f, extra: { ahora: () => ms } });
	await a.enviar('uno');
	ms += 29 * 60 * 1000;
	await a.enviar('dos');
	assert.equal(turnstile.obtenidos, 1);
	ms += 90 * 1000; // faltan menos de 10 s para el vencimiento
	await a.enviar('tres');
	assert.equal(turnstile.obtenidos, 2);
});

test('armarHistorial: solo pares completos y enviados, los cuatro últimos y hasta 8.000 caracteres', () => {
	const u = (id, texto, estado = 'enviada') => ({ id, rol: 'usuario', texto, estado });
	const r = (id, texto, firma = FIRMA) => ({ id, rol: 'asistente', texto, firma, bloques: [], fuentes: [], derivar: false });
	assert.deepEqual(armarHistorial([]), []);
	assert.deepEqual(armarHistorial([u(1, 'a', 'fallida'), u(2, 'b'), r(3, 'c')]), [{ rol: 'user', texto: 'b' }, { rol: 'assistant', texto: 'c', firma: FIRMA }]);
	assert.deepEqual(armarHistorial([u(1, 'sin respuesta', 'pendiente')]), []);
	const seis = Array.from({ length: 6 }, (_, i) => [u(i * 2 + 1, `p${i}`), r(i * 2 + 2, `r${i}`)]).flat();
	const h = armarHistorial(seis);
	assert.equal(h.length, 8);
	assert.equal(h[0].texto, 'p2');
	// Pasa de 8.000: se descartan los pares más viejos.
	const pesados = Array.from({ length: 4 }, (_, i) => [u(i * 2 + 1, 'x'.repeat(500)), r(i * 2 + 2, 'y'.repeat(1900))]).flat();
	const h2 = armarHistorial(pesados);
	assert.ok(h2.reduce((n, t) => n + t.texto.length, 0) <= 8000);
	assert.ok(h2.length < 8 && h2.length % 2 === 0);
	// La respuesta va tal cual (el Worker la firmó así): una que no cabe en un turno, o sin firma, deja afuera su par.
	assert.deepEqual(armarHistorial([u(1, 'p'), r(2, 'z'.repeat(2000))]).map((x) => x.texto.length), [1, 2000]);
	assert.deepEqual(armarHistorial([u(1, 'p'), r(2, 'z'.repeat(2001))]), []);
	assert.deepEqual(armarHistorial([u(1, 'p'), r(2, 'ok', '')]), []);
	assert.deepEqual(armarHistorial([u(1, 'p'), r(2, 'ok', '')].concat([u(3, 'q'), r(4, 'bien')])).map((x) => x.texto), ['q', 'bien']);
});

test('limpiarEntrada: saltos normalizados, sin controles ni marcas invisibles, sin espacios en los bordes', () => {
	assert.equal(limpiarEntrada('  a\r\nb\u0000c‮d​e\t f  '), 'a\nbcde f');
});

// --- Validaciones locales -----------------------------------------------------------------------------------------------

test('pregunta vacía o demasiado larga: error local, sin turno y sin tocar la red', async () => {
	const f = apiGuionada();
	const { a } = nuevo({ fetch: f });
	await a.enviar('   \n ');
	assert.equal(a.estado().error.clave, 'vacio');
	await a.enviar('a'.repeat(501));
	assert.equal(a.estado().error.clave, 'largo');
	assert.equal(a.estado().turnos.length, 0);
	assert.equal(f.llamadas.length, 0);
	// Con 500 justos sí se envía, y el error anterior se limpia.
	await a.enviar('a'.repeat(500));
	assert.equal(a.estado().error, null);
	assert.equal(a.estado().turnos.length, 2);
});

test('mientras hay una pregunta en curso no se envía otra', async () => {
	let liberar;
	const f = apiGuionada({ mensaje: [() => new Promise((r) => (liberar = () => r(ok())))] });
	const { a } = nuevo({ fetch: f });
	const primera = a.enviar('uno');
	await new Promise((r) => setImmediate(r));
	assert.equal(a.estado().esperando, true);
	await a.enviar('dos');
	assert.equal(a.estado().turnos.length, 1);
	liberar();
	await primera;
	assert.equal(f.de('/v1/mensaje').length, 1);
});

// --- Reintentos acotados ------------------------------------------------------------------------------------------------

test('sesión inválida (401): se pide otra sesión y se reenvía UNA vez', async () => {
	const f = apiGuionada({ mensaje: [() => falla('sesion_invalida', 401), () => ok()] });
	const { a, turnstile } = nuevo({ fetch: f });
	await a.enviar('hola');
	assert.equal(a.estado().error, null);
	assert.equal(a.estado().turnos.length, 2);
	assert.equal(turnstile.obtenidos, 2);
	assert.equal(f.de('/v1/sesion').length, 2);
	assert.equal(f.de('/v1/mensaje').length, 2);
});

test('sesión inválida que persiste: dos intentos y error de servicio, sin bucle', async () => {
	const f = apiGuionada({ mensaje: [() => falla('sesion_invalida', 401)] });
	const { a } = nuevo({ fetch: f });
	await a.enviar('hola');
	assert.equal(a.estado().error.clave, 'servicio');
	assert.equal(f.de('/v1/mensaje').length, 2);
	assert.equal(f.de('/v1/sesion').length, 2);
});

test('Turnstile: un fallo se reintenta una vez; dos fallos son «verificacion» y no se pide sesión', async () => {
	const uno = nuevo({ fetch: apiGuionada(), turnstile: turnstileFalso(['falla', 'tok']) });
	await uno.a.enviar('hola');
	assert.equal(uno.ultimo().error, null);
	assert.equal(uno.turnstile.obtenidos, 2);
	assert.equal(uno.turnstile.reinicios, 1);

	const f = apiGuionada();
	const dos = nuevo({ fetch: f, turnstile: turnstileFalso(['falla', 'falla']) });
	await dos.a.enviar('hola');
	assert.equal(dos.ultimo().error.clave, 'verificacion');
	assert.equal(dos.ultimo().error.reintentable, true);
	assert.equal(dos.turnstile.obtenidos, 2);
	assert.equal(f.de('/v1/sesion').length, 0);
	assert.equal(dos.ultimo().turnos[0].estado, 'fallida');
});

test('Turnstile rechazado por el Worker (403): una repetición y después error', async () => {
	const f = apiGuionada({ sesion: [() => falla('turnstile_fallido', 403)] });
	const { a, turnstile } = nuevo({ fetch: f });
	await a.enviar('hola');
	assert.equal(a.estado().error.clave, 'verificacion');
	assert.equal(turnstile.obtenidos, 2);
	assert.equal(f.de('/v1/sesion').length, 2);
});

test('error de red: sin repetición automática; «Reintentar» reenvía la misma pregunta sin duplicarla', async () => {
	const f = apiGuionada({ mensaje: [() => { throw new TypeError('Failed to fetch'); }, () => ok()] });
	const { a } = nuevo({ fetch: f });
	await a.enviar('hola');
	let e = a.estado();
	assert.deepEqual([e.error.clave, e.error.reintentable, e.error.ofrecerContacto], ['red', true, true]);
	assert.equal(f.de('/v1/mensaje').length, 1);
	assert.deepEqual(e.turnos.map((t) => [t.rol, t.estado]), [['usuario', 'fallida']]);
	await a.reintentar();
	e = a.estado();
	assert.equal(e.error, null);
	assert.deepEqual(e.turnos.map((t) => [t.rol, t.estado ?? '']), [['usuario', 'enviada'], ['asistente', '']]);
	assert.equal(f.de('/v1/mensaje')[1].cuerpo.mensaje, 'hola');
});

test('«Reintentar» sin pregunta fallida no hace nada', async () => {
	const f = apiGuionada();
	const { a } = nuevo({ fetch: f });
	await a.reintentar();
	await a.enviar('hola');
	await a.reintentar();
	assert.equal(f.de('/v1/mensaje').length, 1);
});

test('tiempo agotado del cliente: error «tiempo», reintentable', async () => {
	const f = apiGuionada({ mensaje: [(init) => new Promise((_r, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('abortado', 'AbortError'))))] });
	const { a } = nuevo({ fetch: f, extra: { tiempoMaxMs: 30 } });
	const t0 = Date.now();
	await a.enviar('hola');
	assert.equal(a.estado().error.clave, 'tiempo');
	assert.equal(a.estado().error.reintentable, true);
	assert.ok(Date.now() - t0 < 2000);
});

test('límite de sesión: se descarta la sesión y «Reintentar» abre una nueva', async () => {
	const f = apiGuionada({ mensaje: [() => falla('limite_sesion', 429), () => ok()] });
	const { a, turnstile } = nuevo({ fetch: f });
	await a.enviar('hola');
	assert.equal(a.estado().error.clave, 'limiteSesion');
	assert.equal(a.estado().formularioHabilitado, true);
	await a.reintentar();
	assert.equal(a.estado().error, null);
	assert.equal(turnstile.obtenidos, 2);
});

test('límite del visitante y tope diario: apagan el formulario y la lámpara; empezar de nuevo no los quita', async () => {
	const f = apiGuionada({ mensaje: [() => falla('limite_visitante', 429, { reintentar_en: 600 })] });
	const { a } = nuevo({ fetch: f });
	await a.enviar('hola');
	let e = a.estado();
	assert.deepEqual([e.error.clave, e.error.reintentarEnSeg, e.formularioHabilitado, e.disponible], ['limiteVisitante', 600, false, false]);
	await a.enviar('otra');
	assert.equal(f.de('/v1/mensaje').length, 1, 'no envía con el formulario apagado');
	a.reiniciar();
	e = a.estado();
	assert.equal(e.turnos.length, 0);
	assert.equal(e.formularioHabilitado, false);
});

test('errores de configuración del Worker (origen, tipo, ruta): contacto, sin reintentar', async () => {
	for (const [codigo, status] of [['origen_no_permitido', 403], ['tipo_no_soportado', 415], ['solicitud_invalida', 400], ['no_encontrado', 404]]) {
		const { a } = nuevo({ fetch: apiGuionada({ mensaje: [() => falla(codigo, status)] }) });
		await a.enviar('hola');
		const e = a.estado().error;
		assert.deepEqual([e.clave, e.reintentable, e.ofrecerContacto], ['servicio', false, true], codigo);
	}
});

test('respuestas raras del servicio: se tratan como error de servicio y nunca rompen', async () => {
	const raras = [
		() => new Response('<html>502 Bad Gateway</html>', { status: 502 }),
		() => new Response('no es json', { status: 200 }),
		() => json({ respuesta: 5, firma: FIRMA, idioma: 'es', restantes: 1, derivar: false }),
		() => json({ respuesta: 'x', firma: FIRMA, idioma: 'pt', restantes: 1, derivar: false }),
		() => json({ respuesta: 'x', firma: FIRMA, idioma: 'es', restantes: '1', derivar: false }),
		() => json({ respuesta: 'x', firma: FIRMA, idioma: 'es', restantes: 1, derivar: 'no' }),
		() => json({ respuesta: 'x', idioma: 'es', restantes: 1, derivar: false }), // sin firma
		() => json({ respuesta: 'x', firma: 'corta', idioma: 'es', restantes: 1, derivar: false }), // firma mal formada
		() => json(null),
		() => json([]),
		() => json({ error: { codigo: 'Código <script>' } }, 500),
		() => json({ respuesta: 'x'.repeat(60_000), firma: FIRMA, idioma: 'es', restantes: 1, derivar: false }),
	];
	for (const r of raras) {
		const { a } = nuevo({ fetch: apiGuionada({ mensaje: [r] }) });
		await a.enviar('hola');
		const e = a.estado();
		assert.equal(e.error?.clave, 'servicio', 'una respuesta rara tiene que dar error de servicio');
		assert.equal(e.fase, 'libre');
	}
});

test('una sesión rara del Worker también es un error de servicio', async () => {
	for (const s of [() => json({ sesion: 5 }), () => json({ sesion: 'x', expira: 'mañana', limites: {} }), () => json({})]) {
		const { a } = nuevo({ fetch: apiGuionada({ sesion: [s] }) });
		await a.enviar('hola');
		assert.equal(a.estado().error?.clave, 'servicio');
	}
});

// --- Seguridad: la respuesta se pinta como texto -------------------------------------------------------------------------

test('XSS: HTML, javascript: y enlaces ajenos de la respuesta llegan como texto, sin ningún enlace', async () => {
	const hostil = '<img src=x onerror=alert(1)>\n\n[Pulse](javascript:alert(2)) [Ajeno](https://evil.example/robo) https://evil.example/otra <script>alert(3)</script>';
	const { a } = nuevo({ fetch: apiGuionada({ mensaje: [() => ok({ respuesta: hostil })] }) });
	await a.enviar('hola');
	const r = a.estado().turnos[1];
	const partes = r.bloques.flatMap((b) => (b.tipo === 'lista' ? b.items.flat() : b.partes));
	assert.equal(partes.filter((p) => p.tipo === 'enlace').length, 0);
	assert.deepEqual(r.fuentes, []);
	const plano = partes.map((p) => p.texto).join('');
	assert.ok(plano.includes('<img src=x onerror=alert(1)>'), 'la etiqueta se ve como texto');
	assert.ok(!plano.includes('javascript:'));
	// Todo lo que el controlador entrega son cadenas, no nodos ni funciones.
	assert.equal(JSON.stringify(r), JSON.stringify(JSON.parse(JSON.stringify(r))));
});

// --- Conexión y conversación nueva --------------------------------------------------------------------------------------

test('sin conexión: no se envía hasta que vuelva; también se toma de la configuración inicial', async () => {
	const f = apiGuionada();
	const { a } = nuevo({ fetch: f });
	a.fijarConexion(false);
	assert.equal(a.estado().sinConexion, true);
	await a.enviar('hola');
	assert.equal(a.estado().turnos.length, 0);
	assert.equal(f.llamadas.length, 0);
	a.fijarConexion(true);
	assert.equal(a.estado().sinConexion, false);
	await a.enviar('hola');
	assert.equal(a.estado().turnos.length, 2);

	const sin = nuevo({ fetch: apiGuionada(), extra: { enLinea: () => false } });
	assert.equal(sin.a.estado().sinConexion, true);
});

test('conversación nueva: se vacía todo y una respuesta que llega después se descarta', async () => {
	let liberar;
	const f = apiGuionada({ mensaje: [() => new Promise((r) => (liberar = () => r(ok())))] });
	const { a } = nuevo({ fetch: f });
	const envio = a.enviar('hola');
	await new Promise((r) => setImmediate(r));
	a.reiniciar();
	assert.deepEqual([a.estado().turnos.length, a.estado().esperando, a.estado().mostrarSugerencias], [0, false, true]);
	liberar();
	await envio;
	assert.equal(a.estado().turnos.length, 0);
	assert.equal(a.estado().error, null);
});

test('los textos salen en el idioma pedido', () => {
	const es = crearAsistente({ urlApi: API, idioma: 'es', contacto, turnstile: turnstileFalso() });
	const en = crearAsistente({ urlApi: API, idioma: 'en', contacto, turnstile: turnstileFalso() });
	assert.match(es.textos.saludo, /asistente con IA/);
	assert.match(en.textos.saludo, /AI assistant/);
	assert.ok(es.textos.errores.red.includes(correo));
	assert.equal(en.estado().idioma, 'en');
});

test('en inglés, el pedido lleva idioma «en» y los rótulos de fuente salen en inglés', async () => {
	const f = apiGuionada({ mensaje: [() => ok({ respuesta: 'See [Technical](/#tecnico).', idioma: 'en' })] });
	const { a } = nuevo({ fetch: f, extra: { idioma: 'en' } });
	await a.enviar('hi');
	assert.equal(f.de('/v1/mensaje')[0].cuerpo.idioma, 'en');
	assert.deepEqual(a.estado().turnos[1].fuentes, [{ href: '/#tecnico', texto: 'Software & AI' }]);
});

// --- Config del build ---------------------------------------------------------------------------------------------------

test('config: sin URL el asistente no se monta; con URL válida sí', () => {
	assert.deepEqual(leerConfigDeEntorno({}, true), { activo: false, motivo: 'sin PUBLIC_ASISTENTE_URL' });
	assert.equal(leerConfigDeEntorno({ PUBLIC_ASISTENTE_URL: '   ' }, true).activo, false);
	const ok1 = leerConfigDeEntorno({ PUBLIC_ASISTENTE_URL: 'https://asistente.matiasormeno.com.ar/', PUBLIC_TURNSTILE_SITEKEY: '0x4AAAAAAAexample_key' }, true);
	assert.deepEqual(ok1, { activo: true, urlApi: 'https://asistente.matiasormeno.com.ar', sitekey: '0x4AAAAAAAexample_key', modoPrueba: false });
});

test('config: en producción exige https y sitekey; lo local solo sirve fuera de producción', () => {
	const sitekey = '0x4AAAAAAAexample_key';
	for (const url of ['http://asistente.matiasormeno.com.ar', 'ftp://x.example', 'javascript:alert(1)', 'no es una url', 'https://u:p@asistente.matiasormeno.com.ar', 'https://asistente.matiasormeno.com.ar/ruta', 'https://asistente.matiasormeno.com.ar/?a=1']) {
		assert.equal(leerConfigDeEntorno({ PUBLIC_ASISTENTE_URL: url, PUBLIC_TURNSTILE_SITEKEY: sitekey }, true).activo, false, url);
	}
	assert.equal(leerConfigDeEntorno({ PUBLIC_ASISTENTE_URL: 'https://asistente.matiasormeno.com.ar' }, true).activo, false, 'falta la sitekey');
	assert.equal(leerConfigDeEntorno({ PUBLIC_ASISTENTE_URL: 'https://asistente.matiasormeno.com.ar', PUBLIC_TURNSTILE_SITEKEY: 'corta' }, true).activo, false);
	// Local: modo de prueba, sin sitekey, solo en desarrollo.
	assert.deepEqual(leerConfigDeEntorno({ PUBLIC_ASISTENTE_URL: 'http://localhost:8787' }, false), { activo: true, urlApi: 'http://localhost:8787', sitekey: null, modoPrueba: true });
	assert.equal(leerConfigDeEntorno({ PUBLIC_ASISTENTE_URL: 'http://localhost:8787' }, true).activo, false, 'nunca en un build de producción');
	assert.equal(leerConfigDeEntorno({ PUBLIC_ASISTENTE_URL: 'http://127.0.0.1:8787' }, true).activo, false);
	assert.equal(leerConfigDeEntorno({ PUBLIC_ASISTENTE_URL: 'https://localhost:8787' }, false).activo, false);
});

test('config: la sitekey de prueba de Cloudflare solo sirve fuera de producción', () => {
	const prueba = '1x00000000000000000000AA';
	for (const clave of [prueba, '2x00000000000000000000AB', '3x00000000000000000000FF']) {
		assert.equal(esSitekeyDePrueba(clave), true, clave);
		const r = leerConfigDeEntorno({ PUBLIC_ASISTENTE_URL: 'https://asistente.matiasormeno.com.ar', PUBLIC_TURNSTILE_SITEKEY: clave }, true);
		assert.equal(r.activo, false, clave);
		assert.match(r.motivo, /prueba/);
	}
	assert.equal(esSitekeyDePrueba('0x4AAAAAAAexample_key'), false);
	assert.deepEqual(leerConfigDeEntorno({ PUBLIC_ASISTENTE_URL: 'http://localhost:8787', PUBLIC_TURNSTILE_SITEKEY: prueba }, false), { activo: true, urlApi: 'http://localhost:8787', sitekey: prueba, modoPrueba: true });
});
// --- Turnstile en el navegador ------------------------------------------------------------------------------------------

function navegadorFalso() {
	const n = { scripts: [], renders: [], quitados: [], turnstile: undefined };
	n.document = {
		createElement: () => ({ src: '', async: false, defer: false, onload: null, onerror: null }),
		head: {
			appendChild: (s) => {
				n.scripts.push(s);
			},
		},
	};
	n.cargarApi = () => {
		n.turnstile = {
			render: (c, o) => {
				n.renders.push({ contenedor: c, opciones: o });
				return `w${n.renders.length}`;
			},
			remove: (id) => n.quitados.push(id),
		};
		n.scripts.at(-1).onload();
	};
	return n;
}

test('turnstile del navegador: no pide nada hasta que se necesita; carga el script una vez y dibuja en el contenedor', async () => {
	const n = navegadorFalso();
	const contenedor = { nombre: 'recuadro' };
	const t = turnstileNavegador({ sitekey: '0x4AAAAAAAexample_key', contenedor: () => contenedor, idioma: 'en', entorno: n });
	assert.equal(n.scripts.length, 0, 'crear el proveedor no carga nada');
	const p = t.obtenerToken();
	await new Promise((r) => setImmediate(r));
	assert.equal(n.scripts.length, 1);
	assert.equal(n.scripts[0].src, URL_SCRIPT_TURNSTILE);
	assert.ok(n.scripts[0].src.startsWith('https://challenges.cloudflare.com/'));
	n.cargarApi();
	await new Promise((r) => setImmediate(r));
	const { contenedor: c, opciones } = n.renders[0];
	assert.equal(c, contenedor);
	assert.deepEqual([opciones.sitekey, opciones.action, opciones.appearance, opciones.size, opciones.language], ['0x4AAAAAAAexample_key', 'asistente', 'interaction-only', 'flexible', 'en']);
	opciones.callback('token-de-turnstile');
	assert.equal(await p, 'token-de-turnstile');
	// Una segunda vez no vuelve a cargar el script y descarta el widget anterior.
	const p2 = t.obtenerToken();
	await new Promise((r) => setImmediate(r));
	assert.equal(n.scripts.length, 1);
	assert.deepEqual(n.quitados, ['w1']);
	n.renders[1].opciones.callback('otro');
	assert.equal(await p2, 'otro');
	t.reiniciar();
	assert.deepEqual(n.quitados, ['w1', 'w2']);
});

test('turnstile del navegador: error, vencimiento, falta de contenedor y falla de carga rechazan', async () => {
	const n = navegadorFalso();
	const t = turnstileNavegador({ sitekey: '0x4AAAAAAAexample_key', contenedor: () => ({}), idioma: 'es', entorno: n });
	const p = t.obtenerToken();
	await new Promise((r) => setImmediate(r));
	n.cargarApi();
	await new Promise((r) => setImmediate(r));
	n.renders[0].opciones['error-callback']();
	await assert.rejects(p);
	const p2 = t.obtenerToken();
	await new Promise((r) => setImmediate(r));
	n.renders[1].opciones['expired-callback']();
	await assert.rejects(p2);

	const sin = turnstileNavegador({ sitekey: '0x4AAAAAAAexample_key', contenedor: () => null, idioma: 'es', entorno: n });
	await assert.rejects(sin.obtenerToken());

	const m = navegadorFalso();
	const roto = turnstileNavegador({ sitekey: '0x4AAAAAAAexample_key', contenedor: () => ({}), idioma: 'es', entorno: m });
	const p3 = roto.obtenerToken();
	await new Promise((r) => setImmediate(r));
	m.scripts[0].onerror();
	await assert.rejects(p3);
	// Después de una falla de carga se puede volver a intentar.
	const p4 = roto.obtenerToken();
	await new Promise((r) => setImmediate(r));
	assert.equal(m.scripts.length, 2);
	m.cargarApi();
	await new Promise((r) => setImmediate(r));
	m.renders[0].opciones.callback('ok');
	assert.equal(await p4, 'ok');
});

test('turnstile del navegador: si nadie responde, vence', async () => {
	const n = navegadorFalso();
	const t = turnstileNavegador({ sitekey: '0x4AAAAAAAexample_key', contenedor: () => ({}), idioma: 'es', entorno: n, tiempoMaxMs: 20 });
	const p = t.obtenerToken();
	await new Promise((r) => setImmediate(r));
	n.cargarApi();
	await assert.rejects(p);
});

test('turnstile de prueba: no carga nada de terceros y da el token que acepta el Worker simulado', async () => {
	const t = turnstileDePrueba();
	assert.equal(await t.obtenerToken(), TOKEN_DE_PRUEBA);
	t.reiniciar();
	const { a } = nuevo({ fetch: fetchHaciaElWorker(), turnstile: t });
	await a.enviar('¿qué busca?');
	assert.equal(a.estado().error, null);
});

test('un límite con «reintentar en» se levanta solo al vencer; sin ese dato, no', async () => {
	const agenda = [];
	const programar = (accion, ms) => agenda.push({ accion, ms });
	const f = apiGuionada({ mensaje: [() => falla('limite_visitante', 429, { reintentar_en: 60 }), () => ok()] });
	const { a } = nuevo({ fetch: f, extra: { programar } });
	await a.enviar('hola');
	assert.equal(a.estado().formularioHabilitado, false);
	assert.deepEqual(agenda.map((x) => x.ms), [60_000]);
	agenda[0].accion();
	const e = a.estado();
	assert.equal(e.error, null);
	assert.equal(e.formularioHabilitado, true);
	assert.equal(e.disponible, true);
	await a.enviar('otra');
	assert.equal(f.de('/v1/mensaje').length, 2, 'después de vencer, vuelve a enviar');

	// Sin «reintentar en» no se agenda nada.
	const f2 = apiGuionada({ mensaje: [() => falla('limite_visitante', 429)] });
	const agenda2 = [];
	const { a: b } = nuevo({ fetch: f2, extra: { programar: (x, ms) => agenda2.push({ x, ms }) } });
	await b.enviar('hola');
	assert.equal(agenda2.length, 0);
	assert.equal(b.estado().formularioHabilitado, false);
});

test('el historial que se manda al Worker lleva la firma de cada respuesta, tal como llegó', async () => {
	const f = apiGuionada({ mensaje: [() => ok({ respuesta: 'Uno.', firma: 'A'.repeat(43) }), () => ok({ respuesta: 'Dos.', firma: 'B'.repeat(43) }), () => ok()] });
	const { a } = nuevo({ fetch: f });
	await a.enviar('uno');
	await a.enviar('dos');
	await a.enviar('tres');
	const h = f.de('/v1/mensaje')[2].cuerpo.historial;
	assert.deepEqual(h, [
		{ rol: 'user', texto: 'uno' },
		{ rol: 'assistant', texto: 'Uno.', firma: 'A'.repeat(43) },
		{ rol: 'user', texto: 'dos' },
		{ rol: 'assistant', texto: 'Dos.', firma: 'B'.repeat(43) },
	]);
});


test('con temporizadores falsos: vencido «reintentar en», el formulario se habilita de nuevo y la pregunta siguiente se envía', async (ctx) => {
	ctx.mock.timers.enable({ apis: ['setTimeout'] });
	const f = apiGuionada({ mensaje: [() => falla('limite_visitante', 429, { reintentar_en: 45 }), () => ok()] });
	const { a } = nuevo({ fetch: f }); // sin `programar`: usa el setTimeout real, aquí falso
	await a.enviar('hola');
	assert.equal(a.estado().formularioHabilitado, false);
	ctx.mock.timers.tick(44_999);
	assert.equal(a.estado().formularioHabilitado, false, 'un milisegundo antes sigue bloqueado');
	ctx.mock.timers.tick(1);
	const e = a.estado();
	assert.equal(e.error, null);
	assert.equal(e.formularioHabilitado, true);
	assert.equal(e.disponible, true);
	await a.enviar('otra');
	assert.equal(f.de('/v1/mensaje').length, 2);
	assert.equal(a.estado().turnos.at(-1).rol, 'asistente');
});

test('ajustarAlCuerpo: quita pares viejos hasta entrar en el tope de bytes y no toca el mensaje', () => {
	const par = (n) => [{ rol: 'user', texto: 'é'.repeat(n) }, { rol: 'assistant', texto: 'ú'.repeat(n), firma: FIRMA }];
	const pedido = { mensaje: 'hola', historial: [...par(100), ...par(100), ...par(100)], idioma: 'es' };
	const bytes = (p) => new TextEncoder().encode(JSON.stringify(p)).length;
	const completo = bytes(pedido);
	assert.deepEqual(ajustarAlCuerpo(pedido, completo), pedido);
	const dos = ajustarAlCuerpo(pedido, completo - 1);
	assert.equal(dos.historial.length, 4);
	assert.equal(dos.historial[0].rol, 'user', 'sigue empezando por user y alternando');
	assert.deepEqual(dos.historial, pedido.historial.slice(2));
	assert.ok(bytes(dos) <= completo - 1);
	assert.deepEqual(ajustarAlCuerpo(pedido, 10).historial, [], 'si ni vacío entra, queda sin historial (el Worker dirá 413)');
	assert.equal(ajustarAlCuerpo(pedido, 10).mensaje, 'hola');
});

test('413 del Worker: «conversación larga», sin bloquear el formulario; «Nueva conversación» lo quita y se puede seguir', async () => {
	const f = apiGuionada({ mensaje: [() => falla('cuerpo_demasiado_grande', 413), () => ok()] });
	const { a } = nuevo({ fetch: f });
	await a.enviar('hola');
	let e = a.estado();
	assert.equal(e.error.clave, 'conversacionLarga');
	assert.equal(e.error.reintentable, false);
	assert.equal(e.formularioHabilitado, true);
	assert.ok(a.textos.errores.conversacionLarga.includes('nueva conversación'));
	a.reiniciar();
	e = a.estado();
	assert.equal(e.error, null);
	await a.enviar('otra');
	assert.equal(f.de('/v1/mensaje').at(-1).cuerpo.historial.length, 0);
	assert.equal(a.estado().turnos.at(-1).rol, 'asistente');
});
