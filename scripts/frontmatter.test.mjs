// Tests del lector de encabezados de verificar-borradores (scripts/frontmatter.mjs). Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerFrontmatter, esBorrador } from './frontmatter.mjs';

const md = (lineas) => `---\n${lineas.join('\n')}\n---\n\nCuerpo`;

test('lee valores simples y entre comillas', () => {
	const { datos, problemas } = leerFrontmatter(md(['titulo: "Casa #1"', 'estado: borrador', "resumen: 'algo'"]));
	assert.deepEqual(problemas, []);
	assert.equal(datos.titulo, 'Casa #1');
	assert.equal(datos.estado, 'borrador');
	assert.equal(datos.resumen, 'algo');
});

test('un comentario al final de la línea no cuenta como valor', () => {
	const { datos, problemas } = leerFrontmatter(md(['estado: borrador # falta la cifra', 'borrador: true   # oculto']));
	assert.deepEqual(problemas, []);
	assert.equal(datos.estado, 'borrador');
	assert.equal(datos.borrador, 'true');
	assert.equal(esBorrador(datos), true);
});

test('un # pegado al texto (ancla de URL) no es comentario', () => {
	const { datos } = leerFrontmatter(md(['demo: https://ejemplo.com/p#ancla']));
	assert.equal(datos.demo, 'https://ejemplo.com/p#ancla');
});

test('una línea que es solo comentario se ignora', () => {
	const { datos, problemas } = leerFrontmatter(md(['# [CONFIRMAR] algo', 'estado: publicado']));
	assert.deepEqual(problemas, []);
	assert.equal(esBorrador(datos), false);
});

test('CRLF también se lee', () => {
	const { datos } = leerFrontmatter('---\r\nestado: borrador\r\n---\r\n');
	assert.equal(esBorrador(datos), true);
});

test('avisa si no hay encabezado', () => {
	const { problemas } = leerFrontmatter('Solo texto');
	assert.equal(problemas.length, 1);
	assert.match(problemas[0], /encabezado/);
});

test('avisa si estado o borrador tienen un valor que no se entiende', () => {
	const a = leerFrontmatter(md(['estado: Borrador!']));
	assert.equal(a.problemas.length, 1);
	assert.match(a.problemas[0], /estado/);
	const b = leerFrontmatter(md(['borrador: si']));
	assert.equal(b.problemas.length, 1);
	assert.match(b.problemas[0], /borrador/);
	const c = leerFrontmatter(md(['estado: >', '  borrador']));
	assert.equal(c.problemas.length, 1);
});

test('avisa si una línea del encabezado no tiene forma clave: valor', () => {
	const { problemas } = leerFrontmatter(md(['estado borrador']));
	assert.equal(problemas.length, 1);
	assert.match(problemas[0], /línea/);
});

test('las listas y los objetos anidados (sangría) no son un problema', () => {
	const { problemas } = leerFrontmatter(
		md(['caminos: [logistica, tecnico]', 'resultado:', '  cifra: "1"', 'stack: ["a", "b"]', 'estado: publicado']),
	);
	assert.deepEqual(problemas, []);
});

// --- leerPrueba: el extracto de prueba (bloque literal) de una demo ---
import { leerPrueba } from './frontmatter.mjs';

const conPrueba = (extra = []) =>
	md([
		'titulo: "Demo"',
		'prueba:',
		'  archivo: "tests/a.test.ts"',
		'  desde: 255',
		'  hasta: 257',
		'  codigo: |',
		'    it("x", () => {',
		'      expect(1).toBe(1); // # no es comentario aquí',
		'    });',
		'  autoria: "La regla la definí yo; la prueba la escribió la IA y yo la revisé."',
		...extra,
	]);

test('leerPrueba: lee archivo, rango, código literal (con su sangría relativa) y autoría', () => {
	const { prueba, problemas } = leerPrueba(conPrueba(['estado: publicado']));
	assert.deepEqual(problemas, []);
	assert.deepEqual(prueba, {
		archivo: 'tests/a.test.ts',
		desde: 255,
		hasta: 257,
		codigo: 'it("x", () => {\n  expect(1).toBe(1); // # no es comentario aquí\n});',
		autoria: 'La regla la definí yo; la prueba la escribió la IA y yo la revisé.',
	});
});

test('leerPrueba: sin bloque prueba no hay prueba ni problemas', () => {
	assert.deepEqual(leerPrueba(md(['titulo: "x"'])), { prueba: undefined, problemas: [] });
});

test('leerPrueba: CRLF también se lee', () => {
	const { prueba } = leerPrueba(conPrueba().replace(/\n/g, '\r\n'));
	assert.equal(prueba?.desde, 255);
	assert.equal(prueba?.codigo.split('\n').length, 3);
});

test('leerPrueba: avisa si falta un campo o el código no es un bloque literal', () => {
	const sinDesde = leerPrueba(conPrueba().replace('  desde: 255\n', ''));
	assert.equal(sinDesde.prueba, undefined);
	assert.match(sinDesde.problemas.join('|'), /desde/);
	const plano = leerPrueba(conPrueba().replace('codigo: |', 'codigo: >'));
	assert.equal(plano.prueba, undefined);
	assert.match(plano.problemas.join('|'), /codigo/);
});

test('leerPrueba: lee el commit si viene, y lo rechaza si no es un hash', () => {
	const ok = leerPrueba(conPrueba(['  commit: "a42985a"']));
	assert.deepEqual(ok.problemas, []);
	assert.equal(ok.prueba?.commit, 'a42985a');
	assert.equal(leerPrueba(conPrueba()).prueba?.commit, undefined);
	const mal = leerPrueba(conPrueba(['  commit: "main; rm -rf"']));
	assert.equal(mal.prueba, undefined);
	assert.match(mal.problemas.join('|'), /commit/);
});

test('leerPrueba: una línea del código con menos sangría que la primera avisa en vez de cortar en silencio', () => {
	const texto = conPrueba().replace('      expect(1).toBe(1);', '   expect(1).toBe(1);');
	const { prueba, problemas } = leerPrueba(texto);
	assert.equal(prueba, undefined);
	assert.match(problemas.join('|'), /sangría/);
	assert.match(problemas.join('|'), /expect/);
});

test('leerPrueba: el código puede tener más sangría que 4 (como YAML, la fija la primera línea)', () => {
	const texto = conPrueba()
		.split('\n')
		.map((l) => (l.startsWith('    ') && !l.startsWith('  autoria') ? '  ' + l : l))
		.join('\n');
	const { prueba, problemas } = leerPrueba(texto);
	assert.deepEqual(problemas, []);
	assert.equal(prueba?.codigo, 'it("x", () => {\n  expect(1).toBe(1); // # no es comentario aquí\n});');
});

test('leerPrueba: una tabulación como sangría del código también avisa', () => {
	const { prueba, problemas } = leerPrueba(conPrueba().replace('      expect(1)', '\texpect(1)'));
	assert.equal(prueba, undefined);
	assert.match(problemas.join('|'), /sangría/);
});

test('leerPrueba: codigo sin ninguna línea con texto avisa', () => {
	const texto = md(['prueba:', '  archivo: "a.ts"', '  desde: 1', '  hasta: 1', '  codigo: |', '  autoria: "x"']);
	const { prueba, problemas } = leerPrueba(texto);
	assert.equal(prueba, undefined);
	assert.match(problemas.join('|'), /codigo/);
});

// --- leerBloque: un objeto de un nivel (`resultado:`, con sangría de dos espacios) ---
import { leerBloque } from './frontmatter.mjs';

test('leerBloque: lee las claves con sangría de un bloque, sin comillas ni comentarios', () => {
	const texto = md(['titulo: "Caso"', 'resultado:', '  cifra: "40 → 300+"', '  unidad: facturas por jornada # sin comillas', '  medicion: \'Medido en octubre; "no" es el máximo.\'', 'destacado: true']);
	assert.deepEqual(leerBloque(texto, 'resultado'), {
		cifra: '40 → 300+',
		unidad: 'facturas por jornada',
		medicion: 'Medido en octubre; "no" es el máximo.',
	});
});

test('leerBloque: sin el bloque, o sin encabezado, devuelve un objeto vacío', () => {
	assert.deepEqual(leerBloque(md(['titulo: "Caso"']), 'resultado'), {});
	assert.deepEqual(leerBloque('Solo texto', 'resultado'), {});
});

test('leerBloque: se detiene en la próxima clave sin sangría', () => {
	assert.deepEqual(leerBloque(md(['resultado:', '  cifra: "1"', 'autoria:', '  yo: "a"']), 'resultado'), { cifra: '1' });
});
