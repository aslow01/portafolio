// Decisiones del script de las fichas que no necesitan navegador (src/lib/paginas.ts). Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRACIA_FONDO_MS, cierraPorFondo, fueEmpujada, imagenRota, paginaDelHash, paginaGuardada, tituloConNombre } from '../src/lib/paginas.ts';

const ids = ['tapa', 'el-caso', 'como-trabajo', 'que-hice-yo'];

test('el hash abre la página cuyo id coincide, con o sin el numeral', () => {
	assert.equal(paginaDelHash('#tapa', ids), 0);
	assert.equal(paginaDelHash('#el-caso', ids), 1);
	assert.equal(paginaDelHash('el-caso', ids), 1);
	assert.equal(paginaDelHash('#que-hice-yo', ids), 3);
});

test('un hash vacío, de otra cosa o mal escrito no abre ninguna página (se queda en la primera)', () => {
	assert.equal(paginaDelHash('', ids), -1);
	assert.equal(paginaDelHash('#', ids), -1);
	assert.equal(paginaDelHash('#tecnico', ids), -1);
	assert.equal(paginaDelHash('#EL-CASO', ids), -1);
	assert.equal(paginaDelHash('#%E0%A4%A', ids), -1, 'una secuencia % inválida no rompe');
});

test('el hash se decodifica y una página sin id nunca coincide', () => {
	assert.equal(paginaDelHash('#el%2Dcaso', ids), 1);
	assert.equal(paginaDelHash('#', ['', 'a']), -1);
	assert.equal(paginaDelHash('#a', ['', 'a']), 1);
	assert.equal(paginaDelHash('#a', []), -1);
});

test('una foto está rota solo cuando terminó de cargar y no tiene ancho', () => {
	assert.equal(imagenRota({ complete: true, naturalWidth: 0 }), true);
	assert.equal(imagenRota({ complete: true, naturalWidth: 767 }), false);
	assert.equal(imagenRota({ complete: false, naturalWidth: 0 }), false, 'una foto diferida (lazy) que todavía no pidió');
});

test('el título del documento: «<título> | <nombre>», sin repetir el nombre si el título ya empieza con él', () => {
	assert.equal(tituloConNombre('Técnico e IA', 'Ana Pérez'), 'Técnico e IA | Ana Pérez');
	assert.equal(tituloConNombre('Logística y minería', 'Ana Pérez'), 'Logística y minería | Ana Pérez');
	assert.equal(tituloConNombre('Ana Pérez · logística minera', 'Ana Pérez'), 'Ana Pérez · logística minera');
});

test('una hoja se cierra por el fondo solo si el toque empezó y terminó en el fondo y ya pasó el primer instante (doble clic)', () => {
	const ok = { enFondo: true, empezoEnFondo: true, msDesdeApertura: GRACIA_FONDO_MS + 1 };
	assert.equal(cierraPorFondo(ok), true);
	assert.equal(cierraPorFondo({ ...ok, msDesdeApertura: 80 }), false, 'el segundo clic de un doble clic cae sobre el fondo');
	assert.equal(cierraPorFondo({ ...ok, msDesdeApertura: GRACIA_FONDO_MS }), true, 'justo en el límite ya vale');
	assert.equal(cierraPorFondo({ ...ok, enFondo: false }), false, 'un clic dentro de la hoja no la cierra');
	assert.equal(cierraPorFondo({ ...ok, empezoEnFondo: false }), false, 'arrastrar desde adentro y soltar afuera no la cierra');
});

test('«empujada»: una entrada del historial que abrió una ficha lo recuerda aunque la página se recargue', () => {
	assert.equal(fueEmpujada({ ficha: 'demos', empujada: true }), true);
	assert.equal(fueEmpujada({ ficha: 'demos', empujada: false }), false);
	assert.equal(fueEmpujada({ ficha: 'demos' }), false);
	assert.equal(fueEmpujada(null), false);
	assert.equal(fueEmpujada(undefined), false);
	assert.equal(fueEmpujada('empujada'), false);
	assert.equal(fueEmpujada({ empujada: 'si' }), false, 'solo un true de verdad');
});

test('la página guardada en el historial: solo la de la misma ficha y dentro del total; si no, la primera', () => {
	assert.equal(paginaGuardada({ ficha: 'logistica', empujada: true, pagina: 3 }, 'logistica', 5), 3);
	assert.equal(paginaGuardada({ ficha: 'logistica', pagina: 0 }, 'logistica', 5), 0);
	assert.equal(paginaGuardada({ ficha: 'logistica', pagina: 4 }, 'logistica', 5), 4, 'la última página vale');
	assert.equal(paginaGuardada({ ficha: 'logistica', pagina: 5 }, 'logistica', 5), 0, 'una más que el total no existe');
	assert.equal(paginaGuardada({ ficha: 'logistica', pagina: -1 }, 'logistica', 5), 0);
	assert.equal(paginaGuardada({ ficha: 'logistica', pagina: 1.5 }, 'logistica', 5), 0);
	assert.equal(paginaGuardada({ ficha: 'logistica', pagina: '3' }, 'logistica', 5), 0, 'solo un número de verdad');
	assert.equal(paginaGuardada({ ficha: 'demos', pagina: 3 }, 'logistica', 5), 0, 'la página es de otra ficha');
	assert.equal(paginaGuardada({ pagina: 3 }, 'logistica', 5), 0);
	assert.equal(paginaGuardada(null, 'logistica', 5), 0);
	assert.equal(paginaGuardada(undefined, 'logistica', 5), 0);
	assert.equal(paginaGuardada('3', 'logistica', 5), 0);
});
