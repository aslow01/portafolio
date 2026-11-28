// Generador del contenido público que lee el asistente (scripts/asistente/generar-indice.mjs). Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { construirIndice, ESTIMADO_MAXIMO_TOKENS, estimarTokens, escribirContexto } from './asistente/generar-indice.mjs';
import { leerFrontmatter } from './frontmatter.mjs';
import { datosPrivados } from './higiene.mjs';
import { correo, linkedin } from '../src/lib/sitio.ts';
import { cv, cvEn, telefono } from '../src/lib/datos-pendientes.ts';
import { textosSitio } from '../src/lib/sitio.ts';
import { experiencia } from '../src/lib/experiencia.ts';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const indice = construirIndice({ raiz: RAIZ });
const texto = indice.texto;

const archivosMd = (carpeta) => readdirSync(join(RAIZ, 'src', 'content', carpeta)).filter((f) => f.endsWith('.md'));
const frontmatterDe = (carpeta, archivo) => leerFrontmatter(readFileSync(join(RAIZ, 'src', 'content', carpeta, archivo), 'utf8')).datos;

test('el contexto trae los bloques con etiquetas fijas y su huella', () => {
	assert.match(texto, /^<contenido_publico indice="[0-9a-f]{12}">/);
	assert.match(texto, /<\/contenido_publico>$/);
	for (const etiqueta of ['perfil', 'contacto', 'experiencia', 'preguntas_frecuentes']) {
		assert.match(texto, new RegExp(`<${etiqueta}>[\\s\\S]+</${etiqueta}>`), etiqueta);
	}
	assert.match(indice.huella, /^[0-9a-f]{12}$/);
	assert.ok(texto.includes(`indice="${indice.huella}"`));
});

test('cada caso, demo y proyecto publicado aparece con su id y su URL; los borradores y «en preparación» no', () => {
	let publicados = 0;
	for (const f of archivosMd('casos')) {
		const d = frontmatterDe('casos', f);
		const id = f.replace(/\.md$/, '');
		if (d.estado === 'borrador') {
			assert.ok(!texto.includes(`id="${id}"`), `entró el borrador ${id}`);
			assert.ok(!texto.includes(d.titulo), `entró el título del borrador ${id}`);
		} else {
			publicados++;
			assert.ok(texto.includes(`<caso id="${id}" url="/casos/${id}/">`), `falta el caso ${id}`);
		}
	}
	assert.ok(publicados >= 5);
	for (const f of archivosMd('demos')) {
		const d = frontmatterDe('demos', f);
		const id = f.replace(/\.md$/, '');
		if (d.estado === 'en-preparacion') {
			assert.ok(!texto.includes(`id="${id}"`), `entró la demo en preparación ${id}`);
			assert.ok(!texto.includes(d.titulo), `entró el título de la demo en preparación ${id}`);
		} else {
			assert.ok(texto.includes(`<demo id="${id}"`), `falta la demo ${id}`);
			assert.ok(texto.includes(d.demo), `falta el enlace en vivo de ${id}`);
			assert.ok(texto.includes(d.repo), `falta el repositorio de ${id}`);
		}
	}
	for (const f of archivosMd('proyectos')) {
		const d = frontmatterDe('proyectos', f);
		if (d.tipo === 'novela') continue;
		const marca = `<proyecto id="${f.replace(/\.md$/, '')}"`;
		if (String(d.borrador) === 'true') assert.ok(!texto.includes(marca) && !texto.includes(d.titulo), `entró el borrador ${f}`);
		else assert.ok(texto.includes(marca), `falta el proyecto ${f}`);
	}
});

test('la novela sale de los textos fijos de lib/opciones.ts, nunca de una entrada de proyectos', () => {
	assert.match(texto, /<proyecto id="novela"/);
	assert.ok(texto.includes('Novela de terror por contagio, en dos libros.'));
});

test('el contacto es el público: correo, LinkedIn, teléfono y los CV de lib', () => {
	assert.ok(texto.includes(correo));
	assert.ok(texto.includes(linkedin));
	assert.ok(texto.includes(telefono.visible));
	assert.ok(texto.includes(cv.tecnico.archivo));
	assert.ok(texto.includes(cv.logistica.archivo));
});

test('la experiencia sale de lib/experiencia.ts, con la empresa anonimizada tal como la web', () => {
	for (const p of experiencia) assert.ok(texto.includes(p.titulo), p.titulo);
	assert.match(texto, /Empresa de seguridad privada de San Juan/);
});

test('lo que se cita solo con medición: la cifra del caso principal lleva su «medicion»', () => {
	assert.ok(texto.includes('40 → 300+'));
	assert.ok(texto.includes('octubre de 2026'));
});

test('sin comentarios HTML ni notas internas del contenido', () => {
	assert.ok(!texto.includes('<!--'));
	assert.ok(!/TODO/.test(texto));
});

test('higiene: ni datos privados, ni correos personales, ni CUIT, ni teléfonos que no sean el público, ni términos de la lista local', () => {
	const rutaLocal = join(RAIZ, 'scripts', 'higiene.local.json');
	const extra = existsSync(rutaLocal) ? JSON.parse(readFileSync(rutaLocal, 'utf8')) : {};
	const hallazgos = datosPrivados(texto, { telefonoPermitido: telefono.tel.replace(/\D/g, ''), extra });
	assert.deepEqual(hallazgos, []);
});

test('lo que no está publicado no entra: sueldo, disponibilidad ni cierre del trabajo actual', () => {
	assert.ok(!/pretensi[oó]n|salario|\bsueldo\b|fines de diciembre|renuncia|preaviso/i.test(texto.replace(/<preguntas_frecuentes>[\s\S]*<\/preguntas_frecuentes>/, '')));
	// En las preguntas frecuentes solo puede aparecer para decir que no está publicado.
	const faq = texto.match(/<preguntas_frecuentes>([\s\S]*)<\/preguntas_frecuentes>/)[1];
	assert.match(faq, /no (?:est[áa]|figura)[^.]*publicad/i);
});

test('el nivel de inglés: solo lo que dice el CV técnico, de descarga pública, y nunca como conversación en vivo', () => {
	assert.match(texto, /A2/);
	// El CV publicado dice solo «inglés básico (A2)»: el asistente no agrega «escrita» ni otro matiz que Matías no haya publicado.
	assert.doesNotMatch(texto, /comunicación escrita|written communication/i);
	assert.ok(!/fluido|fluent|bilingüe|bilingual/i.test(texto));
});

test('la frase de lo que busca coincide con la que dice la página técnica', () => {
	const pagina = readFileSync(join(RAIZ, 'src', 'pages', 'tecnico.astro'), 'utf8');
	assert.match(pagina, /abierto a otros países/);
	assert.match(texto, /abierto a otros países/);
});

test('es determinista: dos corridas dan el mismo texto y la misma huella', () => {
	const otra = construirIndice({ raiz: RAIZ });
	assert.equal(otra.texto, texto);
	assert.equal(otra.huella, indice.huella);
});

test('cabe en el presupuesto: caracteres / 3 ≤ 24.000 tokens estimados', () => {
	assert.equal(ESTIMADO_MAXIMO_TOKENS, 24_000);
	assert.ok(estimarTokens(texto) <= ESTIMADO_MAXIMO_TOKENS, `${estimarTokens(texto)} tokens estimados`);
	assert.equal(estimarTokens('abc'.repeat(100)), 100);
});

test('falla el build si el contenido pasa el presupuesto', () => {
	const copia = mkdtempSync(join(tmpdir(), 'indice-'));
	try {
		cpSync(join(RAIZ, 'src', 'content'), join(copia, 'src', 'content'), { recursive: true });
		cpSync(join(RAIZ, 'scripts', 'asistente'), join(copia, 'scripts', 'asistente'), { recursive: true });
		const enorme = join(copia, 'src', 'content', 'casos', 'automatizacion-facturas.md');
		writeFileSync(enorme, `${readFileSync(enorme, 'utf8')}\n${'Relleno de prueba. '.repeat(5000)}`);
		assert.throws(() => construirIndice({ raiz: copia }), /presupuesto/i);
	} finally {
		rmSync(copia, { recursive: true, force: true });
	}
});

test('escribirContexto genera un módulo TypeScript con INDICE y CONTEXTO que se puede importar', async () => {
	const destino = mkdtempSync(join(tmpdir(), 'ctx-'));
	try {
		const archivo = join(destino, 'contexto.generado.ts');
		escribirContexto(indice, archivo);
		const m = await import(`file:///${archivo.replace(/\\/g, '/')}`);
		assert.equal(m.CONTEXTO, texto);
		assert.equal(m.INDICE, indice.huella);
	} finally {
		rmSync(destino, { recursive: true, force: true });
	}
});

test('los datos de la lista local de términos se leen del archivo local si existe; nunca se copian al contexto', () => {
	assert.ok(!texto.includes('higiene.local'));
});

// --- La versión en inglés y el trabajo independiente -------------------------------------------------------------------------

test('la versión en inglés: el contexto la declara, con las rutas bajo /en/, el CV en inglés y lo que ese sitio dice de idiomas y estudios', () => {
	assert.doesNotMatch(texto, /páginas del sitio están en español/);
	assert.match(texto, /versión en inglés/i);
	for (const ruta of ['/en/#tecnico', '/en/#contacto', '/en/casos/']) assert.ok(texto.includes(ruta), ruta);
	assert.ok(texto.includes(cvEn.tecnico.archivo), 'falta el CV técnico en inglés');
	assert.ok(texto.includes(cvEn.logistica.archivo), 'falta el CV de logística en inglés');
	const en = textosSitio('en');
	assert.ok(texto.includes(en.idiomas), 'faltan los idiomas que declara la versión en inglés');
	assert.ok(texto.includes(en.estudiosActuales), 'faltan los estudios como los dice la versión en inglés');
});

test('el contexto sigue siendo una sola fuente en español: no duplica los casos en inglés (cada pedido paga el contexto)', () => {
	const casosEn = readdirSync(join(RAIZ, 'src', 'content-en', 'casos')).filter((f) => f.endsWith('.md'));
	assert.ok(casosEn.length >= 5);
	for (const f of casosEn) {
		const { titulo } = leerFrontmatter(readFileSync(join(RAIZ, 'src', 'content-en', 'casos', f), 'utf8')).datos;
		assert.ok(!texto.includes(titulo), `entró el título en inglés ${titulo}`);
	}
});

test('trabajo independiente: las referencias anónimas van en un solo bloque, sin nombres ni direcciones', () => {
	assert.equal((texto.match(/<trabajo_independiente /g) ?? []).length, 1);
	const bloque = texto.match(/<trabajo_independiente id="referencias"[\s\S]*?<\/trabajo_independiente>/)?.[0] ?? '';
	assert.match(bloque, /4 entregados y 1 en curso/);
	assert.doesNotMatch(bloque, /https?:|@|\d{6}/);
});

test('trabajo independiente: sin permiso de un cliente no entra nada; con permiso entra con el título genérico', () => {
	const conPermiso = { id: 'taller-prueba', rubro: 'Taller mecánico', titulo: 'Sitio para un taller mecánico', queSeHizo: 'Sitio para mostrar los trabajos.', stack: ['Astro'], permisoCliente: true };
	const sinPermiso = { ...conPermiso, id: 'otro-prueba', titulo: 'Sitio sin permiso', permisoCliente: false };
	const r = construirIndice({ raiz: RAIZ, trabajos: [conPermiso, sinPermiso] }).texto;
	assert.match(r, /<trabajo_independiente id="taller-prueba" url="\/tecnico\/">/);
	assert.ok(r.includes('Sitio para un taller mecánico'));
	assert.ok(!r.includes('Sitio sin permiso'));
	assert.throws(() => construirIndice({ raiz: RAIZ, trabajos: [{ ...conPermiso, stack: [] }] }), /incompleto/);
});
