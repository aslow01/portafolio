// Turnstile en el navegador. El script de Cloudflare se pide RECIÉN cuando el visitante manda su primera pregunta: quien no usa
// el asistente no le pide nada a terceros. La CSP tiene que admitir challenges.cloudflare.com en script-src y frame-src
// (docs-asistente/03, sección 9.2); eso lo decide quien activa el asistente, no este módulo.
//
// Toca el navegador solo a través de `EntornoNavegador`, que se inyecta: así se prueba sin DOM.
import type { Idioma, ProveedorTurnstile } from './tipos.ts';

export const URL_SCRIPT_TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const ACCION = 'asistente';
/** Valor que acepta el Worker en modo de prueba local (no pasa Turnstile real). */
export const TOKEN_DE_PRUEBA = 'sin-turnstile';

interface ApiTurnstile {
	render(contenedor: unknown, opciones: Record<string, unknown>): string | undefined;
	remove(id: string): void;
}
interface ScriptLike {
	src: string;
	async: boolean;
	defer: boolean;
	onload: (() => void) | null;
	onerror: (() => void) | null;
}
export interface EntornoNavegador {
	document: { createElement(etiqueta: string): unknown; head: { appendChild(nodo: unknown): unknown } };
	turnstile?: ApiTurnstile | undefined;
}

export interface OpcionesTurnstile {
	sitekey: string;
	/** El elemento de la hoja donde Turnstile dibuja su recuadro si hace falta interacción. */
	contenedor: () => unknown;
	idioma: Idioma;
	tema?: 'light' | 'dark' | 'auto';
	/** Por defecto, `window`. */
	entorno?: EntornoNavegador;
	/** Espera máxima por un token, en ms (por defecto 60 000: puede requerir una interacción). */
	tiempoMaxMs?: number;
}

export function turnstileNavegador(opciones: OpcionesTurnstile): ProveedorTurnstile {
	const entorno = (): EntornoNavegador => opciones.entorno ?? (globalThis as unknown as EntornoNavegador);
	let carga: Promise<ApiTurnstile> | null = null;
	let idWidget: string | undefined;

	function cargarScript(): Promise<ApiTurnstile> {
		const ya = entorno().turnstile;
		if (ya) return Promise.resolve(ya);
		if (carga) return carga;
		carga = new Promise<ApiTurnstile>((resolver, rechazar) => {
			const s = entorno().document.createElement('script') as ScriptLike;
			s.src = URL_SCRIPT_TURNSTILE;
			s.async = true;
			s.defer = true;
			s.onload = () => {
				const api = entorno().turnstile;
				if (api) resolver(api);
				else {
					carga = null;
					rechazar(new Error('turnstile sin API'));
				}
			};
			s.onerror = () => {
				carga = null;
				rechazar(new Error('no se pudo cargar turnstile'));
			};
			entorno().document.head.appendChild(s);
		});
		return carga;
	}

	function quitar(api?: ApiTurnstile): void {
		const a = api ?? entorno().turnstile;
		if (a && idWidget !== undefined) {
			try {
				a.remove(idWidget);
			} catch {
				// Un widget que ya no existe no es un problema.
			}
		}
		idWidget = undefined;
	}

	return {
		async obtenerToken() {
			const api = await cargarScript();
			quitar(api);
			const contenedor = opciones.contenedor();
			if (!contenedor) throw new Error('no hay dónde dibujar turnstile');
			return new Promise<string>((resolver, rechazar) => {
				const reloj = setTimeout(() => rechazar(new Error('turnstile tardó demasiado')), opciones.tiempoMaxMs ?? 60_000);
				const fin = <T>(f: (x: T) => void) => (x: T) => {
					clearTimeout(reloj);
					f(x);
				};
				idWidget = api.render(contenedor, {
					sitekey: opciones.sitekey,
					action: ACCION,
					appearance: 'interaction-only',
					size: 'flexible',
					theme: opciones.tema ?? 'auto',
					language: opciones.idioma,
					callback: fin(resolver),
					'error-callback': fin(() => rechazar(new Error('turnstile falló'))),
					'expired-callback': fin(() => rechazar(new Error('turnstile venció'))),
				});
			});
		},
		reiniciar() {
			quitar();
		},
	};
}

/** Para el modo de prueba local: no carga nada de terceros y entrega el token que el Worker simulado acepta. */
export function turnstileDePrueba(): ProveedorTurnstile {
	return {
		obtenerToken: () => Promise.resolve(TOKEN_DE_PRUEBA),
		reiniciar() {},
	};
}
