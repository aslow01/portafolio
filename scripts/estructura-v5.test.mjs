// La estructura del sitio v5 en dist/ (el build): fichas y páginas de la portada, las diez páginas de /tecnico/, el
// molde de los casos, la 404, enlaces y hashes que llevan a algo que existe, ids únicos, borradores, sitemap y noindex.
// Mira el HTML generado, sin navegador. Se saltea si no hay dist/ (`npm run build`); `npm run prepublicar` lo exige.
// Las redirecciones, las bajas de la v5 y el conjunto exacto de páginas: scripts/redirecciones-v5.test.mjs.
// Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cv } from '../src/lib/datos-pendientes.ts';
import { fichas } from '../src/v5/datos.ts';
import { CASOS_PUBLICADOS, cargarContenido, cargarDist, conDist, exigirDist, hayDist } from './dist.mjs';
import { enlacesRotos, fichasDe, idsRepetidos, lomosDe, paginaDe, problemasDeReferencias, textoVisible } from './sitio-html.mjs';

const ORIGEN = 'https://matiasormeno.com.ar';
// La imagen para compartir de las páginas que no son un caso (la de un caso es `caso-<id>`).
const IMAGEN_DE_PAGINA = { '/': 'portada', '/tecnico/': 'tecnico', '/casos/': 'casos' };
// Las ocho del caso, y al final las dos piezas propias: Método y Laboratorio.
const PAGINAS_TECNICO = ['tapa', 'el-caso', 'como-trabajo', 'que-hice-yo', 'como-se-verifico', 'circuito', 'prueba-centavo', 'prueba-dia', 'metodo', 'laboratorio'];
const HREFS_LOMOS_DE_SALIDA = ['/', '/#logistica', '/tecnico/', '/#demos', '/#proyectos', '/#contacto'];

const dist = hayDist ? cargarDist() : undefined;
const contenido = hayDist ? cargarContenido() : [];
const rutasDeCasos = () => [...dist.paginas.keys()].filter((r) => /^\/casos\/[^/]+\/$/.test(r));
// La carpeta de un caso es su primer camino declarado, `caminos[0]` (como carpetaDe en caso.ts).
const casoPublicado = (ruta) => contenido.find((e) => e.coleccion === 'casos' && !e.borrador && `/casos/${e.slug}/` === ruta);
// (`datos.caminos` llega como el texto del encabezado: «[tecnico, logistica]»)
const enTecnico = (ruta) => /^\[\s*tecnico/.test(casoPublicado(ruta)?.datos.caminos ?? '');
// La obra principal de Técnico: el caso publicado de ese camino con `destacado` (el de menor `orden`) (contenido.ts, obraPrincipal).
const obraDeTecnico = () =>
	contenido
		.filter((e) => e.coleccion === 'casos' && !e.borrador && e.datos.caminos.includes('tecnico') && String(e.datos.destacado) === 'true')
		.sort((a, b) => Number(a.datos.orden) - Number(b.datos.orden))[0]?.slug;
const sinNoindex = (p) => !/noindex/i.test(p.meta.robots ?? '');
const clasesDe = (e) => (e.attrs.class ?? '').split(/\s+/).filter(Boolean);
// Los casos publicados, en el orden de `orden` (el del cajón de /casos/ y el de su numeración).
const publicadosPorOrden = () =>
	contenido
		.filter((e) => e.coleccion === 'casos' && !e.borrador)
		.sort((a, b) => Number(a.datos.orden) - Number(b.datos.orden));

test('dist existe cuando se exige (prepublicar)', () => {
	if (exigirDist) assert.ok(hayDist, 'dist/ no existe: corra `npm run build` antes');
});

test('la portada tiene las cinco fichas, en orden, y cada una abre con su tapa y tiene al menos dos páginas con título', conDist, () => {
	const delSitio = fichasDe(dist.paginas.get('/').html);
	assert.deepEqual(delSitio.map((f) => f.id), fichas.map((f) => f.id));
	for (const f of delSitio) {
		assert.ok(f.paginas.length >= 2, `${f.id}: tiene ${f.paginas.length} página(s)`);
		assert.equal(f.paginas[0].tapa, true, `${f.id}: la primera página no es la tapa`);
		assert.deepEqual(f.paginas.slice(1).filter((p) => p.tapa), [], `${f.id}: hay una tapa que no es la primera`);
		for (const p of f.paginas) assert.ok(p.titulo?.trim(), `${f.id}: una página sin data-titulo (el paginador no tendría qué decir)`);
		const titulos = f.paginas.map((p) => p.titulo);
		assert.deepEqual(idsRepetidos(titulos), [], `${f.id}: títulos de página repetidos`);
	}
});

test('/tecnico/ es la ficha 02 abierta, con sus diez páginas, cada una con su id y en este orden', conDist, () => {
	const html = dist.paginas.get('/tecnico/').html;
	const delSitio = fichasDe(html);
	assert.deepEqual(delSitio.map((f) => f.id), ['tecnico']);
	assert.deepEqual(delSitio[0].paginas.map((p) => p.id), PAGINAS_TECNICO);
	assert.equal(delSitio[0].paginas[0].tapa, true);
});

test('cada página de caso es una ficha fija «caso» con tapa primero, páginas con id y un h1', conDist, () => {
	const rutas = rutasDeCasos();
	assert.ok(rutas.length > 0, 'no hay ninguna página de caso');
	for (const ruta of rutas) {
		const p = dist.paginas.get(ruta);
		const delCaso = fichasDe(p.html);
		assert.deepEqual(delCaso.map((f) => f.id), ['caso'], ruta);
		const paginas = delCaso[0].paginas;
		assert.ok(paginas.length >= 4, `${ruta}: solo ${paginas.length} páginas`);
		assert.equal(paginas[0].tapa, true, ruta);
		assert.equal(paginas[0].id, 'tapa', ruta);
		for (const pg of paginas) assert.ok(pg.id && pg.titulo, `${ruta}: una página sin id o sin título`);
		assert.equal(p.ids.filter((id) => id === 't-h1').length, 1, `${ruta}: debe haber un solo h1 (#t-h1)`);
	}
});

test('/casos/ es el cajón: un solo h1, sin ficha, un expediente por caso publicado y en el orden de `orden`', conDist, () => {
	const p = dist.paginas.get('/casos/');
	assert.ok(p, 'no existe /casos/ (índice de casos)');
	assert.deepEqual(fichasDe(p.html), [], '/casos/ no es una ficha: es una composición propia');
	assert.equal(p.ids.filter((id) => id === 't-casos').length, 1, 'debe haber un solo h1 (#t-casos), destino del salto');
	const esperados = publicadosPorOrden().map((e) => `/casos/${e.slug}/`);
	// Los enlaces de los expedientes: `a` de un `li.exp`; los de los lomos no son de casos.
	const enlaces = p.enlaces.filter((e) => /^\/casos\/[^/]+\/$/.test(e.href));
	assert.deepEqual(enlaces.map((e) => e.href), esperados, 'un enlace por caso publicado, en orden, sin repetir');
	const lista = p.etiquetas.find((e) => e.nombre === 'ol' && clasesDe(e).includes('cajon'));
	assert.ok(lista, 'sin la lista <ol class="cajon">');
	assert.equal(clasesDe(lista).includes('muchos'), esperados.length >= 7, '«muchos» es 7 u 8 expedientes');
	assert.equal(p.etiquetas.filter((e) => e.nombre === 'li' && clasesDe(e).includes('exp')).length, esperados.length, 'un li.exp por caso');
	assert.ok(esperados.length >= 2 && esperados.length <= 8, `el cajón admite de 2 a 8 casos y hay ${esperados.length}`);
});

test('/casos/: cada expediente sale con la cortina del color de su carpeta y el principal es la banda clara', conDist, () => {
	const p = dist.paginas.get('/casos/');
	const principal = obraDeTecnico();
	const salidas = p.etiquetas.filter((e) => e.nombre === 'a' && /^\/casos\/[^/]+\/$/.test(e.attrs.href ?? ''));
	for (const a of salidas) {
		const slug = a.attrs.href.split('/')[2];
		assert.ok('data-salir' in a.attrs, `${slug}: el enlace no sale con la cortina (data-salir)`);
		const color = enTecnico(a.attrs.href) ? 'var(--azurita)' : 'var(--cobre)';
		assert.equal(a.attrs['data-color'], color, `${slug}: la cortina es del color de la carpeta a la que se va`);
	}
	const bandas = p.etiquetas.filter((e) => e.nombre === 'li' && clasesDe(e).includes('exp'));
	bandas.forEach((li, i) => {
		const slug = salidas[i].attrs.href.split('/')[2];
		assert.equal(clasesDe(li).includes('c-cobre'), !enTecnico(`/casos/${slug}/`), `${slug}: la banda cobre es la de un caso de la carpeta Logística`);
		assert.equal(clasesDe(li).includes('principal'), slug === principal, `${slug}: la banda clara es la de la obra principal`);
	});
	// Cada título aparece en el texto de la página (el nombre accesible del enlace empieza por él).
	const texto = textoVisible(p.html);
	for (const e of publicadosPorOrden()) assert.ok(texto.includes(String(e.datos.titulo)), `${e.slug}: el título no está en /casos/`);
});

test('todo caso publicado recibe al menos un enlace desde /casos/, y /casos/ se alcanza desde las tres puertas', conDist, () => {
	const desdeElIndice = new Set(dist.paginas.get('/casos/').enlaces.map((e) => e.href));
	for (const slug of CASOS_PUBLICADOS) assert.ok(desdeElIndice.has(`/casos/${slug}/`), `casos/${slug}: sin enlace entrante desde /casos/`);
	const enlazan = (pagina) => pagina?.enlaces.some((e) => e.href === '/casos/') === true;
	// La tapa de /tecnico/, la p. 4 de Logística y «Más casos» de cada caso (las tres puertas).
	assert.ok(enlazan(paginaDe(dist.paginas.get('/tecnico/').html, { id: 'tapa' })), '/tecnico/, tapa: sin enlace a /casos/');
	assert.ok(enlazan(paginaDe(dist.paginas.get('/').html, { titulo: 'De dónde vengo' })), '/#logistica, De dónde vengo: sin enlace a /casos/');
	for (const ruta of rutasDeCasos()) assert.ok(enlazan(paginaDe(dist.paginas.get(ruta).html, { id: 'mas-casos' })), `${ruta}: «Más casos» sin la fila hacia /casos/`);
});

test('la tapa de /tecnico/ ya no lista títulos de casos sueltos: CV, «Casos de estudio» y correo, en ese orden de foco', conDist, () => {
	for (const [ruta, p] of dist.paginas) {
		assert.ok(!p.etiquetas.some((e) => clasesDe(e).includes('otros-casos')), `${ruta}: sigue la lista «Otros casos de estudio»`);
	}
	const tapa = paginaDe(dist.paginas.get('/tecnico/').html, { id: 'tapa' });
	assert.ok(!tapa.enlaces.some((e) => /^\/casos\/[^/]+\/$/.test(e.href)), 'la tapa enlaza a un caso suelto: la puerta es una sola, /casos/');
	const hrefs = tapa.enlaces.map((e) => (e.href.startsWith('mailto:') ? 'mailto' : e.href));
	assert.deepEqual(hrefs, [...(cv.tecnico ? [cv.tecnico.archivo] : []), '/casos/', 'mailto']);
	const puerta = tapa.enlaces.find((e) => e.href === '/casos/');
	assert.ok('data-salir' in puerta.data, 'la puerta sale con la cortina');
	assert.equal(puerta.data['data-n'], String(CASOS_PUBLICADOS.length), 'la solapita cuenta los casos publicados (no un número escrito a mano)');
});

test('Logística, p. 4: «Descargar el CV», WhatsApp y «Casos de estudio», sin el enlace a un caso suelto', conDist, () => {
	const pagina = paginaDe(dist.paginas.get('/').html, { titulo: 'De dónde vengo' });
	assert.ok(!pagina.enlaces.some((e) => /^\/casos\/[^/]+\/$/.test(e.href)), 'enlaza a un caso suelto: la puerta es una sola, /casos/');
	const hrefs = pagina.enlaces.map((e) => e.href);
	assert.equal(hrefs.at(-1), '/casos/', '«Casos de estudio» es el último enlace');
	assert.equal(hrefs.filter((h) => h === '/casos/').length, 1);
	if (cv.logistica) assert.equal(hrefs[0], cv.logistica.archivo, 'el CV va primero');
	assert.equal(pagina.enlaces.at(-1).data['data-n'], String(CASOS_PUBLICADOS.length));
});

test('Logística, p. 5 «Casos y demo»: los dos casos de logística (cortina) y la demo de control de flota, con sus títulos', conDist, () => {
	const pagina = paginaDe(dist.paginas.get('/').html, { titulo: 'Casos y demo' });
	assert.ok(pagina, 'Logística no tiene la página «Casos y demo»');
	const demo = contenido.find((e) => e.coleccion === 'demos' && e.slug === 'control-flota' && !e.borrador);
	const casos = ['cargador-bajas', 'sistema-gestion-operativa'].map((slug) => contenido.find((e) => e.coleccion === 'casos' && e.slug === slug && !e.borrador));
	assert.ok(demo && casos.every(Boolean), 'faltan el caso o la demo publicados que enlaza la página');
	assert.deepEqual(
		pagina.enlaces.map((e) => e.href),
		[...casos.map((c) => `/casos/${c.slug}/`), String(demo.datos.demo)],
	);
	for (const e of pagina.enlaces.slice(0, 2)) assert.ok('data-salir' in e.data, `${e.href}: sale sin cortina`);
});

test('Técnico en la portada: tercera página «Herramientas propias», con dos cartas que llevan a /tecnico/#metodo y #laboratorio', conDist, () => {
	const tecnico = fichasDe(dist.paginas.get('/').html).find((f) => f.id === 'tecnico');
	assert.deepEqual(tecnico.paginas.map((p) => p.titulo), ['Tapa', 'El caso', 'Herramientas propias']);
	const pagina = paginaDe(dist.paginas.get('/').html, { titulo: 'Herramientas propias' });
	const cartas = pagina.etiquetas.filter((e) => e.nombre === 'a' && clasesDe(e).includes('carta-p'));
	assert.deepEqual(cartas.map((a) => a.attrs.href), ['/tecnico/#metodo', '/tecnico/#laboratorio']);
	assert.deepEqual(cartas.map((a) => clasesDe(a).filter((c) => c.startsWith('c-'))), [['c-grafito'], ['c-hueso']], 'el color sale de la clase .c-* de cada carta');
	for (const a of cartas) assert.ok('data-salir' in a.attrs, 'la carta sale con la cortina');
});

test('«La carta de atrás»: cada carta grande de proyecto (Proyectos y /tecnico/) lleva un <details class="tras"> con su solapa y sus filas', conDist, () => {
	// Una página con una carta grande: un `div.carta-grande.con-tras` y un `details.tras` (solapa a un lado) con sus filas.
	const conTras = (donde, pagina, filas = 3) => {
		const t = pagina.etiquetas;
		const detalles = t.filter((e) => e.nombre === 'details' && clasesDe(e).includes('tras'));
		assert.equal(detalles.length, 1, `${donde}: falta la carta de atrás`);
		assert.ok(clasesDe(detalles[0]).some((c) => c === 'izq' || c === 'der'), `${donde}: la solapa va a la izquierda o a la derecha`);
		assert.ok(clasesDe(detalles[0]).some((c) => c === 'c-hueso' || c === 'c-grafito'), `${donde}: la carta de atrás lleva su color .c-*`);
		assert.equal(t.filter((e) => e.nombre === 'div' && clasesDe(e).includes('fila-t')).length, filas, `${donde}: filas de autoría`);
		const grande = t.find((e) => e.nombre === 'div' && clasesDe(e).includes('carta-grande'));
		assert.ok(clasesDe(grande).includes('con-tras'), `${donde}: la carta suma la clase con-tras`);
	};
	const portada = dist.paginas.get('/').html;
	for (const titulo of ['Afterfall', 'Novela']) conTras(`/ ${titulo}`, paginaDe(portada, { titulo }));
	for (const id of ['metodo', 'laboratorio']) conTras(`/tecnico/#${id}`, paginaDe(dist.paginas.get('/tecnico/').html, { id }));
	const html = dist.paginas.get('/tecnico/').html;
	assert.equal((html.match(/Quién hizo qué<span class="solo-lector">: /g) ?? []).length, 2, 'la solapa dice «Quién hizo qué: {nombre}»');
});

test('ningún id se repite dentro de una misma página', conDist, () => {
	const problemas = [];
	for (const [ruta, p] of dist.paginas) for (const id of idsRepetidos(p.ids)) problemas.push(`${ruta}: id "${id}" repetido`);
	assert.deepEqual(problemas, []);
});

test('lo que referencia un id (aria-labelledby, aria-describedby, aria-controls, data-para) apunta a uno que existe', conDist, () => {
	const problemas = [];
	for (const [ruta, p] of dist.paginas) for (const m of problemasDeReferencias(p)) problemas.push(`${ruta}: ${m}`);
	assert.deepEqual(problemas, []);
});

test('todo enlace interno (página, archivo o #hash, también a otra página) lleva a algo que existe', conDist, () => {
	const rotos = enlacesRotos(dist.paginas, dist.existe).map((r) => `${r.desde}: ${r.href} (${r.motivo})`);
	assert.deepEqual(rotos, []);
});

test('las páginas de /tecnico/ que se abren con hash existen: cada enlace a /tecnico/#algo del sitio apunta a una de las diez', conDist, () => {
	const aTecnico = [];
	for (const [ruta, p] of dist.paginas) {
		for (const { href } of p.enlaces) {
			const m = href.match(/^\/tecnico\/#(.+)$/);
			if (m) aTecnico.push({ ruta, hash: m[1] });
		}
	}
	assert.ok(aTecnico.length > 0, 'ninguna página enlaza a una página interior de /tecnico/ (el caso lo hace al volver)');
	assert.deepEqual(aTecnico.filter((x) => !PAGINAS_TECNICO.includes(x.hash)), []);
});

test('archivos que pide cada página (imágenes, scripts, hojas, fuentes): rutas absolutas y existentes', conDist, () => {
	const problemas = [];
	for (const [ruta, p] of dist.paginas) {
		for (const r of p.recursos) {
			if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(r)) continue; // otro origen: lo vigila la higiene
			if (!r.startsWith('/')) problemas.push(`${ruta}: "${r}" es relativa (se rompe desde /tecnico/ o un caso)`);
			else if (!dist.archivos.has(r.split(/[?#]/)[0])) problemas.push(`${ruta}: "${r}" no existe en dist/`);
		}
	}
	assert.deepEqual(problemas, []);
});

test('la barra de lomos de las páginas interiores sale a la portada y a cada ficha, y marca de dónde se viene', conDist, () => {
	const interiores = ['/tecnico/', '/casos/', '/404.html', ...rutasDeCasos()];
	for (const ruta of interiores) {
		const l = lomosDe(dist.paginas.get(ruta).html);
		assert.ok(l, `${ruta}: sin barra de lomos`);
		assert.deepEqual(l.enlaces.map((e) => e.href), HREFS_LOMOS_DE_SALIDA, ruta);
		const actuales = l.enlaces.filter((e) => e.data['aria-current']).map((e) => `${e.href}=${e.data['aria-current']}`);
		// De dónde se viene (la carpeta del caso): marca visual en `data-actual`, sin aria-current (no es esta página).
		const deDonde = l.enlaces.filter((e) => e.data['data-actual'] !== undefined).map((e) => e.href);
		if (ruta === '/tecnico/') assert.deepEqual(actuales, ['/tecnico/=page'], ruta);
		else if (ruta === '/404.html') assert.deepEqual([...actuales, ...deDonde], [], 'la 404 no es ninguna sección');
		else if (ruta === '/casos/') assert.deepEqual([...actuales, ...deDonde], [], 'el índice de casos no es ninguna carpeta');
		else if (enTecnico(ruta)) {
			assert.deepEqual(actuales, [], `${ruta}: Técnico no es esta página: no lleva aria-current`);
			assert.deepEqual(deDonde, ['/tecnico/'], `${ruta}: un caso del camino técnico marca Técnico como su carpeta`);
		} else {
			assert.deepEqual(actuales, [], `${ruta}: Logística no es esta página: no lleva aria-current`);
			assert.deepEqual(deDonde, ['/#logistica'], `${ruta}: un caso de la carpeta Logística marca Logística como su carpeta`);
		}
	}
});

test('la barra de lomos de la portada: Inicio y las cinco fichas, cada una con un id que existe en la página', conDist, () => {
	const p = dist.paginas.get('/');
	const l = lomosDe(p.html);
	assert.deepEqual(l.enlaces.map((e) => e.href), ['#inicio', ...fichas.map((f) => `#${f.id}`)]);
});

test('un caso de la carpeta Técnico cierra hacia /tecnico/ (a #el-caso solo la obra principal) y termina con un camino de vuelta', conDist, () => {
	// «El caso» de /tecnico/ muestra la obra principal: volver a esa página desde otro caso mostraría un caso distinto.
	// Un caso de la carpeta Logística (cargador-bajas, sistema-gestion-operativa) vuelve a su ficha de la portada: se prueba en la prueba de al lado.
	const principal = obraDeTecnico();
	for (const ruta of rutasDeCasos().filter((r) => enTecnico(r))) {
		const destino = ruta === `/casos/${principal}/` ? '/tecnico/#el-caso' : '/tecnico/';
		const cerrar = dist.paginas.get(ruta).etiquetas.find((e) => e.nombre === 'a' && e.attrs.class?.split(/\s+/).includes('cerrar'));
		assert.ok(cerrar, `${ruta}: sin «Cerrar»`);
		assert.equal(cerrar.attrs.href, destino, ruta);
		const pie = dist.paginas.get(ruta).enlaces.filter((e) => e.href === destino);
		assert.ok(pie.length >= 2, `${ruta}: debería volver a Técnico desde «Cerrar» y desde el pie, y hay ${pie.length}`);
	}
});

test('un caso de la carpeta Logística (cargador-bajas y sistema-gestion-operativa) cierra hacia su ficha de la portada (/#logistica), desde «Cerrar» y desde el pie', conDist, () => {
	const deLogistica = rutasDeCasos().filter((r) => !enTecnico(r));
	assert.ok(deLogistica.includes('/casos/sistema-gestion-operativa/'), 'sistema-gestion-operativa debe abrir en la carpeta Logística');
	for (const ruta of deLogistica) {
		const cerrar = dist.paginas.get(ruta).etiquetas.find((e) => e.nombre === 'a' && e.attrs.class?.split(/\s+/).includes('cerrar'));
		assert.equal(cerrar?.attrs.href, '/#logistica', ruta);
		assert.ok(dist.paginas.get(ruta).enlaces.filter((e) => e.href === '/#logistica').length >= 2, `${ruta}: sin el camino de vuelta en el pie`);
	}
});

test('la 404: noindex, fuera del sitemap, con la salida a la portada y los lomos visibles de entrada', conDist, () => {
	const p = dist.paginas.get('/404.html');
	assert.match(p.meta.robots ?? '', /noindex/);
	assert.ok(!dist.sitemap.includes('/404.html') && !dist.sitemap.includes('/404/'));
	assert.ok(p.enlaces.some((e) => e.href === '/'), 'sin enlace a la portada');
	const nav = p.etiquetas.find((e) => e.nombre === 'nav' && e.attrs.class?.split(/\s+/).includes('lomos'));
	assert.ok(nav?.attrs.class.split(/\s+/).includes('visible'), 'los lomos de la 404 deben ser visibles sin esperar al script');
	// «Fondo hueso, sin JS»: la página no carga ningún script (los de las pestañas los pide cada página que los usa).
	const scripts = p.etiquetas.filter((e) => e.nombre === 'script').map((e) => e.attrs.src);
	assert.deepEqual(scripts, [], 'la 404 no debe cargar scripts');
});

test('las redirecciones y la 404 no cargan ningún script; la portada, /tecnico/ y los casos sí', conDist, () => {
	for (const ruta of ['/404.html', '/logistica/', '/demos/', '/contacto/', '/proyectos/']) {
		assert.ok(!/<script/i.test(dist.paginas.get(ruta).html), `${ruta} carga un script`);
	}
	for (const ruta of ['/', '/tecnico/', '/casos/', ...rutasDeCasos()]) {
		assert.ok(/<script[^>]+src="\/_astro\//i.test(dist.paginas.get(ruta).html), `${ruta} no carga su script`);
	}
});

test('las páginas que se indexan: canónica propia, descripción, imagen social que existe; ninguna con noindex sin motivo', conDist, () => {
	const problemas = [];
	for (const [ruta, p] of dist.paginas) {
		if (!sinNoindex(p) || ruta === '/404.html') continue;
		if (p.meta.canonica !== ORIGEN + ruta) problemas.push(`${ruta}: la canónica es ${p.meta.canonica} y debería ser ${ORIGEN + ruta}`);
		if (!p.meta.descripcion?.trim()) problemas.push(`${ruta}: sin descripción`);
		const imagen = p.meta.ogImagen ? new URL(p.meta.ogImagen) : undefined;
		if (!imagen || imagen.origin !== ORIGEN || !dist.archivos.has(imagen.pathname)) problemas.push(`${ruta}: og:image no es un archivo de este sitio (${p.meta.ogImagen})`);
		if (!p.meta.ogImagenAlt?.trim()) problemas.push(`${ruta}: la imagen social no tiene texto alternativo`);
		// X lee las etiquetas twitter: iguales a las og: (la imagen y su texto alternativo), y el tipo depende de la página.
		if (p.meta.twitterImagen !== p.meta.ogImagen) problemas.push(`${ruta}: twitter:image (${p.meta.twitterImagen}) no es og:image (${p.meta.ogImagen})`);
		if (p.meta.twitterImagenAlt !== p.meta.ogImagenAlt) problemas.push(`${ruta}: twitter:image:alt no es og:image:alt`);
		const esCaso = /^\/casos\/[^/]+\/$/.test(ruta);
		const tipo = esCaso ? 'article' : 'website';
		if (p.meta.ogTipo !== tipo) problemas.push(`${ruta}: og:type es ${p.meta.ogTipo} y debería ser ${tipo}`);
		// Cada página, con SU imagen: la portada, Técnico, el índice de casos y cada caso (nombre de archivo: clave y huella).
		const clave = esCaso ? `caso-${ruta.split('/')[2]}` : IMAGEN_DE_PAGINA[ruta];
		if (clave && !imagen?.pathname.startsWith(`/og/${clave}-`)) problemas.push(`${ruta}: og:image debería ser /og/${clave}-… y es ${imagen?.pathname}`);
	}
	assert.deepEqual(problemas, []);
});

test('las redirecciones y la 404 también llevan imagen social de este sitio: /logistica/ la suya, las demás la de la portada', conDist, () => {
	const problemas = [];
	const esperada = { '/logistica/': 'logistica', '/demos/': 'portada', '/contacto/': 'portada', '/proyectos/': 'portada', '/404.html': 'portada' };
	for (const [ruta, clave] of Object.entries(esperada)) {
		const p = dist.paginas.get(ruta);
		const imagen = p.meta.ogImagen ? new URL(p.meta.ogImagen) : undefined;
		if (!imagen || imagen.origin !== ORIGEN || !dist.archivos.has(imagen.pathname)) problemas.push(`${ruta}: og:image no es un archivo de este sitio (${p.meta.ogImagen})`);
		else if (!imagen.pathname.startsWith(`/og/${clave}-`)) problemas.push(`${ruta}: og:image debería ser /og/${clave}-… y es ${imagen.pathname}`);
		if (!p.meta.ogImagenAlt?.trim()) problemas.push(`${ruta}: sin texto alternativo de la imagen`);
		if (p.meta.twitterImagen !== p.meta.ogImagen || p.meta.twitterImagenAlt !== p.meta.ogImagenAlt) problemas.push(`${ruta}: las etiquetas twitter: no repiten las og:`);
		if (ruta !== '/404.html' && !p.meta.descripcion?.trim()) problemas.push(`${ruta}: sin descripción`);
	}
	assert.deepEqual(problemas, []);
});

test('el sitemap lista exactamente las páginas que se indexan: cada una existe y cada página sin noindex (salvo la 404) está', conDist, () => {
	assert.ok(dist.sitemap.length > 0, 'el sitemap está vacío');
	assert.deepEqual(idsRepetidos(dist.sitemap), [], 'una URL repetida en el sitemap');
	const faltan = dist.sitemap.filter((r) => !dist.paginas.has(r)).map((r) => `${r}: está en el sitemap y no existe`);
	const conNoindex = dist.sitemap.filter((r) => dist.paginas.has(r) && !sinNoindex(dist.paginas.get(r))).map((r) => `${r}: está en el sitemap y tiene noindex`);
	const sinListar = [...dist.paginas]
		.filter(([ruta, p]) => ruta !== '/404.html' && sinNoindex(p) && !dist.sitemap.includes(ruta))
		.map(([ruta]) => `${ruta}: se indexa y no está en el sitemap`);
	assert.deepEqual([...faltan, ...conNoindex, ...sinListar], []);
});

test('casos publicados: son exactamente los decididos (CASOS_PUBLICADOS) en el contenido, en las páginas y en el sitemap', conDist, () => {
	const publicadosEnContenido = contenido.filter((e) => e.coleccion === 'casos' && !e.borrador).map((c) => c.slug);
	assert.deepEqual(publicadosEnContenido.sort(), [...CASOS_PUBLICADOS].sort(), 'un caso cambió de estado sin tocar CASOS_PUBLICADOS (scripts/dist.mjs)');
	assert.deepEqual(rutasDeCasos().sort(), CASOS_PUBLICADOS.map((s) => `/casos/${s}/`).sort());
	for (const slug of CASOS_PUBLICADOS) assert.ok(dist.sitemap.includes(`/casos/${slug}/`), `casos/${slug}: no está en el sitemap`);
});

test('borradores: ninguno genera página, entra al sitemap ni da nombre a una ruta (haya o no haya en el árbol)', conDist, () => {
	const rutas = [...dist.paginas.keys(), ...dist.archivos];
	const problemas = [];
	for (const e of contenido.filter((x) => x.borrador)) {
		for (const r of [...rutas, ...dist.sitemap]) if (r.split('/').includes(e.slug)) problemas.push(`${e.coleccion}/${e.slug} (borrador): aparece en la ruta ${r}`);
	}
	assert.deepEqual(problemas, []);
});

test('enlaces externos: en la misma pestaña (sin target), con rel="noopener", nunca http plano', conDist, () => {
	const problemas = [];
	for (const [ruta, p] of dist.paginas) {
		for (const e of p.enlaces.filter((x) => /^(?:https?:)?\/\//i.test(x.href))) {
			if (e.target) problemas.push(`${ruta}: ${e.href} abre con target="${e.target}" (la v5 abre en la misma pestaña)`);
			if (!/\bnoopener\b/.test(e.rel ?? '')) problemas.push(`${ruta}: ${e.href} sin rel="noopener"`);
			if (/^http:/i.test(e.href)) problemas.push(`${ruta}: ${e.href} es http, no https`);
		}
	}
	assert.deepEqual(problemas, []);
});

test('CV: con el PDF cargado, todo enlace es absoluto y con `download`; sin PDF, no se dibuja ningún enlace a él', conDist, () => {
	const problemas = [];
	for (const [ruta, p] of dist.paginas) {
		for (const e of p.enlaces.filter((x) => /\.pdf(?:$|[?#])/i.test(x.href) || /^\/?cv\//i.test(x.href))) {
			if (!e.href.startsWith('/cv/')) problemas.push(`${ruta}: ${e.href} no es una ruta absoluta a /cv/`);
			if (!e.descarga) problemas.push(`${ruta}: ${e.href} sin download`);
			const camino = Object.keys(cv).find((c) => e.href.includes(c));
			if (camino && cv[camino] === null) problemas.push(`${ruta}: enlaza al CV ${camino} y no hay PDF cargado (datos-pendientes.ts)`);
		}
	}
	for (const [camino, datos] of Object.entries(cv)) {
		if (datos) assert.ok(dist.archivos.has(datos.archivo), `el CV ${camino} dice ${datos.archivo} y el archivo no está en dist/`);
	}
	assert.deepEqual(problemas, []);
});
