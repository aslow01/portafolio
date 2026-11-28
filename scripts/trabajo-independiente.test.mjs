// «Trabajo independiente» (src/lib/trabajo-independiente.ts y la página 11 de /tecnico/): sin permiso del cliente no se muestra
// nada, la vista previa con datos ficticios solo existe en desarrollo y una entrada con permiso pero incompleta rompe la
// compilación en vez de ocultarse. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	problemasDeEntrada,
	trabajosAMostrar,
	trabajosIndependientes,
	trabajosVisibles,
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

test('los datos reales: cada web tiene su entrada, y las que no tienen permiso no se muestran', () => {
	assert.ok(trabajosIndependientes.length >= 4, 'faltan las cuatro webs');
	const ids = trabajosIndependientes.map((e) => e.id);
	assert.equal(new Set(ids).size, ids.length, 'ids repetidos');
	for (const e of trabajosIndependientes) assert.equal(typeof e.permisoCliente, 'boolean', `${e.id}: permisoCliente debe ser true o false`);
	assert.deepEqual(trabajosVisibles().map((e) => e.id), trabajosIndependientes.filter((e) => e.permisoCliente).map((e) => e.id));
	assert.doesNotThrow(() => trabajosVisibles(), 'una entrada con permiso quedó incompleta');
});

test('los títulos son genéricos: sin direcciones web, correos, teléfonos ni números', () => {
	for (const e of trabajosIndependientes) {
		for (const campo of [e.rubro, e.titulo, e.queSeHizo]) {
			assert.doesNotMatch(campo, /@|https?:|www\.|\.com|\.ar\b|\d/i, `${e.id}: «${campo}» parece traer un dato personal`);
		}
	}
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

test('dist: sin permisos, /tecnico/ no tiene la página ni rastro de los datos ficticios ni de las entradas', conDist, () => {
	if (trabajosVisibles().length > 0) return; // con permisos reales sí aparece: no hay nada que negar
	const dist = cargarDist();
	for (const [ruta, p] of dist.paginas) {
		assert.doesNotMatch(p.html, /Trabajo independiente|id="independiente"|ejemplo\.invalid|Ejemplo ficticio|Vista previa/i, `${ruta}: aparece la sección sin permisos`);
		for (const e of trabajosIndependientes) assert.ok(!p.html.includes(e.titulo), `${ruta}: aparece «${e.titulo}»`);
	}
});
