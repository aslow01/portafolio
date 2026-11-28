// Compara la huella del contexto local con la del Worker desplegado (`GET /v1/salud`, campo `indice`).
// Si difieren, se cambió el contenido de la web y falta redesplegar el Worker (docs-asistente/03, 5.3). Solo informa: nunca bloquea.

const TIEMPO_MS = 8000;

/**
 * @param {{ url: string, huellaLocal: string, fetchFn?: typeof fetch }} p
 * @returns {Promise<{ estado: 'omitido' | 'coincide' | 'difiere' | 'sin-respuesta', mensaje: string }>}
 */
export async function compararConDesplegado({ url, huellaLocal, fetchFn = fetch }) {
	const bruta = (url ?? '').trim();
	if (bruta === '') return { estado: 'omitido', mensaje: 'Sin PUBLIC_ASISTENTE_URL: no se compara la huella del Worker desplegado.' };
	let origen;
	try {
		const u = new URL(bruta);
		if (u.protocol !== 'https:' || u.username !== '' || u.password !== '') throw new Error('no es https o lleva credenciales');
		origen = u.origin;
	} catch {
		return { estado: 'omitido', mensaje: 'PUBLIC_ASISTENTE_URL no es una dirección https válida: no se compara la huella del Worker desplegado.' };
	}
	try {
		const r = await fetchFn(`${origen}/v1/salud`, { signal: AbortSignal.timeout(TIEMPO_MS) });
		if (!r.ok) throw new Error(`HTTP ${r.status}`);
		const datos = await r.json();
		if (typeof datos?.indice !== 'string' || datos.indice === '') throw new Error('sin índice');
		if (datos.indice === huellaLocal) return { estado: 'coincide', mensaje: `El Worker desplegado tiene el mismo contexto que la web (huella ${huellaLocal}).` };
		return {
			estado: 'difiere',
			mensaje: `AVISO: el Worker desplegado tiene la huella ${datos.indice} y la web local ${huellaLocal}. Cambió el contenido de la web: falta redesplegar el Worker (npm run asistente:indice y wrangler deploy).`,
		};
	} catch {
		return { estado: 'sin-respuesta', mensaje: 'AVISO: no se pudo consultar /v1/salud del Worker; la huella no se comparó. Revíselo a mano.' };
	}
}
