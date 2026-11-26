// Prueba la política de contenido de public/_headers (Cloudflare Pages). Node puro: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const texto = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
const csp = texto.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1] ?? '';
const directivas = Object.fromEntries(
	csp.split(';').map((d) => {
		const [nombre, ...valores] = d.trim().split(/\s+/);
		return [nombre, valores];
	}),
);

test('la política parte de default-src self y no permite estilos ni scripts en línea', () => {
	assert.deepEqual(directivas['default-src'], ["'self'"]);
	assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
	assert.deepEqual(directivas['style-src'], ["'self'"]);
});

test('sin analítica: script-src y connect-src quedan en self, sin orígenes de terceros', () => {
	assert.deepEqual(directivas['script-src'], ["'self'"]);
	assert.deepEqual(directivas['connect-src'], ["'self'"]);
	assert.doesNotMatch(csp, /cloudflareinsights/);
	for (const [nombre, valores] of Object.entries(directivas)) {
		assert.ok(valores.every((v) => v.startsWith("'") || !v.includes('//')), `${nombre} no admite orígenes externos`);
	}
	assert.deepEqual(directivas['frame-ancestors'], ["'none'"]);
	assert.deepEqual(directivas['object-src'], ["'none'"]);
});

test('aísla la ventana: Cross-Origin-Opener-Policy same-origin', () => {
	assert.match(texto, /^\s*Cross-Origin-Opener-Policy:\s*same-origin$/m);
});

test('lleva las demás cabeceras de seguridad', () => {
	assert.match(texto, /^\s*X-Content-Type-Options:\s*nosniff$/m);
	assert.match(texto, /^\s*Referrer-Policy:\s*\S+/m);
	assert.match(texto, /^\s*Permissions-Policy:\s*\S+/m);
});

test('los archivos con nombre por contenido o por versión se guardan para siempre', () => {
	assert.match(texto, /^\/_astro\/\*\s*\n\s+Cache-Control:\s*public, max-age=31536000, immutable$/m);
	assert.match(texto, /^\/fonts\/\*\s*\n\s+Cache-Control:\s*public, max-age=31536000, immutable$/m);
	// Las imágenes para compartir llevan la huella de su contenido en el nombre (scripts/og/generar.mjs).
	assert.match(texto, /^\/og\/\*\s*\n\s+Cache-Control:\s*public, max-age=31536000, immutable$/m);
});
