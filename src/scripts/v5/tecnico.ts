// Comportamiento propio de la página /tecnico/ (web v5), encima de pestanas.ts. Sin dependencias; sin eval ni
// atributos en línea (CSP: script-src 'self'). Solo queda lo que no es del sistema de fichas:
//   La hoja de código (la crea pestanas.ts) toma la tipografía y el color de esta ficha y se cierra con «Atrás»
//   del navegador: al abrir suma una entrada al historial, Atrás la baja y deja
//   el foco en el botón que la abrió, y abrir y cerrar no deja entradas de más.
// Lo demás lo hacen el armazón (Ficha.astro, Pagina.astro, Lomos.astro) y pestanas.ts: «Cerrar» sale a la portada con la
// cortina (ficha fija), y el hash (#el-caso…) abre la página con ese id.
// Acá se carga pestanas.ts (BaseV5 ya no lo pone en todas las páginas: la 404 va sin JS), y al importarlo corre primero
// (la ficha ya está abierta y las hojas creadas). Que los scripts no queden en línea lo asegura
// `vite.build.assetsInlineLimit: 0` (astro.config.mjs).
import './pestanas';

const d = document;
const ficha = d.querySelector<HTMLElement>('.ficha.fija.f-tecnico');

if (ficha) {
	let porAtras = false; // el cierre lo pidió el botón Atrás: al cerrarse no hay que volver a llamar a history.back()
	let foco: HTMLElement | null = null; // el botón que tiene que recuperar el foco cuando termina de recorrerse el historial
	d.querySelectorAll<HTMLDialogElement>('dialog.hoja').forEach((hoja) => {
		// La hoja cuelga del <body>, fuera de la ficha: se le dan la clase (tipografía, código) y el color del grafito.
		hoja.classList.add('f-tecnico', 'c-grafito');
		const boton = d.querySelector<HTMLElement>(`.ver-codigo[data-hoja="${hoja.id}"]`);
		// pestanas.ts abre la hoja en su propio clic (registrado antes que este): acá solo se suma la entrada al historial.
		boton?.addEventListener('click', () => {
			if (!hoja.open) return;
			try {
				history.pushState({ hoja: hoja.id }, '', location.href);
			} catch {
				/* sin historial: la hoja igual abre y cierra con Cerrar y Escape */
			}
		});
		// Cerrada por «Cerrar», Escape o un toque afuera: se quita la entrada que sumó al abrir.
		hoja.addEventListener('close', () => {
			if (porAtras) {
				porAtras = false;
				return;
			}
			if (history.state && history.state.hoja === hoja.id) {
				// Recorrer el historial le quita el foco al botón (sobre todo con `#página` en la dirección): se lo devuelve el popstate.
				foco = boton;
				history.back();
			}
		});
	});
	addEventListener('popstate', () => {
		// Después de que corran los demás manejadores de «popstate» y el salto del navegador al fragmento.
		const b = foco;
		foco = null;
		if (b) setTimeout(() => b.focus({ preventScroll: true }), 0);
		const abierta = d.querySelector<HTMLDialogElement>('dialog.hoja[open]');
		if (abierta) {
			// Atrás con la hoja abierta: se baja (con su animación y el foco de vuelta al botón) y la página queda donde estaba.
			porAtras = true;
			abierta.querySelector<HTMLElement>('.cerrar-hoja')?.click();
			// Sin animación (movimiento reducido) la hoja se baja en el acto y el navegador, al volver en el historial,
			// manda el foco a la página del hash: se lo devuelve al botón que abrió la hoja. Con animación, la hoja sigue
			// abierta (el resto de la página no recibe foco) y el foco vuelve solo al terminar de bajar.
			setTimeout(() => {
				if (!abierta.open) d.querySelector<HTMLElement>(`.ver-codigo[data-hoja="${abierta.id}"]`)?.focus({ preventScroll: true });
			}, 0);
			return;
		}
		// «Adelante» hacia una entrada de hoja con la hoja cerrada: no se reabre.
		if (history.state && history.state.hoja) {
			try {
				history.replaceState(null, '', location.href);
			} catch {
				/* sin historial */
			}
		}
	});
}
