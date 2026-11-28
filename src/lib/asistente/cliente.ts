// Cliente HTTP del Worker del asistente (contrato: worker/src/contrato.ts). Todo lo que llega se valida: la respuesta es dato hostil.
// Sin cookies (`credentials: 'omit'`), sin enviar nada más que el contrato, con tiempo máximo propio. Puro salvo `fetch`.
import type { Idioma, PedidoMensaje, RespuestaMensaje, RespuestaSalud, RespuestaSesion } from '../../../worker/src/contrato.ts';
import type { CodigoCliente } from './errores.ts';

/** Un error ya clasificado: el controlador solo mira `codigo`. */
export class ErrorApi extends Error {
	codigo: CodigoCliente | string;
	http: number | undefined;
	reintentarEn: number | undefined;

	constructor(codigo: CodigoCliente | string, http?: number, reintentarEn?: number) {
		super(codigo);
		this.name = 'ErrorApi';
		this.codigo = codigo;
		this.http = http;
		this.reintentarEn = reintentarEn;
	}
}

export interface ClienteApi {
	salud(): Promise<RespuestaSalud>;
	sesion(turnstile: string, idioma: Idioma): Promise<RespuestaSesion>;
	mensaje(sesion: string, pedido: PedidoMensaje): Promise<RespuestaMensaje>;
}

export interface OpcionesCliente {
	/** Base del Worker, sin barra final. */
	urlApi: string;
	tiempoMaxMs: number;
	fetch?: typeof fetch | undefined;
}

const MAX_CUERPO_CARACTERES = 50_000;
const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const esIdioma = (x: unknown): x is Idioma => x === 'es' || x === 'en';
const esEntero = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function leerSalud(x: unknown): RespuestaSalud {
	if (!esObjeto(x) || typeof x.abierto !== 'boolean' || typeof x.indice !== 'string') throw new ErrorApi('respuesta_invalida');
	return { abierto: x.abierto, indice: x.indice.slice(0, 40) };
}

function leerSesion(x: unknown): RespuestaSesion {
	if (!esObjeto(x) || typeof x.sesion !== 'string' || x.sesion.length < 1 || x.sesion.length > 1024 || !esEntero(x.expira) || !esObjeto(x.limites)) {
		throw new ErrorApi('respuesta_invalida');
	}
	const { mensaje, mensajes, historial } = x.limites;
	if (!esEntero(mensaje) || !esEntero(mensajes) || !esEntero(historial)) throw new ErrorApi('respuesta_invalida');
	return { sesion: x.sesion, expira: x.expira, limites: { mensaje, mensajes, historial } };
}

function leerMensaje(x: unknown): RespuestaMensaje {
	if (
		!esObjeto(x) ||
		typeof x.respuesta !== 'string' ||
		typeof x.firma !== 'string' ||
		!/^[A-Za-z0-9_-]{43}$/.test(x.firma) ||
		!esIdioma(x.idioma) ||
		!esEntero(x.restantes) ||
		typeof x.derivar !== 'boolean'
	) {
		throw new ErrorApi('respuesta_invalida');
	}
	return { respuesta: x.respuesta, firma: x.firma, idioma: x.idioma, restantes: x.restantes, derivar: x.derivar };
}

/** `{ error: { codigo, reintentar_en? } }` → `ErrorApi`; cualquier otra cosa es una respuesta inválida del servicio. */
function errorDeRespuesta(estado: number, datos: unknown): ErrorApi {
	const e = esObjeto(datos) && esObjeto(datos.error) ? datos.error : undefined;
	if (!e || typeof e.codigo !== 'string' || e.codigo.length > 40 || !/^[a-z_]+$/.test(e.codigo)) return new ErrorApi('respuesta_invalida', estado);
	const reintentar = esEntero(e.reintentar_en) && e.reintentar_en > 0 ? e.reintentar_en : undefined;
	return new ErrorApi(e.codigo, estado, reintentar);
}

export function crearClienteApi(opciones: OpcionesCliente): ClienteApi {
	const llamar = opciones.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));

	async function pedir(ruta: string, init: { metodo: 'GET' | 'POST'; cuerpo?: unknown; sesion?: string }): Promise<unknown> {
		const control = new AbortController();
		let vencio = false;
		const reloj = setTimeout(() => {
			vencio = true;
			control.abort();
		}, opciones.tiempoMaxMs);
		try {
			const headers: Record<string, string> = {};
			if (init.metodo === 'POST') headers['Content-Type'] = 'application/json';
			if (init.sesion) headers.Authorization = `Bearer ${init.sesion}`;
			let res: Response;
			try {
				res = await llamar(`${opciones.urlApi}${ruta}`, {
					method: init.metodo,
					headers,
					body: init.metodo === 'POST' ? JSON.stringify(init.cuerpo ?? {}) : null,
					credentials: 'omit',
					cache: 'no-store',
					referrerPolicy: 'no-referrer',
					signal: control.signal,
				});
			} catch {
				throw new ErrorApi(vencio ? 'tiempo_cliente' : 'red');
			}
			let datos: unknown;
			try {
				const texto = await res.text();
				if (texto.length > MAX_CUERPO_CARACTERES) throw new Error('cuerpo demasiado grande');
				datos = JSON.parse(texto);
			} catch {
				if (vencio) throw new ErrorApi('tiempo_cliente');
				throw new ErrorApi('respuesta_invalida', res.status);
			}
			if (!res.ok) throw errorDeRespuesta(res.status, datos);
			return datos;
		} finally {
			clearTimeout(reloj);
		}
	}

	return {
		salud: async () => leerSalud(await pedir('/v1/salud', { metodo: 'GET' })),
		sesion: async (turnstile, idioma) => leerSesion(await pedir('/v1/sesion', { metodo: 'POST', cuerpo: { turnstile, idioma } })),
		mensaje: async (sesion, pedido) => leerMensaje(await pedir('/v1/mensaje', { metodo: 'POST', cuerpo: pedido, sesion })),
	};
}
