// Las funciones puras con las que se revisa el HTML generado (scripts/sitio-html.mjs), probadas con páginas de juguete.
// Cada prueba tiene su contraparte "rota a propósito": si la función no detectara el defecto, la prueba fallaría.
// Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	analizarPagina,
	enlacesRotos,
	fichasDe,
	idsRepetidos,
	lomosDe,
	paginaDe,
	problemasDeReferencias,
	problemasDeRedireccion,
	rutaDeArchivo,
	textoVisible,
	urlsDeSitemap,
} from './sitio-html.mjs';

const pagina = (cuerpo, cabeza = '') => `<!doctype html><html lang="es"><head><meta charset="utf-8">${cabeza}</head><body>${cuerpo}</body></html>`;

test('rutaDeArchivo: cada archivo de dist/ es una ruta del sitio', () => {
	assert.equal(rutaDeArchivo('index.html'), '/');
	assert.equal(rutaDeArchivo('tecnico/index.html'), '/tecnico/');
	assert.equal(rutaDeArchivo('casos/uno/index.html'), '/casos/uno/');
	assert.equal(rutaDeArchivo('404.html'), '/404.html');
	assert.equal(rutaDeArchivo('cv\\x.pdf'), '/cv/x.pdf', 'con barras de Windows también');
});

test('analizarPagina: ids, enlaces, metas y recursos; ignora comentarios y el interior de script y style', () => {
	const h = pagina(
		`<!-- <a id="comentado" href="/no"> --><section id="a"><a href='/x/#y' rel="noopener" data-salir>Ir</a></section>
		 <script type="module" src="/_astro/a.js">var s = '<a id="dentro" href="/tampoco">';</script>
		 <img src="/img/a.png" srcset="/img/a-1.png 720w, /img/a-2.png 1280w" alt="">`,
		`<meta name="robots" content="noindex"><link rel="canonical" href="https://x.ar/"><meta http-equiv="refresh" content="0; url=/#demos">`,
	);
	const p = analizarPagina(h);
	assert.deepEqual(p.ids, ['a']);
	assert.deepEqual(p.enlaces.map((e) => e.href), ['/x/#y']);
	assert.equal(p.enlaces[0].rel, 'noopener');
	assert.equal(p.meta.robots, 'noindex');
	assert.equal(p.meta.canonica, 'https://x.ar/');
	assert.equal(p.meta.refresh, '0; url=/#demos');
	assert.deepEqual(p.recursos.sort(), ['/_astro/a.js', '/img/a-1.png', '/img/a-2.png', '/img/a.png']);
});

test('fichasDe: agrupa las páginas (article.pagina) bajo su ficha (section.ficha), en orden', () => {
	const h = pagina(`
		<section class="ficha c-cobre p1 f-logistica" id="logistica"><div class="hojas">
			<article class="pagina tapa" data-titulo="Tapa"></article><article class="pagina" data-titulo="Conducción" id="conduccion"></article></div></section>
		<section class="ficha c-azurita f-tecnico" id="tecnico"><article class="pagina tapa" data-titulo="Tapa"></article></section>
		<article class="otra-cosa"></article>`);
	const f = fichasDe(h);
	assert.deepEqual(f.map((x) => x.id), ['logistica', 'tecnico']);
	assert.deepEqual(f[0].paginas, [{ id: undefined, titulo: 'Tapa', tapa: true }, { id: 'conduccion', titulo: 'Conducción', tapa: false }]);
	assert.equal(f[1].paginas.length, 1);
});

test('paginaDe: el análisis de una sola página de ficha (article.pagina), por título o por id', () => {
	const h = pagina(`
		<article class="pagina tapa" data-titulo="Tapa"><a href="/uno/">uno</a></article>
		<article class="pagina" data-titulo="De dónde vengo" id="de-donde"><a href="/casos/">Casos</a><span id="x"></span></article>
		<a href="/afuera/">afuera</a>`);
	assert.deepEqual(paginaDe(h, { titulo: 'De dónde vengo' }).enlaces.map((e) => e.href), ['/casos/']);
	assert.deepEqual(paginaDe(h, { id: 'de-donde' }).ids, ['de-donde', 'x']);
	assert.deepEqual(paginaDe(h, { titulo: 'Tapa' }).enlaces.map((e) => e.href), ['/uno/']);
	assert.equal(paginaDe(h, { titulo: 'No existe' }), undefined);
});

test('lomosDe: solo los enlaces de la barra de lomos, no los de la página', () => {
	const h = pagina('<a href="/fuera">x</a><nav class="lomos visible" aria-label="Secciones"><ol><li><a href="/" data-salir>Inicio</a></li><li><a href="/tecnico/" aria-current="page">T</a></li></ol></nav><a href="/otro">y</a>');
	const l = lomosDe(h);
	assert.deepEqual(l.enlaces.map((e) => e.href), ['/', '/tecnico/']);
	assert.equal(l.enlaces[1].data['aria-current'], 'page');
	assert.equal(lomosDe(pagina('<nav class="pila"><a href="#x">a</a></nav>')), undefined);
});

test('textoVisible: sin etiquetas ni código; lo en línea no corta palabras y lo de bloque sí', () => {
	const t = textoVisible(pagina('<h1>Hola</h1><p>Un <em>dirijo</em> a la&nbsp;IA</p><script>var x = "oculto";</script><style>p{}</style><!-- no --><p>Fin</p>'));
	assert.equal(t, 'Hola Un dirijo a la\u00A0IA Fin');
});

test('idsRepetidos: señala el id que aparece dos veces, y solo ese', () => {
	assert.deepEqual(idsRepetidos(['a', 'b', 'c']), []);
	assert.deepEqual(idsRepetidos(['a', 'b', 'a', 'c', 'a', 'c']), ['a', 'c']);
});

test('problemasDeReferencias: aria-labelledby, aria-controls y data-para deben apuntar a un id que exista', () => {
	const bien = analizarPagina(pagina('<h2 id="t">T</h2><section aria-labelledby="t"></section><button data-para="p1"></button><div id="p1"></div>'));
	assert.deepEqual(problemasDeReferencias(bien), []);
	const mal = analizarPagina(pagina('<section aria-labelledby="t-falta"></section><button data-para="paso-9"></button><p aria-describedby="uno dos" id="uno"></p>'));
	const texto = problemasDeReferencias(mal).join(' | ');
	assert.match(texto, /aria-labelledby.*t-falta/);
	assert.match(texto, /data-para.*paso-9/);
	assert.match(texto, /aria-describedby.*dos/, 'una lista de ids: cada uno cuenta');
	assert.doesNotMatch(texto, /uno/);
});

test('enlacesRotos: un sitio de juguete sano no da ningún roto; con un hash sin id da exactamente ese', () => {
	const portada = (extra) => `<span id="inicio"></span><section id="demos"></section><a href="#inicio">a</a><a href="/#demos">b</a><a href="/tecnico/#el-caso">c</a><a href="/tecnico/">d</a><a href="/cv/a.pdf" download>e</a>${extra}`;
	const sitio = (extra) =>
		new Map([
			['/', analizarPagina(pagina(portada(extra)))],
			['/tecnico/', analizarPagina(pagina('<article id="el-caso"></article><a href="/">f</a><a href="/#demos">g</a>'))],
		]);
	const archivos = new Set(['/cv/a.pdf']);
	const verificar = (paginas) => enlacesRotos(paginas, (ruta) => paginas.has(ruta) || archivos.has(ruta));
	assert.deepEqual(verificar(sitio('')), []);
	assert.deepEqual(verificar(sitio('<a href="/#logistica">h</a>')).map((r) => `${r.desde} -> ${r.href}`), ['/ -> /#logistica']);
});

test('enlacesRotos: detecta página inexistente, archivo faltante, hash sin id y hash en otra página', () => {
	const paginas = new Map([
		['/', analizarPagina(pagina('<section id="demos"></section><a href="/#demos">ok</a><a href="/#nada">hash</a><a href="/no-existe/">pagina</a><a href="/cv/falta.pdf">archivo</a><a href="/tecnico/#otro">hash ajeno</a><a href="#interno">mismo</a><a href="https://externo.ejemplo/x">fuera</a><a href="mailto:a@b.ar">mail</a>'))],
		['/tecnico/', analizarPagina(pagina('<article id="el-caso"></article>'))],
	]);
	const rotos = enlacesRotos(paginas, (ruta) => paginas.has(ruta));
	assert.deepEqual(rotos.map((r) => `${r.desde} -> ${r.href}`).sort(), [
		'/ -> #interno',
		'/ -> /#nada',
		'/ -> /cv/falta.pdf',
		'/ -> /no-existe/',
		'/ -> /tecnico/#otro',
	]);
});

test('enlacesRotos: un enlace relativo se resuelve desde la página que lo tiene', () => {
	const paginas = new Map([
		['/casos/uno/', analizarPagina(pagina('<a href="../../">sube</a><a href="../dos/">hermano</a>'))],
		['/', analizarPagina(pagina(''))],
	]);
	const rotos = enlacesRotos(paginas, (ruta) => paginas.has(ruta));
	assert.deepEqual(rotos.map((r) => r.href), ['../dos/']);
});

test('urlsDeSitemap: rutas de cada <loc>, de uno o varios archivos', () => {
	const xml = '<urlset><url><loc>https://matiasormeno.com.ar/</loc></url><url><loc>https://matiasormeno.com.ar/tecnico/</loc></url></urlset>';
	assert.deepEqual(urlsDeSitemap(xml), ['/', '/tecnico/']);
	assert.deepEqual(urlsDeSitemap(''), []);
});

test('problemasDeRedireccion: meta refresh al destino, noindex, canónica a la portada, un solo enlace y sin scripts', () => {
	const bien = pagina(
		'<main><a href="/#demos">Ir a Demos</a></main>',
		'<meta http-equiv="refresh" content="0; url=/#demos"><meta name="robots" content="noindex"><link rel="canonical" href="https://matiasormeno.com.ar/">',
	);
	assert.deepEqual(problemasDeRedireccion(analizarPagina(bien), '/#demos'), []);

	const casos = {
		'sin refresh': bien.replace(/<meta http-equiv="refresh"[^>]*>/, ''),
		'refresh a otro lado': bien.replace('url=/#demos', 'url=/#contacto'),
		'sin noindex': bien.replace('<meta name="robots" content="noindex">', ''),
		'canónica a sí misma': bien.replace('https://matiasormeno.com.ar/"', 'https://matiasormeno.com.ar/demos/"'),
		'sin enlace': bien.replace('<a href="/#demos">Ir a Demos</a>', ''),
		'enlace a otro lado': bien.replace('<a href="/#demos">', '<a href="/#contacto">'),
		'con script': bien.replace('</main>', '<script src="/_astro/x.js"></script></main>'),
	};
	for (const [nombre, html] of Object.entries(casos)) {
		assert.notDeepEqual(problemasDeRedireccion(analizarPagina(html), '/#demos'), [], nombre);
	}
});
