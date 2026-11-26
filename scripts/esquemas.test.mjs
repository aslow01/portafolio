// Tests de los esquemas compartidos (src/lib/esquemas.ts). Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlHttps } from '../src/lib/esquemas.ts';

test('una dirección https es válida', () => {
	assert.equal(urlHttps.safeParse('https://github.com/aslow01/portafolio').success, true);
});

test('solo https: http, javascript, data, mailto y ftp se rechazan', () => {
	for (const url of [
		'http://ejemplo.com',
		'javascript:alert(1)',
		'data:text/html,<b>x</b>',
		'mailto:a@b.com',
		'ftp://ejemplo.com/x',
		'//ejemplo.com',
		'no es una url',
		'',
	]) {
		assert.equal(urlHttps.safeParse(url).success, false, url);
	}
});

// --- Láminas y extracto de prueba de las demos ---
import { z } from 'astro/zod';
import { avisoDemo, crearLamina, laminas, prueba } from '../src/lib/esquemas.ts';

// En el sitio `clara` es el `image()` de Astro; acá alcanza con un string. Solo hay tema claro.
const lamina = crearLamina(z.string());
const laminaOk = {
	id: 'resultado',
	clara: 'clara.png',
	alt: 'Resultado de la conciliación con el ejemplo completo.',
	pie: 'Así se ve lo que falta cargar.',
	procedencia: 'Captura de la demo propia, datos ficticios.',
};

test('lámina: con todos los campos obligatorios es válida (sin captura oscura: solo hay tema claro)', () => {
	assert.equal(lamina.safeParse(laminaOk).success, true);
});

test('lámina: el recorte para celular (movil) es opcional y exige su versión clara', () => {
	assert.equal(lamina.safeParse({ ...laminaOk, movil: { clara: 'm.png' } }).success, true);
	assert.equal(lamina.safeParse({ ...laminaOk, movil: {} }).success, false);
});

test('lámina: sin alt (o con alt vacío) falla; también sin pie o sin procedencia', () => {
	for (const campo of ['alt', 'pie', 'procedencia', 'clara', 'id']) {
		const { [campo]: _, ...sin } = laminaOk;
		assert.equal(lamina.safeParse(sin).success, false, `sin ${campo}`);
	}
	assert.equal(lamina.safeParse({ ...laminaOk, alt: '   ' }).success, false);
});

test('lámina: el id es un identificador (minúsculas, números y guiones)', () => {
	assert.equal(lamina.safeParse({ ...laminaOk, id: 'Resultado final' }).success, false);
	assert.equal(lamina.safeParse({ ...laminaOk, id: 'celular-360' }).success, true);
});

test('laminas: puede ser una lista vacía, y los id no se repiten', () => {
	const lista = laminas(z.string());
	assert.equal(lista.safeParse([]).success, true);
	assert.equal(lista.safeParse([laminaOk, { ...laminaOk, id: 'celular' }]).success, true);
	assert.equal(lista.safeParse([laminaOk, laminaOk]).success, false);
});

const pruebaOk = {
	archivo: 'tests/conciliacion.test.ts',
	desde: 255,
	hasta: 257,
	codigo: 'it("x", () => {\n  expect(1).toBe(1);\n});',
	autoria: 'La regla la definí yo; la prueba la escribió la IA y yo la revisé.',
	regla: 'Si el importe difiere, la factura no cuenta como cargada.',
	queDice: 'Mil contra mil con un centavo es otro importe.',
	titular: 'El importe se compara sin tolerancia',
};

test('prueba: un extracto coherente es válido', () => {
	assert.equal(prueba.safeParse(pruebaOk).success, true);
});

test('prueba: la cantidad de líneas del código tiene que ser la del rango declarado', () => {
	assert.equal(prueba.safeParse({ ...pruebaOk, hasta: 256 }).success, false);
	assert.equal(prueba.safeParse({ ...pruebaOk, hasta: 258 }).success, false);
	// Una línea final vacía de más (típica del bloque `|` de YAML) no cuenta.
	assert.equal(prueba.safeParse({ ...pruebaOk, codigo: pruebaOk.codigo + '\n' }).success, true);
});

test('prueba: el rango es válido (desde >= 1, hasta >= desde, enteros)', () => {
	assert.equal(prueba.safeParse({ ...pruebaOk, desde: 0, hasta: 2 }).success, false);
	assert.equal(prueba.safeParse({ ...pruebaOk, desde: 257, hasta: 255 }).success, false);
	assert.equal(prueba.safeParse({ ...pruebaOk, desde: 1.5, hasta: 3.5 }).success, false);
});

test('prueba: la ruta es relativa al repositorio, sin subir de carpeta ni letras de unidad', () => {
	for (const archivo of ['../secreto.ts', 'tests/../../x.ts', '/etc/passwd', 'C:\\x.ts', 'tests\\a.ts', 'https://x.com/a.ts', '']) {
		assert.equal(prueba.safeParse({ ...pruebaOk, archivo }).success, false, archivo);
	}
});

test('prueba: sin línea de autoría o con código vacío o demasiado largo falla', () => {
	assert.equal(prueba.safeParse({ ...pruebaOk, autoria: '' }).success, false);
	const { autoria: _, ...sinAutoria } = pruebaOk;
	assert.equal(prueba.safeParse(sinAutoria).success, false);
	assert.equal(prueba.safeParse({ ...pruebaOk, codigo: '' }).success, false);
	const largo = Array.from({ length: 40 }, () => 'x').join('\n');
	assert.equal(prueba.safeParse({ ...pruebaOk, desde: 1, hasta: 40, codigo: largo }).success, false);
});

test('prueba: la regla, lo que dice la prueba y el titular son obligatorios y no pueden estar en blanco', () => {
	for (const campo of ['regla', 'queDice', 'titular']) {
		const { [campo]: _, ...sin } = pruebaOk;
		assert.equal(prueba.safeParse(sin).success, false, `sin ${campo}`);
		assert.equal(prueba.safeParse({ ...pruebaOk, [campo]: '   ' }).success, false, `${campo} en blanco`);
	}
});

test('prueba: un código de solo espacios o tabulaciones no es un extracto', () => {
	assert.equal(prueba.safeParse({ ...pruebaOk, desde: 1, hasta: 1, codigo: '   ' }).success, false);
	assert.equal(prueba.safeParse({ ...pruebaOk, desde: 1, hasta: 2, codigo: '\t\n\t' }).success, false);
});

test('prueba: el commit es opcional y, si viene, es un hash de git', () => {
	assert.equal(prueba.safeParse({ ...pruebaOk, commit: 'a42985a' }).success, true);
	assert.equal(prueba.safeParse({ ...pruebaOk, commit: 'a42985a1c0ffee00a42985a1c0ffee00a42985a1' }).success, true);
	for (const commit of ['', 'main', 'a42985', 'A42985A', 'a42985a; rm -rf', 'g42985a', 'a'.repeat(41)]) {
		assert.equal(prueba.safeParse({ ...pruebaOk, commit }).success, false, commit);
	}
});

test('avisoDemo: una línea de texto corta; en blanco o muy larga falla', () => {
	assert.equal(avisoDemo.safeParse('Interfaz en rediseño').success, true);
	assert.equal(avisoDemo.safeParse('   ').success, false);
	assert.equal(avisoDemo.safeParse('').success, false);
	assert.equal(avisoDemo.safeParse('a'.repeat(121)).success, false);
	assert.equal(avisoDemo.safeParse(undefined).success, false);
});
