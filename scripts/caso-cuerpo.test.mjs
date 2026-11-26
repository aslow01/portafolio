// Pruebas del molde «Expediente» de la página de caso (src/v5/interiores/cuerpo.ts y caso.ts). Node puro: npm test
// Cubren la lectura del Markdown, el reparto en páginas y el armado del modelo, con los casos reales de src/content.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { leerCuerpo, leerInline, paginar, paginasDeSeccion } from '../src/v5/interiores/cuerpo.ts';
import { armarCaso, partirCifra, partirTitulo } from '../src/v5/interiores/caso.ts';

const DIR = new URL('../src/content/casos/', import.meta.url);
/** El Markdown de un caso sin su encabezado (entre «---»). */
const cuerpoDe = (archivo) => {
	const t = readFileSync(new URL(archivo, DIR), 'utf8').replace(/\r\n?/g, '\n');
	return t.slice(t.indexOf('\n---', 4) + 4);
};
const forma = (paginas) => paginas.map((p) => p.map((b) => (b.t === 'p' ? 'p' : `ul${b.items.length}`)).join('+'));

test('todos los casos del repositorio se leen sin errores (publicados y borradores)', () => {
	for (const f of readdirSync(DIR)) {
		const secciones = leerCuerpo(cuerpoDe(f));
		assert.ok(secciones.length > 0, f);
		for (const s of secciones) assert.ok(s.titulo.length > 0 && s.tandas.length > 0, `${f}: ${s.titulo}`);
	}
});

test('el caso de facturas: cinco secciones, y las que no entran en una página se parten como en el prototipo', () => {
	const s = leerCuerpo(cuerpoDe('automatizacion-facturas.md'));
	assert.deepEqual(
		s.map((x) => x.titulo),
		['Problema', 'Qué se construyó', 'Cómo se controla', 'Puesta al día de la facturación', 'Resultado'],
	);
	assert.deepEqual(forma(paginasDeSeccion(s[0])), ['p']);
	assert.deepEqual(forma(paginasDeSeccion(s[1])), ['p+ul2', 'ul3']);
	assert.deepEqual(forma(paginasDeSeccion(s[2])), ['p+ul3', 'ul4']);
	assert.deepEqual(forma(paginasDeSeccion(s[3])), ['p']);
	assert.deepEqual(forma(paginasDeSeccion(s[4])), ['p']);
});

test('el reparto no corta un ítem, no pierde ninguno y no deja la presentación de una lista sola al pie', () => {
	const item = (n) => [{ t: 'txt', s: `ítem ${n} ${'x'.repeat(200)}` }];
	const bloques = [{ t: 'p', hijos: [{ t: 'txt', s: 'Lo que sigue:' }] }, { t: 'ul', items: [1, 2, 3, 4, 5, 6, 7, 8].map(item) }];
	const paginas = paginar(bloques, 700);
	assert.ok(paginas.length >= 2);
	const items = paginas.flatMap((p) => p.flatMap((b) => (b.t === 'ul' ? b.items : [])));
	assert.equal(items.length, 8);
	assert.equal(paginas[0][0].t, 'p');
	assert.ok(paginas[0].some((b) => b.t === 'ul'), 'la primera página lleva algún ítem junto a su presentación');
	// el original no se modifica
	assert.equal(bloques[1].items.length, 8);
});

test('una sección corta queda en una sola página; un solo bloque enorme no se parte', () => {
	const corta = [{ t: 'p', hijos: [{ t: 'txt', s: 'corto' }] }];
	assert.equal(paginar(corta).length, 1);
	const enorme = [{ t: 'p', hijos: [{ t: 'txt', s: 'x'.repeat(5000) }] }];
	assert.equal(paginar(enorme).length, 1);
});

test('«<!-- página -->» corta a mano y manda sobre el reparto automático', () => {
	const md = '## Uno\n\nprimero\n\n<!-- página -->\n\nsegundo\n\n- a\n- b\n';
	const [s] = leerCuerpo(md);
	assert.deepEqual(forma(paginasDeSeccion(s)), ['p', 'p+ul2']);
	assert.throws(() => leerCuerpo('<!-- página -->\n## Uno'), /antes del primer/);
});

test('el Markdown que el molde no entiende falla con la línea, en vez de publicarse mal', () => {
	assert.throws(() => leerCuerpo('## A\n\n### B'), /Línea 3.*nivel 2/);
	assert.throws(() => leerCuerpo('texto suelto\n## A'), /antes del primer/);
	assert.throws(() => leerCuerpo('## A\n\n1. uno'), /numeradas/);
	assert.throws(() => leerCuerpo('## A\n\n> cita'), /citas/);
	assert.throws(() => leerCuerpo('## A\n\n<div>x</div>'), /HTML/);
	assert.throws(() => leerCuerpo('## A\n\n- a\n  - anidado'), /anidadas/);
	assert.throws(() => leerCuerpo('## A\n\nuna **negrita sin cerrar'), /negrita sin cerrar/);
	assert.throws(() => leerCuerpo('## A\n\nver [esto](pagina.html)'), /no es absoluto/);
});

test('texto en línea: negrita, cursiva, código y enlaces; comillas tipográficas', () => {
	assert.deepEqual(leerInline('a **b** y *c* con `d` y [e](/f/)'), [
		{ t: 'txt', s: 'a ' },
		{ t: 'strong', hijos: [{ t: 'txt', s: 'b' }] },
		{ t: 'txt', s: ' y ' },
		{ t: 'em', hijos: [{ t: 'txt', s: 'c' }] },
		{ t: 'txt', s: ' con ' },
		{ t: 'code', s: 'd' },
		{ t: 'txt', s: ' y ' },
		{ t: 'a', href: '/f/', hijos: [{ t: 'txt', s: 'e' }] },
	]);
	const [s] = leerCuerpo('## A\n\nuna lista de "no pagar" y d\'Artagnan...');
	assert.equal(s.tandas[0][0].hijos[0].s, 'una lista de “no pagar” y d’Artagnan…');
});

test('un renglón de continuación se une al ítem', () => {
	const [s] = leerCuerpo('## A\n\n- uno\n  sigue\n- dos\n');
	assert.equal(s.tandas[0][0].items.length, 2);
	assert.equal(s.tandas[0][0].items[0][0].s, 'uno sigue');
});

test('la cifra y el título se parten sin perder nada', () => {
	assert.deepEqual(partirCifra('40 → 300+', 'facturas por jornada', 'Promedios.'), { antes: ['40'], ahora: '300+', unidad: 'facturas por jornada', medicion: 'Promedios.' });
	assert.deepEqual(partirCifra('2.000', undefined, 'Mes.'), { antes: [], ahora: '2.000', unidad: undefined, medicion: 'Mes.' });
	assert.deepEqual(partirTitulo('Automatización de la carga de facturas'), { primera: 'Automatización', resto: 'de la carga de facturas' });
	assert.deepEqual(partirTitulo('Automatización de la carga de facturas', 3), { primera: 'Automatización de la', resto: 'carga de facturas' });
	assert.deepEqual(partirTitulo('Plataforma'), { primera: 'Plataforma', resto: '' });
});

const facturas = {
	titulo: 'Automatización de la carga de facturas',
	resumen: 'Resumen.',
	contexto: 'Empresa de seguridad privada de San Juan',
	rol: 'Diseño, dirección y verificación',
	uso: 'Diario',
	resultado: { cifra: '40 → 300+', unidad: 'facturas por jornada', medicion: 'Promedios por jornada, medidos en octubre de 2026.' },
	autoria: { yo: 'Yo hice esto.', ia: 'La IA hizo aquello.', verificacion: 'Así lo verifiqué.' },
};

test('el modelo del caso de facturas: nueve páginas en el orden del prototipo, con la puesta al día antes de la cifra', () => {
	const m = armarCaso(facturas, cuerpoDe('automatizacion-facturas.md'));
	assert.deepEqual(
		m.paginas.map((p) => `${p.tipo}:${p.titulo}`),
		[
			'hoja:Problema',
			'hoja:Qué se construyó',
			'hoja:Qué se construyó · 2',
			'hoja:Cómo se controla',
			'hoja:Cómo se controla · 2',
			'hoja:Puesta al día de la facturación',
			'cifra:Resultado',
			'autoria:Mi parte',
			'cierre:Cómo lo verifiqué',
		],
	);
	assert.deepEqual(m.caratula.map((f) => f.clave), ['donde', 'rol', 'resultado']);
	// la continuación comparte el número de su sección
	const hojas = m.paginas.filter((p) => p.tipo === 'hoja');
	assert.deepEqual(hojas.map((p) => p.solapa.numero), [1, 2, 2, 3, 3, 4]);
	assert.deepEqual(hojas.map((p) => p.solapa.nivel), ['h2', 'h2', 'p', 'h2', 'p', 'h2']);
	// ids únicos
	const ids = m.paginas.map((p) => p.id);
	assert.equal(new Set(ids).size, ids.length);
});

test('la cifra solo se muestra con su medición; sin ella, «Resultado» es una hoja más y la carátula no la lleva', () => {
	const m = armarCaso({ ...facturas, resultado: { cifra: '40 → 300+' } }, cuerpoDe('automatizacion-facturas.md'));
	assert.equal(m.paginas.some((p) => p.tipo === 'cifra'), false);
	assert.equal(m.caratula.some((f) => f.clave === 'resultado'), false);
	assert.equal(m.paginas.find((p) => p.titulo === 'Resultado')?.tipo, 'hoja');
});

test('un caso mínimo: sin carátula, sin autoría y sin cifra, igual arma sus páginas y un cierre con la salida', () => {
	const m = armarCaso({ titulo: 'Uno', resumen: 'r' }, '## Problema\n\nTexto.\n');
	assert.deepEqual(m.caratula, []);
	assert.deepEqual(m.paginas.map((p) => p.tipo), ['hoja', 'cierre']);
	assert.equal(m.paginas[1].verificacion, undefined);
	assert.equal(m.titulo.resto, '');
});

test('«Resultado» con listas o con mucho texto no entra en la página azul de la cifra', () => {
	const conLista = armarCaso(facturas, '## Resultado\n\n- uno\n- dos\n');
	assert.equal(conLista.paginas[0].tipo, 'hoja');
	const largo = armarCaso(facturas, `## Resultado\n\n${'palabra '.repeat(120)}\n`);
	assert.equal(largo.paginas[0].tipo, 'hoja');
});

test('«Más casos»: hasta tres, al final; sin otros casos, no hay página', () => {
	const otros = [1, 2, 3, 4].map((n) => ({ rotulo: 'Caso · Técnico e IA', titulo: `Caso ${n}`, href: `/casos/c${n}/`, borrador: false }));
	const m = armarCaso(facturas, cuerpoDe('automatizacion-facturas.md'), { mas: otros });
	const ultima = m.paginas[m.paginas.length - 1];
	assert.equal(ultima.tipo, 'mas');
	assert.equal(ultima.casos.length, 3);
	assert.equal(armarCaso(facturas, cuerpoDe('automatizacion-facturas.md')).paginas.some((p) => p.tipo === 'mas'), false);
});

test('«Más casos»: con el total de casos (dos o más) suma la fila «Todos los casos de estudio» al índice, con o sin cartas', () => {
	const otros = [1, 2].map((n) => ({ rotulo: 'Caso · Técnico e IA', titulo: `Caso ${n}`, href: `/casos/c${n}/`, borrador: false }));
	const conCartas = armarCaso(facturas, cuerpoDe('automatizacion-facturas.md'), { mas: otros, totalCasos: 6 });
	const ultima = conCartas.paginas[conCartas.paginas.length - 1];
	assert.equal(ultima.tipo, 'mas');
	assert.equal(ultima.casos.length, 2);
	assert.deepEqual(ultima.todos, { texto: 'Todos los casos de estudio', total: 6 });
	// sin cartas del mismo camino, la página existe igual: de cualquier caso se llega al índice
	const soloFila = armarCaso(facturas, cuerpoDe('automatizacion-facturas.md'), { totalCasos: 2 });
	const pagina = soloFila.paginas[soloFila.paginas.length - 1];
	assert.equal(pagina.tipo, 'mas');
	assert.deepEqual(pagina.casos, []);
	assert.equal(pagina.id, 'mas-casos');
});

test('«Más casos»: con un solo caso publicado no hay índice al que ir, y sin el dato no cambia nada', () => {
	const sinIndice = armarCaso(facturas, cuerpoDe('automatizacion-facturas.md'), { totalCasos: 1 });
	assert.equal(sinIndice.paginas.some((p) => p.tipo === 'mas'), false);
	const otros = [{ rotulo: 'Caso · Técnico e IA', titulo: 'Caso 1', href: '/casos/c1/', borrador: false }];
	const solasCartas = armarCaso(facturas, cuerpoDe('automatizacion-facturas.md'), { mas: otros, totalCasos: 1 });
	assert.equal(solasCartas.paginas[solasCartas.paginas.length - 1].todos, undefined);
});

test('los dos nombres de sección que chocan con las anclas fijas reciben otro id', () => {
	const m = armarCaso(facturas, '## Autoría\n\nTexto.\n');
	const ids = m.paginas.map((p) => p.id);
	assert.equal(new Set(ids).size, ids.length);
});
