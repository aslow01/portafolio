// Idiomas y direcciones (src/i18n/idioma.ts): el español en `/`, el inglés bajo `/en/`. Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alternas, idiomaDe, idiomaDeRuta, quitarPrefijo, rutaAlterna, rutaDe, traductor } from '../src/i18n/idioma.ts';

test('idiomaDe: «en» (con o sin región) es inglés; todo lo demás, español', () => {
	assert.equal(idiomaDe('en'), 'en');
	assert.equal(idiomaDe('en-US'), 'en');
	assert.equal(idiomaDe('es'), 'es');
	assert.equal(idiomaDe('es-AR'), 'es');
	assert.equal(idiomaDe(undefined), 'es');
	assert.equal(idiomaDe('english'), 'es');
});

test('traductor: devuelve el texto del idioma pedido', () => {
	assert.equal(traductor('es')('Cerrar', 'Close'), 'Cerrar');
	assert.equal(traductor('en')('Cerrar', 'Close'), 'Close');
});

test('rutaDe: el español no cambia; el inglés suma /en, también en la portada y con hash', () => {
	assert.equal(rutaDe('es', '/'), '/');
	assert.equal(rutaDe('en', '/'), '/en/');
	assert.equal(rutaDe('es', '/tecnico/'), '/tecnico/');
	assert.equal(rutaDe('en', '/tecnico/'), '/en/tecnico/');
	assert.equal(rutaDe('en', '/casos/automatizacion-facturas/'), '/en/casos/automatizacion-facturas/');
	assert.equal(rutaDe('en', '/tecnico/#el-caso'), '/en/tecnico/#el-caso');
	assert.equal(rutaDe('en', '/#contacto'), '/en/#contacto');
	assert.throws(() => rutaDe('en', 'casos/'), /empezar con/);
});

test('rutaDe no duplica el prefijo', () => {
	assert.equal(rutaDe('en', '/en/tecnico/'), '/en/tecnico/');
	assert.equal(rutaDe('es', '/en/tecnico/'), '/tecnico/');
	assert.equal(rutaDe('en', '/entrevista/'), '/en/entrevista/', 'una ruta que solo empieza con «en» no es el prefijo');
});

test('quitarPrefijo e idiomaDeRuta', () => {
	assert.equal(quitarPrefijo('/en/'), '/');
	assert.equal(quitarPrefijo('/en'), '/');
	assert.equal(quitarPrefijo('/en/casos/'), '/casos/');
	assert.equal(quitarPrefijo('/casos/'), '/casos/');
	assert.equal(quitarPrefijo('/entrevista/'), '/entrevista/');
	assert.equal(idiomaDeRuta('/en/casos/'), 'en');
	assert.equal(idiomaDeRuta('/en'), 'en');
	assert.equal(idiomaDeRuta('/'), 'es');
	assert.equal(idiomaDeRuta('/entrevista/'), 'es');
});

test('rutaAlterna: la misma página en el otro idioma', () => {
	assert.equal(rutaAlterna('/en/casos/x/', 'es'), '/casos/x/');
	assert.equal(rutaAlterna('/casos/x/', 'en'), '/en/casos/x/');
	assert.equal(rutaAlterna('/', 'en'), '/en/');
	assert.equal(rutaAlterna('/en/', 'es'), '/');
});

test('alternas: direcciones absolutas de los dos idiomas', () => {
	assert.deepEqual(alternas('/tecnico/', 'https://matiasormeno.com.ar'), {
		es: 'https://matiasormeno.com.ar/tecnico/',
		en: 'https://matiasormeno.com.ar/en/tecnico/',
	});
	assert.deepEqual(alternas('/en/', new URL('https://matiasormeno.com.ar')), {
		es: 'https://matiasormeno.com.ar/',
		en: 'https://matiasormeno.com.ar/en/',
	});
});
