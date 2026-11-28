// Registro estructurado, una línea JSON por evento y SIN texto del visitante. Solo pasan los campos de esta lista:
// el mensaje, el historial, la respuesta, la IP, la huella, el token de Turnstile y la sesión no tienen por dónde salir.

const CAMPOS = [
	'evento',
	'codigo',
	'http',
	'requestId',
	'ms',
	'tokensEntrada',
	'tokensSalida',
	'tokensCache',
	'idioma',
	'derivar',
	'indice',
] as const;

export function registrar(
	datos: Record<string, unknown>,
	salida: (linea: string) => void = (l) => console.log(l),
	ahora: () => string = () => new Date().toISOString(),
): void {
	const limpio: Record<string, string | number | boolean> = { t: ahora() };
	for (const campo of CAMPOS) {
		const v = datos[campo];
		if (typeof v === 'string') limpio[campo] = v.slice(0, 80);
		else if (typeof v === 'number' || typeof v === 'boolean') limpio[campo] = v;
	}
	salida(JSON.stringify(limpio));
}
