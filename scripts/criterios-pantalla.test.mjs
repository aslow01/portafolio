// Los topes de página de la web v5, en funciones puras. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGINAS_SIN_FICHA, TAMANOS, TOPE_ABSOLUTO, esPaginaSinFicha, paginasAMedir, problemaDeRazon, razonDeDocumento, rutasDeCasos, topeDeRazon } from './criterios-pantalla.mjs';

const tam = (nombre) => TAMANOS.find((t) => t.nombre === nombre);

test('topes por tamaño, tal como los fija la especificación', () => {
	assert.equal(topeDeRazon(tam('390x844')), 1.0);
	assert.equal(topeDeRazon(tam('768x1024')), 1.0);
	assert.equal(topeDeRazon(tam('1440x900')), 1.0);
	assert.equal(topeDeRazon(tam('360x740')), 1.02);
	assert.equal(topeDeRazon(tam('320x640')), 1.25);
	assert.equal(topeDeRazon(tam('844x390')), 1.5);
	assert.equal(TAMANOS.length, 6);
});

test('una página que entra justo no tiene problema; pasarse del tope sí, con el motivo', () => {
	assert.equal(problemaDeRazon(1.0, tam('390x844')), undefined);
	assert.equal(problemaDeRazon(1.004, tam('390x844')), undefined, 'redondeo de píxeles');
	assert.match(problemaDeRazon(1.05, tam('390x844')), /1,05|1\.05/);
	assert.equal(problemaDeRazon(1.02, tam('360x740')), undefined);
	assert.notEqual(problemaDeRazon(1.1, tam('360x740')), undefined);
	assert.equal(problemaDeRazon(1.25, tam('320x640')), undefined);
	assert.notEqual(problemaDeRazon(1.3, tam('320x640')), undefined);
	assert.equal(problemaDeRazon(1.46, tam('844x390')), undefined);
});

test('más de 1,50 no es aceptable en ningún tamaño', () => {
	for (const t of TAMANOS) assert.match(problemaDeRazon(TOPE_ABSOLUTO + 0.01, t), /nunca más de/, t.nombre);
});

// Entradas de dist/casos/ como las da readdirSync(…, { withFileTypes: true }).
const entrada = (name, carpeta) => ({ name, isDirectory: () => carpeta });

test('rutasDeCasos: solo las carpetas de dist/casos/ son casos; index.html (el índice) no', () => {
	const entradas = [entrada('index.html', false), entrada('uno', true), entrada('dos', true)];
	assert.deepEqual(rutasDeCasos(entradas), ['/casos/uno/', '/casos/dos/']);
	assert.deepEqual(rutasDeCasos([entrada('index.html', false)]), []);
});

test('las páginas sin ficha (el índice /casos/ y la 404) se miden como documento; las demás, por ficha', () => {
	assert.deepEqual([...PAGINAS_SIN_FICHA].sort(), ['/404.html', '/casos/']);
	assert.equal(esPaginaSinFicha('/casos/'), true);
	assert.equal(esPaginaSinFicha('/404.html'), true);
	assert.equal(esPaginaSinFicha('/casos/uno/'), false);
	assert.equal(esPaginaSinFicha('/tecnico/'), false);
	assert.equal(esPaginaSinFicha('/#logistica'), false);
});

test('razonDeDocumento: alto del documento ÷ alto visible, con los mismos topes; sin alto visible, infinito', () => {
	assert.equal(razonDeDocumento(844, 844), 1);
	assert.equal(razonDeDocumento(1266, 844), 1.5);
	assert.equal(razonDeDocumento(100, 0), Infinity);
	assert.equal(problemaDeRazon(razonDeDocumento(649, 640), tam('320x640')), undefined);
	assert.notEqual(problemaDeRazon(razonDeDocumento(900, 640), tam('320x640')), undefined);
});

test('paginasAMedir: el índice /casos/ va entre las ya conocidas, antes de los casos; la 404 al final', () => {
	const lista = paginasAMedir(['/casos/uno/', '/casos/dos/']);
	assert.deepEqual(lista, ['/#logistica', '/#tecnico', '/#demos', '/#proyectos', '/#contacto', '/tecnico/', '/casos/', '/casos/uno/', '/casos/dos/', '/404.html']);
});
