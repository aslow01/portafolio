// Verificación del asistente en un navegador real: npm run verificar:asistente
// Levanta el Worker en modo de prueba (scripts/asistente/servidor-local.mjs, sin claves) y `astro dev` apuntando a él (el widget
// solo se monta en desarrollo o con PUBLIC_ASISTENTE_URL, y un build de producción no puede apuntar a localhost), abre Chromium
// (Playwright) y comprueba lo que `npm test` no alcanza: el ORDEN DE TAB dentro de la hoja del asistente.
//
// Orden esperado (docs-asistente/01-diseno.md, sección 4): campo → «Enviar» → «Cerrar». Es distinto del orden visual, donde
// «Cerrar» está arriba: se eligió así a propósito (WCAG 2.4.3, Orden del foco: el foco entra por el campo, que es lo que el
// visitante viene a usar, y «Cerrar» queda alcanzable con Tab sin dar la vuelta con Mayús+Tab). Si alguien reordena el DOM, esto falla.
//
// Es una prueba de navegador: NO forma parte de `npm test` ni agrega dependencias. Playwright se encuentra igual que en
// verificar-interacciones.mjs (PLAYWRIGHT_MODULO=<carpeta node_modules que lo tenga>, CHROMIUM_RUTA=<chrome.exe> opcional).
// ASISTENTE_DEV_URL=http://localhost:<n> reutiliza un `astro dev` ya abierto (Astro solo permite uno por carpeta) en vez de levantar otro.
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { crearServidorLocal } from './asistente/servidor-local.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function cargarPlaywright() {
	try {
		return await import('playwright');
	} catch {
		const base = process.env.PLAYWRIGHT_MODULO;
		if (!base) throw new Error('No se encontró Playwright. Ver el encabezado de verificar-interacciones.mjs (PLAYWRIGHT_MODULO).');
		const req = createRequire(join(resolve(base), 'x.js'));
		return await import(pathToFileURL(req.resolve('playwright')).href);
	}
}

const puertoLibre = () =>
	new Promise((ok, mal) => {
		const s = createServer();
		s.once('error', mal);
		s.listen(0, '127.0.0.1', () => {
			const { port } = s.address();
			s.close(() => ok(port));
		});
	});

async function esperarA(url, ms) {
	const limite = Date.now() + ms;
	while (Date.now() < limite) {
		try {
			if ((await fetch(url)).ok) return;
		} catch {
			// todavía no escucha
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	throw new Error(`${url} no respondió en ${ms / 1000} s`);
}

const matar = (hijo) => {
	if (!hijo?.pid) return;
	// `shell: true` deja a npx/astro como nietos: en Windows se cierra el árbol entero.
	if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(hijo.pid), '/T', '/F'], { stdio: 'ignore' });
	else hijo.kill();
};

const playwright = await cargarPlaywright();
const chromium = playwright.chromium ?? playwright.default.chromium;

const worker = crearServidorLocal({ puerto: 0 });
const dirWorker = await worker.escuchar();
const urlWorker = `http://localhost:${dirWorker.port}`;

let dev = null;
let urlDev = process.env.ASISTENTE_DEV_URL ?? '';
let navegador = null;
const resultados = [];
const errores = [];

try {
	if (urlDev === '') {
		const puerto = await puertoLibre();
		urlDev = `http://localhost:${puerto}`;
		let salida = '';
		// Comando fijo y puerto numérico: sin datos externos (`shell: true` hace falta para encontrar npx en Windows).
		dev = spawn(`npx astro dev --port ${puerto}`, { cwd: raiz, shell: true, env: { ...process.env, PUBLIC_ASISTENTE_URL: urlWorker } });
		dev.stdout.on('data', (d) => (salida += d));
		dev.stderr.on('data', (d) => (salida += d));
		const cayo = new Promise((_, mal) =>
			dev.on('exit', (c) => mal(new Error(`astro dev terminó (${c}): ${salida.replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').slice(0, 300)} Si ya hay un astro dev abierto, use ASISTENTE_DEV_URL=<su dirección>.`))),
		);
		await Promise.race([esperarA(`${urlDev}/tecnico/`, 90_000), cayo]);
	}

	navegador = await chromium.launch(process.env.CHROMIUM_RUTA ? { executablePath: process.env.CHROMIUM_RUTA } : {});

	const claseDelFoco = (p) => p.evaluate(() => String(document.activeElement?.className ?? 'ninguno'));

	for (const [nombre, viewport] of [
		['escritorio 1440 x 900', { width: 1440, height: 900 }],
		['celular 390 x 844', { width: 390, height: 844 }],
	]) {
		const contexto = await navegador.newContext({ viewport, reducedMotion: 'reduce' });
		const p = await contexto.newPage();
		p.on('pageerror', (e) => errores.push(`${nombre}: ${e.message}`));
		const titulo = `Tab recorre campo → Enviar → Cerrar, y «Cerrar» se ve arriba (${nombre})`;
		try {
			await p.goto(`${urlDev}/tecnico/`);
			const lanzador = p.locator('.consulta-lanzador');
			await lanzador.waitFor({ state: 'visible', timeout: 15_000 });
			await lanzador.click();
			await p.locator('dialog.consulta[open]').waitFor({ timeout: 5000 });
			await p.waitForTimeout(800);

			const recorrido = [await claseDelFoco(p)];
			for (let i = 0; i < 2; i++) {
				await p.keyboard.press('Tab');
				recorrido.push(await claseDelFoco(p));
			}
			const esperado = ['consulta-campo', 'consulta-enviar', 'consulta-cerrar'];
			if (recorrido.join('|') !== esperado.join('|')) throw new Error(`el orden fue ${recorrido.join(' → ')} y debía ser ${esperado.join(' → ')}`);

			// La diferencia con el orden visual es deliberada: si «Cerrar» dejara de estar arriba, habría que revisar la decisión.
			const y = await p.evaluate(() => ({
				cerrar: document.querySelector('dialog.consulta .consulta-cerrar')?.getBoundingClientRect().top ?? -1,
				campo: document.querySelector('dialog.consulta .consulta-campo')?.getBoundingClientRect().top ?? -1,
			}));
			if (!(y.cerrar >= 0 && y.cerrar < y.campo)) throw new Error(`«Cerrar» no está arriba del campo (cerrar ${y.cerrar} px, campo ${y.campo} px)`);

			resultados.push({ nombre: titulo, ok: true });
		} catch (e) {
			resultados.push({ nombre: titulo, ok: false, motivo: e instanceof Error ? e.message.split('\n')[0] : String(e) });
		} finally {
			await contexto.close();
		}
	}
} catch (e) {
	resultados.push({ nombre: 'preparación del entorno', ok: false, motivo: e instanceof Error ? e.message : String(e) });
} finally {
	await navegador?.close();
	matar(dev);
	worker.servidor.close();
	worker.servidor.closeAllConnections?.();
}

let fallos = 0;
for (const r of resultados) {
	if (!r.ok) fallos++;
	console.log(`${r.ok ? 'OK   ' : 'FALLA'} ${r.nombre}${r.ok ? '' : `\n        ${r.motivo}`}`);
}
for (const e of errores) console.log(`ERROR DE PÁGINA ${e}`);
console.log(`\n${resultados.length - fallos} de ${resultados.length} escenarios en verde${errores.length ? `, ${errores.length} errores de página` : ''}.`);
process.exit(fallos || errores.length ? 1 : 0);
