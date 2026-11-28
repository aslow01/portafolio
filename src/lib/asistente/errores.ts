// Del código de un error (el del Worker o uno del propio cliente) a lo que la presentación dibuja. Puro, sin DOM.
import type { CodigoError } from '../../../worker/src/contrato.ts';
import type { ErrorVista } from './tipos.ts';

/** Los códigos del Worker más los que solo conoce el cliente. */
export type CodigoCliente = CodigoError | 'red' | 'tiempo_cliente' | 'respuesta_invalida';

export interface ErrorCliente {
	codigo: CodigoCliente | string;
	reintentarEn?: number | undefined;
}

const sin = (v: ErrorVista, segundos: number | undefined): ErrorVista => (segundos !== undefined && segundos > 0 ? { ...v, reintentarEnSeg: segundos } : v);

export function errorVistaDe(e: ErrorCliente): ErrorVista {
	switch (e.codigo) {
		case 'red':
			return { clave: 'red', reintentable: true, ofrecerContacto: true, bloqueaFormulario: false };
		case 'tiempo_cliente':
		case 'proveedor_tiempo':
			return { clave: 'tiempo', reintentable: true, ofrecerContacto: true, bloqueaFormulario: false };
		case 'turnstile_fallido':
			return { clave: 'verificacion', reintentable: true, ofrecerContacto: true, bloqueaFormulario: false };
		case 'limite_visitante':
			return sin({ clave: 'limiteVisitante', reintentable: false, ofrecerContacto: true, bloqueaFormulario: true }, e.reintentarEn);
		case 'limite_sesion':
			return { clave: 'limiteSesion', reintentable: true, ofrecerContacto: true, bloqueaFormulario: false };
		case 'servicio_pausado':
			return sin({ clave: 'tope', reintentable: false, ofrecerContacto: true, bloqueaFormulario: true }, e.reintentarEn);
		case 'cuerpo_demasiado_grande':
			// La pregunta ya se validó en el cliente (500 caracteres): un 413 es que la conversación entera pesa demasiado.
			return { clave: 'conversacionLarga', reintentable: false, ofrecerContacto: true, bloqueaFormulario: false };
		case 'proveedor_error':
		case 'error_interno':
		case 'respuesta_invalida':
		case 'sesion_invalida':
			return { clave: 'servicio', reintentable: true, ofrecerContacto: true, bloqueaFormulario: false };
		default:
			// Errores de programación o de configuración (solicitud, origen, ruta, método, tipo) y lo desconocido: contacto, sin reintentar.
			return { clave: 'servicio', reintentable: false, ofrecerContacto: true, bloqueaFormulario: false };
	}
}
