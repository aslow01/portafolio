// Modo de prueba local, sin clave: respuestas fijas elegidas por palabra clave y errores forzados con mensajes mágicos.
// Solo corre con SIMULADO=1 Y con el Worker atendiendo en localhost (lo decide handler.ts). Los textos de referencia
// son los de docs-asistente/02-textos.md, sección 1.5.
import type { CodigoError, Idioma } from './contrato.ts';

export type Simulada =
	| { tipo: 'texto'; texto: string; derivar: boolean; demoraMs: number }
	| { tipo: 'error'; codigo: CodigoError; reintentarEn?: number };

const CORREO = 'contacto@matiasormeno.com.ar';

type Par = { es: string; en: string };
const R: Record<string, Par & { derivar: boolean }> = {
	perfil: {
		es: 'Matías busca trabajo de desarrollo de software y automatización con IA, en forma remota y abierto a otros países. Diseña automatizaciones para áreas administrativas, dirige su desarrollo con IA y las verifica con pruebas automáticas. Más en [Técnico e IA](/#tecnico).',
		en: 'Matías is looking for software development and AI-assisted automation work, remote and open to other countries. He designs automations for administrative areas, directs their development with AI and verifies them with automated tests. More in [Software & AI](/en/#tecnico).',
		derivar: false,
	},
	autoria: {
		es: 'Matías concibe, diseña, dirige y verifica sus sistemas; los desarrolla con IA, que escribe el código bajo su dirección. Cada caso detalla su parte, por ejemplo [la automatización de facturas](/casos/automatizacion-facturas/).',
		en: 'Matías conceives, designs, directs and verifies his systems; he develops them with AI, which writes the code under his direction. Each case describes his part, for example [the invoice automation](/en/casos/automatizacion-facturas/).',
		derivar: false,
	},
	demos: {
		es: 'Hay tres demos con datos ficticios, que corren en el navegador:\n- [Lector y conciliador de facturas](https://facturas.matiasormeno.com.ar)\n- [Control de flota](https://flota.matiasormeno.com.ar)\n- [Tablero de cobranzas](https://tablero.matiasormeno.com.ar)\nEl código es público; la lista está en [Demos](/#demos).',
		en: 'There are three demos with fictional data, running in the browser:\n- [Invoice reader and reconciler](https://facturas.matiasormeno.com.ar)\n- [Fleet control](https://flota.matiasormeno.com.ar)\n- [Collections dashboard](https://tablero.matiasormeno.com.ar)\nThe code is public; see the list in [Demos](/en/#demos). The demos are in Spanish.',
		derivar: false,
	},
	caso: {
		es: 'El caso principal es un cargador de facturas hecho a medida: concilia las facturas contra ARCA, controla cada comprobante antes de guardarlo y se detiene ante cualquier diferencia. Está en uso diario. Detalle en [Automatización de la carga de facturas](/casos/automatizacion-facturas/).',
		en: 'The main case is a custom invoice loader: it reconciles invoices against ARCA data, checks each document before saving it and stops at any difference. It is in daily use. Details in [Automating invoice entry](/en/casos/automatizacion-facturas/).',
		derivar: false,
	},
	contacto: {
		es: `Puede escribirle a Matías a [${CORREO}](mailto:${CORREO}). También figura su LinkedIn en [Contacto](/#contacto).\n${'[[CONTACTO]]'}`,
		en: `You can write to Matías at [${CORREO}](mailto:${CORREO}). His LinkedIn is also listed in [Contact](/en/#contacto).\n${'[[CONTACTO]]'}`,
		derivar: true,
	},
	condiciones: {
		es: `Esos puntos los conversa Matías directamente; yo no puedo informarlos ni prometerlos. Escríbale a ${CORREO}.\n[[CONTACTO]]`,
		en: `Matías discusses those points directly; I cannot give or promise them. Write to him at ${CORREO}.\n[[CONTACTO]]`,
		derivar: true,
	},
	ingles: {
		es: `Eso lo aclara el CV técnico; para una conversación en vivo conviene escribirle antes a ${CORREO} y acordar el formato.\n[[CONTACTO]]`,
		en: `The software CV states that; for a live conversation, please write to him first at ${CORREO} to agree on the format.\n[[CONTACTO]]`,
		derivar: true,
	},
	fuera: {
		es: 'Solo puedo responder sobre el portafolio de Matías: sus casos, demos, proyectos, CV y cómo contactarlo. ¿Quiere preguntar algo de eso?',
		en: 'I can only answer about Matías\'s portfolio: his case studies, demos, projects, CV and how to contact him. Would you like to ask about any of those?',
		derivar: false,
	},
	largo: {
		es: Array.from({ length: 6 }, (_, i) => `Párrafo ${i + 1} de una respuesta larga de prueba: sirve para ver cómo se acomoda el texto cuando ocupa varias líneas en la hoja del asistente.`).join('\n\n'),
		en: Array.from({ length: 6 }, (_, i) => `Paragraph ${i + 1} of a long test answer: it shows how the text lays out when it takes several lines in the assistant panel.`).join('\n\n'),
		derivar: false,
	},
};

/** Comandos: `/falla-…` y los nombres de escenario del diseño (`/error`, `/tiempo`, `/limite`, `/tope`, `/lento`…). */
const COMANDOS: Record<string, Simulada | ((i: Idioma) => Simulada)> = {
	'/ok': (i) => texto('perfil', i),
	'/lento': (i) => ({ ...texto('perfil', i), demoraMs: 3000 }),
	'/colgado': (i) => ({ ...texto('perfil', i), demoraMs: 60_000 }),
	'/largo': (i) => texto('largo', i),
	'/contacto': (i) => texto('contacto', i),
	'/fuera-de-tema': (i) => texto('fuera', i),
	'/error': { tipo: 'error', codigo: 'proveedor_error' },
	'/falla-502': { tipo: 'error', codigo: 'proveedor_error' },
	'/tiempo': { tipo: 'error', codigo: 'proveedor_tiempo' },
	'/falla-504': { tipo: 'error', codigo: 'proveedor_tiempo' },
	'/limite': { tipo: 'error', codigo: 'limite_visitante', reintentarEn: 600 },
	'/falla-429': { tipo: 'error', codigo: 'limite_visitante', reintentarEn: 600 },
	'/tope': { tipo: 'error', codigo: 'servicio_pausado', reintentarEn: 3600 },
	'/falla-503': { tipo: 'error', codigo: 'servicio_pausado', reintentarEn: 3600 },
	'/falla-500': { tipo: 'error', codigo: 'error_interno' },
};

const texto = (clave: string, idioma: Idioma): Simulada => ({ tipo: 'texto', texto: R[clave][idioma], derivar: R[clave].derivar, demoraMs: 0 });

const plano = (t: string): string => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Palabra clave → respuesta. El orden importa: la primera que coincide gana. */
const CLAVES: [RegExp, string][] = [
	[/sueldo|salario|pretension|salary|\brates?\b|disponib|availab|start date|fecha de inicio|contrato|contract/, 'condiciones'],
	[/ingles|english|idioma|language/, 'ingles'],
	[/contact|correo|mail|escrib|write|linkedin|whatsapp|telefono|phone/, 'contacto'],
	[/demo/, 'demos'],
	[/autor|parte hace|ia hace|who built|does the ai|written by|hace la ia|what does he do/, 'autoria'],
	[/caso|factura|invoice|case stud/, 'caso'],
	[/busca|puesto|trabajo|role|job|looking for|remot/, 'perfil'],
];

export function respuestaSimulada(mensaje: string, idioma: Idioma): Simulada {
	const m = plano(mensaje).trim();
	const comando = COMANDOS[m];
	if (comando) return typeof comando === 'function' ? comando(idioma) : comando;
	for (const [re, clave] of CLAVES) if (re.test(m)) return texto(clave, idioma);
	return texto('fuera', idioma);
}
