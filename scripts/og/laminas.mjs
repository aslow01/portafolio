// Las láminas de las imágenes para compartir (1200 × 630): la lista de lo que hay que dibujar, con todos los textos que
// la plantilla necesita. Puro: sin Playwright ni DOM, para que lo use el generador (generar.mjs) y la prueba (og.test.mjs).
// Los textos salen del sitio (src/lib/sitio.ts, src/v5/datos.ts y los casos de src/content/casos y src/content-en/casos):
// nada de eso se escribe acá. Los únicos literales son los de las constantes de abajo, y og.test.mjs comprueba que cada uno
// siga en su página.
// Hay dos juegos: el español (claves `portada`, `tecnico`…) y el inglés (claves `en/portada`, `en/tecnico`…, archivos
// `en-portada-<huella>.png`). Las láminas en español no llevan ningún campo de idioma: así su huella no cambia.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cifraVisible, esDeCamino, obraPrincipal } from '../../src/lib/contenido.ts';
import { esPublicable } from '../../src/lib/estados.ts';
import { listaConY } from '../../src/lib/presentacion.ts';
import { minas, nombre, textosSitio } from '../../src/lib/sitio.ts';
import { fichasDe } from '../../src/v5/datos.ts';
import { claseDeTono, expedientes } from '../../src/v5/interiores/archivo.ts';
import { carpetaDe, partirCifra, partirTitulo } from '../../src/v5/interiores/caso.ts';
import { leerBloque, leerFrontmatter } from '../frontmatter.mjs';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

// Los literales: cada uno copia lo que dice una página del sitio (el español y el inglés están en las mismas páginas).
const LITERALES = {
	es: {
		// tecnico.astro, Portada.astro (la etiqueta de la pestaña dice «e IA · desarrollo de software y automatización · remoto»: lo primero y lo último; el título ya dice lo del medio)
		TECNICO: { palabra: 'Desarrollo', resto: 'de software y automatización', linea: 'Con IA · remoto' },
		LOGISTICA: { palabra: 'Logística', resto: 'y minería' }, // fichas/Logistica.astro
		CASOS: { rotulo: 'Archivo · casos anonimizados', palabra: 'Casos', resto: 'de estudio' }, // casos/index.astro
		ROTULO_CASO: 'Caso de estudio · anonimizado', // interiores/Expediente.astro
	},
	en: {
		// tecnico.astro: «Software development and AI automation»; la línea no repite «AI», que ya está en el título.
		TECNICO: { palabra: 'Software', resto: 'development and AI automation', linea: 'Remote' },
		LOGISTICA: { palabra: 'Logistics', resto: 'and mining' },
		CASOS: { rotulo: 'Archive · anonymized cases', palabra: 'Case', resto: 'studies' },
		ROTULO_CASO: 'Case study · anonymized',
	},
};

/** Cuántos expedientes caben en la lámina del cajón. */
export const MAX_EN_CAJON = 7;

/**
 * Los expedientes que entran en la lámina del cajón y cuántos quedan afuera. Si hay más casos que lugares, no se recorta
 * en silencio: `laminas()` avisa por consola y `og.test.mjs` falla hasta que se agrande la lámina.
 */
export function recortarCajon(lista, max = MAX_EN_CAJON) {
	return { visibles: lista.slice(0, max), omitidos: Math.max(0, lista.length - max) };
}
/** Tamaño de arranque del título de la ficha de Técnico y de Logística (px). */
const TAMANO = { tecnico: 150, logistica: 170 };

/** El nombre de archivo de una lámina: `en/portada` → `en-portada` (la barra no puede ir en un nombre de archivo). */
export const nombreDeArchivo = (clave) => clave.replace('/', '-');

const fichaDe = (idioma, id) => {
	const f = fichasDe(idioma).find((x) => x.id === id);
	if (!f) throw new Error(`Ficha desconocida: ${id}`);
	return f;
};
const datosDeFicha = (f) => ({ numero: f.numero, nombre: f.nombre, color: `c-${f.color}` });

/** Los casos de la carpeta que se publican (`esPublicable` con `dev` en falso), con lo que las láminas necesitan. */
export function casosPublicados(carpeta = join(RAIZ, 'src', 'content', 'casos')) {
	const casos = [];
	for (const archivo of readdirSync(carpeta).filter((f) => f.endsWith('.md'))) {
		const texto = readFileSync(join(carpeta, archivo), 'utf8');
		const { datos, problemas } = leerFrontmatter(texto);
		const id = archivo.replace(/\.md$/, '');
		if (problemas.length > 0) throw new Error(`casos/${id}: ${problemas.join('; ')}`);
		const data = {
			titulo: datos.titulo,
			corte: datos.corte ? Number(datos.corte) : undefined,
			orden: Number(datos.orden),
			caminos: (datos.caminos ?? '').replace(/[[\]\s]/g, '').split(',').filter(Boolean),
			estado: datos.estado,
			borrador: datos.borrador === 'true',
			destacado: datos.destacado === 'true',
			contexto: datos.contexto,
			resultado: leerBloque(texto, 'resultado'),
		};
		if (esPublicable(data, false)) casos.push({ id, data });
	}
	return casos.sort((a, b) => a.data.orden - b.data.orden);
}

/** La tapa de un caso (composición D), en español o en inglés. */
function laminaDeCaso({ id, data }, idioma) {
	const en = idioma === 'en';
	const f = datosDeFicha(fichaDe(idioma, carpetaDe(data.caminos)));
	const { primera, resto } = partirTitulo(data.titulo, data.corte);
	const visible = cifraVisible(data.resultado);
	// La cifra va solo si tiene un dígito («Partes cargados en la app» no es una cifra) y siempre con su medición entera.
	const cifra = visible?.cifra && /\d/.test(visible.cifra) ? partirCifra(visible.cifra, visible.unidad, visible.medicion ?? '') : undefined;
	const cifraEnAlt = cifra ? ` ${visible.cifra}${cifra.unidad ? ` ${cifra.unidad}` : ''}.` : '';
	const alt = en
		? `${nombre.completo}. Anonymized case study: ${data.titulo}.${cifraEnAlt}`
		: `${nombre.completo}. Caso de estudio anonimizado: ${data.titulo}.${cifraEnAlt}`;
	return {
		clave: `${en ? 'en/' : ''}caso-${id}`,
		composicion: 'D',
		ficha: f,
		firma: nombre.completo,
		rotulo: LITERALES[idioma].ROTULO_CASO,
		palabra: primera,
		resto,
		contexto: data.contexto ?? '',
		...(cifra ? { cifra } : {}),
		alt,
	};
}

/** Las láminas de un idioma, en orden: portada, tecnico, logistica, casos y una `caso-<id>` por caso publicado. */
function laminasDe(idioma) {
	const en = idioma === 'en';
	const prefijo = en ? 'en/' : '';
	const { TECNICO, LOGISTICA, CASOS } = LITERALES[idioma];
	const fichas = fichasDe(idioma);
	const { titular } = textosSitio(idioma);
	const publicados = casosPublicados(en ? join(RAIZ, 'src', 'content-en', 'casos') : undefined);
	const principal = obraPrincipal(publicados.filter((c) => esDeCamino(c.data, 'tecnico')));
	const { visibles: cajon, omitidos } = recortarCajon(expedientes(publicados, principal?.id, false, false, idioma));
	if (omitidos > 0) console.warn(`AVISO: la lámina del cajón tiene lugar para ${MAX_EN_CAJON} casos y hay ${omitidos} más sin dibujar: agrandar la lámina (scripts/og).`);
	const tecnico = fichaDe(idioma, 'tecnico');
	const logistica = fichaDe(idioma, 'logistica');
	// Lo que asoma de Técnico (decorativo): «0,0» + «1» en español, «0.0» + «1» en inglés.
	const decimal = en ? { decimal: '0.0' } : {};

	return [
		{
			clave: `${prefijo}portada`,
			composicion: 'A',
			nombre: [nombre.primero, nombre.segundo, nombre.apellido],
			titular,
			bandas: fichas.map((f) => ({ numero: f.numero, corto: f.corto, color: `c-${f.color}`, asoma: f.id === 'tecnico', ...(f.id === 'tecnico' ? decimal : {}) })),
			alt: en
				? `${nombre.completo}. ${titular}. Five colored tabs: ${listaConY(fichas.map((f) => f.corto), 'en')}.`
				: `${nombre.completo}. ${titular}. Cinco pestañas de colores: ${listaConY(fichas.map((f) => f.corto))}.`,
		},
		{
			clave: `${prefijo}tecnico`,
			composicion: 'B',
			variante: 'tecnico',
			ficha: datosDeFicha(tecnico),
			firma: nombre.completo,
			palabra: TECNICO.palabra,
			resto: TECNICO.resto,
			linea: TECNICO.linea,
			tamano: TAMANO.tecnico,
			...decimal,
			alt: en
				? `${nombre.completo}. ${tecnico.nombre}: remote software development and AI automation. A 0.01 difference highlighted.`
				: `${nombre.completo}. ${tecnico.nombre}: ${TECNICO.palabra.toLowerCase()} ${TECNICO.resto}, remoto. Una diferencia de 0,01 resaltada.`,
		},
		{
			clave: `${prefijo}logistica`,
			composicion: 'B',
			variante: 'logistica',
			ficha: datosDeFicha(logistica),
			firma: nombre.completo,
			palabra: LOGISTICA.palabra,
			resto: LOGISTICA.resto,
			linea: minas.join(' · '),
			tamano: TAMANO.logistica,
			alt: en
				? `${nombre.completo}. ${logistica.nombre}: ${listaConY([...minas], 'en')}, over a drawing of a mountain range.`
				: `${nombre.completo}. ${logistica.nombre}: ${listaConY([...minas])}, sobre el dibujo de una cordillera.`,
		},
		{
			clave: `${prefijo}casos`,
			composicion: 'C',
			rotulo: CASOS.rotulo,
			palabra: CASOS.palabra,
			resto: CASOS.resto,
			firma: nombre.completo,
			expedientes: cajon.map((e) => ({ id: e.href.split('/').filter(Boolean).at(-1), numero: e.numero, titulo: e.titulo, clases: claseDeTono(e.tono) })),
			alt: en
				? `${nombre.completo}. Anonymized case studies, stacked like colored case files.`
				: `${nombre.completo}. Casos de estudio anonimizados, apilados como expedientes de colores.`,
		},
		...publicados.map((c) => laminaDeCaso(c, idioma)),
	];
}

/** Todas las láminas, primero las de español y después las de inglés. Cada una es un objeto serializable (la huella sale de su JSON). */
export async function laminas() {
	return [...laminasDe('es'), ...laminasDe('en')];
}

/**
 * Los primeros 10 caracteres hexadecimales del SHA-256 de la lámina, la plantilla y la hoja: el nombre del archivo cambia
 * solo si cambia algo de lo que se ve (los rastreadores guardan la imagen por su dirección). 10 caracteres alcanzan para cambiar el nombre del archivo.
 */
export function huella(lamina, plantilla, css) {
	return createHash('sha256').update(JSON.stringify(lamina) + plantilla + css).digest('hex').slice(0, 10);
}
