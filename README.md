# Portafolio de Matías Ariel Ormeño (web)

Código del sitio https://matiasormeno.com.ar. El sitio está en español.

## In English

Personal portfolio site of Matías Ariel Ormeño (https://matiasormeno.com.ar). It has two paths, logistics and mining, and technical and AI, with anonymised case studies, three live demos with fictitious data, and personal creative projects.

Stack: Astro (static site, generated into `dist/`), TypeScript, deployed on Cloudflare Pages. To run it: `npm install`, then `npm run dev` for development or `npm run build` for the static build.

Conceived, designed and directed by Matías Ariel Ormeño; built with AI.

The site content and the rest of this README are in Spanish.

## Qué es

Un portafolio con dos caminos (logística y minería, y técnico e IA), casos de estudio anonimizados, demos propias con datos ficticios y proyectos creativos.

El diseño es la versión 5, «Mezcla». La portada es una pila de cinco pestañas, como un fichero: Logística y minería, Técnico e IA, Demos, Proyectos y Contacto. Cada pestaña abre su ficha a pantalla completa, dividida en páginas que caben en la pantalla sin desplazarse. El texto usa Bricolage Grotesque y Schibsted Grotesk; el código, Red Hat Mono. Hay un solo tema, el claro.

### Páginas

| Ruta | Qué muestra |
| --- | --- |
| `/` | La portada y sus cinco fichas. |
| `/tecnico/` | El camino técnico y de IA, en páginas: el caso principal, sus pruebas y, al final, las dos piezas propias (Método y Laboratorio). |
| `/casos/` | **El cajón**: el índice de casos de estudio. Una pila de expedientes, uno por caso publicado, cada uno con su solapa (número y camino) y el título. Al tocar uno se abre el caso. Entra en una sola pantalla y admite hasta ocho casos; con más, el build falla y pide rediseñar la página. |
| `/casos/<caso>/` | Un caso de estudio anonimizado: problema, qué se construyó y resultado, con una sección «Mi parte y autoría». |
| `/logistica/`, `/demos/`, `/contacto/`, `/proyectos/` | Solo redirigen a su ficha de la portada (`/#<ficha>`). Quedan fuera del sitemap, pero llevan las etiquetas de vista previa (descripción e imagen), porque los rastreadores de LinkedIn y WhatsApp no siguen la redirección. |
| 404 | Página de error con los lomos de las secciones. |

A `/casos/` se llega desde la tapa de `/tecnico/`, desde la ficha de Logística y desde «Más casos», al pie de cada caso. La cantidad de casos que se muestra se calcula del contenido; no se escribe a mano.

### Método y Laboratorio

Dos piezas propias del camino técnico, publicadas:

- **Método con Claude**: cómo trabaja el autor con un asistente de IA (reglas, agentes y guardas de seguridad).
- **Laboratorio de modelos**: pruebas para elegir qué modelo de IA conviene a cada tarea de código.

Son las dos últimas páginas de `/tecnico/` (`#metodo` y `#laboratorio`) y una página más, «Herramientas propias», en la ficha Técnico de la portada. Cada una lleva, detrás de su carta, la solapa «+ Quién hizo qué» con tres filas: Mi parte, Autoría y Cómo lo verifiqué. Son proyectos de `src/content/proyectos/` con `camino: tecnico`.

### Imágenes para compartir

Al pegar un enlace en LinkedIn, WhatsApp o un correo se ve una imagen de 1200 × 630 px que es una pieza del propio sitio: la portada muestra la pila de pestañas con el nombre; Técnico y Logística, su ficha con la solapa de color; `/casos/`, el cajón de expedientes; y cada caso, su tapa con el título y, si la tiene, la cifra con su medición. Hay una por página que se indexa, no una por camino (las redirecciones y la 404 usan la de la portada, y `/logistica/` la de Logística), y cada una lleva su texto alternativo.

Se generan a mano, no en el build:

```
node scripts/og/generar.mjs
```

El script usa Playwright como `verificar:paginas` (no es dependencia; ver más abajo las variables `PLAYWRIGHT_MODULO` y `CHROMIUM_RUTA`), dibuja cada lámina desde `scripts/og/plantilla.html` y `scripts/og/og.css` con los textos de `src/`, y escribe `public/og/<clave>-<huella>.png` y `src/lib/imagenes-sociales.ts` (este último no se edita a mano). El nombre lleva la huella del contenido, así que si algo cambia el archivo es otro y los rastreadores no siguen mostrando el viejo; `public/_headers` los guarda para siempre. Hay que volver a generarlas al cambiar el título, el corte, los caminos, el orden o la cifra de un caso publicado, el titular, las minas o las fichas. No hace falta acordarse: `npm test` falla y dice qué correr.

## Cómo se hizo

Matías Ariel Ormeño diseñó el sitio, decidió qué se muestra y qué no, dirigió el trabajo y verificó el resultado. **El código, los estilos y las pruebas se desarrollaron con una IA (Claude, de Anthropic) bajo su dirección**: los commits llevan su coautoría. Las revisiones de código, de accesibilidad y las pruebas de uso las hicieron también agentes de IA; las decisiones de contenido y de diseño son de Matías.

Matías cursa la Tecnicatura Universitaria en Programación a Distancia (UTN). En este sitio delegó la escritura del código en la IA y se ocupó de dirigirla: qué construir, cómo probarlo y qué revisar antes de publicar. El pie de la ficha de Contacto lo dice también: «Sitio diseñado y dirigido por mí; desarrollado con IA».

## Stack

- [Astro](https://astro.build) con colecciones de contenido y TypeScript. Sitio estático: se genera en `dist/`.
- `@astrojs/sitemap` para el mapa del sitio.
- `@astrojs/check` y `typescript` para verificar tipos.
- Sin otras dependencias. Sumar una requiere justificarla.
- JavaScript propio en el navegador: unas 1.200 líneas de TypeScript en `src/scripts/v5/` (pestañas, cortinas entre páginas, hojas de código y autoría). El contenido de las páginas se puede leer sin JavaScript; las animaciones y el cambio de pestañas lo necesitan.
- Los estilos van en archivos aparte (sin `style` en línea) para que la política de contenido no necesite `'unsafe-inline'`.

## Cómo correr

Node 22.23.4 o superior y npm.

```
npm ci             # instala las versiones exactas de package-lock.json (o npm install)
npm run dev        # servidor local en http://localhost:4321 (muestra también los borradores)
npm run build      # genera dist/ (solo lo publicable)
npm run preview    # sirve dist/ tal como saldrá
```

## Cómo verificar

```
npm test             # pruebas de las reglas de contenido, de las cabeceras, de higiene y de las imágenes para compartir (Node, sin navegador); si existe dist/, también lo revisa
npm run check        # tipos y plantillas (astro check)
npm run verificar    # comprueba que dist/ no contenga nada marcado como borrador (correr después de build)
npm run higiene      # busca datos privados, estilos y scripts en línea y páginas noindex en el sitemap (también corre dentro de npm test)
npm run prepublicar  # todo lo anterior, en orden, con el control del extracto obligatorio
npm run verificar:paginas  # navegador (Playwright): cada página de cada ficha entra en su pantalla; correr después de build
npm run verificar:interacciones  # navegador (Playwright): foco, historial, doble clic en las hojas y pantallas bajas; correr después de build
npm audit --audit-level=high  # dependencias sin vulnerabilidades altas ni críticas (necesita conexión)
```

Además, a mano: abrir `npm run preview` a 320, 360 y 1280 px, recorrer con Tab (el foco se ve siempre) y probar con JavaScript desactivado.

### Verificación de las páginas (navegador)

`npm run verificar:paginas` sirve `dist/` y abre la portada con cada una de sus cinco fichas abiertas, `/tecnico/`, `/casos/`, cada caso y la 404, en seis tamaños de pantalla (de 320 × 640 a 1440 × 900, en vertical y apaisado). Falla si una página de una ficha no entra en su pantalla (los topes están en `scripts/criterios-pantalla.mjs`), si la página desborda en horizontal, si una captura que enlaza una demo no tiene un `alt` que empiece con «Probar la demo», si una imagen no carga o si hay errores de consola. No forma parte de `npm test` ni de `prepublicar`, y no agrega dependencias: Playwright no está en `package.json`. Para correrlo:

```
npm install --no-save playwright
npx playwright install chromium
npm run verificar:paginas
```

`npm run verificar:interacciones` usa el mismo Playwright y las mismas variables y comprueba lo que solo se ve con un navegador real: adónde queda el foco al cargar, cambiar de ficha o cerrar una hoja, que «Atrás» no deje una entrada repetida tras recargar, que las flechas pasen de página recién cargada la página, que un doble clic no cierre una hoja y que la portada y la tapa de Logística entren en pantallas bajas. Tampoco forma parte de `npm test` ni de `prepublicar`.

Variables opcionales: `PLAYWRIGHT_MODULO` (carpeta `node_modules` que ya tenga Playwright), `CHROMIUM_RUTA` (ejecutable de Chromium), `PUERTO`, `TAMANOS`, `PAGINAS` (lista separada por comas) y `CAPTURAS` (carpeta donde guardar una captura por página y tamaño).

## Cómo está organizado

```
src/content/casos/      casos de estudio (anonimizados)
src/content/demos/      demos propias
src/content/proyectos/  proyectos creativos y piezas propias del camino técnico
src/lib/                reglas puras (visibilidad, textos derivados, esquemas, datos del sitio), con pruebas en scripts/; `imagenes-sociales.ts` lo escribe el generador
src/pages/              rutas
src/v5/                 portada, fichas, lomos, la página de caso y el índice de casos
src/scripts/v5/         comportamiento en el navegador (TypeScript, sin dependencias)
src/styles/v5/          sistema de diseño: tokens, fuentes, sistema compartido, portada e interiores
src/assets/capturas/    capturas de las demos (Astro las optimiza)
public/fonts/           fuentes autoalojadas, cada una con su licencia OFL
public/cv/              los dos CV descargables, uno por camino (PDF)
public/_headers         política de contenido (CSP) y demás cabeceras de seguridad
public/og/              imágenes para compartir (1200 x 630), una por página, con la huella en el nombre (las genera scripts/og/)
scripts/                pruebas (Node) y verificaciones
scripts/og/             generador de las imágenes para compartir: plantilla, estilos, lista de láminas y `generar.mjs`
```

### El contenido vive en colecciones

Cada elemento es un archivo `.md` con encabezado (frontmatter) y texto. Se agrega el archivo y aparece en las listas y en su propia página. Los campos y valores permitidos están en `src/content.config.ts`; si falta un campo o un valor no es válido, el build falla con un mensaje.

- **Caso**: `titulo`, `resumen`, `caminos` (`logistica` y/o `tecnico`), `orden`, `estado` (`borrador` o `publicado`). Opcionales: `corte`, `regla`, `uso`, `contexto`, `lineaObra`, `rol`, `resultado`, `demo`, `destacado`, `autoria`.
- **Demo**: `titulo`, `resumen`, `estado` (`en-preparacion`, `en-desarrollo` o `en-vivo`), `orden`. Opcionales: `subdominio`, `repo`, `demo`, `aviso`, `stack`, `laminas` (capturas con `alt`, `pie` y `procedencia`), `prueba` (extracto literal de una prueba, comprobado contra el repositorio de la demo), `caso`, `pruebaUrl`, `autoria`.
- **Proyecto**: `titulo`, `tipo` (`novela`, `juego` u `otro`), `resumen`, `estado` (`en-preparacion`, `en-desarrollo` o `terminado`), `orden`. Opcionales: `camino` (`proyectos`, por defecto, o `tecnico` para las piezas propias de `/tecnico/`), `pagina`, `enlaces`, `borrador`, `autoria`.
- `autoria` tiene tres filas opcionales: `yo`, `ia` y `verificacion`. Una fila vacía no se muestra.

Las direcciones externas (`repo`, `demo`, `pruebaUrl`, `enlaces`) deben ser `https`. La cifra de un resultado solo se muestra si trae `medicion` (qué se midió y cuándo).

### El extracto de prueba es literal

`prueba` muestra un fragmento real de un test de la demo: `archivo`, `desde`–`hasta` (máximo 30 líneas), `codigo` (el texto, con bloque literal `|`), `regla` y `queDice` (en castellano, se muestran junto al código), `titular` (frase corta para la ficha de la demo), `autoria` y, opcional, `commit` (hash del commit del repositorio de la demo donde están esas líneas).

`npm test` compara `codigo` con el archivo real del repositorio de la demo. Se ignoran el fin de línea, los espacios al final de cada línea y la sangría común; cualquier otra diferencia falla y dice la primera línea distinta. Si `prueba` tiene `commit`, se compara contra ese commit (`git show`) y no contra la carpeta de trabajo.

La carpeta del repositorio de la demo se indica con una variable de entorno por demo (el repositorio de trabajo y el público, si existen, se comparan los dos):

| Qué | Variable de entorno |
| --- | --- |
| Repositorio de trabajo | `RUTA_DEMO_<SLUG>` |
| Repositorio público | `RUTA_DEMO_<SLUG>_PUBLICO` |

`<SLUG>` es el nombre del archivo de la demo en mayúsculas y con guiones bajos: `lector-facturas` pasa a `RUTA_DEMO_LECTOR_FACTURAS`. Sin las variables, el test busca en rutas fijas del equipo del autor (ver `src/lib/repos-demo.ts`); en otro equipo conviene clonar las demos y definir las variables.

- Una variable `RUTA_DEMO_*` que apunta a una carpeta que no existe (o está vacía) **falla siempre**: un error de tipeo no apaga el control.
- Si no hay ningún repositorio, el test **se saltea con un aviso** (visible en la salida y en el recuento de salteados), salvo que `CI` o `EXIGIR_EXTRACTO=1` estén definidos: ahí **falla**.
- `npm run prepublicar` define `EXIGIR_EXTRACTO=1`, así que no se puede publicar sin haber comprobado el extracto.

### Borradores

Un caso con `estado: borrador`, o cualquier elemento con `borrador: true`, se ve en `npm run dev` y no sale en `npm run build`. Ninguna página lo lista, lo enlaza ni lo nombra. `npm run verificar` lo comprueba sobre `dist/`: busca el nombre del archivo y el título de cada borrador, y falla si no puede leer un encabezado.

La lista de casos publicados está escrita a mano en `scripts/dist.mjs`, a propósito: las pruebas la comparan con el contenido, y publicar un caso exige tocar esa lista, que se ve en el diff.

## Antes de publicar

`npm run prepublicar` corre en orden `npm test` (con el extracto obligatorio), `npm run check`, `npm run build`, `npm run verificar`, las pruebas que miran `dist/` y `npm run higiene` sobre `dist/`, y se detiene en el primer fallo. Hay que correrlo en un equipo que tenga los repositorios de las demos (o con las variables `RUTA_DEMO_*` apuntando a ellos). No ejecuta `npm audit` ni `verificar:paginas`: se corren aparte.

### Higiene

`scripts/higiene.test.mjs` (parte de `npm test`) falla si en `src/`, `public/`, `scripts/`, este archivo o `dist/` aparece una palabra de la lista local de términos prohibidos, una dirección de Gmail, un CUIT o CUIL, o un teléfono que no sea el público de `src/lib/datos-pendientes.ts`. Sobre `dist/` también falla ante `style=`, `<style`, `<script` en línea, manejadores `on…=`, recursos de otros orígenes o URI `data:`, y si una página con `noindex` figura en el sitemap.

Los términos prohibidos no están escritos en el repositorio (es público), ni en claro ni como hash. Van en `scripts/higiene.local.json`, que está en `.gitignore`; `npm run prepublicar` falla si ese archivo no existe o no tiene palabras. Formato:

```json
{ "palabras": ["palabra-prohibida", "dominio-de-ejemplo.com"], "expresiones": ["cliente[-_ ]?uno"] }
```

## Seguridad

- `public/_headers` define la política de contenido (CSP) y otras cabeceras para Cloudflare Pages. Todo el CSS sale en archivos aparte (`inlineStylesheets: 'never'`) y los scripts también (`assetsInlineLimit: 0`), así que la política no usa `'unsafe-inline'`.
- Sin analítica: la política solo admite el propio origen. Lleva también `Cross-Origin-Opener-Policy: same-origin`. `Strict-Transport-Security` (HSTS) se activa en la zona de Cloudflare al publicar, no en `_headers`.
- Las pruebas de `npm test` incluyen esa política.

## Publicación

El sitio se publica en Cloudflare Pages, a partir de la carpeta `dist/` que genera `npm run build`. Los datos de las demos y de los ejemplos son ficticios; los casos de estudio están anonimizados.

## Documentación de diseño

La especificación de diseño (decisiones, medidas y prototipos) vive en un repositorio privado. Los comentarios del código que remiten a ella («sección 1.2», «§11.4»…) no se pueden seguir desde este repositorio; lo que el código necesita para funcionar está en el código y en sus pruebas.

## Licencia

- El **código** (plantillas, estilos y scripts) es MIT: ver [`LICENSE`](LICENSE).
- Los **textos, las capturas y las imágenes** son © Matías Ariel Ormeño, todos los derechos reservados. Que el repositorio sea público no los libera.
- Las **fuentes** Bricolage Grotesque, Schibsted Grotesk y Red Hat Mono están bajo la licencia SIL OFL 1.1; cada una tiene su texto en `public/fonts/` (`OFL*.txt`).
