// La versión en inglés (/en/): las rutas, el idioma declarado (lang, hreflang, canonical, Open Graph), el selector de
// idioma, que el contenido en inglés sea el mismo contenido (mismos ids, estados, cifras y código de prueba) y que en las
// páginas inglesas no quede español suelto. Lo de dist/ se saltea sin build. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { circuitoLector, circuitoLectorEn } from '../src/lib/circuito.ts';
import { filasAutoria } from '../src/lib/contenido.ts';
import { novela, novelaEn } from '../src/lib/opciones.ts';
import { bajadaProyectos, cantidad, descripcionProyectos, inventarioTecnico, listaConY, rotuloCaso, textoEstadoDemo } from '../src/lib/presentacion.ts';
import { comoTrabajo, textosSitio } from '../src/lib/sitio.ts';
import { duracionAltaMontana, ficha, fichas, fichasDe } from '../src/v5/datos.ts';
import { expedientes } from '../src/v5/interiores/archivo.ts';
import { armarCaso } from '../src/v5/interiores/caso.ts';
import { casosCentavoDe, flujoDeAutoria, frases, leyendaTira, lecturasRelojDe, nombrePaso, rotulosJornadaDe } from '../src/v5/fichas/tecnico-datos.ts';
import { RAIZ, cargarDist, conDist, hayDist } from './dist.mjs';
import { leerFrontmatter, leerPrueba } from './frontmatter.mjs';
import { textoVisible } from './sitio-html.mjs';

const ORIGEN = 'https://matiasormeno.com.ar';
const leer = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');
const sinNbsp = (t) => t.replaceAll(' ', ' ');

// --- El contenido en inglés es el mismo contenido -----------------------------------------------------------------

const archivos = (carpeta) => readdirSync(join(RAIZ, 'src', carpeta)).filter((f) => f.endsWith('.md')).sort();

for (const coleccion of ['casos', 'demos', 'proyectos']) {
	test(`${coleccion}: la carpeta en inglés (src/content-en/) tiene los mismos archivos que la de español`, () => {
		assert.deepEqual(archivos(`content-en/${coleccion}`), archivos(`content/${coleccion}`));
	});
}

// Los campos que no son texto: tienen que ser idénticos en las dos versiones (el estado, el orden, las cifras, las referencias).
// `corte` (cuántas palabras van en el cartel pesado del título) depende de las palabras del título: puede cambiar con la traducción.
const CAMPOS_FIJOS = ['caminos', 'orden', 'estado', 'destacado', 'demo', 'caso', 'tipo', 'camino', 'borrador', 'repo', 'subdominio', 'stack', 'pagina'];

for (const coleccion of ['casos', 'demos', 'proyectos']) {
	test(`${coleccion}: cada entrada en inglés repite los campos que no son texto (estado, orden, caminos, enlaces, referencias)`, () => {
		const problemas = [];
		for (const archivo of archivos(`content/${coleccion}`)) {
			const es = leerFrontmatter(leer('src', 'content', coleccion, archivo)).datos;
			const en = leerFrontmatter(leer('src', 'content-en', coleccion, archivo)).datos;
			for (const campo of CAMPOS_FIJOS) {
				// `pagina` es un nombre corto (texto): solo se compara que exista en los dos o en ninguno.
				if (campo === 'pagina') {
					if ((es.pagina === undefined) !== (en.pagina === undefined)) problemas.push(`${coleccion}/${archivo}: «pagina» está en una versión y en la otra no`);
					continue;
				}
				if (es[campo] !== en[campo]) problemas.push(`${coleccion}/${archivo}: ${campo} es «${es[campo]}» en español y «${en[campo]}» en inglés`);
			}
			// Los mismos campos de texto en las dos versiones: ninguna cifra, regla o fila de autoría de más ni de menos.
			const sinCorte = (o) => Object.keys(o).filter((k) => k !== 'corte').sort();
			assert.deepEqual(sinCorte(en), sinCorte(es), `${coleccion}/${archivo}: los campos del encabezado no son los mismos`);
		}
		assert.deepEqual(problemas, []);
	});
}

test('casos: la misma estructura del cuerpo (secciones y puntos de lista, en el mismo orden) y la misma cifra', () => {
	const problemas = [];
	for (const archivo of archivos('content/casos')) {
		const es = leer('src', 'content', 'casos', archivo);
		const en = leer('src', 'content-en', 'casos', archivo);
		const forma = (t) => t.split(/\r?\n/).filter((l) => /^## |^- |^<!--/.test(l)).map((l) => l.slice(0, 2));
		if (JSON.stringify(forma(es)) !== JSON.stringify(forma(en))) problemas.push(`${archivo}: las secciones y los puntos de lista no coinciden con los del español`);
		const parrafos = (t) => t.split(/\r?\n\r?\n/).length;
		if (parrafos(es) !== parrafos(en)) problemas.push(`${archivo}: no tiene la misma cantidad de párrafos`);
		// La cifra y su unidad: «40 → 300+» no se traduce.
		const cifra = (t) => t.match(/^\s+cifra: "(.*)"$/m)?.[1];
		if (/\d/.test(cifra(es) ?? '') && cifra(es) !== cifra(en)) problemas.push(`${archivo}: la cifra «${cifra(es)}» cambió en inglés («${cifra(en)}»)`);
		// Las cantidades del cuerpo (2.000 → 2,000, 275 de 275…): los mismos números, con el separador de miles del inglés.
		const numeros = (t) => [...t.matchAll(/\d[\d.,]*\d|\d/g)].map((m) => m[0].replace(/[.,]/g, '')).sort();
		if (JSON.stringify(numeros(es.split('---').slice(2).join(''))) !== JSON.stringify(numeros(en.split('---').slice(2).join('')))) problemas.push(`${archivo}: los números del cuerpo no son los del español`);
	}
	assert.deepEqual(problemas, []);
});

test('demos: el código de la prueba es literal (idéntico al español) y las cifras de las capturas no cambian', () => {
	for (const archivo of archivos('content/demos')) {
		const es = leerPrueba(leer('src', 'content', 'demos', archivo));
		const en = leerPrueba(leer('src', 'content-en', 'demos', archivo));
		assert.deepEqual(en.problemas, [], archivo);
		if (!es.prueba) {
			assert.equal(en.prueba, undefined, `${archivo}: la versión en inglés no debería traer prueba`);
			continue;
		}
		assert.equal(en.prueba.codigo, es.prueba.codigo, `${archivo}: el código de la prueba se tradujo o cambió`);
		assert.equal(en.prueba.archivo, es.prueba.archivo);
		assert.equal(en.prueba.desde, es.prueba.desde);
		assert.equal(en.prueba.hasta, es.prueba.hasta);
	}
});

test('el cuerpo y los textos en inglés no dejan español suelto (ni nombres de la empresa)', () => {
	const problemas = [];
	const espanol = /\b(el|la|los|las|una|que|con|para|del|por|nos|está|están|fue|más|sin)\b|[¿¡ñ]|[áéíóú]\w/i;
	for (const coleccion of ['casos', 'demos', 'proyectos']) {
		for (const archivo of archivos(`content-en/${coleccion}`)) {
			const texto = leer('src', 'content-en', coleccion, archivo)
				.split(/\r?\n/)
				// El código de la prueba y los comentarios del YAML están en español a propósito.
				.filter((l) => !/^\s*#/.test(l))
				.join('\n');
			const sinPrueba = texto.replace(/^ {2}codigo: \|[\s\S]*?(?=^ {2}\w)/m, '');
			for (const [i, linea] of sinPrueba.split('\n').entries()) {
				// Las etiquetas de la demo que se dejan en español entre comillas, con su glosa.
				const sinEtiquetas = linea.replace(/“[^”]*”/g, '').replace(/"?(Posición|Requieren)[^"]*"?/g, '');
				if (espanol.test(sinEtiquetas)) problemas.push(`${coleccion}/${archivo}:${i + 1}: ${linea.trim().slice(0, 80)}`);
			}
		}
	}
	assert.deepEqual(problemas, []);
});

// --- Los textos que arma el código ---------------------------------------------------------------------------------

test('las fichas en inglés: mismos ids, números, colores y posiciones; solo cambian los nombres', () => {
	const en = fichasDe('en');
	assert.equal(en.length, fichas.length);
	fichas.forEach((f, i) => {
		const e = en[i];
		assert.deepEqual({ id: e.id, numero: e.numero, color: e.color, posicion: e.posicion }, { id: f.id, numero: f.numero, color: f.color, posicion: f.posicion });
	});
	assert.deepEqual(en.map((f) => f.corto), ['Logistics', 'Software', 'Demos', 'Projects', 'Contact']);
	assert.equal(ficha('tecnico', 'en').nombre, 'Software and AI');
	assert.equal(ficha('tecnico').nombre, 'Técnico e IA', 'el español no cambia');
	assert.equal(fichasDe('es'), fichas);
});

test('listas y cantidades en inglés: «a, b and c» (sin coma antes de and), «two», «a game»', () => {
	assert.equal(listaConY(['Vicuña', 'Veladero', 'Pachón'], 'en'), 'Vicuña, Veladero and Pachón');
	assert.equal(listaConY(['a', 'b'], 'en'), 'a and b');
	assert.equal(listaConY(['a', 'b', 'c']), 'a, b y c', 'el español no cambia');
	assert.equal(cantidad(1, 'a game', 'games', 'en'), 'a game');
	assert.equal(cantidad(3, 'a game', 'games', 'en'), 'three games');
	assert.equal(cantidad(12, 'a game', 'games', 'en'), '12 games');
	assert.equal(descripcionProyectos(['novela', 'juego'], 'en'), 'a novel and a game');
	assert.equal(descripcionProyectos(['novela', 'juego']), 'una novela y un juego');
	assert.equal(bajadaProyectos(['novela', 'juego'], 'en'), 'What I do outside work: a novel and a game that share a world.');
	assert.equal(bajadaProyectos([], 'en'), 'What I do outside work.');
	assert.equal(textoEstadoDemo('en-desarrollo', 'en'), 'in development');
	assert.equal(textoEstadoDemo('en-vivo', 'en'), 'live');
	assert.equal(textoEstadoDemo('en-desarrollo'), 'en desarrollo');
	assert.equal(rotuloCaso(['logistica', 'tecnico'], 'en'), 'Case · Logistics · Software and AI');
	assert.equal(rotuloCaso(['tecnico']), 'Caso · Técnico e IA');
});

test('inventarioTecnico en inglés: el «live» va antes del sustantivo y «in development» después', () => {
	assert.equal(inventarioTecnico(5, ['en-vivo', 'en-vivo', 'en-vivo'], 'en'), 'five anonymized case studies and three live demos, with fictitious data');
	assert.equal(inventarioTecnico(1, ['en-vivo'], 'en'), 'one anonymized case study and one live demo, with fictitious data');
	assert.equal(inventarioTecnico(2, ['en-desarrollo', 'en-desarrollo'], 'en'), 'two anonymized case studies and two demos in development, with fictitious data');
	assert.equal(inventarioTecnico(2, [], 'en'), 'two anonymized real cases');
	assert.equal(inventarioTecnico(1, ['en-vivo', 'en-desarrollo'], 'en'), 'one anonymized case study, one live demo and one demo in development, with fictitious data');
	assert.equal(inventarioTecnico(5, ['en-vivo', 'en-vivo', 'en-vivo']), 'cinco casos de estudio anonimizados y tres demos en vivo, con datos ficticios', 'el español no cambia');
});

test('la duración en minas: «1 year» / «N months» en inglés, «1 año» / «N meses» en español', () => {
	assert.match(duracionAltaMontana('es'), /^(1 año|\d+ años|\d+ meses)$/);
	assert.match(duracionAltaMontana('en'), /^(1 year|\d+ years|\d+ months)$/);
});

test('«Cómo trabajo» en inglés: tres oraciones, y las dos frases que se resaltan están dentro de la primera', () => {
	const { comoTrabajo: en, enfasisComoTrabajo } = textosSitio('en');
	assert.equal(frases(en).length, 3, 'frases() tiene que seguir partiendo en tres oraciones');
	assert.equal(frases(comoTrabajo).length, 3);
	assert.deepEqual(enfasisComoTrabajo, ['define the rules', 'check that it works']);
	for (const f of enfasisComoTrabajo) assert.ok(frases(en)[0].includes(f), f);
	assert.equal(textosSitio('es').comoTrabajo, comoTrabajo);
});

test('«Cómo trabajo» y «Estudios» en inglés tienen una sola fuente (lib/sitio.ts): ningún otro archivo de src/ los repite', () => {
	const listar = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listar(join(dir, e.name)) : [join(dir, e.name)]));
	const codigo = listar(join(RAIZ, 'src')).filter((r) => /\.(astro|ts)$/.test(r) && !r.endsWith(join('lib', 'sitio.ts')));
	assert.ok(codigo.length > 20, 'la prueba no está mirando el código');
	for (const ruta of codigo) {
		const t = readFileSync(ruta, 'utf8');
		assert.doesNotMatch(t, /I design the systems and develop them with AI/, ruta);
		assert.doesNotMatch(t, /I understand the problem, define the rules/, ruta);
		assert.doesNotMatch(t, /Associate degree in Programming/, ruta);
		assert.doesNotMatch(t, /Spanish: native · English: A2/, ruta);
	}
});

test('los textos fijos del sitio en inglés dicen lo que se busca: desarrollo de software remoto y automatización con IA', () => {
	const en = textosSitio('en');
	assert.equal(en.titular, 'Software development and AI automation');
	assert.match(en.descripcionSitio, /software development and AI automation/);
	assert.match(en.bajadaPortada, /under my direction/, '«dirijo» se aclara: sin «direct» a secas, que se lee como dirigir un equipo');
	assert.equal(en.idiomas, 'Spanish: native · English: A2 (I write with translation tools)');
	assert.equal(textosSitio('es').idiomas, '', 'en español no hay línea de idiomas');
});

test('el circuito en inglés: siete pasos, el 5 con el acercamiento y el 7 de una persona, con el mismo código literal', () => {
	assert.equal(circuitoLectorEn.length, circuitoLector.length);
	circuitoLectorEn.forEach((p, i) => {
		assert.ok(p.titulo.length > 0 && p.texto.length > 0, `paso ${i + 1}`);
		assert.equal(p.acercamiento !== undefined, i === 4, `acercamiento en el paso ${i + 1}`);
		assert.equal(p.persona === true, i === 6, `persona en el paso ${i + 1}`);
	});
	const a = circuitoLectorEn[4].acercamiento;
	assert.equal(sinNbsp(a.factura), '$1,000.00');
	assert.equal(sinNbsp(a.sistema.join('')), '$1,000.01');
	assert.equal(a.factura.slice(0, -1), a.sistema[0], 'solo cambia el último dígito');
	// El acercamiento coincide con lo que dice la prueba publicada, en inglés.
	const queDice = leer('src', 'content-en', 'demos', 'lector-facturas.md').match(/^ {2}queDice: "(.*)"$/m)?.[1];
	assert.ok(queDice?.includes(sinNbsp(a.factura)) && queDice.includes(sinNbsp(a.sistema.join(''))), 'la prueba en inglés no menciona los importes del acercamiento');
});

test('leyendaTira y nombrePaso en inglés', () => {
	assert.equal(
		leyendaTira(circuitoLectorEn, 'en'),
		'One invoice’s path through the demo: seven steps. Step 5 compares the amount to the cent; the last step is decided by a person.',
	);
	assert.equal(nombrePaso(4, circuitoLectorEn[4], 'en'), 'Step 5: compares the amount to the cent');
	assert.match(leyendaTira(circuitoLector), /^El circuito de una factura en la demo: siete pasos/, 'el español no cambia');
});

test('la prueba del centavo y el reloj en inglés: mismas filas, mismas fuentes literales, importes con el formato inglés', () => {
	const es = casosCentavoDe('es');
	const en = casosCentavoDe('en');
	assert.deepEqual(en.map((c) => c.fuente), es.map((c) => c.fuente));
	assert.deepEqual(en.map((c) => c.igual), es.map((c) => c.igual));
	assert.deepEqual(en.map((c) => c.planilla), ['1,000.00', '1,000.00', '0.1 + 0.2', '118,470.50']);
	assert.deepEqual(lecturasRelojDe('en').map((l) => l.fuente), lecturasRelojDe('es').map((l) => l.fuente));
	assert.deepEqual(lecturasRelojDe('en').map((l) => l.texto), ['is still Nov 17.', 'is already Nov 18.']);
	assert.deepEqual(rotulosJornadaDe('en'), { antes: 'By hand', ahora: 'With the tool' });
});

test('flujoDeAutoria en inglés: el párrafo del caso se parte en tres sin cambiar palabras, y el tercer paso (la aprobación) es el que decide', () => {
	const yo = leerFrontmatter(leer('src', 'content-en', 'casos', 'automatizacion-facturas.md')).datos;
	assert.ok(yo, 'sin encabezado');
	const texto = leer('src', 'content-en', 'casos', 'automatizacion-facturas.md').match(/^ {2}yo: "(.*)"$/m)?.[1];
	const flujo = flujoDeAutoria(texto, 'en');
	assert.ok(flujo, 'el párrafo en inglés no tiene la forma «… (a, b and c) …»');
	assert.deepEqual(flujo.pasos, ['Reconciliation', 'Proposal', 'Approval', 'Loading', 'Control']);
	assert.equal(flujo.pasos[2], 'Approval');
	assert.match(flujo.antes, /designed the workflow:$/);
	assert.match(flujo.despues, /^I defined the control rules/);
});

test('la verificación del caso principal en inglés: cinco oraciones (tres controles y dos de nota) y la regla, dos', () => {
	const t = leer('src', 'content-en', 'casos', 'automatizacion-facturas.md');
	const verificacion = t.match(/^ {2}verificacion: "(.*)"$/m)?.[1];
	const regla = t.match(/^regla: "(.*)"$/m)?.[1];
	assert.equal(frases(verificacion).length, 5);
	assert.equal(frases(regla).length, 2);
	assert.match(frases(verificacion)[2], /Nothing is entered without human approval/);
});

test('la novela en inglés tiene los mismos campos que la española y su autoría (sin IA ni verificación)', () => {
	assert.deepEqual(Object.keys(novelaEn).sort(), Object.keys(novela).sort());
	assert.equal(novelaEn.estado, novela.estado);
	assert.equal(novelaEn.orden, novela.orden);
	assert.equal(filasAutoria(novelaEn.autoria, 'en').length, 1);
	assert.deepEqual(filasAutoria(novelaEn.autoria, 'en').map((f) => f.rotulo), ['My part']);
	assert.deepEqual(filasAutoria(novela.autoria).map((f) => f.rotulo), ['Mi parte']);
});

test('armarCaso en inglés: rótulos de la carátula y del cierre en inglés; la sección «Result» se reconoce como el resultado', () => {
	const cuerpo = '## Problem\n\nTexto.\n\n## Result\n\nPrimero. Segundo.';
	const datos = {
		titulo: 'Automating invoice entry',
		resumen: 'r',
		contexto: 'Private security company in San Juan',
		rol: 'Design',
		uso: 'Daily',
		resultado: { cifra: '40 → 300+', unidad: 'invoices per workday', medicion: 'Averages' },
		autoria: { yo: 'a', ia: 'b', verificacion: 'c' },
	};
	const m = armarCaso(datos, cuerpo, { idioma: 'en', totalCasos: 3 });
	assert.deepEqual(m.caratula.map((f) => f.rotulo), ['Context', 'My role', 'Result']);
	const cifra = m.paginas.find((p) => p.tipo === 'cifra');
	assert.ok(cifra, 'la sección «Result» no se reconoció: no hay página de la cifra');
	assert.equal(cifra.encabezado, 'Result');
	assert.equal(m.paginas.find((p) => p.tipo === 'autoria').titulo, 'My part');
	assert.equal(m.paginas.find((p) => p.tipo === 'cierre').titulo, 'How I verified it');
	assert.equal(m.paginas.find((p) => p.tipo === 'mas').todos.texto, 'All case studies');
	// Y el español sigue igual.
	const es = armarCaso({ ...datos }, cuerpo.replace('Problem', 'Problema').replace('Result', 'Resultado'), { totalCasos: 3 });
	assert.deepEqual(es.caratula.map((f) => f.rotulo), ['Dónde', 'Mi rol', 'Resultado']);
	assert.equal(es.paginas.find((p) => p.tipo === 'cierre').titulo, 'Cómo lo verifiqué');
});

test('expedientes en inglés: las direcciones van bajo /en/, los caminos y las notas en inglés', () => {
	const casos = [
		{ id: 'uno', data: { titulo: 'Uno', orden: 1, caminos: ['tecnico', 'logistica'], estado: 'publicado' } },
		{ id: 'dos', data: { titulo: 'Dos', orden: 2, caminos: ['logistica'], estado: 'publicado' } },
	];
	const [a, b] = expedientes(casos, 'uno', true, false, 'en');
	assert.equal(a.href, '/en/casos/uno/');
	assert.equal(b.href, '/en/casos/dos/');
	assert.equal(a.caminos, 'Software · Logistics');
	assert.equal(a.nota, 'With live demo');
	assert.equal(expedientes(casos, 'uno', true, false)[0].href, '/casos/uno/', 'el español no cambia');
});

// --- Lo que se publicó en dist/ ------------------------------------------------------------------------------------

const dist = hayDist ? cargarDist() : undefined;
// Las cuatro puertas (/demos/…) son redirecciones: no se indexan y tienen sus pruebas en redirecciones-v5.test.mjs.
const PUERTAS = ['/logistica/', '/demos/', '/contacto/', '/proyectos/'];
// La 404 (en español y en inglés) no se indexa ni tiene par: tiene su propia prueba más abajo.
const enRutas = () => [...dist.paginas.keys()].filter((r) => r.startsWith('/en/') && r !== '/en/404.html' && !PUERTAS.includes(r.slice(3)));
const esRutas = () => [...dist.paginas.keys()].filter((r) => !r.startsWith('/en/') && r !== '/404.html' && !PUERTAS.includes(r));

test('dist: cada página en español que se indexa tiene su par en /en/, y viceversa', conDist, () => {
	const esperadas = esRutas().map((r) => `/en${r}`).sort();
	assert.deepEqual(enRutas().sort(), esperadas);
	assert.ok(esperadas.length >= 9, 'la prueba dejó de servir: casi no hay páginas');
});

test('dist: la 404 en inglés está en /en/404.html (Cloudflare Pages sirve el 404.html más cercano): en inglés, sin índice, fuera del sitemap y con la salida a /en/', conDist, () => {
	const p = dist.paginas.get('/en/404.html');
	assert.ok(p, 'falta dist/en/404.html: /en/… caería en la 404 en español');
	assert.ok(!dist.paginas.has('/en/404/'), 'quedó dist/en/404/index.html además de /en/404.html');
	assert.match(p.html, /<html lang="en"[ >]/);
	assert.match(p.html, /<meta name="robots" content="noindex"/);
	assert.ok(!dist.sitemap.some((r) => r.includes('404')), 'la 404 no va en el sitemap');
	assert.match(p.html, /Page not found/);
	assert.match(p.html, /<a class="boton" href="[/]en[/]"/, 'el botón no lleva a /en/');
	assert.doesNotMatch(p.html, /No se encontró|Ir a la portada/, 'quedó texto en español');
	assert.match(dist.paginas.get('/404.html').html, /No se encontró la página/, 'la 404 de la raíz sigue en español');
});

test('dist: <html lang> dice el idioma de la página (es-AR en español, en en /en/)', conDist, () => {
	for (const ruta of enRutas()) assert.match(dist.paginas.get(ruta).html, /<html lang="en"[ >]/, `${ruta}: no dice lang="en"`);
	for (const ruta of esRutas()) assert.match(dist.paginas.get(ruta).html, /<html lang="es-AR"[ >]/, `${ruta}: no dice lang="es-AR"`);
});

test('dist: cada página indexable declara sus alternativas (hreflang es-AR, en y x-default), con la canónica propia y simétricas', conDist, () => {
	const problemas = [];
	for (const ruta of [...esRutas(), ...enRutas()]) {
		const html = dist.paginas.get(ruta).html;
		const alt = Object.fromEntries([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]));
		const esRuta = ruta.startsWith('/en/') ? ruta.slice(3) : ruta;
		const esperado = { 'es-AR': `${ORIGEN}${esRuta}`, en: `${ORIGEN}/en${esRuta}`, 'x-default': `${ORIGEN}${esRuta}` };
		if (JSON.stringify(alt) !== JSON.stringify(esperado)) problemas.push(`${ruta}: hreflang ${JSON.stringify(alt)}, esperado ${JSON.stringify(esperado)}`);
		const canonica = dist.paginas.get(ruta).meta.canonica;
		if (canonica !== ORIGEN + ruta) problemas.push(`${ruta}: canónica ${canonica}`);
	}
	assert.deepEqual(problemas, []);
});

test('dist: Open Graph en inglés en /en/ (og:locale en_US, imagen en-…) y en español en el resto', conDist, () => {
	for (const ruta of enRutas()) {
		const p = dist.paginas.get(ruta);
		assert.match(p.html, /<meta property="og:locale" content="en_US"/, ruta);
		assert.match(p.html, /<meta property="og:locale:alternate" content="es_AR"/, ruta);
		assert.match(new URL(p.meta.ogImagen).pathname, /^\/og\/en-/, `${ruta}: la imagen social no es la inglesa`);
		assert.match(p.meta.ogImagenAlt, /^Matías Ariel Ormeño\. /, ruta);
		assert.doesNotMatch(p.meta.ogImagenAlt, /Caso de estudio|Cinco pestañas|Desarrollo de software/, `${ruta}: el alt de la imagen sigue en español`);
		assert.ok(p.meta.descripcion && !/ de | y |ción/.test(p.meta.descripcion.replace(/Matías Ariel Ormeño|San Juan|Argentina/g, '')), `${ruta}: la descripción parece estar en español: ${p.meta.descripcion}`);
	}
	for (const ruta of esRutas()) assert.match(dist.paginas.get(ruta).html, /<meta property="og:locale" content="es_AR"/, ruta);
});

test('dist: el sitemap lista las dos versiones y enlaza cada par con xhtml:link', conDist, () => {
	const xml = readFileSync(join(RAIZ, 'dist', 'sitemap-0.xml'), 'utf8');
	for (const ruta of esRutas()) {
		assert.ok(dist.sitemap.includes(ruta), `${ruta} no está en el sitemap`);
		assert.ok(dist.sitemap.includes(`/en${ruta}`), `/en${ruta} no está en el sitemap`);
		assert.ok(xml.includes(`<xhtml:link rel="alternate" hreflang="en" href="${ORIGEN}/en${ruta}"/>`), `${ruta}: el sitemap no lo enlaza con su versión en inglés`);
	}
	assert.ok(xml.includes('hreflang="es-AR"'));
});

test('dist: el selector de idioma está en el encabezado de cada página y lleva a la misma página en el otro idioma', conDist, () => {
	const problemas = [];
	for (const ruta of [...esRutas(), ...enRutas()]) {
		const html = dist.paginas.get(ruta).html;
		const bloques = [...html.matchAll(/<nav class="idioma"[^>]*>([\s\S]*?)<\/nav>/g)].map((m) => m[1]);
		if (bloques.length === 0) {
			problemas.push(`${ruta}: no tiene selector de idioma`);
			continue;
		}
		const enIngles = ruta.startsWith('/en/');
		const otro = enIngles ? ruta.slice(3) : `/en${ruta}`;
		for (const b of bloques) {
			const enlaces = [...b.matchAll(/<a [^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1]);
			if (JSON.stringify(enlaces) !== JSON.stringify([otro])) problemas.push(`${ruta}: el selector lleva a ${enlaces.join(', ')} y debería llevar a ${otro}`);
			assert.match(b, enIngles ? /<span lang="en" aria-current="true">EN/ : /<span lang="es-AR" aria-current="true">ES/, `${ruta}: el idioma actual no está marcado`);
			assert.match(b, enIngles ? /<a lang="es-AR" hreflang="es-AR"[^>]*aria-label="Español"/ : /<a lang="en" hreflang="en"[^>]*aria-label="English"/, `${ruta}: el enlace al otro idioma no dice su idioma`);
		}
	}
	assert.deepEqual(problemas, []);
});

test('dist: la portada, /tecnico/ y /casos/ muestran el selector una vez por ficha o por encabezado (portada + 5 fichas; /tecnico/, el índice y cada caso: una)', conDist, () => {
	const cuenta = (ruta) => (dist.paginas.get(ruta).html.match(/<nav class="idioma"/g) ?? []).length;
	assert.equal(cuenta('/'), 6);
	assert.equal(cuenta('/en/'), 6);
	for (const ruta of ['/tecnico/', '/casos/', '/en/tecnico/', '/en/casos/']) assert.equal(cuenta(ruta), 1, ruta);
});

test('dist: las páginas en inglés enlazan por dentro solo a /en/…, a los PDF y a los archivos del sitio (nunca a una página en español, salvo el selector)', conDist, () => {
	const problemas = [];
	for (const ruta of enRutas()) {
		const p = dist.paginas.get(ruta);
		const selector = ruta.slice(3);
		for (const e of p.enlaces) {
			const href = e.href;
			if (!href.startsWith('/') || href.startsWith('/en/') || /^\/(cv|og|_astro|fonts|favicon)/.test(href)) continue;
			if (href.split('#')[0] === selector) continue; // el selector de idioma
			problemas.push(`${ruta}: enlaza a ${href}`);
		}
	}
	assert.deepEqual(problemas, []);
});

test('dist: en /en/ los dos CV son PDF en inglés (ninguno avisa «(Spanish)»); el interfaz de las demos sí', conDist, () => {
	const portada = sinNbsp(textoVisible(dist.paginas.get('/en/').html));
	const hrefs = dist.paginas.get('/en/').enlaces.map((e) => e.href);
	assert.ok(hrefs.includes('/cv/matias-ormeno-cv-technical-en.pdf'), 'la portada en inglés no enlaza el CV técnico en inglés');
	assert.ok(!hrefs.includes('/cv/matias-ormeno-cv-tecnico.pdf'), 'la portada en inglés enlaza el CV técnico en español');
	assert.ok(hrefs.includes('/cv/matias-ormeno-cv-logistics-en.pdf'), 'la portada en inglés no enlaza el CV de logística en inglés');
	assert.ok(!hrefs.includes('/cv/matias-ormeno-cv-logistica.pdf'), 'la portada en inglés enlaza el CV de logística en español');
	assert.match(portada, /Download the logistics CV/);
	assert.doesNotMatch(portada, /logistics CV \(Spanish\)/);
	assert.match(portada, /Software and AI CV/);
	assert.doesNotMatch(portada, /Software CV \(Spanish\)|Download CV \(Spanish\)/);
	assert.match(portada, /The demos’ interface is in Spanish\./);
	assert.match(portada, /Spanish: native · English: A2 \(I write with translation tools\)/);
	// En español no aparece nada de eso.
	const es = sinNbsp(textoVisible(dist.paginas.get('/').html));
	assert.doesNotMatch(es, /interface is in Spanish|English: A2|\(Spanish\)/);
});

// Frases típicas del español que no deberían quedar en las páginas inglesas. Se excluyen a propósito: los rótulos de la demo
// entre comillas con su glosa («Mal cargada: otro importe»), el texto de las capturas y los nombres propios.
const ESPANOL = [
	'Descargar', 'Escribir', 'Cerrar', 'Inicio', 'Siguiente', 'Anterior', 'Página', 'Casos de estudio', 'Mi parte', 'Autoría', 'Caso de estudio',
	'Cómo trabajo', 'Cómo se verificó', 'Probar la demo', 'Ver el código', 'Ver el caso', 'Hecho con', 'en vivo', 'en desarrollo', 'Volver', 'Más casos',
	'Logística', 'Técnico', 'Proyectos', 'Contacto', 'Tecnicatura', 'empresa de seguridad', 'Problema', 'Resultado', 'Empresa de', 'Quién hizo qué',
];

test('dist: ninguna página en inglés conserva títulos, botones o rótulos en español (el texto visible y los nombres accesibles)', conDist, () => {
	const problemas = [];
	for (const ruta of enRutas()) {
		const html = dist.paginas.get(ruta).html;
		// Lo que se lee: el texto visible más los nombres accesibles (aria-label, alt y title).
		const accesibles = [...html.matchAll(/\b(?:aria-label|alt|title|data-titulo|data-nombre)="([^"]*)"/g)].map((m) => m[1]).join(' · ');
		const texto = `${textoVisible(html)} · ${accesibles}`;
		for (const frase of ESPANOL) {
			// «Proyectos» y «Contacto» pueden aparecer dentro de nombres propios de las capturas: se busca la palabra suelta.
			if (new RegExp(`(^|[^\\p{L}])${frase}($|[^\\p{L}])`, 'u').test(texto)) problemas.push(`${ruta}: queda «${frase}»`);
		}
	}
	assert.deepEqual(problemas, []);
});

test('dist: la portada y /tecnico/ en inglés dicen qué busca (remoto, desarrollo de software y automatización con IA) y el idioma de los casos', conDist, () => {
	const portada = sinNbsp(textoVisible(dist.paginas.get('/en/').html));
	const tecnico = sinNbsp(textoVisible(dist.paginas.get('/en/tecnico/').html));
	assert.match(portada, /Software development and AI automation/);
	assert.match(portada, /software development and automation · remote/);
	assert.match(tecnico, /Looking for: remote software development · open to international employers/i);
	for (const oracion of textosSitio('en').comoTrabajo.split(/(?<=\.) /)) assert.ok(tecnico.includes(sinNbsp(oracion)), `/en/tecnico/ no tiene: ${oracion.slice(0, 50)}…`);
	assert.ok(tecnico.includes(sinNbsp(textosSitio('en').estudiosActuales)), '/en/tecnico/ no dice los estudios');
});

test('dist: cada caso en inglés trae su título, su resultado y su autoría en inglés', conDist, () => {
	const casos = [...dist.paginas.keys()].filter((r) => /^\/en\/casos\/[^/]+\/$/.test(r));
	assert.ok(casos.length >= 6);
	for (const ruta of casos) {
		const t = textoVisible(dist.paginas.get(ruta).html);
		assert.match(t, /Case study · anonymized/, ruta);
		assert.match(t, /My part/, ruta);
		assert.match(t, /Context/, ruta);
		assert.doesNotMatch(t, /Dónde|Mi rol|Resultado/, ruta);
	}
	const facturas = textoVisible(dist.paginas.get('/en/casos/automatizacion-facturas/').html);
	assert.match(facturas, /40/);
	assert.match(facturas, /300\+/);
	assert.match(facturas, /invoices per workday/);
});

test('Contacto en inglés: la línea de idiomas va en la primera página, bajo la bajada, y no se repite en la segunda', () => {
	const fuente = readFileSync(join(RAIZ, 'src/v5/fichas/Contacto.astro'), 'utf8');
	const iBajada = fuente.indexOf('<p class="texto">{bajada}</p>');
	const iIdiomas = fuente.indexOf('<p class="texto idiomas">{idiomas}</p>');
	const iCanales = fuente.indexOf('<ul class="canales');
	assert.ok(iBajada > 0 && iIdiomas > iBajada && iIdiomas < iCanales, 'los idiomas van entre la bajada y los canales');
	assert.equal(fuente.split('{idiomas}').length - 1, 1, 'la línea sale una sola vez');
});

test('Logística: el pie de la foto de Pachón dice «curso Hombre Nuevo» y la ficha ya no lleva «350 cc»', () => {
	const fuente = readFileSync(join(RAIZ, 'src/v5/fichas/Logistica.astro'), 'utf8');
	assert.match(fuente, /Pachón \(curso Hombre Nuevo\)\. Foto propia/);
	assert.match(fuente, /Pachón \(Hombre Nuevo course\)\. My own photo/);
	assert.doesNotMatch(fuente, /Pachón: Hombre Nuevo|350 cc/);
});
