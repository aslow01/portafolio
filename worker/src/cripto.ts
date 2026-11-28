// Utilidades de Web Crypto compartidas (sin dependencias: el runtime de Workers y Node las traen).

const codificador = new TextEncoder();

export function aBase64Url(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** `null` si el texto no es base64url válido. */
export function deBase64Url(texto: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]*$/.test(texto) || texto.length % 4 === 1) return null;
	const b64 = texto.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (texto.length % 4)) % 4);
	try {
		const bin = atob(b64);
		return Uint8Array.from(bin, (c) => c.charCodeAt(0));
	} catch {
		return null;
	}
}

export function aHex(bytes: Uint8Array): string {
	return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function aBytes(texto: string): Uint8Array<ArrayBuffer> {
	return codificador.encode(texto) as Uint8Array<ArrayBuffer>;
}

/** Los secretos tienen que ser cadenas de al menos 32 caracteres (la guía pide 32 bytes aleatorios en base64: 44); si no, el Worker no firma nada. */
export function secretoValido(secreto: unknown): secreto is string {
	return typeof secreto === 'string' && secreto.length >= 32;
}

export async function claveHmac(secreto: Uint8Array<ArrayBuffer>, usos: ('sign' | 'verify')[]): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', secreto, { name: 'HMAC', hash: 'SHA-256' }, false, usos);
}

export async function hmacSha256(secreto: Uint8Array<ArrayBuffer>, datos: string): Promise<Uint8Array<ArrayBuffer>> {
	const clave = await claveHmac(secreto, ['sign']);
	return new Uint8Array(await crypto.subtle.sign('HMAC', clave, aBytes(datos)));
}

export async function sha256Hex(texto: string): Promise<string> {
	return aHex(new Uint8Array(await crypto.subtle.digest('SHA-256', aBytes(texto))));
}
