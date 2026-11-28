// Controlador del asistente: el estado de la conversación y todo lo que pasa entre «Enviar» y la respuesta.
// Sin DOM: la presentación se suscribe al estado (tipos.ts) y llama a los métodos. La conversación vive solo en memoria.
//
// Reintentos acotados (nada de bucles): una sola repetición automática si la sesión venció (401) y dos intentos de Turnstile;
// todo lo demás lo decide el visitante con «Reintentar».
import { LIMITES } from '../../../worker/src/contrato.ts';
import type { PedidoMensaje, RespuestaSesion, TurnoHistorial } from '../../../worker/src/contrato.ts';
import { ErrorApi, crearClienteApi } from './cliente.ts';
import type { ClienteApi } from './cliente.ts';
import { errorVistaDe } from './errores.ts';
import { OCULTOS, formatearRespuesta } from './formato.ts';
import { textosDe } from './textos.ts';
import type { Asistente, ConfigAsistente, ErrorVista, EstadoAsistente, Turno, TurnoAsistente, TurnoUsuario } from './tipos.ts';

export const TIEMPO_MAX_POR_DEFECTO_MS = 20_000;
/** Se renueva la sesión un poco antes de que venza para no mandar una pregunta con una sesión a punto de caer. */
const MARGEN_SESION_MS = 10_000;
const PARES_DE_HISTORIAL = LIMITES.historial / 2;

const CONTROLES = /[\u0000-\u0009\u000b-\u001f\u007f]/g;
const FORMA_PAGINA = /^\/[a-z0-9/_-]{0,80}$/;

const largo = (t: string): number => [...t].length;
const recortar = (t: string, max: number): string => (largo(t) > max ? [...t].slice(0, max).join('') : t);

/** Lo que se envía: saltos de línea normalizados, sin controles ni marcas invisibles, sin espacios en los bordes. */
export function limpiarEntrada(texto: string): string {
	return String(texto).replace(/\r\n?/g, '\n').replace(CONTROLES, '').replace(OCULTOS, '').trim();
}

/**
 * El historial que acepta el Worker: pares completos pregunta-respuesta, los últimos cuatro y no más de 8.000 caracteres.
 * La respuesta del asistente va tal cual y con la firma que le puso el Worker (si se tocara, el Worker la rechazaría): una
 * respuesta sin firma o más larga que un turno de historial no entra, y el par se deja afuera.
 */
export function armarHistorial(turnos: readonly Turno[]): TurnoHistorial[] {
	const pares: [TurnoHistorial, TurnoHistorial][] = [];
	for (let i = 0; i + 1 < turnos.length; i++) {
		const a = turnos[i];
		const b = turnos[i + 1];
		if (a.rol === 'usuario' && a.estado === 'enviada' && b.rol === 'asistente') {
			if (b.firma !== '' && largo(b.texto) <= LIMITES.textoHistorial) {
				pares.push([
					{ rol: 'user', texto: recortar(a.texto, LIMITES.textoHistorial) },
					{ rol: 'assistant', texto: b.texto, firma: b.firma },
				]);
			}
			i++;
		}
	}
	let elegidos = pares.slice(-PARES_DE_HISTORIAL);
	const suma = (l: typeof pares) => l.reduce((n, [u, r]) => n + largo(u.texto) + largo(r.texto), 0);
	while (elegidos.length > 0 && suma(elegidos) > LIMITES.sumaHistorial) elegidos = elegidos.slice(1);
	return elegidos.flat();
}

/**
 * Red de seguridad: si el pedido pesa más de maxBytes (UTF-8 del JSON), se quitan los pares más viejos del historial (siempre de
 * a dos, así sigue empezando por user y alternando, y las firmas de las respuestas que quedan no se tocan). Con los límites de
 * LIMITES no debería hacer falta nunca; evita un 413 si algún día cambian.
 */
export function ajustarAlCuerpo(pedido: PedidoMensaje, maxBytes: number): PedidoMensaje {
	const bytes = (p: PedidoMensaje) => new TextEncoder().encode(JSON.stringify(p)).length;
	let historial = pedido.historial;
	while (historial.length > 0 && bytes({ ...pedido, historial }) > maxBytes) historial = historial.slice(2);
	return historial === pedido.historial ? pedido : { ...pedido, historial };
}

/** Igual que `Asistente`, pero `abrir()` devuelve la promesa de la consulta de salud (la presentación puede ignorarla). */
export type AsistenteConSalud = Omit<Asistente, 'abrir'> & { abrir(): Promise<void> };

export function crearAsistente(config: ConfigAsistente): AsistenteConSalud {
	const tiempoMaxMs = config.tiempoMaxMs ?? TIEMPO_MAX_POR_DEFECTO_MS;
	const ahora = config.ahora ?? (() => Date.now());
	const programar =
		config.programar ??
		((accion: () => void, ms: number) => {
			const t: unknown = setTimeout(accion, ms);
			(t as { unref?: () => void }).unref?.();
		});
	const api: ClienteApi = crearClienteApi({ urlApi: config.urlApi, tiempoMaxMs, fetch: config.fetch });
	const reglas = { correo: config.contacto.correo, linkedin: config.contacto.linkedin, cvs: config.contacto.cvs, casos: config.contacto.casos };
	const textos = textosDe(config.idioma, { correo: config.contacto.correo, max: LIMITES.mensaje });

	// --- estado ---
	let abierto = false;
	let turnos: Turno[] = [];
	let fase: EstadoAsistente['fase'] = 'libre';
	let error: ErrorVista | null = null;
	let disponible = true;
	let sinConexion = config.enLinea ? !config.enLinea() : false;
	let restantes: number | null = null;
	let sesion: RespuestaSesion | null = null;
	let saludConsultada = false;
	let siguienteId = 1;
	/** Cambia con cada «conversación nueva»: una respuesta de la conversación anterior se descarta. */
	let generacion = 0;
	const oyentes = new Set<(e: EstadoAsistente) => void>();

	const estado = (): EstadoAsistente => ({
		abierto,
		turnos: [...turnos],
		fase,
		esperando: fase !== 'libre',
		error,
		disponible,
		sinConexion,
		formularioHabilitado: !(error?.bloqueaFormulario ?? false),
		restantes,
		maxCaracteres: LIMITES.mensaje,
		mostrarSugerencias: turnos.length === 0,
		idioma: config.idioma,
	});
	const avisar = () => {
		const e = estado();
		for (const o of [...oyentes]) o(e);
	};

	/** Un límite que trae «reintentar en N segundos» se levanta solo al vencer: el formulario no queda bloqueado hasta recargar la página.
	 * Si el Worker sigue sin dejar pasar, el próximo intento vuelve a mostrar el límite. */
	function levantarAlVencer(v: ErrorVista): void {
		if (!v.bloqueaFormulario || v.reintentarEnSeg === undefined) return;
		programar(() => {
			if (error !== v) return; // ya se cambió o se quitó por otra vía
			error = null;
			disponible = true;
			avisar();
		}, Math.min(v.reintentarEnSeg, 86_400) * 1000);
	}

	const sesionVigente = (): boolean => sesion !== null && sesion.expira * 1000 - MARGEN_SESION_MS > ahora();

	/** Sesión vigente o una nueva, pasando por Turnstile. Turnstile se reintenta una vez. */
	async function asegurarSesion(): Promise<string> {
		if (sesion !== null && sesionVigente()) return sesion.sesion;
		fase = 'verificando';
		avisar();
		for (let intento = 0; intento < 2; intento++) {
			const ultimo = intento === 1;
			let token: string;
			try {
				token = await config.turnstile.obtenerToken();
			} catch {
				config.turnstile.reiniciar();
				if (ultimo) throw new ErrorApi('turnstile_fallido');
				continue;
			}
			try {
				sesion = await api.sesion(token, config.idioma);
				return sesion.sesion;
			} catch (e) {
				if (e instanceof ErrorApi && e.codigo === 'turnstile_fallido') {
					config.turnstile.reiniciar();
					if (ultimo) throw e;
					continue;
				}
				throw e;
			}
		}
		throw new ErrorApi('turnstile_fallido');
	}

	function pedidoDe(texto: string, previos: readonly Turno[]): PedidoMensaje {
		const p = config.pagina?.();
		return ajustarAlCuerpo(
			{
				mensaje: texto,
				historial: armarHistorial(previos),
				idioma: config.idioma,
				pagina: p !== undefined && FORMA_PAGINA.test(p) ? p : undefined,
			},
			LIMITES.cuerpoBytes - 1024,
		);
	}

	/** Manda la pregunta del turno `id` y deja el estado listo para dibujar, con respuesta o con error. */
	async function procesar(id: number): Promise<void> {
		const mio = generacion;
		const indice = turnos.findIndex((t) => t.id === id);
		const turno = turnos[indice];
		if (!turno || turno.rol !== 'usuario') return;
		const previos = turnos.slice(0, indice);
		const marcar = (e: TurnoUsuario['estado']) => {
			turnos = turnos.map((t) => (t.id === id && t.rol === 'usuario' ? { ...t, estado: e } : t));
		};

		fase = 'verificando';
		marcar('pendiente');
		error = null;
		avisar();
		try {
			let reintentoDeSesion = false;
			for (;;) {
				const token = await asegurarSesion();
				if (mio !== generacion) return;
				fase = 'respondiendo';
				avisar();
				try {
					const r = await api.mensaje(token, pedidoDe(turno.texto, previos));
					if (mio !== generacion) return;
					const { bloques, fuentes } = formatearRespuesta(r.respuesta, reglas, config.idioma);
					const respuesta: TurnoAsistente = { id: siguienteId++, rol: 'asistente', texto: r.respuesta, firma: r.firma, bloques, fuentes, derivar: r.derivar };
					marcar('enviada');
					turnos = [...turnos, respuesta];
					restantes = r.restantes;
					disponible = true;
					fase = 'libre';
					avisar();
					return;
				} catch (e) {
					if (e instanceof ErrorApi && e.codigo === 'sesion_invalida' && !reintentoDeSesion) {
						// La sesión venció o no vale: una sola vez se pide otra y se reenvía.
						reintentoDeSesion = true;
						sesion = null;
						continue;
					}
					if (e instanceof ErrorApi && e.codigo === 'limite_sesion') sesion = null;
					throw e;
				}
			}
		} catch (e) {
			if (mio !== generacion) return;
			const falla = e instanceof ErrorApi ? e : new ErrorApi('respuesta_invalida');
			marcar('fallida');
			error = errorVistaDe(falla);
			if (error.bloqueaFormulario) disponible = false;
			levantarAlVencer(error);
			fase = 'libre';
			avisar();
		}
	}

	async function consultarSalud(): Promise<void> {
		try {
			const s = await api.salud();
			if (!s.abierto) {
				disponible = false;
				error = errorVistaDe({ codigo: 'servicio_pausado' });
				levantarAlVencer(error);
			}
		} catch {
			// Sin Worker o caído: el visitante lo descubre al preguntar; la lámpara avisa que puede no estar.
			disponible = false;
		}
		avisar();
	}

	return {
		textos,
		estado,
		suscribir(oyente) {
			oyentes.add(oyente);
			oyente(estado());
			return () => void oyentes.delete(oyente);
		},
		async abrir() {
			if (abierto) return;
			abierto = true;
			avisar();
			if (!saludConsultada) {
				saludConsultada = true;
				await consultarSalud();
			}
		},
		cerrar() {
			if (!abierto) return;
			abierto = false;
			avisar();
		},
		async enviar(crudo) {
			if (fase !== 'libre') return;
			if (error?.bloqueaFormulario) return;
			if (sinConexion) return;
			const texto = limpiarEntrada(crudo);
			if (texto === '') {
				error = { clave: 'vacio', reintentable: false, ofrecerContacto: false, bloqueaFormulario: false };
				avisar();
				return;
			}
			if (largo(texto) > LIMITES.mensaje) {
				error = { clave: 'largo', reintentable: false, ofrecerContacto: false, bloqueaFormulario: false };
				avisar();
				return;
			}
			const turno: TurnoUsuario = { id: siguienteId++, rol: 'usuario', texto, estado: 'pendiente' };
			turnos = [...turnos, turno];
			await procesar(turno.id);
		},
		async reintentar() {
			if (fase !== 'libre' || sinConexion) return;
			const ultimo = turnos[turnos.length - 1];
			if (!ultimo || ultimo.rol !== 'usuario' || ultimo.estado !== 'fallida') return;
			await procesar(ultimo.id);
		},
		reiniciar() {
			generacion++;
			turnos = [];
			fase = 'libre';
			// Un límite o un tope no se quita empezando de nuevo.
			if (!error?.bloqueaFormulario) error = null;
			avisar();
		},
		fijarConexion(enLinea) {
			if (sinConexion === !enLinea) return;
			sinConexion = !enLinea;
			avisar();
		},
	};
}
