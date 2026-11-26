// El extracto de prueba que muestra la web tiene que ser literal: se compara contra el archivo real
// de los repositorios de la demo (el de trabajo y el público). Node puro: npm test
//
// Dónde se busca (reglas en src/lib/repos-demo.ts): D:\demo-<slug> y D:\demo-<slug>-publico, o las
// variables RUTA_DEMO_<SLUG> y RUTA_DEMO_<SLUG>_PUBLICO. Si no hay ningún repositorio, la comprobación
// se saltea con un aviso, salvo que CI o EXIGIR_EXTRACTO=1 estén definidos (npm run prepublicar):
// ahí falla. Una variable RUTA_DEMO_* que apunta a una carpeta inexistente falla siempre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extraerLineas, sinSangriaComun, compararExtracto } from '../src/lib/extracto.ts';
import { repositoriosDeDemo } from '../src/lib/repos-demo.ts';
import { leerPrueba } from './frontmatter.mjs';

const archivo = ['uno', '  dos', '  tres', '', 'cinco'].join('\n');

test('extraerLineas: rango 1-based e inclusivo', () => {
	assert.deepEqual(extraerLineas(archivo, 2, 3), ['  dos', '  tres']);
	assert.deepEqual(extraerLineas(archivo, 1, 1), ['uno']);
	assert.deepEqual(extraerLineas('a\r\nb\r\nc', 2, 3), ['b', 'c']);
});

test('extraerLineas: un rango fuera del archivo es un error, no un recorte', () => {
	assert.throws(() => extraerLineas(archivo, 4, 6), RangeError);
	assert.throws(() => extraerLineas(archivo, 0, 2), RangeError);
	assert.throws(() => extraerLineas(archivo, 3, 2), RangeError);
});

test('sinSangriaComun: saca solo la sangría que comparten todas las líneas con texto', () => {
	assert.deepEqual(sinSangriaComun(['  a', '    b', '', '  c']), ['a', '  b', '', 'c']);
	assert.deepEqual(sinSangriaComun(['a', '  b']), ['a', '  b']);
	assert.deepEqual(sinSangriaComun([]), []);
});

test('compararExtracto: coincide aunque cambien el fin de línea, los espacios finales o la sangría común', () => {
	const r = compararExtracto('x\r\n  dos  \r\n  tres\r\n', { desde: 2, hasta: 3, codigo: 'dos\ntres\n' });
	assert.deepEqual(r, { coincide: true });
});

test('compararExtracto: si difiere, dice la primera línea distinta (con su número en el archivo)', () => {
	const r = compararExtracto(archivo, { desde: 2, hasta: 3, codigo: 'dos\ntres cambiada' });
	assert.equal(r.coincide, false);
	assert.match(r.detalle, /línea 3/);
	assert.match(r.detalle, /tres cambiada/);
});

test('compararExtracto: una línea de más o de menos también difiere', () => {
	assert.equal(compararExtracto(archivo, { desde: 2, hasta: 3, codigo: 'dos' }).coincide, false);
	assert.equal(compararExtracto(archivo, { desde: 2, hasta: 3, codigo: 'dos\ntres\ncuatro' }).coincide, false);
});

test('compararExtracto: un rango que ya no existe en el archivo difiere, con explicación', () => {
	const r = compararExtracto(archivo, { desde: 4, hasta: 9, codigo: 'x' });
	assert.equal(r.coincide, false);
	assert.match(r.detalle, /no existe|tiene 5 líneas/);
});

test('compararExtracto: un extracto de solo espacios o tabulaciones no coincide con nada', () => {
	const conBlancos = ['uno', '   ', '\t', 'cuatro'].join('\n');
	for (const codigo of ['   ', '\t\t', ' \n\t\n  ', '']) {
		const r = compararExtracto(conBlancos, { desde: 2, hasta: 3, codigo });
		assert.equal(r.coincide, false, JSON.stringify(codigo));
		assert.match(r.detalle, /vacío/);
	}
});

test('compararExtracto: una tabulación y espacios no son lo mismo', () => {
	assert.equal(compararExtracto('\tdos\n\ttres', { desde: 1, hasta: 2, codigo: '  dos\n  tres' }).coincide, true); // sangría común
	assert.equal(compararExtracto('a\n\tb', { desde: 1, hasta: 2, codigo: 'a\n  b' }).coincide, false);
});

test('compararExtracto: un archivo con líneas de solo blancos dentro del rango se compara como líneas vacías', () => {
	const f = ['x', '  uno', '   ', '  dos'].join('\n');
	assert.equal(compararExtracto(f, { desde: 2, hasta: 4, codigo: 'uno\n\ndos' }).coincide, true);
});

// --- Dónde está el repositorio de la demo (src/lib/repos-demo.ts) ---

const entorno = (env = {}, existentes = []) => ({ env, existe: (r) => existentes.includes(r) });

test('repositorios: sin nada que encontrar, saltea con un aviso que dice cómo comprobarlo', () => {
	const r = repositoriosDeDemo('lector-facturas', entorno());
	assert.equal(r.estado, 'saltear');
	assert.match(r.mensaje, /RUTA_DEMO_LECTOR_FACTURAS/);
	assert.match(r.mensaje, /EXIGIR_EXTRACTO/);
});

test('repositorios: sin nada que encontrar, falla si CI o EXIGIR_EXTRACTO=1', () => {
	for (const env of [{ CI: 'true' }, { CI: '1' }, { EXIGIR_EXTRACTO: '1' }]) {
		const r = repositoriosDeDemo('lector-facturas', entorno(env));
		assert.equal(r.estado, 'fallar', JSON.stringify(env));
	}
	for (const env of [{ CI: '' }, { CI: 'false' }, { CI: '0' }, { EXIGIR_EXTRACTO: '0' }, { EXIGIR_EXTRACTO: '' }]) {
		assert.equal(repositoriosDeDemo('lector-facturas', entorno(env)).estado, 'saltear', JSON.stringify(env));
	}
});

test('repositorios: usa D:/demo-<slug> y también el público si existen', () => {
	const solo = repositoriosDeDemo('lector-facturas', entorno({}, ['D:/demo-lector-facturas']));
	assert.deepEqual(solo, { estado: 'comprobar', rutas: ['D:/demo-lector-facturas'] });
	const ambos = repositoriosDeDemo('lector-facturas', entorno({}, ['D:/demo-lector-facturas', 'D:/demo-lector-facturas-publico']));
	assert.deepEqual(ambos.rutas, ['D:/demo-lector-facturas', 'D:/demo-lector-facturas-publico']);
	const publico = repositoriosDeDemo('lector-facturas', entorno({}, ['D:/demo-lector-facturas-publico']));
	assert.deepEqual(publico.rutas, ['D:/demo-lector-facturas-publico']);
});

test('repositorios: las variables RUTA_DEMO_* reemplazan a las rutas por defecto', () => {
	const r = repositoriosDeDemo(
		'lector-facturas',
		entorno({ RUTA_DEMO_LECTOR_FACTURAS: '/x/trabajo', RUTA_DEMO_LECTOR_FACTURAS_PUBLICO: '/x/publico' }, ['/x/trabajo', '/x/publico', 'D:/demo-lector-facturas']),
	);
	assert.deepEqual(r, { estado: 'comprobar', rutas: ['/x/trabajo', '/x/publico'] });
});

test('repositorios: una variable RUTA_DEMO_* que apunta a algo inexistente falla siempre, aunque haya otro repositorio', () => {
	const r = repositoriosDeDemo(
		'lector-facturas',
		entorno({ RUTA_DEMO_LECTOR_FACTURAS: '/no/existe' }, ['D:/demo-lector-facturas']),
	);
	assert.equal(r.estado, 'fallar');
	assert.match(r.mensaje, /RUTA_DEMO_LECTOR_FACTURAS/);
	assert.match(r.mensaje, /\/no\/existe/);
	// También la del repositorio público, y una variable definida pero vacía.
	assert.equal(repositoriosDeDemo('lector-facturas', entorno({ RUTA_DEMO_LECTOR_FACTURAS_PUBLICO: '/no' })).estado, 'fallar');
	assert.equal(repositoriosDeDemo('lector-facturas', entorno({ RUTA_DEMO_LECTOR_FACTURAS: '' }, ['D:/demo-lector-facturas'])).estado, 'fallar');
});

// --- Control contra los repositorios reales ---

const base = fileURLToPath(new URL('..', import.meta.url));
const carpetaDemos = join(base, 'src', 'content', 'demos');

/** El archivo en el commit indicado (si la demo declara `commit`) o, si no, tal como está en la carpeta. */
function leerArchivoDelRepo(raiz, prueba) {
	if (!prueba.commit) {
		const ruta = resolve(raiz, prueba.archivo);
		if (!existsSync(ruta)) throw new Error(`no existe ${prueba.archivo} en ${raiz}`);
		return readFileSync(ruta, 'utf8');
	}
	try {
		return execFileSync('git', ['-C', raiz, 'show', `${prueba.commit}:${prueba.archivo}`], {
			encoding: 'utf8',
			maxBuffer: 10 * 1024 * 1024,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
	} catch {
		throw new Error(`git no encuentra ${prueba.archivo} en el commit ${prueba.commit} de ${raiz}`);
	}
}

for (const nombre of readdirSync(carpetaDemos).filter((f) => f.endsWith('.md'))) {
	const slug = nombre.replace(/\.md$/, '');
	const { prueba, problemas } = leerPrueba(readFileSync(join(carpetaDemos, nombre), 'utf8'));

	test(`el contenido de ${slug} se puede leer sin ambigüedades`, () => {
		assert.deepEqual(problemas, []);
	});
	if (!prueba) continue;

	test(`el extracto de ${slug} (${prueba.archivo}, ${prueba.desde}–${prueba.hasta}) es literal`, (t) => {
		const repos = repositoriosDeDemo(slug, { env: process.env, existe: existsSync });
		if (repos.estado === 'fallar') assert.fail(repos.mensaje);
		if (repos.estado === 'saltear') {
			console.warn(repos.mensaje);
			t.skip(repos.mensaje);
			return;
		}
		for (const raiz of repos.rutas) {
			const r = compararExtracto(leerArchivoDelRepo(raiz, prueba), prueba);
			assert.ok(
				r.coincide,
				`el extracto de "${slug}" ya no coincide con ${raiz}: ${r.detalle}. Actualice el contenido antes de publicar.`,
			);
		}
	});
}
