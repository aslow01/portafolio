// SOLO DESARROLLO (`npm run dev` sin `PUBLIC_ASISTENTE_URL`): un `fetch` falso que responde como el Worker del asistente
// (contrato: worker/src/contrato.ts), para ver y probar la hoja sin red, sin clave y sin Worker. consulta-motor.ts lo carga con
// un `import()` dentro de `import.meta.env.DEV`: no entra al build de producción.
// Las respuestas son frases de prueba armadas con lo que dice la web; no usan IA.
//
// La dirección elige un escenario: `?consulta=<escenario>`:
//   ok (por defecto), lento (3 s), error (sin red), tiempo (el Worker no contesta), limite (429 del visitante), sesion (429 de la
//   sesión), tope (503: tope diario), servicio (502), verificacion (Turnstile no pasa), sin-red (el navegador sin conexión),
//   derivar (toda respuesta pide contactar a Matías), largo (una respuesta con lista), pocas (quedan 3 preguntas).
import type { Idioma } from '../../lib/asistente/tipos.ts';

export const URL_SIMULADA = 'http://simulado.invalid';

export type Escenario = 'ok' | 'lento' | 'error' | 'tiempo' | 'limite' | 'sesion' | 'tope' | 'servicio' | 'verificacion' | 'sin-red' | 'derivar' | 'largo' | 'pocas';
const ESCENARIOS: readonly string[] = ['ok', 'lento', 'error', 'tiempo', 'limite', 'sesion', 'tope', 'servicio', 'verificacion', 'sin-red', 'derivar', 'largo', 'pocas'];

export function escenarioDeLaDireccion(search: string): Escenario {
	const e = new URLSearchParams(search).get('consulta') ?? 'ok';
	return (ESCENARIOS.includes(e) ? e : 'ok') as Escenario;
}

const json = (cuerpo: unknown, status = 200): Response => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
const falla = (codigo: string, status: number): Response => json({ error: { codigo } }, status);
const pausa = (ms: number, senal?: AbortSignal | null): Promise<void> =>
	new Promise((resolver, rechazar) => {
		const t = setTimeout(resolver, ms);
		senal?.addEventListener('abort', () => {
			clearTimeout(t);
			rechazar(new DOMException('abortado', 'AbortError'));
		});
	});

interface Respuesta {
	texto: string;
	derivar: boolean;
}

const EN = /\b(what|which|how|where|who|is|does|can|do|he|his|job|role|demo|demos|contact)\b/i;

function respuestaA(pregunta: string, idioma: Idioma, escenario: Escenario): Respuesta {
	const q = pregunta.toLowerCase();
	const en = idioma === 'en' || (EN.test(pregunta) && !/[¿áéíóúñ]/i.test(pregunta));
	const largo = escenario === 'largo';
	let r: Respuesta;
	if (/contacto|contact|correo|email|mail/.test(q)) {
		r = en
			? { texto: 'You can write to him at contacto@matiasormeno.com.ar. All published channels are on the [Contact](/en/#contacto) page.', derivar: true }
			: { texto: 'Puede escribirle a contacto@matiasormeno.com.ar. Todos los canales publicados están en [Contacto](/#contacto).', derivar: true };
	} else if (/demo/.test(q)) {
		r = en
			? { texto: 'Three live demos, all with fictional data and public code:\n\n- **Invoice reader**: [facturas.matiasormeno.com.ar](https://facturas.matiasormeno.com.ar)\n- **Fleet control**: [flota.matiasormeno.com.ar](https://flota.matiasormeno.com.ar)\n- **Billing dashboard**: [tablero.matiasormeno.com.ar](https://tablero.matiasormeno.com.ar)\n\nSee [Demos](/en/#demos). The demo pages are in Spanish.', derivar: false }
			: { texto: 'Tres demos en vivo, todas con datos ficticios y código público:\n\n- **Lector de facturas**: [facturas.matiasormeno.com.ar](https://facturas.matiasormeno.com.ar)\n- **Control de flota**: [flota.matiasormeno.com.ar](https://flota.matiasormeno.com.ar)\n- **Tablero de cobranzas**: [tablero.matiasormeno.com.ar](https://tablero.matiasormeno.com.ar)\n\nMás en [Demos](/#demos).', derivar: false };
	} else if (/parte|ia\b|ai\b|himself|autor/.test(q)) {
		r = en
			? { texto: 'Matías conceives, designs, directs and verifies his software; he develops it with AI, which writes the code under his direction. Each case describes his part. See [Software & AI](/en/tecnico/).', derivar: false }
			: { texto: 'Matías concibe, diseña, dirige y verifica sus sistemas, y los desarrolla con IA, que escribe el código bajo su dirección. Cada caso detalla su parte. Más en [Técnico e IA](/tecnico/).', derivar: false };
	} else if (/trabajo|puesto|busca|job|role|looking/.test(q)) {
		r = en
			? { texto: 'Software development and AI-assisted automation, **remote**, open to other countries. He designs automations for administrative areas, directs their development with AI and verifies them with automated tests. See [Software & AI](/en/tecnico/) and the [case studies](/en/casos/).', derivar: false }
			: { texto: 'Desarrollo de software y automatización con IA, **remoto** y abierto a otros países. Diseña automatizaciones para el área administrativa, dirige su desarrollo con IA y las verifica con pruebas automáticas. Más en [Técnico e IA](/tecnico/) y en [Casos de estudio](/casos/).', derivar: false };
	} else if (/poema|poem|receta|recipe|clima|weather/.test(q)) {
		r = en
			? { texto: 'I can only answer about Matías\'s portfolio: his case studies, demos, projects, CV and how to contact him. I cannot help with other topics here. Would you like to ask about any of those?', derivar: false }
			: { texto: 'Solo puedo responder sobre el portafolio de Matías: sus casos, demos, proyectos, CV y cómo contactarlo. Para otro tema no puedo ayudar aquí. ¿Quiere preguntar algo de eso?', derivar: false };
	} else {
		r = en
			? { texto: 'That is not in the portfolio, and I do not want to make it up. You can ask Matías directly at contacto@matiasormeno.com.ar.', derivar: true }
			: { texto: 'Eso no figura en el portafolio, y no quiero inventarlo. Puede preguntárselo directamente a Matías en contacto@matiasormeno.com.ar.', derivar: true };
	}
	if (largo && !r.derivar) {
		r = {
			texto: `${r.texto}\n\n- El caso de la carga de facturas está escrito en español.\n- La cifra es de más de 2.000 comprobantes por mes, cotejada contra ARCA.\n\n**Nota**: <b>esto no es HTML</b> ni un [enlace malo](javascript:alert(1)).`,
			derivar: false,
		};
	}
	return escenario === 'derivar' ? { ...r, derivar: true } : r;
}

/** Un `fetch` que hace de Worker. `tiempo` no contesta nunca (el cliente se rinde solo); `error` falla como una red caída. */
export function crearFetchSimulado(escenario: Escenario, idioma: Idioma): typeof fetch {
	let restantes = escenario === 'pocas' ? 4 : 20;
	return async (entrada, init) => {
		const url = new URL(String(entrada));
		const senal = init?.signal ?? null;
		if (escenario === 'error') throw new TypeError('Failed to fetch');
		if (url.pathname === '/v1/salud') return json({ abierto: escenario !== 'tope', indice: 'simulado' });
		if (url.pathname === '/v1/sesion') {
			await pausa(250, senal);
			if (escenario === 'verificacion') return falla('turnstile_fallido', 403);
			return json({ sesion: 'simulada', expira: Math.floor(Date.now() / 1000) + 1800, limites: { mensaje: 500, mensajes: 20, historial: 8 } });
		}
		if (url.pathname === '/v1/mensaje') {
			if (escenario === 'tiempo') await pausa(60_000, senal);
			await pausa(escenario === 'lento' ? 3000 : 700, senal);
			if (escenario === 'limite') return falla('limite_visitante', 429);
			if (escenario === 'sesion') return falla('limite_sesion', 429);
			if (escenario === 'tope') return falla('servicio_pausado', 503);
			if (escenario === 'servicio') return falla('proveedor_error', 502);
			const pedido = JSON.parse(String(init?.body ?? '{}')) as { mensaje?: string; idioma?: Idioma };
			restantes = Math.max(0, restantes - 1);
			const r = respuestaA(pedido.mensaje ?? '', pedido.idioma ?? idioma, escenario);
			return json({ respuesta: r.texto, firma: 'S'.repeat(43), idioma: pedido.idioma ?? idioma, restantes, derivar: r.derivar });
		}
		return falla('no_encontrado', 404);
	};
}
