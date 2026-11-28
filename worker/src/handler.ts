// El Worker del asistente: enrutador, CORS, orden de las comprobaciones y errores opacos (docs-asistente/03, secciones 3, 4 y 9).
// No importa nada de `cloudflare:` ni del contenido generado: todo lo de afuera entra por `Dependencias`, así se prueba en Node.
//
// Orden de `POST /v1/mensaje` (cada paso corta antes de gastar el siguiente):
//   origen y tipo → cuerpo con tope de tamaño → sesión firmada → validación → limitador atómico → datos personales → proveedor.
import { llamarAnthropic, armarMensajes } from './anthropic.ts';
import { ESTADO_HTTP, LIMITES, validarPedidoMensaje, validarPedidoSesion } from './contrato.ts';
import type { CodigoError, RespuestaError, RespuestaMensaje, RespuestaSalud, RespuestaSesion } from './contrato.ts';
import { configDeEntorno } from './limitador.ts';
import type { LimitadorCliente } from './limitador.ts';
import { lineaDelVisitante, procesarRespuesta, recortarEnFrase, REGLAS } from './prompt.ts';
import { registrar } from './registro.ts';
import { emitirSesion, firmarTurno, verificarSesion, verificarTurno } from './sesion.ts';
import { respuestaSimulada } from './simulado.ts';
import { esSecretoDePrueba, verificarTurnstile } from './turnstile.ts';
import { huellaVisitante } from './visitante.ts';
import { secretoValido } from './cripto.ts';

export interface Entorno {
	ALLOWED_ORIGINS?: string;
	TURNSTILE_HOSTNAMES?: string;
	MODELO?: string;
	MAX_TOKENS_SALIDA?: string;
	TOPE_DIA?: string;
	TOPE_MES?: string;
	/** `1` = interruptor: todo responde 503 `servicio_pausado`. */
	PAUSADO?: string;
	/** `1` = modo de prueba. Solo se honra si el Worker atiende en localhost. */
	SIMULADO?: string;
	ANTHROPIC_API_KEY?: string;
	TURNSTILE_SECRET?: string;
	SESSION_SECRET?: string;
}

export interface Dependencias {
	fetch: (url: string, init: RequestInit) => Promise<Response>;
	limitador: LimitadorCliente;
	/** El contenido público generado en el build (`<contenido_publico>…`) y su huella de 12 caracteres. */
	contexto: { texto: string; indice: string };
	ahoraMs: () => number;
	esperar: (ms: number) => Promise<void>;
	registrar: (datos: Record<string, unknown>) => void;
}

/** Para usar en `index.ts`. */
export const dependenciasBase = {
	ahoraMs: () => Date.now(),
	esperar: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
	registrar: (d: Record<string, unknown>) => registrar(d),
};

const TIEMPO_PROVEEDOR_MS = 25_000;
/** Lo que cabe en un turno del historial: el widget devuelve la respuesta entera y firmada, sin recortarla. */
const MAX_RESPUESTA = LIMITES.textoHistorial;
const SECRETO_LOCAL = 'secreto-solo-para-pruebas-locales-0000';
const HOST_LOCAL = /^(?:localhost|127\.0\.0\.1|\[::1\])$/;
const ORIGEN_LOCAL = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;
const RUTAS: Record<string, 'GET' | 'POST'> = { '/v1/salud': 'GET', '/v1/sesion': 'POST', '/v1/mensaje': 'POST' };

/** Lo que el Worker necesita para atender; `null` si falta algo (entonces responde 503 `servicio_pausado`). */
interface Config {
	secreto: string;
	claveAnthropic: string;
	secretoTurnstile: string;
	modelo: string;
}

function leerConfig(env: Entorno, simulado: boolean, local: boolean): Config | null {
	const secreto = simulado && !secretoValido(env.SESSION_SECRET) ? SECRETO_LOCAL : env.SESSION_SECRET;
	if (!secretoValido(secreto)) return null;
	const claveAnthropic = env.ANTHROPIC_API_KEY ?? '';
	const secretoTurnstile = env.TURNSTILE_SECRET ?? '';
	const modelo = env.MODELO?.trim() ?? '';
	// Una secreta de prueba de Turnstile aceptaría cualquier token: fuera de localhost es una configuración rota, no un modo de uso.
	if (!local && esSecretoDePrueba(secretoTurnstile)) return null;
	if (!simulado && (claveAnthropic === '' || secretoTurnstile === '' || !/^[A-Za-z0-9._-]{1,80}$/.test(modelo))) return null;
	return { secreto, claveAnthropic, secretoTurnstile, modelo };
}

// ---------------------------------------------------------------------------------------------------------------------

const lista = (texto: string | undefined): string[] =>
	(texto ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s !== '');

const esLocal = (req: Request): boolean => HOST_LOCAL.test(new URL(req.url).hostname);

/** Orígenes exactos de la variable; `localhost` solo cuando el propio Worker corre en localhost (nunca en producción). */
function origenPermitido(origen: string | null, env: Entorno, local: boolean): boolean {
	if (origen === null) return false;
	if (lista(env.ALLOWED_ORIGINS).includes(origen)) return true;
	return local && ORIGEN_LOCAL.test(origen);
}

const CABECERAS_BASE: Record<string, string> = {
	'content-type': 'application/json; charset=utf-8',
	'cache-control': 'no-store',
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'no-referrer',
	vary: 'Origin',
};

function responder(cuerpo: unknown, estado: number, origenCors: string | null, extra: Record<string, string> = {}): Response {
	const h: Record<string, string> = { ...CABECERAS_BASE, ...extra };
	if (origenCors) h['access-control-allow-origin'] = origenCors;
	return new Response(JSON.stringify(cuerpo), { status: estado, headers: h });
}

function fallo(codigo: CodigoError, origenCors: string | null, reintentarEn?: number, extra: Record<string, string> = {}): Response {
	const cuerpo: RespuestaError = { error: reintentarEn !== undefined ? { codigo, reintentar_en: Math.max(1, Math.ceil(reintentarEn)) } : { codigo } };
	const h = { ...extra };
	if (reintentarEn !== undefined) h['retry-after'] = String(Math.max(1, Math.ceil(reintentarEn)));
	return responder(cuerpo, ESTADO_HTTP[codigo], origenCors, h);
}

type Cuerpo = { ok: true; texto: string } | { ok: false; codigo: 'cuerpo_demasiado_grande' | 'solicitud_invalida' };

/** Lee el cuerpo con tope: si pasa de `max` bytes se corta y no se sigue leyendo. */
async function leerCuerpo(req: Request, max: number): Promise<Cuerpo> {
	const declarado = Number(req.headers.get('content-length'));
	if (Number.isFinite(declarado) && declarado > max) return { ok: false, codigo: 'cuerpo_demasiado_grande' };
	if (!req.body) return { ok: true, texto: '' };
	const lector = req.body.getReader();
	const partes: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await lector.read();
		if (done) break;
		total += value.byteLength;
		if (total > max) {
			await lector.cancel().catch(() => undefined);
			return { ok: false, codigo: 'cuerpo_demasiado_grande' };
		}
		partes.push(value);
	}
	const bytes = new Uint8Array(total);
	let pos = 0;
	for (const p of partes) {
		bytes.set(p, pos);
		pos += p.byteLength;
	}
	try {
		return { ok: true, texto: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
	} catch {
		return { ok: false, codigo: 'solicitud_invalida' };
	}
}

function parsear(texto: string): unknown {
	try {
		return JSON.parse(texto);
	} catch {
		return undefined;
	}
}

const entero = (texto: string | undefined, min: number, max: number, porDefecto: number): number => {
	if (texto === undefined || !/^\d{1,6}$/.test(texto.trim())) return porDefecto;
	const n = Number(texto.trim());
	return n >= min && n <= max ? n : porDefecto;
};

// ---------------------------------------------------------------------------------------------------------------------

export async function manejar(req: Request, env: Entorno, deps: Dependencias): Promise<Response> {
	const url = new URL(req.url);
	const ruta = url.pathname;
	const local = esLocal(req);
	const origen = req.headers.get('origin');
	const permitido = origenPermitido(origen, env, local);
	const cors = permitido ? origen : null;
	const registrarRechazo = (codigo: string) => deps.registrar({ evento: 'rechazo', codigo, indice: deps.contexto.indice });

	try {
		const metodoEsperado = RUTAS[ruta];
		if (metodoEsperado === undefined) return fallo('no_encontrado', cors);

		// Preflight: solo para orígenes de la lista.
		if (req.method === 'OPTIONS') {
			if (cors === null) return fallo('origen_no_permitido', null);
			return new Response(null, {
				status: 204,
				headers: {
					'access-control-allow-origin': cors,
					'access-control-allow-methods': 'POST, GET, OPTIONS',
					'access-control-allow-headers': 'Content-Type, Authorization',
					'access-control-max-age': '600',
					vary: 'Origin',
					'cache-control': 'no-store',
				},
			});
		}
		if (req.method !== metodoEsperado) return fallo('metodo_no_permitido', cors, undefined, { allow: `${metodoEsperado}, OPTIONS` });

		// Origen: un navegador ajeno no entra (curl sí puede mentir el Origin: eso lo frenan Turnstile y los límites).
		if (metodoEsperado === 'POST' && !permitido) return fallo('origen_no_permitido', null);
		if (metodoEsperado === 'GET' && origen !== null && !permitido) return fallo('origen_no_permitido', null);

		const simulado = env.SIMULADO === '1' && local;
		const config = leerConfig(env, simulado, local);
		const pausado = env.PAUSADO === '1' || config === null;
		const ahoraS = Math.floor(deps.ahoraMs() / 1000);

		// --- GET /v1/salud ---------------------------------------------------------------------------------------------
		if (ruta === '/v1/salud') {
			let abierto = !pausado;
			if (abierto) {
				try {
					abierto = (await deps.limitador.estado(ahoraS)).abierto;
				} catch {
					abierto = false;
				}
			}
			const cuerpo: RespuestaSalud = { abierto, indice: deps.contexto.indice };
			return responder(cuerpo, 200, cors);
		}

		// --- POST: tipo de contenido y servicio abierto ------------------------------------------------------------------
		const tipo = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
		if (tipo !== 'application/json') return fallo('tipo_no_soportado', cors);
		if (config === null || env.PAUSADO === '1') {
			registrarRechazo('servicio_pausado');
			return fallo('servicio_pausado', cors, 300);
		}
		const secreto = config.secreto;

		const cuerpo = await leerCuerpo(req, LIMITES.cuerpoBytes);
		if (!cuerpo.ok) return fallo(cuerpo.codigo, cors);
		const datos = parsear(cuerpo.texto);

		const huellaDe = () => huellaVisitante(secreto, new Date(ahoraS * 1000).toISOString().slice(0, 10), req.headers.get('cf-connecting-ip'));

		// --- POST /v1/sesion --------------------------------------------------------------------------------------------
		if (ruta === '/v1/sesion') {
			const pedido = validarPedidoSesion(datos);
			if (!pedido.ok) return fallo('solicitud_invalida', cors);
			const huella = await huellaDe();
			let cupo;
			try {
				cupo = await deps.limitador.sesion({ huella, ahora: ahoraS });
			} catch {
				registrarRechazo('limitador_caido');
				return fallo('servicio_pausado', cors, 60);
			}
			if (!cupo.ok) {
				registrarRechazo('limite_visitante');
				return fallo('limite_visitante', cors, cupo.reintentarEn);
			}
			if (!simulado) {
				const veredicto = await verificarTurnstile({
					token: pedido.valor.turnstile,
					secreto: config.secretoTurnstile,
					hostnames: lista(env.TURNSTILE_HOSTNAMES),
					ip: req.headers.get('cf-connecting-ip') ?? undefined,
					fetchFn: deps.fetch,
					modoPrueba: esSecretoDePrueba(config.secretoTurnstile),
				});
				if (veredicto === 'caido') {
					registrarRechazo('turnstile_caido');
					return fallo('servicio_pausado', cors, 30);
				}
				if (veredicto === 'rechazado') {
					registrarRechazo('turnstile_fallido');
					return fallo('turnstile_fallido', cors);
				}
			} else if (pedido.valor.turnstile === 'turnstile-falla') {
				return fallo('turnstile_fallido', cors);
			}
			const s = await emitirSesion(secreto, ahoraS);
			deps.registrar({ evento: 'sesion_ok', idioma: pedido.valor.idioma, indice: deps.contexto.indice });
			const resp: RespuestaSesion = {
				sesion: s.token,
				expira: s.expira,
				limites: { mensaje: LIMITES.mensaje, mensajes: configDeEntorno(env).sesionMensajes, historial: LIMITES.historial },
			};
			return responder(resp, 200, cors);
		}

		// --- POST /v1/mensaje -------------------------------------------------------------------------------------------
		const auth = /^Bearer ([A-Za-z0-9._-]{1,1024})$/.exec(req.headers.get('authorization') ?? '');
		const sesion = auth ? await verificarSesion(secreto, auth[1], ahoraS) : null;
		if (!sesion) {
			registrarRechazo('sesion_invalida');
			return fallo('sesion_invalida', cors);
		}
		const pedido = validarPedidoMensaje(datos);
		if (!pedido.ok) return fallo('solicitud_invalida', cors);
		const p = pedido.valor;
		// Los turnos del asistente tienen que ser los que este Worker firmó: el navegador no puede inventar lo que «dijo» el asistente.
		for (const turno of p.historial) {
			if (turno.rol === 'assistant' && !(await verificarTurno(secreto, turno.texto, turno.firma ?? ''))) {
				registrarRechazo('historial_falsificado');
				return fallo('solicitud_invalida', cors);
			}
		}

		const huella = await huellaDe();
		const cuenta = { huella, sid: sesion.sid, ahora: ahoraS };
		let cupo;
		try {
			cupo = await deps.limitador.mensaje(cuenta);
		} catch {
			registrarRechazo('limitador_caido');
			return fallo('servicio_pausado', cors, 60);
		}
		if (!cupo.ok) {
			const codigo: CodigoError = cupo.motivo === 'sesion' ? 'limite_sesion' : cupo.motivo === 'visitante' ? 'limite_visitante' : 'servicio_pausado';
			registrarRechazo(codigo);
			return fallo(codigo, cors, codigo === 'limite_sesion' ? undefined : cupo.reintentarEn);
		}

		const inicio = deps.ahoraMs();
		const devolverCupo = async () => {
			try {
				await deps.limitador.devolver(cuenta);
			} catch {
				// Si no se pudo devolver, el visitante pierde un mensaje: es el lado seguro.
			}
		};

		let texto: string;
		let tokens = { tokensEntrada: 0, tokensSalida: 0, tokensCache: 0 };
		let requestId: string | undefined;

		if (simulado) {
			const sim = respuestaSimulada(p.mensaje, p.idioma);
			if (sim.tipo === 'error') {
				await devolverCupo();
				return fallo(sim.codigo, cors, sim.reintentarEn);
			}
			if (sim.demoraMs > 0) await deps.esperar(sim.demoraMs);
			texto = sim.texto;
		} else {
			const r = await llamarAnthropic({
				clave: config.claveAnthropic,
				modelo: config.modelo,
				maxTokens: entero(env.MAX_TOKENS_SALIDA, 50, 1000, 300),
				reglas: REGLAS,
				contexto: deps.contexto.texto,
				extra: lineaDelVisitante(p.idioma, p.pagina),
				mensajes: armarMensajes(p.historial, p.mensaje),
				fetchFn: deps.fetch,
				tiempoMs: TIEMPO_PROVEEDOR_MS,
			});
			if (!r.ok) {
				// Un tiempo agotado no devuelve el cupo: la API puede haber procesado (y cobrado) el pedido igual.
				if (r.tipo !== 'tiempo') await devolverCupo();
				const codigo: CodigoError = r.tipo === 'tiempo' ? 'proveedor_tiempo' : 'proveedor_error';
				deps.registrar({ evento: 'rechazo', codigo, http: r.tipo === 'proveedor' ? r.http : undefined, ms: deps.ahoraMs() - inicio, indice: deps.contexto.indice });
				return fallo(codigo, cors);
			}
			texto = r.truncado ? recortarEnFrase(r.texto) : r.texto;
			tokens = r;
			requestId = r.requestId;
		}

		const { texto: limpio, derivar } = procesarRespuesta(texto);
		if (limpio === '') {
			// Con el modelo real el pedido se pagó: solo en modo de prueba se devuelve el cupo.
			if (simulado) await devolverCupo();
			registrarRechazo('proveedor_error');
			return fallo('proveedor_error', cors);
		}
		deps.registrar({
			evento: 'mensaje_ok',
			ms: deps.ahoraMs() - inicio,
			...tokens,
			requestId,
			idioma: p.idioma,
			derivar,
			indice: deps.contexto.indice,
		});
		// Por puntos de código, para no partir un emoji; y la firma es del texto exacto que se devuelve.
		const respuesta = [...limpio].slice(0, MAX_RESPUESTA).join('');
		const resp: RespuestaMensaje = { respuesta, firma: await firmarTurno(secreto, respuesta), idioma: p.idioma, restantes: cupo.restantes, derivar };
		return responder(resp, 200, cors);
	} catch {
		// Nada de trazas ni de mensajes del proveedor hacia afuera.
		try {
			registrarRechazo('error_interno');
		} catch {
			// El registro no puede tumbar la respuesta.
		}
		return fallo('error_interno', cors);
	}
}
