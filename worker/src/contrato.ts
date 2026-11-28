// Contrato HTTP entre el widget y el Worker del asistente (docs-asistente/03, sección 4).
// Puro y sin dependencias: lo importan el Worker y, solo como tipos, el widget (src/lib/asistente).

export type Idioma = 'es' | 'en';
export type Rol = 'user' | 'assistant';

/** Límites del contrato. El Worker los hace valer siempre; el widget los recibe en la sesión solo para no duplicarlos. */
export const LIMITES = {
	/** Caracteres (puntos de código) de la pregunta, tras recortar espacios. */
	mensaje: 500,
	/** Preguntas por sesión. */
	mensajes: 20,
	/** Turnos de historial que se aceptan (pregunta y respuesta cuentan por separado). */
	historial: 8,
	textoHistorial: 2000,
	sumaHistorial: 8000,
	/**
	 * Bytes del cuerpo de un pedido. Tiene que alcanzar para el peor caso válido: la pregunta (500) más el historial (8.000)
	 * en caracteres de 4 bytes son unos 34 KB, más las firmas y las claves (lo prueba scripts/asistente-contrato.test.mjs).
	 */
	cuerpoBytes: 40 * 1024,
	/** Caracteres del token de Turnstile. */
	turnstile: 2048,
} as const;

export interface TurnoHistorial {
	rol: Rol;
	texto: string;
	/**
	 * Solo en los turnos del asistente: la firma que el Worker puso en esa respuesta (`RespuestaMensaje.firma`). Sin ella, o con
	 * una que no corresponde al texto, el pedido se rechaza: el cliente no puede inventar lo que «dijo» el asistente.
	 */
	firma?: string | undefined;
}

export interface PedidoSesion {
	turnstile: string;
	idioma: Idioma;
}

export interface RespuestaSesion {
	sesion: string;
	/** Segundos Unix. */
	expira: number;
	limites: { mensaje: number; mensajes: number; historial: number };
}

export interface PedidoMensaje {
	mensaje: string;
	historial: TurnoHistorial[];
	idioma: Idioma;
	pagina?: string | undefined;
}

export interface RespuestaMensaje {
	respuesta: string;
	/** El widget la devuelve tal cual en el historial del pedido siguiente, junto con `respuesta` (ver `TurnoHistorial.firma`). */
	firma: string;
	idioma: Idioma;
	restantes: number;
	derivar: boolean;
}

export interface RespuestaSalud {
	abierto: boolean;
	indice: string;
}

export type CodigoError =
	| 'solicitud_invalida'
	| 'sesion_invalida'
	| 'origen_no_permitido'
	| 'turnstile_fallido'
	| 'no_encontrado'
	| 'metodo_no_permitido'
	| 'cuerpo_demasiado_grande'
	| 'tipo_no_soportado'
	| 'limite_visitante'
	| 'limite_sesion'
	| 'servicio_pausado'
	| 'proveedor_error'
	| 'proveedor_tiempo'
	| 'error_interno';

export interface RespuestaError {
	error: { codigo: CodigoError; reintentar_en?: number };
}

export const ESTADO_HTTP: Record<CodigoError, number> = {
	solicitud_invalida: 400,
	sesion_invalida: 401,
	origen_no_permitido: 403,
	turnstile_fallido: 403,
	no_encontrado: 404,
	metodo_no_permitido: 405,
	cuerpo_demasiado_grande: 413,
	tipo_no_soportado: 415,
	limite_visitante: 429,
	limite_sesion: 429,
	servicio_pausado: 503,
	proveedor_error: 502,
	proveedor_tiempo: 504,
	error_interno: 500,
};

export type Validacion<T> = { ok: true; valor: T } | { ok: false };

const MAL = { ok: false } as const;

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Cantidad de puntos de código (un emoji cuenta uno). */
const largo = (t: string): number => [...t].length;

// Control: todo lo de C0 y DEL salvo los que `permitidos` deja pasar.
const CONTROL_SIN_SALTO = /[\u0000-\u0009\u000b-\u001f\u007f]/;
const CONTROL_SIN_SALTO_NI_TAB = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function esIdioma(x: unknown): x is Idioma {
	return x === 'es' || x === 'en';
}

export function validarPedidoSesion(x: unknown): Validacion<PedidoSesion> {
	if (!esObjeto(x)) return MAL;
	const { turnstile, idioma } = x;
	if (typeof turnstile !== 'string' || turnstile.length < 1 || turnstile.length > LIMITES.turnstile) return MAL;
	if (!esIdioma(idioma)) return MAL;
	return { ok: true, valor: { turnstile, idioma } };
}

const FORMA_PAGINA = /^\/[a-z0-9/_-]{0,80}$/;
/** HMAC-SHA256 de 32 bytes en base64url, sin relleno. */
const FORMA_FIRMA = /^[A-Za-z0-9_-]{43}$/;
/** Marcas que no se ven (ancho cero, sentido del texto, unión de palabras, BOM): no cuentan como contenido. */
const INVISIBLES = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
/** Un sustituto UTF-16 sin su pareja: no es texto válido y no tiene por qué llegar al modelo. */
const SUSTITUTO_SUELTO = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

function validarHistorial(x: unknown): TurnoHistorial[] | null {
	if (!Array.isArray(x) || x.length > LIMITES.historial) return null;
	const salida: TurnoHistorial[] = [];
	let suma = 0;
	for (let i = 0; i < x.length; i++) {
		const turno: unknown = x[i];
		if (!esObjeto(turno)) return null;
		const { rol: rolRecibido, texto: recibido, firma } = turno;
		// Alternan empezando por user.
		const rol: Rol = i % 2 === 0 ? 'user' : 'assistant';
		if (rolRecibido !== rol || typeof recibido !== 'string') return null;
		// Lo del asistente se acepta tal cual y con su firma (el Worker la comprueba); lo del usuario, limpio como la pregunta.
		let texto = recibido;
		let turnoValido: TurnoHistorial;
		if (rol === 'user') {
			if (SUSTITUTO_SUELTO.test(texto)) return null;
			texto = texto.replace(INVISIBLES, '');
			turnoValido = { rol, texto };
		} else {
			if (typeof firma !== 'string' || !FORMA_FIRMA.test(firma)) return null;
			turnoValido = { rol, texto, firma };
		}
		if (texto.trim() === '') return null;
		const n = largo(texto);
		if (n > LIMITES.textoHistorial) return null;
		if (CONTROL_SIN_SALTO_NI_TAB.test(texto)) return null;
		suma += n;
		salida.push(turnoValido);
	}
	if (salida.length % 2 !== 0) return null; // tiene que terminar en assistant
	if (suma > LIMITES.sumaHistorial) return null;
	return salida;
}

/** Valida el cuerpo de `POST /v1/mensaje`. Devuelve solo los campos conocidos; el resto se descarta. */
export function validarPedidoMensaje(x: unknown): Validacion<PedidoMensaje> {
	if (!esObjeto(x)) return MAL;
	const { mensaje, historial, idioma, pagina } = x;
	if (typeof mensaje !== 'string') return MAL;
	if (SUSTITUTO_SUELTO.test(mensaje)) return MAL;
	const texto = mensaje.replace(INVISIBLES, '').trim();
	if (texto === '' || largo(texto) > LIMITES.mensaje) return MAL;
	if (CONTROL_SIN_SALTO.test(texto)) return MAL;
	if (!esIdioma(idioma)) return MAL;
	const h = validarHistorial(historial);
	if (h === null) return MAL;
	if (pagina !== undefined && (typeof pagina !== 'string' || !FORMA_PAGINA.test(pagina))) return MAL;
	return { ok: true, valor: { mensaje: texto, historial: h, idioma, pagina } };
}
