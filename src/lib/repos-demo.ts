// Dónde está el repositorio de una demo, para comprobar que su extracto de prueba es literal.
// Pura (sin sistema de archivos ni `process`): el test le pasa el entorno y una función `existe`.

export type Repositorios =
	| { estado: 'comprobar'; rutas: string[] }
	| { estado: 'fallar'; mensaje: string }
	| { estado: 'saltear'; mensaje: string };

/** Nombre de la variable de entorno que fija la ruta: `RUTA_DEMO_LECTOR_FACTURAS` (o `…_PUBLICO`). */
export function variableDeRuta(slug: string, publico = false): string {
	return `RUTA_DEMO_${slug.toUpperCase().replace(/-/g, '_')}${publico ? '_PUBLICO' : ''}`;
}

const apagado = (v: string | undefined) => v === undefined || ['', '0', 'false'].includes(v.trim().toLowerCase());

/**
 * Qué repositorios hay que comparar. Se mira el de trabajo (`D:/demo-<slug>`) y el público
 * (`D:/demo-<slug>-publico`), o lo que digan las variables `RUTA_DEMO_*`.
 *
 * - Una variable definida que apunta a una carpeta inexistente falla siempre: un error de tipeo no
 *   puede apagar el control.
 * - Sin ningún repositorio, falla si `CI` o `EXIGIR_EXTRACTO=1` están definidos; si no, saltea con aviso.
 */
export function repositoriosDeDemo(
	slug: string,
	entorno: { env: Record<string, string | undefined>; existe: (ruta: string) => boolean },
): Repositorios {
	const { env, existe } = entorno;
	const candidatos = [
		{ variable: variableDeRuta(slug), porDefecto: `D:/demo-${slug}` },
		{ variable: variableDeRuta(slug, true), porDefecto: `D:/demo-${slug}-publico` },
	];

	const errores: string[] = [];
	const rutas: string[] = [];
	for (const { variable, porDefecto } of candidatos) {
		const definida = env[variable];
		if (definida !== undefined) {
			if (definida.trim() === '') errores.push(`${variable} está definida pero vacía`);
			else if (!existe(definida)) errores.push(`${variable} apunta a "${definida}", que no existe`);
			else rutas.push(definida);
		} else if (existe(porDefecto)) {
			rutas.push(porDefecto);
		}
	}
	if (errores.length) {
		return { estado: 'fallar', mensaje: `${errores.join('; ')}. Corrija la variable o quítela.` };
	}
	if (rutas.length) return { estado: 'comprobar', rutas };

	const exigir = !apagado(env.CI) || env.EXIGIR_EXTRACTO === '1';
	const donde = `${candidatos.map((c) => c.porDefecto).join(' ni ')} (o ${candidatos.map((c) => c.variable).join(' / ')})`;
	if (exigir) {
		return {
			estado: 'fallar',
			mensaje: `no se encontró el repositorio de la demo "${slug}" (${donde}) y el control es obligatorio (CI o EXIGIR_EXTRACTO=1)`,
		};
	}
	return {
		estado: 'saltear',
		mensaje: `AVISO: no se encontró el repositorio de la demo "${slug}" (${donde}); no se comprobó el extracto. Defina ${candidatos[0].variable} para comprobarlo, o EXIGIR_EXTRACTO=1 para que esta falta sea un error.`,
	};
}
