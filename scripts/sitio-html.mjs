// Funciones puras para revisar el HTML que genera el sitio (dist/): leen texto, no archivos ni navegador, así que se
// prueban con páginas de juguete (scripts/sitio-html.test.mjs) y se aplican al dist/ real en scripts/estructura-v5.test.mjs.
// No es un analizador de HTML completo: lee las etiquetas de apertura que Astro genera (atributos entre comillas),
// ignora comentarios y el interior de <script> y <style>. Entrada hostil o mal formada: no se interpreta, solo se busca.

const ENTIDADES = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': '\u00A0' };
const decodificar = (t) => t.replace(/&(?:amp|quot|#39|lt|gt|nbsp);/g, (e) => ENTIDADES[e]);

const ATRIBUTOS_ETIQUETA = '((?:[^>"\']|"[^"]*"|\'[^\']*\')*)';
const ETIQUETA = new RegExp(`<([a-zA-Z][^\\s/>]*)${ATRIBUTOS_ETIQUETA}>`, 'g');
const ATRIBUTO = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const CUERPO_OPACO = new RegExp(`(<(script|style)\\b${ATRIBUTOS_ETIQUETA}>)[\\s\\S]*?(</\\2\\s*>)`, 'gi');

/** Sin comentarios y con vacío el interior de <script> y <style> (para no leer como etiquetas lo que es texto de código). */
function limpiar(html) {
	return html.replace(/<!--[\s\S]*?-->/g, '').replace(CUERPO_OPACO, '$1$4');
}

/** Todas las etiquetas de apertura, en orden: `{ nombre, attrs }`; un atributo sin valor vale `''`. */
export function etiquetas(html) {
	const salida = [];
	for (const m of limpiar(html).matchAll(ETIQUETA)) {
		const attrs = {};
		for (const a of m[2].matchAll(ATRIBUTO)) {
			const nombre = a[1].toLowerCase();
			if (!(nombre in attrs)) attrs[nombre] = decodificar(a[2] ?? a[3] ?? a[4] ?? '');
		}
		salida.push({ nombre: m[1].toLowerCase(), attrs });
	}
	return salida;
}

const tokens = (valor) => (valor ?? '').split(/\s+/).filter(Boolean);
const URLS_DE_SRCSET = (srcset) => srcset.split(',').map((e) => e.trim().split(/\s+/)[0]).filter(Boolean);
const RELS_SIN_ARCHIVO = new Set(['canonical']);

/**
 * Lo que interesa de una página: ids, enlaces, referencias entre ids, metas, recursos (archivos que pide) y cuántos
 * <script> trae.
 */
export function analizarPagina(html) {
	const lista = etiquetas(html);
	const ids = [];
	const enlaces = [];
	const referencias = [];
	const recursos = [];
	const meta = {};
	let scripts = 0;
	for (const { nombre, attrs } of lista) {
		if (attrs.id !== undefined) ids.push(attrs.id);
		for (const atributo of ['aria-labelledby', 'aria-describedby', 'aria-controls']) {
			for (const id of tokens(attrs[atributo])) referencias.push({ atributo, id });
		}
		if (attrs['data-para'] !== undefined) referencias.push({ atributo: 'data-para', id: attrs['data-para'] });
		if (nombre === 'a' && attrs.href !== undefined) {
			enlaces.push({ href: attrs.href, rel: attrs.rel, target: attrs.target, descarga: 'download' in attrs, data: attrs });
		}
		if (nombre === 'script') scripts++;
		if (nombre === 'meta') {
			const clave = (attrs.name ?? attrs.property ?? attrs['http-equiv'] ?? '').toLowerCase();
			if (clave === 'robots') meta.robots = attrs.content;
			if (clave === 'refresh') meta.refresh = attrs.content;
			if (clave === 'description') meta.descripcion = attrs.content;
			if (clave === 'og:image') meta.ogImagen = attrs.content;
			if (clave === 'og:image:alt') meta.ogImagenAlt = attrs.content;
			if (clave === 'og:type') meta.ogTipo = attrs.content;
			if (clave === 'twitter:image') meta.twitterImagen = attrs.content;
			if (clave === 'twitter:image:alt') meta.twitterImagenAlt = attrs.content;
		}
		if (nombre === 'link' && attrs.rel?.toLowerCase() === 'canonical') meta.canonica = attrs.href;
		if (['img', 'source', 'script', 'link', 'video', 'audio'].includes(nombre) && !RELS_SIN_ARCHIVO.has(attrs.rel?.toLowerCase())) {
			if (attrs.src) recursos.push(attrs.src);
			if (nombre === 'link' && attrs.href) recursos.push(attrs.href);
			if (attrs.srcset) recursos.push(...URLS_DE_SRCSET(attrs.srcset));
		}
	}
	return { ids, enlaces, referencias, recursos, meta, scripts, etiquetas: lista };
}

/** El análisis de la barra de lomos (`<nav class="lomos">`) de una página, o `undefined` si no la tiene. */
export function lomosDe(html) {
	const m = limpiar(html).match(/<nav\b[^>]*\bclass\s*=\s*"(?:[^"]*\s)?lomos(?:\s[^"]*)?"[^>]*>[\s\S]*?<\/nav\s*>/i);
	return m ? analizarPagina(m[0]) : undefined;
}

const ETIQUETA_DE_BLOQUE = /^(?:p|div|li|ol|ul|dl|dt|dd|h[1-6]|section|article|nav|header|main|footer|figure|figcaption|br|button|tr|td|th)$/i;

/** El texto de la página sin etiquetas: lo de bloque separa con un espacio, lo en línea (`<em>`, `<a>`) no corta palabras. */
export function textoVisible(html) {
	const cuerpo = limpiar(html).replace(/^[\s\S]*?<body\b[^>]*>/i, '');
	const sinEtiquetas = cuerpo.replace(new RegExp(`</?([a-zA-Z][^\\s/>]*)${ATRIBUTOS_ETIQUETA}>`, 'g'), (_, nombre) =>
		ETIQUETA_DE_BLOQUE.test(nombre) ? ' ' : '',
	);
	return decodificar(sinEtiquetas).replace(/[ \t\r\n]+/g, ' ').trim();
}

/** De `index.html`, `tecnico/index.html` o `404.html` (relativos a dist/) a la ruta del sitio. */
export function rutaDeArchivo(relativa) {
	const r = '/' + relativa.replaceAll('\\', '/').replace(/^\/+/, '');
	if (r.endsWith('/index.html')) return r.slice(0, -'index.html'.length);
	return r;
}

/**
 * Las fichas de una página y las páginas de cada una, en el orden del HTML: un `section.ficha` abre una ficha y cada
 * `article.pagina` que sigue es una de sus páginas.
 */
export function fichasDe(html) {
	const fichas = [];
	for (const { nombre, attrs } of etiquetas(html)) {
		const clases = tokens(attrs.class);
		if (nombre === 'section' && clases.includes('ficha')) fichas.push({ id: attrs.id, clases, paginas: [] });
		else if (nombre === 'article' && clases.includes('pagina') && fichas.length > 0) {
			fichas.at(-1).paginas.push({ id: attrs.id, titulo: attrs['data-titulo'], tapa: clases.includes('tapa') });
		}
	}
	return fichas;
}

/**
 * El análisis de una sola página de ficha (`<article class="pagina">…</article>`), la que tenga ese `titulo` (data-titulo)
 * o ese `id`; `undefined` si no está. Sirve para mirar los enlaces de «la tapa» o «De dónde vengo» sin los del resto.
 */
export function paginaDe(html, { titulo, id }) {
	for (const m of limpiar(html).matchAll(/<article\b[^>]*>[\s\S]*?<\/article\s*>/gi)) {
		const apertura = etiquetas(m[0])[0];
		if (!tokens(apertura.attrs.class).includes('pagina')) continue;
		if ((titulo !== undefined && apertura.attrs['data-titulo'] === titulo) || (id !== undefined && apertura.attrs.id === id)) return analizarPagina(m[0]);
	}
	return undefined;
}

/** Los ids que aparecen más de una vez (una sola vez cada uno, en orden de aparición). */
export function idsRepetidos(ids) {
	const vistos = new Set();
	const repetidos = new Set();
	for (const id of ids) (vistos.has(id) ? repetidos : vistos).add(id);
	return [...repetidos];
}

/** Referencias (`aria-labelledby`, `aria-describedby`, `aria-controls`, `data-para`) a un id que no existe en la página. */
export function problemasDeReferencias(pagina) {
	const ids = new Set(pagina.ids);
	return pagina.referencias.filter((r) => !ids.has(r.id)).map((r) => `${r.atributo}="${r.id}": no hay ningún elemento con ese id`);
}

const CON_ESQUEMA = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Enlaces internos que no llevan a ningún lado. `paginas`: Map de ruta (`/tecnico/`) a `analizarPagina(...)`. `existe(ruta)`
 * dice si la ruta (`/cv/a.pdf`, `/tecnico/`) existe en el sitio. Cuenta como roto: una ruta que no existe, o un `#hash`
 * sin elemento con ese id en la página de destino. Los enlaces con esquema (https:, mailto:, tel:) no se miran.
 */
export function enlacesRotos(paginas, existe) {
	const rotos = [];
	for (const [desde, pagina] of paginas) {
		for (const { href } of pagina.enlaces) {
			if (CON_ESQUEMA.test(href)) continue;
			let url;
			try {
				url = new URL(href, `https://sitio.invalido${desde}`);
			} catch {
				rotos.push({ desde, href, motivo: 'URL mal formada' });
				continue;
			}
			let ruta = url.pathname;
			if (ruta !== desde && !existe(ruta) && !/\.[a-z0-9]+$/i.test(ruta) && !ruta.endsWith('/') && existe(`${ruta}/`)) ruta = `${ruta}/`;
			if (ruta !== desde && !existe(ruta)) {
				rotos.push({ desde, href, motivo: `no existe ${ruta}` });
				continue;
			}
			let hash = url.hash.replace(/^#/, '');
			try {
				hash = decodeURIComponent(hash);
			} catch {
				// Un % inválido: se busca tal cual.
			}
			const destino = ruta === desde ? pagina : paginas.get(ruta);
			if (hash !== '' && destino && !destino.ids.includes(hash)) rotos.push({ desde, href, motivo: `${ruta} no tiene un elemento con id "${hash}"` });
		}
	}
	return rotos;
}

/** Las rutas (`/`, `/tecnico/`) de cada `<loc>` de un sitemap. */
export function urlsDeSitemap(xml) {
	return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => new URL(decodificar(m[1])).pathname);
}

/**
 * Lo que tiene que cumplir una página de redirección: `meta refresh` inmediato al
 * `destino`, `noindex`, canónica a la portada, un único enlace al mismo destino y ningún script. Lista vacía = cumple.
 */
export function problemasDeRedireccion(pagina, destino, canonicaEsperada = '/') {
	const problemas = [];
	const { refresh, robots, canonica } = pagina.meta;
	const url = refresh?.match(/^\s*0\s*;\s*url\s*=\s*(.+?)\s*$/i)?.[1];
	if (url === undefined) problemas.push('falta <meta http-equiv="refresh" content="0; url=…">');
	else if (url !== destino) problemas.push(`el refresh va a ${url} y debería ir a ${destino}`);
	if (!tokens(robots?.replaceAll(',', ' ')).includes('noindex')) problemas.push('falta <meta name="robots" content="noindex">');
	let rutaCanonica;
	try {
		rutaCanonica = canonica ? new URL(canonica).pathname : undefined;
	} catch {
		rutaCanonica = undefined;
	}
	if (rutaCanonica !== canonicaEsperada) problemas.push(`la canónica debe ser la portada (${canonicaEsperada}) y es ${canonica ?? '(ninguna)'}`);
	if (pagina.enlaces.length !== 1) problemas.push(`debe tener un único enlace y tiene ${pagina.enlaces.length}`);
	else if (pagina.enlaces[0].href !== destino) problemas.push(`el enlace va a ${pagina.enlaces[0].href} y debería ir a ${destino}`);
	if (pagina.scripts > 0) problemas.push(`no debe llevar JavaScript y trae ${pagina.scripts} <script>`);
	return problemas;
}
