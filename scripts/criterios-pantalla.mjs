// Los topes de «página que no entra» (la especificación de diseño, privada, los fija por tamaño de pantalla), como funciones puras (las usa
// scripts/verificar-paginas.mjs, que mide en el navegador, y se prueban en scripts/criterios-pantalla.test.mjs).
// La razón de una página es su alto de contenido ÷ su alto visible: 1,00 = entra justo, sin desplazarse.

/** Tamaños de pantalla (CSS px) que fija la especificación. */
export const TAMANOS = [
	{ nombre: '390x844', ancho: 390, alto: 844 },
	{ nombre: '768x1024', ancho: 768, alto: 1024 },
	{ nombre: '1440x900', ancho: 1440, alto: 900 },
	{ nombre: '360x740', ancho: 360, alto: 740 },
	{ nombre: '320x640', ancho: 320, alto: 640 },
	{ nombre: '844x390', ancho: 844, alto: 390 },
];

/** Nunca aceptable, en ningún tamaño. */
export const TOPE_ABSOLUTO = 1.5;

/** La razón más alta aceptable para una pantalla de `ancho` × `alto`. */
export function topeDeRazon({ ancho, alto }) {
	if (alto <= 520) return 1.5; // apaisado
	if (ancho <= 320) return 1.25;
	if (ancho <= 360) return 1.02;
	if (ancho <= 1440) return 1.0; // 390 × 844, 768 × 1024 y 1440 × 900 (y lo que quede entre medio, por el criterio más duro)
	return TOPE_ABSOLUTO;
}

/** `undefined` si la página entra; si no, el motivo. Tolera 0,5 % por redondeo de píxeles (alto en enteros). */
export function problemaDeRazon(razon, tamano) {
	const tope = topeDeRazon(tamano);
	if (razon > TOPE_ABSOLUTO) return `la página ocupa ${razon.toFixed(2)} veces la pantalla (nunca más de ${TOPE_ABSOLUTO})`;
	if (razon > tope + 0.005) return `la página ocupa ${razon.toFixed(2)} veces la pantalla y el tope a ${tamano.ancho} × ${tamano.alto} es ${tope.toFixed(2)}`;
	return undefined;
}

/** Páginas sin ficha (composición propia: el índice de casos y la 404): se mide el documento entero. */
export const PAGINAS_SIN_FICHA = ['/casos/', '/404.html'];

export const esPaginaSinFicha = (ruta) => PAGINAS_SIN_FICHA.includes(ruta);

/** Razón de un documento: alto de todo el contenido ÷ alto visible (`documentElement.scrollHeight / innerHeight`). */
export const razonDeDocumento = (altoDocumento, altoVisible) => (altoVisible > 0 ? altoDocumento / altoVisible : Infinity);

/**
 * Las rutas de los casos a partir de las entradas de dist/casos/ (`readdirSync(…, { withFileTypes: true })`): solo las
 * carpetas. `index.html` es el índice /casos/, no un caso: tomarlo daría `/casos/index.html/` y la medición fallaría.
 */
export const rutasDeCasos = (entradas) => entradas.filter((e) => e.isDirectory()).map((e) => `/casos/${e.name}/`);

/** La lista que mide `verificar-paginas.mjs`: las cinco fichas de la portada, /tecnico/, el índice, los casos y la 404. */
export const paginasAMedir = (casos) => ['/#logistica', '/#tecnico', '/#demos', '/#proyectos', '/#contacto', '/tecnico/', '/casos/', ...casos, '/404.html'];
