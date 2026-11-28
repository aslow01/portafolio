// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { esRedireccion } from './src/lib/redirecciones.ts';

// https://astro.build/config
export default defineConfig({
	site: 'https://matiasormeno.com.ar',
	// Dos idiomas: español en `/` (por defecto) e inglés bajo `/en/` (i18n nativa de Astro; las páginas en inglés están en
	// src/pages/en/). El sitemap lista las dos versiones y las enlaza entre sí con `xhtml:link` (hreflang).
	i18n: {
		defaultLocale: 'es',
		locales: ['es', 'en'],
		routing: { prefixDefaultLocale: false },
	},
	// Las direcciones viejas que redirigen a la portada (lib/redirecciones.ts) llevan noindex y no entran al sitemap.
	integrations: [
		sitemap({
			filter: (pagina) => !esRedireccion(pagina),
			i18n: { defaultLocale: 'es', locales: { es: 'es-AR', en: 'en' } },
		}),
	],
	build: {
		// Nada de <style> en línea: así la política de contenido (public/_headers) no necesita 'unsafe-inline'.
		inlineStylesheets: 'never',
	},
	vite: {
		build: {
			// Astro mete en el HTML los scripts de menos de 4 KB (y las imágenes chicas como `data:`), y la política de
			// contenido (public/_headers: script-src 'self', img-src 'self') no los admite. Con 0 todo sale como archivo.
			assetsInlineLimit: 0,
		},
	},
});
