// Lado del widget, parte pura: enlaces permitidos, formato de la respuesta (siempre como texto), textos y errores. npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enlacePermitido } from '../src/lib/asistente/enlaces.ts';
import { formatearRespuesta } from '../src/lib/asistente/formato.ts';
import { textosDe, textosExtraDe } from '../src/lib/asistente/textos.ts';
import { errorVistaDe } from '../src/lib/asistente/errores.ts';
import { correo, linkedin } from '../src/lib/sitio.ts';
import { cv, cvEn } from '../src/lib/datos-pendientes.ts';
import { construirIndice } from './asistente/generar-indice.mjs';
import { respuestaSimulada } from '../worker/src/simulado.ts';

const reglas = { correo, linkedin, cvs: [cv.logistica.archivo, cv.tecnico.archivo, cvEn.tecnico.archivo, cvEn.logistica.archivo] };
const permitido = (u) => enlacePermitido(u, reglas);

// --- Enlaces permitidos -------------------------------------------------------------------------------------------------

test('enlaces: las páginas internas del sitio valen', () => {
	for (const ruta of ['/casos/', '/casos/automatizacion-facturas/', '/casos/cargador-bajas/', '/#contacto', '/#demos', '/#proyectos', '/#tecnico', '/#logistica', '/demos/', '/proyectos/', '/tecnico/', '/logistica/', '/contacto/', cv.tecnico.archivo, cv.logistica.archivo]) {
		assert.deepEqual(permitido(ruta), { href: ruta, externo: false }, ruta);
	}
});

test('enlaces: el correo exacto, las tres demos, los repositorios públicos y el LinkedIn publicado', () => {
	assert.deepEqual(permitido(`mailto:${correo}`), { href: `mailto:${correo}`, externo: false });
	assert.deepEqual(permitido('https://facturas.matiasormeno.com.ar'), { href: 'https://facturas.matiasormeno.com.ar', externo: true });
	assert.deepEqual(permitido('https://flota.matiasormeno.com.ar/'), { href: 'https://flota.matiasormeno.com.ar', externo: true });
	assert.equal(permitido('https://tablero.matiasormeno.com.ar')?.externo, true);
	for (const repo of ['demo-lector-facturas', 'demo-control-flota', 'demo-tablero-gestion', 'portafolio']) {
		assert.equal(permitido(`https://github.com/aslow01/${repo}`)?.href, `https://github.com/aslow01/${repo}`, repo);
	}
	assert.equal(permitido(`https://github.com/aslow01/demo-control-flota/`)?.href, 'https://github.com/aslow01/demo-control-flota');
	assert.equal(permitido(linkedin)?.externo, true);
	// El mismo LinkedIn escrito sin los porcentajes también es ese enlace.
	assert.equal(permitido('https://www.linkedin.com/in/matías-ormeño-98208a3b3')?.href, linkedin);
});

test('enlaces: todo lo demás se rechaza', () => {
	const malos = [
		'',
		'javascript:alert(1)',
		'JaVaScRiPt:alert(1)',
		'data:text/html,<script>alert(1)</script>',
		'vbscript:x',
		'//evil.example/x',
		'\\\\evil.example',
		'https://evil.example',
		'http://facturas.matiasormeno.com.ar',
		'https://facturas.matiasormeno.com.ar.evil.example',
		'https://facturas.matiasormeno.com.ar@evil.example',
		'https://usuario:clave@facturas.matiasormeno.com.ar',
		'https://facturas.matiasormeno.com.ar:8443',
		'https://facturas.matiasormeno.com.ar/otra',
		'https://facturas.matiasormeno.com.ar/?x=1',
		'https://facturas.matiasormeno.com.ar/#x',
		'https://matiasormeno.com.ar/casos/',
		'https://github.com/otro/demo-control-flota',
		'https://github.com/aslow01/otro-repo',
		'https://github.com/aslow01/demo-control-flota/issues',
		'https://www.linkedin.com/in/otra-persona',
		'mailto:otro@ejemplo.org',
		`mailto:${correo}?cc=otro@ejemplo.org`,
		['tel:+549', '264', '0000000'].join(''),
		'/casos/../admin/',
		'/casos/Mayusculas/',
		'/casos/uno/dos/',
		'/casos/sin-barra',
		'/cv/otro.pdf',
		'/#otra',
		'/admin',
		'/',
		' /casos/',
		'/casos/ ',
		'/casos/\n',
		'/casos/' + 'a'.repeat(300) + '/',
	];
	for (const u of malos) assert.equal(permitido(u), null, JSON.stringify(u));
});

test('enlaces: toda URL del contexto del asistente y del modo de prueba está permitida', () => {
	const { texto } = construirIndice();
	const urls = new Set([
		...texto.matchAll(/https?:\/\/[^\s"<>)]+/g),
		...texto.matchAll(/(?<![\w/.])(\/(?:casos\/[a-z0-9-]*\/?|#[a-z]+|cv\/[\w.-]+))/g),
		...texto.matchAll(/(?<![\w/.])(\/en\/(?:casos\/[a-z0-9-]*\/?|#[a-z]+))/g),
		...texto.matchAll(/(?:demo|repo|url)="([^"]+)"/g),
	].map((m) => (m[1] && !m[0].startsWith('http') ? m[1] : m[0])));
	assert.ok(urls.size > 8, `solo ${urls.size} URL`);
	for (const u of urls) {
		if (u === '') continue; // demo sin enlace
		const limpia = u.replace(/[.,;:]+$/, '');
		assert.ok(permitido(limpia), `el contexto cita ${limpia}, que el widget no permite`);
	}
});

test('enlaces: los textos de prueba del Worker solo enlazan a destinos permitidos', () => {
	for (const msg of ['¿qué busca?', '¿qué demos hay?', '¿cómo lo contacto?', '¿qué hace la IA?', '¿hay un caso?', '/largo']) {
		for (const idioma of ['es', 'en']) {
			const r = respuestaSimulada(msg, idioma);
			assert.equal(r.tipo, 'texto');
			for (const m of r.texto.matchAll(/\]\(([^)]+)\)/g)) assert.ok(permitido(m[1]), `${msg}/${idioma}: ${m[1]}`);
		}
	}
});

// --- Formato de la respuesta -------------------------------------------------------------------------------------------

const f = (t, idioma = 'es') => formatearRespuesta(t, reglas, idioma);
const texto = (s, negrita = false) => ({ tipo: 'texto', texto: s, negrita });
const enlace = (t, href, externo = false) => ({ tipo: 'enlace', texto: t, href, externo });

test('formato: párrafos separados por línea en blanco; los saltos simples se juntan', () => {
	const r = f('Primero.\n\nSegundo renglón\ncontinúa acá.');
	assert.deepEqual(r.bloques, [
		{ tipo: 'parrafo', partes: [texto('Primero.')] },
		{ tipo: 'parrafo', partes: [texto('Segundo renglón continúa acá.')] },
	]);
	assert.deepEqual(r.fuentes, []);
});

test('formato: negrita, enlaces permitidos y enlaces sueltos', () => {
	const r = f('Es **muy** claro. Vea [el caso](/casos/automatizacion-facturas/) o https://flota.matiasormeno.com.ar, y también /#demos.');
	assert.deepEqual(r.bloques[0].partes, [
		texto('Es '),
		texto('muy', true),
		texto(' claro. Vea '),
		enlace('el caso', '/casos/automatizacion-facturas/'),
		texto(' o '),
		enlace('https://flota.matiasormeno.com.ar', 'https://flota.matiasormeno.com.ar', true),
		texto(', y también '),
		enlace('/#demos', '/#demos'),
		texto('.'),
	]);
});

test('formato: listas con guion, asterisco o número', () => {
	const r = f('Hay tres:\n- Uno\n- **Dos**\n* Tres\n\n1. Cuarto\n2) Quinto');
	assert.deepEqual(r.bloques, [
		{ tipo: 'parrafo', partes: [texto('Hay tres:')] },
		{ tipo: 'lista', items: [[texto('Uno')], [texto('Dos', true)], [texto('Tres')]] },
		{ tipo: 'lista', items: [[texto('Cuarto')], [texto('Quinto')]] },
	]);
});

test('formato: HTML, scripts y manejadores quedan como texto inerte, sin ninguna etiqueta ni enlace', () => {
	const sucio = '<img src=x onerror=alert(1)> y <script>alert(2)</script> y <a href="javascript:alert(3)">clic</a>';
	const r = f(sucio);
	assert.deepEqual(r.bloques, [{ tipo: 'parrafo', partes: [texto(sucio)] }]);
	assert.deepEqual(r.fuentes, []);
});

test('formato: enlaces peligrosos o ajenos se muestran como texto y sin href', () => {
	const r = f('[Toque acá](javascript:alert(1)) y [mire](https://evil.example/x) y [datos](data:text/html,hola) y https://evil.example/y y [otro](//evil.example)');
	for (const b of r.bloques) for (const p of b.partes) assert.notEqual(p.tipo, 'enlace', JSON.stringify(p));
	const plano = r.bloques[0].partes.map((p) => p.texto).join('');
	assert.match(plano, /Toque acá/);
	assert.match(plano, /mire/);
	assert.ok(!plano.includes('javascript:alert'));
});

test('formato: marcas sin cerrar quedan literales', () => {
	const r = f('Un **abierto y un [corchete](sin cierre y [x]( ).');
	assert.equal(r.bloques[0].partes.every((p) => p.tipo === 'texto'), true);
	assert.match(r.bloques[0].partes.map((p) => p.texto).join(''), /\*\*abierto/);
});

test('formato: se sacan caracteres de control y los que invierten el sentido del texto', () => {
	const r = f('a\u0000b\u001bc‮d​e﻿f\tg');
	assert.equal(r.bloques[0].partes.map((p) => p.texto).join(''), 'abcdef g');
});

test('formato: un título con # pierde los numerales y una respuesta vacía no dibuja nada', () => {
	assert.deepEqual(f('## Título\nTexto').bloques, [{ tipo: 'parrafo', partes: [texto('Título Texto')] }]);
	assert.deepEqual(f('').bloques, []);
	assert.deepEqual(f('  \n\n  ').bloques, []);
});

test('formato: una respuesta desmesurada se corta', () => {
	const r = f('a'.repeat(20_000));
	const total = r.bloques[0].partes.map((p) => p.texto).join('').length;
	assert.ok(total <= 6000);
});

test('fuentes: páginas internas distintas, con rótulos de una lista cerrada, máximo tres', () => {
	const r = f('[x](/#tecnico) [y](/#demos) [z](/#demos) [Facturas](/casos/automatizacion-facturas/) [Bajas](/casos/cargador-bajas/) [mail](mailto:' + correo + ') [CV](' + cv.tecnico.archivo + ') [demo](https://flota.matiasormeno.com.ar)');
	assert.deepEqual(r.fuentes, [
		{ href: '/#tecnico', texto: 'Técnico e IA' },
		{ href: '/#demos', texto: 'Demos' },
		{ href: '/casos/automatizacion-facturas/', texto: 'Caso: Facturas' },
	]);
});

test('fuentes: en inglés los rótulos van en inglés; un caso sin texto de enlace usa su identificador', () => {
	const r = f('/#tecnico y /casos/cargador-bajas/', 'en');
	assert.deepEqual(r.fuentes, [
		{ href: '/#tecnico', texto: 'Software & AI' },
		{ href: '/casos/cargador-bajas/', texto: 'Case: cargador bajas' },
	]);
});

test('fuentes: un texto de enlace largo se recorta', () => {
	const r = f(`[${'palabra '.repeat(30)}](/casos/cargador-bajas/)`);
	assert.ok(r.fuentes[0].texto.length <= 70);
});

// --- Textos --------------------------------------------------------------------------------------------------------------

test('textos: español e inglés completos, con el correo y el máximo ya puestos', () => {
	for (const idioma of ['es', 'en']) {
		const t = textosDe(idioma, { correo, max: 500 });
		assert.equal(t.sugerencias.length, 4);
		for (const k of ['red', 'tiempo', 'servicio', 'verificacion', 'limiteVisitante', 'limiteSesion', 'conversacionLarga', 'tope', 'largo', 'vacio']) {
			assert.ok(t.errores[k] && t.errores[k].length > 10, `${idioma}/${k}`);
		}
		const todo = JSON.stringify(t);
		assert.ok(!todo.includes('{correo}') && !todo.includes('{max}'), idioma);
		assert.ok(t.errores.red.includes(correo));
		assert.ok(t.errores.largo.includes('500'));
		for (const [k, v] of Object.entries(t)) {
			if (typeof v === 'string') assert.ok(v.trim() !== '', `${idioma}/${k} vacío`);
		}
	}
	assert.match(textosDe('es', { correo, max: 500 }).saludo, /asistente con IA/);
	assert.match(textosDe('en', { correo, max: 500 }).saludo, /AI assistant/);
	assert.match(textosExtraDe('es').quedan(1), /1 pregunta\b/);
	assert.match(textosExtraDe('es').quedan(3), /3 preguntas/);
});

test('textos: sin voseo en español neutro (de usted) y sin datos que la web no publica', () => {
	const es = JSON.stringify(textosDe('es', { correo, max: 500 }));
	assert.ok(!/\b(?:podés|tenés|querés|escribí|probá|vení|acá)\b/i.test(es));
	assert.ok(!/gmail|salario|sueldo/i.test(es));
});

// --- Errores del Worker → lo que se dibuja --------------------------------------------------------------------------------

test('errores: cada código del Worker se traduce a una clave, con sus botones', () => {
	const e = (codigo, extra = {}) => errorVistaDe({ codigo, ...extra });
	assert.deepEqual(e('red'), { clave: 'red', reintentable: true, ofrecerContacto: true, bloqueaFormulario: false });
	assert.deepEqual(e('tiempo_cliente'), { clave: 'tiempo', reintentable: true, ofrecerContacto: true, bloqueaFormulario: false });
	assert.deepEqual(e('proveedor_tiempo'), { clave: 'tiempo', reintentable: true, ofrecerContacto: true, bloqueaFormulario: false });
	for (const c of ['proveedor_error', 'error_interno', 'respuesta_invalida']) assert.equal(e(c).clave, 'servicio', c);
	assert.equal(e('turnstile_fallido').clave, 'verificacion');
	assert.equal(e('turnstile_fallido').reintentable, true);
	assert.deepEqual(e('limite_visitante', { reintentarEn: 600 }), { clave: 'limiteVisitante', reintentable: false, ofrecerContacto: true, bloqueaFormulario: true, reintentarEnSeg: 600 });
	assert.deepEqual(e('limite_sesion'), { clave: 'limiteSesion', reintentable: true, ofrecerContacto: true, bloqueaFormulario: false });
	assert.deepEqual(e('servicio_pausado', { reintentarEn: 3600 }), { clave: 'tope', reintentable: false, ofrecerContacto: true, bloqueaFormulario: true, reintentarEnSeg: 3600 });
	assert.deepEqual(e('cuerpo_demasiado_grande'), { clave: 'conversacionLarga', reintentable: false, ofrecerContacto: true, bloqueaFormulario: false });
	// Errores de programación o de configuración: contacto, sin reintentar.
	for (const c of ['solicitud_invalida', 'origen_no_permitido', 'no_encontrado', 'metodo_no_permitido', 'tipo_no_soportado']) {
		assert.deepEqual(e(c), { clave: 'servicio', reintentable: false, ofrecerContacto: true, bloqueaFormulario: false }, c);
	}
	assert.equal(e('sesion_invalida').clave, 'servicio');
	assert.equal(e('algo_desconocido').clave, 'servicio');
});

test('enlaces: con la lista de casos publicados, un caso que no existe se muestra como texto', () => {
	const conLista = { ...reglas, casos: ['automatizacion-facturas', 'cargador-bajas'] };
	assert.deepEqual(enlacePermitido('/casos/cargador-bajas/', conLista), { href: '/casos/cargador-bajas/', externo: false });
	assert.equal(enlacePermitido('/casos/caso-inventado/', conLista), null);
	assert.equal(enlacePermitido('/casos/cargador-bajas/', { ...reglas, casos: [] }), null);
	assert.deepEqual(enlacePermitido('/casos/', conLista), { href: '/casos/', externo: false });
	// Sin la lista (solo pruebas), vale cualquier forma válida.
	assert.notEqual(enlacePermitido('/casos/otro-caso/', reglas), null);
	assert.equal(enlacePermitido('/casos/Otro_Caso/', reglas), null);
});

// --- La versión en inglés (/en/) -----------------------------------------------------------------------------------------

test('enlaces en inglés: las mismas páginas bajo /en/ valen, con su dirección tal cual', () => {
	const conLista = { ...reglas, casos: ['cargador-bajas'] };
	for (const ruta of ['/en/casos/', '/en/casos/cargador-bajas/', '/en/#contacto', '/en/#demos', '/en/#proyectos', '/en/#tecnico', '/en/#logistica', '/en/demos/', '/en/proyectos/', '/en/tecnico/', '/en/logistica/', '/en/contacto/']) {
		assert.deepEqual(enlacePermitido(ruta, conLista), { href: ruta, externo: false }, ruta);
	}
	// Un caso que no existe sigue siendo texto, también en inglés.
	assert.equal(enlacePermitido('/en/casos/caso-inventado/', conLista), null);
});

test('enlaces en inglés: lo que no es una página del sitio no se cuela por el prefijo', () => {
	for (const u of ['/en/', '/en', '/en/en/casos/', '/en//evil.example', '/en/#otra', '/en/admin', '/en/casos/Mayusculas/', '/en/casos/uno/dos/', '/en/cv/otro.pdf', `/en${cv.tecnico.archivo}`, '/en/ casos/', '/EN/casos/', '/english/casos/']) {
		assert.equal(permitido(u), null, JSON.stringify(u));
	}
});

test('enlaces: el CV técnico en inglés vale si el sitio lo publica', () => {
	const archivo = cvEn.tecnico.archivo;
	assert.equal(enlacePermitido(archivo, { ...reglas, cvs: [cv.logistica.archivo, cv.tecnico.archivo] }), null);
	assert.deepEqual(permitido(archivo), { href: archivo, externo: false });
});

test('formato en inglés: una ruta suelta bajo /en/ es un enlace, y las fuentes llevan rótulos en inglés', () => {
	const r = f('See /en/#tecnico and [the case](/en/casos/cargador-bajas/), or /en/casos/.', 'en');
	assert.deepEqual(r.fuentes, [
		{ href: '/en/#tecnico', texto: 'Software & AI' },
		{ href: '/en/casos/cargador-bajas/', texto: 'Case: the case' },
		{ href: '/en/casos/', texto: 'Case studies' },
	]);
	const suelto = f('Mire /en/casos/cargador-bajas/ ahora', 'es');
	assert.equal(suelto.bloques[0].partes.find((p) => p.tipo === 'enlace')?.href, '/en/casos/cargador-bajas/');
	assert.equal(suelto.fuentes[0].texto, 'Caso: cargador bajas');
});

test('Worker simulado en inglés: enlaza a las páginas en inglés (/en/) y no avisa que el caso esté solo en español', () => {
	for (const msg of ['¿qué busca?', '¿qué demos hay?', '¿cómo lo contacto?', '¿qué hace la IA?', '¿hay un caso?']) {
		const r = respuestaSimulada(msg, 'en');
		for (const m of r.texto.matchAll(/\]\(([^)]+)\)/g)) {
			if (m[1].startsWith('/')) assert.ok(m[1].startsWith('/en/'), `${msg}: ${m[1]}`);
		}
		assert.doesNotMatch(r.texto, /\(in Spanish\)/); // los casos ya existen en inglés; las páginas de las demos siguen en español
	}
});
