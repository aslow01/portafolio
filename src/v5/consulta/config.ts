// La bandera del asistente: cuándo se monta y en qué modo. Pura (sin Astro ni DOM): scripts/consulta.test.mjs.
// La validación de las variables del build es la de src/lib/asistente/config.ts; acá solo se suma el modo simulado de desarrollo.
//
//   · Producción sin `PUBLIC_ASISTENTE_URL`: APAGADO. El sitio queda como estaba (sin lanzador, sin hoja, sin cambios en el
//     paginador ni en el riel). Es el estado por defecto hasta que Matías cargue la clave del Worker.
//   · Producción con `PUBLIC_ASISTENTE_URL` válida: `real`, contra el Worker.
//   · `npm run dev` sin URL: `simulado` (respuestas de prueba hechas en el navegador, sin red ni clave).
//   · `npm run dev` con `http://localhost:…`: `prueba-local` (el Worker local, con sus respuestas simuladas).
// El modo `simulado` NUNCA sale en un build de producción: `dev` es `import.meta.env.DEV`, que Vite fija en `false` al compilar.
import { leerConfigDeEntorno } from '../../lib/asistente/config.ts';

export type ModoConsulta = 'real' | 'prueba-local' | 'simulado';

export interface ConfiguracionConsulta {
	modo: ModoConsulta;
	/** Origen del Worker, sin barra final. Vacío en modo simulado. */
	api: string;
	/** Clave pública (site key) de Turnstile. Vacía en modo simulado y, a veces, en prueba local. */
	sitekey: string;
}

export interface EntornoConsulta {
	dev: boolean;
	url?: string | undefined;
	sitekey?: string | undefined;
}

/** `null` = el asistente no se monta. */
export function configuracionConsulta({ dev, url, sitekey }: EntornoConsulta): ConfiguracionConsulta | null {
	const c = leerConfigDeEntorno({ PUBLIC_ASISTENTE_URL: url, PUBLIC_TURNSTILE_SITEKEY: sitekey }, !dev);
	if (c.activo) return { modo: c.modoPrueba ? 'prueba-local' : 'real', api: c.urlApi, sitekey: c.sitekey ?? '' };
	if (dev && (url ?? '').trim() === '') return { modo: 'simulado', api: '', sitekey: '' };
	return null;
}

/** ¿La hoja muestra el sello «Modo de prueba»? Con respuestas que no vienen del modelo, siempre. */
export const esModoPrueba = (modo: string | undefined): boolean => modo === 'simulado' || modo === 'prueba-local';
