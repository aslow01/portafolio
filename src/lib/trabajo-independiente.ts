// Trabajo independiente de Matías: sitios web hechos para clientes particulares (no para su empleador).
// Puro, sin Astro: se prueba con `npm test` (scripts/trabajo-independiente.test.mjs).
//
// DOS MODOS (decisión de Matías del 28/11/2026):
//
// 1. REFERENCIA ANÓNIMA (`tipo: 'referencia'`): es lo que muestra hoy la web. Las webs hechas para clientes particulares
//    tienen datos personales, así que se muestran SOLO como referencia: sin dirección, sin captura, sin nombre del negocio ni de
//    la persona, sin ciudad ni teléfonos. Por esa decisión general, una referencia se muestra sin `permisoCliente` individual
//    (el campo ni siquiera existe en una referencia). Una referencia PROHÍBE `url`, `captura`, `capturaAlt` y cualquier campo que
//    no figure en `CAMPOS_REFERENCIA`: si alguna los trae, la compilación falla (y el tipo también, en `astro check`).
//    Lleva siempre su versión en inglés (`en`); sin `stack` ni `anio` se muestran sin esos datos (no se inventan).
//    La página NO dibuja una tarjeta por referencia: las junta en una sola (`resumenReferencias`): cuántas hay, cuántas en curso
//    (`estado: 'en-curso'`) y los rubros, todo calculado desde las entradas. Los textos de cada entrada se validan, pero solo el
//    rubro llega a la tarjeta.
//
// 2. ENTRADA COMPLETA (sin `tipo`): con dirección o captura. REGLA DE PRIVACIDAD de siempre: se muestra SOLO si el cliente dio
//    permiso por escrito (`permisoCliente: true`) y sin sus datos personales. Sin ninguna entrada visible, la sección «Trabajo
//    independiente» no aparece en la web (la página ni se genera).
//
// CÓMO AGREGAR UN SITIO COMO REFERENCIA (por ejemplo, cuando la quinta web se termine):
//   1. Copiar un bloque de `trabajosIndependientes` y darle un `id` nuevo (minúsculas y guiones, sin el nombre del cliente).
//   2. Completar `rubro`, `titulo` (genérico), `queSeHizo` (1 a 3 frases que Matías pueda sostener en una entrevista) y la
//      versión en inglés `en`. `stack` y `anio` solo si se saben.
//   3. Nada más: sin url, captura ni datos del cliente.
// CÓMO AGREGAR UN SITIO COMPLETO (con permiso del cliente en mano): sin `tipo`, con `stack`, `permisoCliente: true` y, si
//   hay captura, guardarla en `src/assets/independiente/` y poner `captura: 'independiente/<archivo>.png'` más `capturaAlt`
//   (qué se ve, sin datos personales). Si queda a medias, la compilación falla a propósito en vez de ocultarlo en silencio.

export type Idioma = 'es' | 'en';

/** Los textos que se traducen. */
export interface Textos {
	/** Rubro del cliente, en pocas palabras («Taller mecánico»). */
	rubro: string;
	/** Título genérico, sin nombre del negocio ni de la persona. */
	titulo: string;
	/** Qué se hizo: 1 a 3 frases, solo lo que Matías confirme. */
	queSeHizo: string;
}

interface Comun extends Textos {
	/** Identificador interno, único: minúsculas y guiones. Nunca el nombre del cliente. */
	id: string;
	/** Tecnologías, una por elemento. Opcional: si no se sabe, no se escribe (y no se muestra). */
	stack?: readonly string[];
	/** Año de publicación. Opcional: si no se sabe, no se escribe (y no se muestra). */
	anio?: number;
	/** Versión en inglés. Obligatoria en las referencias; en las completas, sin ella se muestra el español. */
	en?: Textos;
}

/** Una web con datos personales: se muestra solo como referencia, sin dirección, captura ni datos del cliente. */
export interface ReferenciaAnonima extends Comun {
	tipo: 'referencia';
	/** `'en-curso'` si el sitio todavía no se entregó. Sin el campo, se cuenta como entregado. */
	estado?: 'en-curso';
	en: Textos;
	url?: never;
	captura?: never;
	capturaAlt?: never;
	permisoCliente?: never;
}

/** Una web que se puede mostrar entera, porque el cliente lo autorizó por escrito. */
export interface SitioCompleto extends Comun {
	tipo?: 'completo';
	/** Dirección pública del sitio (https), solo si el cliente la autoriza. */
	url?: string;
	/** Captura: ruta dentro de `src/assets/`, siempre `independiente/<archivo>`. Requiere `capturaAlt`. */
	captura?: string;
	/** Texto alternativo de la captura: qué se ve, sin datos personales. */
	capturaAlt?: string;
	/** `true` solo con el permiso del cliente. Con `false` (o sin el campo) la entrada no se muestra en ningún lado. */
	permisoCliente: boolean;
}

export type TrabajoIndependiente = ReferenciaAnonima | SitioCompleto;

/** Los únicos campos que puede tener una referencia. Cualquier otro (url, captura, teléfono, ciudad…) rompe la compilación. */
const CAMPOS_REFERENCIA: readonly string[] = ['id', 'tipo', 'estado', 'rubro', 'titulo', 'queSeHizo', 'stack', 'anio', 'en'];
const CAMPOS_TEXTOS = ['rubro', 'titulo', 'queSeHizo'] as const satisfies readonly (keyof Textos)[];
const esCampoDeTexto = (campo: string): boolean => CAMPOS_TEXTOS.some((c) => c === campo);
/**
 * Lo que no puede aparecer en el texto de una referencia: direcciones, correos, teléfonos o números. OJO: es una red de
 * seguridad, no un filtro. No detecta nombres de personas, de negocios ni ciudades; lo que protege de verdad es la lista cerrada
 * de campos y que los textos sean genéricos. Nadie debe confiar en que este control «limpia» un texto.
 */
export const DATO_PERSONAL = /@|https?:|www\.|\.com|\.ar\b|\d/i;

/**
 * Las cinco webs. Las cuatro hechas (un negocio de venta y logística, dos talleres mecánicos y un cliente del rubro de
 * agricultura y riego) y la quinta, en curso, entran como REFERENCIAS ANÓNIMAS (decisión de Matías del 28/11/2026: tienen datos
 * personales). Los textos son solo lo que se sabe: sitio a medida para el cliente y, en los talleres, una muestra de sus
 * trabajos. Sin stack ni año: no se saben, no se inventan. El rubro de la quinta no se sabe: queda «Cliente particular».
 */
export const trabajosIndependientes: readonly TrabajoIndependiente[] = [
	{
		id: 'venta-logistica-1',
		tipo: 'referencia',
		rubro: 'Venta y logística',
		titulo: 'Sitio web para un negocio de venta y logística',
		queSeHizo: 'Sitio web a medida para el cliente.',
		en: {
			rubro: 'Sales and logistics',
			titulo: 'Website for a sales and logistics business',
			queSeHizo: 'Custom website for the client.',
		},
	},
	{
		id: 'taller-1',
		tipo: 'referencia',
		rubro: 'Taller mecánico',
		titulo: 'Sitio web para un taller mecánico',
		queSeHizo: 'Sitio web a medida para el cliente, con una muestra de sus trabajos.',
		en: {
			rubro: 'Auto repair shop',
			titulo: 'Website for an auto repair shop',
			queSeHizo: 'Custom website for the client, with a showcase of their work.',
		},
	},
	{
		id: 'taller-2',
		tipo: 'referencia',
		rubro: 'Taller mecánico',
		titulo: 'Sitio web para un taller mecánico',
		queSeHizo: 'Sitio web a medida para el cliente, con una muestra de sus trabajos.',
		en: {
			rubro: 'Auto repair shop',
			titulo: 'Website for an auto repair shop',
			queSeHizo: 'Custom website for the client, with a showcase of their work.',
		},
	},
	{
		id: 'agro-riego-1',
		tipo: 'referencia',
		rubro: 'Agricultura y riego',
		titulo: 'Sitio web para un cliente del rubro de agricultura y riego',
		queSeHizo: 'Sitio web a medida para el cliente.',
		en: {
			rubro: 'Agriculture and irrigation',
			titulo: 'Website for a client in agriculture and irrigation',
			queSeHizo: 'Custom website for the client.',
		},
	},
	{
		id: 'en-curso-1',
		tipo: 'referencia',
		estado: 'en-curso',
		rubro: 'Cliente particular',
		titulo: 'Sitio web para un cliente particular',
		queSeHizo: 'Sitio web a medida para el cliente, en desarrollo.',
		en: {
			rubro: 'Private client',
			titulo: 'Website for a private client',
			queSeHizo: 'Custom website for the client, currently in development.',
		},
	},
];

/**
 * Entradas de FANTASÍA para mirar cómo queda la sección. Solo se usan en `npm run dev` con la variable VISTA_PREVIA=independiente
 * (src/pages/tecnico.astro); en el build nunca se leen. Ninguna describe un trabajo real.
 */
export const vistaPreviaIndependiente: readonly TrabajoIndependiente[] = [
	{
		id: 'ejemplo-1',
		rubro: 'Ejemplo ficticio · Taller',
		titulo: 'Sitio de ejemplo para un taller mecánico',
		queSeHizo: 'Texto de relleno: galería de trabajos con antes y después, y pedido de turno por mensaje.',
		stack: ['Astro', 'TypeScript', 'Cloudflare Pages'],
		url: 'https://ejemplo.invalid/',
		captura: 'capturas/tablero-resumen-clara.png',
		capturaAlt: 'Imagen de relleno de la vista previa: no es un sitio de un cliente.',
		anio: 2026,
		permisoCliente: true,
	},
	{
		id: 'ejemplo-2',
		rubro: 'Ejemplo ficticio · Logística',
		titulo: 'Sitio de ejemplo para un negocio de venta y logística',
		queSeHizo: 'Texto de relleno: presentación del negocio, zonas de entrega y pedido de cotización.',
		stack: ['Astro', 'TypeScript'],
		anio: 2026,
		permisoCliente: true,
	},
	{
		id: 'ejemplo-3',
		rubro: 'Ejemplo ficticio · Riego',
		titulo: 'Sitio de ejemplo para un servicio de riego',
		queSeHizo: 'Texto de relleno: servicios, zonas de trabajo y pedido de visita.',
		stack: ['Astro'],
		permisoCliente: true,
	},
];

export const esReferencia = (e: TrabajoIndependiente): e is ReferenciaAnonima => e.tipo === 'referencia';

function problemasComunes(e: Comun): string[] {
	const p: string[] = [];
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) p.push('id: minúsculas, números y guiones');
	if (!e.rubro.trim()) p.push('falta el rubro');
	if (!e.titulo.trim()) p.push('falta el título');
	if (!e.queSeHizo.trim()) p.push('falta «qué se hizo»');
	if (e.anio !== undefined && !(Number.isInteger(e.anio) && e.anio >= 2020 && e.anio <= 2100)) p.push('año fuera de rango');
	return p;
}

function problemasDeReferencia(e: ReferenciaAnonima): string[] {
	const p = problemasComunes(e);
	// Lo que una referencia no puede tener: ni url, captura o capturaAlt (aunque vengan vacíos), ni nada fuera de la lista.
	for (const campo of Object.keys(e)) {
		if (!CAMPOS_REFERENCIA.includes(campo)) p.push(`${campo}: no se permite en una referencia anónima`);
	}
	if (e.stack !== undefined && (e.stack.length === 0 || e.stack.some((s) => !s.trim()))) p.push('stack: si se escribe, sin elementos vacíos (si no se sabe, no se escribe)');
	if (e.estado !== undefined && e.estado !== 'en-curso') p.push("estado: solo 'en-curso' (o sin el campo)");
	// En tiempo de ejecución la versión en inglés puede venir incompleta aunque el tipo diga lo contrario: se revisa como parcial.
	const en: Partial<Textos> | undefined = e.en;
	if (!en || typeof en !== 'object') p.push('falta la versión en inglés');
	else {
		const claves = Object.keys(en);
		if (claves.length !== CAMPOS_TEXTOS.length || !claves.every(esCampoDeTexto) || CAMPOS_TEXTOS.some((c) => !String(en[c] ?? '').trim())) {
			p.push('la versión en inglés debe tener rubro, titulo y queSeHizo, completos y sin otros campos');
		}
	}
	for (const [nombre, texto] of [['rubro', e.rubro], ['título', e.titulo], ['qué se hizo', e.queSeHizo], ['rubro (inglés)', en?.rubro], ['título (inglés)', en?.titulo], ['qué se hizo (inglés)', en?.queSeHizo]] as const) {
		if (typeof texto === 'string' && DATO_PERSONAL.test(texto)) p.push(`${nombre}: parece traer un dato personal (dirección, correo, teléfono o número)`);
	}
	return p;
}

function problemasDeCompleta(e: SitioCompleto): string[] {
	const p = problemasComunes(e);
	if (!e.stack || e.stack.length === 0 || e.stack.some((s) => !s.trim())) p.push('falta el stack');
	if (e.url !== undefined && !/^https:\/\/[^\s/]+(\/\S*)?$/.test(e.url)) p.push('la url debe ser https');
	if (e.captura !== undefined) {
		if (!/^independiente\/[\w.-]+\.(png|jpe?g|webp)$/.test(e.captura)) p.push('la captura va en src/assets/independiente/');
		if (!e.capturaAlt?.trim()) p.push('falta el texto alternativo de la captura');
	}
	return p;
}

/**
 * Los problemas de una entrada que se va a mostrar (lista vacía = completa). Las referencias siempre se revisan; las completas
 * solo con permiso (sin él no se muestran y no se revisan).
 */
export function problemasDeEntrada(e: TrabajoIndependiente): string[] {
	if (esReferencia(e)) return problemasDeReferencia(e);
	if (!e.permisoCliente) return [];
	return problemasDeCompleta(e);
}

/**
 * Lo que se muestra: las referencias (`tipo === 'referencia'`, estrictamente) y las entradas completas con
 * `permisoCliente === true` (estrictamente: ni un valor «verdadero» de otro tipo). Una entrada visible pero incompleta o con
 * campos prohibidos es un error (la compilación falla), no una entrada oculta.
 */
export function trabajosVisibles(entradas: readonly TrabajoIndependiente[] = trabajosIndependientes): TrabajoIndependiente[] {
	const visibles = entradas.filter((e) => esReferencia(e) || e.permisoCliente === true);
	const ids = new Set<string>();
	for (const e of visibles) {
		const p = problemasDeEntrada(e);
		if (ids.has(e.id)) p.push('id repetido');
		ids.add(e.id);
		if (p.length > 0) {
			throw new Error(
				esReferencia(e)
					? `Referencia anónima «${e.id}» incompleta o con campos que no se permiten: ${p.join('; ')}.`
					: `Trabajo independiente «${e.id}» con permiso pero incompleto: ${p.join('; ')}.`,
			);
		}
	}
	return visibles;
}

/** Lo que la página imprime de una entrada: nada más que esto. */
export interface VistaTrabajo {
	id: string;
	referencia: boolean;
	rubro: string;
	titulo: string;
	queSeHizo: string;
	stack: string[];
	anio?: number;
	url?: string;
	captura?: string;
	capturaAlt?: string;
}

/**
 * La entrada lista para dibujar, en el idioma pedido. Una referencia se copia campo por campo: aunque el objeto trajera algo de
 * más, `url`, `captura` y lo demás no pasan. Una entrada completa sin traducción se muestra en español.
 */
export function vistaDe(e: TrabajoIndependiente, idioma: Idioma): VistaTrabajo {
	const textos: Textos = idioma === 'en' && e.en ? e.en : e;
	const base = { id: e.id, rubro: textos.rubro, titulo: textos.titulo, queSeHizo: textos.queSeHizo, stack: [...(e.stack ?? [])] };
	if (esReferencia(e)) return { ...base, referencia: true, ...(e.anio !== undefined && { anio: e.anio }) };
	return {
		...base,
		referencia: false,
		...(e.anio !== undefined && { anio: e.anio }),
		...(e.url !== undefined && { url: e.url }),
		...(e.captura !== undefined && { captura: e.captura }),
		...(e.capturaAlt !== undefined && { capturaAlt: e.capturaAlt }),
	};
}

const INTRO = {
	es: {
		completas: 'Sitios web para clientes particulares, publicados con autorización de cada cliente y sin sus datos personales.',
		referencias: 'Sin nombres, direcciones ni capturas, por privacidad de los clientes.',
		mezcla: 'Los demás se resumen en una tarjeta, sin nombres, direcciones ni capturas, por privacidad de los clientes.',
	},
	en: {
		completas: 'Websites for private clients, published with each client\'s permission and without their personal data.',
		referencias: 'No names, addresses or screenshots, for the clients\' privacy.',
		mezcla: 'The rest are summed up in one card, with no names, addresses or screenshots, for the clients\' privacy.',
	},
} as const;

/** Lo que dibuja la tarjeta única de las referencias: una línea con los conteos y los rubros. Todo sale de las entradas. */
export interface ResumenReferencias {
	principal: string;
	rubros: string[];
}

const RESUMEN = {
	es: {
		base: 'Sitios web a medida para clientes particulares',
		entregados: (n: number) => `${n} ${n === 1 ? 'entregado' : 'entregados'}`,
		enCurso: (n: number) => `${n} en curso`,
		y: ' y ',
	},
	en: {
		base: 'Custom websites for private clients',
		entregados: (n: number) => `${n} delivered`,
		enCurso: (n: number) => `${n} in progress`,
		y: ' and ',
	},
} as const;

/**
 * Junta las referencias en una sola tarjeta: «Sitios web a medida para clientes particulares: 4 entregados y 1 en curso.» más los
 * rubros de los entregados (con la cantidad si se repite). Los números los calcula el código; los textos de cada entrada no se
 * tocan. Las entradas completas se ignoran.
 */
export function resumenReferencias(lista: readonly TrabajoIndependiente[], idioma: Idioma): ResumenReferencias {
	const referencias = lista.filter(esReferencia);
	const entregadas = referencias.filter((e) => e.estado !== 'en-curso');
	const enCurso = referencias.length - entregadas.length;
	const t = RESUMEN[idioma];
	const partes = [...(entregadas.length > 0 ? [t.entregados(entregadas.length)] : []), ...(enCurso > 0 ? [t.enCurso(enCurso)] : [])];
	const cuentas = new Map<string, number>();
	for (const e of entregadas) {
		const rubro = vistaDe(e, idioma).rubro;
		cuentas.set(rubro, (cuentas.get(rubro) ?? 0) + 1);
	}
	return {
		principal: partes.length > 0 ? `${t.base}: ${partes.join(t.y)}.` : `${t.base}.`,
		rubros: [...cuentas].map(([rubro, n]) => (n > 1 ? `${rubro} (${n})` : rubro)),
	};
}

/** La nota que abre la sección: dice lo que de verdad se muestra (solo referencias, solo sitios con permiso o ambos). */
export function introIndependiente(lista: readonly TrabajoIndependiente[], idioma: Idioma): string {
	const hayReferencias = lista.some(esReferencia);
	const hayCompletas = lista.some((e) => !esReferencia(e));
	const t = INTRO[idioma];
	if (hayReferencias && hayCompletas) return `${t.completas} ${t.mezcla}`;
	return hayReferencias ? t.referencias : t.completas;
}

/**
 * Qué lista dibuja la página. La vista previa (datos ficticios) solo existe en desarrollo: `enDesarrollo` lo calcula quien
 * llama con `import.meta.env.DEV`, y en el build es `false`, así que nunca la activa.
 */
export function trabajosAMostrar(pedidaVistaPrevia: boolean, enDesarrollo: boolean): { lista: TrabajoIndependiente[]; vistaPrevia: boolean } {
	if (enDesarrollo && pedidaVistaPrevia) return { lista: [...vistaPreviaIndependiente], vistaPrevia: true };
	return { lista: trabajosVisibles(), vistaPrevia: false };
}
