// Declaraciones mínimas, escritas a mano, de lo que el Worker usa de Cloudflare (sin sumar @cloudflare/workers-types).
// Son globales: no hay `import` ni `export` en este archivo.

interface CursorSql {
	toArray(): Record<string, unknown>[];
}

interface AlmacenDO {
	sql: { exec(consulta: string, ...parametros: (string | number)[]): CursorSql };
	transactionSync<T>(fn: () => T): T;
}

/** El primer argumento del constructor de un Durable Object. */
interface EstadoDO {
	storage: AlmacenDO;
}

interface StubDO {
	fetch(url: string, init?: RequestInit): Promise<Response>;
}

interface IdDO {
	readonly nombre?: never;
}

interface NamespaceDO {
	idFromName(nombre: string): IdDO;
	get(id: IdDO): StubDO;
}
