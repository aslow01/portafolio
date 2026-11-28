// Genera las imágenes para compartir (public/og/<clave>-<huella>.png, 1200 × 630) y src/lib/imagenes-sociales.ts:
//   node scripts/og/generar.mjs
// Dibuja las láminas en español (`portada`, `tecnico`…) y en inglés (`en/portada`…, archivos `en-portada-<huella>.png`).
// Es una herramienta de mano: no forma parte de `npm test` ni del build (ni corre en Cloudflare) y no agrega dependencias.
// Playwright no está en package.json; se usa igual que en scripts/verificar-paginas.mjs (`npm install --no-save playwright`,
// o PLAYWRIGHT_MODULO=<carpeta node_modules con Playwright>; CHROMIUM_RUTA=<ejecutable de Chromium> si no está el de Playwright).
// Qué dibuja: laminas.mjs da la lista y los textos (salen de src/); plantilla.html y og.css son el molde. El nombre de cada
// archivo lleva la huella de su contenido: si algo cambia, el archivo nuevo tiene otro nombre y los rastreadores (LinkedIn,
// WhatsApp) no siguen mostrando la imagen vieja. src/lib/imagenes-sociales.ts lo escribe este script: no se edita a mano.
// Cuándo volver a correrlo: al cambiar el título, el `corte`, los caminos, el `orden` o la cifra de un caso publicado; al
// cambiar el titular, las minas o las fichas; al tocar la plantilla o la hoja. scripts/og.test.mjs falla y lo avisa.
// Si la plantilla pide una lámina que no encaja (un título que no entra), falla con la clave de la lámina.
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { huella, laminas, nombreDeArchivo } from './laminas.mjs';

const aqui = resolve(fileURLToPath(new URL('.', import.meta.url)));
const raiz = resolve(aqui, '..', '..');
const carpeta = join(raiz, 'public', 'og');
const MAX_BYTES = 200 * 1024;

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

/**
 * Llena la plantilla con una lámina (corre dentro de la página, por eso no usa nada de afuera) y aplica las reglas de
 * encaje (título, cifra, expedientes). Todo texto entra con textContent. Devuelve `{ error }` si la lámina no entra.
 */
function dibujar(l) {
	const nodo = (etiqueta, clase, texto) => {
		const e = document.createElement(etiqueta);
		if (clase) e.className = clase;
		if (texto !== undefined) e.textContent = texto;
		return e;
	};
	const caja = (e) => e.getBoundingClientRect();
	document.body.dataset.tipo = l.composicion === 'B' || l.composicion === 'D' ? 'ficha' : l.composicion === 'A' ? 'portada' : 'casos';

	// A · Pila: el nombre, el titular y las cinco bandas.
	if (l.composicion === 'A') {
		const lamina = document.getElementById('portada');
		lamina.querySelector('.nombre').replaceChildren(...l.nombre.map((p) => nodo('span', '', p)));
		lamina.querySelector('.titular').textContent = l.titular;
		const pila = lamina.querySelector('.pila');
		pila.replaceChildren();
		l.bandas.forEach((banda, i) => {
			const li = nodo('li', `b ${banda.color}`);
			li.style.top = `${36 + 118 * i}px`;
			li.style.setProperty('--x', String(i));
			const o = nodo('span', 'o');
			o.append(nodo('b', '', banda.numero));
			li.append(o, nodo('span', 'w', banda.corto));
			if (banda.asoma) {
				const asoma = nodo('span', 'asoma');
				asoma.append(nodo('span', 'cifra', banda.decimal ?? '0,0'), nodo('b', '', '1'));
				li.append(asoma);
			}
			pila.append(li);
		});
		// La palabra de la banda de Técnico no puede pisar lo que asoma.
		for (const li of pila.children) {
			const asoma = li.querySelector('.asoma');
			if (asoma && caja(li.querySelector('.w')).right > caja(asoma).left) return { error: 'la palabra de la banda pisa lo que asoma' };
		}
		return {};
	}

	// C · Cajón: el rótulo, «Casos de estudio» y los expedientes.
	if (l.composicion === 'C') {
		const lamina = document.getElementById('casos');
		lamina.querySelector('.rotulo').textContent = l.rotulo;
		lamina.querySelector('.h .palabra').textContent = l.palabra;
		lamina.querySelector('.h .resto').textContent = l.resto;
		lamina.querySelector('.firma2').textContent = l.firma;
		const cajon = lamina.querySelector('.cajon');
		cajon.replaceChildren();
		const n = l.expedientes.length;
		const paso = (630 - 44) / n;
		l.expedientes.forEach((e, i) => {
			const li = nodo('li', `e ${e.clases}`);
			li.style.top = `${44 + i * paso}px`;
			li.style.setProperty('--x', String(n > 1 ? i / (n - 1) : 0));
			const o = nodo('span', 'o');
			o.append(nodo('b', '', e.numero));
			li.append(o, nodo('span', 't', e.titulo), nodo('span', 'ir', '→'));
			cajon.append(li);
		});
		// El título no puede bajar más allá de `paso − 34 − 4` desde el borde de su banda (si no, lo tapa la solapa siguiente)
		// ni pasar de dos renglones. Se prueba a 27 px; si alguno no entra, a 24 px (todos igual, para que se lea parejo).
		const entra = (tt) => {
			cajon.style.setProperty('--tt', `${tt}px`);
			return [...cajon.querySelectorAll('.t')].every((t) => caja(t).height <= paso - 34 - 4 - 10 + 0.5 && caja(t).height <= 2 * tt * 1.02 + 1);
		};
		const tt = [27, 24].find(entra);
		if (tt === undefined) {
			const malos = [...cajon.querySelectorAll('.t')].filter((t) => caja(t).height > paso - 48 + 0.5).map((t) => t.textContent);
			return { error: `un título no entra en su banda ni a 24 px: ${malos.join(' | ')}` };
		}
		return { tt };
	}

	// B y D · Ficha: cabeza con la solapa y la firma, y el cuerpo con el título.
	const f = document.getElementById('ficha');
	const conCifra = l.composicion === 'D' && l.cifra !== undefined;
	f.className = `lamina ficha ${l.composicion === 'D' ? 'caso' : l.variante} ${conCifra ? 'con-cifra ' : ''}${l.ficha.color}`;
	f.querySelector('.solapa .n').textContent = l.ficha.numero;
	f.querySelector('.solapa .sec').textContent = l.ficha.nombre;
	f.querySelector('.firma').textContent = l.firma;
	const rotulo = f.querySelector('.rotulo');
	rotulo.textContent = l.rotulo ?? '';
	rotulo.hidden = !l.rotulo;
	const linea = f.querySelector('.linea');
	linea.textContent = l.linea ?? '';
	linea.hidden = !l.linea;
	const pie = f.querySelector('.pie');
	f.querySelector('.ctx').textContent = l.contexto ?? '';
	pie.hidden = !l.contexto;
	const titulo = f.querySelector('.titulo');
	f.querySelector('.titulo .palabra').textContent = l.palabra;
	f.querySelector('.titulo .resto').textContent = l.resto;
	f.querySelector('.titulo .resto').hidden = !l.resto;
	const cuerpo = f.querySelector('.cuerpo');

	if (l.composicion === 'B') {
		// «0,0» + «1» en español, «0.0» + «1» en inglés (lo que asoma de Técnico, decorativo).
		const decimal = f.querySelector('.pieza-tec .cifra');
		if (decimal) decimal.textContent = l.decimal ?? '0,0';
		titulo.style.setProperty('--t', `${l.tamano}px`);
		titulo.style.removeProperty('--wdth');
		titulo.style.removeProperty('--ancho');
		if (titulo.scrollWidth > titulo.clientWidth) return { error: 'el título desborda en ancho' };
		if (caja(linea).bottom > caja(cuerpo).bottom - 44) return { error: 'el título y la línea no entran en el cuerpo' };
		return { t: l.tamano };
	}

	// D · Tapa de caso: el título baja de 4 en 4 desde 150 px hasta que mida ≤ 300 px de alto y no desborde (mínimo 84 px).
	titulo.style.setProperty('--wdth', '75%');
	titulo.style.setProperty('--ancho', conCifra ? '640px' : '1072px');
	let t = 150;
	const cabe = () => caja(titulo).height <= 300 && titulo.scrollWidth <= titulo.clientWidth;
	titulo.style.setProperty('--t', `${t}px`);
	while (!cabe() && t > 84) {
		t -= 4;
		titulo.style.setProperty('--t', `${t}px`);
	}
	if (!cabe()) return { error: 'el título no entra ni a 84 px' };
	const medidas = { t };

	if (conCifra) {
		const bloque = f.querySelector('.cifra-caso');
		const cc = bloque.querySelector('.cc');
		const hayAntes = l.cifra.antes.length > 0;
		bloque.querySelector('.a').textContent = l.cifra.antes.join(' → ');
		bloque.querySelector('.a').hidden = !hayAntes;
		bloque.querySelector('.f').hidden = !hayAntes;
		bloque.querySelector('.b2').textContent = l.cifra.ahora;
		bloque.querySelector('.uni').textContent = l.cifra.unidad ?? '';
		bloque.querySelector('.uni').hidden = !l.cifra.unidad;
		bloque.querySelector('.med').textContent = l.cifra.medicion;
		// Si la cifra no entra en 360 px, baja de 8 en 8 hasta 96 px.
		let c = 168;
		bloque.style.setProperty('--cifra', `${c}px`);
		while (cc.scrollWidth > cc.clientWidth && c > 96) {
			c -= 8;
			bloque.style.setProperty('--cifra', `${c}px`);
		}
		if (cc.scrollWidth > cc.clientWidth) return { error: 'la cifra no entra en 360 px ni a 96 px' };
		if (caja(bloque).top < caja(cuerpo).top + 24) return { error: 'el bloque de la cifra y su medición es demasiado alto' };
		if (caja(f.querySelector('.ctx')).right > caja(bloque).left) return { error: 'el pie pisa el bloque de la cifra' };
		medidas.cifra = c;
	}
	if (!pie.hidden && caja(titulo).bottom > caja(pie).top) return { error: 'el título pisa el pie' };
	return medidas;
}

const escapar = (texto) => `'${texto.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

const lista = await laminas();
const plantilla = readFileSync(join(aqui, 'plantilla.html'), 'utf8');
const css = readFileSync(join(aqui, 'og.css'), 'utf8');
const playwright = await cargarPlaywright();
const chromium = playwright.chromium ?? playwright.default.chromium;

mkdirSync(carpeta, { recursive: true });
const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_RUTA || undefined });
const hechas = {};
try {
	const pagina = await navegador.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'light' });
	await pagina.goto(pathToFileURL(join(aqui, 'plantilla.html')).href);
	// La plantilla está vacía: sin texto el navegador no baja las fuentes, así que se piden a mano antes de comprobarlas.
	await pagina.evaluate(() => Promise.all([document.fonts.load("800 100px 'Bricolage Grotesque'"), document.fonts.load("600 22px 'Schibsted Grotesk'")]).then(() => document.fonts.ready));
	const fuentes = await pagina.evaluate(() => ({
		cartel: document.fonts.check("800 100px 'Bricolage Grotesque'"),
		texto: document.fonts.check("600 22px 'Schibsted Grotesk'"),
	}));
	if (!fuentes.cartel || !fuentes.texto) throw new Error('No cargaron las fuentes del sitio (Bricolage Grotesque y Schibsted Grotesk): no se genera nada');

	for (const lamina of lista) {
		const resultado = await pagina.evaluate(dibujar, lamina);
		if (resultado.error) throw new Error(`${lamina.clave}: ${resultado.error}`);
		const archivo = `${nombreDeArchivo(lamina.clave)}-${huella(lamina, plantilla, css)}.png`;
		const ruta = join(carpeta, archivo);
		await pagina.screenshot({ path: ruta, clip: { x: 0, y: 0, width: 1200, height: 630 } });
		const peso = statSync(ruta).size;
		console.log(`${archivo}  ${Math.round(peso / 1024)} KB  ${JSON.stringify(resultado)}`);
		if (peso > MAX_BYTES) throw new Error(`${archivo} pesa ${Math.round(peso / 1024)} KB (máximo 200): revisar qué lo engorda`);
		hechas[lamina.clave] = { archivo: `/og/${archivo}`, alt: lamina.alt };
	}
} finally {
	await navegador.close();
}

// Todo salió bien: se borran los PNG que no son de esta corrida (solo PNG: nada más se toca en public/og/) y se escribe el archivo que lee el sitio.
const vigentes = new Set(Object.values(hechas).map((i) => i.archivo.replace('/og/', '')));
for (const viejo of readdirSync(carpeta).filter((f) => f.endsWith('.png') && !vigentes.has(f))) unlinkSync(join(carpeta, viejo));

const entradas = Object.keys(hechas)
	.sort()
	.map((clave) => `\t${/^[a-z]+$/.test(clave) ? clave : escapar(clave)}: { archivo: ${escapar(hechas[clave].archivo)}, alt: ${escapar(hechas[clave].alt)} },`);
writeFileSync(
	join(raiz, 'src', 'lib', 'imagenes-sociales.ts'),
	[
		'// Generado por scripts/og/generar.mjs: no editar a mano. Para cambiarlo, cambiar el contenido y volver a generar.',
		'export const imagenesSociales = {',
		...entradas,
		'} as const satisfies Record<string, { archivo: string; alt: string }>;',
		'',
	].join('\n'),
);
console.log(`${Object.keys(hechas).length} imágenes en public/og/ y src/lib/imagenes-sociales.ts`);
