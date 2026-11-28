// Límites del asistente (worker/src/limitador.ts): contadores atómicos sobre SQLite. node:sqlite hace de base. npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { LIMITES_INICIALES, NucleoLimitador } from '../worker/src/limitador.ts';

/** Una base en memoria con la forma que el Durable Object le da al núcleo. */
function nueva(config = {}) {
	const db = new DatabaseSync(':memory:');
	const sql = {
		ejecutar: (q, ...p) => void db.prepare(q).run(...p),
		filas: (q, ...p) => db.prepare(q).all(...p),
		transaccion: (fn) => {
			db.exec('BEGIN');
			try {
				const r = fn();
				db.exec('COMMIT');
				return r;
			} catch (e) {
				db.exec('ROLLBACK');
				throw e;
			}
		},
	};
	return new NucleoLimitador(sql, { ...LIMITES_INICIALES, ...config });
}

const T0 = Date.UTC(2026, 10, 27, 12, 0, 0) / 1000; // 27/11/2026 12:00 UTC
const arg = (extra = {}) => ({ huella: 'aaaaaaaaaaaaaaaa', sid: '1111111111111111', ahora: T0, ...extra });

test('un mensaje normal pasa y devuelve cuántos quedan en la sesión', () => {
	const l = nueva();
	assert.deepEqual(l.mensaje(arg()), { ok: true, restantes: 9 });
	assert.deepEqual(l.mensaje(arg({ ahora: T0 + 1 })), { ok: true, restantes: 8 });
});

test('el mensaje 11 de una sesión se rechaza como «sesion»', () => {
	const l = nueva({ visitanteDia: 1000, rafagaMin: 1000 });
	for (let i = 0; i < 10; i++) assert.equal(l.mensaje(arg({ ahora: T0 + i })).ok, true, `mensaje ${i + 1}`);
	const r = l.mensaje(arg({ ahora: T0 + 21 }));
	assert.equal(r.ok, false);
	assert.equal(r.motivo, 'sesion');
});

test('el 6.º mensaje del minuto se rechaza; al minuto siguiente vuelve a pasar', () => {
	const l = nueva();
	for (let i = 0; i < 5; i++) assert.equal(l.mensaje(arg({ ahora: T0 + i })).ok, true);
	const r = l.mensaje(arg({ ahora: T0 + 6 }));
	assert.equal(r.ok, false);
	assert.equal(r.motivo, 'visitante');
	assert.equal(r.reintentarEn, 54); // hasta el próximo minuto cerrado
	assert.equal(l.mensaje(arg({ ahora: T0 + 61 })).ok, true);
});

test('el mensaje 16 del día de un visitante se rechaza, aunque cambie de sesión', () => {
	const l = nueva({ topeDia: 10_000 });
	for (let i = 0; i < 15; i++) {
		const r = l.mensaje(arg({ ahora: T0 + i * 60, sid: `s${Math.floor(i / 10)}`.padEnd(16, '0') }));
		assert.equal(r.ok, true, `mensaje ${i + 1}: ${JSON.stringify(r)}`);
	}
	const r = l.mensaje(arg({ ahora: T0 + 16 * 60, sid: 's9'.padEnd(16, '0') }));
	assert.equal(r.ok, false);
	assert.equal(r.motivo, 'visitante');
	// Pasa la medianoche UTC: otro día.
	assert.equal(r.reintentarEn, 12 * 3600 - 16 * 60);
});

test('el mensaje 41 global del día se rechaza (de cualquier visitante) y a la medianoche se renueva', () => {
	const l = nueva({ topeDia: 40 });
	for (let i = 0; i < 40; i++) {
		const huella = String(i).padStart(16, '0');
		assert.equal(l.mensaje(arg({ huella, sid: huella, ahora: T0 + i })).ok, true, `mensaje ${i + 1}`);
	}
	const r = l.mensaje(arg({ huella: 'f'.repeat(16), sid: 'f'.repeat(16), ahora: T0 + 200 }));
	assert.deepEqual([r.ok, r.motivo], [false, 'global_dia']);
	assert.equal(l.estado(T0 + 200).abierto, false);
	const manana = T0 + 12 * 3600 + 5;
	assert.equal(l.estado(manana).abierto, true);
	assert.equal(l.mensaje(arg({ huella: 'e'.repeat(16), sid: 'e'.repeat(16), ahora: manana })).ok, true);
});

test('el tope mensual global corta y avisa hasta cuándo', () => {
	const l = nueva({ topeDia: 10_000, topeMes: 3 });
	for (let i = 0; i < 3; i++) {
		const h = String(i).padStart(16, '0');
		assert.equal(l.mensaje(arg({ huella: h, sid: h, ahora: T0 + i })).ok, true);
	}
	const r = l.mensaje(arg({ huella: 'd'.repeat(16), sid: 'd'.repeat(16), ahora: T0 + 10 }));
	assert.deepEqual([r.ok, r.motivo], [false, 'global_mes']);
	assert.equal(r.reintentarEn, Date.UTC(2026, 11, 1) / 1000 - (T0 + 10));
	assert.equal(l.estado(T0 + 10).abierto, false);
});

test('un rechazo no consume nada: si la sesión está llena, el global no sube', () => {
	const l = nueva({ topeDia: 11, visitanteDia: 1000, rafagaMin: 1000 });
	for (let i = 0; i < 10; i++) l.mensaje(arg({ ahora: T0 + i }));
	assert.equal(l.mensaje(arg({ ahora: T0 + 30 })).ok, false); // sesión llena
	// Queda 1 en el global del día: otro visitante todavía pasa.
	const otro = { huella: 'b'.repeat(16), sid: 'b'.repeat(16), ahora: T0 + 31 };
	assert.equal(l.mensaje(otro).ok, true);
	assert.equal(l.mensaje({ ...otro, ahora: T0 + 32 }).ok, false);
});

test('devolver restaura el cupo (por ejemplo, si el proveedor falló antes de producir texto)', () => {
	const l = nueva({ topeDia: 1, rafagaMin: 1, visitanteDia: 1 });
	assert.equal(l.mensaje(arg()).ok, true);
	assert.equal(l.mensaje(arg({ ahora: T0 + 1 })).ok, false);
	l.devolver(arg());
	assert.deepEqual(l.mensaje(arg({ ahora: T0 + 2 })), { ok: true, restantes: 9 });
	// Devolver de más no deja contadores negativos.
	l.devolver(arg());
	l.devolver(arg());
	l.devolver(arg());
	assert.equal(l.mensaje(arg({ ahora: T0 + 3 })).ok, true);
	assert.equal(l.mensaje(arg({ ahora: T0 + 4 })).ok, false);
});

test('sesiones nuevas: 6 por hora por visitante', () => {
	const l = nueva();
	for (let i = 0; i < 6; i++) assert.equal(l.sesion({ huella: 'a'.repeat(16), ahora: T0 + i }).ok, true, `sesión ${i + 1}`);
	const r = l.sesion({ huella: 'a'.repeat(16), ahora: T0 + 10 });
	assert.deepEqual([r.ok, r.motivo], [false, 'visitante']);
	assert.equal(r.reintentarEn, 3600 - 10);
	assert.equal(l.sesion({ huella: 'c'.repeat(16), ahora: T0 + 10 }).ok, true); // otro visitante
	assert.equal(l.sesion({ huella: 'a'.repeat(16), ahora: T0 + 3600 }).ok, true); // otra hora
});

test('las sesiones no consumen mensajes ni a la inversa', () => {
	const l = nueva({ rafagaMin: 1 });
	l.sesion({ huella: 'a'.repeat(16), ahora: T0 });
	assert.equal(l.mensaje(arg()).ok, true);
});

test('la limpieza borra solo lo vencido', () => {
	const l = nueva();
	l.sesion({ huella: 'a'.repeat(16), ahora: T0 });
	l.mensaje(arg());
	const antes = l.cantidadDeContadores();
	assert.ok(antes >= 5);
	l.limpiar(T0 + 60);
	assert.equal(l.cantidadDeContadores(), antes); // nada venció todavía
	l.limpiar(T0 + 40 * 86400);
	assert.equal(l.cantidadDeContadores(), 0);
});

test('lo que guarda son solo contadores con huella: ni IP ni texto', () => {
	const l = nueva();
	l.mensaje(arg());
	const claves = l.claves();
	assert.ok(claves.length > 0);
	for (const c of claves) assert.doesNotMatch(c, /\d+\.\d+\.\d+\.\d+|@|hola/i);
});

test('la configuración se lee de variables de texto, con valores por defecto si faltan o son raros', async () => {
	const { configDeEntorno } = await import('../worker/src/limitador.ts');
	assert.equal(configDeEntorno({ TOPE_DIA: '50', TOPE_MES: '900' }).topeDia, 50);
	assert.equal(configDeEntorno({ TOPE_DIA: '50', TOPE_MES: '900' }).topeMes, 900);
	assert.equal(configDeEntorno({}).topeDia, LIMITES_INICIALES.topeDia);
	assert.equal(configDeEntorno({ TOPE_DIA: 'muchos' }).topeDia, LIMITES_INICIALES.topeDia);
	assert.equal(configDeEntorno({ TOPE_DIA: '-3' }).topeDia, LIMITES_INICIALES.topeDia);
	assert.equal(configDeEntorno({ TOPE_DIA: '0' }).topeDia, 0); // 0 = cerrado a propósito
});

test('gasto mínimo (pedido del 28/11/2026): worker/wrangler.toml y los valores iniciales dicen lo mismo', async () => {
	const { readFileSync } = await import('node:fs');
	const toml = readFileSync(new URL('../worker/wrangler.toml', import.meta.url), 'utf8');
	const valor = (nombre) => /"([^"]*)"/.exec(toml.split(String.fromCharCode(10)).find((l) => l.startsWith(`${nombre} `)) ?? '')?.[1];
	assert.equal(valor('MODELO'), 'claude-haiku-5-5');
	assert.equal(valor('MAX_TOKENS_SALIDA'), '300');
	assert.equal(valor('TOPE_DIA'), '40');
	assert.equal(valor('TOPE_MES'), '500');
	assert.equal(Number(valor('TOPE_DIA')), LIMITES_INICIALES.topeDia);
	assert.equal(Number(valor('TOPE_MES')), LIMITES_INICIALES.topeMes);
	assert.equal(LIMITES_INICIALES.visitanteDia, 15);
	assert.equal(LIMITES_INICIALES.sesionMensajes, 10);
});
