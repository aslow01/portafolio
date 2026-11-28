// Higiene del sitio: nada de la empresa empleadora, datos personales ni estilos o scripts en línea, ni en el
// código (src/, public/, scripts/) ni en lo publicado (dist/). Node puro: npm test
//
// - src/, public/ y scripts/ se revisan siempre.
// - dist/ se revisa si existe; con EXIGIR_DIST=1 (lo pone `npm run prepublicar`) su ausencia es un error.
// - La excepción del teléfono es la de src/lib/datos-pendientes.ts (el número público de contacto).
// El nombre de la empresa y sus dominios están en scripts/higiene.local.json (no versionado); ver higiene.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { datosPrivados, problemasDeDist, problemasDeSrc, telefonosEn } from './higiene.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const EXTENSIONES = /\.(?:html|css|js|mjs|ts|astro|md|json|txt|xml|svg|webmanifest)$/i;
const leer = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');

/** Archivos de texto de una carpeta, de forma recursiva (sin node_modules ni .astro). */
function archivos(carpeta) {
	const base = join(RAIZ, carpeta);
	if (!existsSync(base)) return [];
	const salida = [];
	const recorrer = (dir) => {
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			const ruta = join(dir, e.name);
			if (e.isDirectory()) {
				if (e.name !== 'node_modules' && e.name !== '.astro') recorrer(ruta);
			} else if (EXTENSIONES.test(e.name) || e.name === '_headers') {
				salida.push(ruta);
			}
		}
	};
	recorrer(base);
	return salida;
}

const rel = (ruta) => relative(RAIZ, ruta).split(sep).join('/');

// Teléfono público autorizado: el de datos-pendientes.ts, solo dígitos.
const telefonoPermitido = (leer('src', 'lib', 'datos-pendientes.ts').match(/tel:\s*'(\+?\d+)'/)?.[1] ?? '').replace(/\D/g, '');

// Palabras extra opcionales (archivo no versionado).
const rutaLocal = join(RAIZ, 'scripts', 'higiene.local.json');
const extra = existsSync(rutaLocal) ? JSON.parse(readFileSync(rutaLocal, 'utf8')) : {};

// --- Las funciones de detección (con datos de mentira) ---------------------------------------------------------

test('el archivo local con las palabras prohibidas existe cuando se exige (prepublicar)', () => {
	if (process.env.EXIGIR_DIST === '1') {
		assert.ok(existsSync(rutaLocal), 'falta scripts/higiene.local.json con el nombre de la empresa y sus dominios');
		assert.ok((extra.palabras ?? []).length > 0, 'scripts/higiene.local.json no tiene palabras');
	}
});

test('higiene.mjs no guarda palabras prohibidas ni sus hashes', () => {
	assert.doesNotMatch(leer('scripts', 'higiene.mjs'), /[0-9a-f]{64}/);
});

test('teléfonos: detecta los formatos argentinos y deja pasar solo el público', () => {
	const permitido = '5492641110000';
	assert.deepEqual(telefonosEn('Llamar al +54 9 264 111-0000', permitido), []);
	assert.deepEqual(telefonosEn('tel:+5492641110000', permitido), []);
	assert.deepEqual(telefonosEn('https://wa.me/5492641110000', permitido), []);
	assert.deepEqual(telefonosEn('+54\u00A09\u00A0264\u00A0111-0000', permitido), []);
	assert.equal(telefonosEn('+54 9 11 5555-1234', permitido).length, 1);
	assert.equal(telefonosEn('0264 15 555 1234', permitido).length, 1);
	assert.equal(telefonosEn('tel:+5491155551234', permitido).length >= 1, true);
	assert.equal(telefonosEn('wa.me/5491155551234', permitido).length >= 1, true);
	assert.deepEqual(telefonosEn('Pedido 2026-11-18, 1.234,56 y 20.000 comprobantes', permitido), []);
});

test('datos privados: @gmail y CUIT o CUIL, con o sin guiones', () => {
	assert.deepEqual(datosPrivados('Un texto limpio'), []);
	assert.equal(datosPrivados('alguien@gmail.com').length, 1);
	assert.equal(datosPrivados('CUIT 30-12345678-9').length, 1);
	assert.equal(datosPrivados('CUIL 20123456789').length, 1);
	assert.deepEqual(datosPrivados('la sigla CUIT es genérica'), []);
});

test('datos privados: lo que diga el archivo local se busca tal cual o como expresión', () => {
	const extra = { palabras: ['dominio-ejemplo.com', 'zorzal'], expresiones: ['cliente[-_ ]?uno'] };
	assert.equal(datosPrivados('visite Dominio-Ejemplo.com', { extra }).length, 1);
	assert.equal(datosPrivados('zórzalseguridad.com.ar', { extra }).length, 1);
	assert.doesNotMatch(datosPrivados('zorzal', { extra }).join(' '), /zorzal/);
	assert.equal(datosPrivados('el Cliente_Uno pidió', { extra }).length, 1);
	assert.deepEqual(datosPrivados('nada', { extra }), []);
});

test('dist: detecta estilos y scripts en línea, otros orígenes y data:', () => {
	assert.deepEqual(problemasDeDist('a.html', '<p class="x">hola</p><link rel="stylesheet" href="/_astro/a.css">'), []);
	assert.equal(problemasDeDist('a.html', '<p style="color:red">').length, 1);
	assert.equal(problemasDeDist('a.html', '<style>p{}</style>').length, 1);
	assert.equal(problemasDeDist('a.html', '<button onclick="x()">').length, 1);
	assert.equal(problemasDeDist('a.html', '<img src="https://otro.example/a.png">').length, 1);
	assert.equal(problemasDeDist('a.html', '<link rel="preload" href="https://otro.example/f.woff2">').length, 1);
	assert.deepEqual(problemasDeDist('a.html', '<a href="https://wa.me/x" rel="noopener">y</a><link rel="canonical" href="https://matiasormeno.com.ar/">'), []);
	assert.equal(problemasDeDist('a.css', 'a{background:url(data:image/png;base64,AAA)}').length, 1);
});

test('dist: un <script> solo se acepta si es externo y del mismo origen, sin contenido en línea', () => {
	const aceptados = [
		'<script src="/_astro/pestanas.abc.js"></script>',
		'<script type="module" src="/_astro/pestanas.abc.js"></script>',
		'<script src="/_astro/p.js" type="module" defer></script>',
		"<script type='module' src='/_astro/p.js'></script>",
		'<script src=/_astro/p.js></script>',
		'<SCRIPT TYPE="module" SRC="/_astro/p.js"></SCRIPT>',
		'<script src="_astro/p.js">  \n </script>',
		'<script\n\ttype="module"\n\tsrc="/_astro/p.js"\n></script>',
	];
	for (const html of aceptados) assert.deepEqual(problemasDeDist('a.html', html), [], html);
	const rechazados = [
		'<script>alert(1)</script>',
		'<script type="module">import "/a.js"</script>',
		'<script></script>',
		'<script src="/a.js">alert(1)</script>',
		'<SCRIPT SRC="/a.js">x</SCRIPT>',
		'<script src="https://otro.example/a.js"></script>',
		"<script src='//otro.example/a.js'></script>",
		'<script src=https://otro.example/a.js></script>',
		'<script src="data:text/javascript,alert(1)"></script>',
		'<script src="javascript:alert(1)"></script>',
		'<script src=""></script>',
		'<script type="module" src="//otro.example/a.js"></script>',
		'<p>ok</p><script src="/a.js"></script><script>x()</script>',
	];
	for (const html of rechazados) assert.ok(problemasDeDist('a.html', html).length > 0, html);
	assert.ok(problemasDeDist('a.html', '<a href="javascript:alert(1)">x</a>').length > 0);
	assert.ok(problemasDeDist('a.html', "<a href='JavaScript:alert(1)'>x</a>").length > 0);
	assert.deepEqual(problemasDeDist('a.html', '<p>el <scripts> no es un script</p>'), []);
});

test('src: las reglas de seguridad de la especificación: HTML con datos, eval, almacenamiento, target="_blank" y «próximamente»', () => {
	const prohibidos = [
		'el.innerHTML = datos;',
		'el.outerHTML = x',
		'el.insertAdjacentHTML("beforeend", x)',
		'document.write(x)',
		'eval(codigo)',
		'const f = new Function("a", "return a")',
		'localStorage.setItem("a", "b")',
		'sessionStorage.getItem("a")',
		'<a href="https://x.example" target="_blank">x</a>',
		'<p>Próximamente</p>',
		'<p>PRÓXIMAMENTE: más casos</p>',
		'<p>proximamente</p>',
	];
	for (const texto of prohibidos) assert.ok(problemasDeSrc('x.ts', texto).length > 0, texto);
	// No son falsos positivos: nombres que solo contienen la palabra, o un uso permitido.
	for (const texto of [
		'const retrieval = 1; // evaluar(x)',
		'el.textContent = datos;',
		'<a href="https://x.example" rel="noopener">x</a>',
		'const form = new FormData(f);',
		'history.replaceState(null, "", "#a")',
	]) {
		assert.deepEqual(problemasDeSrc('x.ts', texto), [], texto);
	}
});

test('el beacon de Cloudflare Web Analytics es la única excepción a «sin scripts de otro origen»', () => {
	const beacon = '<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="{&quot;token&quot;: &quot;40d169325dab43f0a702d3a7352bc826&quot;}"></script>';
	assert.deepEqual(problemasDeDist('index.html', `<head>${beacon}</head>`), []);
	assert.deepEqual(problemasDeSrc('x.astro', '<script is:inline defer src="https://static.cloudflareinsights.com/beacon.min.js"></script>'), []);
	// Otro origen, otro archivo del mismo origen o contenido en línea siguen prohibidos.
	assert.ok(problemasDeDist('index.html', '<script defer src="https://static.cloudflareinsights.com/otro.js"></script>').length > 0);
	assert.ok(problemasDeDist('index.html', '<script src="https://example.com/beacon.min.js"></script>').length > 0);
	assert.ok(problemasDeDist('index.html', '<script defer src="https://static.cloudflareinsights.com/beacon.min.js">alert(1)</script>').length > 0);
	assert.equal(problemasDeSrc('x.astro', '<script is:inline>').length, 1);
});

test('src: solo quedan las reglas de la CSP; las visuales de la v4 ya no se comprueban', () => {
	assert.deepEqual(problemasDeSrc('x.css', 'a { border-radius: 12px; letter-spacing: 0.08em; }'), []);
	assert.equal(problemasDeSrc('x.astro', '<p style="x">').length, 1);
	assert.equal(problemasDeSrc('x.astro', '<script is:inline>').length, 1);
	assert.equal(problemasDeSrc('x.astro', '<style define:vars={{ a }}>').length, 1);
	assert.equal(problemasDeSrc('x.css', '@import url(https://fonts.googleapis.com/css2);').length, 1);
	for (const css of [
		'a { border-radius: 4px; }',
		'a { box-shadow: 0 0 1px; }',
		'a { letter-spacing: 0.05em; }',
		'a { text-transform: uppercase; }',
		'a { background: linear-gradient(red, blue); }',
		'a { color: var(--c-texto); }',
		'.otra {\n  color: var(--c-senal);\n}',
	]) {
		assert.deepEqual(problemasDeSrc('x.css', css), [], css);
	}
});
// --- El repositorio de verdad ---------------------------------------------------------------------------------

test('src, public, scripts y README: nada de la empresa, @gmail, CUIT ni teléfonos ajenos', () => {
	const rutas = [...archivos('src'), ...archivos('public'), ...archivos('scripts'), join(RAIZ, 'README.md')].filter(existsSync);
	const problemas = [];
	for (const ruta of rutas) {
		// El archivo local y los de la propia higiene (llevan datos de mentira) no se revisan.
		if (ruta === rutaLocal || /higiene(?:\.test)?\.mjs$/.test(ruta)) continue;
		for (const h of datosPrivados(readFileSync(ruta, 'utf8'), { telefonoPermitido, extra })) problemas.push(`${rel(ruta)}: ${h}`);
	}
	assert.deepEqual(problemas, []);
});

test('src: las búsquedas de seguridad y de CSP dan cero', () => {
	const problemas = [];
	for (const ruta of archivos('src').filter((r) => /\.(?:astro|css|ts)$/.test(r))) {
		for (const h of problemasDeSrc(rel(ruta), readFileSync(ruta, 'utf8'))) problemas.push(`${rel(ruta)}: ${h}`);
	}
	assert.deepEqual(problemas, []);
});

const hayDist = existsSync(join(RAIZ, 'dist'));
const exigirDist = process.env.EXIGIR_DIST === '1';

test('dist existe cuando se exige (prepublicar)', () => {
	if (exigirDist) assert.ok(hayDist, 'dist/ no existe: corra `npm run build` antes');
});

test('dist: sin estilos ni scripts en línea, ni otros orígenes, ni datos privados', { skip: !hayDist && 'no hay dist/' }, () => {
	const problemas = [];
	for (const ruta of archivos('dist')) {
		const texto = readFileSync(ruta, 'utf8');
		for (const h of problemasDeDist(rel(ruta), texto)) problemas.push(`${rel(ruta)}: ${h}`);
		for (const h of datosPrivados(texto, { telefonoPermitido, extra })) problemas.push(`${rel(ruta)}: ${h}`);
	}
	assert.deepEqual(problemas, []);
});

test('dist: toda página con noindex queda fuera del sitemap', { skip: !hayDist && 'no hay dist/' }, () => {
	const sitemaps = archivos('dist')
		.filter((r) => /sitemap-\d+\.xml$/.test(r))
		.map((r) => readFileSync(r, 'utf8'))
		.join('\n');
	const enSitemap = [...sitemaps.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
	assert.ok(enSitemap.length > 0, 'el sitemap no tiene páginas');
	const sobran = [];
	for (const ruta of archivos('dist').filter((r) => r.endsWith('.html'))) {
		if (!/<meta name="robots" content="noindex"/.test(readFileSync(ruta, 'utf8'))) continue;
		const url = '/' + rel(ruta).replace(/^dist\//, '').replace(/(?:^|\/)index\.html$/, '').replace(/\.html$/, '');
		const normal = url.endsWith('/') || url === '/' ? url : `${url}/`;
		if (enSitemap.includes(normal)) sobran.push(normal);
	}
	assert.deepEqual(sobran, []);
});
