// Higiene del sitio: qué NO puede aparecer en el código ni en lo que se publica. Funciones puras (sin leer
// archivos), que usan scripts/higiene.test.mjs y otras pruebas. Se prueban en scripts/higiene.test.mjs.
//
// Este repositorio es público, así que el nombre de la empresa empleadora y sus dominios NO están escritos acá,
// ni en claro ni como hash (un hash de una palabra corta se adivina en segundos). Van en el archivo
// `scripts/higiene.local.json`, que está en .gitignore y no se sube. `npm run prepublicar` exige que exista:
//   { "palabras": ["nombre-de-la-empresa", "dominio-de-ejemplo.com"], "expresiones": ["cliente[-_ ]?uno"] }
// `palabras` se busca tal cual (sin distinguir mayúsculas ni acentos); `expresiones` son expresiones regulares.

/** Minúsculas y sin acentos. */
const plano = (t) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Solo dígitos. */
const digitos = (t) => t.replace(/\D/g, '');

// Separador entre grupos de un número: espacio, espacio duro (U+00A0), punto o guion.
const SEP = '[\\s\\u00A0.-]*';
const TELEFONOS = [
	// Con código de país: +54 9 264 000 0000, 549264..., 54 264 ...
	new RegExp(`(?<!\\d)\\+?54${SEP}9?${SEP}\\d{2,4}${SEP}\\d{3,4}${SEP}\\d{4}(?!\\d)`, 'g'),
	// Celular con 15: 0264 15 000 0000, 264-15-0000000
	new RegExp(`(?<!\\d)0?\\d{3,4}[\\s\\u00A0-]15${SEP}\\d{2,4}${SEP}\\d{3,4}(?!\\d)`, 'g'),
	// Enlaces tel: y wa.me, aunque el número tenga otra forma
	/tel:\+?[\d\s-]{6,}/g,
	/wa\.me\/\d{6,}/g,
];

/**
 * Teléfonos que aparecen en un texto, salvo el público (`permitido`, solo dígitos, p. ej. '5492645624917').
 * Devuelve los dígitos hallados.
 */
export function telefonosEn(texto, permitido) {
	const hallados = [];
	for (const re of TELEFONOS) {
		for (const m of texto.matchAll(re)) {
			const d = digitos(m[0]);
			if (permitido && d.length > 0 && (permitido === d || permitido.endsWith(d))) continue;
			hallados.push(d);
		}
	}
	return hallados;
}

// CUIT/CUIL: prefijo 20, 23, 24, 25, 26, 27, 30, 33 o 34, ocho dígitos y verificador; con o sin guiones.
const CUIT = /(?<!\d)(?:20|23|24|25|26|27|30|33|34)[\s-]?\d{8}[\s-]?\d(?!\d)/g;

/**
 * Datos privados en un texto (`@gmail`, CUIT/CUIL, teléfonos y lo que diga el archivo local: empresa, dominios, nombres).
 * Devuelve una lista de descripciones; vacía si el texto está limpio.
 * @param {string} texto
 * @param {{ telefonoPermitido?: string, extra?: { palabras?: string[], expresiones?: string[] } }} [opciones]
 */
export function datosPrivados(texto, opciones = {}) {
	const { telefonoPermitido, extra = {} } = opciones;
	const hallazgos = [];
	if (/@gmail/i.test(texto)) hallazgos.push('correo @gmail');
	for (const m of texto.matchAll(CUIT)) hallazgos.push(`CUIT o CUIL: ${m[0]}`);
	for (const d of telefonosEn(texto, telefonoPermitido)) hallazgos.push(`teléfono: ${d}`);
	const textoPlano = plano(texto);
	for (const p of extra.palabras ?? []) {
		if (textoPlano.includes(plano(p))) hallazgos.push('palabra prohibida del archivo local');
	}
	for (const e of extra.expresiones ?? []) {
		if (new RegExp(e, 'i').test(texto)) hallazgos.push('expresión prohibida del archivo local');
	}
	return hallazgos;
}

/**
 * Lo que no puede haber en el HTML y el CSS publicados (CSP sin 'unsafe-inline'). El único JavaScript permitido es el
 * propio, externo y servido desde el mismo origen: `<script src="/ruta.js">` sin contenido adentro.
 */
export function problemasDeDist(ruta, texto) {
	const hallazgos = [];
	const esHtml = ruta.endsWith('.html');
	texto = texto.replace(BEACON, '');
	if (esHtml) {
		if (/\sstyle\s*=/i.test(texto)) hallazgos.push('atributo style=');
		if (/<style[\s>]/i.test(texto)) hallazgos.push('etiqueta <style');
		hallazgos.push(...problemasDeScripts(texto));
		if (/\bhref\s*=\s*["']?\s*javascript:/i.test(texto)) hallazgos.push('enlace javascript:');
		if (/\son[a-z]+\s*=/i.test(texto)) hallazgos.push('manejador de evento en línea (on…=)');
		if (/\b(?:src|srcset|action)\s*=\s*["']?(?:https?:)?\/\//i.test(texto)) hallazgos.push('recurso de otro origen (src, srcset o action)');
		for (const m of texto.matchAll(/<link\b[^>]*>/gi)) {
			if (/rel\s*=\s*["']?(?:stylesheet|preload|preconnect|dns-prefetch|prefetch|modulepreload)/i.test(m[0]) && /href\s*=\s*["']?(?:https?:)?\/\//i.test(m[0])) {
				hallazgos.push(`<link> a otro origen: ${m[0].slice(0, 80)}`);
			}
		}
	}
	if (esHtml || ruta.endsWith('.css')) {
		if (/(?:src|href)\s*=\s*["']?data:|url\(\s*["']?data:/i.test(texto)) hallazgos.push('URI data:');
	}
	return hallazgos;
}

// Una etiqueta <script> con sus atributos (las comillas pueden contener `>`) y lo que hay hasta su cierre.
const SCRIPT = /<script(?=[\s>])((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)(?:<\/script\s*>|$)/gi;
const SRC = /(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/i;

// La única excepción: el beacon de Cloudflare Web Analytics (visitas sin cookies), con ese src exacto y sin contenido en línea.
// public/_headers admite solo ese origen en script-src, y scripts/cabeceras.test.mjs lo prueba.
const BEACON = /<script\b(?:\s+(?:is:inline|defer))*\s+src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js"(?:\s+data-cf-beacon=(?:'\{"token": "[0-9a-f]{32}"\}'|"\{&quot;token&quot;: &quot;[0-9a-f]{32}&quot;\}"))?\s*><\/script>/g;

/** Un `<script>` vale solo si es externo, del mismo origen (ruta relativa o absoluta del sitio) y sin contenido. Salvo el beacon. */
function problemasDeScripts(html) {
	const hallazgos = [];
	for (const m of html.matchAll(SCRIPT)) {
		const src = SRC.exec(m[1]);
		const valor = (src?.[1] ?? src?.[2] ?? src?.[3] ?? '').trim();
		if (!src || valor === '') hallazgos.push('<script> sin src (en línea)');
		else if (valor.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(valor)) hallazgos.push(`<script> con src de otro origen o con esquema: ${valor.slice(0, 60)}`);
		if (m[2].trim() !== '') hallazgos.push('<script> con contenido en línea');
	}
	return hallazgos;
}

/**
 * Búsquedas sobre un archivo de `src/` que sostienen la CSP y la seguridad: nada de
 * estilos o scripts en línea, ni de fuentes de Google, ni de HTML armado con datos (`innerHTML` y parientes), ni de
 * código evaluado, ni de almacenamiento del navegador, ni de enlaces que abran otra pestaña, ni de «próximamente».
 * El `_ruta` se recibe para que el mensaje del que llama diga de qué archivo es; acá no se usa.
 */
export function problemasDeSrc(_ruta, texto) {
	const hallazgos = [];
	const ver = (descripcion, re) => {
		if (re.test(texto)) hallazgos.push(descripcion);
	};
	ver('style= (estilo en línea)', /\bstyle\s*=/);
	ver('is:inline (salvo el beacon de Cloudflare Web Analytics)', /is:inline(?![^>]*src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js")/);
	ver('define:vars', /define:vars/);
	ver('fuentes de Google', /fonts\.googleapis|fonts\.gstatic/);
	ver('HTML armado con datos (innerHTML, outerHTML o insertAdjacentHTML)', /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/);
	ver('document.write', /\bdocument\s*\.\s*write(?:ln)?\b/);
	ver('código evaluado (eval o new Function)', /\beval\s*\(|\bnew\s+Function\b/);
	ver('almacenamiento del navegador (localStorage o sessionStorage)', /\b(?:localStorage|sessionStorage)\b/);
	ver('enlace que abre otra pestaña (target="_blank")', /target\s*=\s*["']?_blank/i);
	ver('«próximamente» (la web no promete lo que no tiene)', /pr[óo]ximamente/i);
	return hallazgos;
}