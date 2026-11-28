// Huella del visitante: HMAC de su IP con una clave que cambia cada día. La IP nunca se guarda ni se registra.
// Se usa SOLO `CF-Connecting-IP` (lo pone Cloudflare; el cliente no lo puede falsear). (docs-asistente/03, sección 7.2)
import { aBytes, aHex, hmacSha256 } from './cripto.ts';

/** IPv4 tal cual; IPv6 agrupada por /64 (un visitante controla todo su prefijo); sin IP, una marca fija. */
export function normalizarIp(ip: string | null | undefined): string {
	const t = (ip ?? '').trim().toLowerCase();
	if (t === '') return 'sin-ip';
	const mapeada = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(t);
	if (mapeada) return mapeada[1];
	if (!t.includes(':')) return t;
	const sinZona = t.split('%')[0];
	const mitades = sinZona.split('::');
	if (mitades.length > 2) return t;
	const grupos = (s: string): string[] => (s === '' ? [] : s.split(':'));
	const izq = grupos(mitades[0]);
	const der = mitades.length === 2 ? grupos(mitades[1]) : [];
	const relleno = mitades.length === 2 ? 8 - izq.length - der.length : 0;
	const todos = [...izq, ...Array<string>(Math.max(relleno, 0)).fill('0'), ...der];
	if (todos.length !== 8 || todos.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return t;
	return `${todos.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':')}::/64`;
}

/** 16 caracteres hexadecimales. `fecha` es el día UTC `AAAA-MM-DD`: la huella cambia cada día. */
export async function huellaVisitante(secreto: string, fecha: string, ip: string | null | undefined): Promise<string> {
	const claveDelDia = await hmacSha256(aBytes(secreto), `huella:${fecha}`);
	const mac = await hmacSha256(claveDelDia, normalizarIp(ip));
	return aHex(mac).slice(0, 16);
}
