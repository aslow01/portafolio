// Llamada a la API de Anthropic por `fetch`, sin SDK. El cliente nunca elige modelo, tope ni sistema: los fija el Worker.
// Nunca devuelve el texto de un error del proveedor (puede nombrar la cuenta o la clave).
import { omitirDatosPersonales } from './pii.ts';
import type { TurnoHistorial } from './contrato.ts';

export const URL_ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const VERSION_API = '2023-06-01';

export interface MensajeApi {
	role: 'user' | 'assistant';
	content: string;
}

/** Historial y pregunta nueva. Lo que escribió el visitante pasa por la omisión de datos personales; lo del asistente no. */
export function armarMensajes(historial: readonly TurnoHistorial[], mensaje: string): MensajeApi[] {
	const previos: MensajeApi[] = historial.map((t) => ({
		role: t.rol,
		content: t.rol === 'user' ? omitirDatosPersonales(t.texto) : t.texto,
	}));
	return [...previos, { role: 'user', content: omitirDatosPersonales(mensaje) }];
}

export interface PedidoAnthropic {
	clave: string;
	modelo: string;
	maxTokens: number;
	/** Reglas fijas del asistente. */
	reglas: string;
	/** Contenido público del portafolio: se marca para el caché de prompts. */
	contexto: string;
	/** Línea variable (página, idioma): va después del bloque cacheado para no romperlo. Vacío = sin bloque. */
	extra: string;
	mensajes: readonly MensajeApi[];
	fetchFn: (url: string, init: RequestInit) => Promise<Response>;
	tiempoMs: number;
}

export type ResultadoAnthropic =
	| {
			ok: true;
			texto: string;
			/** El modelo se quedó sin tokens (`stop_reason: max_tokens`): el texto puede terminar a mitad de frase o de enlace. */
			truncado: boolean;
			tokensEntrada: number;
			tokensSalida: number;
			tokensCache: number;
			requestId: string | undefined;
	  }
	| { ok: false; tipo: 'proveedor'; http: number | undefined }
	| { ok: false; tipo: 'tiempo' };

const numero = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

export async function llamarAnthropic(p: PedidoAnthropic): Promise<ResultadoAnthropic> {
	const sistema: Record<string, unknown>[] = [
		{ type: 'text', text: p.reglas },
		{ type: 'text', text: p.contexto, cache_control: { type: 'ephemeral' } },
	];
	if (p.extra !== '') sistema.push({ type: 'text', text: p.extra });

	const control = new AbortController();
	let vencio = false;
	const reloj = setTimeout(() => {
		vencio = true;
		control.abort();
	}, p.tiempoMs);
	try {
		const res = await p.fetchFn(URL_ANTHROPIC, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-api-key': p.clave, 'anthropic-version': VERSION_API },
			body: JSON.stringify({ model: p.modelo, max_tokens: p.maxTokens, system: sistema, messages: p.mensajes }),
			signal: control.signal,
		});
		if (!res.ok) return { ok: false, tipo: 'proveedor', http: res.status };
		const datos: unknown = await res.json();
		const contenido = (datos as { content?: unknown } | null)?.content;
		if (!Array.isArray(contenido)) return { ok: false, tipo: 'proveedor', http: res.status };
		const texto = contenido
			.map((b: unknown) =>
				typeof b === 'object' && b !== null && (b as { type?: unknown }).type === 'text'
					? String((b as { text?: unknown }).text ?? '')
					: '',
			)
			.join('')
			.trim();
		if (texto === '') return { ok: false, tipo: 'proveedor', http: res.status };
		const uso = ((datos as { usage?: unknown }).usage ?? {}) as Record<string, unknown>;
		return {
			ok: true,
			texto,
			truncado: (datos as { stop_reason?: unknown }).stop_reason === 'max_tokens',
			tokensEntrada: numero(uso.input_tokens),
			tokensSalida: numero(uso.output_tokens),
			tokensCache: numero(uso.cache_read_input_tokens),
			requestId: res.headers.get('request-id') ?? undefined,
		};
	} catch {
		return vencio ? { ok: false, tipo: 'tiempo' } : { ok: false, tipo: 'proveedor', http: undefined };
	} finally {
		clearTimeout(reloj);
	}
}
