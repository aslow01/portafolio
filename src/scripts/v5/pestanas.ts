// Comportamiento de la web v5 «Mezcla»: la pila de pestañas de la portada, las fichas con páginas horizontales, el
// paginador, los lomos, la cortina al salir, «Atrás» del navegador, el circuito de pasos y la hoja de código.
// Sin dependencias.
//
// Compatible con la política de contenido (public/_headers: script-src 'self', style-src 'self'): sin eval, sin
// atributos en línea y sin `setAttribute('style')`. Los valores dinámicos van por `el.style.setProperty` (CSSOM,
// permitido) y las animaciones por `el.animate` (Web Animations). Los datos del usuario no existen en esta página;
// todo el texto que se arma acá va con `textContent`. No guarda nada en el navegador (lo vigila scripts/higiene.mjs). Ningún script del sitio
// queda en línea en el HTML (la política no lo admite): `vite.build.assetsInlineLimit: 0` (astro.config.mjs) hace que
// Astro los entregue como archivos de /_astro/ aunque sean chicos.
//
// Contrato con el HTML (lo arman src/v5/Ficha.astro, Pagina.astro, Portada.astro y Lomos.astro):
//   .portada .pila .banda > a[data-banda]  la pestaña de la portada (lleva .oreja y .cara > .palabra)
//   .ficha#<id>[data-nombre] > .ficha-cabeza + .hojas > .pagina[data-titulo]   la ficha y sus páginas
//   .ficha.fija > .hojas > .pagina#<id>    ficha de una página interior (/tecnico/): no se cierra, abre en la página del hash
//   .foto img                              foto que, si no carga, deja su `.foto` con la clase `sin-foto` (se ve el dibujo)
//   .pg-titulo .palabra-h                  la palabra que viaja desde la pestaña y se ensancha
//   a[data-cerrar], a[data-salir], [data-ir]   cerrar la ficha, salir a otra página con cortina, ir a la página N
//   .lomos a[data-lomo]                    los lomos (se muestran con una ficha abierta)
//   [data-letras], [data-caida], [data-marcas], [data-sub], .ver-codigo[data-hoja]   piezas de la etapa 2
// El script agrega a <html> las clases `js` (y saca `sin-js`) y `mueve` (si el movimiento no está reducido).

import { cierraPorFondo, fueEmpujada, imagenRota, paginaDelHash, paginaGuardada, tituloConNombre } from '../../lib/paginas.ts';
import { nombre as autor } from '../../lib/sitio.ts';
import { idiomaDe, traductor } from '../../i18n/idioma.ts';

const d = document;
// El idioma de la página es el de <html lang> (lo pone BaseV5 según la dirección): los textos propios del script van a pares.
const tr = traductor(idiomaDe(d.documentElement.lang));
const raiz = d.documentElement;
raiz.classList.remove('sin-js');
raiz.classList.add('js');
// El título de la portada, tal como llegó: se restaura al cerrar una ficha. Con una ficha abierta, el título es el de la ficha.
const tituloOriginal = d.title;
const quieto = matchMedia('(prefers-reduced-motion: reduce)');
const conAnim = (): boolean => !quieto.matches && 'animate' in Element.prototype;
if (conAnim()) raiz.classList.add('mueve');

const PESO = 'cubic-bezier(0.7, 0, 0.12, 1)';
/** Duraciones de las animaciones hechas con el script (las de CSS están en tokens.css). */
const T = { abrirPila: 700, abrirLomo: 620, cerrar: 540, titulo: 820, hojas: 760, cortina: 560, hoja: 560, bajaHoja: 380 } as const;

const portada = d.querySelector<HTMLElement>('.portada');
const lomos = d.querySelector<HTMLElement>('.lomos');
const num = (n: string): number => parseFloat(getComputedStyle(raiz).getPropertyValue(n)) || 0;

// Fotos o dibujo: con ?fotos=no en la dirección se ven los dibujos de la D2 en el mismo hueco.
try {
	if (new URLSearchParams(location.search).get('fotos') === 'no') raiz.classList.remove('con-fotos');
} catch {
	/* sin URLSearchParams: quedan las fotos */
}
// El historial puede negarse en contextos aislados: nunca debe romper la página.
const historial = (como: 'push' | 'replace', estado: unknown, url: string): void => {
	try {
		if (como === 'push') history.pushState(estado, '', url);
		else history.replaceState(estado, '', url);
	} catch {
		/* sin historial: la ficha igual abre y cierra */
	}
};

// Forma de pestaña: solapa (x, w, arriba, alto o) y cuerpo a todo el ancho hasta «abajo».
const pestana = (x: number, w: number, arriba: number, o: number, abajo: number, ancho: number): string => {
	const c = Math.min(num('--corte') || 16, w / 2);
	const b = arriba + o;
	return `polygon(${x}px ${arriba}px, ${x + w - c}px ${arriba}px, ${x + w}px ${b}px, ${ancho}px ${b}px, ${ancho}px ${abajo}px, 0px ${abajo}px, 0px ${b}px, ${x}px ${b}px)`;
};
// Un rectángulo chico (un lomo, un botón) escrito con los mismos ocho puntos, para poder transformarlo en pestaña.
const caja = (r: DOMRect): string => {
	const { left: x, top: t, right: dr, bottom: b } = r;
	return `polygon(${x}px ${t}px, ${dr - 8}px ${t}px, ${dr}px ${t + 8}px, ${dr}px ${t + 8}px, ${dr}px ${b}px, ${x}px ${b}px, ${x}px ${t + 8}px, ${x}px ${t + 8}px)`;
};
const crear = <K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, texto?: string): HTMLElementTagNameMap[K] => {
	const e = d.createElement(tag);
	if (clase) e.className = clase;
	if (texto) e.textContent = texto;
	return e;
};

// ---------- 0. Preparación de piezas ----------
// Letras: el texto queda para el lector de pantalla; la copia visible se parte en letras (Afterfall cae).
d.querySelectorAll<HTMLElement>('[data-letras]').forEach((el) => {
	const texto = el.textContent ?? '';
	const lector = crear('span', 'solo-lector', texto);
	const vis = crear('span', 'letras');
	vis.setAttribute('aria-hidden', 'true');
	for (const c of texto) vis.append(crear('span', 'l', c));
	el.replaceChildren(lector, vis);
});
// Fotos: si una no carga (o ya había fallado cuando corrió el script), su figura queda `sin-foto` y se ve el dibujo en su lugar.
d.querySelectorAll<HTMLImageElement>('.foto img').forEach((img) => {
	const sinFoto = (): void => img.closest('.foto')?.classList.add('sin-foto');
	img.addEventListener('error', sinFoto);
	if (imagenRota(img)) sinFoto();
});
// Marcas del caso (una por factura): se generan acá para no cargar el HTML con 340 elementos.
d.querySelectorAll<HTMLElement>('[data-marcas]').forEach((g) => {
	const n = parseInt(g.getAttribute('data-marcas') ?? '', 10) || 0;
	const frag = d.createDocumentFragment();
	for (let i = 0; i < n; i++) {
		const m = d.createElement('i');
		m.style.setProperty('--i', String(i));
		frag.append(m);
	}
	g.append(frag);
});

// Cada página arma su pieza al llegar: --p va de 0 a 1 (una sola vez por página).
const armar = (p: HTMLElement): void => {
	if (!conAnim() || p.dataset.armada) return;
	p.dataset.armada = '1';
	const t0 = performance.now() + 160;
	const dur = 1500;
	const paso = (ahora: number): void => {
		const t = Math.min(1, Math.max(0, (ahora - t0) / dur));
		p.style.setProperty('--p', (1 - Math.pow(1 - t, 3)).toFixed(3));
		if (t < 1) requestAnimationFrame(paso);
	};
	requestAnimationFrame(paso);
	p.querySelectorAll<HTMLElement>('[data-caida] .l').forEach((l, i) =>
		l.animate(
			[
				{ transform: 'translateY(-1.1em)', opacity: 0 },
				{ transform: 'translateY(0.06em)', opacity: 1, offset: 0.7 },
				{ transform: 'none', opacity: 1 },
			],
			{ duration: 520, delay: 300 + i * 45, easing: 'cubic-bezier(0.55, 0, 0.85, 0.45)', fill: 'backwards' },
		),
	);
};

// ---------- 1. Fichas y paginadores ----------
interface FichaViva {
	f: HTMLElement;
	hojas: HTMLElement;
	pags: HTMLElement[];
	total: number;
	nombre: string;
	idx: number;
	ant: HTMLButtonElement;
	sig: HTMLButtonElement;
	ind: HTMLButtonElement;
	lista: HTMLOListElement;
	sol: HTMLElement;
	pos: HTMLElement;
	nom: HTMLElement;
	/** Región de estado: dice «Página 2 de 6: Conducción» al cambiar de página con la ficha abierta. */
	anuncio: HTMLElement;
	siguiente: HTMLElement | null;
	raf: number;
	anim: Animation | null;
}

const fichas = new Map<string, FichaViva>();
const orden = [...d.querySelectorAll<HTMLElement>('.ficha')];
let abierta: FichaViva | null = null;
let empujada = false;
// Se reasigna en la sección 5 (la pila con resortes) cuando hay pila.
let golpe: (banda: Element) => void = () => {};

const tituloDe = (p: HTMLElement): string => p.dataset.titulo ?? '';
const FOCABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex="0"]';
const visible = (e: Element): boolean => (e as HTMLElement).checkVisibility?.() ?? true;
/** ¿La página es más alta que su pantalla (desplazamiento interno)? */
const desplaza = (p: HTMLElement): boolean => p.scrollHeight > p.clientHeight + 1;

orden.forEach((f, n) => {
	const hojas = f.querySelector<HTMLElement>('.hojas');
	if (!hojas) return;
	const pags = [...hojas.children].filter((x): x is HTMLElement => x instanceof HTMLElement);
	const total = pags.length;
	const nombre = f.dataset.nombre ?? '';
	hojas.setAttribute('role', 'region');
	hojas.setAttribute('aria-roledescription', tr('carrusel', 'carousel'));
	hojas.setAttribute('aria-label', `${nombre}, ${total} ${total === 1 ? tr('página', 'page') : tr('páginas', 'pages')}`);
	pags.forEach((p, i) => {
		p.setAttribute('role', 'group');
		p.setAttribute('aria-roledescription', tr('página', 'page'));
		p.setAttribute('aria-label', `${i + 1} ${tr('de', 'of')} ${total}: ${tituloDe(p)}`);
		p.tabIndex = -1;
		if (conAnim()) p.style.setProperty('--p', '0');
	});

	const nav = crear('nav', 'paginador');
	nav.setAttribute('aria-label', tr(`Páginas de ${nombre}`, `Pages of ${nombre}`));
	const ant = crear('button', 'pag-ant');
	ant.type = 'button';
	ant.setAttribute('aria-label', tr('Página anterior', 'Previous page'));
	const flechaAnt = crear('span', '', '←');
	flechaAnt.setAttribute('aria-hidden', 'true');
	ant.append(flechaAnt, crear('span', 'pag-txt', tr('Anterior', 'Previous')));
	const sig = crear('button', 'pag-sig');
	sig.type = 'button';
	const ind = crear('button', 'pag-indice');
	ind.type = 'button';
	ind.setAttribute('aria-expanded', 'false');
	const lin = crear('span', 'pag-lin');
	const pos = crear('span', 'pag-pos');
	const nom = crear('span', 'pag-nombre');
	lin.append(pos, nom);
	const sol = crear('span', 'solapitas');
	sol.setAttribute('aria-hidden', 'true');
	for (let i = 0; i < total; i++) sol.append(crear('i'));
	// Su `aria-label` (lo arma `actualizar`) empieza con el texto visible, «1 / 6 Tapa».
	ind.append(lin, sol);
	const lista = crear('ol', 'pag-lista');
	lista.id = `paginas-${f.id}`;
	lista.hidden = true;
	ind.setAttribute('aria-controls', lista.id);
	const anuncio = crear('p', 'solo-lector');
	anuncio.setAttribute('role', 'status');
	pags.forEach((p, i) => {
		const li = crear('li');
		const b = crear('button');
		b.type = 'button';
		b.dataset.pagina = String(i);
		b.setAttribute('aria-label', `${tr('Página', 'Page')} ${i + 1}: ${tituloDe(p)}`);
		b.append(crear('span', 'num', String(i + 1)), crear('span', 'pag-titulo', tituloDe(p)));
		li.append(b);
		lista.append(li);
	});
	if (total > 6) lista.classList.add('muchas');
	nav.append(ant, ind, sig, lista, anuncio);
	hojas.after(nav);

	const siguiente = orden[n + 1] ?? null;
	const o: FichaViva = { f, hojas, pags, total, nombre, idx: 0, ant, sig, ind, lista, sol, pos, nom, anuncio, siguiente, raf: 0, anim: null };
	fichas.set(f.id, o);

	ant.addEventListener('click', () => ir(o, o.idx - 1));
	sig.addEventListener('click', () => {
		if (o.idx < total - 1) ir(o, o.idx + 1);
		else if (o.siguiente) cambiarA(o.siguiente.id, sig);
	});
	ind.addEventListener('click', () => mostrarLista(o, !!lista.hidden));
	lista.addEventListener('click', (e) => {
		const b = e.target instanceof Element ? e.target.closest<HTMLElement>('button[data-pagina]') : null;
		if (!b) return;
		mostrarLista(o, false);
		ir(o, Number(b.dataset.pagina), true);
	});
	hojas.addEventListener(
		'scroll',
		() => {
			if (o.raf) return;
			o.raf = requestAnimationFrame(() => {
				o.raf = 0;
				const i = Math.round(hojas.scrollLeft / Math.max(1, hojas.clientWidth));
				if (i !== o.idx) {
					o.idx = Math.max(0, Math.min(total - 1, i));
					actualizar(o, true);
					recordarPagina(o);
				}
			});
		},
		{ passive: true },
	);
	// Flechas del teclado: página anterior y siguiente (sin pisar Alt+flecha ni las flechas de una lista de pestañas).
	f.addEventListener('keydown', (e) => {
		if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
		const t = e.target instanceof Element ? e.target : null;
		if (t && t.closest('pre, input, textarea, select, [role="tablist"]')) return;
		// Con el foco en «Anterior» o «Siguiente», ↑ ↓ Re Pág Av Pág desplazan la página que no entra en la pantalla.
		if (t && t.closest('.pag-ant, .pag-sig') && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(e.key)) {
			const p = o.pags[o.idx];
			if (desplaza(p)) {
				e.preventDefault();
				const paso = e.key.startsWith('Page') ? p.clientHeight * 0.85 : 48;
				p.scrollBy({ top: e.key.endsWith('Down') ? paso : -paso, behavior: conAnim() ? 'smooth' : 'auto' });
			}
			return;
		}
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			ir(o, o.idx + 1, true);
		}
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			ir(o, o.idx - 1, true);
		}
	});
	f.querySelectorAll<HTMLElement>('[data-ir]').forEach((b) => b.addEventListener('click', () => ir(o, Number(b.dataset.ir), true)));
	actualizar(o);
});

function mostrarLista(o: FichaViva, si: boolean): void {
	o.lista.hidden = !si;
	o.ind.setAttribute('aria-expanded', String(si));
	if (si) o.lista.querySelector<HTMLElement>('[aria-current]')?.focus();
}

// El teclado y el lector de pantalla solo recorren lo que se ve:
//  · las páginas que no son la actual son `inert` (nada enfocable ni clicable): si no, Tab entraba en los enlaces de las páginas
//    que están fuera de la pantalla, arrastraba la ficha de una página a otra y la tabulación saltaba 1 → 4 → 5. Sigue sin ser
//    inerte la página que tiene el foco, para que no se lo quite mientras la ficha se desplaza hasta ella (`ir` con foco);
//  · la página actual que se desplaza por dentro y no tiene nada enfocable recibe el foco con Tab; si no, con el teclado no había
//    forma de leerla. Solo la actual, para no sumar una parada por página.
function pasoPorTeclado(o: FichaViva): void {
	o.pags.forEach((p, j) => {
		p.inert = j !== o.idx && !p.contains(d.activeElement);
		p.tabIndex = j === o.idx && desplaza(p) && ![...p.querySelectorAll(FOCABLE)].some(visible) ? 0 : -1;
	});
}

// Desde 1024 px: si las solapas con todos sus títulos no entran en su columna, pisan «Anterior» y «Siguiente». Las que no son
// la actual pasan a mostrar solo el número. Solo se agrega la clase (no se quita al navegar) para que no salten; con `desdeCero`
// (cambio de tamaño) se vuelve a medir.
function ajustarSolapas(o: FichaViva, desdeCero = false): void {
	if (!matchMedia('(min-width: 1024px)').matches || !o.f.classList.contains('abierta')) return;
	if (desdeCero) o.lista.classList.remove('compacta');
	const botones = [...o.lista.querySelectorAll<HTMLElement>('button')];
	// Ancho natural de cada solapa: el actual más lo que el título recorta con los puntos suspensivos.
	const natural =
		botones.reduce((s, b) => {
			const t = b.querySelector<HTMLElement>('.pag-titulo');
			return s + b.offsetWidth + (t ? Math.max(0, t.scrollWidth - t.clientWidth) : 0);
		}, 0) +
		4 * (botones.length - 1);
	if (o.lista.clientWidth > 0 && natural > o.lista.clientWidth) o.lista.classList.add('compacta');
}

function actualizar(o: FichaViva, anunciar = false): void {
	const i = o.idx;
	o.pos.textContent = `${i + 1} / ${o.total}`;
	o.nom.textContent = tituloDe(o.pags[i]);
	o.ind.setAttribute('aria-label', `${o.pos.textContent} ${o.nom.textContent}, ${tr('elegir página', 'choose a page')}`);
	[...o.sol.children].forEach((s, j) => s.classList.toggle('ahora', j === i));
	o.lista.querySelectorAll('button').forEach((b, j) => {
		if (j === i) b.setAttribute('aria-current', 'page');
		else b.removeAttribute('aria-current');
	});
	// Un botón `disabled` con el foco lo pierde (el foco pasa a body): si era el que se apaga, el foco va al otro del paginador.
	const conFoco = d.activeElement;
	o.ant.disabled = i === 0;
	const ultima = i === o.total - 1;
	o.sig.replaceChildren();
	o.sig.classList.toggle('salto', ultima && !!o.siguiente);
	if (ultima && o.siguiente) {
		const destino = fichas.get(o.siguiente.id);
		const n = o.siguiente.querySelector('.ficha-cabeza .num');
		const flecha = crear('span', '', `${n?.textContent ?? ''}→`);
		flecha.setAttribute('aria-hidden', 'true');
		o.sig.append(crear('span', 'pag-txt', destino ? destino.nombre : ''), flecha);
		o.sig.setAttribute('aria-label', `${tr('Siguiente sección', 'Next section')}: ${destino ? destino.nombre : ''}`);
		o.sig.disabled = false;
	} else {
		const flecha = crear('span', '', '→');
		flecha.setAttribute('aria-hidden', 'true');
		o.sig.append(crear('span', 'pag-txt', tr('Siguiente', 'Next')), flecha);
		o.sig.setAttribute('aria-label', tr('Página siguiente', 'Next page'));
		o.sig.disabled = ultima;
	}
	if (conFoco === o.ant && o.ant.disabled && !o.sig.disabled) o.sig.focus();
	else if (conFoco === o.sig && o.sig.disabled && !o.ant.disabled) o.ant.focus();
	if (o.f.classList.contains('abierta')) {
		o.pags[i].classList.add('viva');
		armar(o.pags[i]);
	}
	// Al cambiar de página con la ficha abierta, el cambio se anuncia (el foco se queda en el botón).
	if (anunciar && o.f.classList.contains('abierta')) o.anuncio.textContent = `${tr('Página', 'Page')} ${i + 1} ${tr('de', 'of')} ${o.total}: ${tituloDe(o.pags[i])}`;
	pasoPorTeclado(o);
	ajustarSolapas(o);
}

function ir(o: FichaViva, i: number, foco = false): void {
	const j = Math.max(0, Math.min(o.total - 1, i));
	o.hojas.scrollTo({ left: j * o.hojas.clientWidth, behavior: conAnim() ? 'smooth' : 'auto' });
	if (foco) {
		// la página de destino todavía es inerte (idx no cambió): se la habilita antes de pasarle el foco
		o.pags[j].inert = false;
		o.pags[j].focus({ preventScroll: true });
	}
}

addEventListener('resize', () => {
	for (const o of fichas.values())
		if (o.f.classList.contains('abierta')) {
			o.hojas.scrollLeft = o.idx * o.hojas.clientWidth;
			pasoPorTeclado(o);
			ajustarSolapas(o, true);
		}
});
// Con las fuentes cargadas cambia el alto de las páginas: se vuelve a ver cuál se desplaza.
void d.fonts?.ready.then(() => {
	for (const o of fichas.values())
		if (o.f.classList.contains('abierta')) {
			pasoPorTeclado(o);
			ajustarSolapas(o, true);
		}
});

// ---------- 2. Abrir, cambiar y cerrar ----------
const bandaDe = (id: string): HTMLElement | null => (portada ? portada.querySelector<HTMLElement>(`[data-banda="${id}"]`) : null);
const marcarLomos = (id: string | null): void => {
	if (!lomos) return;
	lomos.querySelectorAll<HTMLElement>('a[data-lomo]').forEach((a) => {
		if (a.dataset.lomo === id) a.setAttribute('aria-current', 'page');
		else a.removeAttribute('aria-current');
	});
};
const ocultar = (o: FichaViva): void => {
	o.f.classList.remove('abierta', 'encima');
	mostrarLista(o, false);
};
const enfocarTitulo = (o: FichaViva): void => {
	if (o.idx > 0) {
		enfocarTituloDePagina(o.pags[o.idx]);
		return;
	}
	const t = o.pags[0].querySelector<HTMLElement>('[tabindex="-1"]') ?? o.pags[0];
	t.focus({ preventScroll: true });
};

// «Atrás» desde otra página (un caso, p. ej.) tiene que volver a la página de la ficha desde la que se salió, no a la primera.
// La página actual se guarda en el estado de la entrada del historial (`history.state`): no cambia la dirección ni usa el
// almacenamiento del navegador, y sobrevive a recargar y a ir y volver. Al volver a abrir la ficha se restaura.
function recordarPagina(o: FichaViva): void {
	if (abierta !== o) return;
	const previo: object = typeof history.state === 'object' && history.state !== null ? history.state : {};
	historial('replace', { ...previo, ficha: o.f.id, pagina: o.idx }, location.href);
}
function restaurarPagina(o: FichaViva): void {
	const i = paginaGuardada(history.state, o.f.id, o.total);
	if (i <= 0) return;
	o.hojas.scrollTo({ left: i * o.hojas.clientWidth, behavior: 'auto' });
	o.idx = i;
	actualizar(o);
	enfocarTituloDePagina(o.pags[i]);
}
// El navegador salta al fragmento (#ficha) después de que corre el script y deshace el foco: si pasado un cuadro nada lo tiene
// (el foco quedó en <body>), se vuelve a poner en el título de la ficha que sigue abierta.
const reenfocarSiNadaLoTiene = (o: FichaViva): void => {
	requestAnimationFrame(() => {
		if (abierta === o && (!d.activeElement || d.activeElement === d.body)) enfocarTitulo(o);
	});
};
// Corta la animación en curso de una ficha sin dejar que su final cambie el estado (Atrás y
// enseguida Adelante dejaban la ficha cerrada y la portada sin respuesta).
const cortar = (o: FichaViva | null): void => {
	if (!o || !o.anim) return;
	o.anim.onfinish = null;
	o.anim.cancel();
	o.anim = null;
};

type ModoApertura = 'directo' | 'pila' | 'lomo';

function abrir(o: FichaViva, { modo = 'directo', desde = null }: { modo?: ModoApertura; desde?: HTMLElement | null } = {}): void {
	const previa = abierta;
	if (previa === o) return;
	cortar(o);
	cortar(previa);
	abierta = o;
	o.f.classList.add('abierta');
	if (previa) o.f.classList.add('encima');
	raiz.classList.add('con-ficha');
	if (portada) portada.inert = true;
	o.hojas.scrollLeft = 0;
	o.idx = 0;
	actualizar(o);
	marcarLomos(o.f.id);
	// Una ficha fija es la propia página (su título ya es el del HTML): solo las que se abren y se cierran lo cambian.
	if (!o.f.classList.contains('fija')) d.title = tituloConNombre(o.nombre, autor.completo);
	if (lomos) lomos.classList.add('visible');

	const listo = (): void => {
		o.f.classList.remove('encima');
		for (const otra of fichas.values()) if (otra !== abierta && otra.f.classList.contains('abierta')) ocultar(otra);
		if (abierta === o) enfocarTitulo(o);
	};
	const solapa = o.f.querySelector('.ficha-cabeza .oreja');
	if (modo === 'directo' || !desde || !conAnim() || !solapa) {
		listo();
		return;
	}

	const ancho = innerWidth;
	const alto = innerHeight;
	const rf = solapa.getBoundingClientRect();
	const fin = pestana(rf.left, rf.width, rf.top, rf.height, alto, ancho);
	let inicio: string;
	const orejaDesde = desde.querySelector('.oreja');
	const caraDesde = desde.querySelector('.cara');
	if (modo === 'pila' && orejaDesde && caraDesde) {
		const r = orejaDesde.getBoundingClientRect();
		const cara = caraDesde.getBoundingClientRect();
		inicio = pestana(r.left, r.width, r.top, r.height, Math.min(alto, cara.bottom + 2), ancho);
		// La palabra de la pestaña viaja hasta el título de la ficha y en el viaje SE ENSANCHA (injerto de la D3):
		// sale condensada (wdth 75) y llega ancha (wdth 100).
		const palabra = desde.querySelector<HTMLElement>('.palabra');
		const titulo = o.pags[0].querySelector<HTMLElement>('.palabra-h');
		if (palabra && titulo) {
			const rp = palabra.getBoundingClientRect();
			const rt = titulo.getBoundingClientRect();
			const s = parseFloat(getComputedStyle(palabra).fontSize) / parseFloat(getComputedStyle(titulo).fontSize);
			titulo.animate(
				[
					{ transform: `translate(${rp.left - rt.left}px, ${rp.top - rt.top}px) scale(${s})`, fontStretch: '75%' },
					{ fontStretch: '75%', offset: 0.45 },
					{ transform: 'none', fontStretch: '100%' },
				],
				{ duration: T.titulo, easing: PESO },
			);
		}
	} else {
		inicio = caja(desde.getBoundingClientRect());
	}
	const a = o.f.animate([{ clipPath: inicio }, { clipPath: fin }], { duration: modo === 'pila' ? T.abrirPila : T.abrirLomo, easing: PESO, fill: 'forwards' });
	o.anim = a;
	// La página entra con un leve corrimiento: el contenido «se asienta» detrás de la solapa.
	o.hojas.animate([{ transform: 'translateY(48px)' }, { transform: 'none' }], { duration: T.hojas, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.15)' });
	a.onfinish = () => {
		o.anim = null;
		a.cancel();
		listo();
	};
}

function cerrar(): void {
	const o = abierta;
	if (!o || o.f.classList.contains('fija')) return;
	cortar(o);
	abierta = null;
	empujada = false;
	if (lomos) lomos.classList.remove('visible');
	marcarLomos(null);
	d.title = tituloOriginal;
	raiz.classList.remove('con-ficha');
	if (portada) portada.inert = false;
	for (const otra of fichas.values())
		if (otra !== o && otra.f.classList.contains('abierta')) {
			cortar(otra);
			ocultar(otra);
		}
	const banda = bandaDe(o.f.id);
	const solapa = o.f.querySelector('.ficha-cabeza .oreja');
	const orejaBanda = banda?.querySelector('.oreja');
	const caraBanda = banda?.querySelector('.cara');
	if (banda && solapa && orejaBanda && caraBanda && conAnim()) {
		const ancho = innerWidth;
		const alto = innerHeight;
		const rf = solapa.getBoundingClientRect();
		const r = orejaBanda.getBoundingClientRect();
		const cara = caraBanda.getBoundingClientRect();
		const a = o.f.animate(
			[
				{ clipPath: pestana(rf.left, rf.width, rf.top, rf.height, alto, ancho) },
				{ clipPath: pestana(r.left, r.width, r.top, r.height, Math.min(alto, cara.bottom + 2), ancho) },
			],
			{ duration: T.cerrar, easing: 'cubic-bezier(0.6, 0, 0.25, 1)', fill: 'forwards' },
		);
		o.anim = a;
		a.onfinish = () => {
			o.anim = null;
			a.cancel();
			if (abierta !== o) {
				ocultar(o);
				golpe(banda);
			}
		};
	} else {
		ocultar(o);
	}
	if (banda) banda.focus({ preventScroll: true });
}

function cambiarA(id: string, desde: HTMLElement): void {
	const o = fichas.get(id);
	if (!o) return;
	if (abierta && abierta.f.classList.contains('fija')) return;
	historial('replace', { ficha: id, empujada }, `#${id}`);
	abrir(o, { modo: abierta ? 'lomo' : 'pila', desde: abierta ? desde : bandaDe(id) });
}

function volver(): void {
	if (empujada) history.back();
	else {
		historial('replace', null, location.pathname + location.search);
		cerrar();
	}
}

addEventListener('popstate', () => {
	const id = location.hash.slice(1);
	const o = fichas.get(id);
	empujada = fueEmpujada(history.state);
	if (o) {
		const yaAbierta = abierta === o;
		abrir(o, { modo: abierta ? 'directo' : 'pila', desde: bandaDe(id) });
		if (!yaAbierta) restaurarPagina(o);
		reenfocarSiNadaLoTiene(o);
	} else if (abierta) cerrar();
});

addEventListener('keydown', (e) => {
	if (e.key !== 'Escape' || !abierta || d.querySelector('dialog[open]')) return;
	const lista = abierta.lista;
	if (!lista.hidden && !matchMedia('(min-width: 1024px)').matches) {
		mostrarLista(abierta, false);
		abierta.ind.focus();
		return;
	}
	if (!abierta.f.classList.contains('fija')) volver();
});

// Flechas ← →: con el foco todavía en <body> (recién cargada la página, sin haber tocado nada) también pasan de página.
// Con el foco dentro de la ficha ya lo hace el manejador de cada ficha.
d.addEventListener('keydown', (e) => {
	if (!abierta || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
	if (e.target !== d.body && e.target !== raiz) return;
	if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
	if (d.querySelector('dialog[open]')) return;
	e.preventDefault();
	ir(abierta, abierta.idx + (e.key === 'ArrowRight' ? 1 : -1), true);
});

// ---------- 3. Salir hacia otra página: el color de destino sube desde lo que se tocó ----------
function salir(a: HTMLAnchorElement, e: Event): void {
	if (!conAnim()) return;
	e.preventDefault();
	const color = a.dataset.color || getComputedStyle(a).getPropertyValue('--fondo').trim() || '#23211e';
	const cortina = crear('div', 'cortina');
	cortina.setAttribute('aria-hidden', 'true');
	const capa = crear('div');
	capa.style.setProperty('background', color);
	cortina.append(capa);
	d.body.append(cortina);
	const r = a.getBoundingClientRect();
	const an = capa.animate([{ clipPath: caja(r) }, { clipPath: pestana(0, Math.min(innerWidth * 0.3, 220), 0, num('--cabeza') || 48, innerHeight, innerWidth) }], {
		duration: T.cortina,
		easing: PESO,
		fill: 'forwards',
	});
	an.onfinish = () => {
		location.href = a.href;
	};
}
addEventListener('pageshow', () => d.querySelectorAll('.cortina').forEach((c) => c.remove()));

// ---------- 4. Clics ----------
let suprimir = false;
d.addEventListener(
	'click',
	(e) => {
		if (suprimir) {
			suprimir = false;
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a') : null;
		if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
		if (a.hasAttribute('data-salir')) {
			salir(a, e);
			return;
		}
		if (a.hasAttribute('data-cerrar')) {
			if (abierta && !abierta.f.classList.contains('fija')) {
				e.preventDefault();
				volver();
			}
			return;
		}
		const h = a.getAttribute('href') ?? '';
		if (!h.startsWith('#')) return;
		// «Ir a las secciones»: el foco va a la primera banda (la pila es un contenedor sin anillo y el salto parecía no hacer nada).
		// Con una ficha abierta se deja el salto de siempre: el hash cierra la ficha y el foco vuelve a su banda.
		if (h === '#secciones' && !abierta) {
			const primera = pila?.querySelector<HTMLElement>('.banda > a');
			if (primera) {
				e.preventDefault();
				primera.focus();
			}
			return;
		}
		const id = h.slice(1);
		const destino = fichas.get(id);
		if (!destino) return;
		e.preventDefault();
		if (abierta) {
			if (abierta.f.id !== id) cambiarA(id, a);
		} else {
			empujada = true;
			historial('push', { ficha: id, empujada: true }, `#${id}`);
			abrir(destino, { modo: 'pila', desde: a.closest<HTMLElement>('[data-banda]') ?? bandaDe(id) });
		}
	},
	true,
);

// El selector de idioma (SelectorIdioma.astro) lleva a la misma página en el otro idioma: al ir le suma el hash de la dirección,
// así el cambio cae en la misma ficha y la misma página (`/en/#tecnico`, `/en/tecnico/#el-caso`).
d.addEventListener(
	'click',
	(e) => {
		const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('.idioma a') : null;
		if (a && location.hash) a.hash = location.hash;
	},
	true,
);

// Espacio abre la pestaña igual que Enter (un enlace nativo solo responde a Enter; pedido de la revisión de teclado).
d.addEventListener('keydown', (e) => {
	if (e.key !== ' ' || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.repeat) return;
	const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('.banda > a, .lomos a') : null;
	if (!a || e.target !== a) return;
	e.preventDefault();
	a.click();
});

// ---------- 5. La pila: resortes. El dedo y el cursor la hojean; arrastrar hacia arriba la abre en abanico ----------
// Táctil: eventos touch pasivos (la pila deja «pan-y», así con zoom la página se sigue desplazando).
// Un toque con deriva de hasta 16 px sigue siendo un toque.
interface Resorte {
	y: number;
	v: number;
	t: number;
}
const pila = portada ? portada.querySelector<HTMLElement>('.pila') : null;
if (pila && !quieto.matches) {
	const enlaces = [...pila.querySelectorAll<HTMLAnchorElement>('.banda > a')];
	const N = enlaces.length;
	const resortes: Resorte[] = enlaces.map((a) => {
		a.draggable = false;
		return { y: 0, v: 0, t: 0 };
	});
	const abanico: Resorte = { y: 0, v: 0, t: 0 }; // grados de la pestaña de arriba
	const K = 360;
	const C = 15; // amortiguamiento bajo: rebota dos veces y se asienta
	let corriendo = false;
	let ultimo = 0;
	const paso = (ahora: number): void => {
		const dt = Math.min(0.032, Math.max(0.001, (ahora - ultimo) / 1000));
		ultimo = ahora;
		let quietos = true;
		for (const s of [...resortes, abanico]) {
			s.v += (-K * (s.y - s.t) - C * s.v) * dt;
			s.y += s.v * dt;
			if (Math.abs(s.v) < 0.4 && Math.abs(s.y - s.t) < 0.05) {
				s.y = s.t;
				s.v = 0;
			} else quietos = false;
		}
		enlaces.forEach((a, i) => {
			a.style.setProperty('--y', `${resortes[i].y.toFixed(2)}px`);
			a.style.setProperty('--r', `${((-abanico.y * (N - 1 - i)) / (N - 1)).toFixed(3)}deg`);
		});
		if (quietos) {
			corriendo = false;
			return;
		}
		requestAnimationFrame(paso);
	};
	const mover = (): void => {
		if (corriendo) return;
		corriendo = true;
		ultimo = performance.now();
		requestAnimationFrame(paso);
	};
	const bandas = enlaces.map((a) => a.parentElement as HTMLElement);
	const indice = (y: number): number => {
		let i = -1;
		bandas.forEach((b, j) => {
			if (b.getBoundingClientRect().top - 30 <= y) i = j;
		});
		return i;
	};
	const apuntar = (y: number, fuerza = 1): void => {
		const i = indice(y);
		resortes.forEach((s, j) => {
			const dist = Math.abs(j - i);
			s.t = i < 0 ? 0 : dist === 0 ? -18 * fuerza : dist === 1 ? -6 * fuerza : 0;
		});
		mover();
	};
	const soltar = (): void => {
		resortes.forEach((s) => {
			s.t = 0;
		});
		abanico.t = 0;
		mover();
	};
	golpe = (banda) => {
		const i = enlaces.indexOf(banda as HTMLAnchorElement);
		if (i >= 0) {
			resortes[i].v = 420;
			mover();
		}
	};
	const UMBRAL = 16;
	let y0 = 0;
	let abajo = false;
	let movido = false;
	const empieza = (y: number): void => {
		abajo = true;
		movido = false;
		y0 = y;
		apuntar(y, 1);
	};
	const sigue = (y: number): void => {
		const dy = y - y0;
		if (Math.abs(dy) > UMBRAL) movido = true;
		if (movido) abanico.t = Math.max(-3, Math.min(13, -dy / 13));
		apuntar(y, 1);
	};
	const termina = (): void => {
		if (!abajo) return;
		abajo = false;
		if (movido) {
			suprimir = true;
			setTimeout(() => {
				suprimir = false;
			}, 80);
		}
		soltar();
	};
	// Ratón y lápiz
	pila.addEventListener('pointerdown', (e) => {
		if (e.pointerType !== 'touch' && e.button === 0) empieza(e.clientY);
	});
	pila.addEventListener('pointermove', (e) => {
		if (e.pointerType === 'touch') return;
		if (abajo) sigue(e.clientY);
		else if (e.pointerType === 'mouse') apuntar(e.clientY, 0.8);
	});
	pila.addEventListener('pointerup', (e) => {
		if (e.pointerType === 'touch') return;
		const fueArrastre = movido;
		termina();
		if (e.pointerType === 'mouse' && !fueArrastre) apuntar(e.clientY, 0.8);
	});
	pila.addEventListener('pointerleave', (e) => {
		if (e.pointerType === 'mouse') {
			abajo = false;
			soltar();
		}
	});
	// Dedo
	pila.addEventListener(
		'touchstart',
		(e) => {
			if (e.touches.length === 1) empieza(e.touches[0].clientY);
			else termina();
		},
		{ passive: true },
	);
	pila.addEventListener(
		'touchmove',
		(e) => {
			if (abajo && e.touches.length === 1) sigue(e.touches[0].clientY);
		},
		{ passive: true },
	);
	pila.addEventListener('touchend', termina, { passive: true });
	pila.addEventListener('touchcancel', termina, { passive: true });
}

// ---------- 6. Circuito: un paso por vez, patrón de pestañas, y «Paso siguiente» ----------
d.querySelectorAll<HTMLElement>('[data-sub]').forEach((sub) => {
	const lista = sub.querySelector<HTMLElement>('.pasos-lista');
	if (!lista) return;
	const botones = [...lista.querySelectorAll<HTMLButtonElement>('button[data-para]')];
	const vistas = botones.map((b) => d.getElementById(b.dataset.para ?? '')).filter((v): v is HTMLElement => v !== null);
	if (vistas.length !== botones.length) return;
	lista.setAttribute('role', 'tablist');
	botones.forEach((b, i) => {
		const para = b.dataset.para ?? '';
		b.setAttribute('role', 'tab');
		b.id = `pe-${para}`;
		b.setAttribute('aria-controls', para);
		vistas[i].setAttribute('role', 'tabpanel');
		vistas[i].style.setProperty('--k', String(i));
		vistas[i].setAttribute('aria-labelledby', b.id);
		if (!vistas[i].querySelector('a, button, [tabindex]')) vistas[i].tabIndex = 0;
	});
	const sig = sub.querySelector<HTMLElement>('[data-siguiente]');
	// «Paso siguiente» deja el foco en su botón, así que el paso nuevo se anuncia en una región de estado.
	const anuncio = crear('p', 'solo-lector');
	anuncio.setAttribute('role', 'status');
	sub.append(anuncio);
	let actual = 0;
	const elegir = (i: number, foco = false, anunciar = false): void => {
		actual = i;
		if (anunciar) anuncio.textContent = `${tr('Paso', 'Step')} ${i + 1} ${tr('de', 'of')} ${botones.length}: ${vistas[i].querySelector('.sub-t')?.textContent ?? ''}`;
		botones.forEach((b, j) => {
			b.setAttribute('aria-selected', String(i === j));
			b.tabIndex = i === j ? 0 : -1;
			vistas[j].hidden = i !== j;
		});
		if (sig?.firstChild) sig.firstChild.textContent = i === botones.length - 1 ? tr('Volver al paso 1 ', 'Back to step 1 ') : tr('Paso siguiente ', 'Next step ');
		if (conAnim()) vistas[i].animate([{ transform: 'translateX(24px)', opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 360, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)' });
		if (foco) botones[i].focus();
	};
	botones.forEach((b, i) => {
		b.addEventListener('click', () => elegir(i));
		b.addEventListener('keydown', (e) => {
			const n = botones.length;
			const destinos: Record<string, number> = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 };
			const a = destinos[e.key];
			if (a === undefined) return;
			e.preventDefault();
			e.stopPropagation();
			elegir(a, true);
		});
	});
	if (sig) {
		sig.hidden = false;
		sig.addEventListener('click', () => elegir((actual + 1) % botones.length, false, true));
	}
	elegir(0);
});

// ---------- 7. La prueba completa: el código sube en una hoja (segundo nivel, a un toque) ----------
d.querySelectorAll<HTMLElement>('.ver-codigo[data-hoja]').forEach((b) => {
	const pg = b.closest('.pg');
	const flujo = pg ? pg.querySelector<HTMLElement>('.codigo-flujo') : null;
	if (!flujo || typeof HTMLDialogElement !== 'function') return;
	const dlg = crear('dialog', 'hoja');
	dlg.id = b.dataset.hoja ?? '';
	dlg.setAttribute('aria-labelledby', `${dlg.id}-t`);
	const or = crear('div', 'hoja-oreja');
	or.setAttribute('aria-hidden', 'true');
	const o2 = crear('span', 'oreja');
	o2.append(crear('span', 'num', '02'), crear('span', '', tr('Código', 'Code')));
	or.append(o2);
	const cuerpo = crear('div', 'hoja-cuerpo');
	const cab = crear('div', 'hoja-cabeza');
	const h = crear('h2', '', flujo.dataset.tituloHoja || tr('Prueba', 'Test'));
	h.id = `${dlg.id}-t`;
	h.tabIndex = -1;
	const x = crear('button', 'cerrar-hoja', tr('Cerrar', 'Close'));
	x.type = 'button';
	cab.append(h, x);
	cuerpo.append(cab, flujo);
	dlg.append(or, cuerpo);
	d.body.append(dlg);
	b.hidden = false;
	b.setAttribute('aria-haspopup', 'dialog');
	const bajar = (): void => {
		if (!dlg.open) return;
		const fin = (): void => {
			dlg.close();
			b.focus({ preventScroll: true });
		};
		if (!conAnim()) {
			fin();
			return;
		}
		const a = dlg.animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: T.bajaHoja, easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fill: 'forwards' });
		a.onfinish = () => {
			fin();
			a.cancel();
		};
	};
	let abiertaEn = 0;
	let pulsoEnFondo = false;
	b.addEventListener('click', () => {
		if (dlg.open) return;
		abiertaEn = performance.now();
		dlg.showModal();
		h.focus({ preventScroll: true });
		if (conAnim()) dlg.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(-8px)', offset: 0.82 }, { transform: 'none' }], { duration: T.hoja, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)' });
	});
	x.addEventListener('click', bajar);
	dlg.addEventListener('cancel', (e) => {
		e.preventDefault();
		bajar();
	});
	// Se cierra por el fondo solo si el toque empezó ahí y ya pasó el primer instante (el segundo clic de un doble clic no la cierra).
	dlg.addEventListener('pointerdown', (e) => {
		pulsoEnFondo = e.target === dlg;
	});
	dlg.addEventListener('click', (e) => {
		if (cierraPorFondo({ enFondo: e.target === dlg, empezoEnFondo: pulsoEnFondo, msDesdeApertura: performance.now() - abiertaEn })) bajar();
		pulsoEnFondo = false;
	});
});

// ---------- 8. Arranque ----------
// El hash de una ficha fija puede ser el de una de sus páginas (/tecnico/#el-caso): abre esa página, sin animación y con el
// foco en ella. Devuelve si la había (si no, la ficha queda donde estaba).
const irAlHash = (o: FichaViva): boolean => {
	const i = paginaDelHash(
		location.hash,
		o.pags.map((p) => p.id),
	);
	if (i < 0) return false;
	o.hojas.scrollTo({ left: i * o.hojas.clientWidth, behavior: 'auto' });
	o.idx = i;
	actualizar(o);
	// El foco va al título de la página y no a la página entera (su anillo rodeaba los 1216 × 668 px).
	enfocarTituloDePagina(o.pags[i]);
	return true;
};
function enfocarTituloDePagina(pag: HTMLElement): void {
	const titulo = pag.querySelector<HTMLElement>('h1, h2, h3');
	if (titulo) {
		if (!titulo.hasAttribute('tabindex')) titulo.tabIndex = -1;
		titulo.focus({ preventScroll: true });
	} else pag.focus({ preventScroll: true });
}
const fija = d.querySelector<HTMLElement>('.ficha.fija');
if (fija && fichas.has(fija.id)) {
	const o = fichas.get(fija.id) as FichaViva;
	abierta = o;
	fija.classList.add('abierta');
	raiz.classList.add('con-ficha');
	if (lomos) lomos.classList.add('visible');
	const conHash = irAlHash(o);
	if (!conHash) {
		actualizar(o);
		// Sin hash de página: si se vuelve (con «Atrás») desde otra página, queda en la página desde la que se salió.
		restaurarPagina(o);
	}
	// Con `#página`, al terminar la carga el navegador pone el foco en el destino (la página entera): se lo devuelve al título.
	if (conHash) {
		const reenfocar = (): void => {
			requestAnimationFrame(() => {
				const a = d.activeElement;
				if (!a || a === d.body || o.pags.includes(a as HTMLElement)) irAlHash(o);
			});
		};
		if (d.readyState === 'complete') reenfocar();
		else addEventListener('load', reenfocar, { once: true });
	}
	addEventListener('hashchange', () => {
		irAlHash(o);
		requestAnimationFrame(() => {
			if (d.activeElement && o.pags.includes(d.activeElement as HTMLElement)) irAlHash(o);
		});
	});
} else {
	const id = location.hash.slice(1);
	const o = fichas.get(id);
	if (o) {
		// Recargar con la ficha abierta no borra el estado de la entrada: si la había sumado una ficha, «Atrás» la sigue cerrando.
		empujada = fueEmpujada(history.state);
		abrir(o, { modo: 'directo' });
		restaurarPagina(o);
		// Al cargar con `#ficha`, el navegador salta al fragmento después de este script y deshace el foco; se vuelve
		// a pedir cuando la página terminó de cargar.
		if (d.readyState === 'complete') reenfocarSiNadaLoTiene(o);
		else addEventListener('load', () => reenfocarSiNadaLoTiene(o), { once: true });
	}
}
