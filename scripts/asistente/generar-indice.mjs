// Genera el contenido público que lee el asistente: `npm run asistente:indice` → worker/src/contexto.generado.ts.
//
// Una sola fuente de verdad: todo sale de src/ (content y lib) con los mismos filtros de visibilidad que la web
// (esPublicable, demoVisible, proyectoVisible), más las preguntas frecuentes de scripts/asistente/faq.es.md (a mano, revisadas
// por Matías). No lee los CV, las evidencias ni las notas internas del repositorio base. Lo que no está publicado en la web no puede llegar al modelo por construcción.
//
// Es determinista (sin fechas): dos corridas dan la misma huella. Falla si pasa del presupuesto de tokens.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { leerBloque, leerFrontmatter } from '../frontmatter.mjs';
import { cifraVisible } from '../../src/lib/contenido.ts';
import { cv, cvEn, telefono } from '../../src/lib/datos-pendientes.ts';
import { esReferencia, resumenReferencias, trabajosIndependientes, trabajosVisibles } from '../../src/lib/trabajo-independiente.ts';
import { demoVisible, esPublicable, proyectoVisible } from '../../src/lib/estados.ts';
import { experiencia, textoPeriodo } from '../../src/lib/experiencia.ts';
import { novela } from '../../src/lib/opciones.ts';
import { bajadaPortada, comoTrabajo, correo, estudiosActuales, linkedin, minas, nombre, textosSitio, titular, ubicacion } from '../../src/lib/sitio.ts';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_POR_DEFECTO = join(AQUI, '..', '..');

/** Estimación pesimista: un token cada 3 caracteres. */
export const estimarTokens = (texto) => Math.ceil(texto.length / 3);
/** Presupuesto de diseño: 20.000 tokens; por encima de 24.000 estimados el build falla (docs-asistente/03, 5.3). */
export const ESTIMADO_MAXIMO_TOKENS = 24_000;
export const PRESUPUESTO_TOKENS = 20_000;

// --- Lectura del contenido -------------------------------------------------------------------------------------------

const sinComentarios = (t) => t.replace(/<!--[\s\S]*?-->/g, '');
const desescapar = (t) => t.replace(/\\"/g, '"');

/** Campos simples del encabezado, el cuerpo y los bloques de una entrada de src/content. */
function leerEntrada(ruta) {
	const bruto = readFileSync(ruta, 'utf8');
	const { datos } = leerFrontmatter(bruto);
	for (const k of Object.keys(datos)) datos[k] = desescapar(datos[k]);
	const bloque = (clave) => Object.fromEntries(Object.entries(leerBloque(bruto, clave)).map(([k, v]) => [k, desescapar(v)]));
	const cuerpo = bruto.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
	return { datos, bloque, cuerpo: sinComentarios(cuerpo).trim() };
}

function entradas(raiz, carpeta) {
	const dir = join(raiz, 'src', 'content', carpeta);
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith('.md'))
		.sort()
		.map((f) => ({ id: f.replace(/\.md$/, ''), ...leerEntrada(join(dir, f)) }));
}

/** El front matter dice `estado` y `borrador` como texto; las funciones de visibilidad esperan `{ estado, borrador? }`. */
const visibilidad = (datos) => ({ estado: datos.estado, borrador: datos.borrador === 'true' });
const orden = (a, b) => Number(a.datos.orden ?? 0) - Number(b.datos.orden ?? 0) || a.id.localeCompare(b.id);

const linea = (rotulo, valor) => (valor && String(valor).trim() !== '' ? `${rotulo}: ${String(valor).trim()}` : '');
const unir = (...partes) => partes.filter((p) => p && p !== '').join('\n');

/** Filas de «mi parte y autoría», tal como las muestra la web. */
function autoria(a) {
	return unir(linea('Su parte', a.yo), linea('Autoría', a.ia), linea('Cómo lo verifica', a.verificacion));
}

function listaDeStack(valor) {
	if (!valor) return '';
	try {
		const v = JSON.parse(valor);
		return Array.isArray(v) ? v.join(', ') : '';
	} catch {
		return '';
	}
}

// --- Bloques ----------------------------------------------------------------------------------------------------------

function bloquePerfil() {
	return unir(
		linea('Nombre', nombre.completo),
		linea('Base', ubicacion),
		linea('Titular del sitio', titular),
		linea('Qué hace', bajadaPortada),
		linea('Cómo trabaja', comoTrabajo),
		linea('Estudios', estudiosActuales),
		linea('Inducciones en las minas', minas.join(', ')),
		'El sitio tiene dos caminos: «Logística y minería» (/#logistica) y «Técnico e IA» (/#tecnico), y las secciones Demos (/#demos), Proyectos (/#proyectos) y Contacto (/#contacto). Los casos están en /casos/.',
		// La versión en inglés (/en/) tiene las mismas páginas y los mismos identificadores de casos: el contexto se escribe una sola vez, en español
		// (cada pedido paga el contexto entero) y el asistente traduce al responder; solo cambian las rutas y lo que el sitio en inglés dice distinto.
		'El sitio tiene una versión en inglés con las mismas páginas bajo /en/: /en/#logistica, /en/#tecnico, /en/#demos, /en/#proyectos, /en/#contacto, /en/casos/ y /en/casos/<id>/ para cada caso (el mismo id). A quien lee la versión en inglés hay que darle enlaces con el prefijo /en/. Las demos en vivo (los tres subdominios) están en español. En la versión en inglés el camino «Técnico e IA» se llama «Software and AI» y su CV, «Software CV».',
		linea('Idiomas (como los declara la versión en inglés del sitio)', textosSitio('en').idiomas),
		linea('Estudios (como los dice la versión en inglés del sitio)', textosSitio('en').estudiosActuales),
	);
}

function bloqueContacto() {
	const cvs = [
		['CV de logística y minería', cv.logistica],
		['CV técnico e IA', cv.tecnico],
	]
		.filter(([, c]) => c)
		.map(([t, c]) => `- ${t} (descarga gratuita): ${c.archivo} · ${c.detalle}`);
	// Los CV de la versión en inglés (los dos caminos tienen PDF en inglés desde el 28/11/2026). Si uno apunta al mismo archivo
	// que el de español, no se repite.
	const enIngles = [
		['CV técnico en inglés', 'tecnico'],
		['CV de logística y minería en inglés', 'logistica'],
	]
		.filter(([, c]) => cvEn[c] && cvEn[c].archivo !== cv[c]?.archivo)
		.map(([t, c]) => `- ${t} (descarga gratuita; el de la versión en inglés del sitio): ${cvEn[c].archivo} · ${cvEn[c].detalle}`);
	return unir(
		linea('Correo', correo),
		telefono ? linea('WhatsApp y teléfono', telefono.visible) : '',
		linea('LinkedIn', linkedin),
		'Todos los canales y los CV: /#contacto',
		cvs.length ? `CV en PDF:\n${[...cvs, ...enIngles].join('\n')}` : '',
	);
}

function bloqueExperiencia() {
	return experiencia
		.map((p) => {
			const cabeza = `- ${textoPeriodo(p)}: ${p.titulo}${p.lugar ? `, ${p.lugar}` : ''}`;
			const puntos = (p.puntos ?? []).map((x) => `  · ${x}`);
			return unir(cabeza, p.detalle ? `  ${p.detalle}` : '', ...puntos);
		})
		.join('\n');
}

function bloqueCaso(c, demos) {
	const d = c.datos;
	const r = cifraVisible(c.bloque('resultado'));
	const demo = d.demo ? demos.find((x) => x.id === d.demo) : undefined;
	return [
		`<caso id="${c.id}" url="/casos/${c.id}/">`,
		unir(
			linea('Título', d.titulo),
			linea('Resumen', d.resumen),
			linea('Contexto', d.contexto),
			linea('Su rol', d.rol),
			linea('Uso', d.uso),
			linea('Regla', d.regla),
			linea('Resultado', d.resultadoCorto),
			r ? linea('Cifra', `${r.cifra} ${r.unidad ?? ''}`.trim() + ` (${r.medicion})`) : '',
			autoria(c.bloque('autoria')),
			demo ? linea('Demo relacionada', demo.datos.titulo) : '',
			c.cuerpo ? `\n${c.cuerpo}` : '',
		),
		'</caso>',
	].join('\n');
}

function bloqueDemo(c) {
	const d = c.datos;
	const prueba = c.bloque('prueba');
	return [
		`<demo id="${c.id}" demo="${d.demo ?? ''}" repo="${d.repo ?? ''}">`,
		unir(
			linea('Título', d.titulo),
			linea('Resumen', d.resumen),
			linea('Estado', d.estado === 'en-vivo' ? 'en vivo' : 'en desarrollo'),
			linea('Tecnologías', listaDeStack(d.stack)),
			linea('Aviso', d.aviso),
			prueba.titular ? linea('Una prueba de la demo', `${prueba.titular}. ${prueba.regla ?? ''} ${prueba.queDice ?? ''}`.replace(/\s+/g, ' ')) : '',
			autoria(c.bloque('autoria')),
			c.cuerpo ? `\n${c.cuerpo}` : '',
		),
		'</demo>',
	].join('\n');
}

/**
 * Sitios hechos para clientes particulares (lib/trabajo-independiente.ts). Las referencias anónimas van en UN solo bloque, igual que la
 * tarjeta de la web: los conteos y los rubros, sin dirección ni nombres. Las entradas completas (con permiso escrito del cliente) van
 * una por bloque. Sin ninguna entrada visible, no hay bloque.
 */
function bloquesTrabajoIndependiente(lista) {
	const referencias = lista.filter(esReferencia);
	const completas = lista.filter((t) => !esReferencia(t));
	const bloques = [];
	if (referencias.length > 0) {
		const r = resumenReferencias(referencias, 'es');
		bloques.push(
			[
				'<trabajo_independiente id="referencias" url="/tecnico/">',
				unir(linea('Resumen', r.principal), linea('Rubros', r.rubros.join(', ')), linea('Aviso', 'Referencias anónimas: sin nombres, direcciones ni capturas por privacidad de los clientes.')),
				'</trabajo_independiente>',
			].join('\n'),
		);
	}
	for (const t of completas) {
		bloques.push(
			[
				`<trabajo_independiente id="${t.id}" url="/tecnico/">`,
				unir(linea('Título', t.titulo), linea('Rubro', t.rubro), linea('Qué hizo', t.queSeHizo), linea('Tecnologías', (t.stack ?? []).join(', ')), linea('Año', t.anio), linea('Sitio', t.url)),
				'</trabajo_independiente>',
			].join('\n'),
		);
	}
	return bloques;
}

function bloqueProyecto(p) {
	return [
		`<proyecto id="${p.id}" url="/#proyectos">`,
		unir(
			linea('Título', p.titulo),
			linea('Tipo', p.tipo),
			linea('Estado', p.estado),
			linea('Resumen', p.resumen),
			autoria(p.autoria),
			p.cuerpo ? `\n${p.cuerpo}` : '',
		),
		'</proyecto>',
	].join('\n');
}

function proyectosPublicos(raiz) {
	const lista = entradas(raiz, 'proyectos')
		// La novela nunca sale de una entrada: sus textos son los fijos de lib/opciones.ts.
		.filter((e) => e.datos.tipo !== 'novela' && proyectoVisible(visibilidad(e.datos), false))
		.sort(orden)
		.map((e) => ({
			id: e.id,
			titulo: e.datos.titulo,
			tipo: e.datos.tipo,
			estado: e.datos.estado,
			resumen: e.datos.resumen,
			autoria: e.bloque('autoria'),
			cuerpo: e.datos.borrador === 'true' ? '' : e.cuerpo,
		}));
	const deNovela = {
		id: 'novela',
		titulo: novela.titulo,
		tipo: novela.tipo,
		estado: novela.estado,
		resumen: `${novela.texto} ${novela.aparte}`,
		autoria: novela.autoria,
		cuerpo: '',
	};
	return [deNovela, ...lista];
}

/** Preguntas frecuentes escritas a mano y revisadas por Matías (scripts/asistente/faq.es.md), sin sus comentarios. */
function bloqueFaq(raiz) {
	const ruta = join(raiz, 'scripts', 'asistente', 'faq.es.md');
	if (!existsSync(ruta)) throw new Error(`Falta ${ruta}`);
	return sinComentarios(readFileSync(ruta, 'utf8')).trim();
}

// --- Armado ------------------------------------------------------------------------------------------------------------

/**
 * @param {{ raiz?: string, trabajos?: readonly object[] }} [opciones] `raiz`: carpeta del sitio (por defecto, este repositorio);
 *   `trabajos`: los sitios independientes (por defecto, los de lib/trabajo-independiente.ts; solo para pruebas).
 * @returns {{ texto: string, huella: string, tokens: number }}
 */
export function construirIndice(opciones = {}) {
	const raiz = opciones.raiz ?? RAIZ_POR_DEFECTO;
	// Solo con permiso del cliente y completos; uno con permiso pero incompleto hace fallar la corrida, igual que la web.
	const independientes = trabajosVisibles(opciones.trabajos ?? trabajosIndependientes);
	const demosTodas = entradas(raiz, 'demos');
	const demos = demosTodas.filter((e) => demoVisible(visibilidad(e.datos), false)).sort(orden);
	const casos = entradas(raiz, 'casos')
		.filter((e) => esPublicable(visibilidad(e.datos), false))
		.sort(orden);

	const cuerpo = [
		`<perfil>\n${bloquePerfil()}\n</perfil>`,
		`<contacto>\n${bloqueContacto()}\n</contacto>`,
		`<experiencia>\n${bloqueExperiencia()}\n</experiencia>`,
		...casos.map((c) => bloqueCaso(c, demos)),
		...demos.map((d) => bloqueDemo(d)),
		...proyectosPublicos(raiz).map((p) => bloqueProyecto(p)),
		...bloquesTrabajoIndependiente(independientes),
		`<preguntas_frecuentes>\n${bloqueFaq(raiz)}\n</preguntas_frecuentes>`,
	].join('\n\n');

	const huella = createHash('sha256').update(cuerpo).digest('hex').slice(0, 12);
	const texto = `<contenido_publico indice="${huella}">\n\n${cuerpo}\n\n</contenido_publico>`;
	const tokens = estimarTokens(texto);
	if (tokens > ESTIMADO_MAXIMO_TOKENS) {
		throw new Error(
			`El contenido del asistente pasa el presupuesto: ~${tokens} tokens estimados (máximo ${ESTIMADO_MAXIMO_TOKENS}, objetivo ${PRESUPUESTO_TOKENS}). ` +
				'Acorte un caso o saque el cuerpo de alguna entrada: cada pedido paga ese contexto.',
		);
	}
	return { texto, huella, tokens };
}

/** Escribe el módulo TypeScript que importa el Worker. No se versiona (está en .gitignore). */
export function escribirContexto(indice, destino) {
	mkdirSync(dirname(destino), { recursive: true });
	const modulo = [
		'// GENERADO por scripts/asistente/generar-indice.mjs (npm run asistente:indice). No editar a mano ni versionar.',
		`export const INDICE: string = ${JSON.stringify(indice.huella)};`,
		`export const CONTEXTO: string = ${JSON.stringify(indice.texto)};`,
		'',
	].join('\n');
	writeFileSync(destino, modulo, 'utf8');
}

// Uso por consola: node scripts/asistente/generar-indice.mjs
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const indice = construirIndice();
	const destino = join(RAIZ_POR_DEFECTO, 'worker', 'src', 'contexto.generado.ts');
	escribirContexto(indice, destino);
	console.log(`Contexto del asistente: ${indice.texto.length} caracteres, ~${indice.tokens} tokens estimados (presupuesto ${PRESUPUESTO_TOKENS}), huella ${indice.huella}.`);
	console.log(`Escrito en ${destino}`);
}
