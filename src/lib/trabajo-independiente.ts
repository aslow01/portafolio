// Trabajo independiente de Matías: sitios web hechos para clientes particulares (no para su empleador).
// Puro, sin Astro: se prueba con `npm test` (scripts/trabajo-independiente.test.mjs).
//
// REGLA DE PRIVACIDAD (carpeta privada de trabajo): un sitio se muestra SOLO si el cliente dio permiso por escrito
// (`permisoCliente: true`) y sin sus datos personales (ni su nombre, ni el de su negocio, ni teléfonos, ni direcciones). Por
// eso el título es siempre genérico («Taller mecánico»), nunca el nombre del negocio. Sin ninguna entrada con permiso, la
// sección «Trabajo independiente» no aparece en la web (la página ni se genera): la rama se puede publicar sin riesgo.
//
// CÓMO AGREGAR UN SITIO (la quinta web, por ejemplo):
//   1. Copiar un bloque de `trabajosIndependientes` y darle un `id` nuevo (minúsculas y guiones, sin el nombre del cliente).
//   2. Completar `rubro`, `titulo` (genérico), `queSeHizo` (1 a 3 frases que Matías pueda sostener en una entrevista),
//      `stack`, `anio` y, si el cliente lo autoriza, `url`.
//   3. Si hay captura: guardarla en `src/assets/independiente/` y poner `captura: 'independiente/<archivo>.png'` más
//      `capturaAlt` (qué se ve, sin datos personales). Revisar la imagen: sin nombres, teléfonos, patentes ni rostros.
//   4. Recién con el permiso del cliente en mano, pasar `permisoCliente` a `true`. Si queda a medias (sin `queSeHizo` o con una
//      `url` que no es https), la compilación falla a propósito en vez de ocultarlo en silencio.

export interface TrabajoIndependiente {
	/** Identificador interno, único: minúsculas y guiones. Nunca el nombre del cliente. */
	id: string;
	/** Rubro del cliente, en pocas palabras («Taller mecánico»). */
	rubro: string;
	/** Título genérico, sin nombre del negocio ni de la persona («Sitio para un taller mecánico»). */
	titulo: string;
	/** Qué se hizo: 1 a 3 frases, solo lo que Matías confirme. */
	queSeHizo: string;
	/** Tecnologías, una por elemento. */
	stack: readonly string[];
	/** Dirección pública del sitio (https), solo si el cliente la autoriza. */
	url?: string;
	/** Captura: ruta dentro de `src/assets/`, siempre `independiente/<archivo>`. Requiere `capturaAlt`. */
	captura?: string;
	/** Texto alternativo de la captura: qué se ve, sin datos personales. */
	capturaAlt?: string;
	/** Año de publicación. */
	anio?: number;
	/** `true` solo con el permiso del cliente. Con `false` (o sin el campo) la entrada no se muestra en ningún lado. */
	permisoCliente: boolean;
}

/**
 * Los sitios. Todos entran con `permisoCliente: false` y sin `url` ni `captura`: todavía no hay permisos ni material
 * (28/11/2026). Los textos de `queSeHizo` y `stack` son de trabajo, tomados de lo que cada cliente pidió; Matías
 * los confirma o corrige antes de dar el permiso.
 */
export const trabajosIndependientes: readonly TrabajoIndependiente[] = [
	{
		id: 'venta-logistica-1',
		rubro: 'Venta y logística',
		titulo: 'Sitio para un negocio de venta y logística',
		queSeHizo: 'Sitio para presentar el negocio y recibir pedidos de cotización.',
		stack: [],
		permisoCliente: false,
	},
	{
		id: 'taller-1',
		rubro: 'Taller mecánico',
		titulo: 'Sitio para un taller mecánico',
		queSeHizo: 'Sitio para mostrar los trabajos del taller.',
		stack: [],
		permisoCliente: false,
	},
	{
		id: 'taller-2',
		rubro: 'Taller mecánico',
		titulo: 'Segundo sitio para un taller mecánico',
		queSeHizo: 'Sitio para mostrar los trabajos del taller.',
		stack: [],
		permisoCliente: false,
	},
	{
		id: 'agro-riego-1',
		rubro: 'Agricultura y riego',
		titulo: 'Sitio para un profesional de agricultura y riego',
		queSeHizo: 'Sitio para presentar sus servicios.',
		stack: [],
		permisoCliente: false,
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

/** Los problemas de una entrada con permiso (lista vacía = completa). Las que no tienen permiso no se revisan. */
export function problemasDeEntrada(e: TrabajoIndependiente): string[] {
	if (!e.permisoCliente) return [];
	const p: string[] = [];
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) p.push('id: minúsculas, números y guiones');
	if (!e.rubro.trim()) p.push('falta el rubro');
	if (!e.titulo.trim()) p.push('falta el título');
	if (!e.queSeHizo.trim()) p.push('falta «qué se hizo»');
	if (e.stack.length === 0 || e.stack.some((s) => !s.trim())) p.push('falta el stack');
	if (e.url !== undefined && !/^https:\/\/[^\s/]+(\/\S*)?$/.test(e.url)) p.push('la url debe ser https');
	if (e.captura !== undefined) {
		if (!/^independiente\/[\w.-]+\.(png|jpe?g|webp)$/.test(e.captura)) p.push('la captura va en src/assets/independiente/');
		if (!e.capturaAlt?.trim()) p.push('falta el texto alternativo de la captura');
	}
	if (e.anio !== undefined && !(Number.isInteger(e.anio) && e.anio >= 2020 && e.anio <= 2100)) p.push('año fuera de rango');
	return p;
}

/**
 * Lo que se muestra: SOLO las entradas con `permisoCliente === true` (estrictamente: ni un valor «verdadero» de otro tipo).
 * Una entrada con permiso pero incompleta es un error (la compilación falla), no una entrada oculta.
 */
export function trabajosVisibles(entradas: readonly TrabajoIndependiente[] = trabajosIndependientes): TrabajoIndependiente[] {
	const conPermiso = entradas.filter((e) => e.permisoCliente === true);
	const ids = new Set<string>();
	for (const e of conPermiso) {
		const p = problemasDeEntrada(e);
		if (ids.has(e.id)) p.push('id repetido');
		ids.add(e.id);
		if (p.length > 0) throw new Error(`Trabajo independiente «${e.id}» con permiso pero incompleto: ${p.join('; ')}.`);
	}
	return conPermiso;
}

/**
 * Qué lista dibuja la página. La vista previa (datos ficticios) solo existe en desarrollo: `enDesarrollo` lo calcula quien
 * llama con `import.meta.env.DEV`, y en el build es `false`, así que nunca la activa.
 */
export function trabajosAMostrar(pedidaVistaPrevia: boolean, enDesarrollo: boolean): { lista: TrabajoIndependiente[]; vistaPrevia: boolean } {
	if (enDesarrollo && pedidaVistaPrevia) return { lista: [...vistaPreviaIndependiente], vistaPrevia: true };
	return { lista: trabajosVisibles(), vistaPrevia: false };
}
