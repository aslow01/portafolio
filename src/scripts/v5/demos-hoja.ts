// Hoja de autoría de la ficha Demos (web v5): el botón «Ver mi parte y la autoría» abre una hoja que sube desde
// abajo con la parte de Matías y la autoría de esa demo. Es el segundo nivel de la ficha, a un toque.
//
// Contrato con el HTML (src/v5/fichas/Demos.astro):
//   button.ver-codigo[data-autoria="<id>"][hidden]   el botón; se muestra solo si el navegador sabe de <dialog>
//   #<id>.autoria-flujo > .autoria-t + dl            el contenido; sin JavaScript queda en el flujo, debajo de las acciones
// Acá se arma el <dialog class="hoja"> (el mismo componente que la hoja de código de pestanas.ts, con su solapa «03 Autoría»)
// y se le pasa el contenido. Se cierra con «Cerrar», con Escape, con un toque fuera, con «Atrás» del navegador (queda en la
// misma página de la ficha) y el foco vuelve al botón que la abrió.
//
// Compatible con la política de contenido (script-src 'self', style-src 'self'): sin eval, sin atributos en línea. Todo el texto
// que se arma acá va con `textContent`; no guarda nada en el navegador. Convive con pestanas.ts sin tocarlo: «Atrás» con
// la hoja abierta deja la misma ficha abierta (el hash no cambia), así que el manejador de pestanas.ts no tiene nada que hacer.

// El import también hace de este archivo un módulo: si no, TypeScript lo toma por un script global y sus constantes chocan con las de pestanas.ts.
import { tituloAutoriaDe } from '../../lib/contenido.ts';
import { cierraPorFondo } from '../../lib/paginas.ts';
import { idiomaDe, traductor } from '../../i18n/idioma.ts';

// El idioma de la página es el de <html lang> (lo pone BaseV5 según la dirección).
const idioma = idiomaDe(document.documentElement.lang);
const tr = traductor(idioma);
const tituloAutoria = tituloAutoriaDe(idioma);

const d = document;
const quieto = matchMedia('(prefers-reduced-motion: reduce)');
const conAnim = (): boolean => !quieto.matches && 'animate' in Element.prototype;
/** Duraciones (ms): la hoja sube en 560 y baja en 380, como la de código. */
const T = { sube: 560, baja: 380 } as const;

interface Hoja {
	dlg: HTMLDialogElement;
	bajar: (desdeHistorial?: boolean) => void;
}
const hojas: Hoja[] = [];
// Se ignora el próximo «popstate» cuando lo provoca el propio cierre de una hoja (history.back()).
let ignorarPop = false;
// El estado que tenía el historial antes de abrir una hoja: se repone si «Adelante» cae en una entrada de hoja ya cerrada.
let previo: unknown = null;
// El botón que tiene que recuperar el foco cuando termina de recorrerse el historial.
let foco: HTMLElement | null = null;

// El historial puede negarse en contextos aislados: nunca debe romper la hoja.
const historial = (como: 'push' | 'replace', estado: unknown): void => {
	try {
		if (como === 'push') history.pushState(estado, '', location.href);
		else history.replaceState(estado, '', location.href);
	} catch {
		/* sin historial: la hoja igual abre y cierra */
	}
};
const hojaDe = (estado: unknown): string | null => {
	if (estado && typeof estado === 'object' && 'hoja' in estado && typeof (estado as { hoja: unknown }).hoja === 'string') return (estado as { hoja: string }).hoja;
	return null;
};

const crear = <K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, texto?: string): HTMLElementTagNameMap[K] => {
	const e = d.createElement(tag);
	if (clase) e.className = clase;
	if (texto) e.textContent = texto;
	return e;
};

if (typeof HTMLDialogElement === 'function') {
	d.querySelectorAll<HTMLButtonElement>('button.ver-codigo[data-autoria]').forEach((boton) => {
		const id = boton.dataset.autoria ?? '';
		const flujo = d.getElementById(id);
		if (!flujo) return;
		const titulo = flujo.querySelector('.autoria-t');
		const textoTitulo = titulo?.textContent?.trim() || tituloAutoria;
		titulo?.remove(); // en la hoja, el título es el <h2> de su cabeza

		const dlg = crear('dialog', 'hoja hoja-autoria');
		dlg.id = `hoja-${id}`;
		dlg.setAttribute('aria-labelledby', `${dlg.id}-t`);
		const oreja = crear('div', 'hoja-oreja');
		oreja.setAttribute('aria-hidden', 'true');
		const solapa = crear('span', 'oreja');
		solapa.append(crear('span', 'num', '03'), crear('span', '', tr('Autoría', 'Authorship')));
		oreja.append(solapa);
		const cuerpo = crear('div', 'hoja-cuerpo');
		const cabeza = crear('div', 'hoja-cabeza');
		const h = crear('h2', '', textoTitulo);
		h.id = `${dlg.id}-t`;
		h.tabIndex = -1;
		const x = crear('button', 'cerrar-hoja', tr('Cerrar', 'Close'));
		x.type = 'button';
		cabeza.append(h, x);
		cuerpo.append(cabeza, flujo);
		dlg.append(oreja, cuerpo);
		// Dentro de su ficha, para que sus estilos (todos cuelgan de .f-demos) y el color de la ficha le lleguen.
		(boton.closest('.ficha') ?? d.body).append(dlg);
		boton.hidden = false;
		boton.setAttribute('aria-haspopup', 'dialog');

		let cerrando = false;
		let cierrePropio = false;
		// Cerrada por la propia hoja: se saca del historial la entrada que se agregó al abrirla.
		const retirarEntrada = (): void => {
			if (hojaDe(history.state) !== id) return;
			ignorarPop = true;
			setTimeout(() => {
				ignorarPop = false;
			}, 600);
			// Recorrer el historial le quita el foco al botón (Chrome lo hace la primera vez): se lo devuelve el popstate.
			foco = boton;
			history.back();
		};
		const bajar = (desdeHistorial = false): void => {
			if (!dlg.open || cerrando) return;
			cerrando = true;
			const fin = (): void => {
				cierrePropio = true;
				dlg.close();
				cerrando = false;
				boton.focus({ preventScroll: true });
				if (!desdeHistorial) retirarEntrada();
			};
			if (!conAnim()) {
				fin();
				return;
			}
			const a = dlg.animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: T.baja, easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fill: 'forwards' });
			a.onfinish = () => {
				fin();
				a.cancel();
			};
		};
		hojas.push({ dlg, bajar });

		let abiertaEn = 0;
		let pulsoEnFondo = false;
		boton.addEventListener('click', () => {
			if (dlg.open) return;
			abiertaEn = performance.now();
			previo = history.state;
			historial('push', { hoja: id });
			dlg.showModal();
			h.focus({ preventScroll: true });
			if (conAnim()) dlg.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(-8px)', offset: 0.82 }, { transform: 'none' }], { duration: T.sube, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)' });
		});
		x.addEventListener('click', () => bajar());
		// Escape: el navegador cierra el <dialog> de golpe; acá se baja con su animación y se devuelve el foco.
		dlg.addEventListener('cancel', (e) => {
			e.preventDefault();
			bajar();
		});
		// Algunos navegadores cierran con un segundo Escape sin avisar con «cancel»: se hace lo mismo que al cerrar.
		dlg.addEventListener('close', () => {
			if (cierrePropio) {
				cierrePropio = false;
				return;
			}
			boton.focus({ preventScroll: true });
			retirarEntrada();
		});
		// Se cierra por el fondo solo si el toque empezó ahí y ya pasó el primer instante (el segundo clic de un doble clic no la cierra).
		dlg.addEventListener('pointerdown', (e) => {
			pulsoEnFondo = e.target === dlg;
		});
		dlg.addEventListener('click', (e) => {
			if (cierraPorFondo({ enFondo: e.target === dlg, empezoEnFondo: pulsoEnFondo, msDesdeApertura: performance.now() - abiertaEn })) bajar();
			pulsoEnFondo = false;
		});
		// Las flechas ← → de la ficha (pasar de página) no valen con la hoja abierta: el <dialog> está dentro de la ficha.
		dlg.addEventListener('keydown', (e) => e.stopPropagation());
	});

	// «Atrás» con una hoja abierta la baja y deja la misma página; «Adelante» a una hoja ya cerrada no la reabre.
	addEventListener('popstate', () => {
		if (ignorarPop) {
			ignorarPop = false;
			const b = foco;
			foco = null;
			// Después de que corran los demás manejadores de «popstate» (los de pestanas.ts).
			if (b) setTimeout(() => b.focus({ preventScroll: true }), 0);
			return;
		}
		const abierta = hojas.find((h) => h.dlg.open);
		if (abierta) {
			abierta.bajar(true);
			return;
		}
		if (hojaDe(history.state)) historial('replace', previo);
	});
}
