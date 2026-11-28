// Presentación del asistente de la web v5: «La consulta a mano». Dibuja los lanzadores y la hoja
// de consulta a partir del estado que entrega src/lib/asistente (la lógica: red, sesión, Turnstile, límites). Acá NO hay
// lógica de red ni de negocio: solo DOM, foco, teclado y movimiento. Sin dependencias.
//
// Compatible con la política de contenido (public/_headers: script-src 'self', style-src 'self'): sin eval, sin atributos en
// línea y sin `setAttribute('style')` (los valores dinámicos van por `style.setProperty`, que es CSSOM). Todo lo que viene
// del asistente o del visitante se pinta con `textContent` o nodos de texto, nunca como HTML (lo vigila scripts/higiene.mjs).
// La conversación vive solo en memoria de la página: sin almacenamiento del navegador ni cookies.
//
// Contrato con el HTML:
//   #consulta-raiz[data-modo|data-api|data-sitekey|data-correo|data-linkedin|data-cvs]   lo deja v5/Consulta.astro (BaseV5)
//   .lomos.visible                                                                       el lanzador aparece y se va con los lomos
// Arma el mismo botón (`button.consulta-lanzador`) en cada lugar donde la pantalla puede mostrarlo; consulta.css elige cuál se ve
// (docs-asistente/destacado.md):
//   .ficha-cabeza .utiles > …lanzador         la cabeza de cada ficha (escritorio), pegado a «ES | EN» / «Cerrar»
//   .portada .cabeza > …lanzador              la cabecera de la portada (escritorio)
//   button.consulta-barra                     la barra fija al pie de la portada (celular y tableta); lleva `html.con-barra`
//   div.consulta-pieza > …lanzador            la celda junto al paginador (celular y tableta, en las fichas)
//   .consulta-invita (tras [data-consulta-invita])   dos preguntas que abren la hoja y se envían solas (camino técnico, escritorio)
//   dialog.consulta#consulta                  la hoja: modal y a pantalla completa en celular; en escritorio, no modal
// Lo que va fuera de la portada y de las fichas (la barra, la celda y la hoja) cuelga de <body>, así `portada.inert` y el teclado
// de las fichas no lo alcanzan. Sin JavaScript no hay nada de esto (queda Contacto). Si el asistente no inicia, se quita todo y se
// quitan `con-consulta` y `con-barra` de <html>: el paginador y la portada vuelven a su medida.

// La hoja de estilos viaja con este script: si el asistente no se monta, no se descarga ni se enlaza en ninguna página.
import '../../styles/v5/consulta.css';
import { mailto } from '../../lib/sitio.ts';
import type { Bloque, ErrorVista, EstadoAsistente, Fragmento, Idioma, Turno, TurnoAsistente, TurnoUsuario } from '../../lib/asistente/tipos.ts';
import { rutaDe } from '../../i18n/idioma.ts';
import { esDeCampo, esFalla, idiomaDe, quedanPocas, rotulosDe, textoContador, type Rotulos } from '../../v5/consulta/rotulos.ts';
import { crearMotor } from './consulta-motor.ts';

const d = document;
const raiz = d.documentElement;
const quieto = matchMedia('(prefers-reduced-motion: reduce)');
const conAnim = (): boolean => !quieto.matches && 'animate' in Element.prototype;
/** Escritorio: la hoja sale del riel y no es modal. Debajo (o con poca altura), pantalla completa y modal. Igual que consulta.css. */
const escritorio = matchMedia('(min-width: 1024px) and (min-height: 521px)');
const toque = matchMedia('(pointer: coarse)');

/** Las preguntas de la invitación del camino técnico: las dos primeras sugerencias del asistente. */
const PREGUNTAS_INVITACION = 2;

/** Duraciones y curvas de las animaciones hechas con el script (las de CSS están en tokens.css; son las de pestanas.ts). */
const PESO = 'cubic-bezier(0.7, 0, 0.12, 1)';
const T = { abrirPanel: 380, cerrarPanel: 300, abrirHoja: 560, cerrarHoja: 380 } as const;
/** Por debajo de este alto visible (px), la hoja pasa a su versión compacta (consulta.css, `.compacta`). */
const COMPACTA = 520;

const crear = <K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, texto?: string): HTMLElementTagNameMap[K] => {
	const e = d.createElement(tag);
	if (clase) e.className = clase;
	if (texto) e.textContent = texto;
	return e;
};
const lampara = (prendida: boolean): HTMLElement => {
	const l = crear('i', prendida ? 'consulta-lampara prendida' : 'consulta-lampara');
	l.setAttribute('aria-hidden', 'true');
	return l;
};
const flecha = (texto: string, clase = 'consulta-flecha'): HTMLElement => {
	const f = crear('span', clase, texto);
	f.setAttribute('aria-hidden', 'true');
	return f;
};

const marca = d.getElementById('consulta-raiz');
if (marca && typeof HTMLDialogElement === 'function') {
	iniciar(marca).catch(() => {
		// Si no inicia, no queda nada a medias: ni lanzadores, ni invitación, ni la columna reservada en el paginador, ni el lugar de la barra.
		raiz.classList.remove('con-consulta', 'con-barra');
		d.querySelectorAll('.consulta-lanzador, .consulta-pieza, .consulta-invita').forEach((e) => e.remove());
		d.getElementById('consulta')?.remove();
	});
}

async function iniciar(marca: HTMLElement): Promise<void> {
	const idioma: Idioma = idiomaDe(raiz.lang);
	const R: Rotulos = rotulosDe(idioma);

	// ---------- Marcado ----------
	// Turnstile (interaction-only) dibuja acá SOLO si Cloudflare pide una interacción; el recuadro con su explicación se ve
	// únicamente mientras el widget ocupa lugar (si no, no queda ni el filete).
	const verif = crear('div', 'consulta-verificacion');
	verif.append(crear('p', '', R.verificacion));
	const montajeVerif = crear('div', 'consulta-turnstile');
	verif.append(montajeVerif);
	new ResizeObserver(() => verif.classList.toggle('activa', montajeVerif.offsetHeight > 0)).observe(montajeVerif);

	const { asistente, prueba } = await crearMotor(marca, idioma, { montaje: montajeVerif });
	const X = asistente.textos;

	// Los lanzadores: el sello «IA» (un globo de diálogo, decorativo), la frase entera y la flecha. En el celular apaisado y en la celda
	// se ve la forma corta («Preguntar»); consulta.css elige cuál de las dos, y el nombre accesible sale de la que se ve:
	// «Pregúntele a mi asistente de IA» o «Preguntar al asistente de IA» (siempre contiene lo que se lee en pantalla).
	const lanzadores: HTMLButtonElement[] = [];
	const srApagados: HTMLElement[] = [];
	const lanzador = (lugar: 'cabeza' | 'barra' | 'celda' | 'archivo'): HTMLButtonElement => {
		const b = crear('button', `consulta-lanzador consulta-en-${lugar}${lugar === 'barra' ? ' consulta-barra' : ''}`);
		b.type = 'button';
		b.setAttribute('aria-haspopup', 'dialog');
		b.setAttribute('aria-expanded', 'false');
		b.setAttribute('aria-controls', 'consulta');
		const sello = crear('span', 'consulta-sello', R.siglaIa);
		sello.setAttribute('aria-hidden', 'true');
		const completo = crear('span', 'consulta-completo');
		completo.append(crear('span', 'consulta-frase', X.lanzador), crear('span', 'solo-lector', R.complementoFrase));
		const reducido = crear('span', 'consulta-reducido');
		reducido.append(crear('span', 'consulta-palabra', R.palabra), crear('span', 'solo-lector', R.complementoLanzador));
		const srApagado = crear('span', 'solo-lector');
		b.append(sello, completo, reducido, flecha('→', 'consulta-ir'), srApagado);
		lanzadores.push(b);
		srApagados.push(srApagado);
		return b;
	};

	const dlg = crear('dialog', 'consulta');
	dlg.id = 'consulta';
	dlg.setAttribute('aria-labelledby', 'consulta-titulo');

	const cab = crear('div', 'consulta-cabeza');
	const cerrar = crear('button', 'consulta-cerrar');
	cerrar.type = 'button';
	cerrar.setAttribute('aria-label', X.cerrar);
	cerrar.append(crear('span', '', R.cerrar));
	const solapa = crear('p', 'consulta-solapa');
	solapa.setAttribute('aria-hidden', 'true');
	solapa.append(lampara(true), R.solapa);
	cab.append(cerrar, solapa);

	const tapa = crear('div', 'consulta-tapa');
	const titulo = crear('h2', '', X.tituloPanel);
	titulo.id = 'consulta-titulo';
	const bajada = crear('p', '', R.bajada);
	bajada.id = 'consulta-bajada';
	const sello = crear('p', 'consulta-prueba', X.avisoPrueba);
	sello.hidden = !prueba;
	tapa.append(titulo, bajada, sello);

	const sinRed = crear('p', 'consulta-sinred');
	sinRed.setAttribute('role', 'status');
	sinRed.hidden = true;
	sinRed.append(lampara(false), X.sinConexion);

	// El cuerpo se desplaza por dentro; la conversación es un «log» sin anuncios propios (las respuestas y los errores se
	// anuncian en las dos regiones de abajo: así la pregunta propia no se repite y cada cosa suena una sola vez).
	const cuerpo = crear('div', 'consulta-cuerpo');
	const inicio = crear('div', 'consulta-inicio');
	// Un solo aviso («responde con lo publicado y puede equivocarse»), el de la bajada de la tapa: el saludo largo de `X.saludo` ya no se
	// dibuja (repetía lo mismo y empujaba las preguntas a la mitad de la pantalla en el celular).
	const listaSug = crear('ul', 'consulta-sugerencias');
	X.sugerencias.forEach((s) => {
		const li = crear('li');
		const b = crear('button', '', s);
		b.type = 'button';
		b.dataset.sugerencia = s;
		li.append(b);
		listaSug.append(li);
	});
	inicio.append(crear('p', 'consulta-saludo', X.introVacio), listaSug);
	const registro = crear('div', 'consulta-registro');
	registro.setAttribute('role', 'log');
	registro.setAttribute('aria-live', 'off');
	registro.setAttribute('aria-label', X.tituloPanel);
	registro.tabIndex = -1; // recibe el foco por programa cuando la hoja se abre desde una pregunta de la invitación
	cuerpo.append(inicio, registro);

	const form = crear('form', 'consulta-form');
	form.noValidate = true;
	const filaRotulo = crear('div', 'consulta-fila-rotulo');
	const etiqueta = crear('label', 'consulta-rotulo', X.rotulos.pregunta);
	etiqueta.htmlFor = 'consulta-campo';
	const lado = crear('div', 'consulta-lado');
	const contador = crear('span', 'consulta-contador');
	contador.hidden = true;
	const nueva = crear('button', 'consulta-nueva', R.nuevaCorto);
	nueva.type = 'button';
	nueva.setAttribute('aria-label', X.nueva);
	nueva.hidden = true;
	lado.append(contador, nueva);
	filaRotulo.append(etiqueta, lado);
	const fila = crear('div', 'consulta-fila');
	const campo = crear('textarea', 'consulta-campo');
	campo.id = 'consulta-campo';
	campo.rows = 1;
	campo.placeholder = X.campoPlaceholder;
	campo.autocomplete = 'off';
	campo.setAttribute('enterkeyhint', 'send');
	campo.setAttribute('aria-describedby', 'consulta-bajada consulta-nota');
	const enviar = crear('button', 'consulta-enviar');
	enviar.type = 'submit';
	enviar.setAttribute('aria-label', X.enviar);
	enviar.append(crear('span', '', R.enviar), flecha('→'));
	fila.append(campo, enviar);
	const validacion = crear('p', 'consulta-validacion');
	validacion.hidden = true;
	const nota = crear('p', 'consulta-nota', X.privacidad);
	nota.id = 'consulta-nota';
	const quedan = crear('span');
	form.append(verif, filaRotulo, fila, validacion, nota);
	nota.append(quedan);

	// Regiones para lectores de pantalla: una cortés (respuestas y «escribiendo») y una asertiva (errores).
	const anuncio = crear('p', 'solo-lector');
	anuncio.setAttribute('role', 'status');
	const alerta = crear('p', 'solo-lector');
	alerta.setAttribute('role', 'alert');

	// La cabeza (con «Cerrar») va primera en el DOM, como se ve (WCAG 2.4.3): el foco entra igual por el campo, y Mayúsculas + Tab
	// llega a «Cerrar»; Escape también cierra.
	dlg.append(cab, tapa, sinRed, cuerpo, form, anuncio, alerta);

	// Dónde van los lanzadores. Cabeza de la portada (escritorio): después del selector de idioma.
	d.querySelector('.portada .cabeza')?.append(lanzador('cabeza'));
	// Cabeza de cada ficha: en el grupo de «ES | EN» y «Cerrar», del lado de adentro (a la izquierda del grupo en 01–03, a la derecha en 04–05).
	d.querySelectorAll('.ficha-cabeza').forEach((c) => {
		const l = lanzador('cabeza');
		const utiles = c.querySelector('.utiles');
		if (!utiles) c.append(l);
		else if (utiles.classList.contains('izq')) utiles.append(l);
		else utiles.prepend(l);
	});
	// Barra al pie de la portada (celular y tableta): la portada le reserva el lugar con `html.con-barra`.
	const barra = d.querySelector('.portada') ? lanzador('barra') : null;
	if (barra) raiz.classList.add('con-barra');
	// El índice de casos (/casos/), a donde llega quien viene del CV: no tiene paginador, así que no hay celda. En escritorio, el lanzador va
	// al pie de la cabeza de la columna izquierda, debajo del CV y el correo; en celular no se dibuja (la pila ya llena la pantalla).
	const cabArchivo = d.querySelector('.archivo-cab');
	cabArchivo?.append(lanzador('archivo'));
	// Celda junto al paginador de las fichas (celular y tableta).
	const pieza = cabArchivo ? null : crear('div', 'consulta-pieza');
	pieza?.append(lanzador('celda'));
	d.body.append(...(barra ? [barra] : []), ...(pieza ? [pieza] : []), dlg);

	// La invitación del camino técnico (escritorio): el rótulo y dos preguntas que abren la hoja y se envían solas.
	const invitaciones: HTMLButtonElement[] = [];
	const grupos: HTMLElement[] = [];
	d.querySelectorAll('[data-consulta-invita]').forEach((ref, i) => {
		const grupo = crear('div', 'consulta-invita');
		const rotulo = crear('p', 'consulta-invita-rotulo', R.invita);
		rotulo.id = `consulta-invita-${i}`;
		grupo.setAttribute('role', 'group');
		grupo.setAttribute('aria-label', X.lanzador); // el rótulo visible solo aparece con lugar de sobra (consulta.css)
		const fila = crear('div', 'consulta-invita-fila');
		for (const pregunta of X.sugerencias.slice(0, PREGUNTAS_INVITACION)) {
			const b = crear('button', 'consulta-pregunta');
			b.type = 'button';
			b.dataset.pregunta = pregunta;
			b.append(crear('span', '', pregunta), flecha('→', 'consulta-ir'));
			invitaciones.push(b);
			fila.append(b);
		}
		grupo.append(rotulo, fila);
		grupos.push(grupo);
		// Después de las acciones (CV, casos, correo), antes del circuito: el orden de Tab es el de lectura (WCAG 2.4.3)
		const acciones = ref.closest('.pg')?.querySelector(':scope > .acciones');
		(acciones ?? ref).after(grupo);
	});

	// ---------- Estado de la presentación ----------
	const turnos = new Map<number, HTMLElement>();
	let espera: HTMLElement | null = null;
	let bloqueError: HTMLElement | null = null;
	let faltaAnunciarEspera = true;
	let errorAnunciado = '';
	let conEntrada = false; // en celular, la hoja suma una entrada al historial: «Atrás» la cierra
	let modo: 'panel' | 'hoja' = 'panel';
	let salida: Animation | null = null;
	let ultimo: EstadoAsistente = asistente.estado();
	/** Quien abrió la hoja (un lanzador o una pregunta de la invitación): al cerrarla, el foco vuelve ahí. */
	let abridor: HTMLElement | null = null;
	const visible = (e: HTMLElement): boolean => e.isConnected && e.checkVisibility?.() !== false;
	const lanzadorVisible = (): HTMLElement | undefined => lanzadores.find(visible);

	// La invitación solo se queda si entra con un respiro de 16 px sobre el circuito de la tapa (el alto de la pantalla y el idioma cambian
	// cuánto lugar hay): primero se va la segunda pregunta y, si aún no entra, la invitación entera. Con menos de 700 px de alto, o en el
	// celular, consulta.css ya no la muestra y no hay nada que medir.
	const RESPIRO = 16;
	function ajustarInvitaciones(): void {
		for (const g of grupos) {
			g.classList.remove('sin-segunda', 'sin-lugar');
			const circuito = g.closest('.pg')?.querySelector('.tira ol');
			if (!circuito || !visible(g)) continue;
			// En la grilla del escritorio la invitación se superpone al aire del circuito: alcanza con el respiro. En una columna (tableta
			// en vertical y celular) ocupa lugar de verdad: además no puede hacer desplazar la página.
			const enGrilla = g.parentElement !== null && getComputedStyle(g.parentElement).display === 'grid';
			const pagina = g.closest<HTMLElement>('.pagina');
			const cabe = (): boolean =>
				g.getBoundingClientRect().bottom + RESPIRO <= circuito.getBoundingClientRect().top && (enGrilla || !pagina || pagina.scrollHeight <= pagina.clientHeight + 1);
			if (cabe()) continue;
			g.classList.add('sin-segunda');
			if (!cabe()) g.classList.add('sin-lugar');
		}
	}
	if (grupos.length > 0) {
		ajustarInvitaciones();
		void d.fonts?.ready.then(ajustarInvitaciones);
		const medida = new ResizeObserver(ajustarInvitaciones);
		for (const g of grupos) {
			const pagina = g.closest('.pagina');
			if (pagina) medida.observe(pagina);
		}
		// La entrada de la página mueve el circuito (su posición cambia sin que cambie ningún tamaño): se mide de nuevo cuando algo termina de animarse
		let cuadro = 0;
		const reajustar = (): void => {
			cancelAnimationFrame(cuadro);
			cuadro = requestAnimationFrame(ajustarInvitaciones);
		};
		d.addEventListener('animationend', reajustar, true);
		d.addEventListener('transitionend', reajustar, true);
		addEventListener('load', reajustar);
	}

	// Un anuncio pendiente se puede cancelar: si «escribiendo…» llega después de que la espera ya terminó (un error inmediato), no se dice.
	const pendiente = new WeakMap<HTMLElement, { cuadro: number; texto: string }>();
	const decir = (region: HTMLElement, texto: string): void => {
		const previo = pendiente.get(region);
		if (previo) cancelAnimationFrame(previo.cuadro);
		region.textContent = '';
		const cuadro = requestAnimationFrame(() => {
			region.textContent = texto;
			pendiente.delete(region);
		});
		pendiente.set(region, { cuadro, texto });
	};
	const callarSi = (region: HTMLElement, texto: string): void => {
		const previo = pendiente.get(region);
		if (previo?.texto === texto) {
			cancelAnimationFrame(previo.cuadro);
			pendiente.delete(region);
		}
		if (region.textContent === texto) region.textContent = '';
	};
	const aTexto = (bloques: readonly Bloque[]): string =>
		bloques
			.map((b) => (b.tipo === 'parrafo' ? b.partes.map((p) => p.texto).join('') : b.items.map((i) => i.map((p) => p.texto).join('')).join('. ')))
			.join(' ');

	/**
	 * En la portada (`/` en español, `/en/` en inglés), un enlace a una ficha es un salto interno (`#demos`): lo toma el script de
	 * las fichas. En otra página, navega.
	 */
	const portada = rutaDe(idioma, '/');
	const ajustarHref = (href: string): string => (location.pathname === portada && href.startsWith(`${portada}#`) ? href.slice(portada.length) : href);

	// ---------- Dibujo de los turnos ----------
	function partes(padre: HTMLElement, fragmentos: readonly Fragmento[]): void {
		for (const f of fragmentos) {
			if (f.tipo === 'texto') {
				if (f.negrita) padre.append(crear('strong', '', f.texto));
				else padre.append(d.createTextNode(f.texto));
			} else {
				const a = crear('a', '', f.texto);
				a.href = ajustarHref(f.href);
				if (f.externo) a.rel = 'noopener';
				padre.append(a);
			}
		}
	}
	function bloques(padre: HTMLElement, lista: readonly Bloque[]): void {
		for (const b of lista) {
			if (b.tipo === 'parrafo') {
				const p = crear('p');
				partes(p, b.partes);
				padre.append(p);
			} else {
				const ul = crear('ul');
				for (const item of b.items) {
					const li = crear('li');
					partes(li, item);
					ul.append(li);
				}
				padre.append(ul);
			}
		}
	}
	function turnoUsuario(t: TurnoUsuario): HTMLElement {
		const el = crear('div', 'consulta-turno pregunta');
		el.append(crear('p', 'consulta-rotulo', X.rotulos.usted), crear('p', 'consulta-pregunta-texto', t.texto));
		el.dataset.estado = t.estado;
		return el;
	}
	function acciones(...hijos: HTMLElement[]): HTMLElement {
		const a = crear('div', 'consulta-acciones');
		a.append(...hijos);
		return a;
	}
	function enlaceCorreo(clase: string): HTMLAnchorElement {
		const a = crear('a', clase, X.escribir);
		a.href = mailto(X.asuntoCorreo);
		return a;
	}
	function tarjetaContacto(): HTMLElement {
		const c = crear('div', 'consulta-contacto');
		const ver = crear('a', 'consulta-enlace', X.verContacto);
		ver.href = ajustarHref(rutaDe(idioma, '/#contacto'));
		c.append(crear('h3', '', X.contactoTitulo), crear('p', '', X.contactoTexto), acciones(enlaceCorreo('consulta-boton-lleno'), ver));
		return c;
	}
	function turnoAsistente(t: TurnoAsistente): HTMLElement {
		const el = crear('div', 'consulta-turno respuesta llega');
		const r = crear('p', 'consulta-rotulo');
		r.append(lampara(true), X.rotulos.asistente);
		const texto = crear('div', 'consulta-respuesta-texto');
		bloques(texto, t.bloques);
		el.append(r, texto);
		if (t.fuentes.length > 0) {
			const f = crear('p', 'consulta-fuentes');
			const rot = crear('span', 'consulta-rotulo', X.rotulos.fuente);
			rot.setAttribute('aria-hidden', 'true');
			f.append(rot);
			for (const fu of t.fuentes) {
				const a = crear('a');
				a.href = ajustarHref(fu.href);
				a.append(crear('span', 'solo-lector', `${X.rotulos.fuente}: `), crear('span', 'consulta-fuente-texto', fu.texto));
				f.append(a);
			}
			el.append(f);
		}
		if (t.derivar) el.append(tarjetaContacto());
		return el;
	}
	function turnoEspera(): HTMLElement {
		const el = crear('div', 'consulta-turno respuesta espera');
		el.setAttribute('aria-hidden', 'true');
		const r = crear('p', 'consulta-rotulo');
		r.append(lampara(false), X.rotulos.asistente);
		el.append(r, crear('p', 'consulta-espera-texto', X.buscando));
		return el;
	}
	/** Falla o límite del servicio, en el registro: filete a la izquierda, rótulo, una frase y las acciones. */
	function aviso(err: ErrorVista): HTMLElement {
		const el = crear('div', esFalla(err.clave) ? 'consulta-aviso falla' : 'consulta-aviso');
		el.dataset.clave = err.clave;
		const rot = crear('p', 'consulta-rotulo');
		rot.append(lampara(false), R.rotuloError[err.clave]);
		el.append(rot, crear('p', '', X.errores[err.clave]));
		const hijos: HTMLElement[] = [];
		if (err.reintentable) {
			const b = crear('button', 'consulta-boton', X.reintentar);
			b.type = 'button';
			b.dataset.reintentar = '';
			hijos.push(b);
		}
		if (err.ofrecerContacto) hijos.push(enlaceCorreo(err.bloqueaFormulario ? 'consulta-boton-lleno' : 'consulta-enlace'));
		if (hijos.length > 0) el.append(acciones(...hijos));
		return el;
	}

	/** El foco no se pierde cuando desaparece lo que lo tenía (una sugerencia, «Reintentar»): vuelve al campo, o a la hoja si el teclado virtual estorba. */
	function devolverFoco(): void {
		if (toque.matches) cuerpo.focus({ preventScroll: true });
		else campo.focus({ preventScroll: true });
	}
	function ajustarCuerpoFocable(): void {
		// Una región que se desplaza tiene que poder leerse con el teclado: si no tiene nada enfocable adentro, se le da el foco con Tab.
		const hayFocable = cuerpo.querySelector('a[href], button:not([disabled])') !== null;
		const desplaza = cuerpo.scrollHeight > cuerpo.clientHeight + 1;
		if (desplaza && !hayFocable) cuerpo.tabIndex = 0;
		else if (cuerpo.tabIndex === 0) cuerpo.tabIndex = -1;
	}
	cuerpo.tabIndex = -1;

	// ---------- Dibujo del estado ----------
	function dibujar(e: EstadoAsistente): void {
		const previo = ultimo;
		ultimo = e;
		const hayTurnos = e.turnos.length > 0;

		// Lanzadores (todos iguales) y preguntas de la invitación (apagadas mientras una pregunta espera su respuesta)
		for (const l of lanzadores) {
			l.setAttribute('aria-expanded', String(e.abierto));
			l.toggleAttribute('data-apagado', !e.disponible);
		}
		for (const s of srApagados) s.textContent = e.disponible ? '' : R.noDisponible;
		for (const b of invitaciones) b.setAttribute('aria-disabled', String(e.fase !== 'libre'));
		// Sin servicio (tope de uso, pausa, sin conexión) no se invita a preguntar: queda el lanzador, que explica el motivo adentro
		const sinServicio = !e.disponible || e.sinConexion || !e.formularioHabilitado;
		for (const g of grupos) {
			if (g.hidden === sinServicio) continue;
			g.hidden = sinServicio;
			if (!sinServicio) ajustarInvitaciones(); // vuelve: se mide de nuevo si entra
		}

		// Turnos nuevos (por id; los turnos no cambian de lugar). Sin turnos, se limpia (conversación nueva).
		let nuevo = false;
		if (!hayTurnos && turnos.size > 0) {
			registro.replaceChildren();
			turnos.clear();
			espera = null;
			bloqueError = null;
		}
		let ultimaPregunta: HTMLElement | null = null;
		for (const t of e.turnos as readonly Turno[]) {
			let el = turnos.get(t.id);
			if (!el) {
				el = t.rol === 'usuario' ? turnoUsuario(t) : turnoAsistente(t);
				turnos.set(t.id, el);
				registro.append(el);
				nuevo = true;
				if (t.rol === 'asistente') decir(anuncio, `${X.rotulos.asistente}: ${aTexto(t.bloques)}`);
			} else if (t.rol === 'usuario') {
				el.dataset.estado = t.estado;
			}
			if (t.rol === 'usuario') ultimaPregunta = el;
		}

		// «Buscando…»: un turno visible (sin anuncio propio) y un aviso único para el lector de pantalla
		if (e.esperando && !espera) {
			espera = turnoEspera();
			registro.append(espera);
			nuevo = true;
			if (faltaAnunciarEspera) decir(anuncio, X.escribiendoLector);
			faltaAnunciarEspera = false;
		} else if (!e.esperando && espera) {
			espera.remove();
			espera = null;
			faltaAnunciarEspera = true;
			// Un lector en modo navegación no debe encontrar «escribiendo…» después de un error: se vacía lo que quedó (la respuesta, si hubo, ya lo reemplazó).
			callarSi(anuncio, X.escribiendoLector);
		}

		// Errores: los de la respuesta, en el registro; los del campo (vacío, largo), junto al campo
		const err = e.error;
		const enRegistro = err !== null && !esDeCampo(err.clave) ? err : null;
		const delCampo = err !== null && esDeCampo(err.clave) ? err : null;
		if (enRegistro) {
			if (!bloqueError || bloqueError.dataset.clave !== enRegistro.clave) {
				bloqueError?.remove();
				bloqueError = aviso(enRegistro);
				nuevo = true;
			}
			registro.append(bloqueError);
			const firma = `${enRegistro.clave}:${e.turnos.length}`;
			if (firma !== errorAnunciado) {
				errorAnunciado = firma;
				const rot = R.rotuloError[enRegistro.clave];
				decir(alerta, `${rot ? `${rot}. ` : ''}${X.errores[enRegistro.clave]}`);
			}
		} else if (bloqueError) {
			if (bloqueError.contains(d.activeElement)) devolverFoco();
			bloqueError.remove();
			bloqueError = null;
			errorAnunciado = '';
		}
		if (espera) registro.append(espera); // siempre al final
		validacion.hidden = delCampo === null;
		if (delCampo) validacion.textContent = X.errores[delCampo.clave];

		// Estado vacío y «Nueva conversación»
		inicio.hidden = !e.mostrarSugerencias || !e.formularioHabilitado; // con el límite o el tope apagado, queda solo el motivo
		nueva.hidden = !hayTurnos;

		// Formulario
		campo.disabled = !e.formularioHabilitado;
		campo.placeholder = e.formularioHabilitado ? X.campoPlaceholder : R.campoApagado;
		sinRed.hidden = !e.sinConexion;
		actualizarEnviar();
		quedan.textContent = quedanPocas(e.restantes) ? ` ${X.quedan(e.restantes)}` : '';
		sello.hidden = !prueba;

		// Abrir o cerrar la hoja
		if (e.abierto && !dlg.open) mostrar();
		else if (!e.abierto && (dlg.open || previo.abierto)) ocultar();

		if (nuevo) {
			// Al llegar algo nuevo, el registro se desplaza hasta el comienzo de la pregunta (no hasta el final): se lee de arriba abajo
			const meta = ultimaPregunta ?? espera ?? bloqueError;
			meta?.scrollIntoView({ block: 'start', behavior: conAnim() ? 'smooth' : 'auto' });
		}
		ajustarCuerpoFocable();
	}

	function actualizarEnviar(): void {
		const e = ultimo;
		const vacio = campo.value.trim() === '';
		const espera = e.fase !== 'libre';
		const apagado = vacio || espera || e.sinConexion || !e.formularioHabilitado;
		enviar.setAttribute('aria-disabled', String(apagado));
		enviar.setAttribute('aria-label', espera ? R.enviarEsperando : X.enviar);
		// Sin `maxlength` nativo: un pegado largo se corta en silencio. Se deja pasar, el contador pasa a ser de error y «Enviar» explica el motivo.
		const largoCampo = [...campo.value].length;
		const c = textoContador(largoCampo, e.maxCaracteres);
		contador.hidden = c === null;
		contador.classList.toggle('pasado', largoCampo > e.maxCaracteres);
		if (c !== null) contador.textContent = c;
	}
	function autoajustar(): void {
		campo.style.setProperty('height', 'auto');
		campo.style.setProperty('height', `${Math.min(campo.scrollHeight + 4, 128)}px`);
	}
	/** `campo`: lo escrito en el formulario; `sugerencia`: un botón de la hoja; `invitacion`: una pregunta de la tapa del camino técnico. */
	function mandar(texto: string, desde: 'campo' | 'sugerencia' | 'invitacion' = 'campo'): void {
		const e = asistente.estado();
		const limpio = texto.trim();
		if (limpio === '' || e.fase !== 'libre' || e.sinConexion || !e.formularioHabilitado) return;
		if (desde === 'campo') {
			campo.value = '';
			autoajustar();
		}
		validacion.hidden = true;
		void asistente.enviar(limpio);
		actualizarEnviar();
		if (desde === 'sugerencia') devolverFoco();
		// Desde la invitación, el foco va al registro: allí se anuncia la respuesta (la región `aria-live` ya existe) y se lee con el lector
		else if (desde === 'invitacion') registro.focus({ preventScroll: true });
	}
	/**
	 * Una pregunta de la invitación: abre la hoja y la envía en el acto (el turno aparece «esperando»). Si el asistente no puede
	 * responder (sin conexión, tope, pausado), la hoja queda abierta con la pregunta escrita en el campo y el aviso del motivo.
	 */
	function preguntarDesde(origen: HTMLElement, texto: string): void {
		abridor = origen;
		void asistente.abrir();
		const e = asistente.estado();
		if (e.fase !== 'libre') return;
		if (!e.disponible || e.sinConexion || !e.formularioHabilitado) {
			campo.value = texto;
			autoajustar();
			actualizarEnviar();
			campo.focus({ preventScroll: true });
			return;
		}
		mandar(texto, 'invitacion');
	}

	// ---------- Abrir y cerrar la hoja ----------
	const frames = (entra: boolean): Keyframe[] => {
		if (modo === 'panel') return entra ? [{ transform: 'translateX(100%)' }, { transform: 'none' }] : [{ transform: 'none' }, { transform: 'translateX(100%)' }];
		return entra ? [{ transform: 'translateY(100%)' }, { transform: 'translateY(-8px)', offset: 0.82 }, { transform: 'none' }] : [{ transform: 'none' }, { transform: 'translateY(100%)' }];
	};
	const sinSalida = (): void => {
		if (!salida) return;
		salida.onfinish = null;
		salida.cancel();
		salida = null;
	};
	function empujarEntrada(): void {
		try {
			const previo: object = typeof history.state === 'object' && history.state !== null ? history.state : {};
			history.pushState({ ...previo, consulta: true }, '', location.href);
			conEntrada = true;
		} catch {
			/* sin historial: la hoja igual abre y cierra con Cerrar y Escape */
		}
	}
	function quitarEntrada(): void {
		if (!conEntrada) return;
		conEntrada = false;
		try {
			if (history.state && (history.state as { consulta?: unknown }).consulta) history.back();
		} catch {
			/* sin historial */
		}
	}
	function ajustarVisual(): void {
		// Con el teclado virtual abierto (iOS no achica `dvh`), la hoja ocupa solo lo que se ve y el formulario queda pegado abajo.
		const vv = window.visualViewport;
		if (modo !== 'hoja' || !dlg.open) return;
		const alto = vv?.height ?? innerHeight;
		if (vv) {
			dlg.style.setProperty('--consulta-alto', `${alto}px`);
			dlg.style.setProperty('--consulta-arriba', `${vv.offsetTop}px`);
		}
		dlg.classList.toggle('compacta', alto < COMPACTA);
	}
	/** Escritorio (hoja no modal): un elemento de la página que queda casi todo detrás de la hoja no recibe el foco: Tab sigue con el próximo visible (WCAG 2.4.11). */
	let sentidoTab: 1 | -1 = 1;
	/** Más de la mitad del elemento queda detrás de la hoja (con menos, el anillo de foco se ve). */
	const tapado = (el: Element): boolean => {
		const r = el.getBoundingClientRect();
		const h = dlg.getBoundingClientRect();
		const area = r.width * r.height;
		if (area <= 0) return false;
		const ancho = Math.max(0, Math.min(r.right, h.right) - Math.max(r.left, h.left));
		const alto = Math.max(0, Math.min(r.bottom, h.bottom) - Math.max(r.top, h.top));
		return (ancho * alto) / area > 0.5;
	};
	const enfocables = (): HTMLElement[] =>
		[...d.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, summary, [tabindex]')].filter(
			(el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && !el.closest('[inert]') && el.checkVisibility?.({ checkVisibilityCSS: true }) !== false,
		);
	d.addEventListener('keydown', (e) => {
		if (e.key === 'Tab') sentidoTab = e.shiftKey ? -1 : 1;
	}, true);
	d.addEventListener('focusin', (e) => {
		const el = e.target instanceof HTMLElement ? e.target : null;
		if (!el || modo !== 'panel' || !dlg.open || dlg.contains(el) || !tapado(el)) return;
		const lista = enfocables();
		let i = lista.indexOf(el);
		if (i < 0) return;
		for (i += sentidoTab; i >= 0 && i < lista.length; i += sentidoTab) {
			if (dlg.contains(lista[i]) || !tapado(lista[i])) {
				lista[i].focus({ preventScroll: true });
				return;
			}
		}
		(sentidoTab === 1 ? (lanzadorVisible() ?? campo) : campo).focus({ preventScroll: true });
	});
	function mostrar(): void {
		sinSalida();
		if (dlg.open) return;
		modo = escritorio.matches ? 'panel' : 'hoja';
		if (modo === 'hoja') {
			dlg.showModal();
			empujarEntrada();
			ajustarVisual();
		} else {
			dlg.show();
		}
		if (conAnim()) dlg.animate(frames(true), { duration: modo === 'panel' ? T.abrirPanel : T.abrirHoja, easing: modo === 'panel' ? PESO : 'cubic-bezier(0.2, 0.8, 0.25, 1)' });
		campo.focus({ preventScroll: true });
		ajustarCuerpoFocable();
	}
	function ocultar(): void {
		if (!dlg.open) return;
		const fin = (): void => {
			const conFoco = dlg.contains(d.activeElement) || d.activeElement === d.body || d.activeElement === null;
			dlg.close();
			dlg.style.removeProperty('--consulta-alto');
			dlg.style.removeProperty('--consulta-arriba');
			dlg.classList.remove('compacta');
			quitarEntrada();
			if (conFoco) (abridor && visible(abridor) ? abridor : lanzadorVisible())?.focus({ preventScroll: true });
		};
		if (!conAnim()) {
			fin();
			return;
		}
		if (salida) return;
		salida = dlg.animate(frames(false), { duration: modo === 'panel' ? T.cerrarPanel : T.cerrarHoja, easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fill: 'forwards' });
		salida.onfinish = () => {
			sinSalida();
			fin();
		};
	}

	// ---------- Eventos ----------
	for (const l of lanzadores) {
		l.addEventListener('click', () => {
			abridor = l;
			if (ultimo.abierto) asistente.cerrar();
			else void asistente.abrir();
		});
	}
	for (const b of invitaciones) {
		b.addEventListener('click', () => {
			if (b.getAttribute('aria-disabled') !== 'true') preguntarDesde(b, b.dataset.pregunta ?? '');
		});
	}
	cerrar.addEventListener('click', () => asistente.cerrar());
	dlg.addEventListener('cancel', (e) => {
		e.preventDefault();
		asistente.cerrar();
	});
	// En escritorio la hoja no es modal: Escape (desde la hoja o desde el lanzador) la cierra, aunque el foco esté en la página.
	d.addEventListener('keydown', (e) => {
		if (e.key !== 'Escape' || !ultimo.abierto || e.defaultPrevented) return;
		if (d.querySelector('dialog.hoja[open]')) return; // la hoja de código tiene su propio Escape
		e.preventDefault();
		// Sin esto, con el movimiento reducido (la hoja se cierra en el acto) el Escape seguiría hasta el script de las fichas y cerraría también la ficha
		e.stopPropagation();
		asistente.cerrar();
	});
	// «Atrás» en celular cierra la hoja (como la hoja de código)
	addEventListener('popstate', () => {
		if (conEntrada && ultimo.abierto && !(history.state && (history.state as { consulta?: unknown }).consulta)) {
			conEntrada = false;
			asistente.cerrar();
		}
	});
	// Girar el celular o cambiar el tamaño: si la hoja pasa de modal a no modal (o al revés), se vuelve a abrir en su modo
	escritorio.addEventListener('change', () => {
		if (!dlg.open) return;
		sinSalida();
		dlg.close();
		quitarEntrada();
		dlg.style.removeProperty('--consulta-alto');
		dlg.style.removeProperty('--consulta-arriba');
		dlg.classList.remove('compacta');
		mostrar();
	});
	window.visualViewport?.addEventListener('resize', ajustarVisual);
	window.visualViewport?.addEventListener('scroll', ajustarVisual);
	addEventListener('resize', ajustarVisual);
	// Un enlace de una respuesta lleva a otra página o ficha: en celular la hoja (modal) se baja; en escritorio sigue a la vista
	dlg.addEventListener('click', (e) => {
		const t = e.target instanceof Element ? e.target : null;
		const a = t?.closest('a');
		if (a && !a.href.startsWith('mailto:') && modo === 'hoja' && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
			// La entrada que sumó la hoja se descarta sin retroceder: el enlace suma la suya
			if (conEntrada) {
				conEntrada = false;
				try {
					const { consulta: _quitada, ...resto } = (history.state ?? {}) as Record<string, unknown>;
					history.replaceState(resto, '', location.href);
				} catch {
					/* sin historial */
				}
			}
			asistente.cerrar();
		}
		if (t?.closest('[data-reintentar]')) {
			devolverFoco();
			void asistente.reintentar();
		}
		const sug = t?.closest<HTMLElement>('[data-sugerencia]');
		if (sug) mandar(sug.dataset.sugerencia ?? '', 'sugerencia');
	});
	nueva.addEventListener('click', () => {
		asistente.reiniciar();
		campo.value = '';
		autoajustar();
		actualizarEnviar();
		campo.focus({ preventScroll: true });
	});
	form.addEventListener('submit', (e) => {
		e.preventDefault();
		if (enviar.getAttribute('aria-disabled') === 'true') return;
		mandar(campo.value);
	});
	campo.addEventListener('keydown', (e) => {
		// Enter envía; Mayúsculas + Enter hace un salto de línea (y no con el teclado de una composición: IME)
		if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
		e.preventDefault();
		if (enviar.getAttribute('aria-disabled') !== 'true') mandar(campo.value);
	});
	campo.addEventListener('input', () => {
		autoajustar();
		actualizarEnviar();
		if (!validacion.hidden) validacion.hidden = true;
	});
	addEventListener('online', () => asistente.fijarConexion(true));
	addEventListener('offline', () => asistente.fijarConexion(false));
	asistente.fijarConexion(navigator.onLine);

	// El asistente está siempre a la vista: ya no se va con los lomos (la portada tiene el suyo), así que la hoja abierta en escritorio
	// sigue donde está cuando se cierra la ficha de la portada.

	// «El asomo», el único movimiento: una vez por llegada al sitio, el lanzador que se ve sube 6 px y vuelve (consulta.css). La
	// «sesión» se decide sin guardar nada en el navegador: llegada nueva = sin página de origen o de otro sitio (cambiar de idioma o de
	// página dentro del sitio no lo repite). Con movimiento reducido no se arma.
	const llegadaNueva = ((): boolean => {
		try {
			return d.referrer === '' || new URL(d.referrer).origin !== location.origin;
		} catch {
			return true;
		}
	})();
	if (llegadaNueva && conAnim()) {
		const quitar = (): void => lanzadores.forEach((l) => l.classList.remove('consulta-asomo'));
		lanzadores.forEach((l) => l.classList.add('consulta-asomo'));
		d.addEventListener('animationend', (e) => e.animationName === 'consulta-asomo' && quitar(), true);
		setTimeout(quitar, 5000);
	}

	asistente.suscribir(dibujar);
	d.getElementById('consulta-raiz')?.setAttribute('data-listo', '');
}
