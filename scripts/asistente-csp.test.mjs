// El asistente y la política de contenido (public/_headers) tienen que ir juntos: un build con el asistente activo y unas
// cabeceras que lo bloquean no se puede publicar. Node puro: npm test (la parte de dist/ se saltea sin build; con
// `npm run prepublicar` es obligatoria).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cargarDist, conDist, RAIZ } from './dist.mjs';
import { directivasDeCsp, faltantesParaAsistente, ORIGEN_TURNSTILE } from './asistente/csp.mjs';

const API = 'https://asistente.matiasormeno.com.ar';
const BASE = "default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self'; frame-ancestors 'none'";
const ACTIVA = `default-src 'self'; script-src 'self' ${ORIGEN_TURNSTILE}; connect-src 'self' ${API} ${ORIGEN_TURNSTILE}; frame-src ${ORIGEN_TURNSTILE}; style-src 'self'`;

test('directivasDeCsp separa nombre y fuentes', () => {
	assert.deepEqual(directivasDeCsp("default-src 'self'; script-src 'self' https://a.example ;"), { 'default-src': ["'self'"], 'script-src': ["'self'", 'https://a.example'] });
});

test('con la política actual (solo self) el asistente no puede funcionar: faltan el Worker y Turnstile', () => {
	const faltan = faltantesParaAsistente(BASE, API);
	assert.equal(faltan.length, 4);
	assert.ok(faltan.some((f) => f.startsWith('connect-src sin https://asistente.matiasormeno.com.ar')));
	assert.ok(faltan.some((f) => f.startsWith('frame-src')), 'frame-src hereda de default-src (self): no admite Turnstile');
});

test('con el Worker y Turnstile en las directivas correctas no falta nada; un origen parecido no cuenta', () => {
	assert.deepEqual(faltantesParaAsistente(ACTIVA, API), []);
	assert.deepEqual(faltantesParaAsistente(ACTIVA.replace(API, 'https://*.matiasormeno.com.ar'), API), []);
	assert.equal(faltantesParaAsistente(ACTIVA.replace(API, 'https://asistente.matiasormeno.com.ar.malo.example'), API).length, 1);
	assert.equal(faltantesParaAsistente(ACTIVA.replace(`script-src 'self' ${ORIGEN_TURNSTILE}`, "script-src 'self'"), API).length, 1);
	// Sin frame-src propio, hereda de default-src: si default-src admite Turnstile alcanza.
	assert.deepEqual(faltantesParaAsistente(ACTIVA.replace(`frame-src ${ORIGEN_TURNSTILE}; `, '').replace("default-src 'self'", `default-src 'self' ${ORIGEN_TURNSTILE}`), API), []);
});

test('public/_headers deja funcionar al asistente en el Worker que declara worker/wrangler.toml (sin depender de dist/)', () => {
	const encabezados = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
	const csp = /^\s*Content-Security-Policy:\s*(.+)$/m.exec(encabezados)?.[1] ?? '';
	const toml = readFileSync(new URL('../worker/wrangler.toml', import.meta.url), 'utf8');
	const dominio = /pattern\s*=\s*"([a-z0-9.-]+)"\s*,\s*custom_domain\s*=\s*true/.exec(toml)?.[1];
	assert.equal(dominio, 'asistente.matiasormeno.com.ar');
	assert.deepEqual(faltantesParaAsistente(csp, `https://${dominio}`), []);
	const permitidos = /^ALLOWED_ORIGINS\s*=\s*"([^"]+)"/m.exec(toml)?.[1].split(',') ?? [];
	assert.ok(permitidos.includes('https://matiasormeno.com.ar') && permitidos.every((o) => o.startsWith('https://')), 'el Worker solo admite orígenes https de la web');
});
test('dist/: si el build monta el asistente contra un Worker real, public/_headers lo deja funcionar', conDist, () => {
	const { paginas } = cargarDist();
	const apis = new Set();
	for (const { html } of paginas.values()) {
		const raiz = /<div[^>]*\bid="consulta-raiz"[^>]*>/.exec(html)?.[0];
		if (!raiz || !/data-modo="real"/.test(raiz)) continue;
		const api = /data-api="([^"]+)"/.exec(raiz)?.[1];
		assert.ok(api, 'el marcador del asistente trae data-api');
		apis.add(api);
	}
	assert.ok(apis.size <= 1, 'todas las páginas apuntan al mismo Worker');
	if (apis.size === 0) return; // asistente apagado (el estado por defecto): nada que comprobar
	const encabezados = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
	const csp = /^\s*Content-Security-Policy:\s*(.+)$/m.exec(encabezados)?.[1] ?? '';
	assert.deepEqual(faltantesParaAsistente(csp, [...apis][0]), [], `el build monta el asistente en ${[...apis][0]} pero public/_headers (en ${RAIZ}) lo bloquearía`);
});
