// Experiencia laboral: los datos de la lista "Experiencia" de la ficha Logística.
// Sin DOM, sin Astro: se prueba con `npm test`.
// Los puestos de la empresa empleadora van anonimizados ("Empresa de seguridad privada de San Juan").
import { comprobantesPorMes } from './sitio.ts';

/** Mes calendario, 'AAAA-MM'. El tipo no distingue '2026-13': para texto de afuera, `aMes` valida. */
export type Mes = `${number}-${string}`;
export type Area = 'logistica' | 'administracion' | 'mantenimiento' | 'formacion';

export interface Puesto {
	/** Para el texto y el inicio de la barra. */
	desde: Mes;
	/** Para el texto. */
	hasta: Mes | 'hoy';
	/** Fin de la barra si difiere de `hasta` (cambio de puesto dentro del mismo mes). */
	finBarra?: Mes;
	/** El puesto, no la empresa. */
	titulo: string;
	lugar?: string;
	area: Area;
	/** Barra llena: logística en proyectos mineros y energéticos de alta montaña. */
	altaMontana?: boolean;
	puntos?: string[];
	detalle?: string;
}

const EMPRESA = 'Empresa de seguridad privada de San Juan';

// Más reciente primero. Los textos los aprobó el autor.
export const experiencia: Puesto[] = [
	{
		desde: '2026-08',
		hasta: 'hoy',
		titulo: 'Administración y desarrollo de software',
		lugar: EMPRESA,
		area: 'administracion',
		puntos: [
			`Carga y control de la facturación de la empresa: ${comprobantesPorMes}.`,
			'Diseño y dirección, con IA, de un cargador de facturas.',
			'Apoyo continuo a Logística.',
		],
	},
	{
		desde: '2025-08',
		hasta: '2026-08',
		finBarra: '2026-07',
		titulo: 'Logística',
		lugar: EMPRESA,
		area: 'logistica',
		altaMontana: true,
		puntos: [
			'Control de la flota vehicular: documentación, vencimientos y mantenimiento.',
			'Combustible, incluido el abastecimiento de grupos electrógenos en campo.',
			'Traslado de equipos y cargas; conducción 4x4 en montaña y ripio; escolta y guía de una columna de 6 camionetas.',
			'Compras con proveedores de varias provincias.',
				'Presupuestos y licitaciones: cotizaciones, comparación de ofertas, documentación y base de proveedores.',
			'Documentación de ingreso de personal y vehículos a proyectos mineros.',
		],
	},
	{
		desde: '2024-06',
		hasta: '2025-08',
		titulo: 'Formación independiente en programación e IA',
		area: 'formacion',
	},
	{
		desde: '2024-02',
		hasta: '2024-06',
		titulo: 'Mantenimiento y apoyo logístico',
		lugar: 'La Pap Transporte y Logística',
		area: 'mantenimiento',
	},
	{
		desde: '2023-04',
		hasta: '2023-11',
		titulo: 'Logística y administración',
		lugar: 'Alya Constructora',
		area: 'logistica',
		detalle: 'Documentación, insumos, proveedores, compras y entregas.',
	},
	{
		desde: '2022-09',
		hasta: '2023-04',
		titulo: 'Administración contable',
		lugar: 'Hiper Frenos y Elásticos',
		area: 'administracion',
		detalle: 'Comprobantes, facturas, pagos y cobros.',
	},
	{
		desde: '2021-09',
		hasta: '2022-11',
		titulo: 'Mantenimiento y tareas administrativas',
		lugar: 'GYM Consultora / H3 Hormigón Elaborado',
		area: 'mantenimiento',
	},
];

const MESES_CORTOS = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];

const FORMA_MES = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

/** Valida un texto 'AAAA-MM' (mes de 01 a 12) y lo devuelve como `Mes`; si no, falla con un mensaje claro. */
export function aMes(texto: string): Mes {
	if (!FORMA_MES.test(texto)) throw new RangeError(`Mes inválido: "${texto}" (se espera AAAA-MM, con mes de 01 a 12)`);
	return texto as Mes;
}

/** Año y número de mes (1 a 12) de un 'AAAA-MM'. */
export function partesDeMes(m: Mes): { anio: number; mes: number } {
	const [anio, mes] = aMes(m).split('-').map(Number);
	return { anio, mes };
}

/** Meses desde enero del año 0 hasta ese mes: sirve para restar fechas. */
export function indiceDeMes(m: Mes): number {
	const { anio, mes } = partesDeMes(m);
	return anio * 12 + (mes - 1);
}

/** El mes de una fecha en el huso de San Juan (UTC-3, sin horario de verano). */
export function mesDe(fecha: Date): Mes {
	const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/San_Juan', year: 'numeric', month: '2-digit' }).formatToParts(fecha);
	const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
	return aMes(`${valor('year')}-${valor('month')}`);
}

/** El mes de hoy (se calcula en el build). */
export function mesActual(): Mes {
	return mesDe(new Date());
}

/** Cantidad de meses de `desde` a `hasta`, ambos inclusivos. */
export function mesesEntre(desde: Mes, hasta: Mes): number {
	return indiceDeMes(hasta) - indiceDeMes(desde) + 1;
}

function mesCorto(m: Mes): string {
	const { anio, mes } = partesDeMes(m);
	return `${MESES_CORTOS[mes - 1]} ${anio}`;
}

/** 'ago. 2025 – ago. 2026'; el puesto actual termina en 'hoy'. */
export function textoPeriodo(p: Puesto): string {
	return `${mesCorto(p.desde)} – ${p.hasta === 'hoy' ? 'hoy' : mesCorto(p.hasta)}`;
}
