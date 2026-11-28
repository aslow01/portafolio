// Verificación de Turnstile contra siteverify. Falla cerrado: si siteverify no responde bien, no se emite sesión.
// (docs-asistente/03, sección 6)

export const URL_SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const ACCION_TURNSTILE = 'asistente';

/**
 * Secretas de PRUEBA públicas de Cloudflare (siempre pasa / siempre falla / token ya usado). Con ellas siteverify devuelve
 * `hostname: "example.com"` y ninguna `action`, y cualquier token sirve: por eso solo valen con el Worker en localhost
 * (handler.ts las trata como configuración faltante en un dominio real).
 */
const SECRETAS_DE_PRUEBA: readonly string[] = ['1x0000000000000000000000000000000AA', '2x0000000000000000000000000000000AA', '3x0000000000000000000000000000000AA'];

export function esSecretoDePrueba(secreto: unknown): boolean {
	return typeof secreto === 'string' && SECRETAS_DE_PRUEBA.includes(secreto);
}

export type ResultadoTurnstile = 'ok' | 'rechazado' | 'caido';
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export interface PedidoTurnstile {
	token: string;
	secreto: string;
	/** Hostnames de la página donde se resolvió el desafío. */
	hostnames: readonly string[];
	ip?: string | undefined;
	fetchFn: Fetch;
	tiempoMs?: number;
	/** Clave de prueba de Cloudflare: se exige success y nada más (su respuesta trae otro host y ninguna acción). Solo en localhost. */
	modoPrueba?: boolean;
}

export async function verificarTurnstile(p: PedidoTurnstile): Promise<ResultadoTurnstile> {
	const cuerpo = new URLSearchParams({ secret: p.secreto, response: p.token });
	if (p.ip) cuerpo.set('remoteip', p.ip);
	let datos: unknown;
	try {
		const res = await p.fetchFn(URL_SITEVERIFY, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: cuerpo.toString(),
			signal: AbortSignal.timeout(p.tiempoMs ?? 5000),
		});
		if (!res.ok) return 'caido';
		datos = await res.json();
	} catch {
		return 'caido';
	}
	if (typeof datos !== 'object' || datos === null) return 'caido';
	const { success, hostname, action } = datos as { success?: unknown; hostname?: unknown; action?: unknown };
	const codigos = (datos as { 'error-codes'?: unknown })['error-codes'];
	if (Array.isArray(codigos) && codigos.includes('internal-error')) return 'caido';
	if (success !== true) return 'rechazado';
	if (p.modoPrueba === true) return 'ok';
	if (typeof hostname !== 'string' || !p.hostnames.includes(hostname)) return 'rechazado';
	if (action !== ACCION_TURNSTILE) return 'rechazado';
	return 'ok';
}
