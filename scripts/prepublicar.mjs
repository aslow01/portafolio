// Verificación completa antes de publicar: npm run prepublicar
// Corre, en orden, las pruebas (con el control del extracto OBLIGATORIO: si falta el repositorio de la demo,
// falla en vez de saltearlo), la revisión de tipos, el build, la comprobación de borradores en dist/, las pruebas que miran
// dist/ (se repiten con el build hecho y dist/ obligatorio) y la higiene de dist/ (sin datos privados, estilos ni scripts en línea, y páginas noindex fuera del sitemap; EXIGIR_DIST=1).
// Se detiene en el primer paso que falla. Ver el README ("Antes de publicar").
// Al final, si hay PUBLIC_ASISTENTE_URL, compara la huella del contexto del asistente con la del Worker desplegado (/v1/salud):
// si difieren avisa que falta redesplegar el Worker, pero NO bloquea.
// No corre `npm audit` ni `verificar:paginas`: se ejecutan aparte (ver el README).
import { spawnSync } from 'node:child_process';
import { construirIndice } from './asistente/generar-indice.mjs';
import { compararConDesplegado } from './asistente/huella-salud.mjs';

const PASOS = [
	['Pruebas (con el extracto obligatorio)', 'test'],
	['Tipos y plantillas', 'run check'],
	['Build', 'run build'],
	['Que dist/ no contenga borradores', 'run verificar'],
	['Estructura de dist/ (páginas, enlaces, ids, sitemap, redirecciones: las pruebas que miran el build)', 'test', { EXIGIR_DIST: '1' }],
	['Higiene de dist/ (datos privados, estilos y scripts en línea, sitemap)', 'run higiene', { EXIGIR_DIST: '1' }],
];

const env = { ...process.env, EXIGIR_EXTRACTO: '1' };

for (const [titulo, comando, extra] of PASOS) {
	console.log(`\n== ${titulo}: npm ${comando}`);
	// `shell: true` hace falta para encontrar npm en Windows; los comandos son fijos, sin datos externos.
	const r = spawnSync(`npm ${comando}`, { stdio: 'inherit', env: { ...env, ...extra }, shell: true });
	if (r.status !== 0) {
		console.error(`\nFALLO en "${titulo}". No publique hasta que pase.`);
		process.exit(r.status ?? 1);
	}
}

// Aviso, no paso: el Worker se despliega aparte y puede no estar publicado todavía.
console.log('\n== Huella del asistente: local contra el Worker desplegado (solo avisa)');
try {
	const r = await compararConDesplegado({ url: process.env.PUBLIC_ASISTENTE_URL ?? '', huellaLocal: construirIndice().huella });
	console.log(r.mensaje);
} catch {
	console.log('AVISO: no se pudo calcular la huella local del contexto del asistente; no se comparó.');
}
console.log('\nprepublicar: todo en verde.');
