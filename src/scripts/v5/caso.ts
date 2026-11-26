// Complemento de la página de caso (molde «Expediente»). El resto del comportamiento (paginador, lomos, teclado, cortina)
// lo hace pestanas.ts, que la página ya carga. Acá solo se le dice a la cortina de qué color subir al salir:
//   · «Inicio» sube hueso (el fondo de la portada);
//   · «Volver» al pie de la hoja sube del color de la carpeta (el enlace está sobre papel claro: sin esto tomaría el claro).
// Los colores se leen de los tokens ya definidos en CSS (tokens.css): no se repite ningún valor acá.
// Sin script no hay cortina y los enlaces navegan directo, así que nada depende de esto.

// Acá se carga el script de las fichas (pestanas.ts): BaseV5 ya no lo pone en todas las páginas (la 404 va sin JS), y
// al importarlo corre antes que el resto de este módulo. Que el script no quede en línea en el HTML (la política de
// contenido no lo admite) lo asegura `vite.build.assetsInlineLimit: 0` (astro.config.mjs).
import './pestanas';

const hueso = getComputedStyle(document.documentElement).getPropertyValue('--hueso').trim();
const expediente = document.querySelector<HTMLElement>('.expediente');
const carpeta = expediente ? getComputedStyle(expediente).getPropertyValue('--fondo').trim() : '';

if (hueso) document.querySelector<HTMLAnchorElement>('.lomos .inicio a')?.setAttribute('data-color', hueso);
if (carpeta) expediente?.querySelectorAll<HTMLAnchorElement>('a.volver[data-salir]').forEach((a) => a.setAttribute('data-color', carpeta));
