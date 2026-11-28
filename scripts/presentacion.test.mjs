// Tests de las reglas de presentación (src/lib/presentacion.ts y sitio.ts). Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	rotuloCaso,
	listaConY,
	cantidad,
	descripcionProyectos,
	bajadaProyectos,
	inventarioTecnico,
	textoEstadoDemo,
} from '../src/lib/presentacion.ts';
import { mailto } from '../src/lib/sitio.ts';

test('rótulo de caso según los caminos', () => {
	assert.equal(rotuloCaso(['logistica']), 'Caso · Logística');
	assert.equal(rotuloCaso(['logistica', 'tecnico']), 'Caso · Logística · Técnico e IA');
});

test('lista con "y" final', () => {
	assert.equal(listaConY([]), '');
	assert.equal(listaConY(['a']), 'a');
	assert.equal(listaConY(['a', 'b']), 'a y b');
	assert.equal(listaConY(['a', 'b', 'c']), 'a, b y c');
});

test('mailto: sin datos es el correo; con asunto y cuerpo, codificados', () => {
	assert.equal(mailto(), 'mailto:contacto@matiasormeno.com.ar');
	assert.equal(mailto('Hola mundo', 'ñ: sí'), 'mailto:contacto@matiasormeno.com.ar?subject=Hola%20mundo&body=%C3%B1%3A%20s%C3%AD');
});

test('cantidad con artículo o número según corresponda', () => {
	assert.equal(cantidad(1, 'un juego', 'juegos'), 'un juego');
	assert.equal(cantidad(1, 'una novela', 'novelas'), 'una novela');
	assert.equal(cantidad(2, 'una novela', 'novelas'), 'dos novelas');
	assert.equal(cantidad(3, 'un juego', 'juegos'), 'tres juegos');
	assert.equal(cantidad(12, 'un juego', 'juegos'), '12 juegos');
});

test('descripción de proyectos: solo lo que hay publicado', () => {
	assert.equal(descripcionProyectos([]), '');
	assert.equal(descripcionProyectos(['juego']), 'un juego');
	assert.equal(descripcionProyectos(['juego', 'novela']), 'una novela y un juego');
	assert.equal(descripcionProyectos(['novela', 'juego', 'otro']), 'una novela, un juego y un proyecto');
	assert.equal(descripcionProyectos(['juego', 'juego']), 'dos juegos');
});

test('bajada de proyectos: "comparten mundo" solo si están la novela y el juego', () => {
	assert.equal(bajadaProyectos(['juego']), 'Lo que hago fuera del trabajo: un juego.');
	assert.equal(
		bajadaProyectos(['novela', 'juego']),
		'Lo que hago fuera del trabajo: una novela y un juego que comparten mundo.',
	);
	assert.equal(bajadaProyectos([]), 'Lo que hago fuera del trabajo.');
});

test('texto del estado de una demo', () => {
	assert.equal(textoEstadoDemo('en-vivo'), 'en vivo');
	assert.equal(textoEstadoDemo('en-desarrollo'), 'en desarrollo');
});

test('inventario del camino técnico, armado con lo publicado', () => {
	assert.equal(inventarioTecnico(0, []), '');
	assert.equal(inventarioTecnico(1, []), 'un caso real anonimizado');
	assert.equal(
		inventarioTecnico(1, ['en-desarrollo']),
		'un caso de estudio anonimizado y una demo en desarrollo, con datos ficticios',
	);
	assert.equal(inventarioTecnico(0, ['en-vivo']), 'una demo en vivo, con datos ficticios');
	assert.equal(
		inventarioTecnico(2, ['en-vivo', 'en-desarrollo', 'en-desarrollo']),
		'dos casos de estudio anonimizados, una demo en vivo y dos demos en desarrollo, con datos ficticios',
	);
});

// --- inventarioPublicado: la cantidad sale de lo publicable, no de un número escrito a mano ---
import { inventarioPublicado } from '../src/lib/presentacion.ts';

const caso = (estado, caminos = ['tecnico']) => ({ data: { estado, caminos } });
const demo = (estado, borrador = false) => ({ data: { estado, borrador } });
const ochoCasos = [
	caso('publicado'),
	...Array.from({ length: 7 }, () => caso('borrador')),
];

test('con un solo caso publicado de ocho, dice "un caso" y nunca un número que no es', () => {
	const texto = inventarioPublicado(ochoCasos, [], false);
	assert.equal(texto, 'un caso real anonimizado');
	assert.doesNotMatch(texto, /seis|siete|ocho|\d/);
});

test('con dos o más casos publicados, plural con número', () => {
	assert.equal(inventarioPublicado([caso('publicado'), caso('publicado'), caso('borrador')], [], false), 'dos casos reales anonimizados');
	const seis = Array.from({ length: 6 }, () => caso('publicado'));
	assert.equal(inventarioPublicado(seis, [], false), 'seis casos reales anonimizados');
});

test('solo cuentan los casos del camino técnico', () => {
	assert.equal(inventarioPublicado([caso('publicado', ['logistica']), caso('publicado', ['logistica', 'tecnico'])], [], false), 'un caso real anonimizado');
	assert.equal(inventarioPublicado([caso('publicado', ['logistica'])], [], false), '');
});

test('en desarrollo (npm run dev) se ve todo, como las páginas', () => {
	assert.equal(inventarioPublicado(ochoCasos, [], true), 'ocho casos reales anonimizados');
});

test('las demos: no cuentan borradores ni las que están en preparación', () => {
	const demos = [demo('en-desarrollo'), demo('en-vivo', true), demo('en-preparacion'), demo('en-preparacion')];
	assert.equal(inventarioPublicado([], demos, false), 'una demo en desarrollo, con datos ficticios');
});

test('un caso y una demo: singular en los dos', () => {
	assert.equal(
		inventarioPublicado(ochoCasos, [demo('en-desarrollo')], false),
		'un caso de estudio anonimizado y una demo en desarrollo, con datos ficticios',
	);
});

test('sin nada publicado, texto vacío (la página omite la frase)', () => {
	assert.equal(inventarioPublicado([caso('borrador')], [demo('en-preparacion')], false), '');
});

// La portada cuenta los casos de los dos caminos (camino = null); el camino técnico, solo los suyos.
test('inventarioPublicado: la portada (camino null) cuenta todos los casos publicados', () => {
	const c = (caminos) => ({ data: { estado: 'publicado', caminos } });
	const casos = [c(['logistica']), c(['tecnico']), c(['logistica', 'tecnico'])];
	assert.equal(inventarioPublicado(casos, [], false, 'es', null), 'tres casos reales anonimizados');
	assert.equal(inventarioPublicado(casos, [], false), 'dos casos reales anonimizados');
});
