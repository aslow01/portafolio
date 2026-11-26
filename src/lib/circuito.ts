// Circuito de la Fig. 1 de la portada: lo que hace la demo del lector de facturas, paso a paso.
// Los importes del acercamiento tienen que coincidir
// con la prueba que publica la demo (`queDice` en src/content/demos/lector-facturas.md): lo comprueba
// scripts/circuito.test.mjs, para que la figura nunca muestre una cifra que la prueba no comprueba.
// Datos de la demo propia: ficticios.

export interface Acercamiento {
	rotulo: string;
	/** Importe de la factura, con espacio fijo (U+00A0) después del "$". */
	factura: string;
	/** Importe en el sistema, partido para resaltar el último dígito (el que difiere). */
	sistema: [string, string];
	veredicto: string;
	nota: string;
}

export interface Paso {
	titulo: string;
	texto: string;
	/** El paso lo decide una persona (se dibuja como rombo). */
	persona?: boolean;
	acercamiento?: Acercamiento;
}

export const circuitoLector: Paso[] = [
	{
		titulo: 'Lee cada factura',
		texto: 'PDF o imagen con el código QR de ARCA.',
	},
	{
		titulo: 'Arma la planilla',
		texto:
			'Un comprobante por fila. Marca para revisar los datos dudosos: CUIT inválido, total en cero, fecha futura. Si un comprobante llega dos veces, queda como “duplicada en la planilla” y no se cuenta dos veces.',
	},
	{
		titulo: 'Lee lo ya cargado',
		texto:
			'El archivo CSV que exporta el sistema de gestión. Si el sistema repite un comprobante, lo informa como “cargada dos veces en el sistema”.',
	},
	{
		titulo: 'Busca cada comprobante',
		texto: 'Por CUIT del emisor, tipo, punto de venta y número. Si no figura, “Falta cargar”.',
	},
	{
		titulo: 'Compara el importe al centavo',
		texto: 'Sin tolerancia. Si coincide, “Ya cargada”.',
		acercamiento: {
			rotulo: 'Acercamiento: un caso de la prueba automática',
			factura: '$\u00A01.000,00',
			sistema: ['$\u00A01.000,0', '1'],
			veredicto: 'Mal cargada: otro importe',
			nota: 'Un centavo de diferencia alcanza: no cuenta como cargada.',
		},
	},
	{
		titulo: 'Revisa lo que sobra en el sistema',
		texto: 'Lo cargado que ninguna factura recibida reclama: “cargadas en el sistema y no recibidas”.',
	},
	{
		titulo: 'Decide una persona',
		texto: 'La demo marca y explica; no carga nada en otro sistema. La planilla se exporta a CSV.',
		persona: true,
	},
];
