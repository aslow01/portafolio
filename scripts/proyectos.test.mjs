// Los proyectos de la portada y la ficha Proyectos (src/lib/proyectos.ts, src/lib/opciones.ts): la novela figura siempre
// con textos fijos, sin título, y NUNCA se lee su entrada de src/content/proyectos (esté o no esté el archivo: la copia
// pública del repositorio se arma sin él). Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { novela } from '../src/lib/opciones.ts';
import { entraEnV5, piezasTecnico, proyectosV5, tamanoTitulo, vistaDeProyecto } from '../src/lib/proyectos.ts';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const carpeta = join(raiz, 'src', 'content', 'proyectos');

// Una entrada de la novela con marcas inconfundibles: si algo de esto aparece en lo que se dibuja, se leyó la entrada.
const entradaNovela = (extra = {}) => ({
	id: 'una-novela-cualquiera',
	data: { tipo: 'novela', estado: 'en-desarrollo', titulo: 'TITULO-SECRETO', resumen: 'RESUMEN-SECRETO. Segunda frase.', orden: 1, borrador: false, ...extra },
	body: 'SINOPSIS-SECRETA sin revisar.',
});
const juego = { id: 'afterfall', data: { tipo: 'juego', estado: 'en-desarrollo', titulo: 'Afterfall', resumen: 'Un juego. Con infectados.', orden: 2, borrador: false }, body: 'Cuerpo del juego.' };

/** Las entradas de novela que haya en src/content/proyectos (en la copia pública no hay ninguna). */
function novelasDelArbol() {
	if (!existsSync(carpeta)) return [];
	return readdirSync(carpeta)
		.filter((n) => n.endsWith('.md'))
		.map((n) => ({ archivo: n, id: n.replace(/\.md$/, ''), texto: readFileSync(join(carpeta, n), 'utf8') }))
		.filter((e) => /^tipo:\s*novela\s*$/m.test(e.texto));
}

test('la novela figura sin título, con textos fijos, aunque no haya ninguna entrada suya', () => {
	const v = proyectosV5([juego], false).find((p) => p.tipo === 'novela');
	assert.deepEqual(v, {
		id: 'novela',
		tipo: 'novela',
		estado: 'en-desarrollo',
		titulo: 'Novela en desarrollo',
		pagina: 'Novela',
		texto: 'Novela de terror por contagio, en dos libros.',
		aparte: 'Trabajo en esta historia desde alrededor de 2018; en 2026 tomó impulso.',
		sinTitulo: true,
		orden: 1,
		filas: [
			{ clave: 'yo', rotulo: 'Mi parte', texto: 'La escribo yo solo: la historia y cada capítulo.' },
		],
		enlaces: [],
		tamanoTitulo: 'largo',
	});
	assert.equal(novela.titulo, 'Novela en desarrollo');
});

test('una entrada de novela, en borrador o publicada, no se lee: figura una sola novela y con los textos fijos', () => {
	for (const e of [entradaNovela({ borrador: true }), entradaNovela({ borrador: false })]) {
		const lista = proyectosV5([e, juego], false);
		assert.doesNotMatch(JSON.stringify(lista), /SECRET/);
		assert.equal(lista.filter((p) => p.tipo === 'novela').length, 1);
		assert.equal(entraEnV5(e, false), false, 'la entrada de la novela no entra: la novela sale de lib/opciones.ts');
	}
});

test('en preparación nunca figura; un borrador de otro proyecto tampoco', () => {
	assert.equal(entraEnV5({ ...juego, data: { ...juego.data, estado: 'en-preparacion' } }, false), false);
	assert.equal(entraEnV5({ ...juego, data: { ...juego.data, borrador: true } }, false), false);
	assert.equal(entraEnV5(juego, false), true);
});

test('un proyecto común: primera oración arriba y el resto abajo; sin resto, el cuerpo publicado', () => {
	const v = vistaDeProyecto(juego);
	assert.equal(v.texto, 'Un juego.');
	assert.equal(v.aparte, 'Con infectados.');
	assert.equal(v.sinTitulo, false);
	const sinResto = vistaDeProyecto({ ...juego, data: { ...juego.data, resumen: 'Solo una.' } });
	assert.equal(sinResto.aparte, 'Cuerpo del juego.');
	const enBorrador = vistaDeProyecto({ ...juego, id: 'x', data: { ...juego.data, resumen: 'Solo una.', borrador: true } });
	assert.equal(enBorrador.aparte, '', 'el cuerpo de un borrador no se publica');
});

// --- Fichas de proyectos propios ---

const pieza = (id, orden, extra = {}) => ({
	id,
	data: { tipo: 'otro', camino: 'tecnico', estado: 'en-desarrollo', titulo: `Pieza ${id}`, resumen: 'Texto. Aparte.', orden, borrador: false, ...extra },
	body: '',
});

test('tamanoTitulo: palabra de 11 letras o más → mas-largo; más de 12 caracteres o palabra de 10 → largo; si no, vacío', () => {
	assert.equal(tamanoTitulo('Afterfall'), '');
	assert.equal(tamanoTitulo('Novela en desarrollo'), 'largo');
	assert.equal(tamanoTitulo('Método con Claude'), 'largo');
	assert.equal(tamanoTitulo('Laboratorio de modelos'), 'mas-largo');
	// bordes: 12 caracteres sin palabra larga es ''; 13 es largo; 10 letras es largo; 11 letras es mas-largo
	assert.equal(tamanoTitulo('Doce letras.'), '');
	assert.equal(tamanoTitulo('Trece letras!'), 'largo');
	assert.equal(tamanoTitulo('Abcdefghij'), 'largo');
	assert.equal(tamanoTitulo('Abcdefghijk'), 'mas-largo');
	// la puntuación y los signos no cuentan como letras
	assert.equal(tamanoTitulo('Ñandú-Ñandú: sí'), 'largo');
	assert.equal(tamanoTitulo(''), '');
});

test('proyectosV5 deja afuera lo de camino técnico, aunque sea publicable', () => {
	const lista = proyectosV5([juego, pieza('metodo', 1), pieza('lab', 2)], false);
	assert.deepEqual(lista.map((p) => p.id), ['afterfall', 'novela']);
	assert.equal(entraEnV5(pieza('metodo', 1), false), false);
	assert.equal(entraEnV5({ ...pieza('x', 1), data: { ...pieza('x', 1).data, camino: 'proyectos' } }, false), true);
	// sin `camino` (entradas viejas): es de Proyectos
	assert.equal(entraEnV5({ ...juego, data: { ...juego.data, tipo: 'otro' } }, false), true);
});

test('piezasTecnico: solo camino técnico, por orden, sin borradores ni «en preparación» (salvo en dev)', () => {
	const entradas = [
		pieza('lab', 2),
		juego,
		pieza('metodo', 1),
		pieza('borrador', 3, { borrador: true }),
		pieza('prep', 4, { estado: 'en-preparacion' }),
		entradaNovela({ camino: 'tecnico' }),
	];
	assert.deepEqual(piezasTecnico(entradas, false).map((p) => p.id), ['metodo', 'lab']);
	assert.deepEqual(piezasTecnico(entradas, true).map((p) => p.id), ['metodo', 'lab', 'borrador']);
	assert.deepEqual(piezasTecnico([juego, entradaNovela()], false), []);
	assert.deepEqual(piezasTecnico([], false), []);
});

test('la vista de una entrada trae filas, enlaces, tamaño de título y nombre de página', () => {
	const e = pieza('metodo', 1, {
		titulo: 'Laboratorio de modelos',
		pagina: 'Laboratorio',
		autoria: { yo: 'Hice A.', ia: '', verificacion: 'Probé B.' },
		enlaces: [{ texto: 'Repositorio', url: 'https://ejemplo.com/x' }],
	});
	const v = vistaDeProyecto(e);
	assert.deepEqual(v.filas, [
		{ clave: 'yo', rotulo: 'Mi parte', texto: 'Hice A.' },
		{ clave: 'verif', rotulo: 'Cómo lo verifiqué', texto: 'Probé B.' },
	]);
	assert.deepEqual(v.enlaces, [{ texto: 'Repositorio', url: 'https://ejemplo.com/x' }]);
	assert.equal(v.tamanoTitulo, 'mas-largo');
	assert.equal(v.pagina, 'Laboratorio');
	assert.equal(v.titulo, 'Laboratorio de modelos');
	// sin datos: sin filas, sin enlaces, y la página es el título
	const vacio = vistaDeProyecto(juego);
	assert.deepEqual(vacio.filas, []);
	assert.deepEqual(vacio.enlaces, []);
	assert.equal(vacio.pagina, 'Afterfall');
	assert.equal(vacio.tamanoTitulo, '');
});

test('la autoría de la novela sale de lib/opciones.ts, nunca de su entrada', () => {
	const e = entradaNovela({ autoria: { yo: 'AUTORIA-SECRETA' } });
	const lista = proyectosV5([e, juego], false);
	assert.doesNotMatch(JSON.stringify(lista), /SECRET/);
	const n = lista.find((p) => p.tipo === 'novela');
	assert.equal(n.filas.length, 1, 'la novela no lleva fila de autoría con IA ni de verificación');
	assert.deepEqual(novela.autoria, {
		yo: 'La escribo yo solo: la historia y cada capítulo.',
		ia: '',
		verificacion: '',
	});
});

test('orden: el juego antes que la novela', () => {
	assert.deepEqual(
		proyectosV5([juego], false).map((p) => p.tipo),
		['juego', 'novela'],
	);
});

test('las entradas reales de novela (si el árbol las tiene): ni su título ni su sinopsis salen en lo que se dibuja ni en el código', () => {
	for (const e of novelasDelArbol()) {
		const [, cabeza, cuerpo] = e.texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/) ?? [];
		assert.ok(cabeza, `${e.archivo}: encabezado legible`);
		const titulo = cabeza.match(/^titulo:\s*(.+)$/m)?.[1].trim();
		assert.ok(titulo, `${e.archivo}: sin título`);
		const dibujado = JSON.stringify(proyectosV5([{ id: e.id, data: { tipo: 'novela', estado: 'en-desarrollo', titulo, resumen: 'x.', orden: 1, borrador: false }, body: cuerpo }, juego], false));
		assert.ok(!dibujado.includes(titulo), 'el título de la novela no se dibuja');
		for (const o of oracionesDe(cuerpo)) assert.ok(!dibujado.includes(o), `la sinopsis no se dibuja: «${o.slice(0, 40)}…»`);
		// El título tampoco puede estar escrito en el código que decide qué se muestra.
		for (const f of ['opciones.ts', 'proyectos.ts']) assert.ok(!readFileSync(join(raiz, 'src', 'lib', f), 'utf8').includes(titulo), `el título está en src/lib/${f}`);
	}
});

test('dist/ (si existe): ni el título ni la sinopsis ni el nombre del archivo de una novela del árbol, en ningún HTML, ruta o sitemap', () => {
	const dist = join(raiz, 'dist');
	if (!existsSync(dist)) return; // `npm run prepublicar` lo exige con el build ya hecho (verificar-borradores.mjs)
	const listar = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? listar(join(d, n)) : [join(d, n)]));
	for (const e of novelasDelArbol()) {
		const titulo = e.texto.match(/^titulo:\s*(.+)$/m)?.[1].trim() ?? '';
		const frases = oracionesDe((e.texto.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/) ?? [])[1] ?? '');
		for (const f of listar(dist)) {
			assert.ok(!f.includes(e.id), `página propia: ${f}`);
			if (!/\.(html|xml|js|css|txt)$/.test(f)) continue;
			const c = readFileSync(f, 'utf8');
			assert.ok(!c.includes(titulo), `el título aparece en ${f}`);
			assert.ok(!c.includes(e.id), `el slug aparece en ${f}`);
			for (const o of frases) assert.ok(!c.includes(o), `la sinopsis aparece en ${f}: «${o.slice(0, 40)}…»`);
		}
	}
});

// --- Contenido real de las fichas (textos fijados por el autor, con topes de largo) ---

/** Lee una entrada de src/content/proyectos con el lector mínimo de esta prueba (claves de primer nivel y `autoria:`). */
function leerEntrada(nombre) {
	const ruta = join(carpeta, nombre);
	if (!existsSync(ruta)) return undefined; // la copia pública no lleva los borradores
	const [, cabeza, cuerpo] = readFileSync(ruta, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	const valor = (s) => s.trim().replace(/^"(.*)"$/, '$1');
	const data = {};
	const autoria = {};
	for (const l of cabeza.split(/\r?\n/)) {
		const sub = l.match(/^\s+(yo|ia|verificacion):\s*(.+)$/);
		if (sub) autoria[sub[1]] = valor(sub[2]);
		const kv = l.match(/^([a-z]+):\s*(.*)$/);
		if (kv && kv[2] !== '') data[kv[1]] = valor(kv[2]);
	}
	if (Object.keys(autoria).length) data.autoria = autoria;
	data.orden = Number(data.orden);
	data.borrador = data.borrador === 'true';
	return { id: nombre.replace(/\.md$/, ''), data, body: cuerpo };
}

const FICHAS = {
	'afterfall.md': {
		tipo: 'juego',
		camino: undefined,
		titulo: 'Afterfall',
		texto: 'Juego de supervivencia contra infectados, pensado para Unreal Engine.',
		aparte: 'Hoy está en etapa de diseño. Todavía no hay capturas.',
		autoria: {
			yo: 'Lo hago yo solo: la historia, los sonidos y las animaciones.',
			ia: 'Uso IA como ayuda en el diseño del juego.',
			verificacion: 'Todavía no hay nada jugable que probar.',
		},
		topeAparte: 110,
	},
	'metodo-claude.md': {
		tipo: 'otro',
		camino: 'tecnico',
		orden: 1,
		titulo: 'Método con Claude',
		pagina: 'Método',
		texto: 'Cómo trabajo con Claude Code: reglas, agentes y guardas de seguridad.',
		aparte: 'Un modelo liviano lee, uno intermedio analiza y el más capaz decide.',
		autoria: {
			yo: 'Fijo las reglas y reviso los cambios.',
			ia: 'Claude escribe los archivos de reglas, agentes y guardas.',
			verificacion: 'Reviso cada cambio; la guarda de comandos tiene pruebas automáticas.',
		},
		topeAparte: 130,
	},
	'laboratorio-modelos.md': {
		tipo: 'otro',
		camino: 'tecnico',
		orden: 2,
		titulo: 'Laboratorio de modelos',
		pagina: 'Laboratorio',
		texto: 'Pruebas para elegir qué modelo de IA conviene a cada tarea de código.',
		aparte: 'Cuando todos los modelos sacan el puntaje máximo, la prueba ya no distingue y se endurece.',
		autoria: {
			yo: 'Diseñé las pruebas junto con Claude y decidí qué datos podían salir a cada proveedor.',
			ia: 'Claude diseñó las pruebas conmigo.',
			verificacion: 'Cada tarea tiene un chequeo oculto, probado con una solución correcta y con versiones rotas a propósito.',
		},
		topeAparte: 130,
	},
};

for (const [archivo, esperado] of Object.entries(FICHAS)) {
	test(`${archivo}: textos fijados por el autor, dentro de los topes de largo, sin repetir la autoría en el aparte`, () => {
		const e = leerEntrada(archivo);
		if (!e) return;
		assert.equal(e.data.tipo, esperado.tipo);
		assert.equal(e.data.camino, esperado.camino);
		assert.equal(e.data.estado, 'en-desarrollo');
		assert.equal(e.body.trim(), '', 'el cuerpo queda vacío');
		assert.equal(e.data.titulo, esperado.titulo);
		assert.equal(e.data.pagina, esperado.pagina);
		if (esperado.orden) assert.equal(e.data.orden, esperado.orden);
		assert.deepEqual(e.data.autoria, esperado.autoria);
		// Los textos que se dibujan salen del resumen: primera oración y resto.
		const v = vistaDeProyecto(e);
		assert.equal(v.texto, esperado.texto);
		assert.equal(v.aparte, esperado.aparte);
		assert.ok(v.texto.length <= 90, `texto ${v.texto.length} > 90`);
		assert.ok(v.aparte.length <= esperado.topeAparte, `aparte ${v.aparte.length} > ${esperado.topeAparte}`);
		assert.ok(v.titulo.length <= 24, 'título > 24');
		assert.ok(Math.max(...v.titulo.split(/\s+/).map((p) => p.length)) <= 11, 'palabra de más de 11 letras');
		const { yo, ia, verificacion } = e.data.autoria;
		assert.ok(yo.length <= 85 && ia.length <= 100 && verificacion.length <= 120, 'una fila pasa su tope');
		assert.ok(yo.length + ia.length + verificacion.length <= 290, 'las tres filas pasan 290');
		if (v.pagina !== v.titulo) assert.ok(v.pagina.length <= 14, 'la página pasa 14');
		assert.equal(v.filas.length, 3);
		assert.deepEqual(v.enlaces, [], 'sin enlace hasta que exista el repositorio');
		// Criterio del autor para estos textos: ninguna cifra y ningún nombre de modelo (Claude, de la herramienta, sí figura en los textos fijados).
		assert.doesNotMatch(JSON.stringify([e.data.titulo, e.data.pagina, e.data.resumen, e.data.autoria]), /\b(opus|sonnet|haiku|gpt|gemini|llama|\d+)\b/i);
	});
}

test('las piezas del camino técnico: Método y Laboratorio publicados; el traductor oculto (borrador) hasta que funcione, así que no sale en producción', () => {
	const metodo = leerEntrada('metodo-claude.md');
	const lab = leerEntrada('laboratorio-modelos.md');
	const traductor = leerEntrada('traductor-entrevistas.md');
	if (!metodo || !lab || !traductor) return;
	assert.equal(metodo.data.borrador, false);
	assert.equal(lab.data.borrador, false);
	assert.equal(traductor.data.borrador, true, 'el traductor sigue oculto hasta que funcione (decisión del 28/11)');
	assert.deepEqual(piezasTecnico([traductor, lab, metodo], false).map((p) => p.pagina), ['Método', 'Laboratorio'], 'en producción salen solo dos, por orden');
	assert.deepEqual(piezasTecnico([traductor, lab, metodo], true).map((p) => p.pagina), ['Método', 'Laboratorio', 'Traductor'], 'en desarrollo se ve el traductor');
	assert.deepEqual(piezasTecnico([traductor, lab, metodo], false).map((p) => p.tamanoTitulo), ['largo', 'mas-largo']);
	assert.ok(!proyectosV5([traductor, lab, metodo], false).some((p) => p.tipo === 'otro'), 'Proyectos sigue con dos cartas');
	// Si Matías pone también las otras dos en borrador, en producción no sale ninguna.
	const enBorrador = [traductor, lab, metodo].map((e) => ({ ...e, data: { ...e.data, borrador: true } }));
	assert.deepEqual(piezasTecnico(enBorrador, false), []);
});

test('traductor-entrevistas.md: en desarrollo, dice qué está hecho y qué falta, sin enlace (repositorio privado) y sin nada que funcione aún', () => {
	const e = leerEntrada('traductor-entrevistas.md');
	if (!e) return;
	assert.equal(e.data.tipo, 'otro');
	assert.equal(e.data.camino, 'tecnico');
	assert.equal(e.data.estado, 'en-desarrollo');
	assert.equal(e.data.orden, 3);
	assert.equal(e.body.trim(), '', 'el cuerpo queda vacío');
	const v = vistaDeProyecto(e);
	assert.equal(v.pagina, 'Traductor');
	assert.equal(v.titulo, 'Traductor para entrevistas');
	assert.deepEqual(v.enlaces, [], 'sin enlace: el repositorio es privado');
	assert.equal(v.filas.length, 3);
	assert.ok(v.texto.length <= 90, 'texto > 90');
	// Dice qué está hecho, qué está en curso y qué falta.
	assert.match(v.aparte, /Hecho:.*En curso:.*Falta:/);
	// Nada de afirmar que ya funciona o que ya se usó, ni de proveedores de pago distintos de ElevenLabs.
	const todo = JSON.stringify([e.data.resumen, e.data.autoria]);
	assert.doesNotMatch(todo, /funciona|ya lo uso|probado en|Parley|Voxis|Transync|Palabra|DeepL|USD|precio/i);
	assert.match(e.data.autoria.verificacion, /Todavía no se midió/);
	// Honestidad con el audio: no se guarda en la PC de Matías, pero sale en vivo hacia ElevenLabs.
	assert.match(e.data.autoria.yo, /ElevenLabs/);
	// El archivo no lleva comentarios que sugieran un vínculo laboral (sale en el repositorio público).
	assert.doesNotMatch(readFileSync(join(carpeta, 'traductor-entrevistas.md'), 'utf8'), /^#/m);
});

test('traductor-entrevistas.md en inglés: mismo orden y estado, dice Done / In progress / Still to do y no afirma que funcione', () => {
	if (!leerEntrada('traductor-entrevistas.md')) return; // la copia pública no lleva este archivo
	const ruta = join(raiz, 'src', 'content-en', 'proyectos', 'traductor-entrevistas.md');
	assert.ok(existsSync(ruta), 'si existe el de español, tiene que existir el de inglés');
	const [, cabeza] = readFileSync(ruta, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
	assert.match(cabeza, /^orden:\s*3\s*$/m);
	assert.match(cabeza, /^estado:\s*en-desarrollo\s*$/m);
	assert.match(cabeza, /^borrador:\s*true\s*$/m, 'oculto hasta que funcione');
	assert.match(cabeza, /Done:.*In progress:.*Still to do:/);
	assert.match(cabeza, /not been measured yet/);
	assert.match(cabeza, /ElevenLabs for speech recognition/);
	assert.doesNotMatch(cabeza, /works|already use|tested in|USD/i);
	assert.doesNotMatch(readFileSync(ruta, 'utf8'), /^#/m);
});

/** Las oraciones de un cuerpo (sin comentarios HTML) de 25 caracteres o más: sirven para buscar la sinopsis. */
function oracionesDe(cuerpo) {
	return cuerpo
		.replace(/<!--[\s\S]*?-->/g, '')
		.split(/(?<=[.:])\s+/)
		.map((o) => o.replace(/[*_]/g, '').trim())
		.filter((o) => o.length >= 25);
}
