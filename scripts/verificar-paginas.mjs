// Verificación visual automática de la web v5: npm run verificar:paginas  (después de `npm run build`).
// Sirve dist/ con un servidor propio y abre con Chromium (Playwright) la portada con cada una de sus cinco fichas
// abiertas (por el hash, `/#logistica`…), `/tecnico/`, el índice `/casos/`, los casos y la 404, en los tamaños de pantalla que fija
// scripts/criterios-pantalla.mjs. Comprueba, en cada una:
//   · que cada página de la ficha entre en su pantalla (razón alto de contenido ÷ alto visible, con los topes de
//     scripts/criterios-pantalla.mjs); las páginas sin ficha (`/casos/` y la 404) se miden como un solo «(documento)»:
//     `documentElement.scrollHeight / innerHeight`, con los mismos topes;
//   · que la página no desborde en horizontal;
//   · que no haya errores de consola ni imágenes rotas;
//   · que cada captura que enlaza una demo tenga un `alt` que empiece con «Probar la demo» (en /en/: «Try the demo»).
// Era la verificación de las láminas de la v4 (un enlace «Ver la captura en tamaño completo» por lámina, claro y oscuro):
// la v5 no tiene ese enlace ni tema oscuro, y la comprobación equivalente es esta.
// Es una prueba de navegador: NO forma parte de `npm test` (que corre sin navegador) ni agrega dependencias.
//
// Playwright no está en package.json. Opciones para tenerlo:
//   npm install --no-save playwright && npx playwright install chromium
//   o apuntar PLAYWRIGHT_MODULO a una carpeta node_modules que ya lo tenga.
// Variables opcionales: CHROMIUM_RUTA=<chrome.exe> si el Chromium instalado no es el que espera esa versión de Playwright;
// PUERTO=<n> (por defecto 4613); CAPTURAS=<carpeta> guarda una captura por página y tamaño;
// PAGINAS="/,/tecnico/" cambia la lista; TAMANOS="390x844,360x740" cambia los tamaños.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TAMANOS, TAMANOS_CASOS, esPaginaSinFicha, paginasAMedir, paginasAMedirEn, problemaDeRazon, razonDeDocumento, rutasDeCasos } from './criterios-pantalla.mjs';

const raiz = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(raiz, 'dist');
if (!existsSync(dist)) {
	console.error('No hay dist/: corra `npm run build` antes.');
	process.exit(2);
}

async function cargarPlaywright() {
	try {
		return await import('playwright');
	} catch {
		const base = process.env.PLAYWRIGHT_MODULO;
		if (!base) throw new Error('No se encontró Playwright. Ver el encabezado de este archivo.');
		const req = createRequire(join(resolve(base), 'x.js'));
		return await import(pathToFileURL(req.resolve('playwright')).href);
	}
}
const playwright = await cargarPlaywright();
const chromium = playwright.chromium ?? playwright.default.chromium;

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };
const servidor = createServer(async (req, res) => {
	try {
		const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
		let archivo = normalize(join(dist, ruta));
		if (archivo !== dist && !archivo.startsWith(dist + sep)) throw new Error('fuera de dist');
		if (existsSync(archivo) && statSync(archivo).isDirectory()) archivo = join(archivo, 'index.html');
		const datos = await readFile(archivo);
		res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] ?? 'application/octet-stream' });
		res.end(datos);
	} catch {
		res.writeHead(404).end('no encontrado');
	}
});
await new Promise((ok) => servidor.listen(Number(process.env.PUERTO ?? 4613), '127.0.0.1', ok));
const origen = `http://127.0.0.1:${servidor.address().port}`;

// Los casos que haya en dist/ se suman solos: solo las carpetas de dist/casos/ (`index.html` es el índice, no un caso).
const casos = existsSync(join(dist, 'casos')) ? rutasDeCasos(readdirSync(join(dist, 'casos'), { withFileTypes: true })) : [];
// La versión en inglés (dist/en/) se mide igual, con los mismos topes.
const casosEn = existsSync(join(dist, 'en', 'casos')) ? rutasDeCasos(readdirSync(join(dist, 'en', 'casos'), { withFileTypes: true }), '/en') : [];
const paginas = process.env.PAGINAS ? process.env.PAGINAS.split(',') : [...paginasAMedir(casos), ...(existsSync(join(dist, 'en')) ? paginasAMedirEn(casosEn) : [])];
const tamanos = process.env.TAMANOS ? TAMANOS.filter((t) => process.env.TAMANOS.split(',').includes(t.nombre)) : TAMANOS;
// Los tamaños extra de `/casos/` (TAMANOS_CASOS) se miden solo con la lista y los tamaños por defecto.
const pasadas = [...tamanos.map((t) => [t, paginas]), ...(process.env.PAGINAS || process.env.TAMANOS ? [] : TAMANOS_CASOS.map((t) => [t, ['/casos/', ...(existsSync(join(dist, 'en')) ? ['/en/casos/'] : [])]]))];
const carpetaCapturas = process.env.CAPTURAS;
if (carpetaCapturas) await mkdir(carpetaCapturas, { recursive: true });

// En local la baliza de analítica de Cloudflare (static.cloudflareinsights.com y su envío a cloudflareinsights.com/cdn-cgi/rum) no
// puede cargarse ni informar: el navegador lo cuenta como error de consola (CORS o «Failed to load resource») en cada página.
// No es un fallo del sitio. Se descarta solo lo que viene de ese dominio; cualquier otro error sigue fallando.
// Los errores de CORS llegan sin ubicación: se reconocen por la dirección de la baliza entre comillas simples, no por una mención suelta.
const esRuidoDeLaBaliza = (mensaje) => /(^|\.)cloudflareinsights\.com$/.test(new URL(mensaje.location().url || 'about:blank').hostname) || /'https:\/\/(static\.)?cloudflareinsights\.com\//.test(mensaje.text());

const fallos = [];
let paginasMedidas = 0;
const maxima = new Map(); // tamaño → la razón más alta vista (para ver que la medición no es siempre 1,00)
const navegador = await chromium.launch(process.env.CHROMIUM_RUTA ? { executablePath: process.env.CHROMIUM_RUTA } : {});
try {
	for (const [tamano, paginas] of pasadas) {
		const contexto = await navegador.newContext({ viewport: { width: tamano.ancho, height: tamano.alto }, colorScheme: 'light', reducedMotion: 'reduce' });
		for (const pagina of paginas) {
			const p = await contexto.newPage();
			const consola = [];
			p.on('console', (m) => m.type() === 'error' && !esRuidoDeLaBaliza(m) && consola.push(m.text()));
			p.on('pageerror', (e) => consola.push(String(e)));
			const donde = `${pagina} · ${tamano.nombre}`;
			await p.goto(origen + pagina, { waitUntil: 'networkidle' });
			const esFicha = pagina.includes('#');
			const sinFicha = esPaginaSinFicha(pagina);
			if (esFicha) await p.waitForSelector('.ficha.abierta', { timeout: 5000 }).catch(() => fallos.push(`${donde}: la ficha no se abrió con el hash`));
			const informe = await p.evaluate(() => {
				// Las páginas de la ficha abierta (o de la ficha fija de /tecnico/ y de los casos).
				const ficha = document.querySelector('.ficha.abierta') ?? document.querySelector('.ficha.fija');
				const paginasDeLaFicha = ficha ? [...ficha.querySelectorAll('.pagina')] : [];
				const de = document.documentElement;
				return {
					hayFicha: ficha !== null,
					razones: paginasDeLaFicha.map((el) => ({ titulo: el.dataset.titulo ?? '(sin título)', razon: el.clientHeight > 0 ? el.scrollHeight / el.clientHeight : Infinity })),
					documento: { alto: de.scrollHeight, visible: innerHeight },
					desborde: de.scrollWidth - de.clientWidth,
					capturas: [...document.querySelectorAll('a.captura')].map((a) => ({ alt: a.querySelector('img')?.alt ?? '', cargada: (a.querySelector('img')?.naturalWidth ?? 0) > 0 })),
					rotas: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== 'lazy' && i.checkVisibility()).map((i) => i.currentSrc || i.src),
				};
			});
			if (!sinFicha && !informe.hayFicha) fallos.push(`${donde}: no hay ninguna ficha abierta.`);
			// Sin ficha (el índice y la 404) no hay páginas que medir: se mide el documento entero.
			const razones = sinFicha ? [{ titulo: '(documento)', razon: razonDeDocumento(informe.documento.alto, informe.documento.visible) }] : informe.razones;
			for (const r of razones) {
				paginasMedidas++;
				if (!(maxima.get(tamano.nombre) >= r.razon)) maxima.set(tamano.nombre, r.razon);
				const problema = problemaDeRazon(r.razon, tamano);
				if (problema) fallos.push(`${donde}: página «${r.titulo}»: ${problema}.`);
			}
			if (informe.desborde > 0) fallos.push(`${donde}: la página desborda ${informe.desborde} px en horizontal.`);
			for (const c of informe.capturas) {
				if (!/^(Probar la demo|Try the demo)/.test(c.alt)) fallos.push(`${donde}: una captura que enlaza una demo tiene alt "${c.alt}" (debe empezar con «Probar la demo» o, en /en/, «Try the demo»).`);
			}
			for (const r of informe.rotas) fallos.push(`${donde}: imagen que no carga: ${r}`);
			for (const c of consola) fallos.push(`${donde}: error de consola: ${c}`);
			if (carpetaCapturas) await p.screenshot({ path: join(carpetaCapturas, `${pagina.replace(/[/#]/g, '_') || '_'}-${tamano.nombre}.png`) });
			await p.close();
		}
		await contexto.close();
	}
} finally {
	await navegador.close();
	servidor.close();
}

console.log(`Páginas de ficha medidas: ${paginasMedidas} (${paginas.join(', ')}; ${tamanos.map((t) => t.nombre).join(', ')}; y /casos/ en ${pasadas.slice(tamanos.length).map(([t]) => t.nombre).join(', ') || 'ninguno más'}).`);
console.log('Razón más alta por tamaño: ' + [...maxima].map(([n, r]) => `${n} ${r.toFixed(2)}`).join(' · '));
if (paginasMedidas === 0) fallos.push('No se midió ninguna página: la prueba no comprobó nada.');
if (fallos.length > 0) {
	console.error(`\n${fallos.length} problema(s):\n- ${fallos.join('\n- ')}`);
	process.exit(1);
}
console.log('verificar:paginas: en verde.');
