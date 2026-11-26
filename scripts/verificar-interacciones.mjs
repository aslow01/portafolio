// Verificación de interacciones de la web v5: npm run verificar:interacciones  (después de `npm run build`).
// Sirve dist/ con un servidor propio y comprueba en Chromium (Playwright) lo que solo se ve con un navegador real y que
// `npm test` no alcanza: el foco, el historial y los clics sobre el fondo de una hoja. Es una prueba de navegador: NO forma
// parte de `npm test` ni agrega dependencias. Playwright se encuentra igual que en verificar-paginas.mjs (ver su encabezado:
// PLAYWRIGHT_MODULO y CHROMIUM_RUTA). PUERTO=<n> cambia el puerto (por defecto 4614).
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
		if (!base) throw new Error('No se encontró Playwright. Ver el encabezado de verificar-paginas.mjs.');
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
await new Promise((ok) => servidor.listen(Number(process.env.PUERTO ?? 4614), '127.0.0.1', ok));
const origen = `http://127.0.0.1:${servidor.address().port}`;

const navegador = await chromium.launch(process.env.CHROMIUM_RUTA ? { executablePath: process.env.CHROMIUM_RUTA } : {});
const resultados = [];
const errores = [];

/** Corre un escenario en una página nueva. Si falla o lanza, queda anotado; los demás siguen. */
async function escenario(nombre, opciones, fn) {
	const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, ...opciones });
	const pagina = await contexto.newPage();
	pagina.on('pageerror', (e) => errores.push(`${nombre}: ${e.message}`));
	try {
		await fn(pagina);
		resultados.push({ nombre, ok: true });
	} catch (e) {
		resultados.push({ nombre, ok: false, motivo: e instanceof Error ? e.message.split('\n')[0] : String(e) });
	} finally {
		await contexto.close();
	}
}
const exigir = (condicion, mensaje) => {
	if (!condicion) throw new Error(mensaje);
};
const foco = (p) => p.evaluate(() => (document.activeElement ? `${document.activeElement.tagName}${document.activeElement.id ? '#' + document.activeElement.id : ''}.${document.activeElement.className}` : 'ninguno'));
const posicion = (p) => p.locator('.ficha.abierta .pag-pos').first().textContent();

const MOVIMIENTOS = [
	['con movimiento', { reducedMotion: 'no-preference' }],
	['con movimiento reducido', { reducedMotion: 'reduce' }],
];

try {
	for (const [como, opciones] of MOVIMIENTOS) {
		// QA M1: un doble clic en «Ver la prueba completa» no abre y cierra la hoja (el segundo clic cae sobre el fondo).
		await escenario(`M1 doble clic en «Ver la prueba completa» deja la hoja abierta (${como})`, opciones, async (p) => {
			await p.goto(`${origen}/tecnico/#prueba-centavo`);
			await p.locator('.ver-codigo').first().dblclick();
			await p.waitForTimeout(1200);
			exigir(await p.evaluate(() => !!document.querySelector('dialog.hoja[open]')), 'la hoja quedó cerrada');
		});

		// Lo mismo en la hoja de autoría de la ficha Demos.
		await escenario(`M1 doble clic en «Ver mi parte y la autoría» deja la hoja abierta (${como})`, opciones, async (p) => {
			await p.goto(`${origen}/#demos`);
			await p.waitForTimeout(600);
			await p.locator('.ficha.abierta .pag-sig').click();
			await p.waitForTimeout(900);
			await p.locator('.ficha.abierta .ver-codigo:visible').first().dblclick();
			await p.waitForTimeout(1200);
			exigir(await p.evaluate(() => !!document.querySelector('dialog.hoja[open]')), 'la hoja quedó cerrada');
		});

		// QA A1: la hoja abierta muestra su código (la barra con el nombre del archivo no ocupa toda la pantalla).
		await escenario(`A1 la barra con el nombre del archivo de la hoja de código es una barra (${como})`, opciones, async (p) => {
			await p.goto(`${origen}/tecnico/#prueba-centavo`);
			await p.locator('.ver-codigo').first().click();
			await p.waitForTimeout(900);
			const alto = await p.evaluate(() => Math.round(document.querySelector('dialog.hoja[open] p.archivo')?.getBoundingClientRect().height ?? -1));
			exigir(alto > 0 && alto < 80, `la barra mide ${alto} px de alto`);
			const codigo = await p.evaluate(() => Math.round(document.querySelector('dialog.hoja[open] pre')?.getBoundingClientRect().height ?? -1));
			exigir(codigo > 100, `el código mide ${codigo} px de alto`);
		});

		// M1 (el clic afuera sigue cerrando): un clic sobre el fondo, pasado el primer instante, cierra la hoja.
		await escenario(`M1 un clic sobre el fondo, pasado el primer instante, cierra la hoja (${como})`, opciones, async (p) => {
			await p.goto(`${origen}/tecnico/#prueba-centavo`);
			await p.locator('.ver-codigo').first().click();
			await p.waitForTimeout(1000);
			await p.mouse.click(195, 8);
			await p.waitForTimeout(1000);
			exigir(await p.evaluate(() => !document.querySelector('dialog.hoja[open]')), 'la hoja no se cerró con un clic afuera');
		});

		// A3: al cerrar la hoja de una página abierta con `#`, el foco vuelve al botón que la abrió.
		for (const [cierre, accion] of [
			['Escape', (p) => p.keyboard.press('Escape')],
			['«Cerrar»', (p) => p.locator('dialog.hoja[open] .cerrar-hoja').click()],
		]) {
			await escenario(`A3 /tecnico/#prueba-centavo: ${cierre} devuelve el foco a «Ver la prueba completa» (${como})`, opciones, async (p) => {
				await p.goto(`${origen}/tecnico/#prueba-centavo`);
				await p.waitForTimeout(400);
				await p.locator('.ver-codigo').first().click();
				await p.waitForTimeout(900);
				await accion(p);
				await p.waitForTimeout(1200);
				const f = await foco(p);
				exigir(f.startsWith('BUTTON') && f.includes('ver-codigo'), `el foco quedó en ${f}`);
			});
		}
	}

	// B1: tras recargar con una ficha abierta, cerrarla y «Atrás», la primera pulsación sale de la portada.
	await escenario('B1 recargar con la ficha abierta, cerrar y «Atrás» no deja una entrada repetida', { reducedMotion: 'reduce' }, async (p) => {
		await p.goto('about:blank');
		await p.goto(`${origen}/`);
		await p.locator('[data-banda="demos"]').click();
		await p.waitForTimeout(600);
		await p.reload();
		await p.waitForTimeout(600);
		exigir(await p.evaluate(() => document.documentElement.classList.contains('con-ficha')), 'la ficha no quedó abierta tras recargar');
		await p.keyboard.press('Escape');
		await p.waitForTimeout(800);
		exigir(await p.evaluate(() => !document.documentElement.classList.contains('con-ficha')), 'Escape no cerró la ficha');
		await p.goBack();
		await p.waitForTimeout(600);
		exigir(p.url() === 'about:blank', `un «Atrás» después de cerrar dejó la dirección en ${p.url()}`);
	});

	// P1: «Atrás» desde un caso vuelve a la página de la ficha desde la que se salió (antes volvía siempre a la primera).
	await escenario('P1 «Atrás» desde un caso vuelve a la página de la ficha de la portada desde la que se salió', { reducedMotion: 'reduce' }, async (p) => {
		await p.goto(`${origen}/`);
		await p.locator('[data-banda="logistica"]').click();
		await p.waitForTimeout(600);
		await p.locator('.ficha.abierta .pag-indice').click();
		await p.locator('.ficha.abierta .pag-lista button', { hasText: 'Casos y demo' }).click();
		await p.waitForTimeout(900);
		const antes = (await posicion(p)).trim();
		exigir(!antes.startsWith('1 /'), `no pasó de la primera página (${antes})`);
		await Promise.all([p.waitForURL(/\/casos\//), p.locator('.ficha.abierta .ver-casos a[data-salir]').first().click()]);
		await p.goBack();
		await p.waitForSelector('.ficha.abierta');
		await p.waitForTimeout(700);
		exigir((await posicion(p)).trim() === antes, `al volver quedó en ${(await posicion(p)).trim()} y se había salido desde ${antes}`);
		const f = await foco(p);
		exigir(!f.startsWith('BODY') && !f.startsWith('ninguno'), `el foco quedó en ${f}`);
	});
	await escenario('P1 «Atrás» desde un caso vuelve a la página de /tecnico/ desde la que se salió', { reducedMotion: 'reduce' }, async (p) => {
		await p.goto(`${origen}/tecnico/`);
		await p.waitForTimeout(500);
		await p.locator('.ficha.abierta .pag-sig').click();
		await p.waitForTimeout(900);
		exigir((await posicion(p)).trim().startsWith('2 /'), `no pasó a la página 2 (${(await posicion(p)).trim()})`);
		await Promise.all([p.waitForURL(/\/casos\//), p.locator('.ficha.abierta #el-caso a[data-salir]').first().click()]);
		await p.goBack();
		await p.waitForSelector('.ficha.abierta');
		await p.waitForTimeout(700);
		exigir((await posicion(p)).trim().startsWith('2 /'), `al volver quedó en ${(await posicion(p)).trim()}`);
	});

	// T1: la tabulación sigue el orden visual: con la ficha Logística abierta, Tab no entra en las páginas que no se ven (antes
	// saltaba 1 → 4 → 5 y arrastraba la ficha de una página a otra); de la última parada de la página se pasa al paginador.
	const paginaDelFoco = (p) =>
		p.evaluate(() => {
			const a = document.activeElement;
			const paginas = [...document.querySelectorAll('.ficha.abierta .pagina')];
			const pg = a ? a.closest('.pagina') : null;
			return pg ? paginas.indexOf(pg) + 1 : 0;
		});
	await escenario('T1 Tab recorre solo la página que se ve de la ficha Logística y sigue al paginador', { reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } }, async (p) => {
		await p.goto(`${origen}/#logistica`);
		await p.waitForTimeout(800);
		let enPaginador = false;
		for (let i = 0; i < 10 && !enPaginador; i++) {
			await p.keyboard.press('Tab');
			const pagina = await paginaDelFoco(p);
			exigir(pagina <= 1, `Tab llevó el foco a la página ${pagina} (la que se ve es la 1)`);
			enPaginador = await p.evaluate(() => !!document.activeElement?.closest('.paginador'));
		}
		exigir(enPaginador, 'Tab no llegó al paginador');
		exigir((await posicion(p)).trim().startsWith('1 /'), `la ficha cambió de página con Tab: ${(await posicion(p)).trim()}`);
	});
	await escenario('T1 Mayús+Tab desde el paginador vuelve a la página que se ve, no a la última', { reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } }, async (p) => {
		await p.goto(`${origen}/#logistica`);
		await p.waitForTimeout(800);
		await p.locator('.ficha.abierta .pag-lista button', { hasText: 'De dónde vengo' }).click();
		await p.waitForTimeout(900);
		const actual = (await posicion(p)).trim();
		await p.locator('.ficha.abierta .pag-ant').focus();
		await p.keyboard.press('Shift+Tab');
		const pagina = await paginaDelFoco(p);
		exigir(pagina === 4, `Mayús+Tab llevó el foco a la página ${pagina} y se veía la 4`);
		exigir((await posicion(p)).trim() === actual, `la ficha cambió de página: de ${actual} a ${(await posicion(p)).trim()}`);
	});

	// B2: las flechas ← → cambian de página con el foco recién cargado (sin haber tocado nada).
	for (const ruta of ['/tecnico/', '/casos/automatizacion-facturas/']) {
		await escenario(`B2 ${ruta}: la flecha derecha pasa de página sin haber enfocado nada`, { reducedMotion: 'reduce' }, async (p) => {
			await p.goto(`${origen}${ruta}`);
			await p.waitForTimeout(500);
			exigir((await foco(p)).startsWith('BODY'), `el foco inicial no está en body: ${await foco(p)}`);
			exigir((await posicion(p)).trim().startsWith('1 /'), 'no empieza en la página 1');
			await p.keyboard.press('ArrowRight');
			await p.waitForTimeout(900);
			exigir((await posicion(p)).trim().startsWith('2 /'), `tras la flecha derecha quedó en ${(await posicion(p)).trim()}`);
			await p.keyboard.press('ArrowLeft');
			await p.waitForTimeout(900);
			exigir((await posicion(p)).trim().startsWith('1 /'), `tras la flecha izquierda quedó en ${(await posicion(p)).trim()}`);
		});
	}

	// F1: el botón del paginador que se apaga (primera o última página) no se lleva el foco a body: pasa al otro botón.
	for (const ruta of ['/tecnico/', '/casos/automatizacion-facturas/']) {
		await escenario(`F1 ${ruta}: al llegar a la primera o a la última página con el teclado, el foco no se pierde en body`, { reducedMotion: 'reduce' }, async (p) => {
			await p.goto(`${origen}${ruta}`);
			await p.waitForTimeout(500);
			await p.locator('.ficha.abierta .pag-sig').focus();
			await p.keyboard.press('Enter');
			await p.waitForTimeout(900);
			exigir((await posicion(p)).trim().startsWith('2 /'), `no pasó a la página 2 (${(await posicion(p)).trim()})`);
			await p.locator('.ficha.abierta .pag-ant').focus();
			await p.keyboard.press('Enter');
			await p.waitForTimeout(900);
			exigir((await posicion(p)).trim().startsWith('1 /'), `no volvió a la página 1 (${(await posicion(p)).trim()})`);
			exigir(await p.locator('.ficha.abierta .pag-ant').isDisabled(), '«Anterior» no quedó apagado en la página 1');
			let f = await foco(p);
			exigir(f.startsWith('BUTTON') && f.includes('pag-sig'), `en la primera página el foco quedó en ${f} (debía pasar a «Siguiente»)`);
			// hasta la última: «Siguiente» se apaga con el foco puesto y el foco pasa a «Anterior»
			for (let n = 0; n < 12 && !(await p.locator('.ficha.abierta .pag-sig').isDisabled()); n++) {
				await p.keyboard.press('Enter');
				await p.waitForTimeout(900);
			}
			exigir(await p.locator('.ficha.abierta .pag-sig').isDisabled(), '«Siguiente» no se apagó en la última página');
			f = await foco(p);
			exigir(f.startsWith('BUTTON') && f.includes('pag-ant'), `en la última página el foco quedó en ${f} (debía pasar a «Anterior»)`);
		});
	}

	// A2: cambiar de ficha por el hash o por el historial deja el foco en el título, no en body.
	await escenario('A2 un cambio de ficha por el hash deja el foco en la ficha', { reducedMotion: 'reduce' }, async (p) => {
		await p.goto(`${origen}/#demos`);
		await p.waitForTimeout(600);
		await p.evaluate(() => {
			location.hash = '#tecnico';
		});
		await p.waitForTimeout(800);
		const f = await foco(p);
		exigir(!f.startsWith('BODY') && !f.startsWith('ninguno'), `el foco quedó en ${f}`);
	});
	await escenario('A2 «Atrás» entre dos fichas deja el foco en la ficha', { reducedMotion: 'reduce' }, async (p) => {
		await p.goto(`${origen}/`);
		await p.locator('[data-banda="demos"]').click();
		await p.waitForTimeout(600);
		await p.evaluate(() => {
			location.hash = '#tecnico';
		});
		await p.waitForTimeout(600);
		await p.goBack();
		await p.waitForTimeout(800);
		const f = await foco(p);
		exigir(!f.startsWith('BODY') && !f.startsWith('ninguno'), `el foco quedó en ${f}`);
	});

	// A4: «Ir a las secciones» deja el foco en algo con indicador (la primera banda), no en un contenedor sin anillo.
	await escenario('A4 «Ir a las secciones» enfoca la primera banda', { reducedMotion: 'reduce' }, async (p) => {
		await p.goto(`${origen}/`);
		await p.keyboard.press('Tab');
		await p.keyboard.press('Enter');
		await p.waitForTimeout(500);
		const f = await p.evaluate(() => {
			const a = document.activeElement;
			return { banda: a?.getAttribute('data-banda') ?? '', visible: a ? a.matches(':focus-visible') : false };
		});
		exigir(f.banda === 'logistica', `el foco quedó en ${await foco(p)}`);
		exigir(f.visible, 'el foco no es visible (:focus-visible)');
	});

	// B3: la portada entra entera en un teléfono de 320 × 568 (si no, «Contacto» queda cortado).
	await escenario('B3 la portada entra en 320 × 568 sin desplazarse', { reducedMotion: 'reduce', viewport: { width: 320, height: 568 } }, async (p) => {
		await p.goto(`${origen}/`);
		await p.waitForTimeout(600);
		const m = await p.evaluate(() => ({ doc: document.documentElement.scrollHeight, alto: innerHeight, contacto: Math.round(document.querySelector('[data-banda="contacto"]').getBoundingClientRect().bottom) }));
		exigir(m.doc <= m.alto + 1, `el documento mide ${m.doc} px y la pantalla ${m.alto}`);
		exigir(m.contacto <= m.alto + 1, `«Contacto» termina en ${m.contacto} px`);
	});

	// B5: en la tapa de Logística, a 320 × 640 y 360 × 640, el paginador no tapa «Esquema, sin escala».
	for (const [ancho, alto] of [[320, 640], [360, 640]]) {
		await escenario(`B5 el paginador no tapa «Esquema, sin escala» en ${ancho} × ${alto}`, { reducedMotion: 'reduce', viewport: { width: ancho, height: alto } }, async (p) => {
			await p.goto(`${origen}/#logistica`);
			await p.waitForTimeout(700);
			const m = await p.evaluate(() => ({
				leyenda: Math.round(document.querySelector('.ficha.abierta figcaption').getBoundingClientRect().bottom),
				paginador: Math.round(document.querySelector('.ficha.abierta .paginador').getBoundingClientRect().top),
			}));
			exigir(m.leyenda <= m.paginador, `la leyenda termina en ${m.leyenda} px y el paginador empieza en ${m.paginador}`);
		});
	}

	// Título: en las páginas interiores el título del documento es el del HTML, también con un hash de ficha.
	for (const [ruta, hash] of [['/tecnico/', '#tecnico'], ['/casos/automatizacion-facturas/', '#caso']]) {
		await escenario(`T el título de ${ruta} no cambia con JavaScript ni con el hash ${hash}`, { reducedMotion: 'reduce' }, async (p) => {
			await p.goto(`${origen}${ruta}`);
			const html = await p.evaluate(() => document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '');
			exigir(html !== '', 'la página no tiene og:title');
			exigir((await p.title()) === html, `con JavaScript el título es «${await p.title()}» y el HTML dice «${html}»`);
			await p.evaluate((h) => {
				history.pushState(null, '', h);
				dispatchEvent(new PopStateEvent('popstate'));
			}, hash);
			await p.waitForTimeout(300);
			exigir((await p.title()) === html, `tras ir a ${hash} el título es «${await p.title()}»`);
		});
	}
} finally {
	await navegador.close();
	servidor.close();
}

let fallos = 0;
for (const r of resultados) {
	if (!r.ok) fallos++;
	console.log(`${r.ok ? 'OK   ' : 'FALLA'} ${r.nombre}${r.ok ? '' : `\n        ${r.motivo}`}`);
}
for (const e of errores) console.log(`ERROR DE PÁGINA ${e}`);
console.log(`\n${resultados.length - fallos} de ${resultados.length} escenarios en verde${errores.length ? `, ${errores.length} errores de página` : ''}.`);
process.exit(fallos || errores.length ? 1 : 0);
