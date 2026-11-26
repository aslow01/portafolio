// Verifica que dist/ (build de producción) no contenga nada de lo marcado como borrador.
// Uso: npm run build && npm run verificar
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerFrontmatter, esBorrador } from './frontmatter.mjs';

const base = fileURLToPath(new URL('..', import.meta.url));
const dist = join(base, 'dist');
const contenido = join(base, 'src', 'content');

function listar(dir) {
	const salida = [];
	for (const nombre of readdirSync(dir)) {
		const ruta = join(dir, nombre);
		if (statSync(ruta).isDirectory()) salida.push(...listar(ruta));
		else salida.push(ruta);
	}
	return salida;
}

if (!existsSync(dist)) {
	console.error('No existe dist/. Ejecutá primero: npm run build');
	process.exit(1);
}

// Borradores: estado "borrador" o borrador: true, en cualquier colección. Si un encabezado no se
// puede leer, se corta: no se puede asegurar que su contenido no esté en dist/.
const borradores = [];
const ilegibles = [];
for (const archivo of listar(contenido).filter((f) => f.endsWith('.md'))) {
	const { datos, problemas } = leerFrontmatter(readFileSync(archivo, 'utf8'));
	const nombre = archivo.slice(contenido.length + 1).split(sep).join('/');
	for (const p of problemas) ilegibles.push(`${nombre}: ${p}`);
	if (esBorrador(datos)) {
		const slug = archivo.split(sep).pop().replace(/\.md$/, '');
		// También se busca el título (casos y proyectos): nombrar un borrador en otra página lo publica.
		borradores.push({ slug, titulo: datos.titulo, archivo });
	}
}
if (ilegibles.length) {
	console.error(`FALLO: hay ${ilegibles.length} problema(s) al leer los encabezados de src/content:`);
	for (const i of ilegibles) console.error(' - ' + i);
	process.exit(1);
}

const textuales = new Set(['.html', '.xml', '.txt', '.json', '.js', '.css', '.map']);
const fallos = [];
for (const archivo of listar(dist)) {
	const rutaRel = archivo.slice(dist.length + 1).split(sep).join('/');
	const texto = textuales.has(extname(archivo)) ? readFileSync(archivo, 'utf8') : '';
	for (const b of borradores) {
		if (rutaRel.includes(b.slug)) fallos.push(`${rutaRel}: la ruta contiene el slug "${b.slug}"`);
		if (texto.includes(b.slug)) fallos.push(`${rutaRel}: menciona el slug "${b.slug}"`);
		if (b.titulo && texto.includes(b.titulo)) fallos.push(`${rutaRel}: menciona el título "${b.titulo}"`);
	}
}

if (fallos.length) {
	console.error(`FALLO: se filtraron borradores en dist/ (${fallos.length}):`);
	for (const f of fallos) console.error(' - ' + f);
	process.exit(1);
}
console.log(`OK: ${borradores.length} borradores revisados, ninguno aparece en dist/.`);
