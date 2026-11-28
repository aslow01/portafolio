// Red de seguridad barata, no una garantía: reemplaza correos, teléfonos, CUIT/CUIL, DNI y otros números largos por
// «[dato omitido]» antes de mandar lo que escribió el visitante al modelo. Un nombre o una dirección no se detectan.

export const OMITIDO = '[dato omitido]';

const CORREO = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Una cadena de 8 o más dígitos, con un separador (espacio, punto, guion, paréntesis) entre algunos de ellos.
const NUMERO_LARGO = /\+?\d(?:[  ().-]?\d){7,}/g;
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function omitirDatosPersonales(texto: string): string {
	return texto.replace(CORREO, OMITIDO).replace(NUMERO_LARGO, (m) => (FECHA_ISO.test(m) ? m : OMITIDO));
}
