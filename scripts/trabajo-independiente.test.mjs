// «Trabajo independiente» (src/lib/trabajo-independiente.ts y la página 11 de /tecnico/): sin permiso del cliente no se muestra
// nada, la vista previa con datos ficticios solo existe en desarrollo y una entrada con permiso pero incompleta rompe la
// compilación en vez de ocultarse. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	DATO_PERSONAL,
	introIndependiente,
	problemasDeEntrada,
	resumenReferencias,
	trabajosAMostrar,
	trabajosIndependientes,
	trabajosVisibles,
	vistaDe,
	vistaPreviaIndependiente,
} from '../src/lib/trabajo-independiente.ts';
import { cargarDist, conDist } from './dist.mjs';

const completa = (extra = {}) => ({
	id: 'taller-x',
	rubro: 'Taller mecánico',
	titulo: 'Sitio para un taller mecánico',
	queSeHizo: 'Sitio para mostrar los trabajos del taller.',
	stack: ['Astro'],
	permisoCliente: true,
	...extra,
});

test('sin permiso no se muestra nada: ni false, ni ausente, ni un valor «verdadero» que no sea true', () => {
	const sinPermiso = [completa({ permisoCliente: false }), completa({ id: 'a', permisoCliente: undefined }), completa({ id: 'b', permisoCliente: 'true' }), completa({ id: 'c', permisoCliente: 1 })];
	assert.deepEqual(trabajosVisibles(sinPermiso), []);
	assert.deepEqual(trabajosVisibles([]), []);
});

test('con permiso se muestra, y solo esa entrada', () => {
	const v = trabajosVisibles([completa({ id: 'con' }), completa({ id: 'sin', permisoCliente: false })]);
	assert.deepEqual(v.map((e) => e.id), ['con']);
});

test('los datos reales: hay entradas, sin ids repetidos, y todas las que son referencia se muestran', () => {
	assert.ok(trabajosIndependientes.length > 0, 'no hay ninguna entrada');
	const ids = trabajosIndependientes.map((e) => e.id);
	assert.equal(new Set(ids).size, ids.length, 'ids repetidos');
	for (const e of trabajosIndependientes) {
		if (e.tipo === 'referencia') continue;
		assert.equal(typeof e.permisoCliente, 'boolean', `${e.id}: permisoCliente debe ser true o false`);
	}
	assert.doesNotThrow(() => trabajosVisibles(), 'una entrada quedó incompleta');
	const visibles = trabajosVisibles().map((e) => e.id);
	assert.deepEqual(visibles, trabajosIndependientes.filter((e) => e.tipo === 'referencia' || e.permisoCliente === true).map((e) => e.id));
});

test('los títulos son genéricos: sin direcciones web, correos, teléfonos ni números (en español y en inglés)', () => {
	for (const e of trabajosIndependientes) {
		for (const campo of [e.rubro, e.titulo, e.queSeHizo, e.en?.rubro, e.en?.titulo, e.en?.queSeHizo]) {
			if (campo === undefined) continue;
			assert.doesNotMatch(campo, DATO_PERSONAL,`${e.id}: «${campo}» parece traer un dato personal`);
		}
	}
});

test('los textos de las referencias reales, exactos: no prometen nada que no se sepa (sin stack ni año inventados)', () => {
	const por = Object.fromEntries(trabajosIndependientes.map((e) => [e.id, e]));
	assert.deepEqual(trabajosIndependientes.map((e) => e.titulo), [
		'Sitio web para un negocio de venta y logística',
		'Sitio web para un taller mecánico',
		'Sitio web para un taller mecánico',
		'Sitio web para un cliente del rubro de agricultura y riego',
		'Sitio web para un cliente particular',
	]);
	// Nada de «productor» ni «agricultor»: Matías no puede sostener qué hace el cliente más allá del rubro.
	for (const e of trabajosIndependientes) assert.doesNotMatch(JSON.stringify(e), /product|agricultor|farmer|grower/i, `${e.id}: afirma algo del cliente que no se sabe`);
	for (const e of trabajosIndependientes) {
		assert.equal(e.stack, undefined, `${e.id}: no se sabe el stack, no se inventa`);
		assert.equal(e.anio, undefined, `${e.id}: no se sabe el año, no se inventa`);
		assert.ok(e.en, `${e.id}: falta la versión en inglés`);
	}
	assert.match(por['taller-1'].queSeHizo, /muestra de sus trabajos/);
	assert.match(por['taller-2'].queSeHizo, /muestra de sus trabajos/);
	assert.doesNotMatch(por['venta-logistica-1'].queSeHizo, /muestra|cotizaci/i);
});

// ---- Modo «referencia anónima» (decisión de Matías del 28/11/2026: datos personales de los clientes) ----
const referencia = (extra = {}) => ({
	id: 'ref-x',
	tipo: 'referencia',
	rubro: 'Taller mecánico',
	titulo: 'Sitio web para un taller mecánico',
	queSeHizo: 'Sitio web a medida para el cliente.',
	en: { rubro: 'Auto repair shop', titulo: 'Website for an auto repair shop', queSeHizo: 'Custom website for the client.' },
	...extra,
});

test('referencia: se muestra sin permisoCliente (ni con permisoCliente: false), y sin stack ni año', () => {
	assert.deepEqual(trabajosVisibles([referencia()]).map((e) => e.id), ['ref-x']);
	assert.deepEqual(problemasDeEntrada(referencia()), []);
	// Una entrada completa sin permiso sigue oculta, aunque comparta la lista con una referencia.
	assert.deepEqual(trabajosVisibles([referencia(), completa({ id: 'otra', permisoCliente: false })]).map((e) => e.id), ['ref-x']);
	// «tipo» tiene que ser exactamente 'referencia': cualquier otra cosa se trata como entrada completa y exige permiso.
	assert.deepEqual(trabajosVisibles([completa({ id: 'q', tipo: 'Referencia', permisoCliente: false })]), []);
});

test('referencia: PROHÍBE url, captura y capturaAlt (la compilación falla)', () => {
	assert.throws(() => trabajosVisibles([referencia({ url: 'https://sitio.example/' })]), /url/);
	assert.throws(() => trabajosVisibles([referencia({ captura: 'independiente/a.png' })]), /captura/);
	assert.throws(() => trabajosVisibles([referencia({ capturaAlt: 'Portada' })]), /capturaAlt/);
	assert.throws(() => trabajosVisibles([referencia({ url: '', captura: '', capturaAlt: '' })]), /no se permite/, 'ni vacíos');
	assert.match(problemasDeEntrada(referencia({ url: 'https://sitio.example/' })).join(' '), /no se permite/);
});

test('referencia: rechaza cualquier campo que no esté en la lista permitida (nada de datos extra)', () => {
	for (const campo of ['telefono', 'nombre', 'ciudad', 'email', 'permisoCliente', 'cliente']) {
		assert.throws(() => trabajosVisibles([referencia({ [campo]: 'x' })]), new RegExp(campo), campo);
	}
});

test('referencia: los textos no pueden traer direcciones, correos ni números', () => {
	for (const malo of ['Escribir a alguien@sitio.example', 'Mirar www.sitio.example', 'Ver https://sitio.example', 'Llamar al 2645550000', 'taller.com']) {
		assert.throws(() => trabajosVisibles([referencia({ queSeHizo: malo })]), /dato personal/, malo);
		assert.throws(() => trabajosVisibles([referencia({ en: { ...referencia().en, titulo: malo } })]), /dato personal/, `en: ${malo}`);
	}
});

test('referencia: exige la versión en inglés completa, y rubro, título y «qué se hizo»', () => {
	assert.throws(() => trabajosVisibles([referencia({ en: undefined })]), /inglés/);
	assert.throws(() => trabajosVisibles([referencia({ en: { rubro: 'x', titulo: ' ', queSeHizo: 'x' } })]), /inglés/);
	assert.throws(() => trabajosVisibles([referencia({ en: { ...referencia().en, ciudad: 'x' } })]), /inglés/);
	assert.throws(() => trabajosVisibles([referencia({ titulo: '' })]), /título/);
	assert.throws(() => trabajosVisibles([referencia({ queSeHizo: ' ' })]), /qué se hizo/);
	assert.throws(() => trabajosVisibles([referencia({ id: 'Ref X' })]), /id/);
	assert.throws(() => trabajosVisibles([referencia(), referencia()]), /repetido/);
});

test('referencia: stack y año son opcionales; si vienen, se validan', () => {
	assert.deepEqual(problemasDeEntrada(referencia({ stack: ['Astro'], anio: 2026 })), []);
	assert.match(problemasDeEntrada(referencia({ stack: [' '] })).join(' '), /stack/);
	assert.match(problemasDeEntrada(referencia({ anio: 1999 })).join(' '), /año/);
});

test('vistaDe: en cada idioma, solo los campos permitidos; la referencia nunca lleva url ni captura', () => {
	const es = vistaDe(referencia(), 'es');
	assert.deepEqual(es, { id: 'ref-x', referencia: true, rubro: 'Taller mecánico', titulo: 'Sitio web para un taller mecánico', queSeHizo: 'Sitio web a medida para el cliente.', stack: [] });
	const en = vistaDe(referencia(), 'en');
	assert.equal(en.titulo, 'Website for an auto repair shop');
	assert.equal(en.rubro, 'Auto repair shop');
	// Aunque alguien le cuele campos a una referencia por fuera de la validación, la vista no los copia.
	const colada = vistaDe({ ...referencia(), url: 'https://sitio.example/', captura: 'independiente/a.png', capturaAlt: 'x', telefono: '1' }, 'es');
	assert.deepEqual(Object.keys(colada).sort(), ['id', 'queSeHizo', 'referencia', 'rubro', 'stack', 'titulo']);
	// Entrada completa: conserva url y captura; sin traducción cae al español.
	const c = vistaDe(completa({ url: 'https://sitio.example/', captura: 'independiente/a.png', capturaAlt: 'Portada', anio: 2026 }), 'en');
	assert.equal(c.referencia, false);
	assert.equal(c.url, 'https://sitio.example/');
	assert.equal(c.titulo, 'Sitio para un taller mecánico');
	assert.equal(c.anio, 2026);
});

test('introIndependiente: la nota de la sección dice la verdad según lo que se muestra', () => {
	for (const idioma of ['es', 'en']) {
		const privacidad = idioma === 'es' ? /privacidad de los clientes/i : /privacy/i;
		const soloRef = introIndependiente([referencia()], idioma);
		assert.doesNotMatch(soloRef, /autorización de cada cliente|permission/i);
		assert.match(soloRef, privacidad);
		assert.doesNotMatch(soloRef, /datos personales|personal data/i, 'el motivo es la privacidad de los clientes, no «datos personales»');
		const soloCompletas = introIndependiente([completa()], idioma);
		assert.doesNotMatch(soloCompletas, privacidad);
		const mezcla = introIndependiente([referencia(), completa()], idioma);
		assert.match(mezcla, privacidad);
		assert.match(mezcla, idioma === 'es' ? /autorización/i : /permission|authori[sz]ation/i);
	}
	assert.doesNotMatch(introIndependiente([referencia()], 'es'), /\bvos\b|tenés|podés/i);
});

test('DATO_PERSONAL: detecta correos, direcciones web, dominios y números; no pretende detectar nombres', () => {
	for (const malo of ['alguien@sitio', 'https://sitio', 'www.sitio', 'taller.com', 'negocio.ar', 'Local 12', '2645550000']) assert.match(malo, DATO_PERSONAL, malo);
	for (const bueno of ['Sitio web a medida para el cliente.', 'Taller mecánico', 'Auto repair shop']) assert.doesNotMatch(bueno, DATO_PERSONAL, bueno);
	assert.doesNotMatch('Casa Pérez', DATO_PERSONAL, 'un nombre pasa: la protección real es la lista cerrada de campos');
});

test('referencia: estado solo puede ser «en-curso»', () => {
	assert.deepEqual(problemasDeEntrada(referencia({ estado: 'en-curso' })), []);
	assert.match(problemasDeEntrada(referencia({ estado: 'terminado' })).join(' '), /estado/);
});

test('resumenReferencias: una sola línea con los conteos calculados y los rubros agrupados', () => {
	const lista = [
		referencia({ id: 'a', rubro: 'Venta y logística', en: { ...referencia().en, rubro: 'Sales and logistics' } }),
		referencia({ id: 'b' }),
		referencia({ id: 'c' }),
		referencia({ id: 'd', rubro: 'Agricultura y riego', en: { ...referencia().en, rubro: 'Agriculture and irrigation' } }),
		referencia({ id: 'e', rubro: 'Cliente particular', estado: 'en-curso', en: { ...referencia().en, rubro: 'Private client' } }),
		completa({ id: 'f' }),
	];
	assert.deepEqual(resumenReferencias(lista, 'es'), {
		principal: 'Sitios web a medida para clientes particulares: 4 entregados y 1 en curso.',
		rubros: ['Venta y logística', 'Taller mecánico (2)', 'Agricultura y riego'],
	});
	assert.deepEqual(resumenReferencias(lista, 'en'), {
		principal: 'Custom websites for private clients: 4 delivered and 1 in progress.',
		rubros: ['Sales and logistics', 'Auto repair shop (2)', 'Agriculture and irrigation'],
	});
	assert.equal(resumenReferencias([referencia()], 'es').principal, 'Sitios web a medida para clientes particulares: 1 entregado.');
	const soloCurso = resumenReferencias([referencia({ estado: 'en-curso' })], 'es');
	assert.equal(soloCurso.principal, 'Sitios web a medida para clientes particulares: 1 en curso.');
	assert.deepEqual(soloCurso.rubros, [], '«en curso» no es un rubro');
});

test('resumenReferencias sobre los datos reales: cuenta lo que hay y no inventa rubros', () => {
	const refs = trabajosIndependientes.filter((e) => e.tipo === 'referencia');
	const enCurso = refs.filter((e) => e.estado === 'en-curso').length;
	const es = resumenReferencias(trabajosIndependientes, 'es');
	assert.ok(es.principal.includes(`${refs.length - enCurso} entregado`), es.principal);
	if (enCurso > 0) assert.ok(es.principal.includes(`${enCurso} en curso`), es.principal);
	assert.doesNotMatch(es.rubros.join(' '), /en curso|cliente particular/i);
	assert.doesNotMatch(`${es.principal} ${es.rubros.join(' ')}`, /\bvos\b|tenés|podés/i);
});

test('una entrada con permiso pero incompleta rompe la compilación (no se oculta en silencio)', () => {
	assert.throws(() => trabajosVisibles([completa({ stack: [] })]), /incompleto/);
	assert.throws(() => trabajosVisibles([completa({ queSeHizo: ' ' })]), /incompleto/);
	assert.throws(() => trabajosVisibles([completa({ url: 'http://sitio.example' })]), /https/);
	assert.throws(() => trabajosVisibles([completa({ captura: 'independiente/a.png' })]), /texto alternativo/);
	assert.throws(() => trabajosVisibles([completa({ captura: '../a.png', capturaAlt: 'x' })]), /src\/assets\/independiente/);
	assert.throws(() => trabajosVisibles([completa(), completa()]), /repetido/);
	assert.deepEqual(problemasDeEntrada(completa({ permisoCliente: false, stack: [] })), [], 'sin permiso no se revisa');
	assert.deepEqual(problemasDeEntrada(completa({ url: 'https://sitio.example/', captura: 'independiente/a.png', capturaAlt: 'Portada del sitio', anio: 2026 })), []);
});

test('la vista previa ficticia solo se activa en desarrollo', () => {
	const real = trabajosVisibles().map((e) => e.id);
	assert.deepEqual(trabajosAMostrar(true, false).lista.map((e) => e.id), real, 'en producción la vista previa pedida no cambia nada');
	assert.equal(trabajosAMostrar(true, false).vistaPrevia, false);
	assert.deepEqual(trabajosAMostrar(false, true).lista.map((e) => e.id), real, 'en desarrollo sin pedirla se ve lo real');
	const prev = trabajosAMostrar(true, true);
	assert.equal(prev.vistaPrevia, true);
	assert.deepEqual(prev.lista.map((e) => e.id), vistaPreviaIndependiente.map((e) => e.id));
	for (const e of vistaPreviaIndependiente) assert.match(e.rubro, /ficticio/i, `${e.id}: los datos de fantasía deben decirlo`);
});

test('dist: sin entradas visibles la sección no existe; con referencias, está en /tecnico/ y /en/tecnico/ y en ningún otro lado', conDist, () => {
	const dist = cargarDist();
	const visibles = trabajosVisibles();
	for (const [ruta, p] of dist.paginas) {
		assert.doesNotMatch(p.html, /ejemplo\.invalid|Ejemplo ficticio|Vista previa|Preview · fictitious/i, `${ruta}: aparecen datos de la vista previa`);
		const esTecnico = ruta === '/tecnico/' || ruta === '/en/tecnico/';
		if (visibles.length === 0 || !esTecnico) {
			assert.doesNotMatch(p.html, /id="independiente"/, `${ruta}: aparece la sección`);
			for (const e of trabajosIndependientes) assert.ok(!p.html.includes(e.titulo), `${ruta}: aparece «${e.titulo}»`);
		}
	}
});

test('dist: las referencias salen en español y en inglés, sin enlaces, imágenes ni datos extra', conDist, () => {
	const referencias = trabajosVisibles().filter((e) => e.tipo === 'referencia');
	assert.ok(referencias.length > 0, 'hay referencias cargadas: el test no puede pasar sin mirar nada');
	const dist = cargarDist();
	for (const [ruta, idioma] of [['/tecnico/', 'es'], ['/en/tecnico/', 'en']]) {
		const html = dist.paginas.get(ruta).html;
		const ini = html.indexOf('id="independiente"');
		assert.ok(ini >= 0, `${ruta}: falta la sección «independiente»`);
		const fin = html.indexOf('</article>', ini);
		assert.ok(fin > ini, `${ruta}: la sección no cierra con </article>`);
		const seccion = html.slice(ini, fin);
		assert.doesNotMatch(seccion, /<a[\s>]|<img|<picture|<svg|href=|src=|srcset=/i, `${ruta}: la sección de referencias trae enlaces o imágenes`);
		// Una sola tarjeta para todas las referencias (más una por cada sitio completo con permiso, hoy ninguno).
		const completas = trabajosVisibles().filter((e) => e.tipo !== 'referencia').length;
		assert.equal((seccion.match(/<li class="indep-carta/g) ?? []).length, 1 + completas, `${ruta}: una tarjeta para todas las referencias`);
		const resumen = resumenReferencias(referencias, idioma);
		assert.ok(seccion.includes(resumen.principal), `${ruta}: falta «${resumen.principal}»`);
		for (const rubro of resumen.rubros) assert.ok(seccion.includes(rubro), `${ruta}: falta el rubro «${rubro}»`);
		// Lo que no se muestra: ni los títulos ni lo que se hizo de cada referencia, ni la palabra «Referencia(s)» como rótulo.
		for (const e of referencias) assert.ok(!seccion.includes(vistaDe(e, idioma).queSeHizo), `${ruta}: repite el texto de «${e.id}»`);
		assert.doesNotMatch(seccion, /Referencias?\b|References?\b/, `${ruta}: «Referencia» confunde con las referencias laborales`);
		assert.doesNotMatch(seccion, /indep-stack|indep-rubro"/, `${ruta}: imprime un stack vacío`);
		assert.doesNotMatch(seccion, /@|https?:|www\./i, `${ruta}: dato personal en la sección`);
		assert.match(seccion, idioma === 'es' ? /por privacidad de los clientes/ : /for the clients' privacy|for the clients&#39; privacy/);
	}
});
