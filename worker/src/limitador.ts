// Límites de uso: contadores diarios y mensuales EXACTOS y ATÓMICOS en un Durable Object con SQLite (una sola instancia).
// Es lo único del menú de Cloudflare con topes por día y por mes sin carreras (docs-asistente/03, sección 7).
//
//  - `NucleoLimitador`: la lógica, sin Cloudflare. Recibe una `BaseSql` (en Node, node:sqlite; en el Durable Object, su SQLite).
//  - `Limitador`: la clase del Durable Object. Habla por `fetch` interno (no hace falta RPC ni extender clases de `cloudflare:`).
//  - `clienteDeNamespace` / `clienteDeNucleo`: lo que usa el Worker. Fallar acá es fallar cerrado: sin contador no se llama a Anthropic.
//
// Lo que se guarda: contadores con una clave que lleva la huella del visitante (HMAC diario de la IP) o el id de sesión.
// Nunca texto, nunca IP. Los contadores vencen a los 2 días (los mensuales, al mes siguiente) y se borran en `limpiar`.

export interface LimitesConfig {
	/** Sesiones nuevas por visitante y por hora. */
	sesionesHora: number;
	/** Mensajes por visitante y por minuto. */
	rafagaMin: number;
	/** Mensajes por visitante y por día UTC. */
	visitanteDia: number;
	/** Mensajes por sesión. */
	sesionMensajes: number;
	/** Mensajes globales por día UTC (variable TOPE_DIA). */
	topeDia: number;
	/** Mensajes globales por mes UTC (variable TOPE_MES). */
	topeMes: number;
}

export const LIMITES_INICIALES: LimitesConfig = {
	sesionesHora: 6,
	rafagaMin: 5,
	visitanteDia: 15,
	sesionMensajes: 10,
	topeDia: 40,
	topeMes: 500,
};

const entero = (texto: string | undefined, porDefecto: number): number => {
	if (texto === undefined || !/^\d{1,9}$/.test(texto.trim())) return porDefecto;
	return Number(texto.trim());
};

/** Lee TOPE_DIA y TOPE_MES (texto) del entorno; lo que falta o no es un entero no negativo usa el valor inicial. */
export function configDeEntorno(env: { TOPE_DIA?: string; TOPE_MES?: string }): LimitesConfig {
	return {
		...LIMITES_INICIALES,
		topeDia: entero(env.TOPE_DIA, LIMITES_INICIALES.topeDia),
		topeMes: entero(env.TOPE_MES, LIMITES_INICIALES.topeMes),
	};
}

export interface BaseSql {
	ejecutar(sql: string, ...params: (string | number)[]): void;
	filas(sql: string, ...params: (string | number)[]): Record<string, unknown>[];
	/** Todo o nada. */
	transaccion<T>(fn: () => T): T;
}

export type Motivo = 'sesion' | 'visitante' | 'global_dia' | 'global_mes';
export type ResultadoConsumo = { ok: true; restantes: number } | { ok: false; motivo: Motivo; reintentarEn: number };
export type ResultadoSesion = { ok: true } | { ok: false; motivo: 'visitante'; reintentarEn: number };

export const ESQUEMA = 'CREATE TABLE IF NOT EXISTS contadores (clave TEXT PRIMARY KEY, n INTEGER NOT NULL, vence INTEGER NOT NULL)';

const DIA = 86400;

/** `AAAA-MM-DD` del día UTC de un instante en segundos. */
const fechaDe = (s: number): string => new Date(s * 1000).toISOString().slice(0, 10);
const mesDe = (s: number): string => new Date(s * 1000).toISOString().slice(0, 7);
const inicioDeMesSiguiente = (s: number): number => {
	const d = new Date(s * 1000);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000;
};

interface Contador {
	clave: string;
	limite: number;
	vence: number;
	motivo: Motivo;
	reintentarEn: number;
}

export class NucleoLimitador {
	sql: BaseSql;
	config: LimitesConfig;

	constructor(sql: BaseSql, config: LimitesConfig) {
		this.sql = sql;
		this.config = config;
		sql.ejecutar(ESQUEMA);
	}

	private leer(clave: string): number {
		const f = this.sql.filas('SELECT n FROM contadores WHERE clave = ?', clave)[0];
		return f ? Number(f.n) : 0;
	}

	private sumar(clave: string, vence: number): void {
		this.sql.ejecutar(
			'INSERT INTO contadores (clave, n, vence) VALUES (?, 1, ?) ON CONFLICT(clave) DO UPDATE SET n = n + 1, vence = excluded.vence',
			clave,
			vence,
		);
	}

	private restar(clave: string): void {
		this.sql.ejecutar('UPDATE contadores SET n = MAX(n - 1, 0) WHERE clave = ?', clave);
	}

	/** Los contadores que cuenta un mensaje, en el orden en que se mira cuál rechaza. */
	private deMensaje(huella: string, sid: string, ahora: number): Contador[] {
		const c = this.config;
		const minuto = Math.floor(ahora / 60);
		const dia = fechaDe(ahora);
		const finDia = Math.floor(ahora / DIA) * DIA + DIA;
		const finMes = inicioDeMesSiguiente(ahora);
		return [
			{ clave: `ses:${sid}`, limite: c.sesionMensajes, vence: ahora + 2 * 3600, motivo: 'sesion', reintentarEn: 0 },
			{ clave: `raf:${huella}:${minuto}`, limite: c.rafagaMin, vence: (minuto + 2) * 60, motivo: 'visitante', reintentarEn: (minuto + 1) * 60 - ahora },
			{ clave: `vdia:${huella}:${dia}`, limite: c.visitanteDia, vence: finDia + DIA, motivo: 'visitante', reintentarEn: finDia - ahora },
			{ clave: `gdia:${dia}`, limite: c.topeDia, vence: finDia + DIA, motivo: 'global_dia', reintentarEn: finDia - ahora },
			{ clave: `gmes:${mesDe(ahora)}`, limite: c.topeMes, vence: finMes + 31 * DIA, motivo: 'global_mes', reintentarEn: finMes - ahora },
		];
	}

	/** Comprueba y suma, todo o nada: si alguno está lleno no se suma ninguno. */
	mensaje(a: { huella: string; sid: string; ahora: number }): ResultadoConsumo {
		return this.sql.transaccion((): ResultadoConsumo => {
			const lista = this.deMensaje(a.huella, a.sid, a.ahora);
			for (const k of lista) {
				if (this.leer(k.clave) >= k.limite) return { ok: false, motivo: k.motivo, reintentarEn: k.reintentarEn };
			}
			for (const k of lista) this.sumar(k.clave, k.vence);
			return { ok: true, restantes: this.config.sesionMensajes - this.leer(lista[0].clave) };
		});
	}

	/** Resta lo que `mensaje` sumó en ese mismo instante (el proveedor falló antes de producir texto). */
	devolver(a: { huella: string; sid: string; ahora: number }): void {
		this.sql.transaccion(() => {
			for (const k of this.deMensaje(a.huella, a.sid, a.ahora)) this.restar(k.clave);
		});
	}

	/** Cuenta una sesión nueva del visitante (y limpia lo vencido, que es la ocasión barata de hacerlo). */
	sesion(a: { huella: string; ahora: number }): ResultadoSesion {
		return this.sql.transaccion((): ResultadoSesion => {
			this.limpiar(a.ahora);
			const hora = Math.floor(a.ahora / 3600);
			const clave = `sv:${a.huella}:${hora}`;
			if (this.leer(clave) >= this.config.sesionesHora) return { ok: false, motivo: 'visitante', reintentarEn: (hora + 1) * 3600 - a.ahora };
			this.sumar(clave, (hora + 2) * 3600);
			return { ok: true };
		});
	}

	/** `abierto` es falso si se llegó al tope del día o del mes. */
	estado(ahora: number): { abierto: boolean } {
		const c = this.config;
		return { abierto: this.leer(`gdia:${fechaDe(ahora)}`) < c.topeDia && this.leer(`gmes:${mesDe(ahora)}`) < c.topeMes };
	}

	limpiar(ahora: number): void {
		this.sql.ejecutar('DELETE FROM contadores WHERE vence < ?', ahora);
	}

	cantidadDeContadores(): number {
		return Number(this.sql.filas('SELECT COUNT(*) AS n FROM contadores')[0]?.n ?? 0);
	}

	claves(): string[] {
		return this.sql.filas('SELECT clave FROM contadores').map((f) => String(f.clave));
	}
}

// ---------------------------------------------------------------------------------------------------------------------
// Lo que usa el Worker

export interface LimitadorCliente {
	sesion(a: { huella: string; ahora: number }): Promise<ResultadoSesion>;
	mensaje(a: { huella: string; sid: string; ahora: number }): Promise<ResultadoConsumo>;
	devolver(a: { huella: string; sid: string; ahora: number }): Promise<void>;
	estado(ahora: number): Promise<{ abierto: boolean }>;
}

/** El mismo contrato sobre un núcleo en memoria (pruebas y modo local). */
export function clienteDeNucleo(n: NucleoLimitador): LimitadorCliente {
	return {
		sesion: async (a) => n.sesion(a),
		mensaje: async (a) => n.mensaje(a),
		devolver: async (a) => n.devolver(a),
		estado: async (ahora) => n.estado(ahora),
	};
}

/** El cliente del Durable Object. Cualquier falla (tiempo, estado raro, JSON raro) lanza: el Worker responde 503 sin llamar a Anthropic. */
export function clienteDeNamespace(ns: NamespaceDO, tiempoMs = 2000): LimitadorCliente {
	const stub = () => ns.get(ns.idFromName('global'));
	async function llamar<T>(ruta: string, cuerpo: unknown): Promise<T> {
		const res = await stub().fetch(`https://limitador.interno${ruta}`, {
			method: 'POST',
			body: JSON.stringify(cuerpo),
			signal: AbortSignal.timeout(tiempoMs),
		});
		if (!res.ok) throw new Error(`limitador ${res.status}`);
		return (await res.json()) as T;
	}
	return {
		sesion: (a) => llamar<ResultadoSesion>('/sesion', a),
		mensaje: (a) => llamar<ResultadoConsumo>('/mensaje', a),
		devolver: async (a) => void (await llamar<unknown>('/devolver', a)),
		estado: (ahora) => llamar<{ abierto: boolean }>('/estado', { ahora }),
	};
}

// ---------------------------------------------------------------------------------------------------------------------
// El Durable Object

const esTexto = (x: unknown, re: RegExp): x is string => typeof x === 'string' && re.test(x);
const HUELLA = /^[0-9a-f]{16}$/;
const esAhora = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;

export class Limitador {
	nucleo: NucleoLimitador;

	constructor(estado: EstadoDO, env: { TOPE_DIA?: string; TOPE_MES?: string }) {
		const almacen = estado.storage;
		const base: BaseSql = {
			ejecutar: (sql, ...p) => void almacen.sql.exec(sql, ...p),
			filas: (sql, ...p) => almacen.sql.exec(sql, ...p).toArray(),
			transaccion: (fn) => almacen.transactionSync(fn),
		};
		this.nucleo = new NucleoLimitador(base, configDeEntorno(env));
	}

	async fetch(req: Request): Promise<Response> {
		const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } });
		if (req.method !== 'POST') return json({ error: 'metodo' }, 405);
		let c: Record<string, unknown>;
		try {
			c = (await req.json()) as Record<string, unknown>;
		} catch {
			return json({ error: 'json' }, 400);
		}
		const ruta = new URL(req.url).pathname;
		const { huella, sid, ahora } = c;
		if (!esAhora(ahora)) return json({ error: 'ahora' }, 400);
		if (ruta === '/estado') return json(this.nucleo.estado(ahora));
		if (!esTexto(huella, HUELLA)) return json({ error: 'huella' }, 400);
		if (ruta === '/sesion') return json(this.nucleo.sesion({ huella, ahora }));
		if (!esTexto(sid, HUELLA)) return json({ error: 'sid' }, 400);
		if (ruta === '/mensaje') return json(this.nucleo.mensaje({ huella, sid, ahora }));
		if (ruta === '/devolver') {
			this.nucleo.devolver({ huella, sid, ahora });
			return json({ ok: true });
		}
		return json({ error: 'ruta' }, 404);
	}
}
