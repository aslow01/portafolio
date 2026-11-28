// INTERFAZ DEL ASISTENTE PARA LA PRESENTACIÓN (maquetador). Solo tipos: sin lógica, sin DOM.
//
// Quien dibuja el widget usa esto y nada más de src/lib/asistente:
//
//   const asistente = crearAsistente(config);        // controlador.ts
//   asistente.suscribir((estado) => dibujar(estado)); // se llama al suscribirse y en cada cambio
//   asistente.abrir(); asistente.enviar(texto); asistente.reintentar(); asistente.reiniciar(); asistente.cerrar();
//
// Reglas que la presentación respeta (docs-asistente/01-diseno.md, sección 8):
//  - Todo texto que venga del asistente (`Fragmento.texto`, `Enlace.texto`) se pinta como TEXTO (textContent o nodos de texto),
//    nunca como HTML. Este módulo ya dejó solo los enlaces permitidos; la presentación no arma otros.
//  - El `mailto:` de «Escribir por correo» lo arma la presentación con `ContactoPublico.correo` (nunca con texto del modelo).
//  - La conversación vive solo en memoria: sin almacenamiento del navegador ni cookies.
//  - Si algo cambia en este archivo después de entregado, se avisa (es el contrato con la presentación).

import type { Idioma } from '../../../worker/src/contrato.ts';

export type { Idioma };

// ---------------------------------------------------------------------------------------------------------------------
// Entrada: cómo se crea el asistente
// ---------------------------------------------------------------------------------------------------------------------

/** Datos de contacto públicos, tal como salen de src/lib/sitio.ts y datos-pendientes.ts (la página los pasa al widget). */
export interface ContactoPublico {
	correo: string;
	linkedin: string;
	/** Rutas de los CV en PDF que el sitio publica, p. ej. `/cv/matias-ormeno-cv-tecnico.pdf`. */
	cvs: readonly string[];
	/** `slug` de los casos publicados: los enlaces a `/casos/<slug>/` que no figuren en la lista no se dibujan. */
	casos?: readonly string[] | undefined;
}

/** Obtiene el token anti robots de Turnstile. Lo implementa `turnstile-navegador.ts` (o un doble en las pruebas). */
export interface ProveedorTurnstile {
	/** Un token nuevo. Rechaza la promesa si la verificación no pasa. Puede mostrar un recuadro dentro de la hoja. */
	obtenerToken(): Promise<string>;
	/** Descarta el widget y su token (tras un fallo o al cerrar). */
	reiniciar(): void;
}

export interface ConfigAsistente {
	/** Base del Worker, sin barra final: `https://asistente.matiasormeno.com.ar` (o `http://localhost:8787` en local). */
	urlApi: string;
	/** Idioma de la interfaz (`<html lang>`). La respuesta sigue el idioma de la pregunta. */
	idioma: Idioma;
	contacto: ContactoPublico;
	turnstile: ProveedorTurnstile;
	/** Espera máxima por respuesta, en ms. Sin dato, 20 000 (el diseño: «tiempo agotado» a los 20 s). */
	tiempoMaxMs?: number;
	/** Ruta de la página donde está el visitante (`location.pathname`), para que el asistente sepa de qué se habla. */
	pagina?: () => string | undefined;
	/** `navigator.onLine`. Sin dato, se supone que hay conexión; la presentación avisa cambios con `fijarConexion`. */
	enLinea?: () => boolean;
	/** Solo para pruebas. */
	fetch?: typeof fetch;
	ahora?: () => number;
	/** Solo para pruebas: cómo se agenda el fin de un límite temporal (por defecto, `setTimeout`, que no mantiene vivo a Node). */
	programar?: (accion: () => void, ms: number) => void;
}

// ---------------------------------------------------------------------------------------------------------------------
// Salida: el estado que se dibuja
// ---------------------------------------------------------------------------------------------------------------------

/** Un pedazo de una línea. `texto` se pinta como texto, `enlace` como `<a>` con `href` ya validado. */
export type Fragmento =
	| { tipo: 'texto'; texto: string; negrita: boolean }
	| { tipo: 'enlace'; texto: string; href: string; externo: boolean };

export type Bloque =
	| { tipo: 'parrafo'; partes: readonly Fragmento[] }
	| { tipo: 'lista'; items: readonly (readonly Fragmento[])[] };

/** Una página del sitio que respalda la respuesta («Fuente: Técnico e IA →»). Máximo tres por respuesta. */
export interface Fuente {
	/** Ruta interna validada (`/casos/automatizacion-facturas/`, `/#demos`…). */
	href: string;
	/** Rótulo corto: de una lista cerrada de páginas o, para un caso, el texto del enlace recortado. */
	texto: string;
}

export interface TurnoUsuario {
	id: number;
	rol: 'usuario';
	texto: string;
	/** `pendiente` mientras espera respuesta; `fallida` si hubo error (el turno se queda y «Reintentar» lo reenvía sin duplicarlo). */
	estado: 'pendiente' | 'enviada' | 'fallida';
}

export interface TurnoAsistente {
	id: number;
	rol: 'asistente';
	/** Texto tal como lo devolvió el Worker (sin el marcador de contacto). Sirve de historial; no se pinta. */
	texto: string;
	/** La firma del Worker sobre `texto`: va con él en el historial del pedido siguiente. La presentación no la usa. */
	firma: string;
	bloques: readonly Bloque[];
	fuentes: readonly Fuente[];
	/** `true`: el asistente indicó que corresponde contactar a Matías → mostrar «Escribir por correo» bajo la respuesta. */
	derivar: boolean;
}

export type Turno = TurnoUsuario | TurnoAsistente;

/**
 * Qué falló. `clave` es la entrada de `Textos.errores` con el texto para mostrar; el resto le dice a la presentación qué
 * botones dibujar y si apaga el formulario.
 */
export type ClaveError =
	| 'red'
	| 'tiempo'
	| 'servicio'
	| 'verificacion'
	| 'limiteVisitante'
	| 'limiteSesion'
	| 'conversacionLarga'
	| 'tope'
	| 'largo'
	| 'vacio';

export interface ErrorVista {
	clave: ClaveError;
	/** Mostrar «Reintentar» (llama a `reintentar()`). */
	reintentable: boolean;
	/** Mostrar «Escribir por correo». */
	ofrecerContacto: boolean;
	/** Apagar el campo y «Enviar» (límite del visitante o tope diario). */
	bloqueaFormulario: boolean;
	/** Segundos hasta que tenga sentido volver a intentar, si el Worker lo dijo. */
	reintentarEnSeg?: number;
}

/** `libre`: nada en curso. `verificando`: Turnstile o apertura de sesión. `respondiendo`: esperando la respuesta del Worker. */
export type Fase = 'libre' | 'verificando' | 'respondiendo';

export interface EstadoAsistente {
	/** La hoja está abierta (la presentación la muestra u oculta). */
	abierto: boolean;
	turnos: readonly Turno[];
	fase: Fase;
	/** `fase !== 'libre'`: mostrar el turno «Buscando en el portafolio…». */
	esperando: boolean;
	error: ErrorVista | null;
	/** `false`: lámpara del lanzador vacía («no disponible ahora»). El lanzador sigue abriendo siempre. */
	disponible: boolean;
	/** Sin conexión: banda de aviso y «Enviar» con `aria-disabled`. */
	sinConexion: boolean;
	/** El campo y «Enviar» admiten escribir (`false` con límite o tope). */
	formularioHabilitado: boolean;
	/** Preguntas que quedan en la sesión, o `null` si todavía no hay sesión. */
	restantes: number | null;
	/** Máximo de caracteres de una pregunta (`maxlength` del campo). */
	maxCaracteres: number;
	/** Mostrar las sugerencias (aún no hubo ninguna pregunta). */
	mostrarSugerencias: boolean;
	idioma: Idioma;
}

export interface Asistente {
	/** Copia inmutable del estado actual. */
	estado(): EstadoAsistente;
	/** Se llama una vez al suscribirse y después en cada cambio. Devuelve la función que cancela la suscripción. */
	suscribir(oyente: (estado: EstadoAsistente) => void): () => void;
	/** Abre la hoja. La primera vez consulta `/v1/salud` (sin Turnstile). */
	abrir(): void;
	cerrar(): void;
	/** Envía una pregunta. Si hay una en curso, o el texto no sirve (vacío, largo), no envía y deja un error `vacio` o `largo`. */
	enviar(texto: string): Promise<void>;
	/** Reenvía la última pregunta fallida, sin duplicarla en el registro. */
	reintentar(): Promise<void>;
	/** Conversación nueva: borra los turnos y el error; la sesión sigue si no venció. */
	reiniciar(): void;
	/** La presentación avisa los eventos `online` y `offline` del navegador. */
	fijarConexion(enLinea: boolean): void;
	readonly textos: Textos;
}

/** Textos de la interfaz en el idioma configurado (docs-asistente/02-textos.md). `{correo}` y `{max}` ya vienen reemplazados. */
export interface Textos {
	lanzador: string;
	lanzadorCorto: string;
	tituloPanel: string;
	etiquetaIa: string;
	saludo: string;
	campoPlaceholder: string;
	enviar: string;
	cerrar: string;
	nueva: string;
	escribiendo: string;
	escribiendoLector: string;
	sugerencias: readonly string[];
	privacidad: string;
	contactoTitulo: string;
	contactoTexto: string;
	escribir: string;
	verContacto: string;
	asuntoCorreo: string;
	reintentar: string;
	avisoPrueba: string;
	/** Banda cuando `estado.sinConexion`. */
	sinConexion: string;
	/** Texto visible del turno de espera («Buscando en el portafolio…»). */
	buscando: string;
	/** Frase que precede a las sugerencias en el estado vacío. */
	introVacio: string;
	/** Rótulos del acta: USTED / ASISTENTE / FUENTE / SU PREGUNTA (la presentación les da el estilo). */
	rotulos: { usted: string; asistente: string; fuente: string; pregunta: string };
	/** «Quedan 3 preguntas en esta conversación.» (singular y plural; `estado.restantes` cuenta la sesión, no el día). */
	quedan(n: number): string;
	errores: Readonly<Record<ClaveError, string>>;
}
